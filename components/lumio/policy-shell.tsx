import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { BrandSymbol } from "./brand";
import "../../app/policy.css";

export function PolicyShell({
  title,
  subtitle,
  children,
  updatedAt = "20/09/2026",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  updatedAt?: string;
}) {
  return (
    <div className="lm-policy-page">
      <header>
        <a className="lm-policy-brand" href="/">
          <BrandSymbol />
          <strong>
            Lumio <small>AI</small>
          </strong>
        </a>
        <a className="lm-policy-back" href="/">
          <ArrowLeft size={16} />
          Về không gian học
        </a>
      </header>
      <main>
        <div className="lm-policy-eyebrow">
          <ShieldCheck size={16} />
          TRUNG TÂM QUYỀN RIÊNG TƯ
        </div>
        <h1>{title}</h1>
        <p className="lm-policy-intro">{subtitle}</p>
        <p className="lm-policy-version">
          Bản thử nghiệm · Cập nhật {updatedAt}
        </p>
        <article>{children}</article>
        <div className="lm-policy-contact">
          <strong>Cần hỗ trợ?</strong>
          <p>
            Liên hệ người phụ trách dự án Lumio AI qua kênh đã cung cấp cho bạn
            quyền dùng bản thử nghiệm. Kênh hỗ trợ công khai sẽ được bổ sung
            trước khi phát hành rộng rãi.
          </p>
        </div>
      </main>
      <footer>
        <span>Lumio AI · Học theo cách của bạn.</span>
        <nav aria-label="Chính sách">
          <a href="/privacy">
            Quyền riêng tư
            <ArrowUpRight size={12} />
          </a>
          <a href="/terms">
            Điều khoản
            <ArrowUpRight size={12} />
          </a>
          <a href="/data-deletion">
            Xóa dữ liệu
            <ArrowUpRight size={12} />
          </a>
        </nav>
      </footer>
    </div>
  );
}
