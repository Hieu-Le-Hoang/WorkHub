/**
 * Data Service — Dataflows (Dataverse) + Fabric (Power BI REST API)
 */

import { dataverseConfig, powerBIConfig } from "@/config/authConfig";

// ── Types ──

export interface Dataflow {
    id: string;
    name: string;
    state: string;
    stateLabel: string;
    lastModified: string;
    createdOn: string;
    owner: string;
    description: string;
    category: string;
    createdBy: string;
    modifiedBy: string;
    entityNames: string[];  // Unique entity/query names from refresh history
    hasSchedule: boolean;   // Has scheduled refresh (RefreshType contains 'Scheduled')
    lastRefreshType: string; // Most recent RefreshType
    lastRefreshTime: string; // Most recent refresh StartTime
    lastRefreshStatus: string; // Most recent refresh status
}

export interface FabricWorkspace {
    id: string;
    name: string;
    type: string;
    state: string;
    capacityId: string;
}

export interface FabricDataflowUser {
    displayName: string;
    emailAddress: string;
    dataflowUserAccessRight: string;
}

export interface FabricDataflowTransaction {
    id: string;
    refreshType: string;
    startTime: string;
    endTime: string;
    status: string;
}

export interface FabricDatasourceUsage {
    datasourceInstanceId: string;
    datasourceType: string;
    connectionDetails: Record<string, string>;
}

export interface FabricUpstreamDataflow {
    targetDataflowId: string;
    groupId: string;
}

export interface FabricItem {
    id: string;
    name: string;
    type: string; // Dataset, Dataflow, Report, etc.
    configuredBy: string;
    isRefreshable: boolean;
    workspaceName: string;
    workspaceId: string;
    // Dataflow-specific fields
    description: string;
    modifiedBy: string;
    modifiedDateTime: string;
    modelUrl: string;
    users: FabricDataflowUser[];
    datasourceUsages: FabricDatasourceUsage[];
    upstreamDataflows: FabricUpstreamDataflow[];
}

// ── Power Platform Dataflows ──

