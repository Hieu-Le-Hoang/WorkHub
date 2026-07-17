/**
 * Route configuration for WorkHub
 * Organized by sidebar groups: Operations, Dev Tools, Settings, Finance, Security, Personal, Demo
 */

/** Route path constants — single source of truth */
export const ROUTES = {
    DASHBOARD: '/',

    // ── Operations ──
    MGMT_DATA: '/operations/data',
    MGMT_REPORTS: '/operations/reports',
    OPS_FABRIC: '/operations/fabric',
    OPS_DATAFLOW: '/operations/dataflow',
    OPS_AUTOMATE: '/operations/automate',
    OPS_CANVAS_APP: '/operations/canvas-app',
    OPS_AUDIT_SETTINGS: '/operations/audit-settings',
    OPS_CONNECTIONS: '/operations/connections',



    // ── Settings (was System) ──
    MGMT_ADMIN: '/settings/admin',
    OPS_HEALTH: '/settings/health',
    MGMT_ENVIRONMENT: '/settings/environment',
    MGMT_DOMAINS: '/settings/domains',
    OPS_BACKUPS: '/settings/backups',

    // ── Finance ──
    MGMT_BILLING: '/finance/billing',
    MGMT_LICENSE: '/finance/license',

    // ── Security & Compliance ──
    MGMT_SECURITY: '/security/security',
    MGMT_LOG: '/security/audit-log',
    OPS_CHANGELOG: '/security/changelog',
    MGMT_SIGNIN_LOG: '/security/signin-log',
    OPS_INCIDENTS: '/security/incidents',
    MGMT_COMPLIANCE: '/security/compliance',

    // ── Personal ──
    PERSONAL_TIMESHEET: '/personal/timesheet',
    PERSONAL_REGISTRATION: '/personal/registration',
    PERSONAL_PAYMENT: '/personal/payment',

    // ── Demo ──
    DEMO_CUSTOMER: '/demo/customer',
    DEMO_PRODUCT: '/demo/product',
    DEMO_SALE_ORDER: '/demo/sale-order',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** Route metadata for header config */
export const ROUTE_META: Record<string, { title: string; showDateNav: boolean }> = {
    [ROUTES.DASHBOARD]: { title: 'Dashboard', showDateNav: false },

    // Operations
    [ROUTES.MGMT_DATA]: { title: 'Data', showDateNav: false },
    [ROUTES.MGMT_REPORTS]: { title: 'Reports', showDateNav: false },
    [ROUTES.OPS_FABRIC]: { title: 'Fabric', showDateNav: false },
    [ROUTES.OPS_DATAFLOW]: { title: 'Dataflow', showDateNav: false },
    [ROUTES.OPS_AUTOMATE]: { title: 'Automate Flow', showDateNav: false },
    [ROUTES.OPS_CANVAS_APP]: { title: 'Canvas App', showDateNav: false },
    [ROUTES.OPS_AUDIT_SETTINGS]: { title: 'Audit Settings', showDateNav: false },
    [ROUTES.OPS_CONNECTIONS]: { title: 'Connections', showDateNav: false },



    // Settings
    [ROUTES.MGMT_ADMIN]: { title: 'Admin', showDateNav: false },
    [ROUTES.OPS_HEALTH]: { title: 'System Health', showDateNav: false },
    [ROUTES.MGMT_ENVIRONMENT]: { title: 'Environment', showDateNav: false },
    [ROUTES.MGMT_DOMAINS]: { title: 'Domains', showDateNav: false },
    [ROUTES.OPS_BACKUPS]: { title: 'Backups', showDateNav: false },

    // Finance
    [ROUTES.MGMT_BILLING]: { title: 'Billing', showDateNav: false },
    [ROUTES.MGMT_LICENSE]: { title: 'License', showDateNav: false },

    // Security & Compliance
    [ROUTES.MGMT_SECURITY]: { title: 'Security', showDateNav: false },
    [ROUTES.MGMT_LOG]: { title: 'Audit Log', showDateNav: false },
    [ROUTES.OPS_CHANGELOG]: { title: 'Change Log', showDateNav: false },
    [ROUTES.MGMT_SIGNIN_LOG]: { title: 'Sign-in Log', showDateNav: false },
    [ROUTES.OPS_INCIDENTS]: { title: 'Incidents', showDateNav: false },
    [ROUTES.MGMT_COMPLIANCE]: { title: 'Compliance', showDateNav: false },

    // Personal
    [ROUTES.PERSONAL_TIMESHEET]: { title: 'Timesheet', showDateNav: true },
    [ROUTES.PERSONAL_REGISTRATION]: { title: 'Registration', showDateNav: true },
    [ROUTES.PERSONAL_PAYMENT]: { title: 'Payment Request', showDateNav: true },

    // Demo
    [ROUTES.DEMO_CUSTOMER]: { title: 'Customer', showDateNav: false },
    [ROUTES.DEMO_PRODUCT]: { title: 'Product', showDateNav: false },
    [ROUTES.DEMO_SALE_ORDER]: { title: 'Sale Order', showDateNav: false },
};

/** Management sub-view type (used by ManagementView) */
export type ManagementSubView = 'admin' | 'billing' | 'log' | 'data' | 'reports' | 'domains' | 'license' | 'security' | 'compliance';

/** Map route path → management sub-view */
export const ROUTE_TO_MGMT_SUBVIEW: Partial<Record<string, ManagementSubView>> = {
    [ROUTES.MGMT_ADMIN]: 'admin',
    [ROUTES.MGMT_BILLING]: 'billing',
    [ROUTES.MGMT_LOG]: 'log',
    [ROUTES.MGMT_DATA]: 'data',
    [ROUTES.MGMT_REPORTS]: 'reports',

    [ROUTES.MGMT_DOMAINS]: 'domains',
    [ROUTES.MGMT_LICENSE]: 'license',
    [ROUTES.MGMT_SECURITY]: 'security',
    [ROUTES.MGMT_COMPLIANCE]: 'compliance',
};
