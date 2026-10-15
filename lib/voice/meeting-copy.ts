import type { Locale } from "../lumio/i18n";
const en = {
  eyebrow: "LUMIO · MEETING NOTES",
  title: "Bring the lesson with you.",
  subtitle:
    "Record the audio you choose from Zoom, Teams, Meet or a browser lesson, then turn it into notes.",
  guide:
    "In Chrome or Edge on Windows, choose a browser tab or screen and enable Share audio. Audio support varies by browser and source. A window may provide no sound.",
  desktopGuide:
    "In the Lumio desktop app on Windows, confirm system audio in the permission dialog. This records all sound playing through the computer. The microphone has a separate optional permission.",
  scope:
    "Screen / system audio can include every app playing sound, not only Zoom. Close unrelated audio and tell participants before recording.",
  privacy:
    "Only audio is recorded. The temporary screen stream stays on this device and ends when capture stops. Nothing is uploaded until you explicitly choose transcription.",
  includeMic: "Include my microphone",
  micHint:
    "Off by default. Enabling this also asks for microphone permission. Headphones help avoid echo.",
  start: "Choose audio source",
  selecting: "Choose a source in the permission window",
  permissionHint:
    "Select the source and enable audio sharing. You can cancel here while permission is pending.",
  recording: "Recording selected audio",
  paused: "Recording paused · sharing is still active",
  finishing: "Finishing the recording…",
  pause: "Pause",
  resume: "Resume",
  stop: "Finish recording",
  cancel: "Cancel capture",
  source: "Source",
  tab: "Browser tab",
  window: "Window",
  screen: "Screen / system audio",
  unknown: "Selected source",
  withMic: "Microphone included",
  withoutMic: "Microphone off",
  limit:
    "Up to 10 minutes / 8 MB per recording. A paused capture ends after 30 minutes. You can listen and download locally without signing in.",
  preview: "Your local recording",
  download: "Download audio",
  use: "Use for transcription",
  using: "Preparing…",
  remove: "Remove recording",
  useHint:
    "This puts the recording into Lumio Voice. Review it, then press Transcribe to upload through your account and credit balance.",
  transferFailed:
    "The recording could not be opened. You can still download it and choose the audio file in Lumio Voice.",
  unsupported:
    "Capture requires HTTPS or localhost, Chrome / Edge on a supported desktop, and audio recording support. Upload an audio file in Lumio Voice instead.",
  denied:
    "Sharing was cancelled or denied. No recording started. Click Choose audio source to try again.",
  unavailable:
    "The source is unavailable. Close the picker and choose another tab or screen with audio sharing enabled.",
  noAudio:
    "This source provided no audio. Sharing has stopped. Try a browser tab, or share the full screen with Share system audio enabled on Windows.",
  microphone:
    "Microphone access failed. Sharing has stopped. Check microphone permissions, or turn off Include my microphone and try again.",
  failed:
    "Recording could not continue. All capture tracks have stopped. Choose the source again to retry.",
  empty:
    "No audio data was recorded. Sharing has stopped. Check the source is playing audio and try again.",
  size: "This take exceeded 8 MB and was discarded. Sharing has stopped. Record a shorter section.",
  duration:
    "The 10-minute limit was reached. Capture stopped and the audio is ready below.",
  session:
    "The 30-minute sharing limit was reached. Capture stopped; recorded audio is ready below.",
  ended: "Source sharing ended. Captured audio is ready below.",
};
type MeetingCopy = { [K in keyof typeof en]: string };
export const meetingCopy: Record<Locale, MeetingCopy> = {
  en,
  vi: {
    eyebrow: "LUMIO · GHI CHÚ BUỔI HỌC",
    title: "Giữ lại điều bạn vừa học.",
    subtitle:
      "Ghi âm nguồn bạn chọn từ Zoom, Teams, Meet hoặc bài giảng trên trình duyệt, rồi chuyển thành ghi chú.",
    guide:
      "Trên Windows với Chrome hoặc Edge, chọn tab trình duyệt hoặc màn hình và bật Chia sẻ âm thanh. Khả năng thu âm tùy trình duyệt và nguồn; chọn cửa sổ có thể không có tiếng.",
    desktopGuide:
      "Trong app Lumio trên Windows, xác nhận thu âm thanh hệ thống ở hộp thoại cấp quyền. Thu mọi âm thanh máy tính đang phát. Micro có tùy chọn và quyền riêng.",
    scope:
      "Âm thanh màn hình / hệ thống có thể gồm mọi ứng dụng đang phát tiếng, không chỉ Zoom. Tắt âm thanh không liên quan và thông báo với người tham gia trước khi ghi.",
    privacy:
      "Chỉ ghi âm thanh. Luồng màn hình tạm thời ở trên thiết bị này và kết thúc khi dừng thu. Chưa gửi dữ liệu lên mạng cho đến khi bạn chủ động chọn chép lời.",
    includeMic: "Thu cả micro của tôi",
    micHint:
      "Mặc định tắt. Bật tùy chọn này sẽ hỏi thêm quyền micro. Dùng tai nghe để hạn chế tiếng vọng.",
    start: "Chọn nguồn âm thanh",
    selecting: "Chọn nguồn trong cửa sổ cấp quyền",
    permissionHint:
      "Chọn nguồn và bật chia sẻ âm thanh. Có thể hủy ở đây khi đang chờ cấp quyền.",
    recording: "Đang ghi nguồn âm thanh đã chọn",
    paused: "Tạm dừng ghi · vẫn đang chia sẻ nguồn",
    finishing: "Đang hoàn tất bản ghi…",
    pause: "Tạm dừng",
    resume: "Ghi tiếp",
    stop: "Hoàn tất bản ghi",
    cancel: "Hủy thu âm",
    source: "Nguồn",
    tab: "Tab trình duyệt",
    window: "Cửa sổ",
    screen: "Màn hình / âm thanh hệ thống",
    unknown: "Nguồn đã chọn",
    withMic: "Có thu micro",
    withoutMic: "Micro tắt",
    limit:
      "Tối đa 10 phút / 8 MB mỗi bản ghi. Phiên chia sẻ tạm dừng sẽ kết thúc sau 30 phút. Có thể nghe và tải về trên máy khi chưa đăng nhập.",
    preview: "Bản ghi trên máy của bạn",
    download: "Tải âm thanh",
    use: "Dùng để chép lời",
    using: "Đang chuẩn bị…",
    remove: "Xóa bản ghi",
    useHint:
      "Đưa bản ghi vào Lumio Voice. Nghe kiểm tra, rồi bấm Chép lời để gửi bằng tài khoản và số credit của bạn.",
    transferFailed:
      "Chưa mở được bản ghi. Bạn vẫn có thể tải về rồi chọn tệp âm thanh trong Lumio Voice.",
    unsupported:
      "Cần HTTPS hoặc localhost, Chrome / Edge trên máy tính hỗ trợ thu âm. Bạn có thể chọn tệp âm thanh trong Lumio Voice.",
    denied:
      "Bạn đã hủy hoặc chưa cho phép chia sẻ. Chưa bắt đầu ghi. Bấm Chọn nguồn âm thanh để thử lại.",
    unavailable:
      "Nguồn chưa khả dụng. Chọn tab hoặc màn hình khác và bật chia sẻ âm thanh.",
    noAudio:
      "Nguồn này không có luồng âm thanh. Đã dừng chia sẻ. Thử chọn tab trình duyệt, hoặc toàn màn hình và bật Chia sẻ âm thanh hệ thống trên Windows.",
    microphone:
      "Chưa thu được micro. Đã dừng chia sẻ. Kiểm tra quyền micro, hoặc tắt Thu cả micro của tôi rồi thử lại.",
    failed:
      "Không thể tiếp tục ghi. Đã dừng toàn bộ nguồn thu. Chọn lại nguồn để thử lại.",
    empty:
      "Chưa ghi được dữ liệu âm thanh. Đã dừng chia sẻ. Kiểm tra nguồn đang phát tiếng rồi thử lại.",
    size: "Bản ghi vượt 8 MB nên đã bỏ bản ghi này và dừng chia sẻ. Hãy ghi một đoạn ngắn hơn.",
    duration: "Đã đạt giới hạn 10 phút và dừng thu. Âm thanh có ở bên dưới.",
    session:
      "Đã đạt giới hạn chia sẻ 30 phút và dừng thu. Âm thanh đã ghi có ở bên dưới.",
    ended: "Đã kết thúc chia sẻ nguồn. Âm thanh đã ghi có ở bên dưới.",
  },
  "zh-CN": {
    eyebrow: "LUMIO · 课堂笔记",
    title: "留住刚学到的内容。",
    subtitle: "录制你选择的 Zoom、Teams、Meet 或浏览器课程音频，再整理成笔记。",
    guide:
      "在 Windows 上使用 Chrome 或 Edge，选择浏览器标签页或屏幕并启用共享音频。支持情况取决于浏览器和来源，窗口可能没有音频。",
    desktopGuide:
      "在 Windows 的 Lumio 桌面应用中，请在权限对话框中确认系统音频。这会录制电脑正在播放的所有声音。麦克风为单独的可选权限。",
    scope:
      "屏幕／系统音频可能包含所有正在发声的应用，不仅是 Zoom。请关闭无关音频，并在录制前告知参与者。",
    privacy:
      "仅录制音频。临时屏幕流仅保留在本设备，停止录制时结束。主动选择转录之前不会上传数据。",
    includeMic: "同时录制我的麦克风",
    micHint: "默认关闭。启用后还会请求麦克风权限。使用耳机有助于减少回声。",
    start: "选择音频来源",
    selecting: "在权限窗口中选择来源",
    permissionHint: "选择来源并启用音频共享。等待权限时也可以在此取消。",
    recording: "正在录制所选音频",
    paused: "录制已暂停 · 仍在共享来源",
    finishing: "正在完成录音…",
    pause: "暂停",
    resume: "继续",
    stop: "完成录音",
    cancel: "取消录制",
    source: "来源",
    tab: "浏览器标签页",
    window: "窗口",
    screen: "屏幕／系统音频",
    unknown: "所选来源",
    withMic: "包含麦克风",
    withoutMic: "麦克风关闭",
    limit:
      "每段最多 10 分钟／8 MB。暂停的共享会在 30 分钟后结束。无需登录即可在本地试听和下载。",
    preview: "本地录音",
    download: "下载音频",
    use: "用于转录",
    using: "准备中…",
    remove: "删除录音",
    useHint: "将录音放入 Lumio Voice，试听后点击转录，通过账户和积分上传。",
    transferFailed: "无法打开录音。仍可下载并在 Lumio Voice 中选择该音频文件。",
    unsupported:
      "需要 HTTPS 或 localhost，以及支持音频录制的桌面版 Chrome／Edge。也可以在 Lumio Voice 中上传音频文件。",
    denied: "共享已取消或被拒绝，尚未开始录音。点击选择音频来源重试。",
    unavailable: "来源不可用。请选择其他标签页或屏幕并启用音频共享。",
    noAudio:
      "此来源没有音频流，共享已停止。请尝试浏览器标签页，或在 Windows 上共享整个屏幕并启用系统音频。",
    microphone:
      "麦克风访问失败，共享已停止。检查权限，或关闭麦克风选项后重试。",
    failed: "无法继续录音，所有采集来源已停止。请重新选择来源。",
    empty: "没有录到音频数据，共享已停止。请确认来源正在播放声音后重试。",
    size: "本段超过 8 MB，已丢弃并停止共享。请录制更短的片段。",
    duration: "已达到 10 分钟上限，采集已停止，录音在下方。",
    session: "已达到 30 分钟共享上限，录音在下方。",
    ended: "来源共享已结束，录音在下方。",
  },
  ja: {
    eyebrow: "LUMIO · 授業のメモ",
    title: "学んだことを持ち帰ろう。",
    subtitle:
      "Zoom、Teams、Meet、ブラウザーの授業から選んだ音声を録音し、メモにできます。",
    guide:
      "Windows の Chrome または Edge でタブや画面を選び、音声共有を有効にしてください。対応はブラウザーと共有元によって異なり、ウィンドウでは音声がない場合があります。",
    desktopGuide:
      "Windows の Lumio デスクトップアプリでは許可ダイアログでシステム音声を確認してください。コンピューターが再生するすべての音を録音します。マイクの許可は別のオプションです。",
    scope:
      "画面／システム音声には Zoom 以外のアプリの音も含まれます。不要な音を止め、参加者に録音を知らせてください。",
    privacy:
      "録音するのは音声だけです。一時的な画面ストリームはこの端末内にとどまり、録音停止時に終了します。文字起こしを選ぶまでアップロードしません。",
    includeMic: "自分のマイクも録音",
    micHint:
      "初期設定はオフです。有効にするとマイクの許可も必要です。反響を防ぐためヘッドホンをおすすめします。",
    start: "音声の共有元を選ぶ",
    selecting: "許可ウィンドウで共有元を選択",
    permissionHint:
      "共有元を選び、音声共有を有効にしてください。許可待ちでもここでキャンセルできます。",
    recording: "選択した音声を録音中",
    paused: "録音を一時停止 · 共有は継続中",
    finishing: "録音を完了しています…",
    pause: "一時停止",
    resume: "再開",
    stop: "録音を完了",
    cancel: "録音をキャンセル",
    source: "共有元",
    tab: "ブラウザーのタブ",
    window: "ウィンドウ",
    screen: "画面／システム音声",
    unknown: "選択した共有元",
    withMic: "マイクあり",
    withoutMic: "マイクオフ",
    limit:
      "1 回最大 10 分／8 MB。一時停止中の共有も 30 分で終了します。ログインせずに端末で再生・保存できます。",
    preview: "端末内の録音",
    download: "音声を保存",
    use: "文字起こしに使う",
    using: "準備中…",
    remove: "録音を削除",
    useHint:
      "録音を Lumio Voice に渡します。確認後、文字起こしボタンでアカウントとクレジットを使って送信してください。",
    transferFailed:
      "録音を開けません。保存して Lumio Voice で音声ファイルを選べます。",
    unsupported:
      "HTTPS または localhost と、録音対応のデスクトップ版 Chrome／Edge が必要です。Lumio Voice で音声ファイルを選ぶこともできます。",
    denied:
      "共有がキャンセルまたは拒否されました。録音は始まっていません。共有元を選び直してください。",
    unavailable:
      "共有元を利用できません。別のタブや画面を選び、音声共有を有効にしてください。",
    noAudio:
      "この共有元に音声がないため共有を停止しました。タブ、または Windows の画面全体とシステム音声共有を試してください。",
    microphone:
      "マイクを利用できず共有を停止しました。許可を確認するか、マイクをオフにして再試行してください。",
    failed:
      "録音を続けられずすべての共有を停止しました。共有元を選び直してください。",
    empty:
      "音声データが記録されず共有を停止しました。共有元が音を再生しているか確認してください。",
    size: "8 MB を超えたため今回の録音を破棄し共有を停止しました。短い区間を録音してください。",
    duration: "10 分の上限に達して停止しました。録音は下にあります。",
    session: "30 分の共有上限に達して停止しました。録音は下にあります。",
    ended: "共有が終了しました。録音は下にあります。",
  },
  ko: {
    eyebrow: "LUMIO · 수업 노트",
    title: "배운 내용을 간직하세요.",
    subtitle:
      "Zoom, Teams, Meet 또는 브라우저 수업에서 선택한 소리를 녹음하고 노트로 정리하세요.",
    guide:
      "Windows의 Chrome 또는 Edge에서 탭이나 화면을 선택하고 오디오 공유를 켜세요. 지원 여부는 브라우저와 소스에 따라 달라 창에서는 소리가 없을 수 있습니다.",
    desktopGuide:
      "Windows Lumio 데스크톱 앱에서는 권한 대화상자에서 시스템 오디오를 확인하세요. 컴퓨터에서 재생하는 모든 소리가 녹음됩니다. 마이크는 별도의 선택 권한입니다.",
    scope:
      "화면／시스템 오디오에는 Zoom뿐 아니라 소리를 내는 모든 앱이 포함될 수 있습니다. 불필요한 소리를 끄고 참가자에게 녹음을 알려 주세요.",
    privacy:
      "오디오만 녹음합니다. 임시 화면 스트림은 이 기기에만 머물며 녹음 중지 시 종료됩니다. 직접 전사를 선택하기 전에는 업로드하지 않습니다.",
    includeMic: "내 마이크도 녹음",
    micHint:
      "기본값은 꺼짐입니다. 켜면 마이크 권한도 요청합니다. 헤드폰을 사용하면 울림을 줄일 수 있습니다.",
    start: "오디오 소스 선택",
    selecting: "권한 창에서 소스를 선택하세요",
    permissionHint:
      "소스를 선택하고 오디오 공유를 켜세요. 권한을 기다리는 중에도 여기서 취소할 수 있습니다.",
    recording: "선택한 오디오 녹음 중",
    paused: "녹음 일시 정지 · 공유는 계속 중",
    finishing: "녹음을 마무리하는 중…",
    pause: "일시 정지",
    resume: "계속",
    stop: "녹음 완료",
    cancel: "녹음 취소",
    source: "소스",
    tab: "브라우저 탭",
    window: "창",
    screen: "화면／시스템 오디오",
    unknown: "선택한 소스",
    withMic: "마이크 포함",
    withoutMic: "마이크 꺼짐",
    limit:
      "녹음당 최대 10분／8 MB. 일시 정지된 공유도 30분 후 종료됩니다. 로그인 없이 기기에서 듣고 다운로드할 수 있습니다.",
    preview: "기기의 녹음",
    download: "오디오 다운로드",
    use: "전사에 사용",
    using: "준비 중…",
    remove: "녹음 삭제",
    useHint:
      "녹음을 Lumio Voice로 옮깁니다. 확인한 후 전사를 눌러 계정과 크레딧으로 업로드하세요.",
    transferFailed:
      "녹음을 열 수 없습니다. 다운로드한 뒤 Lumio Voice에서 오디오 파일을 선택할 수 있습니다.",
    unsupported:
      "HTTPS 또는 localhost와 녹음을 지원하는 데스크톱 Chrome／Edge가 필요합니다. Lumio Voice에서 오디오 파일을 선택할 수도 있습니다.",
    denied:
      "공유가 취소되거나 거부되어 녹음을 시작하지 않았습니다. 소스 선택을 눌러 다시 시도하세요.",
    unavailable:
      "소스를 사용할 수 없습니다. 다른 탭이나 화면을 선택하고 오디오 공유를 켜세요.",
    noAudio:
      "이 소스에는 오디오가 없어 공유를 중지했습니다. 브라우저 탭이나 Windows 전체 화면의 시스템 오디오 공유를 사용해 보세요.",
    microphone:
      "마이크 접근에 실패하여 공유를 중지했습니다. 권한을 확인하거나 마이크를 끄고 다시 시도하세요.",
    failed:
      "녹음을 계속할 수 없어 모든 캡처를 중지했습니다. 소스를 다시 선택하세요.",
    empty:
      "오디오가 녹음되지 않아 공유를 중지했습니다. 소스가 소리를 재생하는지 확인하세요.",
    size: "8 MB를 초과하여 이 녹음을 삭제하고 공유를 중지했습니다. 더 짧은 구간을 녹음하세요.",
    duration: "10분 제한에 도달하여 중지했습니다. 녹음은 아래에 있습니다.",
    session: "30분 공유 제한에 도달하여 중지했습니다. 녹음은 아래에 있습니다.",
    ended: "소스 공유가 끝났습니다. 녹음은 아래에 있습니다.",
  },
};
