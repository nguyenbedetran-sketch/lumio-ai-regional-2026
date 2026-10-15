/// A device preference, deliberately independent from learning data/backups.
enum MotionPreference { auto, subtle, full }

MotionPreference readMotionPreference(Object? value) =>
    MotionPreference.values.firstWhere(
      (mode) => mode.name == value,
      orElse: () => MotionPreference.auto,
    );

enum MotionLevel { none, subtle, full }

MotionLevel resolveMotion(
  MotionPreference preference, {
  required bool disableAnimations,
  required bool accessibleNavigation,
}) {
  if (disableAnimations || accessibleNavigation) return MotionLevel.none;
  return preference == MotionPreference.subtle
      ? MotionLevel.subtle
      : MotionLevel.full;
}
