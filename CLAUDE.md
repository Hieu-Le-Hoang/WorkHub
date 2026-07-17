# CLAUDE.md — Quy tắc hành vi AI · Code Project

> **Rule chung** (giao tiếp, planning, security, encoding, OKF, Lookup...)
> nằm ở **global rules** — Claude Code: `~/.claude/CLAUDE.md`; Antigravity: global config.
> File này chỉ chứa rule **đặc thù cho project code**.

Bộ quy tắc giảm thiểu lỗi phổ biến khi AI viết code. Merge với instruction riêng của project khi cần.

**Đánh đổi:** Ưu tiên thận trọng hơn tốc độ. Với task đơn giản, dùng phán đoán hợp lý.

---

## 1. Suy nghĩ trước khi code

**Đừng đoán mò. Đừng giấu sự mơ hồ. Hãy nêu rõ trade-off.**

Trước khi implement:
- Nêu rõ assumptions. Nếu không chắc — hỏi.
- Nếu có nhiều cách hiểu — trình bày tất cả, đừng tự chọn im lặng.
- Nếu có cách đơn giản hơn — hãy nói. Phản biện khi cần thiết.
- Nếu điều gì đó không rõ — dừng lại. Chỉ rõ điểm mơ hồ. Hỏi.

## 2. Ưu tiên đơn giản

**Code tối thiểu giải quyết đúng vấn đề. Không có gì suy đoán.**

- Không thêm feature ngoài yêu cầu.
- Không tạo abstraction cho code chỉ dùng một lần.
- Không thêm "linh hoạt" hay "cấu hình được" khi không được yêu cầu.
- Không xử lý lỗi cho các tình huống không thể xảy ra.
- Nếu viết 200 dòng mà có thể làm trong 50 — viết lại.

Tự hỏi: "Một senior engineer có nói cái này bị over-engineer không?"
Nếu có — đơn giản hóa.

## 3. Can thiệp tối thiểu

**Chỉ đụng vào đúng những gì cần. Chỉ dọn dẹp đống rác do chính mình tạo ra.**

Khi chỉnh sửa code hiện có:
- Đừng "cải thiện" code, comment, hay formatting xung quanh.
- Đừng refactor những thứ không bị hỏng.
- Giữ nguyên style hiện có, dù bạn sẽ làm khác đi.
- Nếu phát hiện dead code không liên quan — đề cập, đừng tự xóa.

Khi thay đổi tạo ra orphan:
- Xóa import/variable/function mà CHÍNH thay đổi của bạn làm thành vô dụng.
- Không xóa dead code có sẵn trừ khi được yêu cầu rõ ràng.

**Bài kiểm tra:** Mọi dòng code thay đổi phải trace trực tiếp về yêu cầu của user.

## 4. Thực thi hướng mục tiêu

**Định nghĩa tiêu chí thành công. Lặp cho đến khi xác minh được.**

Biến task thành mục tiêu có thể verify:
- "Thêm validation" → "Viết test cho input không hợp lệ, rồi làm chúng pass"
- "Fix bug" → "Viết test reproduce lỗi đó, rồi làm nó pass"
- "Refactor X" → "Đảm bảo test pass trước và sau khi refactor"

Với task nhiều bước, trình bày kế hoạch ngắn:
```
1. [Bước] → verify: [điều kiện kiểm tra]
2. [Bước] → verify: [điều kiện kiểm tra]
3. [Bước] → verify: [điều kiện kiểm tra]
```

Tiêu chí rõ ràng → AI tự lặp độc lập.
Tiêu chí yếu ("làm cho nó chạy") → cần clarify liên tục.

## 5. An toàn & Giới hạn

**Những điều KHÔNG được làm mà không có confirm rõ ràng.**

- **Dependencies**: KHÔNG thêm thư viện / package mới (kể cả devDependency) mà chưa được yêu cầu. Nêu đề xuất và chờ confirm.
- **Secrets**: KHÔNG hardcode API key, password, token, credential vào code — luôn dùng environment variable.
- **Existing tests**: KHÔNG làm break test đang pass. Chạy test suite trước và sau khi sửa. Nếu test break → báo ngay, không tự sửa test để pass.
- **Breaking changes**: KHÔNG thay đổi public API signature, database schema, tên env variable mà không cảnh báo rõ ràng là **[BREAKING CHANGE]** và chờ confirm.
- **Xóa file/data**: KHÔNG xóa file, record, migration mà không có confirm từng đối tượng cụ thể.

---

**Bộ quy tắc đang hoạt động khi:** diff ít thay đổi thừa, ít phải viết lại
do over-engineer, câu hỏi làm rõ xuất hiện TRƯỚC khi implement,
và không có surprise dependency / breaking change nào bị bỏ qua.
