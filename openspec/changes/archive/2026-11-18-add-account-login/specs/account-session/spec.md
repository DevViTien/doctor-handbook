# Spec Delta

## Purpose

Cho bác sĩ và Admin vào app bằng tên đăng nhập và mật khẩu, giữ họ đăng nhập trên thiết bị của mình cho tới khi tự đăng xuất hoặc phiên bị thu hồi, và chặn việc dò mật khẩu.

## ADDED Requirements

### Requirement: Đăng nhập bằng tên đăng nhập và mật khẩu

Trang `/login` SHALL cho một tài khoản đang hoạt động (bác sĩ hoặc Admin) đăng nhập bằng tên đăng nhập và mật khẩu. Tên đăng nhập SHALL được so khớp không phân biệt hoa thường và bỏ khoảng trắng ở hai đầu; mật khẩu SHALL được so khớp chính xác. Đăng nhập thành công SHALL tạo một phiên mới cho thiết bị đó và ghi lại thời điểm đăng nhập gần nhất của tài khoản.

#### Scenario: Bác sĩ đăng nhập đúng

- **WHEN** bác sĩ `bs.lan` nhập đúng tên đăng nhập và mật khẩu rồi gửi form
- **THEN** bác sĩ được chuyển tới `/patients` và thấy khu vực bác sĩ

#### Scenario: Admin đăng nhập đúng

- **WHEN** Admin nhập đúng tên đăng nhập và mật khẩu rồi gửi form
- **THEN** Admin được chuyển tới `/admin/access-codes`

#### Scenario: Tên đăng nhập viết hoa và có khoảng trắng

- **WHEN** bác sĩ `bs.lan` nhập tên đăng nhập là `BS.Lan` cùng mật khẩu đúng
- **THEN** đăng nhập thành công như khi nhập `bs.lan`

#### Scenario: Mật khẩu khác hoa thường

- **WHEN** bác sĩ nhập mật khẩu đúng nhưng đổi chữ thường thành chữ hoa
- **THEN** đăng nhập không thành công

### Requirement: Đi tiếp tới trang đã định mở

Sau khi đăng nhập thành công, người dùng SHALL được chuyển tới đường dẫn trong tham số `next` của trang đăng nhập nếu đó là đường dẫn an toàn theo `access-gate`; nếu không có hoặc không an toàn, SHALL được chuyển tới trang chính theo vai trò (bác sĩ: `/patients`; Admin: `/admin/access-codes`).

#### Scenario: Quay lại trang đã định mở

- **WHEN** bác sĩ mở `/todos` khi chưa đăng nhập, được chuyển tới `/login?next=%2Ftodos` và đăng nhập đúng
- **THEN** bác sĩ được chuyển tới `/todos`

#### Scenario: next trỏ ra ngoài

- **WHEN** bác sĩ đăng nhập đúng tại `/login?next=%2F%2Fevil.com`
- **THEN** bác sĩ được chuyển tới `/patients`

### Requirement: Thông báo lỗi không lộ tài khoản

Khi tên đăng nhập không tồn tại hoặc mật khẩu sai, trang đăng nhập SHALL hiện cùng một thông báo "Tên đăng nhập hoặc mật khẩu không đúng." và MUST NOT cho biết tên đăng nhập có tồn tại hay không. Ô bỏ trống SHALL được báo ngay tại ô đó mà không gửi đi kiểm tra mật khẩu. Thông báo lỗi SHALL được đọc bởi trình đọc màn hình.

#### Scenario: Sai mật khẩu

- **WHEN** bác sĩ `bs.lan` nhập sai mật khẩu
- **THEN** trang hiện "Tên đăng nhập hoặc mật khẩu không đúng." và bác sĩ vẫn ở trang đăng nhập

#### Scenario: Tên đăng nhập không tồn tại

- **WHEN** người dùng nhập tên đăng nhập `khong.ton.tai` với một mật khẩu bất kỳ
- **THEN** trang hiện đúng thông báo như khi sai mật khẩu

#### Scenario: Bỏ trống mật khẩu

- **WHEN** người dùng nhập tên đăng nhập nhưng để trống mật khẩu rồi gửi form
- **THEN** ô mật khẩu được báo lỗi và không có lần đăng nhập sai nào bị tính

#### Scenario: Giữ tên đăng nhập sau lỗi

- **WHEN** đăng nhập không thành công
- **THEN** ô tên đăng nhập giữ nguyên nội dung đã nhập và ô mật khẩu được xoá

### Requirement: Tài khoản bị khoá không đăng nhập được

Tài khoản bị khoá MUST NOT đăng nhập được. Khi mật khẩu đúng nhưng tài khoản bị khoá, trang SHALL hiện "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên." và MUST NOT tạo phiên. Khi mật khẩu sai, tài khoản bị khoá SHALL nhận thông báo chung như mọi lần sai mật khẩu.

#### Scenario: Đúng mật khẩu nhưng bị khoá

- **WHEN** tài khoản `bs.lan` đã bị khoá và bác sĩ nhập đúng mật khẩu
- **THEN** trang hiện "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên." và không có cookie phiên nào được tạo

#### Scenario: Sai mật khẩu khi bị khoá

- **WHEN** tài khoản `bs.lan` đã bị khoá và người dùng nhập sai mật khẩu
- **THEN** trang hiện "Tên đăng nhập hoặc mật khẩu không đúng."

### Requirement: Giữ đăng nhập trên thiết bị

Phiên đăng nhập MUST NOT tự hết hạn theo thời gian: người dùng SHALL vẫn đăng nhập khi mở lại app trên cùng thiết bị cho tới khi tự đăng xuất hoặc phiên bị thu hồi (đổi hay đặt lại mật khẩu, tài khoản bị khoá). Cookie phiên MUST NOT đọc được bằng JavaScript trên trang và MUST chỉ gửi qua HTTPS trên môi trường triển khai.

