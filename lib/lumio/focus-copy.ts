import type { Locale } from "./i18n";
const en = {
  streakToday: "Today counts. Keep your rhythm tomorrow.",
  streakPending: "Your next learning moment keeps the streak going.",
  streakHint:
    "Read a material for 20 seconds, save notes, learn with the assistant, or complete a quiz, review, goal or focus session. Days follow your local calendar; signing in alone does not count.",
  studied: "Learning recorded",
  inactive: "No activity recorded",
  alarmTitle: "A gentle nudge when you're done",
  alarmHint:
    "Your sound stays on this device. Start or preview to enable audio; keep Lumio open. A sleeping device or suspended browser can delay the bell.",
  chime: "Soft chime",
  bell: "Clear bell",
  forest: "Birdsong tones",
  custom: "Your audio",
  silent: "Silent",
  volume: "Volume",
  preview: "Preview sound",
  stop: "Stop sound",
  upload: "Choose audio",
  remove: "Remove audio",
  fileHint:
    "Audio up to 5 MB and 2 minutes. The first 8 seconds play at completion. Your file is stored only in this browser and is not included in JSON backups.",
  blocked: "Audio is blocked or not enabled. Press Preview sound to enable it.",
  missing: "Choose an audio file on this device, or select a built-in bell.",
  invalid: "Choose a playable audio file, up to 5 MB and 2 minutes.",
  storage:
    "Couldn't save or load your custom audio. Check browser storage or use a built-in bell.",
  loading: "Checking your audio…",
  playing: "Playing your bell",
  ready: "Bell settings saved",
  selected: "Selected audio",
};
type Copy = typeof en;
const vi: Copy = {
  streakToday: "Đã ghi nhận hôm nay. Ngày mai mình tiếp tục nhé.",
  streakPending: "Một chút học hôm nay để giữ nhịp liên tiếp.",
  streakHint:
    "Đọc tài liệu 20 giây, lưu ghi chú, học cùng trợ lý hoặc hoàn thành quiz, ôn thẻ, mục tiêu hay phiên tập trung. Chuỗi tính theo ngày trên thiết bị; chỉ đăng nhập chưa được tính.",
  studied: "Đã ghi nhận học tập",
  inactive: "Chưa có hoạt động",
  alarmTitle: "Một tiếng chuông, đến lúc nghỉ",
  alarmHint:
    "Âm thanh ở ngay trên thiết bị. Bấm bắt đầu hoặc nghe thử để bật âm thanh và giữ Lumio mở. Máy ngủ hoặc trình duyệt tạm ngưng có thể làm chuông trễ.",
  chime: "Chuông dịu",
  bell: "Chuông trong",
  forest: "Âm chim hót",
  custom: "Âm thanh riêng",
  silent: "Im lặng",
  volume: "Âm lượng",
  preview: "Nghe thử",
  stop: "Dừng âm thanh",
  upload: "Chọn âm thanh",
  remove: "Xóa âm thanh",
  fileHint:
    "Tệp âm thanh tối đa 5 MB và 2 phút. Phát 8 giây đầu khi kết thúc phiên. Tệp chỉ lưu trong trình duyệt này, không nằm trong bản sao JSON.",
  blocked: "Âm thanh bị chặn hoặc chưa được bật. Bấm Nghe thử để bật chuông.",
  missing: "Chọn tệp âm thanh trên thiết bị này hoặc dùng một chuông có sẵn.",
  invalid: "Hãy chọn tệp âm thanh phát được, tối đa 5 MB và 2 phút.",
  storage:
    "Chưa lưu hoặc đọc được âm thanh riêng. Kiểm tra bộ nhớ trình duyệt hoặc chọn chuông có sẵn.",
  loading: "Đang kiểm tra âm thanh…",
  playing: "Đang phát chuông",
  ready: "Đã lưu lựa chọn chuông",
  selected: "Âm thanh đã chọn",
};
const zh: Copy = {
  streakToday: "今天已记录，明天继续保持。",
  streakPending: "今天学一点，让连续记录延续。",
  streakHint:
    "阅读资料 20 秒、保存笔记、与助手学习，或完成测验、复习、目标、专注。按设备本地日期统计，仅登录不计入。",
  studied: "已记录学习",
  inactive: "暂无活动",
  alarmTitle: "完成时，轻轻提醒你",
  alarmHint:
    "声音保留在本设备。开始或试听以启用音频，并保持 Lumio 打开。设备休眠或浏览器暂停可能延迟铃声。",
  chime: "柔和铃声",
  bell: "清脆铃声",
  forest: "鸟鸣音调",
  custom: "自选音频",
  silent: "静音",
  volume: "音量",
  preview: "试听",
  stop: "停止播放",
  upload: "选择音频",
  remove: "删除音频",
  fileHint:
    "音频不超过 5 MB 和 2 分钟。完成时播放前 8 秒。文件仅保存在本浏览器，不包含在 JSON 备份中。",
  blocked: "音频未启用或被阻止，请点击试听。",
  missing: "请在此设备选择音频，或使用内置铃声。",
  invalid: "请选择可播放的音频，不超过 5 MB 和 2 分钟。",
  storage: "无法保存或读取音频。请检查浏览器存储，或使用内置铃声。",
  loading: "正在检查音频…",
  playing: "正在播放铃声",
  ready: "铃声设置已保存",
  selected: "所选音频",
};
const ja: Copy = {
  streakToday: "今日の学習を記録しました。明日も続けましょう。",
  streakPending: "今日も少し学んで、連続記録をつなぎましょう。",
  streakHint:
    "資料を20秒読む、ノートを保存する、アシスタントと学ぶ、またはクイズ・復習・目標・集中を完了すると記録します。端末の日付で集計し、ログインのみは数えません。",
  studied: "学習を記録済み",
  inactive: "記録なし",
  alarmTitle: "終わりをやさしく知らせる音",
  alarmHint:
    "音はこの端末に保存されます。開始または試聴で音声を有効にし、Lumioを開いておいてください。端末のスリープやブラウザの停止で通知が遅れる場合があります。",
  chime: "やさしいチャイム",
  bell: "澄んだベル",
  forest: "鳥のさえずり音",
  custom: "自分の音声",
  silent: "無音",
  volume: "音量",
  preview: "試聴",
  stop: "音を止める",
  upload: "音声を選ぶ",
  remove: "音声を削除",
  fileHint:
    "5 MB・2分以内の音声。完了時に冒頭8秒を再生します。このブラウザのみに保存され、JSONバックアップには含まれません。",
  blocked: "音声が無効またはブロックされています。試聴を押してください。",
  missing: "この端末で音声を選ぶか、内蔵ベルをご利用ください。",
  invalid: "再生可能な5 MB・2分以内の音声を選んでください。",
  storage:
    "音声を保存・読込できません。ブラウザの容量を確認するか、内蔵ベルをご利用ください。",
  loading: "音声を確認中…",
  playing: "ベルを再生中",
  ready: "ベル設定を保存しました",
  selected: "選択した音声",
};
const ko: Copy = {
  streakToday: "오늘 학습을 기록했어요. 내일도 이어가요.",
  streakPending: "오늘 조금만 학습하면 연속 기록을 이어갈 수 있어요.",
  streakHint:
    "자료 20초 읽기, 노트 저장, 도우미와 학습하거나 퀴즈·복습·목표·집중을 완료하면 기록돼요. 기기의 현지 날짜로 계산하며 로그인만으로는 계산하지 않아요.",
  studied: "학습 기록됨",
  inactive: "기록 없음",
  alarmTitle: "끝날 때 부드러운 알림",
  alarmHint:
    "소리는 이 기기에 저장돼요. 시작하거나 미리 들어 음성을 켜고 Lumio를 열어두세요. 절전이나 브라우저 일시 중단으로 알림이 늦을 수 있어요.",
  chime: "부드러운 차임",
  bell: "맑은 종소리",
  forest: "새소리 음색",
  custom: "내 오디오",
  silent: "무음",
  volume: "음량",
  preview: "미리 듣기",
  stop: "소리 중지",
  upload: "오디오 선택",
  remove: "오디오 삭제",
  fileHint:
    "5 MB, 2분 이하의 오디오. 완료 시 처음 8초가 재생돼요. 이 브라우저에만 저장되며 JSON 백업에는 포함되지 않아요.",
  blocked: "음성이 꺼져 있거나 차단됐어요. 미리 듣기를 눌러주세요.",
  missing: "이 기기에서 오디오를 선택하거나 기본 벨을 사용하세요.",
  invalid: "재생 가능한 5 MB, 2분 이하의 오디오를 선택하세요.",
  storage:
    "오디오를 저장하거나 읽지 못했어요. 브라우저 저장 공간을 확인하거나 기본 벨을 사용하세요.",
  loading: "오디오 확인 중…",
  playing: "벨 재생 중",
  ready: "벨 설정 저장됨",
  selected: "선택한 오디오",
};
export const focusCopy: Record<Locale, Copy> = { en, vi, "zh-CN": zh, ja, ko };
