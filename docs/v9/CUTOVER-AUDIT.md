# Kiểm tra bảo toàn dữ liệu trước khi chuyển database

Ngày ghi nhận: **17/10/2026**. Trạng thái: **BLOCKED đối với tuyên bố di chuyển đầy đủ dữ liệu đang chạy**. Chưa có quyết định cho phép bỏ dữ liệu cũ.

## Phạm vi và bằng chứng

Đã đọc mã nguồn chính xác tại commit `89ddd072f0d34ede54a55053c51f3c394783e5e9`, gồm toàn bộ cây route API, các route quản trị/giáo viên/đồng bộ liên quan, hàm xuất dữ liệu và công cụ snapshot. Không chạy lệnh trên database thật, không đọc thông tin xác thực, không dùng trình duyệt và không thay đổi dịch vụ trong cuộc kiểm tra mã nguồn này.

Hợp đồng trong `lib/server/database-integrity.ts` của commit đó khai báo **schema 18, 51 bảng**. Đây là thông tin của mã nguồn, **không phải kết quả kiểm tra cấu trúc hoặc nội dung của database công khai đang chạy**. Tên `adminSnapshot` chỉ là đối tượng dữ liệu hiển thị trang quản trị, không phải bản snapshot SQLite.

Thông tin người điều phối đã kiểm tra trực tiếp trên giao diện trước chuyển đổi:

- Quản trị đang hiển thị **1 tài khoản quản trị, 2 yêu cầu AI, 8 sự kiện audit**.
- Trong tổ chức kỹ thuật V8 thuộc phạm vi tài khoản đang đăng nhập: **1 lớp, 0 học sinh và 0 bài nộp/chờ chấm hiển thị**.
- Dịch vụ Render Free hiện tại không có SSH/shell hoặc bước pre-deploy khả dụng để lấy tệp database; giới hạn này do người điều phối xác minh riêng, không suy ra từ mã ứng dụng.

Các số đếm trên **không chứng minh toàn hệ thống không có dữ liệu lớp học, bài làm hay bản ghi khác**. Quyền quản trị hệ thống không tự cấp quyền đọc mọi tổ chức. Route giáo viên chỉ trả phạm vi thành viên/lớp có quyền; một số nội dung đã lưu trữ không nằm trong danh sách trả về.

## Cơ chế xuất đã có trong mã đang triển khai

| Cơ chế                                                    | Dữ liệu giữ được                                                                                         | Giới hạn đối với chuyển database                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Cài đặt người học → bản sao JSON                          | Thư viện trình duyệt, trạng thái học và tùy chọn có thể đọc được của tài khoản trên thiết bị đó          | Không phải database máy chủ; bỏ tệp PDF/ảnh/audio/video gốc; không chứa tài khoản, quan hệ lớp, sổ credit hoặc phiên máy chủ |
| Giáo viên → học liệu `.txt`, giáo án `.md`                | Văn bản từng học liệu/giáo án được phép xem                                                              | Không giữ đầy đủ bản ghi, quyền, revision, lịch sử và quan hệ database                                                       |
| Giáo viên → Báo cáo → CSV / In hoặc lưu PDF               | Các kết quả đã công bố đang hiển thị trong phạm vi được phép                                             | Không bao gồm toàn bộ đáp án bài nộp, bản chụp câu hỏi, điểm chưa công bố hoặc lịch sử chấm đầy đủ                           |
| `GET /api/teaching/export?orgId=…&format=json` hoặc `csv` | Các dòng bảng điểm trong phạm vi quyền, có một số mã đối tượng/thời điểm                                 | JSON vẫn chỉ là bảng điểm; không phải bản sao tổ chức/lớp; route còn ghi sự kiện `TEACHING_GRADES_EXPORTED`                  |
| Các GET quản trị có phân quyền                            | Các trường tài khoản, audit, metadata sử dụng AI, cờ tính năng hoặc hồ sơ giáo viên mà endpoint cho phép | Phép chiếu dữ liệu có giới hạn/phân trang; không bao phủ mọi bảng, ánh xạ đăng nhập, ledger, receipt và lịch sử riêng tư     |

Không tìm thấy chức năng tải database trong bốn component quản trị của commit này. Cây route không có endpoint xuất snapshot SQLite, chạy SQL hoặc nhập/khôi phục toàn bộ database. Các API đọc dữ liệu riêng theo tài khoản không hợp thành một giao thức sao lưu nhất quán.

