# password-reset Specification

## Purpose

Bác sĩ quên mật khẩu, hoặc vừa mất máy, dùng mã đặt lại mật khẩu do Admin cấp để đặt mật khẩu mới; mọi phiên cũ của tài khoản kết thúc. Không cần email hay dịch vụ ngoài (idea.md §8.2, §8.3, §12.4). Đây là phần việc của module `auth` ở trang `/reset-password`.

## Requirements

### Requirement: Kiểm mã đặt lại mật khẩu

Trang `/reset-password` SHALL bắt đầu bằng một ô nhập mã, nhận mã bất kể chữ hoa hay thường, có hay không có dấu gạch hoặc khoảng trắng. Khi mã dùng được, trang SHALL hiện tên đăng nhập của tài khoản được cấp mã, giờ hết hạn của mã, và ô nhập mật khẩu mới. Bỏ trống mã SHALL báo lỗi ngay dưới ô và MUST NOT được tính là một lần nhập sai.

#### Scenario: Nhập mã đặt lại đúng

- **WHEN** bác sĩ nhập mã đặt lại mật khẩu còn hạn cấp cho tài khoản `bs.lan` và bấm "Tiếp tục"
- **THEN** trang hiện "Đặt lại mật khẩu cho bs.lan", giờ hết hạn của mã và ô mật khẩu mới

#### Scenario: Bỏ trống mã đặt lại

- **WHEN** bác sĩ bấm "Tiếp tục" khi ô mã trống
- **THEN** ô mã báo "Nhập mã đặt lại mật khẩu." và không có lần nhập sai nào được ghi

### Requirement: Mã đặt lại không dùng được không lộ lý do

Mã không tồn tại, đã dùng, đã huỷ, đã hết hạn, hoặc là mã kích hoạt SHALL nhận cùng một thông báo: "Mã đặt lại mật khẩu không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới."

#### Scenario: Mã đặt lại không tồn tại

- **WHEN** bác sĩ nhập một mã không có trong hệ thống ở `/reset-password`
- **THEN** trang hiện "Mã đặt lại mật khẩu không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới."

#### Scenario: Mã đặt lại đã hết hạn hoặc đã dùng

- **WHEN** bác sĩ nhập một mã đặt lại đã quá 72 giờ, hoặc đã được dùng
- **THEN** trang hiện cùng thông báo như mã không tồn tại

#### Scenario: Mã kích hoạt dùng ở trang đặt lại

- **WHEN** bác sĩ nhập một mã kích hoạt còn hạn ở `/reset-password`
- **THEN** trang hiện cùng thông báo như mã không tồn tại và mã kích hoạt vẫn dùng được ở `/activate`

### Requirement: Đặt mật khẩu mới bằng mã

Gửi mật khẩu mới hợp lệ (8–128 ký tự, không bị cắt khoảng trắng) với mã còn dùng được SHALL đổi mật khẩu của tài khoản được cấp mã, đánh dấu mã đã dùng, kết thúc mọi phiên của tài khoản trên mọi thiết bị, rồi đăng nhập trên thiết bị này và chuyển tới `/patients`. Server SHALL kiểm lại mã khi gửi; mọi bước SHALL thành công cùng nhau hoặc không bước nào có hiệu lực. Mỗi mã SHALL đổi mật khẩu được tối đa một lần.

#### Scenario: Đặt lại thành công

- **WHEN** bác sĩ nhập mã đặt lại của `bs.lan`, nhập mật khẩu mới `matkhau-moi-123` và bấm "Đặt mật khẩu mới"
- **THEN** bác sĩ vào `/patients` đã đăng nhập, và đăng nhập `bs.lan` bằng mật khẩu cũ thì bị báo sai thông tin

#### Scenario: Mọi thiết bị cũ bị đăng xuất

- **WHEN** `bs.lan` đang đăng nhập trên một thiết bị khác và đặt lại mật khẩu bằng mã
- **THEN** thiết bị khác đó mở `/patients` thì bị chuyển tới trang đăng nhập

#### Scenario: Mật khẩu mới quá ngắn

- **WHEN** bác sĩ nhập mật khẩu mới `1234567`
- **THEN** ô mật khẩu báo "Mật khẩu cần tối thiểu 8 ký tự.", mật khẩu cũ vẫn dùng được và mã vẫn còn hạn

#### Scenario: Dùng lại mã đặt lại

- **WHEN** một người nhập lại mã đặt lại đã dùng để đổi mật khẩu
- **THEN** trang hiện thông báo mã không dùng được

### Requirement: Tài khoản bị khoá không đặt lại được

Nếu tài khoản được cấp mã đang bị khoá lúc nhập mã hoặc lúc gửi mật khẩu mới, việc đặt lại SHALL bị từ chối với "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên."; mật khẩu MUST NOT đổi và mã SHALL vẫn còn dùng được sau khi Admin mở khoá.

#### Scenario: Bị khoá sau khi được cấp mã

- **WHEN** Admin cấp mã đặt lại cho `bs.lan`, rồi khoá `bs.lan`, rồi bác sĩ gửi mật khẩu mới bằng mã đó
- **THEN** trang hiện "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên." và mật khẩu cũ của `bs.lan` không đổi

### Requirement: Giới hạn nhập sai mã đặt lại

Lần nhập mã đặt lại không dùng được SHALL được tính chung với lần nhập mã kích hoạt sai theo địa chỉ IP: khi một IP đã có từ 10 lần nhập mã không dùng được trong 15 phút gần nhất, mọi lần nhập mã tiếp theo ở `/reset-password`, kể cả mã đúng, SHALL bị từ chối với "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." Lần bị từ chối vì giới hạn MUST NOT được tính là lần sai.

#### Scenario: Quá nhiều lần nhập mã sai

- **WHEN** một IP đã nhập 10 mã không dùng được trong 15 phút rồi nhập một mã đặt lại đúng
- **THEN** trang hiện "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." và không hiện ô mật khẩu mới

### Requirement: Trang đặt lại mật khẩu dùng tốt trên điện thoại

Ô mã SHALL tự viết hoa khi gõ, MUST NOT tự sửa chính tả hay gợi ý tự điền. Ô mật khẩu mới SHALL khai loại tự điền mật khẩu mới, bị che mặc định và có nút hiện/ẩn. Mã và mật khẩu MUST NOT xuất hiện trên URL. Trang đăng nhập SHALL có liên kết "Quên mật khẩu?" tới `/reset-password`, và trang đặt lại SHALL có liên kết quay lại trang đăng nhập.

#### Scenario: Thuộc tính ô nhập trang đặt lại

- **WHEN** trang đặt lại mật khẩu hiện trên điện thoại
- **THEN** ô mã có `autocapitalize="characters"`, `autocorrect="off"`, `spellcheck="false"`, `autocomplete="off"`, và ô mật khẩu mới có `autocomplete="new-password"`

#### Scenario: Mở trang đặt lại từ trang đăng nhập

- **WHEN** bác sĩ bấm "Quên mật khẩu?" ở trang đăng nhập
- **THEN** trang `/reset-password` hiện ra với ô nhập mã

#### Scenario: Không lộ mã và mật khẩu lên URL

- **WHEN** bác sĩ đi hết hai bước đặt lại mật khẩu
- **THEN** URL của trang chưa bao giờ chứa mã hay mật khẩu
