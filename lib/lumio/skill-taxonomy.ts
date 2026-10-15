/** Small declared scope, not a generated curriculum or a universal learning order. */
export const SKILL_TAXONOMY_VERSION = "lumio-math-foundations-1";
export const skillTaxonomy = [
  {
    id: "fractions",
    vi: "Phép tính phân số",
    en: "Fraction operations",
    aliases: [
      "Phân số",
      "Phép tính phân số",
      "Fractions",
      "Fraction operations",
    ],
    prerequisites: [],
  },
  {
    id: "linear",
    vi: "Phương trình bậc nhất",
    en: "Linear equations",
    aliases: [
      "Phương trình bậc nhất",
      "Phương trình bậc nhất một ẩn",
      "Linear equations",
      "One-variable linear equations",
    ],
    prerequisites: [],
  },
  {
    id: "factor",
    vi: "Phân tích thành nhân tử",
    en: "Factorisation",
    aliases: [
      "Phân tích thành nhân tử",
      "Phân tích đa thức thành nhân tử",
      "Factorisation",
      "Factorization",
    ],
    prerequisites: [],
  },
  {
    id: "product",
    vi: "Phương trình tích",
    en: "Product equations",
    aliases: ["Phương trình tích", "Product equations", "Factored equations"],
    prerequisites: ["linear", "factor"],
  },
  {
    id: "domain",
    vi: "Điều kiện xác định",
    en: "Domain restrictions",
    aliases: [
      "Điều kiện xác định",
      "ĐKXĐ",
      "Domain restrictions",
      "Domain of expressions",
    ],
    prerequisites: [],
  },
  {
    id: "roots",
    vi: "Căn bậc hai",
    en: "Square roots",
    aliases: [
      "Căn bậc hai",
      "Căn thức bậc hai",
      "Square roots",
      "Square root expressions",
    ],
    prerequisites: ["domain"],
  },
  {
    id: "radical-equations",
    vi: "Phương trình chứa căn",
    en: "Radical equations",
    aliases: [
      "Phương trình chứa căn",
      "Phương trình vô tỉ",
      "Radical equations",
    ],
    prerequisites: ["domain", "roots", "linear"],
  },
] as const;
export type SkillId = (typeof skillTaxonomy)[number]["id"];
export const skillById = (id: string) => skillTaxonomy.find((s) => s.id === id);
const translatedNames = {
  "zh-CN": [
    "分数运算",
    "一元一次方程",
    "因式分解",
    "乘积方程",
    "定义域限制",
    "平方根",
    "根式方程",
  ],
  ja: [
    "分数の計算",
    "一次方程式",
    "因数分解",
    "積の方程式",
    "定義域の条件",
    "平方根",
    "無理方程式",
  ],
  ko: [
    "분수 연산",
    "일차방정식",
    "인수분해",
    "곱 형태 방정식",
    "정의역 조건",
    "제곱근",
    "무리방정식",
  ],
} as const;
export function skillLabel(id: SkillId, locale: string) {
  const index = skillTaxonomy.findIndex((s) => s.id === id),
    skill = skillTaxonomy[index];
  if (!skill) return id;
  return locale === "vi"
    ? skill.vi
    : locale in translatedNames
      ? translatedNames[locale as keyof typeof translatedNames][index]
      : skill.en;
}
export const normalizeSkillTopic = (s: string) =>
  s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
/** Exact declared aliases only: broad substring matches must not diagnose skills. */
export function skillForTopic(topic: string): SkillId | undefined {
  const key = normalizeSkillTopic(topic);
  return skillTaxonomy.find((s) =>
    s.aliases.some((a) => normalizeSkillTopic(a) === key),
  )?.id;
}
export function validateSkillGraph(
  nodes: readonly { id: string; prerequisites: readonly string[] }[],
) {
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw new Error("DUPLICATE_SKILL");
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("CYCLIC_SKILL_GRAPH");
    if (done.has(id)) return;
    visiting.add(id);
    const node = nodes.find((n) => n.id === id)!;
    if (new Set(node.prerequisites).size !== node.prerequisites.length)
      throw new Error("DUPLICATE_PREREQUISITE");
    for (const p of node.prerequisites) {
      if (!ids.has(p)) throw new Error("UNKNOWN_PREREQUISITE");
      visit(p);
    }
    visiting.delete(id);
    done.add(id);
  }
  for (const id of ids) visit(id);
  return true;
}
validateSkillGraph(skillTaxonomy);
