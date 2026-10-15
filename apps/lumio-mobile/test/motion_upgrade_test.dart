import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumio_mobile/core/app_store.dart';
import 'package:lumio_mobile/core/models.dart';
import 'package:lumio_mobile/core/motion.dart';
import 'package:lumio_mobile/core/repository.dart';
import 'package:lumio_mobile/core/search.dart';
import 'package:lumio_mobile/main.dart';
import 'package:lumio_mobile/ui/common.dart';
import 'package:lumio_mobile/ui/focus.dart';
import 'package:lumio_mobile/ui/practice.dart';
import 'test_fonts.dart';
import 'package:lumio_mobile/ui/study.dart';
import 'package:lumio_mobile/ui/study_motion.dart';

StudyItem learningFixture(
  String id,
  String title, {
  bool practice = false,
}) => StudyItem(
  id: id,
  title: title,
  source:
      'Điều kiện căn thức: biểu thức dưới dấu căn không âm.\n\nTự tìm điều kiện trước khi rút gọn.',
  notes: practice ? 'Ghi chú của mình: kiểm tra điều kiện trước.' : '',
  summary: practice
      ? 'Bản ghi chú ví dụ do người học viết: căn thức xác định khi biểu thức dưới dấu căn không âm.'
      : '',
  createdAt: DateTime(2026, 10, 3),
  updatedAt: DateTime(2026, 10, 3),
  cards: practice
      ? [
          StudyCard(
            id: 'card-$id',
            front: 'Căn thức xác định khi nào?',
            back: 'Khi biểu thức dưới dấu căn không âm.',
            due: DateTime(2020),
          ),
        ]
      : [],
  questions: practice
      ? [
          QuizQuestion(
            id: 'quiz-$id',
            prompt: 'Điều kiện của căn bậc hai là gì?',
            options: ['Biểu thức không âm', 'Biểu thức luôn âm'],
            correct: 0,
            explanation:
                'Với căn bậc hai thực, biểu thức dưới căn cần không âm.',
          ),
        ]
      : [],
);

Widget pageHarness(
  AppStore store,
  Widget page, {
  MotionPreference motion = MotionPreference.auto,
  MediaQueryData media = const MediaQueryData(),
}) => StoreScope(
  store: store,
  child: MaterialApp(
    theme: lumioTheme(Brightness.light),
    home: MediaQuery(
      data: media,
      child: MotionScope(preference: motion, child: page),
    ),
  ),
);

