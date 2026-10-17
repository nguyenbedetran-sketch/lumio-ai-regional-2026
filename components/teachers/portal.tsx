"use client";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { BrandSymbol } from "../lumio/brand";
import { countryOptions } from "../../lib/teachers/country-options";
import type {
  TeacherProfile,
  TeacherSelfState,
  TeachingLevel,
} from "../../lib/teachers/contracts";

type Locations = {
  provinces: {
    code: string;
    name: string;
    wards: { code: string; name: string }[];
  }[];
  metadata: { notice: string };
};
type Draft = Omit<TeacherProfile, "teacherDeclaration" | "storageConsent"> & {
  teacherDeclaration: boolean;
  storageConsent: boolean;
};
const levels: Record<TeachingLevel, string> = {
  preschool: "Mầm non",
  primary: "Tiểu học",
  lower_secondary: "Trung học cơ sở",
  upper_secondary: "Trung học phổ thông",
  vocational: "Giáo dục nghề nghiệp",
  higher_education: "Đại học / cao đẳng",
  other: "Cấp dạy khác",
};
const statusLabels = {
  pending: "Đang chờ duyệt",
  approved: "Đã cấp quyền giáo viên",
  rejected: "Cần điều chỉnh hồ sơ",
  revoked: "Quyền giáo viên đã thu hồi",
};
const blank = (name: string): Draft => ({
  applicantName: name,
  countryCode: "VN",
  country: "Việt Nam",
  provinceCity: "",
  ward: "",
  school: "",
  teachingLevel: "lower_secondary",
  subjects: [],
  teacherDeclaration: false,
  storageConsent: false,
  workEmail: "",
  publicEvidenceUrl: "",
});
function message(code: string) {
  return (
    (
      {
        SIGN_IN_REQUIRED: "Phiên đăng nhập đã hết. Đăng nhập lại để tiếp tục.",
        SESSION_REVOKED:
          "Tài khoản hoặc phiên đã thay đổi. Đăng nhập lại để tải đúng hồ sơ.",
        TEACHER_CONFLICT:
          "Hồ sơ đã thay đổi ở nơi khác. Tải lại trạng thái trước khi gửi.",
        TEACHER_REQUEST_REUSED:
          "Mã yêu cầu đã được dùng cho nội dung khác. Tải lại trạng thái rồi thử lại.",
        TEACHER_RATE_LIMIT:
          "Bạn đã gửi nhiều lần trong ngày. Hãy chờ trước khi chỉnh sửa tiếp.",
        TEACHER_ALREADY_APPROVED:
          "Hồ sơ đã được duyệt. Liên hệ quản trị viên nếu cần thay đổi.",
        TEACHER_DECLARATION_REQUIRED:
          "Vui lòng xác nhận thông tin và đồng ý lưu hồ sơ.",
        INVALID_TEACHER_PROFILE:
          "Kiểm tra lại các trường bắt buộc, email và liên kết HTTPS.",
        INVALID_TEACHER_REQUEST:
          "Yêu cầu chưa hợp lệ. Tải lại trạng thái rồi thử lại.",
      } as Record<string, string>
    )[code] ||
    "Chưa kết nối được máy chủ. Nội dung đang nhập vẫn được giữ trên trang; hãy thử lại."
  );
}
export function TeacherPortal({
  account,
  providers,
}: {
  account: { key: string; name: string } | null;
  providers: { google: boolean; facebook: boolean };
}) {
  // A server-authenticated account change unmounts all private state and aborts its requests.
  return (
    <TeacherAccountPortal
      key={account?.key || "guest"}
      account={account}
      providers={providers}
    />
  );
}
function TeacherAccountPortal({
  account,
  providers,
}: {
  account: { key: string; name: string } | null;
  providers: { google: boolean; facebook: boolean };
}) {
  const [state, setState] = useState<TeacherSelfState | null>(null),
    [draft, setDraft] = useState<Draft>(() => blank(account?.name || "")),
    [subjects, setSubjects] = useState(""),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [authLost, setAuthLost] = useState(false),
    [notice, setNotice] = useState("");
  const [locations, setLocations] = useState<Locations | null>(null),
    [locationError, setLocationError] = useState(false),
    [locationRetry, setLocationRetry] = useState(0),
    [manualLocation, setManualLocation] = useState(false);
  const active = useRef(true),
    pending = useRef<{ signature: string; id: string } | null>(null),
    operating = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    try {
      const t = localStorage.getItem("lumio-theme");
      if (t === "dark" || t === "light")
        document.documentElement.dataset.theme = t;
    } catch {}
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  function apply(data: TeacherSelfState) {
    setState(data);
    if (data.application) {
      setDraft({ ...data.application.profile });
      setSubjects(data.application.profile.subjects.join(", "));
    } else {
      setDraft(blank(account?.name || ""));
      setSubjects("");
    }
    setLoaded(true);
  }
  async function load(signal?: AbortSignal) {
    if (!account || operating.current) return;
    operating.current = true;
    const abort = new AbortController();
    controller.current = abort;
    signal?.addEventListener("abort", () => abort.abort(), { once: true });
    if (signal?.aborted) abort.abort();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/teacher-application", {
        headers: { "X-Lumio-Account": account.key },
        cache: "no-store",
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 && active.current && !abort.signal.aborted)
          setAuthLost(true);
        throw new Error(data.error);
      }
      if (active.current && !abort.signal.aborted) {
        apply(data);
        setAuthLost(false);
      }
    } catch (e) {
      if (active.current && !abort.signal.aborted)
        setError(message(e instanceof Error ? e.message : ""));
    } finally {
      if (controller.current === abort) {
        operating.current = false;
        controller.current = null;
        if (active.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => {
      abort.abort();
      controller.current?.abort();
      controller.current = null;
      operating.current = false;
    };
  }, [account?.key]); // account comes from the authenticated server page
  useEffect(() => {
    if (draft.countryCode !== "VN" || locations) return;
    const abort = new AbortController();
    setLocationError(false);
    void fetch("/data/vietnam-locations-v5.2.0.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data: Locations) => {
        if (
          !Array.isArray(data.provinces) ||
          !data.provinces.length ||
          data.provinces.length > 100 ||
          !data.provinces.every(
            (p) =>
              typeof p.code === "string" &&
              typeof p.name === "string" &&
              Array.isArray(p.wards) &&
              p.wards.length < 1000 &&
              p.wards.every(
                (w) => typeof w.code === "string" && typeof w.name === "string",
              ),
          )
        )
          throw Error();
        if (!abort.signal.aborted) setLocations(data);
      })
      .catch(() => {
        if (!abort.signal.aborted) setLocationError(true);
      });
    return () => abort.abort();
  }, [draft.countryCode, locations, locationRetry]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setNotice("");
  };
  const province = locations?.provinces.find(
      (p) => p.name === draft.provinceCity,
    ),
    approved = state?.application?.status === "approved",
    locked = busy || approved || !loaded || authLost;
  const knownProvince = !!province,
    knownWard = !!province?.wards.some((w) => w.name === draft.ward);
  const showManual = draft.countryCode !== "VN" || manualLocation;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account || locked || operating.current) return;
    operating.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      ...draft,
      subjects: subjects
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const expectedRevision = state?.application?.revision || 0,
      signature = JSON.stringify({ expectedRevision, profile: payload });
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/teacher-application", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lumio-Account": account.key,
        },
        body: JSON.stringify({
          requestId: pending.current.id,
          expectedRevision,
          profile: payload,
        }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 && active.current && !abort.signal.aborted)
          setAuthLost(true);
        throw new Error(data.error);
      }
      if (active.current && !abort.signal.aborted) {
        apply(data);
        pending.current = null;
        setNotice(
          "Đã gửi hồ sơ. Bạn có thể theo dõi kết quả duyệt ngay tại đây.",
        );
      }
    } catch (e) {
      if (active.current && !abort.signal.aborted)
        setError(message(e instanceof Error ? e.message : ""));
    } finally {
      operating.current = false;
      controller.current = null;
      if (active.current && !abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="tp-shell">
      <header className="tp-header">
        <a href="/" className="tp-brand">
          <BrandSymbol />
          <strong>
            Lumio <sup>AI</sup>
          </strong>
        </a>
        <a href="/" className="tp-back">
          <ArrowLeft size={16} />
          Về không gian học
        </a>
      </header>
      <main className="tp-main">
        <section className="tp-intro">
          <div>
            <p className="tp-eyebrow">
              <span />
              LUMIO · DÀNH CHO GIÁO VIÊN
            </p>
            <h1>
              Một bước kết nối.
              <br />
              <em>Cùng mở lối tri thức.</em>
            </h1>
            <p>
              Đăng ký hồ sơ giảng dạy để quản trị viên xét cấp quyền giáo viên
              cho tài khoản Lumio của bạn.
            </p>
            <div className="tp-pills">
              <span>
                <ShieldCheck size={15} />
                Duyệt thủ công
              </span>
              <span>
                <MapPin size={15} />
                Theo nơi giảng dạy
              </span>
            </div>
          </div>
          <div className="tp-intro-art" aria-hidden="true">
            <div className="tp-orbit" />
            <div className="tp-orbit tp-orbit-two" />
            <div className="tp-cap">
              <GraduationCap size={70} strokeWidth={1.3} />
            </div>
            <span className="tp-art-tag">
              <Check size={15} />
              Hồ sơ của bạn
            </span>
          </div>
        </section>
        <div className="tp-layout">
          <aside className="tp-guide">
            <p className="tp-eyebrow">QUY TRÌNH CẤP QUYỀN</p>
            <ol>
              <li>
                <b>01</b>
                <div>
                  <strong>Thông tin giảng dạy</strong>
                  <p>Chọn địa phương, trường, cấp học và môn dạy.</p>
                </div>
              </li>
              <li>
                <b>02</b>
                <div>
                  <strong>Quản trị viên xem xét</strong>
                  <p>Hồ sơ chờ duyệt; có thể được yêu cầu bổ sung.</p>
                </div>
              </li>
              <li>
                <b>03</b>
                <div>
                  <strong>Cấp quyền giáo viên</strong>
                  <p>Kết quả và ghi chú xuất hiện trong tài khoản này.</p>
                </div>
              </li>
            </ol>
            <div className="tp-privacy">
              <ShieldCheck size={23} />
              <strong>Bạn kiểm soát thông tin</strong>
              <p>
                Hồ sơ chỉ dành cho bạn và quản trị viên có quyền xét duyệt.
                Không gửi căn cước, mật khẩu hay thông tin học sinh.
              </p>
              <a href="/privacy">
                Xem chính sách dữ liệu <ArrowRight size={14} />
              </a>
            </div>
            <p className="tp-footnote">
              Hosting miễn phí có thể ngủ hoặc gián đoạn. Hồ sơ được lưu theo
              cấu hình cơ sở dữ liệu máy chủ; không cam kết lưu trữ lâu dài.
              Quyền giáo viên không tự cấp quyền quản trị hoặc truy cập dữ liệu
              học sinh.
            </p>
          </aside>
          <section className="tp-panel" aria-label="Hồ sơ giáo viên">
            {!account ? (
              <div className="tp-signin">
                <GraduationCap size={42} />
                <h2>Bắt đầu bằng tài khoản của bạn</h2>
                <p>
                  Đăng nhập để gửi hồ sơ và theo dõi kết quả xét duyệt riêng tư.
                </p>
                {(["google", "facebook"] as const).map(
                  (p) =>
                    providers[p] && (
                      <button
                        key={p}
                        className="tp-submit"
                        onClick={() =>
                          void signIn(p, { callbackUrl: window.location.href })
                        }
                      >
                        Đăng nhập với {p === "google" ? "Google" : "Facebook"}
                        <ArrowRight size={16} />
                      </button>
                    ),
                )}
                {!providers.google && !providers.facebook && (
                  <p>Đăng nhập chưa được cấu hình ở môi trường này.</p>
                )}
              </div>
            ) : (
              <>
                <div className="tp-panel-title">
                  <div>
                    <p className="tp-eyebrow">HỒ SƠ GIẢNG DẠY</p>
                    <h2>
                      {state?.application
                        ? "Thông tin đã đăng ký"
                        : "Xin chào, thầy cô."}
                    </h2>
                  </div>
                  <GraduationCap size={27} />
                </div>
                {state?.application && (
                  <div
                    className={`tp-status tp-status-${state.application.status}`}
                    role="status"
                  >
                    <div>
                      {approved ? (
                        <CheckCircle2 size={22} />
                      ) : (
                        <Clock3 size={22} />
                      )}
                      <strong>{statusLabels[state.application.status]}</strong>
                      <span>Phiên bản {state.application.revision}</span>
                    </div>
                    {state.application.reviewNote && (
                      <p>
                        <b>Ghi chú quản trị viên:</b>{" "}
                        {state.application.reviewNote}
                      </p>
                    )}
                    {approved && (
                      <p>
                        Quản trị viên đã duyệt hồ sơ tự khai. Đây không phải
                        chứng nhận danh tính hoặc xác minh công tác chính thức.
                        Các công cụ lớp học sẽ được mở theo quyền và phạm vi
                        riêng.
                      </p>
                    )}
                    {state.application.status === "pending" && (
                      <p>
                        Bạn vẫn có thể sửa thông tin khi chờ duyệt. Thay đổi sẽ
                        được lưu thành phiên bản mới.
                      </p>
                    )}
                  </div>
                )}
                {error && (
                  <div className="tp-error" role="alert">
                    <p>{error}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void load()}
                    >
                      <RefreshCw size={15} />
                      Tải lại trạng thái
                    </button>
                    <small>
                      Tải lại sẽ thay nội dung biểu mẫu bằng hồ sơ đã lưu trên
                      máy chủ.
                    </small>
                  </div>
                )}
                {notice && (
                  <p className="tp-success" role="status">
                    {notice}
                  </p>
                )}
                {!loaded && !error && <p role="status">Đang tải hồ sơ…</p>}
                <form onSubmit={submit}>
                  <fieldset disabled={locked} className="tp-fieldset">
                    <div className="tp-fields">
                      <label className="tp-wide">
                        Họ và tên người giảng dạy <span>*</span>
                        <input
                          name="applicantName"
                          autoComplete="name"
                          required
                          minLength={2}
                          maxLength={120}
                          value={draft.applicantName}
                          onChange={(e) =>
                            update("applicantName", e.target.value)
                          }
                        />
                      </label>
                      <label className="tp-wide">
                        Quốc gia / vùng lãnh thổ <span>*</span>
                        <select
                          name="countryCode"
                          value={draft.countryCode}
                          onChange={(e) => {
                            const code = e.target.value;
                            const option = countryOptions.find(
                              (c) => c.code === code,
                            )!;
                            setDraft((d) => ({
                              ...d,
                              countryCode: code,
                              country: option.vi,
                              provinceCity: "",
                              ward: "",
                            }));
                            setManualLocation(false);
                          }}
                        >
                          {countryOptions.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.vi} ({c.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      {!showManual ? (
                        <>
                          <label>
                            Tỉnh / thành phố <span>*</span>
                            <select
                              name="provinceCity"
                              required
                              value={draft.provinceCity}
                              disabled={!locations || locked}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  provinceCity: e.target.value,
                                  ward: "",
                                }))
                              }
                            >
                              <option value="">
                                {locations
                                  ? "Chọn tỉnh / thành phố"
                                  : "Đang tải địa phương…"}
                              </option>
                              {draft.provinceCity && !knownProvince && (
                                <option value={draft.provinceCity}>
                                  {draft.provinceCity} · đã lưu
                                </option>
                              )}
                              {locations?.provinces.map((p) => (
                                <option key={p.code} value={p.name}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Xã / phường / đặc khu <span>*</span>
                            <select
                              name="ward"
                              required
                              value={draft.ward}
                              disabled={!province || locked}
                              onChange={(e) => update("ward", e.target.value)}
                            >
                              <option value="">
                                Chọn xã / phường / đặc khu
                              </option>
                              {draft.ward && !knownWard && (
                                <option value={draft.ward}>
                                  {draft.ward} · đã lưu
                                </option>
                              )}
                              {province?.wards.map((w) => (
                                <option key={w.code} value={w.name}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : (
                        <>
                          <label>
                            Tỉnh / bang / thành phố <span>*</span>
                            <input
                              name="provinceCity"
                              required
                              maxLength={120}
                              value={draft.provinceCity}
                              onChange={(e) =>
                                update("provinceCity", e.target.value)
                              }
                            />
                          </label>
                          <label>
                            Xã / khu vực tương đương <span>*</span>
                            <input
                              name="ward"
                              required
                              maxLength={120}
                              value={draft.ward}
                              placeholder="Ghi Không áp dụng nếu địa phương không có"
                              onChange={(e) => update("ward", e.target.value)}
                            />
                          </label>
                        </>
                      )}
                      {draft.countryCode === "VN" && (
                        <div className="tp-location-note tp-wide">
                          <p>
                            Danh mục tham khảo v5.2.0. Địa giới có thể thay đổi;
                            hãy dùng địa chỉ nơi trường đang hoạt động. Không
                            yêu cầu quận/huyện.
                          </p>
                          {locationError && (
                            <button
                              type="button"
                              onClick={() => setLocationRetry((n) => n + 1)}
                            >
                              Thử tải lại danh mục
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setManualLocation((v) => !v)}
                          >
                            {showManual
                              ? "Chọn từ danh mục"
                              : "Không tìm thấy địa phương? Nhập thủ công"}
                          </button>
                        </div>
                      )}
                      <label className="tp-wide">
                        Trường / cơ sở đang giảng dạy <span>*</span>
                        <input
                          name="school"
                          required
                          minLength={2}
                          maxLength={200}
                          value={draft.school}
                          placeholder="Tên trường hoặc cơ sở giáo dục"
                          onChange={(e) => update("school", e.target.value)}
                        />
                      </label>
                      <label>
                        Cấp dạy <span>*</span>
                        <select
                          name="teachingLevel"
                          value={draft.teachingLevel}
                          onChange={(e) =>
                            update(
                              "teachingLevel",
                              e.target.value as TeachingLevel,
                            )
                          }
                        >
                          {Object.entries(levels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Môn / lĩnh vực giảng dạy <span>*</span>
                        <input
                          name="subjects"
                          required
                          maxLength={809}
                          value={subjects}
                          placeholder="Toán, Khoa học tự nhiên…"
                          onChange={(e) => setSubjects(e.target.value)}
                        />
                        <small>Tối đa 10 môn, ngăn cách bằng dấu phẩy.</small>
                      </label>
                      <label>
                        Email công việc <small>Không bắt buộc</small>
                        <input
                          name="workEmail"
                          type="email"
                          autoComplete="email"
                          maxLength={254}
                          value={draft.workEmail || ""}
                          onChange={(e) => update("workEmail", e.target.value)}
                        />
                      </label>
                      <label>
                        Liên kết công khai của trường{" "}
                        <small>Không bắt buộc · HTTPS</small>
                        <input
                          name="publicEvidenceUrl"
                          type="url"
                          pattern="https://.*"
                          maxLength={1500}
                          placeholder="https://…"
                          value={draft.publicEvidenceUrl || ""}
                          onChange={(e) =>
                            update("publicEvidenceUrl", e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div className="tp-declarations">
                      <label>
                        <input
                          type="checkbox"
                          required
                          checked={draft.teacherDeclaration}
                          onChange={(e) =>
                            update("teacherDeclaration", e.target.checked)
                          }
                        />
                        <span>
                          Tôi xác nhận mình đang giảng dạy và thông tin trong hồ
                          sơ là chính xác theo hiểu biết của tôi.
                        </span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          required
                          checked={draft.storageConsent}
                          onChange={(e) =>
                            update("storageConsent", e.target.checked)
                          }
                        />
                        <span>
                          Tôi đồng ý lưu hồ sơ này trên máy chủ Lumio để quản
                          trị viên xét duyệt và ghi nhận kết quả. Tôi đã đọc{" "}
                          <a href="/privacy">chính sách dữ liệu</a>.
                        </span>
                      </label>
                    </div>
                    <button className="tp-submit" type="submit">
                      {busy
                        ? "Đang gửi…"
                        : state?.application
                          ? "Gửi lại hồ sơ để duyệt"
                          : "Gửi hồ sơ giáo viên"}
                      <ArrowRight size={18} />
                    </button>
                  </fieldset>
                </form>
                {approved && (
                  <a className="tp-return" href="/">
                    Tiếp tục học cùng Lumio <ArrowRight size={16} />
                  </a>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <footer className="tp-footer">
        Lumio AI · Học sâu hơn, cùng nhau.<a href="/">Về trang chủ</a>
      </footer>
    </div>
  );
}
