import type { Locale } from "./i18n";

/** Safe public metadata, derived from an opened, usable database connection. */
export type StorageStatus = {
  mode: "local-sqlite" | "remote-libsql";
  ready: true;
};

export function safeStorageStatus(
  mode: unknown,
  ready: unknown,
): StorageStatus | undefined {
  return ready === true && (mode === "local-sqlite" || mode === "remote-libsql")
    ? { mode, ready: true }
    : undefined;
}

/** Configuration only: never a connection, network, backup or durability check. */
export function configuredStorageMode(
  value: unknown,
): StorageStatus["mode"] | "unknown" {
  if (value === undefined || value === "" || value === "local-sqlite")
    return "local-sqlite";
  return value === "remote-libsql" ? "remote-libsql" : "unknown";
}

const remoteNotice: Record<Locale, { summary: string; detail: string }> = {
  vi: {
    summary: "Database riêng; hosting miễn phí có thể ngủ.",
    detail:
      "Dữ liệu máy chủ lưu trong cơ sở dữ liệu từ xa, tách khỏi máy chạy web. Hosting miễn phí vẫn có thể ngủ hoặc gián đoạn. Học liệu trong trình duyệt vẫn lưu riêng trên thiết bị; đồng bộ và chỉ mục chỉ bật khi bạn chọn, không tự gửi dữ liệu tới AI. Không cam kết SLA, sao lưu tự động hoặc lưu trữ lâu dài. Toàn bản thử tối đa 200 lượt AI/ngày UTC, 3 lượt đồng thời; chưa mở thanh toán.",
  },
  en: {
    summary: "Separate database; free hosting may sleep.",
    detail:
      "Server data uses a remote database separate from the web host. Free hosting may still sleep or be interrupted. Browser materials remain separate on your device; sync and indexing are opt-in and do not automatically share data with AI. No SLA, automatic backups or long-term storage are promised. Preview-wide limits: 200 AI attempts per UTC day, 3 concurrent. Payments are unavailable.",
  },
  "zh-CN": {
    summary: "独立数据库；免费托管仍可能休眠。",
    detail:
      "服务器数据保存在与网站主机分离的远程数据库中。免费托管仍可能休眠或中断。浏览器教材仍独立保存在设备上；同步和索引仅在主动选择后启用，不会自动向 AI 分享数据。不承诺 SLA、自动备份或长期存储。全站按 UTC 日每天最多 200 次 AI 尝试、同时 3 次。尚未开放支付。",
  },
  ja: {
    summary: "別のデータベースを使用。無料ホストは休止する場合があります。",
    detail:
      "サーバーデータはウェブホストとは別のリモートデータベースに保存します。無料ホストは休止・中断する場合があります。ブラウザーの教材は端末に別途保存され、同期と索引は選択時のみ有効です。AIへ自動共有しません。SLA、自動バックアップ、長期保存は保証しません。全体で UTC 日付ごと 200 回、同時 3 件まで。決済は未対応です。",
  },
  ko: {
    summary: "별도 데이터베이스를 사용하며 무료 호스팅은 중지될 수 있어요.",
    detail:
      "서버 데이터는 웹 호스트와 분리된 원격 데이터베이스에 저장해요. 무료 호스팅은 여전히 중지되거나 끊길 수 있어요. 브라우저 학습 자료는 기기에 따로 저장되며 동기화와 색인은 직접 선택할 때만 켜져요. AI에 자동 공유하지 않아요. SLA, 자동 백업 또는 장기 보관은 보장하지 않아요. 전체 UTC 하루 200회, 동시 3회로 제한되며 결제는 지원하지 않아요.",
  },
};

/** An absent/invalid status retains the existing conservative local notice. */
export function remoteStorageNotice(
  locale: Locale,
  storage?: StorageStatus,
): { summary: string; detail: string } | undefined {
  return safeStorageStatus(storage?.mode, storage?.ready)?.mode ===
    "remote-libsql"
    ? remoteNotice[locale]
    : undefined;
}
