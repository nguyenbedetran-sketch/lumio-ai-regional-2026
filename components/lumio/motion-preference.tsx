"use client";
import { Sparkles } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { MotionMode } from "../../lib/lumio/motion-policy";

const copy = {
  vi: {
    title: "Chuyển động",
    full: "Đầy đủ",
    subtle: "Nhẹ",
    off: "Tắt",
    hint: "Chuyển cảnh, thẻ lật và phản hồi khi học. Tùy chọn được lưu trên thiết bị này.",
    system: "Thiết bị đang bật giảm chuyển động, nên Lumio tạm tắt hiệu ứng.",
    session:
      "Trình duyệt không cho lưu tùy chọn. Mức chuyển động áp dụng trong lần mở này.",
  },
  en: {
    title: "Motion",
    full: "Full",
    subtle: "Subtle",
    off: "Off",
    hint: "Transitions, card flips and learning feedback. Saved on this device.",
    system: "Your device requests reduced motion, so Lumio is pausing effects.",
    session:
      "Browser storage is unavailable. This motion setting applies to this visit.",
  },
  "zh-CN": {
    title: "动态效果",
    full: "完整",
    subtle: "轻微",
    off: "关闭",
    hint: "页面过渡、卡片翻转和学习反馈。设置保存在此设备。",
    system: "设备已启用减少动态效果，Lumio 暂停动画。",
    session: "无法保存浏览器设置，此动态设置仅适用于本次访问。",
  },
  ja: {
    title: "アニメーション",
    full: "標準",
    subtle: "控えめ",
    off: "オフ",
    hint: "画面遷移、カードの反転、学習のフィードバック。この端末に保存されます。",
    system: "端末の動きを減らす設定に従って、演出を一時停止しています。",
    session: "ブラウザに設定を保存できません。今回の利用中に適用されます。",
  },
  ko: {
    title: "움직임",
    full: "전체",
    subtle: "가볍게",
    off: "끄기",
    hint: "화면 전환, 카드 뒤집기, 학습 피드백. 이 기기에 저장돼요.",
    system: "기기의 움직임 줄이기 설정에 따라 효과를 잠시 껐어요.",
    session: "브라우저에 저장할 수 없어 이번 방문에만 적용돼요.",
  },
};
export function MotionPreference({
  locale,
  preference,
  systemReduced,
  stored,
  setPreference,
}: {
  locale: Locale;
  preference: MotionMode;
  systemReduced: boolean;
  stored: boolean;
  setPreference: (mode: MotionMode) => void;
}) {
  const c = copy[locale];
  return (
    <div className="lm-motion-setting">
      <label className="lm-field">
        <span>
          <Sparkles size={16} aria-hidden="true" /> {c.title}
        </span>
        <select
          value={preference}
          onChange={(event) => setPreference(event.target.value as MotionMode)}
          aria-describedby="lm-motion-hint"
        >
          <option value="full">{c.full}</option>
          <option value="subtle">{c.subtle}</option>
          <option value="off">{c.off}</option>
        </select>
      </label>
      <p id="lm-motion-hint" className="lm-help">
        {systemReduced ? c.system : stored ? c.hint : c.session}
      </p>
      {systemReduced && !stored && (
        <p className="lm-help" role="status">
          {c.session}
        </p>
      )}
      <div className="lm-motion-preview" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>Lumio</span>
      </div>
    </div>
  );
}
