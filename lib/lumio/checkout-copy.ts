import type { Locale } from "./i18n";
const en = {
  pay: "Payment",
  checking: "Checking payment availability…",
  unavailable: "Payments are not open",
  hint: "Check the payment status. This does not charge money, grant credits or change your plan.",
  price:
    "Sale prices are not configured. Displayed prices are proposals; no transaction was created.",
  provider:
    "The payment provider is not connected. No money was charged and your plan has not changed.",
  signIn: "Sign in to check payment availability.",
  free: "Free does not require payment.",
};
export const checkoutCopy: Record<Locale, typeof en> = {
  en,
  vi: {
    pay: "Thanh toán",
    checking: "Đang kiểm tra thanh toán…",
    unavailable: "Thanh toán chưa mở",
    hint: "Kiểm tra trạng thái thanh toán; không thu tiền, cấp credit hay đổi gói học.",
    price:
      "Chưa cấu hình giá bán. Giá hiển thị là đề xuất; chưa tạo giao dịch.",
    provider:
      "Chưa kết nối cổng thanh toán. Tài khoản chưa bị trừ tiền và gói học chưa thay đổi.",
    signIn: "Đăng nhập để kiểm tra thanh toán.",
    free: "Gói Free không yêu cầu thanh toán.",
  },
  "zh-CN": {
    pay: "支付",
    checking: "正在检查支付状态…",
    unavailable: "支付尚未开放",
    hint: "检查支付状态，不扣款、不发放积分或更改套餐。",
    price: "尚未配置销售价格。显示价格为建议，未创建交易。",
    provider: "尚未连接支付服务。未扣款，套餐未改变。",
    signIn: "登录以检查支付状态。",
    free: "Free 无需支付。",
  },
  ja: {
    pay: "お支払い",
    checking: "決済状況を確認中…",
    unavailable: "決済は未開始です",
    hint: "決済状況を確認します。請求、クレジット付与、プラン変更は行いません。",
    price: "販売価格は未設定です。表示価格は提案で、取引は作成されていません。",
    provider: "決済サービスは未接続です。請求やプラン変更はありません。",
    signIn: "決済状況を確認するにはログインしてください。",
    free: "Free は支払い不要です。",
  },
  ko: {
    pay: "결제",
    checking: "결제 가능 여부 확인 중…",
    unavailable: "결제가 아직 열리지 않았습니다",
    hint: "결제 상태를 확인합니다. 청구, 크레딧 지급 또는 요금제 변경은 하지 않습니다.",
    price:
      "판매 가격이 설정되지 않았습니다. 표시 가격은 제안이며 거래가 생성되지 않았습니다.",
    provider:
      "결제 서비스가 연결되지 않았습니다. 청구 및 요금제 변경이 없습니다.",
    signIn: "결제 가능 여부를 확인하려면 로그인하세요.",
    free: "Free는 결제가 필요하지 않습니다.",
  },
};