export async function fetchDataflows(accessToken: string): Promise<{ dataflows: Dataflow[]; total: number }> {
    const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Prefer": "odata.include-annotations=\"*\"",
    };

    // Try msdyn_dataflows first (PP Dataflows entity)
    try {
        const ppUrl = `${dataverseConfig.baseUrl}/msdyn_dataflows?$select=msdyn_dataflowid,msdyn_name,msdyn_description,statecode,modifiedon,createdon,_ownerid_value,_createdby_value,_modifiedby_value,msdyn_refreshhistory&$filter=statecode eq 0&$orderby=modifiedon desc&$top=500&$count=true`;
        const ppRes = await fetch(ppUrl, { headers });

        if (ppRes.ok) {
            const ppData = await ppRes.json();
            console.log('[DataService] msdyn_dataflows:', ppData.value?.length || 0, 'items');

            const dataflows = (ppData.value || []).map((df: Record<string, unknown>) => {
                // Extract unique entity names + schedule info from refresh history JSON
                let entityNames: string[] = [];
                let hasSchedule = false;
                let lastRefreshType = '';
                let lastRefreshTime = '';
                let lastRefreshStatus = '';
                try {
                    const histJson = df.msdyn_refreshhistory as string;
                    if (histJson) {
                        const hist = JSON.parse(histJson) as Array<Record<string, unknown>>;
                        const names = new Set<string>();

                        // Sort by StartTime desc to get latest first
                        const sorted = [...hist].sort((a, b) =>
                            new Date(b.StartTime as string).getTime() - new Date(a.StartTime as string).getTime()
                        );

                        // Get latest refresh info
                        if (sorted.length > 0) {
                            lastRefreshType = (sorted[0].RefreshType as string || '').replace('RefreshType', '');
                            lastRefreshTime = sorted[0].StartTime as string || '';
                            lastRefreshStatus = sorted[0].RefreshStatus as string || '';
                        }

                        // Check if any entry has Scheduled refresh type
                        // Actual values: RefreshTypeTimeBased, RefreshTypeIntervalBased (= scheduled)
                        //                RefreshTypeOneTime (= manual)
                        hasSchedule = sorted.some(h => {
                            const rt = (h.RefreshType as string || '').toLowerCase();
                            return rt.includes('timebased') || rt.includes('intervalbased');
                        });

                        for (const h of hist) {
                            const entities = (h.EntitiesRefreshHistory as Array<Record<string, unknown>>) || [];
                            for (const e of entities) {
                                const name = e.EntityName as string;
                                if (name) names.add(name);
                            }
                        }
                        entityNames = Array.from(names).sort();
                    }
                } catch { /* ignore parse errors */ }

                return {
                    id: df.msdyn_dataflowid as string,
                    name: df.msdyn_name as string || '',
                    state: (df.statecode as number) === 0 ? 'Active' : 'Inactive',
                    stateLabel: (df['statecode@OData.Community.Display.V1.FormattedValue'] as string) || ((df.statecode as number) === 0 ? 'Active' : 'Inactive'),
                    lastModified: df.modifiedon as string || '',
                    createdOn: df.createdon as string || '',
                    owner: (df['_ownerid_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
                    description: df.msdyn_description as string || '',
                    category: 'Dataflow',
                    createdBy: (df['_createdby_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
                    modifiedBy: (df['_modifiedby_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
                    entityNames,
                    hasSchedule,
                    lastRefreshType,
                    lastRefreshTime,
                    lastRefreshStatus,
                };
            });

            // Dedupe by name — keep latest modified per name
            const seen = new Map<string, Dataflow>();
            for (const df of dataflows) {
                const existing = seen.get(df.name);
                if (!existing || df.lastModified > existing.lastModified) {
                    seen.set(df.name, df);
                }
            }
            const deduped = Array.from(seen.values());

            if (deduped.length > 0) return { dataflows: deduped, total: deduped.length };
        }
    } catch (e) {
        console.warn('[DataService] msdyn_dataflows entity not available:', e);
    }

    // Fallback: workflows with all automation categories (5=Cloud Flow, 6=Desktop Flow)
    const url = `${dataverseConfig.baseUrl}/workflows?$select=workflowid,name,description,statecode,category,modifiedon,createdon,_ownerid_value,_createdby_value,_modifiedby_value&$filter=category eq 5 or category eq 6&$orderby=modifiedon desc&$top=500&$count=true`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn('Workflows fetch failed:', response.status, errorText);
        return { dataflows: [], total: 0 };
    }

    const data = await response.json();
    console.log('[DataService] Workflows (cat 5+6):', data.value?.length || 0, 'items');

    const dataflows = (data.value || []).map((df: Record<string, unknown>) => ({
        id: df.workflowid as string,
        name: df.name as string || '',
        state: (df.statecode as number) === 1 ? 'Activated' : 'Draft',
        stateLabel: (df['statecode@OData.Community.Display.V1.FormattedValue'] as string) || ((df.statecode as number) === 1 ? 'Activated' : 'Draft'),
        lastModified: df.modifiedon as string || '',
        createdOn: df.createdon as string || '',
        owner: (df['_ownerid_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
        description: df.description as string || '',
        category: (df['category@OData.Community.Display.V1.FormattedValue'] as string) || ((df.category as number) === 5 ? 'Cloud Flow' : 'Desktop Flow'),
        createdBy: (df['_createdby_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
        modifiedBy: (df['_modifiedby_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
        entityNames: [],
        hasSchedule: false,
        lastRefreshType: '',
        lastRefreshTime: '',
        lastRefreshStatus: '',
    }));

    // Dedupe by name — keep latest modified per name
    const seen = new Map<string, Dataflow>();
    for (const df of dataflows) {
        const existing = seen.get(df.name);
        if (!existing || df.lastModified > existing.lastModified) {
            seen.set(df.name, df);
        }
    }
    const deduped = Array.from(seen.values());

    return { dataflows: deduped, total: deduped.length };
}

// ── PA Dataflow Refresh History (from Dataverse msdyn_refreshhistory JSON) ──

export interface DataflowRefreshRun {
    id: string;
    status: string;       // Success | Failed | Running
    startedOn: string;
    completedOn: string;
    trigger: string;      // RefreshType
    errorCode: string;
    errorMessage: string;
    entityName: string;
    insertCount: number;
    rowsRead: number;
}

export async function fetchDataflowRefreshHistory(accessToken: string, dataflowId: string): Promise<DataflowRefreshRun[]> {
    const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
    };

    const url = `${dataverseConfig.baseUrl}/msdyn_dataflows(${dataflowId})?$select=msdyn_refreshhistory`;

    try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
            console.warn('[DataService] msdyn_refreshhistory fetch failed:', res.status);
            return [];
        }

        const data = await res.json();
        const jsonStr = data.msdyn_refreshhistory as string;
        if (!jsonStr) return [];

        const history = JSON.parse(jsonStr) as Array<Record<string, unknown>>;

        // Sort by StartTime descending (most recent first), take top 50
        return history
            .sort((a, b) => new Date(b.StartTime as string).getTime() - new Date(a.StartTime as string).getTime())
            .slice(0, 50)
            .map((h) => {
                const errorInfo = h.ErrorInfo as Record<string, string> | null;
                const exceptionInfo = h.ExceptionInfo as Record<string, unknown> | null;
                const errorMsg = errorInfo?.ErrorMessage
                    || (exceptionInfo?.Message as string)
                    || '';

                // Extract entity-level stats
                const entities = (h.EntitiesRefreshHistory as Array<Record<string, unknown>>) || [];
                const firstEntity = entities[0] || {};
                const entityName = (firstEntity.EntityName as string) || '';
                const insertCount = (firstEntity.InsertCount as number) || 0;

                // Aggregate rowsRead from DataSourceStatistics
                const partitions = (firstEntity.PartitionsRefreshHistory as Array<Record<string, unknown>>) || [];
                let rowsRead = 0;
                for (const p of partitions) {
                    const stats = (p.DataSourceStatistics as Array<Record<string, number>>) || [];
                    for (const s of stats) rowsRead += (s.RowsRead || 0);
                }

                return {
                    id: (h.TransactionId as string) || '',
                    status: (h.RefreshStatus as string) || '',
                    startedOn: (h.StartTime as string) || '',
                    completedOn: (h.EndTime as string) || '',
                    trigger: ((h.RefreshType as string) || '').replace('RefreshType', ''),
                    errorCode: errorInfo?.ErrorCode || '',
                    errorMessage: errorMsg,
                    entityName,
                    insertCount,
                    rowsRead,
                };
            });
    } catch (e) {
        console.warn('[DataService] msdyn_refreshhistory parse error:', e);
        return [];
    }
}

// ── Fabric / Power BI API ──

export async function fetchFabricWorkspaces(accessToken: string): Promise<FabricWorkspace[]> {
    const url = `${powerBIConfig.baseUrl}/groups?$top=100`;

    const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn('Fabric workspaces fetch failed:', response.status, errorText);
        return [];
    }

    const data = await response.json();
    console.log('[DataService] Fabric workspaces raw:', data.value?.length || 0, 'items', data);
    return (data.value || []).map((ws: Record<string, unknown>) => ({
        id: ws.id as string,
        name: ws.name as string || '',
        type: ws.type as string || 'Workspace',
        state: ws.state as string || 'Active',
        capacityId: ws.capacityId as string || '',
    }));
}

export async function fetchFabricItems(accessToken: string, workspaces: FabricWorkspace[]): Promise<FabricItem[]> {
    const allItems: FabricItem[] = [];
    const headers = { "Authorization": `Bearer ${accessToken}` };

    // Fetch multiple item types per workspace (limit to first 20 to avoid rate limiting)
    const targets = workspaces.slice(0, 20);

    for (const ws of targets) {
        try {
            // Parallel fetch: reports, dataflows, pipelines, lakehouses
            const [dsRes, dfRes, rptRes, pipeRes, lhRes] = await Promise.all([
                fetch(`${powerBIConfig.baseUrl}/groups/${ws.id}/datasets`, { headers }),
                fetch(`${powerBIConfig.baseUrl}/groups/${ws.id}/dataflows`, { headers }),
                fetch(`${powerBIConfig.baseUrl}/groups/${ws.id}/reports`, { headers }),
                fetch(`https://api.fabric.microsoft.com/v1/workspaces/${ws.id}/dataPipelines`, { headers }).catch(() => null),
                fetch(`https://api.fabric.microsoft.com/v1/workspaces/${ws.id}/lakehouses`, { headers }).catch(() => null),
            ]);

            // Datasets
            if (dsRes.ok) {
                const dsData = await dsRes.json();
                (dsData.value || []).forEach((ds: Record<string, unknown>) => {
                    allItems.push({
                        id: ds.id as string, name: ds.name as string || '', type: 'Dataset',
                        configuredBy: ds.configuredBy as string || '', isRefreshable: ds.isRefreshable as boolean || false, workspaceName: ws.name, workspaceId: ws.id,
                        description: '', modifiedBy: '', modifiedDateTime: '', modelUrl: '', users: [], datasourceUsages: [], upstreamDataflows: [],
                    });
                });
            }

            // Dataflows
            if (dfRes.ok) {
                const dfData = await dfRes.json();
                (dfData.value || []).forEach((df: Record<string, unknown>) => {
                    const usersRaw = df.users as Array<Record<string, unknown>> || [];
                    allItems.push({
                        id: df.objectId as string || df.id as string || '', name: df.name as string || '', type: 'Dataflow',
                        configuredBy: df.configuredBy as string || '', isRefreshable: true, workspaceName: ws.name, workspaceId: ws.id,
                        description: df.description as string || '',
                        modifiedBy: df.modifiedBy as string || '',
                        modifiedDateTime: df.modifiedDateTime as string || '',
                        modelUrl: df.modelUrl as string || '',
                        users: usersRaw.map(u => ({
                            displayName: u.displayName as string || '',
                            emailAddress: u.emailAddress as string || '',
                            dataflowUserAccessRight: u.dataflowUserAccessRight as string || '',
                        })),
                        datasourceUsages: ((df.datasourceUsages as Array<Record<string, unknown>>) || []).map(ds => ({
                            datasourceInstanceId: ds.datasourceInstanceId as string || '',
                            datasourceType: ds.datasourceType as string || '',
                            connectionDetails: (ds.connectionDetails as Record<string, string>) || {},
                        })),
                        upstreamDataflows: ((df.upstreamDataflows as Array<Record<string, unknown>>) || []).map(ud => ({
                            targetDataflowId: ud.targetDataflowId as string || '',
                            groupId: ud.groupId as string || '',
                        })),
                    });
                });
            }

            // Reports
            if (rptRes.ok) {
                const rptData = await rptRes.json();
                (rptData.value || []).forEach((rpt: Record<string, unknown>) => {
                    allItems.push({
                        id: rpt.id as string, name: rpt.name as string || '', type: 'Report',
                        configuredBy: '', isRefreshable: false, workspaceName: ws.name, workspaceId: ws.id,
                        description: '', modifiedBy: '', modifiedDateTime: '', modelUrl: '', users: [], datasourceUsages: [], upstreamDataflows: [],
                    });
                });
            }

            // Pipelines (Fabric API — may 404 on non-Fabric workspaces)
            if (pipeRes?.ok) {
                const pipeData = await pipeRes.json();
                (pipeData.value || []).forEach((p: Record<string, unknown>) => {
                    allItems.push({
                        id: p.id as string, name: (p.displayName || p.name) as string || '', type: 'Pipeline',
                        configuredBy: '', isRefreshable: false, workspaceName: ws.name, workspaceId: ws.id,
                        description: '', modifiedBy: '', modifiedDateTime: '', modelUrl: '', users: [], datasourceUsages: [], upstreamDataflows: [],
                    });
                });
            }

            // Lakehouses (Fabric API — may 404 on non-Fabric workspaces)
            if (lhRes?.ok) {
                const lhData = await lhRes.json();
                (lhData.value || []).forEach((lh: Record<string, unknown>) => {
                    allItems.push({
                        id: lh.id as string, name: (lh.displayName || lh.name) as string || '', type: 'Lakehouse',
                        configuredBy: '', isRefreshable: false, workspaceName: ws.name, workspaceId: ws.id,
                        description: '', modifiedBy: '', modifiedDateTime: '', modelUrl: '', users: [], datasourceUsages: [], upstreamDataflows: [],
                    });
                });
            }
        } catch (e) {
            console.warn(`Fabric items fetch failed for workspace ${ws.name}:`, e);
        }
    }

    // Dedupe by id
    const seen = new Set<string>();
    return allItems.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

// ── Fabric Dataflow Transactions (on-demand) ──

export async function fetchDataflowTransactions(
    accessToken: string,
    workspaceId: string,
    dataflowId: string,
): Promise<FabricDataflowTransaction[]> {
    const url = `${powerBIConfig.baseUrl}/groups/${workspaceId}/dataflows/${dataflowId}/transactions?$top=10`;
    try {
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${accessToken}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.value || []).map((t: Record<string, unknown>) => ({
            id: t.id as string || '',
            refreshType: t.refreshType as string || '',
            startTime: t.startTime as string || '',
            endTime: t.endTime as string || '',
            status: t.status as string || '',
        }));
    } catch {
        return [];
    }
}

// ── Fabric Dataflow Refresh Schedule (on-demand) ──

export interface FabricRefreshSchedule {
    days: string[];
    times: string[];
    enabled: boolean;
    localTimeZoneId: string;
    notifyOption: string;
}

export async function fetchDataflowRefreshSchedule(
    accessToken: string,
    workspaceId: string,
    dataflowId: string,
): Promise<FabricRefreshSchedule | null> {
    const url = `${powerBIConfig.baseUrl}/groups/${workspaceId}/dataflows/${dataflowId}/refreshSchedule`;
    try {
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${accessToken}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            days: data.days as string[] || [],
            times: data.times as string[] || [],
            enabled: data.enabled as boolean || false,
            localTimeZoneId: data.localTimeZoneId as string || '',
            notifyOption: data.notifyOption as string || '',
        };
    } catch {
        return null;
    }
}

// ── Delete PA Dataflow (Dataverse) ──

export async function deleteDataflow(accessToken: string, dataflowId: string): Promise<void> {
    const url = `${dataverseConfig.baseUrl}/msdyn_dataflows(${dataflowId})`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
        },
    });
    if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.error('[DataService] Delete PA dataflow failed:', response.status, errorText);
        throw new Error(`Delete dataflow failed: ${response.status}`);
    }
    console.log('[DataService] Deleted PA dataflow:', dataflowId);
}

// ── Delete Fabric Dataflow (Power BI REST API) ──

export async function deleteFabricDataflow(accessToken: string, workspaceId: string, dataflowId: string): Promise<void> {
    const url = `${powerBIConfig.baseUrl}/groups/${workspaceId}/dataflows/${dataflowId}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    if (!response.ok && response.status !== 200 && response.status !== 204) {
        const errorText = await response.text();
        console.error('[DataService] Delete Fabric dataflow failed:', response.status, errorText);
        throw new Error(`Delete Fabric dataflow failed: ${response.status}`);
    }
    console.log('[DataService] Deleted Fabric dataflow:', dataflowId);
}
