import type { Locale } from "./i18n";
export const primaryNavigation = [
  "home",
  "library",
  "review",
  "planner",
  "progress",
] as const;
export const secondaryNavigation = [
  { id: "library", destinations: ["search", "history", "favorites"] },
  { id: "tools", destinations: ["focus", "voice", "personal"] },
  { id: "account", destinations: ["billing", "experience"] },
] as const;
const labels = {
  vi: {
    primary: "Học tập",
    library: "Tra cứu thư viện",
    tools: "Công cụ học",
    account: "Tài khoản",
    navigation: "Điều hướng",
    discard: "Bỏ thay đổi chưa lưu?",
    keep: "Tiếp tục chỉnh sửa",
    leave: "Bỏ bản nháp",
    indexedDelete:
      "Bản chỉ mục tìm kiếm trên máy chủ của tài liệu này cũng sẽ được xóa.",
    deleteError:
      "Chưa xóa được chỉ mục trên máy chủ. Tài liệu vẫn được giữ; kiểm tra đăng nhập và thử lại.",
  },
  en: {
    primary: "Study",
    library: "Browse library",
    tools: "Study tools",
    account: "Account",
    navigation: "Navigation",
    discard: "Discard unsaved changes?",
    keep: "Keep editing",
    leave: "Discard draft",
    indexedDelete: "This material's server search index will also be removed.",
    deleteError:
      "The server index could not be removed. Your material is kept; check your sign-in and retry.",
  },
  "zh-CN": {
    primary: "学习",
    library: "资料库工具",
    tools: "学习工具",
    account: "账户",
    navigation: "导航",
    discard: "放弃未保存的更改？",
    keep: "继续编辑",
    leave: "放弃草稿",
    indexedDelete: "也将删除此资料的服务器搜索索引。",
    deleteError: "无法删除服务器索引。资料已保留，请检查登录后重试。",
  },
  ja: {
    primary: "学習",
    library: "ライブラリを探す",
    tools: "学習ツール",
    account: "アカウント",
    navigation: "ナビゲーション",
    discard: "未保存の変更を破棄しますか？",
    keep: "編集を続ける",
    leave: "下書きを破棄",
    indexedDelete: "この資料のサーバー検索インデックスも削除します。",
    deleteError:
      "サーバーの索引を削除できませんでした。資料は保持されています。ログインを確認して再試行してください。",
  },
  ko: {
    primary: "학습",
    library: "라이브러리 탐색",
    tools: "학습 도구",
    account: "계정",
    navigation: "탐색",
    discard: "저장하지 않은 변경사항을 버릴까요?",
    keep: "계속 편집",
    leave: "초안 버리기",
    indexedDelete: "이 자료의 서버 검색 색인도 삭제합니다.",
    deleteError:
      "서버 색인을 삭제하지 못했어요. 자료는 유지됩니다. 로그인 상태를 확인하고 다시 시도하세요.",
  },
};
export function navigationCopy(locale: Locale) {
  return labels[locale];
}
