import type { Locale } from "../lumio/i18n";
export function parseClock(value: string): number | null {
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value.trim())) return null;
  const parts = value.trim().split(":").map(Number);
  if (parts.at(-1)! >= 60 || (parts.length === 3 && parts[1] >= 60))
    return null;
  const result =
    parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
  return result <= 172800 ? result : null;
}
export const rangeCopy: Record<
  Locale,
  {
    title: string;
    start: string;
    end: string;
    hint: string;
    invalid: string;
    scope: string;
  }
> = {
  vi: {
    title: "Chọn đoạn video để học",
    start: "Bắt đầu",
    end: "Kết thúc",
    hint: "MM:SS hoặc HH:MM:SS · tối đa 30 phút mỗi yêu cầu. Chỉ phân tích đoạn đã chọn; các mốc chương tính từ đầu video gốc.",
    invalid:
      "Nhập mốc hợp lệ, kết thúc sau bắt đầu và độ dài không quá 30 phút.",
    scope: "Phạm vi đã yêu cầu",
  },
  en: {
    title: "Choose a video section",
    start: "Start",
    end: "End",
    hint: "MM:SS or HH:MM:SS · up to 30 minutes per request. Only the chosen section is analyzed; chapter times refer to the original video.",
    invalid:
      "Use valid times, with the end after the start and a maximum length of 30 minutes.",
    scope: "Requested section",
  },
  "zh-CN": {
    title: "选择学习片段",
    start: "开始",
    end: "结束",
    hint: "MM:SS 或 HH:MM:SS，每次最多30分钟。仅分析所选片段，章节时间相对原始视频。",
    invalid: "请输入有效时间，结束晚于开始，片段不超过30分钟。",
    scope: "请求分析的片段",
  },
  ja: {
    title: "学習する動画区間を選択",
    start: "開始",
    end: "終了",
    hint: "MM:SS または HH:MM:SS、1回最大30分。選んだ区間だけを分析し、章の時刻は元動画の先頭から表示します。",
    invalid:
      "有効な時刻を入力してください。終了は開始より後、区間は30分以内です。",
    scope: "分析を依頼した区間",
  },
  ko: {
    title: "학습할 영상 구간 선택",
    start: "시작",
    end: "종료",
    hint: "MM:SS 또는 HH:MM:SS · 요청당 최대30분. 선택 구간만 분석하며 챕터 시간은 원본 영상 기준입니다.",
    invalid:
      "유효한 시간을 입력하세요. 종료는 시작 이후, 구간은30분 이하여야 합니다.",
    scope: "요청한 구간",
  },
};
