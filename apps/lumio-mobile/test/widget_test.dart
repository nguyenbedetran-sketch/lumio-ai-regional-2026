import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumio_mobile/core/app_store.dart';
import 'package:lumio_mobile/core/repository.dart';
import 'package:lumio_mobile/main.dart';
import 'test_fonts.dart';

void main() {
  testWidgets(
    'Native home renders at phone width; offline material persists through navigation',
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
      final boundaryKey = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundaryKey,
          child: LumioApp(store: store, monitorFocus: false),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Tập trung một chút.\nTiến xa hơn mỗi ngày.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        final boundary =
            boundaryKey.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await Directory(
          '../../docs/v7/evidence/native',
        ).create(recursive: true);
        await File(
          '../../docs/v7/evidence/native/ui-preview.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
      await tester.tap(find.text('Thêm học liệu').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(0), 'Bài học thử');
      await tester.enterText(
        find.byType(TextField).at(1),
        'Tự kiểm tra kiến thức giúp nhận ra phần cần ôn lại.',
      );
      await tester.tap(find.text('Lưu').first);
      await tester.pumpAndSettle();
      expect(store.data.items.single.title, 'Bài học thử');
      await tester.tap(find.text('Thư viện').last);
      await tester.pumpAndSettle();
      expect(find.text('Bài học thử'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Bài học thử'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nguồn'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Chia sẻ nội dung này'));
      await tester.pumpAndSettle();
      expect(find.text('Xem trước khi chia sẻ'), findsOneWidget);
      expect(find.text('Chọn ứng dụng nhận'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        final boundary =
            boundaryKey.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File(
          '../../docs/v7/evidence/native/plugin-upgrade-share-preview.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
