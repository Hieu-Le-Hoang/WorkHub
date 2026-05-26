/**
 * Danh sách ngày lễ chính thức Việt Nam
 * Nguồn: Nghị định 90/2019/NĐ-CP và lịch âm hàng năm
 *
 * Format: 'YYYY-MM-DD'
 */

const VIETNAM_HOLIDAYS: Record<string, string> = {
    // ── 2025 ──────────────────────────────────────────
    '2025-01-01': 'Tết Dương lịch',
    '2025-01-25': 'Nghỉ Tết Nguyên Đán (29 tháng Chạp)',
    '2025-01-26': 'Nghỉ Tết Nguyên Đán (30 tháng Chạp)',
    '2025-01-27': 'Tết Nguyên Đán (Mùng 1)',
    '2025-01-28': 'Tết Nguyên Đán (Mùng 2)',
    '2025-01-29': 'Tết Nguyên Đán (Mùng 3)',
    '2025-01-30': 'Tết Nguyên Đán (Mùng 4)',
    '2025-01-31': 'Tết Nguyên Đán (Mùng 5)',
    '2025-04-07': 'Nghỉ bù Giỗ Tổ Hùng Vương',
    '2025-04-30': 'Ngày Giải phóng miền Nam',
    '2025-05-01': 'Ngày Quốc tế Lao động',
    '2025-09-01': 'Nghỉ bù Quốc khánh',
    '2025-09-02': 'Quốc khánh',

    // ── 2026 ──────────────────────────────────────────
    '2026-01-01': 'Tết Dương lịch',
    '2026-02-14': 'Nghỉ Tết Nguyên Đán (26 tháng Chạp)',
    '2026-02-15': 'Nghỉ Tết Nguyên Đán (27 tháng Chạp)',
    '2026-02-16': 'Nghỉ Tết Nguyên Đán (28 tháng Chạp)',
    '2026-02-17': 'Tết Nguyên Đán (Mùng 1)',
    '2026-02-18': 'Tết Nguyên Đán (Mùng 2)',
    '2026-02-19': 'Tết Nguyên Đán (Mùng 3)',
    '2026-02-20': 'Tết Nguyên Đán (Mùng 4)',
    '2026-02-21': 'Tết Nguyên Đán (Mùng 5)',
    '2026-03-26': 'Giỗ Tổ Hùng Vương (10/3 ÂL)',
    '2026-04-30': 'Ngày Giải phóng miền Nam',
    '2026-05-01': 'Ngày Quốc tế Lao động',
    '2026-09-02': 'Quốc khánh',
    '2026-09-03': 'Nghỉ bù Quốc khánh',

    // ── 2027 ──────────────────────────────────────────
    '2027-01-01': 'Tết Dương lịch',
    '2027-02-05': 'Nghỉ Tết Nguyên Đán (28 tháng Chạp)',
    '2027-02-06': 'Tết Nguyên Đán (Mùng 1)',
    '2027-02-07': 'Tết Nguyên Đán (Mùng 2)',
    '2027-02-08': 'Tết Nguyên Đán (Mùng 3)',
    '2027-02-09': 'Tết Nguyên Đán (Mùng 4)',
    '2027-02-10': 'Tết Nguyên Đán (Mùng 5)',
    '2027-04-15': 'Giỗ Tổ Hùng Vương (10/3 ÂL)',
    '2027-04-30': 'Ngày Giải phóng miền Nam',
    '2027-05-01': 'Ngày Quốc tế Lao động',
    '2027-09-02': 'Quốc khánh',
};

/**
 * Kiểm tra ngày có phải ngày lễ chính thức Việt Nam không
 * @param dateStr - Format 'YYYY-MM-DD'
 */
export function isVietnamHoliday(dateStr: string): boolean {
    return dateStr in VIETNAM_HOLIDAYS;
}

/**
 * Lấy tên ngày lễ (nếu có)
 * @param dateStr - Format 'YYYY-MM-DD'
 */
export function getHolidayName(dateStr: string): string | undefined {
    return VIETNAM_HOLIDAYS[dateStr];
}
