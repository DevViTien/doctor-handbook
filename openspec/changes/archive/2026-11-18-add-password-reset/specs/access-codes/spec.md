# Spec Delta

## ADDED Requirements

### Requirement: Admin cấp mã đặt lại mật khẩu

Mỗi tài khoản bác sĩ đang hoạt động ở `/admin/accounts` SHALL có nút "Cấp mã đặt lại mật khẩu"; tài khoản đang bị khoá MUST NOT có nút này. Bấm nút SHALL tạo ngay một mã đặt lại mật khẩu gắn với tài khoản đó, cùng định dạng và hạn 72 giờ như mã kích hoạt, và hiện mã một lần trong hộp thoại có nút sao chép tin nhắn (mã, đường dẫn `/reset-password` không chứa mã, giờ hết hạn). Tạo mã mới SHALL huỷ mọi mã đặt lại còn hạn trước đó của cùng tài khoản.

#### Scenario: Cấp mã đặt lại cho bác sĩ quên mật khẩu

- **WHEN** Admin bấm "Cấp mã đặt lại mật khẩu" ở dòng của `bs.lan`
- **THEN** hộp thoại hiện một mã dạng `XXXX-XXXX`, tên đăng nhập `bs.lan` và giờ hết hạn bằng lúc tạo cộng 72 giờ

#### Scenario: Cấp mã mới thì mã cũ bị huỷ

- **WHEN** Admin cấp mã đặt lại cho `bs.lan` hai lần liên tiếp
- **THEN** mã thứ nhất ở trạng thái "Đã huỷ" trong danh sách mã và không dùng được ở `/reset-password`, còn mã thứ hai dùng được

#### Scenario: Tài khoản bị khoá không có nút cấp mã đặt lại

- **WHEN** Admin xem dòng của tài khoản `bs.khoa` đang bị khoá
- **THEN** dòng đó không có nút "Cấp mã đặt lại mật khẩu"

#### Scenario: Bác sĩ gửi yêu cầu cấp mã đặt lại

- **WHEN** bác sĩ đã đăng nhập gửi yêu cầu cấp mã đặt lại mật khẩu cho một tài khoản
- **THEN** yêu cầu bị từ chối với mã lỗi `FORBIDDEN` và không có mã nào được tạo

## MODIFIED Requirements

### Requirement: Danh sách mã theo trạng thái

Trang `/admin/access-codes` SHALL liệt kê các mã đã tạo, cả mã kích hoạt lẫn mã đặt lại mật khẩu, mới nhất ở trên. Mỗi dòng có nhãn loại ("Kích hoạt" hoặc "Đặt lại mật khẩu"), tên người nhận, ngày giờ tạo và đúng một trạng thái theo thứ tự ưu tiên: "Đã huỷ", rồi "Đã dùng" (kèm tên đăng nhập của tài khoản và thời điểm dùng), rồi "Hết hạn", rồi "Còn hạn" (kèm giờ hết hạn). Trạng thái MUST NOT chỉ thể hiện bằng màu. Khi chưa có mã nào, trang SHALL hiện trạng thái rỗng.

#### Scenario: Mã còn hạn

- **WHEN** danh sách có một mã tạo cách đây 1 giờ, chưa dùng, chưa huỷ
- **THEN** dòng của mã đó hiện "Còn hạn" và giờ hết hạn

#### Scenario: Mã đã dùng

- **WHEN** một mã đã được dùng để tạo tài khoản `bs.tran`
- **THEN** dòng của mã đó hiện "Đã dùng", tên đăng nhập `bs.tran` và thời điểm dùng

#### Scenario: Mã hết hạn

- **WHEN** một mã chưa dùng, chưa huỷ, đã quá 72 giờ kể từ lúc tạo
- **THEN** dòng của mã đó hiện "Hết hạn" và không có nút huỷ

#### Scenario: Mã đã huỷ

- **WHEN** Admin đã huỷ một mã
- **THEN** dòng của mã đó hiện "Đã huỷ" và không có nút huỷ

#### Scenario: Chưa có mã nào

- **WHEN** Admin mở `/admin/access-codes` khi chưa từng tạo mã
- **THEN** trang hiện "Chưa có mã nào" cùng lời hướng dẫn tạo mã đầu tiên

#### Scenario: Mã đặt lại mật khẩu trong danh sách

- **WHEN** Admin đã cấp một mã đặt lại mật khẩu cho `bs.lan` và một mã kích hoạt cho "BS. Trần Thị B"
- **THEN** danh sách có hai dòng, lần lượt mang nhãn "Đặt lại mật khẩu" (kèm `bs.lan`) và "Kích hoạt", và mã đặt lại còn hạn có nút "Huỷ mã"
