# Spec Delta

## Purpose

Thùng rác của bệnh nhân: bỏ một hồ sơ mà vẫn lấy lại được trong 30 ngày, rồi hệ thống xoá hẳn. Chuyển vào thùng rác không hỏi xác nhận vì hoàn tác được; chỉ xoá vĩnh viễn mới hỏi. Đây là phần việc của module `patients`, ở trang chi tiết bệnh nhân và trang `/settings/trash`.

## ADDED Requirements

### Requirement: Chuyển bệnh nhân vào thùng rác

Trang chi tiết bệnh nhân SHALL có nút "Thêm thao tác" mở menu có mục "Chuyển vào thùng rác". Chọn mục này SHALL chuyển bệnh nhân vào thùng rác ngay, không hỏi xác nhận, rồi đưa bác sĩ về `/patients`. Bệnh nhân trong thùng rác MUST NOT hiện ở danh sách, kết quả tìm, gợi ý trùng tên; trang chi tiết của bệnh nhân đó SHALL hiện "Không tìm thấy bệnh nhân".

#### Scenario: Chuyển vào thùng rác

- **WHEN** bác sĩ mở trang chi tiết của "Nguyễn Văn An", bấm "Thêm thao tác" rồi chọn "Chuyển vào thùng rác"
- **THEN** trình duyệt về `/patients`, danh sách không còn "Nguyễn Văn An", và mở lại URL trang chi tiết đó thì hiện "Không tìm thấy bệnh nhân"

#### Scenario: Bệnh nhân trong thùng rác không hiện khi tìm

- **WHEN** "Nguyễn Văn An" có ghi chú "Dị ứng Penicillin" và đang ở thùng rác, rồi bác sĩ gõ "penicillin" vào ô tìm
- **THEN** trang hiện "Không thấy bệnh nhân nào khớp"

### Requirement: Hoàn tác ngay sau khi xoá

Sau khi chuyển vào thùng rác, trang SHALL hiện thông báo "Đã chuyển bệnh nhân vào thùng rác." kèm nút "Hoàn tác" trong khoảng 8 giây. Thông báo MUST NOT chứa họ tên hay thông tin nào của bệnh nhân. Bấm "Hoàn tác" SHALL đưa bệnh nhân trở lại danh sách.

#### Scenario: Hoàn tác

- **WHEN** bác sĩ vừa chuyển "Nguyễn Văn An" vào thùng rác và bấm "Hoàn tác"
- **THEN** danh sách lại có "Nguyễn Văn An", và thông báo đã hiện không chứa "Nguyễn Văn An"

### Requirement: Trang thùng rác

Cài đặt SHALL có dòng "Thùng rác" kèm số bệnh nhân đang trong thùng rác, mở `/settings/trash`. Trang này SHALL liệt kê bệnh nhân trong thùng rác của bác sĩ, xoá gần nhất ở trên. Mỗi dòng có họ tên, giới tính, tuổi, quê, "Xoá ngày dd/MM/yyyy · còn N ngày" (theo giờ Việt Nam), và hai nút "Khôi phục", "Xoá vĩnh viễn". Thùng rác trống thì trang SHALL hiện "Thùng rác trống".

#### Scenario: Xem thùng rác

- **WHEN** bác sĩ chuyển "Nguyễn Văn An" vào thùng rác hôm nay, rồi mở Cài đặt và bấm "Thùng rác"
- **THEN** dòng Thùng rác trong Cài đặt có "1 bệnh nhân", và trang `/settings/trash` có "Nguyễn Văn An" kèm "còn 30 ngày"

#### Scenario: Thùng rác trống

- **WHEN** bác sĩ chưa xoá bệnh nhân nào mở `/settings/trash`
- **THEN** trang hiện "Thùng rác trống"

### Requirement: Khôi phục từ thùng rác

Bấm "Khôi phục" SHALL đưa bệnh nhân trở lại danh sách ở vị trí trên cùng, giữ nguyên thông tin, tóm tắt và mọi ghi chú, và hiện "Đã khôi phục bệnh nhân.". Bệnh nhân đó rời khỏi trang thùng rác.

