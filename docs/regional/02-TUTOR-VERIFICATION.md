# Gia sư và kiểm chứng Toán — nâng cấp vòng khu vực

Ngày kiểm tra: 15/10/2026 (Asia/Bangkok). Báo cáo này ghi rõ phạm vi kiểm tra; không phải kết quả thử nghiệm với học sinh.

## Lỗi trước khi sửa

`guidance: "full"` được nhận trực tiếp từ trình duyệt; đổi chế độ Nhanh/Suy luận/Chuyên sâu có thể nhận lời giải ngay. Lịch sử chỉ lấy từ JSON phía khách, chưa có phiên gia sư lưu trên máy chủ. Các quy tắc kiểm tra Toán mới nằm trong prompt, chưa có bộ kiểm tra độc lập.

## Thay đổi đã triển khai

- Phiên SQLite gắn tài khoản chuẩn và phiên đăng nhập hiện hành. Đề bài giữ nguyên, học liệu được ràng buộc bằng SHA-256 (văn bản, loại/nội dung media, URL và đoạn video); thay nguồn/ngôn ngữ/đề không được dùng lại lượt gợi ý cũ.
- Máy chủ dùng lịch sử đã lưu, bỏ lịch sử và trạng thái mở khóa mà khách tự gửi. Mọi chế độ chat của học sinh cùng chịu khóa. Cần ít nhất ba gợi ý thành công, đủ nội dung và không gần như trùng nguyên văn. Không có lối mở khóa sớm hoặc quyền giáo viên ngầm.
- Yêu cầu lời giải sớm trả HTTP409 `TUTOR_LOCKED` kèm trạng thái, trước khi giữ credit/gọi nhà cung cấp. Khi đã mở, câu hỏi gửi mô hình được máy chủ cố định về đúng đề gốc.
- Phản hồi có đúng trường gợi ý chính/câu hỏi; chỉ giữ câu hỏi đầu tiên nếu mô hình viết thêm câu hỏi thứ hai. Trường chẩn đoán tùy chọn rỗng/null được bỏ qua và độ dài được giới hạn. Lỗi hệ thống, phản hồi rỗng, lặp, sai schema hoặc bị phát hiện tiết lộ nghiệm không được tăng lượt.
- Nếu thiếu dữ kiện/ảnh chưa rõ, `needsClarification` lưu yêu cầu bổ sung. Lượt hỏi lại không tăng số gợi ý và chưa thể mở lời giải. Cần tiếp tục theo dữ kiện thật, không giả định thêm một hình vuông hay kích thước.
- Có bộ chặn bổ sung đối với nghiệm chưa được học sinh thử trong các phương trình mà bộ kiểm tra hiểu: ký hiệu `x=...`, kết luận/đáp án dạng số và `\\boxed{...}`, bao gồm phân số thường/LaTeX và dấu phẩy thập phân tiếng Việt. Phạm vi này có giới hạn, không phải bộ phát hiện mọi cách tiết lộ đáp án bằng ngôn ngữ tự nhiên.
- Lưu lượt học và chốt credit trong cùng giao dịch SQLite. Nếu chốt thất bại, cả hai được rollback; giữ credit được hoàn theo quy tắc cũ. Khóa lượt 70giây và revision chặn kết quả đến muộn/cập nhật đồng thời.
- Lưu trích dẫn đã được xác thực (tối đa bốn đoạn ngắn) và kết quả kiểm tra số cùng lượt học; tải lại phiên vẫn xem được nguồn. Không lưu cả tài liệu/media vào bảng gia sư.

## Dữ liệu và API

`POST /api/ai` nhận tùy chọn `tutorSessionId`; `tutorContext` do máy chủ tự tạo, không chép từ JSON. Phản hồi công khai có `tutor` và, khi có, `verification`; không gửi thông tin nhà cung cấp/mô hình/token hoặc cấu trúc trả lời nội bộ.

`GET /api/tutor/session?sessionId=...` lấy đề/lịch sử của chính tài khoản. `DELETE /api/tutor/session` với `{sessionId}` xóa một phiên; `{all:true}` xóa mọi phiên gia sư của tài khoản. Xóa này không xóa tài khoản, audit hay sổ credit.

Phiên có tối đa100lượt, tối đa100phiên đang giữ/tài khoản và hết hạn sau bảy ngày kể từ khi tạo. Nội dung hết hạn được dọn vật lý khi API gia sư được truy cập; không có cron nền cam kết xóa đúng từng giây. Bản thi miễn phí trên máy chủ tạm có thể mất trạng thái khi khởi động lại, như cảnh báo riêng của bản preview.

## Bộ kiểm tra Toán độc lập

Không chạy `eval`, mã do mô hình tạo hoặc công cụ bên ngoài. Parser giới hạn cú pháp một ẩn `x`; chỉ nhận đúng một phương trình nhận diện rõ trong đề. Bộ giải độc lập hỗ trợ hệ số nguyên, phương trình đa thức/hữu tỉ đến bậc hai và dạng một căn bằng biểu thức hữu tỉ, trong khoảng số an toàn. Mọi nghiệm được thay lại vào biểu thức **gốc**, kiểm tra mẫu khác0, căn không âm và vế đối diện căn không âm. Có kiểm tra đủ nghiệm và nghiệm ngoại lai.

