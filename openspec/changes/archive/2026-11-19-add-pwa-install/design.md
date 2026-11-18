# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **`src/app/manifest.ts`**: đã có tên, mô tả, `lang: "vi"`, `start_url: /patients`, `display: standalone`, màu nền và màu chủ đề sáng. Icon chỉ có `icon.svg` (sizes `any`) và `apple-icon`.
- **`src/app/icon.svg`**: icon tạm, một cuốn sổ đen có dấu cộng. **`src/app/apple-icon.tsx`**: vẽ dấu "+" bằng `ImageResponse`, cũng là icon tạm.
- **`layout.tsx`**: có `appleWebApp.capable`, `themeColor` sáng và tối, `viewportFit: cover` (đã tính safe area).
- **CSP**: đã có `worker-src 'self'` và `manifest-src 'self'`.
- **`proxy.ts`**: matcher bỏ qua `icon.svg`, `apple-icon`, `manifest.webmanifest`. Mọi đường dẫn khác cần cookie, nếu không sẽ chuyển hướng về `/login`.
- **Chưa có** service worker, thư mục `public/`, hay chỗ nào hướng dẫn cài.
- **Playwright** (devDependency) có Chromium, dùng được để vẽ PNG từ SVG.

## Goals / Non-Goals

**Goals:**

- Cài được trên Android (Chrome) và iPhone (Safari); mở thẳng `/patients`, toàn màn hình.
- Icon nhận ra ngay là "sổ tay của bác sĩ", rõ ở cỡ 16 px lẫn 512 px, đẹp trên nền sáng và nền tối.
- Không có byte dữ liệu bệnh nhân nào nằm trong bộ nhớ đệm.

**Non-Goals:** xem dữ liệu khi mất mạng, thông báo đẩy, tự nhắc cài (xem proposal, "Ngoài phạm vi").

## Decisions

### 1. Icon

**Ba phương án trong mockup.** Cả ba dùng cùng một bộ màu:

| Màu      | Hex       | Dùng cho        |
| -------- | --------- | --------------- |
| Đỏ y tế  | `#D92D20` | chữ thập        |
| Xanh mực | `#1E3A8A` | nền hoặc bìa sổ |
| Giấy     | `#FFFFFF` | trang sổ        |
| Gáy sổ   | `#C7D2FE` | khoen gáy sổ    |

| Phương án               | Mô tả                                                                                         | Ưu                                                                            | Nhược                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **A. Bìa sổ** (đề xuất) | Nền xanh mực tràn viền; giữa là cuốn sổ trắng có khoen gáy bên trái; chữ thập đỏ lớn trên bìa | Đọc được cả "sổ" lẫn "y tế" ngay ở 32 px; tương phản tốt trên nền sáng và tối | Nhiều chi tiết nhất (khoen gáy)                                 |
| B. Nền đỏ               | Nền đỏ tràn viền; cuốn sổ trắng; chữ thập đỏ trên sổ                                          | Rất nổi trên màn hình chính                                                   | Đỏ cả nền dễ lẫn với app y tế, ngân hàng khác; gắt khi nhìn lâu |
| C. Dấu trang chữ thập   | Nền sáng; bìa sổ xanh mực; chữ thập đỏ là tấm đánh dấu trang ló ra ở mép trên                 | Mềm, "sổ tay" rõ nhất                                                         | Chữ thập nhỏ, gần mất ở 16–32 px                                |

**Hình học** (khung 512):

- Hình chính nằm trong vòng tròn bán kính 205 px (80 % cạnh). Đó là vùng an toàn của icon `maskable`, nên Android cắt tròn, vuông bo hay giọt nước đều không mất hình.
- Icon `any` dùng chính hình đó trên nền bo góc, vì iPhone tự bo góc.

**Tạo PNG**: `scripts/build-icons.mjs` mở Chromium của Playwright, vẽ SVG gốc `src/assets/app-icon.svg` (cùng biến thể maskable và favicon) ra:

- `public/icons/icon-192.png`, `public/icons/icon-512.png`;
- `public/icons/maskable-512.png`;
- `src/app/apple-icon.png` (180 px, nền đặc, không trong suốt, vì iOS phủ đen phần trong suốt).

Các PNG được commit. Script chỉ chạy lại khi đổi icon (`pnpm icons`), nên build không phụ thuộc trình duyệt.

