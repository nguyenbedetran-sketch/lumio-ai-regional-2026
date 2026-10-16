# F02a1 — kiểm thử giao diện báo cáo sử dụng AI

## Phạm vi và cách chạy

```powershell
node scripts/test-v7-usage-ui.cjs
```

Runner dùng `@playwright/cli@0.1.21` và Microsoft Edge đã có trên máy kiểm thử. Nó biên dịch component `components/admin/usage-breakdown.tsx` thật cùng React và CSS ứng dụng hiện hành. Các wrapper `.ad-shell`, `.ad-main`, `.ad-content`, `.ad-panel` theo cấu trúc quản trị hiện có. Fixture không thêm đường dẫn kiểm thử hoặc cơ chế bỏ qua đăng nhập vào ứng dụng.

Mọi request đều được chặn tại browser fixture. Các tài khoản, model, số liệu và phản hồi HTTP là dữ liệu tổng hợp, có nhãn rõ trên ảnh. Không gọi nhà cung cấp AI, không đổi dữ liệu quản trị, không truy cập bản public và không phát sinh chi phí AI từ runner này.

## Kết quả mới nhất

Xem [báo cáo JSON](qa-usage-ui-report.json) để biết thời điểm chạy, số kiểm tra, kết quả, kích thước thật và SHA-256 của component/CSS/fixture/browser test. Không cộng số kiểm tra từ các lượt chạy trước. Lịch sử phát hiện và sửa lỗi riêng ở [usage-ui-findings.json](reports/usage-ui-findings.json).

Lượt nghiệm thu cuối ngày 16/10/2026 lúc `05:11:44Z`: **79/79 kiểm tra PASS**, 12 GET tổng hợp, 0 runtime error, 0 request tới provider hoặc bản public. Cả ba ảnh dưới đã được mở xem sau lượt chạy này. Những lượt 62/66/72 kiểm tra trước đó là các mốc phát hiện/sửa lỗi riêng, không cộng vào kết quả 79.

Chẩn đoán toàn bộ nhật ký cũng đã được kiểm tra: fixture có 9 bản ghi còn lưu, 3 lượt chưa rõ kết quả, trong đó 2 lượt nằm ngoài khoảng đã chọn. Các số đó hiển thị riêng với 7 lượt chuẩn bị gọi và 1 lượt chưa rõ kết quả trong khoảng đang xem. Giới hạn 64 lượt/tài khoản, 2.048 lượt toàn hệ thống và 100.000 bản ghi được ghi rõ là giới hạn dung lượng/dispatch; không dùng làm mẫu số credit hoặc chi phí.

## Những hành vi được kiểm tra

- Disclosure đóng mặc định; mở, đổi bộ lọc hoặc đổi viewport không tự tải số liệu riêng tư. Nút tải dùng GET, `cache: no-store` và header tài khoản chuẩn.
- Kết quả yêu cầu và từng lượt chuẩn bị gọi AI là hai scope riêng. Không trộn hàng dữ liệu, không gộp số yêu cầu với số lượt gọi, không biến phản hồi HTTP thành câu trả lời đã được chấp nhận hoặc credit đã thu.
- Token chưa đo hiển thị dấu gạch; token được báo là 0 vẫn hiển thị 0. Chi phí chưa biết không trở thành 0 USD hoặc hóa đơn.
- Nhật ký chờ cũ ngoài cửa sổ thời gian vẫn hiện trong chẩn đoán toàn bộ nhật ký; tổng theo cửa sổ và mẫu số dung lượng không bị cộng/trộn với nhau.
- Đổi nhóm/thời gian hủy request cũ và xóa kết quả. Fixture cố tình giả lập transport bỏ qua AbortSignal để kiểm tra phản hồi trễ vẫn không ghi đè kết quả mới.
- 401/403 không giữ bảng riêng tư cũ; đổi tài khoản bằng remount xóa dữ liệu/lỗi và hủy lượt tải cũ. Sai scope được từ chối; lỗi máy chủ và dữ liệu rỗng có trạng thái tương ứng.
- Dùng bàn phím mở summary, chuyển qua bộ lọc và gửi form; nhãn điều khiển, trạng thái đang tải, cột và dòng của bảng có semantics phù hợp trong component này.
- Tại 390/768/1440 px, trang và bộ lọc không tràn ngang; bảng rộng cuộn trong vùng riêng. Mã model thông thường đọc được, mã dài giữ nguyên và xuống dòng trong ô. Số liệu chính và chi tiết HTTP/token nằm trên dòng riêng, tránh đọc nhầm `5 / 2` cộng với `1 lỗi` thành `5 / 21`.

## Minh chứng

- [Desktop 1440 px](qa-usage-attempts-desktop.png)
- [Tablet 768 px](qa-usage-attempts-tablet.png)
- [Mobile 390 px](qa-usage-attempts-mobile.png)

Ảnh chỉ là component thật với dữ liệu tổng hợp trong fixture. Các ảnh không chứng minh quyền truy cập backend, tính đúng của SQL tổng hợp, dữ liệu provider thật hoặc giao diện toàn bộ sản phẩm trên thiết bị thật. Cần dùng các bộ kiểm thử API/SQLite và nghiệm thu triển khai riêng cho các tuyên bố đó. Đây cũng không phải chứng nhận accessibility/WCAG cho toàn ứng dụng.
