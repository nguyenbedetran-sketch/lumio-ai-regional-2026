import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'web_sync.dart';

class WebSyncPending {
  const WebSyncPending({
    required this.epoch,
    required this.revision,
    required this.requestId,
    required this.data,
  });
  final String epoch, requestId;
  final int revision;
  final WebSyncEnvelope data;
  Map<String, dynamic> toJson() => {
    'epoch': epoch,
    'expectedRevision': revision,
    'requestId': requestId,
    'data': data.toJson(),
  };
  factory WebSyncPending.fromJson(Map<String, dynamic> v) {
    if (v['epoch'] is! String ||
        v['expectedRevision'] is! int ||
        v['expectedRevision'] < 0 ||
        v['requestId'] is! String ||
        !RegExp(r'^[-\w]{16,100}$').hasMatch(v['requestId'])) {
      throw const WebSyncFailure('INVALID_SYNC_CURSOR');
    }
    return WebSyncPending(
      epoch: v['epoch'],
      revision: v['expectedRevision'],
      requestId: v['requestId'],
      data: WebSyncEnvelope.fromJson(v['data']),
    );
  }
}

class WebSyncLocal {
  const WebSyncLocal({
    this.enabled = false,
    this.current,
    this.epoch,
    this.revision,
    this.base,
    this.pending,
  });
  final bool enabled;
  final WebSyncEnvelope? current, base;
  final String? epoch;
  final int? revision;
  final WebSyncPending? pending;
  Map<String, dynamic> toJson() => {
    'version': 1,
    'enabled': enabled,
    'current': current?.toJson(),
    'epoch': epoch,
    'revision': revision,
    'base': base?.toJson(),
    'pending': pending?.toJson(),
  };
  factory WebSyncLocal.fromJson(Map<String, dynamic> v) {
    if (v['version'] != 1 ||
        v['enabled'] is! bool ||
        (v['epoch'] != null &&
            (v['epoch'] is! String ||
                v['epoch'].isEmpty ||
                v['epoch'].length > 100)) ||
        (v['revision'] != null &&
            (v['revision'] is! int ||
                v['revision'] < 0 ||
                v['revision'] > 1000000000)) ||
        ((v['epoch'] == null) != (v['revision'] == null)) ||
        ((v['base'] == null) != (v['epoch'] == null))) {
      throw const WebSyncFailure('INVALID_SYNC_CURSOR');
    }
    return WebSyncLocal(
      enabled: v['enabled'],
      current: v['current'] == null
          ? null
          : WebSyncEnvelope.fromJson(v['current']),
      epoch: v['epoch'],
      revision: v['revision'],
      base: v['base'] == null ? null : WebSyncEnvelope.fromJson(v['base']),
      pending: v['pending'] == null
          ? null
          : WebSyncPending.fromJson(Map<String, dynamic>.from(v['pending'])),
    );
  }
}

abstract interface class WebSyncStorage {
  Future<WebSyncLocal?> read(String scope);
  Future<void> write(String scope, WebSyncLocal value);
}

/// Separate account/origin file. It contains learning snapshots, never a bearer or provider key.
class FileWebSyncStorage implements WebSyncStorage {
  FileWebSyncStorage(this.directory);
  final Directory directory;
  bool recoveredBackup = false;
  String pathFor(String scope) =>
      '${directory.path}/web-sync-${sha256.convert(utf8.encode(scope))}.json';
  Future<WebSyncLocal> _read(File file) async {
    if (await file.length() > 3 * maxWebSyncBytes + 65536) {
      throw const WebSyncFailure('SYNC_TOO_LARGE');
    }
    return WebSyncLocal.fromJson(
      Map<String, dynamic>.from(jsonDecode(await file.readAsString())),
    );
  }

  @override
  Future<WebSyncLocal?> read(String scope) async {
    recoveredBackup = false;
    final file = File(pathFor(scope));
    if (!await file.exists()) return null;
    try {
      return await _read(file);
    } catch (_) {
      final backup = File('${file.path}.bak');
      if (!await backup.exists()) rethrow;
      final value = await _read(backup);
      recoveredBackup = true;
      return value;
    }
  }

  @override
  Future<void> write(String scope, WebSyncLocal value) async {
    final raw = jsonEncode(value.toJson());
    WebSyncLocal.fromJson(Map<String, dynamic>.from(jsonDecode(raw)));
    if (utf8.encode(raw).length > 3 * maxWebSyncBytes + 65536) {
      throw const WebSyncFailure('SYNC_TOO_LARGE');
    }
    await directory.create(recursive: true);
    final file = File(pathFor(scope)), next = File('${file.path}.next');
    await next.writeAsString(raw, flush: true);
    if (await file.exists()) {
      bool valid = true;
      try {
        await _read(file);
      } catch (_) {
        valid = false;
      }
      if (valid) await file.copy('${file.path}.bak');
    }
    await next.rename(file.path);
  }
}
