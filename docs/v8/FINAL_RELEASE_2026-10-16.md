# Lumio AI3.4 / V8 — bàn giao lần nộp5

**Đã nộp lại:22:21:45 ngày16/10/2026 (UTC+7), đội AI26A0048, Bảng A · Miền Trung.** Cổng xác nhận “Lần5 · Bản dùng để chấm”, tổng5 biên nhận; tải lại trang vẫn giữ mốc này. Một lần bấm cập nhật, không tạo lần6.

- [Website public](https://lumio-ai-demo.onrender.com/)
- [GitHub mã nguồn](https://github.com/nguyenbedetran-sketch/lumio-ai-regional-2026)
- [Thư mục minh chứng](https://drive.google.com/drive/folders/1ARB9KHRNnAiHRMd_FH8tHLY4C8dlWbzG)
- [PDF6 trang](https://drive.google.com/file/d/1U8pIYeIuN5Z2AWchMhzf2GdVGBoftYB2/view)
- [Ảnh cổng xác nhận](https://drive.google.com/file/d/1_yJWiljZlBJs-vJMPIhnIcB-OnTXjl3G/view)
- [Biên nhận JSON](SUBMISSION-RECEIPT-5.json)

## Bản chạy và thay đổi

Runtime **3.4.0-rc.1 / schema18**, commit `89ddd072f0d34ede54a55053c51f3c394783e5e9`. [CI38918173559/job117030941226](https://github.com/nguyenbedetran-sketch/lumio-ai-regional-2026/actions/runs/38918173559) thành công: Node24.19.0, pnpm11.25.0, frozen lockfile, test:all, build và TypeScript.

Render Free `srv-danebeek1f9s738epav0`, deploy `dep-db93j23bc2fs73cnss9g`: Live đúng89ddd07 lúc21:51:50 UTC+7, duration2m05s. Auto deploy giữ tắt; commit bàn giao này chỉ đổi tài liệu/minh chứng, không đổi runtime hoặc khởi động lại dữ liệu.

V8 tái sử dụng ứng dụng hiện có: Home gọn và mở câu hỏi đúng học liệu dưới dạng bản nháp; kế hoạch tối đa3 bước, ưu tiên ôn quá hạn; minh chứng kỹ năng có xem/loại/khôi phục; giữ trường sync khi client cũ chưa biết. Tutor có diễn giải/ví dụ/cách khác không tăng khóa3 gợi ý; phản hồi đóng riêng theo lượt. Voice chọn nguồn, khôi phục phiên theo tài khoản/nguồn và dừng capture khi nguồn thay đổi. Teacher ghép đề nháp từ câu đã duyệt, có kiểm toàn đề. Admin đọc số liệu job tổng hợp có kiểm quyền mới và kiểm lại thu hồi trong transaction.

Chi tiết và những phần chưa làm: [COVERAGE](COVERAGE.md), [CHECKLIST](CHECKLIST.md), [nghiệm thu local](HOME-ACCEPTANCE.md). Không tuyên bố toàn bộ backlog V8 hoàn tất.

## Nghiệm thu thực tế

Local và CI là kiểm tra có dữ liệu/tài khoản/transport tổng hợp trong phạm vi từng suite; báo cáo không cộng các suite thành độ chính xác AI. Migrations và snapshot dùng SQLite riêng, không phải diễn tập khôi phục máy chủ public.

Public59 điều kiện HTTP đạt: version3.4/health, cấu hình cạnh tranh, OAuth, thanh toán tắt,401/no-store ở các endpoint riêng và trang guest được chặn. [Báo cáo HTTP](public-v8-check.json).

Google OAuth của chủ tài khoản hoạt động. Hai lượt OpenAI thật với bài tự soạn: `3x - 6 = 9` nhận một gợi ý cộng6 hai vế và một câu hỏi, không có nghiệm cuối; “Dễ hiểu hơn” dùng ví dụ khác và vẫn giữ khóa1/3. Trích đoạn§3 mở trong nguồn gốc; việc khớp trích đoạn không chứng minh mọi định nghĩa/ví dụ trong câu trả lời đều được nguồn nói trực tiếp. Phản hồi “Hữu ích” lưu riêng và khôi phục cùng hai lượt sau reload. Không gọi AI hoặc trừ thêm credit khi lưu phản hồi/khôi phục.

Nhật ký ghi2 lượt chuẩn bị/2 phản hồi HTTP,0 lỗi hoặc kết quả chưa rõ; model yêu cầu là alias `gpt-5-mini`/OpenAI, tên model phản hồi khác alias. Token3463vào+1306ra=4769. Chi phí USD chưa biết, không ghi$0. Trial200 trừ hai lượt4credit, còn192 khả dụng/0 giữ. [Nghiệm thu public có giới hạn](authenticated-acceptance.json).

Teacher dùng tổ chức/lớp riêng có tên “NGHIỆM THU V8”, zero học sinh. Một câu tự soạn được duyệt, ma trận lưu nháp1câu/1điểm; tải lại vẫn còn; chưa giao bài hoặc công bố điểm. UI preview thiếu1 câu và preflight cảnh báo0/1 có trích đoạn. Lỗi shortage ở backend được kiểm bằng handler/DB riêng; không gọi UI preview thành một public server rejection. Admin đọc hàng đợi0 job, không suy worker đang sống hay backup. Home/Voice kiểm viewport CSS390×900, không tràn ngang; không gọi ghi âm, STT/TTS hoặc thiết bị thật. Console error capture cuối lượt nghiệm thu rỗng ở4 tab đã kiểm.

## Minh chứng và tính toàn vẹn

| Tệp | Byte | SHA-256 |
| --- | ---: | --- |
| [Source ZIP89](https://drive.google.com/file/d/1JKXOMZXtEHKFqMHlMnJc0YW3S2wdCzqz/view) | 20,887,193 | `70fe45717ebf12fc4a660404ef754b96694cec4217d5bf582eb3eefce33315f5` |
| [PDF](https://drive.google.com/file/d/1U8pIYeIuN5Z2AWchMhzf2GdVGBoftYB2/view) | 555,457 | `62bae5145ec0f66ee82d75cc9b2ab52bd873eb4862f640db2731f7a1a2f753ed` |
| [Evidence ZIP](https://drive.google.com/file/d/1CtYhTv7_Qk9TogjCZjh5dPZr4KyU3WyJ/view) | 23,386,511 | `972a0d962425f610df1ebede184b6607e254c5462ea0ce7536fee61d3ddeab90` |

Source998 file khớp byte Git blob,6 exclusions có lý do. PDF đã render và xem đủ6 trang mới. Evidence53 file khớp manifest/CRC, gồm28 minh chứng local,10 ảnh public,4 báo cáo public và các chỉ mục/source/PDF. So sánh1050 file trong ZIP và source lồng với6 giá trị credential đã cấu hình: zero khớp; đây không phải bảo đảm scanner phát hiện mọi secret. [Integrity](final-bundle-integrity.json).

Drive:6 tệp LAN5 đúng parent, dung lượng và anyone-reader theo readback; final listing25 tệp gồm cả6.3 viewer chính trả200 với tên đúng khi không dùng cookie. Không gọi đây là kiểm remote binary hash. [Delivery proof](drive-delivery-verification.json), [anonymous viewer proof](drive-viewer-check.json).

PDF/ZIP được khóa trước nộp nên giữ snapshot biên nhận PENDING đúng thời điểm đóng gói. Biên nhận JSON/ảnh sau nộp xác nhận trạng thái mới; các gói đã băm không bị sửa. Source/docs ở89 có thể còn ghi một số cổng đang chờ; tài liệu bàn giao này là mốc sau nghiệm thu. Giữ lần1–4 để đối chiếu.

## Các giới hạn còn lại

Render Free có thể ngủ và mất SQLite khi restart/redeploy; chưa có database bền vững nhiều instance hoặc off-host recovery/RPO/RTO đo thực tế. Chưa có merchant/thanh toán thật, pilot độc lập, phát hành native mới hoặc thử micro/loa/Zoom/Android/iPhone thật. Hai lượt Tutor không thay benchmark AI toàn diện. Hồ sơ kỹ năng là quy tắc/ taxonomy giới hạn, chưa phải chẩn đoán hay knowledge tracing hiệu chuẩn. Xem backlog trong COVERAGE/CHECKLIST để tiếp tục từng phần có kiểm chứng.
