import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { Calendar } from '@/components/Calendar';
import { DayDetail } from '@/components/DayDetail';
import { WorkSummary } from '@/components/WorkSummary';
import { ManagementView } from '@/components/ManagementView';
import { PlaceholderPage } from '@/components/PlaceholderPage';
import { BillingPage } from '@/components/BillingPage';
import { LicensePage } from '@/components/LicensePage';
import { ReportsPage } from '@/components/ReportsPage';
import { SystemHealthPage } from '@/components/SystemHealthPage';
import { LogsPage } from '@/components/LogsPage';
import { SecurityPage } from '@/components/SecurityPage';
import { DomainsPage } from '@/components/DomainsPage';

import { DataPage } from '@/components/DataPage';
import { BackupsPage } from '@/components/BackupsPage';
import { DataflowPage } from '@/components/DataflowPage';
import { FabricPage } from '@/components/FabricPage';
import { AutomateFlowPage } from '@/components/AutomateFlowPage';
import { CanvasAppPage } from '@/components/CanvasAppPage';
import { AuditSettingsPage } from '@/components/AuditSettingsPage';
import { ConnectionsPage } from '@/components/ConnectionsPage';
import { EnvironmentPage } from '@/components/EnvironmentPage';

import { ROUTE_META, ROUTE_TO_MGMT_SUBVIEW, ROUTES } from '@/routes';

// Lazy load heavy components
const LeaveDashboard = lazy(() => import('@/components/LeaveDashboard').then(m => ({ default: m.LeaveDashboard })));

import { DayRecord, MonthSummary } from '@/types/types';
import { calculateMonthSummary } from '@/utils/workUtils';
import { fetchChamCongData, getAccessToken, fetchEmployeeIdFromSystemUser, fetchEmployeeName } from '@/services/dataverse';
import { dataverseConfig } from '@/config/authConfig';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@/index.css';

import { Github } from 'lucide-react';

const LoadingSpinner = () => (
    <div className="loading-state">
        <div className="spinner"></div>
        <p>Đang tải...</p>
    </div>
);

// ── Placeholder page configs ──

const IncidentsPage = () => (
    <PlaceholderPage title="Incidents" description="Log & track sự cố hệ thống." />
);

const ChangeLogPage = () => (
    <PlaceholderPage
        title="Change Log"
        description="Theo dõi deployments — ai deploy gì, khi nào. 🚧 Đang phát triển — sẽ tích hợp GitHub API."
        links={[
            { icon: <Github size={18} />, title: 'GitHub Releases', url: 'https://github.com/orgs/WCG-HieuLe/repositories', description: 'Organization releases' },
        ]}
    />
);

const SignInLogPage = () => (
    <PlaceholderPage title="Sign-in Log" description="Azure AD sign-in logs — theo dõi ai đăng nhập, từ đâu, khi nào. 🚧 Đang phát triển." />
);



