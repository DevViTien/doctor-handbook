# Spec Delta

## MODIFIED Requirements

### Requirement: Giới hạn dung lượng file

App SHALL từ chối file lớn hơn 50 MB với thông báo "File quá lớn. Dung lượng tối đa 50 MB.", và server SHALL từ chối phần dữ liệu chữ (không kể ảnh) lớn hơn 4 MB sau nén.

#### Scenario: File quá lớn

- **WHEN** bác sĩ chọn một file lớn hơn 50 MB
- **THEN** trang báo "File quá lớn. Dung lượng tối đa 50 MB."

## ADDED Requirements

### Requirement: Nhập ảnh đại diện

Tóm tắt file SHALL kèm số ảnh. Khi nhập, app SHALL tải các ảnh trong file lên kho trước ("Đang tải ảnh lên N/M…"), rồi mới thay dữ liệu, và gắn mỗi ảnh vào đúng bệnh nhân mới. Một ảnh không tải lên được thì app MUST NOT thay dữ liệu và SHALL báo lỗi kèm "Thử lại". Sau khi nhập xong, ảnh của dữ liệu cũ SHALL bị xoá khỏi kho. File không có ảnh, kể cả file định dạng cũ, SHALL vẫn nhập được.

#### Scenario: Nhập file có ảnh

- **WHEN** bác sĩ đang có "Trần Thị Bình" có ảnh, rồi nhập một file có "Nguyễn Văn An" kèm ảnh
- **THEN** trang chi tiết của "Nguyễn Văn An" hiện ảnh từ file, và ảnh cũ của "Trần Thị Bình" không còn trong kho

#### Scenario: Nhập file định dạng cũ không có ảnh

- **WHEN** bác sĩ nhập một file sao lưu phiên bản định dạng 1
- **THEN** dữ liệu được nhập, mọi bệnh nhân hiện chữ cái đầu

#### Scenario: Mất mạng khi tải ảnh lên

- **WHEN** mạng mất lúc app đang tải ảnh của file lên kho
- **THEN** trang báo lỗi kèm "Thử lại", và dữ liệu của bác sĩ không đổi
