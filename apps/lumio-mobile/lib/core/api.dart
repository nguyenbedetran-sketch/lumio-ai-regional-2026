import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:crypto/crypto.dart';

import 'models.dart';
import 'paid_intents.dart';
import 'tutor_session.dart';
import 'web_sync.dart';

class ApiFailure implements Exception {
  const ApiFailure(this.code, {this.tutor});
  final String code;
  final TutorSnapshot? tutor;
  bool get invalidatesTutorSession => const [
    'TUTOR_SESSION_NOT_FOUND',
    'TUTOR_CONTEXT_CHANGED',
    'SESSION_REVOKED',
    'SIGN_IN_REQUIRED',
    'ACCOUNT_CHANGED',
    'INVALID_ACCOUNT',
  ].contains(code);
  @override
  String toString() => code;
}

Uri validateServer(String raw, {bool allowLocal = kDebugMode}) {
  final url = Uri.tryParse(raw.trim());
  if (url == null ||
      !url.hasAuthority ||
      url.userInfo.isNotEmpty ||
      url.query.isNotEmpty ||
      url.fragment.isNotEmpty ||
      (url.path.isNotEmpty && url.path != '/')) {
    throw const ApiFailure('INVALID_SERVER');
  }
  final host = url.host;
  final private = const [
    'localhost',
    '127.0.0.1',
    '::1',
    '10.0.2.2',
  ].contains(host);
  if (url.scheme != 'https' &&
      !(allowLocal && url.scheme == 'http' && private)) {
    throw const ApiFailure('HTTPS_REQUIRED');
  }
  return url.replace(path: '', query: null, fragment: null);
}

class MobileSession {
  const MobileSession({
    required this.token,
    required this.origin,
    required this.id,
    required this.name,
    required this.expiresAt,
  });
  final String token, origin, id, name;
  final DateTime expiresAt;
  String get scope => '$origin::$id';
  Map<String, dynamic> toJson() => {
    'accessToken': token,
    'origin': origin,
    'user': {'id': id, 'name': name},
    'expiresAt': expiresAt.toIso8601String(),
  };
  factory MobileSession.fromJson(Map<String, dynamic> j, [String? server]) {
    final user = object(j['user']);
    if (j['accessToken'] is! String ||
        (j['accessToken'] as String).length < 24 ||
        user['id'] is! String) {
      throw const ApiFailure('INVALID_RESPONSE');
    }
    final expiresAt = j['expiresAt'] is num
        ? DateTime.fromMillisecondsSinceEpoch((j['expiresAt'] as num).toInt())
        : readDate(j['expiresAt']);
    return MobileSession(
      token: j['accessToken'],
      origin: server ?? j['origin'],
      id: user['id'],
      name: user['name'] ?? 'Lumio',
      expiresAt: expiresAt,
    );
  }
}

class LumioApi {
  LumioApi(
    this.origin, {
    this.token,
    String? canonicalUserId,
    PaidIntentRegistry? paidIntents,
    http.Client Function()? clientFactory,
  }) : _canonicalUserId = canonicalUserId,
       _paidIntents = paidIntents ?? PaidIntentRegistry.secure(),
       _clientFactory = clientFactory ?? http.Client.new;
  final Uri origin;
  final String? token;
  String? _canonicalUserId;
  PaidIntentRegistry _paidIntents;
  bool Function()? _sessionCurrent;
  void bindCanonicalUser(
    String? userId, {
    PaidIntentRegistry? paidIntents,
    bool Function()? sessionCurrent,
  }) {
    if (_canonicalUserId != null && _canonicalUserId != userId) {
      throw const ApiFailure('ACCOUNT_CHANGED');
    }
    _canonicalUserId = userId;
    if (paidIntents != null) _paidIntents = paidIntents;
    _sessionCurrent = sessionCurrent;
  }

  void _checkPaidAccount() {
    if (token == null ||
        token!.isEmpty ||
        _canonicalUserId == null ||
        _canonicalUserId!.trim().isEmpty) {
      throw const ApiFailure('SIGN_IN_REQUIRED');
    }
    if (_sessionCurrent?.call() == false) {
      throw const ApiFailure('ACCOUNT_CHANGED');
    }
  }

  Future<void> clearUncertainPaidRequests() async {
    _checkPaidAccount();
    try {
      await _paidIntents.clearUncertain(origin, _canonicalUserId!);
    } on PaidIntentFailure catch (e) {
      throw ApiFailure(e.code);
    }
  }

