# account-management Specification

## Purpose

Admin xem các tài khoản bác sĩ đang có (kèm số bệnh nhân và lần sao lưu gần nhất), khoá hoặc mở khoá một tài khoản, và xoá hẳn một tài khoản đã khoá cùng toàn bộ dữ liệu (D21). Khoá là lớp bảo vệ khi bác sĩ mất thiết bị, vì phiên đăng nhập không tự hết hạn. Đây là phần việc của module `admin` ở trang `/admin/accounts`; Admin không bao giờ thấy dữ liệu bệnh nhân ở đây.

## Requirements

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

Xem danh sách, khoá, mở khoá và xoá tài khoản SHALL chỉ dành cho Admin đã đăng nhập. Yêu cầu khoá, mở khoá hay xoá từ người chưa đăng nhập MUST bị từ chối với mã lỗi `UNAUTHENTICATED`, từ bác sĩ MUST bị từ chối với mã lỗi `FORBIDDEN`; trong cả hai trường hợp MUST NOT có tài khoản nào bị thay đổi. Yêu cầu nhắm vào tài khoản Admin hoặc tài khoản không tồn tại MUST bị từ chối với "Không tìm thấy tài khoản." và không thay đổi gì.

#### Scenario: Bác sĩ gửi yêu cầu khoá tài khoản khác

- **WHEN** bác sĩ `bs.minh` đã đăng nhập gửi yêu cầu khoá tài khoản `bs.lan`
- **THEN** yêu cầu bị từ chối với mã lỗi `FORBIDDEN` và `bs.lan` vẫn đang hoạt động

#### Scenario: Chưa đăng nhập gửi yêu cầu mở khoá

- **WHEN** một yêu cầu không có phiên gửi yêu cầu mở khoá `bs.khoa`
- **THEN** yêu cầu bị từ chối với mã lỗi `UNAUTHENTICATED` và `bs.khoa` vẫn bị khoá

#### Scenario: Khoá tài khoản Admin

- **WHEN** Admin gửi yêu cầu khoá chính tài khoản Admin
- **THEN** yêu cầu bị từ chối với "Không tìm thấy tài khoản." và tài khoản Admin vẫn hoạt động

#### Scenario: Bác sĩ gửi yêu cầu xoá tài khoản khác

- **WHEN** bác sĩ `bs.minh` đã đăng nhập gửi yêu cầu xoá tài khoản `bs.khoa` đã khoá, kèm đúng tên đăng nhập
- **THEN** yêu cầu bị từ chối với mã lỗi `FORBIDDEN` và `bs.khoa` cùng dữ liệu của nó vẫn còn

#### Scenario: Chưa đăng nhập gửi yêu cầu xoá

- **WHEN** một yêu cầu không có phiên gửi yêu cầu xoá `bs.khoa`
- **THEN** yêu cầu bị từ chối với mã lỗi `UNAUTHENTICATED` và `bs.khoa` vẫn còn

#### Scenario: Xoá tài khoản Admin hoặc tài khoản đã xoá

- **WHEN** Admin gửi yêu cầu xoá chính tài khoản Admin, hoặc một tài khoản vừa bị xoá
- **THEN** yêu cầu bị từ chối với "Không tìm thấy tài khoản." và không có gì bị xoá

### Requirement: Số bệnh nhân và lần sao lưu trong danh sách

Mỗi dòng của danh sách tài khoản bác sĩ SHALL hiện số bệnh nhân của tài khoản (không tính bệnh nhân trong thùng rác) và ngày sao lưu gần nhất, hoặc "Chưa sao lưu" khi bác sĩ chưa sao lưu lần nào. Đây chỉ là con số và ngày: danh sách MUST NOT hiện tên, thông tin hay nội dung nào của bệnh nhân.

#### Scenario: Đếm bệnh nhân không tính thùng rác

- **WHEN** `bs.lan` có ba bệnh nhân, trong đó một người đang ở thùng rác, và đã sao lưu ngày 15/11/2026
- **THEN** dòng của `bs.lan` hiện "2 bệnh nhân" và "Sao lưu 15/11/2026", không hiện tên bệnh nhân nào

#### Scenario: Chưa có bệnh nhân, chưa sao lưu

- **WHEN** `bs.minh` chưa thêm bệnh nhân nào và chưa sao lưu lần nào
- **THEN** dòng của `bs.minh` hiện "0 bệnh nhân" và "Chưa sao lưu"

### Requirement: Xoá tài khoản đã khoá

Tài khoản bác sĩ đã khoá SHALL có nút "Xoá"; tài khoản đang hoạt động MUST NOT có nút này. Xoá đã xác nhận SHALL xoá vĩnh viễn tài khoản cùng mọi bệnh nhân (cả trong thùng rác), ghi chú, ảnh đại diện, việc cần làm, phiên đăng nhập và mã truy cập của tài khoản đó, rồi báo "Đã xoá tài khoản <tên đăng nhập>.". Dữ liệu của bác sĩ khác MUST NOT bị đụng tới.

#### Scenario: Xoá tài khoản cùng toàn bộ dữ liệu

