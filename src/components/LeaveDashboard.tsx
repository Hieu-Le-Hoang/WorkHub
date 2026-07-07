import React, { useEffect, useState, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { toast } from 'sonner';
import { fetchPersonalRegistrations, fetchDNTTRecords, fetchEmployeeCode, fetchSubjectId, getAccessToken, TeamRegistration, DNTTRecord, getApprovalStatusText, updateDNTTStatus, fetchApproverRegistrations } from '@/services/dataverse';
import { LeaveDetailModal } from '@/components/LeaveDetailModal';
import { formatDateVN } from '@/lib/dateUtils';

interface LeaveDashboardProps {
    employeeId: string | null;
    employeeName: string | null;
    year: number;
    month: number;
    mode: 'registration' | 'dntt';
}

export const LeaveDashboard: React.FC<LeaveDashboardProps> = ({ employeeId, employeeName, year, month, mode }) => {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();

    const [loading, setLoading] = useState(false);
    const [registrations, setRegistrations] = useState<TeamRegistration[]>([]);
    const [dnttRecords, setDnttRecords] = useState<DNTTRecord[]>([]);
    const [regFilter, setRegFilter] = useState<'pending' | 'all'>('pending');

    // Cache subjectId to avoid re-fetching
    const [subjectId, setSubjectId] = useState<string | null>(null);

    // Load data with month/year filter
    const loadData = useCallback(async () => {
        if (!isAuthenticated || !accounts[0] || !employeeId) return;

        setLoading(true);
        try {
            const token = await getAccessToken(instance, accounts[0]);

            if (mode === 'registration') {
                // Fetch BOTH: team registrations (approver) + personal registrations
                const promises: Promise<TeamRegistration[]>[] = [];

                // 1. Personal registrations (user's own)
                promises.push(fetchPersonalRegistrations(token, employeeId, year, month));

                // 2. Team registrations (user is the approver) — only if we have employee name
                if (employeeName) {
                    promises.push(fetchApproverRegistrations(token, employeeName, year, month));
                }

                const results = await Promise.all(promises);

                // Merge and deduplicate by registration ID
                const allRegs = results.flat();
                const uniqueMap = new Map<string, TeamRegistration>();
                allRegs.forEach(reg => uniqueMap.set(reg.crdfd_phieuangkyid, reg));
                const merged = Array.from(uniqueMap.values());

                // Sort by date descending
                merged.sort((a, b) => new Date(b.crdfd_tungay).getTime() - new Date(a.crdfd_tungay).getTime());

                setRegistrations(merged);
                setDnttRecords([]);
            } else {
                // DNTT mode — fetch DNTT records
                let currentSubjectId = subjectId;

                if (!currentSubjectId) {
                    const code = await fetchEmployeeCode(token, employeeId);
                    if (code) {
                        const sid = await fetchSubjectId(token, code);
                        if (sid) {
                            setSubjectId(sid);
                            currentSubjectId = sid;
                        }
                    }
                }

                if (currentSubjectId) {
                    const dnttData = await fetchDNTTRecords(token, currentSubjectId, year, month);
                    setDnttRecords(dnttData);
                }
                setRegistrations([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, accounts, instance, employeeId, employeeName, year, month, subjectId, mode]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // formatDate → dùng formatDateVN từ @/lib/dateUtils (đã convert UTC → UTC+7)
    const formatDate = formatDateVN;

    const formatCurrency = (amount?: number) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getRegistrationTypeName = (type: number): string => {
        switch (type) {
            case 191920000: return "Nghỉ phép";
            case 191920001: return "Làm việc tại nhà (WFH)";
            case 191920002: return "Tăng ca";
            case 191920003: return "Công tác";
            case 191920004: return "Đi trễ / Về sớm";
            case 283640001: return "Nghỉ không lương";
            default: return "Khác";
        }
    };

    const getStatusClass = (status?: number): string => {
        switch (status) {
            case 191920000: return "status-pending";
            case 191920001: return "status-approved";
            case 191920002: return "status-rejected";
            default: return "status-pending";
        }
    };

    // Modal State
    const [selectedItem, setSelectedItem] = useState<TeamRegistration | DNTTRecord | null>(null);
    const [selectedType, setSelectedType] = useState<'registration' | 'dntt' | null>(null);

    const closeModal = () => {
        setSelectedItem(null);
        setSelectedType(null);
    };

    const handleRowClick = (item: TeamRegistration | DNTTRecord, type: 'registration' | 'dntt') => {
        setSelectedItem(item);
        setSelectedType(type);
    };

    // Handle DNTT field update
    const [updating, setUpdating] = useState(false);
    const handleDNTTFieldChange = async (fieldName: string, value: number | null) => {
        if (!selectedItem || !accounts[0]) return;
        const dnttRecord = selectedItem as DNTTRecord;
        setUpdating(true);
        try {
            const token = await getAccessToken(instance, accounts[0]);
            const success = await updateDNTTStatus(token, dnttRecord.cr44a_enghithanhtoanid, fieldName, value);
            if (success) {
                await loadData();
                closeModal();
            } else {
                toast.error('Cập nhật thất bại!');
            }
        } catch (e) {
            console.error('Error updating DNTT:', e);
            toast.error('Đã xảy ra lỗi!');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="leave-dashboard list-view-container">
            {/* Header with count + external link */}
            <div className="list-view-header">
                <div className="list-view-toolbar">
                    {mode === 'registration' ? (
                        <div className="sub-tabs">
                            <button
                                className={`sub-tab ${regFilter === 'pending' ? 'active' : ''}`}
                                onClick={() => setRegFilter('pending')}
                            >
                                Chưa duyệt ({registrations.filter(r => r.crdfd_captrenduyet === 191920000).length})
                            </button>
                            <button
                                className={`sub-tab ${regFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setRegFilter('all')}
                            >
                                Tất cả ({registrations.length})
                            </button>
                        </div>
                    ) : (
                        <span className="billing-stat-label">
                            💰 Đề nghị thanh toán ({dnttRecords.length})
                        </span>
                    )}
                </div>

                <div className="list-view-actions">


                </div>
            </div>

            {!employeeId && (
                <div className="list-view-empty-state">
                    <p>Vui lòng đăng nhập để xem phiếu đăng ký.</p>
                </div>
            )}

            {loading ? (
                <div className="list-view-empty-state">
                    <div className="spinner"></div>
                    <p>Đang tải dữ liệu...</p>
                </div>
            ) : (
                <div className="list-view-table-wrapper">
                    {/* Registration */}
                    {mode === 'registration' && (() => {
                        const filtered = regFilter === 'pending'
                            ? registrations.filter(r => r.crdfd_captrenduyet === 191920000)
                            : registrations;
                        return (
                        <>
                            {filtered.length === 0 ? (
                                <div className="list-view-empty-state">
                                    <p>{regFilter === 'pending' ? 'Không có phiếu chờ duyệt.' : 'Không có phiếu đăng ký nào trong tháng này.'}</p>
                                </div>
                            ) : (
                                <table className="list-view-table">
                                    <thead>
                                        <tr>
                                            <th>Nhân viên</th>
                                            <th>Loại</th>
                                            <th>Từ ngày</th>
                                            <th>Đến ngày</th>
                                            <th className="text-right">Số ngày</th>
                                            <th>Lý do</th>
                                            <th>Trạng thái</th>
                                            <th style={{ width: '2.5rem' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((reg) => (
                                            <tr key={reg.crdfd_phieuangkyid} onClick={() => handleRowClick(reg, 'registration')}>
                                                <td className="font-medium">{reg.employeeName}</td>
                                                <td>{getRegistrationTypeName(reg.crdfd_loaiangky)}</td>
                                                <td>{formatDate(reg.crdfd_tungay)}</td>
                                                <td>{formatDate(reg.crdfd_enngay)}</td>
                                                <td className="text-right">{reg.cr1bb_songay ?? '-'}</td>
                                                <td className="note-cell">{reg.crdfd_diengiai || '-'}</td>
                                                <td>
                                                    <span className={`status-badge ${getStatusClass(reg.crdfd_captrenduyet)}`}>
                                                        {getApprovalStatusText(reg.crdfd_captrenduyet)}
                                                    </span>
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <a
                                                        href={`https://wecare-ii.crm5.dynamics.com/main.aspx?appid=7c0ada0d-cf0d-f011-998a-6045bd1cb61e&pagetype=entityrecord&etn=crdfd_phieuangky&id=${reg.crdfd_phieuangkyid}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="external-link-icon"
                                                        title="Mở record trong Dynamics 365"
                                                    >
                                                        🔗
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                        );
                    })()}

                    {/* DNTT */}
                    {mode === 'dntt' && (
                        <>
                            {dnttRecords.length === 0 ? (
                                <div className="list-view-empty-state">
                                    <p>Chưa có đề nghị thanh toán nào trong tháng này.</p>
                                </div>
                            ) : (
                                <table className="list-view-table">
                                    <thead>
                                        <tr>
                                            <th>Loại hồ sơ</th>
                                            <th className="text-right">Số tiền</th>
                                            <th>Diễn giải</th>
                                            <th>Ngày tạo</th>
                                            <th>Trạng thái</th>
                                            <th>Người tạo</th>
                                            <th style={{ width: '2.5rem' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dnttRecords.map((dntt) => (
                                            <tr key={dntt.cr44a_enghithanhtoanid} onClick={() => handleRowClick(dntt, 'dntt')}>
                                                <td>
                                                    <span className="badge-reg-type">{dntt.cr1bb_loaihosothanhtoan || '-'}</span>
                                                </td>
                                                <td className="amount-cell text-right">
                                                    {formatCurrency(dntt.cr44a_sotien_de_nghi)}
                                                </td>
                                                <td>{dntt.cr1bb_diengiai || '-'}</td>
                                                <td>
                                                    {formatDate(dntt.createdon)}
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${dntt.cr44a_trangthai_denghithanhtoan === 'Đã duyệt' ? 'status-approved' :
                                                        dntt.cr44a_trangthai_denghithanhtoan === 'Từ chối duyệt' ? 'status-rejected' : 'status-pending'}`}>
                                                        {dntt.cr44a_trangthai_denghithanhtoan || 'N/A'}
                                                    </span>
                                                </td>
                                                <td>{dntt.ownerName || '-'}</td>
                                                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <a
                                                        href={`https://wecare-ii.crm5.dynamics.com/main.aspx?appid=d6bc8d55-f810-f011-998a-6045bd1bb1cd&pagetype=entityrecord&etn=cr44a_enghithanhtoan&id=${dntt.cr44a_enghithanhtoanid}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="external-link-icon"
                                                        title="Mở record trong Dynamics 365"
                                                    >
                                                        🔗
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedItem && (
                selectedType === 'registration' ? (
                    <LeaveDetailModal
                        registration={selectedItem as TeamRegistration}
                        onClose={closeModal}
                        onUpdateSuccess={(updatedItem) => {
                            setRegistrations(prev => prev.map(item =>
                                item.crdfd_phieuangkyid === updatedItem.crdfd_phieuangkyid ? updatedItem : item
                            ));
                            loadData();
                            closeModal();
                        }}
                    />
                ) : (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Chi tiết đề nghị thanh toán</h3>
                                <button className="close-modal-btn" onClick={closeModal}>&times;</button>
                            </div>
                            <div className="modal-body">
                                <div className="detail-field">
                                    <label className="detail-label">Loại hồ sơ</label>
                                    <div className="detail-value highlight">
                                        {(selectedItem as DNTTRecord).cr1bb_loaihosothanhtoan || '-'}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="detail-field">
                                        <label className="detail-label">Số tiền đề nghị</label>
                                        <div className="detail-value highlight" style={{ color: 'var(--success)' }}>
                                            {formatCurrency((selectedItem as DNTTRecord).cr44a_sotien_de_nghi)}
                                        </div>
                                    </div>
                                    <div className="detail-field">
                                        <label className="detail-label">Người đề nghị</label>
                                        <div className="detail-value">{(selectedItem as DNTTRecord).ownerName || '-'}</div>
                                    </div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Diễn giải</label>
                                    <div className="detail-value">{(selectedItem as DNTTRecord).cr1bb_diengiai || '-'}</div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Ngày tạo</label>
                                    <div className="detail-value">{formatDate((selectedItem as DNTTRecord).createdon)}</div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Trạng thái đề nghị</label>
                                    <div className="detail-value">
                                        <span className={`status-badge ${(selectedItem as DNTTRecord).cr44a_trangthai_denghithanhtoan === 'Đã duyệt' ? 'status-approved' :
                                            (selectedItem as DNTTRecord).cr44a_trangthai_denghithanhtoan === 'Từ chối duyệt' ? 'status-rejected' : 'status-pending'}`}>
                                            {(selectedItem as DNTTRecord).cr44a_trangthai_denghithanhtoan || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Trưởng bộ phận</label>
                                    <div className="detail-value">
                                        <select
                                            className="status-select"
                                            aria-label="Trưởng bộ phận duyệt"
                                            value={(selectedItem as DNTTRecord).cr44a_truongbophan_value ?? ''}
                                            onChange={(e) => handleDNTTFieldChange('cr44a_truongbophan', e.target.value ? parseInt(e.target.value) : null)}
                                            disabled={updating}
                                        >
                                            <option value="">-- Chọn --</option>
                                            <option value="283640001">Chưa duyệt</option>
                                            <option value="283640000">Đã duyệt</option>
                                            <option value="283640002">Từ chối duyệt</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="detail-field">
                                    <label className="detail-label">Kế toán tổng hợp</label>
                                    <div className="detail-value">
                                        {(selectedItem as DNTTRecord).cr44a_ketoantonghop || '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};