#### Scenario: Mở lại app

- **WHEN** bác sĩ đã đăng nhập, đóng trình duyệt rồi mở lại `/patients`
- **THEN** bác sĩ thấy khu vực bác sĩ mà không phải đăng nhập lại

#### Scenario: Cookie phiên được bảo vệ

- **WHEN** bác sĩ đăng nhập thành công
- **THEN** cookie phiên có thuộc tính `HttpOnly`, `SameSite=Lax` và không có trong `document.cookie`

### Requirement: Đăng xuất

Bác sĩ SHALL đăng xuất được từ màn hình Cài đặt; Admin SHALL đăng xuất được từ thanh trên của khu vực quản trị. Đăng xuất SHALL kết thúc phiên của thiết bị đó, xoá cookie phiên và chuyển tới `/login`; phiên của tài khoản đó trên các thiết bị khác SHALL vẫn còn hiệu lực. Đăng xuất MUST NOT hỏi xác nhận.

#### Scenario: Bác sĩ đăng xuất

- **WHEN** bác sĩ bấm "Đăng xuất" ở màn hình Cài đặt
- **THEN** bác sĩ được chuyển tới `/login`, và mở lại `/patients` thì bị chuyển về trang đăng nhập

#### Scenario: Admin đăng xuất

- **WHEN** Admin bấm "Đăng xuất" ở thanh trên khu vực quản trị
- **THEN** Admin được chuyển tới `/login`

#### Scenario: Thiết bị khác vẫn đăng nhập

- **WHEN** bác sĩ đăng nhập trên hai thiết bị rồi đăng xuất ở thiết bị thứ nhất
- **THEN** thiết bị thứ hai vẫn mở được `/patients`

### Requirement: Giới hạn đăng nhập sai theo tên đăng nhập

Khi một tên đăng nhập đã có từ 5 lần đăng nhập sai trong 15 phút gần nhất, mọi lần thử tiếp theo với tên đó, kể cả mật khẩu đúng, SHALL bị từ chối với "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." cho tới khi số lần sai trong 15 phút gần nhất xuống dưới 5. Lần bị từ chối vì giới hạn MUST NOT được tính là lần sai. Đăng nhập thành công SHALL xoá các lần sai đã ghi của tên đó.

#### Scenario: Lần thử thứ sáu bị từ chối

- **WHEN** `bs.lan` đã nhập sai mật khẩu 5 lần trong 15 phút và lần thứ sáu nhập đúng mật khẩu
- **THEN** trang hiện "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." và không có phiên nào được tạo

#### Scenario: Hết cửa sổ thì thử lại được

- **WHEN** đã quá 15 phút kể từ lần sai đầu tiên trong 5 lần sai của `bs.lan`
- **THEN** đăng nhập với mật khẩu đúng thành công

#### Scenario: Đăng nhập thành công xoá đếm

- **WHEN** `bs.lan` nhập sai 4 lần, đăng nhập đúng, đăng xuất, rồi nhập sai thêm 4 lần trong cùng 15 phút
- **THEN** lần thử tiếp theo với mật khẩu đúng vẫn thành công

#### Scenario: Tên khác không bị ảnh hưởng

- **WHEN** `bs.lan` đang bị tạm từ chối vì nhập sai quá nhiều
- **THEN** tài khoản `bs.minh` vẫn đăng nhập được từ cùng thiết bị

### Requirement: Giới hạn đăng nhập sai theo địa chỉ IP

Khi một địa chỉ IP đã có từ 20 lần đăng nhập sai trong 15 phút gần nhất (với bất kỳ tên đăng nhập nào), mọi lần thử tiếp theo từ IP đó SHALL bị từ chối với cùng thông báo giới hạn cho tới khi số lần sai trong 15 phút gần nhất xuống dưới 20. Lần bị từ chối vì giới hạn MUST NOT được tính là lần sai.

#### Scenario: Dò nhiều tên từ một IP

- **WHEN** một IP đã có 20 lần đăng nhập sai với 20 tên đăng nhập khác nhau trong 15 phút
- **THEN** lần thử tiếp theo từ IP đó với bất kỳ tên nào bị từ chối với thông báo giới hạn

### Requirement: Form đăng nhập dùng tốt trên điện thoại

Ô tên đăng nhập MUST NOT tự viết hoa chữ đầu, tự sửa chính tả hay gợi ý từ; hai ô SHALL khai báo loại tự điền (tên đăng nhập, mật khẩu hiện tại) để trình quản lý mật khẩu điền được. Mật khẩu SHALL bị che mặc định và có nút hiện/ẩn. Form SHALL gửi bằng phím Enter/"Đi" của bàn phím, và MUST NOT đưa tên đăng nhập hay mật khẩu lên URL. Trong lúc đang gửi, nút đăng nhập SHALL báo đang xử lý và không gửi được lần nữa.

#### Scenario: Thuộc tính ô nhập

- **WHEN** trang đăng nhập hiện trên điện thoại
- **THEN** ô tên đăng nhập có `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`, `autocomplete="username"`, và ô mật khẩu có `autocomplete="current-password"`

#### Scenario: Hiện mật khẩu

- **WHEN** người dùng bấm nút hiện mật khẩu
- **THEN** mật khẩu hiện thành chữ đọc được, và bấm lần nữa thì bị che lại

#### Scenario: Không lộ thông tin lên URL

- **WHEN** người dùng gửi form đăng nhập, thành công hay không
- **THEN** URL của trang không chứa tên đăng nhập hay mật khẩu