- **WHEN** `bs.khoa` đã bị khoá, có bệnh nhân (một người có ảnh, một người trong thùng rác), ghi chú và việc cần làm, và Admin xoá `bs.khoa` sau khi gõ đúng tên đăng nhập
- **THEN** dòng của `bs.khoa` biến mất khỏi danh sách, trang báo "Đã xoá tài khoản bs.khoa.", và không còn bệnh nhân, ghi chú, việc cần làm, ảnh hay mã truy cập nào của `bs.khoa`

#### Scenario: Dữ liệu của bác sĩ khác còn nguyên

- **WHEN** Admin xoá `bs.khoa` trong khi `bs.lan` cũng có bệnh nhân có ảnh, ghi chú và việc cần làm
- **THEN** bệnh nhân, ảnh, ghi chú và việc cần làm của `bs.lan` vẫn còn đủ

#### Scenario: Tài khoản đang hoạt động không có nút xoá

- **WHEN** Admin mở `/admin/accounts` khi `bs.lan` đang hoạt động
- **THEN** dòng của `bs.lan` không có nút "Xoá", chỉ có "Cấp mã đặt lại mật khẩu" và "Khoá"

#### Scenario: Đăng nhập bằng tài khoản đã xoá

- **WHEN** Admin đã xoá `bs.khoa` và ai đó nhập tên đăng nhập `bs.khoa` cùng mật khẩu cũ ở trang đăng nhập
- **THEN** trang hiện "Tên đăng nhập hoặc mật khẩu không đúng."

#### Scenario: Dùng lại tên đăng nhập đã xoá

- **WHEN** Admin đã xoá `bs.khoa`, rồi một bác sĩ kích hoạt tài khoản bằng một mã mới và chọn tên đăng nhập `bs.khoa`
- **THEN** tài khoản được tạo và bác sĩ vào được app với sổ trống

### Requirement: Xác nhận xoá bằng tên đăng nhập

Bấm "Xoá" SHALL mở hộp thoại nêu họ tên bác sĩ, số bệnh nhân, ngày sao lưu gần nhất, các loại dữ liệu sẽ mất, và cho biết thao tác không hoàn tác được. Nút "Xoá vĩnh viễn" SHALL chỉ bấm được khi chữ gõ vào ô "Gõ tên đăng nhập để xác nhận" trùng tên đăng nhập (không phân biệt hoa thường, bỏ khoảng trắng đầu cuối). Server MUST kiểm lại tên đăng nhập; không khớp thì MUST từ chối với "Tên đăng nhập không khớp." và không xoá gì.

#### Scenario: Chưa gõ đúng thì chưa xoá được

- **WHEN** Admin mở hộp thoại xoá `bs.khoa` và gõ `bs.kho`
- **THEN** nút "Xoá vĩnh viễn" chưa bấm được; gõ thêm thành `BS.Khoa` thì nút bấm được

#### Scenario: Hộp thoại cho biết sẽ mất gì

- **WHEN** Admin bấm "Xoá" ở dòng của `bs.khoa`, tài khoản có 12 bệnh nhân và chưa sao lưu lần nào
- **THEN** hộp thoại hiện họ tên của `bs.khoa`, "12 bệnh nhân", "Chưa sao lưu" và cho biết không hoàn tác được

#### Scenario: Server từ chối tên đăng nhập không khớp

- **WHEN** một yêu cầu xoá `bs.khoa` gửi kèm tên đăng nhập `bs.lan`
- **THEN** yêu cầu bị từ chối với "Tên đăng nhập không khớp." và `bs.khoa` cùng dữ liệu của nó vẫn còn

#### Scenario: Đổi ý trong hộp thoại

- **WHEN** Admin bấm "Xoá" rồi chọn "Không xoá"
- **THEN** tài khoản và dữ liệu vẫn còn, dòng vẫn "Đã khoá"

### Requirement: Xoá không thành thì không mất tài khoản

Khi xoá không thực hiện được, hộp thoại SHALL hiện lý do và tài khoản MUST còn nguyên trong danh sách với trạng thái "Đã khoá", cùng mọi bệnh nhân, ghi chú và việc cần làm. Tài khoản không còn bị khoá MUST bị từ chối với "Tài khoản đang hoạt động. Khoá trước khi xoá.". Khi không xoá được ảnh trong kho, yêu cầu MUST bị từ chối với "Chưa xoá được tài khoản. Tài khoản vẫn bị khoá, hãy thử lại sau.".

#### Scenario: Tài khoản vừa được mở khoá ở nơi khác

- **WHEN** hộp thoại xoá `bs.khoa` đang mở, ở một thiết bị khác Admin mở khoá `bs.khoa`, rồi Admin xác nhận xoá
- **THEN** hộp thoại hiện "Tài khoản đang hoạt động. Khoá trước khi xoá." và `bs.khoa` vẫn còn

#### Scenario: Kho ảnh lỗi

- **WHEN** Admin xác nhận xoá `bs.khoa` nhưng kho lưu trữ ảnh trả lỗi
- **THEN** hộp thoại hiện "Chưa xoá được tài khoản. Tài khoản vẫn bị khoá, hãy thử lại sau." và tài khoản `bs.khoa` cùng bệnh nhân, ghi chú, việc cần làm vẫn còn