  final http.Client Function() _clientFactory;
  final Set<http.Client> _clients = {};
  void cancel() {
    for (final client in _clients.toList()) {
      client.close();
    }
    _clients.clear();
  }

  Uri endpoint(String path) => origin.resolve(path);
  Future<Uint8List> _send(
    http.BaseRequest request, {
    int limit = 8 * 1024 * 1024,
    bool audio = false,
    String? paidStamp,
  }) async {
    final paid =
        request.method == 'POST' &&
        const ['/api/ai', '/api/voice'].contains(request.url.path);
    PaidIntentLease? intent;
    http.Client? client;
    if (request.url.origin != origin.origin) {
      throw const ApiFailure('INVALID_SERVER');
    }
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    if (_canonicalUserId != null) {
      request.headers['X-Lumio-User'] = _canonicalUserId!;
    }
    request.followRedirects =
        false; // Never leak a bearer token to a redirected origin.
    try {
      if (paid) {
        _checkPaidAccount();
        final stamp =
            paidStamp ?? (request is http.Request ? request.body : null);
        if (stamp == null) {
          throw const ApiFailure('AI_REQUEST_METADATA_INVALID');
        }
        intent = await _paidIntents.begin(
          origin,
          _canonicalUserId!,
          request.url.path,
          stamp,
        );
        _checkPaidAccount();
        request.headers['Idempotency-Key'] = intent.key;
      }
      client = _clientFactory();
      _clients.add(client);
      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 125));
      final bytes = BytesBuilder();
      await for (final chunk in response.stream.timeout(
        const Duration(seconds: 125),
      )) {
        if (bytes.length + chunk.length > limit) {
          throw const ApiFailure('RESPONSE_TOO_LARGE');
        }
        bytes.add(chunk);
      }
      final result = bytes.takeBytes();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        String? code;
        TutorSnapshot? tutor;
        try {
          final j = object(jsonDecode(utf8.decode(result)));
          final rawCode = j['error'] is String ? j['error'] : j['code'];
          code =
              rawCode is String &&
                  RegExp(r'^[A-Z][A-Z0-9_]{1,80}$').hasMatch(rawCode)
              ? rawCode
              : null;
          tutor = TutorSnapshot.tryParse(j['tutor']);
          if (intent != null &&
              code != null &&
              response.statusCode < 500 &&
              !const [
                'AI_REQUEST_IN_PROGRESS',
                'AI_REQUEST_COMPLETED',
                'AI_REQUEST_CONFLICT',
                'AI_REQUEST_UNSETTLED',
              ].contains(code)) {
            await _paidIntents.acknowledge(intent);
          }
          // A gateway may return a readable JSON 5xx after the origin has
          // settled the charge. Keep this UUID until an explicit retry returns
          // its authoritative failed/completed receipt; never retry here.
        } catch (_) {}
        throw ApiFailure(code ?? 'HTTP_${response.statusCode}', tutor: tutor);
      }
      if (audio &&
          (!response.headers.entries.any(
                (header) =>
                    header.key.toLowerCase() == 'content-type' &&
                    header.value.toLowerCase().startsWith('audio/'),
              ) ||
              result.isEmpty)) {
        throw const ApiFailure('INVALID_AUDIO');
      }
      if (intent != null) {
        if (!audio) {
          try {
            object(jsonDecode(utf8.decode(result)));
          } catch (_) {
            throw const ApiFailure('INVALID_RESPONSE');
          }
        }
        // A parsed response is the ACK. If clearing metadata fails, preserve
        // its old UUID rather than allowing an unrecorded duplicate operation.
        try {
          await _paidIntents.acknowledge(intent);
        } on PaidIntentFailure {
          /* Safe retained receipt. */
        }
        _checkPaidAccount();
      }
      return result;
    } on PaidIntentFailure catch (e) {
      throw ApiFailure(e.code);
    } on TimeoutException {
      throw const ApiFailure('TIMEOUT');
    } on SocketException {
      throw const ApiFailure('NETWORK_ERROR');
    } on http.ClientException {
      throw const ApiFailure('NETWORK_ERROR');
    } finally {
      if (intent != null) _paidIntents.release(intent);
      if (client != null) {
        _clients.remove(client);
        client.close();
      }
    }
  }

  Future<Map<String, dynamic>> json(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final request = http.Request(method, endpoint(path));
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    final bytes = await _send(request);
    if (bytes.isEmpty) return {};
    try {
      return object(jsonDecode(utf8.decode(bytes)));
    } catch (_) {
      throw const ApiFailure('INVALID_RESPONSE');
    }
  }

  Future<MobileSession> pair(String code, String device) async =>
      MobileSession.fromJson(
        await json('POST', '/api/mobile/pair/exchange', {
          'code': code.trim(),
          'deviceName': device,
        }),
        origin.toString(),
      );
  Future<Map<String, dynamic>> account() => json('GET', '/api/mobile/account');

  /// A separate canonical web snapshot, never native LibraryData serialization.
  WebSyncTransport webSync(String canonicalUserId) =>
      _ApiWebSync(this, canonicalUserId);
  Future<void> revoke() async {
    await json('DELETE', '/api/mobile/account');
  }

  Future<Map<String, dynamic>> study({
    required String task,
    required String source,
    required String language,
    String question = '',
    List<Map<String, String>> history = const [],
    String? tutorSessionId,
    String guidance = 'hints',
  }) => json('POST', '/api/ai', {
    'task': task,
    'source': source,
    'question': question,
    'language': language,
    'mode': 'tutor',
    // Chat history is canonical on the server. The argument is retained for
    // source compatibility, but client messages never authorize tutor progress.
    'history': task == 'chat'
        ? <Map<String, String>>[]
        : history.take(6).toList(),
    if (task == 'chat' && tutorSessionId != null)
      'tutorSessionId': tutorSessionId,
    if (task == 'chat') 'guidance': guidance,
  });
  Future<String> transcribe(File file, String language) async {
    if (await file.length() > 8 * 1024 * 1024) {
      throw const ApiFailure('AUDIO_TOO_LARGE');
    }
    final request = http.MultipartRequest('POST', endpoint('/api/voice'));
    request.fields['language'] = language;
    final chunks = BytesBuilder();
    await for (final chunk in file.openRead()) {
      if (chunks.length + chunk.length > 8 * 1024 * 1024) {
        throw const ApiFailure('AUDIO_TOO_LARGE');
      }
      chunks.add(chunk);
    }
    final bytes = chunks.takeBytes();
    final filename = file.uri.pathSegments.last;
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
        contentType: MediaType('audio', 'mp4'),
      ),
    );
    final stamp = jsonEncode([
      'transcribe',
      language,
      filename,
      'audio/mp4',
      bytes.length,
      sha256.convert(bytes).toString(),
    ]);
    final result = object(
      jsonDecode(utf8.decode(await _send(request, paidStamp: stamp))),
    );
    if (result['text'] is! String) throw const ApiFailure('INVALID_RESPONSE');
    return result['text'];
  }

  Future<Uint8List> speak(String text, String language, String voice) async {
    if (text.isEmpty || text.length > 3000) {
      throw const ApiFailure('SPEECH_TOO_LONG');
    }
    final request = http.Request('POST', endpoint('/api/voice'));
    request.headers['Content-Type'] = 'application/json';
    request.body = jsonEncode({
      'text': text,
      'language': language,
      'voice': voice,
    });
    return _send(request, audio: true);
  }
}

