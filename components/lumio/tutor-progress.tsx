"use client";
import {
  Check,
  LockKeyhole,
  UnlockKeyhole,
  RotateCcw,
  ShieldCheck,
  CircleHelp,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { TutorState, MathVerification } from "../../lib/tutor/types";
export const tutorUICopy = {
  vi: {
    title: "Tự tìm ra cách giải",
    hint: "lượt gợi ý đã ghi nhận",
    rule: "Lumio hướng tới một gợi ý và một câu hỏi mỗi lượt. Máy chủ mở lời giải sau ít nhất 3 lượt gợi ý được chấp nhận; đổi kiểu học không bỏ qua khóa. Số lượt chỉ ghi nhận cấu trúc, không xác nhận gợi ý luôn đúng hoặc bạn đã hiểu bài.",
    locked: "Lời giải đang khóa",
    unlocked: "Đã đủ điều kiện xem lời giải",
    open: "Xem lời giải đầy đủ",
    fresh: "Bài mới",
    restoring: "Đang khôi phục phiên học…",
    history: "Cuộc trao đổi của bạn",
    you: "Bạn",
    tutor: "Lumio",
    verified: "Đã kiểm tra các nghiệm được nêu",
    unknown: "Chưa kiểm chứng độc lập bài này",
    invalid: "Có kết quả không khớp điều kiện",
    check:
      "Bộ kiểm tra chỉ đối chiếu biểu thức và nghiệm trong phạm vi hỗ trợ, không chứng minh mọi bước lập luận.",
    expired:
      "Phiên trước không còn trên máy chủ. Hãy bắt đầu lại; học liệu của bạn vẫn còn trên thiết bị.",
    extract:
      "Mở Nguồn học liệu và trích xuất văn bản trước khi gửi tài liệu này.",
    reset:
      "Bắt đầu bài khác sẽ tạo phiên mới; phiên trước vẫn tuân theo thời hạn lưu 7 ngày.",
  },
  en: {
    title: "Find your way to the solution",
    hint: "recorded hint turns",
    rule: "Lumio aims for one hint and one question per turn. The server unlocks the full solution after at least 3 accepted hint turns; changing modes cannot bypass the lock. This structural count does not certify hint correctness or learner understanding.",
    locked: "Solution locked",
    unlocked: "Solution available",
    open: "View full solution",
    fresh: "New problem",
    restoring: "Restoring your session…",
    history: "Your conversation",
    you: "You",
    tutor: "Lumio",
    verified: "Stated roots checked",
    unknown: "Not independently verified",
    invalid: "A result violates the conditions",
    check:
      "The checker tests supported expressions and roots; it does not prove every reasoning step.",
    expired:
      "The previous session is no longer on the server. Start again; your learning material remains on this device.",
    extract:
      "Open the source tab and extract the document text before sending it.",
    reset:
      "A different problem creates a new session. Previous sessions follow the 7-day retention policy.",
  },
  ja: {
    title: "自分で解き方を見つける",
    hint: "記録済みのヒント回数",
    rule: "各回にヒント1つと質問1つを目指します。サーバーは受け付けたヒントが3回以上になると解答を解除し、モード変更では回避できません。この回数は形式上の記録で、ヒントの正しさや学習者の理解を保証しません。",
    locked: "解答はロック中",
    unlocked: "解答を表示できます",
    open: "完全な解答を見る",
    fresh: "新しい問題",
    restoring: "セッションを復元中…",
    history: "学習の対話",
    you: "あなた",
    tutor: "Lumio",
    verified: "提示された解を確認済み",
    unknown: "独立した検証は未実施",
    invalid: "条件に合わない結果があります",
    check:
      "検証器は対応する式と解のみを照合し、すべての論証を証明するものではありません。",
    expired:
      "以前のセッションはサーバーにありません。教材はこの端末に残っています。",
    extract: "元資料タブで文書のテキストを抽出してください。",
    reset:
      "新しい問題は新しいセッションを作ります。以前の対話は7日間の保存方針に従います。",
  },
  ko: {
    title: "스스로 풀이 찾기",
    hint: "기록된 힌트 횟수",
    rule: "한 차례에 힌트 하나와 질문 하나를 목표로 해요. 서버가 받아들인 힌트가 3회 이상이면 전체 풀이가 열리며 모드 변경으로 우회할 수 없어요. 형식상 기록된 횟수이며 힌트의 정확성이나 학습자의 이해를 보장하지 않아요.",
    locked: "풀이 잠김",
    unlocked: "풀이 확인 가능",
    open: "전체 풀이 보기",
    fresh: "새 문제",
    restoring: "세션을 복원하고 있어요…",
    history: "학습 대화",
    you: "나",
    tutor: "Lumio",
    verified: "제시된 해를 검증했어요",
    unknown: "독립 검증되지 않았어요",
    invalid: "조건에 맞지 않는 결과가 있어요",
    check: "지원하는 식과 해만 대조하며 모든 논증 단계를 증명하지는 않아요.",
    expired: "이전 세션이 서버에 없어요. 자료는 이 기기에 남아 있어요.",
    extract: "원본 탭에서 문서 텍스트를 먼저 추출하세요.",
    reset: "새 문제는 새 세션을 만들어요. 이전 세션은 7일 보관 정책을 따라요.",
  },
  "zh-CN": {
    title: "自己找到解题方法",
    hint: "已记录的提示轮次",
    rule: "Lumio力求每轮一个提示、一个问题。服务器接受至少3轮提示后才解锁完整解答，切换模式无法绕过。这个次数仅记录格式上接受的轮次，不证明提示正确或学习者已经理解。",
    locked: "解答已锁定",
    unlocked: "可以查看解答",
    open: "查看完整解答",
    fresh: "新题目",
    restoring: "正在恢复会话…",
    history: "学习对话",
    you: "你",
    tutor: "Lumio",
    verified: "已核对所列解",
    unknown: "尚未独立验证",
    invalid: "有结果不符合条件",
    check: "检查器仅核对支持的表达式及解，不证明全部推理步骤。",
    expired: "服务器已无此前会话。学习资料仍保存在本设备，可重新开始。",
    extract: "请先在原始资料页提取文档文字。",
    reset: "新题目会创建新会话。以前的会话遵循7天保存政策。",
  },
};
export function TutorProgress({
  state,
  locale,
  disabled,
  restoring,
  onNew,
  onUnlock,
}: {
  state?: TutorState | null;
  locale: Locale;
  disabled?: boolean;
  restoring?: boolean;
  onNew: () => void;
  onUnlock: () => void;
}) {
  const c = tutorUICopy[locale],
    count = state?.hintCount || 0,
    ready = !!state?.canUnlock;
  const clarification = {
    vi: "Bài này còn thiếu dữ kiện. Câu hỏi bổ sung không tính là một gợi ý để mở lời giải.",
    en: "This problem needs more information. Clarifying questions do not count toward unlocking the solution.",
    ja: "問題に必要な情報が不足しています。確認の質問は解答解除のヒント回数に含まれません。",
    ko: "문제에 필요한 정보가 부족해요. 확인 질문은 풀이를 여는 힌트 횟수에 포함되지 않아요.",
    "zh-CN": "题目仍缺少信息。补充信息的提问不计入解锁提示次数。",
  }[locale];
  return (
    <section
      className="lm-tutor-progress"
      data-tutor-progress
      data-hints={count}
      data-unlocked={ready}
      aria-label={c.title}
    >
      <div className="lm-tutor-progress-heading">
        <div>
          <span className="lm-tutor-eyebrow">LUMIO · LEARNING FIRST</span>
          <h4>{c.title}</h4>
        </div>
        <span className={ready ? "lm-tutor-lock ready" : "lm-tutor-lock"}>
          {ready ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />}{" "}
          {ready ? c.unlocked : c.locked}
        </span>
      </div>
      <div
        className="lm-tutor-milestones"
        aria-label={`${Math.min(count, 3)}/3 ${c.hint}`}
      >
        {[1, 2, 3].map((n) => (
          <span key={n} className={count >= n ? "done" : ""}>
            {count >= n ? <Check size={15} /> : n}
          </span>
        ))}
        <strong>
          {count}/3 {c.hint}
        </strong>
      </div>
      <p>{restoring ? c.restoring : c.rule}</p>
      {state?.needsClarification && <p role="status">{clarification}</p>}
      <div className="lm-row">
        <button
          className="lm-button"
          disabled={disabled || restoring}
          onClick={onNew}
          title={c.reset}
        >
          <RotateCcw size={15} />
          {c.fresh}
        </button>
        <button
          className="lm-button primary"
          data-tutor-unlock
          disabled={!ready || disabled || restoring}
          onClick={onUnlock}
        >
          <UnlockKeyhole size={15} />
          {c.open}
        </button>
      </div>
    </section>
  );
}
export function MathVerificationNotice({
  verification,
  locale,
}: {
  verification?: MathVerification;
  locale: Locale;
}) {
  if (!verification) return null;
  const c = tutorUICopy[locale],
    scope = verification.scope,
    good = verification.status === "verified" && scope?.candidates === "exact",
    bad = verification.status === "inconsistent";
  const labels = {
    vi: {
      title: "Phạm vi kiểm tra độc lập",
      candidates: "Nghiệm được nêu",
      domain: "Điều kiện tại nghiệm",
      complete: "Đủ nghiệm",
      steps: "Bước ⇔ viết rõ",
      arithmetic: "Phép tính viết rõ",
      exact: "Chính xác",
      checked: "Đã kiểm tra",
      proved: "Đã chứng minh trong phạm vi hỗ trợ",
      incomplete: "Thiếu hoặc thừa nghiệm",
      approximate_only: "Chỉ khớp gần đúng — chưa xác minh chính xác",
      not_supported: "Chưa xác minh",
      not_requested: "Không đánh giá tập nghiệm đầy đủ ở lượt này",
      partial: "Chỉ kiểm tra một phần",
      not_checked: "Chưa kiểm tra",
      inconsistent: "Không khớp",
      legacy:
        "Kết quả lưu từ bộ kiểm tra trước; chưa có chứng cứ xác minh chính xác V3.",
      details: "Các bước đã đối chiếu",
      equivalent: "Tương đương trong miền của đề gốc",
      not_equivalent: "Không tương đương trong miền của đề gốc",
      invalid: "Phép tính sai",
    },
    en: {
      title: "Independent check scope",
      candidates: "Stated candidates",
      domain: "Domain at candidates",
      complete: "Complete root set",
      steps: "Explicit ⇔ steps",
      arithmetic: "Explicit arithmetic",
      exact: "Exact",
      checked: "Checked",
      proved: "Proved within supported scope",
      incomplete: "Missing or extra roots",
      approximate_only: "Approximate match only — not an exact proof",
      not_supported: "Unverified",
      not_requested: "Complete root set not evaluated this turn",
      partial: "Partially checked",
      not_checked: "Not checked",
      inconsistent: "Mismatch",
      legacy:
        "Saved by an earlier checker; no V3 exact-verification evidence is available.",
      details: "Compared steps",
      equivalent: "Equivalent within the original domain",
      not_equivalent: "Not equivalent within the original domain",
      invalid: "Arithmetic mismatch",
    },
  }[locale === "vi" ? "vi" : "en"];
  return (
    <aside
      className={`lm-math-verification ${good ? "verified" : bad ? "inconsistent" : ""}`}
      data-math-verification={verification.status}
    >
      {good ? <ShieldCheck size={18} /> : <CircleHelp size={18} />}
      <div>
        <strong>{good ? c.verified : bad ? c.invalid : c.unknown}</strong>
        <p>{c.check}</p>
        {verification.equation && <code>{verification.equation}</code>}
        {verification.conditions?.length ? (
          <p>{verification.conditions.join("; ")}</p>
        ) : null}
        {scope ? (
          <div aria-label={labels.title} data-math-scope>
            <ul>
              {(
                [
                  [labels.candidates, scope.candidates],
                  [labels.domain, scope.domain],
                  [labels.complete, scope.completeness],
                  [labels.steps, scope.steps],
                  [labels.arithmetic, scope.arithmetic],
                ] as const
              ).map(([label, status]) => (
                <li key={label}>
                  <strong>{label}:</strong> {labels[status]}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>{labels.legacy}</p>
        )}
        {!!verification.explicitSteps?.length && (
          <details>
            <summary>
              {labels.details} ({verification.explicitSteps.length})
            </summary>
            <ul>
              {verification.explicitSteps.map((step, i) => (
                <li key={i}>
                  <code>
                    {step.from} ⇔ {step.to}
                  </code>
                  <p>{labels[step.status]}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </aside>
  );
}
