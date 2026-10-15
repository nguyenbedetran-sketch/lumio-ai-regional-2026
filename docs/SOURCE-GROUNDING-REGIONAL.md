# Nguồn học liệu và kiểm tra nội dung — AI26A0048

## Phạm vi đã triển khai

- Văn bản và website: máy chủ chia chính văn đã cung cấp thành đoạn có ID và khoảng ký tự xác định. Website vẫn dùng bộ tải URL có xác thực, giới hạn dung lượng, chặn địa chỉ nội bộ, ghim DNS và kiểm tra từng chuyển hướng.
- Phụ đề: chỉ lấy mốc từ cue `[MM:SS]` / `[HH:MM:SS]` thật trong văn bản. Mốc do mô hình quan sát video vẫn mang nhãn ước lượng, không được đổi thành mốc đã xác minh.
- PDF: trích lớp văn bản từng trang, giữ số trang thật trong tệp. Tệp scan hoặc công thức là ảnh không biến thành văn bản đáng tin cậy chỉ nhờ bước này.
- DOCX: đọc đoạn và tiêu đề có cấu trúc; không bịa số trang vì DOCX không có bố cục trang cố định.
- PPTX: đọc trang chiếu theo `presentation.xml` và quan hệ `r:id`; không dùng số trong tên tệp `slideN.xml` để đoán thứ tự.
- Ảnh, âm thanh hoặc video chưa có văn bản trích được: giao diện ghi rõ chưa xác định vị trí đoạn trích. Không gán trang, vùng ảnh hay thời gian giả.

## Cách sử dụng

1. Thêm PDF, DOCX hoặc PPTX vào thư viện. Tệp vẫn nằm trong trình duyệt sau khi thêm.
2. Mở **Tài liệu gốc → Phân tích tài liệu**. Bước này gửi tệp tới máy chủ Lumio để trích văn bản; chưa gửi tới mô hình AI.
3. Kiểm tra văn bản trích được với bản gốc. Sửa văn bản sẽ bỏ chứng thực vị trí vật lý; phân tích lại bản gốc để khôi phục.
4. Chọn công cụ AI. Với tài liệu đã trích văn bản, AI dùng lớp văn bản kèm metadata; không cần gửi lại tệp nhị phân.
5. Mở **Đối chiếu học liệu** cạnh câu trả lời, chương tóm tắt, mặt sau thẻ hoặc giải thích quiz. Đoạn trích hiện nguyên văn, kèm vị trí đã có dữ liệu. PDF có thể mở đúng trang; website và video mở nguồn của người học.

## Quy tắc xác minh

Mô hình chỉ được đề xuất `{ segmentId, quote }`. Máy chủ xác nhận ID tồn tại và đoạn trích 8–500 ký tự xuất hiện nguyên văn trong đoạn đó. Vị trí trang, trang chiếu, đoạn và cue thời gian được suy ra từ dữ liệu đầu vào do ứng dụng quản lý. Giá trị vị trí hoặc liên kết do mô hình tự thêm bị bỏ.

Tài liệu trích trên máy chủ được ký HMAC bằng bí mật phía máy chủ, gắn với tài khoản, SHA-256 của văn bản, tên tệp và các khoảng vị trí. Sửa văn bản, đổi trang hoặc dùng chứng thực của tài khoản khác bị chặn trước khi dự trữ credit/gọi AI. Chứng thực không chứng minh nội dung tệp đúng hoặc toàn bộ bố cục đã được trích đủ.

Bản sao JSON không khôi phục chứng thực tệp vật lý. Các đoạn trích được kiểm tra lại với văn bản của bản sao; trang/trang chiếu không đủ căn cứ bị bỏ. Tệp gốc không nằm trong bản sao nên cần thêm lại và phân tích lại khi cần vị trí vật lý.

## Giới hạn và an toàn

`POST /api/ingest-document` yêu cầu phiên đăng nhập, cùng origin, tối đa 4 lần/phút/tài khoản và một lần đang chạy cho mỗi tài khoản; toàn bộ tiến trình máy chủ chỉ cho một lượt trích đồng thời để phù hợp máy chủ miễn phí. Khi bận, người dùng nhận thông báo chờ rồi thử lại. Giới hạn: 6 MiB, 100 trang/trang chiếu, 200.000 ký tự. Xử lý trong worker tách biệt, tối đa 15 giây, V8 old heap 128 MiB (không phải giới hạn toàn bộ bộ nhớ của tiến trình).

