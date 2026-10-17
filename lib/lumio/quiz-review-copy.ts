import type { Locale } from "./i18n";

type Copy = {
  notice: string;
  ai: string;
  history: string;
  matched: string;
  different: string;
  key: string;
  rate: string;
  complete: string;
};
export const quizReviewCopy: Record<Locale, Copy> = {
  en: {
    notice:
      "Practice result compared with the saved answer key, not teacher-confirmed. Check the question, alternatives and explanation against the source. AI and older questions without recorded provenance do not add new skill evidence.",
    ai: "AI-generated answer key · unreviewed. More than one option may be valid; review the source before relying on this practice result.",
    history:
      "Local practice history uses saved answer keys that are not teacher-confirmed. Older evidence is retained and may include unreviewed AI keys; these suggestions do not establish assessed mastery.",
    matched: "Matches the saved key",
    different: "Differs from the saved key",
    key: "Saved key",
    rate: "Saved-key match rate",
    complete:
      "All responses match the saved key. Review the source to check its correctness.",
  },
  vi: {
    notice:
      "Kết quả luyện tập đối chiếu với đáp án đã lưu, chưa được giáo viên xác nhận. Hãy kiểm tra câu hỏi, các lựa chọn và giải thích với tài liệu gốc. Câu hỏi AI và câu hỏi cũ chưa rõ nguồn đáp án không tạo thêm bằng chứng kỹ năng.",
    ai: "Đáp án do AI tạo · chưa được duyệt. Có thể có nhiều lựa chọn hợp lệ; hãy đối chiếu tài liệu gốc trước khi dùng kết quả luyện tập này.",
    history:
      "Lịch sử luyện tập cục bộ dựa trên đáp án đã lưu, chưa được giáo viên xác nhận. Bằng chứng cũ vẫn được giữ và có thể chứa đáp án AI chưa duyệt; gợi ý này không xác nhận mức độ thành thạo đã được đánh giá.",
    matched: "Khớp đáp án đã lưu",
    different: "Khác đáp án đã lưu",
    key: "Đáp án đã lưu",
    rate: "Tỷ lệ khớp đáp án đã lưu",
    complete:
      "Tất cả câu trả lời khớp đáp án đã lưu. Hãy kiểm tra tính đúng đắn với tài liệu gốc.",
  },
  "zh-CN": {
    notice:
      "练习结果仅与保存的答案键对照，未经教师确认。请根据原始资料检查题目、选项和解释。AI题目及未记录答案来源的旧题目不会新增技能证据。",
    ai: "AI生成的答案键 · 尚未审核。可能有多个有效选项；请先核对原始资料。",
    history:
      "本地练习历史使用未经教师确认的答案键。旧证据会保留，可能含未审核的AI答案；这些建议不能证明经过评估的知识掌握程度。",
    matched: "与保存的答案键一致",
    different: "与保存的答案键不同",
    key: "保存的答案键",
    rate: "答案键匹配率",
    complete: "所有回答均与保存的答案键一致。请核对原始资料以检查其正确性。",
  },
  ja: {
    notice:
      "練習結果は保存された解答キーとの照合であり、教師による確認はありません。問題・選択肢・解説を原資料で確認してください。AIの問題と出所不明の旧問題は新しいスキル証拠を作成しません。",
    ai: "AI生成の解答キー · 未確認。複数の選択肢が正しい場合があります。原資料と照合してください。",
    history:
      "端末の練習履歴は教師未確認の解答キーに基づきます。古い証拠は保持され、未確認のAI解答を含む場合があります。この提案は評価済みの習熟度を示しません。",
    matched: "保存された解答キーと一致",
    different: "保存された解答キーと異なる",
    key: "保存された解答キー",
    rate: "解答キーとの一致率",
    complete:
      "すべての回答が保存された解答キーと一致しました。正しさを原資料で確認してください。",
  },
  ko: {
    notice:
      "연습 결과는 저장된 정답표와 비교한 것이며 교사가 확인한 평가가 아닙니다. 문제, 선택지, 해설을 원문과 대조하세요. AI 문제와 출처가 기록되지 않은 이전 문제는 새 기술 근거를 만들지 않습니다.",
    ai: "AI가 생성한 정답표 · 검토되지 않음. 유효한 선택지가 여러 개일 수 있으니 원문을 확인하세요.",
    history:
      "기기의 연습 기록은 교사가 확인하지 않은 정답표를 사용합니다. 이전 근거는 보존되며 검토되지 않은 AI 정답이 포함될 수 있습니다. 이 추천은 평가된 숙련도를 입증하지 않습니다.",
    matched: "저장된 정답표와 일치",
    different: "저장된 정답표와 다름",
    key: "저장된 정답표",
    rate: "정답표 일치율",
    complete:
      "모든 답변이 저장된 정답표와 일치합니다. 정확성은 원문과 대조하세요.",
  },
};
