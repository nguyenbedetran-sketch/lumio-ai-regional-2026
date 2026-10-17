import type { Locale } from "./i18n";
export const contentViewCopy: Record<
  Locale,
  {
    preview: string;
    edit: string;
    source: string;
    markdown: string;
    csv: string;
    svg: string;
  }
> = {
  en: {
    preview: "Reading preview",
    edit: "Edit source text / Markdown",
    source: "Original source text · shown literally for citation checking",
    markdown: "Markdown source (.md)",
    csv: "Flashcard data (.csv)",
    svg: "SVG download supports plain-text labels. Read formatted formulas in the interactive map and node details.",
  },
  vi: {
    preview: "Bản xem để đọc",
    edit: "Sửa văn bản gốc / Markdown",
    source: "Văn bản nguồn gốc · hiển thị nguyên văn để đối chiếu trích dẫn",
    markdown: "Mã nguồn Markdown (.md)",
    csv: "Dữ liệu thẻ ghi nhớ (.csv)",
    svg: "Tải SVG hỗ trợ nhãn văn bản thuần. Đọc công thức đã định dạng trong sơ đồ tương tác và chi tiết nút.",
  },
  "zh-CN": {
    preview: "阅读预览",
    edit: "编辑原始文本 / Markdown",
    source: "原始资料文字 · 按原文显示以核对引用",
    markdown: "Markdown源文件 (.md)",
    csv: "闪卡数据 (.csv)",
    svg: "SVG下载支持纯文本标签。请在交互导图和节点详情中阅读排版公式。",
  },
  ja: {
    preview: "閲覧プレビュー",
    edit: "原文 / Markdown を編集",
    source: "元の資料テキスト · 引用確認のため原文のまま表示",
    markdown: "Markdownソース (.md)",
    csv: "単語カードのデータ (.csv)",
    svg: "SVGのダウンロードはプレーンテキストのラベルに対応します。数式は対話型マップとノード詳細でお読みください。",
  },
  ko: {
    preview: "읽기 미리보기",
    edit: "원문 / Markdown 편집",
    source: "원본 자료 텍스트 · 인용 확인을 위해 원문 그대로 표시",
    markdown: "Markdown 원본 (.md)",
    csv: "플래시카드 데이터 (.csv)",
    svg: "SVG 다운로드는 일반 텍스트 라벨을 지원합니다. 수식은 대화형 지도와 노드 상세에서 확인하세요.",
  },
};
