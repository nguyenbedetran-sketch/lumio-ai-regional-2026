# Lumio Android 0.3.0+3 — ngày 03/10/2026

## Chuyển động đi cùng thao tác học

| Vị trí | Thay đổi | Nguồn dữ liệu |
| --- | --- | --- |
| Hôm nay | Hero xanh rừng, thẻ chỉ số, nhịp học hôm nay | Sự kiện đọc, ôn thẻ và hoàn thành focus đã lưu |
| Điều hướng | Fade/slide ngắn; giữ trang đã mở bằng IndexedStack; chỉ dựng trang mới khi mở lần đầu | Lựa chọn tab của người dùng |
| Thư viện | Thẻ học liệu mới, tìm không dấu, bộ lọc và hai thứ tự sắp xếp | Nội dung trên thiết bị |
| Studio | Thẻ tóm tắt, flashcard, quiz, gia sư và giọng nói có mô tả | Các tác vụ đã có; kết quả AI chỉ xuất hiện sau phản hồi máy chủ |
| Flashcard | Lật 3D 440 ms, chỉ dựng mặt đang thấy, tiến độ lượt ôn | Thẻ đến hạn và đánh giá đã lưu |
| Quiz | Phản hồi đáp án bằng màu/icon, khóa lựa chọn sau lần trả lời, vòng kết quả | Đáp án thật và QuizAttempt đã lưu |
| Focus | Vòng tiến độ và vạch đồng hồ, thời gian còn lại tính từ deadline, phản hồi hoàn thành | FocusSession và sự kiện focus đã lưu một lần |

Không tự tạo điểm, credit, streak hoặc kết quả AI cho hiệu ứng. Focus vẫn là đồng hồ trong app: chưa có dịch vụ nền/exact alarm và không cam kết phát chuông đúng lúc khi khóa màn hình.

## Tùy chọn và accessibility

- **Tự động**: chuyển động đầy đủ khi thiết bị cho phép; giảm chuyển động hoặc điều hướng hỗ trợ tắt animation tùy biến.
- **Nhẹ nhàng**: entry fade tối đa 160 ms, không dịch chuyển/scale/lật 3D.
- **Đầy đủ**: entry có dịch chuyển nhẹ, thẻ lật 3D và phản hồi hành động. Cài đặt thiết bị vẫn ưu tiên.
- Tùy chọn lưu trong `settings.json`, tách khỏi thư viện và bản sao học tập. Bản cũ thiếu tùy chọn tự dùng Tự động.
- Không có animation lặp vô hạn. Khi đổi tab, ticker của trang ẩn bị tắt; search/filter/scroll của trang đã mở được giữ. Widget thử cỡ chữ 130% ở chiều rộng 360 px, sáng và tối.
- Trong lật thẻ, mặt chưa thấy không nằm trong cây widget/semantics; đáp án được đánh dấu vùng cập nhật khi hiện. Quiz dùng biểu tượng cùng chữ, không chỉ dùng màu.

## Thư viện

Tiếp tục dùng `flutter_animate` **4.5.2**, Flutter/Material và `share_plus` **13.3.0** đã có; không thêm package hoặc dịch vụ mới. Xem nguồn và giấy phép trong [PLUGIN-UPGRADE.md](PLUGIN-UPGRADE.md). `CardReveal`, `TabReveal` và vòng focus được viết bằng widget/canvas Flutter trong repo.

Tìm học liệu chuẩn hóa chữ hoa/thường, dấu tiếng Việt và dấu Unicode dạng phân tách. Các từ trong truy vấn đều phải có trong tiêu đề, nội dung, ghi chú hoặc tóm tắt. Chỉ mục ở bộ nhớ, được cập nhật khi học liệu thay đổi và bỏ khi học liệu bị xóa; không được lưu hay gửi đến dịch vụ ngoài. Bộ lọc còn lựa chọn sau khi đổi tab trong cùng phiên app.

## Kiểm tra và mở code

Các kiểm tra mới nằm tại `test/motion_upgrade_test.dart`: ghi và đọc lại tùy chọn, accessibility override, tìm không dấu, giữ trạng thái điều hướng, lật và ghi nhận ôn thẻ, đáp án quiz khóa đúng và lưu kết quả một lần, vòng focus, bố cục phone width/chữ lớn và xuất ảnh widget.

Kết quả bản này ngày **03/10/2026**:

- `flutter analyze --no-pub`: không có vấn đề.
- `flutter test --no-pub`: **40/40** đạt, gồm 12 kiểm tra mới và 28 kiểm tra hiện có.
- `flutter build apk --debug --no-pub`: thành công, **457,8 giây**.
- APK: **168.774.375 bytes**, `edu.lumio.lumio_mobile`, versionName `0.3.0`, versionCode `3`, minSDK `24`, targetSDK `36`; ABI `arm64-v8a`, `armeabi-v7a`, `x86_64`.
- SHA256 APK: `5f4b44e6f31e4f961bbfb4e255904d538398dbece6b12ceb4a9b1fdee8ad8c3f`.
- `apksigner verify`: chữ ký v2 debug hợp lệ. APK vẫn là bản thử, không phải bản ký phát hành Google Play.
- `adb devices -l`: danh sách trống; chưa kiểm tra điện thoại/emulator.

Nhật ký trong thư mục `outputs`: `native-0.3-analyze.log`, `native-0.3-tests.log`, `native-0.3-build.log`, `native-0.3-signature.log`. Build có cảnh báo khác phiên bản SDK XML giữa Android tools nhưng Gradle và xác minh APK đều hoàn thành; không dùng cảnh báo đó làm kết quả kiểm tra thiết bị.

Chạy ở thư mục chứa `pubspec.yaml`:

```sh
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter devices
flutter run -d <device-id>
```

Nguồn theme và điều hướng: `lib/main.dart`; motion policy: `lib/core/motion.dart`; widget chuyển động: `lib/ui/study_motion.dart`; màn hình: `lib/ui/`. APK debug nằm tại `build/app/outputs/flutter-apk/app-debug.apk`.

Ảnh `outputs/native-0.3-home.png` và `outputs/native-0.3-study.png` được kết xuất từ Flutter thật với nội dung ví dụ được ghi nhãn. Đây là ảnh widget test 430 × 932 logical pixels, không phải ảnh chụp điện thoại hoặc emulator. Kết quả kiểm tra thiết bị, microphone, loa/Bluetooth, secure storage, hệ thống chia sẻ và vòng đời nền cần thử trên Android thật.
