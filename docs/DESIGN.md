---
type: Guideline
title: WorkHub Admin Page — Design Pattern
description: Hướng dẫn và tiêu chuẩn thiết kế UI/UX cho toàn bộ các trang trong hệ thống WorkHub
timestamp: 2026-04-25T00:00:00Z
owner: Hiếu Lê
status: active
---

# WorkHub Admin Page — Design Pattern

> Template chuẩn cho tất cả admin/management pages trong WorkHub.
> **Last Updated**: 2026-04-25

---

## Layout Structure (top → bottom)

```
┌─────────────────────────────────────────────────┐
│  [Stat Card 1]  [Stat Card 2]  [Stat Card 3]   │  ← 3-4 cards, horizontal row
├─────────────────────────────────────────────────┤
│  [Tab1] [Tab2] [Tab3] [Portals]    < 1/5 > 🔍 ↻│  ← Tabs left, pagination + search + refresh right
├─────────────────────────────────────────────────┤
│  Data Table (scrollable, ~50 rows)              │  ← Compact rows, status badges
│  ...                                            │
└─────────────────────────────────────────────────┘
```

## Key UX Rules

| Rule | Detail |
|------|--------|
| **Rows per page** | 20 (scrollable), tăng lên nếu cần |
| **Pagination vị trí** | **Top-right**, cạnh Search + Refresh — KHÔNG để dưới bảng |
| **Lazy tab loading** | Chỉ fetch data khi click tab, cache loaded state |
| **Tab cuối = Portals** | External links gom vào tab riêng, không để dưới cùng |
| **Search/Pagination** | Chỉ hiện ở data tabs (ẩn ở Portals/static tabs) |
| **Compact margins** | Minimal spacing giữa sections |

---

## Font & Typography Scale ✅

> **Quan trọng**: Dùng CSS classes có sẵn — không hardcode inline fontSize.

| Level | CSS Class / Token | Giá trị | Dùng cho |
|---|---|---|---|
| Label muted | `.billing-stat-label` | `0.65rem` | Stat card labels, section labels |
| Body small | `.billing-table-type` | `0.72rem` | Table secondary info, badges |
| Body | `.billing-section h3` | `0.85rem` | Section headings |
| Stat value | `.billing-stat-value` | `1.1rem` | Số liệu thống kê |
| Card heading | `.management-card h3` | `var(--heading-font-size)` = 20px | Portal card titles |
| Font body | `Inter` | — | Tất cả text |
| Font heading | `Lexend` | — | Chỉ dùng qua CSS class `.management-card h3` |

### ❌ Không được làm
```tsx
// ❌ WRONG — hardcode pixel hoặc inline rem lẻ
<span style={{ fontSize: '11px' }}>...</span>
<span style={{ fontSize: '0.62rem' }}>...</span>

// ✅ ĐÚNG — dùng CSS class hoặc var()
<span className="billing-stat-label">...</span>
<span style={{ fontSize: '0.75rem' }}>...</span>  // chỉ khi không có class phù hợp
```

### Unit chuẩn
- **rem** — luôn dùng rem, không dùng px (trừ nội dung monospace/code trong detail sidebar)
- **Scale cho phép**: `0.65rem`, `0.72rem`, `0.75rem`, `0.85rem`, `1rem`, `1.1rem`, `1.5rem`

---

## Data Loading Pattern (useApiData) ✅

> **Bắt buộc**: Tất cả pages phải dùng `useApiData` hook, không tự quản lý useState fetch.

```tsx
import { useApiData } from '@/hooks/useApiData';

const { data, loading, error, refresh: loadData } = useApiData<MyType | null>({
    key: 'unique_cache_key',          // snake_case, unique per page/tab
    fetcher: async () => {
        const token = await acquireToken(instance, accounts[0], scopes);
        return await fetchMyData(token);
    },
    enabled: isAuthenticated && accounts.length > 0,
    initialData: null,
    ttl: 600000,                       // 10 phút (default, optional)
});
```

### Destructuring conventions
```tsx
// ✅ Chuẩn — alias refresh thành loadData
const { data, loading, error, refresh: loadData } = useApiData<T>({ ... });

// ✅ Khi cần setData (optimistic update / filter client-side)
const { data: apiData, loading, error, refresh: loadData, setData } = useApiData({ ... });

// ✅ Multiple data sources trong cùng page
const { data: paData,     loading: paLoading,     refresh: loadPA }     = useApiData({ key: 'pa_flows', ... });
const { data: fabricData, loading: fabricLoading, refresh: loadFabric } = useApiData({ key: 'fabric',   ... });
```

### Cache key naming
| Pattern | Ví dụ |
|---|---|
| `{resource}_{userId}` | `license_summary_abc123` |
| `{resource}` (global) | `billing_dashboard`, `health_status` |
| `{resource}_{tab}` | `logs_signin`, `logs_audit` |

### Loading states
```tsx
// ✅ Skeleton/loading placeholder — giữ layout ổn định
{loading && !data && (
    <div className="billing-loading">
        <div className="spinner" />
        <p>Đang tải...</p>
    </div>
)}

// ✅ Refresh indicator (có data rồi, đang refresh ngầm)
{refreshing && <span className="text-muted">↻ Đang cập nhật...</span>}
```

---

## Stat Cards

- Label on top (small, muted)
- Large number value below
- Icon badge top-right (colored circle background + Lucide icon)
- Colors: Purple `#8b5cf6`, Green `#10b981`, Blue `#3b82f6`, Amber `#f59e0b`

## Tab Bar

