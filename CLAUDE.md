# CLAUDE.md

Hướng dẫn cho Claude Code trong repo **doctor-handbook** (Doctor Handbook): web app thay cuốn sổ tay giấy của
bác sĩ khi khám lâm sàng — ghi nhớ bệnh nhân, tìm lại tức thì, việc cần làm, sao lưu ra file. Dự án nội bộ,
miễn phí, phi thương mại. Dữ liệu là **thông tin bệnh nhân**: riêng tư và tách theo bác sĩ là ưu tiên số một.

## Next.js 16

Next.js 16 khác kiến thức cũ (ví dụ `middleware` đã đổi thành `proxy.ts`, `next lint` không còn). Trước khi
dùng API của Next, đọc tài liệu đi kèm trong `node_modules/next/dist/docs/`. Khối dưới đây do `next dev`
tự ghi vào `AGENTS.md` (commit cùng repo, không sửa tay):

@AGENTS.md

## Tài liệu nguồn

| Tài liệu                     | Trả lời câu hỏi                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `idea.md`                    | Sản phẩm là gì, đã chốt những gì (mục 2 D1–D21, nguyên tắc mục 7 N1–N6, bảo mật mục 8.6) |
| `teckstack.md`               | Vì sao chọn công nghệ này, giới hạn gói miễn phí                                         |
| `docs/architecture.md`       | Phân tầng, luồng request, xác thực, dữ liệu, storage, logging                            |
| `CONTRIBUTING.md`            | Quy ước code, đặt tên, commit, cách thêm một tính năng                                   |
| `src/modules/<id>/README.md` | Phạm vi từng module (auth, admin, patients, search, todos, backup)                       |
| `openspec/specs/`            | Hệ thống **đang** làm gì (hành vi hiện trạng — WHAT)                                     |
| `openspec/changes/`          | Việc **sắp** làm (proposal, design, delta spec, tasks); `archive/` là lịch sử            |
| `openspec/config.yaml`       | Bối cảnh dự án và **các bất biến** — đọc trước khi đổi kiến trúc hay hành vi             |

## Lệnh

| Lệnh                   | Khi nào                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `pnpm check`           | Lint, typecheck, format, unit test, OpenSpec — chạy trước khi coi một việc là xong |
| `pnpm build`           | Khi đổi cấu hình, route, hoặc trước khi archive một change                         |
| `pnpm test:e2e`        | Playwright (Pixel 7, iPhone 14), khi đổi giao diện hoặc luồng người dùng           |
| `pnpm spec:check`      | OpenSpec strict + không còn change xong mà chưa archive                            |
| `pnpm db:generate`     | Sau khi sửa `src/server/db/schema/*`; xem lại SQL sinh ra                          |
| `pnpm exec openspec …` | CLI OpenSpec                                                                       |

Gọi OpenSpec bằng **`pnpm exec openspec`**: repo ghim bản 1.15.0 (`devDependencies`), bản cài global trên
máy có thể khác và sinh file khác định dạng. Không chạy `pnpm db:migrate` vào database production từ máy.

## Quy trình bắt buộc: OpenSpec (spec-driven)

### Khi nào PHẢI đi qua OpenSpec

Thêm, sửa hoặc bỏ **hành vi** (bác sĩ, Admin hoặc hệ thống quan sát được) → bắt buộc:

1. `/opsx:explore` — khi yêu cầu còn mơ hồ, cần đọc code và bàn phương án trước (không viết code).
2. `/opsx:propose <mô tả>` — tạo change trong `openspec/changes/<tên>/` gồm proposal, delta spec, design, tasks.
   Dừng lại để người dùng duyệt; không code trong cùng lượt.
3. `/opsx:apply` — code theo `tasks.md`, tick từng task khi xong và test xanh.
4. `/opsx:archive` — khi mọi task xong: gộp delta vào `openspec/specs/`, chuyển change vào `archive/`.

