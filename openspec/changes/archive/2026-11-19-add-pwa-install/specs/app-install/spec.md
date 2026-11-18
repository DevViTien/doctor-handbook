# Spec Delta

## Purpose

Cài app lên màn hình chính: bác sĩ mở Doctor Handbook bằng một biểu tượng như mọi ứng dụng khác, vào thẳng danh sách bệnh nhân, toàn màn hình. Trình duyệt chỉ giữ lại tệp tĩnh của app, không bao giờ giữ dữ liệu bệnh nhân. Mở app lúc mất mạng thì hiện một trang riêng của app.

## ADDED Requirements

### Requirement: Manifest và icon

App SHALL có manifest với tên "Doctor Handbook", tên ngắn "Sổ tay BS", chế độ `standalone`, trang mở đầu `/patients`, màu nền theo bảng màu của app, và icon PNG 192 × 192 px, 512 × 512 px, kèm một icon 512 px dạng `maskable`. App SHALL có icon iPhone (`apple-touch-icon`) PNG 180 × 180 px. Mọi icon và manifest MUST tải được khi chưa đăng nhập.

#### Scenario: Manifest đủ để cài

- **WHEN** một trình duyệt chưa đăng nhập tải manifest của app
- **THEN** manifest có `display` là `standalone`, `start_url` là `/patients`, và các icon 192 px, 512 px, 512 px `maskable` đều tải được dưới dạng PNG đúng kích thước

#### Scenario: Icon iPhone

- **WHEN** một trình duyệt chưa đăng nhập tải icon iPhone của app
- **THEN** nhận được ảnh PNG 180 × 180 px

### Requirement: Lối tắt khi giữ icon

Manifest SHALL khai hai lối tắt: "Thêm bệnh nhân" mở `/patients/new` và "Việc cần làm" mở `/todos`.

#### Scenario: Lối tắt trong manifest

- **WHEN** một trình duyệt tải manifest của app
- **THEN** manifest có lối tắt "Thêm bệnh nhân" tới `/patients/new` và "Việc cần làm" tới `/todos`

### Requirement: Cài từ Cài đặt

Cài đặt SHALL có dòng "Cài ứng dụng lên màn hình chính" hiện đúng việc bác sĩ làm được trên máy đang dùng: nút "Cài ứng dụng" khi trình duyệt cho cài, hướng dẫn nút Chia sẻ trên iPhone hay iPad, hoặc một câu cho biết tình trạng (đã cài, chưa cài, trình duyệt chưa hỗ trợ).

#### Scenario: Trình duyệt cho cài

- **WHEN** trình duyệt báo app cài được, và bác sĩ mở Cài đặt rồi bấm "Cài ứng dụng"
- **THEN** hộp thoại cài của trình duyệt mở ra, và khi bác sĩ đồng ý thì dòng hiện "Đã cài trên máy này"

#### Scenario: Bác sĩ chưa muốn cài

- **WHEN** trình duyệt báo app cài được, bác sĩ bấm "Cài ứng dụng" rồi chọn "Không cài" ở hộp thoại
- **THEN** dòng hiện "Chưa cài. Tải lại trang để cài lại.", không còn nút "Cài ứng dụng"

#### Scenario: iPhone

- **WHEN** bác sĩ mở Cài đặt bằng trình duyệt trên iPhone
- **THEN** dòng hiện hướng dẫn bấm nút Chia sẻ rồi chọn "Thêm vào MH chính", không có nút "Cài ứng dụng"

#### Scenario: Đang dùng app đã cài

- **WHEN** bác sĩ mở Cài đặt từ icon trên màn hình chính
- **THEN** dòng hiện "Bạn đang dùng ứng dụng đã cài"

#### Scenario: Trình duyệt chưa hỗ trợ cài

- **WHEN** bác sĩ mở Cài đặt bằng một trình duyệt máy tính không báo app cài được
- **THEN** dòng hiện một câu gợi ý mở bằng Chrome (Android) hoặc Safari (iPhone), không có nút "Cài ứng dụng"

### Requirement: Trình duyệt không giữ dữ liệu bệnh nhân

App SHALL đăng ký một service worker chỉ giữ tệp tĩnh của app (mã giao diện, icon, trang "Đang mất mạng"). Trang, kết quả tìm, dữ liệu sao lưu, ảnh đại diện và mọi câu trả lời có dữ liệu MUST NOT được lưu vào bộ nhớ đệm của service worker.

#### Scenario: Bộ nhớ đệm chỉ có tệp tĩnh

- **WHEN** bác sĩ mở danh sách, trang chi tiết của "Nguyễn Văn An" và trang Cài đặt
- **THEN** mọi mục trong bộ nhớ đệm của service worker là tệp tĩnh (`/_next/static/`, `/icons/`, `/icon.svg`, `/offline.html`), và không mục nào chứa "Nguyễn Văn An"

### Requirement: Trang "Đang mất mạng"

Mở một trang của app lúc không có mạng SHALL hiện trang "Đang mất mạng" của app thay cho trang lỗi của trình duyệt. Trang này SHALL nói "Đang mất mạng. Ghi chú đang gõ vẫn được giữ trên máy." và có nút "Thử lại" để tải lại trang. Trang MUST NOT chứa dữ liệu bệnh nhân.

#### Scenario: Mở app lúc mất mạng

- **WHEN** bác sĩ đã mở app ít nhất một lần, rồi mất mạng và mở lại `/patients`
- **THEN** trang hiện "Đang mất mạng" và nút "Thử lại"
