import { PolicyShell } from "../../components/lumio/policy-shell";
import { pageMetadata } from "../../lib/metadata";
export const metadata = pageMetadata({
  title: "Quyền riêng tư",
  description:
    "Cách Lumio AI xử lý đăng nhập, dữ liệu học cục bộ, yêu cầu AI và nhật ký vận hành trong bản thử nghiệm.",
  path: "/privacy",
});
export default function PrivacyPage() {
  return (
    <PolicyShell
      title="Dữ liệu của bạn, rõ ràng từ đầu."
      subtitle="Trang này mô tả cách bản Lumio AI hiện tại xử lý thông tin khi bạn đăng nhập và học tập."
      updatedAt="15/10/2026"
    >
      <section>
        <h2>Phạm vi bản dự thi</h2>
        <p>
          Đây là bản dùng thử phục vụ cuộc thi, không phải dịch vụ lưu trữ lâu
          dài. Trên máy chủ Render miễn phí, cơ sở dữ liệu tạm có thể bị đặt lại
          khi dịch vụ ngủ, khởi động lại hoặc triển khai. Phiên đăng nhập, liên
          kết tài khoản, số dư credit và phiên gia sư có thể mất sớm hơn thời
          hạn phiên; dữ liệu học trong trình duyệt là một nơi lưu riêng. Hãy giữ
          tệp gốc và bản xuất nếu cần; không dùng bản thử nghiệm làm nơi lưu duy
          nhất cho bài học quan trọng.
        </p>
      </section>
      <section>
        <h2>1. Dữ liệu đăng nhập</h2>
        <p>
          Khi bạn chọn Google hoặc Facebook, Lumio nhận mã định danh tài khoản
          cùng thông tin hồ sơ cơ bản được dịch vụ cho phép, như tên, email và
          ảnh đại diện. Thông tin này dùng để nhận diện tài khoản, hiển thị hồ
          sơ và liên kết các cách đăng nhập khi bạn chủ động yêu cầu. Lumio
          không yêu cầu bạn nhập mật khẩu Google hoặc Facebook vào ứng dụng.
        </p>
        <p>
          Mã định danh, tên, email nếu có, liên kết đăng nhập, quyền tài khoản
          và thời điểm hoạt động được lưu trong cơ sở dữ liệu của máy chủ Lumio.
          Cookie cần thiết được dùng để duy trì phiên đăng nhập. Trùng email
          không làm hai tài khoản tự động gộp.
        </p>
      </section>
      <section>
        <h2>2. Thư viện và quá trình học</h2>
        <p>
          Tài liệu bạn thêm, tệp đính kèm, ghi chú, thẻ ghi nhớ và kết quả bài
          luyện tập được lưu trên trình duyệt của thiết bị này bằng IndexedDB.
          Kế hoạch, lịch ôn và phiên tập trung được lưu cục bộ theo tài khoản.
          Hiện chưa có đồng bộ thư viện giữa các thiết bị.
        </p>
        <p>
          Chuỗi ngày học, lịch sử hoạt động và phản hồi Hợp với tôi / Ít đề xuất
          hơn dùng để gợi ý học liệu. Bộ gợi ý tính toán và học từ phản hồi ngay
          trên thiết bị, không gửi lịch sử hoặc phản hồi tới dịch vụ AI. Bạn có
          thể tắt cá nhân hóa tại Đề xuất cho bạn. Tệp chuông riêng cũng chỉ lưu
          trong trình duyệt; bản sao JSON chứa lựa chọn chuông và phản hồi,
          nhưng không chứa tệp chuông riêng.
        </p>
        <p>
          Chủ đề, độ khó và mục tiêu bạn chọn, lượt thích và đánh giá mức hữu
          ích sau học được lưu theo tài khoản trên thiết bị. Sở thích và tự đánh
          giá được tách khỏi kết quả quiz; không dùng chúng để khẳng định bạn đã
          thành thạo môn học. Bạn có thể xóa phản hồi trong Đề xuất cho bạn mà
          không xóa học liệu. Tắt cá nhân hóa không tự xóa dữ liệu đã lưu.
        </p>
        <p>
          Xóa dữ liệu trang web trong trình duyệt có thể làm mất dữ liệu học
          tập. Bản xuất JSON của thư viện không bao gồm tệp PDF, ảnh, audio hoặc
          video gốc. Bản sao có chứa tóm tắt, sơ đồ tư duy và những khung hình
          video nhỏ mà bạn chủ động chụp và lưu trong bản tóm tắt. Hãy giữ các
          tệp gốc riêng nếu cần sao lưu.
        </p>
      </section>
      <section>
        <h2>3. Khi bạn sử dụng AI</h2>
        <p>
          Khi bạn nhấn gửi câu hỏi, tạo tóm tắt, tạo bài học hoặc sử dụng giọng
          nói, nội dung bạn chọn cùng câu hỏi, ngôn ngữ, tùy chọn học và một
          phần hội thoại gần nhất có thể được gửi qua máy chủ Lumio tới dịch vụ
          xử lý phù hợp: OpenAI, Google Gemini hoặc xAI. File hoặc URL video chỉ
          được gửi khi tính năng bạn sử dụng cần đến chúng.
        </p>
        <p>
          Lumio không chủ động đưa email hay thông tin hồ sơ đăng nhập vào câu
          lệnh AI. Tuy nhiên, tài liệu hoặc câu hỏi bạn nhập có thể tự chứa dữ
          liệu cá nhân. Chỉ gửi nội dung cần thiết và có quyền sử dụng. Việc lưu
          giữ và xử lý tại nhà cung cấp còn phụ thuộc điều khoản, chính sách và
          cấu hình dịch vụ của họ; Lumio không cam kết thay các nhà cung cấp
          rằng mọi yêu cầu đều không được lưu.
        </p>
        <p>
          Mục “Dữ liệu gửi khi bạn dùng AI” cạnh thao tác gửi nêu các loại dữ
          liệu của yêu cầu đang chuẩn bị, như văn bản, ảnh/PDF, bản ghi âm, tệp
          hoặc liên kết video và các lượt hội thoại liên quan. Lumio không chủ
          động gửi toàn bộ thư viện, phản hồi đề xuất hay thông tin hồ sơ đăng
          nhập trong nội dung yêu cầu AI. Nếu bạn tự đưa thông tin cá nhân vào
          câu hỏi hoặc tài liệu, phần đó có thể vẫn được gửi. Hãy bỏ phần không
          cần thiết trước khi gửi.
        </p>
        <p>
          Với gia sư có phiên học, máy chủ còn lưu đề bài (tối đa 4.000 ký tự),
          tối đa 100 lượt hội thoại, tiến trình gợi ý và mã kiểm tra của học
          liệu để xác minh điều kiện mở lời giải. Tệp học liệu gốc không được
          lưu trong bảng phiên gia sư. Phiên hết hiệu lực sau 7 ngày; việc dọn
          các phiên hết hạn thực hiện khi có truy cập, chưa có lịch dọn nền. Bạn
          có thể xem/xóa phiên của mình bằng công cụ quản lý phiên gia sư. Xóa
          phiên không xóa tài khoản, sổ credit hoặc nhật ký vận hành.
        </p>
        <p>
          Lumio không có chức năng huấn luyện mô hình gia sư từ tài liệu hay hội
          thoại học sinh. Bộ xếp hạng đề xuất nhỏ có thể học từ các lượt đánh
          giá rõ ràng ngay trên thiết bị; đây là xử lý cục bộ, có thể tắt. Việc
          sử dụng dữ liệu tại dịch vụ AI bên ngoài phụ thuộc cấu hình và điều
          khoản của dịch vụ; Lumio không cam kết thay họ về huấn luyện hoặc lưu
          giữ. Không gửi thông tin nhạy cảm của trẻ em hoặc của người khác khi
          không cần cho bài học.
        </p>
      </section>
      <section>
        <h2>4a. Bản ghi âm và buổi học trực tuyến</h2>
        <p>
          Ứng dụng chỉ bắt đầu thu âm sau thao tác và quyền bạn cấp. Bản ghi
          được giữ trên thiết bị để nghe lại, tải xuống hoặc lưu vào thư viện;
          chọn thu âm không tự gửi bản ghi tới AI. Bản ghi chỉ được gửi ra ngoài
          khi bạn chọn chép lời hoặc tạo nội dung cần âm thanh đó. Thu âm hệ
          thống trong bản Windows có thể ghi mọi ứng dụng đang phát tiếng, không
          chỉ Zoom. Dừng thu khi không cần và chỉ ghi nội dung bạn có quyền
          ghi/chia sẻ; chú ý giọng nói của người khác.
        </p>
      </section>
      <section>
        <h2>4. Liên kết website và video</h2>
        <p>
          Website chỉ được máy chủ tải nội dung sau khi bạn chọn đọc trang.
          Trang nguồn nhận yêu cầu truy cập từ máy chủ Lumio. Nội dung công khai
          được trích xuất để bạn xem lại trước khi lưu; Lumio không gửi cookie
          đăng nhập của bạn tới trang đó. Với video YouTube, URL được chuyển cho
          dịch vụ phân tích video khi bạn tạo nội dung; Lumio không vượt quyền
          xem video.
        </p>
      </section>
      <section>
        <h2>5. Dữ liệu vận hành và quản trị</h2>
        <p>
          Máy chủ lưu sự kiện quản trị, thay đổi tài khoản, mã yêu cầu, trạng
          thái và thông tin sử dụng AI như mô hình, số token được nhà cung cấp
          báo cáo, thời gian xử lý và mã lỗi. Nhật ký sử dụng không được thiết
          kế để lưu nội dung câu hỏi, tài liệu hoặc câu trả lời. Trang quản trị
          không cung cấp chức năng xem thư viện cục bộ hoặc hội thoại riêng của
          người học.
        </p>
        <p>
          Ví credit, quyền gói và lịch sử dự giữ, sử dụng, hoàn credit được lưu
          trên máy chủ theo tài khoản. Nhật ký credit không chứa prompt, nội
          dung học hoặc thông tin thẻ thanh toán. Bản hiện tại chưa thu tiền
          hoặc tiếp nhận thông tin thanh toán.
        </p>
        <p>
          Bản thử nghiệm chưa có cơ chế tự động xóa nhật ký theo lịch hoặc thời
          hạn lưu giữ đã công bố. Người phụ trách dự án quản lý dữ liệu trên máy
          chủ; quy trình lưu giữ cần được hoàn thiện trước khi vận hành rộng
          rãi.
        </p>
      </section>
      <section>
        <h2>6. Quyền lựa chọn của bạn</h2>
        <p>
          Bạn có thể đăng xuất, xóa từng nội dung học tập, xuất bản sao, thu hồi
          kết nối tại Google/Facebook hoặc yêu cầu người phụ trách dự án xử lý
          dữ liệu tài khoản. Thu hồi quyền đăng nhập không tự động xóa dữ liệu
          học đã lưu trên trình duyệt hay nhật ký máy chủ. Xem{" "}
          <a href="/data-deletion">hướng dẫn xóa dữ liệu</a> để phân biệt các
          bước này.
        </p>
      </section>
    </PolicyShell>
  );
}
