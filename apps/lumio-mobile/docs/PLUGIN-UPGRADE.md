# Nâng cấp thư viện native 0.2.0+2

Hai thư viện dưới đây được chọn từ nguồn chính thức, không suy đoán tên plugin trong video TikTok chưa đọc được. Cả hai được pin **đúng phiên bản** trong `pubspec.yaml`; `pubspec.lock` khóa cả phụ thuộc gián tiếp.

| Thư viện | Nguồn / giấy phép | Phần đã dùng |
| --- | --- | --- |
| `flutter_animate` **4.5.2** | [pub.dev](https://pub.dev/packages/flutter_animate/versions/4.5.2), [GitHub gskinner](https://github.com/gskinner/flutter_animate), [BSD-3-Clause](https://github.com/gskinner/flutter_animate/blob/main/LICENSE) | Fade + chuyển nhẹ 8 px khi mở thư viện/trang chủ/tóm tắt; phản hồi quiz fade + scale 0,98 → 1. |
| `share_plus` **13.3.0** | [pub.dev](https://pub.dev/packages/share_plus/versions/13.3.0), [GitHub Flutter Community](https://github.com/fluttercommunity/plus_plugins/tree/main/packages/share_plus/share_plus), [BSD-3-Clause](https://pub.dev/packages/share_plus/versions/13.3.0/license) | Mở bảng chia sẻ hệ điều hành sau khi người dùng xem, sửa và xác nhận nội dung đã chọn. |

Nguồn được kiểm tra ngày 27/09/2026. Không tải mã từ repository lạ hoặc dùng bản fork không rõ tác giả. Giấy phép upstream được giữ qua cơ chế LicenseRegistry của Flutter và trang Giấy phép trong app. Đây là thư viện của bên thứ ba, không phải công nghệ do đội tự viết.

## Cách dùng

- **Nguồn**: mở học liệu → tab Nguồn → biểu tượng chia sẻ cạnh tiêu đề.
- **Tóm tắt**: tại Studio, dùng biểu tượng chia sẻ bên cạnh Tóm tắt đã lưu.
- **Ghi chú**: nút Chia sẻ nội dung này dưới nút Lưu. Nếu đang sửa ghi chú, bản nháp hiện tại được đưa vào màn hình xem trước; thao tác chia sẻ không tự lưu/thay đổi ghi chú.
- **Flashcard**: sau khi lật thẻ, dùng Chia sẻ nội dung này để chọn đúng thẻ hiện tại, gồm câu hỏi và đáp án.

Mỗi thao tác mở màn hình **Xem trước khi chia sẻ**. Người dùng sửa đoạn văn, sau đó nhấn **Chọn ứng dụng nhận**. App truyền tiêu đề học liệu và đúng văn bản đã duyệt; không gửi toàn bộ thư viện, lịch sử, tài khoản, token hoặc khóa API. App không tự bấm gửi trong ứng dụng nhận.

Đoạn chia sẻ tối đa 24.000 ký tự. Nội dung dài hơn được giữ trong màn hình xem trước, yêu cầu người dùng tự rút gọn; không âm thầm cắt. Có nút Sao chép khi không muốn hoặc không mở được bảng chia sẻ. Bản sao JSON vẫn theo luồng xuất/nhập cũ, không tự chia sẻ.

## Chuyển động và khả năng truy cập

Hiệu ứng kéo dài 180–280 ms, không có vòng lặp, shader động hoặc hiệu ứng chờ giả. Khi hệ điều hành bật **giảm chuyển động** (`disableAnimations`) hoặc chế độ điều hướng hỗ trợ (`accessibleNavigation`), các wrapper chuyển động được bỏ qua hoàn toàn. Hiệu ứng không tạo điểm, hoạt động học hoặc số liệu tiến độ.

## Tương thích và kiểm tra rủi ro

`share_plus` 13.3.0 yêu cầu Flutter ≥ 3.38.1, Dart ≥ 3.10, Java 17, Kotlin 2.2, AGP ≥ 8.12.1, Gradle ≥ 8.13 và iOS ≥ 13 theo README upstream. Dự án dùng Flutter 3.47.5 / Dart 3.13.4, JDK 21 với bytecode Java 17, Kotlin 2.4, AGP 9.1, Gradle 9.3.1; Android minSDK 24 giữ nguyên. [Yêu cầu upstream](https://pub.dev/packages/share_plus/versions/13.3.0).

Manifest của plugin thêm FileProvider và receiver với `exported=false`; không thêm quyền nguy hiểm mới. Tích hợp hiện tại chỉ truyền `text`, không đính kèm file hay URI và không dùng file cache chia sẻ. Các thư viện này không cần API key; tác vụ AI/voice vẫn đi qua backend và quyền tài khoản đã có.

Giới hạn thực tế:

- Trạng thái chọn ứng dụng nhận không chứng minh tin đã gửi. UI không thông báo “gửi thành công”; trường hợp đóng bảng chia sẻ và trường hợp hệ điều hành không cung cấp trạng thái được phân biệt.
- Ứng dụng nhận có thể từ chối văn bản, nhất là một số ứng dụng Meta/Facebook. Không cam kết tương thích mọi ứng dụng; dùng Sao chép khi cần. [Giới hạn do upstream công bố](https://pub.dev/packages/share_plus/versions/13.3.0).
- Vị trí nút được truyền cho popover iPad, nhưng bản iOS vẫn chưa build/ký/kiểm tra trên thiết bị.
- Unit/widget test dùng hàm chia sẻ giả lập để không gửi dữ liệu ra ngoài. Cần kiểm tra bảng chia sẻ hệ điều hành trên điện thoại thật trước khi phát hành.
- `flutter_animate` có phụ thuộc `flutter_shaders`, nhưng app chỉ dùng fade/move/scale, không kích hoạt shader hay tải nội dung từ mạng.

## Bằng chứng kiểm tra

Ngày 27/09/2026: **28/28 test đạt**, kiểm tra giao diện bổ sung đạt; `flutter analyze` sạch; Android debug build thành công trong 283,2 giây. Mã versionName `0.2.0`, versionCode `2`. Ảnh `outputs/plugin-upgrade-share-preview.png` được kết xuất từ luồng widget thật, không phải ảnh chụp điện thoại.

- `outputs/plugin-upgrade-pub.log`: resolve đúng phiên bản.
- `outputs/plugin-upgrade-analyze.log`: phân tích mã nguồn.
- `outputs/plugin-upgrade-tests.log`: kiểm tra toàn bộ và tám test mới về giới hạn dữ liệu, chia sẻ chủ động, hủy/lỗi, reduced motion và kết thúc animation.
- `outputs/plugin-upgrade-build.log`: build Android debug cuối.

APK mới là bản 0.2.0+2 để kiểm tra; chưa phát hành cửa hàng và chưa thay thế bản đã giao trước đó. Hướng dẫn mở code và ghép backend giữ tại `README.md`.
