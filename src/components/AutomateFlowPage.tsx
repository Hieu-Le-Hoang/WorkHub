import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import {
    Zap, RefreshCw, AlertTriangle, Search, X,
    CheckCircle, XCircle, Copy, Check,
    ChevronDown, ChevronRight, ExternalLink, Clock, History,
    Activity, Loader2, Trash2, Shield
} from 'lucide-react';
import type { FlowDefinition, FlowRun } from '@/services/azure/powerPlatformService';
import { fetchFlows, fetchFlowRuns, fetchFlowRunTriggerOutput, deleteFlow } from '@/services/azure/powerPlatformService';
import { acquireToken } from '@/services/azure/tokenService';
import { dataverseConfig, powerAutomateConfig } from '@/config/authConfig';
import { useApiData } from '@/hooks/useApiData';
import { FlowHealthModal, useFlowHealthCheck, HEALTH_PERIODS, type HealthFilter } from '@/components/flow/FlowHealthCheck';
import { FlowStructureViewer } from '@/components/flow/FlowStructureViewer';
import {
    fetchFlowMetadata,
    parseFlowStructure,
    parseRunError,
    formatDuration,
    type FlowStructure,
} from '@/services/azure/flowAnalyticsService';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const CACHE_KEY = 'automate_flows';

/* ─── Formatters ─── */
function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─── Copy Button ─── */
const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* noop */ }
    };
    return (
        <button
            onClick={handleCopy}
            className={`action-icon-btn ${copied ? 'text-success' : ''}`}
            title={copied ? 'Copied!' : `Copy ${label || ''}`}
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
    );
};

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE — AutomateFlowPage
   ═══════════════════════════════════════════════════════════ */

