---
name: doctor-handbook-ui
description: Source of truth for all UI work in the doctor-handbook repo (Doctor Handbook). Use for anything visual or interactive in src/app, src/components or src/modules/*/components - screens, forms, lists, navigation, design tokens, colours, dark mode, typography, layout, responsive/mobile fixes, empty/loading/error states, dialogs, accessibility, mockups, redesign - including OpenSpec changes that touch the UI. Also when the user says "giao diện", "UI", "thiết kế", "màn hình", "form", "mobile", "màu", "dark mode". Overrides the vendored frontend-design, web-design-guidelines, vercel-react-best-practices and vercel-composition-patterns skills where they conflict.
---

# Giao diện Doctor Handbook

Skill này là **nguồn chân lý** cho mọi việc giao diện trong repo. Thứ bậc khi mâu thuẫn:
`CLAUDE.md` + bất biến trong `openspec/config.yaml` > skill này > các skill vendored
(`frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`, `vercel-composition-patterns`;
nguồn và phiên bản ở `.claude/skills/VENDORED.md`).

Người dùng là **bác sĩ đang khám lâm sàng**: đứng hoặc đi, một tay cầm điện thoại, vài giây giữa hai
bệnh nhân, bệnh nhân và người nhà có thể nhìn vào màn hình (idea.md §4.3). Mọi quyết định giao diện
phải phục vụ bối cảnh đó trước tiên.

## Khi nào dùng skill vendored nào

| Giai đoạn                       | Skill                                                        | Lấy gì                                                  |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Khám phá, đề xuất hướng, mockup | `frontend-design`                                            | Hướng thẩm mỹ rõ ràng, tránh giao diện "AI chung chung" |
| Code                            | `vercel-react-best-practices`, `vercel-composition-patterns` | RSC/Server Action, hiệu năng React, compound component  |
| Kiểm tra                        | `web-design-guidelines`                                      | Rà a11y, form, focus, chuyển động, typography           |

### Khi skill khác nói khác

Luật của dự án thắng:

- `frontend-design` tự chọn font, bảng màu hex riêng → giữ **Be Vietnam Pro** và token trong
  `src/app/globals.css`. Tránh thẩm mỹ "lạ mắt" làm chậm việc đọc: đây là công cụ làm việc, ưu tiên
  rõ ràng, tương phản, mật độ thông tin vừa phải.
- `web-design-guidelines` đòi Title Case → dùng **sentence case** tiếng Việt ("Thêm bệnh nhân").
  Gợi ý `nuqs`, `virtua` hay thư viện khác → không thêm khi chưa có quyết định trong `design.md`.
- `vercel-react-best-practices`: SWR, `lru-cache`, `@vercel/analytics`, `better-all` → không có trong
  dự án. Server Action thì **có**, nhưng luôn dựng bằng `createAction`/`createFormAction` (xác thực + Zod + `ActionResult`; form dùng `createFormAction` + `useActionState`),
  không viết action trần. Đọc `localStorage`/IndexedDB → kiểm bằng Zod. Màu cứng, inline style trong
  ví dụ → token + Tailwind.
- `vercel-composition-patterns`: ví dụ viết cho React Native → áp dụng mẫu, không chép API.

## Luật cứng

**Bối cảnh lâm sàng**

- Thiết kế cho **390 px** trước (kiểm cả 360 px), máy tính là bản mở rộng. Không cuộn ngang ở 360 px.
- Hành động chính nằm ở **nửa dưới màn hình** (vùng ngón cái): thanh `BottomNav`, nút thêm ở góc dưới.
  Vùng chạm **≥ 44 × 44 px** cho hành động chính, tối thiểu 24 × 24 px.
- Chữ ô nhập **≥ 16 px** (iOS tự phóng to nếu nhỏ hơn). Chữ thân ≥ 16 px; chú thích ≥ 14 px.
- **Ghi nhanh (N2)**: chỉ họ tên là bắt buộc; lưu tự động, báo "Đã lưu"/"Đang chờ mạng" nhỏ gọn;
  không hộp thoại xác nhận khi lưu. `ConfirmDialog` chỉ cho thao tác không hoàn tác được (xoá vĩnh
  viễn, thay thế dữ liệu khi nhập, khoá/xoá tài khoản).
- **Riêng tư trên màn hình (S7)**: danh sách bệnh nhân chỉ hiện tên, tuổi, giới, quê, ảnh; tóm tắt và
  ghi chú chỉ hiện ở màn hình chi tiết. Không hiện dữ liệu bệnh nhân trong toast, tiêu đề tab, thông báo.
- Mở app là vào thẳng việc chính (danh sách Bệnh nhân + ô tìm kiếm); không màn hình chào.

**Hệ thống giao diện**

- Dùng primitive trong `src/components/ui` (shadcn/ui) và thành phần chung trong
  `src/components/{layout,common}` (`PageHeader`, `PageContainer`, `EmptyState`, `ErrorState`,
  `ConfirmDialog`, `InitialsAvatar`, `Spinner`) trước khi viết cái mới. Thành phần chỉ một module dùng
  thì đặt trong `src/modules/<id>/components/`; dùng từ hai module trở lên mới đưa xuống `src/components/common`.
- Màu, bo góc chỉ lấy từ token trong `src/app/globals.css`. Màu mới = token mới có giá trị **sáng**
  (`:root`) **và tối** (`.dark`), cộng một dòng `--color-*` trong `@theme inline`. Không viết hex/oklch
  hay `bg-blue-500` trong component.
- Ghép class bằng `cn()`, biến thể bằng `cva()`; component nhận `className`. Icon từ `lucide-react`;
  icon trang trí `aria-hidden`, nút chỉ có icon phải có `aria-label`.
- Đường dẫn lấy từ `src/config/routes.ts`, không viết chuỗi path trong component.
- Thêm primitive: `pnpm dlx shadcn@latest add <component>` rồi `pnpm format`; giữ file sinh ra gần bản gốc.
- Chữ hiển thị: tiếng Việt, viết thẳng trong component (không có i18n). Thông báo lỗi lấy từ
  `ActionResult.error.message` (mã `AppError`), không tự viết lại thông báo lỗi chung.

**Tiếp cận (WCAG 2.2 AA)**

- Tương phản chữ ≥ 4.5:1 (chữ lớn ≥ 3:1), viền điều khiển ≥ 3:1, ở **cả sáng lẫn tối**, kể cả dưới
  nắng: ưu tiên tương phản cao.
- Màu không bao giờ là tín hiệu duy nhất (việc quá hạn: màu + chữ/icon).
- Mọi form có `label`; lỗi trường gắn bằng `aria-describedby`/`aria-invalid` (dùng `Field` của shadcn).
- `focus-visible` luôn thấy rõ; điều hướng được bằng bàn phím trên máy tính.
- Mọi animation có nhánh `motion-reduce:`.

**Phạm vi**

- Đổi **hành vi** người dùng quan sát được (luồng mới, trạng thái mới, trường mới) → đi qua OpenSpec.
  Thay đổi **thuần hình ảnh** (màu, khoảng cách, font) làm thẳng, không cần change, nhưng vẫn qua pha 4.
- Không tạo `DESIGN.md` hay file kế hoạch riêng: quyết định thiết kế ghi trong `design.md` của change.

## Checklist màn hình

Trước khi coi một màn hình là xong:

- [ ] Có **trạng thái rỗng** (icon, lời giải thích, hành động tiếp), **đang tải** (`loading.tsx` hoặc
      `Skeleton`), **lỗi** (`ErrorState` + "Thử lại").
- [ ] Ở 360/390 px: không tràn, hành động chính trong tầm ngón cái, không bị `BottomNav` che
      (đã có padding đáy trong `DoctorShell`), tôn trọng safe area của iPhone.
- [ ] Mất mạng giữa chừng: chữ đang gõ không mất (nháp IndexedDB), có báo trạng thái.
- [ ] Tên Việt dài, trùng tên: danh sách vẫn phân biệt được (tuổi, giới, quê), chữ bị cắt có `truncate`.
- [ ] Không lộ dữ liệu nhạy cảm ở danh sách, toast, tiêu đề.
- [ ] Sáng và tối đều đọc tốt.
- [ ] Trình đọc màn hình: tiêu đề trang (`h1`), nhãn nút, `role="status"` cho thông báo đã lưu.

## Quy trình (ánh xạ sang OpenSpec)

1. **Pha 1 — Khảo sát.** Chạy `pnpm dev`, xem màn hình liên quan ở 390 px (DevTools hoặc Playwright
   project `android`/`iphone`); liệt kê vấn đề. Dùng `/opsx:explore` để bàn.
2. **Pha 2 — Thiết kế (bắt buộc, không bỏ qua được).** Trong `/opsx:propose`, với **mọi** change chạm
   giao diện, kể cả màn hình "chỉ có một form":
   - Dùng `frontend-design` để chọn hướng hình ảnh có chủ đích (nhưng giữ luật của dự án ở trên).
   - Làm mockup HTML **chạy được** cho mọi màn hình và **mọi trạng thái** change thêm/đổi (mặc định, đang
     gửi, từng loại lỗi, rỗng, đang tải), có công tắc sáng/tối và điện thoại (390 px)/máy tính; dùng chữ thật
     của app, không lorem ipsum. Khi có lựa chọn cần người dùng quyết (bảng màu, bố cục), đặt các phương án
     cạnh nhau trong mockup để so sánh.
   - Lưu ở `openspec/changes/<tên>/mockup/index.html`: HTML hoàn chỉnh (`<!doctype html>`, `<head>`,
     `<body>`), mở trực tiếp bằng trình duyệt, CSS/JS viết trong file (chỉ font từ Google Fonts). **Gửi
     đường dẫn file local cho người dùng. KHÔNG upload mockup lên claude.ai (Artifact) hay dịch vụ ngoài.**
   - Tự xem trước bằng ảnh chụp Playwright local (điện thoại 390 px và máy tính, sáng và tối), sửa lỗi
     hiển thị rồi mới gửi.
   - Tính tỉ số tương phản của mọi màu mới (sáng và tối) trước khi đưa vào mockup.
   - `design.md` ghi: link mockup, hướng hình ảnh, bố cục, token thêm/đổi (sáng + tối, tỉ số tương phản),
     các trạng thái, cách kiểm tra. `tasks.md` có nhóm `0. Thiết kế` với task "người dùng duyệt mockup".
   - **Dừng lại chờ người dùng duyệt.** Chỉ khi người dùng duyệt (hoặc yêu cầu sửa rồi duyệt bản sửa) mới
     tick task duyệt, ghi ngày và điều chỉnh vào `design.md`, rồi sang pha 3.
3. **Pha 3 — Code.** `/opsx:apply` theo `tasks.md`, dùng `vercel-react-best-practices` +
   `vercel-composition-patterns`. Token trước, thành phần chung sau, màn hình cuối.
4. **Pha 4 — Kiểm tra.** Xem lại ở 390 px và 1280 px, sáng/tối; rà bằng `web-design-guidelines` trên
   các file đã đổi; `pnpm check`, `pnpm test:e2e`; hai lượt review code, rồi `/opsx:archive`.

## Bẫy hay gặp

- E2E và test component truy vấn theo vai trò và tên (`getByRole`); đổi chữ hay vai trò là sửa test.
- Thêm token tối mà quên `.dark` → chế độ tối lệch. `next-themes` đặt class `dark` trên `<html>`.
- `"use client"` đặt quá cao làm cả cây thành client: đặt ở lá có tương tác.
- Trang trong `(doctor)` đã được `requirePageAccess` bảo vệ ở layout, nhưng **mọi** đọc/ghi dữ liệu vẫn
  phải qua DAL/`createAction`/`createFormAction` (layout không chạy lại khi điều hướng phía client).
- Hình đẹp ở 1280 px nhưng tràn ở 360 px: luôn xem điện thoại trước.