function App() {
    const { instance, accounts, inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const location = useLocation();

    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [records, setRecords] = useState<DayRecord[]>([]);
    // allRecords = current month + previous month — dùng cho 30-day rolling alert
    const [allRecords, setAllRecords] = useState<DayRecord[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [summary, setSummary] = useState<MonthSummary>({
        standardDays: 0,
        actualDays: 0,
        insufficientDays: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [employeeName, setEmployeeName] = useState<string | null>(null);

    const handleLogin = useCallback(async () => {
        try {
            await instance.loginRedirect({
                scopes: dataverseConfig.scopes,
            });
        } catch (e) {
            console.error('Login error:', e);
            setError('Đăng nhập thất bại. Vui lòng thử lại.');
        }
    }, [instance]);

    const handleLogout = useCallback(() => {
        instance.logoutRedirect({
            postLogoutRedirectUri: window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/+$/, ''),
        });
        setEmployeeId(null);
    }, [instance]);

    // Auto-login: redirect to Azure AD if not authenticated
    useEffect(() => {
        if (!isAuthenticated && inProgress === InteractionStatus.None) {
            handleLogin();
        }
    }, [isAuthenticated, inProgress, handleLogin]);

    useEffect(() => {
        const fetchEmployeeId = async () => {
            if (isAuthenticated && accounts.length > 0 && !employeeId) {
                try {
                    const azureAdObjectId = accounts[0].localAccountId;
                    const token = await getAccessToken(instance, accounts[0]);
                    const id = await fetchEmployeeIdFromSystemUser(token, azureAdObjectId);
                    if (id) {
                        setEmployeeId(id);
                        // Also fetch Vietnamese name for approver matching
                        const name = await fetchEmployeeName(token, id);
                        if (name) setEmployeeName(name);
                    } else {
                        setError('Không tìm thấy thông tin nhân viên trong Dataverse.');
                    }
                } catch (e) {
                    console.error('Error fetching employee ID:', e);
                }
            }
        };

        if (inProgress === InteractionStatus.None) {
            fetchEmployeeId();
        }
    }, [isAuthenticated, accounts, instance, inProgress, employeeId]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (isAuthenticated && accounts.length > 0 && employeeId) {
                const token = await getAccessToken(instance, accounts[0]);

                // Tháng hiện tại
                const currentData = fetchChamCongData(token, year, month, employeeId);

                // Tháng trước — để đảm bảo 30-day rolling có đủ dữ liệu
                const prevDate = new Date(year, month - 1, 1);
                const prevData = fetchChamCongData(token, prevDate.getFullYear(), prevDate.getMonth(), employeeId);

                const [data, prevMonthData] = await Promise.all([currentData, prevData]);

                setRecords(data);
                // Gộp 2 tháng cho rolling alert, dedup theo date
                const merged = new Map<string, DayRecord>();
                [...prevMonthData, ...data].forEach(r => merged.set(r.date, r));
                setAllRecords(Array.from(merged.values()));
            } else {
                setRecords([]);
                setAllRecords([]);
                if (!isAuthenticated) {
                    setError('Vui lòng đăng nhập để xem dữ liệu chấm công.');
                }
            }
        } catch (e) {
            console.error('Error loading data:', e);
            setError('Không thể tải dữ liệu từ Dataverse.');
            setRecords([]);
            setAllRecords([]);
        } finally {
            setLoading(false);
        }

        setSelectedDate(null);
    }, [year, month, isAuthenticated, accounts, instance, employeeId]);

    useEffect(() => {
        if (inProgress === InteractionStatus.None) {
            loadData();
        }
    }, [loadData, inProgress]);

    useEffect(() => {
        const newSummary = calculateMonthSummary(records, year, month);
        setSummary(newSummary);
    }, [records, year, month]);

    const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
        setYear(newYear);
        setMonth(newMonth);
    }, []);

    const handleSelectDate = useCallback((date: string) => {
        setSelectedDate(prev => date === prev ? null : date);
    }, []);

    const selectedRecord = useMemo(() => {
        if (!selectedDate) return null;
        return records.find(r => r.date === selectedDate) || ({
            date: selectedDate,
            hoursWorked: 0,
            status: 'normal',
            workValue: 0,
        } as DayRecord);
    }, [records, selectedDate]);

    // Derive header config from current route
    const headerConfig = useMemo(() => {
        const meta = ROUTE_META[location.pathname];
        return meta || { title: 'WorkHub', showDateNav: false };
    }, [location.pathname]);

    // Get user display name from MSAL account
    const userName = accounts[0]?.name || 'User';

    // Timesheet page content
    const TimesheetPage = () => (
        <>
            {error && (
                <div className="error-banner">⚠️ {error}</div>
            )}
            {inProgress !== InteractionStatus.None && <LoadingSpinner />}
            {!isAuthenticated && inProgress === InteractionStatus.None && (
                <div className="empty-state">
                    <h2>Đang chuyển hướng đăng nhập...</h2>
                    <p>Bạn sẽ được chuyển đến Azure AD.</p>
                </div>
            )}
            {isAuthenticated && !loading && (
                <div className="content-grid">
                    <div className="calendar-section">
                        <Calendar
                            year={year}
                            month={month}
                            records={records}
                            selectedDate={selectedDate}
                            onSelectDate={handleSelectDate}
                        />
                    </div>
                    <div className="summary-section">
                        <WorkSummary
                            summary={summary}
                            year={year}
                            month={month}
                            records={allRecords}
                        />
                    </div>
                </div>
            )}
            {loading && isAuthenticated && <LoadingSpinner />}
        </>
    );

    // Management page — derives sub-view from current route
    const ManagementPage = () => {
        const subView = ROUTE_TO_MGMT_SUBVIEW[location.pathname];
        return <ManagementView activeSubView={subView} />;
    };

    // Leave page — derives mode from route
    const LeavePage = ({ mode }: { mode: 'registration' | 'dntt' }) => (
        <Suspense fallback={<LoadingSpinner />}>
            <LeaveDashboard
                employeeId={employeeId}
                employeeName={employeeName}
                year={year}
                month={month}
                mode={mode}
            />
        </Suspense>
    );

    return (
        <ErrorBoundary>
            <div className="app">
                <Sidebar
                    user={accounts[0] || null}
                    isAuthenticated={isAuthenticated}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                />

                <div className="main-layout">
                    <Header
                        year={year}
                        month={month}
                        onMonthChange={handleMonthChange}
                        title={headerConfig.title}
                        showDateNav={headerConfig.showDateNav}
                    />

                    <main className="main-content">
                        <Routes>
                            <Route path={ROUTES.DASHBOARD} element={<Dashboard userName={userName} />} />

                            {/* Personal */}
                            <Route path={ROUTES.PERSONAL_TIMESHEET} element={<TimesheetPage />} />
                            <Route path={ROUTES.PERSONAL_REGISTRATION} element={<LeavePage mode="registration" />} />
                            <Route path={ROUTES.PERSONAL_PAYMENT} element={<LeavePage mode="dntt" />} />

                            {/* Operations */}
                            <Route path={ROUTES.MGMT_DATA} element={<DataPage />} />
                            <Route path={ROUTES.MGMT_REPORTS} element={<ReportsPage />} />
                            <Route path={ROUTES.OPS_FABRIC} element={<FabricPage />} />
                            <Route path={ROUTES.OPS_DATAFLOW} element={<DataflowPage />} />
                            <Route path={ROUTES.OPS_AUTOMATE} element={<AutomateFlowPage />} />
                            <Route path={ROUTES.OPS_CANVAS_APP} element={<CanvasAppPage />} />
                            <Route path={ROUTES.OPS_AUDIT_SETTINGS} element={<AuditSettingsPage />} />
                            <Route path={ROUTES.OPS_CONNECTIONS} element={<ConnectionsPage />} />



                            {/* Settings */}
                            <Route path={ROUTES.MGMT_ADMIN} element={<ManagementPage />} />
                            <Route path={ROUTES.OPS_HEALTH} element={<SystemHealthPage />} />
                            <Route path={ROUTES.MGMT_ENVIRONMENT} element={<EnvironmentPage />} />
                            <Route path={ROUTES.MGMT_DOMAINS} element={<DomainsPage />} />
                            <Route path={ROUTES.OPS_BACKUPS} element={<BackupsPage />} />

                            {/* Finance */}
                            <Route path={ROUTES.MGMT_BILLING} element={<BillingPage />} />
                            <Route path={ROUTES.MGMT_LICENSE} element={<LicensePage />} />

                            {/* Security & Compliance */}
                            <Route path={ROUTES.MGMT_SECURITY} element={<SecurityPage />} />
                            <Route path={ROUTES.MGMT_LOG} element={<LogsPage />} />
                            <Route path={ROUTES.OPS_CHANGELOG} element={<ChangeLogPage />} />
                            <Route path={ROUTES.MGMT_SIGNIN_LOG} element={<SignInLogPage />} />
                            <Route path={ROUTES.OPS_INCIDENTS} element={<IncidentsPage />} />
                            <Route path={ROUTES.MGMT_COMPLIANCE} element={<ManagementPage />} />

                            {/* Fallback */}
                            <Route path="*" element={<Dashboard userName={userName} />} />
                        </Routes>
                    </main>
                </div>

                {selectedRecord && (
                    <DayDetail
                        record={selectedRecord}
                        onClose={() => setSelectedDate(null)}
                        employeeId={employeeId}
                        onSaveSuccess={loadData}
                    />
                )}

                <Toaster
                    theme="dark"
                    position="bottom-right"
                    toastOptions={{
                        style: {
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                        },
                    }}
                />
            </div>
        </ErrorBoundary>
    );
}

export default App;
