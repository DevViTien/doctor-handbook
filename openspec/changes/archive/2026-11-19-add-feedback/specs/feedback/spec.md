## Purpose

Bác sĩ gửi góp ý hoặc báo lỗi ngay trong app chỉ trong vài giây, phục vụ đợt dùng thử (idea.md §15),
và Admin đọc lại ở khu vực quản trị mà không chạm tới dữ liệu bệnh nhân (N6).

## ADDED Requirements

### Requirement: Gửi góp ý từ Cài đặt

Trang Cài đặt của bác sĩ SHALL có dòng "Góp ý" dẫn tới `/settings/feedback`. Trang này SHALL có một ô
"Nội dung góp ý" (bắt buộc, tối đa 2.000 ký tự sau khi bỏ khoảng trắng đầu cuối), lời nhắc "Đừng ghi tên
hay thông tin bệnh nhân. Admin đọc được nội dung này." và nút "Gửi góp ý". Gửi thành công MUST làm trống
ô và báo "Đã gửi góp ý. Cảm ơn bác sĩ!" ngay trên trang; gửi không thành MUST giữ nguyên chữ đã gõ.

#### Scenario: Gửi góp ý

- **WHEN** "bs.lan" mở Cài đặt, bấm "Góp ý", gõ "Tìm bằng giọng nói hay nhận sai tên" rồi bấm "Gửi góp ý"
- **THEN** trang báo "Đã gửi góp ý. Cảm ơn bác sĩ!", ô nội dung trống, và có một góp ý của "bs.lan" với đúng nội dung đó

#### Scenario: Chưa gõ gì

- **WHEN** bác sĩ bấm "Gửi góp ý" khi ô nội dung trống hoặc chỉ có khoảng trắng
- **THEN** ô báo "Nhập nội dung góp ý." và không góp ý nào được lưu

#### Scenario: Quá dài

- **WHEN** bác sĩ gửi nội dung dài hơn 2.000 ký tự
- **THEN** ô báo "Góp ý tối đa 2.000 ký tự.", chữ đã gõ vẫn còn, và không góp ý nào được lưu

#### Scenario: Mất mạng khi gửi

- **WHEN** bác sĩ bấm "Gửi góp ý" lúc mất mạng
- **THEN** trang báo "Chưa gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Gửi góp ý lại khi có mạng." và ô vẫn giữ nguyên chữ đã gõ

### Requirement: Thông tin kèm theo góp ý

Mỗi góp ý SHALL được lưu kèm thời điểm gửi, loại máy và trình duyệt, và mã bản triển khai đang chạy,
không cần bác sĩ nhập. Hệ thống MUST NOT lưu kèm trang đang mở hay dữ liệu nào khác, và MUST NOT đưa
nội dung góp ý vào log, toast hay tiêu đề trang.

#### Scenario: Gửi từ iPhone

- **WHEN** bác sĩ gửi góp ý từ Safari trên iPhone
- **THEN** góp ý được lưu với loại máy hiện ra cho Admin là "iPhone · Safari" cùng mã bản triển khai lúc gửi

#### Scenario: Nội dung không vào log

- **WHEN** bác sĩ gửi góp ý "Lỗi ở màn hình ghi chú"
- **THEN** không dòng log nào của server chứa "Lỗi ở màn hình ghi chú"

### Requirement: Giới hạn số góp ý

Mỗi tài khoản bác sĩ SHALL gửi được tối đa 20 góp ý trong 24 giờ gần nhất. Góp ý vượt giới hạn MUST bị
từ chối với lời báo "Đã gửi 20 góp ý trong 24 giờ qua. Thử lại sau." và chữ đã gõ MUST còn
nguyên. Giới hạn của bác sĩ này MUST NOT ảnh hưởng bác sĩ khác.

#### Scenario: Vượt 20 góp ý trong 24 giờ

- **WHEN** "bs.lan" đã gửi 20 góp ý trong 24 giờ qua và gửi thêm một góp ý
- **THEN** trang báo "Đã gửi 20 góp ý trong 24 giờ qua. Thử lại sau.", chữ đã gõ vẫn còn, và số góp ý của "bs.lan" vẫn là 20

#### Scenario: Bác sĩ khác không bị chặn

- **WHEN** "bs.lan" đã chạm giới hạn và "bs.minh" gửi một góp ý
- **THEN** góp ý của "bs.minh" được lưu

### Requirement: Admin đọc góp ý

Khu vực quản trị SHALL có tab "Góp ý" dẫn tới `/admin/feedback`, liệt kê tối đa 200 góp ý mới nhất,
mới nhất ở trên. Mỗi góp ý SHALL hiện tên hiển thị và tên đăng nhập người gửi, thời điểm gửi (giờ Việt
Nam), loại máy và trình duyệt, và trọn nội dung (giữ xuống dòng). Góp ý Admin chưa đánh dấu đã xem SHALL
có nhãn "Mới", và đầu trang SHALL cho biết số góp ý mới. Khi chưa có góp ý nào, trang SHALL hiện "Chưa có
góp ý nào".

#### Scenario: Xem danh sách góp ý

