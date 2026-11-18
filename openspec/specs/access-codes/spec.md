# access-codes Specification

## Purpose

Admin cấp, theo dõi và huỷ các mã truy cập một lần (hiện có mã kích hoạt; sau này thêm mã đặt lại mật khẩu) để đưa bác sĩ vào app mà không cần email hay dịch vụ ngoài. Đây là phần việc của module `admin` ở trang `/admin/access-codes`. Mã chỉ hiện một lần và server chỉ lưu bản băm.

## Requirements

### Requirement: Admin tạo mã kích hoạt

Admin SHALL tạo được mã kích hoạt ở `/admin/access-codes` bằng cách nhập tên người nhận (bắt buộc, tối đa 80 ký tự, bỏ khoảng trắng hai đầu). Mã SHALL gồm 8 ký tự lấy từ chữ in hoa và chữ số, MUST NOT chứa các ký tự dễ nhầm `0`, `O`, `1`, `I`, `L`, và SHALL được hiển thị thành hai nhóm bốn ký tự nối bằng dấu gạch (ví dụ `K7HM-3QXR`). Mã SHALL hết hạn đúng 72 giờ sau lúc tạo.

#### Scenario: Tạo mã cho bác sĩ mới

- **WHEN** Admin nhập "BS. Trần Thị B" vào ô tên người nhận và bấm "Tạo mã"
- **THEN** trang hiện một mã dạng `XXXX-XXXX` chỉ gồm các ký tự cho phép, kèm tên "BS. Trần Thị B" và giờ hết hạn bằng lúc tạo cộng 72 giờ (giờ Việt Nam)

#### Scenario: Bỏ trống tên người nhận

- **WHEN** Admin bấm "Tạo mã" khi ô tên người nhận trống hoặc chỉ có khoảng trắng
- **THEN** ô tên người nhận báo "Nhập tên người nhận mã." và không có mã nào được tạo

### Requirement: Mã chỉ hiện một lần

Mã vừa tạo SHALL chỉ hiện trong phản hồi của lần tạo đó. Server MUST chỉ lưu bản băm của mã, và MUST NOT hiện lại mã ở danh sách, sau khi tải lại trang, hay ở bất kỳ màn hình nào khác. Cạnh mã vừa tạo SHALL có nút sao chép một tin nhắn soạn sẵn gồm mã, đường dẫn trang kích hoạt và giờ hết hạn. Đường dẫn trong tin nhắn MUST NOT chứa mã.

#### Scenario: Tải lại trang sau khi tạo mã

- **WHEN** Admin tạo mã rồi tải lại trang `/admin/access-codes`
- **THEN** mã vừa tạo không còn hiện ở đâu trên trang, còn danh sách vẫn có dòng của người nhận đó với trạng thái "Còn hạn"

#### Scenario: Sao chép tin nhắn gửi bác sĩ

- **WHEN** Admin bấm "Sao chép tin nhắn" cạnh mã vừa tạo
- **THEN** bộ nhớ tạm chứa mã dạng `XXXX-XXXX`, đường dẫn tới `/activate` và giờ hết hạn, đường dẫn không chứa mã, và nút báo "Đã sao chép"

#### Scenario: Database không chứa mã thô

- **WHEN** Admin vừa tạo một mã
- **THEN** không cột nào của bảng mã truy cập chứa mã đó ở dạng có hay không có dấu gạch

### Requirement: Danh sách mã theo trạng thái

Trang `/admin/access-codes` SHALL liệt kê các mã đã tạo, mới nhất ở trên. Mỗi dòng có tên người nhận, ngày giờ tạo và đúng một trạng thái theo thứ tự ưu tiên: "Đã huỷ", rồi "Đã dùng" (kèm tên đăng nhập của tài khoản đã tạo và thời điểm dùng), rồi "Hết hạn", rồi "Còn hạn" (kèm giờ hết hạn). Trạng thái MUST NOT chỉ thể hiện bằng màu. Khi chưa có mã nào, trang SHALL hiện trạng thái rỗng.

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

### Requirement: Huỷ mã chưa dùng

Mã đang "Còn hạn" SHALL có nút "Huỷ mã". Bấm nút SHALL mở hộp thoại xác nhận nêu tên người nhận; chỉ khi Admin xác nhận thì mã mới bị huỷ. Mã đã huỷ MUST NOT dùng được nữa. Nếu lúc xác nhận mã không còn ở trạng thái "Còn hạn" (vừa được dùng hoặc vừa hết hạn), server SHALL từ chối với "Mã này đã được dùng, đã hết hạn hoặc đã bị huỷ." và giữ nguyên mã.

#### Scenario: Huỷ mã còn hạn

- **WHEN** Admin bấm "Huỷ mã" ở dòng của "BS. Trần Thị B" rồi xác nhận trong hộp thoại
- **THEN** dòng đó chuyển sang "Đã huỷ", và nhập mã đó ở `/activate` thì bị từ chối

#### Scenario: Đổi ý trong hộp thoại

- **WHEN** Admin bấm "Huỷ mã" rồi chọn "Không huỷ" trong hộp thoại
- **THEN** mã vẫn ở trạng thái "Còn hạn"

#### Scenario: Huỷ mã vừa được dùng

- **WHEN** Admin xác nhận huỷ một mã mà bác sĩ vừa dùng để kích hoạt ngay trước đó
- **THEN** trang báo "Mã này đã được dùng, đã hết hạn hoặc đã bị huỷ." và dòng đó hiện "Đã dùng"

### Requirement: Chỉ Admin cấp, xem và huỷ mã

Tạo, xem danh sách và huỷ mã SHALL chỉ dành cho Admin đã đăng nhập. Yêu cầu tạo hay huỷ mã từ người chưa đăng nhập MUST bị từ chối với mã lỗi `UNAUTHENTICATED`, từ bác sĩ MUST bị từ chối với mã lỗi `FORBIDDEN`, và trong cả hai trường hợp MUST NOT có mã nào được tạo hay thay đổi. Màn hình mã MUST NOT hiện bất kỳ dữ liệu bệnh nhân nào.

#### Scenario: Bác sĩ gửi yêu cầu tạo mã

- **WHEN** bác sĩ đã đăng nhập gửi yêu cầu tạo mã kích hoạt
- **THEN** yêu cầu bị từ chối với mã lỗi `FORBIDDEN` và số mã trong database không đổi

#### Scenario: Chưa đăng nhập gửi yêu cầu huỷ mã

- **WHEN** một yêu cầu không có phiên gửi yêu cầu huỷ một mã đang còn hạn
- **THEN** yêu cầu bị từ chối với mã lỗi `UNAUTHENTICATED` và mã vẫn còn hạn
