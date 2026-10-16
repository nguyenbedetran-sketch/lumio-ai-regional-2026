import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class PaidIntentFailure implements Exception {
  const PaidIntentFailure(this.code);
  final String code;
}

abstract interface class PaidIntentStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
}

class SecurePaidIntentStorage implements PaidIntentStorage {
  SecurePaidIntentStorage(this.storage);
  final FlutterSecureStorage storage;
  @override
  Future<String?> read(String key) => storage.read(key: key);
  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);
}

class PaidIntentLease {
  const PaidIntentLease(this.storageKey, this.hash, this.key);
  final String storageKey, hash, key;
}

/// Only opaque UUIDs, request hashes and time are persisted, never body/token.
/// Calls do not retry themselves. Same exact unresolved intent reuses its UUID.
class PaidIntentRegistry {
  PaidIntentRegistry(this.storage, {DateTime Function()? now})
    : _now = now ?? DateTime.now;
  factory PaidIntentRegistry.secure([FlutterSecureStorage? storage]) =>
      PaidIntentRegistry(
        SecurePaidIntentStorage(storage ?? const FlutterSecureStorage()),
      );
  final PaidIntentStorage storage;
  final DateTime Function() _now;
  static const maxEntries = 64;
  static const retryWindow = Duration(days: 7);
  static final Map<String, Future<void>> _writes = {};
  static final Set<String> _active = {};
  static final _uuid = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  );
  static String digest(String text) =>
      sha256.convert(utf8.encode(text)).toString();
  static String _scope(Uri origin, String userId) {
    if (userId.trim().isEmpty ||
        userId.length > 200 ||
        RegExp(r'[\x00-\x20\x7f]').hasMatch(userId)) {
      throw const PaidIntentFailure('INVALID_ACCOUNT');
    }
    return 'lumio.paid-intents.v1.${digest(jsonEncode([origin.origin, userId]))}';
  }

  Future<T> _serialized<T>(String key, Future<T> Function() run) async {
    final previous = _writes[key] ?? Future<void>.value();
    final current = previous.then((_) => run(), onError: (Object _) => run());
    final gate = current.then<void>((_) {}, onError: (Object _) {});
    _writes[key] = gate;
    try {
      return await current;
    } finally {
      if (identical(_writes[key], gate)) _writes.remove(key);
    }
  }

  Future<List<Map<String, dynamic>>> _read(String key) async {
    String? raw;
    try {
      raw = await storage.read(key);
    } catch (_) {
      throw const PaidIntentFailure('AI_REQUEST_METADATA_UNAVAILABLE');
    }
    if (raw == null) return [];
    try {
      if (raw.length > 20000) throw const FormatException();
      final decoded = jsonDecode(raw);
      if (decoded is! List || decoded.length > maxEntries) {
        throw const FormatException();
      }
      final hashes = <String>{}, ids = <String>{};
      return decoded.map((entry) {
        if (entry is! Map ||
            entry.length != 3 ||
            entry['hash'] is! String ||
            !RegExp(r'^[a-f0-9]{64}$').hasMatch(entry['hash']) ||
            entry['key'] is! String ||
            !_uuid.hasMatch(entry['key']) ||
            entry['at'] is! int ||
            entry['at'] <= 0 ||
            entry['at'] > _now().millisecondsSinceEpoch + 60000 ||
            !hashes.add(entry['hash']) ||
            !ids.add(entry['key'])) {
          throw const FormatException();
        }
        return <String, dynamic>{
          'hash': entry['hash'],
          'key': entry['key'],
          'at': entry['at'],
        };
      }).toList();
    } catch (_) {
      throw const PaidIntentFailure('AI_REQUEST_METADATA_INVALID');
    }
  }

  Future<void> _write(String key, List<Map<String, dynamic>> entries) async {
    try {
      await storage.write(key, jsonEncode(entries));
    } catch (_) {
      throw const PaidIntentFailure('AI_REQUEST_METADATA_UNAVAILABLE');
    }
  }

  String _newKey() {
    final random = Random.secure(),
        bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final hex = bytes.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  Future<PaidIntentLease> begin(
    Uri origin,
    String userId,
    String path,
    String stamp,
  ) {
    final storageKey = _scope(origin, userId);
    final hash = digest(jsonEncode(['POST', path, stamp]));
    return _serialized(storageKey, () async {
      final activeKey = '$storageKey:$hash';
      if (_active.contains(activeKey)) {
        throw const PaidIntentFailure('AI_REQUEST_IN_PROGRESS');
      }
      final entries = await _read(storageKey);
      Map<String, dynamic>? record;
      for (final entry in entries) {
        if (entry['hash'] == hash) record = entry;
      }
      if (record != null &&
          _now().millisecondsSinceEpoch - (record['at'] as int) >=
              retryWindow.inMilliseconds) {
        // Do not silently forget old uncertainty and charge a fresh operation.
        throw const PaidIntentFailure('AI_REQUEST_RETRY_EXPIRED');
      }
      if (record == null) {
        if (entries.length >= maxEntries) {
          throw const PaidIntentFailure('AI_REQUEST_PENDING_LIMIT');
        }
        record = {
          'hash': hash,
          'key': _newKey(),
          'at': _now().millisecondsSinceEpoch,
        };
        entries.add(record);
        await _write(
          storageKey,
          entries,
        ); // Must succeed before a paid transport.
      }
      _active.add(activeKey);
      return PaidIntentLease(storageKey, hash, record['key'] as String);
    });
  }

  Future<void> acknowledge(PaidIntentLease lease) =>
      _serialized(lease.storageKey, () async {
        final entries = await _read(lease.storageKey);
        entries.removeWhere(
          (entry) => entry['hash'] == lease.hash && entry['key'] == lease.key,
        );
        await _write(lease.storageKey, entries);
      });
  void release(PaidIntentLease lease) =>
      _active.remove('${lease.storageKey}:${lease.hash}');

  /// Explicit new-intent control only. Caller must warn that a new call may cost
  /// credits; this never recovers output or cancels work already on the server.
  Future<void> clearUncertain(Uri origin, String userId) {
    final key = _scope(origin, userId);
    return _serialized(key, () async {
      if (_active.any((value) => value.startsWith('$key:'))) {
        throw const PaidIntentFailure('AI_REQUEST_IN_PROGRESS');
      }
      await _write(key, []);
    });
  }
}
