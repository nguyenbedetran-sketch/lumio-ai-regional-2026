export type MotionMode = "full" | "subtle" | "off";
export const MOTION_STORAGE_KEY = "lumio-motion-v3";

export function parseMotionPreference(value: unknown): MotionMode {
  return value === "off" || value === "subtle" ? value : "full";
}

/** The system accessibility preference always takes precedence. */
export function resolveMotionMode(
  preference: MotionMode,
  systemReduced: boolean,
): MotionMode {
  return systemReduced ? "off" : parseMotionPreference(preference);
}
