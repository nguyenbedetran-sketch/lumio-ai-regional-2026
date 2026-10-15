import type { Locale } from "../lumio/i18n";
type Copy = {
  title: string;
  intro: string;
  extract: string;
  busy: string;
  youtube: string;
  videoHint: string;
  learnVideo: string;
  fallback: string;
  captions: string;
  paste: string;
  source: string;
  save: string;
  saved: string;
  replace: string;
  preview: string;
  loaded: string;
  truncated: string;
  error: string;
  signIn: string;
  publicOnly: string;
  badCaption: string;
  modes: string[];
  modeHints: string[];
  mode: string;
  difficulty: string;
  levels: string[];
  goal: string;
  goalHint: string;
  guidance: string;
  hint: string;
  full: string;
  presentation: string;
  auto: string;
  math: string;
  videoAttached: string;
  videoUnavailable: string;
  characters: string;
  manual: string;
};
export const linkCopy: Record<Locale, Copy> = {
  vi: {
    title: "Biến liên kết thành bài học",
    intro:
      "Lấy phần văn bản công khai, xem lại nguồn rồi học theo cách của bạn.",
    extract: "Đọc nội dung trang",
    busy: "Đang đọc nội dung…",
    youtube: "Góc học cùng video",
    videoHint:
      "Lumio có thể phân tích video YouTube công khai khi bạn gửi yêu cầu. Video riêng tư, không công khai hoặc bị hạn chế có thể không xử lý được.",
    learnVideo: "Mở trợ lý cho video",
    fallback: "Đã có bản chép lời? Thêm vào để học chính xác hơn.",
    captions: "Nhập phụ đề .vtt / .srt",
    paste: "Dán văn bản hoặc bản chép lời tại đây…",
    source: "Văn bản nguồn",
    save: "Lưu làm nguồn học",
    saved: "Đã lưu nguồn học.",
    replace: "Thay văn bản nguồn",
    preview: "Xem lại trước khi lưu",
    loaded: "Đã lấy nội dung từ",
    truncated:
      "Trang dài: chỉ lấy 50.000 ký tự đầu. Bạn có thể chọn phần cần học.",
    error:
      "Chưa đọc được trang này. Trang có thể cần đăng nhập hoặc JavaScript. Hãy dán phần nội dung bạn có quyền sử dụng.",
    signIn: "Đăng nhập để đọc nội dung từ liên kết.",
    publicOnly: "Chỉ hỗ trợ địa chỉ trang web công khai.",
    badCaption:
      "Chưa đọc được phụ đề. Chọn tệp .vtt hoặc .srt hợp lệ, tối đa 200 KB.",
    modes: ["Nhanh", "Suy luận", "Chuyên sâu", "Gia sư"],
    modeHints: [
      "Trả lời ngắn, đi thẳng vào ý chính.",
      "Giải thích ý tưởng, giả thiết và các bước chính.",
      "Từ kiến thức nền đến ví dụ và bài luyện.",
      "Gợi ý từng bước, để bạn tự tìm ra lời giải.",
    ],
    mode: "Cách học",
    difficulty: "Trình độ",
    levels: ["Mới bắt đầu", "Trung bình", "Nâng cao"],
    goal: "Mục tiêu của bạn",
    goalHint: "Ví dụ: hiểu vòng lặp để tự làm bài tập",
    guidance: "Hướng dẫn",
    hint: "Gợi ý từng bước",
    full: "Lời giải đầy đủ",
    presentation: "Trình bày",
    auto: "Tự động",
    math: "Lời giải Toán",
    videoAttached: "Video công khai được gửi khi bạn nhấn tạo nội dung.",
    videoUnavailable:
      "Chưa phân tích được video? Hãy quay lại Nguồn để nhập phụ đề hoặc dán bản chép lời.",
    characters: "ký tự",
    manual: "Nội dung do bạn thêm",
  },
  en: {
    title: "Turn a link into a lesson",
    intro: "Extract public page text, review the source, then learn your way.",
    extract: "Read page content",
    busy: "Reading content…",
    youtube: "Your video learning corner",
    videoHint:
      "Lumio can analyze public YouTube videos when you send a request. Private, unlisted or restricted videos may not work.",
    learnVideo: "Open video tutor",
    fallback: "Have a transcript? Add it for more precise learning.",
    captions: "Import .vtt / .srt captions",
    paste: "Paste text or a transcript here…",
    source: "Source text",
    save: "Save as learning source",
    saved: "Learning source saved.",
    replace: "Replace source text",
    preview: "Review before saving",
    loaded: "Content retrieved from",
    truncated:
      "Long page: only the first 50,000 characters were extracted. Select the part you need.",
    error:
      "This page could not be read. It may need sign-in or JavaScript. Paste content you have permission to use.",
    signIn: "Sign in to read a linked page.",
    publicOnly: "Only public website addresses are supported.",
    badCaption: "Choose a valid .vtt or .srt caption file, up to 200 KB.",
    modes: ["Quick", "Think", "Deep", "Tutor"],
    modeHints: [
      "A concise answer focused on the key idea.",
      "Explain ideas, assumptions and essential steps.",
      "Build from prerequisites to examples and practice.",
      "One hint at a time so you discover the answer.",
    ],
    mode: "Learning style",
    difficulty: "Level",
    levels: ["Beginner", "Intermediate", "Advanced"],
    goal: "Your goal",
    goalHint: "For example: understand loops to solve exercises",
    guidance: "Guidance",
    hint: "Step-by-step hints",
    full: "Full solution",
    presentation: "Presentation",
    auto: "Automatic",
    math: "Math solution",
    videoAttached: "The public video is sent when you generate content.",
    videoUnavailable:
      "Unable to analyze the video? Return to Source to import captions or paste a transcript.",
    characters: "characters",
    manual: "Content you added",
  },
  "zh-CN": {
    title: "把链接变成课程",
    intro: "提取公开网页文字，检查来源，再按自己的方式学习。",
    extract: "读取网页内容",
    busy: "正在读取…",
    youtube: "视频学习空间",
    videoHint:
      "发送请求时，Lumio 可以分析公开的 YouTube 视频。私密、不公开或受限视频可能无法处理。",
    learnVideo: "打开视频导师",
    fallback: "已有字幕？添加字幕可提高学习准确性。",
    captions: "导入 .vtt / .srt 字幕",
    paste: "粘贴文字或字幕…",
    source: "来源文字",
    save: "保存为学习来源",
    saved: "来源已保存。",
    replace: "替换来源文字",
    preview: "保存前检查",
    loaded: "内容来源",
    truncated: "长网页：仅提取前 50,000 个字符，请选择需要的部分。",
    error: "无法读取网页，可能需要登录或 JavaScript。请粘贴你有权使用的内容。",
    signIn: "请登录后读取链接。",
    publicOnly: "仅支持公开网页地址。",
    badCaption: "请选择有效的 .vtt 或 .srt 文件，最大 200 KB。",
    modes: ["快速", "思考", "深入", "导师"],
    modeHints: [
      "简洁回答核心问题。",
      "解释思路、假设和关键步骤。",
      "从基础到实例和练习。",
      "逐步提示，让你自己找到答案。",
    ],
    mode: "学习方式",
    difficulty: "水平",
    levels: ["入门", "中级", "高级"],
    goal: "学习目标",
    goalHint: "例如：理解循环并独立完成练习",
    guidance: "指导",
    hint: "逐步提示",
    full: "完整解答",
    presentation: "展示方式",
    auto: "自动",
    math: "数学解题",
    videoAttached: "生成内容时将发送公开视频。",
    videoUnavailable: "无法分析视频？回到来源，导入字幕或粘贴文字。",
    characters: "字符",
    manual: "你添加的内容",
  },
  ja: {
    title: "リンクをレッスンに",
    intro: "公開ページの文章を取得し、出典を確認して学びましょう。",
    extract: "ページを読み取る",
    busy: "読み取り中…",
    youtube: "動画学習スペース",
    videoHint:
      "リクエスト時に公開 YouTube 動画を分析できます。非公開・限定公開・制限付き動画には対応できない場合があります。",
    learnVideo: "動画のチューターを開く",
    fallback: "文字起こしがあれば、追加してより正確に学べます。",
    captions: ".vtt / .srt 字幕を読み込む",
    paste: "文章や文字起こしを貼り付け…",
    source: "出典テキスト",
    save: "学習資料として保存",
    saved: "保存しました。",
    replace: "出典テキストを置き換える",
    preview: "保存前に確認",
    loaded: "取得元",
    truncated:
      "長いページの先頭50,000文字を取得しました。必要な部分を選択してください。",
    error:
      "ページを読み取れません。ログインや JavaScript が必要かもしれません。利用権のある内容を貼り付けてください。",
    signIn: "リンクの読み取りにはログインしてください。",
    publicOnly: "公開ページのURLのみ対応しています。",
    badCaption:
      "有効な .vtt または .srt ファイルを選択してください（200 KB以下）。",
    modes: ["クイック", "思考", "詳しく", "チューター"],
    modeHints: [
      "要点を簡潔に回答。",
      "考え方、前提、主な手順を説明。",
      "基礎から例題と練習まで。",
      "一つずつヒントを出し、自分で答えを発見。",
    ],
    mode: "学び方",
    difficulty: "レベル",
    levels: ["初級", "中級", "上級"],
    goal: "学習目標",
    goalHint: "例：ループを理解して問題を自力で解く",
    guidance: "ガイド",
    hint: "段階的なヒント",
    full: "完全な解答",
    presentation: "表示",
    auto: "自動",
    math: "数学の解答",
    videoAttached: "生成時に公開動画を送信します。",
    videoUnavailable:
      "動画を分析できませんか？出典に戻り、字幕や文字起こしを追加してください。",
    characters: "文字",
    manual: "追加した内容",
  },
  ko: {
    title: "링크를 수업으로",
    intro: "공개 페이지의 글을 가져와 출처를 확인하고 학습하세요.",
    extract: "페이지 내용 읽기",
    busy: "읽는 중…",
    youtube: "영상 학습 공간",
    videoHint:
      "요청을 보내면 공개 YouTube 영상을 분석합니다. 비공개, 일부 공개 또는 제한된 영상은 처리하지 못할 수 있습니다.",
    learnVideo: "영상 튜터 열기",
    fallback: "자막이 있나요? 추가하면 더 정확하게 학습할 수 있어요.",
    captions: ".vtt / .srt 자막 가져오기",
    paste: "글이나 자막을 붙여 넣으세요…",
    source: "원문",
    save: "학습 자료로 저장",
    saved: "학습 자료를 저장했어요.",
    replace: "원문 바꾸기",
    preview: "저장 전 확인",
    loaded: "가져온 출처",
    truncated:
      "긴 페이지의 첫 50,000자만 가져왔어요. 필요한 부분을 선택하세요.",
    error:
      "페이지를 읽지 못했어요. 로그인이나 JavaScript가 필요할 수 있어요. 사용 권한이 있는 내용을 붙여 넣으세요.",
    signIn: "링크를 읽으려면 로그인하세요.",
    publicOnly: "공개 웹 주소만 지원합니다.",
    badCaption: "유효한 .vtt 또는 .srt 파일을 선택하세요. 최대 200 KB입니다.",
    modes: ["빠르게", "생각하기", "깊이 있게", "튜터"],
    modeHints: [
      "핵심을 짧고 명확하게 답합니다.",
      "아이디어, 가정, 핵심 단계를 설명합니다.",
      "기초부터 예제와 연습까지 학습합니다.",
      "힌트를 하나씩 받아 스스로 답을 찾습니다.",
    ],
    mode: "학습 방식",
    difficulty: "수준",
    levels: ["초급", "중급", "고급"],
    goal: "학습 목표",
    goalHint: "예: 반복문을 이해하고 혼자 문제 풀기",
    guidance: "안내",
    hint: "단계별 힌트",
    full: "전체 풀이",
    presentation: "표현 방식",
    auto: "자동",
    math: "수학 풀이",
    videoAttached: "내용을 생성할 때 공개 영상을 전송합니다.",
    videoUnavailable:
      "영상을 분석하지 못하나요? 원문으로 돌아가 자막을 가져오거나 붙여 넣으세요.",
    characters: "자",
    manual: "직접 추가한 내용",
  },
};
