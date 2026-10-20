/**
 * Notification Service — Fetch app notifications from Dataverse
 * Table: appnotification (EntitySet: appnotifications)
 * Owner-based filtering: ownerid = current systemuser
 */

import { dataverseConfig } from '../../config/authConfig';
import { createFetchHeadersWithAnnotations } from './common';

// ── Types ──

export interface NotificationAction {
    title: string;
    data: {
        url: string;
        navigationTarget?: string;
    };
}

export interface AppNotification {
    appnotificationid: string;
    title: string;
    body: string;
    icontype: number;
    icontypeFormatted: string;
    priority: number;
    priorityFormatted: string;
    createdon: string;
    createdonFormatted: string;
    actions: NotificationAction[];
}

/**
 * Get current user's systemuserid from Azure AD Object ID
 */
export async function getCurrentSystemUserId(
    accessToken: string,
    azureAdObjectId: string
): Promise<string | null> {
    const url = `${dataverseConfig.baseUrl}/systemusers?$filter=azureactivedirectoryobjectid eq ${azureAdObjectId}&$select=systemuserid`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.value?.length > 0) {
            return data.value[0].systemuserid;
        }
        return null;
    } catch (e) {
        console.error('[NotificationService] Error fetching systemuserid:', e);
        return null;
    }
}

/**
 * Fetch notifications for a specific user (by ownerid)
 */
export async function fetchNotifications(
    accessToken: string,
    ownerSystemUserId: string,
    top: number = 50
): Promise<AppNotification[]> {
    const filter = `_ownerid_value eq ${ownerSystemUserId} and contains(body, 'đang chờ')`;
    const select = 'appnotificationid,title,body,data,icontype,priority,createdon';
    const orderby = 'createdon desc';

    const url = `${dataverseConfig.baseUrl}/appnotifications?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=${encodeURIComponent(orderby)}&$top=${top}`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[NotificationService] Error:', response.status, errorText);
            return [];
        }

        const result = await response.json();
        const records = result.value || [];

        return records.map((r: any) => {
            // Parse actions from data field (JSON string)
            let actions: NotificationAction[] = [];
            if (r.data) {
                try {
                    const parsed = JSON.parse(r.data);
                    actions = parsed.actions || [];
                } catch {
                    // data field is not valid JSON, skip
                }
            }

            return {
                appnotificationid: r.appnotificationid,
                title: r.title || '',
                body: r.body || '',
                icontype: r.icontype,
                icontypeFormatted: r['icontype@OData.Community.Display.V1.FormattedValue'] || '',
                priority: r.priority,
                priorityFormatted: r['priority@OData.Community.Display.V1.FormattedValue'] || 'Normal',
                createdon: r.createdon,
                createdonFormatted: r['createdon@OData.Community.Display.V1.FormattedValue'] || '',
                actions,
            } as AppNotification;
        });
    } catch (e) {
        console.error('[NotificationService] Exception:', e);
        return [];
    }
}

/**
 * Build full PowerApps URL from relative notification action URL
 */
export function buildPowerAppsUrl(relativeUrl: string): string {
    const orgUrl = dataverseConfig.orgUrl || 'https://wecare-ii.crm5.dynamics.com';
    // relativeUrl starts with "?" — append to main.aspx
    if (relativeUrl.startsWith('?')) {
        return `${orgUrl}/main.aspx${relativeUrl}`;
    }
    return `${orgUrl}/${relativeUrl}`;
}

/**
 * Format createdon relative to now (e.g. "5 phút trước", "2 giờ trước")
 */
export function formatTimeAgo(isoDate: string): string {
    const now = new Date();
    const date = new Date(isoDate);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;

    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
