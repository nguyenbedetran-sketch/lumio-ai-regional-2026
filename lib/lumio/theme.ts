export type ThemePreference = "light" | "dark" | "system";
export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}
export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): "light" | "dark" {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}
export function readThemePreference(): ThemePreference {
  try {
    return normalizeThemePreference(localStorage.getItem("lumio-theme"));
  } catch {
    return "system";
  }
}

/** Constant parser-blocking bootstrap: no user strings are interpolated into JS.
 * It changes only the resolved root attribute, never the persisted preference. */
export const themeBootstrapScript = `(function(){var p="system",d=true;try{var s=localStorage.getItem("lumio-theme");if(s==="light"||s==="dark"||s==="system")p=s;}catch(e){}if(p==="system"){try{d=matchMedia("(prefers-color-scheme: dark)").matches;}catch(e){}}document.documentElement.dataset.theme=p==="system"?(d?"dark":"light"):p;})();`;
