# WorkHub

**Last Updated**: 2026-06-22 11:31
**Last Reviewed**: 2026-06-22 11:31

> Internal web app quản lý hệ thống, chấm công, nghỉ phép và tools nội bộ — kết nối Dataverse qua MSAL Azure AD.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Vite 5 + React 18 |
| Language | TypeScript 5.3 (strict mode) |
| Styling | CSS custom properties (theme engine) + glassmorphism (`index.css` ~183KB) |
| Icons | `lucide-react` ^0.562 |
| Auth | `@azure/msal-browser` ^4.27 + `@azure/msal-react` ^3.0.23 |
| Data Source | Dataverse API (`wecare-ii.crm5.dynamics.com/api/data/v9.2`) |
| Charts | `recharts` ^3.8 |
| State | `zustand` (global) + `useState` (component-level) |
| Server State | `useApiData` hook (central fetch + cache engine, TTL 10 phút) |
| Pagination | `usePagination` hook (client-side, cho data < 200 items) |
| Notifications | `sonner` ^2.0.7 (toast) |
| Routing | `react-router-dom` ^7.13 |
| Virtualization | `@tanstack/react-virtual` ^3.13 |
| Excel | `xlsx-js-style` ^1.2 |
| Deploy | GitHub Pages (`base: /WorkHub/`) |

---

## Build Commands

```bash
yarn dev            # Vite dev server (port 5173)
yarn build          # tsc && vite build → dist/
yarn preview        # Preview built output locally
npx tsc --noEmit    # Type check only (không emit file)
```

---

## Environment Variables

| Variable | Required | Mô tả |
|----------|----------|--------|
| `VITE_CLIENT_ID` | ✅ | Azure AD App Registration Client ID |
| `VITE_AUTHORITY` | ❌ | Authority URL (default: `https://login.microsoftonline.com/common`) |
| `VITE_DATAVERSE_URL` | ✅ | Dataverse base URL |
| `VITE_DATAVERSE_ORG_URL` | ✅ | Dataverse org URL |
| `VITE_DATAVERSE_SCOPE` | ✅ | Dataverse OAuth scope |
| `VITE_AZURE_SUBSCRIPTION_ID` | ✅ | Azure subscription ID (cho Billing/Cost) |
| `VITE_PP_ENV_ID` | ✅ | Power Platform Environment ID |
| `VITE_TENANT_ID` | ✅ | Azure AD Tenant ID |
| `VITE_EMPLOYEE_ID` | ❌ | Default employee GUID cho dev |

> Xem `.env.example` để có đủ danh sách. **Không** commit `.env`.

---

## Authentication

- **Method**: MSAL `loginRedirect` → Azure AD (auto-login khi chưa auth)
- **Scopes chính**: `https://wecare-ii.crm5.dynamics.com/.default`
- **Multi-scope**: Power BI, Power Platform Admin, MS Graph (mỗi scope dùng `acquireToken()` riêng)
- **Cache**: `sessionStorage`
- **Flow**: Login → `localAccountId` → `systemuser` → `crdfd_employee` → `employeeId` (GUID)

---

## Architecture Diagram

> Lấy từ source code thực tế — routes, modules, data flow.

```mermaid
flowchart TD
    subgraph Entry["Entry Point"]
        main["main.tsx\n(MsalProvider)"] --> App["App.tsx\n(Router + Layout)"]
    end

    subgraph Auth["Auth Layer"]
        Config["config/authConfig.ts\n(MSAL config + scopes)"]
        Hook["useApiData hook\n(cache TTL 10 phút)"]
        Pagi["usePagination hook\n(client-side, <200 items)"]
    end

    subgraph Pages["Pages by Group"]
        Ops["Operations\nData · Reports · Fabric\nDataflow · Automate · Canvas\nConnections · AuditSettings"]
        Finance["Finance\nBilling · License"]
        Security["Security\nSecurityPage · AuditLog\nChangeLog · Compliance"]
        Settings["Settings\nHealth · Environment\nDomains · Backups"]
        Personal["Personal\nTimesheet · Calendar\nRegistration · Payment\nWorkSummary"]
    end

    subgraph Services["Service Layer"]
        Azure["services/azure/\n19 service files\n(PP · Graph · Cost · Flow...)"]
        DV["services/dataverse/\n8 domain files\n(chamCong · leave · auth...)"]
    end

    subgraph Backend["Backend"]
        Dataverse[("Dataverse\nwecare-ii.crm5")]
        AzureAPI[("Azure APIs\nCost · Graph · PBI")]
    end

    App --> Pages
    App --> Config
    Pages --> Hook
    Pages --> Pagi
    Hook --> Azure
    Hook --> DV
    Azure --> AzureAPI
    DV --> Dataverse
```

