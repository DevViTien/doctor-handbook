# patient-notes Specification

## Purpose

Ghi chú theo thời gian của một bệnh nhân: mỗi lần gặp ghi một ý, tự gắn ngày giờ, tự lưu không cần bấm nút, không mất chữ khi mất mạng hay đóng tab. Ghi chú chỉ hiện ở trang chi tiết bệnh nhân và chỉ của bác sĩ sở hữu. Đây là phần việc của module `patients`.

## Requirements

### Requirement: Danh sách ghi chú của bệnh nhân

Trang chi tiết bệnh nhân SHALL có phần "Ghi chú" dưới thẻ Tóm tắt, liệt kê mọi ghi chú của bệnh nhân đó, mới tạo nhất ở trên. Mỗi ghi chú SHALL hiện ngày giờ tạo dạng `dd/MM/yyyy HH:mm` theo giờ Việt Nam và nội dung giữ nguyên các dòng; link `http(s)` thành liên kết như ở tóm tắt. Chưa có ghi chú thì phần này SHALL hiện "Chưa có ghi chú".

#### Scenario: Xem ghi chú mới nhất ở trên

- **WHEN** bệnh nhân có ghi chú "Tái khám, KQ XN bình thường" tạo lúc 02/10/2026 14:30 và "HA 150/90, tăng liều amlodipin" tạo lúc 15/11/2026 09:12
- **THEN** trang chi tiết hiện "15/11/2026 09:12" cùng "HA 150/90, tăng liều amlodipin" ở trên, rồi tới "02/10/2026 14:30" cùng "Tái khám, KQ XN bình thường"

#### Scenario: Chưa có ghi chú

- **WHEN** bác sĩ mở trang chi tiết của bệnh nhân chưa có ghi chú nào
- **THEN** phần Ghi chú hiện "Chưa có ghi chú"

#### Scenario: Ghi chú không hiện ở danh sách bệnh nhân

- **WHEN** bệnh nhân có ghi chú "Dị ứng Penicillin"
- **THEN** trang `/patients` không chứa "Dị ứng Penicillin"

### Requirement: Thêm ghi chú

Trang chi tiết SHALL có nút "Ghi chú mới" ở nửa dưới màn hình. Bấm nút SHALL mở ô soạn ở đầu phần Ghi chú, con trỏ đặt sẵn trong ô. Ngày giờ của ghi chú SHALL do hệ thống gán lúc ghi chú được lưu lần đầu, không do bác sĩ nhập. Ghi chú chỉ gồm khoảng trắng MUST NOT được tạo.

#### Scenario: Ghi một ý

- **WHEN** bác sĩ mở trang chi tiết, bấm "Ghi chú mới" rồi gõ "HA 150/90, tăng liều amlodipin"
- **THEN** ô soạn đang có con trỏ, và sau khi ngừng gõ ghi chú hiện trong phần Ghi chú kèm ngày giờ hiện tại

#### Scenario: Ghi chú trống không được tạo

- **WHEN** bác sĩ bấm "Ghi chú mới", chỉ gõ dấu cách rồi bấm "Xong"
- **THEN** không có ghi chú nào được tạo

### Requirement: Tự lưu ghi chú

Ô soạn SHALL tự gửi nội dung lên server sau khi bác sĩ ngừng gõ khoảng một giây, và mỗi lần gõ tiếp thì cập nhật cùng ghi chú đó, không tạo ghi chú mới. Không có hộp thoại xác nhận nào khi lưu. Ô soạn SHALL hiện trạng thái "Đang lưu…" khi đang gửi và "Đã lưu" khi server đã nhận đúng nội dung đang hiện. Nút "Xong" chỉ đóng ô soạn.

#### Scenario: Tự lưu khi ngừng gõ

- **WHEN** bác sĩ gõ "HA 150/90" vào ô soạn rồi ngừng tay
- **THEN** ô soạn hiện "Đã lưu", và tải lại trang thì ghi chú "HA 150/90" vẫn còn

#### Scenario: Gõ tiếp không tạo ghi chú thứ hai

- **WHEN** bác sĩ gõ "HA 150/90", đợi "Đã lưu", rồi gõ tiếp ", tăng liều amlodipin"
- **THEN** bệnh nhân chỉ có một ghi chú, nội dung "HA 150/90, tăng liều amlodipin"

