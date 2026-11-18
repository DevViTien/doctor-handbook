# account-activation Specification

## Purpose

Bác sĩ dùng mã kích hoạt Admin cấp để tự tạo tài khoản (họ tên, tên đăng nhập, mật khẩu), đồng ý lưu ý sử dụng rồi vào app ngay. Tài khoản bác sĩ chỉ được tạo theo cách này (idea.md D2, D17). Đây là phần việc của module `auth` ở trang `/activate`.

## Requirements

### Requirement: Kiểm mã trước khi tạo tài khoản

Trang `/activate` SHALL bắt đầu bằng một ô nhập mã. Mã SHALL được chấp nhận bất kể chữ hoa hay thường, có hay không có dấu gạch hoặc khoảng trắng. Khi mã dùng được, trang SHALL hiện tên người nhận và giờ hết hạn của mã, cùng form tạo tài khoản. Bỏ trống mã SHALL báo lỗi ngay dưới ô và MUST NOT được tính là một lần nhập sai.

#### Scenario: Nhập mã đúng

- **WHEN** bác sĩ nhập `K7HM-3QXR` (mã còn hạn cấp cho "BS. Trần Thị B") và bấm "Tiếp tục"
- **THEN** trang hiện "BS. Trần Thị B", giờ hết hạn của mã và form tạo tài khoản

#### Scenario: Nhập mã chữ thường không dấu gạch

- **WHEN** bác sĩ nhập `k7hm3qxr` cho mã `K7HM-3QXR`
- **THEN** mã được chấp nhận như khi nhập `K7HM-3QXR`

#### Scenario: Bỏ trống mã

- **WHEN** bác sĩ bấm "Tiếp tục" khi ô mã trống
- **THEN** ô mã báo "Nhập mã kích hoạt." và không có lần nhập sai nào được ghi

### Requirement: Mã không dùng được không lộ lý do

Mã không tồn tại, đã dùng, đã huỷ, đã hết hạn, hoặc không phải mã kích hoạt SHALL nhận cùng một thông báo: "Mã kích hoạt không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới." Trang MUST NOT cho biết lý do cụ thể, để không dò được mã nào có thật.

#### Scenario: Mã không tồn tại

- **WHEN** bác sĩ nhập một mã không có trong hệ thống
- **THEN** trang hiện "Mã kích hoạt không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới."

#### Scenario: Mã đã hết hạn

- **WHEN** bác sĩ nhập một mã được tạo cách đây hơn 72 giờ
- **THEN** trang hiện cùng thông báo như mã không tồn tại

#### Scenario: Mã đã dùng hoặc đã huỷ

- **WHEN** bác sĩ nhập một mã đã dùng để tạo tài khoản, hoặc một mã Admin đã huỷ
- **THEN** trang hiện cùng thông báo như mã không tồn tại

#### Scenario: Mã đặt lại mật khẩu dùng ở trang kích hoạt

- **WHEN** bác sĩ nhập một mã đặt lại mật khẩu còn hạn ở trang `/activate`
- **THEN** trang hiện cùng thông báo như mã không tồn tại và không có tài khoản nào được tạo

### Requirement: Tạo tài khoản bằng mã kích hoạt

Gửi form tạo tài khoản với mã còn dùng được và dữ liệu hợp lệ SHALL tạo một tài khoản bác sĩ đang hoạt động, ghi lại thời điểm đồng ý lưu ý sử dụng, đánh dấu mã đã dùng gắn với tài khoản đó, đăng nhập luôn trên thiết bị (như một lần đăng nhập thành công) và chuyển tới `/patients`. Server SHALL kiểm lại mã khi gửi form. Mọi bước SHALL thành công cùng nhau hoặc không bước nào có hiệu lực.

#### Scenario: Kích hoạt thành công

- **WHEN** bác sĩ nhập mã đúng, điền họ tên "Trần Thị B", tên đăng nhập `bs.tran`, mật khẩu `matkhau123`, tick đồng ý và bấm "Tạo tài khoản"
- **THEN** bác sĩ vào `/patients` đã đăng nhập, và danh sách mã của Admin hiện mã đó "Đã dùng" bởi `bs.tran`

