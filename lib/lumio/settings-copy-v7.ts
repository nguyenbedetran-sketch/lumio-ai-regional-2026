import type { Locale } from "./i18n";
const copy = {
  vi: {
    sync: "Thiết bị & đồng bộ",
    syncHint:
      "Chủ động chọn dữ liệu văn bản để tiếp tục học trên thiết bị khác.",
    sources: "Tra cứu nhiều học liệu",
    sourceHint: "Quản lý bản chỉ mục riêng và phạm vi gửi tới AI.",
    services: "Khả năng AI hiện có",
  },
  en: {
    sync: "Devices & sync",
    syncHint: "Choose which text data to use on another device.",
    sources: "Search across sources",
    sourceHint: "Manage your private index and what is sent to AI.",
    services: "Available AI capabilities",
  },
  "zh-CN": {
    sync: "设备与同步",
    syncHint: "主动选择要在其他设备使用的文字资料。",
    sources: "跨资料检索",
    sourceHint: "管理私人索引及发送给AI的内容。",
    services: "可用AI功能",
  },
  ja: {
    sync: "デバイスと同期",
    syncHint: "別のデバイスで使うテキストを選択します。",
    sources: "複数資料を検索",
    sourceHint: "個人の索引とAIに送る範囲を管理します。",
    services: "利用可能なAI機能",
  },
  ko: {
    sync: "기기 및 동기화",
    syncHint: "다른 기기에서 사용할 텍스트 자료를 직접 선택하세요.",
    sources: "여러 자료 검색",
    sourceHint: "비공개 색인과 AI에 보내는 범위를 관리하세요.",
    services: "사용 가능한 AI 기능",
  },
};
export function settingsCopy(locale: Locale) {
  return copy[locale];
}
