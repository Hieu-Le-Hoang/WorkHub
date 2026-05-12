/**
 * Dataverse Audit Log Service
 * Query audits entity + ai_tables for filtering
 * Auth: MSAL token (dataverseConfig.scopes)
 */

import { dataverseConfig } from '@/config/authConfig';

// ── Types ──

export interface DvAuditLog {
    id: string;
    timestamp: Date;
    tableName: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    recordId: string;
    user: { id: string; name: string };
    changes?: string;
}

export interface AuditFilterCriteria {
    tableName: string;
    action: 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE';
    startDate: string;
    endDate: string;
    recordId: string;
    pageSize: number;
    /** Client-side filter: chỉ giữ logs có changes chứa tên column này */
    columnName?: string;
}

export interface TableOption {
    displayName: string;
    logicalName: string;
}

export interface FetchAuditLogsResponse {
    logs: DvAuditLog[];
    totalCount: number;
    nextLink: string | null;
}

interface RawAuditLog {
    auditid: string;
    createdon: string;
    objecttypecode: string;
    action: number;
    _objectid_value: string;
    _userid_value: string;
    '_userid_value@OData.Community.Display.V1.FormattedValue': string;
    changedata?: string;
}

interface DynamicsAuditResponse {
    '@odata.count'?: number;
    '@odata.nextLink'?: string;
    value: RawAuditLog[];
}



export const ACTION_OPTIONS = ['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const;

// ── Helpers ──

const mapAction = (code: number): 'CREATE' | 'UPDATE' | 'DELETE' => {
    switch (code) {
        case 1: return 'CREATE';
        case 2: return 'UPDATE';
        case 3: return 'DELETE';
        default: return 'UPDATE';
    }
};

const mapActionToCode = (action: string): number | null => {
    switch (action) {
        case 'CREATE': return 1;
        case 'UPDATE': return 2;
        case 'DELETE': return 3;
        default: return null;
    }
};

const parseChanges = (raw: RawAuditLog): string => {
    if (raw.action !== 2 || !raw.changedata) return 'N/A';

    try {
        const data = JSON.parse(raw.changedata);
        if (data?.changedAttributes?.length > 0) {
            return data.changedAttributes.map((attr: { logicalName: string; oldValue: unknown; newValue: unknown }) => {
                return `${attr.logicalName}: ${JSON.stringify(attr.oldValue)} → ${JSON.stringify(attr.newValue)}`;
            }).join('\n');
        }
        return 'No detailed changes available.';
    } catch {
        const fields = raw.changedata.split(',').filter(f => f.trim());
        return fields.length > 0
            ? 'Fields changed: ' + fields.map(f => f.trim()).join(', ')
            : 'Change detected, no fields listed.';
    }
};

const mapRawLog = (raw: RawAuditLog): DvAuditLog => ({
    id: raw.auditid,
    timestamp: new Date(raw.createdon),
    tableName: raw.objecttypecode,
    action: mapAction(raw.action),
    recordId: raw._objectid_value,
    user: {
        id: raw._userid_value,
        name: raw['_userid_value@OData.Community.Display.V1.FormattedValue'] || 'Unknown',
    },
    changes: parseChanges(raw),
});

// ── Authenticated fetch for Dataverse ──

async function dvFetch(url: string, token: string, extraHeaders?: Record<string, string>): Promise<Response> {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Prefer': 'odata.include-annotations="*"',
        ...extraHeaders,
    };

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
        const text = await res.text();
        let msg = res.statusText;
        try {
            const json = JSON.parse(text);
            msg = json.error?.message || json.message || text;
        } catch { msg = text || msg; }
        throw new Error(`Dataverse API ${res.status}: ${msg}`);
    }
    return res;
}

// ── Public API ──

/**
 * Fetch audit logs from Dataverse audits entity
 */
