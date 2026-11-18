# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`: 3 phương án icon (nhiều cỡ, màn hình chính Android/iPhone, sáng/tối, vùng an toàn maskable), màn hình chờ, dòng cài trong Cài đặt (4 trạng thái), trang mất mạng. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 19/11/2026, chọn phương án A (Bìa sổ). Kiểm: ngày duyệt, phương án đã chọn và các điều chỉnh được ghi vào design.md §8 (mục "Trạng thái duyệt").

## 1. Icon và manifest

- [x] 1.1 Viết SVG gốc theo phương án đã chọn (`src/assets/app-icon.svg`, bản maskable, favicon `src/app/icon.svg`) và `scripts/build-icons.mjs` (`pnpm icons`); sinh và commit PNG 192, 512, maskable 512, `src/app/apple-icon.png` 180; xoá `apple-icon.tsx`. Kiểm: PNG đúng kích thước, icon iPhone không có điểm trong suốt.
- [x] 1.2 Cập nhật `manifest.ts` (icon PNG, maskable, lối tắt) và matcher của `proxy.ts`. Kiểm: E2E "Manifest đủ để cài", "Icon iPhone", "Lối tắt trong manifest" khi chưa đăng nhập.

## 2. Service worker và trang mất mạng

- [x] 2.1 Viết `isCacheableStatic` ngay trong `public/sw.js`, kèm unit test chạy chính file đó qua `node:vm` (`src/lib/pwa/service-worker.test.ts`): cho phép `/_next/static/`, `/icons/`, `/icon.svg`, `/offline.html` cùng origin; từ chối trang, `/api/*`, Server Action, origin khác, URL ký của Storage. Phần còn lại của `public/sw.js` theo design §3, `public/offline.html` theo §5; header `Cache-Control: no-cache` cho `sw.js`.
- [x] 2.2 Đăng ký service worker trong `AppProviders` (chỉ production). Kiểm: E2E "Bộ nhớ đệm chỉ có tệp tĩnh" (đọc Cache Storage sau khi mở danh sách, chi tiết, Cài đặt) và "Mở app lúc mất mạng".

## 3. Dòng cài trong Cài đặt

- [x] 3.1 Viết `src/lib/pwa/install-prompt.ts` (giữ `beforeinstallprompt`, `appinstalled`, `installState`, `useInstallState`) kèm unit test cho cách nhận biết iOS/đã cài/không hỗ trợ; viết `InstallAppRow` và đặt vào Cài đặt. Kiểm: E2E "Trình duyệt cho cài" (giả lập sự kiện `beforeinstallprompt`), "iPhone" (user agent Safari iPhone), "Đang dùng app đã cài" (giả lập `display-mode: standalone`); so với mockup ở 360/390/1280 px, sáng và tối.

## 4. Tài liệu

- [x] 4.1 Cập nhật teckstack §2 và §4.9 (service worker tự viết thay Serwist), `docs/architecture.md` (PWA, quy tắc cache), README (cách sinh lại icon, thử cài trên máy thật). Kiểm: `pnpm format:check` xanh.

## 5. Kiểm tra cuối

- [x] 5.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - Lighthouse hay DevTools → Application → Manifest không báo lỗi cài;
  - xem lại ở 360/390/1280 px, sáng và tối;
  - rà bằng `web-design-guidelines`.
- [x] 5.2 Đối chiếu `specs/app-install/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Xem dữ liệu khi mất mạng, thông báo đẩy, tự nhắc cài, icon riêng cho Admin: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-pwa-install --yes` trong cùng PR với task cuối.
- Thử cài trên iPhone và Android thật trong buổi dùng thử.
