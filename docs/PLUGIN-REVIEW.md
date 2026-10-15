# Rà soát phần nâng cấp plugin

Ngày 27/09/2026. Phạm vi: code mới trong command palette, helper Supabase, wrapper SkillUI và app Flutter 0.2. Skill [Ponytail Review](../.agents/skills/ponytail-review/SKILL.md) được dùng để tìm phần phức tạp không cần thiết; đây không phải review bảo mật.

## Kết quả Ponytail (chỉ nhận xét)

`lib/lumio/command-copy.ts:L23: delete: allSearch/current chưa có nơi sử dụng ở cả năm locale. Bỏ 10 dòng nếu không thêm nút tương ứng.`

`net: -10 lines possible.`

Không gỡ kiểm tra input, bảo vệ tài khoản, giới hạn credit, focus/accessibility hoặc kiểm thử chỉ để làm code ngắn hơn. Không áp dụng tự động kết quả của skill.

## Đối chiếu kết quả SkillUI

Đã chạy `npm run design:audit` với SkillUI 1.3.4 trên bản sao chỉ chứa CSS và component giao diện. [Báo cáo gốc](design-audit/lumio-ui-design/DESIGN.md) và [danh sách file đầu vào](design-audit/scope.json) được giữ để xem lại. Không gửi env, database, tài liệu của người học hoặc thông tin đăng nhập cho công cụ.

Tool báo 20 màu, 24 component và 38 khai báo chuyển động. Đây là phân tích tĩnh: có thể gộp màu sáng/tối, nhầm `inherit` thành font và suy luận sai khoảng cách. Không coi các nhận xét tự sinh hoặc quy tắc trong báo cáo là yêu cầu thiết kế.

Quyết định áp dụng: command palette dùng các biến `--lm-text`, `--lm-muted`, `--lm-line`, `--lm-accent`, `--lx-card` của Lumio để đi cùng theme hiện có; không chép bảng màu tổng hợp từ báo cáo. Dùng font kế thừa, bo góc 24/19 px desktop/mobile, khoảng chạm từ 44 px cho nút mở. Chuyển động mở ngắn 180 ms, không chạy lặp hoặc trì hoãn đóng trang giọng nói. Tìm kiếm giữ dữ liệu trong bộ nhớ của tài khoản đang mở.

## Giới hạn thực tế

Supabase MCP là kết nối dành cho người phát triển; helper chỉ tạo cấu hình để xem trước, chưa chuyển SQLite sang Supabase hoặc đồng bộ thư viện. Strix chưa chạy. Bộ skill Parker chưa tải do cần email/newsletter. Hai trường hợp này không được tính là công cụ đã tích hợp thành công.
