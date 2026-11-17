# Skill vendored từ bên ngoài

Các skill dưới đây được **chép nguyên văn** (vendor) từ repo công khai trên GitHub và ghim theo commit SHA.
Không cài bằng installer (`npx skills`, plugin marketplace…) và không chạy script nào của các repo nguồn.

Bản trong repo này được chép **byte-identical** từ repo `board-games` (cùng chủ), nơi chúng đã được lấy về từ
nguồn ngày 2026-11-03 và **đọc hết** trước khi vendor. Ngày chép sang doctor-handbook: 2026-11-18
(kiểm bằng `diff -rq`).

Nội dung giữ byte-identical với bản gốc, trừ chỗ sửa ghi ở mục "Sửa cục bộ". Vì vậy các thư mục này
nằm trong `.prettierignore`: đừng format lại chúng.

Khi hướng dẫn của một skill vendored khác quy ước của dự án (`CLAUDE.md`, `openspec/config.yaml`,
`docs/architecture.md`, `CONTRIBUTING.md`, skill `doctor-handbook-ui`), **quy ước của dự án thắng**.

## frontend-design

| Mục           | Giá trị                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| Nguồn         | [anthropics/skills](https://github.com/anthropics/skills)                        |
| Đường dẫn     | `skills/frontend-design/`                                                        |
| SHA           | `ca45fc496a3436251f191354091d557da31c15b5`                                       |
| Giấy phép     | Apache-2.0 (`LICENSE.txt` trong thư mục skill; frontmatter `license` trỏ tới nó) |
| File lấy      | `SKILL.md`, `LICENSE.txt` (toàn bộ thư mục upstream)                             |
| Sửa cục bộ    | Không có                                                                         |
| Thư mục local | `.claude/skills/frontend-design/`                                                |

## web-design-guidelines

| Mục           | Giá trị                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nguồn         | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (`SKILL.md`) + [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) (luật) |
| Đường dẫn     | `skills/web-design-guidelines/SKILL.md`; `command.md` (repo web-interface-guidelines)                                                                                                         |
| SHA           | agent-skills `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`; web-interface-guidelines `434b7f91364665f2f733b310ec54809bf8f37937`                                                                  |
| Giấy phép     | MIT. web-interface-guidelines có file `LICENSE` (đã chép thành `LICENSE`). agent-skills không có file LICENSE: MIT chỉ khai trong `README.md` của repo                                        |
| File lấy      | `SKILL.md`; `command.md` → `guidelines.md`; `LICENSE` (của web-interface-guidelines)                                                                                                          |
| Sửa cục bộ    | `SKILL.md`: thay bước WebFetch `.../web-interface-guidelines/main/command.md` bằng đọc file `guidelines.md` cạnh nó. Có comment `LOCAL MODIFICATION` ở cuối file (ghi từ repo board-games)    |
| Thư mục local | `.claude/skills/web-design-guidelines/`                                                                                                                                                       |

## vercel-react-best-practices

| Mục           | Giá trị                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| Nguồn         | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| Đường dẫn     | `skills/react-best-practices/`                                          |
| SHA           | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`                              |
| Giấy phép     | MIT, khai ở frontmatter `license: MIT` và `README.md` của repo          |
| File lấy      | `SKILL.md`, `AGENTS.md` (bản gộp mọi rule), `rules/*.md`                |
| Sửa cục bộ    | Không có                                                                |
| Thư mục local | `.claude/skills/vercel-react-best-practices/`                           |

## vercel-composition-patterns

| Mục           | Giá trị                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| Nguồn         | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| Đường dẫn     | `skills/composition-patterns/`                                          |
| SHA           | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`                              |
| Giấy phép     | MIT, khai ở frontmatter `license: MIT` và `README.md` của repo          |
| File lấy      | `SKILL.md`, `AGENTS.md` (bản gộp), `rules/*.md`                         |
| Sửa cục bộ    | Không có                                                                |
| Thư mục local | `.claude/skills/vercel-composition-patterns/`                           |

## Cách cập nhật

Cập nhật ở repo `board-games` trước (quy trình đầy đủ trong `.claude/skills/VENDORED.md` của repo đó: lấy SHA,
tải vào thư mục tạm, **đọc hết** file mới/đổi, không vendor file `.js`/`.ts`/script, áp lại phần sửa cục bộ),
rồi chép sang đây và kiểm bằng `diff -rq`. Cập nhật SHA, ngày trong file này.
