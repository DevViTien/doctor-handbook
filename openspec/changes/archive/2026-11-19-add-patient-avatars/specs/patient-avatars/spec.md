# Spec Delta

## Purpose

Ảnh đại diện bệnh nhân: một tấm ảnh nhỏ cạnh tên giúp bác sĩ phân biệt người trùng tên (idea.md P6). Ảnh do bác sĩ chụp hoặc chọn, được nén ngay trên máy, lưu ở kho riêng tư và chỉ bác sĩ sở hữu xem được. Đây là phần việc của module `patients`, ở trang chi tiết bệnh nhân và mọi danh sách bệnh nhân.

## ADDED Requirements

### Requirement: Đặt ảnh đại diện

Trang chi tiết bệnh nhân SHALL có nút "Ảnh đại diện" trên ảnh hoặc chữ cái đầu. Nút mở bảng chọn có "Chụp ảnh" và "Chọn ảnh có sẵn"; khi bệnh nhân đã có ảnh thì thêm "Xem ảnh" và "Xoá ảnh". Ảnh được chọn SHALL được cắt hình vuông ở giữa, thu nhỏ còn 384 × 384 px và nén trên máy rồi mới gửi đi. Gửi xong, ảnh SHALL thay chữ cái đầu ở trang chi tiết. File không phải ảnh hay ảnh lớn hơn 25 MB SHALL bị từ chối với thông báo "Không đọc được ảnh này." hoặc "Ảnh quá lớn. Dung lượng tối đa 25 MB.".

#### Scenario: Chọn ảnh có sẵn

- **WHEN** bác sĩ mở trang chi tiết của "Nguyễn Văn An" chưa có ảnh, bấm "Ảnh đại diện" rồi "Chọn ảnh có sẵn" và chọn một ảnh 1200 × 900 px
- **THEN** trang hiện ảnh thay cho chữ cái đầu, và ảnh lưu trong kho là ảnh vuông 384 × 384 px

#### Scenario: File không phải ảnh

- **WHEN** bác sĩ chọn một file không phải ảnh
- **THEN** trang báo "Không đọc được ảnh này." và ảnh cũ giữ nguyên

#### Scenario: Mất mạng khi lưu ảnh

- **WHEN** bác sĩ chọn ảnh lúc mất mạng
- **THEN** trang báo "Chưa lưu được ảnh vì mất mạng." kèm nút "Thử lại", và bệnh nhân vẫn giữ ảnh cũ (hoặc chữ cái đầu)

### Requirement: Xem và xoá ảnh đại diện

"Xem ảnh" SHALL mở hộp thoại hiện ảnh lớn. "Xoá ảnh" SHALL hỏi bằng hộp thoại "Xoá ảnh đại diện?" kèm "Xoá ảnh" và "Không xoá"; xác nhận thì ảnh bị xoá hẳn khỏi kho và trang lại hiện chữ cái đầu.

#### Scenario: Xoá ảnh

- **WHEN** bác sĩ bấm "Ảnh đại diện", "Xoá ảnh", rồi "Xoá ảnh" trong hộp thoại
- **THEN** trang hiện lại chữ cái đầu và ảnh không còn trong kho

#### Scenario: Đổi ý khi xoá ảnh

- **WHEN** bác sĩ bấm "Xoá ảnh" rồi "Không xoá"
- **THEN** ảnh vẫn còn

### Requirement: Ảnh trong danh sách bệnh nhân

Mọi chỗ hiện chữ cái đầu của bệnh nhân (danh sách, kết quả tìm, gợi ý trùng tên, trang chi tiết, thùng rác) SHALL hiện ảnh đại diện nếu có. Ảnh SHALL chỉ tải khi dòng hiện ra trên màn hình. Ảnh chưa tải xong hoặc không tải được SHALL hiện chữ cái đầu. Ảnh MUST NOT có chữ thay thế (alt) chứa tên bệnh nhân, vì tên đã hiện ngay bên cạnh.

#### Scenario: Danh sách có ảnh

- **WHEN** "Nguyễn Văn An" có ảnh và "Trần Thị Bình" không có, rồi bác sĩ mở `/patients`
- **THEN** dòng "Nguyễn Văn An" hiện ảnh, còn dòng "Trần Thị Bình" hiện chữ cái đầu

### Requirement: Ảnh đại diện riêng tư

Ảnh SHALL nằm trong kho riêng tư, không có link công khai. Trình duyệt SHALL chỉ nhận đường dẫn tạm có hạn, do server tạo sau khi kiểm bệnh nhân thuộc về bác sĩ đang đăng nhập. Yêu cầu xem, đặt hay xoá ảnh của bệnh nhân thuộc bác sĩ khác, từ người chưa đăng nhập, hay từ Admin MUST bị từ chối. Server MUST NOT nhận một đường dẫn ảnh nằm ngoài thư mục của chính tài khoản đó.

#### Scenario: Ảnh của bác sĩ khác

- **WHEN** "bs.minh" mở địa chỉ ảnh của bệnh nhân thuộc "bs.lan"
- **THEN** yêu cầu bị từ chối và không có ảnh nào được trả về

#### Scenario: Gắn ảnh của tài khoản khác

- **WHEN** một trình duyệt bị sửa của "bs.lan" gửi lệnh gắn cho bệnh nhân của mình một đường dẫn ảnh nằm trong thư mục của "bs.minh"
- **THEN** lệnh bị từ chối và ảnh của bệnh nhân không đổi

#### Scenario: Chưa đăng nhập hoặc Admin xem ảnh

- **WHEN** người chưa đăng nhập, hoặc Admin, mở địa chỉ ảnh của một bệnh nhân
- **THEN** yêu cầu bị từ chối

### Requirement: Ảnh bị xoá cùng bệnh nhân

Khi bệnh nhân bị xoá vĩnh viễn, dù bác sĩ bấm "Xoá vĩnh viễn" hay hệ thống tự xoá sau 30 ngày trong thùng rác, ảnh của bệnh nhân đó SHALL bị xoá khỏi kho. Đổi sang ảnh khác SHALL xoá ảnh cũ. Chuyển vào thùng rác MUST NOT xoá ảnh, để khôi phục vẫn còn ảnh.

#### Scenario: Xoá vĩnh viễn xoá ảnh

- **WHEN** "Nguyễn Văn An" có ảnh, đang ở thùng rác, và bác sĩ bấm "Xoá vĩnh viễn"
- **THEN** ảnh của "Nguyễn Văn An" không còn trong kho

#### Scenario: Khôi phục còn ảnh

- **WHEN** "Nguyễn Văn An" có ảnh được chuyển vào thùng rác rồi khôi phục
- **THEN** trang chi tiết vẫn hiện ảnh đó