*Kiến trúc 3 lớp: Pages → useApiData/usePagination hooks → Service layer → APIs. Services tách thành 2 domain rõ ràng (azure/ + dataverse/).*

---

## Project Structure

```
src/
├── App.tsx                   # Root layout + routing (15KB)
├── main.tsx                  # Entry point — MsalProvider wrapper
├── index.css                 # Toàn bộ styling (~183KB — nguyên khối)
├── components/               # Page components (31 files)
│   ├── ui/                   # Atomic components (ConfirmDialog)
│   └── flow/                 # AutomateFlow sub-components (FlowOverview, FlowStructureViewer)
├── hooks/
│   ├── useApiData.ts         # Central fetch engine + cache (TTL 10 phút)
│   └── usePagination.ts      # Client-side pagination (< 200 items)
├── services/
│   ├── azure/                # 19 service files: PP, Graph, Cost, Flow analytics...
│   └── dataverse/            # 8 domain files: authService, chamCongService,
│                             #   dnttService, notificationService, registrationService...
├── config/                   # authConfig.ts — MSAL + scope configs
├── routes/                   # index.ts — Route constants + ROUTE_META
├── types/                    # TypeScript interfaces
├── context/                  # React Context providers
├── lib/                      # dateUtils.ts
├── styles/features/          # (đang trống — chuẩn bị CSS split)
├── constants/, data/, utils/
docs/
└── DESIGN.md                 # Design pattern chuẩn cho toàn bộ pages
```

---

## Features

### ✅ Dashboard
- Welcome greeting (dynamic từ MSAL) + date
- Stats grid (4 cards): Admin Systems, Active Tools, Pending Requests, This Month
- Quick Access links (6 portal cards): Power Platform, Azure, Google Admin, MS Entra, SharePoint, 365 Admin
- Design: glassmorphism stat-card + hover-glow

### ✅ Operations

| Page | Mô tả | API | Size |
|------|--------|-----|------|
| **DataPage** | Database & storage: Portals, Dataverse tables, Fabric tabs | Dataverse metadata | 868B |
| **ReportsPage** | Power BI gallery: search, gradient thumbnails, iframe embed | Power BI REST | 10KB |
| **FabricPage** | Microsoft Fabric — Workspace, items (Dataflow, Dataset, Report, Lakehouse) | Power BI API | 14KB |
| **DataflowPage** | Power Apps + Fabric dataflows — status, history, delete, schedule | PA Dataverse + PBI API | **60KB** |
| **AutomateFlowPage** | Power Automate flow list — Lightweight Health Check (~700 flows, ~20s) + flow analytics | Flow API + flowAnalyticsService | 38KB |
| **CanvasAppPage** | Canvas Apps list + status + delete | Power Apps API | 22KB |
| **ConnectionsPage** | Power Platform Connections — grouped by connector, status, delete | Power Apps API | 25KB |
| **AuditSettingsPage** | Dataverse Audit configuration — bật/tắt audit per table/column | Dataverse Metadata API | 22KB |

### ✅ Dev Tools
- Portal links: Stitch, GitHub, Figma, NPM, Project-Tracker
- PP management via Dataverse API

### ✅ Settings

| Page | Mô tả | API |
|------|--------|-----|
| **SystemHealthPage** | MS Graph Service Health — service status, active issues | MS Graph |
| **EnvironmentPage** | Power Platform environments list | PP Admin API |
| **DomainsPage** | Domain records | MS Graph Domains |
| **BackupsPage** | Environment backup info + retention | BAP Admin API |

### ✅ Finance

| Page | Mô tả | API |
|------|--------|-----|
| **BillingPage** | Azure Cost Management — daily costs, top resources, service breakdown, charts | Azure Cost REST |
| **LicensePage** | MS Graph `subscribedSkus` — SKU details, assigned/total seats | MS Graph |

