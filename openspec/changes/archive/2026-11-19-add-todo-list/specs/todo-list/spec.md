# Spec Delta

## Purpose

Danh sách việc cần làm của bác sĩ: ghi nhanh việc phát sinh khi khám, có ngày hạn nếu cần, đánh dấu xong bằng một chạm. Cố ý đơn giản (D5), không có thông báo (D15). Đây là phần việc của module `todos`, ở trang `/todos`.

## ADDED Requirements

### Requirement: Trang việc cần làm

Tab "Việc cần làm" (`/todos`) SHALL hiện tiêu đề "Việc cần làm" kèm số việc chưa xong, ô thêm nhanh, danh sách việc chưa xong, và mục "Đã xong (N)" thu gọn ở cuối khi có việc đã xong. Chưa có việc nào thì trang SHALL hiện "Chưa có việc nào". Tiêu đề trang, URL và thông báo nổi MUST NOT chứa nội dung việc.

#### Scenario: Chưa có việc nào

- **WHEN** bác sĩ chưa có việc nào mở `/todos`
- **THEN** trang hiện "Chưa có việc nào" và ô "Thêm việc…"

#### Scenario: Việc đã xong thu gọn ở cuối

- **WHEN** bác sĩ có hai việc chưa xong và một việc đã xong, rồi mở `/todos`
- **THEN** trang hiện hai việc chưa xong, mục "Đã xong (1)" đang thu gọn, và việc đã xong chỉ hiện khi mở mục đó

### Requirement: Thêm việc nhanh

Gõ nội dung vào ô "Thêm việc…" rồi nhấn Enter (hoặc bấm "Thêm") SHALL thêm việc ngay, có ngày hạn nếu bác sĩ đã chọn. Ô nhập SHALL trống lại và giữ con trỏ. Nội dung trống thì không thêm gì; nội dung dài quá 1000 ký tự thì báo lỗi. Gửi lại cùng một lần thêm (bấm hai lần, mạng chập chờn) MUST NOT tạo việc trùng. Mất mạng thì app SHALL giữ chữ trong ô và báo "Chưa thêm được vì mất mạng".

#### Scenario: Thêm việc bằng Enter

- **WHEN** bác sĩ gõ "Gọi chị Bình báo kết quả XN" vào ô "Thêm việc…" rồi nhấn Enter
- **THEN** việc đó hiện trong danh sách chưa xong, ô nhập trống lại, và tải lại trang việc vẫn còn

#### Scenario: Thêm việc có ngày hạn

- **WHEN** bác sĩ gõ "Nộp báo cáo tháng", chọn ngày hạn ngày mai, rồi nhấn Enter
- **THEN** việc hiện kèm "Ngày mai"

#### Scenario: Mất mạng khi thêm việc

- **WHEN** bác sĩ gõ "Hỏi khoa Dược" rồi nhấn Enter lúc mất mạng
- **THEN** trang báo "Chưa thêm được vì mất mạng", ô nhập vẫn còn "Hỏi khoa Dược", và không có việc nào được lưu

### Requirement: Ngày hạn và thứ tự

Ngày hạn SHALL tính theo ngày lịch giờ Việt Nam và hiện thành:

- "Quá hạn · dd/MM" màu đỏ kèm icon, khi hạn đã qua;
- "Hôm nay" hoặc "Ngày mai";
- "dd/MM", hay "dd/MM/yyyy" khi khác năm nay.

Màu MUST NOT là tín hiệu duy nhất của việc quá hạn. Việc chưa xong SHALL xếp: có ngày hạn trước (hạn sớm nhất ở trên), rồi tới việc không có hạn (mới nhất ở trên). Việc đã xong SHALL xếp theo lúc xong, mới nhất ở trên.

#### Scenario: Việc quá hạn

- **WHEN** bác sĩ có việc "Gọi chị Bình" hạn hôm qua và việc "Nộp báo cáo" không có hạn
- **THEN** "Gọi chị Bình" ở trên cùng, kèm chữ "Quá hạn"

#### Scenario: Thứ tự việc chưa xong

- **WHEN** bác sĩ có việc A hạn sau 5 ngày, việc B hạn ngày mai, việc C không hạn thêm hôm qua, và việc D không hạn thêm hôm nay
- **THEN** danh sách theo thứ tự B, A, D, C

### Requirement: Đánh dấu xong và mở lại

Chạm vòng tròn của một việc chưa xong SHALL đánh dấu việc đó xong và chuyển nó xuống mục "Đã xong". Chạm vòng tròn của một việc trong "Đã xong" SHALL mở lại việc đó. Vòng tròn MUST có nhãn cho trình đọc màn hình ("Đánh dấu xong" hoặc "Mở lại việc") và vùng chạm ít nhất 44 × 44 px.

