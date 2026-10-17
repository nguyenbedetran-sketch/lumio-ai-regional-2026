"use client";
import { useId, useState } from "react";
import { ExternalLink, Link2, PlayCircle, Presentation, ShieldCheck, X } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { TeachingMaterial } from "../../lib/teaching/contracts";
import { inspectTeachingResourceURL, teachingResourceTime, type SafeTeachingResource } from "../../lib/teaching/resource-links";
import { MathText } from "../lumio/math-text";
import styles from "./resource-link.module.css";

const copies = {
  vi: { resource: "Tài nguyên học tập", open: "Mở tại nguồn", load: "Cho phép tải video YouTube", close: "Đóng trình phát", consent: "Chỉ khi bạn bấm cho phép, trình duyệt mới kết nối YouTube. Địa chỉ IP và dữ liệu trình duyệt có thể được gửi tới dịch vụ này; chế độ không cookie không bảo đảm không theo dõi.", watch: "Khung video không xác nhận bạn đã xem hoặc hoàn thành bài. Phụ đề và khả năng phát phụ thuộc video; nếu bị chặn, hãy mở tại nguồn.", loading: "Đang tải khung video…", error: "Không tải được khung video. Bạn có thể thử lại hoặc mở tại nguồn.", retry: "Thử tải lại", presentation: "Liên kết tham khảo: Lumio không chỉnh sửa thiết kế, xác nhận quyền truy cập tài nguyên riêng tư hoặc tự chuyển đổi slide. Dịch vụ gốc có thể yêu cầu đăng nhập.", external: "Tài nguyên mở ở dịch vụ gốc. Lumio không tự tải nội dung hoặc xác nhận quyền truy cập; video ngoài YouTube được xem tại nguồn.", invalid: "Liên kết này chưa hợp lệ hoặc không an toàn. Nhờ giáo viên kiểm tra lại địa chỉ.", http: "Liên kết HTTP không mã hóa. Chỉ mở khi bạn tin cậy nguồn.", start: "Bắt đầu tại" },
  en: { resource: "Learning resource", open: "Open at source", load: "Allow YouTube video to load", close: "Close player", consent: "Your browser connects to YouTube only after you allow it. Your IP address and browser data may be sent to that service; no-cookie mode does not guarantee no tracking.", watch: "Opening this player does not confirm viewing or lesson completion. Captions and playback depend on the video; open the source if it is blocked.", loading: "Loading video frame…", error: "The video frame could not load. Retry or open the source.", retry: "Retry loading", presentation: "Reference link: Lumio does not edit designs, verify access to private resources or automatically convert slides. The source service may require sign-in.", external: "This resource opens at its source service. Lumio does not fetch it or verify access; non-YouTube videos play at the source.", invalid: "This link is invalid or unsafe. Ask the teacher to check its address.", http: "This HTTP link is not encrypted. Open only if you trust the source.", start: "Start at" },
  "zh-CN": { resource: "学习资源", open: "打开来源", load: "允许加载 YouTube 视频", close: "关闭播放器", consent: "只有允许后，浏览器才会连接 YouTube。IP 地址和浏览器数据可能发送给该服务；无 Cookie 模式不保证不会被跟踪。", watch: "打开播放器不代表已观看或完成课程。字幕和播放取决于视频；无法播放时请打开来源。", loading: "正在加载视频框架…", error: "视频框架无法加载。请重试或打开来源。", retry: "重新加载", presentation: "参考链接：Lumio 不编辑设计、不验证私人资源权限，也不自动转换幻灯片。来源服务可能要求登录。", external: "资源在来源服务中打开。Lumio 不自动获取内容或验证权限；其他视频在来源播放。", invalid: "链接无效或不安全。请老师检查地址。", http: "此 HTTP 链接未加密。仅在信任来源时打开。", start: "开始于" },
  ja: { resource: "学習リソース", open: "提供元で開く", load: "YouTube 動画の読み込みを許可", close: "プレーヤーを閉じる", consent: "許可後のみブラウザーが YouTube に接続します。IP アドレスやブラウザーデータが送信される場合があります。Cookie なしモードでも追跡されない保証はありません。", watch: "開いただけで視聴や学習完了とは判定しません。字幕と再生可否は動画によります。再生できない場合は提供元で開いてください。", loading: "動画フレームを読み込み中…", error: "動画を読み込めません。再試行するか提供元で開いてください。", retry: "再読み込み", presentation: "参照リンクです。Lumio はデザイン編集、非公開資料のアクセス確認、スライドの自動変換を行いません。提供元でログインが必要な場合があります。", external: "提供元で開きます。Lumio は内容の自動取得や権限確認をしません。他の動画は提供元で再生します。", invalid: "リンクが無効または安全ではありません。先生に確認してください。", http: "暗号化されていない HTTP リンクです。信頼できる場合のみ開いてください。", start: "開始位置" },
  ko: { resource: "학습 자료", open: "원본에서 열기", load: "YouTube 동영상 로드 허용", close: "플레이어 닫기", consent: "허용한 뒤에만 브라우저가 YouTube에 연결합니다. IP 주소와 브라우저 정보가 전달될 수 있으며, 쿠키 없는 모드도 추적 방지를 보장하지 않습니다.", watch: "플레이어를 열었다고 시청이나 학습 완료로 기록하지 않습니다. 자막과 재생 여부는 동영상에 따라 달라집니다. 차단되면 원본에서 여세요.", loading: "동영상 프레임 로드 중…", error: "동영상을 로드하지 못했습니다. 다시 시도하거나 원본에서 여세요.", retry: "다시 로드", presentation: "참고 링크입니다. Lumio는 디자인 편집, 비공개 자료 접근 확인 또는 슬라이드 자동 변환을 하지 않습니다. 원본 서비스 로그인이 필요할 수 있습니다.", external: "원본 서비스에서 열립니다. Lumio는 내용을 자동으로 가져오거나 권한을 확인하지 않습니다. 다른 동영상은 원본에서 재생합니다.", invalid: "올바르지 않거나 안전하지 않은 링크입니다. 선생님께 주소 확인을 요청하세요.", http: "암호화되지 않은 HTTP 링크입니다. 신뢰하는 경우에만 여세요.", start: "시작 위치" },
} satisfies Record<Locale, Record<string, string>>;
const playbackProblem: Record<Locale, string> = { vi: "Video không phát", en: "Video will not play", "zh-CN": "视频无法播放", ja: "動画を再生できない", ko: "동영상이 재생되지 않아요" };