Future<void> capture(WidgetTester tester, GlobalKey key, String name) async {
  await tester.runAsync(() async {
    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await Directory('../../docs/v7/evidence/native').create(recursive: true);
    await File(
      '../../docs/v7/evidence/native/$name',
    ).writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test(
    'Device accessibility always overrides full motion; unknown preference stays automatic',
    () {
      expect(readMotionPreference('future-mode'), MotionPreference.auto);
      expect(readMotionPreference('subtle'), MotionPreference.subtle);
      for (final preference in MotionPreference.values) {
        expect(
          resolveMotion(
            preference,
            disableAnimations: true,
            accessibleNavigation: false,
          ),
          MotionLevel.none,
        );
        expect(
          resolveMotion(
            preference,
            disableAnimations: false,
            accessibleNavigation: true,
          ),
          MotionLevel.none,
        );
      }
      expect(
        resolveMotion(
          MotionPreference.subtle,
          disableAnimations: false,
          accessibleNavigation: false,
        ),
        MotionLevel.subtle,
      );
      expect(
        resolveMotion(
          MotionPreference.auto,
          disableAnimations: false,
          accessibleNavigation: false,
        ),
        MotionLevel.full,
      );
    },
  );

  test(
    'Motion preference persists independently of library backups and other settings',
    () async {
      final repository = PreviewRepository();
      final first = AppStore(repository)..ready = true;
      await first.settings(
        motion: MotionPreference.subtle,
        locale: 'en',
        theme: ThemeMode.dark,
      );
      final second = AppStore(repository);
      await second.initialize();
      expect(second.ready, true);
      expect(second.motionPreference, MotionPreference.subtle);
      expect(second.language, 'en');
      expect(second.themeMode, ThemeMode.dark);
      expect(second.data.encode(), isNot(contains('motion')));
      first.dispose();
      second.dispose();
    },
  );

  test(
    'Vietnamese search accepts accents, decomposed accents and multiple terms',
    () {
      expect(
        matchesLearningText('Điều kiện căn thức bậc hai', 'can dieu kien'),
        true,
      );
      expect(
        matchesLearningText('Ca\u0306n thu\u031b\u0301c', 'can thuc'),
        true,
      );
      expect(matchesLearningText('Đại số', 'dai'), true);
      expect(matchesLearningText('Hình học', 'dai'), false);
      expect(matchesLearningText('Học liệu', '  '), true);
    },
  );

  for (final reduced in [false, true]) {
    testWidgets(
      'Card reveal exposes only current face and finishes ${reduced ? 'with reduced motion' : 'normally'}',
      (tester) async {
        final store = AppStore(PreviewRepository())..ready = true;
        var flipped = false;
        late StateSetter update;
        await tester.pumpWidget(
          pageHarness(
            store,
            StatefulBuilder(
              builder: (context, setState) {
                update = setState;
                return Scaffold(
                  body: CardReveal(
                    flipped: flipped,
                    front: const Text('Question visible'),
                    back: const Text('Answer visible'),
                  ),
                );
              },
            ),
            media: MediaQueryData(disableAnimations: reduced),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Question visible'), findsOneWidget);
        expect(find.text('Answer visible'), findsNothing);
        update(() => flipped = true);
        await tester.pump();
        if (reduced) expect(find.text('Answer visible'), findsOneWidget);
        await tester.pumpAndSettle();
        expect(find.text('Question visible'), findsNothing);
        expect(find.text('Answer visible'), findsOneWidget);
        expect(tester.binding.hasScheduledFrame, false);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        store.dispose();
      },
    );
  }

  testWidgets(
    'Library search and selected filter survive navigation between retained tabs',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final store = AppStore(PreviewRepository())
        ..ready = true
        ..onboarded = true;
      store.data = LibraryData(
        items: [
          learningFixture('math', 'Căn thức', practice: true),
          learningFixture('geo', 'Hình học'),
        ],
      );
      await tester.pumpWidget(LumioApp(store: store, monitorFocus: false));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thư viện').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'can');
      await tester.tap(find.text('Có thẻ ôn'));
      await tester.pumpAndSettle();
      expect(find.text('Căn thức'), findsOneWidget);
      expect(find.text('Hình học'), findsNothing);
      await tester.tap(find.text('Hôm nay').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thư viện').last);
      await tester.pumpAndSettle();
      expect(
        tester.widget<EditableText>(find.byType(EditableText)).controller.text,
        'can',
      );
      final chip = tester.widget<FilterChip>(
        find.widgetWithText(FilterChip, 'Có thẻ ôn'),
      );
      expect(chip.selected, true);
      expect(find.text('Hình học'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets('Real review rating persists once after card reveal', (
    tester,
  ) async {
    final item = learningFixture('math', 'Căn thức', practice: true);
    final store = AppStore(PreviewRepository())..ready = true;
    store.data = LibraryData(items: [item]);
    await tester.pumpWidget(pageHarness(store, ReviewPage(itemId: item.id)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xem đáp án'));
    await tester.pumpAndSettle();
    expect(find.text('Khi biểu thức dưới dấu căn không âm.'), findsOneWidget);
    await tester.tap(find.text('Nhớ'));
    await tester.pumpAndSettle();
    expect(store.item(item.id)!.cards.single.reviews, 1);
    expect(store.data.events.where((e) => e.kind == 'review').length, 1);
    expect(find.text('Đã ôn xong lượt này'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('Quiz locks the chosen answer and saves the actual result once', (
    tester,
  ) async {
    final item = learningFixture('math', 'Căn thức', practice: true);
    final store = AppStore(PreviewRepository())..ready = true;
    store.data = LibraryData(items: [item]);
    await tester.pumpWidget(
      pageHarness(store, QuizPage(itemId: item.id, questions: item.questions)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Biểu thức luôn âm'));
    await tester.pumpAndSettle();
    expect(find.text('Cùng xem lại'), findsOneWidget);
    await tester.tap(find.text('Biểu thức không âm'));
    await tester.pumpAndSettle();
    expect(find.text('Cùng xem lại'), findsOneWidget);
    await tester.ensureVisible(find.text('Hoàn thành'));
    await tester.tap(find.text('Hoàn thành'));
    await tester.pumpAndSettle();
    expect(store.item(item.id)!.attempts.single.correct, 0);
    expect(store.data.events.where((e) => e.kind == 'quiz').length, 1);
    expect(find.text('0 / 1'), findsOneWidget);
    expect(tester.binding.hasScheduledFrame, false);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets(
    'Focus dial shows actual seconds and finite progress, respecting reduced motion',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: true),
            child: Scaffold(
              body: FocusDial(
                remaining: 123,
                progress: .5,
                label: 'Đang tạm dừng',
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('02:03'), findsOneWidget);
      expect(find.text('Đang tạm dừng'), findsOneWidget);
      expect(tester.binding.hasScheduledFrame, false);
      expect(tester.takeException(), isNull);
    },
  );

  for (final dark in [false, true]) {
    testWidgets(
      'Home and studio render at 360px with large text ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(360, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        tester.platformDispatcher.textScaleFactorTestValue = 1.3;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        final store = AppStore(PreviewRepository())
          ..ready = true
          ..onboarded = true
          ..themeMode = dark ? ThemeMode.dark : ThemeMode.light;
        store.data = LibraryData(
          items: [learningFixture('math', 'Căn thức', practice: true)],
        );
        await tester.pumpWidget(LumioApp(store: store, monitorFocus: false));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Thư viện').last);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Căn thức'));
        await tester.pumpAndSettle();
        expect(find.text('Một nguồn. Nhiều cách hiểu.'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        store.dispose();
      },
    );
  }

  testWidgets(
    'Capture actual 0.3 home and studio Flutter widgets with labelled example content',
    (tester) async {
      tester.view.physicalSize = const Size(430, 932);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.runAsync(loadLumioTestFonts);
      final store = AppStore(PreviewRepository())
        ..ready = true
        ..onboarded = true
        ..themeMode = ThemeMode.light;
      store.data = LibraryData(
        items: [
          learningFixture(
            'example-math',
            'Ví dụ offline · Căn thức',
            practice: true,
          ),
        ],
      );
      final key = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: key,
          child: LumioApp(store: store, monitorFocus: false),
        ),
      );
      await tester.pumpAndSettle();
      await capture(tester, key, 'native-0.3-home.png');
      await tester.tap(find.text('Thư viện').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ví dụ offline · Căn thức'));
      await tester.pumpAndSettle();
      expect(find.byType(StudyPage), findsOneWidget);
      expect(tester.takeException(), isNull);
      await capture(tester, key, 'native-0.3-study.png');
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
