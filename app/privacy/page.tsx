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
      updatedAt="16/10/2026"
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
        <h2>Hồ sơ đăng ký giáo viên</h2>
        <p>
          Khi chủ động đăng ký, bạn gửi tên tự khai, quốc gia, tỉnh/thành,
          xã/phường hoặc khu vực tương đương, trường, cấp và môn dạy tới máy chủ
          Lumio. Email công việc và liên kết công khai là tùy chọn. Hồ sơ chỉ
          hiển thị cho chính tài khoản đó và quản trị viên có quyền xét duyệt;
          không gửi tới dịch vụ AI. Không cung cấp căn cước, mật khẩu hoặc dữ
          liệu học sinh trong biểu mẫu.
        </p>
        <p>
          Việc duyệt hồ sơ là đánh giá thủ công trên thông tin tự khai, không
          phải xác minh danh tính hay chứng nhận đang công tác tại trường.
          Quyền giáo viên có thể bị thu hồi, không tự cấp quyền quản trị hoặc
          truy cập dữ liệu học sinh. Hồ sơ, kết quả và thao tác xét duyệt lưu
          riêng trong cơ sở dữ liệu; không áp dụng thời hạn bảy ngày của bản
          đồng bộ học tập. Bản hiện tại chưa có nút tự xóa hồ sơ giáo viên;
          xóa dữ liệu học trên trình duyệt không xóa hồ sơ này. Trên hosting
          miễn phí, dữ liệu vẫn có thể mất khi dịch vụ được tạo lại.
        </p>
      </section>
      <section>
        <h2>Không gian giáo viên và lớp học</h2>
        <p>
          Khi tạo hoặc tham gia lớp, Lumio lưu tổ chức, lớp, tên hiển thị tài
          khoản, phân công giáo viên, nhóm, học liệu, giáo án, câu hỏi, bài
          giao, bài làm, điểm và nhận xét trong cơ sở dữ liệu máy chủ. Đây là
          dữ liệu riêng với thư viện IndexedDB và bản đồng bộ bảy ngày. Chỉ
          dùng dữ liệu cần thiết; không nhập căn cước, thông tin sức khỏe hay
          thông tin gia đình của học sinh. Mã mời lớp có hạn và chỉ cấp quyền
          học sinh của lớp đó, không cấp quyền giáo viên hoặc quản trị.
        </p>
        <p>
          Giáo viên xem lớp được phân công; quản trị tổ chức xem phạm vi tổ
          chức mình. Học sinh xem bài được giao, học liệu đã chia sẻ và bài
          làm của chính mình. Điểm tự chấm là bản tạm dành cho giáo viên;
          học sinh chỉ nhận điểm và đáp án sau bước xác nhận, công bố. Nhật
          ký ghi thao tác thay đổi quyền lớp, chấm và công bố bằng mã đối
          tượng, không cố ý chép nội dung bài làm vào nhật ký. Quyền quản trị
          hệ thống không tự động cho phép đọc mọi lớp hoặc thư viện cá nhân.
        </p>
        <p>
          Công cụ AI giáo viên chỉ gửi sau khi bạn xác nhận xử lý bên ngoài:
          chủ đề, khối lớp, mục tiêu, độ khó và các đoạn học liệu bạn chọn.
          Gợi ý nhận xét chỉ dùng đoạn không nhận dạng do giáo viên tự nhập,
          không tự đính kèm danh sách lớp, email, tên học sinh hoặc toàn bộ
          bài làm. Bộ phát hiện thông tin riêng tư có giới hạn; giáo viên
          vẫn phải loại bỏ dữ liệu cá nhân trước khi gửi. Nguồn trích dẫn
          khớp không có nghĩa toàn bộ nội dung AI chính xác; giáo viên phải
          kiểm tra bản nháp trước khi giao bài hoặc công bố nhận xét.
        </p>
        <p>
          Dữ liệu lớp chưa có thời hạn xóa tự động. Lưu trữ/đóng lớp không
          đồng nghĩa xóa toàn bộ bài làm và nhật ký; liên hệ người phụ trách
          để xử lý yêu cầu dữ liệu. Bản xuất CSV hoặc bản in PDF là bản sao
          riêng mà người tải phải bảo quản. Hosting miễn phí vẫn có thể làm
          mất dữ liệu máy chủ; chưa dùng bản thử nghiệm này làm sổ điểm chính
          thức hoặc bản sao duy nhất.
        </p>
        <p>
          Mỗi lần chấm và công bố lưu một phiên bản lịch sử riêng; sửa điểm
          không ghi đè bản cũ. Lý do điều chỉnh điểm hoặc cho luyện lại, người
          thực hiện và khung giờ mở/đóng bài cũng lưu trên máy chủ. Học sinh chỉ
          xem lịch sử kết quả đã công bố của chính mình, không xem lý do nội
          bộ. Những bản ghi này không có hạn bảy ngày hoặc nút tự xóa; sao lưu
          cơ sở dữ liệu của người vận hành có thể chứa chúng và cần được xử lý
          riêng.
        </p>
      </section>
      <section>
        <h2>2. Thư viện và quá trình học</h2>
        <p>
          Tài liệu bạn thêm, tệp đính kèm, ghi chú, thẻ ghi nhớ và kết quả bài
          luyện tập được lưu trên trình duyệt của thiết bị này bằng IndexedDB.
          Kế hoạch, lịch ôn và phiên tập trung được lưu cục bộ theo tài khoản.
          Đăng nhập không tự đưa toàn bộ thư viện lên máy chủ. Bản V3 có công cụ
          đồng bộ bản văn bản theo yêu cầu, cần thao tác chủ động như mô tả dưới
          đây.
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
          Hồ sơ kỹ năng mới chỉ tổng hợp snapshot quiz của tài khoản hiện tại:
          kỹ năng/độ khó được khai báo, phiên bản câu hỏi, lựa chọn đúng/sai và
          dấu hiệu câu từng làm. Kết quả chọn lần đầu trong app không bảo đảm
          người học chưa nhận hỗ trợ ở nơi khác. Lịch sử cũ thiếu snapshot không
          được điền giả; lượt thích và streak không đo năng lực. Nhãn diễn giải
          có mức bất định và ngưỡng thử nghiệm, chưa được xác thực trên học
          sinh. Bạn có thể tắt riêng tính hồ sơ hoặc chọn “Xóa snapshot kỹ năng”
          trong Đề xuất cho bạn. Nút này giữ điểm quiz và lịch sử đáp án, chỉ
          xóa snapshot của thư viện trên thiết bị; bản đã xuất hoặc đồng bộ ở
          nơi khác cần xử lý riêng.
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
        <h2>2a. Bản đồng bộ theo yêu cầu</h2>
        <p>
          Khi chủ động gửi bản đồng bộ, văn bản học liệu, ghi chú, thẻ, quiz,
          kết quả học, snapshot kỹ năng, lịch ôn và tùy chọn cá nhân hóa có thể
          được lưu trên máy chủ Lumio để tài khoản của bạn lấy lại. Bản này
          không chứa tệp PDF/ảnh/audio/video gốc, token đăng nhập, khóa API, bộ
          đếm tập trung đang chạy hoặc tệp chuông riêng. Hãy xem phạm vi trước
          khi chọn gửi; tắt cá nhân hóa không tự xóa bản đồng bộ đã lưu.
        </p>
        <p>
          Bản đồng bộ có thời hạn 7 ngày tính từ lần ghi thành công gần nhất.
          Hết hạn được kiểm tra/dọn khi truy cập, chưa phải lịch xóa nền. Máy
          chủ preview dùng cơ sở dữ liệu tạm nên có thể mất dữ liệu sớm hơn khi
          khởi động lại hoặc triển khai. Xung đột cần được xử lý trước khi ghi
          tiếp; không dùng bản thử nghiệm làm bản sao lưu duy nhất. Thư viện cục
          bộ và bản đồng bộ là hai nơi lưu riêng, không tự xóa lẫn nhau.
        </p>
        <p>
          Bạn có thể chọn “Xóa bản máy chủ” trong công cụ đồng bộ để bỏ bản đồng
          bộ của tài khoản và tắt gửi tiếp trên thiết bị này. Dữ liệu cục bộ,
          phiên gia sư, chỉ mục nguồn và sổ credit vẫn là các phần riêng. Những
          thiết bị khác phải đối chiếu lại trước khi gửi thay đổi.
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
        <h2>3a. Tra cứu nhiều học liệu</h2>
        <p>
          Lập chỉ mục là thao tác chủ động có thông báo riêng: tên và phần văn
          bản đã trích xuất của những học liệu bạn chọn, vị trí nguồn, mã kiểm
          tra và các đoạn chia nhỏ được lưu trên máy chủ Lumio theo tài khoản và
          không gian. Đây không phải tải lên tệp gốc hay xác nhận đã đọc những
          trang/ảnh chưa trích xuất được. Các tài liệu chỉ mục, vector nếu có và
          bản chụp đoạn truy xuất có thời hạn 7 ngày; dọn khi truy cập. Preview
          có thể đặt lại dữ liệu sớm hơn. Bạn có thể xóa từng tài liệu đã lập
          chỉ mục trong công cụ tra cứu; việc đó không xóa bản gốc cục bộ.
        </p>
        <p>
          Tra cứu từ khóa chạy trên máy chủ Lumio. Chỉ khi bạn đồng ý riêng với
          tạo embedding/tìm kiếm kết hợp và tính năng được bật, đoạn văn bản
          hoặc câu truy vấn tương ứng mới được gửi tới OpenAI để tạo vector.
          Vector không phải dữ liệu đã ẩn danh và có thể thể hiện nội dung học.
          Phần nguồn được truy xuất có thể tiếp tục được gửi đến dịch vụ AI khi
          bạn dùng nó để đặt câu hỏi/tạo nội dung. Không gửi toàn bộ thư viện
          hoặc thông tin hồ sơ đăng nhập theo mặc định. Chính sách lưu giữ của
          nhà cung cấp bên ngoài vẫn áp dụng; xóa tại Lumio không bảo đảm xóa
          ngay những dữ liệu họ đã tiếp nhận.
        </p>
      </section>
      <section>
        <h2>3b. Tóm tắt chạy nền</h2>
        <p>
          Khi bạn đồng ý riêng rồi đưa vào hàng đợi, máy chủ lưu tên, văn bản
          hiện tại hoặc URL YouTube và thời lượng bạn khai báo, ngôn ngữ, mã
          kiểm tra nguồn, tiến độ và kết quả tóm tắt từng phần. Không lưu tệp âm
          thanh/video/PDF gốc trong hàng đợi này. Nội dung đầu vào và kết quả
          giữ tối đa 7 ngày; dọn khi truy cập hoặc khi worker bảo trì, chưa phải
          bảo đảm xóa đúng một thời điểm khi máy chủ đang ngủ.
        </p>
        <p>
          Khi tác vụ chạy, từng phần cần thiết được gửi tới dịch vụ AI. Phần lỗi
          có thể tự thử lại tối đa 3 lần; bạn đã đồng ý việc gửi này khi tạo tác
          vụ. Có thể hủy xử lý tiếp hoặc xóa tác vụ đã dừng/hoàn tất trong bảng
          quản lý. Yêu cầu đang gửi có thể đã được nhà cung cấp tiếp nhận;
          hủy/xóa tại Lumio không thu hồi dữ liệu đã gửi ra ngoài. Hosting miễn
          phí có thể ngủ/reset và mất hàng đợi, nên không cam kết xử lý liên tục
          hoặc lưu bền vững. Hãy tải kết quả/bản sao khi cần giữ lâu.
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
          Luồng tạo nội dung cho người học, giáo viên và tóm tắt nền còn ghi riêng
          từng lần chuẩn bị gọi AI, gồm mã tài khoản/yêu cầu, model được yêu cầu
          và model trong phản hồi, số token được báo, trạng thái và thời gian.
          Đây là metadata liên kết tài khoản, không phải dữ liệu ẩn danh hay
          nội dung học. Nhật ký mới chưa bao phủ giọng nói và embeddings, không
          dựng lại các lần gọi trước khi nâng cấp. Số token hoặc chi phí chưa
          biết được giữ là chưa biết, không tự coi bằng không.
        </p>
        <p>
          Metadata từng lần gọi đã kết thúc quá 31 ngày được dọn theo đợt khi có
          yêu cầu mới đủ quyền; không có lịch xóa nền nên có thể còn lưu lâu hơn.
          Bản ghi chưa rõ kết quả được giữ để kiểm tra lỗi, không tự xóa hoặc tự
          gọi lại AI. Xóa thư viện hay phiên gia sư không xóa nhật ký này; quản trị
          viên được cấp quyền có thể xem báo cáo metadata. Các nhật ký quản trị,
          sổ credit và bản sao lưu vẫn có phạm vi riêng, chưa có nút tự xóa toàn
          bộ hoặc thời hạn chung. Người phụ trách phải xác định phạm vi xử lý
          khi có yêu cầu dữ liệu tài khoản.
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
