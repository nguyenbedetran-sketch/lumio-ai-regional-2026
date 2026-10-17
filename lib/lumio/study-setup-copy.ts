import type { Locale } from "./i18n";
export const studySetupCopy: Record<
  Locale,
  { setup: string; hint: string; error: string; chosen: string }
> = {
  en: {
    setup: "Set your study direction",
    hint: "Choose an aim and topics for your next step. Optional, editable, and saved only in this account's workspace on this device. A preferred level is not an ability assessment.",
    error:
      "Preferences were not saved. Check browser storage and retry; this is not a completed learning activity.",
    chosen: "Matches the study goal and topics you selected",
  },
  vi: {
    setup: "Chọn hướng học của bạn",
    hint: "Chọn mục tiêu và chủ đề cho bước học tiếp theo. Không bắt buộc, có thể sửa; chỉ lưu theo tài khoản trên thiết bị này. Mức độ mong muốn không phải đánh giá năng lực.",
    error:
      "Chưa lưu được tùy chọn. Kiểm tra quyền lưu trữ rồi thử lại; thao tác này không phải một hoạt động học đã hoàn thành.",
    chosen: "Phù hợp mục tiêu và chủ đề bạn tự chọn",
  },
  "zh-CN": {
    setup: "选择你的学习方向",
    hint: "为下一步选择目标和主题。可跳过或修改，仅保存在此设备的账号学习空间。偏好难度不是能力评估。",
    error: "偏好未保存。请检查浏览器存储后重试；这不是已完成的学习活动。",
    chosen: "符合你选择的学习目标和主题",
  },
  ja: {
    setup: "学習の方向を選ぶ",
    hint: "次の一歩に向けて目標とテーマを選びます。任意で変更可能。この端末のアカウント別領域に保存します。希望する難易度は能力評価ではありません。",
    error:
      "設定は保存されていません。保存権限を確認して再試行してください。学習完了の記録は作りません。",
    chosen: "自分で選んだ学習目標とテーマに一致",
  },
  ko: {
    setup: "학습 방향 선택",
    hint: "다음 단계의 목표와 주제를 선택하세요. 선택 사항이며 수정할 수 있고 이 기기의 계정 학습 공간에만 저장돼요. 희망 난이도는 능력 평가가 아니에요.",
    error:
      "설정을 저장하지 못했어요. 브라우저 저장 권한을 확인하고 다시 시도하세요. 학습 완료 기록은 만들지 않아요.",
    chosen: "선택한 학습 목표와 주제에 맞는 자료",
  },
};