#### Scenario: Đăng nhập lại bằng tài khoản vừa tạo

- **WHEN** bác sĩ vừa kích hoạt `bs.tran` đăng xuất rồi đăng nhập với `bs.tran` và `matkhau123`
- **THEN** đăng nhập thành công và vào `/patients`

#### Scenario: Họ tên điền sẵn từ tên người nhận

- **WHEN** form tạo tài khoản hiện cho mã cấp cho "BS. Trần Thị B"
- **THEN** ô họ tên có sẵn "BS. Trần Thị B" và bác sĩ sửa được trước khi gửi

### Requirement: Quy tắc tên đăng nhập, mật khẩu và họ tên

Tên đăng nhập SHALL được bỏ khoảng trắng hai đầu và chuyển về chữ thường, rồi MUST gồm 3–32 ký tự chỉ là chữ không dấu, chữ số, dấu chấm, gạch dưới, và MUST NOT trùng tài khoản nào đã có. Mật khẩu MUST có 8–128 ký tự, không bị cắt khoảng trắng, không có quy tắc thành phần. Họ tên MUST không trống, tối đa 80 ký tự. Lỗi SHALL hiện dưới đúng ô; lỗi ở form này MUST NOT làm mã bị dùng.

#### Scenario: Tên đăng nhập có dấu

- **WHEN** bác sĩ nhập tên đăng nhập `bs.lân`
- **THEN** ô tên đăng nhập báo "Tên đăng nhập gồm 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới." và không có tài khoản nào được tạo

#### Scenario: Tên đăng nhập viết hoa

- **WHEN** bác sĩ kích hoạt với tên đăng nhập `BS.Tran`
- **THEN** tài khoản được tạo với tên đăng nhập `bs.tran`

#### Scenario: Tên đăng nhập đã có người dùng

- **WHEN** bác sĩ chọn tên đăng nhập `bs.lan` đã thuộc một tài khoản khác
- **THEN** ô tên đăng nhập báo "Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.", mã vẫn còn hạn và bác sĩ đổi tên rồi gửi lại được

#### Scenario: Mật khẩu quá ngắn

- **WHEN** bác sĩ nhập mật khẩu `1234567`
- **THEN** ô mật khẩu báo "Mật khẩu cần tối thiểu 8 ký tự." và không có tài khoản nào được tạo

### Requirement: Đồng ý lưu ý sử dụng

Form tạo tài khoản SHALL hiện lưu ý sử dụng: app là sổ ghi nhớ cá nhân, không thay thế hồ sơ bệnh án; dữ liệu trên máy chủ miễn phí có thể mất nên phải tự sao lưu; file sao lưu chứa thông tin bệnh nhân; chỉ ghi thông tin cần thiết; app giữ đăng nhập nên bác sĩ tự bảo vệ thiết bị, mất máy thì báo Admin. Tài khoản MUST NOT được tạo khi bác sĩ chưa tick "Tôi đã đọc và đồng ý".

#### Scenario: Chưa tick đồng ý

- **WHEN** bác sĩ điền đủ form tạo tài khoản nhưng không tick "Tôi đã đọc và đồng ý" rồi bấm "Tạo tài khoản"
- **THEN** ô tick báo "Bạn cần đọc và đồng ý lưu ý sử dụng." và không có tài khoản nào được tạo

#### Scenario: Lưu ý hiện trước khi tạo tài khoản

- **WHEN** form tạo tài khoản hiện ra
- **THEN** lưu ý có câu "không thay thế hồ sơ bệnh án" và nhắc sao lưu thường xuyên

### Requirement: Mã chỉ tạo được một tài khoản

Mỗi mã kích hoạt SHALL tạo được tối đa một tài khoản, kể cả khi nhiều lần gửi diễn ra cùng lúc. Nếu mã hết hạn, bị huỷ hoặc đã được dùng trong lúc bác sĩ đang điền form, lần gửi SHALL bị từ chối với thông báo mã không dùng được, và trang SHALL quay về bước nhập mã.

