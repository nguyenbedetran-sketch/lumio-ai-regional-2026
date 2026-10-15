import { ShieldCheck } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import {
  outboundCategories,
  type OutboundDisclosure,
} from "../../lib/lumio/outbound-disclosure";
const en = {
  title: "Data sent when you run AI",
  intro: "The following goes through Lumio's server to an external AI service:",
  source: "selected material text",
  question: "your question",
  history: "recent conversation turns",
  image: "the selected image",
  pdf: "the selected PDF",
  audio: "the selected audio recording",
  video: "the selected video file",
  videoUrl: "the video URL and selected time range",
  speechText: "the text selected for read-aloud",
  options: "language and learning/voice settings",
  caution:
    "Only send material you can share. Remove personal details you do not need. Your library and recommendation ratings are not sent in full.",
  policy: "Data and privacy",
  tutor:
    "The problem and conversation are stored on Lumio. Tutor sessions expire after 7 days; expired data is cleaned up on access, or you can delete your session.",
};
const copy: Record<Locale, typeof en> = {
  en,
  vi: {
    title: "Dữ liệu gửi khi bạn dùng AI",
    intro: "Các mục sau đi qua máy chủ Lumio tới dịch vụ AI bên ngoài:",
    source: "văn bản học liệu đã chọn",
    question: "câu hỏi bạn nhập",
    history: "các lượt hội thoại gần đây",
    image: "ảnh đã chọn",
    pdf: "tệp PDF đã chọn",
    audio: "bản ghi âm đã chọn",
    video: "tệp video đã chọn",
    videoUrl: "đường dẫn video và phạm vi thời gian đã chọn",
    speechText: "đoạn văn bản chọn để đọc ra tiếng",
    options: "ngôn ngữ và tùy chọn học/giọng đọc",
    caution:
      "Chỉ gửi nội dung bạn có quyền chia sẻ; bỏ thông tin cá nhân không cần thiết. Không gửi toàn bộ thư viện hoặc phản hồi đề xuất.",
    policy: "Dữ liệu và quyền riêng tư",
    tutor:
      "Đề bài và hội thoại gia sư được lưu trên Lumio. Phiên hết hạn sau 7 ngày; dữ liệu hết hạn được dọn khi truy cập, hoặc bạn có thể chủ động xóa phiên.",
  },
  "zh-CN": {
    title: "使用 AI 时发送的数据",
    intro: "以下内容通过 Lumio 服务器发送至外部 AI 服务：",
    source: "所选资料文字",
    question: "你的问题",
    history: "最近的对话",
    image: "所选图片",
    pdf: "所选 PDF",
    audio: "所选录音",
    video: "所选视频文件",
    videoUrl: "视频链接和所选时间范围",
    speechText: "朗读文字",
    options: "语言、学习或声音设置",
    caution:
      "只发送有权分享的内容，并删除不必要的个人信息。不会发送整个资料库或推荐评价。",
    policy: "数据与隐私",
    tutor:
      "题目和对话存储在 Lumio。会话7天后过期，过期数据在访问时清理，也可主动删除会话。",
  },
  ja: {
    title: "AI 使用時に送信するデータ",
    intro: "次の情報が Lumio サーバーを経由して外部 AI サービスに送られます：",
    source: "選択した教材の文章",
    question: "入力した質問",
    history: "最近の会話",
    image: "選択した画像",
    pdf: "選択した PDF",
    audio: "選択した録音",
    video: "選択した動画ファイル",
    videoUrl: "動画 URL と選択した時間範囲",
    speechText: "読み上げる文章",
    options: "言語、学習や音声の設定",
    caution:
      "共有できる教材だけを送り、不要な個人情報を除いてください。ライブラリ全体や提案の評価は送りません。",
    policy: "データとプライバシー",
    tutor:
      "問題と会話は Lumio に保存され、セッションは7日後に期限切れとなります。期限切れデータはアクセス時に整理され、自分でも削除できます。",
  },
  ko: {
    title: "AI 사용 시 전송하는 데이터",
    intro: "다음 정보가 Lumio 서버를 거쳐 외부 AI 서비스로 전송됩니다:",
    source: "선택한 자료 텍스트",
    question: "입력한 질문",
    history: "최근 대화",
    image: "선택한 이미지",
    pdf: "선택한 PDF",
    audio: "선택한 녹음",
    video: "선택한 동영상 파일",
    videoUrl: "동영상 주소와 선택한 시간 범위",
    speechText: "읽어 줄 텍스트",
    options: "언어, 학습 및 음성 설정",
    caution:
      "공유할 권한이 있는 자료만 보내고 불필요한 개인 정보는 지워 주세요. 전체 자료실이나 추천 평가는 전송하지 않습니다.",
    policy: "데이터 및 개인 정보",
    tutor:
      "문제와 대화는 Lumio에 저장됩니다. 세션은7일 후 만료되고 만료 데이터는 접근 시 정리되며 직접 삭제할 수도 있습니다.",
  },
};
export function OutboundDataNotice({
  locale,
  ...input
}: OutboundDisclosure & { locale: Locale }) {
  const c = copy[locale];
  return (
    <details
      className="lm-outbound-notice"
      data-outbound-disclosure={input.action}
      style={{
        margin: "14px 0",
        border: "1px solid var(--lm-line)",
        borderRadius: 14,
        padding: "12px 14px",
        fontSize: 12,
        lineHeight: 1.75,
        color: "var(--lm-muted)",
      }}
    >
      <summary style={{ cursor: "pointer", color: "var(--lm-text)" }}>
        <ShieldCheck
          size={14}
          style={{ verticalAlign: "middle", marginRight: 7 }}
        />
        {c.title}
      </summary>
      <p>
        {c.intro}{" "}
        {outboundCategories(input)
          .map((category) => c[category])
          .join("; ")}
        .
      </p>
      {input.tutorSession && <p>{c.tutor}</p>}
      <p>
        {c.caution}{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          {c.policy} ↗
        </a>
      </p>
    </details>
  );
}
