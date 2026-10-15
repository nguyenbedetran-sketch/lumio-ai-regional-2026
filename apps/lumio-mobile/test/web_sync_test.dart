import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumio_mobile/core/api.dart';
import 'package:lumio_mobile/core/web_sync.dart';
import 'package:lumio_mobile/core/web_sync_controller.dart';
import 'package:lumio_mobile/core/web_sync_repository.dart';

Map<String, dynamic> fixture({
  String notes = 'Ghi chú gốc',
  String id = 'web-math',
}) => {
  'version': 1,
  'library': {
    'version': 1,
    'spaces': [
      {'id': 'math', 'name': 'Toán', 'color': 'green'},
    ],
    'items': [
      {
        'id': id,
        'title': 'DỮ LIỆU KIỂM THỬ — Căn thức',
        'kind': 'text',
        'spaceId': 'math',
        'createdAt': '2026-10-15T00:00:00Z',
        'updatedAt': '2026-10-15T00:00:00Z',
        'text': 'Khi chia cho x cần x khác 0.',
        'notes': notes,
        'favorite': true,
        'sourceEvidence': {
          'version': 1,
          'kind': 'pdf',
          'filename': 'fixture.pdf',
          'digest': 'synthetic-digest',
          'units': [
            {'start': 0, 'end': 28, 'page': 3},
          ],
          'proof': 'synthetic-public-proof-not-a-key',
        },
        'cards': [
          {
            'id': 'card',
            'front': 'Điều kiện?',
            'back': 'x khác 0',
            'references': [
              {'segmentId': 'seg-1', 'quote': 'Khi chia cho x', 'page': 3},
            ],
          },
        ],
        'questions': [
          {
            'id': 'q',
            'prompt': '2x=8',
            'options': ['4', '3', '2', '1'],
            'correct': 0,
            'explanation': 'Chia cho 2',
            'topic': 'Phương trình bậc nhất',
            'difficulty': 'beginner',
            'references': [
              {
                'segmentId': 'seg-1',
                'quote': 'Khi chia cho x',
                'start': 0,
                'end': 14,
                'paragraph': 1,
              },
            ],
          },
        ],
        'attempts': [
          {
            'date': '2026-10-15T00:00:00Z',
            'score': 1,
            'total': 1,
            'answers': [
              {
                'questionId': 'q',
                'selected': 0,
                'correct': true,
                'topic': 'Phương trình bậc nhất',
              },
            ],
            'skillEvidence': {
              'version': 1,
              'taxonomyVersion': 'lumio-math-foundations-1',
              'attemptId': 'synthetic-attempt',
              'answers': [
                {
                  'questionId': 'q',
                  'fingerprint': 'q1:10:a:b',
                  'skillId': 'linear',
                  'skillOrigin': 'topic-alias',
                  'difficulty': 'beginner',
                  'difficultyOrigin': 'declared',
                  'exposure': 'first-choice',
                  'selected': 0,
                  'correct': true,
                },
              ],
            },
          },
        ],
        'artifacts': [
          {
            'id': 'artifact',
            'kind': 'summary',
            'futureMetadata': {'kept': true},
          },
        ],
        'futureField': {
          'nested': [1, 2, 3],
        },
      },
    ],
  },
  'learning': {
    'version': 1,
    'focus': null,
    'tasks': [
      {'id': 'goal', 'title': 'Ôn Toán'},
    ],
    'reviews': [
      {'key': 'item:card', 'dueAt': '2026-10-20T00:00:00Z'},
    ],
    'events': [
      {'id': 'read', 'kind': 'read', 'at': '2026-10-15T00:00:00Z'},
    ],
  },
  'preferences': {
    'version': 1,
    'enabled': true,
    'feedback': [],
    'skillTracking': true,
    'controls': {
      'topics': ['Căn thức'],
      'difficulty': 'beginner',
      'goal': 'review',
    },
  },
};
WebSyncEnvelope envelope({
  String notes = 'Ghi chú gốc',
  String id = 'web-math',
}) => WebSyncEnvelope.fromJson(fixture(notes: notes, id: id));

