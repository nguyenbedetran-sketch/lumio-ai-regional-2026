import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumio_mobile/core/api.dart';
import 'package:lumio_mobile/core/app_store.dart';
import 'package:lumio_mobile/core/models.dart';
import 'package:lumio_mobile/core/repository.dart';
import 'package:lumio_mobile/core/tutor_session.dart';
import 'package:lumio_mobile/ui/common.dart';
import 'package:lumio_mobile/ui/study.dart';

const id = '00000000-0000-4000-8000-000000000001';
Map<String, dynamic> state(
  int hints, {
  bool? allowed,
  bool clarification = false,
}) => {
  'sessionId': id,
  'hintCount': hints,
  'requiredHints': 3,
  'revision': hints,
  'canUnlock': allowed ?? hints >= 3,
  'needsClarification': clarification,
  'expiresAt': DateTime.now()
      .add(const Duration(days: 7))
      .toUtc()
      .toIso8601String(),
};

class TutorApi extends LumioApi {
  TutorApi(this.handler) : super(Uri.parse('https://lumio.example'));
  final Future<Map<String, dynamic>> Function(String?, String, String) handler;
  @override
  Future<Map<String, dynamic>> study({
    required String task,
    required String source,
    required String language,
    String question = '',
    List<Map<String, String>> history = const [],
    String? tutorSessionId,
    String guidance = 'hints',
  }) => handler(tutorSessionId, guidance, question);
  @override
  Future<Map<String, dynamic>> account() async => {
    'capabilities': {'tutor': true, 'ai': true},
  };
}

