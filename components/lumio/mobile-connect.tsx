"use client";
import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
  Smartphone,
  ArrowLeft,
  ShieldCheck,
  Copy,
  Check,
  Link2,
  Trash2,
} from "lucide-react";

type Device = {
  id: string;
  name: string;
  expiresAt: number;
  lastSeenAt: string;
};
export function MobileConnect({ publicDemo }: { publicDemo: boolean }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState(
    publicDemo ? "PUBLIC_DEMO_ONLY" : "loading",
  );
  const [pair, setPair] = useState<{ code: string; expiresAt: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const refresh = useCallback(async () => {
    if (publicDemo) return;
    try {
      const response = await fetch("/api/mobile/devices", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || "ERROR");
        return;
      }
      setDevices(data.devices);
      setStatus("ready");
    } catch {
      setStatus("ERROR");
    }
  }, [publicDemo]);
  useEffect(() => {
    void refresh();
    if (!publicDemo)
      fetch("/api/config")
        .then((r) => r.json())
        .then(setProviders)
        .catch(() => {});
  }, [refresh, publicDemo]);
  useEffect(() => {
    if (!pair) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((pair.expiresAt - Date.now()) / 1000));
      setSeconds(left);
      if (!left) setPair(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pair]);
  async function createCode() {
    setBusy(true);
    setCopied(false);
    try {
      const response = await fetch("/api/mobile/devices", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || "ERROR");
        return;
      }
      setPair(data);
      setStatus("ready");
    } catch {
      setStatus("ERROR");
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/mobile/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error();
      await refresh();
    } catch {
      setStatus("ERROR");
    } finally {
      setBusy(false);
    }
  }
  const errors: Record<string, string> = {
    PUBLIC_DEMO_ONLY:
      "Bản web demo công khai chưa bật tài khoản và AI. App Android vẫn dùng được thư viện và công cụ học ngoại tuyến. Ghép nối cần máy chủ Lumio có đăng nhập và AI đã cấu hình.",
    SIGN_IN_REQUIRED: "Đăng nhập trên web trước khi kết nối điện thoại.",
    SESSION_REVOKED: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
    REAUTH_REQUIRED:
      "Đăng nhập lại để xác nhận trước khi cấp quyền cho điện thoại.",
    ERROR: "Chưa kết nối được máy chủ. Hãy thử lại.",
  };
  return (
    <main className="lm-mobile-page">
      <a href="/" className="lm-button">
        <ArrowLeft size={17} /> Về không gian học
      </a>
      <header>
        <span className="lm-overline">LUMIO · ANDROID</span>
        <h1>
          Mang việc học
          <br />
          <em>theo bạn.</em>
        </h1>
        <p>
          Kết nối app điện thoại với tài khoản Lumio. Tài liệu trên mỗi thiết bị
          được lưu riêng; ghép nối cho phép dùng AI và giọng nói theo cùng tài
          khoản và số dư credit.
        </p>
        <Smartphone className="lm-mobile-hero-icon" aria-hidden="true" />
      </header>
      <div className="lm-mobile-columns">
        <section className="lm-panel">
          <h2>
            <Link2 size={22} /> Kết nối điện thoại
          </h2>
          <ol>
            <li>
              Mở Lumio trên Android, vào{" "}
              <strong>Cài đặt → Kết nối tài khoản</strong>.
            </li>
            <li>Nhập địa chỉ backend Lumio trong app.</li>
            <li>Tạo mã bên dưới, rồi dán vào app trên điện thoại của bạn.</li>
          </ol>
          {status === "loading" ? (
            <p role="status">Đang kiểm tra tài khoản…</p>
          ) : status !== "ready" ? (
            <p className="lm-help" role="status">
              {errors[status] || errors.ERROR}
            </p>
          ) : null}
          {!publicDemo &&
            ["SIGN_IN_REQUIRED", "SESSION_REVOKED", "REAUTH_REQUIRED"].includes(
              status,
            ) && (
              <div className="lm-row">
                {["google", "facebook"]
                  .filter((p) => providers[p])
                  .map((p) => (
                    <button
                      key={p}
                      className="lm-button"
                      onClick={() => void signIn(p, { callbackUrl: "/mobile" })}
                    >
                      Đăng nhập {p === "google" ? "Google" : "Facebook"}
                    </button>
                  ))}
              </div>
            )}
          {!publicDemo && status === "ready" && (
            <button
              className="lm-primary"
              disabled={busy}
              onClick={() => void createCode()}
            >
              {busy ? "Đang tạo…" : "Tạo mã kết nối 5 phút"}
            </button>
          )}
          {pair && (
            <div className="lm-pair-code">
              <label htmlFor="pair-code">
                Mã dùng một lần · còn {seconds} giây
              </label>
              <input
                id="pair-code"
                readOnly
                value={pair.code}
                spellCheck={false}
              />
              <button
                className="lm-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pair.code);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? "Đã sao chép" : "Sao chép mã"}
              </button>
            </div>
          )}
          <p className="lm-help">
            <ShieldCheck size={16} /> Mã cấp quyền sử dụng tài khoản. Chỉ nhập
            vào app của bạn. Phiên điện thoại hết hạn sau 7 ngày hoặc khi bạn
            thu hồi.
          </p>
        </section>
        <section className="lm-panel">
          <h2>Thiết bị đã kết nối</h2>
          <p className="lm-help">
            Tối đa 5 thiết bị. Thu hồi quyền không xóa tài liệu ngoại tuyến trên
            điện thoại.
          </p>
          {devices.length ? (
            devices.map((device) => (
              <div className="lm-device-row" key={device.id}>
                <Smartphone size={22} />
                <div>
                  <strong>{device.name}</strong>
                  <small>
                    Hết hạn:{" "}
                    {new Date(device.expiresAt).toLocaleDateString("vi-VN")}
                  </small>
                </div>
                <button
                  className="lm-icon"
                  disabled={busy}
                  title={`Thu hồi ${device.name}`}
                  aria-label={`Thu hồi ${device.name}`}
                  onClick={() => void revoke(device.id)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          ) : (
            <p>Chưa có điện thoại kết nối.</p>
          )}
          {!publicDemo && (
            <button
              className="lm-button"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Làm mới danh sách
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
