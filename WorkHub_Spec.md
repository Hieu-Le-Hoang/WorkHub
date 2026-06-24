---
type: Specification
title: WorkHub — App Specification
description: Đặc tả chi tiết giao diện, sidebar và các module chức năng của WorkHub
timestamp: 2026-06-24T11:00:00Z
owner: Hiếu Lê
status: active
---

# WorkHub — App Specification

> Internal admin dashboard cho Tech Lead, gom tất cả công việc giám sát và vận hành hệ thống vào 1 nơi.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Vite + React + TypeScript |
| Styling | Tailwind CSS |
| Auth | MSAL.js (Azure AD SSO) |
| State | Zustand + TanStack Query |
| Routing | React Router v6 |
| Deploy | GitHub Pages / Azure Static Web Apps |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  WorkHub React App                │
│              Auth: MSAL.js (Azure AD SSO)         │
├──────────────────────────────────────────────────┤
│  📡 REST API           🔗 Portal Links            │
│  Azure Cost Management  Azure Portal              │
│  MS Graph API           Entra ID                   │
│  Dataverse Web API      GitHub                     │
│  PP Admin API           Google Admin               │
│                                                    │
│  📦 Embed iframe                                   │
│  Power BI Reports (secure embed)                   │
│  Canvas Apps (Power Apps embed)                    │
└──────────────────────────────────────────────────┘
```

## Layout

- **Left Sidebar** — collapsible (expanded 240px / collapsed 64px icon-only)
- **Header** — app title + user avatar + notification bell
- **Content Area** — dynamic per module
- Sidebar state lưu localStorage

---

## Sidebar Structure

```
WorkHub
├── 🏠 Dashboard
│
├── 📊 MANAGEMENT
│   ├── 📌 System
│   │   ├── Admin
│   │   ├── Dev Tools
│   │   ├── Domains
│   │   └── Data
│   ├── 💰 Finance
│   │   ├── Billing
│   │   └── License
│   └── 🛡️ Security & Compliance
│       ├── Security
│       ├── Log
│       └── Compliance
│
├── 🔒 OPERATIONS
│   ├── System Health
│   ├── Scheduled Jobs
│   ├── Incidents
│   ├── Change Log
│   └── Backups
│
└── 👤 PERSONAL
    ├── Timesheet
    ├── Registration
    ├── Payment Request
    └── Reports
```

---

## Module Details

### 🏠 Dashboard

Overview page — scan nhanh tình hình trong 10 giây.

| Widget | Data source | Loại |
|--------|------------|------|
| Azure cost tháng này + forecast | Azure Cost Management API | 📡 API |
| License usage (assigned/total) | MS Graph subscribedSkus | 📡 API |
| System status badges | Azure Resource Health API | 📡 API |
| Failed flows (24h) | Power Automate API | 📡 API |
| Quick links tới portal hay dùng | Static config | 🔗 Link |

---

### 📊 MANAGEMENT

#### 📌 System

##### 👥 Admin

Quản lý users, tenant, organization.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Tổng users (active/disabled) | 📡 API | MS Graph → users count |
| User mới thêm/xóa gần đây | 📡 API | MS Graph → recent changes |
| MFA coverage % | 📡 API | MS Graph → auth methods registered |
| Entra ID Users | 🔗 Link | `https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UserManagementMenuBlade` |
| Google Workspace Users | 🔗 Link | `https://admin.google.com` |
| GitHub Org Members | 🔗 Link | `https://github.com/orgs/{org}/settings/members` |

##### 🛠️ Dev Tools

Quick access cho development resources.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| GitHub repos list | 📡 API | GitHub API → org repos |
| Open PRs count | 📡 API | GitHub API → pull requests |
| Recent workflow runs | 📡 API | GitHub Actions API |
| GitHub Org | 🔗 Link | `https://github.com/orgs/{org}` |
| GitHub Actions | 🔗 Link | `https://github.com/orgs/{org}/actions` |
| Power Automate | 🔗 Link | `https://make.powerautomate.com` |
| Azure DevOps | 🔗 Link | `https://dev.azure.com/{org}` |

##### 🌐 Domains

Quản lý domain và SSL certificates.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Domain list + expiry date | 📡 API / Config | Domain registrar API hoặc static config |
| SSL certificate expiry | 📡 API | SSL check API |
| Cảnh báo sắp hết hạn | Logic | Highlight nếu < 30 ngày |
| Domain registrar (GoDaddy/Cloudflare) | 🔗 Link | Portal quản lý domain |

##### 💾 Data

