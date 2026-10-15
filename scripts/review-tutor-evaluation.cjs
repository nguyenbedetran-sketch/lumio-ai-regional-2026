// Evidence assembly. The notes below are engineering review of the recorded
// synthetic transcripts, not a fabricated student trial or expert endorsement.
const fs = require("node:fs"),
  path = require("node:path");
const directory = path.resolve(__dirname, "../docs/regional");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const main = read("tutor-live-final.json"),
  correct = read("tutor-live-correct-prose.json"),
  method = read("tutor-live-method-review.json");
const notes = {
  linear: {
    pedagogy: "PARTIAL",
    note: "Không đưa giá trị nghiệm trước mở khóa; có lúc một đoạn gợi ý nêu cả trừ và chia, còn rộng hơn một thao tác. Lời giải cuối có đủ thế nghiệm.",
  },
  "rational-domain": {
    pedagogy: "PARTIAL",
    note: "Phát hiện x=2 làm mẫu0, giữ điều kiện và giải đúng7/2. Một số gợi ý nêu lộ trình khử mẫu rồi giải thay vì chỉ một bước nhỏ.",
  },
  "radical-extraneous": {
    pedagogy: "PASS",
    note: "Loại x=0 bằng đối chiếu hai vế và dấu; lời giải đầy đủ giữ x≥1, loại nghiệm ngoại lai, thế x=3 đúng. Bản ghi cũ có ký tự điều khiển định dạng; parser đã lọc và có kiểm tra hồi quy.",
  },
  "correct-first": {
    pedagogy: "PASS",
    note: "Xác nhận nghiệm học sinh đã thử; hướng kiểm tra thêm nghiệm còn lại. Bản chạy toàn bộ từng chặn nhầm 'nghiệm3' do chỉ nhận x=3; parser được mở rộng cho lời đáp số rõ bằng tiếng Việt rồi kiểm tra lại thành công.",
  },
  "wrong-first": {
    pedagogy: "PARTIAL",
    note: "Chỉ đúng lỗi đổi dấu và nhắc nhân toàn bộ vế; bản kiểm tra lại không còn khẳng định phải trừ trước nhân. Một vài gợi ý vẫn liệt kê hai thao tác và có lỗi diễn đạt nhỏ.",
  },
  "repeated-mistake": {
    pedagogy: "PASS",
    note: "Xử lý hai lần chọnx=2, nêu đúng lỗi bỏ qua mẫu, không đưa nghiệm-2 trong các phản hồi được chấp nhận. Một bản trước từng bị chặn/hoàn credit vì mô hình lộ nghiệm sớm; lỗi ấy được giữ trong bằng chứng.",
  },
  "demand-answer": {
    pedagogy: "PARTIAL",
    note: "Đòi đáp án không vượt khóa; gợi ý tiếp tục theo căn và bình phương, lời giải cuối kiểm tra đúngx=3. Lượt cuối trước mở có thể hướng dẫn cả trừ và chia; câu từ về khóa còn cứng.",
  },
  "early-full": {
    pedagogy: "PARTIAL",
    note: "Lời giải trực tiếp lúc đầu bị409 và không gọi dịch vụ; ba gợi ý dẫn tới nghiệm7 rồi thế hai vế15. Một vài gợi ý mô tả nhiều thao tác trong cùng đoạn.",
  },
  "missing-data": {
    pedagogy: "PARTIAL",
    note: "Không bịa chiều rộng/diện tích; ba lượt đều cần bổ sung dữ kiện, không tăng gợi ý và yêu cầu lời giải vẫn409. Còn lặp lại việc hỏi dữ kiện đã xác nhận thiếu; nên rút ngắn hội thoại khi đề không đủ.",
  },
  "source-substitution": {
    pedagogy: "PASS",
    note: "Giữ điều kiệnx≠1, giải đúngx=3, thế lại và có trích dẫn đúng đoạn nguồn được cung cấp. Không tự tạo số trang/mốc thời gian.",
  },
};
const records = main.cases.map((c) => {
  const replacement =
    c.id === "correct-first"
      ? correct.cases[0]
      : c.id === "wrong-first"
        ? method.cases[0]
        : c;
  return {
    ...replacement,
    evidenceFile:
      c.id === "correct-first"
        ? "tutor-live-correct-prose.json"
        : c.id === "wrong-first"
          ? "tutor-live-method-review.json"
          : "tutor-live-final.json",
    engineeringReview: notes[c.id],
    referenceCorrectness:
      c.id === "missing-data"
        ? "PASS: insufficient data correctly retained"
        : "PASS: checked reference roots and recorded final transformations/substitution",
  };
});
const report = {
  schema: 1,
  reviewedAt: new Date().toISOString(),
  reviewer:
    "AI-assisted engineering review; not an independent teacher assessment",
  sourceRuns: [
    "tutor-live-final.json",
    "tutor-live-correct-prose.json",
    "tutor-live-method-review.json",
  ],
  singleCleanTenCaseRun: false,
  runOutcome:
    "The ten-case final run had9 accepted paths and1 safe false-positive rejection. That case passed after a focused fix/recheck. A second focused recheck assessed method wording.",
  selectedRunsProviderRequests: [main, correct, method].reduce(
    (n, r) => n + (r.providerRequests || 0),
    0,
  ),
  technicalOutcome:
    "10 reference scenarios have a recorded accepted path across final+focused rechecks;9 numeric full solutions independently checked; underdetermined exercise stayed locked",
  pedagogyOutcome: "PARTIAL",
  studentTrial: "NOT TESTED",
  independentTeacherReview: "NOT TESTED",
  limitations: [
    "Numeric verification does not prove every narrative step.",
    "Some hints still describe more than one operation.",
    "Missing-data conversation can repeat clarification instead of concluding earlier.",
    "Leak detection is bounded; natural-language answer leakage cannot be ruled out for every exercise.",
    "Local route evaluation injects authprincipal; OAuth and public deployment require separate evidence.",
  ],
  cases: records,
};
fs.writeFileSync(
  path.join(directory, "tutor-evaluation-reviewed.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const lines = [
  "# Đối chiếu10kịch bản gia sư thật",
  "",
  report.runOutcome,
  "",
  "Đây là đánh giá kỹ thuật có AI hỗ trợ, không thay thế đánh giá của giáo viên độc lập và không phải thử nghiệm với học sinh.",
  "",
  "| Kịch bản | Quy trình/đáp án tham chiếu | Sư phạm | Nhận xét |",
  "|---|---|---|---|",
  ...records.map(
    (c) =>
      `| ${c.id} | ${c.status} | ${c.engineeringReview.pedagogy} | ${c.engineeringReview.note} |`,
  ),
  "",
  "Tổng quan: **PASS kiểm tra kỹ thuật theo các bằng chứng cuối + lần kiểm tra lại; PARTIAL về độ nhất quán sư phạm.** Không có một lần chạy10ca sạch hoàn toàn được gộp giả thành kết quả duy nhất. Các lần lỗi gốc vẫn được giữ. Xem JSON cùng tên để đọc hội thoại và đường dẫn bằng chứng của từng ca.",
  "",
  "Chưa có dữ liệu học sinh tình nguyện hoặc giáo viên độc lập để kết luận hiệu quả học tập.",
  "",
];
fs.writeFileSync(path.join(directory, "03-TUTOR-REVIEW.md"), lines.join("\n"));
console.log(
  `Assembled${records.length} reviewed scenarios from3 recorded runs; pedagogyPARTIAL.`,
);