#### Scenario: Đánh dấu xong

- **WHEN** bác sĩ chạm vòng tròn của việc "Gọi chị Bình"
- **THEN** việc đó rời danh sách chưa xong, mục "Đã xong (1)" xuất hiện, và tải lại trang việc vẫn đã xong

#### Scenario: Mở lại việc

- **WHEN** bác sĩ mở mục "Đã xong" và chạm vòng tròn của việc "Gọi chị Bình"
- **THEN** việc đó trở lại danh sách chưa xong

### Requirement: Sửa việc

Chạm vào nội dung một việc SHALL mở bảng "Sửa việc" với nội dung và ngày hạn hiện tại. Bảng có nút bỏ ngày hạn, nút "Lưu" và nút "Xoá việc". "Lưu" SHALL cập nhật việc theo cùng quy tắc như khi thêm. Việc không còn (đã xoá ở thiết bị khác) thì app SHALL báo "Không tìm thấy việc này." và bỏ việc đó khỏi danh sách.

#### Scenario: Sửa nội dung và ngày hạn

- **WHEN** bác sĩ chạm việc "Nộp báo cáo", đổi thành "Nộp báo cáo quý", bỏ ngày hạn, rồi bấm "Lưu"
- **THEN** danh sách hiện "Nộp báo cáo quý" không có ngày hạn, và tải lại trang vẫn vậy

### Requirement: Xoá việc có hoàn tác

"Xoá việc" SHALL xoá ngay, không hỏi xác nhận, rồi hiện thông báo "Đã xoá việc." kèm nút "Hoàn tác" trong khoảng 8 giây. Thông báo MUST NOT chứa nội dung việc. "Hoàn tác" SHALL đưa việc trở lại với nội dung, ngày hạn và trạng thái xong như trước khi xoá.

#### Scenario: Xoá rồi hoàn tác

- **WHEN** bác sĩ mở bảng sửa của việc "Hỏi khoa Dược", bấm "Xoá việc", rồi bấm "Hoàn tác" trên thông báo
- **THEN** thông báo "Đã xoá việc." không chứa "Hỏi khoa Dược", và việc đó lại có trong danh sách

### Requirement: Xoá các việc đã xong

Mục "Đã xong" SHALL có nút "Xoá các việc đã xong". Bấm nút SHALL hỏi bằng hộp thoại "Xoá N việc đã xong?" kèm "Xoá" và "Không xoá". Xác nhận SHALL xoá hẳn mọi việc đã xong của bác sĩ; việc chưa xong giữ nguyên.

#### Scenario: Xoá các việc đã xong

- **WHEN** bác sĩ có hai việc đã xong và một việc chưa xong, mở "Đã xong", bấm "Xoá các việc đã xong" rồi "Xoá"
- **THEN** mục "Đã xong" biến mất và việc chưa xong vẫn còn

#### Scenario: Đổi ý khi xoá việc đã xong

- **WHEN** bác sĩ bấm "Xoá các việc đã xong" rồi "Không xoá"
- **THEN** mọi việc vẫn còn

### Requirement: Việc cần làm tách theo bác sĩ

Bác sĩ SHALL chỉ thấy việc của chính mình. Mọi lệnh thêm, sửa, đánh dấu xong, xoá MUST chỉ áp dụng cho việc của bác sĩ đang đăng nhập. Lệnh nhắm vào việc của bác sĩ khác MUST bị từ chối ("Không tìm thấy việc này.") và không đổi gì. Người chưa đăng nhập hay Admin gửi lệnh MUST bị từ chối.

#### Scenario: Việc của bác sĩ khác

- **WHEN** "bs.minh" có việc "Họp khoa", và "bs.lan" mở `/todos`
- **THEN** trang của "bs.lan" không có "Họp khoa"

#### Scenario: Sửa hoặc xoá việc của bác sĩ khác

- **WHEN** một trình duyệt bị sửa của "bs.lan" gửi lệnh đánh dấu xong, sửa hoặc xoá với id việc "Họp khoa" của "bs.minh"
- **THEN** lệnh bị từ chối và việc "Họp khoa" không đổi

#### Scenario: Chưa đăng nhập hoặc Admin gửi lệnh

- **WHEN** người chưa đăng nhập, hoặc Admin, gửi lệnh thêm hay xoá việc
- **THEN** lệnh bị từ chối và không việc nào thay đổi
