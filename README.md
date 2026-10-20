# Harness của repo này

Lớp luật cho agent (Claude Code) khi làm việc trong repo: chặn secret, hỏi trước khi đổi luật, và một
lệnh duy nhất để kiểm repo còn ổn không. Người ngồi làm cùng agent là reviewer; harness chỉ cưỡng
chế ở chỗ không undo được.

## Có gì

```
.claude/settings.json      đăng ký hook + permissions.deny cho file secret
.claude/hooks/
  pre_tool_use.mjs         DENY secret · lệnh hủy diệt · pipe-to-shell — ASK khi sửa config/luật
  post_tool_use.mjs        format file vừa sửa + quét secret, góp ý cho agent (không chặn)
  session_start.sh         đầu phiên: branch, 5 commit gần nhất, phần đầu TODO.md
scripts/verify.sh          chạy toàn bộ gate — agent/người chạy TAY trước khi báo xong
scripts/gates.sh           danh sách gate (sửa file này khi gate không hợp dự án)
linters/                   luật riêng: security (secret, PII trong log), doc-paths (doc trỏ path chết)
decisions/                 ADR
CLAUDE.md                  luật + bản đồ repo cho agent
TODO.md                    việc đang làm / tiếp theo · gate đang tắt · review
```

## Ba phán quyết của hook

| | Khi nào | Agent gặp gì |
|---|---|---|
| **DENY** | đọc/sửa `.env*`, key, credential · `rm -rf /` · `curl … \| sh` | bị chặn, có lý do |
| **ASK** | sửa `linters/`, `scripts/verify.sh`, `scripts/gates.sh`, `.claude/*`, `tsconfig*.json`, `biome.json`, `eslint.config.*`, `vitest.config.*` | người bấm duyệt hoặc từ chối |
| **ALLOW** | còn lại | không gì |

## Gate trong `verify.sh`

`format-check` (biome) · `lint` · `security` · `doc-paths` · `typecheck` (tsc) · `test`. Gate nào thiếu
tool hoặc config thì **SKIP** và được liệt kê; không gate nào chạy thì **exit 1**.

Dự án không phải JS (Python, Godot...): thêm gate của nó vào `scripts/gates.sh`, có ví dụ sẵn trong file.

## Lỗ đã biết

- Không có git hook, không có CI: commit gõ tay không qua gate nào. Thêm CI khi repo có người thứ hai.
- Gate Bash là so chuỗi trên dòng lệnh: một script gián tiếp (`sh ./tools/x.sh`) đọc secret vẫn lọt.
- ASK phụ thuộc người đọc prompt — bấm duyệt theo phản xạ thì ASK = ALLOW.
