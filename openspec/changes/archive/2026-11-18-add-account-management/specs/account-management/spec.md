# Spec Delta

## Purpose

Admin xem các tài khoản bác sĩ đang có, và khoá hoặc mở khoá một tài khoản. Khoá là lớp bảo vệ khi bác sĩ mất thiết bị, vì phiên đăng nhập không tự hết hạn. Đây là phần việc của module `admin` ở trang `/admin/accounts`; Admin không bao giờ thấy dữ liệu bệnh nhân ở đây.

## ADDED Requirements

### Requirement: Danh sách tài khoản bác sĩ

Trang `/admin/accounts` SHALL liệt kê mọi tài khoản bác sĩ, mới tạo nhất ở trên. Mỗi dòng có họ tên, tên đăng nhập, ngày tạo, lần đăng nhập cuối (hoặc "Chưa đăng nhập") và trạng thái "Đang hoạt động" hoặc "Đã khoá". Trạng thái MUST NOT chỉ thể hiện bằng màu. Tài khoản Admin MUST NOT có trong danh sách. Trang MUST NOT hiện dữ liệu bệnh nhân. Khi chưa có tài khoản bác sĩ nào, trang SHALL hiện trạng thái rỗng.

#### Scenario: Xem danh sách

- **WHEN** Admin mở `/admin/accounts` khi có hai tài khoản bác sĩ `bs.lan` (đang hoạt động) và `bs.khoa` (đã khoá)
- **THEN** trang hiện hai dòng với họ tên, tên đăng nhập, ngày tạo, lần đăng nhập cuối, và trạng thái lần lượt "Đang hoạt động" và "Đã khoá"

#### Scenario: Tài khoản Admin không có trong danh sách

- **WHEN** Admin mở `/admin/accounts`
- **THEN** không dòng nào có tên đăng nhập của tài khoản Admin

#### Scenario: Bác sĩ chưa đăng nhập lần nào

- **WHEN** một tài khoản bác sĩ chưa có lần đăng nhập nào được ghi lại
- **THEN** dòng của tài khoản đó hiện "Chưa đăng nhập" thay cho thời điểm đăng nhập cuối

#### Scenario: Chưa có tài khoản bác sĩ nào

- **WHEN** Admin mở `/admin/accounts` khi chưa có tài khoản bác sĩ nào
- **THEN** trang hiện "Chưa có tài khoản bác sĩ nào" cùng liên kết tới trang Mã truy cập

### Requirement: Khoá tài khoản

Tài khoản bác sĩ đang hoạt động SHALL có nút "Khoá". Bấm nút SHALL mở hộp thoại xác nhận nêu họ tên bác sĩ; chỉ khi Admin xác nhận thì tài khoản mới bị khoá. Khoá SHALL kết thúc ngay mọi phiên của tài khoản đó trên mọi thiết bị. Tài khoản bị khoá MUST NOT đăng nhập được cho tới khi được mở khoá.

#### Scenario: Khoá tài khoản đang dùng

- **WHEN** `bs.lan` đang đăng nhập trên một thiết bị, và Admin bấm "Khoá" ở dòng của `bs.lan` rồi xác nhận
- **THEN** dòng đó chuyển sang "Đã khoá", và thiết bị của `bs.lan` mở `/patients` thì bị chuyển tới trang đăng nhập

#### Scenario: Đổi ý trong hộp thoại

- **WHEN** Admin bấm "Khoá" rồi chọn "Không khoá" trong hộp thoại
- **THEN** tài khoản vẫn "Đang hoạt động" và phiên của bác sĩ vẫn còn hiệu lực

#### Scenario: Bị khoá thì không đăng nhập được

- **WHEN** Admin đã khoá `bs.lan` và `bs.lan` nhập đúng mật khẩu ở trang đăng nhập
- **THEN** trang hiện "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên."

### Requirement: Mở khoá tài khoản

Tài khoản bác sĩ đã khoá SHALL có nút "Mở khoá", chạy ngay mà không hỏi xác nhận. Sau khi mở khoá, bác sĩ SHALL đăng nhập lại được bằng mật khẩu hiện có. Các phiên đã kết thúc lúc khoá MUST NOT có hiệu lực trở lại.

#### Scenario: Mở khoá rồi đăng nhập lại

- **WHEN** Admin bấm "Mở khoá" ở dòng của `bs.khoa` đang bị khoá
- **THEN** dòng đó chuyển sang "Đang hoạt động", và `bs.khoa` đăng nhập lại được bằng mật khẩu của mình

#### Scenario: Phiên cũ không sống lại

- **WHEN** `bs.lan` đang đăng nhập trên một thiết bị, Admin khoá rồi mở khoá `bs.lan`
- **THEN** thiết bị đó mở `/patients` vẫn bị chuyển tới trang đăng nhập

### Requirement: Chỉ Admin quản lý tài khoản

Xem danh sách, khoá và mở khoá tài khoản SHALL chỉ dành cho Admin đã đăng nhập. Yêu cầu khoá hay mở khoá từ người chưa đăng nhập MUST bị từ chối với mã lỗi `UNAUTHENTICATED`, từ bác sĩ MUST bị từ chối với mã lỗi `FORBIDDEN`; trong cả hai trường hợp MUST NOT có tài khoản nào bị thay đổi. Yêu cầu nhắm vào tài khoản Admin hoặc tài khoản không tồn tại MUST bị từ chối với "Không tìm thấy tài khoản." và không thay đổi gì.

#### Scenario: Bác sĩ gửi yêu cầu khoá tài khoản khác

- **WHEN** bác sĩ `bs.minh` đã đăng nhập gửi yêu cầu khoá tài khoản `bs.lan`
- **THEN** yêu cầu bị từ chối với mã lỗi `FORBIDDEN` và `bs.lan` vẫn đang hoạt động

#### Scenario: Chưa đăng nhập gửi yêu cầu mở khoá

- **WHEN** một yêu cầu không có phiên gửi yêu cầu mở khoá `bs.khoa`
- **THEN** yêu cầu bị từ chối với mã lỗi `UNAUTHENTICATED` và `bs.khoa` vẫn bị khoá

#### Scenario: Khoá tài khoản Admin

- **WHEN** Admin gửi yêu cầu khoá chính tài khoản Admin
- **THEN** yêu cầu bị từ chối với "Không tìm thấy tài khoản." và tài khoản Admin vẫn hoạt động
