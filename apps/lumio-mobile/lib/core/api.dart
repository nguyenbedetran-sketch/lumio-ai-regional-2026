import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'models.dart';
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
  LumioApi(this.origin, {this.token, http.Client Function()? clientFactory})
    : _clientFactory = clientFactory ?? http.Client.new;
  final Uri origin;
  final String? token;
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
  }) async {
    final client = _clientFactory();
    _clients.add(client);
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    request.followRedirects =
        false; // Never leak a bearer token to a redirected origin.
    try {
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
          code = j['error'] is String ? j['error'] : j['code'];
          tutor = TutorSnapshot.tryParse(j['tutor']);
        } catch (_) {}
        throw ApiFailure(code ?? 'HTTP_${response.statusCode}', tutor: tutor);
      }
      if (audio &&
          !(response.headers['content-type'] ?? '').startsWith('audio/')) {
        throw const ApiFailure('INVALID_AUDIO');
      }
      return result;
    } on TimeoutException {
      throw const ApiFailure('TIMEOUT');
    } on SocketException {
      throw const ApiFailure('NETWORK_ERROR');
    } on http.ClientException {
      throw const ApiFailure('NETWORK_ERROR');
    } finally {
      _clients.remove(client);
      client.close();
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
    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType('audio', 'mp4'),
      ),
    );
    final result = object(jsonDecode(utf8.decode(await _send(request))));
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
