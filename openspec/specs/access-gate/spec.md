# access-gate Specification

## Purpose

Chặn mọi màn hình và API cần đăng nhập trước khi có phiên hợp lệ, đưa người dùng tới đúng nơi (đăng nhập hoặc trang chính theo vai trò) mà không làm mất trang họ định mở, không mở đường chuyển hướng sang trang ngoài, và dọn phiên đã bị thu hồi. Đây là hành vi của khung ứng dụng (`src/proxy.ts`, `src/server/auth/guards.ts`, `/api/auth/clear-session`); luồng đăng nhập thuộc module `auth`.

## Requirements

### Requirement: Trang cần đăng nhập chuyển tới đăng nhập

Khi trình duyệt không có cookie phiên, mọi trang ngoài các trang công khai (`/login`, `/activate`, `/reset-password`) SHALL chuyển tới `/login`, kèm tham số `next` là đường dẫn và query đã yêu cầu; riêng trang chính `/` chuyển tới `/login` không kèm `next`.

#### Scenario: Mở danh sách bệnh nhân khi chưa đăng nhập

- **WHEN** trình duyệt không có cookie phiên mở `/patients?q=an`
- **THEN** trình duyệt được chuyển tới `/login?next=%2Fpatients%3Fq%3Dan`

#### Scenario: Mở trang chính khi chưa đăng nhập

- **WHEN** trình duyệt không có cookie phiên mở `/`
- **THEN** trình duyệt được chuyển tới `/login` không có tham số `next`

#### Scenario: Trang công khai không bị chặn

- **WHEN** trình duyệt không có cookie phiên mở `/login`
- **THEN** trang đăng nhập hiện ra, không bị chuyển hướng

### Requirement: API cần đăng nhập trả lỗi thay vì chuyển hướng

Khi không có cookie phiên, mọi đường dẫn dưới `/api/` ngoài các API công khai (`/api/health`, `/api/auth/clear-session`, `/api/cron/*`) SHALL trả mã 401 với thân JSON `{ "error": { "code": "UNAUTHENTICATED", "message": … } }` và MUST NOT chuyển hướng tới trang HTML.

#### Scenario: Gọi API khi chưa đăng nhập

- **WHEN** một yêu cầu không có cookie phiên gọi `/api/backup/export`
- **THEN** phản hồi có mã 401 và `error.code` là `UNAUTHENTICATED`

### Requirement: Phiên không còn hiệu lực được dọn

Khi cookie phiên tồn tại nhưng phiên không còn hiệu lực (đã đăng xuất ở nơi khác, đã đặt lại mật khẩu, tài khoản bị khoá, phiên không tồn tại), trang cần đăng nhập SHALL chuyển qua `/api/auth/clear-session`, nơi cookie phiên bị xoá rồi chuyển tới `/login` kèm `next` là trang đã yêu cầu. `/api/auth/clear-session` MUST NOT xoá cookie của một phiên còn hiệu lực; khi đó nó chuyển tới trang chính theo vai trò.

#### Scenario: Tài khoản bị khoá khi đang đăng nhập

- **WHEN** Admin khoá tài khoản của một bác sĩ và bác sĩ đó mở `/todos` với cookie phiên cũ
- **THEN** cookie phiên bị xoá và bác sĩ được chuyển tới `/login?next=%2Ftodos`

#### Scenario: Gọi dọn phiên khi phiên còn hiệu lực

- **WHEN** một bác sĩ có phiên hợp lệ mở `/api/auth/clear-session`
- **THEN** cookie phiên giữ nguyên và bác sĩ được chuyển tới `/patients`

### Requirement: Không chuyển hướng ra ngoài ứng dụng

Mọi giá trị `next` dùng để chuyển hướng SHALL chỉ được chấp nhận khi là đường dẫn tương đối cùng nguồn (bắt đầu bằng một dấu `/`, không phải `//` hay `/\`, không chứa ký tự điều khiển); giá trị khác MUST bị bỏ qua.

#### Scenario: Tham số next trỏ ra trang ngoài

- **WHEN** trình duyệt mở `/api/auth/clear-session?next=%2F%2Fevil.com`
- **THEN** trình duyệt được chuyển tới `/login` không có tham số `next`

#### Scenario: Ký tự điều khiển trong next

- **WHEN** giá trị `next` là `/\t/evil.com`
- **THEN** giá trị đó bị bỏ qua

### Requirement: Mỗi vai trò chỉ vào khu vực của mình

Bác sĩ SHALL chỉ vào được khu vực bác sĩ (`/patients`, `/todos`, `/settings`); Admin SHALL chỉ vào được khu vực quản trị (`/admin/*`). Người đã đăng nhập mở khu vực của vai trò khác SHALL được chuyển tới trang chính của vai trò mình (bác sĩ: `/patients`; Admin: `/admin/access-codes`). Người đã đăng nhập mở trang đăng nhập, kích hoạt hay đặt lại mật khẩu SHALL được chuyển tới trang chính của vai trò mình.

#### Scenario: Admin mở danh sách bệnh nhân

- **WHEN** Admin đã đăng nhập mở `/patients`
- **THEN** Admin được chuyển tới `/admin/access-codes`

#### Scenario: Bác sĩ mở khu vực quản trị

- **WHEN** bác sĩ đã đăng nhập mở `/admin/accounts`
- **THEN** bác sĩ được chuyển tới `/patients`

#### Scenario: Đã đăng nhập mở trang đăng nhập

- **WHEN** bác sĩ đã đăng nhập mở `/login`
- **THEN** bác sĩ được chuyển tới `/patients`

### Requirement: Kiểm tra sống và việc định kỳ

`/api/health` SHALL luôn trả `{ "status": "ok" }` mà không cần đăng nhập và không truy cập database. `/api/cron/daily-maintenance` SHALL chỉ chạy khi yêu cầu mang `Authorization: Bearer <CRON_SECRET>` đúng; thiếu hoặc sai SHALL trả 401.

#### Scenario: Kiểm tra sống

- **WHEN** một yêu cầu không có cookie gọi `/api/health`
- **THEN** phản hồi có mã 200 và `status` là `ok`

#### Scenario: Gọi việc định kỳ không có bí mật

- **WHEN** một yêu cầu không có header `Authorization` gọi `/api/cron/daily-maintenance` trên môi trường đã đặt `CRON_SECRET`
- **THEN** phản hồi có mã 401
