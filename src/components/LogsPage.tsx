import React, { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import {
    FileText, AlertTriangle, RefreshCw, Search, Clock, Copy, Check,
    ChevronLeft, ChevronRight, Filter, X, ChevronDown, Calendar
} from 'lucide-react';
import { acquireToken } from '@/services/azure/tokenService';
import { dataverseConfig } from '@/config/authConfig';
import {
    fetchDvAuditLogs, fetchAuditTables,
    DvAuditLog, AuditFilterCriteria, TableOption, FetchAuditLogsResponse,
    ACTION_OPTIONS,
} from '@/services/azure/dvAuditService';

// ── State management ──

interface PageState { logs: DvAuditLog[]; nextLink: string | null }

interface AppState {
    pageHistory: PageState[];
    totalCount: number;
    currentPage: number;
    hasSearched: boolean;
    isLoading: boolean;
    error: string | null;
}

type Action =
    | { type: 'SEARCH_START' }
    | { type: 'SEARCH_SUCCESS'; payload: FetchAuditLogsResponse }
    | { type: 'SEARCH_FAILURE'; payload: string }
    | { type: 'PAGE_CHANGE_START' }
    | { type: 'NEXT_PAGE_SUCCESS'; payload: FetchAuditLogsResponse }
    | { type: 'SET_PAGE'; payload: number }
    | { type: 'PAGE_CHANGE_FAILURE'; payload: string };

const initialState: AppState = {
    pageHistory: [], totalCount: 0, currentPage: 1,
    hasSearched: false, isLoading: false, error: null,
};

const reducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'SEARCH_START':
            return { ...initialState, isLoading: true, hasSearched: true };
        case 'SEARCH_SUCCESS':
            return {
                ...state, isLoading: false, error: null,
                totalCount: action.payload.totalCount,
                pageHistory: [{ logs: action.payload.logs, nextLink: action.payload.nextLink }],
                currentPage: 1,
            };
        case 'SEARCH_FAILURE':
            return { ...state, isLoading: false, error: action.payload };
        case 'PAGE_CHANGE_START':
            return { ...state, isLoading: true, error: null };
        case 'NEXT_PAGE_SUCCESS':
            return {
                ...state, isLoading: false,
                pageHistory: [...state.pageHistory, { logs: action.payload.logs, nextLink: action.payload.nextLink }],
                currentPage: state.currentPage + 1,
            };
        case 'SET_PAGE':
            return { ...state, currentPage: action.payload };
        case 'PAGE_CHANGE_FAILURE':
            return { ...state, isLoading: false, error: action.payload };
        default: return state;
    }
};

// ── Component ──

const DateFilterInput: React.FC<{ label: string; value: string; onChange: (val: string) => void }> = ({ label, value, onChange }) => {
    const [inputValue, setInputValue] = useState('');
    const hiddenDateRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (value) {
            const parts = value.split('-');
            if (parts.length === 3) {
                const [y, m, d] = parts;
                setInputValue(`${d}/${m}/${y}`);
            } else {
                setInputValue(value);
            }
        } else {
            setInputValue('');
        }
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9/]/g, '');

        if (val.length > inputValue.length) {
            if (val.length === 2 && !val.includes('/')) val += '/';
            else if (val.length === 5 && val.split('/').length === 2) val += '/';
        }

        setInputValue(val);

        if (val.length === 10) {
            const parts = val.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                if (d.length === 2 && m.length === 2 && y.length === 4) {
                    onChange(`${y}-${m}-${d}`);
                }
            }
        } else if (val.length === 0) {
            onChange('');
        }
    };

    const handleCalendarClick = () => {
        if (hiddenDateRef.current) {
            try {
                hiddenDateRef.current.showPicker();
            } catch {
                hiddenDateRef.current.click();
            }
        }
    };

    return (
        <div>
            <label className="audit-filter-label">{label}</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {/* Hidden native date input — chỉ dùng để hiện picker */}
                <input
                    ref={hiddenDateRef}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        position: 'absolute',
                        opacity: 0,
                        pointerEvents: 'none',
                        width: 0,
                        height: 0,
                        border: 'none',
                        padding: 0,
                    }}
                    tabIndex={-1}
                />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleTextChange}
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className="audit-filter-input"
                    style={{ flex: 1, paddingRight: '2rem' }}
                />
                <button
                    type="button"
                    onClick={handleCalendarClick}
                    style={{
                        position: 'absolute',
                        right: '0.45rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'inherit',
                        opacity: 0.5,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                    }}
                    tabIndex={-1}
                >
                    <Calendar size={14} />
                </button>
            </div>
        </div>
    );
};

