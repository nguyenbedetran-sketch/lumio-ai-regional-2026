# Mở code và dùng Lumio AI khu vực V2 + V3.1

Đây là hướng dẫn source web **3.1.0-regional.1**, SQLite schema11, của đội AI26A0048. Bản này thêm hồ sơ/xét duyệt giáo viên trên nền V3. Kết quả public/GitHub/Drive/nộp bài xem trong [báo cáo cuối](docs/regional/FINAL-REPORT.md); tài liệu này không tự xác nhận đã deploy, duyệt thử giáo viên public hoặc đã nộp. Báo cáo còn BẢN NHÁP nghĩa là trạng thái cuối chưa chốt.

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

V3 có công cụ đồng bộ trong Cài đặt: chỉ gửi bản văn bản/ghi chú/thẻ/quiz/tiến độ/tùy chọn khi bạn bật đồng ý và thao tác. Đăng nhập không tự sync; bản máy chủ giữ tối đa 7 ngày và có thể mất sớm trên host miễn phí. Khi xung đột, xuất bản sao rồi chọn thay đổi cần giữ; không bấm ghi đè khi chưa hiểu bản nào mới. “Xóa bản máy chủ” không xóa thư viện cục bộ hoặc sổ credit. Tắt sync không xóa bản đã gửi.

## Hồ sơ giáo viên - bổ sung V3.1