### Requirement: Không mất ghi chú đang gõ

Mỗi thay đổi trong ô soạn SHALL được lưu ngay vào bộ nhớ của trình duyệt trên máy, trước khi gửi lên server. Không gửi được vì mạng thì ô soạn SHALL hiện "Đang chờ mạng". Nháp chưa gửi SHALL được tự gửi lại khi có mạng trở lại, từ bất kỳ trang nào của bác sĩ. Nháp MUST chỉ bị xoá khỏi máy sau khi server xác nhận đã lưu đúng nội dung đó.

#### Scenario: Mất mạng khi đang ghi

- **WHEN** bác sĩ mất mạng rồi gõ "HA 150/90" vào ô soạn
- **THEN** ô soạn hiện "Đang chờ mạng"; khi có mạng lại, ô soạn chuyển sang "Đã lưu" và server có ghi chú "HA 150/90"

#### Scenario: Đóng ô soạn khi đang chờ mạng

- **WHEN** bác sĩ mất mạng, gõ "HA 150/90", bấm "Xong", rồi bấm "Sửa" trên ghi chú đó và bấm "Xong" mà không gõ gì
- **THEN** phần Ghi chú vẫn hiện "HA 150/90" kèm "Đang chờ mạng"; khi có mạng lại, nhãn đó biến mất và server có ghi chú "HA 150/90"

#### Scenario: Rời trang khi chưa gửi được

- **WHEN** bác sĩ mất mạng, gõ "HA 150/90" vào ô soạn, mở trang `/patients`, rồi có mạng lại
- **THEN** server có ghi chú "HA 150/90" mà bác sĩ không phải quay lại trang bệnh nhân đó

#### Scenario: Đóng trang khi chưa gửi được

- **WHEN** bác sĩ mất mạng, gõ "HA 150/90", tải lại trang khi đã có mạng
- **THEN** trang chi tiết hiện "Khôi phục ghi chú chưa gửi" cùng ô soạn chứa "HA 150/90", rồi tự lưu ghi chú đó

### Requirement: Nháp gắn với tài khoản

Nháp trên máy SHALL gắn với tài khoản đã gõ ra nó. Trang của tài khoản khác MUST NOT hiện, gửi hay xoá nháp đó, kể cả khi dùng chung một trình duyệt.

#### Scenario: Đổi tài khoản trên cùng trình duyệt

- **WHEN** `bs.lan` để lại một nháp chưa gửi, đăng xuất, rồi `bs.minh` đăng nhập trên cùng trình duyệt và mở trang bệnh nhân của mình
- **THEN** trang của `bs.minh` không hiện "Khôi phục ghi chú chưa gửi" và không chứa chữ trong nháp của `bs.lan`

### Requirement: Sửa ghi chú

Mỗi ghi chú SHALL có nút "Sửa" mở ô soạn tại chỗ với nội dung hiện có, cũng tự lưu như khi thêm. Ngày giờ tạo MUST giữ nguyên; thời điểm sửa gần nhất SHALL được lưu và ghi chú đã sửa SHALL hiện thêm "Đã sửa" kèm ngày giờ đó. Ghi chú vừa tạo, đang soạn liền một mạch, không bị coi là đã sửa.

#### Scenario: Sửa giữ ngày tạo

- **WHEN** bác sĩ bấm "Sửa" trên ghi chú tạo lúc 15/11/2026 09:12, sửa thành "HA 140/90" rồi ngừng gõ
- **THEN** ghi chú vẫn hiện "15/11/2026 09:12", nội dung "HA 140/90", và có thêm "Đã sửa" kèm ngày giờ hiện tại

#### Scenario: Ghi chú mới không hiện "Đã sửa"

- **WHEN** bác sĩ thêm ghi chú mới và gõ thành nhiều đợt, mỗi đợt đều tự lưu
- **THEN** ghi chú không hiện "Đã sửa"

### Requirement: Xoá ghi chú

Ô soạn của một ghi chú đã lưu SHALL có nút "Xoá ghi chú". Bấm nút SHALL mở hộp thoại xác nhận nói rõ không khôi phục được; chỉ khi bác sĩ xác nhận thì ghi chú mới bị xoá vĩnh viễn, cùng nháp của nó trên máy.

