/**
 * Flow Analytics Service — Batch scanning, error analysis, aggregation
 * Ported & enhanced from Quan-ly-flow repo for WorkHub
 */

import { acquireToken } from '@/services/azure/tokenService';
import { PP_ENV_ID, powerAutomateConfig } from '@/config/authConfig';
import type { IPublicClientApplication, AccountInfo } from '@azure/msal-browser';

// ── Types ──

export interface FlowRun {
    id: string;
    name: string;
    status: string;
    startedOn: string;
    completedOn: string;
    trigger: string;
    triggerOutputsLink: string;
    errorCode: string;
    errorMessage: string;
    duration: number; // ms
}

export interface FlowStructure {
    trigger: { name: string; type: string } | null;
    actions: { name: string; type: string }[];
}

// ── Lightweight Health Check Types ──

export interface FailedFlowSummary {
    id: string;
    name: string;
    owner: string;
    failCount: number;
    totalRuns: number;
    lastError: string;
    lastErrorCode: string;
    lastErrorMessage: string;
    lastFailedAction: string;
}

export interface StuckFlowSummary {
    id: string;
    name: string;
    owner: string;
    runningCount: number;
    totalRuns: number;
}

export interface HealthCheckResult {
    scannedFlows: number;
    skippedFlows: number;
    totalFailedRuns: number;
    failedFlows: FailedFlowSummary[];
    stuckFlows: StuckFlowSummary[];
}

// ── LRU Cache ──

const MAX_CACHE_SIZE = 500;
const runsCache = new Map<string, FlowRun[]>();
const metadataCache = new Map<string, Record<string, unknown>>();

function limitCacheSize<T>(cache: Map<string, T>, maxSize = MAX_CACHE_SIZE) {
    if (cache.size > maxSize) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
    }
}

// ── Abort Controller ──

let scanAbortController: AbortController | null = null;
let isScanningAborted = false;

export function stopScanning() {
    isScanningAborted = true;
    if (scanAbortController) {
        scanAbortController.abort();
        scanAbortController = null;
    }
}

export function clearRunsCache() {
    runsCache.clear();
}

// ── API Functions ──

/**
 * Fetch flow metadata (definition, connections, triggers, actions)
 */
export async function fetchFlowMetadata(
    instance: IPublicClientApplication,
    account: AccountInfo,
    flowId: string,
): Promise<Record<string, unknown> | null> {
    if (metadataCache.has(flowId)) {
        return metadataCache.get(flowId)!;
    }

    try {
        const token = await acquireToken(instance, account, powerAutomateConfig.scopes);
        const url = `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/scopes/admin/environments/${PP_ENV_ID}/flows/${flowId}?api-version=2016-11-01`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        });

        if (!response.ok) return null;

        const data = await response.json();
        metadataCache.set(flowId, data);
        limitCacheSize(metadataCache);
        return data;
    } catch {
        return null;
    }
}

// ── Parse Helpers ──

function parseRunData(run: Record<string, unknown>): FlowRun {
    const props = (run.properties as Record<string, unknown>) || {};
    const trigger = (props.trigger as Record<string, unknown>) || {};
    const error = (props.error as Record<string, string>) || {};
    const outputsLink = ((trigger.outputsLink as Record<string, unknown>)?.uri as string) || '';
    const startTime = (props.startTime as string) || '';
    const endTime = (props.endTime as string) || '';

    const durationMs = startTime && endTime
        ? new Date(endTime).getTime() - new Date(startTime).getTime()
        : 0;

    return {
        id: (run.name as string) || '',
        name: (run.name as string) || '',
        status: (props.status as string) || '',
        startedOn: startTime,
        completedOn: endTime,
        trigger: (trigger.name as string) || '',
        triggerOutputsLink: outputsLink,
        errorCode: error?.code || '',
        errorMessage: error?.message || '',
        duration: durationMs,
    };
}

/**
 * Parse flow structure from metadata
 */
export function parseFlowStructure(metadata: Record<string, unknown> | null): FlowStructure {
    if (!metadata) return { trigger: null, actions: [] };

    const props = (metadata.properties as Record<string, unknown>) || {};
    const definition = (props.definition as Record<string, unknown>) || {};

    // Parse trigger
    const triggers = (definition.triggers as Record<string, Record<string, unknown>>) || {};
    const triggerKey = Object.keys(triggers)[0];
    const trigger = triggerKey
        ? { name: triggerKey, type: (triggers[triggerKey]?.type as string) || 'Unknown' }
        : null;

    // Parse actions
    const actionsObj = (definition.actions as Record<string, Record<string, unknown>>) || {};
    const actions = Object.keys(actionsObj).map(key => ({
        name: key,
        type: (actionsObj[key]?.type as string) || 'Unknown',
    }));

    return { trigger, actions };
}

