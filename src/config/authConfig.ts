// MSAL Configuration for Admin_WECARE (single tenant)
// Supports multiple API scopes: Dataverse, Azure Management, MS Graph, Power BI

export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_CLIENT_ID || "",
        authority: import.meta.env.VITE_AUTHORITY || "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/+$/, ''),
        // Không cho MSAL navigate thêm 1 lần về URL gốc sau khi auth xong.
        // Mỗi lần đổi domain là 1 cơ hội để browser nhảy profile và mở tab mới.
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: "localStorage" as const,
        // Giữ auth state trong cookie để sống sót qua chặng redirect,
        // không phụ thuộc hoàn toàn vào storage.
        storeAuthStateInCookie: true,
    },
};

// ── API Configurations ──

export const dataverseConfig = {
    baseUrl: import.meta.env.VITE_DATAVERSE_URL || "https://wecare-ii.crm5.dynamics.com/api/data/v9.2",
    orgUrl: import.meta.env.VITE_DATAVERSE_ORG_URL || "https://wecare-ii.crm5.dynamics.com",
    scopes: [import.meta.env.VITE_DATAVERSE_SCOPE || "https://wecare-ii.crm5.dynamics.com/.default"],
};

export const graphConfig = {
    baseUrl: "https://graph.microsoft.com/v1.0",
    scopes: ["https://graph.microsoft.com/.default"],
};

export const powerBIConfig = {
    baseUrl: "https://api.powerbi.com/v1.0/myorg",
    scopes: ["https://analysis.windows.net/powerbi/api/.default"],
};

export const powerAppsConfig = {
    baseUrl: "https://api.powerapps.com",
    scopes: ["https://service.powerapps.com/User"],
};

export const powerAutomateConfig = {
    baseUrl: "https://api.flow.microsoft.com",
    scopes: ["https://service.flow.microsoft.com/Flows.Read.All"],
};

export const powerPlatformAdminConfig = {
    baseUrl: "https://api.bap.microsoft.com",
    scopes: ["https://service.powerapps.com/User"],
};

// ── Sensitive IDs (from env vars) ──

export const PP_ENV_ID = import.meta.env.VITE_PP_ENV_ID || "de210e4b-cd22-e605-91ca-8e841aad4b8e";
export const TENANT_ID = import.meta.env.VITE_TENANT_ID || "";