DOCX/PPTX chỉ giải nén các XML cần đọc; mỗi XML tối đa 2 MiB, tổng XML 8 MiB, tối đa 3.000 mục ZIP. Không ghi tệp giải nén ra đĩa, không tải quan hệ ngoài, từ chối DTD/entity. Có giới hạn độ sâu và số thẻ XML. PDF không chạy JavaScript của tệp; eval của bộ đọc bị tắt. Tệp và nội dung trích không được ghi vào nhật ký ứng dụng.

Tài liệu không có văn bản, mã hóa/hỏng, giới hạn quá lớn hoặc timeout trả lỗi rõ ràng. Không thay bằng kết quả AI mẫu. Tệp có công thức, bảng, hình và thứ tự đọc phức tạp vẫn cần kiểm tra bằng mắt. Công thức Office OMML bị từ chối để tránh làm phẳng phân số/căn sai nghĩa; ứng dụng hướng dẫn xuất PDF hoặc dùng ảnh. Chức năng chưa thực hiện OCR độc lập và chưa xác minh vùng ảnh.

## Kiểm tra chất lượng

- Quiz: đúng 4 lựa chọn, một chỉ số đáp án, giải thích, chủ đề và độ khó; chặn lựa chọn trùng văn bản hoặc tương đương số đơn giản (`1/2`, `0.5`, `50%`), câu hỏi trùng và nhiều chỉ số đáp án.
- Flashcard: chặn câu hỏi mặt trước trùng, yêu cầu một ý chính và giữ điều kiện trong chỉ dẫn mô hình. Nếu mô hình đặt JSON References trong hậu tố mặt sau, chỉ tách thành trích dẫn khi tất cả trích đoạn khớp nguồn; JSON sai hoặc trích dẫn bịa bị từ chối.
- Tóm tắt: cấu trúc chương/sơ đồ được kiểm tra, chỉ giữ trích đoạn khớp. Toàn bộ luồng chia đoạn video vẫn giữ giới hạn và kiểm tra coverage hiện có.
- Kết quả hiện **Đã kiểm tra cấu trúc**, số mục có đoạn nguồn và nhắc cần kiểm tra nội dung. Sự xuất hiện của đoạn trích không chứng minh kết luận, lời giải, độ khó hoặc ý nghĩa đúng. Chưa có bộ chấm ngữ nghĩa độc lập cho mọi môn học.

## Kiểm thử đã chạy

`node tests/source-grounding.cjs`: 20 kiểm tra PASS, gồm PDF thật hai trang, XML DOCX, PPTX đảo thứ tự tệp, ZIP bomb, DTD/entity, hủy worker, từ chối công thức Office thay vì làm sai cấu trúc, giả chứng thực, đổi tài khoản, đổi vị trí, giả trích dẫn, trùng đáp án và trường hợp không có nguồn. Các fixture đều được tạo riêng cho kiểm thử; không dùng dữ liệu học sinh, không gọi API có phí. Không coi các kiểm tra này là thử nghiệm hiệu quả học tập.

`node tests/source-http.cjs`: 7 kiểm tra HTTP PASS với bộ tra phiên đăng nhập thay bằng fixture tách biệt; bộ đọc file, HMAC và route đều chạy thật. Bao gồm PDF hai trang, thiếu đăng nhập, khác origin, tệp giả/base64 sai, lỗi an toàn, giới hạn lượt và hai yêu cầu đồng thời. Không sử dụng cơ sở dữ liệu cá nhân, OAuth hoặc AI có phí.

Các kiểm tra hồi quy đã chạy: `core.cjs` 9, `ingestion.cjs` 27 và `full-summary.cjs` 15 PASS. `node scripts/test-ui.cjs --regional-sources`: 16 kiểm tra trình duyệt PASS ở desktop và điện thoại, dùng tài khoản và nội dung kiểm thử được ghi rõ; chặn mọi yêu cầu AI. Đã kiểm tra trích đoạn trên thẻ/quiz/chương, loại trang và URL giả, trạng thái chưa có nguồn, không tràn ngang và không có lỗi trình duyệt. Ảnh minh chứng và báo cáo ở `docs/regional/qa-source-*` và `qa-regional-sources-report.json`.

Kết quả production cuối cùng được ghi riêng trong báo cáo nghiệm thu chung sau khi root tích hợp.

## Nguồn kỹ thuật

- [unjs/unpdf](https://github.com/unjs/unpdf): trích văn bản PDF, giới hạn tài nguyên khi xử lý tài liệu không tin cậy; phiên bản khóa `1.8.1`.
- [fflate](https://github.com/101arrowz/fflate): giải nén có bộ lọc metadata trước khi cấp phát; phiên bản khóa `0.8.3`.

Không dùng trích dẫn ngoài làm nguồn của học sinh. Hai liên kết trên chỉ mô tả thư viện kỹ thuật của ứng dụng.
