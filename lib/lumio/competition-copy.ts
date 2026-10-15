import type { Locale } from "./i18n";
export const competitionCopy: Record<Locale, {title:string; detail:string}> = {
  vi: {title:"Bản dùng thử vòng khu vực · AI hoạt động thật", detail:"Học liệu lưu trên thiết bị này. Tài khoản, credit và phiên gia sư là dữ liệu thử nghiệm; có thể đặt lại khi hosting miễn phí khởi động lại. Tối đa 200 yêu cầu AI/ngày cho toàn bản thử, tính từ lần khởi động máy chủ; chưa mở thanh toán."},
  en: {title:"Regional competition preview · live AI",detail:"Materials stay on this device. Test accounts, credits and tutor sessions may reset when free hosting restarts. Up to 200 AI requests per day across the preview since server startup. Payments are unavailable."},
  ja: {title:"地域大会プレビュー・実際のAIを使用",detail:"教材はこの端末に保存されます。無料ホストの再起動で試用アカウント、クレジット、学習セッションがリセットされる場合があります。プレビュー全体で1日200リクエストまで（サーバー再起動でリセット）。決済は未対応です。"},
  ko: {title:"지역 대회 미리보기 · 실제 AI",detail:"학습 자료는 이 기기에 저장됩니다. 무료 호스팅 재시작 시 시험 계정, 크레딧, 튜터 세션이 초기화될 수 있습니다. 서버 시작 이후 미리보기 전체 하루 200개 AI 요청으로 제한됩니다. 결제는 지원하지 않습니다."},
  "zh-CN": {title:"区域赛试用版 · 真实 AI",detail:"学习资料保存在本设备。免费主机重启时，试用账户、积分和辅导会话可能重置。全站每天最多200次AI请求，服务器重启会重置计数。尚未开放支付。"},
};
