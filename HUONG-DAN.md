# Mở code và dùng Lumio AI 2.0 khu vực

Đây là hướng dẫn bản web dự thi AI26A0048. Kết quả public/GitHub/Drive/nộp bài xem trong [báo cáo cuối](docs/regional/FINAL-REPORT.md); tài liệu này không tự xác nhận đã deploy hoặc đã nộp. Báo cáo còn BẢN NHÁP nghĩa là trạng thái cuối chưa chốt.

## 1. Mở và chạy trên laptop

1. Giải nén gói source vào một thư mục. Mở VS Code → File → Open Folder → chọn **thư mục có `package.json`**. Nếu gói chung có ba thư mục `web`, `mobile`, `desktop`, chọn `web` cho website.
2. Cài Node.js 24.x. Mở lại terminal, chạy `node --version`; kết quả cần bắt đầu `v24.`. Nếu chưa có pnpm, chạy `npm install -g pnpm@11.25.0`.
3. Trong Terminal → New Terminal, chạy:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

4. Mở [http://localhost:3000](http://localhost:3000). Nhấn Ctrl+C để dừng. Lần sau chỉ cần `pnpm dev`; chỉ cài lại khi dependency/lockfile thay đổi. Không mở `.tsx` trực tiếp hoặc dùng Live Server.

Công cụ local dùng được không cần key. Google/Facebook và AI chỉ hoạt động khi server được cấu hình; [AI-SETUP.md](AI-SETUP.md) chỉ cách làm. Không gửi key/mật khẩu/OTP vào chat, GitHub hoặc giao diện học. Bản source sạch không kèm cấu hình riêng.

## 2. Đăng nhập, liên kết và dữ liệu

Đăng nhập bằng dịch vụ đã cấu hình; trong Cài đặt, dùng Liên kết để nối danh tính khác vào tài khoản đang dùng. Không tự gộp theo email. Liên kết yêu cầu xác thực gần đây và kiểm tra chủ sở hữu ở máy chủ. Ứng dụng OAuth đang thử nghiệm chỉ dùng được với các tài khoản mà dịch vụ cho phép; có key không đồng nghĩa được duyệt public.

Ưu tiên `localhost` khi thử Facebook trên máy. Bản triển khai phải có HTTPS hợp lệ và callback đúng domain. `localhost` và `127.0.0.1` có cookie/vùng lưu học liệu riêng. Chuyển bằng Cài đặt → Xuất bản sao ở địa chỉ cũ → Nhập bản sao ở địa chỉ mới.

Thư viện, file, ghi chú, quiz, lịch học/ôn và phản hồi lưu theo tài khoản trong trình duyệt. JSON không chứa PDF/ảnh/audio/video gốc hoặc tệp chuông riêng: giữ các tệp đó riêng. Nhập JSON không tăng ví credit hoặc cấp quyền server. Không xóa dữ liệu trình duyệt trước khi sao lưu.

## 3. Học từ tài liệu

1. Thêm văn bản/tệp hoặc đọc website, xem lại trước khi lưu. Với PDF/DOCX/PPTX được hỗ trợ, chuẩn bị văn bản trích xuất trước khi hỏi để có vị trí nguồn; ảnh/PDF quét hoặc công thức Office phức tạp có thể chưa trích xuất được. Khi báo không hỗ trợ, dùng văn bản/ảnh rõ phù hợp thay vì coi quá trình đó đã thành công.
2. Mở tài liệu → Studio học tập. Tạo tóm tắt, thẻ, bài luyện tập hoặc hỏi Lumio bằng dữ liệu đã chọn. AI chỉ gọi sau thao tác của bạn; có thể tốn credit và phí dịch vụ của chủ dự án.
3. Tóm tắt mặc định toàn bộ nguồn có sẵn. Video được chia tuần tự thành phần 10 phút theo thời lượng đã xác nhận, giữ chương và mốc gốc; có hủy/tiếp tục trong trang đang mở. Giới hạn lập kế hoạch 12 giờ không bảo đảm đủ quota/credit hay thành công trên dịch vụ. Chỉ lưu bản toàn bộ khi mọi phần thành công. Phụ đề/văn bản chỉ bao phủ phần bạn cung cấp. [Chi tiết](docs/WHOLE-MEDIA-SUMMARY.md).
4. Mở phần nguồn cạnh câu trả lời/quiz/thẻ để xem đoạn trích và trang/mục/slide khi xác định được. Nguồn khớp chưa chứng minh toàn bộ lời giải đúng. Nếu hiện chưa xác định vị trí, hãy kiểm tra tài liệu gốc; không dùng số trang/thời gian AI tự đoán.

## 4. Gia sư và lời giải

Mặc định Lumio hỏi từng bước: một gợi ý chính, một câu hỏi, rồi chờ bạn thử. Trả lời cách nghĩ của mình, kể cả khi chưa chắc. Máy chủ theo dõi phiên/bài và ít nhất 3 gợi ý có ý nghĩa mới mở lời giải đầy đủ; lỗi hệ thống, rỗng hoặc lặp không được cộng. Chọn Nhanh/Suy luận/Chuyên sâu không bỏ qua điều kiện này.

Khi đủ điều kiện, nút Xem lời giải đầy đủ cho phép xem các bước và kiểm tra kết quả. Bộ kiểm tra Toán chỉ hỗ trợ một số dạng; lời giải chưa kiểm chứng phải đối chiếu nguồn/người hướng dẫn. Nếu đề thiếu dữ kiện, bổ sung theo câu hỏi thay vì để AI tự bịa. Bài mới hoặc học liệu thay đổi cần phiên phù hợp, không tiếp tục dữ kiện bài trước. Có thể xóa phiên của mình; phiên hết hiệu lực sau 7 ngày và được dọn khi truy cập.

## 5. Ôn tập và đề xuất

- Lật thẻ, tự đánh giá mức ghi nhớ, làm quiz và xem giải thích/nguồn. Lịch ôn điều chỉnh theo kết quả thực; điểm quiz không phải mức thành thạo toàn môn.
- Đề xuất cho bạn cho chọn chủ đề, độ khó và mục tiêu. Mở Vì sao có đề xuất này? để xem số câu đúng/sai, lịch ôn và metadata hỗ trợ. Lượt thích thể hiện sở thích; tự đánh giá hữu ích sau học là dữ liệu riêng.
- Có thể tắt cá nhân hóa hoặc Xóa phản hồi đã lưu. Xóa phản hồi giữ học liệu, quiz, lịch sử và tùy chọn; tắt không tự xóa dữ liệu. Xử lý đề xuất trên thiết bị, chưa có kết quả thử nghiệm học sinh thật.
- Phòng tập trung có chuông mặc định/tệp riêng, âm lượng và nghe thử. Giữ trang mở; máy ngủ có thể làm chuông trễ. Chuỗi ngày học tính từ hoạt động học hợp lệ, không chỉ đăng nhập.

## 6. Giọng nói và họp

Đọc ra tiếng tạo rồi phát từng phần; nếu trình duyệt chặn tự phát, bấm Play trên trình phát đã tạo. Có tạm dừng/dừng, lỗi cạnh nút; không tạo âm thanh tự động khi mở học liệu. Bản đọc dùng AI đã cấu hình và credit. [Chi tiết](docs/READ-ALOUD.md).

Trong Phòng giọng nói, chỉ thu sau khi chọn nguồn/cấp quyền; có nghe lại, tải về hoặc lưu local. Thu không tự gửi lên AI; chép lời là thao tác riêng. Windows có thể thu mọi ứng dụng đang phát tiếng, không chỉ Zoom. Chỉ ghi/chia sẻ nội dung bạn có quyền dùng. Phiên/bản ghi có giới hạn và cần kiểm tra thiết bị thật riêng. [Hướng dẫn](docs/MEETING-CAPTURE.md).

## 7. Gói và credit - chưa thu tiền

Free có 200 credit thử một lần/tài khoản server. Giá đề xuất: Plus 59.000đ/600 credit mỗi tháng; Premium 129.000đ/1.600; Pro 249.000đ/3.500; năm bằng 10 tháng. Gói thêm: 25.000đ/250, 59.000đ/700, 119.000đ/1.600. Đây là giá duyệt bản thi, chưa mở bán; nút thanh toán khóa, không tự nạp/gia hạn. Ví thực tế nằm riêng và không tăng khi xem gói.

Trong chế độ khu vực, Free được mở thử các khả năng AI nâng cao khi đã cấu hình; vẫn kiểm tra tài khoản/credit/hạn mức. Ngoại lệ thử này không phải mua Plus/Premium/Pro. Yêu cầu lỗi hoàn phần credit đã giữ. Một video/bản đọc dài có nhiều yêu cầu, không phải một lần dùng cố định. [Bảng giá đề xuất](docs/regional/PRICING-PROPOSAL.md).

## 8. Build và chạy bản dự thi

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/start-regional.cjs
```

Lệnh cuối cần origin HTTPS và đủ env server; không chạy như localhost HTTP thông thường. Dùng `render-regional.yaml`, không nhầm `render.yaml` UI-only cũ. Cấu hình trong [AI-SETUP.md](AI-SETUP.md). Root triển khai và kiểm tra URL thực tế riêng, không coi build local là public đã hoạt động.

Render Free là host tạm: tài khoản, liên kết, credit, nhật ký và phiên gia sư có thể reset sau ngủ/restart/deploy; học liệu trình duyệt là kho riêng. Giới hạn AI: 15/phút, 150/ngày UTC và 1 đang chạy/tài khoản; bản khu vực thêm 200 lượt thử/ngày UTC và 3 đang chạy/instance. Bộ đếm reset khi restart. Không nhập thông tin quan trọng chỉ giữ duy nhất trên bản thi.

## 9. Android/Dart và Windows

Nếu cần viết app điện thoại, mở dự án Flutter/Dart riêng, bắt đầu từ `lib/main.dart` và README mobile; cần Flutter/Android SDK theo hướng dẫn dự án đó. Đây vẫn là mã Android 0.3 từ đợt trước, iPhone chưa hoàn tất. Windows 0.1 ở dự án Electron riêng, local preview và dữ liệu riêng; không tự đồng bộ phiên web. Đợt 2.0 này **không build APK/EXE mới và không xác nhận lại chúng**. Để thử tính năng khu vực mới, ưu tiên web trên trình duyệt máy tính/điện thoại.

## 10. Lỗi thường gặp

- Không thấy AI/đăng nhập: kiểm tra env phía server và công tắc quản trị; chưa cấu hình thì không có kết quả AI giả. Đọc thông báo và thử lại sau khi sửa đúng nguyên nhân.
- Báo quota/credit: xem ví và hạn mức; đổi mode không né được bảo vệ. Không bấm lặp nhiều yêu cầu khi một lần đang chạy.
- Cổng 3000 bận: dùng server đã mở hoặc dừng đúng server của bạn; không mở nhiều phiên cùng cổng.
- Xung đột nhiều tab: xuất bản nháp trước, rồi tải bản đã lưu; không ghi đè dữ liệu tab khác.
- Báo public chưa sẵn sàng: xem báo cáo cuối/khởi động hosting; không lấy tài liệu lịch sử 1.x làm xác nhận 2.0.

Xem [README](README.md), [AI và OAuth](AI-SETUP.md), [nghiệm thu](docs/regional/FINAL-REPORT.md), [quyền riêng tư khi web đang chạy](http://localhost:3000/privacy) và [thử nghiệm tự nguyện chưa thực hiện](docs/regional/STUDENT-PILOT.md).
