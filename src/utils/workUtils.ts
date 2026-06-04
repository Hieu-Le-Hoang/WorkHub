import { DayRecord, MonthSummary } from '@/types/types';
import { isVietnamHoliday } from '@/constants/vietnamHolidays';

/**
 * Lấy số ngày trong tháng
 */
export function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Lấy thứ trong tuần (0 = CN, 6 = T7)
 */
export function getDayOfWeek(year: number, month: number, day: number): number {
    return new Date(year, month, day).getDay();
}

/**
 * Kiểm tra ngày có phải là ngày làm việc không và trả về công chuẩn
 * T2-T6: 1 công (8 giờ)
 * T7: 0.5 công (4 giờ sáng)
 * CN: 0 công
 */
export function getStandardWorkValue(dayOfWeek: number): number {
    if (dayOfWeek === 0) return 0;      // Chủ nhật
    if (dayOfWeek === 6) return 0.5;    // Thứ 7 (chỉ sáng)
    return 1;                            // T2 - T6
}

/**
 * Lấy số giờ chuẩn cần làm cho ngày đó
 */
export function getStandardHours(dayOfWeek: number): number {
    if (dayOfWeek === 0) return 0;      // Chủ nhật
    if (dayOfWeek === 6) return 4;      // Thứ 7: 4 giờ sáng
    return 8;                            // T2 - T6: 8 giờ
}

/**
 * Tính tổng công chuẩn trong tháng
 */
export function getStandardWorkDays(year: number, month: number): number {
    const daysInMonth = getDaysInMonth(year, month);
    let total = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dayOfWeek = getDayOfWeek(year, month, day);
        total += getStandardWorkValue(dayOfWeek);
    }

    return total;
}

/**
 * Tính tổng công thực tế từ records
 */
export function getActualWorkDays(records: DayRecord[]): number {
    return records.reduce((total, record) => total + record.workValue, 0);
}

/**
 * Lấy danh sách các ngày làm việc không đủ giờ
 */
export function getInsufficientDays(
    records: DayRecord[],
    year: number,
    month: number
): DayRecord[] {
    return records.filter(record => {
        // Safe parsing of YYYY-MM-DD
        const parts = record.date.split('-').map(Number);
        if (parts.length < 3) return false;

        const rYear = parts[0];
        const rMonth = parts[1] - 1; // 0-indexed
        const rDay = parts[2];

        if (rYear !== year || rMonth !== month) return false;

        const date = new Date(rYear, rMonth, rDay);
        const dayOfWeek = date.getDay();
        const standardHours = getStandardHours(dayOfWeek);

        // Chỉ kiểm tra ngày làm việc (không phải CN)
        if (standardHours === 0) return false;

        // Ngày nghỉ phép hoặc off không tính là thiếu giờ
        if (record.status === 'leave' || record.status === 'off' || record.status === 'holiday') {
            return false;
        }

        // Kiểm tra theo workValue (bao gồm cả công từ phiếu đăng ký đã duyệt)
        const standardWorkValue = getStandardWorkValue(dayOfWeek);

        // workValue >= chuẩn → coi như đủ công (phiếu bổ sung đủ giờ)
        if (record.workValue >= standardWorkValue) {
            return false;
        }

        // Vẫn thiếu giờ (dù có phiếu DiTreVeSom hay không)
        return record.hoursWorked < standardHours;
    });
}

/**
 * Tính toán summary cho tháng
 */
export function calculateMonthSummary(
    records: DayRecord[],
    year: number,
    month: number
): MonthSummary {
    const monthRecords = records.filter(r => {
        const parts = r.date.split('-').map(Number);
        if (parts.length < 3) return false;
        return parts[0] === year && (parts[1] - 1) === month;
    });

    return {
        standardDays: getStandardWorkDays(year, month),
        actualDays: getActualWorkDays(monthRecords),
        insufficientDays: getInsufficientDays(monthRecords, year, month)
    };
}

/**
 * Format date thành YYYY-MM-DD
 */
