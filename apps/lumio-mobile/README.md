# Lumio AI — ứng dụng Flutter 0.3.0+3

Ứng dụng **native Flutter**, giao diện Material 3, không dùng WebView. Đây là bản Android debug để kiểm tra sản phẩm; chưa phát hành Google Play và chưa được kiểm tra trên điện thoại vật lý. Mã iOS có sẵn nhưng chưa build/ký trên macOS.

## Mở và chạy code

1. Cài Flutter stable và Android Studio/Android SDK, JDK 21; chạy `flutter doctor` để kiểm tra Android toolchain. Bản này được xây dựng với Flutter **3.47.5**, Dart **3.13.4**. Android tối thiểu **7.0 / API 24**.
2. Mở thư mục `lumio-mobile` bằng VS Code, cài extension Flutter và Dart. Mở Terminal ngay tại thư mục có `pubspec.yaml`.
3. Chạy:

```sh
flutter pub get
flutter analyze
flutter test
flutter devices
flutter run -d <device-id>
```

Nếu dùng bộ công cụ tại workspace hiện tại trên Windows, có thể thay `flutter` bằng `..\..\work\toolchains\flutter\bin\flutter.bat`. Đường dẫn này phụ thuộc vị trí giải nén; máy khác nên cài Flutter rồi thêm thư mục `flutter/bin` vào PATH.

Build bản thử Android:

```sh
flutter build apk --debug
```

APK nằm tại `build/app/outputs/flutter-apk/app-debug.apk`. Cài qua `adb install -r <đường-dẫn-apk>` hoặc chép APK sang điện thoại và mở bằng trình quản lý tệp. Bản debug chỉ phục vụ kiểm tra, có kích thước lớn hơn bản phát hành.

Bản release **không gắn chứng thư debug**. Trước khi phát hành cần chủ sở hữu cấu hình khóa upload riêng, ký AAB, hoàn thiện chính sách dữ liệu và kiểm tra thiết bị; không đưa keystore hoặc mật khẩu vào source ZIP. iOS cần macOS, Xcode, signing và tài khoản Apple phù hợp.

## Mới trong 0.3.0+3

- Trang Hôm nay và Studio học tập có thẻ hành động mới, màu kem/xanh rừng, điểm nhấn tím Lumio và xanh lime. Nhịp học hôm nay chỉ đánh dấu hoạt động đã lưu; mở app không tự tạo streak.
- Giữ trang và vị trí cuộn khi đổi tab. Trang chưa mở được tải khi cần; các trang ẩn dừng ticker animation. Từ khóa tìm và bộ lọc không mất khi quay lại Thư viện.
- Tìm tiếng Việt có hoặc không dấu, nhiều từ khóa, cả tiêu đề/nguồn/ghi chú/tóm tắt đã lưu. Có lọc thẻ, quiz, ghi chú và sắp xếp theo tên hoặc lần cập nhật. Chỉ mục chỉ ở bộ nhớ trong phiên app, không gửi mạng.
- Lật flashcard 3D ngắn, phản hồi đáp án quiz rõ màu và biểu tượng, vòng kết quả lấy điểm thật. Mặt ẩn của thẻ không xuất hiện trong cây accessibility.
- Vòng đồng hồ focus theo deadline thật, chuyển động ngắn khi tiến độ đổi và phản hồi hoàn thành sau khi đã lưu sự kiện; kết thúc sớm không nhận thành tích.
- **Cài đặt → Chuyển động**: Tự động / Nhẹ nhàng / Đầy đủ, lưu trên thiết bị. Chế độ nhẹ dùng fade ngắn và bỏ lật 3D; giảm chuyển động hoặc điều hướng hỗ trợ của hệ điều hành luôn được ưu tiên. Animation có điểm kết thúc, không có hiệu ứng nền chạy vô hạn.

Phạm vi, kiểm tra và ảnh widget thật: [MOTION-UPGRADE.md](docs/MOTION-UPGRADE.md). Các API, lưu trữ tài khoản và chia sẻ chủ động tiếp tục dùng cùng hợp đồng của bản trước.

## Đã thêm trong 0.2.0+2

- Chuyển động ngắn khi mở thư viện/tóm tắt và nhận phản hồi quiz; tắt theo cài đặt giảm chuyển động hoặc điều hướng hỗ trợ.
- Chia sẻ nguồn, ghi chú/bản nháp, tóm tắt hoặc đúng flashcard đang xem. Có màn hình xem trước, sửa đoạn văn, chọn ứng dụng nhận và sao chép dự phòng; không tự chia sẻ bản sao, token hay dữ liệu tài khoản.
- Tích hợp `flutter_animate` 4.5.2 và `share_plus` 13.3.0 từ nguồn chính thức. Xem [nguồn, giấy phép và giới hạn](docs/PLUGIN-UPGRADE.md).

## Đã có trong bản này

