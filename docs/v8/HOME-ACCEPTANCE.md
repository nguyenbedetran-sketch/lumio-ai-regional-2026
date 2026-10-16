# V8 · Trang chủ và nghiệm thu tích hợp local

Trang chủ dùng lại thư viện, Study Studio, Gia sư, Planner, Review và engine cá nhân hóa. Không thay stack hoặc tạo bản sao các module này.

- Một vùng hỏi gia sư với học liệu được chọn rõ ràng. Nút mở chỉ chuyển câu hỏi sang bản nháp của tab Hỏi Lumio, không tự gọi AI hoặc trừ credit. Sau khi xóa câu hỏi, chuyển tab không khôi phục câu cũ.
- Kế hoạch có một bước chính và tối đa hai lựa chọn khác trong phần mở rộng bằng bàn phím. Người học chọn trọng tâm hoặc mở phần kiểm soát minh chứng đã có.
- Chỉ hiển thị ba học liệu thật gần đây, mục tiêu và hoạt động đã lưu. Không biến thời gian sử dụng thành tỷ lệ thành thạo. Thu gọn công cụ nhập nâng cao/không gian; mọi cách nhập vẫn còn.
- Bản nháp trang chủ được bảo vệ khi điều hướng và mở trình nhập, kể cả nút thêm ở sidebar. Giữ bản nháp hủy điều hướng; bỏ bản nháp xóa câu hỏi theo lựa chọn rõ ràng. `useDraft` chỉ thêm callback tùy chọn khi bỏ bản nháp; các caller cũ giữ hành vi cũ.
- CSS module theo token hiện hành, giữ sáng/tối, năm ngôn ngữ, focus nhìn thấy và tùy chọn giảm chuyển động. Sửa tràn lịch chuỗi ngày ở tablet được phát hiện bằng browser test; không che lỗi bằng overflow-x:hidden.

`node scripts/test-v8-home-ui.cjs`: **197 assertion PASS**, gồm luồng mới và hồi quy Workspace/IndexedDB thực trong Edge cách ly. Các phản hồi đăng nhập, HTTP, học liệu và AI là fixture được ghi nhãn; không có provider, tài khoản hay học sinh thật. Kiểm tra chiều rộng325/390/768/1440, năm ngôn ngữ mobile, bàn phím, bản nháp, hủy tải tệp, nguồn/citation, chuyển tài khoản và reduced motion. Báo cáo: [qa-home-workspace-report.json](qa-home-workspace-report.json). Đã mở và kiểm tra trực quan [desktop](qa-home-desktop.png) và [mobile](qa-home-mobile.png).

Gates tích hợp: `pnpm@11.25.0 test:all`, Next production build và TypeScript **exit0**. Lệnh, thời điểm và hash log local trong [integration-gates.json](reports/integration-gates.json). Bản build có route mới `/api/tutor/feedback` và `/api/admin/jobs`; route vẫn cần nghiệm thu quyền trên môi trường public. Không cộng các assertion từ nhiều lần chạy thành số người dùng hoặc mức chính xác AI.

Kiểm tra chéo đã phát hiện và sửa: micro không dừng khi nguồn làm mới nền; một bài bị đếm nhiều lần vì lời giải nhắc vị trí A/B; client cũ bỏ trường lịch ôn/loại trừ; bản nháp rỗng bị điền lại; thông báo lưu lịch ôn không phản ánh lỗi storage. Test tái hiện ở các module, xem [LEARNING](LEARNING.md), [TUTOR-VOICE](TUTOR-VOICE.md), [TEACHER-ASSESSMENT](TEACHER-ASSESSMENT.md).

Phạm vi này không phải chứng nhận WCAG, pentest toàn hệ thống, chất lượng provider, thiết bị native hoặc hiệu quả học tập. Public/deploy/Drive/biên nhận là các gate riêng trong [CHECKLIST](CHECKLIST.md).