- **WHEN** "bs.lan" gửi "Nút lưu khó bấm" rồi "bs.minh" gửi "App chạy tốt", và Admin mở `/admin/feedback`
- **THEN** góp ý của "bs.minh" ở trên góp ý của "bs.lan", mỗi mục có tên hiển thị, tên đăng nhập, thời điểm gửi, loại máy, nội dung và nhãn "Mới", và đầu trang báo có 2 góp ý mới

#### Scenario: Nội dung nhiều dòng

- **WHEN** góp ý có nội dung ba dòng
- **THEN** trang Admin hiện đủ ba dòng, đúng thứ tự xuống dòng

#### Scenario: Chưa có góp ý

- **WHEN** Admin mở `/admin/feedback` khi chưa bác sĩ nào gửi góp ý
- **THEN** trang hiện "Chưa có góp ý nào"

### Requirement: Đánh dấu góp ý đã xem

Admin SHALL đánh dấu được từng góp ý mới là đã xem bằng nút "Đã xem", không cần hộp thoại xác nhận. Góp
ý đã xem MUST mất nhãn "Mới" và không còn được tính vào số góp ý mới; nội dung giữ nguyên.

#### Scenario: Đánh dấu đã xem

- **WHEN** Admin bấm "Đã xem" ở góp ý "Nút lưu khó bấm"
- **THEN** góp ý đó không còn nhãn "Mới" và số góp ý mới ở đầu trang giảm đi một

### Requirement: Xoá góp ý

Admin SHALL xoá được từng góp ý bằng nút "Xoá", qua hộp thoại xác nhận "Xoá góp ý này?" với nút "Xoá
góp ý" và "Không xoá". Góp ý đã xoá MUST biến mất hẳn, không có thùng rác. Góp ý đã bị xoá ở nơi khác
MUST được báo "Góp ý này không còn." và trang tải lại danh sách.

#### Scenario: Xoá góp ý

- **WHEN** Admin bấm "Xoá" ở góp ý "Nút lưu khó bấm" rồi bấm "Xoá góp ý" trong hộp thoại
- **THEN** góp ý đó không còn trên trang và không còn trong database

#### Scenario: Đổi ý khi xoá góp ý

- **WHEN** Admin bấm "Xoá" rồi bấm "Không xoá"
- **THEN** góp ý vẫn còn nguyên

#### Scenario: Góp ý đã bị xoá ở nơi khác

- **WHEN** Admin mở hộp thoại xoá một góp ý vừa bị xoá ở thẻ trình duyệt khác rồi bấm "Xoá góp ý"
- **THEN** hộp thoại báo "Góp ý này không còn."

### Requirement: Góp ý còn lại khi xoá tài khoản

Khi Admin xoá một tài khoản bác sĩ, góp ý tài khoản đó đã gửi SHALL còn lại trên trang Góp ý, với người
gửi hiện "Tài khoản đã xoá" thay cho tên.

#### Scenario: Xoá tài khoản đã gửi góp ý

- **WHEN** "bs.khoa" đã gửi góp ý "Muốn thêm nhãn bệnh nhân", rồi Admin khoá và xoá tài khoản "bs.khoa"
- **THEN** trang Góp ý vẫn có "Muốn thêm nhãn bệnh nhân" với người gửi "Tài khoản đã xoá"

### Requirement: Quyền truy cập góp ý

Chỉ bác sĩ đã đăng nhập SHALL gửi được góp ý, và góp ý MUST được gắn với tài khoản lấy từ phiên, không
bao giờ từ dữ liệu trình duyệt gửi lên. Bác sĩ MUST NOT đọc được góp ý nào, kể cả của chính mình. Chỉ
Admin SHALL đọc, đánh dấu đã xem và xoá góp ý. Lệnh sai vai trò hoặc chưa đăng nhập MUST bị từ chối và
không đổi gì.

#### Scenario: Chưa đăng nhập mở trang góp ý

- **WHEN** người chưa đăng nhập mở `/settings/feedback`
- **THEN** trình duyệt được chuyển tới `/login?next=%2Fsettings%2Ffeedback`

#### Scenario: Bác sĩ mở trang góp ý của Admin

- **WHEN** "bs.lan" mở `/admin/feedback`
- **THEN** bác sĩ được chuyển tới `/patients`

#### Scenario: Gửi góp ý mạo danh bác sĩ khác

- **WHEN** một trình duyệt bị sửa của "bs.lan" gửi góp ý kèm id tài khoản của "bs.minh"
- **THEN** góp ý được lưu với người gửi là "bs.lan"

#### Scenario: Admin hoặc người chưa đăng nhập gửi góp ý

- **WHEN** Admin, hoặc người chưa đăng nhập, gửi lệnh gửi góp ý
- **THEN** lệnh bị từ chối và không góp ý nào được lưu

#### Scenario: Bác sĩ gửi lệnh đánh dấu hoặc xoá góp ý

- **WHEN** "bs.lan" gửi lệnh đánh dấu đã xem hoặc xoá một góp ý
- **THEN** lệnh bị từ chối và góp ý không đổi
