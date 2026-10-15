import type { Locale } from "./i18n";
export const publicDemoCopy: Record<
  Locale,
  { title: string; description: string }
> = {
  vi: {
    title: "Bản demo công khai · Lưu trên trình duyệt",
    description:
      "Bạn đang thử giao diện và công cụ học cục bộ. Học liệu lưu trong trình duyệt này; đăng nhập và xử lý AI trực tuyến đang tắt.",
  },
  en: {
    title: "Public demo · Browser storage",
    description:
      "Explore the interface and local study tools. Materials stay in this browser; sign-in and online AI processing are disabled.",
  },
  "zh-CN": {
    title: "公开演示 · 浏览器本地存储",
    description:
      "你正在体验界面和本地学习工具。学习资料保存在此浏览器中；登录和在线 AI 处理已关闭。",
  },
  ja: {
    title: "公開デモ · ブラウザーに保存",
    description:
      "画面とローカル学習ツールをお試しいただけます。教材はこのブラウザー内に保存されます。ログインとオンライン AI 処理は無効です。",
  },
  ko: {
    title: "공개 데모 · 브라우저에 저장",
    description:
      "화면과 로컬 학습 도구를 체험할 수 있습니다. 학습 자료는 이 브라우저에 저장되며 로그인과 온라인 AI 처리는 꺼져 있습니다.",
  },
};
