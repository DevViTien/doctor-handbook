# Spec Delta

## Purpose

Nhập dữ liệu từ file sao lưu: bác sĩ lấy lại toàn bộ sổ tay khi server mất dữ liệu, khi đổi tài khoản, hay khi lỡ tay. MVP chỉ thay thế toàn bộ (D20); app tự sao lưu dữ liệu hiện tại trước khi thay, và nhập kiểu tất cả hoặc không. Đây là phần việc của module `backup`, ở trang `/settings/backup`.

## ADDED Requirements

### Requirement: Chọn file và xem tóm tắt

Trang `/settings/backup` SHALL có nút "Chọn file sao lưu" để chọn một file `.zip`. App SHALL kiểm tra file **trước khi đổi bất cứ gì**, rồi hiện tóm tắt "File sao lưu ngày dd/MM/yyyy: N bệnh nhân, M ghi chú, K việc". Nếu file được tạo từ một tài khoản khác, tóm tắt SHALL thêm cảnh báo "File này của tài khoản <tên đăng nhập>." nhưng vẫn cho nhập.

#### Scenario: Xem tóm tắt file

- **WHEN** bác sĩ "bs.lan" chọn một file sao lưu của chính mình tạo ngày 10/11/2026 có 2 bệnh nhân, 3 ghi chú, 0 việc
- **THEN** trang hiện "File sao lưu ngày 10/11/2026: 2 bệnh nhân, 3 ghi chú, 0 việc" và dữ liệu hiện tại chưa đổi

#### Scenario: File của tài khoản khác

- **WHEN** bác sĩ "bs.lan" chọn một file sao lưu tạo từ tài khoản "bs.minh"
- **THEN** tóm tắt có "File này của tài khoản bs.minh." và nút nhập vẫn bấm được

### Requirement: Từ chối file không hợp lệ

App SHALL từ chối file không phải file sao lưu của app, file bị hỏng, hay file có dữ liệu sai quy tắc (thiếu họ tên, quá giới hạn ký tự, ghi chú không thuộc bệnh nhân nào trong file…), báo "File này không phải file sao lưu của Doctor Handbook, hoặc đã bị hỏng.", và MUST NOT đổi dữ liệu nào. Server MUST kiểm tra lại toàn bộ dữ liệu trước khi ghi, không tin phần kiểm tra trên trình duyệt.

#### Scenario: File hỏng

- **WHEN** bác sĩ chọn một file `.zip` không phải file sao lưu
- **THEN** trang báo "File này không phải file sao lưu của Doctor Handbook, hoặc đã bị hỏng." và dữ liệu không đổi

#### Scenario: Dữ liệu sai gửi thẳng lên server

- **WHEN** một trình duyệt bị sửa gửi lên server dữ liệu nhập có bệnh nhân không có họ tên
- **THEN** server từ chối và dữ liệu của bác sĩ không đổi

### Requirement: Phiên bản định dạng của file

App SHALL đọc được file của phiên bản định dạng hiện tại và mọi phiên bản cũ hơn. File từ phiên bản định dạng mới hơn app đang chạy SHALL bị từ chối với thông báo "File được tạo từ phiên bản app mới hơn. Vui lòng cập nhật app (tải lại trang) rồi thử lại."

#### Scenario: File của phiên bản mới hơn

- **WHEN** bác sĩ chọn một file sao lưu có phiên bản định dạng lớn hơn phiên bản app hỗ trợ
- **THEN** trang báo "Vui lòng cập nhật app" và không cho nhập

### Requirement: Giới hạn dung lượng file

App SHALL từ chối file lớn hơn 4 MB với thông báo "File quá lớn. Dung lượng tối đa 4 MB.", và server SHALL từ chối dữ liệu nhập vượt giới hạn đó.

#### Scenario: File quá lớn

- **WHEN** bác sĩ chọn một file lớn hơn 4 MB
- **THEN** trang báo "File quá lớn. Dung lượng tối đa 4 MB."

### Requirement: Xác nhận và tự sao lưu trước khi thay

Nếu tài khoản đang có dữ liệu, bấm "Nhập dữ liệu" SHALL mở hộp thoại "Thay thế toàn bộ dữ liệu?" nêu số bệnh nhân, ghi chú, việc sẽ bị thay, kèm nút "Thay thế dữ liệu" và "Không nhập". Sau khi bác sĩ xác nhận, app SHALL **tự tải về một file sao lưu dữ liệu hiện tại**, tên `doctor-handbook_<tên-đăng-nhập>_<yyyy-mm-dd>_truoc-khi-nhap.zip`, rồi mới thay; không tải được file này thì app MUST NOT nhập. Tài khoản chưa có dữ liệu thì app nhập ngay, không hỏi và không tự sao lưu.

#### Scenario: Thay thế dữ liệu đang có

- **WHEN** bác sĩ đang có "Trần Thị Bình", chọn file có "Nguyễn Văn An", bấm "Nhập dữ liệu" rồi "Thay thế dữ liệu" trong hộp thoại
- **THEN** trình duyệt tải về một file `…_truoc-khi-nhap.zip` có "Trần Thị Bình", rồi danh sách chỉ còn "Nguyễn Văn An"

#### Scenario: Đổi ý khi thay thế

- **WHEN** bác sĩ đang có dữ liệu bấm "Nhập dữ liệu" rồi "Không nhập" trong hộp thoại
- **THEN** không có file nào được tải về và dữ liệu không đổi

