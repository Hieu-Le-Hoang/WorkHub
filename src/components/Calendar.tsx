import React, { useMemo, useCallback } from 'react';
import { DayRecord } from '@/types/types';
import {
    getDaysInMonth,
    getDayOfWeek,
    formatDate
} from '@/utils/workUtils';
import { isVietnamHoliday, getHolidayName } from '@/constants/vietnamHolidays';

interface CalendarProps {
    year: number;
    month: number;
    records: DayRecord[];
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
}

export const Calendar: React.FC<CalendarProps> = React.memo(({
    year,
    month,
    records,
    selectedDate,
    onSelectDate
}) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = getDayOfWeek(year, month, 1);
    const today = useMemo(() => new Date(), []);
    const todayStr = useMemo(() => formatDate(today.getFullYear(), today.getMonth(), today.getDate()), [today]);

    // Tạo map từ date -> record (memoized)
    const recordMap = useMemo(() => {
        const map = new Map<string, DayRecord>();
        records.forEach(r => map.set(r.date, r));
        return map;
    }, [records]);

    // Tạo mảng các ngày hiển thị (memoized)
    const calendarDays = useMemo<(number | null)[]>(() => {
        const days: (number | null)[] = [];
        // Thêm các ô trống cho đầu tháng
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }
        // Thêm các ngày trong tháng
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }
        return days;
    }, [firstDayOfWeek, daysInMonth]);

    const getDayClass = useCallback((day: number | null): string => {
        if (day === null) return 'calendar-day empty';

        const dateStr = formatDate(year, month, day);
        const record = recordMap.get(dateStr);
        const dayOfWeek = getDayOfWeek(year, month, day);
        const date = new Date(year, month, day);

        let classes = ['calendar-day'];

        if (dateStr === selectedDate) classes.push('selected');
        if (dateStr === todayStr) classes.push('today');

        // Ngày CN
        if (dayOfWeek === 0) {
            classes.push('off-day');
        } else if (isVietnamHoliday(dateStr)) {
            // Ngày lễ — check trước cả tương lai
            classes.push('holiday');
        } else if (date > today) {
            classes.push('future');
        } else if (record) {
            if (record.status === 'leave') {
                classes.push('leave');
            } else if (record.status === 'holiday') {
                classes.push('holiday');
            } else if (record.status === 'late') {
                classes.push('late');
            } else if (record.status === 'warning') {
                classes.push('warning');
            } else if (record.workValue < (dayOfWeek === 6 ? 0.5 : 1.0)) {
                // Kiểm tra workValue thay vì hoursWorked để bao gồm phiếu đăng ký đã duyệt
                classes.push('insufficient');
            } else {
                classes.push('normal');
            }
        }

        return classes.join(' ');
    }, [year, month, selectedDate, todayStr, recordMap]);

    const formatTime = useCallback((timeStr?: string) => {
        if (!timeStr) return '--:--';
        // Check if ISO string or Date string
        if (timeStr.includes('T') || timeStr.includes('-')) {
            try {
                const date = new Date(timeStr);
                return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
            } catch {
                return timeStr.substring(0, 5);
            }
        }
        // Assume simple time string like "08:00:00"
        return timeStr.substring(0, 5);
    }, []);

    return (
        <div className="calendar">
            <div className="calendar-header">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                    <div key={day} className="calendar-header-cell">
                        {day}
                    </div>
                ))}
            </div>
            <div className="calendar-grid">
                {calendarDays.map((day, index) => {
                    const dateStr = day ? formatDate(year, month, day) : '';
                    const record = day ? recordMap.get(dateStr) : null;


                    return (
                        <div
                            key={index}
                            className={getDayClass(day)}
                            onClick={() => day && onSelectDate(dateStr)}
                        >
                            {day && (
                                <>
                                    <div className="day-top">
                                        <span className="day-number">{day}</span>
                                        {record && (record.checkIn || record.checkOut) && (
                                            <div className="time-display">
                                                <div className="time-row">
                                                    <span className="time-label">In:</span>
                                                    <span className="time-val">{formatTime(record.checkIn)}</span>
                                                </div>
                                                <div className="time-row">
                                                    <span className="time-label">Out:</span>
                                                    <span className="time-val">{formatTime(record.checkOut)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="day-badges">
                                        {record && record.hoursWorked > 0 && (
                                            <span className="hours-badge">{record.hoursWorked}h</span>
                                        )}
                                        {/* Badge ngày lễ — hiện cả khi không có record */}
                                        {isVietnamHoliday(dateStr) && (
                                            <span
                                                className="status-badge holiday"
                                                title={getHolidayName(dateStr)}
                                            >
                                                Lễ
                                            </span>
                                        )}
                                        {record && record.status === 'leave' && (
                                            <span className="status-badge leave">Phép</span>
                                        )}
                                        {record && record.status === 'late' && (
                                            <span className="status-badge late">Trễ</span>
                                        )}
                                        {record && record.status === 'warning' && (
                                            <span className="status-badge warning" title="Thiếu check-in/out hoặc giờ bất thường">⚠️</span>
                                        )}
                                        {/* Badge thiếu công — chưa có phiếu đăng ký */}
                                        {record && record.status !== 'holiday' && !isVietnamHoliday(dateStr) &&
                                            record.workValue < (getDayOfWeek(year, month, day!) === 6 ? 0.5 : 1.0) &&
                                            !record.registration && (
                                                <span
                                                    className="status-badge insufficient-warn"
                                                    title="Thiếu giờ — click để tạo phiếu"
                                                >
                                                    ⚠️
                                                </span>
                                            )}
                                        {record && record.registration && (
                                            <span className="status-badge registration" title={record.registration.typeName}>📝</span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="calendar-legend">
                <div className="legend-item">
                    <span className="legend-color normal"></span>
                    <span>Đủ công</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color insufficient"></span>
                    <span>Thiếu giờ</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color warning"></span>
                    <span>Cảnh báo</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color late"></span>
                    <span>Đi trễ</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color leave"></span>
                    <span>Nghỉ phép</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color off-day"></span>
                    <span>Nghỉ</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color holiday"></span>
                    <span>Ngày lễ</span>
                </div>
            </div>
        </div>
    );
});