export async function fetchDvAuditLogs(
    token: string,
    filters: AuditFilterCriteria,
    nextLink: string | null,
): Promise<FetchAuditLogsResponse> {
    let url: string;
    let extraHeaders: Record<string, string> | undefined;

    if (nextLink) {
        url = nextLink;
    } else {
        const conditions: string[] = [];

        if (filters.startDate) conditions.push(`createdon ge ${filters.startDate}T00:00:00Z`);
        if (filters.endDate) conditions.push(`createdon le ${filters.endDate}T23:59:59Z`);
        if (filters.tableName) conditions.push(`objecttypecode eq '${filters.tableName}'`);

        const actionCode = mapActionToCode(filters.action);
        if (actionCode !== null) conditions.push(`action eq ${actionCode}`);

        if (filters.recordId?.trim()) conditions.push(`_objectid_value eq ${filters.recordId.trim()}`);

        const select = '$select=auditid,createdon,objecttypecode,action,_objectid_value,_userid_value,changedata';
        const orderBy = '$orderby=createdon desc';
        const count = '$count=true';

        let query = `${select}&${orderBy}&${count}`;
        if (conditions.length > 0) query += `&$filter=${conditions.join(' and ')}`;

        url = `${dataverseConfig.baseUrl}/audits?${query}`;
        extraHeaders = { 'Prefer': `odata.maxpagesize=${filters.pageSize},odata.include-annotations="*"` };
    }

    const res = await dvFetch(url, token, extraHeaders);
    const data: DynamicsAuditResponse = await res.json();

    return {
        logs: data.value.map(mapRawLog),
        totalCount: data['@odata.count'] ?? 0,
        nextLink: data['@odata.nextLink'] || null,
    };
}

// ── Cache config ──

const TABLE_CACHE_KEY = 'dv_audit_tables_v2';
const TABLE_CACHE_TTL = 60 * 60 * 1000; // 60 minutes

interface TableCache {
    data: TableOption[];
    timestamp: number;
}

function getCachedTables(): TableOption[] | null {
    try {
        const raw = sessionStorage.getItem(TABLE_CACHE_KEY);
        if (!raw) return null;
        const cache: TableCache = JSON.parse(raw);
        if (Date.now() - cache.timestamp > TABLE_CACHE_TTL) {
            sessionStorage.removeItem(TABLE_CACHE_KEY);
            return null;
        }
        return cache.data;
    } catch {
        return null;
    }
}

function setCachedTables(data: TableOption[]): void {
    const cache: TableCache = { data, timestamp: Date.now() };
    sessionStorage.setItem(TABLE_CACHE_KEY, JSON.stringify(cache));
}

/**
 * Fetch auditable tables from Dataverse EntityDefinitions metadata API.
 * Only returns custom, unmanaged tables (filters out system/managed).
 * Results are cached in sessionStorage for 60 minutes.
 */
export async function fetchAuditTables(token: string): Promise<TableOption[]> {
    // Check cache first
    const cached = getCachedTables();
    if (cached) return cached;

    const select = '$select=LogicalName,DisplayName';
    const filter = '$filter=IsCustomEntity eq true';

    const url = `${dataverseConfig.baseUrl}/EntityDefinitions?${select}&${filter}`;
    const res = await dvFetch(url, token);
    const data = await res.json();

    // Các prefix được coi là table của công ty (loại bỏ adx_, msdyn_, system tables...)
    const COMPANY_PREFIXES = [
        'cr', 'wcg_', 'new_', 'chuongdq_', 'khoadb_', 
        'ttphat_', 'sa_', 'thuanndm_', 'zxc_', 'n3_'
    ];

    const tables: TableOption[] = (data.value || [])
        .map((e: { LogicalName: string; DisplayName: { UserLocalizedLabel: { Label: string } | null } }) => ({
            displayName: e.DisplayName?.UserLocalizedLabel?.Label || e.LogicalName,
            logicalName: e.LogicalName,
        }))
        .filter((t: TableOption) => {
            const ln = t.logicalName.toLowerCase();
            return COMPANY_PREFIXES.some(prefix => ln.startsWith(prefix));
        })
        .sort((a: TableOption, b: TableOption) => a.displayName.localeCompare(b.displayName));

    setCachedTables(tables);
    return tables;
}
