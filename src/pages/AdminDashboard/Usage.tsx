import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchStream,
  fetchBreakdown,
  formatVND,
  formatCompact,
  formatModelName,
  UnauthorizedError,
  type StreamResponse,
  type BreakdownResponse,
  type RangeKey,
} from '../../lib/ckeyApi';
import './Usage.css';

const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
];

/** Render a model as "provider / normalized name", keeping the provider muted. */
const ModelName: React.FC<{ modelName: string }> = ({ modelName }) => {
  const { provider, name } = formatModelName(modelName);
  return (
    <span className="model-name" title={modelName}>
      {provider && <span className="model-provider">{provider}</span>}
      <span className="model-label">{name}</span>
    </span>
  );
};

const Usage: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('7d');
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // A dropped admin key mid-session sends the user back to login.
  const handleFetchError = (e: unknown): string => {
    if (e instanceof UnauthorizedError) {
      navigate('/admin', { replace: true });
      return e.message;
    }
    return e instanceof Error ? e.message : 'Không tải được dữ liệu.';
  };

  // Stream (account totals + logs) — not range-scoped, fetched once.
  useEffect(() => {
    let alive = true;
    fetchStream(8)
      .then((d) => alive && setStream(d))
      .catch((e) => alive && setError(handleFetchError(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Breakdown (trend + per-model) — re-fetched when the range changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchBreakdown(range)
      .then((d) => {
        if (!alive) return;
        setBreakdown(d);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(handleFetchError(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const trend = breakdown?.trend ?? [];
  const models = useMemo(
    () => (breakdown?.models ?? []).slice().sort((a, b) => b.charged_vnd - a.charged_vnd),
    [breakdown],
  );

  // ---- Trend area chart geometry (single series) ----
  const W = 760;
  const H = 260;
  const padL = 56;
  const padR = 18;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xFor = (i: number) =>
    padL + (trend.length <= 1 ? plotW / 2 : (i / (trend.length - 1)) * plotW);
  const maxCost = Math.max(...trend.map((p) => p.charged_vnd), 1);
  const yMax = niceMax(maxCost);
  const yFor = (v: number) => padT + plotH - (v / yMax) * plotH;

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((yMax / steps) * i));
  }, [yMax]);

  const linePath = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.charged_vnd)}`).join(' ');
  const areaPath =
    trend.length > 0
      ? `${linePath} L${xFor(trend.length - 1)},${padT + plotH} L${xFor(0)},${padT + plotH} Z`
      : '';

  const hoverPoint = hoverX !== null ? trend[hoverX] : null;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (trend.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    if (x < padL - 12 || x > padL + plotW + 12) {
      setHoverX(null);
      return;
    }
    const idx = Math.round(((x - padL) / plotW) * (trend.length - 1));
    setHoverX(Math.max(0, Math.min(trend.length - 1, idx)));
  };

  const maxModelCost = Math.max(...models.map((m) => m.charged_vnd), 1);
  const health = stream?.health;

  return (
    <div className="usage-page">
      <div className="usage-header">
        <div>
          <h1>Usage</h1>
          <p className="usage-subtitle">Thống kê chi phí sử dụng model cho coding</p>
        </div>
        {health && (
          <span className={`health-badge ${health.online ? 'online' : 'offline'}`}>
            <span className="health-dot" />
            {health.online ? 'API online' : 'API offline'}
            {typeof health.status === 'number' && <span className="health-http">· {health.status}</span>}
          </span>
        )}
      </div>

      {/* ---- Account KPIs (current, not range-scoped) ---- */}
      {stream && (
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <div className="kpi-label">Số dư khả dụng</div>
            <div className="kpi-value">{formatVND(stream.balance.vnd)}</div>
            {stream.hold.vnd > 0 && <div className="kpi-sub">Đang giữ: {stream.hold.text}</div>}
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Chi hôm nay</div>
            <div className="kpi-value">{stream.today.charged_text}</div>
            <div className="kpi-sub">{stream.today.requests} request</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Chi tháng này</div>
            <div className="kpi-value">{stream.limits.text.monthly_spent}</div>
            <div className="kpi-sub">Tổng đã chi: {stream.limits.text.total_spent}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Tổng request</div>
            <div className="kpi-value">{stream.totals.requests.toLocaleString('vi-VN')}</div>
            <div className={`kpi-sub ${stream.totals.success_rate >= 95 ? 'good' : 'warn'}`}>
              {stream.totals.success_rate}% thành công
            </div>
          </div>
        </div>
      )}

      {/* ---- Filter row (scopes the two analytics cards below) ---- */}
      <div className="usage-filters">
        <div className="range-group" role="tablist" aria-label="Khoảng thời gian">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              className={`range-btn ${range === r.key ? 'active' : ''}`}
              onClick={() => {
                setRange(r.key);
                setHoverX(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="view-toggle" role="tablist" aria-label="Kiểu hiển thị">
          <button role="tab" aria-selected={view === 'chart'} className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
            Biểu đồ
          </button>
          <button role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Bảng
          </button>
        </div>
      </div>

      {error && (
        <div className="usage-error" role="alert">
          {error}
        </div>
      )}

      {/* ---- Trend + model breakdown ---- */}
      <div className={`analytics ${loading ? 'is-loading' : ''}`}>
        {view === 'chart' ? (
          <>
            {range !== 'today' && (
            <figure className="chart-card">
              <figcaption>
                <span className="chart-title">Chi phí theo ngày</span>
                <span className="chart-caption">Tổng phí mỗi ngày trong {rangeLabel(range)}, đơn vị VND</span>
              </figcaption>

              {trend.length === 0 && !loading ? (
                <div className="empty-state">Không có dữ liệu trong khoảng này.</div>
              ) : (
                <svg
                  className="cost-chart"
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  onMouseMove={handleMove}
                  onMouseLeave={() => setHoverX(null)}
                >
                  {yTicks.map((t) => (
                    <g key={t}>
                      <line x1={padL} x2={W - padR} y1={yFor(t)} y2={yFor(t)} className="gridline" />
                      <text x={padL - 10} y={yFor(t) + 4} textAnchor="end" className="axis-tick">
                        {formatCompact(t)}
                      </text>
                    </g>
                  ))}

                  {areaPath && <path d={areaPath} className="area-fill" />}
                  {linePath && <path d={linePath} className="area-edge" />}

                  {trend.map((p, i) => (
                    <circle key={i} cx={xFor(i)} cy={yFor(p.charged_vnd)} r={hoverX === i ? 5 : 3.5} className="point" />
                  ))}

                  {hoverX !== null && (
                    <line x1={xFor(hoverX)} x2={xFor(hoverX)} y1={padT} y2={padT + plotH} className="crosshair" />
                  )}

                  {trend.map((p, i) => (
                    <text key={i} x={xFor(i)} y={H - 8} textAnchor="middle" className="axis-tick">
                      {p.label}
                    </text>
                  ))}
                </svg>
              )}

              {hoverPoint && (
                <div className="chart-tooltip" role="status">
                  <div className="tooltip-date">{hoverPoint.label}</div>
                  <div className="tooltip-row">
                    <span className="tooltip-key">Chi phí</span>
                    <span className="tooltip-val">{formatVND(hoverPoint.charged_vnd)}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="tooltip-key">Request</span>
                    <span className="tooltip-val">{hoverPoint.requests}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="tooltip-key">Token</span>
                    <span className="tooltip-val">{formatCompact(hoverPoint.tokens)}</span>
                  </div>
                </div>
              )}
            </figure>
            )}

            <figure className="chart-card">
              <figcaption>
                <span className="chart-title">Chi phí theo model</span>
                <span className="chart-caption">Tổng phí mỗi model trong {rangeLabel(range)}</span>
              </figcaption>

              {models.length === 0 && !loading ? (
                <div className="empty-state">Không có dữ liệu trong khoảng này.</div>
              ) : (
                <div className="bar-list">
                  {models.map((m) => (
                    <div className="bar-row" key={m.model_name}>
                      <div className="bar-label">
                        <ModelName modelName={m.model_name} />
                        <span className="bar-meta">
                          {m.total_requests} req · {formatCompact(m.total_tokens)} tok
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(m.charged_vnd / maxModelCost) * 100}%` }} />
                        <span className="bar-value">{formatVND(m.charged_vnd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </figure>
          </>
        ) : (
          <figure className="chart-card">
            <figcaption>
              <span className="chart-title">Chi phí theo model</span>
              <span className="chart-caption">Bảng dữ liệu {rangeLabel(range)}</span>
            </figcaption>
            <div className="table-scroll">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th className="num">Request</th>
                    <th className="num">Token</th>
                    <th className="num">Cache read</th>
                    <th className="num">Chi phí</th>
                    <th className="num">Tỉ lệ TC</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.model_name}>
                      <td><ModelName modelName={m.model_name} /></td>
                      <td className="num">{m.total_requests}</td>
                      <td className="num">{formatCompact(m.total_tokens)}</td>
                      <td className="num">{formatCompact(m.cache_read_tokens)}</td>
                      <td className="num strong">{formatVND(m.charged_vnd)}</td>
                      <td className="num">{m.success_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </figure>
        )}
      </div>

      {/* ---- Recent logs ---- */}
      {stream && stream.logs.length > 0 && (
        <figure className="chart-card">
          <figcaption>
            <span className="chart-title">Request gần đây</span>
            <span className="chart-caption">Các lượt gọi API mới nhất</span>
          </figcaption>
          <div className="table-scroll">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Model</th>
                  <th className="num">Token</th>
                  <th className="num">Chi phí</th>
                  <th className="num">Độ trễ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {stream.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="nowrap">{log.created_at_text}</td>
                    <td><ModelName modelName={log.model_name} /></td>
                    <td className="num">{formatCompact(log.total_tokens)}</td>
                    <td className="num strong">{formatVND(log.charged_vnd)}</td>
                    <td className="num">{(log.latency_ms / 1000).toFixed(1)}s</td>
                    <td>
                      <span className={`status-badge ${log.status === 'success' ? 'ok' : 'fail'}`}>
                        {log.status === 'success' ? 'Thành công' : log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      )}

      {loading && !breakdown && <div className="usage-loading">Đang tải dữ liệu…</div>}
    </div>
  );
};

// Round a max value up to a clean axis bound.
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function rangeLabel(range: RangeKey): string {
  return range === 'today' ? 'hôm nay' : range === '7d' ? '7 ngày qua' : '30 ngày qua';
}

export default Usage;