export function formatDate(year: number, month: number, day: number): string {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

/**
 * Lấy tên thứ trong tuần
 */
export function getDayName(dayOfWeek: number): string {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[dayOfWeek];
}

/**
 * Lấy giờ phút từ chuỗi ISO (HH:MM)
 */
export function getTimeFromISO(isoStr?: string): string {
    if (!isoStr) return '';
    if (isoStr.match(/^\d{1,2}:\d{2}/)) {
        const parts = isoStr.split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1]}`;
    }

    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Tính số giờ làm thực tế từ và ra
 */
export function calculateActualHours(inT: string, outT: string, standardHours: number = 8, capped: boolean = true): number {
    if (!inT || !outT) return 0;
    try {
        const [h1, m1] = inT.split(':').map(Number);
        const [h2, m2] = outT.split(':').map(Number);

        let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (totalMinutes < 0) totalMinutes += 24 * 60;

        const rawHours = parseFloat((totalMinutes / 60).toFixed(1));

        if (capped) {
            return Math.min(rawHours, standardHours);
        }
        return rawHours;
    } catch (e) {
        return 0;
    }
}

// ─────────────────────────────────────────────
// Attendance Alert (30-day rolling check)
// ─────────────────────────────────────────────

export type AlertLevel = 'missing' | 'no-checkin' | 'insufficient';

export interface AttendanceAlert {
    date: string;          // YYYY-MM-DD
    level: AlertLevel;
    label: string;         // Mô tả ngắn để hiển thị
    hoursWorked?: number;
    standardHours?: number;
}

/**
 * Quét 30 ngày rolling kể từ hôm nay trở về trước.
 * Trả về danh sách ngày có vấn đề chấm công, sắp xếp mới → cũ.
 */
export function getAttendanceAlerts(
    records: DayRecord[],
    days: number = 30
): AttendanceAlert[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build map để tra cứu nhanh
    const recordMap = new Map<string, DayRecord>();
    records.forEach(r => recordMap.set(r.date, r));

    const alerts: AttendanceAlert[] = [];

    for (let i = 1; i <= days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);

        const dayOfWeek = date.getDay();
        // Bỏ qua CN (0)
        if (dayOfWeek === 0) continue;

        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const dateStr = formatDate(year, month, day);

        // Bỏ qua ngày lễ
        if (isVietnamHoliday(dateStr)) continue;
        const record = recordMap.get(dateStr);

        // ── Case 1: Không có record nào ──
        if (!record) {
            const stdH = getStandardHours(dayOfWeek);
            alerts.push({
                date: dateStr,
                level: 'missing',
                label: 'Không có dữ liệu chấm công',
                standardHours: stdH,
            });
            continue;
        }

        // Bỏ qua ngày đã được giải quyết: nghỉ phép, off, lễ
        if (record.status === 'leave' || record.status === 'off' || record.status === 'holiday') {
            continue;
        }

        // Đã có phiếu đăng ký → người dùng đã xử lý, bỏ qua mọi loại alert
        if (record.registration) {
            continue;
        }

        // ── Case 2: Thiếu check-in hoặc check-out ──
        const hasCheckIn = !!record.checkIn && record.checkIn !== '00:00:00';
        const hasCheckOut = !!record.checkOut && record.checkOut !== '00:00:00';

        if (!hasCheckIn || !hasCheckOut) {
            const missing = !hasCheckIn && !hasCheckOut
                ? 'Thiếu check-in & check-out'
                : !hasCheckIn ? 'Thiếu check-in' : 'Thiếu check-out';
            alerts.push({
                date: dateStr,
                level: 'no-checkin',
                label: missing,
                hoursWorked: record.hoursWorked,
                standardHours: getStandardHours(dayOfWeek),
            });
            continue;
        }

        // ── Case 3: Thiếu giờ + chưa có phiếu ──
        const standardWorkValue = getStandardWorkValue(dayOfWeek);
        if (record.workValue < standardWorkValue && !record.registration) {
            const stdH = getStandardHours(dayOfWeek);
            alerts.push({
                date: dateStr,
                level: 'insufficient',
                label: `Thiếu giờ (${record.hoursWorked}h/${stdH}h)`,
                hoursWorked: record.hoursWorked,
                standardHours: stdH,
            });
        }
    }

    return alerts;
}

