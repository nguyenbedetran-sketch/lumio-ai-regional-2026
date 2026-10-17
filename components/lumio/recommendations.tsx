"use client";
import { MathText } from "./math-text";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BrainCircuit,
  Compass,
  ThumbsDown,
  ThumbsUp,
  Sparkles,
  Check,
} from "lucide-react";
import type { LearningItem } from "../../lib/lumio/types";
import type { LearningState } from "../../lib/lumio/learning-engine";
import type { Locale } from "../../lib/lumio/i18n";
import {
  recommend,
  canEvaluateRecommendation,
  type Preferences,
} from "../../lib/lumio/recommendations";
import { recommendationCopy } from "../../lib/lumio/recommendation-copy";
import { SkillEvidencePanel } from "./skill-evidence";
import { DailyLearningPlan } from "./learning-plan";
import { StudyPreferenceForm } from "./study-preferences";
export const personalCopy = {
  vi: {
    nav: "Đề xuất cho bạn",
    title: "Bước tiếp theo, hợp với bạn.",
    intro:
      "Dùng nội dung bạn đọc, kết quả luyện tập và phản hồi để điều chỉnh gợi ý tiếp theo.",
    enabled: "Cá nhân hóa theo lịch sử học",
    privacy:
      "Xử lý ngay trên thiết bị. Không gửi lịch sử hoặc phản hồi tới dịch vụ AI.",
    empty: "Thêm vài tài liệu vào thư viện để bắt đầu khám phá.",
    open: "Học tiếp",
    like: "Hợp với tôi",
    skip: "Ít đề xuất hơn",
    ratings: "phản hồi trên học liệu",
    how: "Lumio chọn gợi ý như thế nào?",
    content: "Đối chiếu nội dung với lịch sử đọc",
    baseline: "Ưu tiên ôn tập và khám phá thư viện",
    logistic: "Mô hình học từ phản hồi của bạn",
    neural: "Mạng nơ-ron cá nhân hóa · thử nghiệm",
    detail:
      "Khi còn ít dữ liệu, Lumio dùng nội dung tương tự và lịch ôn. Từ 12 phản hồi có ít nhất 4 đánh giá mỗi loại, mô hình logistic được huấn luyện tại máy. Từ 40 phản hồi có ít nhất 10 mỗi loại, mạng hai lớp ẩn được dùng thử. Đây không phải điểm năng lực hay dự đoán chắc chắn.",
    disabled:
      "Cá nhân hóa đã tắt. Gợi ý theo lịch ôn, quiz, mục yêu thích và khám phá thư viện; không dùng lịch sử đọc hoặc phản hồi.",
    storage: "Không thể lưu tùy chọn. Kiểm tra quyền lưu trữ trình duyệt.",
    reason: {
      review: "Thẻ đã đến lịch ôn",
      practice: "Quiz gần đây cần luyện thêm",
      interest: "Gần với nội dung bạn đang học",
      favorite: "Bạn đã đánh dấu yêu thích",
      explore: "Một góc nhìn mới trong thư viện",
    },
  },
  en: {
    nav: "For you",
    title: "Your next step, made personal.",
    intro:
      "Uses what you read, practise and rate to adjust the next suggestions.",
    enabled: "Personalize with learning history",
    privacy:
      "Runs on this device. History and ratings are not sent to an AI service.",
    empty: "Add a few materials to your library to start exploring.",
    open: "Continue learning",
    like: "Useful for me",
    skip: "Suggest less",
    ratings: "material ratings",
    how: "How are suggestions selected?",
    content: "Content and reading history",
    baseline: "Review and library discovery",
    logistic: "Learning from your feedback",
    neural: "Personal neural ranker · experimental",
    detail:
      "With little data, Lumio uses similar content and review dates. At 12 ratings with at least 4 in each class, a logistic ranker trains locally. At 40 ratings with at least 10 in each class, a network with two hidden layers is used experimentally. These are not ability scores or certain predictions.",
    disabled:
      "Personalization is off. Suggestions use reviews, quizzes, favorites and library discovery, without reading history or ratings.",
    storage: "Preferences could not be saved. Check browser storage access.",
    reason: {
      review: "Cards are due for review",
      practice: "Recent quizzes need more practice",
      interest: "Related to what you are learning",
      favorite: "Saved as a favorite",
      explore: "Discover something in your library",
    },
  },
  "zh-CN": {
    nav: "为你推荐",
    title: "适合你的下一步。",
    intro: "根据阅读、练习和反馈调整推荐。",
    enabled: "使用学习记录进行个性化",
    privacy: "在本机处理，不向 AI 服务发送历史或反馈。",
    empty: "先向资料库添加一些材料。",
    open: "继续学习",
    like: "适合我",
    skip: "减少推荐",
    ratings: "条资料反馈",
    how: "如何选择推荐？",
    content: "内容与阅读记录",
    baseline: "复习与资料探索",
    logistic: "从你的反馈中学习",
    neural: "个性化神经网络 · 实验性",
    detail:
      "数据较少时使用内容相似度和复习日期。至少12条反馈且每类至少4条时训练本地逻辑回归；至少40条且每类至少10条时试用两层隐藏层网络。不是能力评分，也不保证预测准确。",
    disabled:
      "已关闭个性化。推荐使用复习、测验、收藏和资料探索，不使用阅读记录或反馈。",
    storage: "无法保存偏好，请检查浏览器存储。",
    reason: {
      review: "卡片到期需要复习",
      practice: "近期测验需要练习",
      interest: "与你正在学习的内容相关",
      favorite: "已收藏",
      explore: "探索资料库",
    },
  },
  ja: {
    nav: "あなたへの提案",
    title: "あなたに合う、次の一歩。",
    intro: "読書、練習、評価から次の提案を調整します。",
    enabled: "学習履歴で個別化",
    privacy: "端末内で処理し、履歴や評価をAIサービスに送りません。",
    empty: "ライブラリに教材を追加してください。",
    open: "学習を続ける",
    like: "役に立つ",
    skip: "提案を減らす",
    ratings: "件の教材評価",
    how: "提案の選び方",
    content: "内容と読書履歴",
    baseline: "復習と教材の発見",
    logistic: "評価から学習中",
    neural: "個別ニューラルモデル・試験版",
    detail:
      "少ないデータでは内容の類似性と復習日を使います。各評価4件以上、計12件からロジスティックモデルを端末で学習。各10件以上、計40件から隠れ層2つのネットワークを試用します。能力の評価や確実な予測ではありません。",
    disabled:
      "個別化はオフです。復習、クイズ、お気に入り、教材の発見を使い、読書履歴や評価は使いません。",
    storage: "設定を保存できません。保存権限を確認してください。",
    reason: {
      review: "カードの復習日です",
      practice: "最近のクイズを練習",
      interest: "学習中の内容に関連",
      favorite: "お気に入りの教材",
      explore: "ライブラリを探索",
    },
  },
  ko: {
    nav: "맞춤 추천",
    title: "나에게 맞는 다음 한 걸음.",
    intro: "읽기, 연습, 평가에 따라 다음 추천을 조정합니다.",
    enabled: "학습 기록으로 맞춤 설정",
    privacy: "기기에서 처리하며 기록이나 평가를 AI 서비스에 보내지 않습니다.",
    empty: "자료실에 학습 자료를 추가해 주세요.",
    open: "계속 학습",
    like: "도움이 돼요",
    skip: "추천 줄이기",
    ratings: "개의 자료 평가",
    how: "추천은 어떻게 고르나요?",
    content: "내용과 읽기 기록",
    baseline: "복습과 자료 탐색",
    logistic: "내 평가에서 학습",
    neural: "맞춤 신경망 · 실험 기능",
    detail:
      "데이터가 적으면 내용 유사도와 복습 날짜를 사용합니다. 각 유형4개 이상, 총12개 평가부터 로지스틱 모델을 로컬에서 학습합니다. 각10개 이상, 총40개부터 은닉층2개의 신경망을 시험합니다. 능력 평가나 확정적 예측이 아닙니다.",
    disabled:
      "맞춤 추천이 꺼져 있습니다. 복습, 퀴즈, 즐겨찾기와 자료 탐색을 사용하며 읽기 기록과 평가는 사용하지 않습니다.",
    storage: "설정을 저장하지 못했습니다. 브라우저 저장 권한을 확인하세요.",
    reason: {
      review: "복습할 카드가 있어요",
      practice: "최근 퀴즈를 더 연습해요",
      interest: "학습 중인 내용과 관련 있어요",
      favorite: "즐겨찾는 자료",
      explore: "자료실에서 새롭게 발견",
    },
  },
};
export function Recommendations({
  items,
  learning,
  preferences,
  update,
  locale,
  open,
  storageError,
  onClearSkillEvidence,
  onReview,
}: {
  items: LearningItem[];
  learning: LearningState;
  preferences: Preferences;
  update: (fn: (p: Preferences) => Preferences) => void;
  locale: Locale;
  open: (i: LearningItem) => void;
  storageError: boolean;
  onClearSkillEvidence?: () => void;
  onReview?: () => void;
}) {
  const c = personalCopy[locale];
  const rc = recommendationCopy[locale];
  const [notice, setNotice] = useState("");
  const result = useMemo(
    () => recommend(items, learning, preferences),
    [items, learning, preferences],
  );
  function rate(itemId: string, value: 0 | 1) {
    update((p) => ({
      ...p,
      feedback: [
        ...p.feedback.filter((f) => f.itemId !== itemId),
        { itemId, value, at: new Date().toISOString() },
      ].slice(-1000),
    }));
  }
  function outcome(itemId: string, useful: boolean) {
    update((p) => ({
      ...p,
      outcomes: [
        ...(p.outcomes || []).filter((o) => o.itemId !== itemId),
        { itemId, useful, at: new Date().toISOString() },
      ].slice(-1000),
    }));
  }
  return (
    <section className="lm-personal">
      <div className="lm-personal-hero">
        <div>
          <span className="lm-overline">LUMIO / {c.nav}</span>
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
        </div>
        <span className="lm-personal-orbit">
          <BrainCircuit size={44} />
        </span>
      </div>
      <div className="lm-personal-controls">
        <label>
          <input
            type="checkbox"
            checked={preferences.enabled}
            disabled={storageError}
            onChange={(e) =>
              update((p) => ({ ...p, enabled: e.target.checked }))
            }
          />
          {c.enabled}
        </label>
        <span>
          {result.ratings} {c.ratings}
        </span>
      </div>
      <p className="lm-muted">{preferences.enabled ? c.privacy : c.disabled}</p>
      <p className="lm-help">{rc.distinction}</p>
      <DailyLearningPlan
        items={items}
        learning={learning}
        preferences={preferences}
        locale={locale}
        open={open}
        onReview={onReview}
        onPreferences={update}
        storageError={storageError}
      />
      {storageError && (
        <p className="lm-error" role="alert">
          {c.storage}
        </p>
      )}
      <StudyPreferenceForm
        locale={locale}
        preferences={preferences}
        update={update}
        storageError={storageError}
      />
      <div className="lm-personal-evaluation" data-recommendation-evaluations>
        <p>
          {result.outcomes.total
            ? `${result.outcomes.total} ${rc.evaluated} · ${result.outcomes.useful} ${rc.usefulCount}`
            : rc.noOutcome}
        </p>
        <button
          className="lm-button"
          disabled={
            storageError ||
            (!preferences.feedback.length && !preferences.outcomes?.length)
          }
          onClick={() => {
            if (!window.confirm(rc.clearConfirm)) return;
            update((p) => ({ ...p, feedback: [], outcomes: [] }));
            setNotice(rc.cleared);
          }}
        >
          {rc.clear}
        </button>
      </div>
      <p className="lm-help" role="status" aria-live="polite">
        {notice}
      </p>
      <SkillEvidencePanel
        items={items}
        preferences={preferences}
        update={update}
        locale={locale}
        open={open}
        storageError={storageError}
        onClearSkillEvidence={onClearSkillEvidence}
      />
      <details className="lm-personal-details">
        <summary>
          <Sparkles size={16} />
          {c.how}
          <b>
            {c[result.method as "baseline" | "content" | "logistic" | "neural"]}
          </b>
        </summary>
        <p>{c.detail}</p>
        <p>{rc.varied}</p>
      </details>
      {!result.items.length && (
        <div className="lm-personal-empty">
          <Compass size={40} />
          <p>{c.empty}</p>
        </div>
      )}
      <div className="lm-personal-grid">
        {result.items.slice(0, 12).map((r, index) => (
          <article
            className="lm-personal-card"
            key={r.item.id}
            style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}
          >
            <div className="lm-personal-number">
              {String(index + 1).padStart(2, "0")}
              <span>{r.item.kind.toUpperCase()}</span>
            </div>
            <p className="lm-personal-reason">
              {r.reason === "topic"
                ? rc.topicReason
                : r.reason === "goal"
                  ? rc.goalReason
                  : c.reason[r.reason]}
            </p>
            <h2>
              <MathText text={r.item.title} inline />
            </h2>
            <details className="lm-personal-evidence">
              <summary>{rc.evidence}</summary>
              {r.evidence.due > 0 && (
                <p>
                  {r.evidence.due} {rc.due}
                </p>
              )}
              {r.evidence.total > 0 && (
                <p>
                  {r.evidence.attempts} {rc.recent} · {r.evidence.correct}/
                  {r.evidence.total} {rc.correct}
                </p>
              )}
              {r.evidence.wrongTopics.map((t) => (
                <p key={t.topic}>
                  {t.topic}: {t.wrong} {rc.wrong} {rc.of} {t.total}
                </p>
              ))}
              {r.evidence.topics.length > 0 && (
                <p>
                  {rc.chosen}: {r.evidence.topics.join(", ")}
                </p>
              )}
              <p>
                {r.evidence.difficulty
                  ? `${rc.level}: ${rc[r.evidence.difficulty]}`
                  : rc.unknown}
              </p>
              {preferences.enabled && r.evidence.goal !== "balanced" && (
                <p>
                  {rc.goal}: {rc[r.evidence.goal]}
                </p>
              )}
            </details>
            {r.terms.length > 0 && (
              <div className="lm-personal-tags">
                {r.terms.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            )}
            <button className="lm-button primary" onClick={() => open(r.item)}>
              {c.open}
              <ArrowUpRight size={16} />
            </button>
            <div className="lm-personal-rating">
              <button
                disabled={!preferences.enabled || storageError}
                aria-pressed={r.feedback === 1}
                onClick={() => rate(r.item.id, 1)}
              >
                {r.feedback === 1 ? (
                  <Check size={15} />
                ) : (
                  <ThumbsUp size={15} />
                )}{" "}
                {c.like}
              </button>
              <button
                disabled={!preferences.enabled || storageError}
                aria-pressed={r.feedback === 0}
                onClick={() => rate(r.item.id, 0)}
              >
                <ThumbsDown size={15} /> {c.skip}
              </button>
            </div>
            <div className="lm-personal-outcome">
              <p>{rc.outcome}</p>
              <div>
                {([true, false] as const).map((useful) => (
                  <button
                    key={String(useful)}
                    className="lm-button"
                    aria-pressed={r.outcome === useful}
                    disabled={
                      !preferences.enabled ||
                      storageError ||
                      !canEvaluateRecommendation(r.item, learning)
                    }
                    onClick={() => outcome(r.item.id, useful)}
                  >
                    {useful ? rc.useful : rc.unclear}
                  </button>
                ))}
              </div>
              <small>
                {canEvaluateRecommendation(r.item, learning)
                  ? rc.outcomeHint
                  : rc.outcomeLocked}
              </small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
