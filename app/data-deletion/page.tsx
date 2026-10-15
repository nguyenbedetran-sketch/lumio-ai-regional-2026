import { PolicyShell } from "../../components/lumio/policy-shell";
import { pageMetadata } from "../../lib/metadata";
export const metadata = pageMetadata({
  title: "Xóa dữ liệu",
  description:
    "Hướng dẫn xóa dữ liệu học trên thiết bị, thu hồi đăng nhập và xử lý dữ liệu tài khoản trong Lumio AI.",
  path: "/data-deletion",
});
export default function DataDeletionPage() {
  return (
    <PolicyShell
      title="Bạn muốn xóa dữ liệu?"
      subtitle="Dữ liệu trên thiết bị và dữ liệu tài khoản trên máy chủ cần được xử lý riêng."
      updatedAt="15/10/2026"
    >
      <section>
        <h2>1. Xóa nội dung học trên thiết bị</h2>
        <p>
          Trong Lumio, mở từng nội dung và chọn biểu tượng xóa để xóa nội dung
          đó khỏi thư viện đang dùng. Để xóa toàn bộ dữ liệu của Lumio trên
          thiết bị, mở phần cài đặt quyền riêng tư của trình duyệt, tìm dữ liệu
          trang web của đúng địa chỉ Lumio bạn đang dùng, rồi xóa dữ liệu trang
          này. Bước đó cũng có thể đăng xuất tài khoản và xóa kế hoạch, lịch ôn,
          tùy chọn, phản hồi cá nhân hóa cùng tệp và chuông riêng đã lưu tại
          trình duyệt. Tắt cá nhân hóa chỉ ngừng dùng lịch sử/feedback để xếp
          hạng, không xóa phản hồi đã lưu.
        </p>
        <p>
          Để chỉ xóa phản hồi sở thích và đánh giá sau học, mở Đề xuất cho bạn
          rồi chọn “Xóa phản hồi đã lưu”. Tùy chọn chủ đề/độ khó/mục tiêu, lịch
          sử học và điểm quiz vẫn còn; bạn có thể sửa các tùy chọn hoặc tắt cá
          nhân hóa riêng. Thao tác chỉ áp dụng tài khoản đang dùng trên trình
          duyệt này, không xóa dữ liệu của tài khoản khác.
        </p>
        <p>
          Hãy xuất bản sao và giữ tệp gốc trước nếu bạn còn cần chúng. Việc xóa
          trên thiết bị này không xóa bản xuất JSON, tệp tải về hoặc dữ liệu còn
          lưu trên thiết bị khác.
        </p>
      </section>
      <section>
        <h2>2a. Xóa phiên gia sư trên máy chủ</h2>
        <p>
          Công cụ quản lý phiên gia sư cho phép tài khoản đang đăng nhập xem và
          xóa phiên của chính mình. Xóa phiên loại bỏ đề bài, hội thoại và tiến
          trình mở lời giải trong phiên đó; không xóa thư viện cục bộ, danh tính
          đăng nhập, credit hoặc nhật ký vận hành. Phiên hết hiệu lực sau 7 ngày
          và được dọn khi truy cập; hiện chưa có lịch xóa nền tự động. Nếu muốn
          xóa dữ liệu máy chủ khác, thực hiện yêu cầu xử lý tài khoản dưới đây.
        </p>
      </section>
      <section>
        <h2>2. Thu hồi Google hoặc Facebook</h2>
        <p>
          Trong cài đặt tài khoản Google, mở phần kết nối với ứng dụng và dịch
          vụ bên thứ ba, chọn Lumio AI nếu có, rồi thu hồi kết nối. Trong
          Facebook, mở Cài đặt, tìm Ứng dụng và trang web, chọn ứng dụng Lumio
          và gỡ quyền truy cập.
        </p>
        <p>
          Thu hồi kết nối dừng quyền đăng nhập tương ứng; thao tác này không tự
          gửi yêu cầu xóa tài khoản tới máy chủ Lumio và không tự xóa thư viện
          cục bộ.
        </p>
      </section>
      <section>
        <h2>3. Yêu cầu xử lý tài khoản máy chủ</h2>
        <p>
          Liên hệ người phụ trách dự án qua kênh đã mời bạn dùng thử. Nêu rõ yêu
          cầu xóa tài khoản Lumio và dịch vụ đăng nhập đã dùng. Bạn có thể được
          yêu cầu xác minh mình là chủ tài khoản; không gửi mật khẩu hoặc mã
          OTP.
        </p>
        <p>
          Người phụ trách cần kiểm tra và thông báo phần dữ liệu tài khoản, liên
          kết đăng nhập, dữ liệu sử dụng, ví credit và nhật ký có thể xóa hoặc
          cần giữ lại, cùng lý do và thời gian dự kiến. Trang này chưa có chức
          năng tiếp nhận và hoàn tất yêu cầu xóa tự động. Nhật ký quản trị hiện
          được thiết kế chỉ ghi thêm, tương tự sổ credit, nên việc xử lý cần quy
          trình riêng; không nên hiểu rằng khóa tài khoản đã xóa toàn bộ dữ
          liệu.
        </p>
      </section>
      <section>
        <h2>4. Nội dung đã gửi tới dịch vụ xử lý</h2>
        <p>
          Dữ liệu đã gửi tới dịch vụ AI có thể chịu cơ chế lưu giữ riêng của nhà
          cung cấp. Xóa nội dung trong Lumio không đảm bảo các bản mà dịch vụ
          bên ngoài đã tiếp nhận được xóa ngay. Người phụ trách sẽ cần làm rõ
          phạm vi xử lý yêu cầu nếu có dữ liệu liên quan.
        </p>
      </section>
    </PolicyShell>
  );
}
