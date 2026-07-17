import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AccountInfo } from '@azure/msal-browser';
import {
    Home,
    ChevronDown,
    ChevronRight,
    // Operations
    Database,
    BarChart3,
    Factory,
    Workflow,
    Zap,
    AppWindow,
    ScanSearch,
    Plug,

    // Settings
    Settings,
    Activity,
    Globe,
    HardDrive,
    Server,
    // Finance
    Receipt,
    KeyRound,
    // Security & Compliance
    Shield,
    ScrollText,
    ClipboardCheck,
    AlertTriangle,
    GitCommitHorizontal,
    LogIn,
    // Personal
    Calendar,
    FileText,
    DollarSign,
    // Demo
    FlaskConical,
    Users,
    Package,
    ShoppingCart,
    // Other
    PanelLeftClose,
    PanelLeft,
} from 'lucide-react';
import { ROUTES } from '@/routes';

interface SidebarProps {
    user: AccountInfo | null;
    isAuthenticated: boolean;
    onLogin: () => void;
    onLogout: () => void;
}

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
}

interface NavGroup {
    id: string;
    label: string;
    icon: React.ReactNode;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        id: 'operations',
        label: 'Operations',
        icon: <Activity size={16} />,
        items: [
            { path: ROUTES.MGMT_DATA, label: 'Data', icon: <Database size={16} /> },
            { path: ROUTES.MGMT_REPORTS, label: 'Reports', icon: <BarChart3 size={16} /> },
            { path: ROUTES.OPS_FABRIC, label: 'Fabric', icon: <Factory size={16} /> },
            { path: ROUTES.OPS_DATAFLOW, label: 'Dataflow', icon: <Workflow size={16} /> },
            { path: ROUTES.OPS_AUTOMATE, label: 'Automate Flow', icon: <Zap size={16} /> },
            { path: ROUTES.OPS_CANVAS_APP, label: 'Canvas App', icon: <AppWindow size={16} /> },
            { path: ROUTES.OPS_AUDIT_SETTINGS, label: 'Audit Settings', icon: <ScanSearch size={16} /> },
            { path: ROUTES.OPS_CONNECTIONS, label: 'Connections', icon: <Plug size={16} /> },
        ],
    },

    {
        id: 'settings',
        label: 'Settings',
        icon: <Settings size={16} />,
        items: [
            { path: ROUTES.MGMT_ADMIN, label: 'Admin', icon: <Settings size={16} /> },
            { path: ROUTES.OPS_HEALTH, label: 'System Health', icon: <Activity size={16} /> },
            { path: ROUTES.MGMT_ENVIRONMENT, label: 'Environment', icon: <Server size={16} /> },
            { path: ROUTES.MGMT_DOMAINS, label: 'Domains', icon: <Globe size={16} /> },
            { path: ROUTES.OPS_BACKUPS, label: 'Backups', icon: <HardDrive size={16} /> },
        ],
    },
    {
        id: 'finance',
        label: 'Finance',
        icon: <Receipt size={16} />,
        items: [
            { path: ROUTES.MGMT_BILLING, label: 'Billing', icon: <Receipt size={16} /> },
            { path: ROUTES.MGMT_LICENSE, label: 'License', icon: <KeyRound size={16} /> },
        ],
    },
    {
        id: 'security',
        label: 'Security & Compliance',
        icon: <Shield size={16} />,
        items: [
            { path: ROUTES.MGMT_SECURITY, label: 'Security', icon: <Shield size={16} /> },
            { path: ROUTES.MGMT_LOG, label: 'Audit Log', icon: <ScrollText size={16} /> },
            { path: ROUTES.OPS_CHANGELOG, label: 'Change Log', icon: <GitCommitHorizontal size={16} /> },
            { path: ROUTES.MGMT_SIGNIN_LOG, label: 'Sign-in Log', icon: <LogIn size={16} /> },
            { path: ROUTES.OPS_INCIDENTS, label: 'Incidents', icon: <AlertTriangle size={16} /> },
            { path: ROUTES.MGMT_COMPLIANCE, label: 'Compliance', icon: <ClipboardCheck size={16} /> },
        ],
    },
    {
        id: 'personal',
        label: 'Personal',
        icon: <Calendar size={16} />,
        items: [
            { path: ROUTES.PERSONAL_TIMESHEET, label: 'Timesheet', icon: <Calendar size={16} /> },
            { path: ROUTES.PERSONAL_REGISTRATION, label: 'Registration', icon: <FileText size={16} /> },
            { path: ROUTES.PERSONAL_PAYMENT, label: 'Payment Request', icon: <DollarSign size={16} /> },
        ],
    },
    {
        id: 'demo',
        label: 'Demo',
        icon: <FlaskConical size={16} />,
        items: [
            { path: ROUTES.DEMO_CUSTOMER, label: 'Customer', icon: <Users size={16} /> },
            { path: ROUTES.DEMO_PRODUCT, label: 'Product', icon: <Package size={16} /> },
            { path: ROUTES.DEMO_SALE_ORDER, label: 'Sale Order', icon: <ShoppingCart size={16} /> },
        ],
    },
];

