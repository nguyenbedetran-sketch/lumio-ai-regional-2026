import 'dart:convert';

const maxWebSyncBytes = 2 * 1024 * 1024;

class WebSyncFailure implements Exception {
  const WebSyncFailure(this.code);
  final String code;
  @override
  String toString() => code;
}

Map<String, dynamic> _map(dynamic v) {
  if (v is! Map) throw const WebSyncFailure('INVALID_SYNC_DATA');
  return Map<String, dynamic>.from(v);
}

bool webSyncEqual(dynamic a, dynamic b) {
  if (a is Map && b is Map) {
    return a.length == b.length &&
        a.keys.every((k) => b.containsKey(k) && webSyncEqual(a[k], b[k]));
  }
  if (a is List && b is List) {
    return a.length == b.length &&
        List.generate(
          a.length,
          (i) => i,
        ).every((i) => webSyncEqual(a[i], b[i]));
  }
  return a == b;
}

Map<String, dynamic> _clone(Map<String, dynamic> v) =>
    _map(jsonDecode(jsonEncode(v)));

/// A separate web contract. Never round-trip this through native StudyItem/LibraryData.
/// Unknown JSON metadata is retained locally; the server remains schema authority.
class WebSyncEnvelope {
  WebSyncEnvelope._(this._value);
  final Map<String, dynamic> _value;
  factory WebSyncEnvelope.fromJson(dynamic value) {
    try {
      final encoded = jsonEncode(value);
      if (utf8.encode(encoded).length > maxWebSyncBytes) {
        throw const WebSyncFailure('SYNC_TOO_LARGE');
      }
      final v = _map(jsonDecode(encoded)),
          library = _map(v['library']),
          learning = _map(v['learning']),
          preferences = _map(v['preferences']);
      if (v['version'] != 1 ||
          library['version'] != 1 ||
          learning['version'] != 1 ||
          preferences['version'] != 1 ||
          preferences['enabled'] is! bool ||
          preferences['feedback'] is! List ||
          library['items'] is! List ||
          library['spaces'] is! List ||
          (library['items'] as List).length > 100 ||
          (library['spaces'] as List).length > 100 ||
          learning['focus'] != null) {
        throw const WebSyncFailure('INVALID_SYNC_DATA');
      }
      for (final key in ['tasks', 'reviews', 'events']) {
        if (learning[key] is! List) {
          throw const WebSyncFailure('INVALID_SYNC_DATA');
        }
      }
      if (learning.containsKey('reviewOverrides') &&
          (learning['reviewOverrides'] is! List ||
              (learning['reviewOverrides'] as List).length > 20000)) {
        throw const WebSyncFailure('INVALID_SYNC_DATA');
      }
      for (final pair in [
        [library['spaces'], 'id'],
        [learning['tasks'], 'id'],
        [learning['reviews'], 'key'],
        [learning['events'], 'id'],
        if (learning.containsKey('reviewOverrides'))
          [learning['reviewOverrides'], 'key'],
      ]) {
        final seen = <String>{};
        for (final raw in pair[0] as List) {
          final key = _map(raw)[pair[1]];
          if (key is! String || key.isEmpty || !seen.add(key)) {
            throw const WebSyncFailure('INVALID_SYNC_DATA');
          }
        }
      }
      final ids = <String>{};
      for (final raw in library['items'] as List) {
        final i = _map(raw);
        if (i['id'] is! String ||
            (i['id'] as String).isEmpty ||
            (i['id'] as String).length > 100 ||
            !ids.add(i['id']) ||
            i['title'] is! String ||
            (i['title'] as String).length > 200 ||
            i['text'] is! String ||
            (i['text'] as String).length > 200000 ||
            i['notes'] is! String ||
            (i['notes'] as String).length > 200000 ||
            i['cards'] is! List ||
            i['questions'] is! List ||
            i['attempts'] is! List ||
            (i['cards'] as List).length > 500 ||
            (i['questions'] as List).length > 100 ||
            (i['attempts'] as List).length > 1000 ||
            ![
              'text',
              'pdf',
              'image',
              'audio',
              'video',
              'link',
            ].contains(i['kind'])) {
          throw const WebSyncFailure('INVALID_SYNC_DATA');
        }
      }
      return WebSyncEnvelope._(v);
    } on WebSyncFailure {
      rethrow;
    } catch (_) {
      throw const WebSyncFailure('INVALID_SYNC_DATA');
    }
  }
  Map<String, dynamic> toJson() => _clone(_value);
  String encode() => jsonEncode(_value);
  List<Map<String, dynamic>> get items =>
      (_value['library']['items'] as List).map((v) => _clone(_map(v))).toList();
  WebSyncEnvelope editNotes(String id, String notes, DateTime now) {
    if (notes.length > 200000) throw const WebSyncFailure('SYNC_TOO_LARGE');
    final v = toJson(), items = v['library']['items'] as List;
    final index = items.indexWhere((i) => i['id'] == id);
    if (index < 0) throw const WebSyncFailure('SYNC_ITEM_NOT_FOUND');
    items[index] = {
      ..._map(items[index]),
      'notes': notes,
      'updatedAt': now.toUtc().toIso8601String(),
    };
    return WebSyncEnvelope.fromJson(v);
  }
}

