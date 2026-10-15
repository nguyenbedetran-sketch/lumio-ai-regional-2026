import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'models.dart';

/// A flushed write + prior-version backup; errors never become an empty library.
class LocalRepository {
  LocalRepository(this.directory);
  final Directory directory;
  bool recoveredBackup = false;
  String scopeFile(String scope) =>
      '${directory.path}/library-${sha256.convert(utf8.encode(scope))}.json';
  Future<LibraryData> load(String scope) async {
    recoveredBackup = false;
    final file = File(scopeFile(scope));
    if (!await file.exists()) return const LibraryData();
    try {
      return LibraryData.fromJson(
        object(jsonDecode(await file.readAsString())),
      );
    } catch (_) {
      final backup = File('${file.path}.bak');
      if (!await backup.exists()) rethrow;
      final data = LibraryData.fromJson(
        object(jsonDecode(await backup.readAsString())),
      );
      recoveredBackup = true;
      return data;
    }
  }

  Future<void> save(String scope, String snapshot) async {
    LibraryData.fromJson(object(jsonDecode(snapshot)));
    await directory.create(recursive: true);
    final file = File(scopeFile(scope));
    final pending = File('${file.path}.next');
    await pending.writeAsString(snapshot, flush: true);
    if (await file.exists()) {
      // Do not replace a valid backup with corrupt data during recovery.
      var valid = true;
      try {
        LibraryData.fromJson(object(jsonDecode(await file.readAsString())));
      } on FormatException {
        valid = false;
      } on TypeError {
        valid = false;
      }
      if (valid) await file.copy('${file.path}.bak');
    }
    await pending.rename(file.path);
  }

  Future<Map<String, dynamic>> readSettings() async {
    final file = File('${directory.path}/settings.json');
    return await file.exists()
        ? object(jsonDecode(await file.readAsString()))
        : {};
  }

  Future<void> saveSettings(Map<String, dynamic> settings) async {
    await directory.create(recursive: true);
    final file = File('${directory.path}/settings.next');
    await file.writeAsString(jsonEncode(settings), flush: true);
    await file.rename('${directory.path}/settings.json');
  }
}

/// Browser build is a clearly labelled, non-persistent visual preview only.
class PreviewRepository implements LocalRepository {
  final Map<String, String> _libraries = {};
  Map<String, dynamic> _settings = {};
  @override
  bool recoveredBackup = false;
  @override
  Directory get directory => throw UnsupportedError(
    'Native storage is unavailable in browser preview',
  );
  @override
  String scopeFile(String scope) => scope;
  @override
  Future<LibraryData> load(String scope) async => _libraries[scope] == null
      ? const LibraryData()
      : LibraryData.fromJson(object(jsonDecode(_libraries[scope]!)));
  @override
  Future<void> save(String scope, String snapshot) async {
    LibraryData.fromJson(object(jsonDecode(snapshot)));
    _libraries[scope] = snapshot;
  }

  @override
  Future<Map<String, dynamic>> readSettings() async => Map.of(_settings);
  @override
  Future<void> saveSettings(Map<String, dynamic> settings) async {
    _settings = Map.of(settings);
  }
}
