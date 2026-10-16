import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumio_mobile/core/api.dart';
import 'package:lumio_mobile/core/app_store.dart';
import 'package:lumio_mobile/core/paid_intents.dart';
import 'package:lumio_mobile/core/repository.dart';
import 'package:lumio_mobile/ui/common.dart';

class MemoryIntents implements PaidIntentStorage {
  final values = <String, String>{};
  bool failRead = false, failWrite = false;
  @override
  Future<String?> read(String key) async {
    if (failRead) throw StateError('Storage failed');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    if (failWrite) throw StateError('Storage failed');
    values[key] = value;
  }
}

final origin = Uri.parse('https://lumio.example');
const token = 'synthetic-session-token-only';
Matcher apiError(String code) =>
    isA<ApiFailure>().having((e) => e.code, 'code', code);
Matcher intentError(String code) =>
    isA<PaidIntentFailure>().having((e) => e.code, 'code', code);
Future<Map<String, dynamic>> study(
  LumioApi api, [
  String question = 'Private authored question',
]) => api.study(
  task: 'chat',
  source: 'Private authored material',
  language: 'vi',
  question: question,
);
http.Response ok() => http.Response(
  '{"text":"Authored fixture response"}',
  200,
  headers: {'Content-Type': 'application/json'},
);
LumioApi api(
  MemoryIntents storage,
  Future<http.Response> Function(http.Request) handler, {
  String user = 'canonical-a',
  Uri? server,
  bool Function()? sessionCurrent,
}) {
  final value = LumioApi(
    server ?? origin,
    token: token,
    canonicalUserId: user,
    paidIntents: PaidIntentRegistry(storage),
    clientFactory: () => MockClient(handler),
  );
  if (sessionCurrent != null) {
    value.bindCanonicalUser(user, sessionCurrent: sessionCurrent);
  }
  return value;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'Paid headers use canonical user and UUIDv4, not a provider credential',
    () async {
      final memory = MemoryIntents();
      await study(
        api(memory, (request) async {
          expect(request.headers['X-Lumio-User'], 'canonical-a');
          expect(request.headers['Authorization'], 'Bearer $token');
          expect(
            request.headers['Idempotency-Key'],
            matches(
              RegExp(
                r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
              ),
            ),
          );
          expect(request.followRedirects, isFalse);
          expect(
            request.headers.keys.any(
              (key) => key.toLowerCase().contains('api-key'),
            ),
            isFalse,
          );
          return ok();
        }),
      );
    },
  );
  test(
    'Paid transport fails closed without canonical user even with bearer',
    () async {
      var calls = 0;
      final value = LumioApi(
        origin,
        token: token,
        paidIntents: PaidIntentRegistry(MemoryIntents()),
        clientFactory: () => MockClient((_) async {
          calls++;
          return ok();
        }),
      );
      await expectLater(study(value), throwsA(apiError('SIGN_IN_REQUIRED')));
      expect(calls, 0);
    },
  );
  test(
    'Cross-origin absolute endpoint is rejected before sending bearer',
    () async {
      var calls = 0;
      final value = api(MemoryIntents(), (_) async {
        calls++;
        return ok();
      });
      await expectLater(
        value.json('POST', 'https://other.example/api/ai', {}),
        throwsA(apiError('INVALID_SERVER')),
      );
      expect(calls, 0);
    },
  );
  test(
    'Lost JSON ACK reuses its UUID across new API and registry instances; success releases it',
    () async {
      final memory = MemoryIntents(), keys = <String>[];
      Future<http.Response> handle(http.Request request) async {
        keys.add(request.headers['Idempotency-Key']!);
        return keys.length == 1 ? http.Response('{"text":', 200) : ok();
      }

      await expectLater(
        study(api(memory, handle)),
        throwsA(apiError('INVALID_RESPONSE')),
      );
      await study(api(memory, handle));
      await study(api(memory, handle));
      expect(keys[0], keys[1]);
      expect(keys[2], isNot(keys[1]));
      expect(jsonDecode(memory.values.values.single), isEmpty);
    },
  );
  test(
    'Network uncertainty never auto-retries; explicit retry keeps its UUID',
    () async {
      final memory = MemoryIntents(), keys = <String>[];
      Future<http.Response> handle(http.Request request) async {
        keys.add(request.headers['Idempotency-Key']!);
        if (keys.length == 1) {
          throw http.ClientException('Synthetic network loss');
        }
        return ok();
      }

      await expectLater(
        study(api(memory, handle)),
        throwsA(apiError('NETWORK_ERROR')),
      );
      expect(keys.length, 1);
      await study(api(memory, handle));
      expect(keys, [keys.first, keys.first]);
    },
  );
  test(
    'Completed, in-progress and conflict receipts retain the old intent without a new paid key',
    () async {
      for (final code in [
        'AI_REQUEST_COMPLETED',
        'AI_REQUEST_IN_PROGRESS',
        'AI_REQUEST_CONFLICT',
        'AI_REQUEST_UNSETTLED',
      ]) {
        final memory = MemoryIntents(), keys = <String>[];
        Future<http.Response> handle(http.Request request) async {
          keys.add(request.headers['Idempotency-Key']!);
          return http.Response(
            jsonEncode({
              'error': code,
              'receipt': {'status': 'completed'},
            }),
            409,
          );
        }

        for (var i = 0; i < 2; i++) {
          await expectLater(
            study(api(memory, handle)),
            throwsA(apiError(code)),
          );
        }
        expect(keys.length, 2);
        expect(keys[0], keys[1]);
        expect((jsonDecode(memory.values.values.single) as List).length, 1);
      }
    },
  );
  test(
    'A definite JSON failure releases its key but an HTML error remains uncertain',
    () async {
      final memory = MemoryIntents(), keys = <String>[];
      var response = http.Response('{"error":"INVALID_INPUT"}', 400);
      Future<http.Response> handle(http.Request request) async {
        keys.add(request.headers['Idempotency-Key']!);
        return response;
      }

      await expectLater(
        study(api(memory, handle)),
        throwsA(apiError('INVALID_INPUT')),
      );
      response = http.Response('<!doctype html>', 502);
      await expectLater(
        study(api(memory, handle)),
        throwsA(apiError('HTTP_502')),
      );
      await expectLater(
        study(api(memory, handle)),
        throwsA(apiError('HTTP_502')),
      );
      expect(keys[0], isNot(keys[1]));
      expect(keys[1], keys[2]);
    },
  );
  test(
    'JSON gateway 5xx after a synthetic settlement retains the UUID across restart and completed receipt',
    () async {
      final memory = MemoryIntents(), keys = <String>[];
      var syntheticSettlements = 0;
      Future<http.Response> handle(http.Request request) async {
        keys.add(request.headers['Idempotency-Key']!);
        if (keys.length == 1) {
          syntheticSettlements++;
          // The origin's result was lost at a fixture gateway after settlement.
          return http.Response('{"error":"PROVIDER_UNAVAILABLE"}', 502);
        }
        return http.Response('{"error":"AI_REQUEST_COMPLETED"}', 409);
      }

      await expectLater(
        study(api(memory, handle)),
        throwsA(apiError('PROVIDER_UNAVAILABLE')),
      );
      expect(keys.length, 1); // No automatic replay after the gateway failure.
      for (var i = 0; i < 2; i++) {
        // Each API instance reads the persisted fixture as after an app restart.
        await expectLater(
          study(api(memory, handle)),
          throwsA(apiError('AI_REQUEST_COMPLETED')),
        );
      }
      expect(keys.toSet().length, 1);
      expect(syntheticSettlements, 1);
      expect((jsonDecode(memory.values.values.single) as List).length, 1);
    },
  );
  test(
    'Every JSON HTTP 5xx stays uncertain until a failed receipt acknowledges it',
    () async {
      for (final status in [500, 502, 503, 504, 599]) {
        final memory = MemoryIntents(), keys = <String>[];
        var response = http.Response('{"error":"PROVIDER_ERROR"}', status);
        Future<http.Response> handle(http.Request request) async {
          keys.add(request.headers['Idempotency-Key']!);
          return response;
        }

        await expectLater(
          study(api(memory, handle)),
          throwsA(apiError('PROVIDER_ERROR')),
        );
        expect(keys.length, 1);
        response = http.Response('{"error":"AI_REQUEST_FAILED"}', 409);
        await expectLater(
          study(api(memory, handle)),
          throwsA(apiError('AI_REQUEST_FAILED')),
        );
        expect(keys[0], keys[1]);
        expect(jsonDecode(memory.values.values.single), isEmpty);
        response = ok();
        await study(api(memory, handle));
        expect(keys[2], isNot(keys[1]));
      }
    },
  );
  test(
    'Secure metadata read/write errors prevent every paid request',
    () async {
      for (final writeFailure in [false, true]) {
        final memory = MemoryIntents()
          ..failRead = !writeFailure
          ..failWrite = writeFailure;
        var calls = 0;
        await expectLater(
          study(
            api(memory, (_) async {
              calls++;
              return ok();
            }),
          ),
          throwsA(apiError('AI_REQUEST_METADATA_UNAVAILABLE')),
        );
        expect(calls, 0);
      }
    },
  );
  test(
    'Corrupt metadata fails closed rather than forgetting an uncertain charge',
    () async {
      final memory = MemoryIntents(), registry = PaidIntentRegistry(memory);
      final lease = await registry.begin(
        origin,
        'canonical-a',
        '/api/ai',
        'seed',
      );
      registry.release(lease);
      memory.values[lease.storageKey] = '{corrupt';
      var calls = 0;
      await expectLater(
        study(
          api(memory, (_) async {
            calls++;
            return ok();
          }),
        ),
        throwsA(apiError('AI_REQUEST_METADATA_INVALID')),
      );
      expect(calls, 0);
    },
  );
  test(
    'Same-intent concurrency across client instances is blocked locally',
    () async {
      final memory = MemoryIntents(),
          entered = Completer<void>(),
          reply = Completer<http.Response>();
      var calls = 0;
      Future<http.Response> handle(http.Request request) {
        calls++;
        entered.complete();
        return reply.future;
      }

      final pending = study(api(memory, handle));
      await entered.future;
      await expectLater(
        study(api(memory, handle)),
        throwsA(apiError('AI_REQUEST_IN_PROGRESS')),
      );
      expect(calls, 1);
      reply.complete(ok());
      await pending;
    },
  );
  test(
    'Concurrent different intents are serialized in metadata without losing either receipt',
    () async {
      final memory = MemoryIntents(),
          a = PaidIntentRegistry(memory),
          b = PaidIntentRegistry(memory);
      final leases = await Future.wait([
        a.begin(origin, 'canonical-a', '/api/ai', 'one'),
        b.begin(origin, 'canonical-a', '/api/ai', 'two'),
      ]);
      expect((jsonDecode(memory.values.values.single) as List).length, 2);
      a.release(leases[0]);
      b.release(leases[1]);
    },
  );
  test(
    'Sixty-four uncertain intents are bounded and never evicted to make a new charge',
    () async {
      final memory = MemoryIntents(), registry = PaidIntentRegistry(memory);
      for (var i = 0; i < PaidIntentRegistry.maxEntries; i++) {
        final lease = await registry.begin(
          origin,
          'canonical-a',
          '/api/ai',
          'payload-$i',
        );
        registry.release(lease);
      }
      await expectLater(
        registry.begin(origin, 'canonical-a', '/api/ai', 'another'),
        throwsA(intentError('AI_REQUEST_PENDING_LIMIT')),
      );
      final retry = await registry.begin(
        origin,
        'canonical-a',
        '/api/ai',
        'payload-0',
      );
      registry.release(retry);
      await registry.clearUncertain(origin, 'canonical-a');
      final explicitNew = await registry.begin(
        origin,
        'canonical-a',
        '/api/ai',
        'payload-0',
      );
      registry.release(explicitNew);
      expect(explicitNew.key, isNot(retry.key));
    },
  );
  test(
    'Expired uncertainty is not silently replaced by a new UUID after restart',
    () async {
      final memory = MemoryIntents(), at = DateTime.utc(2030, 1, 1);
      final first = PaidIntentRegistry(memory, now: () => at),
          later = PaidIntentRegistry(
            memory,
            now: () => at.add(const Duration(days: 8)),
          );
      final lease = await first.begin(origin, 'canonical-a', '/api/ai', 'same');
      first.release(lease);
      await expectLater(
        later.begin(origin, 'canonical-a', '/api/ai', 'same'),
        throwsA(intentError('AI_REQUEST_RETRY_EXPIRED')),
      );
      expect(
        (jsonDecode(memory.values.values.single) as List).single['key'],
        lease.key,
      );
    },
  );
  test(
    'Account/origin scopes are separate and only hashes/UUID/time are persisted',
    () async {
      final memory = MemoryIntents(),
          registry = PaidIntentRegistry(memory),
          keys = <String>[];
      for (final scope in [
        (origin, 'canonical-a'),
        (origin, 'canonical-b'),
        (Uri.parse('https://other.example'), 'canonical-a'),
      ]) {
        final lease = await registry.begin(
          scope.$1,
          scope.$2,
          '/api/ai',
          'Private source and token must never be cached',
        );
        registry.release(lease);
        keys.add(lease.key);
      }
      expect(keys.toSet().length, 3);
      final encoded = jsonEncode(memory.values);
      for (final private in [
        'Private source',
        'canonical-a',
        'canonical-b',
        'lumio.example',
        token,
      ]) {
        expect(encoded.contains(private), isFalse);
      }
      expect(
        (jsonDecode(memory.values.values.first) as List).single.keys.toSet(),
        {'hash', 'key', 'at'},
      );
    },
  );
  test(
    'Canonical binding cannot be changed and a stale account response is rejected',
    () async {
      final memory = MemoryIntents();
      var current = true;
      final value = api(memory, (_) async {
        current = false;
        return ok();
      }, sessionCurrent: () => current);
      expect(
        () => value.bindCanonicalUser('canonical-b'),
        throwsA(apiError('ACCOUNT_CHANGED')),
      );
      await expectLater(study(value), throwsA(apiError('ACCOUNT_CHANGED')));
      var calls = 0;
      await expectLater(
        study(
          api(memory, (_) async {
            calls++;
            return ok();
          }, sessionCurrent: () => false),
        ),
        throwsA(apiError('ACCOUNT_CHANGED')),
      );
      expect(calls, 0);
    },
  );
  test(
    'Transcription fingerprint uses immutable audio bytes, not multipart boundaries',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'lumio-paid-audio-',
      );
      try {
        final file = File('${directory.path}/authored.m4a');
        await file.writeAsBytes([1, 2, 3, 4]);
        final memory = MemoryIntents(), keys = <String>[];
        Future<http.Response> handle(http.Request request) async {
          keys.add(request.headers['Idempotency-Key']!);
          return http.Response('{', 200);
        }

        for (var i = 0; i < 2; i++) {
          await expectLater(
            api(memory, handle).transcribe(file, 'vi'),
            throwsA(apiError('INVALID_RESPONSE')),
          );
        }
        expect(keys[0], keys[1]);
        await file.writeAsBytes([4, 3, 2, 1]);
        await expectLater(
          api(memory, handle).transcribe(file, 'vi'),
          throwsA(apiError('INVALID_RESPONSE')),
        );
        expect(keys[2], isNot(keys[1]));
        expect(jsonEncode(memory.values).contains('authored.m4a'), isFalse);
      } finally {
        await directory.delete(recursive: true);
      }
    },
  );
  test(
    'TTS keeps an uncertain invalid audio response and releases a validated audio ACK',
    () async {
      final memory = MemoryIntents(), keys = <String>[];
      Future<http.Response> handle(http.Request request) async {
        keys.add(request.headers['Idempotency-Key']!);
        return keys.length == 1
            ? http.Response('not audio', 200)
            : http.Response.bytes(
                [1, 2],
                200,
                headers: {'Content-Type': 'audio/mpeg'},
              );
      }

      await expectLater(
        api(memory, handle).speak('Authored text', 'en', 'eve'),
        throwsA(apiError('INVALID_AUDIO')),
      );
      expect(await api(memory, handle).speak('Authored text', 'en', 'eve'), [
        1,
        2,
      ]);
      expect(keys[0], keys[1]);
      expect(jsonDecode(memory.values.values.single), isEmpty);
    },
  );
  test(
    'AppStore binds session.id and shares secure intent metadata between API getters',
    () async {
      final keys = <String>[];
      final store = AppStore(
        PreviewRepository(),
        apiFactory: (url, bearer) => LumioApi(
          url,
          token: bearer,
          clientFactory: () => MockClient((request) async {
            expect(request.headers['X-Lumio-User'], 'canonical-store');
            keys.add(request.headers['Idempotency-Key']!);
            return http.Response('{', 200);
          }),
        ),
      );
      store.session = MobileSession(
        token: token,
        origin: origin.toString(),
        id: 'canonical-store',
        name: 'Synthetic owner',
        expiresAt: DateTime.now().add(const Duration(hours: 1)),
      );
      await expectLater(
        study(store.api),
        throwsA(apiError('INVALID_RESPONSE')),
      );
      await expectLater(
        study(store.api),
        throwsA(apiError('INVALID_RESPONSE')),
      );
      expect(keys[0], keys[1]);
      store.dispose();
    },
  );
  testWidgets(
    'Receipt copy explains lost output and new-credit risk instead of an automatic retry',
    (tester) async {
      final store = AppStore(PreviewRepository());
      await tester.pumpWidget(
        StoreScope(
          store: store,
          child: MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: Text(
                  errorText(context, const ApiFailure('AI_REQUEST_COMPLETED')),
                ),
              ),
            ),
          ),
        ),
      );
      expect(find.textContaining('tốn thêm credit'), findsOneWidget);
      expect(find.textContaining('chưa khôi phục được'), findsOneWidget);
      store.dispose();
    },
  );
}