Quản lý Dataverse và database.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Dataverse tables count | 📡 API | Metadata API → entity count |
| Storage usage % | 📡 API | PP Admin Capacity API |
| Power Apps Maker | 🔗 Link | `https://make.powerapps.com` |
| Dataverse Admin | 🔗 Link | `https://admin.powerplatform.microsoft.com/environments` |

---

#### 💰 Finance

##### 💰 Billing

Theo dõi chi phí Azure / Google hàng tháng.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Current month spend | 📡 API | Azure Cost Management → total by day (chart) |
| Forecast end-of-month | 📡 API | Azure Cost Forecast API |
| Top 5 expensive resources | 📡 API | Cost by resource |
| Cost by service breakdown | 📡 API | Cost by service name (pie chart) |
| Budget alerts status | 📡 API | Budget API → threshold % |
| Azure Cost Analysis | 🔗 Link | `https://portal.azure.com/#view/Microsoft_Azure_CostManagement/Menu/~/costanalysis` |
| Azure Invoices | 🔗 Link | `https://portal.azure.com/#view/Microsoft_Azure_CostManagement/Menu/~/invoices` |
| Google Cloud Billing | 🔗 Link | `https://console.cloud.google.com/billing` |
| M365 Billing | 🔗 Link | `https://admin.microsoft.com/Adminportal/Home#/BillingAccounts` |

##### 🔑 License

Theo dõi license usage, tránh mua thừa/thiếu.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| License list (SKU, assigned/total) | 📡 API | MS Graph → subscribedSkus |
| PP license users | 📡 API | Graph → users with PP license |
| Dataverse storage (DB/File/Log) | 📡 API | PP Admin Capacity API |
| Cost estimate / month | 📡 API | Tính theo MS list price |
| Cảnh báo sắp hết license | Logic | assigned ≈ total → warning badge |
| M365 Admin Licenses | 🔗 Link | `https://admin.microsoft.com/Adminportal/Home#/licenses` |
| PP Admin Capacity | 🔗 Link | `https://admin.powerplatform.microsoft.com/resources/capacity` |

---

#### 🛡️ Security & Compliance

##### 🔐 Security

Giám sát bảo mật tổng thể.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| MFA enrollment % | 📡 API | MS Graph → auth methods |
| Risky sign-ins count | 📡 API | MS Graph → riskyUsers |
| Defender alerts count | 📡 API | MS Security Graph API |
| GitHub secret scan results | 📡 API | GitHub API → code-scanning alerts |
| Microsoft Defender | 🔗 Link | `https://security.microsoft.com` |
| Entra Conditional Access | 🔗 Link | `https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess` |
| GitHub Security | 🔗 Link | `https://github.com/orgs/{org}/security` |
| Azure Security Center | 🔗 Link | `https://portal.azure.com/#view/Microsoft_Azure_Security/SecurityMenuBlade` |

##### 📝 Log

Audit trail — ai làm gì khi nào.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Recent sign-in failures (top 10) | 📡 API | MS Graph → signIn logs |
| Risky sign-ins | 📡 API | MS Graph → riskyUsers |
| Entra Sign-in Logs | 🔗 Link | `https://entra.microsoft.com/#view/Microsoft_AAD_IAM/SignInEventsV3Blade` |
| Entra Audit Logs | 🔗 Link | `https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuditLogsBlade` |
| Azure Activity Log | 🔗 Link | `https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/activityLog` |
| Google Admin Audit | 🔗 Link | `https://admin.google.com/ac/reporting/audit/login` |

##### 📋 Compliance

Track compliance documents & policies.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Policy checklist + status | 📡 API (Dataverse) | Custom table: policy name, status, due date |
| DPIA status | Dataverse | Theo DD action items |
| Incident Response Plan | Dataverse | Document status tracking |
| BCP status | Dataverse | Business Continuity Plan |
| Data Retention Policy | Dataverse | Document status |
| Training records | Dataverse | Security awareness training |
| Microsoft Purview Compliance | 🔗 Link | `https://compliance.microsoft.com` |

---

### 🔒 OPERATIONS

##### 🟢 System Health

Biết ngay hệ thống có đang OK không.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Azure services status | 📡 API | Azure Resource Health → per resource |
| M365 service health | 📡 API | MS Graph → serviceHealth API |
| Active incidents (Azure) | 📡 API | Azure Service Health → current issues |
| Uptime % (30 days) | 📡 API | Tính từ health history |
| Azure Service Health | 🔗 Link | `https://portal.azure.com/#view/Microsoft_Azure_Health/AzureHealthBrowseBlade` |
| M365 Service Health | 🔗 Link | `https://admin.microsoft.com/Adminportal/Home#/servicehealth` |
| Google Workspace Status | 🔗 Link | `https://www.google.com/appsstatus/dashboard` |

