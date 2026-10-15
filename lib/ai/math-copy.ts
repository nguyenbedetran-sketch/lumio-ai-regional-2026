import type { Locale } from "../lumio/i18n";
import type { MathStyle } from "./math-style";
export const mathCopy: Record<
  Locale,
  {
    label: string;
    styles: Record<MathStyle, string>;
    hint: string;
    image: string;
  }
> = {
  vi: {
    label: "Cách trình bày lời giải",
    styles: {
      standard: "Từng bước cơ bản",
      notebook: "Vở học · theo tài liệu tham khảo",
      exam: "Bài thi · ngắn gọn, đủ ý",
    },
    hint: "Điều kiện → nhận xét → biến đổi có lý do → kiểm tra → kết luận. Chế độ gợi ý vẫn chỉ mở từng bước.",
    image:
      "Với ảnh/PDF: ghi rõ số bài cần giải. Ký hiệu mờ hoặc thiếu dữ kiện sẽ được hỏi lại.",
  },
  en: {
    label: "Solution style",
    styles: {
      standard: "Standard step by step",
      notebook: "Class notebook · reference inspired",
      exam: "Exam answer · concise and complete",
    },
    hint: "Conditions → key idea → justified steps → check → conclusion. Hint mode still reveals one step at a time.",
    image:
      "For images/PDFs, specify the exercise number. Unclear symbols or missing facts require clarification.",
  },
  "zh-CN": {
    label: "解答风格",
    styles: {
      standard: "基础分步讲解",
      notebook: "课堂笔记 · 参考资料风格",
      exam: "考试答卷 · 简洁完整",
    },
    hint: "条件 → 关键思路 → 有依据的步骤 → 检验 → 结论。提示模式仍然只逐步提示。",
    image: "图片或PDF请注明题号。模糊符号或缺少条件时，会先请你确认。",
  },
  ja: {
    label: "解答の書き方",
    styles: {
      standard: "基本のステップ解説",
      notebook: "授業ノート · 参考資料の形式",
      exam: "答案 · 簡潔で十分な説明",
    },
    hint: "条件 → 着眼点 → 根拠のある変形 → 確認 → 結論。ヒントモードでは一段階ずつ示します。",
    image:
      "画像・PDFでは問題番号を指定してください。不鮮明な記号や不足する条件は確認します。",
  },
  ko: {
    label: "풀이 형식",
    styles: {
      standard: "기본 단계별 풀이",
      notebook: "수업 노트 · 참고 자료 형식",
      exam: "시험 답안 · 간결하고 완전하게",
    },
    hint: "조건 → 핵심 아이디어 → 근거 있는 풀이 → 확인 → 결론. 힌트 모드는 한 단계씩만 안내합니다.",
    image:
      "이미지/PDF는 문제 번호를 적어 주세요. 흐린 기호나 누락된 조건은 먼저 확인합니다.",
  },
};
