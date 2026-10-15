"use client";
import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, Quote, ShieldCheck, Info } from "lucide-react";
import {
  validateReferences,
  type SourceEvidence,
  type SourceReference,
  type ContentQuality,
} from "../../lib/ai/grounding";
import type { LearningItem } from "../../lib/lumio/types";
import type { Locale } from "../../lib/lumio/i18n";
import { formatTime } from "../../lib/ai/summary";
import { MathText } from "./math-text";
import styles from "./source-references.module.css";

const copies = {
  vi: {
    title: "Đối chiếu học liệu",
    unknown: "Chưa xác định được vị trí nguồn",
    unknownHelp:
      "Nội dung này chưa có đoạn trích đã đối chiếu. Có thể là kiến thức bổ sung của AI; hãy kiểm tra trong tài liệu gốc.",
    page: "Trang",
    slide: "Trang chiếu",
    paragraph: "Đoạn",
    open: "Mở nguồn",
    excerpt: "Trích đoạn khớp nguồn",
    note: "Đoạn trích khớp văn bản được cung cấp; điều này chưa chứng minh câu trả lời AI đúng.",
    quality: "Kiểm tra trước khi học",
    checked: "Đã kiểm tra cấu trúc",
    cited: "mục có đoạn nguồn đối chiếu",
    semantic:
      "Tính đúng đắn, điều kiện và ý nghĩa vẫn cần kiểm tra với tài liệu hoặc giáo viên.",
    additional: "Nguồn chưa đủ để kiểm chứng nội dung này.",
  },
  en: {
    title: "Check against your source",
    unknown: "Source location is not established",
    unknownHelp:
      "No matching excerpt is available. This may include additional AI knowledge; check the original material.",
    page: "Page",
    slide: "Slide",
    paragraph: "Paragraph",
    open: "Open source",
    excerpt: "Matching excerpt",
    note: "The excerpt matches the supplied text; this does not prove that the AI answer is correct.",
    quality: "Check before studying",
    checked: "Structure checked",
    cited: "items have matching source excerpts",
    semantic:
      "Accuracy, conditions and meaning still need checking against the source or with a teacher.",
    additional: "The available source cannot verify this content.",
  },
  "zh-CN": {
    title: "对照学习资料",
    unknown: "尚未确定来源位置",
    unknownHelp: "没有可核对的原文，可能包含 AI 补充知识，请检查原始资料。",
    page: "页",
    slide: "幻灯片",
    paragraph: "段落",
    open: "打开来源",
    excerpt: "匹配的原文",
    note: "引文与所提供的文字匹配，但不证明 AI 的答案正确。",
    quality: "学习前核对",
    checked: "已检查结构",
    cited: "项包含匹配原文",
    semantic: "准确性、条件和含义仍需对照来源或请老师核查。",
    additional: "现有来源无法验证这些内容。",
  },
  ja: {
    title: "資料と照合",
    unknown: "出典の位置は未確認です",
    unknownHelp:
      "一致する引用はありません。AI の補足知識を含む場合があります。元の資料で確認してください。",
    page: "ページ",
    slide: "スライド",
    paragraph: "段落",
    open: "出典を開く",
    excerpt: "一致する引用",
    note: "引用が資料の文字と一致しても、AI の回答が正しい証明にはなりません。",
    quality: "学習前に確認",
    checked: "構造を確認済み",
    cited: "項目に一致する引用あり",
    semantic: "正確さ、条件、意味は資料や先生と確認してください。",
    additional: "この出典だけでは内容を検証できません。",
  },
  ko: {
    title: "학습 자료와 대조",
    unknown: "출처 위치를 확인하지 못했어요",
    unknownHelp:
      "일치하는 원문이 없어요. AI의 추가 지식일 수 있으므로 원본 자료를 확인하세요.",
    page: "쪽",
    slide: "슬라이드",
    paragraph: "문단",
    open: "출처 열기",
    excerpt: "일치하는 원문",
    note: "인용문이 제공된 글과 일치해도 AI 답변의 정확성을 증명하지는 않아요.",
    quality: "학습 전에 확인",
    checked: "구조 확인 완료",
    cited: "항목에 대조 원문이 있어요",
    semantic: "정확성, 조건, 의미는 원본이나 선생님과 확인해야 해요.",
    additional: "현재 출처로는 이 내용을 검증할 수 없어요.",
  },
};
export function SourceReferences({
  references,
  source,
  evidence,
  item,
  locale,
  onOpenSource,
}: {
  references?: SourceReference[];
  source: string;
  evidence?: SourceEvidence;
  item?: LearningItem;
  locale: Locale;
  onOpenSource?: (reference?: SourceReference) => void;
}) {
  const c = copies[locale],
    refs = [
      ...validateReferences(
        references?.filter((r) => !r.rag),
        source,
        evidence,
      ),
      ...(references || []).filter(
        (r) =>
          r.rag &&
          r.verification === "exact-excerpt" &&
          typeof r.quote === "string" &&
          r.quote.length >= 8 &&
          r.quote.length <= 500 &&
          /^[a-f0-9]{64}$/.test(r.rag.digest) &&
          /^[a-f0-9-]{36}$/.test(r.rag.documentId) &&
          /^[a-f0-9-]{36}$/.test(r.rag.snapshotId) &&
          typeof r.rag.title === "string" &&
          r.rag.title.length <= 200 &&
          Number.isInteger(r.start) &&
          Number.isInteger(r.end) &&
          r.end - r.start === r.quote.length &&
          Number.isInteger(r.paragraph) &&
          r.paragraph > 0,
      ),
    ];
  const [blobURL, setBlobURL] = useState("");
  useEffect(() => {
    if (!item?.blob) {
      setBlobURL("");
      return;
    }
    const url = URL.createObjectURL(item.blob);
    setBlobURL(url);
    return () => URL.revokeObjectURL(url);
  }, [item?.blob]);
  function href(ref: SourceReference) {
    if (ref.rag) return undefined;
    if (item?.kind === "pdf" && blobURL)
      return `${blobURL}${ref.page ? `#page=${ref.page}` : ""}`;
    try {
      const url = new URL(item?.sourceInfo?.url || item?.url || "");
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return undefined;
      if (
        ref.seconds !== undefined &&
        /(^|\.)(youtube\.com|youtu\.be)$/.test(url.hostname)
      )
        url.searchParams.set("t", String(ref.seconds));
      return url.href;
    } catch {
      return undefined;
    }
  }
  return (
    <section
      className={styles.sources}
      data-source-references
      data-reference-count={refs.length}
    >
      <div className={styles.heading}>
        <BookOpen size={17} />
        <strong>{c.title}</strong>
        <span>{refs.length ? c.excerpt : c.unknown}</span>
      </div>
      {refs.length ? (
        <>
          {refs.map((ref) => (
            <details
              key={`${ref.rag?.documentId || ""}:${ref.segmentId}:${ref.start}`}
              className={styles.reference}
              open={refs.length === 1}
            >
              <summary>
                <Quote size={15} />
                <span>
                  {ref.rag?.title ||
                    evidence?.filename ||
                    item?.fileName ||
                    item?.title ||
                    c.title}
                  {" · "}
                  {ref.page
                    ? `${c.page} ${ref.page}`
                    : ref.slide
                      ? `${c.slide} ${ref.slide}`
                      : `${c.paragraph} ${ref.paragraph}`}
                  {ref.seconds !== undefined
                    ? ` · ${formatTime(ref.seconds)}`
                    : ""}
                  {ref.heading ? ` · ${ref.heading}` : ""}
                </span>
              </summary>
              <blockquote>
                <MathText text={ref.quote} inline />
              </blockquote>
              <div className={styles.actions}>
                {onOpenSource && !ref.rag && (
                  <button
                    type="button"
                    className="lm-button"
                    onClick={() => onOpenSource(ref)}
                  >
                    <BookOpen size={15} />
                    {c.open}
                  </button>
                )}
                {href(ref) && (
                  <a
                    className="lm-button"
                    href={href(ref)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={15} />
                    {c.open}
                  </a>
                )}
              </div>
            </details>
          ))}
          <p className={styles.note}>
            <ShieldCheck size={14} />
            {c.note}
          </p>
        </>
      ) : (
        <p className={styles.note}>
          {c.unknownHelp}
          {onOpenSource && (
            <button
              type="button"
              className="lm-button"
              onClick={() => onOpenSource()}
            >
              {c.open}
            </button>
          )}
        </p>
      )}
    </section>
  );
}
export function ContentQualityNotice({
  quality,
  locale,
}: {
  quality?: ContentQuality;
  locale: Locale;
}) {
  if (!quality) return null;
  const c = copies[locale];
  return (
    <aside className={styles.quality} data-content-quality>
      <Info size={18} />
      <div>
        <strong>{c.quality}</strong>
        <p>
          {c.checked} · {quality.citedItems}/{quality.totalItems} {c.cited}.
        </p>
        <p>
          {c.semantic}{" "}
          {quality.citedItems < quality.totalItems ? c.additional : ""}
        </p>
      </div>
    </aside>
  );
}