#### Scenario: Xoá ghi chú

- **WHEN** bác sĩ bấm "Sửa" trên một ghi chú, bấm "Xoá ghi chú" rồi xác nhận
- **THEN** ghi chú biến khỏi phần Ghi chú, và tải lại trang thì vẫn không còn

#### Scenario: Đổi ý khi xoá

- **WHEN** bác sĩ bấm "Xoá ghi chú" rồi chọn "Không xoá"
- **THEN** ghi chú vẫn còn

### Requirement: Giới hạn độ dài ghi chú

Một ghi chú MUST có tối đa 5000 ký tự sau khi cắt khoảng trắng ở đầu và cuối. Quá giới hạn thì ô soạn SHALL báo "Ghi chú tối đa 5000 ký tự." và không gửi; chữ vẫn còn trong ô soạn và trong nháp trên máy. Ghi chú bị server từ chối mà ô soạn đã đóng SHALL hiện "Chưa lưu được".

#### Scenario: Ghi chú quá dài

- **WHEN** bác sĩ dán 5001 ký tự vào ô soạn
- **THEN** ô soạn báo "Ghi chú tối đa 5000 ký tự.", không có ghi chú nào được lưu, và chữ vẫn còn trong ô

#### Scenario: Đóng ô soạn khi ghi chú bị từ chối

- **WHEN** ô soạn đang báo "Ghi chú tối đa 5000 ký tự." và bác sĩ bấm "Xong"
- **THEN** ghi chú hiện trong phần Ghi chú kèm "Chưa lưu được" (không phải "Đang chờ mạng"), và không có ghi chú nào được lưu

### Requirement: Ghi chú tách theo bác sĩ

Mọi thao tác đọc, lưu, xoá ghi chú SHALL chỉ áp dụng cho ghi chú thuộc bệnh nhân của bác sĩ đang đăng nhập; tài khoản lấy từ phiên. Lệnh lưu hay xoá mang id bệnh nhân hoặc id ghi chú của bác sĩ khác MUST bị từ chối với `NOT_FOUND` và không thay đổi gì. Lệnh không kèm phiên MUST bị từ chối với `UNAUTHENTICATED`, lệnh của Admin với `FORBIDDEN`.

#### Scenario: Ghi vào bệnh nhân của bác sĩ khác

- **WHEN** lệnh lưu ghi chú của `bs.minh` mang id một bệnh nhân của `bs.lan`
- **THEN** lệnh trả về `NOT_FOUND`, và bệnh nhân của `bs.lan` không có ghi chú mới

#### Scenario: Ghi đè ghi chú của bác sĩ khác

- **WHEN** lệnh lưu của `bs.minh` mang id một ghi chú của `bs.lan`
- **THEN** lệnh trả về `NOT_FOUND`, và ghi chú của `bs.lan` giữ nguyên nội dung

#### Scenario: Chưa đăng nhập hoặc Admin gửi lệnh lưu ghi chú

- **WHEN** lệnh lưu ghi chú được gửi không kèm phiên, hoặc do Admin gửi
- **THEN** lệnh trả về lần lượt `UNAUTHENTICATED` và `FORBIDDEN`, không có ghi chú nào được tạo

### Requirement: Ô soạn ghi chú dùng tốt trên điện thoại

Ô soạn SHALL là ô nhiều dòng, chữ cỡ ít nhất 16 px, `autocomplete="off"`, tự cao lên theo nội dung. Nút "Ghi chú mới" và nút "Xong" SHALL có vùng chạm ít nhất 44 × 44 px. Trạng thái lưu SHALL được trình đọc màn hình đọc lên (`role="status"`). Ghi chú MUST NOT xuất hiện trong URL, tiêu đề tab hay thông báo nổi.

#### Scenario: Thuộc tính ô soạn

- **WHEN** bác sĩ bấm "Ghi chú mới"
- **THEN** ô soạn có `autocomplete="off"`, cỡ chữ ít nhất 16 px, và chỉ báo trạng thái có `role="status"`

#### Scenario: Ghi chú không lên URL hay tiêu đề

- **WHEN** bác sĩ thêm ghi chú "HA 150/90"
- **THEN** không URL nào đã đi qua và không tiêu đề tab nào chứa "HA 150/90"
