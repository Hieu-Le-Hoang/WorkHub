/**
 * Power Platform Service — via Dataverse API
 * Fetches canvas apps, flows, environments from Dataverse tables
 * NO additional scopes needed — uses existing Dataverse token
 */

import { dataverseConfig, PP_ENV_ID } from "@/config/authConfig";

// ── Types ──

export interface CanvasApp {
    id: string;
    name: string;
    displayName: string;
    status: string;
    appType: string;
    owner: string;
    lastModified: string;
    playUrl: string;
    createdTime: string;
}

export interface FlowDefinition {
    id: string;
    name: string;
    state: string;
    stateLabel: string;
    lastModified: string;
    category: string;
    owner: string;
    description: string;
    createdOn: string;
    triggerType: string;
    scope: string;
    statusCode: string;
    uniqueName: string;
    createdBy: string;
    modifiedBy: string;
    solutionId: string;
    clientData: string;
    definition: string;
}

export interface PPEnvironment {
    name: string;
    version: string;
    state: string;
    createdOn: string;
    uniqueName: string;
    urlName: string;
}

// ── Canvas App Types ──
const APP_TYPE_MAP: Record<number, string> = {
    0: 'Canvas App',
    1: 'Component Library',
    2: 'Custom Page',
    3: 'Unified App',
};

// ── API Calls ──

