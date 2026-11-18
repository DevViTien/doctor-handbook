# Proposal

## Why

Bác sĩ mở app nhiều lần mỗi ca khám, bằng một tay. Mở trình duyệt rồi gõ địa chỉ là quá chậm. Một biểu tượng trên màn hình chính, mở thẳng vào danh sách bệnh nhân, mới đúng tinh thần "nhanh như lật sổ" (N2). Kế hoạch dùng thử (idea.md §15) cũng ghi rõ buổi hướng dẫn gồm bước "cài lên màn hình chính".

Hiện app mới có manifest tối thiểu: icon SVG tạm (một cuốn sổ đen) và một icon iPhone chỉ có dấu "+". Chưa có icon PNG cho Android, chưa có service worker, chưa có chỗ nào chỉ bác sĩ cách cài. Mở app lúc mất mạng thì chỉ thấy trang lỗi của trình duyệt.

Change này không thuộc module nghiệp vụ nào: nó nằm ở tầng app (`src/app`) và tầng dùng chung (`src/components`, `src/lib`, `public/`). Đáp ứng idea.md:

- §11 Hệ thống: "Cài lên màn hình chính như app (PWA)" (Should).
- §13: web mobile-first, dạng PWA để cài lên màn hình chính.
- §15: hướng dẫn dùng thử có bước cài lên màn hình chính.
- N2, N3: mở app là vào thẳng việc chính, dùng một tay.
- S7, N6: không có dữ liệu bệnh nhân nào nằm trong bộ nhớ đệm của trình duyệt.

## What Changes

- **Bộ icon mới** do tôi thiết kế. Điểm chính là **chữ thập đỏ y tế trên bìa một cuốn sổ tay**; mockup có 3 phương án để bạn chọn. Gồm:
  - icon PNG 192 và 512 px;
  - icon "maskable" 512 px để Android cắt tròn hay vuông mà không mất hình;
  - icon iPhone 180 px;
  - favicon SVG cho tab trình duyệt.
- **Manifest hoàn chỉnh**:
  - tên "Doctor Handbook", tên ngắn "Sổ tay BS";
  - mở ở chế độ `standalone`, vào thẳng `/patients`;
  - màu nền và màu thanh trạng thái theo bảng màu A;
  - lối tắt khi giữ icon (Android): "Thêm bệnh nhân" và "Việc cần làm".
- **Cài từ Cài đặt**: một dòng mới "Cài ứng dụng lên màn hình chính".
  - **Android / Chrome**: nút "Cài ứng dụng" mở hộp thoại cài của trình duyệt. Cài xong dòng này hiện "Đã cài trên máy này".
  - **iPhone / Safari**: Safari không có nút cài tự động, nên dòng này hiện hướng dẫn 2 bước kèm hình nút Chia sẻ: bấm Chia sẻ, rồi "Thêm vào MH chính".
  - **Đang mở từ icon đã cài**: dòng hiện "Bạn đang dùng ứng dụng đã cài".
  - **Trình duyệt không hỗ trợ cài** (ví dụ Firefox trên máy tính): dòng hiện "Mở trang này bằng Chrome hoặc Safari để cài".
- **Service worker nhỏ tự viết** (`public/sw.js`):
  - chỉ lưu tệp tĩnh của app (`/_next/static/*`, icon, font) để mở nhanh hơn;
  - **không bao giờ lưu trang hay dữ liệu**: mọi trang và mọi yêu cầu dữ liệu vẫn đi thẳng lên mạng.
- **Trang "Đang mất mạng"**: mở app lúc không có mạng thì hiện một trang riêng của app, thay cho trang lỗi của trình duyệt. Trang có icon, câu "Đang mất mạng. Ghi chú đang gõ vẫn được giữ trên máy." và nút "Thử lại". Trang này không chứa dữ liệu bệnh nhân.

## Capabilities

### New Capabilities

- `app-install`: cài app lên màn hình chính. Gồm manifest và icon, lối tắt, dòng cài trong Cài đặt (Android, iPhone, đã cài, không hỗ trợ), service worker chỉ lưu tệp tĩnh, và trang "Đang mất mạng".

### Modified Capabilities

(Không có.) Không requirement nào hiện có bị đổi.

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, sáng/tối, điện thoại/máy tính. Gồm:
  - 3 phương án icon, ở nhiều cỡ và trên màn hình chính Android và iPhone;
  - vùng an toàn của icon maskable;
  - màn hình chờ khi mở app;
  - dòng cài trong Cài đặt, đủ 4 trạng thái;
  - trang "Đang mất mạng".

  Người dùng chọn icon và duyệt trước khi code.

- **Route và tệp tĩnh**:
  - `src/app/manifest.ts`;
  - `src/app/icon.svg` (thay icon tạm);
  - `src/app/apple-icon.png` (thay `apple-icon.tsx`);
  - `public/icons/*.png`, `public/sw.js`, `public/offline.html`.
- **Tầng dùng chung**:
  - `src/lib/pwa/install-prompt.ts`: giữ sự kiện `beforeinstallprompt` từ lúc app mở;
  - `src/components/providers/service-worker.tsx`: đăng ký service worker, chỉ ở bản production;
  - `src/components/common/install-app-row.tsx`: dòng cài trong Cài đặt.
- **Cài đặt**: `src/app/(doctor)/settings/page.tsx` thêm dòng cài.
- **Proxy**: `src/proxy.ts` để `/sw.js`, `/offline.html`, `/icons/*` và `/apple-icon.png` đi qua mà không cần đăng nhập. Trình duyệt tải các tệp này cả khi chưa có phiên.
- **Công cụ**: `scripts/build-icons.mjs` vẽ các PNG từ một tệp SVG gốc bằng Chromium của Playwright có sẵn. PNG được commit vào repo; build không cần chạy script này.
- **Thư viện**: không thêm. Không dùng Serwist như teckstack §4.9 ghi: plugin của Serwist cần webpack, còn Next 16 build bằng Turbopack; mà service worker cần ở đây chỉ khoảng 60 dòng. teckstack được cập nhật theo.
- **Database, sao lưu**: không đổi.
- **Bất biến**:
  - Không đưa dữ liệu bệnh nhân vào bộ nhớ đệm của trình duyệt: service worker chỉ lưu theo danh sách đường dẫn tĩnh được phép.
  - Không thêm dịch vụ ngoài.

## Ngoài phạm vi

- **Xem dữ liệu khi hoàn toàn mất mạng** (§11 Could, Phase 2): trang mất mạng chỉ báo tình trạng, không hiện dữ liệu.
- **Thông báo đẩy (push)**: không có (D15).
- **Tự nhắc cài khi mở app lần đầu**: chưa làm. Nút cài nằm trong Cài đặt, và buổi hướng dẫn dùng thử chỉ cho bác sĩ.
- **Icon riêng cho Admin**: dùng chung icon.
