"use client";

import { useEffect, useRef, useState } from "react";
import type {
  UsageBreakdown,
  UsageDimension,
} from "../../lib/server/usage-report";
import type { ProviderAttemptBreakdown } from "../../lib/server/provider-attempt-report";

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
  const [scope, setScope] = useState<"outcomes" | "attempts">("outcomes");
  const [report, setReport] = useState<
    UsageBreakdown | ProviderAttemptBreakdown | null
  >(null);
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
        `/api/admin/usage?summary=1&scope=${scope}&dimension=${dimension}&days=${days}`,
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
      const result = (await response.json()) as
        UsageBreakdown | ProviderAttemptBreakdown;
      if (
        result.scope !==
        (scope === "attempts"
          ? "recorded-text-provider-attempts"
          : "recorded-request-outcomes")
      )
        throw new Error("Loại báo cáo trả về không khớp. Hãy tải lại.");
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
        Kết quả yêu cầu và từng lần gọi AI là hai loại báo cáo riêng. Một yêu
        cầu có thể dùng model dự phòng, nên không cộng hai số này với nhau.
        Credit và hoàn credit dùng sổ giao dịch riêng; đây chưa phải hóa đơn.
      </p>
      <form
        className="ad-usage-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          Loại báo cáo{" "}
          <select
            value={scope}
            onChange={(event) => {
              reset();
              setScope(event.target.value as "outcomes" | "attempts");
            }}
          >
            <option value="outcomes">Kết quả yêu cầu</option>
            <option value="attempts">Từng lần gọi AI</option>
          </select>
        </label>
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
        {report &&
          (report.scope === "recorded-text-provider-attempts" ? (
            <AttemptBreakdownView report={report} />
          ) : (
            <>
              <p>
                {number(report.totals.requests)} yêu cầu ·{" "}
                {number(report.totals.errors)} lỗi · chi phí ước tính đã ghi:{" "}
                {cost(report.totals.recordedEstimatedCostUsd)}.{" "}
                {number(report.totals.unpricedRequests)} lượt chưa có chi phí.
                Dấu “—” là chưa đo, không phải 0.
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
                  Đang hiển thị 25 nhóm nhiều yêu cầu nhất. Tổng phía trên bao
                  gồm mọi nhóm trong khoảng đã chọn.
                </p>
              )}
            </>
          ))}
      </div>
    </details>
  );
}

function AttemptBreakdownView({
  report,
}: {
  report: ProviderAttemptBreakdown;
}) {
  return (
    <>
      <p>
        Toàn bộ nhật ký còn {number(report.retainedAllAges.unresolved)} lượt
        chưa rõ kết quả, gồm{" "}
        {number(report.retainedAllAges.unresolvedOutsideWindow)} lượt ngoài
        khoảng đang xem. Giới hạn chờ:{" "}
        {number(report.limits.unresolvedPerAccount)} lượt/tài khoản và{" "}
        {number(report.limits.unresolvedGlobal)} lượt toàn hệ thống. Đang lưu{" "}
        {number(report.retainedAllAges.attempts)} /{" "}
        {number(report.limits.total)} bản ghi; đạt giới hạn sẽ chặn lượt gọi
        mới. Các tổng trong bảng bên dưới chỉ tính khoảng thời gian đã chọn.
      </p>
      <p>
        {number(report.totals.attempts)} lượt chuẩn bị gọi ·{" "}
        {number(report.totals.responses)} phản hồi HTTP ·{" "}
        {number(report.totals.httpErrors)} phản hồi lỗi HTTP.{" "}
        {number(report.totals.unresolved)} lượt chưa có kết quả ghi nhận;{" "}
        {number(report.totals.transportUnknown)} lượt không rõ nhà cung cấp đã
        nhận/xử lý do mất mạng, hết giờ hoặc hủy.
      </p>
      <p>
        Chỉ ghi luồng tạo nội dung của người học, giáo viên và tóm tắt nền từ
        khi nâng cấp; chưa gồm giọng nói, embeddings hay lịch sử trước đó. Phản
        hồi HTTP không xác nhận câu trả lời đúng hoặc đã được chấp nhận. Lượt đã
        chuẩn bị có thể chưa tới nhà cung cấp. Chưa có bảng giá được xác nhận:
        chi phí của cả {number(report.totals.unpricedAttempts)} lượt vẫn chưa
        biết, không phải 0.
      </p>
      {report.firstRetainedAttemptAt && (
        <p>
          Bản ghi sớm nhất còn lưu:{" "}
          <time dateTime={report.firstRetainedAttemptAt}>
            {report.firstRetainedAttemptAt}
          </time>
          . Đây không phải ngày bắt đầu thu thập; dữ liệu đã kết thúc quá 31
          ngày được dọn theo đợt khi có lượt gọi mới, lượt chưa rõ kết quả được
          giữ riêng.
        </p>
      )}
      {!report.groups.length ? (
        <p>Chưa có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        <div className="ad-table-scroll">
          <table className="ad-table">
            <caption>
              Lượt gọi theo{" "}
              {report.dimension === "model"
                ? "model được yêu cầu"
                : report.dimension === "task"
                  ? "tính năng"
                  : "mã tài khoản"}
              ; tối đa 25 nhóm
            </caption>
            <thead>
              <tr>
                <th scope="col">Nhóm</th>
                <th scope="col">Chuẩn bị / phản hồi</th>
                <th scope="col">Chưa rõ kết quả</th>
                <th scope="col">Token đã báo</th>
                <th scope="col">Độ trễ TB</th>
                <th scope="col">Model trong phản hồi</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((group) => (
                <tr key={JSON.stringify([group.provider, group.key])}>
                  <th scope="row">
                    <code>{group.key}</code>
                    {group.provider && <small>{group.provider}</small>}
                  </th>
                  <td>
                    {number(group.attempts)} / {number(group.responses)}
                    <small>{number(group.httpErrors)} phản hồi lỗi HTTP</small>
                  </td>
                  <td>
                    {number(group.unresolved)} chưa ghi kết quả
                    <small>
                      {number(group.transportUnknown)} mất mạng/hết giờ/hủy
                    </small>
                  </td>
                  <td>
                    {number(group.inputTokens)} vào /{" "}
                    {number(group.outputTokens)} ra
                    <small>
                      Độ phủ vào {number(group.inputTokenRecords)} / ra{" "}
                      {number(group.outputTokenRecords)} lượt; tổng token đã báo{" "}
                      {number(group.totalTokens)} (
                      {number(group.totalTokenRecords)} lượt)
                    </small>
                  </td>
                  <td>{number(group.averageLatencyMs)} ms</td>
                  <td>
                    {number(group.responseModelRecords)} lượt có tên model
                    <small>
                      {number(group.changedModelRecords)} khác tên yêu cầu; có
                      thể là phiên bản/alias
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>
        Dấu “—” là chưa đo. Token chỉ cộng các giá trị provider đã báo, không
        suy ra từ nội dung. Các nhóm dùng thời điểm chuẩn bị gọi.
      </p>
      {report.truncated && (
        <p>
          Đang hiển thị 25 nhóm nhiều lượt nhất. Tổng phía trên bao gồm mọi nhóm
          trong khoảng đã chọn.
        </p>
      )}
    </>
  );
}
