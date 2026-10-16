# V9 · Theme trước khi vẽ và trạng thái đang tải thật

## Thay đổi

`lib/lumio/theme.ts` nhận đúng `light`, `dark`, `system`; thiếu, sai hoặc không đọc được storage sẽ dùng `system`. Giá trị light/dark đã lưu vẫn được giữ. Script hằng trong `<head>` của Layout đặt `html[data-theme]` trước nội dung body, không chèn chuỗi từ người dùng vào JavaScript và không sửa preference đã lưu.

Client dùng cùng quy tắc chuẩn hóa, giữ listener `matchMedia` hiện có. `suppressHydrationWarning` chỉ nằm ở thẻ `html` để cho phép thuộc tính theme được đặt trước hydration; không che các sai khác của cây nội dung.

`LoadingSkeleton` được dùng trong hai nhánh chờ hiện có: khởi tạo client, và đọc thư viện/trạng thái học chưa sẵn sàng. Placeholder không chứa học liệu, tài khoản, thống kê hoặc phần trăm giả. Có một thông báo polite, `aria-busy` và phần hình học ẩn với công nghệ hỗ trợ. Nhánh lỗi đọc thư viện vẫn giữ alert và nút thử lại.

Chỉ khi đang thật sự chờ và đã biết lựa chọn motion `full`, các thanh chờ mới có pulse opacity nhẹ. `off`, `subtle` hoặc reduced-motion của OS không pulse. Không biểu diễn tiến độ backend hoặc hoàn thành bằng hiệu ứng này.

## Kiểm tra local

- `node tests/v9-theme.cjs`: **7 PASS**, pure helper, VM chạy đúng script hằng và SSR của Layout/Skeleton thật. [JSON](qa-theme-unit.json).
- `node scripts/test-v9-theme-loading-ui.cjs`: **49 PASS**, Edge cách ly. [JSON](qa-theme-loading.json).

Browser kiểm tra theme ngay trong script đầu body và màu canvas tính thật trong khi cố ý chặn bundle hydration. Các trường hợp gồm light/dark rõ ràng, thiếu, sai, storage từ chối và hai theme hệ thống. Script bootstrap không ghi đè preference. Fixture client dùng LumioApp thật với Promise đọc thư viện bị giữ hoặc từ chối tại ranh giới test: skeleton→workspace, error→Retry→đọc mới; đổi theme hệ thống vẫn giữ preference `system`.

Skeleton đã kiểm các chiều rộng320/375/390/768/1440, native status và các lựa chọn giảm chuyển động. [Ảnh mobile SSR có nhãn](qa-loading-mobile.png) là fixture trước hydration; không phải ảnh public V9.

Phạm vi không có đăng nhập thật, API AI, dữ liệu cá nhân, thiết bị thật hoặc thử nghiệm screen reader đầy đủ. Bộ này không thay nghiệm thu Next production/hydration/public và full regression của bản tích hợp. Test harness có thêm hai tùy chọn không bắt buộc `folder`/`holdLibraryRead`; hành vi mặc định vẫn được giữ.

File runtime: `app/layout.tsx`, các block theme/loading đã phân công trong `components/lumio/app.tsx`, `lib/lumio/theme.ts`, `components/lumio/LoadingSkeleton.tsx` và CSS module tương ứng. Không sửa backend, khóa tài khoản, dữ liệu học, nhánh lỗi hoặc logic cấp quyền.