export async function fetchCanvasApps(accessToken: string): Promise<CanvasApp[]> {
    const url = `${dataverseConfig.baseUrl}/canvasapps?$select=canvasappid,displayname,name,status,canvasapptype,lastmodifiedtime,createdtime,appopenuri,_ownerid_value&$orderby=lastmodifiedtime desc&$top=100`;

    const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json", "OData-MaxVersion": "4.0", "OData-Version": "4.0" },
    });

    if (!response.ok) {
        console.warn('Canvas apps (Dataverse) fetch failed:', response.status);
        return [];
    }

    const data = await response.json();
    return (data.value || []).map((app: Record<string, unknown>) => ({
        id: app.canvasappid as string,
        name: app.name as string || '',
        displayName: app.displayname as string || app.name as string || '',
        status: app.status as string || 'Unknown',
        appType: APP_TYPE_MAP[(app.canvasapptype as number) ?? -1] || 'Unknown',
        owner: (app['_ownerid_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
        lastModified: app.lastmodifiedtime as string || '',
        playUrl: app.appopenuri as string || '',
        createdTime: app.createdtime as string || '',
    }));
}

export async function fetchFlows(accessToken: string): Promise<{ flows: FlowDefinition[]; total: number }> {
    // category=5 = Modern Flow (Power Automate cloud flow)
    // Production environment: de210e4b-cd22-e605-91ca-8e841aad4b8e
    const url = `${dataverseConfig.baseUrl}/workflows?$select=workflowid,name,statecode,statuscode,category,modifiedon,createdon,description,_ownerid_value,scope,uniquename,_createdby_value,_modifiedby_value,solutionid,clientdata,definition&$filter=category eq 5&$orderby=modifiedon desc&$top=5000&$count=true`;

    const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json", "OData-MaxVersion": "4.0", "OData-Version": "4.0", "Prefer": "odata.include-annotations=\"*\"" },
    });

    if (!response.ok) {
        console.warn('Flows (Dataverse) fetch failed:', response.status);
        return { flows: [], total: 0 };
    }

    const data = await response.json();
    const total = data['@odata.count'] || data.value?.length || 0;

    const flows = (data.value || []).map((flow: Record<string, unknown>) => ({
        id: flow.workflowid as string,
        name: flow.name as string || '',
        state: flow.statecode as number === 1 ? 'Activated' : 'Draft',
        stateLabel: (flow['statecode@OData.Community.Display.V1.FormattedValue'] as string) || (flow.statecode === 1 ? 'Activated' : 'Draft'),
        lastModified: flow.modifiedon as string || '',
        category: (flow['category@OData.Community.Display.V1.FormattedValue'] as string) || 'Modern Flow',
        owner: (flow['_ownerid_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
        description: flow.description as string || '',
        createdOn: flow.createdon as string || '',
        triggerType: '',
        scope: (flow['scope@OData.Community.Display.V1.FormattedValue'] as string) || '',
        statusCode: (flow['statuscode@OData.Community.Display.V1.FormattedValue'] as string) || '',
        uniqueName: flow.uniquename as string || '',
        createdBy: (flow['_createdby_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
        modifiedBy: (flow['_modifiedby_value@OData.Community.Display.V1.FormattedValue'] as string) || '',
        solutionId: flow.solutionid as string || '',
        clientData: flow.clientdata as string || '',
        definition: flow.definition as string || '',
    }));

    return { flows, total };
}

export interface FlowRun {
    id: string;
    name: string;
    status: string;       // Succeeded | Failed | Running | Cancelled
    startedOn: string;
    completedOn: string;
    errorCode: string;
    errorMessage: string;
    trigger: string;
    triggerOutputsLink: string;  // SAS URL to fetch trigger output body
}

export async function fetchFlowRuns(flowToken: string, flowId: string, top = 20): Promise<FlowRun[]> {
    const url = `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/scopes/admin/environments/${PP_ENV_ID}/flows/${flowId}/runs?api-version=2016-11-01&$top=${top}`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${flowToken}`,
            "Accept": "application/json",
        },
    });

    if (!response.ok) {
        console.warn('[FlowRuns] fetch failed:', response.status, await response.text().catch(() => ''));
        return [];
    }

    const data = await response.json();
    return (data.value || []).map((run: Record<string, unknown>) => {
        const props = run.properties as Record<string, unknown> || {};
        const trigger = props.trigger as Record<string, unknown> || {};
        const triggerName = trigger.name as string || '';
        const outputsLink = (trigger.outputsLink as Record<string, unknown>)?.uri as string || '';
        const startTime = props.startTime as string || '';
        const endTime = props.endTime as string || '';
        const status = props.status as string || '';
        const error = props.error as Record<string, string> || {};

        return {
            id: run.name as string || '',
            name: run.name as string || '',
            status,
            startedOn: startTime,
            completedOn: endTime,
            errorCode: error?.code || '',
            errorMessage: error?.message || '',
            trigger: triggerName,
            triggerOutputsLink: outputsLink,
        };
    });
}

/**
 * Fetch trigger output body from a SAS URL (returned in run.triggerOutputsLink).
 * The SAS URL is self-authenticated, no Bearer token needed.
 */
export async function fetchFlowRunTriggerOutput(sasUrl: string): Promise<Record<string, unknown> | null> {
    if (!sasUrl) return null;
    try {
        const response = await fetch(sasUrl, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            console.warn('[TriggerOutput] fetch failed:', response.status);
            return null;
        }
        return await response.json();
    } catch (err) {
        console.warn('[TriggerOutput] error:', err);
        return null;
    }
}

// ── Delete Flow ──

export async function deleteFlow(flowToken: string, flowId: string): Promise<void> {
    const url = `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/scopes/admin/environments/${PP_ENV_ID}/flows/${flowId}?api-version=2016-11-01`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${flowToken}`,
            'Accept': 'application/json',
        },
    });

    if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.error('[FlowService] Delete failed:', response.status, errorText);
        throw new Error(`Delete flow failed: ${response.status} — ${errorText}`);
    }

    console.log('[FlowService] Deleted flow:', flowId);
}

export async function fetchEnvironments(envToken: string): Promise<PPEnvironment[]> {
    const url = 'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2021-04-01';

    const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${envToken}`, "Accept": "application/json" },
    });

    if (!response.ok) {
        console.warn('Environments (BAP) fetch failed:', response.status);
        return [];
    }

    const data = await response.json();
    return (data.value || []).map((env: Record<string, unknown>) => {
        const props = env.properties as Record<string, unknown> || {};
        const linked = props.linkedEnvironmentMetadata as Record<string, unknown> || {};
        return {
            name: (props.displayName as string) || (env.name as string) || '',
            version: (linked.version as string) || '',
            state: (props.provisioningState as string) || (props.states as Record<string, string>)?.management || 'Unknown',
            createdOn: (props.createdTime as string) || '',
            uniqueName: (linked.uniqueName as string) || '',
            urlName: (linked.domainName as string) || '',
        };
    });
}
