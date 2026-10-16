/** These are already validated questions, never unvalidated provider JSON. */
type QuizOptions = {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
};

// Bounded, conservative cues for the five supported languages. Bare mathematical
// labels such as A=8w are not option references. This is not semantic analysis.
const positionalCues = [
  /(?:\b(?:option|choice|answer)\s*(?:(?:is|number|no\.?)\s*)?[:：]?\s*["'(\[]?[a-d])(?![\p{L}\p{N}_]|\s*["')\]]*\s*[=<>≤≥≠])/iu,
  /(?:đáp án|phương án|lựa chọn|câu trả lời)(?:\s+(?:đúng|được chọn))?(?:\s+(?:là|số|thứ))?\s*[:：]?\s*["'(\[]?[a-d](?![\p{L}\p{N}_]|\s*["')\]]*\s*[=<>≤≥≠])/iu,
  /(?:\b(?:option|choice)\s*(?:(?:number|no\.?)\s*)?[1-4](?!\d|\.\d)|\b(?:first|second|third|fourth|last)\s+(?:option|choice|answer)\b)/iu,
  /(?:đáp án|phương án|lựa chọn)\s+(?:thứ\s*)?(?:nhất|hai|ba|tư|bốn|đầu tiên|cuối cùng|[1-4])(?![\p{L}\p{N}_])/iu,
  /(?<![\p{L}\p{N}_])[a-d]\s+(?:(?:is|là)\s+(?:the\s+)?(?:correct|right|đúng)|(?:là\s+)?đáp án đúng)/iu,
  /\b(?:which|what)\s+(?:option|choice)\s+is\s+(?:correct|right)\s*[,：:]?\s*[a-d]\s*(?:or|and)\s*[a-d](?![\p{L}\p{N}_])/iu,
  /(?:\bchoose|\bselect|chọn)\s+(?:(?:option|choice|đáp án|phương án)\s+)?[a-d](?![\p{L}\p{N}_]|\s*[=<>≤≥≠])/iu,
  /\b(?:all|none|both)\s+of\s+the\s+(?:above|below)\b/iu,
  /(?:tất cả|không có|cả hai)\s+(?:(?:các|những)\s+)?(?:(?:đáp án|phương án|lựa chọn)\s+)?(?:(?:ở|nào ở|nào)\s+)?(?:trên|dưới)/iu,
  /(?:\b(?:both|either|neither)|cả)\s+(?:(?:options?|choices?|đáp án|phương án)\s+)?[a-d]\s*(?:and|or|và|hoặc|,|&)\s*[a-d](?![\p{L}\p{N}_])/iu,
  /^\s*[(\[]?[a-d][.)\]、:]\s+\S/iu,
  /(?:选项|選項|选择|選擇|答案)(?:是|为|為)?\s*[:：]?\s*[a-d1-4](?![\p{L}\p{N}_]|\s*[=<>≤≥≠])/iu,
  /第\s*[一二三四1-4]\s*(?:个|個)?\s*(?:选项|選項|项|項)|(?:以上|以下)(?:都|皆|均)(?:正确|正確|不正确|不正確)/u,
  /以上(?:皆是|均是|全都|全部)|[a-d]\s*(?:和|与|與|及)\s*[a-d]\s*(?:都|均|皆)/iu,
  /(?:選択肢|答え|解答)(?:は|が)?\s*[:：]?\s*[a-d1-4](?![\p{L}\p{N}_]|\s*[=<>≤≥≠])/iu,
  /(?:[一二三四1-4]\s*番(?:目)?(?:の)?|最初の|最後の)\s*(?:選択肢|答え)|[a-d]\s*(?:が|は)正解/iu,
  /(?:上記|以上)の(?:すべて|いずれも)|[a-d]\s*(?:と|及び)\s*[a-d]\s*(?:の)?両方/iu,
  /(?:선택지|보기|정답|답)(?:은|는|이|가)?\s*[:：]?\s*[a-d1-4](?![\p{L}\p{N}_]|\s*[=<>≤≥≠])/iu,
  /(?:첫|두|세|네)\s*번째\s*(?:선택지|보기|답)|[1-4]\s*번(?:째)?\s*(?:선택지|보기|답)|[a-d]\s*(?:가|는|이)\s*정답/iu,
  /위(?:의)?\s*(?:모든|모두)|[a-d]\s*(?:와|과|및)\s*[a-d]\s*(?:모두|둘\s*다)/iu,
];

export function hasPositionalOptionDependency(question: QuizOptions) {
  // Normalize only the temporary cue text. Original mathematical content,
  // quotation marks and option strings are never rewritten in the result.
  const texts = [
    question.prompt,
    question.explanation,
    ...question.options,
  ].map((text) =>
    text
      .normalize("NFKC")
      .replace(/\p{Cf}/gu, "")
      .replace(/[“”„‟«»「」『』]/gu, '"')
      .replace(/[‘’‚‛‹›]/gu, "'")
        .replace(/["']/g, " "),
  );
  if (
    texts.slice(2).some((text) => /^\s*[(\[]?[1-4][.)\]、:]\s+\S/u.test(text))
  )
    return true;
  return texts.some((text) => positionalCues.some((cue) => cue.test(text)));
}

function contentSeed(questions: readonly QuizOptions[]) {
  // Order-independent option identities make this operation idempotent. This is
  // a stable tie breaker, not randomness, encryption or a secure exam shuffle.
  const text = JSON.stringify(
    questions.map((q) => [
      q.prompt,
      [...q.options].sort(),
      q.options[q.correct],
      q.explanation,
    ]),
  );
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash % 4;
}

/** Preserve exact option strings, answer identity, explanation and metadata. */
export function balanceQuizOptions<T extends QuizOptions>(
  questions: readonly T[],
) {
  const preservedIndices = questions.flatMap((q, i) =>
      hasPositionalOptionDependency(q) ? [i] : [],
    ),
    fixed = new Set(preservedIndices),
    counts = [0, 0, 0, 0],
    seed = contentSeed(questions);
  for (const index of preservedIndices) counts[questions[index].correct]++;
  const balanced = questions.map((question, index): T => {
    if (fixed.has(index)) return question;
    const least = Math.min(...counts);
    let target = 0;
    for (let offset = 0; offset < 4; offset++) {
      const position = (seed + index + offset) % 4;
      if (counts[position] === least) {
        target = position;
        break;
      }
    }
    counts[target]++;
    const shift = (target - question.correct + 4) % 4,
      options = Array<string>(4);
    question.options.forEach((option, oldIndex) => {
      options[(oldIndex + shift) % 4] = option;
    });
    return { ...question, options, correct: target };
  });
  return { questions: balanced, preservedIndices };
}