- Onboarding, tiếng Việt/English, chế độ sáng/tối/theo hệ thống, chuyển cảnh tôn trọng cài đặt giảm chuyển động.
- Thư viện học liệu trên thiết bị: dán văn bản, nhập `.txt`/`.md` UTF-8 tối đa 800 KB, chỉnh sửa, tìm kiếm, ghi chú, xóa và xuất/nhập bản sao JSON. Bài mẫu offline được ghi nhãn rõ.
- Tạo flashcard/câu hỏi thủ công; lật thẻ, tự đánh giá và lên lịch ôn; làm quiz, chấm điểm và lưu từng lần làm bài.
- Tiến độ dùng dữ liệu thực: chuỗi ngày học, hoạt động 7 ngày, số thẻ đến hạn, điểm quiz, phút tập trung. Mở ứng dụng/đăng nhập không tự tạo thành tích.
- Phòng tập trung: chọn 15/25/45 phút, tạm dừng/tiếp tục, chuông và chime, nghe thử, âm lượng, chọn âm thanh riêng tối đa 5 MB và 30 giây.
- Khi ghép với máy chủ đã cấu hình: AI Tutor theo học liệu, tóm tắt, tạo thẻ/quiz; hiển thị Markdown và công thức toán trong bài học, chat, thẻ, quiz và câu trả lời giọng nói.
- Giọng nói theo lượt: ghi âm → chủ động gửi chép lời → sửa văn bản → gửi câu hỏi → nghe câu trả lời. Có dừng/hủy yêu cầu, ba lựa chọn giọng đọc. Không phải hội thoại song công thời gian thực.

## Kết nối tài khoản và AI

Không đặt API key hoặc OAuth secret trong app. App dùng token thiết bị lưu bằng `flutter_secure_storage`; thư viện học tách theo máy chủ và tài khoản, chưa đồng bộ đám mây.

1. Chạy/cấu hình backend Lumio hoặc dùng máy chủ HTTPS của bạn. Đăng nhập Google/Facebook **trên web**, mở `/mobile`, tạo mã ghép có hạn 5 phút.
2. Trong app mở **Cài đặt → Kết nối tài khoản**, nhập đúng origin máy chủ (không thêm đường dẫn), dán mã ghép và xác nhận.
3. Kiểm tra trạng thái AI/giọng nói rồi mở học liệu để dùng. Tác vụ phụ thuộc quyền gói, credit và cấu hình máy chủ; lỗi được hiển thị, không thay bằng kết quả AI giả.
4. Token có hạn 7 ngày. Dùng nút **Thu hồi và ngắt kết nối** trong app hoặc thu hồi tại trang `/mobile`. Gỡ kết nối ngoại tuyến chỉ xóa token trên thiết bị, không thu hồi phiên trên máy chủ. Khi cần đổi máy chủ, ngắt tài khoản hiện tại trước; token cũ không được gửi sang origin khác.

Máy chủ demo công khai mặc định chỉ dùng xem giao diện và **không cho ghép thiết bị**. Để thử backend đang chạy trên PC qua USB:

```sh
adb reverse tcp:3000 tcp:3000
```

Sau đó dùng `http://127.0.0.1:3000` trong bản debug. Trình duyệt trên PC mở `http://localhost:3000/mobile` theo cấu hình OAuth của backend để tạo mã. App truy cập cùng máy chủ qua `127.0.0.1` nhờ adb reverse; mã ghép không bị ràng buộc vào hai tên host này. Android Emulator cũng có địa chỉ `http://10.0.2.2:3000` nhưng backend cần cho phép hostname đó; ưu tiên `adb reverse` để giữ cùng origin. Debug chỉ chấp nhận HTTP ở localhost/127.0.0.1/::1/10.0.2.2; bản release bắt buộc HTTPS. Client không tự theo redirect khi mang bearer token.

Các endpoint tích hợp:

| Endpoint | Mục đích |
| --- | --- |
| `POST /api/mobile/pair/exchange` | Đổi mã một lần lấy token; `expiresAt` là Unix milliseconds |
| `GET /api/mobile/account` | Tài khoản, hạn phiên, quyền tính năng và credit |
| `DELETE /api/mobile/account` | Thu hồi thiết bị hiện tại |
| `POST /api/ai` | Chat/tóm tắt/cards/quiz theo hợp đồng backend Lumio |
| `POST /api/voice` | Multipart âm thanh để chép lời hoặc JSON văn bản để đọc |

## Dữ liệu, quyền và giới hạn

