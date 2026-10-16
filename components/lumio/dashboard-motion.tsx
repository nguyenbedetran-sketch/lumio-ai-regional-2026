"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BookOpen, Check, Layers, Target } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { dashboardCopy } from "../../lib/lumio/dashboard-v3-copy";

export type DashboardMotionMode = "full" | "subtle" | "off";

/** This component has no hidden initial state. Preferences can change while it is mounted. */
export function useDashboardMotion(): DashboardMotionMode {
  const [mode, setMode] = useState<DashboardMotionMode>("off");
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      const requested = document.documentElement.dataset.motion;
      setMode(
        reduced.matches || document.hidden || requested === "off"
          ? "off"
          : requested === "subtle"
            ? "subtle"
            : "full",
      );
    };
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    reduced.addEventListener("change", read);
    document.addEventListener("visibilitychange", read);
    window.addEventListener("lumio:motion", read);
    read();
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", read);
      document.removeEventListener("visibilitychange", read);
      window.removeEventListener("lumio:motion", read);
    };
  }, []);
  return mode;
}

export function DashboardReveal({
  mode,
  children,
}: {
  mode: DashboardMotionMode;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(new WeakSet<Element>());
  useEffect(() => {
    if (
      !root.current ||
      mode === "off" ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const animations = new Set<Animation>();
    const targets = Array.from(
      root.current.querySelectorAll<HTMLElement>("[data-dash-reveal]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        let stagger = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.current.has(entry.target)) continue;
          seen.current.add(entry.target);
          observer.unobserve(entry.target);
          if (typeof entry.target.animate !== "function") continue;
          const animation = entry.target.animate(
            mode === "full"
              ? [
                  { transform: "translateY(6px)", opacity: 0.9 },
                  { transform: "translateY(0)", opacity: 1 },
                ]
              : [{ opacity: 0.85 }, { opacity: 1 }],
            {
              duration: mode === "full" ? 280 : 180,
              delay: Math.min(stagger++ * 32, 64),
              easing: "cubic-bezier(.2,.75,.2,1)",
              fill: "none",
            },
          );
          animations.add(animation);
          animation.finished
            .then(() => animations.delete(animation))
            .catch(() => {});
        }
      },
      { threshold: 0.12 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [mode]);
  return (
    <div ref={root} className="dv-reveal-root">
      {children}
    </div>
  );
}

/** Every motion mode and assistive technology receives the saved metric, never an animated estimate. */
export function DashboardCounter({
  value,
  locale,
  suffix = "",
}: {
  value: number;
  locale: Locale;
  mode: DashboardMotionMode;
  suffix?: string;
}) {
  // Counts are actual saved observations; no interpolated or placeholder values.
  const format = (number: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    }).format(number) + suffix;
  return (
    <span className="dv-counter">
      <span aria-hidden="true">{format(value)}</span>
      <span className="dv-sr-only">{format(value)}</span>
    </span>
  );
}

export function LearningConstellation({
  locale,
  materials,
  quizzes,
  reviews,
  completedGoals,
  goals,
  mode,
  navigate,
}: {
  locale: Locale;
  materials: number;
  quizzes: number;
  reviews: number;
  completedGoals: number;
  goals: number;
  mode: DashboardMotionMode;
  navigate: (view: "library" | "progress" | "review" | "planner") => void;
}) {
  const c = dashboardCopy[locale];
  const id = useId().replaceAll(":", "");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || mode !== "full") return;
    const paths = root.current.querySelectorAll<SVGPathElement>(
      ".dv-constellation-link",
    );
    const animations = Array.from(paths).map((path, index) => {
      const length = path.getTotalLength();
      return path.animate(
        [
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
        ],
        {
          duration: 280,
          delay: Math.min(index * 32, 64),
          easing: "cubic-bezier(.2,.75,.2,1)",
          fill: "none",
        },
      );
    });
    return () => animations.forEach((animation) => animation.cancel());
  }, [mode]);
  const nodes = [
    {
      key: "materials",
      Icon: BookOpen,
      value: materials,
      label: c.materials,
      view: "library" as const,
    },
    {
      key: "practice",
      Icon: Target,
      value: quizzes,
      label: c.practice,
      view: "progress" as const,
    },
    {
      key: "reviews",
      Icon: Layers,
      value: reviews,
      label: c.reviews,
      view: "review" as const,
    },
    {
      key: "goals",
      Icon: Check,
      value: completedGoals,
      label: c.goals,
      view: "planner" as const,
    },
  ];
  return (
    <div className="dv-constellation" ref={root}>
      <svg
        className="dv-constellation-svg"
        viewBox="0 0 380 310"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`dv-mark-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#62a3ff" />
            <stop offset=".55" stopColor="#7055ff" />
            <stop offset="1" stopColor="#b598ff" />
          </linearGradient>
          <radialGradient id={`dv-glow-${id}`}>
            <stop stopColor="#aac984" stopOpacity=".16" />
            <stop offset="1" stopColor="#aac984" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="190" cy="153" r="128" fill={`url(#dv-glow-${id})`} />
        <circle cx="190" cy="153" r="96" className="dv-constellation-orbit" />
        <circle
          cx="190"
          cy="153"
          r="127"
          className="dv-constellation-orbit outer"
        />
        <path
          d="M190 153 C158 121 122 79 73 71"
          className={`dv-constellation-link ${materials ? "is-connected" : ""}`}
        />
        <path
          d="M190 153 C223 116 256 70 307 74"
          className={`dv-constellation-link ${quizzes ? "is-connected" : ""}`}
        />
        <path
          d="M190 153 C139 196 115 231 73 237"
          className={`dv-constellation-link ${reviews ? "is-connected" : ""}`}
        />
        <path
          d="M190 153 C239 191 272 235 308 237"
          className={`dv-constellation-link ${completedGoals ? "is-connected" : ""}`}
        />
        <rect
          x="146"
          y="109"
          width="88"
          height="88"
          rx="27"
          className="dv-constellation-core"
        />
        <path
          d="M163 137 V165 Q163 174 173 174 H184 M185 165 V140 L201 155 L217 140 V170"
          fill="none"
          stroke={`url(#dv-mark-${id})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M219 118 L222 126 L230 129 L222 132 L219 140 L216 132 L208 129 L216 126 Z"
          fill="#c8b7ff"
        />
        <circle cx="190" cy="25" r="3" fill="#cddfb5" />
        <circle cx="62" cy="153" r="2" fill="#779d90" />
        <circle cx="317" cy="153" r="2" fill="#779d90" />
        <circle cx="190" cy="280" r="3" fill="#a79adf" />
      </svg>
      {nodes.map(({ key, Icon, value, label, view }) => (
        <button
          className={`dv-constellation-node ${key} ${value > 0 ? "has-evidence" : ""}`}
          key={key}
          onClick={() => navigate(view)}
          aria-label={`${label}: ${value}${key === "goals" ? ` / ${goals}` : ""}`}
        >
          <span>
            <Icon size={15} />
            <strong>
              <DashboardCounter value={value} locale={locale} mode={mode} />
              {key === "goals" && <small> / {goals}</small>}
            </strong>
          </span>
          <small>{label}</small>
        </button>
      ))}
      <span className="dv-constellation-caption">{c.learningJourney}</span>
    </div>
  );
}
