import type { Locale } from "../lumio/i18n";
const en = {
  title: "Summary scope",
  whole: "Entire source",
  section: "Choose a section",
  wholeHint:
    "Automatically summarize the entire source, organize all processed parts into chapters and build a knowledge map.",
  duration: "Total video duration",
  finished: "This video has ended; it is not a live stream still in progress.",
  sourceChanged:
    "The source changed while processing. The result was not saved to a different source; generate again from the current material.",
  durationHint:
    "Read from the local file or video player. If unavailable, enter the full duration (HH:MM:SS). Only completed videos, up to 12 hours; live streams are not supported.",
  unknown:
    "The full video duration is not available yet. Play the embedded video or enter its total duration; Lumio will not assume the first 10 minutes are the whole video.",
  parts: "parts",
  batchHint:
    "Video parts run in sequence. Each part uses credits checked by the server. Cancel anytime; completed parts can be resumed in this open workspace without processing them again.",
  progress: "Processed",
  incomplete: "Not yet a complete summary. Keep this workspace open to resume.",
  resume: "Continue whole summary",
  wholeVideo: "Entire video processed",
  wholeMedia: "Entire uploaded source",
  wholeText: "All supplied text",
  declared: "Duration entered by you",
  detected: "Duration read from metadata",
  truncated:
    "The imported source was truncated. Add the complete text before creating an entire-source summary.",
  fullError:
    "Unable to finish the entire source. Completed parts are retained in this open workspace; check your credits or connection and continue.",
};
export const fullSummaryCopy: Record<Locale, typeof en> = {
  en,
  vi: {
    title: "Phạm vi tóm tắt",
    whole: "Toàn bộ nội dung",
    section: "Chọn một đoạn",
    wholeHint:
      "Tự động tóm tắt toàn bộ nội dung, chia chương cho mọi phần đã xử lý và tạo bản đồ kiến thức.",
    duration: "Tổng thời lượng video",
    finished: "Đây là video đã kết thúc, không phải livestream đang phát.",
    sourceChanged:
      "Nguồn đã thay đổi trong lúc xử lý. Kết quả không được lưu vào nguồn khác; hãy tạo lại từ nội dung hiện tại.",
    durationHint:
      "Đọc từ tệp hoặc trình phát video. Nếu chưa đọc được, nhập thời lượng toàn bộ (HH:MM:SS). Hỗ trợ video đã kết thúc, tối đa 12 giờ; chưa hỗ trợ livestream đang phát.",
    unknown:
      "Chưa biết thời lượng toàn bộ video. Phát video bên dưới hoặc nhập tổng thời lượng; Lumio không coi 10 phút đầu là cả video.",
    parts: "phần",
    batchHint:
      "Video được xử lý lần lượt. Mỗi phần được máy chủ kiểm tra credit. Có thể dừng bất cứ lúc nào; các phần xong được giữ trong trang đang mở để tiếp tục, không xử lý lại.",
    progress: "Đã xử lý",
    incomplete: "Chưa phải bản tóm tắt toàn bộ. Giữ trang này mở để tiếp tục.",
    resume: "Tiếp tục tóm tắt toàn bộ",
    wholeVideo: "Đã xử lý toàn bộ video",
    wholeMedia: "Toàn bộ tệp đã tải lên",
    wholeText: "Toàn bộ văn bản đã cung cấp",
    declared: "Thời lượng do bạn nhập",
    detected: "Thời lượng đọc từ metadata",
    truncated:
      "Nội dung nhập vào đã bị cắt bớt. Hãy bổ sung toàn bộ văn bản trước khi tóm tắt toàn bộ.",
    fullError:
      "Chưa xử lý xong toàn bộ. Các phần đã xong được giữ trong trang này; kiểm tra credit hoặc kết nối rồi tiếp tục.",
  },
  "zh-CN": {
    ...en,
    title: "总结范围",
    whole: "全部内容",
    section: "选择片段",
    wholeHint: "自动总结全部内容，为所有已处理部分生成章节和知识图谱。",
    duration: "视频总时长",
    finished: "此视频已结束，并非正在进行的直播。",
    sourceChanged:
      "处理过程中来源发生变化，结果未保存到其他来源。请从当前资料重新生成。",
    durationHint:
      "从文件或播放器读取；无法读取时请输入总时长（HH:MM:SS）。支持已结束的视频，最长12小时，不支持正在直播的内容。",
    unknown:
      "尚未获取完整时长。请播放下面的视频或输入总时长，不会把前10分钟当作完整视频。",
    parts: "部分",
    batchHint:
      "各部分依次处理，服务器逐次检查积分。可随时取消，保留此页面即可继续已完成的部分。",
    progress: "已处理",
    incomplete: "尚未完成全部总结。请保留此页面以继续。",
    resume: "继续总结全部",
    wholeVideo: "已处理完整视频",
    wholeMedia: "完整上传文件",
    wholeText: "全部提供的文字",
    declared: "您输入的时长",
    detected: "从元数据读取的时长",
    truncated: "输入来源已被截断，请先补充完整文字。",
    fullError:
      "尚未处理完全部内容。已完成部分保留在此页面，请检查积分或网络后继续。",
  },
  ja: {
    ...en,
    title: "要約の範囲",
    whole: "全体",
    section: "区間を選択",
    wholeHint:
      "全体を自動要約し、処理済みの全区間の章と知識マップを作成します。",
    duration: "動画の総時間",
    finished: "終了済みの動画であり、配信中のライブではありません。",
    sourceChanged:
      "処理中に出典が変更されたため、別の出典に結果を保存しませんでした。現在の資料から再生成してください。",
    durationHint:
      "ファイルまたはプレーヤーから取得します。取得できない場合は総時間を入力してください（HH:MM:SS）。終了済みの動画、最大12時間。ライブ配信中は未対応です。",
    unknown:
      "総時間を取得できません。下の動画を再生するか総時間を入力してください。最初の10分を全体とは扱いません。",
    parts: "区間",
    batchHint:
      "区間を順番に処理し、その都度サーバーでクレジットを確認します。キャンセル後も、このページを開いたままで再開できます。",
    progress: "処理済み",
    incomplete:
      "全体の要約は未完成です。再開するにはこのページを保持してください。",
    resume: "全体の要約を再開",
    wholeVideo: "動画全体を処理済み",
    wholeMedia: "アップロード全体",
    wholeText: "提供された全文",
    declared: "入力した時間",
    detected: "メタデータの時間",
    truncated: "読み込んだ内容が切り詰められています。全文を追加してください。",
    fullError:
      "全体の処理は未完了です。このページに完了済みの区間を保持しています。クレジットと接続を確認して再開してください。",
  },
  ko: {
    ...en,
    title: "요약 범위",
    whole: "전체 내용",
    section: "구간 선택",
    wholeHint:
      "전체 내용을 자동 요약하고 처리한 모든 구간의 챕터와 지식 지도를 만듭니다.",
    duration: "영상 전체 길이",
    finished: "이 영상은 종료되었으며 진행 중인 실시간 방송이 아닙니다.",
    sourceChanged:
      "처리 중 자료가 변경되어 다른 자료에 결과를 저장하지 않았습니다. 현재 자료로 다시 생성하세요.",
    durationHint:
      "파일 또는 플레이어에서 읽습니다. 읽을 수 없으면 전체 길이를 입력하세요(HH:MM:SS). 종료된 영상만 최대12시간 지원하며 진행 중인 실시간 방송은 지원하지 않습니다.",
    unknown:
      "전체 길이를 알 수 없습니다. 아래 영상을 재생하거나 전체 길이를 입력하세요. 처음10분을 전체 영상으로 취급하지 않습니다.",
    parts: "구간",
    batchHint:
      "각 구간을 순서대로 처리하고 서버에서 크레딧을 확인합니다. 언제든 취소할 수 있으며 이 페이지를 열어 두면 완료 구간을 다시 처리하지 않고 이어갑니다.",
    progress: "처리 완료",
    incomplete:
      "전체 요약은 아직 완료되지 않았습니다. 이어가려면 이 페이지를 유지하세요.",
    resume: "전체 요약 계속",
    wholeVideo: "전체 영상 처리 완료",
    wholeMedia: "업로드 파일 전체",
    wholeText: "제공한 전체 텍스트",
    declared: "입력한 길이",
    detected: "메타데이터에서 읽은 길이",
    truncated: "가져온 자료가 잘렸습니다. 전체 텍스트를 먼저 추가하세요.",
    fullError:
      "전체 처리가 끝나지 않았습니다. 이 페이지에 완료 구간을 유지했습니다. 크레딧과 연결을 확인한 후 계속하세요.",
  },
};