class _ApiWebSync implements WebSyncTransport {
  _ApiWebSync(this.api, this.userId) {
    if (userId.trim().isEmpty || userId.length > 200) {
      throw const WebSyncFailure('INVALID_ACCOUNT');
    }
  }
  final LumioApi api;
  final String userId;
  Future<Map<String, dynamic>> _request(
    String method, [
    Map<String, dynamic>? body,
  ]) async {
    final request = http.Request(method, api.endpoint('/api/sync'));
    request.headers['X-Lumio-User'] = userId;
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    try {
      final result = await api._send(request, limit: maxWebSyncBytes + 16384);
      return object(jsonDecode(utf8.decode(result)));
    } on ApiFailure catch (e) {
      throw WebSyncFailure(e.code);
    } on WebSyncFailure {
      rethrow;
    } catch (_) {
      throw const WebSyncFailure('INVALID_RESPONSE');
    }
  }

  @override
  Future<Map<String, dynamic>> read() => _request('GET');
  @override
  Future<Map<String, dynamic>> write(Map<String, dynamic> body) =>
      _request('PUT', body);
  @override
  Future<void> delete({required String epoch, required int revision}) async {
    await _request('DELETE', {'epoch': epoch, 'revision': revision});
  }

  @override
  void cancel() => api.cancel();
}
