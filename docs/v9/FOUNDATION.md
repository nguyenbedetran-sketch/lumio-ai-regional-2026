# V9 · Nền tảng Lumio Aurora

## Phạm vi đã làm

Đã đọc toàn bộ yêu cầu V9 và rà CSS thực tế. Theme cũ được khai báo trong `lumio.css`, `polish.css` và `experience.css`; selector dark trong `polish.css` có độ ưu tiên cao hơn bảng màu forest ở file sau. Nút chính, focus và chuyển động cũng có nhiều giá trị cứng khác nhau.

Palette chung hiện nằm trong `app/experience.css`, giữ các tên biến `--lm-*` / `--lx-*` mà component đang dùng. Các bảng màu cũ được bỏ khỏi hai file trước. Typography và cấu trúc component hiện có được giữ nguyên.

| Vai trò | Dark | Light |
| --- | --- | --- |
| Canvas / surface | `#101916` / `#1B2521` | `#F1F5EE` / `#FFFFFF` |
| Chữ / chữ phụ | `#EDF3E8` / `#A3B3A8` | `#1D2F26` / `#566B5E` |
| Nút chính / chữ trên nút | `#C8F29A` / `#172719` | `#C8F29A` / `#172719` |
| AI / surface AI | `#B7A8FF` / `#302B43` | `#6550A8` / `#EFEAFB` |
| Thành công | `#8CD8B0` | `#246643` |
| Cảnh báo | `#FFCC85` | `#805014` |
| Focus | `#C8F29A` | `#6550A8` |

Token dùng chung: `--lm-ai`, `--lm-ai-tint`, `--lm-ai-line`; `--lm-primary`, `--lm-on-primary`, `--lm-primary-hover`, `--lm-primary-line`; `--lm-focus`, `--lm-control-line`; `--lm-success/warning/error/info` cùng các surface `*-bg`; `--lm-chart-1` đến `--lm-chart-4`.

CSS theo hệ thống khi chưa có `data-theme`; giá trị light/dark rõ ràng luôn thắng. Cơ chế lưu theme, bootstrap và React do phần tích hợp chung quản lý. CSS này không đọc localStorage hoặc thay đổi state.

## Chuyển động và tương tác

- Hover180ms, state220ms, panel280ms, easing `cubic-bezier(.2,.75,.2,1)` được khai báo làm token.
- Card tương tác nâng tối đa2px; nút nâng1px và trở về0 khi nhấn, không scale khi nhấn.
- `data-motion="off"` và OS reduced-motion dừng timeline/transition và hover/press transform của các control chung. `subtle` không nâng các control này.
- Các transform phục vụ bố cục, drawer hoặc lật thẻ không bị reset toàn cục.
- Focus bàn phím3px; shared input/select có chiều cao tối thiểu44px; placeholder đọc được. Nút disabled vẫn dùng thuộc tính native.
- Sửa thứ tự ưu tiên CSS của nút chính trong topbar để nền thường không ghi đè màu nền hành động nhưng giữ chữ tối.

## Bằng chứng có phạm vi

`node scripts/test-v9-foundation-ui.cjs`: **94 PASS**. [JSON](qa-foundation.json) ghi hash toàn bộ CSS được import, màu thực sự từ `getComputedStyle`, tỷ lệ tương phản, theme, focus, hover/press, reduced-motion và viewport.

Trong DOM đại diện có nhãn tổng hợp:

- Các mẫu chữ thường được đo đều ít nhất4.5:1; thấp nhất5.46:1. Chữ phụ light5.74:1, dark7.18:1. Chữ nút chính và nút chính topbar12.4:1.
- Viền hoặc nền control so với vùng kề, focus và marker biểu đồ đạt ít nhất3:1 ở các mẫu được kiểm.
- Các chiều rộng320/360/390/430/768/1024/1440 không tràn ngang trong fixture.
- Không có request ngoài fixture, API sản phẩm hoặc provider. Không có dữ liệu học sinh.

Đã mở và kiểm tra trực quan [ảnh dark](qa-foundation-dark.png) và [ảnh light](qa-foundation-light.png). Đây là mẫu DOM ngữ nghĩa dùng CSS sản phẩm thật, không phải ảnh chụp route production hoặc bằng chứng chạy trọn luồng học.

## Trạng thái

| Hạng mục | Trạng thái |
| --- | --- |
| Gom palette, alias và semantic token | Đã làm, kiểm tra computed CSS |
| Control/focus/contrast/motion mẫu chung | Đã làm,94 kiểm tra đạt |
| Typography/font và dữ liệu học hiện có | Giữ cơ chế hiện có |
| Home/sidebar/notice và shared JS motion | Phần tích hợp riêng của nhóm; không suy kết quả từ fixture này |
| Build/typecheck/regression toàn bản tích hợp | Chờ kết quả của điều phối viên |
| Mọi route, mọi chart, screen reader, WCAG toàn app | Chưa nghiệm thu toàn diện |
| Thiết bị thật/public V9/provider/pilot | Không kiểm trong phạm vi này |

File runtime thay đổi: `app/lumio.css`, `app/polish.css`, `app/experience.css`, `app/premium-v3.css`, `app/learner-v7.css`. Không thêm thư viện hoặc sửa backend/state. Các hard-coded visual ở màn hình cũ ngoài mẫu kiểm vẫn cần được rà theo từng component; token mới không tự chứng nhận mọi màu cũ đã đạt chuẩn.