class MemoryStorage implements WebSyncStorage {
  final values = <String, Map<String, dynamic>>{};
  bool fail = false;
  @override
  Future<WebSyncLocal?> read(String scope) async =>
      values[scope] == null ? null : WebSyncLocal.fromJson(values[scope]!);
  @override
  Future<void> write(String scope, WebSyncLocal value) async {
    if (fail) throw const FileSystemException('synthetic write failure');
    values[scope] = jsonDecode(jsonEncode(value.toJson()));
  }
}

class Server implements WebSyncTransport {
  Server({this.data});
  WebSyncEnvelope? data;
  String epoch = 'synthetic-epoch';
  int revision = 0, reads = 0, deletes = 0;
  bool loseAck = false, offline = false, cancelled = false;
  final writes = <Map<String, dynamic>>[],
      acks = <String, Map<String, dynamic>>{};
  Completer<Map<String, dynamic>>? waiting;
  void Function(Map<String, dynamic>)? beforeWrite;
  @override
  Future<Map<String, dynamic>> read() async {
    reads++;
    if (waiting != null) return waiting!.future;
    if (offline) throw const WebSyncFailure('NETWORK_ERROR');
    return {
      'epoch': epoch,
      'revision': revision,
      'expiresAt': '2030-01-01T00:00:00Z',
      'data': data?.toJson(),
    };
  }

  @override
  Future<Map<String, dynamic>> write(Map<String, dynamic> body) async {
    beforeWrite?.call(body);
    writes.add(jsonDecode(jsonEncode(body)));
    if (offline) throw const WebSyncFailure('NETWORK_ERROR');
    final key = body['requestId'] as String;
    if (acks.containsKey(key)) return acks[key]!;
    if (body['epoch'] != epoch || body['expectedRevision'] != revision) {
      throw const WebSyncFailure('SYNC_CONFLICT');
    }
    data = WebSyncEnvelope.fromJson(body['data']);
    revision++;
    final ack = {'epoch': epoch, 'revision': revision};
    acks[key] = ack;
    if (loseAck) {
      loseAck = false;
      throw const WebSyncFailure('NETWORK_ERROR');
    }
    return ack;
  }

  @override
  Future<void> delete({required String epoch, required int revision}) async {
    if (epoch != this.epoch || revision != this.revision) {
      throw const WebSyncFailure('SYNC_CONFLICT');
    }
    deletes++;
    this.epoch = 'reset-epoch';
    this.revision = 0;
    data = null;
    acks.clear();
  }

  @override
  void cancel() {
    cancelled = true;
  }
}