### Requirement: Không thay dữ liệu chưa được hỏi

Nếu tài khoản có thêm dữ liệu sau khi trang được mở (thiết bị khác, trang cũ), server MUST từ chối thay mà không hỏi và không đổi gì. App SHALL báo "Sổ tay vừa có thêm dữ liệu nên chưa nhập." và tải lại số liệu, để lần nhập sau hỏi và tự sao lưu.

#### Scenario: Trang cũ không được thay dữ liệu mới mà không hỏi

- **WHEN** trang `/settings/backup` được mở lúc tài khoản trống, rồi "Trần Thị Bình" được thêm ở thiết bị khác, và bác sĩ chọn file có "Nguyễn Văn An" rồi bấm "Nhập dữ liệu"
- **THEN** trang báo "Sổ tay vừa có thêm dữ liệu nên chưa nhập.", "Trần Thị Bình" vẫn còn, và lần nhập kế tiếp hiện hộp thoại "Thay thế toàn bộ dữ liệu?"

### Requirement: Nhập tất cả hoặc không

Nhập SHALL thay **toàn bộ** bệnh nhân (kể cả thùng rác), ghi chú và việc của bác sĩ bằng nội dung trong file, trong một lần: lỗi giữa chừng thì dữ liệu hiện tại MUST còn nguyên. Xong, app SHALL báo "Đã nhập N bệnh nhân, M ghi chú, K việc." Mất mạng thì app SHALL báo "Không nhập được vì mất mạng. Dữ liệu chưa thay đổi." kèm nút "Thử lại".

#### Scenario: Nhập vào tài khoản trống

- **WHEN** bác sĩ chưa có dữ liệu chọn file có "Nguyễn Văn An" với ghi chú "HA 150/90" và bấm "Nhập dữ liệu"
- **THEN** trang báo "Đã nhập 1 bệnh nhân, 1 ghi chú, 0 việc.", không có hộp thoại, không có file nào được tải về, và danh sách có "Nguyễn Văn An" với ghi chú "HA 150/90"

#### Scenario: Mất mạng khi nhập

- **WHEN** mạng mất lúc app gửi dữ liệu nhập lên
- **THEN** trang báo "Không nhập được vì mất mạng. Dữ liệu chưa thay đổi." kèm nút "Thử lại", và dữ liệu của bác sĩ không đổi

### Requirement: Dữ liệu nhập giữ nguyên như trong file

Dữ liệu nhập vào SHALL giữ nguyên mọi trường bác sĩ đã nhập cùng ngày tạo, ngày sửa của bệnh nhân và ghi chú; ghi chú đã sửa vẫn hiện "Đã sửa". Bệnh nhân và ghi chú vừa nhập SHALL tìm được như dữ liệu gõ tay. Sau khi nhập, lần sao lưu gần nhất SHALL là lần muộn hơn giữa lần sao lưu gần nhất đang có và ngày tạo file vừa nhập.

#### Scenario: Tìm được dữ liệu vừa nhập

- **WHEN** bác sĩ vừa nhập file có "Nguyễn Văn An" với SĐT 0912 345 678, rồi gõ "0912345678" vào ô tìm
- **THEN** kết quả có "Nguyễn Văn An"

#### Scenario: Ngày sao lưu sau khi nhập

- **WHEN** bác sĩ chưa có dữ liệu và chưa sao lưu lần nào nhập một file sao lưu tạo 3 ngày trước
- **THEN** trang hiện "Lần sao lưu gần nhất: 3 ngày trước"

### Requirement: Thùng rác khi nhập

Bệnh nhân đang ở thùng rác trong file SHALL vào thùng rác với ngày xoá cũ. Bệnh nhân đã quá 30 ngày trong thùng rác, cùng ghi chú của họ, MUST NOT được nhập và không tính vào số đã nhập.

#### Scenario: Giữ ngày tháng và thùng rác

- **WHEN** bác sĩ nhập file có "Nguyễn Văn An" với một ghi chú đã sửa, "Lê Thị Cúc" ở thùng rác xoá cách đây 5 ngày, và "Phạm Văn Dũng" ở thùng rác xoá cách đây 40 ngày
- **THEN** trang báo "Đã nhập 2 bệnh nhân, 1 ghi chú, 0 việc.", ghi chú hiện "Đã sửa", Thùng rác có "Lê Thị Cúc" kèm "còn 25 ngày", và không có "Phạm Văn Dũng"

### Requirement: Quyền nhập dữ liệu

Chỉ bác sĩ đã đăng nhập mới nhập được, và nhập chỉ thay dữ liệu của chính bác sĩ đó; tài khoản đích luôn là tài khoản đang đăng nhập, không bao giờ lấy từ file. Yêu cầu nhập từ người chưa đăng nhập, từ Admin, hay từ một trang web khác MUST bị từ chối và không đổi gì.

#### Scenario: Chưa đăng nhập hoặc Admin nhập dữ liệu

- **WHEN** người chưa đăng nhập, hoặc Admin, gửi yêu cầu nhập dữ liệu
- **THEN** yêu cầu bị từ chối và không dữ liệu nào thay đổi

#### Scenario: Nhập không đụng dữ liệu bác sĩ khác

- **WHEN** "bs.minh" có bệnh nhân "Lê Văn Tâm", và "bs.lan" nhập một file sao lưu tạo từ tài khoản "bs.minh"
- **THEN** "bs.lan" có dữ liệu của file, còn "bs.minh" vẫn có "Lê Văn Tâm" như cũ
