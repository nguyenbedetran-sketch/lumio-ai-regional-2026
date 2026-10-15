import type { Locale } from "./i18n";
export const competitionCopy: Record<
  Locale,
  { title: string; detail: string }
> = {
  vi: {
    title: "Bản dùng thử vòng khu vực · AI hoạt động thật",
    detail:
      "Học liệu mặc định lưu trên thiết bị; đồng bộ và chỉ mục tài liệu chỉ bật khi bạn chọn. Dữ liệu máy chủ có thể đặt lại trên hosting miễn phí. Toàn bản thử tối đa 200 lượt AI/ngày UTC, 3 lượt đồng thời; chưa mở thanh toán.",
  },
  en: {
    title: "Regional competition preview · live AI",
    detail:
      "Materials stay on this device by default; sync and document indexing are opt-in. Server data may reset on free hosting. Preview-wide limits: 200 AI attempts per UTC day, 3 concurrent. Payments are unavailable.",
  },
  ja: {
    title: "地域大会プレビュー・実際のAIを使用",
    detail:
      "教材は既定で端末に保存。同期と資料の索引は選択時のみ使用します。無料ホストではサーバーデータが消える場合があります。全体でUTC日付ごと200回、同時3件まで。決済は未対応です。",
  },
  ko: {
    title: "지역 대회 미리보기 · 실제 AI",
    detail:
      "기본적으로 자료는 기기에 저장되며 동기화와 자료 색인은 선택 시만 사용합니다. 무료 호스팅의 서버 데이터는 초기화될 수 있습니다. 전체 UTC 하루200회, 동시3회로 제한됩니다. 결제는 지원하지 않습니다.",
  },
  "zh-CN": {
    title: "区域赛试用版 · 真实 AI",
    detail:
      "教材默认保存在设备，同步和资料索引仅在主动选择后启用。免费托管的服务器数据可能重置。全站按UTC日每天最多200次AI尝试、同时3次。尚未开放支付。",
  },
};