- Active tab: violet border-bottom + background highlight
- Right actions area: `[< 1/5 >]` `[🔍 Filter]` `[↻]`
- Pagination compact: chỉ icon chevron + page/total

## Data Table

- Semi-transparent rows on dark background
- Hover: subtle violet glow `rgba(167,139,250,0.05)`
- Status badges: colored pills (green success, amber warning, red error)
- Date format: `vi-VN` locale
- No row borders — clean separator via alternating opacity

## Portal Cards (tab cuối)

- 3-column grid
- Each card: Icon + Title + Description + External link arrow
- Glassmorphism border + hover glow

---

## CSS Tokens Reference

| Token | Value |
|-------|-------|
| Background | `#09090b` |
| Surface | `rgba(24,24,27,0.85)` + `blur(12px)` |
| Border | `rgba(255,255,255,0.08)` |
| Accent | `#a78bfa` (violet) |
| Font body | Inter |
| Font heading | Lexend |
| Base font size | 16px |
| Card radius | 12px |
| Button radius | 8px |
| Hover glow | `box-shadow: 0 0 20px rgba(167,139,250,0.15)` |

## CSS Classes (existing)

| Class | Usage |
|-------|-------|
| `.health-page` | **Page wrapper** (root container — bắt buộc) |
| `.billing-stats` | Stat cards container (grid auto-fit) |
| `.billing-stat-card` | Individual stat card |
| `.billing-stat-label` | Stat card label — `0.65rem` muted |
| `.billing-stat-value` | Stat card value — `1.1rem` bold |
| `.billing-stat-sub` | Stat card sub-value — `0.78rem` accent |
| `.billing-section` | Content section wrapper (glassmorphism) |
| `.billing-section-header` | Section title + actions row |
| `.billing-charts-row` | 2-col chart layout (2fr 1fr, responsive) |
| `.billing-table-wrapper` | Table scroll wrapper |
| `.billing-table` | Data table |
| `.billing-table-name` | Primary cell — bold, truncate |
| `.billing-table-type` | Secondary cell — `0.72rem` muted |
| `.billing-table-cost` | Cost cell — accent color, bold |
| `.billing-table-share` | Progress bar cell |
| `.billing-share-bar` / `.billing-share-fill` | Progress bar |
| `.billing-refresh-btn` | Icon refresh button (28px) |
| `.billing-error` | Error banner |
| `.billing-loading` | Loading state (centered) |
| `.logs-tabs` / `.logs-tab` | Tab bar |
| `.logs-tab.active` | Active tab state |
| `.reports-header` | Tab bar + actions row |
| `.reports-header-actions` | Right-side controls container |
| `.reports-search` / `.reports-search-input` | Search input |
| `.pagination-bar` | Inline pagination (`< 1/5 >`) |
| `.management-grid` | Portal link cards grid |
| `.management-card` | Portal link card |
| `.management-card-icon` | Icon container (60px) |
| `.management-card-content` | Text content wrapper |
| `.management-card-arrow-container` | External link arrow |
| `.license-status-badge` | Colored status pill |
| `.detail-sidebar-overlay` | Dark backdrop |
| `.detail-sidebar` | Fixed right panel (420px) |
| `.detail-sidebar-header` | Title + close |
| `.detail-sidebar-body` | Scrollable content |
| `.detail-section` / `.detail-section-title` | Section grouping |
| `.detail-meta-grid` / `.detail-meta-item` | 2-col metadata grid |

---

## Row Detail Pattern: Right Sidebar

Click bất kỳ row nào → slide-in panel từ phải, hiển thị full metadata + related data.

| Element | Detail |
|---------|--------|
| **Trigger** | Click row (`cursor: pointer`, highlight on hover) |
| **Panel width** | 420px, slide-in animation 0.2s |
| **Overlay** | Dark overlay, click to close |
| **Header** | Title + X close button |
| **Body** | Scrollable, 3 sections: Metadata Grid → Related Items → Users |
| **Lazy fetch** | Detail data fetched on click, loading spinner in panel |

---

## Implementation Checklist (new page)

1. Root container: `<div className="health-page">`
2. Stats: `<div className="billing-stats">` → `<div className="billing-stat-card">`
3. Data: `useApiData` hook — **không dùng useState tự quản lý**
4. Font: CSS classes — **không inline `fontSize` bằng px**
5. Tabs: `.logs-tabs` + `.logs-tab` + `.logs-tab.active`
6. Table: `.billing-table-wrapper` + `.billing-table`
7. Portals: `.management-grid` + `.management-card` (tab cuối)
8. Add route in `routes/index.ts`

---

## Stitch Prompt Template

```
Admin dashboard page called '[PAGE_NAME]' for [PURPOSE].
Dark theme with glassmorphism panels (#09090b background, frosted glass cards with blur).

Layout:
- Top: [N] stat cards in horizontal row — [Card1] ([color] icon), [Card2]...
  Each card: label on top, large number below, colored icon badge top-right.
- Tab bar with [N] tabs — [Tab1], [Tab2], ..., Portals.
  Active tab violet highlight. Right side: compact < 1/5 > pagination, search input, refresh button.
- Data table: semi-transparent rows, hover glow, 50 rows scrollable.
  Status badges as colored pills (green/amber/red).
- Portals tab: [N] link cards in grid with icon, title, description, external arrow.

Tokens: Inter 13px, violet #a78bfa, border rgba(255,255,255,0.08),
radius 12px cards / 8px buttons, hover glow violet 0.15 opacity.
No device frames. Desktop layout. No sidebar.
```
