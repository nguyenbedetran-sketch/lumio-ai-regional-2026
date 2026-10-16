// Shared product CSS, representative semantic DOM, no product state or network.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v9-foundation-ui");
function build() {
  fs.mkdirSync(folder, { recursive: true });
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  const files = [...layout.matchAll(/import "([^"\n]+\.css)"/g)].map((m) =>
    m[1].startsWith("./")
      ? path.join(root, "app", m[1])
      : require.resolve(m[1]),
  );
  const css = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  fs.writeFileSync(path.join(folder, "fixture.css"), css);
  fs.writeFileSync(
    path.join(folder, "fixture.html"),
    `<!doctype html><html lang="vi" data-theme="dark" data-motion="full"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumio Aurora · shared CSS fixture</title><link rel="stylesheet" href="/fixture.css"><style>
  .foundation-scope{max-width:1000px;margin:auto;padding:24px;display:grid;gap:22px}.foundation-scope h1{font-size:28px}.foundation-scope .lm-panel{min-width:0}.foundation-row{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}.foundation-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px}.foundation-scope label{display:grid;gap:8px}.foundation-scope input,.foundation-scope textarea,.foundation-scope select{width:100%}.foundation-scope .lm-space-card{min-width:180px}.foundation-scope .lm-topbar{padding:0;min-height:0;justify-content:start;flex-wrap:wrap}.foundation-scope .lm-content-card{max-width:300px;min-height:120px;text-align:left;padding:20px}.foundation-scope .lm-content-card h3{color:var(--lm-text)}.foundation-status{padding:12px 16px;border-radius:12px}.foundation-chart{font-size:28px}.foundation-qa{font-size:12px;color:var(--lm-muted)}@media(max-width:400px){.foundation-scope{padding:16px}.foundation-scope h1{font-size:24px}}
  </style><body><main class="lumio"><div class="foundation-scope">
  <header><p class="foundation-qa">KIỂM THỬ CSS · DOM tổng hợp · Không có dữ liệu học sinh hoặc API</p><h1 id="heading">Lumio Aurora</h1><p id="secondary" style="color:var(--lm-fg-secondary)">Rõ ràng, tập trung và dễ tiếp cận.</p></header>
  <section class="lm-panel"><h2 id="body-text">Học từ tài liệu của bạn</h2><p class="lm-help" id="muted">Chọn một bước học phù hợp. Lịch ôn là gợi ý, không phải điểm thành thạo.</p><div class="foundation-row"><button id="primary" class="lm-button primary">Bắt đầu học</button><button id="secondary-button" class="lm-button">Xem tài liệu</button><button id="disabled" class="lm-button primary" disabled>Chưa có tài liệu</button><button id="danger" class="lm-button danger-fill">Xóa bản nháp</button><button id="icon" class="lm-icon" aria-label="Tùy chọn"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5" fill="none" stroke="currentColor"/></svg></button></div>
  <div class="lm-topbar"><button id="topbar-primary" class="lm-button primary">Học ngay</button><button class="lm-button">Tài khoản</button></div><div class="foundation-grid"><label>Câu hỏi<input id="input" placeholder="Ví dụ: Vì sao đổi dấu ở bước này?"></label><label>Trình độ<select id="select"><option>Cơ bản</option><option>Nâng cao</option></select></label><label>Ghi chú<textarea id="textarea" rows="3" placeholder="Ghi lại ý bạn chưa hiểu"></textarea></label></div><details class="lski-method"><summary id="disclosure">Cách sử dụng gợi ý</summary><p>Tự thử trước rồi kiểm tra lại tài liệu gốc.</p></details></section>
  <section class="lm-panel lm-ai-surface" id="ai-surface"><span class="lm-ai-label" id="ai-label">LUMIO AI</span><h2>Gợi ý đúng lúc, không làm thay</h2><p style="color:var(--lm-text)" id="ai-body">Mỗi phản hồi vẫn cần đối chiếu với nguồn học.</p></section>
  <section class="lm-panel"><h2>Trạng thái có nhãn rõ</h2><div class="foundation-grid"><p id="success" class="foundation-status lm-status-success">✓ Đã lưu ghi chú</p><p id="warning" class="foundation-status lm-status-warning">⚠ Cần kiểm tra lại nguồn</p><p id="error" class="foundation-status lm-status-error">! Không thể lưu thay đổi</p><p id="info" class="foundation-status lm-status-info">ⓘ Chỉ lưu trên thiết bị này</p></div><p id="existing-error" class="lm-error">Không thể gửi yêu cầu. Hãy thử lại khi sẵn sàng.</p></section>
  <section class="lm-panel"><h2>Tài liệu và tương tác</h2><div class="foundation-row"><button class="lm-content-card" id="card"><h3>Phương trình bậc nhất</h3><p>Học liệu tổng hợp để kiểm tra kiểu hiển thị.</p></button><button class="lm-space-card" id="space">Không gian học</button></div><div class="lm-action-grid"><button id="action"><strong>Thêm tài liệu</strong><small>Chọn nội dung bạn có quyền sử dụng</small></button></div><div class="foundation-chart" aria-label="Màu biểu đồ, không có số liệu"><span id="chart1" style="color:var(--lm-chart-1)">●</span> <span id="chart2" style="color:var(--lm-chart-2)">◆</span> <span id="chart3" style="color:var(--lm-chart-3)">▲</span> <span id="chart4" style="color:var(--lm-chart-4)">■</span></div><div id="layout-transform" style="transform:translateX(7px)">Nội dung bố cục được giữ nguyên khi giảm chuyển động.</div></section>
  </div></main></body></html>`,
  );
  return {
    folder,
    cssFiles: files.map((f) => path.relative(root, f)),
    cssSha256: crypto.createHash("sha256").update(css).digest("hex"),
  };
}
module.exports = { build };
