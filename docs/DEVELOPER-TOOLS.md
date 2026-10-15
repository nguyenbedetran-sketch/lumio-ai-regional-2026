# Công cụ phát triển Lumio

Kiểm tra ngày 27/09/2026. Đây là công cụ hỗ trợ phát triển, không phải các tính năng AI hiển thị cho người học. Bảng ghi riêng việc đã cài, đã chạy và còn thiếu; cài công cụ không đồng nghĩa sản phẩm đã được kiểm toán hoặc chuyển cơ sở dữ liệu.

## Trạng thái

| Công cụ được yêu cầu | Trạng thái đã xác minh | Phần còn lại |
| --- | --- | --- |
| [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli) | Đã cài `@playwright/cli` 0.1.21 và chạy kiểm thử UI local bằng Edge ở profile riêng. | Xem `qa-command-report.json`; chưa kiểm tra mọi trình duyệt hoặc điện thoại thật. |
| [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp) | Đã có helper offline tạo mẫu MCP giới hạn project, chỉ đọc; 11/11 kiểm thử đạt. Chưa có project ref thật. | Chưa xác thực/kết nối, chưa truy vấn project, chưa chạy migration. Backend Lumio hiện vẫn dùng SQLite. |
| [Strix](https://github.com/usestrix/strix) | Đã đọc README, requirements và license tại revision cố định. Chưa cài CLI, chưa quét. | Chưa tìm thấy Docker; chưa cấu hình mô hình local cho phiên kiểm thử. |
| [SkillUI](https://github.com/amaancoderx/npxskillui) | Đã cài 1.3.4, chạy phân tích CSS/component allowlist; xuất báo cáo 20 màu, 24 component, 38 khai báo chuyển động. | Phân tích tĩnh có thể suy luận sai; quyết định áp dụng ghi trong PLUGIN-REVIEW.md. Không cài skill toàn máy. |
| [Ponytail](https://github.com/DietrichGebert/ponytail) | Đã cài riêng skill `ponytail-review`, giữ nguyên nội dung upstream, chỉ kích hoạt khi được gọi rõ ràng. | Không cài plugin luôn bật, lifecycle hooks hoặc chế độ tự sửa code. |

Báo cáo UI nằm tại `docs/qa-command-report.json`, kết quả thiết kế ở `docs/design-audit/`. Không có thay đổi thiết lập bảo mật Codex toàn máy trong phần cấu hình này.

## Supabase MCP: tạo mẫu để xem trước

Helper `scripts/setup-supabase-mcp.cjs` không gọi mạng, không đọc token/env, không mở OAuth và không chỉnh cấu hình Codex toàn máy. Dùng project ref của bạn gồm đúng 20 chữ cái thường, hoặc URL chuẩn `https://REF.supabase.co`. Giá trị `abcdefghijklmnopqrst` dưới đây chỉ là ví dụ, không phải project đã kết nối.

In mẫu ra màn hình mà không tạo tệp:

```powershell
node scripts/setup-supabase-mcp.cjs --project-ref abcdefghijklmnopqrst --print
```

Tạo tệp trong thư mục đầu ra riêng, tính từ project `eduvi` dù terminal đang ở đâu:

```powershell
node scripts/setup-supabase-mcp.cjs --project-ref https://abcdefghijklmnopqrst.supabase.co --output-dir tooling/supabase-config
```

Kết quả nằm ở `tooling/supabase-config/.codex/config.toml`, chỉ có section sau với ref đã kiểm tra:

```toml
[mcp_servers.supabase_lumio_readonly]
url = "https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst&read_only=true&features=database,docs"
```

Đầu ra phải là thư mục con tương đối rõ ràng; không nhận `.`/`..`, đường dẫn tuyệt đối hoặc đường dẫn qua symlink/junction. Helper dùng tạo tệp độc quyền và từ chối ghi đè. Nếu cấu hình đã có, dùng `--print`, xem nội dung và hợp nhất thủ công vào `.codex/config.toml` của đúng project. Không thay thế toàn bộ cấu hình đang dùng. Trong bản bàn giao chưa chạy lệnh ghi mẫu với project ref thật.

Codex chỉ đọc cấu hình project khi project được tin cậy; helper không sửa trạng thái tin cậy, chính sách phê duyệt hay sandbox. Sau khi hợp nhất, việc đăng nhập Supabase vẫn cần thực hiện trong luồng xác thực của MCP client. `read_only=true` giới hạn truy vấn thành chỉ đọc, `project_ref` giới hạn project và `features=database,docs` giới hạn nhóm công cụ. Cấu hình này phục vụ phát triển, không tự chuyển backend SQLite sang Supabase. [Codex project configuration](https://learn.chatgpt.com/docs/config-file/config-basic), [Supabase MCP configuration](https://supabase.com/docs/guides/ai-tools/mcp#configuration-options).

Kiểm thử: `node tests/supabase-mcp.cjs` — **11/11 đạt**, chỉ dùng thư mục tạm. Bao gồm ref/URL không hợp lệ, không in credentials, chế độ print không tạo tệp, từ chối ghi đè, đường dẫn ngoài project và symlink/junction; cấu hình project/global giả lập giữ nguyên.

## Ponytail theo dự án

Vị trí: `.agents/skills/ponytail-review/`. Gồm `SKILL.md`, bản quyền MIT, `SOURCE.md` ghi revision/hash và `agents/openai.yaml` với `allow_implicit_invocation: false`. Không có script chạy ngầm hoặc kết nối mạng riêng.

Mở thư mục `eduvi` làm project trong Codex rồi dùng ở lượt tiếp theo:

```text
$ponytail-review xem diff vừa sửa, chỉ báo phần phức tạp không cần thiết; giữ nguyên xác thực, kiểm tra đầu vào, credit, accessibility và kiểm thử cần thiết.
```

Đây là review độ phức tạp, không thay thế review tính đúng đắn/bảo mật và không tự áp dụng thay đổi. Nếu đang mở workspace cha `l-m`, Codex không tự quét sâu xuống skill trong `outputs/eduvi`; hãy mở project đó hoặc tham chiếu đúng file. [Tài liệu skill theo project của OpenAI](https://learn.chatgpt.com/docs/build-skills).

Nguồn cố định: `DietrichGebert/ponytail@e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156`, giấy phép MIT. Hash và bản quyền đầy đủ nằm cạnh skill. Chỉ cần host đọc Markdown; không cần API key riêng cho skill.

## Strix: đã chuẩn bị, chưa chạy

Nguồn kiểm tra: [`usestrix/strix@ae38fe70cd0260555a2ac745ca585e16bf3d6c74`](https://github.com/usestrix/strix/tree/ae38fe70cd0260555a2ac745ca585e16bf3d6c74), phiên bản trong `pyproject.toml` là 1.6.2, Apache-2.0, Python từ 3.12. Luồng local yêu cầu Docker đang chạy và mô hình AI. Nguồn upstream có tùy chọn inference local; luồng cloud có thể tải mã nguồn lên dịch vụ. [Quick Start](https://docs.strix.ai/quickstart).

Máy kiểm tra có `uv 0.12.5`, Python 3.12.14. Không tìm thấy `docker`, `strix`, `ollama`, `lms` trên PATH; hai đường dẫn Docker Desktop tiêu chuẩn cũng không tồn tại. Đây là kết quả kiểm tra công cụ, không khẳng định mọi thư mục trên máy đã được tìm hết.

Đã tạo [STRIX-SCOPE.md](STRIX-SCOPE.md) cho fixture tách biệt với dữ liệu giả phục vụ kiểm thử. Chưa tạo fixture hoặc container. Khi Docker và inference local đã sẵn sàng, cài một bản CLI đã ghim phiên bản trong môi trường công cụ riêng, kiểm tra `strix --help`, rồi mới chạy từ thư mục staging:

```powershell
strix -n --target ./lumio-fixture --scan-mode quick --instruction-file ./STRIX-SCOPE.md
```

Lệnh trên chỉ là hướng dẫn chưa thực thi. `lumio-fixture` phải là bản sao sạch không chứa env, database thật, uploads hoặc token; cấu hình endpoint inference local trước. Không dùng bản đang chạy port 3000 hay URL public làm target. File scope không tự chặn mạng; cần giới hạn mạng thực tế trước khi chạy. Không cung cấp khóa Lumio cho Strix hoặc upload project lên cloud trong phiên này.

## Kiểm thử cục bộ đã chạy

**83/83 đạt**, Node 24, database SQLite tạm riêng, provider transport giả lập; không dùng ví người dùng hoặc gọi AI trả phí:

| Tệp | Số kiểm thử đạt |
| --- | ---: |
| `tests/admin.cjs` | 18 |
| `tests/auth-security.cjs` | 9 |
| `tests/billing.cjs` | 14 |
| `tests/ai-billing.cjs` | 12 |
| `tests/mobile.cjs` | 17 |
| `tests/mobile-ai.cjs` | 13 |

Các kiểm thử bao phủ quyền admin, liên kết/thu hồi danh tính, origin, ví dùng chung, chặn vượt credit, settle/refund, token mobile và hủy yêu cầu. Đây là hồi quy tự động của Lumio, **không phải báo cáo Strix** hoặc chứng nhận không còn lỗ hổng.

## Bộ “37 Codex Skills” được chia sẻ thêm

Phiên chính thấy trang giới thiệu hiển thị “37 Codex Skills”, 38 tệp/17 KB; tải xuống yêu cầu email kèm đăng ký newsletter. Chưa gửi email, chưa tải hoặc đọc nội dung 37 skill, chưa cài bộ này. Không suy diễn tên hay tác dụng từ trang giới thiệu.

## Chạy lại công cụ đã tích hợp

Mở terminal ở thư mục web (`eduvi` trên máy hiện tại), cài từ lockfile rồi chạy web bằng `pnpm dev`. Ở terminal thứ hai:

```powershell
pnpm test:ui
pnpm design:audit
```

`test:ui` chỉ mở `http://localhost:3000` bằng Edge trong session tạm riêng, tạo bài mẫu ở profile đó và đóng đúng session khi kết thúc. Không nạp cookie/token người dùng và không gọi AI trả phí. Có thể chọn Chrome với `pnpm test:ui chrome` nếu đã cài; chỉ Edge được chạy trong phiên bàn giao này. CLI cần trình duyệt tương ứng được cài. CLI 0.1.21 kéo Playwright bản alpha đã khóa trong pnpm-lock; đây là công cụ dev, không được import vào app runtime.

`design:audit` tạo thư mục tạm chỉ có CSS và component UI, không sao chép env, server, database hay cấu hình thực thi. Chạy local với `--format design-md --no-skill`, rồi xóa chính thư mục tạm của lần chạy. Báo cáo không phải bộ quy tắc tự động áp dụng.

Ponytail đã được dùng để review phần mới; xem [PLUGIN-REVIEW.md](PLUGIN-REVIEW.md).