class WebSyncSnapshot {
  const WebSyncSnapshot({
    required this.epoch,
    required this.revision,
    required this.expiresAt,
    this.data,
  });
  final String epoch;
  final int revision;
  final DateTime expiresAt;
  final WebSyncEnvelope? data;
  factory WebSyncSnapshot.fromJson(Map<String, dynamic> v) {
    final epoch = v['epoch'],
        revision = v['revision'],
        expires = DateTime.tryParse(
          v['expiresAt'] is String ? v['expiresAt'] : '',
        );
    if (epoch is! String ||
        epoch.isEmpty ||
        epoch.length > 100 ||
        revision is! int ||
        revision < 0 ||
        revision > 1000000000 ||
        expires == null) {
      throw const WebSyncFailure('INVALID_RESPONSE');
    }
    return WebSyncSnapshot(
      epoch: epoch,
      revision: revision,
      expiresAt: expires,
      data: v['data'] == null ? null : WebSyncEnvelope.fromJson(v['data']),
    );
  }
}

enum WebSyncChoice { local, remote }

class WebSyncMerge {
  const WebSyncMerge(this.data, this.conflicts);
  final WebSyncEnvelope data;
  final List<String> conflicts;
}

/// Same atomic-record three-way semantics as web: no device-clock last-write-wins.
WebSyncMerge mergeWebSync(
  WebSyncEnvelope base,
  WebSyncEnvelope local,
  WebSyncEnvelope remote, {
  WebSyncChoice? choice,
}) {
  final b = base.toJson(),
      l = local.toJson(),
      r = remote.toJson(),
      conflicts = <String>[];
  // Older web clients omit controls they do not understand. Keep the known
  // base value; only an explicit [] or null expresses a deliberate clear.
  for (final value in [l, r]) {
    for (final fields in [
      ['learning', 'reviewOverrides'],
      ['preferences', 'excludedSkillAttemptIds'],
      ['preferences', 'studyFocusSkillId'],
    ]) {
      final section = value[fields[0]] as Map,
          before = b[fields[0]] as Map,
          key = fields[1];
      if (!section.containsKey(key) && before.containsKey(key)) {
        section[key] = before[key];
      }
    }
  }
  dynamic one(dynamic before, dynamic here, dynamic there, String label) {
    if (webSyncEqual(here, there)) return here;
    if (webSyncEqual(here, before)) return there;
    if (webSyncEqual(there, before)) return here;
    conflicts.add(label);
    return choice == WebSyncChoice.remote ? there : here;
  }

  List<dynamic> list(
    List before,
    List here,
    List there,
    String key,
    String label,
  ) {
    final bm = {for (final v in before) _map(v)[key]: v},
        lm = {for (final v in here) _map(v)[key]: v},
        rm = {for (final v in there) _map(v)[key]: v};
    final ids = {...bm.keys, ...lm.keys, ...rm.keys};
    return [for (final id in ids) ?one(bm[id], lm[id], rm[id], '$label: $id')];
  }

  // Evaluate each entry once; conflict lists remain stable and do not duplicate.
  final data = WebSyncEnvelope.fromJson({
    'version': 1,
    'library': {
      'version': 1,
      'items': list(
        b['library']['items'],
        l['library']['items'],
        r['library']['items'],
        'id',
        'Học liệu',
      ),
      'spaces': list(
        b['library']['spaces'],
        l['library']['spaces'],
        r['library']['spaces'],
        'id',
        'Không gian',
      ),
    },
    'learning': {
      'version': 1,
      'focus': null,
      'tasks': list(
        b['learning']['tasks'],
        l['learning']['tasks'],
        r['learning']['tasks'],
        'id',
        'Mục tiêu',
      ),
      'reviews': list(
        b['learning']['reviews'],
        l['learning']['reviews'],
        r['learning']['reviews'],
        'key',
        'Lịch ôn',
      ),
      if ([b, l, r].any((v) => v['learning'].containsKey('reviewOverrides')))
        'reviewOverrides': list(
          b['learning']['reviewOverrides'] ?? [],
          l['learning']['reviewOverrides'] ?? [],
          r['learning']['reviewOverrides'] ?? [],
          'key',
          'Lịch ôn tự chọn',
        ),
      'events': list(
        b['learning']['events'],
        l['learning']['events'],
        r['learning']['events'],
        'id',
        'Hoạt động',
      ),
    },
    'preferences': one(
      b['preferences'],
      l['preferences'],
      r['preferences'],
      'Cá nhân hóa',
    ),
  });
  return WebSyncMerge(data, conflicts);
}

abstract interface class WebSyncTransport {
  Future<Map<String, dynamic>> read();
  Future<Map<String, dynamic>> write(Map<String, dynamic> body);
  Future<void> delete({required String epoch, required int revision});
  void cancel();
}
