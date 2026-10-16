"use client";
import { useEffect, useRef, useState } from "react";
import type { JobHealth } from "../../lib/server/job-health";
const labels: Record<string, string> = {
  queued: "Chờ xử lý",
  running: "Đang xử lý",
  retry_wait: "Chờ thử lại",
  paused: "Tạm dừng",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  failed: "Thất bại",
};
const format = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
export function JobHealthPanel({ accountKey }: { accountKey: string }) {
  const [report, setReport] = useState<JobHealth | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(() => {
    generation.current++;
    active.current?.abort();
    setReport(null);
    setError("");
    setBusy(false);
    return () => {
      generation.current++;
      active.current?.abort();
    };
  }, [accountKey]);
  async function load() {
    const current = ++generation.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setReport(null);
    setError("");
    try {
      const response = await fetch("/api/admin/jobs", {
        cache: "no-store",
        signal: controller.signal,
        headers: { "X-Lumio-Account": accountKey },
      });
      if (!response.ok)
        throw Error(
          [401, 403].includes(response.status)
            ? "Quyền quản trị không còn hiệu lực. Hãy đăng nhập lại."
            : "Chưa đọc được trạng thái hàng đợi. Thử lại sau.",
        );
      const value = (await response.json()) as JobHealth;
      if (value.scope !== "stored-summary-job-metadata")
        throw Error("Phạm vi báo cáo không đúng. Hãy tải lại.");
      if (current === generation.current && !controller.signal.aborted)
        setReport(value);
    } catch (e) {
      if (current === generation.current && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Chưa tải được báo cáo.");
    } finally {
      if (current === generation.current && !controller.signal.aborted)
        setBusy(false);
    }
  }
  return (
    <section className="ad-panel" aria-label="Sức khỏe hàng đợi tóm tắt">
      <div className="ad-panel-heading" style={{ flexWrap: "wrap" }}>
        <div>
          <h2>Hàng đợi tóm tắt</h2>
          <p>Số liệu hiện có trên cơ sở dữ liệu này</p>
        </div>
        <button
          className="ad-primary"
          style={{ fontSize: 11, padding: "10px 12px" }}
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Đang đọc…" : "Kiểm tra hàng đợi"}
        </button>
      </div>
      <div
        style={{
          padding: "0 22px 22px",
          display: "grid",
          gap: 14,
          fontSize: 12,
          lineHeight: 1.65,
        }}
      >
        <p>
          Chỉ đọc số liệu tổng hợp; không mở tài liệu, tên học sinh hoặc nội
          dung từng tác vụ.
        </p>
        {error && (
          <p role="alert" className="ad-error">
            {error}
          </p>
        )}
        {report && (
          <div aria-live="polite" style={{ display: "grid", gap: 14 }}>
            <p>
              {format(report.retainedJobs)} tác vụ còn lưu · Chức năng nền:{" "}
              {report.backgroundJobsConfigured
                ? "được cấu hình bật"
                : "được cấu hình tắt"}
            </p>
            <div className="ad-table-scroll">
              <table className="ad-table">
                <caption
                  style={{
                    textAlign: "left",
                    padding: "8px 0 12px",
                    whiteSpace: "normal",
                    color: "#9cb1bd",
                  }}
                >
                  Trạng thái tác vụ còn lưu, bao gồm bản đã hết hạn chờ dọn
                </caption>
                <thead>
                  <tr>
                    <th>Trạng thái</th>
                    <th>Số tác vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(labels).map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>
                        {format(
                          report.statuses[key as keyof JobHealth["statuses"]],
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul style={{ display: "grid", gap: 8, paddingLeft: 18, margin: 0 }}>
              <li>
                Sẵn sàng nhận xử lý: {format(report.readyNow)} /{" "}
                {format(report.eligiblePending)} tác vụ chờ còn hiệu lực.
              </li>
              <li>Đang đợi mốc thử lại: {format(report.delayedRetries)}.</li>
              <li>
                Thời gian chờ lâu nhất từ lúc tạo:{" "}
                {report.oldestEligibleWaitSeconds === null
                  ? "chưa có"
                  : `${format(report.oldestEligibleWaitSeconds)} giây`}
                .
              </li>
              <li>
                Phần đang chạy: {format(report.runningParts)}; lease đã hết hạn:{" "}
                {format(report.expiredRunningLeases)}; lease thiếu dữ liệu:{" "}
                {format(report.missingRunningLeases)}.
              </li>
              <li>
                Tác vụ hết hạn còn lưu: {format(report.expiredRetained)}; tác vụ
                chưa kết thúc có phiên bị thu hồi:{" "}
                {format(report.revokedPending)}.
              </li>
            </ul>
            {(report.expiredRunningLeases > 0 ||
              report.missingRunningLeases > 0 ||
              report.revokedPending > 0) && (
              <p className="ad-error">
                Có dữ liệu cần kiểm tra. Báo cáo không tự khởi động lại tác vụ
                hay hoàn credit; cơ chế phục hồi hiện có xử lý khi chủ sở hữu
                truy cập.
              </p>
            )}
            <p>
              Mốc thử lại gần nhất:{" "}
              {report.nextRetryAt
                ? new Date(report.nextRetryAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })
                : "chưa có"}
              . Đọc lúc{" "}
              {new Date(report.generatedAt).toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              })}{" "}
              (UTC+7).
            </p>
          </div>
        )}
        <p>
          Đây không phải tín hiệu worker đang sống hay xác nhận backup. Host
          miễn phí có thể ngủ; tác vụ có thể chờ đến lần chủ sở hữu truy cập
          tiếp theo. Số liệu không đại diện cho nhiều máy chủ độc lập.
        </p>
      </div>
    </section>
  );
}