const SIDEBAR_COLLAPSED_KEY = 'workhub_sidebar_collapsed';
const SIDEBAR_BREAKPOINT = 1280;

export const Sidebar: React.FC<SidebarProps> = ({
    isAuthenticated,
    onLogin,
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [collapsed, setCollapsed] = useState(() => {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        if (saved !== null) return saved === 'true';
        return window.innerWidth < SIDEBAR_BREAKPOINT;
    });

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < SIDEBAR_BREAKPOINT) setCollapsed(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleCollapse = () => setCollapsed(true);
        window.addEventListener('workhub:collapse-sidebar', handleCollapse);
        return () => window.removeEventListener('workhub:collapse-sidebar', handleCollapse);
    }, []);

    useEffect(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    }, [collapsed]);

    // Derive từ navGroups để group mới thêm không bị thiếu key (toggleGroup rebuild từ Object.keys)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(navGroups.map(g => [g.id, g.id === 'operations']))
    );

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            // Accordion: if already open, close it; otherwise open only this one
            if (prev[groupId]) return { ...Object.fromEntries(Object.keys(prev).map(k => [k, false])) };
            return Object.fromEntries(Object.keys(prev).map(k => [k, k === groupId]));
        });
    };

    const isActive = (path: string) => location.pathname === path;

    const isGroupActive = (group: NavGroup) => {
        if (group.items) {
            return group.items.some(item => isActive(item.path));
        }
        return false;
    };

    const renderNavItem = (item: NavItem, indent = false) => (
        <button
            key={item.path}
            className={`nav-item ${indent ? 'sub' : ''} ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={collapsed ? item.label : undefined}
        >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
        </button>
    );

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                {!collapsed && <span className="sidebar-logo">WorkHub</span>}
                <button
                    className="sidebar-collapse-btn"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>

            <nav className="sidebar-nav">
                {/* Dashboard — flat item */}
                <button
                    className={`nav-item ${isActive(ROUTES.DASHBOARD) ? 'active' : ''}`}
                    onClick={() => navigate(ROUTES.DASHBOARD)}
                    title={collapsed ? 'Dashboard' : undefined}
                >
                    <Home size={16} className="nav-icon" />
                    {!collapsed && <span>Dashboard</span>}
                </button>

                {/* Groups */}
                {navGroups.map((group) => (
                    <div key={group.id} className="nav-group">
                        <button
                            className={`nav-group-header ${isGroupActive(group) ? 'active' : ''}`}
                            onClick={() => collapsed ? undefined : toggleGroup(group.id)}
                        >
                            {collapsed ? (
                                group.icon
                            ) : (
                                <>
                                    <span className="nav-group-label">
                                        {group.icon}
                                        <span>{group.label}</span>
                                    </span>
                                    {expandedGroups[group.id]
                                        ? <ChevronDown size={14} />
                                        : <ChevronRight size={14} />
                                    }
                                </>
                            )}
                        </button>

                        {!collapsed && expandedGroups[group.id] && (
                            <div className="nav-group-items">
                                {group.items?.map((item) => renderNavItem(item, true))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                {!collapsed && <span className="sidebar-copyright">©2026 HieuLe</span>}
                {!isAuthenticated && (
                    <button className="sidebar-login-btn" onClick={onLogin} title="Đăng nhập">
                        <LogIn size={16} />
                    </button>
                )}
            </div>
        </aside>
    );
};
