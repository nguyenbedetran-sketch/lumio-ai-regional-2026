import type { Messages } from "./i18n";
export const extraZh: Partial<Messages> = {
  localDetail:
    "文件保存在此浏览器。登录不会自动同步；需要时在设置中主动同步文字快照。",
  authTitle: "从这里开启学习之旅。",
  authSub: "为你想理解的一切留出空间。",
  authHint: "Google/Facebook 登录需要 OAuth 应用凭据，与 AI 密钥不同。",
  authError: "登录未完成。请检查 OAuth 配置后重试。",
  sampleLabel: "示例课程",
  saveError: "无法保存。浏览器存储可能已满或被阻止，请先导出备份。",
  loadError: "无法打开本地存储。请刷新或允许浏览器存储。",
  confirmDelete: "删除此内容？",
  deleteHint: "本地文件、笔记、卡片和练习记录将被永久删除。",
  aiHint:
    "原始资料仍可使用。AI 功能需要配置提供商，仅在你主动发送后才会处理内容。",
  emptyCards: "还没有卡片。请从资料中创建卡片。",
  emptyQuiz: "还没有问题。请添加一道四选一问题。",
  quizHint: "分数根据你的回答计算，不代表 AI 能力评估。",
  fileHint:
    "每个文件最多 30 MB，支持 TXT/Markdown、PDF、图片、音频和视频，保存在本设备。",
  fileError: "不支持此文件，或文件超过 30 MB。",
  drop: "将文件拖放到此处或选择文件",
  urlHint:
    "保存链接后，打开原始资料以提取网页，并在保存内容前检查文字。YouTube 支持导入 SRT/VTT 字幕；只有你明确选择后，公开的视频链接才会发送给 AI。",
  invalidUrl: "请输入有效的 http 或 https 链接。",
  missingFile: "备份不包含附件，请重新添加原始文件。",
  backupHint:
    "JSON 备份包含文本、笔记、卡片、测验、学习计划、复习安排、已保存的摘要、知识图谱和小尺寸 JPEG 视频截图，不含原始媒体和 PDF 文件。确认导入后将替换当前空间。",
  importConfirm: "用所选备份替换本地空间？",
  invalidBackup: "备份文件无效。",
  exportDone: "备份已下载。",
  privacyText:
    "AI 仅在你主动发送时接收资料。社交登录会联系所选提供商。请勿在共用设备上存储敏感信息。",
  guideText:
    "1. 添加资料。2. 阅读或播放。3. 写笔记。4. 创建卡片和问题。5. 复习并导出备份。",
  recordHint: "录音需要麦克风权限及 localhost 或 HTTPS，音频保存在设备上。",
  recordError: "麦克风不可用或权限被拒绝。请使用 localhost/HTTPS，或上传音频。",
  maxRecording: "录音已达限制：10 分钟或 30 MB。",
  error: "出现问题，请重试。",
  spaceEmpty: "向这个空间添加第一份学习资料。",
  spaceDeleteHint: "删除空间？其中的内容将移至未分类。",
  noAttempts: "尚无已完成练习。",
  removeFavorite: "取消收藏",
  addFavorite: "添加收藏",
  fileOnly: "支持预览。要分析资料，请在 AI 标签页配置提供商后主动发送。",
  sampleTitle: "学习如何学习",
  sampleText:
    "主动回忆\n合上资料，用自己的话解释主要观点，然后检查遗漏。\n\n间隔练习\n在不同的日子重新学习同一主题，使用简短而重复的练习。\n\n从错误中学习\n找出错误并写下更正后的解释。这是人工编写的示例，而非 AI 回答。",
  sampleFront: "什么是主动回忆？",
  sampleBack: "先从记忆中提取知识，再查看资料。",
  sampleQuestion: "哪项活动属于主动回忆？",
  sampleOptions: ["不看资料解释观点", "重读段落", "抄写每个句子", "标记标题"],
  sampleExplanation: "不看资料进行解释需要提取记忆，之后应检查并修正。",
  fileCount: "已选文件",
  createSpaceHint: "为科目、项目或目标创建独立空间。",
  authChecking: "正在检查登录配置…",
  oauthReady: "已配置 OAuth",
  oauthMissing: "需要 OAuth 凭据",
  linkedOnly: "参考链接",
  emptyNotes: "尚无笔记",
  noText: "尚无提取的文本。",
  deleteQuestion: "删除问题",
  deleteCard: "删除卡片",
  backupReplace: "替换空间",
  sourceType: "内容类型",
  coming: "需要连接服务",
  authUnavailable: "无法加载登录配置，仍可使用本地模式。",
};
export const extraJa: Partial<Messages> = {
  localDetail:
    "ファイルはこのブラウザに保存されます。ログインで自動同期されません。必要なとき設定から文章の記録を同期してください。",
  authTitle: "ここから学びを始めよう。",
  authSub: "理解したいことのための、落ち着いた空間。",
  authHint:
    "Google/Facebook ログインには OAuth アプリ情報が必要です。AI キーとは別の設定です。",
  authError: "ログインできませんでした。OAuth 設定を確認してください。",
  sampleLabel: "サンプル教材",
  saveError:
    "保存できません。容量不足または保存が禁止されています。バックアップを出力してください。",
  loadError:
    "ローカル保存を開けません。更新するか、ブラウザの保存を許可してください。",
  confirmDelete: "この内容を削除しますか？",
  deleteHint:
    "ローカルファイル、ノート、カード、練習履歴が削除されます。元に戻せません。",
  aiHint:
    "元の資料は使用できます。AI 機能にはプロバイダー設定が必要で、明示的に送信した場合のみ処理します。",
  emptyCards: "カードがありません。資料から自分で作成しましょう。",
  emptyQuiz: "問題がありません。四択問題を追加しましょう。",
  quizHint: "点数は回答から計算され、AI による習熟度評価ではありません。",
  fileHint:
    "1 ファイル 30 MB まで。TXT/Markdown、PDF、画像、音声、動画を端末に保存します。",
  fileError: "未対応のファイルか、30 MB を超えています。",
  drop: "ファイルをドロップするか選択してください",
  urlHint:
    "リンクを保存した後、元の資料を開いてウェブページを抽出し、内容を保存する前に文章を確認してください。YouTube は SRT/VTT 字幕の読込に対応しています。公開動画の URL は、明示的に選んだ場合のみ AI に送信されます。",
  invalidUrl: "有効な http または https リンクを入力してください。",
  missingFile:
    "バックアップに添付ファイルがありません。元の資料を追加してください。",
  backupHint:
    "JSON にはテキスト、ノート、カード、クイズ、学習計画、復習予定、保存済みの要約、知識マップ、小さな JPEG 動画フレーム画像が含まれます。元のメディアと PDF ファイルは含まれません。確認後、読込によって現在のスペースを置き換えます。",
  importConfirm: "選択したバックアップでローカルスペースを置き換えますか？",
  invalidBackup: "無効なバックアップです。",
  exportDone: "バックアップを保存しました。",
  privacyText:
    "AI への資料送信は明示的な操作時のみです。ソーシャルログインは選択したサービスに接続します。共有端末に機密情報を保存しないでください。",
  guideText:
    "1. 資料を追加。2. 読む・再生する。3. ノートを書く。4. カードと問題を作成。5. 復習してバックアップ。",
  recordHint:
    "録音にはマイクの許可と localhost または HTTPS が必要です。音声は端末に保存します。",
  recordError:
    "マイクが使えないか、許可されていません。localhost/HTTPS または音声アップロードを利用してください。",
  maxRecording: "録音上限に達しました（10 分または 30 MB）。",
  error: "問題が発生しました。再試行してください。",
  spaceEmpty: "最初の教材をこのスペースに追加しましょう。",
  spaceDeleteHint: "スペースを削除しますか？内容は未分類に移動します。",
  noAttempts: "完了した練習はありません。",
  removeFavorite: "お気に入りから削除",
  addFavorite: "お気に入りに追加",
  fileOnly:
    "プレビューできます。AI タブで設定後、資料を送信すると分析できます。",
  sampleTitle: "学び方を学ぶ",
  sampleText:
    "能動的な想起\n資料を閉じ、自分の言葉で要点を説明し、後から不足を確認します。\n\n間隔を空けた練習\n複数の日に同じテーマへ戻り、短い練習を繰り返します。\n\n間違いから学ぶ\n誤りを見つけ、正しい説明を書きます。これは手作業で作ったサンプルで、AI の回答ではありません。",
  sampleFront: "能動的な想起とは？",
  sampleBack: "資料を確認する前に、記憶から知識を取り出すこと。",
  sampleQuestion: "能動的な想起の例はどれですか？",
  sampleOptions: [
    "資料を見ずに説明する",
    "段落を読み直す",
    "すべての文を書き写す",
    "見出しに線を引く",
  ],
  sampleExplanation:
    "記憶から説明するには想起が必要です。その後、資料で不足を修正します。",
  fileCount: "選択したファイル",
  createSpaceHint: "科目、プロジェクト、目標ごとにスペースを作りましょう。",
  authChecking: "ログイン設定を確認中…",
  oauthReady: "OAuth 設定済み",
  oauthMissing: "OAuth 情報が必要",
  linkedOnly: "参照リンク",
  emptyNotes: "ノートはありません",
  noText: "抽出されたテキストはありません。",
  deleteQuestion: "問題を削除",
  deleteCard: "カードを削除",
  backupReplace: "スペースを置換",
  sourceType: "資料の種類",
  coming: "サービス接続が必要",
  authUnavailable: "ログイン設定を読めません。ローカルモードは利用できます。",
};
export const extraKo: Partial<Messages> = {
  localDetail:
    "파일은 이 브라우저에 저장됩니다. 로그인만으로 자동 동기화되지 않으며 필요할 때 설정에서 텍스트 스냅샷을 동기화하세요.",
  authTitle: "여기서 배움을 시작하세요.",
  authSub: "이해하고 싶은 모든 것을 위한 공간.",
  authHint:
    "Google/Facebook 로그인에는 OAuth 앱 정보가 필요합니다. AI 키와 별도 설정입니다.",
  authError: "로그인이 완료되지 않았습니다. OAuth 설정을 확인하세요.",
  sampleLabel: "예제 수업",
  saveError:
    "저장하지 못했습니다. 저장 공간이 부족하거나 차단되었을 수 있습니다. 백업을 내보내세요.",
  loadError:
    "로컬 저장소를 열지 못했습니다. 새로 고치거나 브라우저 저장을 허용하세요.",
  confirmDelete: "이 콘텐츠를 삭제할까요?",
  deleteHint:
    "로컬 파일, 노트, 카드와 퀴즈 기록이 삭제되며 되돌릴 수 없습니다.",
  aiHint:
    "원본 자료는 계속 사용할 수 있습니다. AI 제공업체 설정 후 직접 보내기를 선택해야 처리됩니다.",
  emptyCards: "카드가 없습니다. 자료에서 직접 만들어보세요.",
  emptyQuiz: "문제가 없습니다. 네 가지 선택지가 있는 문제를 추가하세요.",
  quizHint: "점수는 답변으로 계산되며 AI의 숙련도 평가가 아닙니다.",
  fileHint:
    "파일당 최대 30 MB. TXT/Markdown, PDF, 이미지, 오디오와 비디오는 기기에 저장됩니다.",
  fileError: "지원하지 않는 파일이거나 30 MB보다 큽니다.",
  drop: "파일을 끌어놓거나 선택하세요",
  urlHint:
    "링크를 저장한 뒤 원본 자료를 열어 웹사이트 내용을 추출하고, 저장하기 전에 문장을 확인하세요. YouTube는 SRT/VTT 자막 가져오기를 지원하며, 공개 영상 URL은 직접 선택한 경우에만 AI로 전송됩니다.",
  invalidUrl: "올바른 http 또는 https 링크를 입력하세요.",
  missingFile: "백업에 첨부 파일이 없습니다. 원본을 다시 추가하세요.",
  backupHint:
    "JSON 백업에는 텍스트, 노트, 카드, 퀴즈, 학습 계획, 복습 일정, 저장된 요약, 지식 지도와 작은 JPEG 영상 프레임이 포함됩니다. 원본 미디어와 PDF 파일은 제외됩니다. 확인 후 가져오기를 실행하면 현재 공간을 교체합니다.",
  importConfirm: "선택한 백업으로 로컬 공간을 교체할까요?",
  invalidBackup: "잘못된 백업 파일입니다.",
  exportDone: "백업을 다운로드했습니다.",
  privacyText:
    "직접 보내기를 선택할 때만 자료가 AI로 전송됩니다. 소셜 로그인은 선택한 업체에 연결합니다. 공용 기기에 민감한 정보를 저장하지 마세요.",
  guideText:
    "1. 자료 추가. 2. 읽거나 재생. 3. 노트 작성. 4. 카드와 문제 만들기. 5. 복습하고 백업.",
  recordHint:
    "녹음에는 마이크 권한과 localhost 또는 HTTPS가 필요합니다. 오디오는 기기에 저장됩니다.",
  recordError:
    "마이크를 쓸 수 없거나 권한이 거부되었습니다. localhost/HTTPS를 사용하거나 오디오를 업로드하세요.",
  maxRecording: "녹음 한도에 도달했습니다(10분 또는 30 MB).",
  error: "문제가 발생했습니다. 다시 시도하세요.",
  spaceEmpty: "첫 학습 자료를 이 공간에 추가하세요.",
  spaceDeleteHint: "공간을 삭제할까요? 콘텐츠는 미분류로 이동합니다.",
  noAttempts: "완료한 퀴즈가 없습니다.",
  removeFavorite: "즐겨찾기 해제",
  addFavorite: "즐겨찾기 추가",
  fileOnly:
    "미리보기를 지원합니다. AI 탭에서 설정한 후 직접 보내면 분석할 수 있습니다.",
  sampleTitle: "학습하는 방법 배우기",
  sampleText:
    "능동적 회상\n자료를 닫고 핵심을 자신의 말로 설명한 뒤 빠진 부분을 확인합니다.\n\n간격을 둔 연습\n여러 날에 걸쳐 같은 주제를 다시 보며 짧은 연습을 반복합니다.\n\n실수에서 배우기\n잘못된 점을 찾고 올바른 설명을 적습니다. 직접 작성한 예제이며 AI 답변이 아닙니다.",
  sampleFront: "능동적 회상이란 무엇인가요?",
  sampleBack: "자료를 확인하기 전에 기억에서 내용을 떠올리는 것입니다.",
  sampleQuestion: "능동적 회상에 해당하는 활동은?",
  sampleOptions: [
    "자료를 보지 않고 설명하기",
    "문단 다시 읽기",
    "모든 문장 베끼기",
    "제목 강조하기",
  ],
  sampleExplanation:
    "기억에서 설명하려면 회상이 필요합니다. 이후 자료로 부족한 부분을 확인하세요.",
  fileCount: "선택한 파일",
  createSpaceHint: "과목, 프로젝트 또는 목표별 공간을 만드세요.",
  authChecking: "로그인 설정 확인 중…",
  oauthReady: "OAuth 설정됨",
  oauthMissing: "OAuth 정보 필요",
  linkedOnly: "참고 링크",
  emptyNotes: "노트가 없습니다",
  noText: "추출한 텍스트가 없습니다.",
  deleteQuestion: "문제 삭제",
  deleteCard: "카드 삭제",
  backupReplace: "공간 교체",
  sourceType: "자료 유형",
  coming: "서비스 연결 필요",
  authUnavailable:
    "로그인 설정을 불러오지 못했습니다. 로컬 모드는 사용할 수 있습니다.",
};