/**
 * Parse error details from a failed run
 */
export function parseRunError(run: FlowRun): { code: string; message: string; action: string } {
    let failedAction = 'Unknown';

    if (run.errorMessage) {
        const match = run.errorMessage.match(/action ['"](.+?)['"]/i);
        if (match) failedAction = match[1];
    }

    return {
        code: run.errorCode || 'Unknown',
        message: run.errorMessage || 'No error message',
        action: failedAction,
    };
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
    if (ms <= 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// ── Lightweight Health Check ──

const FAIL_STATUSES = ['Failed', 'Faulted', 'TimedOut', 'Aborted'];
const STUCK_THRESHOLD = 50;

/**
 * Lightweight health check — fetch top 100 runs per flow (NO pagination),
 * identify flows with failures and stuck (Running > 50) flows.
 * ~20-30s for 700+ flows vs minutes for full scan.
 */
export async function fetchFlowHealthCheck(
    instance: IPublicClientApplication,
    account: AccountInfo,
    flows: { id: string; name: string; owner: string }[],
    daysRange: number,
    onProgress?: (processed: number, total: number) => void,
): Promise<HealthCheckResult> {
    const BATCH_SIZE = 10;
    isScanningAborted = false;
    scanAbortController = new AbortController();

    const result: HealthCheckResult = {
        scannedFlows: 0,
        skippedFlows: 0,
        totalFailedRuns: 0,
        failedFlows: [],
        stuckFlows: [],
    };

    // Build filter date
    const now = new Date();
    let filterDate: string;
    if (daysRange === 1) {
        const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        filterDate = new Date(`${dateStr}T00:00:00+07:00`).toISOString().split('.')[0] + 'Z';
    } else {
        filterDate = new Date(now.getTime() - daysRange * 24 * 60 * 60 * 1000).toISOString().split('.')[0] + 'Z';
    }

    for (let i = 0; i < flows.length; i += BATCH_SIZE) {
        if (isScanningAborted) break;

        const batch = flows.slice(i, i + BATCH_SIZE);
        const token = await acquireToken(instance, account, powerAutomateConfig.scopes);

        const batchResults = await Promise.all(
            batch.map(async (flow) => {
                if (isScanningAborted) return { flow, runs: [] as FlowRun[], skipped: false };
                try {
                    const url = `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/scopes/admin/environments/${PP_ENV_ID}/flows/${flow.id}/runs?api-version=2016-11-01&$top=100&$filter=startTime ge ${filterDate}`;
                    const response = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                        signal: scanAbortController?.signal,
                    });

                    if (!response.ok) {
                        if (response.status === 403) return { flow, runs: [] as FlowRun[], skipped: true };
                        return { flow, runs: [] as FlowRun[], skipped: false };
                    }

                    const data = await response.json();
                    const runs: FlowRun[] = (data.value || []).map(parseRunData);
                    return { flow, runs, skipped: false };
                } catch {
                    return { flow, runs: [] as FlowRun[], skipped: false };
                }
            }),
        );

        for (const { flow, runs, skipped } of batchResults) {
            if (skipped) {
                result.skippedFlows++;
                continue;
            }
            result.scannedFlows++;

            if (runs.length === 0) continue;

            // Count failures
            const failedRuns = runs.filter(r => FAIL_STATUSES.includes(r.status));
            if (failedRuns.length > 0) {
                result.totalFailedRuns += failedRuns.length;
                const lastFail = failedRuns[0]; // runs are sorted desc by startTime
                const errorDetail = parseRunError(lastFail);
                result.failedFlows.push({
                    id: flow.id,
                    name: flow.name,
                    owner: flow.owner,
                    failCount: failedRuns.length,
                    totalRuns: runs.length,
                    lastError: errorDetail.code,
                    lastErrorCode: errorDetail.code,
                    lastErrorMessage: errorDetail.message,
                    lastFailedAction: errorDetail.action,
                });
            }

            // Count stuck (Running)
            const runningRuns = runs.filter(r => r.status === 'Running');
            if (runningRuns.length >= STUCK_THRESHOLD) {
                result.stuckFlows.push({
                    id: flow.id,
                    name: flow.name,
                    owner: flow.owner,
                    runningCount: runningRuns.length,
                    totalRuns: runs.length,
                });
            }
        }

        if (onProgress) {
            onProgress(Math.min(i + batch.length, flows.length), flows.length);
        }

        // Rate limit — lighter delay since no pagination
        if (i + BATCH_SIZE < flows.length && !isScanningAborted) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    // Sort results
    result.failedFlows.sort((a, b) => b.failCount - a.failCount);
    result.stuckFlows.sort((a, b) => b.runningCount - a.runningCount);

    return result;
}

