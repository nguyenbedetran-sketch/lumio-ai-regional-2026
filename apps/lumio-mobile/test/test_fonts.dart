import 'dart:io';
import 'package:flutter/services.dart';

/// Find the existing Flutter SDK cache from flutter_tester, not a checkout path.
Future<void> loadLumioTestFonts() async {
  Directory? fonts;
  final configured = Platform.environment['FLUTTER_ROOT'];
  if (configured != null) {
    final candidate = Directory(
      '$configured/bin/cache/artifacts/material_fonts',
    );
    if (candidate.existsSync()) fonts = candidate;
  }
  var directory = File(Platform.resolvedExecutable).parent;
  for (var i = 0; fonts == null && i < 10; i++) {
    final candidate = Directory('${directory.path}/material_fonts');
    if (candidate.existsSync()) fonts = candidate;
    final parent = directory.parent;
    if (parent.path == directory.path) break;
    directory = parent;
  }
  if (fonts == null) {
    throw StateError(
      'Flutter test fonts unavailable; do not publish an Ahem screenshot.',
    );
  }
  for (final pair in [
    ('Roboto', 'roboto-regular.ttf'),
    ('MaterialIcons', 'materialicons-regular.otf'),
  ]) {
    final loader = FontLoader(pair.$1)
      ..addFont(
        File(
          '${fonts.path}/${pair.$2}',
        ).readAsBytes().then(ByteData.sublistView),
      );
    await loader.load();
  }
}
