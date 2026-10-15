"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
  CheckCircle2,
  Link2,
  LoaderCircle,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
type State = {
  authenticated: boolean;
  isAdmin: boolean;
  recentLogin?: boolean;
  linkingEnabled?: boolean;
  identities?: { provider: string; email: string | null }[];
  providers: { google: boolean; facebook: boolean };
};
const texts = {
  vi: {
    title: "Một tài khoản, hai cách đăng nhập",
    description:
      "Liên kết Google và Facebook để mở cùng một không gian học trên trình duyệt này.",
    connected: "Đã liên kết",
    connect: "Liên kết",
    unavailable: "Chưa kết nối dịch vụ",
    signin: "Đăng nhập để quản lý",
    reauth: "Xác nhận tài khoản để tiếp tục",
    privacy:
      "Chỉ liên kết sau khi bạn xác thực ở dịch vụ đã chọn. Hai tài khoản có cùng email không tự động gộp.",
    failed:
      "Chưa liên kết được. Thử lại hoặc đăng nhập lại tài khoản hiện tại.",
    admin: "Mở trung tâm quản trị",
    busy: "Đang mở…",
  },
  en: {
    title: "One account, two ways in",
    description:
      "Link Google and Facebook to use the same learning workspace in this browser.",
    connected: "Linked",
    connect: "Link account",
    unavailable: "Service not connected",
    signin: "Sign in to manage",
    reauth: "Confirm your account to continue",
    privacy:
      "Linking requires authentication with the selected service. Matching email addresses are never merged automatically.",
    failed:
      "Could not link. Try again or sign in to your current account again.",
    admin: "Open admin console",
    busy: "Opening…",
  },
  "zh-CN": {
    title: "一个账户，两种登录方式",
    description: "关联 Google 和 Facebook，在此浏览器中使用同一学习空间。",
    connected: "已关联",
    connect: "关联账户",
    unavailable: "服务尚未连接",
    signin: "登录以管理",
    reauth: "请确认账户以继续",
    privacy: "关联需要验证所选服务的账户。不会根据相同邮箱自动合并。",
    failed: "关联失败，请重试或重新登录。",
    admin: "打开管理中心",
    busy: "正在打开…",
  },
  ja: {
    title: "1つのアカウント、2つのログイン方法",
    description:
      "Google と Facebook を連携し、このブラウザーで同じ学習スペースを使用します。",
    connected: "連携済み",
    connect: "連携する",
    unavailable: "未接続",
    signin: "ログインして管理",
    reauth: "アカウントを確認してください",
    privacy:
      "連携には選択したサービスでの認証が必要です。同じメールでも自動統合しません。",
    failed: "連携できません。再試行または再ログインしてください。",
    admin: "管理画面を開く",
    busy: "開いています…",
  },
  ko: {
    title: "하나의 계정, 두 가지 로그인",
    description:
      "Google과 Facebook을 연결해 이 브라우저의 학습 공간을 함께 사용하세요.",
    connected: "연결됨",
    connect: "계정 연결",
    unavailable: "미연결 서비스",
    signin: "로그인하여 관리",
    reauth: "계정을 다시 확인하세요",
    privacy:
      "연결하려면 해당 서비스에서 인증해야 합니다. 이메일이 같아도 자동 병합하지 않습니다.",
    failed: "연결하지 못했습니다. 다시 시도하거나 현재 계정에 로그인하세요.",
    admin: "관리 콘솔 열기",
    busy: "여는 중…",
  },
};
export function AccountConnections({ locale }: { locale: Locale }) {
  const t = texts[locale];
  const [state, setState] = useState<State | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [localFacebook, setLocalFacebook] = useState(false);
  useEffect(() => {
    setLocalFacebook(window.location.origin === "http://127.0.0.1:3000");
  }, []);
  const localNote = {
    vi: "Facebook dùng địa chỉ localhost để đăng nhập thử. Nếu muốn liên kết, đăng nhập lại Google ở đó trước. Thư viện ở hai địa chỉ lưu riêng; có thể chuyển bằng Xuất/Nhập bản sao.",
    en: "Facebook testing uses localhost. Sign in with Google there first to link accounts. Each address has its own local library; use Export/Import backup to move it.",
    "zh-CN":
      "Facebook 测试使用 localhost。关联前请先在该地址登录 Google。两个地址分别保存本地资料，可通过导出/导入转移。",
    ja: "Facebook のテストには localhost を使います。連携前にそこで Google にログインしてください。資料はアドレスごとに保存され、エクスポート/インポートで移動できます。",
    ko: "Facebook 테스트는 localhost를 사용합니다. 연결하려면 먼저 그 주소에서 Google로 로그인하세요. 주소별 자료는 백업 내보내기/가져오기로 옮길 수 있습니다.",
  }[locale];
  useEffect(() => {
    let active = true;
    fetch("/api/account")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((s) => {
        if (active) setState(s);
      })
      .catch(() => {
        if (active) setError(t.failed);
      });
    return () => {
      active = false;
    };
  }, [t.failed]);
  async function connect(provider: "google" | "facebook") {
    if (provider === "facebook" && localFacebook) {
      window.location.assign("http://localhost:3000/?connections=1");
      return;
    }
    setBusy(provider);
    setError("");
    try {
      if (state?.authenticated) {
        const r = await fetch("/api/account/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        if (!r.ok) {
          const b = await r.json();
          if (b.error === "REAUTHENTICATION_REQUIRED") {
            setError(t.reauth);
            setBusy("");
            return;
          }
          throw Error();
        }
      }
      await signIn(provider, {
        callbackUrl: window.location.origin + "/?connections=1",
      });
    } catch {
      setError(t.failed);
      setBusy("");
    }
  }
  return (
    <section className="lm-panel lm-account-connections">
      <div className="lm-account-heading">
        <Link2 size={22} />
        <div>
          <h3>{t.title}</h3>
          <p className="lm-help">{t.description}</p>
        </div>
      </div>
      {error && (
        <p className="lm-error" role="alert">
          {error}
        </p>
      )}
      {!state && !error && <LoaderCircle size={20} aria-label={t.busy} />}
      {state &&
        (["google", "facebook"] as const).map((provider) => {
          const linked = state.identities?.find((i) => i.provider === provider);
          return (
            <div className="lm-connection-row" key={provider}>
              <span
                className={`lm-connection-icon ${provider}`}
                aria-hidden="true"
              >
                {provider === "google" ? "G" : "f"}
              </span>
              <div>
                <strong>{provider === "google" ? "Google" : "Facebook"}</strong>
                <small>
                  {linked?.email ||
                    (!state.providers[provider] ? t.unavailable : "")}
                </small>
              </div>
              {linked ? (
                <span className="lm-connection-linked">
                  <CheckCircle2 size={15} />
                  {t.connected}
                </span>
              ) : (
                <button
                  className="lm-button"
                  disabled={
                    !!busy ||
                    !state.providers[provider] ||
                    (state.authenticated && !state.linkingEnabled)
                  }
                  onClick={() => void connect(provider)}
                >
                  {busy === provider ? (
                    <LoaderCircle size={16} />
                  ) : (
                    <Link2 size={15} />
                  )}{" "}
                  {state.authenticated ? t.connect : t.signin}
                </button>
              )}
            </div>
          );
        })}
      {state?.authenticated && !state.recentLogin && (
        <button
          className="lm-button"
          onClick={() =>
            void signIn(state.identities?.[0]?.provider || "google", {
              callbackUrl: window.location.origin + "/?connections=1",
            })
          }
        >
          <ShieldCheck size={16} />
          {t.reauth}
        </button>
      )}
      <p className="lm-help lm-connection-note">
        <ShieldCheck size={15} />
        {t.privacy}
      </p>
      {localFacebook && (
        <p className="lm-help">
          {localNote}{" "}
          <a href="http://localhost:3000/?connections=1">localhost:3000 ↗</a>
        </p>
      )}
      {state?.isAdmin && (
        <a className="lm-button" href="/admin">
          {t.admin}
          <ArrowUpRight size={16} />
        </a>
      )}
    </section>
  );
}
