import type { Locale } from "./i18n";

const en = {
  eyebrow: "A little more room to learn",
  title: "Your desk. Your phone. Your next idea.",
  description:
    "Keep a clear path from your materials to your next study session.",
  whatsNew: "A closer look",
  mobile: "Use Lumio on your phone",
  mobileHint:
    "Start in your browser. An Android download appears here when a build is available.",
  guide: "Open the mobile guide",
  install: "Install web app",
  installing: "Opening browser prompt…",
  installed: "Running as a web app",
  installHint: "The browser decides whether this website can be installed.",
  installError:
    "The browser could not open installation. You can use the instructions below.",
  browser: "Web browser",
  ready: "Available now",
  android: "Android app",
  androidPending: "No download published yet",
  download: "Download Android APK",
  version: "Version",
  ios: "iPhone / iPad",
  iosHint: "Use Safari; no App Store release is listed here.",
  pairing: "Connect the mobile app",
  localData:
    "Each browser has its own library. Signing in or adding a shortcut does not sync learning files.",
  publicDemo:
    "This public demo opens the interface and local study tools. Online AI and account sign-in are disabled.",
  close: "Close",
  chooseDevice: "Choose your device",
  androidGuide: [
    "Open this website in Chrome on your phone.",
    "Open the browser menu. Choose “Add to Home screen” or “Install app” if offered.",
    "If the option is missing, keep using Lumio in the browser.",
  ],
  iosGuide: [
    "Open this website in Safari on your iPhone or iPad.",
    "Open the Share menu and choose “Add to Home Screen”.",
    "Confirm the name, then tap Add. Options depend on your iOS version.",
  ],
  address: "Website address",
  copy: "Copy link",
  copied: "Link copied",
  copyError: "Copy was unavailable. Select and copy the address below.",
  localAddress:
    "This is a computer-local address. On your phone, use a deployed URL or the network address supplied by your server.",
  features: [
    {
      title: "A calmer Studio",
      text: "Choose a summary, flashcards or a quiz from the same material.",
    },
    {
      title: "Plans you can act on",
      text: "Set a small goal, return to its source and mark your actual progress.",
    },
    {
      title: "Movement with purpose",
      text: "Clear transitions and keyboard focus, with reduced-motion support.",
    },
  ],
  filteredTitle: "Nothing in this view yet",
  filteredHint:
    "Your other goals are still in the planner. Try another filter or create a goal.",
  resetFilter: "Show all goals",
  goalProgress: "Today's goal progress",
};