Đặc biệt, **không coi mọi GET là thao tác xuất thụ động**: GET đồng bộ có thể tạo snapshot rỗng và dọn dữ liệu hết hạn; GET hàng đợi tóm tắt có thể đối soát/kích hoạt worker và dẫn đến gọi AI. Chưa thực hiện các thao tác này trong cuộc kiểm tra.

## Vì sao chưa thể khôi phục nguyên trạng qua UI

- `scripts/database-snapshot.cjs:1,32–51` là CLI dành cho người vận hành có quyền truy cập tệp. Nó dùng `VACUUM INTO`, không cung cấp endpoint web và không thay database đang chạy. Không có shell/tệp nguồn thì UI hiện tại không gọi được công cụ này.
- `lib/server/teaching-core.ts:2531` chỉ xuất dòng bảng điểm. `components/teaching/assessment.tsx:996–1080` chỉ xuất kết quả đã công bố qua CSV/in; `components/teaching/content.tsx:590,1258` xuất từng giáo án/học liệu.
- `lib/teaching/contracts.ts:355+` không có thao tác nhập toàn bộ dữ liệu máy chủ. Tạo tổ chức/lớp/nội dung thông thường cấp mã mới trên máy chủ, không phải khôi phục mã lịch sử.
- `lib/server/store.ts:254+` tạo `users.id` mới bằng UUID khi tài khoản đăng nhập chưa tồn tại trong database. Cùng tên/email hoặc khóa tài khoản phía trình duyệt không bảo toàn mọi quan hệ dùng UUID cũ.
- `lib/server/teaching-core.ts:686+` đọc theo quyền tổ chức/lớp và lọc nội dung; quyền quản trị hệ thống không phải quyền xuất toàn bộ database. Lịch sử điểm dùng endpoint phân trang riêng.

Vì vậy, lưu lại các số đếm, ảnh trang quản trị hoặc một số JSON/CSV **không đủ** để khôi phục đầy đủ quan hệ tài khoản, bài giao, bài nộp, lịch sử chấm, credit, trạng thái chống xử lý trùng và nhật ký bất biến.

## Điều kiện để quyết định chuyển đổi

**Phương án bảo toàn đầy đủ:** cần lấy bản snapshot riêng tư từ **đúng instance đang chạy, trước mọi triển khai lại có thể làm mất tệp**, kiểm tra tính toàn vẹn và nhập vào database đích theo một quy trình có kiểm chứng. Phải giữ UUID, khóa ngoại, ánh xạ đăng nhập, revision, ledger/receipt, lịch sử và các ràng buộc bất biến; đối chiếu sau nhập trước khi chuyển lưu lượng. Giữ cấu hình ký/xác thực tương thích qua kênh bảo mật, không ghi giá trị vào báo cáo. Chưa có bằng chứng đã thực hiện phương án này.

**Phương án khởi tạo database mới:** chỉ thực hiện nếu người vận hành **chủ động cho phép**, sau khi đã được thông báo rõ dữ liệu nào xuất được và dữ liệu máy chủ cũ nào chưa di chuyển. Lưu các bản xuất riêng tư khả dụng và biên bản phạm vi thiếu. Gọi đúng là **khởi tạo database mới, dữ liệu cũ chưa được di chuyển đầy đủ**; không gọi là migration thành công hoặc khẳng định không mất dữ liệu. Cuộc kiểm tra này không tự cấp phép phương án đó.

Thêm endpoint bằng một lần triển khai mới không giúp lấy lại tệp của instance cũ nếu bước triển khai đã làm mất nó. Giữ dịch vụ cũ trong khi tìm đường lấy snapshot có thể tránh một thay đổi chủ động, nhưng bản thân hosting tạm không tạo bảo đảm lưu trữ lâu dài hoặc sao lưu.

**Kết luận hiện tại:** chưa chứng minh được đường chuyển đổi đầy đủ qua các chức năng đã triển khai. Không chuyển database với tuyên bố bảo toàn dữ liệu cho tới khi có snapshot hợp lệ hoặc quyết định khởi tạo mới được chấp nhận rõ ràng cùng danh sách dữ liệu cũ chưa di chuyển.
