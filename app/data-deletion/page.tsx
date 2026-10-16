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
      updatedAt="16/10/2026"
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
        <h2>1a. Snapshot kỹ năng, bản đồng bộ và chỉ mục nguồn</h2>
        <p>
          Trong Đề xuất cho bạn, “Xóa snapshot kỹ năng” chỉ bỏ dữ liệu snapshot
          dùng để tổng hợp bằng chứng kỹ năng khỏi thư viện của tài khoản trên
          thiết bị này. Điểm quiz, đáp án đã chọn và học liệu vẫn còn. Tắt tính
          hồ sơ không xóa snapshot; lần luyện mới có thể tạo bản ghi mới. Muốn
          xóa cả kết quả gốc, hãy xóa học liệu liên quan hoặc dữ liệu trang web.
          Những bản xuất/đồng bộ ở nơi khác cần được xử lý riêng.
        </p>
        <p>
          Xóa dữ liệu trang web trong trình duyệt không tự xóa bản đồng bộ hoặc
          chỉ mục trên máy chủ. Khi đang đăng nhập, nút Xóa học liệu trong Lumio
          còn yêu cầu xóa các bản chỉ mục của học liệu đó thuộc tài khoản bạn ở
          mọi không gian đã lập chỉ mục; nếu bước máy chủ thất bại, ứng dụng
          giữ học liệu để bạn thử lại. Công cụ tra cứu cũng cho phép xóa riêng
          từng tài liệu khỏi chỉ mục cùng các đoạn/vector liên quan mà giữ bản
          gốc trên thiết bị. Trong Cài đặt, công cụ đồng bộ có nút “Xóa bản máy chủ”:
          nút này xóa bản đồng bộ và dấu vết thao tác chống trùng của tài khoản,
          không xóa tài khoản, phiên gia sư hay sổ credit. Thiết bị khác phải
          đối chiếu lại trước khi gửi dữ liệu. Tắt đồng bộ hoặc đăng xuất không
          tự xóa bản máy chủ; yêu cầu xử lý dữ liệu khác theo hướng dẫn bên
          dưới.
        </p>
        <p>
          Bản đồng bộ có hạn 7 ngày từ lần ghi gần nhất; chỉ mục và snapshot
          truy xuất có thời hạn 7 ngày. Hết hạn được kiểm tra/dọn khi truy cập,
          chưa có lịch dọn nền. Máy chủ preview có thể reset sớm hơn; mất dữ
          liệu tạm không phải quy trình xóa có xác nhận. Xóa bản trên server
          không xóa tệp tải về, bản xuất hay bản còn trong trình duyệt/thiết bị
          khác. Dữ liệu đã gửi cho dịch vụ AI phải xét chính sách của họ riêng.
        </p>
      </section>
      <section>
        <h2>1b. Tác vụ tóm tắt chạy nền</h2>
        <p>
          Trong bảng Tóm tắt chạy nền, chọn Hủy để ngừng xử lý tiếp, rồi dùng
          Xóa với tác vụ đã dừng/hoàn tất để bỏ nội dung đầu vào, tiến độ và các
          kết quả từng phần trên máy chủ. Xóa tác vụ không xóa bản tóm tắt bạn
          đã lưu vào thư viện hoặc tải xuống. Yêu cầu AI đang gửi có thể đã được
          dịch vụ bên ngoài tiếp nhận; thao tác không thu hồi nội dung khỏi nhà
          cung cấp. Các tác vụ hết hiệu lực sau tối đa 7 ngày, dọn khi truy
          cập/worker bảo trì; máy chủ preview có thể mất dữ liệu sớm hơn.
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
        <h2>Dữ liệu lớp học và giảng dạy</h2>
        <p>
          Xóa thư viện hoặc dữ liệu trình duyệt không xóa lớp, bài giao, bài
          làm, điểm hay hồ sơ giáo viên trong cơ sở dữ liệu máy chủ. Đóng
          lớp, thu hồi mã mời hoặc xóa một bản nháp cũng không xóa mọi dữ
          liệu liên quan. Nếu cần xử lý dữ liệu lớp hoặc tài khoản học sinh,
          liên hệ giáo viên/người quản lý tổ chức và người phụ trách dự án
          để xác định quyền sở hữu, phạm vi và các bản xuất cần xử lý. Hiện
          chưa có quy trình tự động hoàn tất yêu cầu xóa toàn bộ lớp và
          nhật ký; không xem việc host miễn phí reset là xác nhận đã xóa.
        </p>
        <p>
          Lịch sử các lần chấm/công bố được thiết kế chỉ ghi thêm, không có nút
          tự xóa hoặc hạn bảy ngày. Sửa điểm hay cấp lần luyện lại giữ các bản
          trước, cùng lý do nội bộ và khung giờ đã lưu. Sao lưu cơ sở dữ liệu
          của người vận hành cũng có thể chứa dữ liệu riêng này; xóa thư viện,
          phiên gia sư, chỉ mục hoặc bản đồng bộ không xóa chúng. Người phụ
          trách phải xác định và thông báo phạm vi xử lý, không xem thao tác
          khóa tài khoản là xóa lịch sử điểm.
        </p>
      </section>
      <section>
        <h2>3. Yêu cầu xử lý tài khoản máy chủ</h2>
        <p>
          Nhật ký từng lần gọi AI là metadata liên kết tài khoản trên máy chủ,
          tách khỏi thư viện và hội thoại. Bản ghi đã kết thúc quá 31 ngày được
          dọn theo đợt khi có lượt gọi mới đủ quyền; bản ghi chưa rõ kết quả được
          giữ riêng, không có nút tự xóa hoặc lịch xóa đúng hạn. Xóa trên thiết bị
          không xóa nhật ký hay bản sao lưu máy chủ. Người phụ trách cần kiểm tra
          riêng chúng khi xử lý yêu cầu tài khoản, không tự gọi lại AI để điền
          thông tin đã mất.
        </p>
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