WebSyncController controller(
  Server server,
  MemoryStorage storage, {
  String scope = 'https://lumio.example::user-a',
  bool Function()? current,
}) => WebSyncController(
  scope: scope,
  transport: server,
  storage: storage,
  isCurrent: current ?? () => true,
);
Future<void> seed(WebSyncController c, {WebSyncEnvelope? data}) async {
  await c.initialize();
  await c.enable(true);
  if (data != null) await c.importSnapshot(data.encode());
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'Web DTO round-trip keeps citations, source units, topic/difficulty, artifacts and skillEvidence',
    () {
      final raw = fixture(), v = WebSyncEnvelope.fromJson(raw);
      expect(webSyncEqual(v.toJson(), raw), true);
      final edited = v.editNotes(
        'web-math',
        'Mới',
        DateTime.utc(2026, 10, 15, 1),
      );
      final before = raw['library']['items'][0],
          after = edited.toJson()['library']['items'][0];
      for (final key in [
        'sourceEvidence',
        'questions',
        'attempts',
        'artifacts',
        'futureField',
        'cards',
      ]) {
        expect(after[key], before[key]);
      }
      expect(v.items[0]['notes'], 'Ghi chú gốc');
    },
  );
  test(
    'DTO refuses native backup, unsupported versions, duplicate records, live timers and oversized UTF8',
    () {
      expect(
        () => WebSyncEnvelope.fromJson({
          'version': 1,
          'items': [],
          'events': [],
          'focus': null,
        }),
        throwsA(isA<WebSyncFailure>()),
      );
      for (final change in [
        (Map<String, dynamic> v) => v['version'] = 2,
        (Map<String, dynamic> v) =>
            v['library']['items'].add(v['library']['items'][0]),
        (Map<String, dynamic> v) =>
            v['learning']['events'].add(v['learning']['events'][0]),
        (Map<String, dynamic> v) => v['learning']['focus'] = {'remaining': 100},
        (Map<String, dynamic> v) =>
            v['library']['items'][0]['text'] = '😀' * 600000,
      ]) {
        final v = fixture();
        change(v);
        expect(
          () => WebSyncEnvelope.fromJson(v),
          throwsA(isA<WebSyncFailure>()),
        );
      }
    },
  );
  test('Structural equality ignores key order and numeric JSON formatting', () {
    expect(
      webSyncEqual(
        {
          'a': 1,
          'b': [2],
        },
        {
          'b': [2.0],
          'a': 1.0,
        },
      ),
      true,
    );
    expect(webSyncEqual([1, 2], [2, 1]), false);
  });
  test(
    'Three-way merge preserves nonconflicting records and requires explicit choice for both-side changes',
    () {
      final base = envelope(),
          local = base.editNotes(
            'web-math',
            'Local',
            DateTime.utc(2026, 10, 15, 1),
          ),
          remote = base.editNotes(
            'web-math',
            'Remote',
            DateTime.utc(2026, 10, 15, 2),
          );
      final merged = mergeWebSync(base, local, remote);
      expect(merged.conflicts, contains('Học liệu: web-math'));
      expect(
        mergeWebSync(
          base,
          local,
          remote,
          choice: WebSyncChoice.remote,
        ).data.items[0]['notes'],
        'Remote',
      );
      final changed = base.toJson();
      changed['library']['spaces'].add({
        'id': 'new',
        'name': 'New',
        'color': 'blue',
      });
      expect(
        mergeWebSync(
          base,
          local,
          WebSyncEnvelope.fromJson(changed),
        ).data.toJson()['library']['spaces'].length,
        2,
      );
    },
  );
  test(
    'Known-base deletions are not resurrected by an unchanged remote record',
    () {
      final base = envelope(), v = base.toJson();
      v['library']['items'] = [];
      expect(
        mergeWebSync(base, WebSyncEnvelope.fromJson(v), base).data.items,
        isEmpty,
      );
    },
  );
  test(
    'Initialising/disabled controller never requests or uploads native data',
    () async {
      final server = Server(), c = controller(server, MemoryStorage());
      await c.initialize();
      await c.sync();
      expect(server.reads, 0);
      expect(server.writes, isEmpty);
      expect(c.value.current, isNull);
      c.dispose();
    },
  );
  test(
    'Explicit receive retains the canonical web snapshot without a native conversion',
    () async {
      final server = Server(data: envelope()),
          c = controller(server, MemoryStorage());
      await seed(c);
      await c.sync();
      expect(webSyncEqual(c.value.current!.toJson(), fixture()), true);
      expect(server.writes, isEmpty);
      expect(c.status, 'done');
      c.dispose();
    },
  );
  test(
    'Pending operation is persisted before PUT, and notes upload preserves metadata',
    () async {
      final store = MemoryStorage(),
          server = Server(data: envelope()),
          c = controller(server, store);
      await seed(c);
      await c.sync();
      await c.editNotes('web-math', 'Chỉnh offline');
      server.beforeWrite = (body) {
        expect(
          store.values[c.scope]!['pending']['requestId'],
          body['requestId'],
        );
      };
      await c.sync();
      expect(server.data!.items[0]['notes'], 'Chỉnh offline');
      expect(
        server.data!.items[0]['questions'],
        fixture()['library']['items'][0]['questions'],
      );
      expect(c.value.pending, isNull);
      c.dispose();
    },
  );
  test(
    'Lost ACK survives restart and replays identical idempotency key/body, not a second mutation',
    () async {
      final store = MemoryStorage(),
          server = Server(),
          c = controller(server, store);
      await seed(c, data: envelope());
      server.loseAck = true;
      await c.sync();
      expect(c.status, 'offline');
      expect(c.value.pending, isNotNull);
      final first = server.writes.single;
      c.dispose();
      final restored = controller(server, store);
      await restored.initialize();
      await restored.sync();
      expect(server.writes.length, 2);
      expect(server.writes.last, first);
      expect(server.revision, 1);
      expect(restored.value.pending, isNull);
      expect(restored.status, 'done');
      restored.dispose();
    },
  );
  test(
    'Local edits after lost ACK are retained when the pending operation is reconciled',
    () async {
      final store = MemoryStorage(),
          server = Server(),
          c = controller(server, store);
      await seed(c, data: envelope());
      server.loseAck = true;
      await c.sync();
      await c.editNotes('web-math', 'Edited after lost ACK');
      await c.sync();
      expect(server.data!.items[0]['notes'], 'Edited after lost ACK');
      expect(server.revision, 2);
      c.dispose();
    },
  );
  test(
    'Both-side edits stop for conflict without overwriting until a choice is given',
    () async {
      final server = Server(data: envelope()),
          c = controller(server, MemoryStorage());
      await seed(c);
      await c.sync();
      await c.editNotes('web-math', 'Local');
      server.data = server.data!.editNotes(
        'web-math',
        'Remote',
        DateTime.utc(2026, 10, 15, 2),
      );
      server.revision++;
      await c.sync();
      expect(c.status, 'conflict');
      expect(server.writes, isEmpty);
      expect(c.value.current!.items[0]['notes'], 'Local');
      await c.sync(choice: WebSyncChoice.remote);
      expect(c.value.current!.items[0]['notes'], 'Remote');
      expect(server.writes, isEmpty);
      c.dispose();
    },
  );
  test(
    'Server reset cannot automatically resurrect old content or a stale pending upload',
    () async {
      final store = MemoryStorage(),
          server = Server(data: envelope()),
          c = controller(server, store);
      await seed(c);
      await c.sync();
      await c.editNotes('web-math', 'Keep local');
      server.epoch = 'reset-epoch';
      server.revision = 0;
      server.data = null;
      await c.sync();
      expect(c.status, 'conflict');
      expect(c.firstConflict, true);
      expect(server.writes, isEmpty);
      expect(c.value.current!.items[0]['notes'], 'Keep local');
      c.dispose();
    },
  );
  test(
    'Account generation change while awaiting network cannot reveal or apply an old response',
    () async {
      var current = true;
      final store = MemoryStorage(),
          server = Server()..waiting = Completer(),
          c = controller(server, store, current: () => current);
      await seed(c);
      final work = c.sync();
      await Future<void>.delayed(Duration.zero);
      current = false;
      server.waiting!.complete({
        'epoch': 'old-account',
        'revision': 0,
        'expiresAt': '2030-01-01T00:00:00Z',
        'data': fixture(),
      });
      await work;
      expect(c.value.current, isNull);
      expect(store.values[c.scope]!['current'], isNull);
      expect(server.writes, isEmpty);
      c.dispose();
      expect(server.cancelled, true);
    },
  );
  test(
    'Origins/accounts have separate outboxes and disabling does not erase snapshots',
    () async {
      final store = MemoryStorage(), server = Server();
      final a = controller(server, store, scope: 'https://a.example::a'),
          b = controller(server, store, scope: 'https://a.example::b');
      await seed(a, data: envelope());
      await a.enable(false);
      await b.initialize();
      expect(a.value.current, isNotNull);
      expect(b.value.current, isNull);
      expect(b.value.enabled, false);
      a.dispose();
      b.dispose();
    },
  );
  test(
    'Deleting server copy uses CAS and keeps local snapshot while clearing pending/cursor/consent',
    () async {
      final server = Server(data: envelope()),
          c = controller(server, MemoryStorage());
      await seed(c);
      await c.sync();
      await c.deleteServer();
      expect(server.data, isNull);
      expect(server.deletes, 1);
      expect(c.value.current, isNotNull);
      expect(c.value.enabled, false);
      expect(c.value.pending, isNull);
      expect(c.value.base, isNull);
      expect(c.value.epoch, isNull);
      c.dispose();
    },
  );
  test(
    'Unreadable storage is not silently replaced by an empty workspace',
    () async {
      final store = MemoryStorage()
            ..values['https://lumio.example::user-a'] = {'bad': true},
          c = controller(Server(), store);
      await c.initialize();
      expect(c.status, 'error');
      await c.enable(true);
      expect(store.values[c.scope], {'bad': true});
      c.dispose();
    },
  );
  test(
    'Canonical bearer and user header are used for GET/PUT/DELETE without a provider key',
    () async {
      final methods = <String>[];
      final client = MockClient((req) async {
        methods.add(req.method);
        expect(req.url.toString(), 'https://lumio.example/api/sync');
        expect(
          req.headers['authorization'],
          'Bearer isolated-lumio-session-token',
        );
        expect(req.headers['x-lumio-user'], 'canonical-a');
        expect(req.followRedirects, false);
        return http.Response(
          jsonEncode(
            req.method == 'GET'
                ? {
                    'epoch': 'e',
                    'revision': 0,
                    'expiresAt': '2030-01-01T00:00:00Z',
                    'data': null,
                  }
                : {'epoch': 'e', 'revision': 1, 'deleted': true},
          ),
          200,
        );
      });
      final transport = LumioApi(
        Uri.parse('https://lumio.example'),
        token: 'isolated-lumio-session-token',
        clientFactory: () => client,
      ).webSync('canonical-a');
      await transport.read();
      await transport.write({
        'epoch': 'e',
        'expectedRevision': 0,
        'requestId': 'isolated-operation-id',
        'data': fixture(),
      });
      await transport.delete(epoch: 'e', revision: 1);
      expect(methods, ['GET', 'PUT', 'DELETE']);
    },
  );
  test(
    'HTTP revoke/redirect errors are bounded and never followed to another origin',
    () async {
      for (final status in [401, 302]) {
        var calls = 0;
        final client = MockClient((req) async {
          calls++;
          expect(req.followRedirects, false);
          return http.Response(
            status == 401
                ? jsonEncode({'error': 'SESSION_REVOKED'})
                : 'redirect',
            status,
            headers: {'location': 'https://other.example/'},
          );
        });
        final api = LumioApi(
          Uri.parse('https://lumio.example'),
          token: 'isolated-session-token',
          clientFactory: () => client,
        ).webSync('canonical-a');
        await expectLater(api.read(), throwsA(isA<WebSyncFailure>()));
        expect(calls, 1);
      }
    },
  );
  test(
    'File store scopes names, flushes snapshots, recovers valid backup and refuses corrupt writes',
    () async {
      final dir = await Directory.systemTemp.createTemp('lumio-web-sync-test-');
      addTearDown(() async {
        final root = await Directory.systemTemp.resolveSymbolicLinks(),
            target = await dir.resolveSymbolicLinks();
        expect(
          target.toLowerCase().startsWith(
            '$root${Platform.pathSeparator}lumio-web-sync-test-'.toLowerCase(),
          ),
          true,
        );
        await dir.delete(recursive: true);
      });
      final storage = FileWebSyncStorage(dir);
      final one = WebSyncLocal(enabled: true, current: envelope());
      await storage.write('origin::a', one);
      await storage.write(
        'origin::a',
        WebSyncLocal(enabled: true, current: envelope(notes: 'Later')),
      );
      expect(storage.pathFor('origin::a'), isNot(storage.pathFor('origin::b')));
      expect(await storage.read('origin::b'), isNull);
      await File(storage.pathFor('origin::a')).writeAsString('broken');
      final recovered = await storage.read('origin::a');
      expect(storage.recoveredBackup, true);
      expect(recovered!.current!.items[0]['notes'], 'Ghi chú gốc');
      await expectLater(
        storage.write('origin::a', WebSyncLocal(epoch: 'bad', revision: 0)),
        throwsA(isA<WebSyncFailure>()),
      );
      expect(await File(storage.pathFor('origin::a')).readAsString(), 'broken');
    },
  );
}
