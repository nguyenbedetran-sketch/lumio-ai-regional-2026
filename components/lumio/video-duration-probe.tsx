"use client";
import { useEffect, useRef } from "react";
type Player = { getDuration(): number; destroy(): void };
type YouTubeAPI = {
  Player: new (target: HTMLElement, options: Record<string, unknown>) => Player;
};
// Official IFrame API; loading metadata never calls Lumio's AI endpoints.
let loading: Promise<YouTubeAPI> | undefined;
function loadAPI(): Promise<YouTubeAPI> {
  const win = window as Window & { YT?: YouTubeAPI };
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    let polls = 0;
    const timer = window.setInterval(() => {
      if (win.YT?.Player) {
        clearInterval(timer);
        resolve(win.YT);
      } else if (++polls > 60) {
        clearInterval(timer);
        loading = undefined;
        reject(new Error("VIDEO_METADATA_UNAVAILABLE"));
      }
    }, 250);
    if (!document.querySelector("script[data-lumio-youtube-api]")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.dataset.lumioYoutubeApi = "true";
      script.onerror = () => {
        clearInterval(timer);
        script.remove();
        loading = undefined;
        reject(new Error("VIDEO_METADATA_UNAVAILABLE"));
      };
      document.head.append(script);
    }
  });
  return loading;
}
export function VideoDurationProbe({
  videoURL,
  title,
  onDuration,
}: {
  videoURL: string;
  title: string;
  onDuration: (seconds: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    callback = useRef(onDuration);
  callback.current = onDuration;
  useEffect(() => {
    let cancelled = false,
      player: Player | undefined,
      poll = 0;
    const container = host.current;
    if (!container) return;
    const child = document.createElement("div");
    container.append(child);
    void loadAPI()
      .then((api) => {
        if (cancelled) return;
        const videoId = new URL(videoURL).searchParams.get("v");
        player = new api.Player(child, {
          width: "100%",
          height: 210,
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { autoplay: 0, playsinline: 1, origin: location.origin },
          events: {
            onReady: () => {
              let tries = 0;
              poll = window.setInterval(() => {
                const duration = player?.getDuration() || 0;
                if (Number.isFinite(duration) && duration > 0) {
                  callback.current(Math.ceil(duration));
                  clearInterval(poll);
                } else if (++tries > 120) clearInterval(poll);
              }, 500);
            },
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearInterval(poll);
      player?.destroy();
      child.remove();
    };
  }, [videoURL]);
  return <div className="lm-duration-player" ref={host} aria-label={title} />;
}
