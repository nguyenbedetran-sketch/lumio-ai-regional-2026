# Tìm nhanh trong Lumio

Bảng tìm nhanh mở bằng **Ctrl+K** (Windows/Linux), **Cmd+K** (macOS) hoặc nút kính lúp trên thanh đầu trang. Chọn trang, không gian học hoặc học liệu bằng chuột/chạm; dùng ↑/↓ và Enter bằng bàn phím. Escape, nút đóng, chạm vùng nền hoặc nhấn lại phím tắt để đóng. Việc mở bảng và nhập từ khóa không điều hướng, không dừng phòng giọng nói và không thay đổi nội dung đang sửa. Chỉ chọn một kết quả mới gọi điều hướng.

## Thư viện và thiết kế

- `cmdk@1.1.1` (MIT): combobox/listbox, lựa chọn kết quả và điều hướng bàn phím. Lumio tự lọc (`shouldFilter={false}`), dùng ID riêng cho từng mục để học liệu trùng tên vẫn mở đúng. Tắt `vimBindings` để Ctrl+K không xung đột. [Tài liệu chính thức](https://github.com/pacocoursey/cmdk), [package và giấy phép](https://github.com/pacocoursey/cmdk/blob/main/cmdk/package.json).
- `motion@13.4.4` (MIT): dùng `animate` từ `motion/mini` trên các phần tử DOM đã mount, chỉ cho chuyển động xuất hiện của nền và hộp tìm kiếm. HTML mặc định hiển thị; nếu khởi tạo hiệu ứng lỗi hoặc bị ngắt, hộp trở về trạng thái hiển thị cuối. Lumio đăng ký sự kiện `matchMedia` để nhận cả thay đổi tùy chọn giảm chuyển động khi trang đang mở; nếu bật tùy chọn này, hủy hiệu ứng đang chạy và đặt ngay trạng thái cuối, không dịch/chỉnh tỷ lệ. Không giữ màn hình cũ sau khi điều hướng. [Tài liệu animate/mini chính thức](https://motion.dev/docs/animate). Lưu ý kỹ thuật: `useReducedMotion` trong bản cài 13.4.4 chỉ lấy snapshot ban đầu, vì vậy không dùng hook đó để giả định cập nhật trực tiếp.
- Vỏ hộp dùng `<dialog>.showModal()`: nền không tương tác trong lúc mở, Tab không chọn được các nút/input nền, Escape đóng, rồi trả focus về điều khiển trước đó hoặc nút tìm nhanh. Chromium có thể chuyển Tab lên thanh trình duyệt; khi đó `document.activeElement` là `body` trong khi hộp vẫn ở trạng thái `:modal`. Không chặn hành vi gốc này bằng vòng focus bổ sung. Chỉ một bảng tồn tại trong workspace. Không có modal tùy biến giả `role=dialog` để thay cơ chế trình duyệt.
- Giao diện theo màu cream/mint hiện có, tương thích dark theme, màn hình hẹp và các ngôn ngữ vi/en/zh-CN/ja/ko. Nút mở có tên truy cập ngay cả khi chỉ hiển thị biểu tượng trên điện thoại.

Đây là tính năng được chọn độc lập để nâng trải nghiệm Lumio, không phải tuyên bố xác định được plugin trong video TikTok.

## Dữ liệu được tìm

Chỉ dùng học liệu và không gian của tài khoản/workspace được truyền vào component. Không gọi AI, máy chủ tìm kiếm hay mạng; không ghi chỉ mục, lịch sử từ khóa hoặc nội dung tìm ra localStorage. Chỉ mục trong bộ nhớ được tạo khi mở và bỏ khi đóng. `key={profile.account}` trong điểm tích hợp đảm bảo trạng thái từ khóa không đi sang tài khoản khác.

Tìm tên học liệu, tên tệp, tên không gian, và **12.000 ký tự đầu của từng phần ghi chú và văn bản nguồn**. Không đọc Blob của PDF/ảnh/video/audio để tự OCR hay chép lời; văn bản đã được trích xuất và lưu trong trường nguồn có thể được tìm trong giới hạn trên. Không tìm các câu trả lời AI chưa lưu trong trường nguồn/ghi chú, thẻ hay đáp án quiz. Bộ tìm kiếm khớp từ theo nội dung literal, bỏ dấu tiếng Việt và chuẩn hóa Unicode; không phải semantic search hoặc sửa lỗi chính tả.

Từ khóa tối đa 160 ký tự. Tất cả từ đều phải khớp một trường; ưu tiên tên chính xác, tiền tố, tên chứa từ khóa, sau đó các trường khác. Cùng mức khớp thì dùng lần mở gần nhất; ngày không hợp lệ tính là 0. Trống từ khóa hiển thị tối đa 6 học liệu gần đây, có từ khóa tối đa 20 kết quả học liệu. Không gian tối đa 6. Tổng kết quả học liệu được báo riêng; mục vượt giới hạn yêu cầu thu hẹp từ khóa. Không tự tải thêm hoặc gửi tài liệu đi để tìm.

## Tích hợp

Thêm `import "./command-menu.css"` trong layout. Trong Workspace, gỡ listener Ctrl/Cmd+K cũ mở trang search, rồi đặt component đúng một lần ở thanh đầu trang **ngoài** `main` có key theo trang/học liệu:

```tsx
<CommandMenu
  key={profile.account}
  locale={profile.locale}
  items={data.items}
  spaces={data.spaces}
  navigation={destinations}
  onNavigate={go}
  onOpenItem={open}
/>
```

`destinations: readonly {id: CommandView; label: string; keywords?: readonly string[]}[]` sử dụng nhãn bản địa hóa và các trang người dùng đang có quyền thấy. `CommandView` khớp union của Workspace. `go(view, spaceId?)` nhận ID không gian khi chọn mục space. Không truyền URL bên ngoài hoặc lệnh xóa tài liệu. Component có props tùy chọn `disabled` và `className`. Giữ component được mount khi chuyển trang để trả focus ổn định, không bọc toàn bộ workspace bằng transition khi tìm.

## Kiểm tra

`node tests/command-menu.cjs` kiểm tra tìm không dấu, AND nhiều trường, tên tệp/không gian, CJK, trùng tên, thứ tự, giới hạn, input literal, tách dữ liệu tài khoản, hợp đồng phím tắt và nhãn đủ 5 ngôn ngữ. Đây là kiểm tra logic; không thay thế kiểm tra trình duyệt.

Khi tích hợp, kiểm tra trên desktop và màn hình 375px: mở bằng nút/phím tắt; gõ; ↑/↓/Enter mở đúng mục; Escape trả focus; Tab/Shift+Tab không lọt ra nền; modal khác giữ quyền phím tắt; dark theme; giảm chuyển động; không dừng âm thanh hay làm mất nội dung đang sửa khi chỉ mở/đóng bảng. Không thể suy ra các kiểm tra tương tác này đã đạt chỉ từ bộ test Node.
