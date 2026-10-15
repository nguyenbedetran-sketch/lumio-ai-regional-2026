import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumio_mobile/core/api.dart';
import 'package:lumio_mobile/core/app_store.dart';
import 'package:lumio_mobile/core/models.dart';
import 'package:lumio_mobile/core/repository.dart';

StudyItem fixture([String id = 'material']) => StudyItem(
  id: id,
  title: 'Căn thức',
  source: '√(a²) = |a|',
  createdAt: DateTime(2026, 9, 27),
  updatedAt: DateTime(2026, 9, 27),
);

class PairApi extends LumioApi {
  PairApi(this.waiting) : super(Uri.parse('https://lumio.example'));
  final Future<MobileSession> waiting;
  @override
  Future<MobileSession> pair(String code, String device) => waiting;
  @override
  Future<Map<String, dynamic>> account() async => {
    'capabilities': {'ai': true, 'voice': true},
  };
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'Native pairing parses integer milliseconds and preserves expiry when stored as ISO',
    () async {
      final expiry = DateTime.now()
          .add(const Duration(days: 7))
          .millisecondsSinceEpoch;
      final client = MockClient((req) async {
        expect(req.url.path, '/api/mobile/pair/exchange');
        expect(req.headers.containsKey('Origin'), false);
        expect(req.headers.containsKey('Cookie'), false);
        return http.Response(
          jsonEncode({
            'accessToken': 'test-token-for-an-isolated-unit-test',
            'user': {'id': 'account-a', 'name': 'Test'},
            'expiresAt': expiry,
          }),
          200,
        );
      });
      final session = await LumioApi(
        Uri.parse('https://lumio.example'),
        clientFactory: () => client,
      ).pair('test-code', 'Test device');
      expect(session.expiresAt.millisecondsSinceEpoch, expiry);
      expect(
        MobileSession.fromJson(session.toJson()).expiresAt,
        session.expiresAt,
      );
    },
  );
  test(
    'Release requires HTTPS; debug HTTP only exact loopback/emulator hosts',
    () {
      for (final host in ['localhost', '127.0.0.1', '10.0.2.2', '[::1]']) {
        expect(
          validateServer('http://$host:3000', allowLocal: true).scheme,
          'http',
        );
        expect(
          () => validateServer('http://$host:3000', allowLocal: false),
          throwsA(isA<ApiFailure>()),
        );
      }
      for (final url in [
        'http://10.attacker.example',
        'http://192.168.attacker.example',
        'http://10.0.2.2.evil.example',
        'http://192.168.1.5',
        'https://user:secret@lumio.example',
        'https://lumio.example/path',
        'https://lumio.example?token=x',
      ]) {
        expect(
          () => validateServer(url, allowLocal: true),
          throwsA(isA<ApiFailure>()),
        );
      }
      expect(validateServer('https://lumio.example').host, 'lumio.example');
    },
  );
  test(
    'Bearer is attached only to configured origin and redirects are disabled',
    () async {
      final client = MockClient((req) async {
        expect(req.url.origin, 'https://lumio.example');
        expect(req.headers['Authorization'], 'Bearer synthetic-test-token');
        expect(req.followRedirects, false);
        return http.Response('{"user":{"id":"a"}}', 200);
      });
      await LumioApi(
        Uri.parse('https://lumio.example'),
        token: 'synthetic-test-token',
        clientFactory: () => client,
      ).account();
    },
  );
  test('Spaced review uses real ratings; again returns in 10 minutes', () {
    final now = DateTime(2026, 9, 27, 13);
    final card = StudyCard(id: 'c', front: 'F', back: 'B', due: now);
    expect(
      card.rated(ReviewRating.again, now).due,
      now.add(const Duration(minutes: 10)),
    );
    final good = card.rated(ReviewRating.good, now);
    expect(good.intervalDays, 1);
    expect(good.rated(ReviewRating.good, now).intervalDays, 3);
    expect(card.rated(ReviewRating.easy, now).intervalDays, 4);
  });
  test(
    'Streak handles yesterday, gaps, midnight and future events without login activity',
    () {
      final now = DateTime(2026, 9, 27, 0, 10);
      StudyEvent e(DateTime date) =>
          StudyEvent(id: date.toString(), kind: 'quiz', at: date);
      expect(studyStreak([], now), 0);
      expect(
        studyStreak([
          e(DateTime(2026, 9, 26, 23)),
          e(DateTime(2026, 9, 25)),
          e(DateTime(2026, 9, 28)),
        ], now),
        2,
      );
      expect(studyStreak([e(DateTime(2026, 9, 25))], now), 0);
      expect(studyStreak([e(now), e(DateTime(2026, 9, 26))], now), 2);
    },
  );
  test('Quiz rejects incomplete answers and grades against actual keys', () {
    final q = QuizQuestion(
      id: 'q',
      prompt: '2+2?',
      options: ['3', '4'],
      correct: 1,
      explanation: '',
    );
    expect(gradeQuiz([q], [1], DateTime.now()).correct, 1);
    expect(gradeQuiz([q], [0], DateTime.now()).correct, 0);
    expect(() => gradeQuiz([q], [], DateTime.now()), throwsFormatException);
    expect(() => gradeQuiz([q], [8], DateTime.now()), throwsFormatException);
  });
  test(
    'Pause and resume preserve remaining focus time; completed session counts once',
    () async {
      final store = AppStore(PreviewRepository())..ready = true;
      final start = DateTime.now().subtract(const Duration(minutes: 26));
      final focus = FocusSession(
        id: 'f',
        totalSeconds: 1500,
        remainingSeconds: 1500,
      ).resume(start);
      expect(
        focus.pause(start.add(const Duration(minutes: 5))).remainingSeconds,
        1200,
      );
      store.data = LibraryData(focus: focus);
      expect(await store.focusComplete(DateTime.now()), true);
      expect(await store.focusComplete(DateTime.now()), false);
      expect(store.data.events.single.minutes, 25);
      store.dispose();
    },
  );
  test(
    'Corrupt typed primary recovers backup and can subsequently save/reopen',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'lumio-mobile-test-',
      );
      addTearDown(() async {
        expect(
          directory.absolute.path.startsWith(
            Directory.systemTemp.absolute.path,
          ),
          true,
        );
        await directory.delete(recursive: true);
      });
      final repo = LocalRepository(directory);
      await repo.save('a', LibraryData(items: [fixture('old')]).encode());
      await repo.save('a', LibraryData(items: [fixture('new')]).encode());
      final broken = fixture('bad').toJson()..['id'] = 42;
      await File(repo.scopeFile('a')).writeAsString(
        jsonEncode({
          'version': 1,
          'items': [broken],
          'events': [],
        }),
      );
      final recovered = await repo.load('a');
      expect(repo.recoveredBackup, true);
      expect(recovered.items.single.id, 'old');
      await repo.save('a', LibraryData(items: [fixture('latest')]).encode());
      expect((await repo.load('a')).items.single.id, 'latest');
      expect((await repo.load('b')).items, isEmpty);
    },
  );
  test(
    'Account transition blocks late saves and preserves each account namespace',
    () async {
      final pairing = Completer<MobileSession>(), repo = PreviewRepository();
      final store = AppStore(
        repo,
        apiFactory: (_, _) => PairApi(pairing.future),
      )..ready = true;
      await store.upsert(fixture('guest-note'));
      final operation = store.pair('https://lumio.example', 'test-only');
      await Future<void>.delayed(Duration.zero);
      expect(store.switchingAccount, true);
      await expectLater(store.upsert(fixture('late-note')), throwsStateError);
      pairing.complete(
        MobileSession(
          token: 'synthetic-test-token-with-enough-length',
          origin: 'https://lumio.example',
          id: 'a',
          name: 'Test',
          expiresAt: DateTime.now().add(const Duration(days: 7)),
        ),
      );
      await operation;
      expect(store.data.items, isEmpty);
      await store.upsert(fixture('account-note'));
      await store.disconnect(revoke: false);
      expect(store.data.items.single.id, 'guest-note');
      expect(
        (await repo.load('https://lumio.example::a')).items.single.id,
        'account-note',
      );
      store.dispose();
    },
  );
  test(
    'Daily reading activity is deduplicated, while no data creates no progress',
    () async {
      final store = AppStore(PreviewRepository())..ready = true;
      expect(store.streak, 0);
      await store.activity('read', itemId: 'a');
      await store.activity('read', itemId: 'a');
      expect(store.data.events.length, 1);
      expect(store.streak, 1);
      store.dispose();
    },
  );
}