#### Scenario: Dùng lại mã đã kích hoạt

- **WHEN** một người nhập lại mã đã dùng để tạo `bs.tran`
- **THEN** trang hiện "Mã kích hoạt không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới."

#### Scenario: Hai lần gửi cùng lúc

- **WHEN** hai trình duyệt cùng gửi form tạo tài khoản với cùng một mã và hai tên đăng nhập khác nhau
- **THEN** đúng một tài khoản được tạo và trình duyệt còn lại nhận thông báo mã không dùng được

#### Scenario: Admin huỷ mã khi bác sĩ đang điền form

- **WHEN** bác sĩ đã qua bước nhập mã, Admin huỷ mã đó, rồi bác sĩ bấm "Tạo tài khoản"
- **THEN** trang quay về bước nhập mã với thông báo mã không dùng được và không có tài khoản nào được tạo

### Requirement: Giới hạn nhập sai mã theo địa chỉ IP

Khi một địa chỉ IP đã có từ 10 lần nhập mã không dùng được trong 15 phút gần nhất, mọi lần nhập mã tiếp theo từ IP đó (ở bước nhập mã hay khi gửi form tạo tài khoản), kể cả mã đúng, SHALL bị từ chối với "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." cho tới khi số lần sai trong 15 phút gần nhất xuống dưới 10. Lần bị từ chối vì giới hạn MUST NOT được tính là lần sai.

#### Scenario: Lần nhập mã thứ mười một bị từ chối

- **WHEN** một IP đã nhập 10 mã không dùng được trong 15 phút rồi nhập một mã đúng
- **THEN** trang hiện "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." và không hiện form tạo tài khoản

#### Scenario: Hết cửa sổ thì nhập mã lại được

- **WHEN** đã quá 15 phút kể từ lần sai đầu tiên trong 10 lần sai của một IP
- **THEN** nhập mã đúng từ IP đó được chấp nhận

#### Scenario: Lỗi ở form tạo tài khoản không tính là nhập sai mã

- **WHEN** bác sĩ có mã đúng gửi form tạo tài khoản 10 lần với tên đăng nhập đã có người dùng
- **THEN** lần gửi tiếp theo với tên đăng nhập hợp lệ vẫn tạo được tài khoản

### Requirement: Trang kích hoạt dùng tốt trên điện thoại

Ô mã SHALL tự viết hoa khi gõ, MUST NOT tự sửa chính tả hay gợi ý tự điền. Ô tên đăng nhập MUST NOT tự viết hoa hay tự sửa, và khai loại tự điền tên đăng nhập. Ô mật khẩu SHALL khai loại tự điền mật khẩu mới và có nút hiện/ẩn. Mã, tên đăng nhập và mật khẩu MUST NOT xuất hiện trên URL. Trang đăng nhập SHALL có liên kết tới trang kích hoạt, và trang kích hoạt SHALL có liên kết quay lại trang đăng nhập.

#### Scenario: Thuộc tính ô nhập

- **WHEN** trang kích hoạt hiện trên điện thoại
- **THEN** ô mã có `autocapitalize="characters"`, `autocorrect="off"`, `spellcheck="false"`, `autocomplete="off"`, ô tên đăng nhập có `autocapitalize="none"` và `autocomplete="username"`, ô mật khẩu có `autocomplete="new-password"`

#### Scenario: Mở trang kích hoạt từ trang đăng nhập

- **WHEN** người chưa có tài khoản bấm "Kích hoạt tài khoản" ở trang đăng nhập
- **THEN** trang `/activate` hiện ra với ô nhập mã

#### Scenario: Không lộ thông tin lên URL

- **WHEN** bác sĩ đi hết hai bước kích hoạt, thành công hay không
- **THEN** URL của trang chưa bao giờ chứa mã, tên đăng nhập hay mật khẩu