1. Đăng nhập bằng Google/Facebook đã được cấu hình, mở **Dành cho giáo viên** trên thanh bên hoặc [http://localhost:3000/teacher](http://localhost:3000/teacher). Module này dùng tài khoản và SQLite hiện có, không cần thêm API key.
2. Điền họ tên người giảng dạy; chọn quốc gia/vùng lãnh thổ; chọn tỉnh/thành rồi xã/phường ở Việt Nam, hoặc nhập khu vực tương đương ở nước khác. Danh mục tham khảo có phiên bản, không yêu cầu quận/huyện cũ. Nếu không tải được hoặc không tìm thấy, dùng **Nhập thủ công** và kiểm tra lại địa chỉ trường.
3. Nhập trường/cơ sở, cấp dạy (có Mầm non), môn phân cách bằng dấu phẩy, tối đa 10 môn. Email công việc và link HTTPS công khai là tùy chọn. Không đưa căn cước, mật khẩu, ngày sinh hoặc thông tin học sinh vào đây.
4. Xác nhận đang giảng dạy/thông tin đúng theo hiểu biết của mình và đồng ý lưu hồ sơ server để xét duyệt. Bấm **Gửi hồ sơ giáo viên**. Kết quả ban đầu là **Đang chờ duyệt**, không phải đã xác minh nghề nghiệp.
5. Theo dõi trạng thái và ghi chú tại trang này. Có thể sửa khi đang chờ; bị từ chối hoặc thu hồi thì bổ sung rồi gửi lại. Khi đã được duyệt, muốn đổi bản khai cần quản trị viên thu hồi trước. Lỗi mạng giữ nội dung đang nhập trên trang; đừng đóng trang trước khi sao chép bản nháp. Nút tải trạng thái sẽ thay biểu mẫu bằng bản máy chủ theo thông báo.

Người phụ trách thiết lập admin trong `.env.local` hoặc Environment hosting bằng `LUMIO_ADMIN_EMAILS`: email Google quản trị đã được dịch vụ xác minh. Khởi động lại server rồi đăng nhập lại; email công việc tự khai trong form không cấp quyền admin. Mở `/admin` → **Xét duyệt giáo viên**, lọc/tìm/mở hồ sơ, nhập lý do và duyệt/từ chối/thu hồi. Chỉ ADMIN/SUPER_ADMIN có quyền; DEV không đọc hồ sơ. Admin không được duyệt hồ sơ của chính mình. Nếu báo xung đột phiên bản, tải lại để xem bản mới trước quyết định.

Quyền được cấp là **credential do admin xét bản khai**, không phải giấy xác minh danh tính/công tác chính thức. Nó không biến người dùng thành admin hoặc mở dữ liệu học sinh. **Lớp học, giao bài và phân tích học sinh chưa được xây dựng trong module này.** Danh mục địa phương hỗ trợ nhập liệu, không xác thực nơi công tác.

Hồ sơ/credential giáo viên nằm riêng trên server, không trong JSON thư viện/sync. Hiện chưa tự hết hạn sau 7 ngày và chưa có nút/endpoint tự xóa hồ sơ này; xóa local/snapshot không xóa bản khai. Liên hệ người phụ trách dự án để xử lý dữ liệu tài khoản. Host miễn phí có thể mất hồ sơ/quyền khi DB reset. Xem [phạm vi backend](docs/v3/08-TEACHER-BACKEND.md), [danh mục tham khảo](docs/v3/09-LOCATION-DATA.md) và `/privacy`.

Kiểm tra source3.1 có **600 PASS**; UI giáo viên admin **31 +3 SSR**, form **43 +4 SSR PASS** với dữ liệu tổng hợp trong browser riêng. Không phải hồ sơ giáo viên thật, OAuth thật hoặc xác nhận teacher public; trạng thái triển khai3.1 cần xem báo cáo cuối.

## 3. Học từ tài liệu

1. Thêm văn bản/tệp hoặc đọc website, xem lại trước khi lưu. Với PDF/DOCX/PPTX được hỗ trợ, chuẩn bị văn bản trích xuất trước khi hỏi để có vị trí nguồn; ảnh/PDF quét hoặc công thức Office phức tạp có thể chưa trích xuất được. Khi báo không hỗ trợ, dùng văn bản/ảnh rõ phù hợp thay vì coi quá trình đó đã thành công.
2. Mở tài liệu → Studio học tập. Tạo tóm tắt, thẻ, bài luyện tập hoặc hỏi Lumio bằng dữ liệu đã chọn. AI chỉ gọi sau thao tác của bạn; có thể tốn credit và phí dịch vụ của chủ dự án.
3. Tóm tắt mặc định toàn bộ nguồn có sẵn. Video được chia tuần tự thành phần 10 phút theo thời lượng đã xác nhận, giữ chương và mốc gốc; có hủy/tiếp tục trong trang đang mở. Giới hạn lập kế hoạch 12 giờ không bảo đảm đủ quota/credit hay thành công trên dịch vụ. Chỉ lưu bản toàn bộ khi mọi phần thành công. Phụ đề/văn bản chỉ bao phủ phần bạn cung cấp. [Chi tiết](docs/WHOLE-MEDIA-SUMMARY.md).
4. Mở phần nguồn cạnh câu trả lời/quiz/thẻ để xem đoạn trích và trang/mục/slide khi xác định được. Nguồn khớp chưa chứng minh toàn bộ lời giải đúng. Nếu hiện chưa xác định vị trí, hãy kiểm tra tài liệu gốc; không dùng số trang/thời gian AI tự đoán.

Tra cứu nhiều học liệu là chức năng chủ động riêng: lập chỉ mục phần văn bản được trích xuất và chọn tài liệu để tìm. Chỉ mục lưu trên máy chủ 7 ngày, xóa riêng với bản local. Tìm từ khóa không cần embeddings; tìm kết hợp/embedding chỉ chạy khi chủ dự án bật và bạn đồng ý gửi đoạn/câu truy vấn ra ngoài. Không coi phần trích xuất lỗi/ảnh scan là đã đọc đầy đủ.

“Tóm tắt chạy nền” khác chế độ toàn video trong trang: cần đồng ý lưu nội dung/kết quả trên server và gửi từng phần tới AI, tối đa 120.000 ký tự hoặc 2 giờ YouTube /12 phần. Có tiến độ, thử lại giới hạn, hủy/xóa và tải Markdown. Máy chủ ngủ/reset có thể ngắt/mất hàng đợi; phần đang gửi có thể đã được dịch vụ AI nhận. Không bắt đầu video dài khi chưa xem credit cần dùng.

## 4. Gia sư và lời giải

Mặc định Lumio hỏi từng bước: một gợi ý chính, một câu hỏi, rồi chờ bạn thử. Trả lời cách nghĩ của mình, kể cả khi chưa chắc. Máy chủ theo dõi phiên/bài và ít nhất 3 gợi ý có ý nghĩa mới mở lời giải đầy đủ; lỗi hệ thống, rỗng hoặc lặp không được cộng. Chọn Nhanh/Suy luận/Chuyên sâu không bỏ qua điều kiện này.

Khi đủ điều kiện, nút Xem lời giải đầy đủ cho phép xem các bước và kiểm tra kết quả. Bộ kiểm tra Toán chỉ hỗ trợ một số dạng; lời giải chưa kiểm chứng phải đối chiếu nguồn/người hướng dẫn. Nếu đề thiếu dữ kiện, bổ sung theo câu hỏi thay vì để AI tự bịa. Bài mới hoặc học liệu thay đổi cần phiên phù hợp, không tiếp tục dữ kiện bài trước. Có thể xóa phiên của mình; phiên hết hiệu lực sau 7 ngày và được dọn khi truy cập.

## 5. Ôn tập và đề xuất

- Lật thẻ, tự đánh giá mức ghi nhớ, làm quiz và xem giải thích/nguồn. Lịch ôn điều chỉnh theo kết quả thực; điểm quiz không phải mức thành thạo toàn môn.
- Đề xuất cho bạn cho chọn chủ đề, độ khó và mục tiêu. Mở Vì sao có đề xuất này? để xem số câu đúng/sai, lịch ôn và metadata hỗ trợ. Lượt thích thể hiện sở thích; tự đánh giá hữu ích sau học là dữ liệu riêng.
- Có thể tắt cá nhân hóa hoặc Xóa phản hồi đã lưu. Xóa phản hồi giữ học liệu, quiz, lịch sử và tùy chọn; tắt không tự xóa dữ liệu. Xử lý đề xuất trên thiết bị, chưa có kết quả thử nghiệm học sinh thật.
- Trong quiz, có thể chọn kỹ năng chung/độ khó cho lần luyện nếu mọi câu thực sự cùng phạm vi; nếu không, giữ nhãn riêng từng câu. Bằng chứng theo từng kỹ năng cho biết số câu khác nhau, ngày/giãn cách và mức bất định; dữ liệu cũ thiếu snapshot không bị gán nhãn giả. Graph chỉ có 7 kỹ năng Toán khai báo, chưa là cả chương trình. Một câu đúng luôn chưa đủ để coi thành thạo. Có tắt riêng và Xóa snapshot kỹ năng, giữ điểm quiz/đáp án. [Giải thích](docs/v3/03-LEARNING-INTELLIGENCE.md).
- Phòng tập trung có chuông mặc định/tệp riêng, âm lượng và nghe thử. Giữ trang mở; máy ngủ có thể làm chuông trễ. Chuỗi ngày học tính từ hoạt động học hợp lệ, không chỉ đăng nhập.

## 6. Giọng nói và họp

Đọc ra tiếng tạo rồi phát từng phần; nếu trình duyệt chặn tự phát, bấm Play trên trình phát đã tạo. Có tạm dừng/dừng, lỗi cạnh nút; không tạo âm thanh tự động khi mở học liệu. Bản đọc dùng AI đã cấu hình và credit. [Chi tiết](docs/READ-ALOUD.md).

Trong Phòng giọng nói, chỉ thu sau khi chọn nguồn/cấp quyền; có nghe lại, tải về hoặc lưu local. Thu không tự gửi lên AI; chép lời là thao tác riêng. Windows có thể thu mọi ứng dụng đang phát tiếng, không chỉ Zoom. Chỉ ghi/chia sẻ nội dung bạn có quyền dùng. Phiên/bản ghi có giới hạn và cần kiểm tra thiết bị thật riêng. [Hướng dẫn](docs/MEETING-CAPTURE.md).

## 7. Gói và credit - chưa thu tiền

Free có 200 credit thử một lần/tài khoản server. Giá đề xuất đã chọn: Plus 59.000đ/600 credit mỗi tháng; Premium 129.000đ/1.600; Pro 249.000đ/3.500; năm bằng 10 tháng. Gói thêm: 25.000đ/250, 59.000đ/700, 119.000đ/1.600. Thanh toán thật **chủ động tắt** trong bản thi: chưa mở bán, nút thanh toán khóa, không tự nạp/gia hạn. Ví thực tế nằm riêng và không tăng khi xem gói.

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

Render Free là host tạm: tài khoản, liên kết, credit, nhật ký, phiên gia sư, sync/chỉ mục, tác vụ và hồ sơ/quyền giáo viên có thể reset sau ngủ/restart/deploy; học liệu trình duyệt là kho riêng. Giới hạn AI: 15/phút, 150/ngày UTC và 1 đang chạy/tài khoản; bản khu vực thêm 200 lượt thử/ngày UTC và 3 đồng thời. V3 counter/lease nằm trong SQLite dùng chung; chỉ giữ qua restart khi tệp DB còn, không tự dùng chung nhiều máy có ổ riêng. Không nhập thông tin quan trọng chỉ giữ duy nhất trên bản thi.

Source3.1 cần migration11 và ba bảng giáo viên; quá trình khởi tạo store tự chạy migration, giữ người dùng/role và snapshot trước đó. Khởi động lại Node sau khi nâng source; không sửa/xóa lịch sử migration. `/api/health` cần báo đúng version, nhưng health không chứng minh AI hoặc teacher public đã thử thành công. Backup/restore theo [hướng dẫn vận hành](docs/v3/05-OPERATIONS-AND-SYNC.md); không đưa DB riêng lên GitHub.

## 9. Android/Dart và Windows

Nếu cần viết app điện thoại, mở dự án Flutter/Dart riêng, bắt đầu từ `lib/main.dart` và README mobile; cần Flutter/Android SDK theo hướng dẫn dự án đó. Các file cài Android 0.3/Windows 0.1 cũ chưa được build lại/xác nhận mới. Sửa source không cập nhật file cài đã tải. Khả năng sync native cần xem README mobile và kết quả kiểm tra riêng, không suy ra từ việc web đã có API. iPhone/device thật chưa được xác nhận. Để thử phần khu vực mới đã kiểm tra browser, ưu tiên web trên máy tính/điện thoại.

Trong ZIP/GitHub bàn giao, source điện thoại nằm ở **`apps/lumio-mobile`**, source laptop ở **`apps/lumio-desktop`**. Mở mỗi thư mục bằng một cửa sổ VS Code riêng. Flutter mới là source `0.4.0+4`; có Bản đồng bộ Web riêng trong Cài đặt, giữ metadata và cho sửa ghi chú; thư viện native cũ vẫn tách riêng.

```sh
cd apps/lumio-mobile
flutter doctor
flutter pub get
flutter devices
flutter run
```

Cần cài Flutter SDK và Android SDK, có emulator hoặc điện thoại Android bật gỡ lỗi USB. Chỉ chọn thiết bị do bạn sở hữu. Trong app, nhập backend HTTPS Lumio; trên web mở **Lumio trên điện thoại**, tự tạo mã ghép năm phút rồi nhập vào app. Không gửi mã ghép hoặc token cho người khác. Mã `.dart` bắt đầu ở `lib/main.dart`, UI ở `lib/ui`, HTTP và đồng bộ ở `lib/core`. `flutter analyze` và `flutter test` kiểm tra source; không thay cho chạy thử máy thật hoặc ký bản phát hành. Build iPhone cần môi trường macOS/Xcode và được thực hiện ở giai đoạn sau.

## 10. Lỗi thường gặp

- Không thấy AI/đăng nhập: kiểm tra env phía server và công tắc quản trị; chưa cấu hình thì không có kết quả AI giả. Đọc thông báo và thử lại sau khi sửa đúng nguyên nhân.
- Báo quota/credit: xem ví và hạn mức; đổi mode không né được bảo vệ. Không bấm lặp nhiều yêu cầu khi một lần đang chạy.
- Cổng 3000 bận: dùng server đã mở hoặc dừng đúng server của bạn; không mở nhiều phiên cùng cổng.
- Xung đột nhiều tab: xuất bản nháp trước, rồi tải bản đã lưu; không ghi đè dữ liệu tab khác.
- Hồ sơ giáo viên không gửi được: xác nhận đúng tài khoản và hai ô khai báo; kiểm tra thông báo trường/email/link HTTPS. Nếu phiên đổi/hết hạn, đăng nhập lại. Nếu lỗi backend sau nâng cấp, dừng và khởi động lại Node để store chạy migration11; không bật admin giả hoặc sửa DB từ trình duyệt.
- Báo public chưa sẵn sàng: xem báo cáo cuối/khởi động hosting; không lấy tài liệu lịch sử 1.x làm xác nhận 2.0.

Xem [README](README.md), [AI và OAuth](AI-SETUP.md), [nghiệm thu](docs/regional/FINAL-REPORT.md), [quyền riêng tư khi web đang chạy](http://localhost:3000/privacy) và [thử nghiệm tự nguyện chưa thực hiện](docs/regional/STUDENT-PILOT.md).
