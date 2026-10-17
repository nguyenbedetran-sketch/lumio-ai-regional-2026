# Teacher và Classroom dùng giao diện chung

Trạng thái kiểm tra cục bộ: **PASS**. Đây là pha CSS riêng sau bản kiểm tra vai trò V9 trước đó; các báo cáo/ảnh đã chấp nhận ở thư mục cũ không bị ghi đè.

## Thay đổi

Runtime chỉ đổi `app/teacher/workspace.css`. Trước chỉnh sửa có **79 khối quy tắc / 87 lần xuất hiện selector chứa 122 khai báo màu cố định**, gồm tám biến nền, màu chữ, trạng thái, chi tiết trang trí và bản in. Các màu màn hình được chuyển tại quy tắc gốc sang token chung `--lm-*`; `--tw-*` chỉ còn là tên tương thích trỏ tới token chung.

| Vai trò                           | Token dùng lại                                                               |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Nền, bề mặt, chữ, chú thích       | `--lm-canvas`, `--lm-surface`, `--lm-soft`, `--lm-text`, `--lm-muted`        |
| Nút chính                         | `--lm-primary`, `--lm-on-primary`, `--lm-primary-line`, `--lm-primary-hover` |
| Viền điều khiển và focus bàn phím | `--lm-control-line`, `--lm-focus`                                            |
| Trạng thái / hỗ trợ AI            | `--lm-success*`, `--lm-warning*`, `--lm-error*`, `--lm-ai*`                  |
| Thanh dữ liệu có sẵn              | `--lm-chart-1`; không thay giá trị hay cách tính                             |

Không thêm thư viện, JavaScript chọn theme, trạng thái học, tiến độ giả hoặc bộ màu sáng/tối thứ hai. Thuộc tính theme và lựa chọn hệ thống dùng cơ chế chung đã có. Kích thước, bố cục, responsive và các luồng lưu/duyệt/giao/chấm giữ nguyên. Nút chính đổi màu chữ đồng thời với nền tương ứng, không đảo màu trắng hàng loạt.

Bản in có ghi đè mực trên giấy trắng trong phạm vi Teacher/Classroom; không thừa hưởng chữ sáng/nền phụ tối từ theme màn hình. Chuyển động vào trang và hover tôn trọng cài đặt giảm chuyển động của hệ điều hành và lựa chọn người dùng. Chữ placeholder, trạng thái, nút đóng dialog và focus native được kiểm tra cùng điều khiển.

## Kết quả

Lệnh: `node scripts/test-v9-teacher-theme-ui.cjs`.

| Luồng React thực tế, HTTP giả lập                             | Kiểm tra thao tác trình duyệt | Trường hợp theme/layout |
| ------------------------------------------------------------- | ----------------------------: | ----------------------: |
| Giáo viên và học sinh                                         |                           129 |                      22 |
| Lịch sử chấm, điều chỉnh, công bố, mất quyền và phản hồi chậm |                            47 |                      22 |
| Soạn/sửa bài giao theo ma trận và đường lưu CAS hiện có       |                            19 |                      11 |
| **Tổng**                                                      |                       **195** |                  **55** |

Bộ fixture chung còn chạy **32 kiểm tra SSR/hàm thuần**, dùng chung giữa các lượt, không tính thành 96 kiểm tra độc lập. Các ma trận lấy computed style thật ở **320 / 390 / 768 / 1440 px** trong light và dark, không có thuộc tính theme với hệ điều hành light/dark, và bản in xuất phát từ dark. Gồm dashboard, lớp học, bảng soạn đề và dialog lịch sử giáo viên/học sinh. Chuyển động tắt theo lựa chọn người dùng được đo bằng tên animation thực tế; kiểm tra giảm chuyển động hệ điều hành có sẵn vẫn qua.

- **1.663 mẫu chữ** trong các trạng thái/viewport đã đo; tỷ lệ nhỏ nhất **4,87:1**. Ngưỡng: 4,5:1 cho chữ thường, 3:1 cho chữ lớn.
- **97 mẫu viền input/select/textarea/search có ý nghĩa**; nhỏ nhất **3,64:1**, ngưỡng 3:1. Điều khiển vô hiệu hóa và input không viền bên trong search không bị tính như viền độc lập.
- Focus bàn phím trong các trạng thái màn hình có outline ít nhất 2 px và tương phản đạt 3:1. Không có tràn ngang toàn trang ở các viewport đã kiểm tra; bảng/dialog vẫn giữ cơ chế cuộn nội bộ.
- Bản in sau dark có nền trắng và chữ đủ tương phản. Đã sửa tình huống alias `--lm-soft` kế thừa nền tối mặc dù biến bề mặt gốc đã đổi sang trắng.
- CSS SHA-256: `950353c0fb2319f75457fa1b31d2b693c170fcd8b6e602122155bc892ed582f6`.

Báo cáo riêng: [giáo viên/lớp học](teacher-teaching-report.json), [lịch sử điểm](teacher-grade-history-report.json), [soạn đề](teacher-assessment-report.json). Mỗi báo cáo có hash workspace CSS và toàn bộ CSS fixture dùng khi chạy.

## Ảnh đã kiểm tra trực quan

- [Giáo viên dark desktop](teacher-teacher-dark-1440.png) và [light điện thoại](teacher-teacher-light-390.png).
- [Classroom dark điện thoại](teacher-classroom-dark-390.png).
- [Soạn đề dark điện thoại](teacher-assessment-editor-dark-390.png) và [light điện thoại](teacher-assessment-editor-light-390.png).
- [Lịch sử giáo viên dark điện thoại](teacher-grade-history-teacher-dark-390.png) và [lịch sử học sinh light desktop](teacher-grade-history-student-light-1440.png).

Ảnh giữ nhãn **KIỂM THỬ** và dữ liệu tổng hợp. Outline focus xuất hiện do thao tác bàn phím trong kiểm tra. Dialog dài cuộn trong khung; phần dưới viewport trong ảnh full-page không đại diện cho một dialog mở dài vượt màn hình.

## Giới hạn bằng chứng

Đây là các component React/CSS hiện tại trong phiên Edge cô lập, với tài khoản/lớp/điểm/HTTP giả lập có chủ đích. Không gọi server công khai, provider, tài khoản thật hoặc cơ sở dữ liệu riêng. Các con số không chứng minh kiểm thử thiết bị Android/iOS, mọi trạng thái có thể có, kiểm toán WCAG toàn diện, độ chính xác chấm bài hoặc học sinh thật sử dụng hiệu quả. Quyền/transaction/backend có báo cáo riêng; pha này không thay hoặc tái chứng nhận chúng. Menu select hệ điều hành chỉ được đo ở trạng thái điều khiển hiển thị, không chứng nhận mọi popup native của mọi hệ điều hành.
