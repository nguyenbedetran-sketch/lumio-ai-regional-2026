# Lumio AI Desktop — Windows 0.1.0

Ứng dụng laptop dùng toàn bộ giao diện web Lumio, chạy trong cửa sổ riêng với backend và Node đi kèm. Không cần mở terminal hoặc cài Node để dùng bộ portable đã đóng gói.

## Mở app

1. Giải nén **toàn bộ** `Lumio-AI-Windows-0.1.0-portable.zip` vào một thư mục, ví dụ `D:\Apps\Lumio`.
2. Mở `Lumio AI.exe` trong thư mục `Lumio AI-win32-x64`.
3. Giữ nguyên thư mục `resources` và các file DLL cạnh EXE. Không chạy EXE trực tiếp từ bên trong ZIP.

Yêu cầu: Windows 10/11, x64. Đây là bản thử nghiệm chưa có chữ ký phát hành Windows và chưa đưa lên Microsoft Store. macOS/Linux chưa được đóng gói.

## Nghe bài giảng từ Zoom / Teams / Meet

1. Mở cuộc họp hoặc video trên laptop; kiểm tra âm thanh đang phát ra đúng loa/tai nghe.
2. Trong Lumio, mở **Phòng giọng nói (Lumio Voice)**, tìm thẻ thu âm **Giữ lại điều bạn vừa học.** Nếu muốn ghi thêm giọng của bạn, bật ô **Thu cả micro của tôi**; mặc định micro tắt. Bấm **Chọn nguồn âm thanh** để lấy âm thanh máy tính.
3. Hộp thoại của Lumio hỏi lại trước **mỗi** lần lấy âm thanh. Chọn cho phép khi bạn muốn ghi.
4. Nguồn này nhận **toàn bộ âm thanh đang phát của máy**, bao gồm cả ứng dụng khác đang phát cùng lúc. Đây chưa phải chế độ tách riêng một ứng dụng Zoom.
5. Dừng từ nút trong Lumio, hoặc menu **Lumio → Dừng thu âm** (`Ctrl + Shift + S`). Đóng ứng dụng cũng dừng các luồng đang thu.

Sau khi hoàn tất, nghe thử rồi chọn **Tải âm thanh** hoặc lưu vào thư viện trước khi đóng app. Bản đang ghi hoặc bản chưa lưu không được tự xuất thành file khi bạn đóng cửa sổ.

Bạn có thể chuyển sang cửa sổ Zoom hoặc thu nhỏ Lumio trong lúc thu. App giữ timer hoạt động để giới hạn thời gian vẫn được kiểm tra; nó không tự khóa chế độ ngủ của Windows.

Windows cần một luồng hình ảnh tạm từ chính cửa sổ Lumio để cấp audio loopback. Luồng hình ảnh không được đưa vào file ghi hay gửi đi. Micro chỉ được cấp khi bạn chọn riêng. Hãy thông báo và có sự đồng ý của người tham gia trước khi ghi cuộc họp.

Mỗi bản ghi giới hạn **10 phút / 8 MB**. Khi tạm dừng, quyền chia sẻ vẫn còn mở; phiên chia sẻ sẽ kết thúc tối đa sau **30 phút**. Dùng **Hoàn tất bản ghi** hoặc **Hủy thu âm** để kết thúc nguồn ngay khi không cần nữa.

Nếu không nhận được âm thanh, kiểm tra thiết bị đầu ra Windows, bật âm cuộc họp và dùng âm thanh máy tính đang phát thật. Nội dung có DRM hoặc cấu hình thiết bị đặc biệt có thể không được thu. Chưa xác nhận khả năng thu Zoom bằng một cuộc họp thật trên laptop của bạn.

## Tính năng và phần cần kết nối sau

- Thư viện, ghi chú, học thẻ, quiz có sẵn trong tài liệu, mục tiêu, tiến bộ, tập trung, giao diện sáng/tối và animation chạy trong app.
- Tạo/tải file thu âm hoạt động tại máy. Chép lời, gia sư AI và tạo nội dung AI trực tuyến chưa bật trong bản desktop này; dùng bản web có cấu hình API và phiên tài khoản phù hợp. Bản portable không kèm API keys.
- Đăng nhập Google/Facebook trong cửa sổ Electron chưa được hỗ trợ. Dùng menu **Mở bản web trên máy** để mở web đang chạy ở `http://localhost:3000/`, hoặc mở bản public. Đăng nhập trong trình duyệt không tự chuyển phiên đăng nhập sang app.
- Tài khoản, credits và thu tiền thật chưa được kết nối trong bản desktop này. Không có thanh toán hoặc đăng ký nền.
- Dữ liệu desktop là vùng riêng, không tự đọc dữ liệu trên trình duyệt hay Android. Dùng xuất/nhập bản sao trong cài đặt để chuyển dữ liệu hỗ trợ.

## Mở code

Cài Node **24.x** và VS Code. Trong thư mục `lumio-desktop`:

```powershell
npm ci
npm test
```

Nếu Electron chưa tải binary sau `npm ci`, chạy:

```powershell
node node_modules/electron/install.js
```

Backend web cần được build riêng trong một bản nguồn sạch không có file `.env` / `.env.*` ngoại trừ `.env.example`, bật `output: 'standalone'` trong `next.config.ts`, rồi chạy `pnpm install --frozen-lockfile` và `pnpm build`. Ví dụ bản web sạch ở `D:\LumioBuild\eduvi`:

```powershell
node scripts/stage.cjs --web=D:\LumioBuild\eduvi --node="C:\Program Files\nodejs\node.exe"
npm start
npm run package
npm run smoke
```

Thư mục build `bundle` có backend, Node và manifest. Script stage tự chép `public` và `.next/static` đúng vị trí và bỏ file môi trường/database. Các package được Next trace có phiên bản duy nhất được chép thành cấu trúc `node_modules` phẳng để không phụ thuộc symlink/junction khi giải nén ZIP trên Windows; script từ chối khi phát hiện hai phiên bản xung đột. Bản nguồn giao cho bạn không kèm `node_modules`, backend đã biên dịch hoặc SDK.

`src/main.cjs` quản lý cửa sổ, chạy/dừng backend, menu và hộp thoại quyền. `src/preload.cjs` chỉ cung cấp metadata và nhận lệnh dừng từ menu; không cấp API file/shell cho trang. `src/security.cjs` chứa các chính sách origin/quyền được kiểm tra độc lập.

## Dữ liệu trên máy

Trong `%APPDATA%\Lumio AI Desktop`:

- Session/cookie/cache/localStorage/IndexedDB của app được lưu trong vùng Electron riêng.
- `server\data\lumio.sqlite` là vị trí dự phòng cho database backend cục bộ; bản offline hiện tại không tạo database tài khoản.
- `server\session-secret` là khóa phiên riêng được tạo khi mở lần đầu.
- `server\server-settings.json` được dành cho cấu hình API riêng trong tương lai; bản desktop hiện tại vẫn khóa AI trực tuyến. Không gửi file này kèm code. Nó không thay thế quy trình đăng nhập tài khoản.

Không có tự khởi động cùng Windows, ghi âm nền hoặc truy cập tài khoản Zoom. Đóng app sẽ tắt backend của app. Cổng `127.0.0.1:3210` cố định; nếu bị chương trình khác chiếm, Lumio từ chối kết nối.