### ✅ Security & Compliance

| Page | Mô tả | API | Status |
|------|--------|-----|--------|
| **SecurityPage** | Risky users, security alerts | MS Graph Security | ✅ Done |
| **LogsPage** (Audit Log) | Dataverse Audit logs — cursor-based pagination | Dataverse | ✅ Done |
| **SignIn Log** | Azure AD Sign-in logs | — | 🚧 Placeholder |
| **ChangeLog** | Changelog viewer — sẽ tích hợp GitHub API | GitHub API | 🚧 Placeholder |
| **Incidents** | Incident management | — | 🚧 Placeholder |
| **Compliance** | Compliance dashboard | — | 🚧 Placeholder |

### ✅ Personal

| Page | Mô tả | API |
|------|--------|-----|
| **Timesheet (Calendar)** | Calendar chấm công + WorkSummary | Dataverse / chamCongService |
| **DayDetail** | Chi tiết ngày làm việc (modal/drawer) | Dataverse |
| **LeaveDashboard** | Đăng ký nghỉ phép — team view, approver view | Dataverse |
| **Registration** | Đăng ký (ra vào, OT...) | Dataverse / registrationService |
| **Payment** | Đề nghị thanh toán | Dataverse / dnttService |

---

## Design System

> **Tài liệu chuẩn**: `docs/DESIGN.md`

### Rules cốt lõi (BẮT BUỘC)

1. **Root container**: `<div className="health-page">` — tất cả pages
2. **Font**: CSS classes (`billing-stat-label`, `billing-table-type`, v.v.) — **không inline `fontSize` bằng px**
3. **Font scale cho phép**: `0.65rem`, `0.72rem`, `0.75rem`, `0.85rem`, `1rem`, `1.1rem`, `1.5rem`
4. **Data loading**: `useApiData` hook — **không tự manage useState + useEffect fetch**
5. **Ngoại lệ**: LogsPage (cursor pagination = Pattern B), AuditSettingsPage (lazy detail fetch)

### CSS Tokens chính

| Token | Value |
|-------|-------|
| Background | `#09090b` |
| Surface | `rgba(24,24,27,0.85)` + `backdrop-filter: blur(12px)` |
| Accent | `#a78bfa` (violet) |
| Font body | Inter |
| Font heading | Lexend |
| Border | `rgba(255,255,255,0.08)` |
| Card radius | 12px |

---

## Data Loading Patterns

### Pattern A — `useApiData` (mặc định, data < 5k rows)

```tsx
const { data, loading, error, refresh: loadData } = useApiData<T>({
    key: 'unique_cache_key',   // unique per page/tab
    fetcher: async () => { ... },
    enabled: isAuthenticated && accounts.length > 0,
    initialData: [] as T[],
    ttl: 600000,               // 10 phút (default)
});
```

### Pattern B — Cursor Pagination (data > 5k / server-side paging)

- Dùng `useReducer` với `currentPage`, `nextLink`, `history[]`
- Ví dụ: `LogsPage.tsx` (Audit logs — server-side cursor)

### Pattern C — `usePagination` (client-side, data < 200 items)

```tsx
const { items, page, totalPages, next, prev, goTo, hasNext, hasPrev } = usePagination(allItems, 20);
```

- Dùng khi data đã load hết vào memory
- Default page size: 20 items

---

## Known Issues & Negative Decisions

| Issue | Chi tiết | Workaround |
|-------|---------|------------|
| `index.css` nguyên khối | ~183KB, khó maintain | Tạm chấp nhận — `styles/features/` đã tạo sẵn slot để split sau |
| Recharts tooltip `fontSize: '11px'` | Library prop, không thể thay class | **Ngoại lệ hợp lý** — không vi phạm DESIGN.md |
| Zustand vẫn ít dùng | Phần lớn state là local `useState` | OK — không cần global state phức tạp ở WorkHub |
| Security/Compliance pages | SignInLog, Incidents, Compliance, ChangeLog chưa có API | Placeholder — cần xác định API source |
| `DataflowPage.tsx` 60KB | File lớn nhất project — nhiều logic phức tạp (tabs, history, schedule) | Tạm chấp nhận — refactor sau khi stable |

