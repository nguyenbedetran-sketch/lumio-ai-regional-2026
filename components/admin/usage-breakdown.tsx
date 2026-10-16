"use client";

import { useEffect, useRef, useState } from "react";
import type {
  UsageBreakdown,
  UsageDimension,
} from "../../lib/server/usage-report";

const number = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("vi-VN").format(value);
const cost = (value: number | null) =>
  value === null
    ? "Chưa đo"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 6,
      }).format(value);

export function UsageBreakdownPanel({ accountKey }: { accountKey: string }) {
  const [dimension, setDimension] = useState<UsageDimension>("model");
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<UsageBreakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const reset = () => {
    generation.current++;
    active.current?.abort();
    setReport(null);
    setError("");
    setBusy(false);
  };
  useEffect(
    () => () => {
      generation.current++;
      active.current?.abort();
    },
    [],
  );
  async function load() {
    const sequence = ++generation.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setReport(null);
    setError("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/usage?summary=1&dimension=${dimension}&days=${days}`,
        {
          cache: "no-store",
          signal: controller.signal,
          headers: { "X-Lumio-Account": accountKey },
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Quyền xem báo cáo không còn hiệu lực. Hãy đăng nhập lại."
            : "Chưa tải được báo cáo. Bạn có thể thử lại.",
        );
      const result = (await response.json()) as UsageBreakdown;
      if (sequence === generation.current && !controller.signal.aborted)
        setReport(result);
    } catch (cause) {
      if (sequence === generation.current && !controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Chưa tải được báo cáo.",
        );
    } finally {
      if (sequence === generation.current && !controller.signal.aborted)
        setBusy(false);
    }
  }
  return (
    <details className="ad-usage-breakdown">
      <summary>Phân tích sử dụng theo model, tính năng và tài khoản</summary>
      <p>
        Đây là kết quả yêu cầu đã ghi nhận, chưa phải hóa đơn hoặc toàn bộ lượt
        gọi nhà cung cấp. Lượt fallback và token tiêu thụ khi lỗi có thể chưa
        được ghi đủ. Credit và hoàn credit dùng sổ giao dịch riêng.
      </p>
      <form
        className="ad-usage-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          Nhóm theo{" "}
          <select
            value={dimension}
            onChange={(event) => {
              reset();
              setDimension(event.target.value as UsageDimension);
            }}
          >
            <option value="model">Model</option>
            <option value="task">Tính năng</option>
            <option value="user">Mã tài khoản</option>
          </select>
        </label>
        <label>
          Khoảng thời gian{" "}
          <select
            value={days}
            onChange={(event) => {
              reset();
              setDays(Number(event.target.value));
            }}
          >
            <option value={7}>7 ngày</option>
            <option value={14}>14 ngày</option>
            <option value={31}>31 ngày</option>
          </select>
        </label>
        <button className="ad-primary" disabled={busy}>
          {busy ? "Đang tải…" : "Xem báo cáo"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite" aria-busy={busy}>
        {report && (
          <>
            <p>
              {number(report.totals.requests)} yêu cầu ·{" "}
              {number(report.totals.errors)} lỗi · chi phí ước tính đã ghi:{" "}
              {cost(report.totals.recordedEstimatedCostUsd)}.{" "}
              {number(report.totals.unpricedRequests)} lượt chưa có chi phí. Dấu
              “—” là chưa đo, không phải 0.
            </p>
            {!report.groups.length ? (
              <p>Chưa có dữ liệu trong khoảng thời gian này.</p>
            ) : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <caption>
                    Kết quả theo{" "}
                    {dimension === "model"
                      ? "model"
                      : dimension === "task"
                        ? "tính năng"
                        : "mã tài khoản"}
                    ; tối đa 25 nhóm
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Nhóm</th>
                      <th scope="col">Yêu cầu / lỗi</th>
                      <th scope="col">Token vào / ra</th>
                      <th scope="col">Độ trễ TB</th>
                      <th scope="col">Ước tính đã ghi / độ phủ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.groups.map((group) => (
                      <tr key={JSON.stringify([group.provider, group.key])}>
                        <th scope="row">
                          <code>
                            {group.key === "unknown"
                              ? "Chưa xác định"
                              : group.key}
                          </code>
                          {group.provider && <small>{group.provider}</small>}
                        </th>
                        <td>
                          {number(group.requests)} / {number(group.errors)}
                        </td>
                        <td>
                          {number(group.inputTokens)} /{" "}
                          {number(group.outputTokens)}
                          <small>
                            {number(group.tokenRecords)} lượt có token vào
                          </small>
                        </td>
                        <td>{number(group.averageLatencyMs)} ms</td>
                        <td>
                          {cost(group.recordedEstimatedCostUsd)}
                          <small>
                            {number(group.costRecords)} /{" "}
                            {number(group.requests)} lượt có chi phí
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {report.truncated && (
              <p>
                Đang hiển thị 25 nhóm nhiều yêu cầu nhất. Tổng phía trên bao gồm
                mọi nhóm trong khoảng đã chọn.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