**UI**: Grid cards — mỗi service 1 card, badge 🟢🟡🔴

##### ⚡ Scheduled Jobs

Monitor Power Automate flows — cái nào chạy, cái nào fail.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Flow runs summary (24h) | 📡 API | Power Automate → succeeded/failed count |
| Failed flows list | 📡 API | Filter status = Failed |
| Top error flows | 📡 API | Group by flow name + failure count |
| Power Automate Manage | 🔗 Link | `https://make.powerautomate.com/manage/flows` |

**UI**: Table với status badge ✅ / ❌ / ⏳

##### 🚨 Incidents

Log & track sự cố hệ thống (phục vụ compliance & DD).

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Open incidents list | 📡 API (Dataverse) | Custom table: title, severity, status, assignee |
| Incident timeline | 📡 API (Dataverse) | Created → Investigating → Resolved |
| MTTR (mean time to resolve) | 📡 API (Dataverse) | Tính từ timestamps |
| Postmortem notes | 📡 API (Dataverse) | Rich text field |
| Severity breakdown chart | 📡 API (Dataverse) | Critical / High / Medium / Low |

**UI**: Table hoặc Kanban + nút "New Incident"
**Cần**: Custom Dataverse table

##### 📦 Change Log

Theo dõi deployments — ai deploy gì, khi nào.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Recent GitHub releases | 📡 API | GitHub API → releases |
| Recent deployments | 📡 API | GitHub Actions → workflow runs |
| Deployment success rate | 📡 API | Tính từ workflow runs |
| GitHub Releases | 🔗 Link | `https://github.com/orgs/{org}/releases` |

**UI**: Timeline view

##### 💾 Backups

Theo dõi backup status (phục vụ BCP & DD).

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Dataverse backup status | 📡 API | PP Admin API → environment backups |
| Last backup date per environment | 📡 API | PP Admin API |
| Google Workspace backup | 🔗 Link | Tùy tool backup đang dùng |
| Azure backup (nếu có) | 🔗 Link | `https://portal.azure.com/#view/Microsoft_Azure_RecoveryServices` |

---

### 👤 PERSONAL

##### 📅 Timesheet

Chấm công cá nhân.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Canvas App chấm công | 📦 Embed | `https://apps.powerapps.com/play/{timesheet-app-id}` |
| Mở app riêng | 🔗 Link | Full screen Canvas App |

##### 📝 Registration

Phiếu đăng ký cá nhân đã tạo.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Canvas App đăng ký | 📦 Embed | `https://apps.powerapps.com/play/{registration-app-id}` |
| Mở app riêng | 🔗 Link | Full screen Canvas App |

##### 💰 Payment Request

Đề nghị thanh toán cá nhân.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Canvas App ĐNTT | 📦 Embed | `https://apps.powerapps.com/play/{payment-app-id}` |
| Mở app riêng | 🔗 Link | Full screen Canvas App |

##### 📊 Reports

Báo cáo tổng hợp cá nhân.

| Nội dung | Loại | Chi tiết |
|----------|------|----------|
| Power BI Dashboard | 📦 Embed | Embed PBI report |
| Mở Power BI | 🔗 Link | `https://app.powerbi.com` |

---

## Azure AD App Registration

### Required API Permissions (Delegated)

```
Microsoft Graph
├── User.Read                      # Current user profile
├── User.Read.All                  # List all users (Admin)
├── Organization.Read.All          # License SKUs
├── AuditLog.Read.All              # Sign-in logs
├── SecurityEvents.Read.All        # Risky sign-ins
├── ServiceHealth.Read.All         # M365 service health
└── Reports.Read.All               # Usage reports

Azure Service Management
└── user_impersonation             # Cost Management, Resource Health

Dynamics CRM
└── user_impersonation             # Dataverse Web API

Power Automate (Flow Service)
└── Flows.Read.All                 # Flow runs, status
```

---

## Build Phases

| Phase | Modules | Effort |
|-------|---------|--------|
| **Phase 1** | Auth (MSAL) + Sidebar + Dashboard + Portal Links | ⭐⭐ |
| **Phase 2** | Billing + License (API) | ⭐⭐⭐ |
| **Phase 3** | Personal (Embed Canvas + PBI) | ⭐ |
| **Phase 4** | System Health + Scheduled Jobs (API) | ⭐⭐⭐ |
| **Phase 5** | Security + Log + Compliance (API + Dataverse) | ⭐⭐⭐ |
| **Phase 6** | Incidents + Change Log + Backups | ⭐⭐⭐ |
| **Phase 7** | Admin + Dev Tools + Domains + Data (API + Links) | ⭐⭐ |
