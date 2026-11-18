# password-change Specification

## Purpose

Bác sĩ đang đăng nhập đổi mật khẩu của chính mình ở màn hình Cài đặt; thiết bị đang dùng vẫn giữ đăng nhập, mọi thiết bị khác bị đăng xuất (idea.md §8.3, D13). Đây là phần việc của module `auth`.

## Requirements

### Requirement: Đổi mật khẩu khi đang đăng nhập

Màn hình `/settings` của bác sĩ SHALL có thẻ "Đổi mật khẩu" với ô "Mật khẩu hiện tại", ô "Mật khẩu mới" và nút "Đổi mật khẩu". Khi mật khẩu hiện tại đúng và mật khẩu mới hợp lệ (8–128 ký tự, không bị cắt khoảng trắng), mật khẩu SHALL được đổi ngay; phiên của thiết bị đang dùng SHALL vẫn còn hiệu lực, mọi phiên khác của tài khoản SHALL kết thúc. Trang SHALL báo "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất." và xoá các ô.

#### Scenario: Đổi mật khẩu thành công

- **WHEN** `bs.lan` nhập đúng mật khẩu hiện tại, nhập mật khẩu mới `matkhau-moi-123` và bấm "Đổi mật khẩu"
- **THEN** trang báo "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.", và `bs.lan` đăng nhập được bằng `matkhau-moi-123` nhưng không đăng nhập được bằng mật khẩu cũ

#### Scenario: Thiết bị đang dùng vẫn đăng nhập, thiết bị khác bị đăng xuất

- **WHEN** `bs.lan` đăng nhập trên hai thiết bị và đổi mật khẩu ở thiết bị thứ nhất
- **THEN** thiết bị thứ nhất vẫn mở được `/patients`, còn thiết bị thứ hai mở `/patients` thì bị chuyển tới trang đăng nhập

### Requirement: Kiểm mật khẩu hiện tại

Mật khẩu hiện tại sai SHALL bị báo "Mật khẩu hiện tại không đúng." dưới ô mật khẩu hiện tại; mật khẩu MUST NOT đổi và không phiên nào bị kết thúc. Mỗi lần sai SHALL được tính vào giới hạn đăng nhập sai của tên đăng nhập đó; khi tên đăng nhập đã có từ 5 lần sai trong 15 phút gần nhất, lần đổi mật khẩu tiếp theo, kể cả đúng mật khẩu, SHALL bị từ chối với "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút."

#### Scenario: Mật khẩu hiện tại sai

- **WHEN** `bs.lan` nhập sai mật khẩu hiện tại và bấm "Đổi mật khẩu"
- **THEN** ô mật khẩu hiện tại báo "Mật khẩu hiện tại không đúng." và mật khẩu cũ vẫn dùng được

#### Scenario: Sai quá nhiều lần

- **WHEN** tên đăng nhập `bs.lan` đã có 5 lần sai trong 15 phút và bác sĩ nhập đúng mật khẩu hiện tại để đổi mật khẩu
- **THEN** trang báo "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." và mật khẩu không đổi

### Requirement: Quy tắc mật khẩu mới

Mật khẩu mới MUST có 8–128 ký tự và MUST khác mật khẩu hiện tại. Lỗi SHALL hiện dưới ô mật khẩu mới; khi có lỗi, mật khẩu MUST NOT đổi.

#### Scenario: Mật khẩu mới quá ngắn

- **WHEN** bác sĩ nhập mật khẩu mới `1234567`
- **THEN** ô mật khẩu mới báo "Mật khẩu cần tối thiểu 8 ký tự." và mật khẩu không đổi

#### Scenario: Mật khẩu mới trùng mật khẩu hiện tại

- **WHEN** bác sĩ nhập mật khẩu mới giống hệt mật khẩu hiện tại
- **THEN** ô mật khẩu mới báo "Mật khẩu mới phải khác mật khẩu hiện tại." và không phiên nào bị kết thúc

### Requirement: Chỉ bác sĩ đã đăng nhập đổi mật khẩu của chính mình

Đổi mật khẩu SHALL chỉ áp dụng cho tài khoản của phiên hiện tại; yêu cầu MUST NOT nhận tài khoản từ client. Yêu cầu từ người chưa đăng nhập MUST bị từ chối với mã lỗi `UNAUTHENTICATED`, từ Admin MUST bị từ chối với mã lỗi `FORBIDDEN`, và không mật khẩu nào bị đổi.

#### Scenario: Chưa đăng nhập gửi yêu cầu đổi mật khẩu

- **WHEN** một yêu cầu không có phiên gửi yêu cầu đổi mật khẩu
- **THEN** yêu cầu bị từ chối với mã lỗi `UNAUTHENTICATED`

#### Scenario: Admin gửi yêu cầu đổi mật khẩu

- **WHEN** Admin đã đăng nhập gửi yêu cầu đổi mật khẩu
- **THEN** yêu cầu bị từ chối với mã lỗi `FORBIDDEN`

### Requirement: Form đổi mật khẩu dùng tốt trên điện thoại

Ô mật khẩu hiện tại SHALL khai loại tự điền mật khẩu hiện tại, ô mật khẩu mới SHALL khai loại tự điền mật khẩu mới; cả hai SHALL bị che mặc định và có nút hiện/ẩn. Mật khẩu MUST NOT xuất hiện trên URL.

#### Scenario: Thuộc tính ô đổi mật khẩu

- **WHEN** thẻ "Đổi mật khẩu" hiện trên điện thoại
- **THEN** ô mật khẩu hiện tại có `autocomplete="current-password"`, ô mật khẩu mới có `autocomplete="new-password"`, cả hai có `type="password"`

#### Scenario: Không lộ mật khẩu lên URL khi đổi

- **WHEN** bác sĩ đổi mật khẩu, thành công hay không
- **THEN** URL của trang không chứa mật khẩu hiện tại hay mật khẩu mới