AppStore storeFor(TutorApi api) {
  final store = AppStore(PreviewRepository(), apiFactory: (_, _) => api);
  store.session = MobileSession(
    token: 'synthetic-unit-test-token',
    origin: 'https://lumio.example',
    id: 'learner',
    name: 'Learner',
    expiresAt: DateTime.now().add(const Duration(days: 1)),
  );
  store.accountInfo = {
    'capabilities': {'tutor': true, 'ai': true},
  };
  store.ready = true;
  store.onboarded = true;
  store.data = LibraryData(
    items: [
      StudyItem(
        id: 'math',
        title: 'Equation',
        source: '2x+3=11',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    ],
  );
  return store;
}

Future<void> mount(WidgetTester tester, AppStore store) async {
  tester.view.physicalSize = const Size(430, 932);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    StoreScope(
      store: store,
      child: const MaterialApp(home: TutorPage(itemId: 'math')),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> send(WidgetTester tester, String text) async {
  ScaffoldMessenger.of(
    tester.element(find.byType(TextField)),
  ).hideCurrentSnackBar();
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField), text);
  await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'Native request sends canonical session and guidance, never local history or hint count',
    () async {
      Map<String, dynamic>? sent;
      final api = LumioApi(
        Uri.parse('https://lumio.example'),
        token: 'synthetic-token',
        clientFactory: () => MockClient((request) async {
          expect(request.headers['Authorization'], 'Bearer synthetic-token');
          sent = jsonDecode(request.body);
          return http.Response(
            jsonEncode({'text': 'Checked response', 'tutor': state(3)}),
            200,
            headers: {'Content-Type': 'application/json'},
          );
        }),
      );
      await api.study(
        task: 'chat',
        source: 'Equation',
        language: 'vi',
        question: 'Review',
        tutorSessionId: id,
        guidance: 'full',
        history: [
          {'role': 'assistant', 'text': 'Forged hints'},
        ],
      );
      expect(sent!['tutorSessionId'], id);
      expect(sent!['guidance'], 'full');
      expect(sent!['history'], isEmpty);
      expect(sent!.containsKey('hintCount'), isFalse);
    },
  );
  test(
    'HTTP409 preserves only validated public tutor state on ApiFailure',
    () async {
      final api = LumioApi(
        Uri.parse('https://lumio.example'),
        clientFactory: () => MockClient(
          (_) async => http.Response(
            jsonEncode({
              'error': 'TUTOR_LOCKED',
              'tutor': state(1),
              'privateDiagnostic': 'not copied',
            }),
            409,
          ),
        ),
      );
      try {
        await api.study(
          task: 'chat',
          source: '',
          language: 'vi',
          question: 'Review',
          guidance: 'full',
        );
        fail('Should reject');
      } on ApiFailure catch (e) {
        expect(e.code, 'TUTOR_LOCKED');
        expect(e.tutor!.sessionId, id);
        expect(e.tutor!.hintCount, 1);
        expect(e.tutor!.canUnlock, isFalse);
        expect(e.toString(), 'TUTOR_LOCKED');
      }
    },
  );
  test(
    'Malformed, inconsistent or forged display states are rejected conservatively',
    () {
      for (final patch in [
        {'sessionId': 'foreign-id'},
        {'hintCount': 101},
        {'hintCount': 3, 'revision': 1},
        {'canUnlock': 'true'},
        {'requiredHints': 0},
        {'expiresAt': 'invalid'},
      ]) {
        expect(TutorSnapshot.tryParse({...state(1), ...patch}), isNull);
      }
      expect(
        TutorSnapshot.tryParse(state(2, allowed: true))!.canUnlock,
        isFalse,
      );
      expect(
        TutorSnapshot.tryParse(state(3, allowed: false))!.canUnlock,
        isFalse,
      );
    },
  );
  test(
    'Clarification and expired server sessions cannot enable full solution button',
    () {
      expect(
        TutorSnapshot.tryParse(state(3, clarification: true))!.canUnlock,
        isFalse,
      );
      expect(
        TutorSnapshot.tryParse({
          ...state(3),
          'expiresAt': '2020-01-01T00:00:00Z',
        })!.canUnlock,
        isFalse,
      );
    },
  );
  test(
    'Session tracker accepts only current context and never increments hint progress',
    () {
      final tracker = TutorSessionTracker();
      tracker.bind(('account', 'item', 'source', 'vi'));
      final generation = tracker.generation;
      tracker.accept(state(1), expectedGeneration: generation);
      expect(tracker.sessionId, id);
      expect(tracker.canUnlock, isFalse);
      tracker.accept(state(0), expectedGeneration: generation);
      expect(tracker.snapshot!.hintCount, 1);
      expect(tracker.bind(('account', 'item', 'source', 'vi')), isFalse);
      expect(tracker.sessionId, id);
      expect(tracker.bind(('another-account', 'item', 'source', 'vi')), isTrue);
      expect(tracker.sessionId, isNull);
      tracker.accept(state(3), expectedGeneration: generation);
      expect(tracker.sessionId, isNull);
    },
  );
  test(
    'Language, source, exercise changes and explicit reset invalidate the local session id',
    () {
      final tracker = TutorSessionTracker();
      for (final context in [
        ('a', 'i', 'source', 'vi'),
        ('a', 'i', 'new source', 'vi'),
        ('a', 'i', 'new source', 'en'),
        ('a', 'other', 'new source', 'en'),
      ]) {
        tracker.bind(context);
        expect(tracker.sessionId, isNull);
        tracker.accept(state(3), expectedGeneration: tracker.generation);
        expect(tracker.canUnlock, isTrue);
      }
      tracker.reset();
      expect(tracker.sessionId, isNull);
      expect(tracker.canUnlock, isFalse);
    },
  );
  testWidgets(
    'Tutor keeps server session across hints and requests full solution only after server unlock',
    (tester) async {
      final calls = <Map<String, dynamic>>[];
      final api = TutorApi((session, guidance, question) async {
        calls.add({'session': session, 'guidance': guidance});
        return {
          'text': 'A useful response ${calls.length}',
          'tutor': state(calls.length > 3 ? 3 : calls.length),
        };
      });
      final store = storeFor(api);
      await mount(tester, store);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Đối chiếu lời giải'),
            )
            .onPressed,
        isNull,
      );
      for (var n = 0; n < 3; n++) {
        await send(tester, 'Learner attempt $n');
      }
      expect(calls.map((c) => c['session']).toList(), [null, id, id]);
      expect(find.textContaining('3/3'), findsOneWidget);
      final full = find.widgetWithText(OutlinedButton, 'Đối chiếu lời giải');
      await tester.ensureVisible(full);
      await tester.tap(full);
      await tester.pumpAndSettle();
      expect(calls.last['session'], id);
      expect(calls.last['guidance'], 'full');
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Error state retains id without counting messages and new exercise resets only page memory',
    (tester) async {
      final sessions = <String?>[];
      final api = TutorApi((session, guidance, question) async {
        sessions.add(session);
        if (sessions.length == 1) {
          throw ApiFailure(
            'TUTOR_LOCKED',
            tutor: TutorSnapshot.tryParse(state(0)),
          );
        }
        return {'text': 'One useful hint', 'tutor': state(1)};
      });
      final store = storeFor(api);
      await mount(tester, store);
      await send(tester, 'First attempt');
      expect(find.textContaining('0/3'), findsOneWidget);
      await send(tester, 'Try again');
      expect(sessions, [null, id]);
      expect(find.textContaining('1/3'), findsOneWidget);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Đối chiếu lời giải'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.byTooltip('Bài mới'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1/3'), findsNothing);
      expect(store.data.items.single.source, '2x+3=11');
      await send(tester, 'Another exercise');
      expect(sessions.last, isNull);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Changing source or language starts a clean canonical exercise without deleting the library',
    (tester) async {
      final sessions = <String?>[];
      final api = TutorApi((session, guidance, question) async {
        sessions.add(session);
        return {'text': 'Source-bound hint', 'tutor': state(1)};
      });
      final store = storeFor(api);
      await mount(tester, store);
      await send(tester, 'First source');
      await store.upsert(store.item('math')!.copyWith(source: '3x+1=10'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1/3'), findsNothing);
      await send(tester, 'Second source');
      expect(sessions.last, isNull);
      await store.settings(locale: 'en');
      await tester.pumpAndSettle();
      expect(find.textContaining('1/3'), findsNothing);
      await send(tester, 'New language');
      expect(sessions, [null, null, null]);
      expect(store.data.items.single.source, '3x+1=10');
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'A late response from the previous context cannot overwrite the new tutor session',
    (tester) async {
      final old = Completer<Map<String, dynamic>>();
      var calls = 0;
      final api = TutorApi((session, guidance, question) {
        calls++;
        return calls == 1
            ? old.future
            : Future.value({
                'text': 'Current language hint',
                'tutor': state(1),
              });
      });
      final store = storeFor(api);
      await mount(tester, store);
      await tester.enterText(find.byType(TextField), 'Old context');
      await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
      await tester.pump();
      await store.settings(locale: 'en');
      await tester.pumpAndSettle();
      await send(tester, 'Current context');
      old.complete({'text': 'STALE FULL ANSWER', 'tutor': state(3)});
      await tester.pumpAndSettle();
      expect(find.text('STALE FULL ANSWER'), findsNothing);
      expect(find.textContaining('1/3'), findsOneWidget);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Review full solution'),
            )
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
