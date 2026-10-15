import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'models.dart' show newId;
import 'web_sync.dart';
import 'web_sync_repository.dart';

/// Separate web-snapshot workspace. Native LibraryData is never read or replaced.
class WebSyncController extends ChangeNotifier {
  WebSyncController({
    required this.scope,
    required this.transport,
    required this.storage,
    required this.isCurrent,
  });
  final String scope;
  final WebSyncTransport transport;
  final WebSyncStorage storage;
  final bool Function() isCurrent;
  WebSyncLocal value = const WebSyncLocal();
  bool ready = false, busy = false, _disposed = false, _writable = false;
  String status = 'ready', error = '';
  List<String> conflicts = [];
  bool firstConflict = false;
  bool get active => !_disposed && isCurrent();
  void _ensure() {
    if (!active) throw const WebSyncFailure('ACCOUNT_CHANGED');
  }

  void _notify() {
    if (active) notifyListeners();
  }

  Future<void> initialize() async {
    try {
      final loaded = await storage.read(scope);
      _ensure();
      value = loaded ?? const WebSyncLocal();
      _writable = true;
      ready = true;
      status = value.pending == null ? 'ready' : 'pending';
    } catch (e) {
      if (active) {
        ready = true;
        _writable = false;
        error = e is WebSyncFailure ? e.code : 'SYNC_STORAGE_ERROR';
        status = 'error';
      }
    }
    _notify();
  }

  Future<void> _save(WebSyncLocal next) async {
    _ensure();
    if (!_writable) throw const WebSyncFailure('SYNC_STORAGE_ERROR');
    await storage.write(scope, next);
    _ensure();
    value = next;
    _notify();
  }