export const LogsPage: React.FC = () => {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();

    const [state, dispatch] = useReducer(reducer, initialState);
    const [filters, setFilters] = useState<AuditFilterCriteria>({
        tableName: '',
        action: 'ALL',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        recordId: '',
        pageSize: 50,
        columnName: '',
    });

    // Table list
    const [tables, setTables] = useState<TableOption[]>([]);
    const [tablesLoading, setTablesLoading] = useState(false);
    const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
    const [tableSearch, setTableSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Page search (local filter on current page)
    const [localSearch, setLocalSearch] = useState('');

    // Clipboard
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // ── Get token ──
    const getToken = useCallback(async () => {
        const account = accounts[0];
        return acquireToken(instance, account, dataverseConfig.scopes);
    }, [instance, accounts]);

    // ── Load tables on mount ──
    useEffect(() => {
        if (!isAuthenticated || accounts.length === 0) return;
        let cancelled = false;

        const loadTables = async () => {
            setTablesLoading(true);
            try {
                const token = await getToken();
                const data = await fetchAuditTables(token);
                if (!cancelled) {
                    setTables(data);
                    if (data.length > 0 && !data.some(t => t.logicalName === filters.tableName)) {
                        setFilters(prev => ({ ...prev, tableName: data[0].logicalName }));
                    } else if (data.length === 0) {
                        setFilters(prev => ({ ...prev, tableName: '' }));
                    }
                }
            } catch (e) {
                console.error('Failed to load tables:', e);
                if (!cancelled) setTables([]);
            } finally {
                if (!cancelled) setTablesLoading(false);
            }
        };

        loadTables();
        return () => { cancelled = true; };
    }, [isAuthenticated, accounts, getToken]);

    // ── Close dropdown on outside click ──
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setTableDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Search ──
    const handleSearch = useCallback(async () => {
        if (!isAuthenticated || accounts.length === 0) return;
        dispatch({ type: 'SEARCH_START' });
        try {
            const token = await getToken();
            const result = await fetchDvAuditLogs(token, filters, null);
            dispatch({ type: 'SEARCH_SUCCESS', payload: result });
        } catch (e) {
            dispatch({ type: 'SEARCH_FAILURE', payload: e instanceof Error ? e.message : 'Failed to fetch audit logs.' });
        }
    }, [isAuthenticated, accounts, getToken, filters]);

    // ── Pagination ──
    const handlePageChange = useCallback(async (direction: 'next' | 'prev') => {
        if (direction === 'prev') {
            if (state.currentPage > 1) dispatch({ type: 'SET_PAGE', payload: state.currentPage - 1 });
            return;
        }

        const totalPages = Math.ceil(state.totalCount / filters.pageSize);
        if (state.currentPage >= totalPages) return;

        const nextPageNum = state.currentPage + 1;
        if (nextPageNum <= state.pageHistory.length) {
            dispatch({ type: 'SET_PAGE', payload: nextPageNum });
            return;
        }

        const currentPageData = state.pageHistory[state.currentPage - 1];
        if (!currentPageData?.nextLink) return;

        dispatch({ type: 'PAGE_CHANGE_START' });
        try {
            const token = await getToken();
            const result = await fetchDvAuditLogs(token, filters, currentPageData.nextLink);
            dispatch({ type: 'NEXT_PAGE_SUCCESS', payload: result });
        } catch (e) {
            dispatch({ type: 'PAGE_CHANGE_FAILURE', payload: e instanceof Error ? e.message : 'Failed to load next page.' });
        }
    }, [state, filters, getToken]);

    // ── Copy record ID ──
    const handleCopy = (logId: string, recordId: string) => {
        navigator.clipboard.writeText(recordId);
        setCopiedId(logId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ── Derived ──
    const currentLogs = state.pageHistory[state.currentPage - 1]?.logs ?? [];
    const totalPages = state.totalCount > 0 ? Math.ceil(state.totalCount / filters.pageSize) : 0;
    const selectedTable = tables.find(t => t.logicalName === filters.tableName);
    const filteredTableOptions = tables.filter(t => t.displayName.toLowerCase().includes(tableSearch.toLowerCase()));

    // Client-side filter: column name (match against changes text)
    const columnFiltered = currentLogs.filter(log => {
        const col = filters.columnName?.trim().toLowerCase();
        if (!col) return true;
        // Với UPDATE logs: changes có format "logicalName: old → new"
        // Với CREATE/DELETE: changes = 'N/A', vẫn cho pass nếu không phải UPDATE
        return log.changes?.toLowerCase().includes(col) ?? false;
    });

    // Local search on current page
    const displayLogs = columnFiltered.filter(log => {
        if (!localSearch.trim()) return true;
        const q = localSearch.toLowerCase();
        return log.user.name.toLowerCase().includes(q)
            || log.tableName.toLowerCase().includes(q)
            || log.changes?.toLowerCase().includes(q)
            || log.action.toLowerCase().includes(q);
    });

    const getActionStyle = (action: string) => {
        switch (action) {
            case 'CREATE': return { color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.45)', boxShadow: '0 0 8px rgba(16,185,129,0.25)' };
            case 'UPDATE': return { color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.4)', boxShadow: '0 0 8px rgba(34,211,238,0.2)' };
            case 'DELETE': return { color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.45)', boxShadow: '0 0 8px rgba(239,68,68,0.25)' };
            default: return { color: '#71717a', background: 'rgba(113,113,122,0.08)', border: '1px solid rgba(113,113,122,0.3)' };
        }
    };

    return (
        <div className="health-page">
            {/* Stats */}
            <div className="billing-stats">
                <div className="billing-stat-card">
                    <div className="billing-stat-header">
                        <span className="billing-stat-label">Total Records</span>
                        <div className="billing-stat-icon" style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}><FileText size={20} /></div>
                    </div>
                    <span className="billing-stat-value">{state.hasSearched ? state.totalCount.toLocaleString() : '—'}</span>
                </div>
                <div className="billing-stat-card">
                    <div className="billing-stat-header">
                        <span className="billing-stat-label">Current Page</span>
                        <div className="billing-stat-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}><Filter size={20} /></div>
                    </div>
                    <span className="billing-stat-value">{state.hasSearched ? `${state.currentPage}/${totalPages || 1}` : '—'}</span>
                </div>
                <div className="billing-stat-card">
                    <div className="billing-stat-header">
                        <span className="billing-stat-label">Tables Available</span>
                        <div className="billing-stat-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><FileText size={20} /></div>
                    </div>
                    <span className="billing-stat-value">{tablesLoading ? '...' : tables.length}</span>
                </div>
                <div className="billing-stat-card">
                    <div className="billing-stat-header">
                        <span className="billing-stat-label">Page Size</span>
                        <div className="billing-stat-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}><FileText size={20} /></div>
                    </div>
                    <span className="billing-stat-value">{filters.pageSize}</span>
                </div>
            </div>

            {/* Error */}
            {state.error && (
                <div className="billing-error">
                    <AlertTriangle size={20} />
                    <div><strong>Cannot load audit logs</strong><p>{state.error}</p></div>
                    <button onClick={handleSearch} className="billing-retry-btn"><RefreshCw size={14} /> Thử lại</button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="billing-section">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                    {/* Table (searchable dropdown) */}
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <label className="audit-filter-label">Table</label>
                        <button
                            type="button"
                            onClick={() => setTableDropdownOpen(prev => !prev)}
                            disabled={tablesLoading}
                            className="audit-filter-select"
                            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {tablesLoading ? 'Loading...' : selectedTable?.displayName || 'Select table'}
                            </span>
                            <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                        </button>
                        {tableDropdownOpen && !tablesLoading && (
                            <div className="audit-table-dropdown">
                                <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
                                    <input
                                        type="text"
                                        placeholder="Search tables..."
                                        value={tableSearch}
                                        onChange={e => setTableSearch(e.target.value)}
                                        className="audit-filter-input"
                                        autoFocus
                                    />
                                </div>
                                <ul style={{ maxHeight: '200px', overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
                                    {filteredTableOptions.length > 0 ? filteredTableOptions.map(t => (
                                        <li
                                            key={t.logicalName}
                                            onClick={() => {
                                                setFilters(prev => ({ ...prev, tableName: t.logicalName }));
                                                setTableDropdownOpen(false);
                                                setTableSearch('');
                                            }}
                                            className="audit-table-dropdown-item"
                                            style={{ fontWeight: filters.tableName === t.logicalName ? 600 : 400 }}
                                        >
                                            {t.displayName}
                                        </li>
                                    )) : (
                                        <li style={{ padding: '0.5rem 0.75rem', opacity: 0.5, fontSize: '0.75rem' }}>No tables found.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Action */}
                    <div>
                        <label className="audit-filter-label">Action</label>
                        <select
                            value={filters.action}
                            onChange={e => setFilters(prev => ({ ...prev, action: e.target.value as AuditFilterCriteria['action'] }))}
                            className="audit-filter-select"
                        >
                            {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>

                    {/* Start Date */}
                    <DateFilterInput
                        label="Start Date"
                        value={filters.startDate}
                        onChange={val => setFilters(prev => ({ ...prev, startDate: val }))}
                    />

                    {/* End Date */}
                    <DateFilterInput
                        label="End Date"
                        value={filters.endDate}
                        onChange={val => setFilters(prev => ({ ...prev, endDate: val }))}
                    />

                    {/* Record ID */}
                    <div>
                        <label className="audit-filter-label">Record ID</label>
                        <input
                            type="text"
                            placeholder="Optional GUID..."
                            value={filters.recordId}
                            onChange={e => setFilters(prev => ({ ...prev, recordId: e.target.value }))}
                            className="audit-filter-input"
                        />
                    </div>

                    {/* Column Name (client-side filter) */}
                    <div>
                        <label className="audit-filter-label">Column Name</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="vd: cr44a_oituongco"
                                value={filters.columnName ?? ''}
                                onChange={e => setFilters(prev => ({ ...prev, columnName: e.target.value }))}
                                className="audit-filter-input"
                                style={{ flex: 1, paddingRight: filters.columnName ? '1.6rem' : undefined }}
                            />
                            {filters.columnName && (
                                <button
                                    type="button"
                                    onClick={() => setFilters(prev => ({ ...prev, columnName: '' }))}
                                    style={{ position: 'absolute', right: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5, padding: 0, display: 'flex' }}
                                    title="Xóa filter"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Page Size */}
                    <div>
                        <label className="audit-filter-label">Page Size</label>
                        <input
                            type="number"
                            min={1}
                            max={1000}
                            value={filters.pageSize}
                            onChange={e => {
                                const n = parseInt(e.target.value, 10);
                                setFilters(prev => ({ ...prev, pageSize: isNaN(n) || n < 1 ? 50 : n }));
                            }}
                            className="audit-filter-input"
                        />
                    </div>

                    {/* Search Button */}
                    <div>
                        <label className="audit-filter-label">&nbsp;</label>
                        <button
                            onClick={handleSearch}
                            disabled={state.isLoading || tablesLoading || !filters.tableName}
                            className="audit-search-btn"
                        >
                            {state.isLoading && state.pageHistory.length === 0
                                ? <><RefreshCw size={14} className="spin" /> Searching...</>
                                : <><Search size={14} /> Search</>
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading (initial search) */}
            {state.isLoading && state.pageHistory.length === 0 && (
                <div className="billing-loading"><div className="spinner"></div><p>Đang tải audit logs...</p></div>
            )}

            {/* Initial state */}
            {!state.hasSearched && !state.isLoading && (
                <div className="billing-loading" style={{ padding: '3rem' }}>
                    <Search size={32} style={{ opacity: 0.2 }} />
                    <p style={{ marginTop: '0.75rem', opacity: 0.5 }}>Chọn filters và nhấn Search để xem audit logs</p>
                </div>
            )}

            {/* No results */}
            {state.hasSearched && state.totalCount === 0 && !state.isLoading && (
                <div className="billing-loading" style={{ padding: '3rem' }}>
                    <FileText size={28} style={{ opacity: 0.2 }} />
                    <p>Không tìm thấy audit logs. Hãy thử thay đổi filters.</p>
                </div>
            )}

            {/* Data Table */}
            {state.hasSearched && state.totalCount > 0 && (
                <div className="billing-section">
                    {/* Table header: local search + pagination */}
                    <div className="reports-header">
                        <div className="reports-search" style={{ width: 250 }}>
                            <Search size={14} className="reports-search-icon" />
                            <input
                                type="text"
                                placeholder="Filter on this page..."
                                value={localSearch}
                                onChange={e => setLocalSearch(e.target.value)}
                                className="reports-search-input"
                            />
                            {localSearch && (
                                <button onClick={() => setLocalSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0.25rem' }}>
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <div className="reports-header-actions">
                            <span className="billing-table-type" style={{ opacity: 0.6 }}>
                                {((state.currentPage - 1) * filters.pageSize + 1).toLocaleString()}–{Math.min(state.currentPage * filters.pageSize, state.totalCount).toLocaleString()} of {state.totalCount.toLocaleString()}
                            </span>
                            {totalPages > 1 && (
                                <div className="pagination-bar">
                                    <button onClick={() => handlePageChange('prev')} disabled={state.currentPage <= 1 || state.isLoading} title="Previous page"><ChevronLeft size={14} /></button>
                                    <span className="pagination-info">{state.currentPage}/{totalPages}</span>
                                    <button onClick={() => handlePageChange('next')} disabled={state.currentPage >= totalPages || state.isLoading} title="Next page"><ChevronRight size={14} /></button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="billing-table-wrapper" style={{ opacity: state.isLoading ? 0.5 : 1 }}>
                        <table className="billing-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>User</th>
                                    <th>Table</th>
                                    <th>Action</th>
                                    <th style={{ minWidth: '300px' }}>Changes</th>
                                    <th style={{ width: '3rem', textAlign: 'center' }}>ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="billing-table-type" style={{ whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Clock size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                                                <div style={{ lineHeight: 1.4 }}>
                                                    <div>{log.timestamp.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                                                    <div style={{ opacity: 0.5, fontSize: '0.72rem' }}>{log.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="billing-table-name">{log.user.name}</td>
                                        <td className="billing-table-type" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{log.tableName}</td>
                                        <td>
                                            <span className="license-status-badge" style={getActionStyle(log.action)}>{log.action}</span>
                                        </td>
                                        <td>
                                            {log.action === 'UPDATE' && log.changes && log.changes !== 'N/A' ? (
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.72rem', lineHeight: 1.5 }}>{log.changes}</pre>
                                            ) : (
                                                <span className="billing-table-type" style={{ opacity: 0.4 }}>N/A</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleCopy(log.id, log.recordId)}
                                                title={`Copy: ${log.recordId}`}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0.25rem' }}
                                            >
                                                {copiedId === log.id ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} style={{ opacity: 0.4 }} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {displayLogs.length === 0 && (
                        <div className="billing-loading" style={{ padding: '2rem' }}>
                            <p>{localSearch ? `Không tìm thấy "${localSearch}" trên trang này` : 'Không có dữ liệu'}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
