"use client";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Network,
  ListTree,
  Download,
  ExternalLink,
  Play,
  Clock3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Camera,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { LearningItem } from "../../lib/lumio/types";
import {
  formatTime,
  summaryMarkdown,
  type StudyArtifact,
} from "../../lib/ai/summary";
import { downloadText } from "../../lib/lumio/enhancements";
import { youtubeURL } from "../../lib/ingestion/youtube";
import { rangeCopy } from "../../lib/ingestion/video-range";
import { fullSummaryCopy } from "../../lib/ai/full-summary-copy";
import { MathText } from "./math-text";
import { parseInlineContent } from "../../lib/lumio/rich-content";
import { contentViewCopy } from "../../lib/lumio/content-view-copy";
import { SourceReferences } from "./source-references";
import type { SourceReference } from "../../lib/ai/grounding";
export const summaryCopy = {
  vi: {
    overview: "Tổng quan",
    chapters: "Nội dung theo chương",
    mindmap: "Sơ đồ tư duy",
    key: "Những điều đáng nhớ",
    source: "Dựa trên nguồn",
    saved: "Đã lưu trong học liệu",
    approximate: "Mốc thời gian do AI ước lượng. Kiểm tra lại trong video.",
    untimed:
      "Nguồn văn bản chưa có mốc thời gian; các chương được chia theo chủ đề.",
    cover: "Ảnh bìa video — không phải ảnh tại từng chương",
    play: "Xem video",
    openYouTube: "Mở trên YouTube",
    detail: "Chọn một ý để khám phá",
    read: "Đọc chương liên quan",
    capture: "Chụp khung hình đang xem",
    frame: "Khung hình từ video của bạn",
    illustration: "Ảnh nguồn do bạn thêm",
    export: "Tải bản tóm tắt",
    exportMap: "Tải sơ đồ SVG",
    quote: "Trích nguyên văn từ nguồn",
    sourceChanged: "Bản tóm tắt được lưu theo nguồn tại thời điểm tạo.",
    sections: "chương",
    savedSummary: "Đã lưu tóm tắt và sơ đồ vào học liệu.",
    review:
      "Bản phân tích do AI tạo. Hãy đối chiếu nguồn khi cần độ chính xác.",
  },
  en: {
    overview: "Overview",
    chapters: "Chapters",
    mindmap: "Mind map",
    key: "Ideas to remember",
    source: "Based on",
    saved: "Saved in this material",
    approximate: "AI-estimated timestamps. Check them against the video.",
    untimed: "This text has no timestamp cues; chapters are grouped by topic.",
    cover: "Video cover — not a frame from each chapter",
    play: "Watch video",
    openYouTube: "Open on YouTube",
    detail: "Select an idea to explore",
    read: "Read related chapter",
    capture: "Capture current frame",
    frame: "Frame from your video",
    illustration: "Source image you added",
    export: "Download summary",
    exportMap: "Download SVG map",
    quote: "Exact source excerpt",
    sourceChanged:
      "This summary reflects the source at the time it was generated.",
    sections: "chapters",
    savedSummary: "Summary and mind map saved to this material.",
    review: "AI-generated analysis. Check the source when precision matters.",
  },
  "zh-CN": {
    overview: "概览",
    chapters: "章节",
    mindmap: "思维导图",
    key: "值得记住的要点",
    source: "基于来源",
    saved: "已保存到学习资料",
    approximate: "时间为 AI 估计，请对照视频检查。",
    untimed: "文字没有时间标记；章节按主题划分。",
    cover: "视频封面，并非各章节的画面",
    play: "播放视频",
    openYouTube: "在 YouTube 上打开",
    detail: "选择一个概念查看详情",
    read: "阅读相关章节",
    capture: "截取当前画面",
    frame: "来自你的视频的画面",
    illustration: "你添加的来源图片",
    export: "下载总结",
    exportMap: "下载 SVG 导图",
    quote: "来源原文",
    sourceChanged: "此总结基于生成时的来源。",
    sections: "章节",
    savedSummary: "总结和导图已保存。",
    review: "AI 生成的分析，需要准确性时请核对来源。",
  },
  ja: {
    overview: "概要",
    chapters: "チャプター",
    mindmap: "マインドマップ",
    key: "覚えておきたい要点",
    source: "出典",
    saved: "学習資料に保存済み",
    approximate: "時刻はAIによる推定です。動画で確認してください。",
    untimed: "時刻情報がない文章のため、トピック別に章分けしています。",
    cover: "動画の表紙画像です。各章のフレームではありません。",
    play: "動画を見る",
    openYouTube: "YouTube で開く",
    detail: "項目を選んで詳しく見る",
    read: "関連する章を読む",
    capture: "現在のフレームを撮影",
    frame: "あなたの動画のフレーム",
    illustration: "追加した出典画像",
    export: "要約をダウンロード",
    exportMap: "SVGをダウンロード",
    quote: "出典の原文",
    sourceChanged: "生成時点の出典に基づく要約です。",
    sections: "章",
    savedSummary: "要約とマップを保存しました。",
    review: "AIによる分析です。正確さが必要な場合は出典を確認してください。",
  },
  ko: {
    overview: "개요",
    chapters: "챕터",
    mindmap: "마인드맵",
    key: "기억할 핵심",
    source: "출처 기반",
    saved: "학습 자료에 저장됨",
    approximate: "AI가 추정한 시점입니다. 영상에서 확인하세요.",
    untimed: "시간 정보가 없는 글이므로 주제별로 나누었습니다.",
    cover: "영상 표지이며 각 챕터의 장면이 아닙니다.",
    play: "영상 보기",
    openYouTube: "YouTube에서 열기",
    detail: "개념을 선택하여 살펴보세요",
    read: "관련 챕터 읽기",
    capture: "현재 장면 캡처",
    frame: "내 영상의 장면",
    illustration: "직접 추가한 원본 이미지",
    export: "요약 다운로드",
    exportMap: "SVG 다운로드",
    quote: "원문 인용",
    sourceChanged: "생성 시점의 자료를 바탕으로 한 요약입니다.",
    sections: "챕터",
    savedSummary: "요약과 마인드맵을 저장했어요.",
    review: "AI가 생성한 분석입니다. 정확성이 필요하면 원문을 확인하세요.",
  },
};
const chapterNavigation = {
  vi: {
    search: "Tìm trong các chương",
    all: "Xem tất cả chương",
    previous: "Trang trước",
    next: "Trang sau",
  },
  en: {
    search: "Search all chapters",
    all: "View all chapters",
    previous: "Previous page",
    next: "Next page",
  },
  "zh-CN": {
    search: "搜索所有章节",
    all: "查看全部章节",
    previous: "上一页",
    next: "下一页",
  },
  ja: {
    search: "全章を検索",
    all: "全章を見る",
    previous: "前のページ",
    next: "次のページ",
  },
  ko: {
    search: "전체 챕터 검색",
    all: "모든 챕터 보기",
    previous: "이전 페이지",
    next: "다음 페이지",
  },
};
function wrapLabel(text: string) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 25 && current) {
      lines.push(current);
      current = word;
    } else current = (current + " " + word).trim();
  }
  if (current) lines.push(current);
  return lines
    .flatMap((line) => (line.length > 30 ? [line.slice(0, 28) + "…"] : line))
    .slice(0, 3);
}
function MindMap({
  artifact,
  locale,
  onChapter,
}: {
  artifact: StudyArtifact;
  locale: Locale;
  onChapter: (i: number) => void;
}) {
  const c = summaryCopy[locale],
    graph = artifact.summary.mindMap,
    [selected, setSelected] = useState(graph.nodes[0]?.id),
    [zoom, setZoom] = useState(1),
    [fit, setFit] = useState(1),
    svg = useRef<SVGSVGElement | null>(null);
  const height = Math.max(
    430,
    Math.ceil((graph.nodes.length - 1) / 2) * 112 + 60,
  );
  const canvas = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = () =>
      setFit(Math.min(1, element.clientWidth / 940, 570 / height));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);
  useEffect(() => {
    if (canvas.current) {
      canvas.current.scrollTop =
        (canvas.current.scrollHeight - canvas.current.clientHeight) / 2;
      canvas.current.scrollLeft =
        (canvas.current.scrollWidth - canvas.current.clientWidth) / 2;
    }
  }, [zoom, height, fit]);
  const positions = new Map(
    graph.nodes.map((node, i) => [
      node.id,
      i === 0
        ? { x: 470, y: height / 2 }
        : { x: i % 2 ? 155 : 785, y: 58 + Math.floor((i - 1) / 2) * 112 },
    ]),
  );
  const node = graph.nodes.find((n) => n.id === selected);
  const richLabels = graph.nodes.some((node) =>
    parseInlineContent(node.label).some((part) => part.kind !== "text"),
  );
  function exportMap() {
    if (!svg.current) return;
    const url = URL.createObjectURL(
      new Blob([svg.current.outerHTML], {
        type: "image/svg+xml;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lumio-mindmap.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="lm-map-workspace">
      <div className="lm-map-toolbar">
        <span>
          <Network size={16} />
          {c.mindmap}
        </span>
        <div>
          <button
            className="lm-icon"
            aria-label="Zoom in"
            onClick={() => setZoom((v) => Math.min(5, v + 0.4))}
          >
            <ZoomIn size={17} />
          </button>
          <button
            className="lm-icon"
            aria-label="Zoom out"
            onClick={() => setZoom((v) => Math.max(0.6, v - 0.2))}
          >
            <ZoomOut size={17} />
          </button>
          <button
            className="lm-icon"
            aria-label="Reset zoom"
            onClick={() => setZoom(1)}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="lm-button"
            onClick={exportMap}
            disabled={richLabels}
            title={richLabels ? contentViewCopy[locale].svg : undefined}
          >
            <Download size={15} />
            {c.exportMap}
          </button>
        </div>
      </div>
      {richLabels && (
        <p className="lm-help" data-map-export-limitation>
          {contentViewCopy[locale].svg}
        </p>
      )}
      <div className="lm-map-canvas" ref={canvas}>
        <svg
          ref={svg}
          xmlns="http://www.w3.org/2000/svg"
          width={940 * zoom * fit}
          height={height * zoom * fit}
          viewBox={`0 0 940 ${height}`}
          role="img"
          aria-label={`${c.mindmap}: ${artifact.summary.title}`}
        >
          <rect
            className="lm-map-background"
            width="940"
            height={height}
            fill="#f4f7ee"
            rx="20"
          />
          {graph.edges.map((edge, i) => {
            const a = positions.get(edge.source)!,
              b = positions.get(edge.target)!;
            return (
              <g key={i}>
                <path
                  d={`M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`}
                  stroke="#a4b991"
                  strokeWidth="2"
                  fill="none"
                />
                {edge.label && <title>{edge.label}</title>}
              </g>
            );
          })}
          {graph.nodes.map((n, i) => {
            const p = positions.get(n.id)!,
              lines = wrapLabel(n.label),
              active = selected === n.id;
            return (
              <g
                key={n.id}
                className="lm-map-node"
                data-root={i === 0}
                data-selected={active}
                role="button"
                tabIndex={0}
                aria-label={n.label}
                onClick={() => setSelected(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(n.id);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={p.x - 126}
                  y={p.y - 40}
                  width="252"
                  height="80"
                  rx="16"
                  fill={i === 0 ? "#234c40" : active ? "#e0efcf" : "#fff"}
                  stroke={active ? "#557b43" : "#d6e1c9"}
                  strokeWidth={active ? "2" : "1"}
                />
                {parseInlineContent(n.label).some(
                  (part) => part.kind !== "text",
                ) ? (
                  <foreignObject
                    x={p.x - 116}
                    y={p.y - 34}
                    width="232"
                    height="68"
                  >
                    <div
                      style={{
                        fontSize: 13,
                        color: i === 0 ? "#edf7df" : "#34543c",
                        textAlign: "center",
                        maxHeight: 68,
                        overflow: "auto",
                      }}
                    >
                      <MathText text={n.label} inline />
                    </div>
                  </foreignObject>
                ) : (
                  <text
                    x={p.x}
                    y={p.y - (lines.length - 1) * 9}
                    textAnchor="middle"
                    fontFamily="Arial,sans-serif"
                    fontSize="13"
                    fontWeight={i === 0 ? "700" : "500"}
                    fill={i === 0 ? "#edf7df" : "#34543c"}
                  >
                    {lines.map((line, index) => (
                      <tspan key={index} x={p.x} dy={index ? 18 : 0}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="lm-map-node-list" role="group" aria-label={c.detail}>
        {graph.nodes.map((n) => (
          <button
            key={n.id}
            aria-pressed={n.id === selected}
            onClick={() => setSelected(n.id)}
          >
            <MathText text={n.label} inline />
          </button>
        ))}
      </div>
      <div className="lm-map-detail">
        <small>{c.detail}</small>
        <h4>
          <MathText text={node?.label || ""} inline />
        </h4>
        <p>
          <MathText text={node?.detail || ""} inline />
        </p>
        {node?.chapterIndex !== undefined && (
          <button
            className="lm-button"
            onClick={() => onChapter(node.chapterIndex!)}
          >
            <BookOpen size={15} />
            {c.read}
          </button>
        )}
      </div>
    </div>
  );
}
export function RichSummary({
  artifact,
  item,
  locale,
  updateArtifact,
  onOpenSource,
}: {
  artifact: StudyArtifact;
  item: LearningItem;
  locale: Locale;
  updateArtifact?: (artifact: StudyArtifact) => void;
  onOpenSource?: (reference?: SourceReference) => void;
}) {
  const c = summaryCopy[locale],
    summary = artifact.summary,
    [tab, setTab] = useState<"overview" | "chapters" | "map">("overview"),
    [selected, setSelected] = useState(0),
    [chapterQuery, setChapterQuery] = useState(""),
    [chapterPage, setChapterPage] = useState(0),
    [blob, setBlob] = useState(""),
    [videoStart, setVideoStart] = useState<number | null>(null),
    [frame, setFrame] = useState<{ url: string; seconds: number } | null>(
      artifact.frames?.at(-1) || null,
    ),
    [ready, setReady] = useState(false),
    media = useRef<HTMLVideoElement | null>(null),
    audioMedia = useRef<HTMLAudioElement | null>(null);
  const video = youtubeURL(artifact.source.url || ""),
    videoId = video ? new URL(video).searchParams.get("v") : null;
  const youtubeTime = Math.floor(
    videoStart ?? artifact.source.range?.startSeconds ?? 0,
  );
  const navigation = chapterNavigation[locale];
  const filteredChapters = summary.chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(
      ({ chapter }) =>
        !chapterQuery.trim() ||
        `${chapter.title} ${chapter.summary} ${chapter.bullets.join(" ")}`
          .toLocaleLowerCase(locale)
          .includes(chapterQuery.trim().toLocaleLowerCase(locale)),
    );
  const chapterPages = Math.max(1, Math.ceil(filteredChapters.length / 40));
  const currentChapterPage = Math.min(chapterPage, chapterPages - 1);
  const visibleChapters = filteredChapters.slice(
    currentChapterPage * 40,
    (currentChapterPage + 1) * 40,
  );
  useEffect(() => {
    if (!item.blob) return;
    const url = URL.createObjectURL(item.blob);
    setBlob(url);
    return () => URL.revokeObjectURL(url);
  }, [item.blob]);
  function seek(seconds: number) {
    if (video) setVideoStart(seconds);
    else {
      const player = media.current || audioMedia.current;
      if (
        player &&
        Number.isFinite(player.duration) &&
        seconds < player.duration
      ) {
        player.currentTime = seconds;
        void player.play().catch(() => {});
      }
    }
  }
  return (
    <section className="lm-rich-summary">
      <div className="lm-summary-banner">
        <div>
          <small>
            {c.saved} ·{" "}
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(artifact.createdAt),
            )}
          </small>
          <h3>
            <MathText text={summary.title} inline />
          </h3>
          <p>
            {c.source}:{" "}
            <strong>
              <MathText text={artifact.source.title} inline />
            </strong>{" "}
            · {summary.chapters.length} {c.sections}
          </p>
          {artifact.source.range && (
            <p className="lm-summary-range">
              <Clock3 size={14} />
              {rangeCopy[locale].scope}:{" "}
              {formatTime(artifact.source.range.startSeconds)}–
              {formatTime(artifact.source.range.endSeconds)}
            </p>
          )}
          {artifact.source.coverage && (
            <p
              className="lm-summary-range lm-summary-whole"
              data-summary-coverage="whole"
            >
              <Clock3 size={14} />
              {artifact.source.coverage.method === "segmented-video" ? (
                <>
                  {fullSummaryCopy[locale].wholeVideo}: 00:00–
                  {formatTime(artifact.source.coverage.durationSeconds!)} ·{" "}
                  {artifact.source.coverage.parts!.length}{" "}
                  {fullSummaryCopy[locale].parts} ·{" "}
                  {artifact.source.coverage.durationBasis === "declared"
                    ? fullSummaryCopy[locale].declared
                    : fullSummaryCopy[locale].detected}
                </>
              ) : artifact.source.coverage.method === "full-media" ? (
                fullSummaryCopy[locale].wholeMedia
              ) : (
                fullSummaryCopy[locale].wholeText
              )}
            </p>
          )}
        </div>
        <button
          className="lm-button"
          onClick={() =>
            downloadText(summary.title, "md", summaryMarkdown(summary))
          }
        >
          <Download size={16} />
          {c.export} · {contentViewCopy[locale].markdown}
        </button>
      </div>
      {(video ||
        item.kind === "video" ||
        item.kind === "image" ||
        item.kind === "audio") && (
        <div className="lm-summary-media">
          {video ? (
            videoStart !== null ? (
              <iframe
                key={videoStart}
                title={item.title}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${Math.floor(videoStart)}`}
                allow="encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                className="lm-video-cover"
                onClick={() =>
                  setVideoStart(artifact.source.range?.startSeconds || 0)
                }
              >
                <img
                  alt={c.cover}
                  src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                />
                <span>
                  <Play size={26} />
                  {c.play}
                </span>
              </button>
            )
          ) : blob && item.kind === "video" ? (
            <>
              <video
                ref={media}
                src={blob}
                controls
                onLoadedData={() => setReady(true)}
              />
              <button
                className="lm-button"
                disabled={!ready}
                onClick={() => {
                  const v = media.current;
                  if (!v) return;
                  const canvas = document.createElement("canvas");
                  if (!v.videoWidth || !v.videoHeight) return;
                  const scale = Math.min(
                    1,
                    640 / v.videoWidth,
                    640 / v.videoHeight,
                  );
                  canvas.width = Math.max(1, Math.round(v.videoWidth * scale));
                  canvas.height = Math.max(
                    1,
                    Math.round(v.videoHeight * scale),
                  );
                  const context = canvas.getContext("2d");
                  if (!context) return;
                  context.drawImage(v, 0, 0, canvas.width, canvas.height);
                  let quality = 0.7,
                    url = canvas.toDataURL("image/jpeg", quality);
                  while (url.length > 250000 && quality > 0.15) {
                    quality -= 0.1;
                    url = canvas.toDataURL("image/jpeg", quality);
                  }
                  if (url.length > 250000) return;
                  const shot = {
                    url,
                    seconds: v.currentTime,
                    createdAt: new Date().toISOString(),
                  };
                  setFrame(shot);
                  updateArtifact?.({
                    ...artifact,
                    frames: [...(artifact.frames || []), shot].slice(-3),
                  });
                }}
              >
                <Camera size={16} />
                {c.capture}
              </button>
            </>
          ) : blob && item.kind === "audio" ? (
            <audio
              ref={audioMedia}
              src={blob}
              controls
              aria-label={item.title}
            />
          ) : blob && item.kind === "image" ? (
            <img
              className="lm-summary-source-image"
              src={blob}
              alt={c.illustration}
            />
          ) : null}
          {video && (
            <a
              className="lm-button"
              href={`${video}&t=${youtubeTime}s`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={15} />
              {c.openYouTube} · {formatTime(youtubeTime)}
            </a>
          )}
          {item.kind !== "audio" && (
            <small>
              {video
                ? c.cover
                : item.kind === "image"
                  ? c.illustration
                  : c.frame}
            </small>
          )}
          {frame && (
            <figure>
              <img
                src={frame.url}
                alt={`${c.frame} ${formatTime(frame.seconds)}`}
              />
              <figcaption>
                {c.frame} · {formatTime(frame.seconds)}
                <a
                  className="lm-button"
                  href={frame.url}
                  download={`lumio-frame-${Math.floor(frame.seconds)}.jpg`}
                  aria-label={`${c.frame} · ${formatTime(frame.seconds)}`}
                >
                  <Download size={15} />
                </a>
              </figcaption>
            </figure>
          )}
        </div>
      )}
      <div className="lm-summary-tabs" role="tablist">
        {(
          [
            ["overview", BookOpen, c.overview],
            ["chapters", ListTree, c.chapters],
            ["map", Network, c.mindmap],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => setTab(key)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="lm-summary-overview">
          <MathText text={summary.overview} />
          <h4>{c.key}</h4>
          <div className="lm-summary-keypoints">
            {summary.keyPoints.map((point, i) => (
              <article key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>
                  <MathText text={point} inline />
                </p>
              </article>
            ))}
          </div>
          <div className="lm-chapter-preview">
            {summary.chapters.slice(0, 12).map((chapter, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelected(i);
                  setChapterQuery("");
                  setChapterPage(0);
                  setTab("chapters");
                }}
              >
                <span className="lm-chapter-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>
                  <MathText text={chapter.title} inline />
                </strong>
                <ExternalLink size={14} />
              </button>
            ))}
          </div>
          {summary.chapters.length > 12 && (
            <button className="lm-button" onClick={() => setTab("chapters")}>
              <ListTree size={16} />
              {navigation.all} · {summary.chapters.length}
            </button>
          )}
        </div>
      )}
      {tab === "chapters" && (
        <div className="lm-summary-chapters">
          <aside>
            <label className="lm-chapter-search">
              <Search size={15} />
              <input
                aria-label={navigation.search}
                placeholder={navigation.search}
                value={chapterQuery}
                onChange={(event) => {
                  setChapterQuery(event.target.value);
                  setChapterPage(0);
                }}
              />
            </label>
            {visibleChapters.map(({ chapter, index: i }) => (
              <button
                key={i}
                aria-current={selected === i ? "true" : undefined}
                onClick={() => setSelected(i)}
              >
                <span className="lm-chapter-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <MathText text={chapter.title} inline />
              </button>
            ))}
            {chapterPages > 1 && (
              <div className="lm-chapter-pages">
                <button
                  className="lm-icon"
                  aria-label={navigation.previous}
                  disabled={currentChapterPage === 0}
                  onClick={() => setChapterPage(currentChapterPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {currentChapterPage + 1}/{chapterPages} ·{" "}
                  {filteredChapters.length} {c.sections}
                </span>
                <button
                  className="lm-icon"
                  aria-label={navigation.next}
                  disabled={currentChapterPage + 1 >= chapterPages}
                  onClick={() => setChapterPage(currentChapterPage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </aside>
          <article>
            <small>
              {String(selected + 1).padStart(2, "0")} /{" "}
              {String(summary.chapters.length).padStart(2, "0")}
            </small>
            <h3>
              <MathText text={summary.chapters[selected].title} inline />
            </h3>
            {summary.chapters[selected].startSeconds !== undefined && (
              <button
                className="lm-button lm-timestamp"
                onClick={() => seek(summary.chapters[selected].startSeconds!)}
                disabled={
                  !video && item.kind !== "video" && item.kind !== "audio"
                }
              >
                <Clock3 size={15} />
                {summary.chapters[selected].timestampKind === "approximate"
                  ? "≈ "
                  : ""}
                {formatTime(summary.chapters[selected].startSeconds!)}
              </button>
            )}
            <MathText text={summary.chapters[selected].summary} />
            <ul>
              {summary.chapters[selected].bullets.map((bullet, i) => (
                <li key={i}>
                  <MathText text={bullet} inline />
                </li>
              ))}
            </ul>
            {summary.chapters[selected].sourceQuote && (
              <blockquote>
                <small>{c.quote}</small>
                <MathText
                  text={summary.chapters[selected].sourceQuote || ""}
                  inline
                />
              </blockquote>
            )}
            <SourceReferences
              references={summary.chapters[selected].references}
              onOpenSource={onOpenSource}
              source={item.text}
              evidence={item.sourceEvidence}
              item={item}
              locale={locale}
            />
          </article>
        </div>
      )}
      {tab === "map" && (
        <MindMap
          key={artifact.id}
          artifact={artifact}
          locale={locale}
          onChapter={(index) => {
            setSelected(index);
            setChapterQuery("");
            setChapterPage(Math.floor(index / 40));
            setTab("chapters");
          }}
        />
      )}
      <p className="lm-summary-disclaimer">
        {summary.chapters.some((ch) => ch.timestampKind === "approximate")
          ? c.approximate
          : summary.chapters.every((ch) => ch.startSeconds === undefined)
            ? c.untimed
            : ""}{" "}
        {c.review} {c.sourceChanged}
      </p>
    </section>
  );
}
