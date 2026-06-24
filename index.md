---
type: Index
okf_version: "0.1"
---

# WorkHub Workspace Index

Chào mừng anh Hiếu Lê đến với hệ thống tài liệu chuẩn OKF của **WorkHub**! Đây là bản đồ điều hướng clickable toàn bộ dự án.

---

## 🗺️ Bản đồ điều hướng (Navigation Map)

### 📄 Tài liệu chung
- 📁 [docs/](./docs/) - Tài liệu thiết kế và đặc tả hệ thống
  - 📄 [DESIGN.md](./docs/DESIGN.md) - Design pattern chuẩn cho giao diện và CSS Tokens
- 📄 [PROJECT.md](./PROJECT.md) - **Tài liệu tổng quan dự án** (Trạng thái, Roadmap, Quyết định thiết kế)
- 📄 [WorkHub_Spec.md](./WorkHub_Spec.md) - Tài liệu đặc tả chức năng & sidebar modules
- 📄 [log.md](./log.md) - Lịch sử cập nhật session & nhật ký phát triển

### 💻 Cấu trúc mã nguồn
- 📁 [src/](./src/) - Mã nguồn chính ứng dụng (Vite + React + TS)
  - 📄 [main.tsx](./src/main.tsx) - Entry point (MsalProvider wrapper)
  - 📄 [App.tsx](./src/App.tsx) - Root layout, sidebar routing và layout chung
  - 📄 [index.css](./src/index.css) - File CSS nguyên khối (~183KB) định nghĩa style hệ thống
  - 📁 [components/](./src/components/) - Các components giao diện nghiệp vụ
    - 📁 [ui/](./src/components/ui/) - Atomic components dùng chung (ConfirmDialog...)
    - 📁 [flow/](./src/components/flow/) - Sub-components cho AutomateFlowPage
  - 📁 [hooks/](./src/hooks/) - Custom React Hooks
    - 📄 [useApiData.ts](./src/hooks/useApiData.ts) - Hook fetch API tập trung và cache (TTL 10 phút)
    - 📄 [usePagination.ts](./src/hooks/usePagination.ts) - Hook phân trang client-side
  - 📁 [services/](./src/services/) - Lớp tích hợp dịch vụ (Services Layer)
    - 📁 [azure/](./src/services/azure/) - 19 service files kết nối Power Platform, Graph, Cost, Flow APIs...
    - 📁 [dataverse/](./src/services/dataverse/) - 8 service files kết nối Dataverse API (chấm công, phép, ĐNTT...)
  - 📁 [config/](./src/config/) - Thư mục chứa cấu hình MSAL Azure AD
    - 📄 [authConfig.ts](./src/config/authConfig.ts) - Định nghĩa Client ID, Tenant, Scopes
  - 📁 [routes/](./src/routes/) - Khởi tạo constants cho Router và Route Meta
  - 📁 [types/](./src/types/) - Định nghĩa TypeScript interfaces
  - 📁 [context/](./src/context/) - React context providers
  - 📁 [lib/](./src/lib/) - Các hàm thư viện bổ trợ (dateUtils.ts...)
  - 📁 [styles/features/](./src/styles/features/) - Slot chuẩn bị cho việc CSS split trong tương lai
  - 📁 [constants/](./src/constants/) - Chứa các hằng số hệ thống
  - 📁 [data/](./src/data/) - Chứa dữ liệu static mẫu
  - 📁 [utils/](./src/utils/) - Các helper functions khác
