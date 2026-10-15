import { PolicyShell } from "../../components/lumio/policy-shell";
import { pageMetadata } from "../../lib/metadata";
export const metadata = pageMetadata({
  title: "Điều khoản sử dụng",
  description:
    "Phạm vi bản thử nghiệm Lumio AI, cách sử dụng tài khoản và tài liệu có trách nhiệm, giới hạn AI và dữ liệu.",
  path: "/terms",
});
export default function TermsPage() {
  return (
    <PolicyShell
      title="Cùng xây một nơi học tập có trách nhiệm."
      subtitle="Các nguyên tắc sử dụng dành cho bản thử nghiệm Lumio AI."
    >
      <section>
        <h2>1. Phạm vi bản thử nghiệm</h2>
        <p>
          Lumio AI hỗ trợ học từ tài liệu, câu hỏi, liên kết và phương tiện do
          người dùng lựa chọn. Đây là phiên bản đang được hoàn thiện. Tính năng,
          giới hạn và khả năng truy cập có thể thay đổi; chưa có cam kết dịch vụ
          thương mại, lưu trữ lâu dài hay hoạt động liên tục.
        </p>
      </section>
      <section>
        <h2>2. Học và kiểm tra lại</h2>
        <p>
          Câu trả lời AI có thể sai, thiếu ngữ cảnh hoặc diễn giải chưa phù hợp.
          Hãy kiểm tra kiến thức, công thức, nguồn trích dẫn và yêu cầu của giáo
          viên trước khi sử dụng. Lời giải có trình bày bước tính không có nghĩa
          đã được công cụ độc lập xác minh.
        </p>
        <p>
          Dùng Lumio để hiểu bài và luyện tập phù hợp với quy định của lớp học
          hoặc kỳ thi. Sản phẩm không thay thế giáo viên, đánh giá chuyên môn
          hoặc dịch vụ tư vấn chuyên ngành.
        </p>
      </section>
      <section>
        <h2>3. Nội dung và tài khoản</h2>
        <p>
          Chỉ thêm tài liệu, hình ảnh, audio, video hoặc liên kết mà bạn có
          quyền sử dụng. Không sử dụng sản phẩm để vượt đăng nhập, giới hạn truy
          cập, phát tán nội dung trái phép, quấy rối, mạo danh hoặc tấn công hệ
          thống.
        </p>
        <p>
          Giữ an toàn cho tài khoản đăng nhập của bạn. Việc liên kết Google và
          Facebook cần xác thực ở từng dịch vụ; không chia sẻ mật khẩu hay mã
          xác minh với người khác. Nếu là người học nhỏ tuổi, hãy sử dụng cùng
          sự hướng dẫn phù hợp từ phụ huynh hoặc giáo viên.
        </p>
      </section>
      <section>
        <h2>4. Chi phí và giới hạn</h2>
        <p>
          Bản này có màn xem Free, Plus, Premium, Pro và ví credit, nhưng giá
          trả phí chưa được xác nhận và chưa mở thanh toán. Credit dùng thử là
          đơn vị giới hạn sử dụng trong Lumio, không phải tiền hoặc số dư của
          nhà cung cấp AI. Quyền gói sandbox dành cho kiểm thử có ngày hết hạn,
          không thu tiền và không tự gia hạn trả phí.
        </p>
        <p>
          Một số tính năng dùng dịch vụ AI bên ngoài và phụ thuộc hạn mức, cấu
          hình, khả năng đáp ứng của dịch vụ. Máy chủ kiểm tra quyền và credit
          trước khi xử lý, quyết toán khi thành công hoặc hoàn khoản giữ khi
          lỗi. Có thêm giới hạn tần suất để bảo vệ hệ thống; không hứa mức sử
          dụng miễn phí không giới hạn.
        </p>
      </section>
      <section>
        <h2>5. Dữ liệu và thay đổi sản phẩm</h2>
        <p>
          Thư viện hiện được lưu trên trình duyệt, chưa có đồng bộ tự động giữa
          thiết bị. Xuất dữ liệu quan trọng và giữ tệp gốc trước khi xóa dữ liệu
          trình duyệt hoặc đổi thiết bị. Cách xử lý tài khoản, nội dung và nhật
          ký được mô tả tại <a href="/privacy">Quyền riêng tư</a>.
        </p>
        <p>
          Người phụ trách dự án có thể tạm khóa tài khoản hoặc tính năng để xử
          lý lạm dụng hoặc lỗi kỹ thuật. Các thay đổi quản trị được ghi nhận
          trong nhật ký. Nếu có vấn đề, hãy liên hệ người phụ trách qua kênh
          dùng thử hiện có.
        </p>
      </section>
    </PolicyShell>
  );
}
