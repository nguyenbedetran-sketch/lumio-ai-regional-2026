import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:share_plus/share_plus.dart';
import 'package:lumio_mobile/core/app_store.dart';
import 'package:lumio_mobile/core/models.dart';
import 'package:lumio_mobile/core/repository.dart';
import 'package:lumio_mobile/core/study_share.dart';
import 'package:lumio_mobile/ui/common.dart';
import 'package:lumio_mobile/ui/study_motion.dart';
import 'package:lumio_mobile/ui/study_share.dart';

void main() {
  final item = StudyItem(
    id: 'private-item-id',
    title: 'Căn thức',
    source: 'Nguồn được chọn',
    notes: 'Ghi chú riêng không được chọn',
    summary: 'Tóm tắt được chọn',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
  );
  test(
    'Sharing selects one section and does not serialize other library fields',
    () {
      final draft = StudyShareDraft.fromItem(item, StudyShareSection.summary);
      final payload = draft.message(draft.text);
      expect(payload, 'Căn thức\n\nTóm tắt được chọn');
      expect(payload, isNot(contains(item.notes)));
      expect(payload, isNot(contains(item.source)));
      expect(payload, isNot(contains(item.id)));
      expect(
        StudyShareDraft.fromItem(item, StudyShareSection.notes).text,
        item.notes,
      );
      expect(
        StudyShareDraft.fromItem(item, StudyShareSection.source).text,
        item.source,
      );
    },
  );
  test(
    'Selected card includes its actual question and answer, not schedule or ID',
    () {
      final card = StudyCard(
        id: 'private-card-id',
        front: r'$\sqrt{a^2}$',
        back: r'$|a|$',
        due: DateTime(2027),
      );
      final draft = StudyShareDraft.card(item.title, card);
      expect(draft.text, contains(card.front));
      expect(draft.text, contains(card.back));
      expect(draft.text, isNot(contains(card.id)));
      expect(draft.text, isNot(contains('2027')));
    },
  );
  test(
    'Share length validation refuses empty and oversized text without truncating',
    () {
      expect(StudyShareDraft.valid('  '), false);
      final long = 'a' * (StudyShareDraft.maxCharacters + 1);
      final draft = StudyShareDraft(title: 'Bài', text: long);
      expect(draft.text.length, StudyShareDraft.maxCharacters + 1);
      expect(() => draft.message(long), throwsFormatException);
      expect(draft.message('Đoạn đã chọn'), 'Bài\n\nĐoạn đã chọn');
    },
  );

  for (final access in [false, true]) {
    testWidgets(
      'Motion is bypassed for ${access ? 'accessible navigation' : 'disabled animations'}',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(
                disableAnimations: !access,
                accessibleNavigation: access,
              ),
              child: const StudyMotion(child: Text('Học liệu')),
            ),
          ),
        );
        expect(find.byType(Animate), findsNothing);
        expect(find.text('Học liệu'), findsOneWidget);
        await tester
            .pumpAndSettle(); // Let MaterialApp finish its initial route frame.
        expect(tester.binding.hasScheduledFrame, false);
      },
    );
  }
  testWidgets('Entry and feedback animations finish, with no repeated ticker', (
    tester,
  ) async {
    for (final feedback in [false, true]) {
      await tester.pumpWidget(
        MaterialApp(
          key: ValueKey(feedback),
          home: StudyMotion(
            feedback: feedback,
            child: const Text('Kết quả thật'),
          ),
        ),
      );
      expect(find.byType(Animate), findsOneWidget);
      await tester.pumpAndSettle();
      expect(tester.binding.hasScheduledFrame, false);
      expect(find.text('Kết quả thật'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets(
    'Sharing requires preview then explicit action, sends edited text only and reports dismissal honestly',
    (tester) async {
      tester.view.physicalSize = const Size(430, 932);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final store = AppStore(PreviewRepository())..ready = true;
      ShareParams? sent;
      var calls = 0;
      await tester.pumpWidget(
        StoreScope(
          store: store,
          child: MaterialApp(
            home: Scaffold(
              body: Center(
                child: ShareLearningButton(
                  draft: StudyShareDraft.fromItem(
                    item,
                    StudyShareSection.summary,
                  ),
                  shareAction: (params) async {
                    sent = params;
                    calls++;
                    return const ShareResult('', ShareResultStatus.dismissed);
                  },
                ),
              ),
            ),
          ),
        ),
      );
      expect(calls, 0);
      await tester.tap(find.text('Chia sẻ nội dung này'));
      await tester.pumpAndSettle();
      expect(find.text('Xem trước khi chia sẻ'), findsOneWidget);
      expect(calls, 0);
      await tester.enterText(find.byType(TextField), 'Chỉ đoạn đã sửa');
      await tester.tap(find.text('Chọn ứng dụng nhận'));
      await tester.pumpAndSettle();
      expect(calls, 1);
      expect(sent!.text, 'Căn thức\n\nChỉ đoạn đã sửa');
      expect(sent!.files, isNull);
      expect(sent!.uri, isNull);
      expect(sent!.sharePositionOrigin!.width, greaterThan(0));
      expect(sent!.downloadFallbackEnabled, false);
      expect(
        find.text('Đã đóng bảng chia sẻ. Chưa xác nhận gửi.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'Share failure keeps draft editable and offers explicit copy, without auto-send',
    (tester) async {
      final store = AppStore(PreviewRepository())..ready = true;
      var calls = 0;
      await tester.pumpWidget(
        StoreScope(
          store: store,
          child: MaterialApp(
            home: Scaffold(
              body: ShareLearningSheet(
                draft: const StudyShareDraft(
                  title: 'Bài',
                  text: 'Nội dung được chọn',
                ),
                shareAction: (_) async {
                  calls++;
                  throw StateError('test-unavailable');
                },
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Chọn ứng dụng nhận'));
      await tester.pumpAndSettle();
      expect(calls, 1);
      expect(
        find.text('Chưa mở được bảng chia sẻ. Bạn có thể sao chép nội dung.'),
        findsOneWidget,
      );
      expect(find.text('Sao chép'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Giữ bản chỉnh sửa');
      expect(calls, 1);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
