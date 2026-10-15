import type { Locale } from "./i18n";
const en = {
  focus: "Focus reading",
  exitFocus: "Exit focus",
  cornell: "Add Cornell template",
  exportNotes: "Export notes .md",
  exportCards: "Export cards .csv",
  template:
    "## Key questions\n- What do I want to understand?\n\n## Notes and evidence\n- Explain the key ideas in my own words.\n\n## Summary\n- What did I learn?\n\n## Review next\n- What still needs checking?",
  templateHint:
    "Adds an editable template below your notes. Your existing notes are kept.",
  emptyNotes: "Write notes before exporting.",
  notesFull: "Not enough room to add the template.",
  learn: "Collect",
  understand: "Understand",
  remember: "Remember",
  path: "Your learning journey",
  shortcut: "Search · Ctrl / ⌘ K",
};
export const enhancements: Record<Locale, typeof en> = {
  en,
  vi: {
    focus: "Đọc tập trung",
    exitFocus: "Thoát tập trung",
    cornell: "Thêm mẫu Cornell",
    exportNotes: "Xuất ghi chú .md",
    exportCards: "Xuất thẻ .csv",
    template:
      "## Câu hỏi trọng tâm\n- Mình muốn hiểu điều gì?\n\n## Ghi chú và dẫn chứng\n- Giải thích ý chính bằng lời của mình.\n\n## Tóm lược\n- Mình đã học được gì?\n\n## Cần ôn tiếp\n- Điều gì còn cần kiểm tra?",
    templateHint:
      "Thêm mẫu có thể chỉnh sửa dưới ghi chú. Nội dung cũ được giữ lại.",
    emptyNotes: "Viết ghi chú trước khi xuất.",
    notesFull: "Không còn đủ chỗ để thêm mẫu.",
    learn: "Thu thập",
    understand: "Hiểu sâu",
    remember: "Ghi nhớ",
    path: "Hành trình học của bạn",
    shortcut: "Tìm kiếm · Ctrl / ⌘ K",
  },
  "zh-CN": {
    focus: "专注阅读",
    exitFocus: "退出专注",
    cornell: "添加康奈尔模板",
    exportNotes: "导出笔记 .md",
    exportCards: "导出卡片 .csv",
    template:
      "## 关键问题\n- 我想理解什么？\n\n## 笔记和证据\n- 用自己的话说明主要观点。\n\n## 总结\n- 我学到了什么？\n\n## 下一步复习\n- 还有什么需要核实？",
    templateHint: "在现有笔记下添加可编辑模板，保留原文。",
    emptyNotes: "请先写笔记。",
    notesFull: "没有足够空间添加模板。",
    learn: "收集",
    understand: "理解",
    remember: "记忆",
    path: "你的学习旅程",
    shortcut: "搜索 · Ctrl / ⌘ K",
  },
  ja: {
    focus: "集中して読む",
    exitFocus: "集中モード終了",
    cornell: "コーネル式テンプレート",
    exportNotes: "ノート出力 .md",
    exportCards: "カード出力 .csv",
    template:
      "## 重要な問い\n- 何を理解したい？\n\n## ノートと根拠\n- 自分の言葉で説明する。\n\n## 要約\n- 何を学んだ？\n\n## 次の復習\n- 何を確認する？",
    templateHint:
      "現在のノートを残し、編集可能なテンプレートを末尾に追加します。",
    emptyNotes: "先にノートを書いてください。",
    notesFull: "テンプレート用の空きがありません。",
    learn: "集める",
    understand: "理解する",
    remember: "覚える",
    path: "学びの道筋",
    shortcut: "検索 · Ctrl / ⌘ K",
  },
  ko: {
    focus: "집중 읽기",
    exitFocus: "집중 모드 종료",
    cornell: "코넬 템플릿 추가",
    exportNotes: "노트 내보내기 .md",
    exportCards: "카드 내보내기 .csv",
    template:
      "## 핵심 질문\n- 무엇을 이해하고 싶은가?\n\n## 노트와 근거\n- 핵심을 내 말로 설명하기.\n\n## 요약\n- 무엇을 배웠는가?\n\n## 다음 복습\n- 무엇을 확인해야 하는가?",
    templateHint: "기존 노트를 유지하고 아래에 편집할 템플릿을 추가합니다.",
    emptyNotes: "먼저 노트를 작성하세요.",
    notesFull: "템플릿을 추가할 공간이 부족합니다.",
    learn: "모으기",
    understand: "이해하기",
    remember: "기억하기",
    path: "나의 학습 여정",
    shortcut: "검색 · Ctrl / ⌘ K",
  },
};

export function cardsCSV(cards: { front: string; back: string }[]) {
  const cell = (text: string) =>
    '"' +
    (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [["Front", "Back"], ...cards.map((c) => [c.front, c.back])]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
export function downloadText(
  title: string,
  extension: "md" | "csv",
  text: string,
) {
  const url = URL.createObjectURL(
    new Blob([text], {
      type:
        extension === "csv"
          ? "text/csv;charset=utf-8"
          : "text/markdown;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download =
    (title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 80) || "lumio") +
    "." +
    extension;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