/** External references only. Never grants access or records viewing/completion. */
export function TeachingResourceLink({ url, title, kind, locale = "vi" }: { url?: string; title?: string; kind?: TeachingMaterial["kind"]; locale?: Locale }) {
  if (!url?.trim()) return null;
  const resource = inspectTeachingResourceURL(url), copy = copies[locale] || copies.vi;
  if (!resource.valid) return <p className={styles.invalid} role="note" data-teaching-resource="invalid">{copy.invalid}</p>;
  return <ResourceCard key={resource.href} resource={resource} title={title} kind={kind} locale={locale} />;
}

function ResourceCard({ resource, title, kind, locale }: { resource: Extract<SafeTeachingResource, { valid: true }>; title?: string; kind?: TeachingMaterial["kind"]; locale: Locale }) {
  const [active, setActive] = useState(false), [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), privacyId = useId();
  const copy = copies[locale] || copies.vi, video = resource.provider === "youtube", presentation = ["canva", "google-slides", "powerpoint"].includes(resource.provider) || kind === "pptx";
  const provider = { youtube: "YouTube", canva: "Canva", "google-slides": "Google Slides", powerpoint: "PowerPoint", external: copy.resource }[resource.provider];
  const Icon = video ? PlayCircle : presentation ? Presentation : Link2;
  const begin = () => { setLoaded(false); setFailed(false); setAttempt(n => n + 1); setActive(true); };
  return <section className={styles.resource} data-teaching-resource={resource.provider}>
    <div className={styles.heading}><Icon size={20} aria-hidden="true" /><div><strong><MathText text={title || provider} inline /></strong><span>{provider} · {resource.host}{resource.startSeconds ? ` · ${copy.start} ${teachingResourceTime(resource.startSeconds)}` : ""}</span></div></div>
    <p id={privacyId} className={styles.notice}>{video ? copy.consent : presentation ? copy.presentation : copy.external}</p>
    {resource.insecure && <p className={styles.invalid} role="note">{copy.http}</p>}
    <div className={styles.actions}>
      {video && <button type="button" onClick={active ? () => { setActive(false); setFailed(false); } : begin} aria-expanded={active} aria-describedby={privacyId}>{active ? <X size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}{active ? copy.close : copy.load}</button>}
      <a href={resource.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink size={16} aria-hidden="true" />{copy.open}<span className={styles.sr}> ({provider})</span></a>
    </div>
    {video && active && <div className={styles.player}>
      {!loaded && !failed && <p role="status" className={styles.loading}>{copy.loading}</p>}
      {!failed && <div className={styles.frame}><iframe key={attempt} src={resource.embedUrl} title={title ? `${provider}: ${title}` : provider} referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }} /></div>}
      {!failed && <button type="button" onClick={() => { setFailed(true); setLoaded(false); }}>{playbackProblem[locale]}</button>}
      {failed && <p className={styles.invalid} role="alert">{copy.error} <button type="button" onClick={begin}>{copy.retry}</button></p>}
      <p className={styles.notice}>{copy.watch}</p>
    </div>}
  </section>;
}