Proposal ghi rõ change thuộc module nào và đáp ứng mục nào của `idea.md`. Tên change là kebab-case tiếng Anh
dạng động từ + đối tượng: `add-doctor-login`, `add-access-codes`, `add-patient-notes`, `add-backup-export`.

**Không** tạo file kế hoạch riêng (`plans/`, `TODO.md`…) cho việc sắp làm — dùng `openspec/changes/`.

### Khi nào KHÔNG cần change

- Sửa lỗi, refactor, đổi tooling/hạ tầng, sửa tài liệu **không đổi requirement** → làm thẳng.
- Nếu khi sửa phát hiện **hành vi lệch khỏi spec** → cập nhật spec (change nhỏ hoặc sửa thẳng
  `openspec/specs/`) để spec không bao giờ sai.

### Xong nghĩa là đã archive, trong cùng PR

- Tick task cuối **chưa phải** là xong. Chừng nào chưa archive, `openspec/specs/` không mô tả hành vi vừa ship.
- Tick task cuối ⇒ chạy `/opsx:archive` (hoặc `pnpm exec openspec archive <tên> --yes`) và commit cùng PR.
- `pnpm spec:check` (CI) **đỏ** nếu còn change tick hết task mà chưa archive. Không bao giờ sửa đỏ bằng cách
  bỏ tick lùi; hai đường đúng là archive, hoặc bỏ tick task thật sự chưa xong.
- **Không bao giờ archive hành vi chưa có trong code** — đó là ghi hành vi giả vào `specs/`.
- `tasks.md` là lời khai trạng thái, không phải danh sách ước muốn. Việc cố ý hoãn chuyển xuống mục
  `## Ngoài phạm vi` (kèm lý do), không để `- [ ]` treo mãi.
- Trước khi archive, đối chiếu delta với **code hiện tại**: code có thể đã đi khác lúc đề xuất; `specs/`
  phải tả đúng cái code đang làm.

### Bẫy khi sửa spec đang có

- Khối `## MODIFIED Requirements` **thay trọn** requirement trong `specs/`. Phải chép **toàn bộ** thân
  requirement hiện có rồi mới sửa; chép thiếu thì archive vẫn xanh nhưng `specs/` mất nội dung, im lặng.
  Luôn diff cả thân với bản trong `specs/` trước khi archive.
- Requirement đổi bản chất → cặp `## REMOVED Requirements` + `## ADDED Requirements` với **tên khác nhau**.
- Đổi tên một requirement làm hỏng mọi delta khác còn trỏ tên cũ → grep `openspec/changes/*/specs/**` trước.
- Archive theo thứ tự tạo change. Nếu công cụ từ chối thì làm mới delta, **không** dùng `--no-validate`.

### Ngôn ngữ

- Artifact OpenSpec (proposal, design, tasks, requirement, scenario) và tài liệu sản phẩm (`idea.md`,
  `teckstack.md`, file này): **tiếng Việt**. Giữ **tiếng Anh**: tiêu đề cấu trúc (`## Why`, `## Purpose`,
  `## Requirements`, `### Requirement:`, `#### Scenario:`, `## ADDED/MODIFIED/REMOVED Requirements`), dấu
  `**WHEN**`/`**THEN**`/`**AND**`, từ khoá `SHALL`/`MUST` (validator bắt buộc), và mọi định danh.
- Code, comment, commit, tài liệu kỹ thuật (`README.md`, `docs/`, README module): **tiếng Anh**.
- Chữ trên giao diện: **tiếng Việt**, sentence case.

## Quy trình làm giao diện

Mọi việc giao diện theo skill **`doctor-handbook-ui`** (`.claude/skills/doctor-handbook-ui/SKILL.md`): bối
cảnh lâm sàng, luật cứng, checklist màn hình; skill này thắng các skill giao diện vendored khi mâu thuẫn.
Bốn pha, **không được bỏ pha 2**:

1. **Khảo sát**: xem màn hình hiện có ở 390 px và 1280 px, sáng/tối.
2. **Thiết kế** (trong `/opsx:propose`): nạp skill `doctor-handbook-ui` + `frontend-design`, làm mockup HTML
   cho **mọi** màn hình và trạng thái mà change thêm hoặc đổi (lỗi, đang gửi, rỗng…), sáng/tối,
   điện thoại/máy tính, lưu ở `openspec/changes/<tên>/mockup/index.html` (HTML hoàn chỉnh, mở trực tiếp
   bằng trình duyệt) và **gửi đường dẫn file local cho người dùng**. **Không** upload mockup lên claude.ai
   (Artifact) hay dịch vụ ngoài nào. Người dùng **duyệt mockup trước khi code**; ghi ngày duyệt và các điều chỉnh
   vào `design.md` và tick task `0.x` trong `tasks.md`. Chưa duyệt thì `/opsx:apply` phải dừng.
3. **Code**: `/opsx:apply`, bám mockup đã duyệt.
4. **Kiểm tra**: xem lại ở 390/1280 px sáng/tối, so với mockup; rà bằng `web-design-guidelines`.

Thay đổi **thuần hình ảnh** không đổi hành vi (màu, khoảng cách) không cần change nhưng vẫn cần mockup hoặc
ảnh trước/sau cho người dùng xem nếu thấy được trên màn hình.

## Bất biến

Danh sách đầy đủ nằm ở **một chỗ duy nhất**: `openspec/config.yaml` → `context` → "Bất biến". Tóm tắt những
điều tuyệt đối không được làm sai:

- Mọi truy vấn dữ liệu đi qua DAL của module và lọc theo `auth.account.id` từ session; không bao giờ nhận
  account id từ client. Mọi Server Action dựng bằng `createAction` (gọi bằng object) hoặc `createFormAction` (form + `useActionState`) và khai `access`.
- Admin không đọc dữ liệu bệnh nhân. App không phải hồ sơ bệnh án.
- Không log dữ liệu bệnh nhân (chỉ dùng `logger`); không đưa dữ liệu bệnh nhân vào URL, toast, tiêu đề.
- Mọi bảng khai `.enableRLS()`; migration tương thích ngược; dữ liệu sổ tay mới phải có trong sao lưu/nhập
  (góp ý gửi Admin là ngoại lệ đã duyệt).
- Không thêm dịch vụ ngoài/trả phí khi chưa có quyết định trong `idea.md` / `teckstack.md`.

Change nào cần vi phạm một bất biến phải nói rõ trong proposal và lý do; nếu được chấp nhận thì sửa luôn
danh sách trong `openspec/config.yaml`.

## Quy ước code (tóm tắt — đầy đủ ở CONTRIBUTING.md và docs/architecture.md)

- Phân tầng `app → modules → components/hooks/lib/config/server`, ESLint chặn import sai chiều và `../`.
  Import qua alias `@/`. Không barrel `index.ts` trong module.
- Module: `server/queries.ts`, `server/mutations.ts` (DAL, `import "server-only"`), `server/actions.ts`
  (`"use server"` + `createAction` / `createFormAction`), `schemas.ts` (Zod dùng chung form/action), `components/`.
- Lỗi dự kiến ném `AppError(code)`; action trả `ActionResult`; route handler dùng `toErrorResponse`.
- Không `any`; `import type` cho kiểu; file kebab-case; component PascalCase, export có tên.
- Test unit đặt cạnh code (`*.test.ts`); E2E trong `tests/e2e`. Mỗi scenario trong spec có test.
- Thêm thư viện: ghi phiên bản và lý do vào `design.md`; không thêm ngoại lệ `minimumReleaseAgeExclude`
  hay bật `allowBuilds` khi chưa có lý do ghi lại.
- Commit theo Conventional Commits; không bỏ qua git hook (`--no-verify`).