export const AutomateFlowPage: React.FC = () => {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();

    const { data: apiData, loading, error, refresh: loadData, setData } = useApiData({
        key: CACHE_KEY,
        fetcher: async () => {
            const token = await acquireToken(instance, accounts[0], dataverseConfig.scopes);
            return await fetchFlows(token);
        },
        enabled: isAuthenticated && accounts.length > 0,
        initialData: { flows: [] as FlowDefinition[], total: 0 }
    });

    const flows = apiData?.flows || [];
    const total = apiData?.total || 0;
    const loaded = flows.length > 0;

    // Health Check — scan state dùng chung cho toolbar + popup
    const health = useFlowHealthCheck(flows);
    const healthResult = health.result;
    const openHealth = (filter: HealthFilter) => { setHealthFilter(filter); setHealthOpen(true); };
    const runHealthCheck = () => {
        openHealth('all');
        if (!health.scanning) health.start();
    };

    const [search, setSearch] = useState('');
    const [selectedFlow, setSelectedFlow] = useState<FlowDefinition | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [healthOpen, setHealthOpen] = useState(false);
    const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<FlowDefinition | null>(null);

    // History popup state
    const [historyName, setHistoryName] = useState('');
    const [historyRuns, setHistoryRuns] = useState<FlowRun[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historySearch, setHistorySearch] = useState('');

    // Trigger output expand state
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
    const [triggerOutput, setTriggerOutput] = useState<Record<string, unknown> | null>(null);
    const [triggerLoading, setTriggerLoading] = useState(false);

    // Flow structure (sidebar)
    const [flowStructure, setFlowStructure] = useState<FlowStructure | null>(null);
    const [structureLoading, setStructureLoading] = useState(false);

    // ─── Data Loading ───
    // ─── Data Loading ───
    // Đã chuyển sang sử dụng hook `useApiData` (Quy chuẩn Wecare Pattern A)

    const handleDeleteClick = useCallback((flow: FlowDefinition, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmTarget(flow);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!confirmTarget) return;
        try {
            setDeletingId(confirmTarget.id);
            const token = await acquireToken(instance, accounts[0], powerAutomateConfig.scopes);
            await deleteFlow(token, confirmTarget.id);
            setData(prev => ({
                flows: prev.flows.filter(f => f.id !== confirmTarget.id),
                total: prev.total - 1
            }));
            if (selectedFlow?.id === confirmTarget.id) setSelectedFlow(null);
            setConfirmTarget(null);
        } catch (err) {
            alert(`Xóa thất bại: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setDeletingId(null);
        }
    }, [confirmTarget, instance, accounts, selectedFlow]);

    // ─── History ───
    const openHistory = useCallback(async (flow: FlowDefinition) => {
        setHistoryName(flow.name);
        setHistoryOpen(true);
        setHistoryRuns([]);
        setHistoryLoading(true);
        setHistorySearch('');
        try {
            const token = await acquireToken(instance, accounts[0], powerAutomateConfig.scopes);
            const runs = await fetchFlowRuns(token, flow.id);
            setHistoryRuns(runs);
        } catch (err) {
            console.warn('Failed to load flow runs:', err);
        } finally {
            setHistoryLoading(false);
        }
    }, [instance, accounts]);

    const toggleRunExpand = useCallback(async (run: FlowRun) => {
        if (expandedRunId === run.id) {
            setExpandedRunId(null);
            setTriggerOutput(null);
            return;
        }
        setExpandedRunId(run.id);
        setTriggerOutput(null);
        setTriggerLoading(true);
        try {
            const output = await fetchFlowRunTriggerOutput(run.triggerOutputsLink);
            setTriggerOutput(output);
        } catch {
            setTriggerOutput(null);
        } finally {
            setTriggerLoading(false);
        }
    }, [expandedRunId]);

    const filteredRuns = useMemo(() => {
        if (!historySearch.trim()) return historyRuns;
        const q = historySearch.toLowerCase();
        return historyRuns.filter(r =>
            r.status.toLowerCase().includes(q) ||
            r.trigger.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q) ||
            r.startedOn.toLowerCase().includes(q)
        );
    }, [historyRuns, historySearch]);

    // ─── Flow Detail ───
    const handleSelectFlow = useCallback(async (flow: FlowDefinition) => {
        setSelectedFlow(flow);
        setFlowStructure(null);
        setStructureLoading(true);
        try {
            const metadata = await fetchFlowMetadata(instance, accounts[0], flow.id);
            const structure = parseFlowStructure(metadata);
            setFlowStructure(structure);
        } catch {
            setFlowStructure(null);
        } finally {
            setStructureLoading(false);
        }
    }, [instance, accounts]);

    // ─── Group by owner ───
    const ownerGroups = useMemo(() => {
        const filtered = search
            ? flows.filter(f =>
                f.id.toLowerCase().includes(search.toLowerCase()) ||
                f.name.toLowerCase().includes(search.toLowerCase()) ||
                f.owner.toLowerCase().includes(search.toLowerCase()) ||
                f.description.toLowerCase().includes(search.toLowerCase())
            )
            : flows;
        const map = new Map<string, FlowDefinition[]>();
        for (const f of filtered) {
            const key = f.owner || 'Unknown';
            const list = map.get(key) || [];
            list.push(f);
            map.set(key, list);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [flows, search]);

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => prev[key] ? {} : { [key]: true });
    };

    useEffect(() => {
        if (Object.keys(expandedGroups).length > 0) return;
        if (ownerGroups.length === 0) return;
        const opGroup = ownerGroups.find(([name]) => name.toLowerCase().includes('operation'));
        if (opGroup) setExpandedGroups({ [opGroup[0]]: true });
        else setExpandedGroups({ [ownerGroups[0][0]]: true });
    }, [ownerGroups]);

    // const activeCount = flows.filter(f => f.state === 'Activated').length;
    const draftCount = flows.filter(f => f.state !== 'Activated').length;
    // const ownerCount = new Set(flows.map(f => f.owner).filter(Boolean)).size;

    /* ═══ RENDER ═══ */
    return (
        <div className="list-view-container" style={{ padding: '0.75rem 1.25rem' }}>

            {/* ── KPI Strip ── */}
            <div className="billing-stats">
                <StatCard icon={<Zap size={16} />} label="Total Flows" value={loading && !loaded ? '...' : total.toString()} sub="Total in environment" colorVar="var(--accent-primary)" />
                <StatCard icon={<XCircle size={16} />} label="Draft" value={loading && !loaded ? '...' : draftCount.toString()} sub="Turned off" colorVar="var(--warning)" />
                <StatCard icon={<AlertTriangle size={16} />} label="Flows with Errors" value={healthResult ? healthResult.failedFlows.length.toString() : '—'} sub={healthResult ? `${healthResult.totalFailedRuns} total failed runs` : 'Require Health Check'} colorVar="var(--danger)" onClick={healthResult ? () => openHealth('failed') : undefined} />
                <StatCard icon={<Shield size={16} />} label="Stuck Flows" value={healthResult ? healthResult.stuckFlows.length.toString() : '—'} sub={healthResult ? `Running > 50 runs` : 'Require Health Check'} colorVar="var(--warning)" onClick={healthResult ? () => openHealth('stuck') : undefined} />
            </div>

            {/* ── Error Banner ── */}
            {error && (
                <div className="flow-error-banner">
                    <AlertTriangle size={18} />
                    <div style={{ flex: 1 }}>
                        <strong>Không thể tải dữ liệu</strong>
                        <p className="text-text-muted" style={{ marginTop: 2 }}>{error}</p>
                    </div>
                    <button onClick={() => loadData()} className="action-icon-btn" style={{ gap: 4, display: 'flex', alignItems: 'center' }}>
                        <RefreshCw size={12} /> Thử lại
                    </button>
                </div>
            )}

            {/* ── Tab Bar + Actions ── */}
            <div className="list-view-header" style={{ borderBottom: 'none', marginBottom: '0.5rem' }}>
                <div className="list-view-toolbar">
                    <div className="list-view-search">
                        <Search size={14} className="list-view-search-icon" />
                        <input
                            type="text"
                            placeholder="Filter flows..."
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
                <div className="list-view-actions">
                    <div className="filter-chips">
                        {HEALTH_PERIODS.map(p => (
                            <button
                                key={p.value}
                                className={`filter-chip ${health.daysRange === p.value ? 'filter-chip--active filter-chip--accent' : ''}`}
                                onClick={() => health.setDaysRange(p.value)}
                                disabled={health.scanning}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {health.scanning ? (
                        <button onClick={() => openHealth('all')} className="filter-chip filter-chip--action" title="Xem tiến độ">
                            <Loader2 size={12} className="animate-spin" /> Scanning {health.progress}%
                        </button>
                    ) : (
                        <button onClick={runHealthCheck} className="filter-chip filter-chip--action" title="Chạy Health Check">
                            <Activity size={12} /> Run Health Check
                        </button>
                    )}
                    <button onClick={() => loadData()} disabled={loading} className="action-icon-btn" title="Refresh">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Loading ── */}
            {loading && !loaded && (
                <div className="list-view-empty-state">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <p>Đang tải flows...</p>
                </div>
            )}

            {/* ── Tab Content ── */}
            {(loaded || flows.length > 0) && (
                <>
                        <div className="list-view-table-wrapper">
                            {ownerGroups.length === 0 && !loading ? (
                                <div className="list-view-empty-state">
                                    <Search size={28} style={{ opacity: 0.3 }} />
                                    <p>{search ? `Không tìm thấy "${search}"` : 'Chưa có flow nào'}</p>
                                </div>
                            ) : (
                                <div className="reports-sidebar-list" style={{ maxHeight: 'none' }}>
                                    {ownerGroups.map(([owner, items]) => (
                                        <div key={owner} className="reports-ws-group">
                                            <button className="reports-ws-header" onClick={() => toggleGroup(owner)}>
                                                {expandedGroups[owner] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                <span className="reports-ws-name">{owner}</span>
                                                <span className="reports-ws-count">{items.length}</span>
                                            </button>
                                            {expandedGroups[owner] && (
                                                <div className="billing-table-wrapper" style={{ marginLeft: 0 }}>
                                                    <table className="billing-table">
                                                        <thead><tr><th>Name</th><th>Status</th><th>Created By</th><th>Created</th><th>Modified By</th><th>Modified</th><th style={{ width: 70 }}></th></tr></thead>
                                                        <tbody>
                                                            {items.map(flow => (
                                                                <tr key={flow.id} className="clickable-row" onClick={() => handleSelectFlow(flow)}>
                                                                    <td className="billing-table-name">{flow.name}</td>
                                                                    <td>
                                                                        <span className={`status-badge ${flow.state === 'Activated' ? 'status-approved' : 'status-pending'}`}>
                                                                            {flow.state === 'Activated' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                                            {flow.stateLabel}
                                                                        </span>
                                                                    </td>
                                                                    <td className="billing-table-type">{flow.createdBy || '—'}</td>
                                                                    <td className="billing-table-type">{formatDate(flow.createdOn)}</td>
                                                                    <td className="billing-table-type">{flow.modifiedBy || '—'}</td>
                                                                    <td className="billing-table-type">{formatDate(flow.lastModified)}</td>
                                                                    <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                                        <button
                                                                            className="billing-refresh-btn"
                                                                            style={{ padding: '4px', lineHeight: 0 }}
                                                                            title="Run History"
                                                                            onClick={e => { e.stopPropagation(); openHistory(flow); }}
                                                                        >
                                                                            <History size={13} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => handleDeleteClick(flow, e)}
                                                                            disabled={deletingId === flow.id}
                                                                            title="Xóa flow"
                                                                            style={{
                                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                                color: 'var(--text-secondary)', padding: 4, borderRadius: 4,
                                                                                opacity: deletingId === flow.id ? 0.3 : 0.5,
                                                                                transition: 'all 0.15s',
                                                                            }}
                                                                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                                                                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                                        >
                                                                            {deletingId === flow.id ? <RefreshCw size={13} className="spin" /> : <Trash2 size={13} />}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                </>
            )}

            {/* ═══ Health Check Modal ═══ */}
            <FlowHealthModal
                open={healthOpen}
                onClose={() => setHealthOpen(false)}
                health={health}
                filter={healthFilter}
                onFilterChange={setHealthFilter}
                onDeleteFlow={(id, name) => setConfirmTarget({ id, name } as FlowDefinition)}
                deletingId={deletingId}
            />

            {/* ═══ Detail Sidebar (RIGHT PANEL) ═══ */}
            {selectedFlow && (
                <>
                    <div className="flow-sidebar-backdrop" onClick={() => setSelectedFlow(null)} />
                    <div className="flow-sidebar-panel">
                        {/* Header */}
                        <div className="flow-sidebar-header">
                            <h3>{selectedFlow.name}</h3>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <a
                                    href={`https://make.powerautomate.com/manage/flows/${selectedFlow.id}/details`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="action-icon-link"
                                    title="Open in Power Automate"
                                >
                                    <ExternalLink size={14} />
                                </a>
                                <button className="close-modal-btn" onClick={() => setSelectedFlow(null)}>&times;</button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flow-sidebar-body">
                            {/* Flow Info */}
                            <div className="flow-detail-section">
                                <div className="flow-detail-section-header"><span>Flow Info</span></div>
                                <div className="detail-field">
                                    <label className="detail-label">ID</label>
                                    <div className="detail-value mono">{selectedFlow.id}</div>
                                </div>
                                {selectedFlow.solutionId && (
                                    <div className="detail-field">
                                        <label className="detail-label">Solution ID</label>
                                        <div className="detail-value mono">{selectedFlow.solutionId}</div>
                                    </div>
                                )}
                                {selectedFlow.description && (
                                    <div className="detail-field">
                                        <label className="detail-label">Description</label>
                                        <div className="detail-value">{selectedFlow.description}</div>
                                    </div>
                                )}
                            </div>

                            {/* Dates */}
                            <div className="flow-detail-section">
                                <div className="flow-detail-section-header"><span>Dates</span></div>
                                <div className="flow-detail-grid">
                                    <div className="detail-field">
                                        <label className="detail-label">Created</label>
                                        <div className="detail-value highlight">{formatDateTime(selectedFlow.createdOn)}</div>
                                    </div>
                                    <div className="detail-field">
                                        <label className="detail-label">Last Modified</label>
                                        <div className="detail-value highlight">{formatDateTime(selectedFlow.lastModified)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Structure */}
                            <div className="flow-detail-section">
                                <div className="flow-detail-section-header"><span>Structure</span></div>
                                <FlowStructureViewer structure={flowStructure || { trigger: null, actions: [] }} loading={structureLoading} />
                            </div>

                            {/* Technical Data */}
                            {selectedFlow.clientData && (
                                <div className="flow-detail-section">
                                    <div className="flow-detail-section-header">
                                        <span>Technical Data</span>
                                        <CopyButton text={selectedFlow.clientData} label="JSON" />
                                    </div>
                                    <pre className="flow-json-block">
                                        {(() => { try { return JSON.stringify(JSON.parse(selectedFlow.clientData), null, 2); } catch { return selectedFlow.clientData; } })()}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ═══ History Modal ═══ */}
            {historyOpen && (
                <div className="modal-overlay" onClick={() => setHistoryOpen(false)}>
                    <div className="modal-content flow-history-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <History size={16} className="text-accent" /> {historyName}
                            </h3>
                            <button className="close-modal-btn" onClick={() => setHistoryOpen(false)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ padding: '1rem 1.25rem' }}>
                            {/* Search */}
                            <div className="list-view-search" style={{ maxWidth: '100%', marginBottom: '0.75rem' }}>
                                <Search size={14} className="list-view-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Filter by status, trigger, ID..."
                                    value={historySearch}
                                    onChange={e => setHistorySearch(e.target.value)}
                                />
                                {historySearch && (
                                    <button onClick={() => setHistorySearch('')} className="list-view-search-clear">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {historyLoading ? (
                                <div className="list-view-empty-state" style={{ padding: '2rem' }}>
                                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                                    <p>Đang tải lịch sử...</p>
                                </div>
                            ) : filteredRuns.length > 0 ? (
                                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                    <table className="list-view-table">
                                        <thead>
                                            <tr>
                                                <th>Status</th>
                                                <th>Trigger</th>
                                                <th>Started</th>
                                                <th>Duration</th>
                                                <th style={{ width: 32 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRuns.map(run => {
                                                const isOk = run.status === 'Succeeded';
                                                const isFail = ['Failed', 'Faulted', 'TimedOut', 'Aborted'].includes(run.status);
                                                const duration = run.startedOn && run.completedOn
                                                    ? formatDuration(new Date(run.completedOn).getTime() - new Date(run.startedOn).getTime())
                                                    : '—';
                                                const isExpanded = expandedRunId === run.id;
                                                const errorInfo = isFail ? parseRunError(run as unknown as import('@/services/azure/flowAnalyticsService').FlowRun) : null;

                                                return (
                                                    <React.Fragment key={run.id}>
                                                        <tr
                                                            onClick={() => toggleRunExpand(run)}
                                                            className={isExpanded ? 'active-row' : ''}
                                                            title={run.errorMessage || 'Click to view trigger data'}
                                                        >
                                                            <td>
                                                                <span className={`status-badge ${isOk ? 'status-approved' : isFail ? 'status-rejected' : 'status-pending'}`}>
                                                                    {isOk ? <CheckCircle size={12} /> : isFail ? <XCircle size={12} /> : <Clock size={12} />}
                                                                    {run.status}
                                                                </span>
                                                            </td>
                                                            <td>{run.trigger || '—'}</td>
                                                            <td>{formatDateTime(run.startedOn)}</td>
                                                            <td>{duration}</td>
                                                            <td>
                                                                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan={5} style={{ padding: 0 }}>
                                                                    <div className="flow-run-expand">
                                                                        {errorInfo && (
                                                                            <div style={{ marginBottom: '0.75rem' }}>
                                                                                <div className="detail-label" style={{ marginBottom: 4 }}>Error Details</div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                                                    <span className="status-badge status-rejected" style={{ fontSize: '0.7rem' }}>{errorInfo.code}</span>
                                                                                    <span className="text-text-muted">Action:</span>
                                                                                    <span>{errorInfo.action}</span>
                                                                                </div>
                                                                                <p className="text-text-muted" style={{ fontSize: '0.8rem', wordBreak: 'break-word' }}>{errorInfo.message}</p>
                                                                            </div>
                                                                        )}
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span className="detail-label">Trigger Output</span>
                                                                            {triggerOutput && <CopyButton text={JSON.stringify(triggerOutput, null, 2)} label="JSON" />}
                                                                        </div>
                                                                        {triggerLoading ? (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                                                                                <Loader2 size={12} className="animate-spin" /> Loading...
                                                                            </div>
                                                                        ) : triggerOutput ? (
                                                                            <pre className="flow-json-block">{JSON.stringify(triggerOutput, null, 2)}</pre>
                                                                        ) : (
                                                                            <div className="text-text-muted" style={{ fontSize: '0.8rem' }}>No trigger output available</div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="list-view-empty-state" style={{ padding: '2rem' }}>
                                    <Clock size={22} style={{ opacity: 0.3 }} />
                                    <p>Chưa có lịch sử chạy</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm delete dialog */}
            <ConfirmDialog
                open={!!confirmTarget}
                title={`Xóa flow "${confirmTarget?.name || ''}"?`}
                confirmLabel="Xóa"
                variant="danger"
                loading={!!deletingId}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setConfirmTarget(null)}
            />
        </div>
    );
};

/* ═══════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════ */

/* ── KPI Card ── */
function StatCard({ icon, label, value, sub, colorVar, onClick }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; colorVar: string; onClick?: () => void }) {
    return (
        <div className="billing-stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} title={onClick ? 'Xem chi tiết' : undefined}>
            <div className="billing-stat-header">
                <span className="billing-stat-label">{label}</span>
                <span style={{ color: colorVar, display: 'flex' }}>{icon}</span>
            </div>
            <span className="billing-stat-value">{value}</span>
            <span className="billing-stat-sub" title={sub}>{sub}</span>
        </div>
    );
}