### ❌ Không làm
- **Không split `index.css`** khi đang active dev — nguy cơ break styles cao, làm sau milestone stable
- **Không migrate LogsPage/AuditSettingsPage sang useApiData** — 2 page này có logic pagination/lazy-fetch đặc thù không phù hợp Pattern A
- **Không dùng Tailwind cho layout chính** — Design system dùng CSS custom properties với dark theme phức tạp — Tailwind không đủ flexible cho glassmorphism

---

## Current Status

**Phase**: Active Development — Security section đang expand, 4 placeholder pages cần implement

### Đã hoàn thành
- ✅ `services/dataverse/` refactor hoàn tất — tách thành 8 domain files
- ✅ `services/azure/` đầy đủ 19 service files — tách clean theo domain
- ✅ Tạo `docs/DESIGN.md` — tài liệu chuẩn UI/UX cho toàn project
- ✅ Audit & fix font violations trên **tất cả pages** — thay `px` → `rem` hoặc CSS class
- ✅ Tất cả pages đã dùng `health-page` root container
- ✅ Personal section mở rộng: DayDetail, NotificationPanel, LeaveDetailModal, LeaveStats, LeaveList, Registration, Payment
- ✅ Security section mở rộng: SignIn Log, ChangeLog, Incidents, Compliance routes (placeholder)
- ✅ `flowAnalyticsService.ts` (18KB) — analytics cho AutomateFlowPage
- ✅ `dvAuditService.ts` — Dataverse Audit service riêng biệt
- ✅ `usePagination.ts` — client-side pagination hook mới

### Blockers hiện tại
- 4 Security pages (SignInLog, Incidents, Compliance, ChangeLog) chưa xác định API source → đang là placeholder
- `DataflowPage.tsx` 60KB — lớn nhất project, cần review refactor sau milestone stable

---

## Next Steps

- [ ] **SignIn Log page** — implement Azure AD Sign-in logs (MS Graph `auditLogs/signIns`)
- [ ] **AutomateFlowPage** — kiểm tra filter UI align DESIGN.md không (38KB)
- [ ] **ManagementView.tsx** — 19KB, review design pattern alignment
- [ ] **Incidents & Compliance pages** — xác định API source và implement
- [ ] **ChangeLog page** — integrate GitHub API (`/orgs/WCG-HieuLe/repos` releases)
- [ ] **Audit `index.css`** — tìm và xóa các class dead code (cleanup, low risk)
- [ ] **`styles/features/`** — bắt đầu migrate CSS theo feature module (sau milestone stable)
- [ ] **Build production** — chạy `yarn build` và verify không có TypeScript error

---

## Quyết Định Thiết Kế

| Quyết định | Lý do |
|------------|-------|
| **Dùng `useApiData` thay useState+useEffect** | Cache TTL 10 phút, tránh re-fetch dư thừa khi switch tab, consistent error handling |
| **Thêm `usePagination` hook riêng** | Tách biệt client-side pagination (< 200 items) khỏi Pattern B (server-side cursor) — reusable, không lặp logic |
| **Giữ `index.css` nguyên khối** | Mọi component share CSS variables — split sẽ cần import chains phức tạp, risk cao |
| **Không dùng Tailwind cho layout chính** | Design system dùng CSS custom properties với dark theme phức tạp — Tailwind không đủ flexible cho glassmorphism |
| **Pattern B cho LogsPage** | Audit logs có thể > 100k records, cursor pagination là cách duy nhất feasible |
| **Recharts cho charts thay vì D3** | Recharts React-native, ít boilerplate, đủ cho nhu cầu cost dashboard hiện tại |
| **`rem` thay `px` cho font** | Respect user font preference, consistent scaling, DESIGN.md standard |
| **Tách `services/dataverse/` thành domain files** | Thay vì 1 file 73KB, mỗi domain (chamCong, leave, auth...) có service riêng — dễ maintain, tree-shakeable |
| **`loginRedirect` thay `loginPopup`** | Popup bị chặn trên một số browser — redirect flow reliable hơn cho production |
| **`styles/features/` tạo sẵn** | Chuẩn bị slot cho CSS split tương lai — không force migrate ngay khi đang active dev |
