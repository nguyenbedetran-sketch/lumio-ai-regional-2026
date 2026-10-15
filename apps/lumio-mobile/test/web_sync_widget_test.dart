import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumio_mobile/core/api.dart';
import 'package:lumio_mobile/core/app_store.dart';
import 'package:lumio_mobile/core/repository.dart';
import 'package:lumio_mobile/ui/web_sync.dart';

void main() {
  testWidgets(
    'Snapshot card makes native-library boundary, retention and pairing explicit at phone width',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final store = AppStore(PreviewRepository())..ready = true;
      addTearDown(store.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(child: WebSyncCard(store: store)),
          ),
        ),
      );
      expect(find.text('Bản đồng bộ Web'), findsOneWidget);
      expect(
        find.textContaining('Thư viện native trong app vẫn riêng'),
        findsOneWidget,
      );
      expect(find.textContaining('7 ngày'), findsOneWidget);
      expect(find.textContaining('Ghép tài khoản ở trên'), findsOneWidget);
      expect(find.byType(CheckboxListTile), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Invalid restored server session cannot crash the mounted snapshot UI or expose its token',
    (tester) async {
      final store = AppStore(PreviewRepository())
        ..ready = true
        ..session = MobileSession(
          token: 'isolated-native-widget-token',
          origin: 'http://untrusted.example',
          id: 'synthetic-user',
          name: 'Synthetic',
          expiresAt: DateTime.utc(2030),
        );
      addTearDown(store.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(child: WebSyncCard(store: store)),
          ),
        ),
      );
      expect(find.textContaining('Chưa mở được bản web riêng'), findsOneWidget);
      expect(find.textContaining('isolated-native-widget-token'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
