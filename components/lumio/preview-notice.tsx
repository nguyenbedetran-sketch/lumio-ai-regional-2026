"use client";
import { ChevronDown, Info, ShieldCheck } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { competitionCopy } from "../../lib/lumio/competition-copy";
import { publicDemoCopy } from "../../lib/lumio/public-demo-copy";
import {
  remoteStorageNotice,
  type StorageStatus,
} from "../../lib/lumio/storage-status";
import styles from "./preview-notice.module.css";

const summaries: Record<Locale, { competition: string; demo: string }> = {
  vi: {
    competition: "Hosting miễn phí: dữ liệu máy chủ có thể đặt lại.",
    demo: "Lưu trên trình duyệt; đăng nhập và AI trực tuyến đang tắt.",
  },
  en: {
    competition: "Free hosting: server data may reset.",
    demo: "Browser storage; sign-in and online AI are disabled.",
  },
  "zh-CN": {
    competition: "免费托管：服务器数据可能重置。",
    demo: "浏览器本地存储；登录与在线 AI 已关闭。",
  },
  ja: {
    competition: "無料ホストではサーバーデータが消える場合があります。",
    demo: "ブラウザーに保存。ログインとオンライン AI は無効です。",
  },
  ko: {
    competition: "무료 호스팅에서는 서버 데이터가 초기화될 수 있어요.",
    demo: "브라우저에 저장하며 로그인과 온라인 AI는 꺼져 있어요.",
  },
};
/** Only optional detail collapses. Storage/online-state warnings always remain visible. */
export function PreviewNotice({
  locale,
  kind,
  storage,
}: {
  locale: Locale;
  kind: "competition" | "demo";
  storage?: StorageStatus;
}) {
  const copy =
    kind === "competition" ? competitionCopy[locale] : publicDemoCopy[locale];
  const Icon = kind === "competition" ? ShieldCheck : Info;
  const remote =
    kind === "competition" ? remoteStorageNotice(locale, storage) : undefined;
  return (
    <details
      className={styles.notice}
      data-competition-preview={kind === "competition" || undefined}
      data-preview-notice={kind}
    >
      <summary>
        <Icon size={18} aria-hidden="true" />
        <span className={styles.copy}>
          <strong>{copy.title}</strong>
          <span>{remote?.summary ?? summaries[locale][kind]}</span>
        </span>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </summary>
      <p className={styles.detail}>
        {remote?.detail ?? ("detail" in copy ? copy.detail : copy.description)}
      </p>
    </details>
  );
}