- App xin quyền microphone khi bắt đầu ghi âm; có quyền Internet để kết nối máy chủ. Không yêu cầu quyền đọc toàn bộ bộ nhớ; tệp được chọn qua hộp thoại hệ thống.
- Token lưu an toàn riêng; học liệu, ghi chú và lịch sử là JSON cục bộ trong thư mục riêng của app, **không được mã hóa ở cấp ứng dụng**. Có bản lưu trước và khôi phục khi file hiện tại lỗi; lỗi không tự xóa thư viện.
- Bản sao JSON không chứa token, âm thanh hoặc khóa API. Bản native dùng định dạng riêng; chưa tự chuyển bản sao của web sang native. Nhập bản sao thay thế thư viện hiện tại sau xác nhận, không gộp; phiên tập trung đang chạy không được khôi phục từ bản nhập.
- Android backup/transfer tự động bị tắt để tránh sao chép token và dữ liệu tài khoản. Gỡ app có thể mất dữ liệu; nên xuất bản sao trước.
- Ghi âm tối đa 120 giây, backend tối đa 8 MB; đọc tối đa 3.000 ký tự. Không tự gửi âm thanh ngay sau khi ghi. File ghi âm/phát lại là tệp tạm.
- Chuông tập trung hoạt động khi app đang mở. Khi bị đưa nền/khóa màn hình, không cam kết báo đúng thời điểm; lúc mở lại app đối chiếu thời gian kết thúc và ghi nhận hoàn thành một lần. Chưa dùng foreground service hoặc exact alarm hệ điều hành.
- Bản native hiện nhận văn bản; chưa nhập trực tiếp PDF/video/website như bản web. Chưa có push notification, thanh toán trong app, đăng nhập OAuth native trực tiếp hoặc đồng bộ thư viện web–điện thoại.
- `flutter run -d chrome` chỉ là bản xem giao diện không lưu dữ liệu lâu dài và không ghép thiết bị. APK mới là luồng native có lưu tệp/secure storage/microphone.
- AI có thể sai; đối chiếu nội dung và công thức với tài liệu gốc. Phạm vi hiển thị toán và khả năng truy cập được ghi trong `docs/MATH.md`.

## Kiểm tra

**Bản 0.3.0+3 (03/10/2026):** `flutter analyze --no-pub` không có vấn đề; **40/40** kiểm thử đạt; APK Android debug build thành công trong **457,8 giây**. `aapt` xác nhận versionName `0.3.0`, versionCode `3`, minSdk `24`, targetSdk `36`; `apksigner verify` xác nhận chữ ký APK v2 debug hợp lệ. Nhật ký mới: `outputs/native-0.3-analyze.log`, `outputs/native-0.3-tests.log`, `outputs/native-0.3-build.log`, `outputs/native-0.3-signature.log`.

Các ảnh `outputs/native-0.3-home.png` và `outputs/native-0.3-study.png` đã được xem để kiểm tra bố cục. Không có thiết bị/emulator trong kết quả `adb devices -l` lúc kiểm tra; chưa thử phần cứng. Chỉ đổi giao diện và hành vi học cục bộ, không tạo kết quả API mới để minh họa. Xem [MOTION-UPGRADE.md](docs/MOTION-UPGRADE.md).

Nhật ký của bản 0.2.0+2 nằm tại `outputs/plugin-upgrade-analyze.log`, `outputs/plugin-upgrade-tests.log` và `outputs/plugin-upgrade-build.log`. Bộ kiểm tra bao gồm hợp đồng pairing, tách tài khoản, khôi phục dữ liệu, học tập, hiển thị toán, chia sẻ chủ động và khả năng truy cập. **Kết quả bản 0.2.0+2 (27/09/2026): 28/28 test đạt, kiểm tra UI sau sửa copy đạt, `flutter analyze` không có vấn đề và APK Android debug build thành công (283,2 giây).** Bảng chia sẻ hệ điều hành vẫn cần kiểm tra trên điện thoại thật; widget test không gửi nội dung ra ứng dụng khác.

Ảnh `outputs/ui-preview.png` được kết xuất từ widget Flutter thật bằng kiểm tra tự động, không phải ảnh chụp điện thoại. Các kiểm tra mock không thay thế việc thử microphone, secure storage, phát chuông, vòng đời nền và ghép tài khoản trên thiết bị thật.

## Cấu trúc và thư viện

- `lib/core/`: model, lưu dữ liệu, trạng thái và HTTP API.
- `lib/ui/`: trang học liệu, luyện tập, focus, voice, cài đặt và toán.
- `lib/main.dart`: theme, ngôn ngữ và điều hướng native.
- `test/`: kiểm tra logic, hợp đồng và giao diện.
- `android/`, `ios/`: dự án nền tảng; `web/`: scaffold xem trước.

Dùng Flutter/Material 3, `http`, `http_parser`, `crypto`, `path_provider`, `flutter_secure_storage`, `record`, `just_audio`, `file_picker`, `flutter_math_fork`, `flutter_animate`, `share_plus`. Phiên bản chính xác nằm trong `pubspec.lock`; giấy phép gói được xem tại trang **Giấy phép** trong app và nguồn pub.dev tương ứng. Âm chuông/chime được tổng hợp riêng; logo là tài sản Lumio do chủ dự án cung cấp. Không đóng gói thông tin bí mật của backend.
