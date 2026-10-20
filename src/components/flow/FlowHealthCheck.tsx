import React, { useState, useCallback, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import {
    Activity, AlertTriangle, CheckCircle, Shield, Loader2, Square,
    ExternalLink, Search, X, Trash2, RefreshCw, ScanSearch,
} from 'lucide-react';
import {
    fetchFlowHealthCheck,
    stopScanning,
    clearRunsCache,
    type HealthCheckResult,
} from '@/services/azure/flowAnalyticsService';
import type { FlowDefinition } from '@/services/azure/powerPlatformService';
import { PP_ENV_ID } from '@/config/authConfig';

export const HEALTH_PERIODS = [
    { value: 1, label: 'Today' },
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
];

const periodLabel = (days: number) => HEALTH_PERIODS.find(p => p.value === days)?.label ?? `${days} days`;

/* ─── Scan state — dùng chung cho toolbar (trigger + progress) và popup (kết quả) ─── */
export function useFlowHealthCheck(flows: FlowDefinition[]) {
    const { instance, accounts } = useMsal();
    const [daysRange, setDaysRange] = useState(1);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<HealthCheckResult | null>(null);
    const [scannedAt, setScannedAt] = useState<Date | null>(null);
    const [scannedDays, setScannedDays] = useState(1);

    const start = useCallback(async () => {
        if (!accounts[0] || scanning) return;
        const activated = flows.filter(f => f.state === 'Activated');
        setScanning(true);
        setProgress(0);
        setResult(null);
        setScannedDays(daysRange);
        clearRunsCache();
        try {
            const data = await fetchFlowHealthCheck(
                instance,
                accounts[0],
                activated.map(f => ({ id: f.id, name: f.name, owner: f.owner })),
                daysRange,
                (processed, total) => setProgress(Math.round((processed / total) * 100)),
            );
            setResult(data);
            setScannedAt(new Date());
        } catch (err) {
            console.error('[FlowHealthCheck] scan error:', err);
        } finally {
            setScanning(false);
            setProgress(100);
        }
    }, [instance, accounts, flows, daysRange, scanning]);

    const stop = useCallback(() => {
        stopScanning();
        setScanning(false);
    }, []);

    return { daysRange, setDaysRange, scanning, progress, result, scannedAt, scannedDays, start, stop };
}

export type FlowHealthState = ReturnType<typeof useFlowHealthCheck>;
export type HealthFilter = 'all' | 'failed' | 'stuck';

interface IssueRow {
    id: string;
    name: string;
    owner: string;
    kind: 'failed' | 'stuck';
    count: number;
    totalRuns: number;
    lastError: string;
}

interface ModalProps {
    open: boolean;
    onClose: () => void;
    health: FlowHealthState;
    filter: HealthFilter;
    onFilterChange: (f: HealthFilter) => void;
    onDeleteFlow?: (id: string, name: string) => void;
    deletingId?: string | null;
}

const flowUrl = (flowId: string) =>
    `https://make.powerautomate.com/environments/${PP_ENV_ID}/flows/${flowId}/details`;

/* ─── Popup kết quả: KPI strip + 1 bảng gộp Failed/Stuck ─── */
export const FlowHealthModal: React.FC<ModalProps> = ({ open, onClose, health, filter, onFilterChange, onDeleteFlow, deletingId }) => {
    const { scanning, progress, result, scannedAt, scannedDays, start, stop } = health;
    const [search, setSearch] = useState('');

    const rows = useMemo<IssueRow[]>(() => {
        if (!result) return [];
        const failed: IssueRow[] = result.failedFlows.map(f => ({
            id: f.id, name: f.name, owner: f.owner, kind: 'failed', count: f.failCount, totalRuns: f.totalRuns, lastError: f.lastError,
        }));
        const stuck: IssueRow[] = result.stuckFlows.map(f => ({
            id: f.id, name: f.name, owner: f.owner, kind: 'stuck', count: f.runningCount, totalRuns: f.totalRuns, lastError: '',
        }));
        // Failed trước, mỗi nhóm sort theo count giảm dần
        return [...failed.sort((a, b) => b.count - a.count), ...stuck.sort((a, b) => b.count - a.count)];
    }, [result]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter(r =>
            (filter === 'all' || r.kind === filter) &&
            (!q || r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q) || r.lastError.toLowerCase().includes(q))
        );
    }, [rows, filter, search]);

    const failedCount = result?.failedFlows.length ?? 0;
    const stuckCount = result?.stuckFlows.length ?? 0;
    const scanned = result?.scannedFlows ?? 0;
    const healthy = Math.max(scanned - new Set(rows.map(r => r.id)).size, 0);

    const kpis = [
        { label: 'Scanned', value: scanned, icon: <ScanSearch size={18} />, theme: 'blue' },
        { label: 'Failed', value: failedCount, icon: <AlertTriangle size={18} />, theme: 'red' },
        { label: 'Stuck', value: stuckCount, icon: <Shield size={18} />, theme: 'orange' },
        { label: 'Healthy', value: healthy, icon: <CheckCircle size={18} />, theme: 'green' },
    ];

    return (
        // Giữ mounted (chỉ ẩn) để đóng popup khi đang scan không mất state
        <div className="modal-overlay" style={{ display: open ? undefined : 'none' }} onClick={onClose}>
            <div className="modal-content flow-health-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={16} className="text-accent" /> Health Check
                        <span className="flow-health-meta">
                            · {periodLabel(scannedDays)}
                            {scannedAt && !scanning && ` · ${scannedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {scanning ? (
                            <button className="filter-chip filter-chip--active filter-chip--danger" onClick={stop}>
                                <Square size={12} /> Stop
                            </button>
                        ) : (
                            <button className="filter-chip filter-chip--action" onClick={start}>
                                <RefreshCw size={12} /> Re-scan
                            </button>
                        )}
                        <button className="close-modal-btn" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="modal-body flow-health-body">
                    {scanning && (
                        <div className="flow-health-progress">
                            <div className="flow-health-progress-label">
                                <span><Loader2 size={13} className="animate-spin" /> Đang quét lịch sử chạy flow...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="flow-health-progress-track">
                                <div className="flow-health-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}

                    {result && (
                        <>
                            <div className="stat-strip">
                                {kpis.map(k => (
                                    <div key={k.label} className="stat-strip-item">
                                        <div className={`stat-icon qa-icon--${k.theme}`}>{k.icon}</div>
                                        <div className="stat-strip-info">
                                            <span className="stat-value">{k.value}</span>
                                            <span className="stat-label">{k.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {rows.length === 0 ? (
                                <div className="flow-health-empty flow-health-empty--ok">
                                    <CheckCircle size={36} />
                                    <p>Không có flow lỗi hay bị kẹt trong {periodLabel(scannedDays).toLowerCase()}.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flow-health-toolbar">
                                        <div className="filter-chips">
                                            {([
                                                ['all', `All ${rows.length}`, 'filter-chip--accent'],
                                                ['failed', `Failed ${failedCount}`, 'filter-chip--danger'],
                                                ['stuck', `Stuck ${stuckCount}`, 'filter-chip--warn'],
                                            ] as const).map(([key, label, tone]) => (
                                                <button
                                                    key={key}
                                                    className={`filter-chip ${filter === key ? `filter-chip--active ${tone}` : ''}`}
                                                    onClick={() => onFilterChange(key)}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="list-view-search" style={{ maxWidth: 280, margin: 0 }}>
                                            <Search size={14} className="list-view-search-icon" />
                                            <input
                                                type="text"
                                                placeholder="Tên flow, owner, lỗi..."
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                            />
                                            {search && (
                                                <button onClick={() => setSearch('')} className="list-view-search-clear">
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="list-view-table-wrapper">
                                        <table className="list-view-table">
                                            <thead>
                                                <tr>
                                                    <th>Flow</th>
                                                    <th>Issue</th>
                                                    <th>Last error</th>
                                                    <th>Owner</th>
                                                    <th style={{ width: 70 }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {visible.map(r => (
                                                    <tr key={`${r.kind}-${r.id}`}>
                                                        <td className="font-semibold">{r.name}</td>
                                                        <td>
                                                            <span className={`status-badge ${r.kind === 'failed' ? 'status-rejected' : 'status-warning'}`}>
                                                                {r.kind === 'failed' ? `${r.count}/${r.totalRuns} failed` : `${r.count} running`}
                                                            </span>
                                                        </td>
                                                        <td className="flow-health-error" title={r.lastError}>{r.lastError || '—'}</td>
                                                        <td className="text-muted">{r.owner || '—'}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                                                                <a href={flowUrl(r.id)} target="_blank" rel="noopener noreferrer" className="action-icon-btn" title="Mở trong Power Automate">
                                                                    <ExternalLink size={14} />
                                                                </a>
                                                                <button
                                                                    onClick={() => onDeleteFlow?.(r.id, r.name)}
                                                                    disabled={deletingId === r.id}
                                                                    className="action-icon-btn"
                                                                    title="Xóa flow"
                                                                >
                                                                    {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {visible.length === 0 && (
                                                    <tr><td colSpan={5} className="flow-health-nomatch">Không có flow khớp bộ lọc.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {!scanning && !result && (
                        <div className="flow-health-empty">
                            <Activity size={32} />
                            <p>Chưa có kết quả. Bấm Re-scan để chạy Health Check.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
