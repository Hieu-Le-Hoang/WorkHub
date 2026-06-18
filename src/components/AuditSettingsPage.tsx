import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import {
    ScanSearch, RefreshCw, AlertTriangle, Search,
    X, Loader2,
    Database, ShieldCheck, ShieldOff,
} from 'lucide-react';
import type { AuditTableInfo } from '@/services/azure/auditSettingsService';
import { fetchAuditSettings, fetchTableAuditDetail, updateTableAudit } from '@/services/azure/auditSettingsService';
import { acquireToken } from '@/services/azure/tokenService';
import { dataverseConfig } from '@/config/authConfig';

type FilterMode = 'all' | 'on' | 'off';

function formatLogicalName(name: string): string {
    return name.replace(/^cr44a_/, '').replace(/_/g, ' ');
}

export const AuditSettingsPage: React.FC = () => {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [tables, setTables] = useState<AuditTableInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const loadedRef = useRef(false);
    const [selectedItem, setSelectedItem] = useState<AuditTableInfo | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [togglingSet, setTogglingSet] = useState<Set<string>>(new Set());
    const [confirmToggle, setConfirmToggle] = useState(false);
    const [toggleTarget, setToggleTarget] = useState<AuditTableInfo | null>(null);

    const loadData = useCallback(async (force = false) => {
        if (!isAuthenticated || accounts.length === 0) return;
        if (loadedRef.current && !force) return;
        setLoading(true);
        setError(null);
        try {
            const token = await acquireToken(instance, accounts[0], dataverseConfig.scopes);
            const result = await fetchAuditSettings(token);
            setTables(result);
            loadedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audit settings');
        } finally {
            setLoading(false);
        }
    }, [instance, accounts, isAuthenticated]);

    useEffect(() => { loadData(); }, [loadData]);

    // Row click → lazy-load detail
    const handleRowClick = useCallback(async (table: AuditTableInfo) => {
        setSelectedItem(table);
        // If detail already cached, skip
        if (table.detail) return;
        setDetailLoading(true);
        try {
            const token = await acquireToken(instance, accounts[0], dataverseConfig.scopes);
            const detail = await fetchTableAuditDetail(token, table.logicalName, table.isAuditEnabled);
            const updated = { ...table, detail };
            setSelectedItem(updated);
            // Cache in tables state
            setTables(prev => prev.map(t =>
                t.logicalName === table.logicalName ? updated : t
            ));
        } catch (err) {
            console.error('Detail fetch failed:', err);
        } finally {
            setDetailLoading(false);
        }
    }, [instance, accounts]);

    // Toggle audit handler — per-table async, không block các table khác
    const handleToggleAudit = useCallback(async () => {
        if (!toggleTarget || !isAuthenticated || accounts.length === 0) return;
        const target = toggleTarget;
        setTogglingSet(prev => new Set(prev).add(target.logicalName));
        setConfirmToggle(false);
        setToggleTarget(null);
        try {
            const token = await acquireToken(instance, accounts[0], dataverseConfig.scopes);
            const newValue = !target.isAuditEnabled;
            await updateTableAudit(token, target.logicalName, newValue);
            // Clear cached detail (audit status changed → columns may differ)
            const updatedBase = { ...target, isAuditEnabled: newValue, detail: undefined };
            setTables(prev => prev.map(t =>
                t.logicalName === target.logicalName
                    ? { ...t, isAuditEnabled: newValue, detail: undefined }
                    : t
            ));
            // Sync selectedItem if it's the same table
            if (selectedItem?.logicalName === target.logicalName) {
                setSelectedItem(updatedBase);
            }
            // Re-fetch detail with new audit state
            const detail = await fetchTableAuditDetail(token, target.logicalName, newValue);
            const withDetail = { ...updatedBase, detail };
            setTables(prev => prev.map(t =>
                t.logicalName === target.logicalName ? withDetail : t
            ));
            if (selectedItem?.logicalName === target.logicalName) {
                setSelectedItem(withDetail);
            }
        } catch (err) {
            console.error('Toggle audit failed:', err);
            alert(`Failed to toggle audit: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setTogglingSet(prev => { const s = new Set(prev); s.delete(target.logicalName); return s; });
        }
    }, [toggleTarget, selectedItem, instance, accounts, isAuthenticated]);

    // Stats
    const auditOnCount = tables.filter(t => t.isAuditEnabled).length;
    const auditOffCount = tables.filter(t => !t.isAuditEnabled).length;

    // Filter + search
    const filteredTables = useMemo(() => {
        let result = tables;
        if (filterMode === 'on') result = result.filter(t => t.isAuditEnabled);
        if (filterMode === 'off') result = result.filter(t => !t.isAuditEnabled);
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.displayName.toLowerCase().includes(q) ||
                t.logicalName.toLowerCase().includes(q)
            );
        }
        return result;
    }, [tables, filterMode, search]);

    return (
        <div className="health-page">
            {/* Stats */}
            <div className="billing-stats">
                <div className="billing-stat-card">
                    <div className="billing-stat-header">
                        <span className="billing-stat-label">Custom Tables</span>
                        <Database size={16} style={{ color: '#a78bfa' }} />
                    </div>
                    <span className="billing-stat-value">{loading && !loadedRef.current ? '...' : tables.length}</span>
                </div>
                <div className="billing-stat-card">
                    <div className="billing-stat-header">
                        <span className="billing-stat-label">Audit ON</span>
                        <ShieldCheck size={16} style={{ color: '#10b981' }} />
                    </div>
                    <span className="billing-stat-value">{loading && !loadedRef.current ? '...' : auditOnCount}</span>
                </div>
                <div className="billing-stat-card">
                    <div className="billing-stat-header">
                        <span className="billing-stat-label">Audit OFF</span>
                        <ShieldOff size={16} style={{ color: '#ef4444' }} />
                    </div>
                    <span className="billing-stat-value">{loading && !loadedRef.current ? '...' : auditOffCount}</span>
                </div>

            </div>

            {/* Error */}
            {error && (
                <div className="billing-error">
                    <AlertTriangle size={20} />
                    <div><strong>Không thể tải dữ liệu</strong><p>{error}</p></div>
                    <button onClick={() => loadData(true)} className="billing-retry-btn"><RefreshCw size={14} /> Thử lại</button>
                </div>
            )}

            {/* Header: filter chips + search + refresh */}
            <div className="reports-header">
                <div className="logs-tabs" />
                <div className="reports-header-actions">
                    <div className="filter-chips">
                        <button
                            className={`filter-chip ${filterMode === 'all' ? 'filter-chip--active' : ''}`}
                            onClick={() => setFilterMode('all')}
                        >
                            All ({tables.length})
                        </button>
                        <button
                            className={`filter-chip ${filterMode === 'on' ? 'filter-chip--active filter-chip--success' : ''}`}
                            onClick={() => setFilterMode('on')}
                        >
                            <ShieldCheck size={12} /> ON ({auditOnCount})
                        </button>
                        <button
                            className={`filter-chip ${filterMode === 'off' ? 'filter-chip--active filter-chip--danger' : ''}`}
                            onClick={() => setFilterMode('off')}
                        >
                            <ShieldOff size={12} /> OFF ({auditOffCount})
                        </button>
                    </div>
                    <div className="reports-search" style={{ width: 220 }}>
                        <Search size={14} className="reports-search-icon" />
                        <input type="text" placeholder="Filter tables..." value={search} onChange={e => setSearch(e.target.value)} className="reports-search-input" />
                    </div>
                    <button onClick={() => loadData(true)} className="billing-refresh-btn" disabled={loading} title="Refresh">
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && !loadedRef.current && (
                <div className="billing-loading"><div className="spinner"></div><p>Đang tải audit settings...</p></div>
            )}

            {/* Table list */}
            {loadedRef.current && (
                <div className="billing-section">
                    <div className="billing-table-wrapper">
                        <table className="billing-table">
                            <thead>
                                <tr>
                                    <th>Display Name</th>
                                    <th>Logical Name</th>
                                    <th style={{ textAlign: 'center' }}>Columns</th>
                                    <th style={{ textAlign: 'center' }}>Audit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTables.map(table => (
                                    <tr key={table.logicalName} className="clickable-row" onClick={() => handleRowClick(table)}>
                                        <td className="billing-table-name">{table.displayName}</td>
                                        <td className="billing-table-type" style={{ fontFamily: 'monospace' }}>{table.logicalName}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {table.detail
                                                ? <span style={{ fontSize: '0.75rem', color: table.detail.auditedColumns.length > 0 ? '#a78bfa' : 'var(--text-muted)' }}>{table.detail.auditedColumns.length}</span>
                                                : <span className="billing-stat-label" style={{ color: 'var(--text-muted)' }}>—</span>
                                            }
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                className={`audit-switch ${table.isAuditEnabled ? 'audit-switch--on' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setToggleTarget(table); setConfirmToggle(true); }}
                                                disabled={togglingSet.has(table.logicalName)}
                                                title={table.isAuditEnabled ? 'Tắt Audit' : 'Bật Audit'}
                                            >
                                                <span className="audit-switch-thumb">
                                                    {togglingSet.has(table.logicalName) && <Loader2 size={10} className="spin" />}
                                                </span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTables.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={3} className="audit-empty-state">
                                            <ScanSearch size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                                            <p>{search ? `Không tìm thấy "${search}"` : 'Không có dữ liệu'}</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detail sidebar */}
            {selectedItem && (
                <>
                    <div className="detail-sidebar-overlay" onClick={() => setSelectedItem(null)} />
                    <div className="detail-sidebar">
                        <div className="detail-sidebar-header">
                            <h3>{selectedItem.displayName}</h3>
                            <button className="detail-sidebar-close" onClick={() => setSelectedItem(null)} title="Close"><X size={16} /></button>
                        </div>
                        <div className="detail-sidebar-body">
                            <div className="detail-section">
                                <div className="detail-section-title">Table Info</div>
                                <div className="detail-meta-grid">
                                    <div className="detail-meta-item"><div className="meta-label">Display Name</div><div className="meta-value">{selectedItem.displayName}</div></div>
                                    <div className="detail-meta-item"><div className="meta-label">Logical Name</div><div className="meta-value" style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{selectedItem.logicalName}</div></div>
                                    <div className="detail-meta-item"><div className="meta-label">Audit Status</div><div className="meta-value">
                                        <button
                                            className={`audit-switch ${selectedItem.isAuditEnabled ? 'audit-switch--on' : ''}`}
                                            onClick={() => { setToggleTarget(selectedItem); setConfirmToggle(true); }}
                                            disabled={togglingSet.has(selectedItem.logicalName)}
                                        >
                                            <span className="audit-switch-thumb">
                                                {togglingSet.has(selectedItem.logicalName) && <Loader2 size={10} className="spin" />}
                                            </span>
                                        </button>
                                    </div></div>
                                    <div className="detail-meta-item"><div className="meta-label">Audited Columns</div><div className="meta-value">{selectedItem.detail ? selectedItem.detail.auditedColumns.length : '...'}</div></div>
                                </div>
                            </div>

                            {/* Detail Loading */}
                            {detailLoading && (
                                <div className="detail-loading">
                                    <Loader2 size={16} className="spin" /> Đang tải chi tiết...
                                </div>
                            )}

                            {/* Unaudited Custom Lookups Warning */}
                            {selectedItem.detail && selectedItem.isAuditEnabled && selectedItem.detail.unauditedLookups.length > 0 && (
                                <div className="detail-section">
                                    <div className="detail-section-title audit-section-warn">
                                        <span><AlertTriangle size={12} /> Lookup chưa bật Audit ({selectedItem.detail.unauditedLookups.length})</span>
                                    </div>
                                    <div className="audit-col-list">
                                        {selectedItem.detail.unauditedLookups.map(col => (
                                            <div key={col.logicalName} className="audit-col-item audit-col-item--warn">
                                                <span className="audit-col-name">{col.displayName || formatLogicalName(col.logicalName)}</span>
                                                <span className="audit-col-logical">{col.logicalName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedItem.detail && selectedItem.detail.auditedColumns.length > 0 && (
                                <div className="detail-section">
                                    <div className="detail-section-title">Audited Columns ({selectedItem.detail.auditedColumns.length})</div>
                                    <div className="audit-col-list">
                                        {selectedItem.detail.auditedColumns.map(col => (
                                            <div key={col.logicalName} className="audit-col-item">
                                                <span className="audit-col-name">{col.displayName || formatLogicalName(col.logicalName)}</span>
                                                <span className="audit-col-logical">{col.logicalName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedItem.detail && selectedItem.detail.auditedColumns.length === 0 && selectedItem.isAuditEnabled && (
                                <div className="detail-section">
                                    <div className="audit-empty-state">
                                        <ShieldCheck size={20} />
                                        <p>Table audit is ON but no specific columns are audited</p>
                                    </div>
                                </div>
                            )}

                            {!selectedItem.isAuditEnabled && !detailLoading && (
                                <div className="detail-section">
                                    <div className="audit-empty-state">
                                        <ShieldOff size={20} />
                                        <p>Auditing is disabled for this table</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Confirm Toggle Dialog */}
            {confirmToggle && toggleTarget && (
                <div className="modal-overlay" onClick={() => { setConfirmToggle(false); setToggleTarget(null); }}>
                    <div className="modal-content audit-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="audit-confirm-title">
                                <AlertTriangle size={16} />
                                {toggleTarget.isAuditEnabled ? 'Tắt Audit?' : 'Bật Audit?'}
                            </h3>
                            <button className="close-modal-btn" onClick={() => { setConfirmToggle(false); setToggleTarget(null); }}>&times;</button>
                        </div>
                        <div className="audit-confirm-body">
                            <p>
                                {toggleTarget.isAuditEnabled
                                    ? <>Bạn sắp <strong className="text-danger">tắt audit</strong> cho table <strong>{toggleTarget.displayName}</strong>. Các thay đổi dữ liệu sẽ <strong>không được ghi log</strong> nữa từ thời điểm này.</>
                                    : <>Bạn sắp <strong className="text-success">bật audit</strong> cho table <strong>{toggleTarget.displayName}</strong>. Mọi thay đổi dữ liệu sẽ được ghi log từ thời điểm này.</>
                                }
                            </p>
                            <div className="audit-confirm-actions">
                                <button className="audit-confirm-btn" onClick={() => { setConfirmToggle(false); setToggleTarget(null); }}>Hủy</button>
                                <button
                                    className={`audit-confirm-btn ${toggleTarget.isAuditEnabled ? 'audit-confirm-btn--danger' : 'audit-confirm-btn--success'}`}
                                    onClick={handleToggleAudit}
                                >
                                    {toggleTarget.isAuditEnabled ? <><ShieldOff size={13} /> Tắt Audit</> : <><ShieldCheck size={13} /> Bật Audit</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