`src/app/icon.svg` (favicon) là bản rút gọn: bỏ khoen gáy, chữ thập to hơn, để rõ ở 16 px.

### 2. Manifest

```ts
{
  id: "/", name: "Doctor Handbook", short_name: "Sổ tay BS", lang: "vi", dir: "ltr",
  start_url: "/patients", scope: "/", display: "standalone", orientation: "portrait",
  background_color: "#f6f7fa", theme_color: "#f6f7fa",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
  ],
  shortcuts: [
    { name: "Thêm bệnh nhân", url: "/patients/new", icons: [...] },
    { name: "Việc cần làm", url: "/todos", icons: [...] },
  ],
}
```

Lối tắt không mang dữ liệu bệnh nhân, nên dùng được ở mọi tài khoản.

### 3. Service worker (`public/sw.js`, tự viết)

**Phương án đã cân nhắc:**

- **Serwist** (teckstack §4.9): plugin `@serwist/next` gắn vào webpack, mà Next 16 build bằng Turbopack mặc định. Thêm một dependency lớn chỉ để cache tệp tĩnh là không đáng.
- **Không service worker**: Chrome vẫn cài được, nhưng mở app lúc mất mạng chỉ thấy trang khủng long, và lần mở nào cũng tải lại toàn bộ tệp JS.

**Đã chọn:** khoảng 60 dòng, không dependency.

| Yêu cầu                                                                  | Xử lý                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `GET /_next/static/*` (gồm font)                                         | **cache-first** (tên tệp có hash, không đổi nội dung)                                                              |
| `/icons/*`, `/icon.svg`, `/offline.html`                                 | **network-first**, mất mạng thì bản trong cache (tên không có hash: deploy đổi chúng thì máy nhận bản mới; review) |
| Điều hướng trang (`request.mode === "navigate"`)                         | **network-only** (có navigation preload); lỗi mạng thì trả `/offline.html` từ cache                                |
| Mọi thứ khác (Server Action, `/api/*`, ảnh đại diện, URL ký của Storage) | không chặn, không cache                                                                                            |
| `install`                                                                | precache `/offline.html` và icon                                                                                   |
| `activate`                                                               | xoá cache của phiên bản cũ; giữ tối đa 300 tệp tĩnh, xoá cũ nhất                                                   |

**Danh sách được phép** là một hàm thuần `isCacheableStatic(url)`, có unit test.

- Chỉ cùng origin.
- Đường dẫn bắt đầu bằng `/_next/static/` hoặc `/icons/`, hoặc là `/icon.svg`, `/offline.html`.

Trang HTML không bao giờ được cache, nên dữ liệu bệnh nhân không thể nằm trong bộ nhớ đệm.

**Đăng ký:** `PwaSetup` (client, trong `AppProviders`) gọi `navigator.serviceWorker.register("/sw.js")`.

- Chỉ khi `process.env.NODE_ENV === "production"`; ở `next dev` thì không, để tránh cache cũ khi đang code.
- `sw.js` được phục vụ với `Cache-Control: no-cache`, khai qua `headers()` trong `next.config.ts`, để bản mới luôn được kiểm.

### 4. Dòng cài trong Cài đặt

`src/lib/pwa/install-prompt.ts` (client) gồm:

- **Giữ sự kiện cài**: lắng nghe `beforeinstallprompt` ngay khi app mở (trong `AppProviders`), gọi `preventDefault()` và giữ sự kiện lại. Sự kiện thường bắn trước khi bác sĩ vào Cài đặt.
- **Phát hiện đã cài**: lắng nghe `appinstalled`.
- **`installState()`** trả về một trong bốn trạng thái:
  - `"installed"`: `matchMedia("(display-mode: standalone)")` hoặc `navigator.standalone`;
  - `"prompt"`: đang giữ sự kiện `beforeinstallprompt`;
  - `"dismissed"`: vừa bấm "Không cài" ở hộp thoại; Chrome chỉ hỏi lại sau khi tải lại trang (review);
  - `"ios"`: user agent là iPhone, iPad, hoặc Mac có cảm ứng, với mọi trình duyệt (từ iOS 16.4 trình duyệt nào cũng có "Thêm vào MH chính" trong menu Chia sẻ; review);
  - `"unsupported"`: còn lại.
