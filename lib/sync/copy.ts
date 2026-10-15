import type { Locale } from "../lumio/i18n";
const en = {
  title: "Continue on another device",
  detail:
    "Sync text, notes, cards, quizzes, review schedules, skill snapshots and preferences with your Lumio account. Original PDFs, images, audio/video and custom alarms remain on this device. Server copies expire 7 days after the last write and may reset earlier on free hosting.",
  consent: "Store my study snapshot on the Lumio server",
  sync: "Sync now",
  offline: "Offline · queued on this device",
  ready: "No data sent",
  done: "Synced",
  busy: "Comparing changes…",
  conflict: "Choose how to resolve different changes",
  local: "Prefer this device's changes",
  remote: "Prefer server changes",
  pull: "Use server copy",
  backup: "Save a backup before choosing",
  signin: "Sign in to sync",
  paused: "Sync paused",
  error: "Not synced. Your device data is retained.",
  first:
    "First connection, or the server copy was reset. Choose what to keep before continuing.",
  deleteConfirm:
    "Delete the server sync copy? Your device data will be retained. Other devices must compare again before sending changes.",
  delete: "Delete server copy",
  accountBound:
    "Each account has its own library. Offline edits stay on this device until sync succeeds. Turning sync off does not delete an existing server copy.",
  conflictError:
    "The server copy changed. Compare again and review conflicts before retrying.",
  changedError:
    "Your local work changed during sync. Compare again to include the latest edits.",
  authError:
    "Your account or session changed. Sign in to the intended account and try again.",
  sizeError:
    "This snapshot is too large. Export a backup, then sync a smaller library.",
  dataError:
    "This snapshot could not be read safely. Keep a backup and check the app version before retrying.",
  storageError:
    "Browser storage is full or unavailable. Export a backup before clearing space or changing permissions.",
  connectionError:
    "The server could not be reached safely. Check your connection and try again; saved work stays on this device.",
};
export const syncCopy: Record<Locale, typeof en> = {
  en,
  vi: {
    title: "Tiếp tục học trên thiết bị khác",
    detail:
      "Đồng bộ văn bản, ghi chú, thẻ, quiz, lịch ôn, snapshot kỹ năng và tùy chọn với tài khoản Lumio của bạn. Tệp PDF, ảnh, âm thanh/video gốc và chuông riêng vẫn ở thiết bị. Bản máy chủ hết hạn sau 7 ngày từ lần ghi cuối và có thể mất sớm khi hosting miễn phí đặt lại.",
    consent: "Tôi muốn lưu bản học tập lên máy chủ Lumio",
    sync: "Đồng bộ ngay",
    offline: "Đang ngoại tuyến · giữ hàng đợi trên thiết bị",
    ready: "Chưa gửi dữ liệu",
    done: "Đã đồng bộ",
    busy: "Đang đối chiếu…",
    conflict: "Có thay đổi khác nhau cần bạn chọn",
    local: "Ưu tiên thay đổi trên thiết bị này",
    remote: "Ưu tiên thay đổi từ máy chủ",
    pull: "Nhận bản máy chủ",
    backup: "Lưu bản sao trước khi chọn",
    signin: "Đăng nhập để đồng bộ",
    paused: "Đồng bộ đang tắt",
    error: "Chưa đồng bộ. Dữ liệu trên thiết bị vẫn được giữ.",
    first:
      "Đây là lần ghép đầu tiên hoặc bản máy chủ đã đặt lại. Hãy chọn bản cần giữ trước khi tiếp tục.",
    deleteConfirm:
      "Xóa bản đồng bộ trên máy chủ? Dữ liệu trên thiết bị này vẫn được giữ. Thiết bị khác phải đối chiếu lại trước khi gửi thay đổi.",
    delete: "Xóa bản máy chủ",
    accountBound:
      "Mỗi tài khoản có thư viện riêng. Bản ngoại tuyến ở thiết bị đến khi gửi thành công. Tắt đồng bộ không tự xóa bản đã có trên máy chủ.",
    conflictError:
      "Bản máy chủ đã thay đổi. Đối chiếu lại và xử lý xung đột trước khi thử tiếp.",
    changedError:
      "Bạn đã chỉnh sửa trong lúc đồng bộ. Hãy đối chiếu lại để giữ cả thay đổi mới nhất.",
    authError:
      "Tài khoản hoặc phiên đăng nhập đã thay đổi. Đăng nhập đúng tài khoản rồi thử lại.",
    sizeError:
      "Bản đồng bộ quá lớn. Xuất bản sao rồi chọn thư viện nhỏ hơn để đồng bộ.",
    dataError:
      "Chưa thể đọc bản này an toàn. Giữ bản sao và kiểm tra phiên bản ứng dụng trước khi thử lại.",
    storageError:
      "Bộ nhớ trình duyệt đã đầy hoặc bị chặn. Xuất bản sao trước khi dọn dung lượng hay đổi quyền lưu trữ.",
    connectionError:
      "Chưa kết nối an toàn được với máy chủ. Kiểm tra mạng rồi thử lại; nội dung đã lưu vẫn ở thiết bị.",
  },
  "zh-CN": {
    title: "在另一台设备继续学习",
    detail:
      "将文字、笔记、卡片、测验、复习计划、技能快照和偏好同步至Lumio账户。原始PDF、图片、音视频和自选铃声仅保留本机。服务器副本最后写入7天后过期，免费托管重置时可能更早丢失。",
    consent: "将学习快照存储在Lumio服务器",
    sync: "立即同步",
    offline: "离线 · 已在本机排队",
    ready: "尚未发送数据",
    done: "已同步",
    busy: "正在比较…",
    conflict: "请处理不同的更改",
    local: "优先此设备的更改",
    remote: "优先服务器的更改",
    pull: "使用服务器副本",
    backup: "选择前保存备份",
    signin: "登录后同步",
    paused: "同步已暂停",
    error: "尚未同步，本机数据仍保留。",
    first: "首次连接或服务器副本已重置，请选择要保留的版本。",
    deleteConfirm:
      "删除服务器同步副本？本机数据保留。其他设备发送前须重新比较。",
    delete: "删除服务器副本",
    accountBound:
      "每个账户独立保存。离线更改留在本机直至同步成功。关闭同步不会删除已有服务器副本。",
    conflictError: "服务器副本已变化，请重新比较并处理冲突。",
    changedError: "同步时本机内容已更改，请重新比较以保留最新修改。",
    authError: "账户或会话已变化，请登录正确账户重试。",
    sizeError: "快照过大，请导出备份后同步较小资料库。",
    dataError: "无法安全读取此快照，请备份并检查应用版本。",
    storageError: "浏览器存储已满或不可用，请先导出备份再调整空间或权限。",
    connectionError: "无法安全连接服务器，请检查网络后重试；已存内容仍在本机。",
  },
  ja: {
    title: "別の端末で学習を続ける",
    detail:
      "文章、ノート、カード、クイズ、復習予定、スキル記録と設定をLumioアカウントへ同期します。元のPDF・画像・音声・動画・独自のベルは端末に残ります。サーバーのコピーは最終書き込みから7日で期限切れ、無料ホストのリセットで早く失われる場合があります。",
    consent: "学習記録をLumioサーバーに保存する",
    sync: "今すぐ同期",
    offline: "オフライン・端末で待機中",
    ready: "データ未送信",
    done: "同期しました",
    busy: "変更を比較中…",
    conflict: "異なる変更の扱いを選んでください",
    local: "この端末の変更を優先",
    remote: "サーバーの変更を優先",
    pull: "サーバーのコピーを使用",
    backup: "選択前にバックアップ",
    signin: "同期するにはログイン",
    paused: "同期は停止中",
    error: "未同期です。端末のデータは残っています。",
    first:
      "初回接続、またはサーバーがリセットされました。残す版を選んでください。",
    deleteConfirm:
      "サーバーの同期コピーを削除しますか？端末のデータは残ります。他の端末は送信前に再比較が必要です。",
    delete: "サーバーのコピーを削除",
    accountBound:
      "各アカウントは独立しています。オフラインの変更は同期成功まで端末に保持。同期を止めてもサーバーの既存コピーは消えません。",
    conflictError:
      "サーバー側が更新されました。再比較して競合を解決してください。",
    changedError:
      "同期中に端末の内容が変わりました。再比較して最新の編集を含めてください。",
    authError:
      "アカウントやセッションが変わりました。正しいアカウントで再ログインしてください。",
    sizeError:
      "記録が大きすぎます。バックアップ後、小さいライブラリを同期してください。",
    dataError:
      "記録を安全に読めません。バックアップし、アプリの版を確認してください。",
    storageError:
      "ブラウザーの保存領域が満杯か使用不可です。バックアップ後、容量や権限を確認してください。",
    connectionError:
      "安全に接続できませんでした。通信を確認して再試行してください。保存済みデータは端末に残ります。",
  },
  ko: {
    title: "다른 기기에서 계속 학습",
    detail:
      "텍스트, 노트, 카드, 퀴즈, 복습 일정, 기술 스냅샷과 설정을Lumio 계정에 동기화합니다. 원본PDF·이미지·음성·영상·사용자 알람은 기기에 유지됩니다. 서버 사본은 마지막 기록7일 후 만료되며 무료 호스팅 초기화 시 더 빨리 사라질 수 있습니다.",
    consent: "학습 스냅샷을Lumio 서버에 저장",
    sync: "지금 동기화",
    offline: "오프라인 · 기기에서 대기 중",
    ready: "전송한 데이터 없음",
    done: "동기화 완료",
    busy: "변경 비교 중…",
    conflict: "서로 다른 변경 처리 방법 선택",
    local: "이 기기의 변경 우선",
    remote: "서버 변경 우선",
    pull: "서버 사본 사용",
    backup: "선택 전 백업 저장",
    signin: "로그인 후 동기화",
    paused: "동기화 꺼짐",
    error: "동기화되지 않았습니다. 기기 데이터는 유지됩니다.",
    first: "첫 연결이거나 서버가 초기화되었습니다. 유지할 사본을 선택하세요.",
    deleteConfirm:
      "서버 동기화 사본을 삭제할까요? 이 기기 데이터는 유지됩니다. 다른 기기는 보내기 전 다시 비교해야 합니다.",
    delete: "서버 사본 삭제",
    accountBound:
      "계정별 자료실은 분리됩니다. 오프라인 변경은 성공할 때까지 기기에 보관됩니다. 동기화를 꺼도 기존 서버 사본은 삭제되지 않습니다.",
    conflictError:
      "서버 사본이 변경되었습니다. 다시 비교하고 충돌을 해결하세요.",
    changedError:
      "동기화 중 기기 내용이 바뀌었습니다. 최신 수정을 포함하도록 다시 비교하세요.",
    authError:
      "계정이나 세션이 변경되었습니다. 올바른 계정으로 로그인 후 다시 시도하세요.",
    sizeError:
      "스냅샷이 너무 큽니다. 백업을 내보내고 더 작은 자료실을 동기화하세요.",
    dataError:
      "스냅샷을 안전하게 읽을 수 없습니다. 백업하고 앱 버전을 확인하세요.",
    storageError:
      "브라우저 저장소가 가득 찼거나 차단되었습니다. 백업 후 공간이나 권한을 조정하세요.",
    connectionError:
      "서버에 안전하게 연결하지 못했습니다. 연결을 확인하고 다시 시도하세요. 저장한 내용은 기기에 남습니다.",
  },
};
/** Do not expose arbitrary exception text, server internals or unknown payloads in product UI. */
export function friendlySyncError(code: string, locale: Locale) {
  const c = syncCopy[locale];
  if (code === "SYNC_LOCAL_ATTACHMENTS_CONFLICT")
    return {
      vi: "Bản máy chủ thay đổi hoặc xóa học liệu có tệp gốc trên thiết bị này. Hãy xuất bản sao, giữ tệp gốc và xử lý học liệu đó trước khi đồng bộ lại.",
      en: "The server copy changes or deletes material with a device-only attachment. Export a backup, keep the original file, and resolve that material before syncing again.",
      "zh-CN":
        "服务器副本更改或删除了含本机原始附件的教材。请先导出备份、保留原文件并处理该教材，再同步。",
      ja: "サーバーの変更で、この端末だけにある添付教材が変更・削除されます。バックアップと元ファイルを保管し、該当教材を確認してから再同期してください。",
      ko: "서버 사본이 이 기기에만 원본 첨부가 있는 자료를 변경하거나 삭제합니다. 백업과 원본 파일을 보관하고 해당 자료를 확인한 뒤 다시 동기화하세요.",
    }[locale];
  if (code === "SYNC_LOCAL_SAVE_FAILED")
    return {
      vi: "Chưa lưu đủ bản đồng bộ trên thiết bị. Hãy giữ bản sao; đối chiếu lại sau khi kiểm tra dung lượng và quyền lưu trữ. Hàng đợi khôi phục vẫn được giữ.",
      en: "The synced copy was not fully saved on this device. Keep a backup and compare again after checking storage space and permissions. The recovery cursor is retained.",
      "zh-CN":
        "同步副本尚未完整保存到本机。请保留备份，检查空间和存储权限后重新比较。恢复记录会保留。",
      ja: "同期データを端末に完全保存できませんでした。バックアップを保管し、容量と保存権限を確認後に再比較してください。復旧用の記録は保持されます。",
      ko: "동기화 사본을 기기에 완전히 저장하지 못했습니다. 백업을 보관하고 공간과 저장 권한을 확인한 뒤 다시 비교하세요. 복구 기록은 유지됩니다.",
    }[locale];
  if (["SYNC_CONFLICT", "IDEMPOTENCY_CONFLICT"].includes(code))
    return c.conflictError;
  if (code === "SYNC_LOCAL_CHANGED") return c.changedError;
  if (
    [
      "SESSION_REVOKED",
      "SIGN_IN_REQUIRED",
      "UNAUTHENTICATED",
      "ACCOUNT_CHANGED",
      "SYNC_ACCOUNT_CHANGED",
      "ACCOUNT_MISMATCH",
      "FORBIDDEN",
      "INVALID_ORIGIN",
    ].includes(code)
  )
    return c.authError;
  if (code === "SYNC_TOO_LARGE") return c.sizeError;
  if (["INVALID_SYNC_DATA", "INVALID_SYNC_REQUEST"].includes(code))
    return c.dataError;
  if (/QuotaExceeded|SecurityError|storage/i.test(code)) return c.storageError;
  return c.connectionError;
}
