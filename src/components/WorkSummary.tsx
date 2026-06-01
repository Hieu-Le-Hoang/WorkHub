import React, { useMemo, useState } from 'react';
import { MonthSummary, DayRecord } from '@/types/types';
import { getAttendanceAlerts, AttendanceAlert } from '@/utils/workUtils';

interface WorkSummaryProps {
    summary: MonthSummary;
    year: number;
    month: number;
    records: DayRecord[];
}

const ALERT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
    missing: {
        icon: '🚫',
        color: '#fb923c',
        bg: 'rgba(249,115,22,0.08)',
        border: 'rgba(249,115,22,0.3)',
    },
    'no-checkin': {
        icon: '⏱️',
        color: '#f87171',
        bg: 'rgba(239,68,68,0.08)',
        border: 'rgba(239,68,68,0.3)',
    },
    insufficient: {
        icon: '⚠️',
        color: '#fbbf24',
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.3)',
    },
};

const LEVEL_LABEL: Record<string, string> = {
    missing: 'Thiếu dữ liệu',
    'no-checkin': 'Thiếu check-in/out',
    insufficient: 'Thiếu giờ',
};

function formatAlertDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dow = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
    return `${dow} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

const AlertRow: React.FC<{ alert: AttendanceAlert }> = ({ alert }) => {
    const cfg = ALERT_CONFIG[alert.level];
    return (
        <div
            className="alert-row"
            style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.color}` }}
        >
            <span className="alert-icon">{cfg.icon}</span>
            <div className="alert-body">
                <span className="alert-date">{formatAlertDate(alert.date)}</span>
                <span className="alert-label" style={{ color: cfg.color }}>{alert.label}</span>
            </div>
            <span
                className="alert-level-badge"
                style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}
            >
                {LEVEL_LABEL[alert.level]}
            </span>
        </div>
    );
};

export const WorkSummary: React.FC<WorkSummaryProps> = React.memo(({ summary, year, month, records }) => {
    const [alertFilter, setAlertFilter] = useState<string>('all');

    const percentage = summary.standardDays > 0
        ? Math.round((summary.actualDays / summary.standardDays) * 100)
        : 0;

    const getProgressColor = (): string => {
        if (percentage >= 100) return '#10b981';
        if (percentage >= 80) return '#f59e0b';
        return '#ef4444';
    };

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    const monthNames = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];

    // Tính alerts từ 30 ngày rolling (dùng toàn bộ records, không lọc theo tháng)
    const allAlerts = useMemo(() => getAttendanceAlerts(records, 30), [records]);

    const counts = useMemo(() => ({
        missing: allAlerts.filter(a => a.level === 'missing').length,
        'no-checkin': allAlerts.filter(a => a.level === 'no-checkin').length,
        insufficient: allAlerts.filter(a => a.level === 'insufficient').length,
    }), [allAlerts]);

    const filteredAlerts = useMemo(() =>
        alertFilter === 'all' ? allAlerts : allAlerts.filter(a => a.level === alertFilter),
        [allAlerts, alertFilter]
    );

    return (
        <div className="work-summary">
            <div className="summary-header">
                <h2>📊 Tổng kết {monthNames[month]} {year}</h2>
                <a
                    href="https://wecare-ii.crm5.dynamics.com/main.aspx?appid=7c0ada0d-cf0d-f011-998a-6045bd1cb61e&newWindow=true&pagetype=entitylist&etn=crdfd_bangchamconghangngay&viewid=a0425dbf-9e97-477c-b77e-c98bf88b1657&viewType=1039"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link-icon"
                    title="Xem dữ liệu gốc"
                >
                    🔗
                </a>
            </div>

            <div className="summary-cards">
                <div className="summary-card standard">
                    <div className="card-icon">📋</div>
                    <div className="card-content">
                        <span className="card-value">{summary.standardDays}</span>
                        <span className="card-label">Công chuẩn</span>
                    </div>
                </div>

                <div className="summary-card actual">
                    <div className="card-icon">✅</div>
                    <div className="card-content">
                        <span className="card-value">{summary.actualDays.toFixed(1)}</span>
                        <span className="card-label">Công thực tế</span>
                    </div>
                </div>

                <div className="summary-card difference">
                    <div className="card-icon">{summary.actualDays >= summary.standardDays ? '🎉' : '⚠️'}</div>
                    <div className="card-content">
                        <span className={`card-value ${summary.actualDays >= summary.standardDays ? 'positive' : 'negative'}`}>
                            {summary.actualDays >= summary.standardDays ? '+' : ''}
                            {(summary.actualDays - summary.standardDays).toFixed(1)}
                        </span>
                        <span className="card-label">Chênh lệch</span>
                    </div>
                </div>
            </div>

            <div className="progress-section">
                <div className="progress-header">
                    <span>Tiến độ công</span>
                    <span className="progress-percent">{percentage}%</span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: getProgressColor()
                        }}
                    />
                </div>
            </div>

            {/* ── 30-day attendance alert panel ── */}
            <div className="alert-panel">
                <div className="alert-panel-header">
                    <span className="alert-panel-title">
                        🔔 Kiểm tra công 30 ngày
                        {allAlerts.length > 0 && (
                            <span className="alert-total-badge">{allAlerts.length}</span>
                        )}
                    </span>
                </div>

                {allAlerts.length > 0 ? (
                    <>
                        {/* Filter chips */}
                        <div className="alert-filters">
                            {(['all', 'missing', 'no-checkin', 'insufficient'] as const).map(f => {
                                const count = f === 'all' ? allAlerts.length : counts[f];
                                const cfg = f === 'all' ? null : ALERT_CONFIG[f];
                                return (
                                    <button
                                        key={f}
                                        className={`alert-chip ${alertFilter === f ? 'active' : ''}`}
                                        style={alertFilter === f && cfg ? {
                                            background: cfg.bg,
                                            borderColor: cfg.border,
                                            color: cfg.color,
                                        } : {}}
                                        onClick={() => setAlertFilter(f)}
                                    >
                                        {f === 'all' ? 'Tất cả' : LEVEL_LABEL[f]}
                                        {count > 0 && <span className="chip-count">{count}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Alert list */}
                        <div className="alert-list">
                            {filteredAlerts.map(alert => (
                                <AlertRow key={alert.date} alert={alert} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="alert-empty">
                        <span>✅</span>
                        <span>30 ngày qua không có vấn đề chấm công</span>
                    </div>
                )}
            </div>

            {summary.insufficientDays.length > 0 && (
                <div className="insufficient-section">
                    <h3>⚠️ Ngày không đủ công ({summary.insufficientDays.length} ngày)</h3>
                    <div className="insufficient-list">
                        {summary.insufficientDays.map((day: DayRecord) => (
                            <div key={day.date} className="insufficient-item">
                                <span className="insufficient-date">{formatDate(day.date)}</span>
                                <span className="insufficient-hours">
                                    {day.hoursWorked}h (thiếu {8 - day.hoursWorked}h)
                                </span>
                                {day.note && <span className="insufficient-note">{day.note}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
