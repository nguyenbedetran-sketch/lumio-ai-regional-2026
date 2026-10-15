import type { PlanId } from "../server/billing-types";
import type { Locale } from "./i18n";
/** Product-owner proposal for UI review. Never passed to wallet, entitlement or checkout code. */
export const PRICING_PREVIEW: Readonly<
  Record<
    PlanId,
    {
      monthlyVnd: number;
      yearlyVnd: number;
      credits: number;
      period: "once" | "month";
    }
  >
> = {
  free: { monthlyVnd: 0, yearlyVnd: 0, credits: 200, period: "once" },
  plus: { monthlyVnd: 59000, yearlyVnd: 590000, credits: 600, period: "month" },
  premium: {
    monthlyVnd: 129000,
    yearlyVnd: 1290000,
    credits: 1600,
    period: "month",
  },
  pro: {
    monthlyVnd: 249000,
    yearlyVnd: 2490000,
    credits: 3500,
    period: "month",
  },
};
export const PACK_PRICING_PREVIEW = {
  pack_small: { vnd: 25000, credits: 250 },
  pack_medium: { vnd: 59000, credits: 700 },
  pack_large: { vnd: 119000, credits: 1600 },
} as const;
export const PRICING_PREVIEW_CHECKOUT = false as const;
const en = {
  badge: "Proposed pricing · no payments",
  notice:
    "These prices and allocations are proposals for reviewing the competition demo. Plans and packs are not on sale; no payment, automatic credit grant or renewal occurs. Your actual wallet balance above is separate.",
  monthly: "proposed / month",
  yearly: "proposed / year",
  annual:
    "Annual proposal: price of 10 months; monthly credit allocation, not an annual upfront credit grant.",
  creditsMonthly: "credits/month proposed",
  creditsOnce: "trial credits, once",
  pack: "proposed credit pack",
  tax: "VND display prices only. Payment method, taxes, expiry, refunds and provider costs must be validated before a real launch.",
};
export const pricingPreviewCopy: Record<Locale, typeof en> = {
  en,
  vi: {
    badge: "Giá đề xuất · chưa thu tiền",
    notice:
      "Giá và hạn mức dưới đây là đề xuất để xem bản dự thi. Chưa mở bán gói hoặc credit; không thu tiền, tự nạp credit hay gia hạn. Số dư ví thật ở trên là dữ liệu riêng.",
    monthly: "đề xuất / tháng",
    yearly: "đề xuất / năm",
    annual:
      "Đề xuất theo năm: giá bằng 10 tháng; hạn mức credit tính theo tháng, không nạp cả năm một lần.",
    creditsMonthly: "credit/tháng dự kiến",
    creditsOnce: "credit dùng thử một lần",
    pack: "gói credit đề xuất",
    tax: "Giá hiển thị bằng VNĐ để duyệt giao diện. Cần kiểm chứng chi phí AI, phương thức thanh toán, thuế, hạn dùng và hoàn tiền trước khi mở bán thật.",
  },
  "zh-CN": {
    badge: "建议价格 · 未收款",
    notice:
      "价格和额度仅用于审核比赛演示。未销售套餐或积分，不付款、不自动充值或续费。上方实际余额单独计算。",
    monthly: "建议/月",
    yearly: "建议/年",
    annual: "年费建议等于10个月；积分按月分配，并非一次充值全年积分。",
    creditsMonthly: "积分/月（建议）",
    creditsOnce: "一次性试用积分",
    pack: "建议积分包",
    tax: "仅展示越南盾价格。正式销售前须验证 AI 成本、支付、税费、有效期和退款。",
  },
  ja: {
    badge: "提案価格・決済なし",
    notice:
      "価格と枠は大会デモ確認用の提案です。販売、決済、自動付与、更新は行いません。実際の残高は別です。",
    monthly: "提案/月",
    yearly: "提案/年",
    annual:
      "年額は10か月分の提案。クレジットは月単位で、年間分を一括付与しません。",
    creditsMonthly: "クレジット/月（提案）",
    creditsOnce: "初回のみの試用クレジット",
    pack: "提案クレジットパック",
    tax: "ベトナムドンの表示提案です。実販売前にAI費用、決済、税、有効期限、返金を確認します。",
  },
  ko: {
    badge: "제안 가격 · 결제 없음",
    notice:
      "가격과 한도는 대회 데모 검토용 제안입니다. 판매, 결제, 자동 충전 또는 갱신은 하지 않습니다. 실제 지갑 잔액은 별도입니다.",
    monthly: "제안/월",
    yearly: "제안/년",
    annual:
      "연간 제안은 10개월 가격이며 크레딧은 매월 기준입니다. 연간 전액을 한 번에 지급하지 않습니다.",
    creditsMonthly: "크레딧/월 제안",
    creditsOnce: "일회성 체험 크레딧",
    pack: "제안 크레딧 팩",
    tax: "베트남 동 표시 가격만 제안합니다. 실제 판매 전 AI 비용, 결제, 세금, 만료 및 환불을 검증해야 합니다.",
  },
};
