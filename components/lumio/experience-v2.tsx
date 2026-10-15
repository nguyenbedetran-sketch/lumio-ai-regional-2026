"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Copy,
  Globe2,
  Layers3,
  MonitorSmartphone,
  Smartphone,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { experienceCopy } from "../../lib/lumio/experience-copy";
import { Dialog } from "./dialog";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export type AndroidRelease = { href: string; version: string; verified: true };

// No generated download URL: release publication is an explicit caller decision.
function releaseLink(release?: AndroidRelease): string | null {
  if (!release?.verified || !release.version.trim()) return null;
  try {
    const url = new URL(release.href, "https://lumio.invalid");
    const relative =
      release.href.startsWith("/") && !release.href.startsWith("//");
    if (
      (!relative &&
        (!release.href.startsWith("https://") || url.protocol !== "https:")) ||
      url.username ||
      url.password ||
      !url.pathname.toLowerCase().endsWith(".apk")
    )
      return null;
    return relative ? `${url.pathname}${url.search}` : url.href;
  } catch {
    return null;
  }
}

/** Optional navigation wrapper. Never remounts child state or changes focus. */
export function PageTransition({
  transitionKey,
  children,
  className = "",
}: {
  transitionKey: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (
      !node?.animate ||
      preference.matches ||
      document.visibilityState === "hidden"
    )
      return;
    const animation = node.animate(
      [
        { opacity: 0.65, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
    const stop = () => {
      if (preference.matches) animation.cancel();
    };
    preference.addEventListener("change", stop);
    return () => {
      animation.cancel();
      preference.removeEventListener("change", stop);
    };
  }, [transitionKey]);
  return (
    <div className={`lv-page-transition ${className}`} ref={ref}>
      {children}
    </div>
  );
}

/** Render only during an actual load; no fabricated progress or timing. */
export function ExperienceSkeleton({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`lv-skeleton ${compact ? "compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="lv-skeleton-label">{label}</span>
      <div className="lv-skeleton-shapes" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export function ExperienceHub({
  locale,
  publicDemo = false,
  pairingAvailable = false,
  androidRelease,
}: {
  locale: Locale;
  publicDemo?: boolean;
  pairingAvailable?: boolean;
  androidRelease?: AndroidRelease;
}) {
  const c = experienceCopy[locale];
  const id = useId();
  const [guide, setGuide] = useState(false);
  const [device, setDevice] = useState<"android" | "ios">("android");
  const [deferredInstall, setDeferredInstall] = useState<InstallPrompt | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installError, setInstallError] = useState(false);
  const [origin, setOrigin] = useState("");
  const [localAddress, setLocalAddress] = useState(false);
  const [copied, setCopied] = useState<"" | "ok" | "error">("");
  const busy = useRef(false);
  const mounted = useRef(true);
  const apk = releaseLink(androidRelease);
  useEffect(() => {
    mounted.current = true;
    setOrigin(window.location.origin);
    setLocalAddress(
      ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname),
    );
    const display = window.matchMedia("(display-mode: standalone)");
    const checkDisplay = () =>
      setInstalled(
        display.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    const available = (event: Event) => {
      event.preventDefault();
      if (typeof (event as InstallPrompt).prompt === "function")
        setDeferredInstall(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setDeferredInstall(null);
    };
    checkDisplay();
    display.addEventListener("change", checkDisplay);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", complete);
    return () => {
      mounted.current = false;
      display.removeEventListener("change", checkDisplay);
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);
  async function install() {
    if (!deferredInstall || busy.current) return;
    busy.current = true;
    setInstalling(true);
    setInstallError(false);
    try {
      await deferredInstall.prompt();
      await deferredInstall.userChoice;
    } catch {
      if (mounted.current) setInstallError(true);
    } finally {
      busy.current = false;
      if (mounted.current) {
        setInstalling(false);
        setDeferredInstall(null);
      }
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(origin);
      if (mounted.current) setCopied("ok");
    } catch {
      if (mounted.current) setCopied("error");
    }
  }
  const icons = [Layers3, Target, WandSparkles];
  return (
    <section className="lv-experience" aria-labelledby={`${id}-title`}>
      <header className="lv-experience-heading">
        <div>
          <span className="lx-kicker">
            <Sparkles size={13} aria-hidden="true" /> {c.eyebrow}
          </span>
          <h2 id={`${id}-title`}>{c.title}</h2>
          <p>{c.description}</p>
        </div>
        <span className="lv-device-emblem" aria-hidden="true">
          <MonitorSmartphone size={38} strokeWidth={1.3} />
        </span>
      </header>
      <div className="lv-experience-grid">
        <div className="lv-new-features">
          <h3>{c.whatsNew}</h3>
          {c.features.map((feature, index) => {
            const Icon = icons[index];
            return (
              <div className="lv-feature" key={index}>
                <span aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div>
                  <h4>{feature.title}</h4>
                  <p>{feature.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="lv-mobile-card">
          <div className="lv-mobile-heading">
            <Smartphone size={22} aria-hidden="true" />
            <h3>{c.mobile}</h3>
          </div>
          <p>{c.mobileHint}</p>
          <dl className="lv-availability">
            <div>
              <dt>
                <Globe2 size={15} aria-hidden="true" />
                {c.browser}
              </dt>
              <dd className="available">
                <Check size={13} aria-hidden="true" />
                {installed ? c.installed : c.ready}
              </dd>
            </div>
            <div>
              <dt>{c.android}</dt>
              <dd>
                {apk
                  ? `${c.version} ${androidRelease!.version}`
                  : c.androidPending}
              </dd>
            </div>
            <div>
              <dt>{c.ios}</dt>
              <dd>{c.iosHint}</dd>
            </div>
          </dl>
          <div className="lv-mobile-actions">
            {apk && (
              <a
                className="lm-button primary"
                href={apk}
                download
                rel="noopener noreferrer"
              >
                <ArrowDownToLine size={16} aria-hidden="true" />
                {c.download}
              </a>
            )}
            {!installed && deferredInstall && (
              <button
                className="lm-button primary"
                disabled={installing}
                onClick={() => void install()}
              >
                {installing ? c.installing : c.install}
              </button>
            )}
            <button className="lm-button" onClick={() => setGuide(true)}>
              {c.guide}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {pairingAvailable && !publicDemo && (
              <a className="lx-text-button" href="/mobile">
                {c.pairing}
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            )}
          </div>
          {installError && (
            <p className="lm-error" role="alert">
              {c.installError}
            </p>
          )}
          <p className="lv-mobile-note">{c.localData}</p>
          {publicDemo && <p className="lv-demo-note">{c.publicDemo}</p>}
        </div>
      </div>
      {guide && (
        <Dialog title={c.mobile} close={() => setGuide(false)} label={c.close}>
          <div className="lv-install-guide">
            <div
              className="lv-device-picker"
              role="group"
              aria-label={c.chooseDevice}
            >
              <button
                aria-pressed={device === "android"}
                onClick={() => setDevice("android")}
              >
                Android
              </button>
              <button
                aria-pressed={device === "ios"}
                onClick={() => setDevice("ios")}
              >
                iPhone / iPad
              </button>
            </div>
            <ol>
              {(device === "android" ? c.androidGuide : c.iosGuide).map(
                (step, index) => (
                  <li key={index}>
                    <span aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p>{step}</p>
                  </li>
                ),
              )}
            </ol>
            <p className="lv-mobile-note">{c.installHint}</p>
            {origin && (
              <div className="lv-copy-address">
                <label htmlFor={`${id}-address`}>{c.address}</label>
                <input
                  id={`${id}-address`}
                  value={origin}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
                {localAddress ? (
                  <p>{c.localAddress}</p>
                ) : (
                  <button className="lm-button" onClick={() => void copy()}>
                    {copied === "ok" ? <Check size={15} /> : <Copy size={15} />}
                    {copied === "ok" ? c.copied : c.copy}
                  </button>
                )}
                <span role="status">
                  {copied === "error"
                    ? c.copyError
                    : copied === "ok"
                      ? c.copied
                      : ""}
                </span>
              </div>
            )}
            <p className="lv-mobile-note">{c.localData}</p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
