# Thư viện chuyển động và giao diện Lumio

Đối chiếu nguồn chính thức ngày **27/09/2026**. Phiên bản dưới đây là phiên bản quan sát trên trang nguồn tại thời điểm kiểm tra; không đồng nghĩa đã cài trong Lumio.

## Lựa chọn cho bản nâng cấp này

Bản web 1.3 dùng CSS/WAAPI cho các hiệu ứng sẵn có và **Motion 13.4.4** cho hộp tìm nhanh. Bản Android 0.2 dùng **flutter_animate 4.5.2** cho chuyển động ngắn và **share_plus 13.3.0** để mở menu chia sẻ của hệ điều hành. Đây là các package đã có trong lockfile và code, tách biệt với công cụ phát triển Playwright CLI, SkillUI, Ponytail và Supabase MCP.

| Package               | Dùng trong Lumio                                                         | Nguồn và giấy phép                                                                                                    |
| --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Motion 13.4.4         | Motion mini/DOM animate, hiệu ứng mở palette; tôn trọng giảm chuyển động | [Tài liệu](https://motion.dev/docs/react), [MIT](https://github.com/motiondivision/motion/blob/main/LICENSE.md)       |
| cmdk 1.1.1            | Điều hướng bàn phím, chọn kết quả tìm kiếm trong native dialog           | [GitHub](https://github.com/dip/cmdk), MIT                                                                            |
| flutter_animate 4.5.2 | Hiện bài học/tóm tắt và phản hồi quiz; không chạy lặp vô hạn             | [Package](https://pub.dev/packages/flutter_animate), [BSD-3-Clause](https://pub.dev/packages/flutter_animate/license) |
| share_plus 13.3.0     | Người dùng xem trước, sửa nội dung rồi mở menu chia sẻ text              | [Package](https://pub.dev/packages/share_plus), [BSD-3-Clause](https://pub.dev/packages/share_plus/license)           |

Flutter SDK vẫn cung cấp Material, route transitions và các điều khiển nền tảng. Không dùng asset hoặc mẫu trả phí Motion+. Nội dung chia sẻ chỉ là tiêu đề + đoạn đã chọn; không tự gửi token, backup, lịch sử hoặc toàn bộ thư viện.

MIT và BSD yêu cầu giữ thông báo giấy phép/bản quyền trong phân phối theo điều kiện của từng giấy phép. BSD còn có điều kiện không dùng tên tác giả để ngụ ý bảo trợ. Giấy phép MIT của Motion core không tự mở rộng sang mọi tài sản, mẫu hoặc sản phẩm Motion+ trả phí. Khi thêm package, giữ nguyên license đi kèm và ghi rõ phiên bản trong lockfile; không chép asset demo từ trang thư viện vào sản phẩm.

## Các điểm thực thi trong web

- `app/motion-v2.css`: entrance 380–420 ms, stagger giới hạn 210 ms, hover chỉ dành cho con trỏ chính xác; chế độ giảm chuyển động tắt các hiệu ứng mới. Skeleton chỉ xuất hiện khi có tải thật, không có phần trăm/ETA tự đặt.
- `components/lumio/experience-v2.tsx`: `PageTransition` giữ nguyên state của các component con; hủy WAAPI khi người dùng bật giảm chuyển động. `ExperienceSkeleton` nhận nhãn có nghĩa. `ExperienceHub` cung cấp hướng dẫn điện thoại bằng 5 ngôn ngữ.
- Studio: công cụ mở ra nhận focus, Escape đóng và trả focus về nút mở; các nút có trạng thái mở rõ ràng. Màn hình kế hoạch phân biệt thư viện mục tiêu trống với bộ lọc không có kết quả.
- Dashboard hiển thị tiến độ dựa trên mục tiêu thật; không mô phỏng số liệu, streak hay phần trăm hiệu quả học tập.

## Tích hợp và trạng thái điện thoại

```tsx
<ExperienceHub
  locale={locale}
  publicDemo={config.publicDemo}
  pairingAvailable={!config.publicDemo}
/>
<PageTransition transitionKey={page}>{pageContent}</PageTransition>
```

Chỉ truyền `pairingAvailable` khi route `/mobile` đã sẵn sàng. `androidRelease` là prop tùy chọn `{href, version, verified: true}`; chỉ truyền sau khi đã kiểm tra tệp APK thật. Component chỉ chấp nhận đường dẫn cùng website hoặc HTTPS đến `.apk`, không dựng liên kết tải giả. Mặc định hiển thị chưa có bản tải. Việc có APK không đồng nghĩa đã phát hành Google Play. Chưa có liên kết App Store trong component này.

Nút cài web chỉ xuất hiện khi trình duyệt gửi `beforeinstallprompt`. Không suy đoán website đã đáp ứng tiêu chí cài chỉ vì mở được trên điện thoại. Nếu không có sự kiện, người dùng nhận hướng dẫn menu Chrome hoặc Safari phù hợp. Nút được bấm mới mở yêu cầu cài; không tự bật prompt. Đã chấp nhận prompt cũng không được coi là đã cài cho đến khi có trạng thái/sự kiện trình duyệt tương ứng. [Hướng dẫn khả năng cài của Chrome](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest).

Thư viện trong trình duyệt vẫn là dữ liệu cục bộ. Thêm lối tắt, đăng nhập hay kết nối thiết bị không tự đồng bộ các tệp học. Bản public demo có thể dùng giao diện/công cụ cục bộ nhưng không được quảng bá là đã bật đăng nhập và AI trực tuyến.

## Kiểm tra cần giữ khi phát hành

Kiểm tra ở 375 px và desktop, sáng/tối, bàn phím, tùy chọn giảm chuyển động; xác nhận liên kết APK thật trước khi công bố. Kiểm tra TypeScript không thay thế đo hiệu năng trên thiết bị Android thật, và mở được trang trong trình duyệt không phải bằng chứng ứng dụng đã có trên cửa hàng.