Các phương trình thập phân ngoài phạm vi bảo đảm số, logarit, hình học, bất đẳng thức, hệ nhiều ẩn và đề ngôn từ chưa được chứng minh đầy đủ tự động. Chúng phải hiện `not_supported` thay vì nhận nhãn đã kiểm chứng. Có thể kiểm tra thay một giá trị cụ thể mà vẫn chưa chứng minh đủ nghiệm.

Nhãn `verified` chỉ xác nhận bộ nghiệm được gửi đối chiếu với phương trình đã nhận diện (dung sai tương đối10⁻⁸). Nó **không xác nhận mọi dòng suy luận trong lời giải**. Các lời giải của bộ10bài vẫn cần đọc và đánh giá toàn bộ quá trình.

## Bằng chứng kiểm thử

| Nhóm | Kết quả | Bằng chứng |
|---|---|---|
| Bộ nghiệm tham chiếu | 10bài đã tính độc lập; một bài thiếu dữ kiện không có đáp án số duy nhất | `lib/tutor/reference-problems.ts`, `tests/tutor.cjs` |
| Phiên/khóa/mở lời giải/Toán/quyền sở hữu | PASS24kiểm tra | `docs/regional/tutor-unit.log` |
| Route thực với SQLite/auth/credit và chặn transport | PASS12kiểm tra | `docs/regional/tutor-api.log` |
| Gọi nhà cung cấp thật | 10kịch bản có đường đi được chấp nhận qua lần chạy cuối và các lần kiểm tra lại; không phải một lượt10ca sạch duy nhất | `tutor-live-final.json`, `tutor-live-correct-prose.json`, `tutor-live-method-review.json` |
| Thử nghiệm học sinh | NOT TESTED; không khẳng định tăng hiệu quả học tập | Cần đợt thử nghiệm tự nguyện riêng |

Các kiểm tra tự động gồm: tài khoản khác không đọc/xóa/tiếp tục được phiên; giả bộ đếm không mở khóa; đổi chế độ không vượt khóa; lỗi/rỗng/lặp không tăng lượt; rollback đồng thời credit/lượt; lưu qua kết nối DB mới; kết quả muộn không commit; xóa/hết hạn dọn nội dung; nguồn và kết quả kiểm tra còn sau tải lại; quyền dùng bản thi chỉ mở năng lực, không tự nhận gói đã trả tiền.

Lần đánh giá thật đầu tiên đã tìm lỗi hết ngân sách token suy luận và lỗi quá nghiêm với metadata tùy chọn. Đã sửa ngân sách có giới hạn và effort phù hợp; tài liệu API xác nhận `max_output_tokens` bao gồm cả token suy luận: [OpenAI — Reasoning models](https://developers.openai.com/api/docs/guides/reasoning). Bản chạy đầu bộ10có8ca đi hết quy trình và2ca bị chặn (một metadata null, một mô hình lộ nghiệm sớm đã bị máy chủ chặn/hoàn credit). Không xóa các lần lỗi để làm đẹp kết quả.

`scripts/evaluate-tutor.cjs --live --max-calls=40` là chương trình **chủ động gọi API thật**, chỉ khi người vận hành chọn `--live`. Nó dùng DB tạm, tài khoản thử tổng hợp và bơm principal ở ranh giới xác thực; toàn bộ route/credit/phiên/router và transport tới nhà cung cấp là mã thật. Nó không phải kiểm thử OAuth hay bản deploy công khai. Báo cáo không chứa key, header bí mật hoặc nội dung học sinh thật. Có chặn số request nhà cung cấp ở transport, không retry âm thầm.

Lần chạy cuối10ca dùng38request nhà cung cấp thật:9ca đi hết theo tiêu chí,1ca chặn nhầm lời học sinh “nghiệm3” vì bộ nhận diện chỉ biết `x=3`. Đã sửa và kiểm tra lại riêng ca đó thành công với4request; thêm4request kiểm tra lại diễn đạt thứ tự biến đổi. Không xóa lần chặn nhầm. Báo cáo `03-TUTOR-REVIEW.md` và `tutor-evaluation-reviewed.json` đọc toàn bộ phản hồi, không chỉ số lượt hay đáp án cuối: **PASS cơ chế kỹ thuật/đáp án tham chiếu trong phạm vi này, PARTIAL độ nhất quán sư phạm**. Một số gợi ý còn mô tả nhiều thao tác và việc hỏi dữ kiện thiếu còn lặp; đây là hạn chế thật, chưa có giáo viên độc lập/người học thật đánh giá.

## Tệp liên quan

`lib/tutor/*`, `lib/server/tutor-core.ts`, migrations5–7 trong `lib/server/schema.ts`, `lib/server/store.ts`, callback giao dịch trong `lib/server/billing-core.ts`/`billing.ts`, `app/api/ai/route.ts`, `app/api/tutor/session/route.ts`, hợp đồng chat trong `lib/ai/contracts.ts`, helper prompt trong router và tùy chọn phiên của `lib/voice/client.ts`. Giao diện và truy xuất nguồn được tích hợp ở các phần tương ứng của báo cáo chung.