  WebSyncLocal _next({
    bool? enabled,
    WebSyncEnvelope? current,
    String? epoch,
    int? revision,
    WebSyncEnvelope? base,
    WebSyncPending? pending,
    bool clearPending = false,
    bool clearCursor = false,
  }) => WebSyncLocal(
    enabled: enabled ?? value.enabled,
    current: current ?? value.current,
    epoch: clearCursor ? null : epoch ?? value.epoch,
    revision: clearCursor ? null : revision ?? value.revision,
    base: clearCursor ? null : base ?? value.base,
    pending: clearPending ? null : pending ?? value.pending,
  );
  Future<void> _local(Future<void> Function() action) async {
    if (busy || !ready || !active) return;
    busy = true;
    error = '';
    _notify();
    try {
      await action();
    } catch (e) {
      if (active) {
        error = e is WebSyncFailure ? e.code : 'SYNC_STORAGE_ERROR';
        status = 'error';
      }
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> enable(bool enabled) => _local(() async {
    await _save(_next(enabled: enabled));
    status = enabled ? (value.pending == null ? 'ready' : 'pending') : 'paused';
  });
  Future<void> editNotes(String itemId, String notes) => _local(() async {
    if (value.current == null) {
      throw const WebSyncFailure('SYNC_ITEM_NOT_FOUND');
    }
    await _save(
      _next(current: value.current!.editNotes(itemId, notes, DateTime.now())),
    );
    status = 'draft';
  });
  Future<void> importSnapshot(String raw) => _local(() async {
    // Imports are explicitly the full web envelope, never the native backup format.
    if (utf8.encode(raw).length > maxWebSyncBytes) {
      throw const WebSyncFailure('SYNC_TOO_LARGE');
    }
    dynamic decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      throw const WebSyncFailure('INVALID_SYNC_DATA');
    }
    final next = WebSyncEnvelope.fromJson(decoded);
    await _save(_next(current: next));
    status = 'draft';
  });
  bool _ack(Map<String, dynamic> raw, String epoch, int revision) =>
      raw['epoch'] == epoch &&
      raw['revision'] is int &&
      raw['revision'] == revision;
  Future<void> sync({WebSyncChoice? choice}) async {
    if (!active || !ready || busy || !value.enabled || !_writable) return;
    busy = true;
    status = 'busy';
    error = '';
    _notify();
    try {
      final captured = value.current?.toJson();
      final pending = value.pending;
      if (pending != null) {
        try {
          final ack = await transport.write(pending.toJson());
          _ensure();
          if (!_ack(ack, pending.epoch, pending.revision + 1)) {
            throw const WebSyncFailure('INVALID_RESPONSE');
          }
          await _save(
            _next(
              epoch: pending.epoch,
              revision: pending.revision + 1,
              base: pending.data,
              clearPending: true,
            ),
          );
        } on WebSyncFailure catch (e) {
          if (!['SYNC_CONFLICT', 'IDEMPOTENCY_CONFLICT'].contains(e.code)) {
            rethrow;
          }
        }
      }
      final snapshot = WebSyncSnapshot.fromJson(await transport.read());
      _ensure();
      if (!webSyncEqual(captured, value.current?.toJson())) {
        throw const WebSyncFailure('SYNC_LOCAL_CHANGED');
      }
      final local = value.current, remote = snapshot.data;
      if (local == null) {
        // Explicit receive action: there is no native-library upload here.
        if (remote != null) {
          await _save(
            _next(
              current: remote,
              epoch: snapshot.epoch,
              revision: snapshot.revision,
              base: remote,
              clearPending: true,
            ),
          );
        }
        status = remote == null ? 'empty' : 'done';
        conflicts = [];
        firstConflict = false;
        return;
      }
      WebSyncEnvelope data = local;
      if (value.epoch != snapshot.epoch || value.base == null) {
        final reset = value.epoch != null && value.epoch != snapshot.epoch;
        if (choice == null &&
            (reset ||
                (remote != null &&
                    !webSyncEqual(local.toJson(), remote.toJson())))) {
          firstConflict = true;
          conflicts = [];
          status = 'conflict';
          return;
        }
        if (choice == WebSyncChoice.remote) {
          if (remote == null) {
            status = 'empty';
            throw const WebSyncFailure('SYNC_REMOTE_EMPTY');
          }
          data = remote;
        }
      } else if (remote != null) {
        final merged = mergeWebSync(value.base!, local, remote, choice: choice);
        if (merged.conflicts.isNotEmpty && choice == null) {
          firstConflict = false;
          conflicts = merged.conflicts;
          status = 'conflict';
          return;
        }
        data = merged.data;
      }
      if (remote != null && webSyncEqual(data.toJson(), remote.toJson())) {
        await _save(
          _next(
            current: data,
            epoch: snapshot.epoch,
            revision: snapshot.revision,
            base: data,
            clearPending: true,
          ),
        );
      } else {
        final pending = WebSyncPending(
          epoch: snapshot.epoch,
          revision: snapshot.revision,
          requestId: 'sync-${newId()}',
          data: data,
        );
        // Durable pending operation precedes network I/O. A lost ACK reuses this ID/body.
        await _save(
          _next(
            current: data,
            epoch: snapshot.epoch,
            revision: snapshot.revision,
            base: value.epoch == snapshot.epoch ? (value.base ?? local) : local,
            pending: pending,
          ),
        );
        final ack = await transport.write(pending.toJson());
        _ensure();
        if (!_ack(ack, snapshot.epoch, snapshot.revision + 1)) {
          throw const WebSyncFailure('INVALID_RESPONSE');
        }
        await _save(
          _next(
            current: data,
            epoch: snapshot.epoch,
            revision: snapshot.revision + 1,
            base: data,
            clearPending: true,
          ),
        );
      }
      status = 'done';
      conflicts = [];
      firstConflict = false;
    } catch (e) {
      if (active) {
        error = e is WebSyncFailure ? e.code : 'SYNC_UNAVAILABLE';
        status = ['NETWORK_ERROR', 'TIMEOUT'].contains(error)
            ? 'offline'
            : error == 'SYNC_CONFLICT'
            ? 'conflict'
            : 'error';
      }
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> deleteServer() => _local(() async {
    final s = WebSyncSnapshot.fromJson(await transport.read());
    _ensure();
    await transport.delete(epoch: s.epoch, revision: s.revision);
    _ensure();
    await _save(_next(enabled: false, clearCursor: true, clearPending: true));
    status = 'paused';
    conflicts = [];
    firstConflict = false;
  });
  @override
  void dispose() {
    _disposed = true;
    transport.cancel();
    super.dispose();
  }
}
