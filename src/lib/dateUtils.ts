/**
 * dateUtils.ts
 * Dataverse lưu datetime ở UTC+0, Vietnam timezone là UTC+7.
 * Các hàm này convert UTC → UTC+7 cho display.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // 7 giờ tính bằng ms

/**
 * Convert UTC ISO string → local datetime-local input value (UTC+7)
 * Input:  "2026-04-28T01:00:00Z"
 * Output: "2026-04-28T08:00"   (dùng cho <input type="datetime-local">)
 */
export function utcToVnInputValue(utcStr?: string | null): string {
    if (!utcStr) return '';
    const date = new Date(utcStr);
    if (isNaN(date.getTime())) return '';
    const vnDate = new Date(date.getTime() + VN_OFFSET_MS);
    // Format: YYYY-MM-DDTHH:mm
    return vnDate.toISOString().substring(0, 16);
}

/**
 * Format UTC ISO string → date only (UTC+7)
 * Input:  "2026-04-28T01:00:00Z"
 * Output: "28/04/2026"
 */
export function formatDateVN(utcStr?: string | null): string {
    if (!utcStr) return '-';
    const date = new Date(utcStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
