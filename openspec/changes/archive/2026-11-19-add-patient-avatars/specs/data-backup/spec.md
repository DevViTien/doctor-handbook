# Spec Delta

## ADDED Requirements

### Requirement: Ảnh trong file sao lưu

File sao lưu SHALL chứa ảnh đại diện của mọi bệnh nhân trong file (kể cả thùng rác) trong thư mục `images/`, mỗi ảnh tên theo mã của bệnh nhân trong `data.json`. `manifest.json` SHALL ghi số ảnh. Trình duyệt tải ảnh trực tiếp từ kho; trong lúc đó nút SHALL hiện tiến độ "Đang tải ảnh N/M…". Một ảnh không tải được thì không tạo file và app SHALL báo lỗi như khi mất mạng.

#### Scenario: File có ảnh

- **WHEN** bác sĩ có hai bệnh nhân, chỉ "Nguyễn Văn An" có ảnh, rồi tải file sao lưu
- **THEN** file có `images/<mã của Nguyễn Văn An>.webp`, và `manifest.json` ghi 1 ảnh