#### Scenario: Khôi phục giữ nguyên ghi chú

- **WHEN** "Nguyễn Văn An" có ghi chú "HA 150/90" và đang ở thùng rác, rồi bác sĩ bấm "Khôi phục" trên dòng đó
- **THEN** trang thùng rác không còn "Nguyễn Văn An", `/patients` có "Nguyễn Văn An" ở trên cùng, và trang chi tiết của người đó vẫn có ghi chú "HA 150/90"

### Requirement: Xoá vĩnh viễn

Bấm "Xoá vĩnh viễn" SHALL mở hộp thoại xác nhận nêu họ tên bệnh nhân và nói rõ hồ sơ cùng mọi ghi chú bị xoá hẳn, không khôi phục được. Chỉ khi bác sĩ xác nhận thì bệnh nhân và ghi chú mới bị xoá khỏi hệ thống. Chỉ bệnh nhân đang trong thùng rác mới xoá vĩnh viễn được.

#### Scenario: Xoá vĩnh viễn

- **WHEN** bác sĩ bấm "Xoá vĩnh viễn" trên dòng "Nguyễn Văn An" rồi xác nhận
- **THEN** trang thùng rác không còn "Nguyễn Văn An", và hệ thống không còn bệnh nhân đó hay ghi chú nào của người đó

#### Scenario: Đổi ý khi xoá vĩnh viễn

- **WHEN** bác sĩ bấm "Xoá vĩnh viễn" rồi chọn "Không xoá"
- **THEN** "Nguyễn Văn An" vẫn ở trang thùng rác

### Requirement: Tự xoá hẳn sau 30 ngày

Bệnh nhân đã ở thùng rác quá 30 ngày SHALL được hệ thống xoá hẳn, cùng mọi ghi chú, trong lần bảo trì hằng ngày. Từ lúc quá 30 ngày, kể cả trước lần bảo trì, bệnh nhân đó MUST NOT hiện ở trang thùng rác và MUST NOT khôi phục được.

#### Scenario: Quá 30 ngày

- **WHEN** "Nguyễn Văn An" đã vào thùng rác 31 ngày trước, và lần bảo trì hằng ngày chạy
- **THEN** trang thùng rác không có "Nguyễn Văn An", và hệ thống không còn bệnh nhân đó hay ghi chú nào của người đó

#### Scenario: Ngày cuối cùng

- **WHEN** "Trần Thị Bình" đã vào thùng rác 29 ngày rưỡi trước
- **THEN** trang thùng rác vẫn có "Trần Thị Bình" kèm "còn 1 ngày", và lần bảo trì không xoá người đó

### Requirement: Thùng rác tách theo bác sĩ

Chuyển vào thùng rác, khôi phục và xoá vĩnh viễn SHALL chỉ áp dụng cho bệnh nhân của bác sĩ đang đăng nhập; tài khoản lấy từ phiên. Lệnh mang id bệnh nhân của bác sĩ khác MUST bị từ chối với `NOT_FOUND` và không đổi gì. Lệnh không kèm phiên MUST bị từ chối với `UNAUTHENTICATED`, lệnh của Admin với `FORBIDDEN`. Trang thùng rác chỉ hiện bệnh nhân của chính bác sĩ.

#### Scenario: Thùng rác của bác sĩ khác

- **WHEN** `bs.lan` có "Nguyễn Văn An" trong thùng rác, và `bs.minh` mở `/settings/trash`
- **THEN** trang của `bs.minh` hiện "Thùng rác trống"

#### Scenario: Xoá bệnh nhân của bác sĩ khác

- **WHEN** lệnh chuyển vào thùng rác, khôi phục hay xoá vĩnh viễn của `bs.minh` mang id một bệnh nhân của `bs.lan`
- **THEN** lệnh trả về `NOT_FOUND`, và bệnh nhân của `bs.lan` không đổi

#### Scenario: Chưa đăng nhập hoặc Admin gửi lệnh xoá

- **WHEN** lệnh chuyển vào thùng rác được gửi không kèm phiên, hoặc do Admin gửi
- **THEN** lệnh trả về lần lượt `UNAUTHENTICATED` và `FORBIDDEN`
