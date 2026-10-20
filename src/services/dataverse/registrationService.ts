/**
 * Registration (Phiếu đăng ký) services
 */

import { dataverseConfig } from '@/config/authConfig';
import { createFetchHeaders, createFetchHeadersWithAnnotations } from './common';
import { PhieuDangKy, TeamRegistration } from './types';
import { formatDate } from '@/utils/workUtils';

/**
 * Fetch Phieu Dang Ky for a specific month
 */
export async function fetchPhieuDangKyForMonth(
    accessToken: string,
    employeeId: string,
    startStr: string,
    endStr: string
): Promise<PhieuDangKy[]> {
    const filter = `_crdfd_nhanvien_value eq ${employeeId} and statecode eq 0 and crdfd_tungay le ${endStr} and crdfd_enngay ge ${startStr}`;
    const select = "crdfd_phieuangkyid,_crdfd_nhanvien_value,crdfd_loaiangky,crdfd_tungay,crdfd_enngay,crdfd_sogio2,crdfd_diengiai,crdfd_captrenduyet,crdfd_hinhthuc,crdfd_quanlytructiep,cr1bb_songay,cr1bb_sopheptonnamtruoc,new_sophepconlaitoithangthucte";

    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies?$filter=${encodeURIComponent(filter)}&$select=${select}`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeaders(accessToken),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error fetching registrations:", response.status, errorText);
            return [];
        }

        const data = await response.json();
        return data.value || [];
    } catch (e) {
        console.error("Error calling PhieuDangKy API:", e);
        return [];
    }
}

/**
 * Fetch personal registrations
 */
export async function fetchPersonalRegistrations(
    accessToken: string,
    employeeId: string,
    year?: number,
    month?: number
): Promise<TeamRegistration[]> {
    let filter = `statecode eq 0 and _crdfd_nhanvien_value eq ${employeeId}`;

    if (year !== undefined && month !== undefined) {
        const startStr = formatDate(year, month, 1);
        const nextMonthDate = new Date(year, month + 1, 1);
        const startStrNext = formatDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);
        filter += ` and crdfd_tungay lt ${startStrNext} and crdfd_enngay ge ${startStr}`;
    }

    const select = "crdfd_phieuangkyid,_crdfd_nhanvien_value,crdfd_loaiangky,crdfd_tungay,crdfd_enngay,crdfd_sogio2,crdfd_diengiai,crdfd_captrenduyet";
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=crdfd_tungay desc`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) {
            console.error("Error fetching personal registrations:", await response.text());
            return [];
        }

        const data = await response.json();
        return (data.value || []).map((item: PhieuDangKy & { [key: string]: unknown }) => ({
            ...item,
            employeeName: (item['_crdfd_nhanvien_value@OData.Community.Display.V1.FormattedValue'] as string) || "Unknown",
            employeeCode: undefined
        }));
    } catch (e) {
        console.error("Error calling Personal Registration API:", e);
        return [];
    }
}

/**
 * Create Phieu Dang Ky
 */
