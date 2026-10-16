# V9 — Lumio Aurora và dữ liệu lưu bền

Ngày bắt đầu:17/10/2026, Asia/Bangkok. Baseline tài liệu `d758b38435bbc1cf5d4d48eca86f70455d8042b7`, runtime public `89ddd072f0d34ede54a55053c51f3c394783e5e9`, phiên bản3.4.0-rc.1/schema18, biên nhận5. Nhánh `codex/v9-aurora`. Người dùng yêu cầu triển khai V9, thêm database cho giáo viên/học sinh, public và nộp lại kèm minh chứng; vẫn giữ hosting Free và thanh toán thật tắt.

## Kiểm toán và hướng thống nhất

Đã đọc đủ tệp V9 từ `6f2bf980-1d7e-45af-9ab3-6c8ec5fc73cc/Pasted text.txt` cùng yêu cầu và6 ảnh tham khảo. Ảnh là hướng cảm hứng, không phải bố cục cần sao chép. Giữ thương hiệu Lumio, các luồng học và nguồn đúng chủ sở hữu; không tạo lại ứng dụng hoặc hệ thống component thứ hai.

Next15/React19, TypeScript, CSS global nhiều lớp và module CSS; bộ nút/input/dialog, dark/light/system, motion và sidebar đã có. Token đang bị các lớp dark ghi đè lẫn nhau. Home V8 có composervànguồn nhưng phân cấp còn phẳng; banner dài; không có mục tiêu vẫn hiện0/0; loading có màn hình logo trống. Theme mặc định light dù đã có system. Kiểm toán cần sửa phần tương phản, motion và thời điểm ghi nhận hoạt động, không thêm số liệu mẫu.

Store hiện dùng SQLite đồng bộ, schema18/51 bảng/6 trigger và53 transaction callback. Lớp/bài nộp không có TTL. File server Render Free bị mất theo vòng đời host. Không thể giải quyết bằng giữ host thức, snapshot định kỳ hoặc tạo database mới rồi bỏ dữ liệu/UUID cũ. Cần database canonical bên ngoài, giữ giao dịch/phân quyền/credit/idempotency hiện có; lỗi kết nối phải fail closed, không fallback về file mới.

## Giai đoạn

1. **Nền thị giác:** gom token semantic vào lớp có sẵn; forest/violet/lime/mint/amber; hai theme dùng chung quy tắc; focus rõ, chữ phụ đủ tương phản. Motion150–220ms hover/180–260ms state/220–320ms panel; nâng tối đa2px, không scale/pulse liên tục; giảm chuyển động theo OS và người dùng.
2. **Home và trạng thái:** phân cấp heading/input/source/CTA, bản nháp không tự gửi; banner gọn có disclosure nhưng giữ cảnh báo quan trọng; card có một hành động chính, mục tiêu/chuỗi/biểu đồ từ dữ liệu thật. Skeleton chỉ khi đang chờ thật, không phần trăm giả. Theme trước paint, giữ preference cũ, theo system khi chưa chọn.
3. **Database:** probe remote libSQL chính thức có connection giữ transaction; cô lập network wait bằng Worker có deadline/quarantine, giữ API binding và core callbacks. Có giới hạn độ trễ main-thread cần đo rõ; không tuyên bố multi-instance production từ một adapter. Chỉ chọn sau kiểm tương thích/rollback/FK/CAS/mất ACK; provisioning Free và overages tắt, secret chỉ server. Cutover và kiểm lại dữ liệu sau process restart/redeploy là cổng bắt buộc.
4. **Nghiệm thu và bàn giao:** regression từng phần, test:all, TypeScript/build; UI320/375/390/430/tablet/laptop/desktop, dark/light/system/reduced-motion, keyboard, labels, tràn và hydration. Tiếp đó CI đúng commit, public auth/AI/DB persistence, ảnh/báo cáo có provenance, source/evidence ZIP đã kiểm hash/secret. Upload đúng thư mục Drive, kiểm metadata/listing/viewer rồi nộp đúng một lần mới; chỉ xác nhận khi cổng có biên nhận.

## Ranh giới

Không thêm merchant/trả phí, đổi scope OAuth Google, công khai DB/backup, tự nhận đã khôi phục dữ liệu cũ, tự tạo học sinh thật hoặc gắn hiệu quả học tập từ fixture. Database bền không đồng nghĩa backup/RPO/RTO. Nếu không lấy được snapshot cũ đã mất trên host, ghi nhận rõ; dữ liệu còn trong trình duyệt và quyền truy cập phải được giữ. Không triển khai adapter chỉ mới hoạt động trên local hoặc bỏ các kiểm tra integrity để chạy remote.

Trạng thái và kết quả thực tế được cập nhật tại [CHECKLIST](CHECKLIST.md), [database](DATABASE.md), [foundation](FOUNDATION.md). Tất cả cổng public/biên nhận V9 tách riêng khỏi kết quả V8.