export const experienceCopy: Record<Locale, typeof en> = {
  en,
  vi: {
    eyebrow: "Thêm một chút không gian để học",
    title: "Từ bàn học đến điện thoại.",
    description:
      "Tài liệu, mục tiêu và buổi học tiếp theo luôn có một chỗ rõ ràng.",
    whatsNew: "Khám phá trải nghiệm mới",
    mobile: "Dùng Lumio trên điện thoại",
    mobileHint:
      "Bắt đầu bằng trình duyệt. Liên kết tải Android chỉ xuất hiện khi có bản cài sẵn sàng.",
    guide: "Xem cách mở trên điện thoại",
    install: "Cài ứng dụng web",
    installing: "Đang mở yêu cầu cài đặt…",
    installed: "Đang mở như ứng dụng web",
    installHint: "Khả năng cài đặt phụ thuộc trình duyệt và cấu hình website.",
    installError:
      "Chưa mở được yêu cầu cài đặt. Bạn có thể làm theo hướng dẫn bên dưới.",
    browser: "Trình duyệt web",
    ready: "Dùng được ngay",
    android: "Ứng dụng Android",
    androidPending: "Chưa có bản tải xuống",
    download: "Tải APK Android",
    version: "Phiên bản",
    ios: "iPhone / iPad",
    iosHint: "Mở bằng Safari; chưa có bản App Store tại đây.",
    pairing: "Kết nối ứng dụng điện thoại",
    localData:
      "Mỗi trình duyệt có thư viện riêng. Đăng nhập hay thêm lối tắt chưa đồng bộ tệp học của bạn.",
    publicDemo:
      "Bản demo công khai mở giao diện và công cụ học cục bộ. AI trực tuyến và đăng nhập tài khoản đang tắt.",
    close: "Đóng",
    chooseDevice: "Chọn thiết bị",
    androidGuide: [
      "Mở website này bằng Chrome trên điện thoại.",
      "Mở menu trình duyệt. Chọn “Thêm vào màn hình chính” hoặc “Cài ứng dụng” nếu có.",
      "Nếu chưa có lựa chọn này, bạn vẫn dùng Lumio trong trình duyệt.",
    ],
    iosGuide: [
      "Mở website này bằng Safari trên iPhone hoặc iPad.",
      "Mở menu Chia sẻ và chọn “Thêm vào Màn hình chính”.",
      "Xác nhận tên rồi chọn Thêm. Tùy chọn có thể khác theo phiên bản iOS.",
    ],
    address: "Địa chỉ website",
    copy: "Sao chép liên kết",
    copied: "Đã sao chép",
    copyError:
      "Chưa sao chép được. Bạn có thể chọn và sao chép địa chỉ bên dưới.",
    localAddress:
      "Đây là địa chỉ chỉ dùng trên máy tính này. Trên điện thoại, hãy dùng URL đã triển khai hoặc địa chỉ mạng do máy chủ cung cấp.",
    features: [
      {
        title: "Studio dễ bắt đầu",
        text: "Chọn tóm tắt, thẻ ghi nhớ hoặc quiz ngay từ một học liệu.",
      },
      {
        title: "Kế hoạch vừa sức",
        text: "Đặt mục tiêu nhỏ, mở lại tài liệu và ghi nhận việc đã hoàn thành.",
      },
      {
        title: "Chuyển động có mục đích",
        text: "Chuyển trang nhẹ, điều hướng bằng bàn phím và hỗ trợ giảm chuyển động.",
      },
    ],
    filteredTitle: "Chưa có mục tiêu trong bộ lọc này",
    filteredHint:
      "Các mục tiêu khác vẫn ở trong kế hoạch. Hãy đổi bộ lọc hoặc tạo mục tiêu mới.",
    resetFilter: "Xem tất cả mục tiêu",
    goalProgress: "Tiến độ mục tiêu hôm nay",
  },
  "zh-CN": {
    eyebrow: "为学习留一点空间",
    title: "从书桌到手机。",
    description: "让资料、目标和下一次学习都有清晰的位置。",
    whatsNew: "探索新的体验",
    mobile: "在手机上使用 Lumio",
    mobileHint: "先在浏览器中使用。有可用安装包时才会显示 Android 下载链接。",
    guide: "查看手机使用指南",
    install: "安装网页应用",
    installing: "正在打开安装提示…",
    installed: "正在以网页应用运行",
    installHint: "是否可以安装取决于浏览器和网站配置。",
    installError: "无法打开安装提示。请参考以下说明。",
    browser: "网页浏览器",
    ready: "现在可用",
    android: "Android 应用",
    androidPending: "暂未发布下载",
    download: "下载 Android APK",
    version: "版本",
    ios: "iPhone / iPad",
    iosHint: "请使用 Safari；这里暂未提供 App Store 版本。",
    pairing: "连接手机应用",
    localData: "各浏览器的资料库独立保存。登录或添加快捷方式不会同步学习文件。",
    publicDemo: "公开演示提供界面和本地学习工具。在线 AI 和账户登录已关闭。",
    close: "关闭",
    chooseDevice: "选择设备",
    androidGuide: [
      "在手机的 Chrome 中打开本网站。",
      "打开浏览器菜单，选择“添加到主屏幕”或“安装应用”（如果提供）。",
      "若没有此选项，仍可在浏览器中使用 Lumio。",
    ],
    iosGuide: [
      "在 iPhone 或 iPad 的 Safari 中打开本网站。",
      "打开共享菜单，选择“添加到主屏幕”。",
      "确认名称并点按添加。选项可能因 iOS 版本而异。",
    ],
    address: "网站地址",
    copy: "复制链接",
    copied: "链接已复制",
    copyError: "无法复制。请手动选择并复制以下地址。",
    localAddress:
      "这是仅用于本机的地址。在手机上，请使用已部署的网址或服务器提供的局域网地址。",
    features: [
      {
        title: "更清晰的学习工作室",
        text: "从同一份资料创建摘要、记忆卡或测验。",
      },
      {
        title: "可以付诸行动的计划",
        text: "设定小目标，回看资料，记录真实进度。",
      },
      {
        title: "有目的的动效",
        text: "清晰的过渡和键盘焦点，并支持减少动态效果。",
      },
    ],
    filteredTitle: "此筛选下还没有目标",
    filteredHint: "其他目标仍在计划中。试试其他筛选或创建目标。",
    resetFilter: "显示所有目标",
    goalProgress: "今日目标进度",
  },
  ja: {
    eyebrow: "学びに、少しの余白を",
    title: "机から、スマートフォンへ。",
    description: "資料、目標、次の学習をわかりやすく整理。",
    whatsNew: "新しい使い心地",
    mobile: "スマートフォンで Lumio を使う",
    mobileHint:
      "まずはブラウザで。Android の配布準備が整った場合にのみダウンロードを表示します。",
    guide: "スマートフォンの使い方",
    install: "ウェブアプリをインストール",
    installing: "インストール画面を開いています…",
    installed: "ウェブアプリとして実行中",
    installHint: "インストールの可否はブラウザとサイト設定によります。",
    installError:
      "インストール画面を開けませんでした。下の手順をご覧ください。",
    browser: "ウェブブラウザ",
    ready: "利用できます",
    android: "Android アプリ",
    androidPending: "ダウンロードは未公開",
    download: "Android APK をダウンロード",
    version: "バージョン",
    ios: "iPhone / iPad",
    iosHint: "Safari で利用できます。App Store 版はここでは未公開です。",
    pairing: "モバイルアプリを接続",
    localData:
      "資料はブラウザごとに保存されます。ログインやショートカットの追加だけでは同期されません。",
    publicDemo:
      "公開デモでは画面とローカル学習ツールを使えます。オンライン AI とログインは無効です。",
    close: "閉じる",
    chooseDevice: "端末を選ぶ",
    androidGuide: [
      "スマートフォンの Chrome でこのサイトを開きます。",
      "ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」があれば選びます。",
      "表示されなくても、ブラウザで Lumio を使えます。",
    ],
    iosGuide: [
      "iPhone または iPad の Safari でこのサイトを開きます。",
      "共有メニューから「ホーム画面に追加」を選びます。",
      "名前を確認して追加します。項目は iOS のバージョンにより異なります。",
    ],
    address: "サイトのアドレス",
    copy: "リンクをコピー",
    copied: "コピーしました",
    copyError:
      "コピーできませんでした。下のアドレスを選択してコピーしてください。",
    localAddress:
      "このアドレスは現在のパソコン専用です。スマートフォンでは公開 URL またはサーバーのネットワークアドレスを使ってください。",
    features: [
      {
        title: "使いやすい Studio",
        text: "一つの資料から要約、暗記カード、クイズを選べます。",
      },
      {
        title: "実行しやすい計画",
        text: "小さな目標を立て、資料に戻り、実際の進捗を記録。",
      },
      {
        title: "意味のある動き",
        text: "わかりやすい画面遷移とキーボード操作。動きを減らす設定にも対応。",
      },
    ],
    filteredTitle: "この条件の目標はまだありません",
    filteredHint:
      "他の目標は残っています。条件を変えるか、目標を追加してください。",
    resetFilter: "すべての目標",
    goalProgress: "今日の目標の進捗",
  },
  ko: {
    eyebrow: "학습을 위한 작은 여유",
    title: "책상에서 휴대폰까지.",
    description: "자료, 목표, 다음 학습을 한눈에 정리하세요.",
    whatsNew: "새로운 사용 경험",
    mobile: "휴대폰에서 Lumio 사용하기",
    mobileHint:
      "브라우저로 시작하세요. 설치 파일이 준비되면 Android 다운로드가 표시됩니다.",
    guide: "모바일 사용 안내",
    install: "웹 앱 설치",
    installing: "설치 안내 여는 중…",
    installed: "웹 앱으로 실행 중",
    installHint: "설치 지원 여부는 브라우저와 웹사이트 설정에 따라 달라집니다.",
    installError: "설치 안내를 열지 못했습니다. 아래 방법을 확인하세요.",
    browser: "웹 브라우저",
    ready: "지금 사용 가능",
    android: "Android 앱",
    androidPending: "아직 다운로드 미공개",
    download: "Android APK 다운로드",
    version: "버전",
    ios: "iPhone / iPad",
    iosHint: "Safari에서 이용하세요. 여기에는 App Store 버전이 없습니다.",
    pairing: "모바일 앱 연결",
    localData:
      "브라우저마다 자료가 따로 저장됩니다. 로그인하거나 바로가기를 추가해도 학습 파일이 동기화되지는 않습니다.",
    publicDemo:
      "공개 데모는 화면과 로컬 학습 도구만 제공합니다. 온라인 AI와 계정 로그인은 꺼져 있습니다.",
    close: "닫기",
    chooseDevice: "기기 선택",
    androidGuide: [
      "휴대폰 Chrome에서 이 웹사이트를 엽니다.",
      "브라우저 메뉴에 '홈 화면에 추가' 또는 '앱 설치'가 있으면 선택합니다.",
      "해당 항목이 없어도 브라우저에서 Lumio를 사용할 수 있습니다.",
    ],
    iosGuide: [
      "iPhone 또는 iPad의 Safari에서 이 웹사이트를 엽니다.",
      "공유 메뉴에서 '홈 화면에 추가'를 선택합니다.",
      "이름을 확인하고 추가합니다. iOS 버전에 따라 항목이 다를 수 있습니다.",
    ],
    address: "웹사이트 주소",
    copy: "링크 복사",
    copied: "링크 복사됨",
    copyError: "복사하지 못했습니다. 아래 주소를 직접 선택해 복사하세요.",
    localAddress:
      "이 주소는 현재 컴퓨터에서만 사용할 수 있습니다. 휴대폰에서는 배포된 URL이나 서버의 네트워크 주소를 사용하세요.",
    features: [
      {
        title: "편안한 Studio",
        text: "같은 자료에서 요약, 암기 카드, 퀴즈를 선택하세요.",
      },
      {
        title: "실천할 수 있는 계획",
        text: "작은 목표를 정하고 자료를 다시 열어 실제 진행을 기록하세요.",
      },
      {
        title: "목적이 있는 움직임",
        text: "분명한 전환과 키보드 포커스, 동작 줄이기를 지원합니다.",
      },
    ],
    filteredTitle: "이 필터에는 목표가 없습니다",
    filteredHint:
      "다른 목표는 계획에 남아 있습니다. 필터를 바꾸거나 목표를 만드세요.",
    resetFilter: "모든 목표 보기",
    goalProgress: "오늘의 목표 진행",
  },
};