export async function createPhieuDangKy(
    accessToken: string,
    employeeId: string,
    data: {
        type: number;
        startDate: string;
        endDate: string;
        hours: number;
        reason?: string;
        approvalStatus: number;
        hinhThuc: number;
    }
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies`;

    const payload = {
        "crdfd_Nhanvien@odata.bind": `/crdfd_employees(${employeeId})`,
        "crdfd_loaiangky": data.type,
        "crdfd_tungay": data.startDate,
        "crdfd_enngay": data.endDate,
        "crdfd_diengiai": data.reason || "",
        "crdfd_captrenduyet": data.approvalStatus,
        "crdfd_sogio2": data.hours,
        "crdfd_hinhthuc": data.hinhThuc
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                ...createFetchHeaders(accessToken),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 204 || response.status === 201) {
            return true;
        } else {
            const errorText = await response.text();
            console.error("Error creating registration details:", response.status, errorText);
            throw new Error(`Dataverse Error (${response.status}): ${errorText}`);
        }
    } catch (e) {
        console.error("Exception creating registration:", e);
        return false;
    }
}

/**
 * Update Phieu Dang Ky
 */
export async function updatePhieuDangKy(
    accessToken: string,
    registrationId: string,
    data: {
        type?: number;
        startDate?: string;
        endDate?: string;
        hours?: number;
        reason?: string;
        quanLyTructiep?: string;
        capTrenDuyet?: number;
        hinhThuc?: number;
        soNgay?: number;
    }
): Promise<boolean> {
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies(${registrationId})`;

    const payload: Record<string, unknown> = {};
    if (data.type !== undefined) payload.crdfd_loaiangky = data.type;
    if (data.startDate !== undefined) payload.crdfd_tungay = data.startDate;
    if (data.endDate !== undefined) payload.crdfd_enngay = data.endDate;
    if (data.hours !== undefined && data.hours !== null) payload.crdfd_sogio2 = data.hours;
    if (data.reason !== undefined) payload.crdfd_diengiai = data.reason;
    if (data.quanLyTructiep !== undefined) payload.crdfd_quanlytructiep = data.quanLyTructiep;
    if (data.capTrenDuyet !== undefined) payload.crdfd_captrenduyet = data.capTrenDuyet;

    if (data.hinhThuc !== undefined && typeof data.hinhThuc === 'number' && !isNaN(data.hinhThuc)) {
        payload.crdfd_hinhthuc = data.hinhThuc;
    }

    if (data.soNgay !== undefined && data.soNgay !== null) payload.cr1bb_songay = data.soNgay;

    if (import.meta.env.DEV) {
        console.log("Updating Registration Payload:", JSON.stringify(payload));
    }

    try {
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                ...createFetchHeaders(accessToken),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 204) {
            return true;
        } else {
            const errorText = await response.text();
            console.error("Error updating registration:", response.status, errorText);
            return false;
        }
    } catch (e) {
        console.error("Exception updating registration:", e);
        return false;
    }
}

/**
 * Fetch registrations where the current user is the approver (quản lý trực tiếp)
 * Only fetches registrations within the selected month
 */
export async function fetchApproverRegistrations(
    accessToken: string,
    approverName: string,
    year?: number,
    month?: number
): Promise<TeamRegistration[]> {
    // Filter by approver name (text field crdfd_quanlytructiep)
    let filter = `statecode eq 0 and crdfd_quanlytructiep eq '${approverName}'`;

    if (year !== undefined && month !== undefined) {
        const startStr = formatDate(year, month, 1);
        const nextMonthDate = new Date(year, month + 1, 1);
        const startStrNext = formatDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);
        // Only fetch registrations within the selected month
        filter = `statecode eq 0 and crdfd_quanlytructiep eq '${approverName}' and crdfd_tungay ge ${startStr} and crdfd_tungay lt ${startStrNext}`;
    }

    const select = "crdfd_phieuangkyid,_crdfd_nhanvien_value,crdfd_loaiangky,crdfd_tungay,crdfd_enngay,crdfd_sogio2,crdfd_diengiai,crdfd_captrenduyet,crdfd_hinhthuc,crdfd_quanlytructiep,cr1bb_songay,cr1bb_sopheptonnamtruoc,new_sophepconlaitoithangthucte";
    const url = `${dataverseConfig.baseUrl}/crdfd_phieuangkies?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=crdfd_tungay desc`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeadersWithAnnotations(accessToken),
        });

        if (!response.ok) {
            console.error("Error fetching approver registrations:", await response.text());
            return [];
        }

        const data = await response.json();
        return (data.value || []).map((item: PhieuDangKy & { [key: string]: unknown }) => ({
            ...item,
            employeeName: (item['_crdfd_nhanvien_value@OData.Community.Display.V1.FormattedValue'] as string) || "Unknown",
            employeeCode: undefined
        }));
    } catch (e) {
        console.error("Error calling Approver Registration API:", e);
        return [];
    }
}
