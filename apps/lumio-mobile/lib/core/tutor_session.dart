/// A display copy of server state. This class never increments hint counts or
/// grants a solution based on local messages or a learner-supplied counter.
class TutorSnapshot {
  const TutorSnapshot({
    required this.sessionId,
    required this.hintCount,
    required this.requiredHints,
    required this.serverCanUnlock,
    required this.needsClarification,
    required this.revision,
    required this.expiresAt,
  });
  final String sessionId;
  final int hintCount, requiredHints, revision;
  final bool serverCanUnlock, needsClarification;
  final DateTime expiresAt;
  bool get canUnlock =>
      serverCanUnlock &&
      !needsClarification &&
      hintCount >= requiredHints &&
      expiresAt.isAfter(DateTime.now());
  static TutorSnapshot? tryParse(dynamic value) {
    if (value is! Map) return null;
    final id = value['sessionId'],
        count = value['hintCount'],
        required = value['requiredHints'],
        revision = value['revision'],
        allowed = value['canUnlock'];
    final expiry = value['expiresAt'] is String
        ? DateTime.tryParse(value['expiresAt'])
        : null;
    if (id is! String ||
        !RegExp(
          r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
        ).hasMatch(id) ||
        count is! int ||
        count < 0 ||
        count > 100 ||
        required is! int ||
        required < 3 ||
        required > 100 ||
        revision is! int ||
        revision < 0 ||
        revision > 100 ||
        count > revision ||
        allowed is! bool ||
        expiry == null ||
        (value['needsClarification'] != null &&
            value['needsClarification'] is! bool)) {
      return null;
    }
    return TutorSnapshot(
      sessionId: id,
      hintCount: count,
      requiredHints: required,
      serverCanUnlock: allowed,
      needsClarification: value['needsClarification'] == true,
      revision: revision,
      expiresAt: expiry,
    );
  }
}

/// Kept only while a page is open; no new persisted student-data format.
class TutorSessionTracker {
  Object? _context;
  int generation = 0;
  TutorSnapshot? snapshot;
  String? get sessionId => snapshot?.sessionId;
  bool get canUnlock => snapshot?.canUnlock == true;
  bool bind(Object context) {
    if (_context == context) return false;
    final changed = _context != null;
    _context = context;
    reset();
    return changed;
  }

  void reset() {
    generation++;
    snapshot = null;
  }

  void accept(dynamic value, {required int expectedGeneration}) {
    if (expectedGeneration != generation) return;
    final next = value is TutorSnapshot ? value : TutorSnapshot.tryParse(value);
    if (next == null) return;
    if (snapshot?.sessionId == next.sessionId &&
        next.revision < snapshot!.revision) {
      return;
    }
    snapshot = next;
  }
}
