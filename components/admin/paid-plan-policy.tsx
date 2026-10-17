"use client";
import { useEffect, useRef, useState } from "react";
import type { PaidPolicy, PaidPolicyConfig } from "../../lib/billing/paid-policy";

type Snapshot = {
  plans: PaidPolicy[];
  configuredAliases: { mode: string; configuredProviders: number }[];
  paymentProviderConfigured: false;
  scope: string;
};
const messages: Record<string, string> = {
  SESSION_REVOKED: "Tài khoản hoặc phiên đã thay đổi. Tải lại trang để xác nhận quyền.",
  ADMIN_REAUTH_REQUIRED: "Phiên quản trị cần đăng nhập lại trước khi thay đổi cấu hình.",
  FORBIDDEN: "Bạn chưa có quyền quản lý cấu hình gói.",
  PAID_POLICY_CONFLICT: "Phiên bản đã thay đổi. Bản nhập vẫn được giữ; tải lại và đối chiếu trước khi lưu.",
  PAID_PRO_INHERITANCE_REQUIRED: "Pro cần bao gồm quyền và hạn mức Premium. Điều chỉnh Pro trước khi tăng Premium.",
  INVALID_PAID_POLICY: "Cấu hình chưa hợp lệ. Kiểm tra giá, hạn mức và các hệ số.",
  INVALID_ORIGIN: "Yêu cầu không đến từ địa chỉ ứng dụng đã cấu hình.",
};
export function PaidPlanPolicyPanel({ accountKey, canEdit }: { accountKey: string; canEdit: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<"premium" | "pro">("premium");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current++;
    request.current?.abort();
    setSnapshot(null); setDrafts({}); setReason(""); setError(""); setNotice(""); setBusy(false);
    return () => { active.current++; request.current?.abort(); };
  }, [accountKey]);
  const plan = snapshot?.plans.find(p => p.planId === selected);
  const draft = drafts[selected] || "";
  let config: PaidPolicyConfig | null = null;
  try { const value = JSON.parse(draft); if (value && typeof value === "object" && !Array.isArray(value)) config = value; } catch {}
  const selectedDirty = !!plan && draft !== JSON.stringify(plan.config, null, 2);
  const dirty = snapshot?.plans.some(p => drafts[p.planId] !== JSON.stringify(p.config, null, 2)) || false;
  const update = (key: keyof PaidPolicyConfig, value: unknown) => {
    if (!config || busy) return;
    setDrafts(d => ({ ...d, [selected]: JSON.stringify({ ...config, [key]: value }, null, 2) }));
    setNotice("");
  };
  async function perform(save = false) {
    if (busy || (save && (!plan || !config || !canEdit || !selectedDirty))) return;
    const seq = ++active.current;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/billing/paid-policy", {
        method: save ? "POST" : "GET", cache: "no-store", signal: controller.signal,
        headers: { "X-Lumio-Account": accountKey, ...(save ? { "Content-Type": "application/json" } : {}) },
        ...(save ? { body: JSON.stringify({ planId: selected, expectedRevision: plan!.revision, reason: reason.trim(), config }) } : {}),
      });
      const data = await response.json();
      if (active.current !== seq || controller.signal.aborted) return;
      if (!response.ok) throw new Error(messages[data.error] || (save ? "Chưa xác nhận kết quả lưu. Tải lại và đối chiếu phiên bản trước khi thử lại." : "Chưa tải được cấu hình. Có thể thử lại."));
      if (!Array.isArray(data.plans) || data.plans.length !== 2 || !data.plans.every((p: PaidPolicy) => ["premium", "pro"].includes(p.planId) && Number.isSafeInteger(p.revision) && p.config)) throw new Error("Phản hồi cấu hình không hợp lệ; chưa xác nhận thay đổi.");
      setSnapshot(data);
      setDrafts(previous => Object.fromEntries(data.plans.map((p: PaidPolicy) => {
        const old = snapshot?.plans.find(item => item.planId === p.planId);
        const keepOtherDraft = save && p.planId !== selected && old && previous[p.planId] !== JSON.stringify(old.config, null, 2);
        return [p.planId, keepOtherDraft ? previous[p.planId] : JSON.stringify(p.config, null, 2)];
      })));
      setReason(""); setNotice(save ? "Máy chủ đã xác nhận cấu hình mới. Không đổi số dư, tự cấp credit hoặc thu tiền." : "Đã đọc cấu hình từ máy chủ.");
    } catch (e) {
      if (active.current === seq && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Chưa hoàn tất yêu cầu.");
    } finally { if (active.current === seq) setBusy(false); }
  }
  return <section className="ad-panel ad-paid-policy" aria-labelledby="paid-policy-title" aria-busy={busy}>
    <div className="ad-panel-heading"><div><h2 id="paid-policy-title">Premium &amp; Pro</h2><p>Cấu hình đề xuất; chưa mở thanh toán. Free và Plus không thuộc biểu mẫu này.</p></div></div>
    <button className="ad-secondary" type="button" disabled={busy} onClick={() => perform()}>{busy ? "Đang xử lý…" : dirty ? "Tải lại và bỏ bản chưa lưu" : "Tải cấu hình"}</button>
    {error && <p className="pp-status" role="alert">{error}</p>}
    {notice && <p className="pp-status" role="status">{notice}</p>}
    {snapshot && <>
      <p className="pp-muted">Các alias có cấu hình: {snapshot.configuredAliases.map(a => `${a.mode}: ${a.configuredProviders}`).join(" · ")}. Đây không phải kiểm tra khả dụng của provider hay giá vốn.</p>
      <label className="pp-field">Gói cần điều chỉnh<select aria-label="Gói cần điều chỉnh" value={selected} onChange={e => { setSelected(e.target.value as typeof selected); setNotice(""); setError(""); }} disabled={busy}><option value="premium">Premium</option><option value="pro">Pro</option></select></label>
      <p className="pp-muted">Phiên bản máy chủ: {plan?.revision ?? "—"}. Bản nhập riêng của từng gói được giữ khi chuyển lựa chọn.</p>
      <fieldset disabled={busy || !canEdit}>
        <legend>Giá và credit cấu hình</legend>
        {config ? <div className="pp-grid">
          {([ ["monthlyPriceMinor", "Giá đề xuất theo tháng (VNĐ)"], ["yearlyPriceMinor", "Giá đề xuất theo năm (VNĐ)"], ["credits", "Credit mỗi chu kỳ tháng"] ] as const).map(([key,label]) => <label className="pp-field" key={key}>{label}<input aria-label={label} type="number" min={key === "credits" ? 1 : 0} max={key === "credits" ? 100000 : 1000000000} step="1" value={typeof config![key] === "number" ? config![key] : ""} onChange={e => update(key, Number(e.target.value))} /></label>)}
        </div> : <p role="alert">JSON chưa hợp lệ. Sửa cấu hình nâng cao hoặc tải lại.</p>}
        <p className="pp-muted">Hệ số 1.000 nghĩa là 1×. Đây là đơn vị dự kiến theo chính sách; chi phí API chưa được xác định. Quyền lớp học vẫn được kiểm tra riêng. Hạn mức hiệu lực còn phụ thuộc từng API.</p>
        <details><summary>Quyền, tác vụ và hệ số nâng cao</summary><label className="pp-field">Cấu hình Premium/Pro (JSON)<textarea aria-label="Cấu hình Premium/Pro (JSON)" spellCheck={false} rows={18} value={draft} onChange={e => { setDrafts(d => ({ ...d, [selected]: e.target.value })); setNotice(""); }} /></label></details>
        <label className="pp-field">Lý do thay đổi (8–300 ký tự)<textarea aria-label="Lý do thay đổi (8–300 ký tự)" rows={2} minLength={8} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="ad-primary" type="button" disabled={busy || !config || reason.trim().length < 8 || reason.trim().length > 300 || !selectedDirty} onClick={() => perform(true)}>Lưu cấu hình {selected === "premium" ? "Premium" : "Pro"}</button>
      </fieldset>
      {!canEdit && <p className="pp-muted">Bạn chỉ có quyền xem; server kiểm tra lại quyền khi lưu.</p>}
      <p className="pp-muted">Không tự gia hạn, không phát sinh giao dịch tiền và không thay lịch sử/số dư hiện có. Giá cấu hình chưa chứng minh có lợi nhuận.</p>
    </>}
  </section>;
}