- **Đọc trạng thái**: `useInstallState()` dùng `useSyncExternalStore`, và server snapshot là `null` nên không lệch lúc hydrate.

`InstallAppRow` (`src/components/common/install-app-row.tsx`) hiện theo trạng thái (theo mockup):

- **`prompt`**: nút "Cài ứng dụng". Gọi `prompt()`, rồi chờ `userChoice`. "accepted" thì hiện "Đã cài trên máy này"; "dismissed" thì giữ nút.
- **`ios`**: hai bước có số thứ tự thật, kèm icon Chia sẻ (`ShareIcon` của lucide) và icon ô vuông có dấu cộng.
- **`installed`**: dòng chữ kèm dấu tích, không nút.
- **`unsupported`**: một câu gợi ý.

### 5. Trang "Đang mất mạng" (`public/offline.html`)

- **Vì sao là HTML tĩnh**: trang này được precache, phải tự đủ, không phụ thuộc bundle của Next.
- **Nội dung**: CSS inline theo token bảng màu A, có nhánh tối qua `prefers-color-scheme`, kèm icon SVG inline.
- **Chữ**: "Đang mất mạng", "Ghi chú đang gõ vẫn được giữ trên máy. Khi có mạng, mở lại để dùng tiếp.", nút "Thử lại" (`location.reload()`).
- **Bảo mật**: không script ngoài; CSP của trang cho phép script inline như phần còn lại của app.

### 6. Proxy

- **Thêm vào matcher**: `sw.js`, `offline.html`, `icons/`, `apple-icon.png`, để trình duyệt tải được khi chưa đăng nhập. Không có tệp nào trong đó chứa dữ liệu.
- **Bỏ**: `apple-icon` của route cũ.

### 7. Lỗi và trường hợp biên

- **Lỗi đăng ký service worker** (trình duyệt chặn, chế độ ẩn danh): bỏ qua im lặng, app chạy như cũ. Không log, vì không có gì để sửa.
- **`prompt()` bị gọi lần hai**: sự kiện chỉ dùng được một lần; sau đó trạng thái về `unsupported` cho tới lần `beforeinstallprompt` sau.
- **Đăng xuất**: cache chỉ có tệp tĩnh, nên không cần xoá gì.

### 8. Giao diện (theo mockup)

Mockup: `openspec/changes/add-pwa-install/mockup/index.html`, file local, mở trực tiếp bằng trình duyệt.

- **Dòng cài trong Cài đặt**: thẻ giống dòng Sao lưu. Icon tải xuống, tiêu đề "Cài ứng dụng lên màn hình chính", và nội dung theo trạng thái nằm ngay trong thẻ (không mở trang mới).
- **Trang mất mạng**: canh giữa, icon app 96 px, tiêu đề, một câu giải thích, nút chính "Thử lại" rộng hết cột trên điện thoại.
- **Màn hình chờ khi mở app**: do hệ điều hành dựng từ `background_color` và icon, nên chỉ minh hoạ trong mockup.

**Trạng thái duyệt**: người dùng duyệt mockup ngày 19/11/2026 và chọn **phương án A (Bìa sổ)**, nguyên trạng.

## Risks / Trade-offs

- **iOS đổi cách "Thêm vào MH chính"** (vị trí nút Chia sẻ khác giữa các bản) → hướng dẫn nói "nút Chia sẻ" kèm icon, không nói vị trí cố định.
- **Chrome đổi điều kiện cài** → `beforeinstallprompt` là tín hiệu duy nhất app dựa vào; không có thì hiện gợi ý, không hỏng gì.
- **Service worker giữ bản giao diện cũ** → chỉ cache tệp có hash; trang luôn lấy từ mạng nên luôn trỏ tới tệp mới; `sw.js` không cache.
- **Thử trên máy thật** → cài trên iPhone và Android thật trong buổi dùng thử (rủi ro R8, chung với giọng nói và tải file sao lưu).

## Migration Plan

Không có migration. Rollback: revert code. Service worker cũ đã đăng ký vẫn chạy ở máy bác sĩ, nhưng chỉ phục vụ tệp tĩnh và trang mất mạng. Muốn gỡ hẳn thì deploy một `sw.js` tự huỷ đăng ký.
