import type { Locale } from "./i18n";
export const desktopCopy: Record<
  Locale,
  {
    title: string;
    detail: string;
    web: string;
    unavailable: string;
    saved: string;
    save: string;
    error: string;
  }
> = {
  vi: {
    title: "Không gian học trên laptop",
    detail:
      "Thu âm cuộc họp, tài liệu và thư viện được lưu riêng trên máy này. Đăng nhập mạng xã hội, chép lời và gia sư AI dùng qua bản web đã được cấu hình; bản desktop này chưa hỗ trợ đồng bộ tài khoản.",
    web: "Mở bản web trong trình duyệt",
    unavailable: "Dùng trên bản web",
    saved: "Đã lưu bản thu vào thư viện trên máy này.",
    save: "Lưu bản thu vào thư viện",
    error: "Chưa lưu được bản thu. Hãy tải file hoặc thử lại.",
  },
  en: {
    title: "Your laptop learning space",
    detail:
      "Meeting recordings, documents and your library stay on this computer. Social sign-in, transcription and AI tutoring use the configured web version; account sync is not supported in this desktop release.",
    web: "Open the web version in your browser",
    unavailable: "Use on the web",
    saved: "Recording saved to this computer's library.",
    save: "Save recording to library",
    error: "Could not save the recording. Download it or try again.",
  },
  ja: {
    title: "パソコンの学習スペース",
    detail:
      "会議録音、資料、ライブラリはこのパソコンに保存されます。ログイン、文字起こし、AI学習は設定済みのWeb版で利用してください。このデスクトップ版はアカウント同期に対応していません。",
    web: "ブラウザーでWeb版を開く",
    unavailable: "Web版で利用",
    saved: "録音をこのパソコンに保存しました。",
    save: "録音をライブラリに保存",
    error: "保存できませんでした。ダウンロードまたは再試行してください。",
  },
  ko: {
    title: "노트북 학습 공간",
    detail:
      "회의 녹음, 자료, 라이브러리는 이 컴퓨터에 저장됩니다. 로그인, 받아쓰기, AI 학습은 설정된 웹 버전을 사용하세요. 이 데스크톱 버전은 계정 동기화를 지원하지 않습니다.",
    web: "브라우저에서 웹 버전 열기",
    unavailable: "웹에서 사용",
    saved: "녹음을 컴퓨터에 저장했습니다.",
    save: "녹음을 라이브러리에 저장",
    error: "저장하지 못했습니다. 다운로드하거나 다시 시도하세요.",
  },
  "zh-CN": {
    title: "笔记本学习空间",
    detail:
      "会议录音、资料和学习库保存在本机。登录、转写和AI辅导需使用已配置的网页版；此桌面版本暂不支持账户同步。",
    web: "在浏览器中打开网页版",
    unavailable: "在网页使用",
    saved: "录音已保存到本机学习库。",
    save: "保存录音到学习库",
    error: "无法保存录音。请下载或重试。",
  },
};
