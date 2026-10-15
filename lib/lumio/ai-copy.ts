import type { Locale } from "./i18n";
import { productCopy } from "./product-copy";
import { billingCopy } from "./billing-copy";
const en = {
  generate: "Generate with AI",
  send: "Send to provider",
  disclosure:
    "This action sends the question and source material to the displayed AI provider. Usage may be billed to your configured account.",
  review: "AI output may be incorrect. Review the answer before using it.",
  question: "Your question",
  busy: "Working…",
  cancel: "Cancel request",
  tooLarge:
    "AI supports up to 6 MB of media and 200,000 text characters per request in this release.",
  unavailable:
    "Configure a new API key, a model and LUMIO_AI_ENABLED in .env.local, then restart. Settings show configuration only, not a verified live connection.",
  transcribe: "Transcribe with xAI",
  speak: "Read with xAI",
  voice: "Voice tools",
  mediaNeeded: "Select an audio file for transcription.",
  added: "Generated material has been added to the matching study tab.",
  language: "Response language",
  mode: "Task",
  ready: "Configured · not live-verified",
  disabled: "Not configured",
  error: "Request failed",
  copied: "Saved to notes",
  saveNotes: "Save result to notes",
  audioPrivacy:
    "Audio is sent to xAI for transcription. Text is sent to xAI for speech generation.",
  realtime: "Realtime voice: not included in this release",
  blocked:
    "Sign in or explicitly enable ALLOW_LOCAL_AI for a localhost-only demo.",
  limit:
    "Request limit reached. Try later; the local demo allows 15 requests/minute and 150/day.",
  keys: "Provider authentication failed. Check your new key and account access.",
  timeout:
    "Provider unavailable or request timed out. No answer was generated.",
  empty: "No usable answer received. Try a shorter source.",
  invalid: "AI returned an invalid structure. Nothing was added.",
  origin: "Origin mismatch. Open the address configured in NEXTAUTH_URL.",
};
type Copy = typeof en;
const vi: Copy = {
  generate: "Tạo bằng AI",
  send: "Gửi tới nhà cung cấp",
  disclosure:
    "Thao tác này gửi câu hỏi và tài liệu gốc tới nhà cung cấp AI được hiển thị. Tài khoản API đã cấu hình có thể phát sinh phí.",
  review: "AI có thể trả lời sai. Hãy kiểm tra kết quả trước khi sử dụng.",
  question: "Câu hỏi của bạn",
  busy: "Đang xử lý…",
  cancel: "Hủy yêu cầu",
  tooLarge:
    "Bản này hỗ trợ tối đa 6 MB media và 200.000 ký tự văn bản trong mỗi yêu cầu AI.",
  unavailable:
    "Điền API key mới, model và LUMIO_AI_ENABLED trong .env.local rồi khởi động lại. Trạng thái chỉ phản ánh cấu hình, chưa xác minh kết nối thật.",
  transcribe: "Chép lời với xAI",
  speak: "Đọc với xAI",
  voice: "Công cụ giọng nói",
  mediaNeeded: "Chọn tài liệu âm thanh để chép lời.",
  added: "Nội dung được tạo đã thêm vào tab học tương ứng.",
  language: "Ngôn ngữ trả lời",
  mode: "Tác vụ",
  ready: "Đã cấu hình · chưa xác minh trực tiếp",
  disabled: "Chưa cấu hình",
  error: "Yêu cầu không thành công",
  copied: "Đã lưu vào ghi chú",
  saveNotes: "Lưu kết quả vào ghi chú",
  audioPrivacy:
    "Âm thanh được gửi tới xAI để chép lời. Văn bản được gửi tới xAI để tạo giọng đọc.",
  realtime: "Realtime voice: chưa có trong bản này",
  blocked:
    "Đăng nhập hoặc chủ động bật ALLOW_LOCAL_AI để demo riêng trên localhost.",
  limit: "Đã đạt giới hạn. Bản local cho phép 15 yêu cầu/phút và 150/ngày.",
  keys: "Nhà cung cấp từ chối xác thực. Kiểm tra key mới và quyền tài khoản.",
  timeout:
    "Nhà cung cấp không sẵn sàng hoặc quá thời gian. Chưa tạo câu trả lời.",
  empty: "Chưa nhận được câu trả lời hợp lệ. Thử tài liệu ngắn hơn.",
  invalid: "AI trả về cấu trúc không hợp lệ. Chưa thêm nội dung.",
  origin:
    "Địa chỉ truy cập không khớp. Mở đúng địa chỉ cấu hình trong NEXTAUTH_URL.",
};
const zh: Copy = {
  ...en,
  generate: "使用 AI 生成",
  send: "发送给提供商",
  disclosure:
    "此操作会将问题和原始资料发送给显示的 AI 提供商，并可能产生 API 费用。",
  review: "AI 可能出错。使用前请检查结果。",
  question: "你的问题",
  busy: "处理中…",
  cancel: "取消请求",
  tooLarge: "每次请求最多支持 6 MB 媒体和 200,000 个文本字符。",
  unavailable:
    "请在 .env.local 中配置新密钥、模型和 LUMIO_AI_ENABLED，然后重启。配置状态不代表连接已验证。",
  transcribe: "使用 xAI 转录",
  speak: "使用 xAI 朗读",
  voice: "语音工具",
  mediaNeeded: "请选择音频资料进行转录。",
  added: "生成的内容已添加到对应学习标签页。",
  language: "回答语言",
  mode: "任务",
  ready: "已配置 · 尚未验证",
  disabled: "未配置",
  error: "请求失败",
  copied: "已保存到笔记",
  saveNotes: "将结果保存到笔记",
  audioPrivacy: "音频发送至 xAI 转录；文本发送至 xAI 生成语音。",
  realtime: "此版本尚不包含实时语音",
  blocked: "请登录，或为本地演示启用 ALLOW_LOCAL_AI。",
  limit: "已达限额：每分钟 15 次，每天 150 次。",
  keys: "身份验证失败。请检查新密钥和账户权限。",
  timeout: "服务不可用或超时。未生成回答。",
  empty: "未收到有效回答。请缩短资料。",
  invalid: "AI 输出格式无效。未添加内容。",
  origin: "访问地址不匹配。请使用 NEXTAUTH_URL 中的地址。",
};
const ja: Copy = {
  ...en,
  generate: "AI で生成",
  send: "プロバイダーへ送信",
  disclosure:
    "質問と元の資料を表示された AI プロバイダーに送信します。API 利用料金が発生する場合があります。",
  review: "AI は誤ることがあります。利用前に結果を確認してください。",
  question: "質問",
  busy: "処理中…",
  cancel: "リクエストを中止",
  tooLarge: "1 回の上限はメディア 6 MB、テキスト 200,000 文字です。",
  unavailable:
    ".env.local に新しいキー、モデル、LUMIO_AI_ENABLED を設定して再起動してください。設定状態は接続確認済みを意味しません。",
  transcribe: "xAI で文字起こし",
  speak: "xAI で読み上げ",
  voice: "音声ツール",
  mediaNeeded: "文字起こしする音声資料を選択してください。",
  added: "生成した内容を対応する学習タブに追加しました。",
  language: "回答言語",
  mode: "タスク",
  ready: "設定済み・接続未確認",
  disabled: "未設定",
  error: "リクエスト失敗",
  copied: "ノートに保存しました",
  saveNotes: "結果をノートに保存",
  audioPrivacy:
    "文字起こしでは音声を、読み上げではテキストを xAI に送信します。",
  realtime: "この版にはリアルタイム音声は含まれません",
  blocked: "ログインするか、ローカル用 ALLOW_LOCAL_AI を有効にしてください。",
  limit: "上限に達しました。毎分 15 回、1 日 150 回までです。",
  keys: "認証失敗。新しいキーと権限を確認してください。",
  timeout: "サービス停止中またはタイムアウト。回答は生成されていません。",
  empty: "有効な回答がありません。資料を短くしてください。",
  invalid: "AI の出力形式が無効です。内容は追加していません。",
  origin:
    "アクセス先が一致しません。NEXTAUTH_URL のアドレスを使用してください。",
};
const ko: Copy = {
  ...en,
  generate: "AI로 생성",
  send: "제공업체에 보내기",
  disclosure:
    "질문과 원본 자료를 표시된 AI 제공업체에 보냅니다. API 사용 요금이 발생할 수 있습니다.",
  review: "AI는 틀릴 수 있습니다. 사용하기 전에 확인하세요.",
  question: "질문",
  busy: "처리 중…",
  cancel: "요청 취소",
  tooLarge: "요청당 미디어 6 MB, 텍스트 200,000자까지 지원합니다.",
  unavailable:
    ".env.local에 새 키, 모델과 LUMIO_AI_ENABLED를 설정하고 재시작하세요. 설정 상태는 실제 연결 검증을 뜻하지 않습니다.",
  transcribe: "xAI로 받아쓰기",
  speak: "xAI로 읽기",
  voice: "음성 도구",
  mediaNeeded: "받아쓸 오디오 자료를 선택하세요.",
  added: "생성된 내용을 해당 학습 탭에 추가했습니다.",
  language: "답변 언어",
  mode: "작업",
  ready: "설정됨 · 연결 미검증",
  disabled: "미설정",
  error: "요청 실패",
  copied: "노트에 저장됨",
  saveNotes: "결과를 노트에 저장",
  audioPrivacy:
    "받아쓰기를 위해 오디오를, 음성 생성을 위해 텍스트를 xAI에 보냅니다.",
  realtime: "이번 버전에는 실시간 음성이 포함되지 않습니다",
  blocked: "로그인하거나 로컬 데모용 ALLOW_LOCAL_AI를 활성화하세요.",
  limit: "한도에 도달했습니다. 분당 15회, 하루 150회입니다.",
  keys: "인증 실패. 새 키와 계정 권한을 확인하세요.",
  timeout:
    "서비스를 사용할 수 없거나 시간이 초과되었습니다. 답변이 생성되지 않았습니다.",
  empty: "유효한 답변이 없습니다. 자료를 줄여보세요.",
  invalid: "AI 출력 형식이 잘못되어 추가되지 않았습니다.",
  origin: "접속 주소가 다릅니다. NEXTAUTH_URL 주소를 사용하세요.",
};
export const aiCopy: Record<Locale, Copy> = { en, vi, "zh-CN": zh, ja, ko };
export function aiErrorMessage(code: string, locale: Locale) {
  const t = aiCopy[locale];
  return (
    (
      {
        SIGN_IN_REQUIRED: productCopy[locale].accountHint,
        AI_DISABLED: productCopy[locale].offlineHint,
        PROVIDER_NOT_CONFIGURED: productCopy[locale].offlineHint,
        LOCAL_RATE_LIMIT: t.limit,
        COMPETITION_RATE_LIMIT: t.limit,
        TUTOR_BUSY: t.limit,
        INVALID_TUTOR_OUTPUT: t.invalid,
        DUPLICATE_TUTOR_HINT: t.invalid,
        INVALID_SOURCE_EVIDENCE: ({vi: "Nguồn đối chiếu đã thay đổi hoặc hết hiệu lực. Mở Nguồn học liệu, trích xuất lại văn bản rồi thử lại.", en: "Source evidence changed or expired. Open the source tab, extract the text again, then retry.", ja: "参照元が変更されたか無効です。元資料タブでテキストを再抽出してください。", ko: "출처가 변경되었거나 만료되었어요. 원본 탭에서 텍스트를 다시 추출하세요.", "zh-CN": "来源已更改或失效。请在原始资料页重新提取文字后重试。"})[locale],
        SOURCE_SIGNING_UNAVAILABLE: ({vi: "Hiện chưa xác thực được nguồn học liệu. Vui lòng thử lại sau; không có kết quả mới được thêm.", en: "Source verification is unavailable. Retry later; no new result was added.", ja: "参照元を検証できません。しばらくしてから再試行してください。", ko: "출처를 검증할 수 없어요. 잠시 후 다시 시도하세요.", "zh-CN": "暂时无法验证来源。请稍后重试，未添加新结果。"})[locale],
        TUTOR_SESSION_LIMIT: t.limit,
        TUTOR_TURN_LIMIT: t.limit,
        PROVIDER_RATE_LIMIT: t.limit,
        PROVIDER_AUTH_ERROR: t.timeout,
        INVALID_AI_OUTPUT: t.invalid,
        EMPTY_AI_OUTPUT: t.empty,
        INCOMPLETE_RESPONSE: t.empty,
        PAYLOAD_TOO_LARGE: t.tooLarge,
        INPUT_TOO_LONG: t.tooLarge,
        INVALID_ORIGIN: t.timeout,
        SESSION_REVOKED: productCopy[locale].accountHint,
        CREDITS_INSUFFICIENT: billingCopy[locale].insufficient,
        PLAN_ACCESS_REQUIRED: billingCopy[locale].access,
        INVALID_VIDEO_DURATION: billingCopy[locale].access,
        BILLING_REQUEST_IN_PROGRESS: t.limit,
      } as Record<string, string>
    )[code] || t.timeout
  );
}
