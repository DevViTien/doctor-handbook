# data-backup Specification

## Purpose

Sao lưu ra file: bác sĩ giữ trên máy một bản sao toàn bộ dữ liệu của mình, vì server miễn phí có thể mất dữ liệu (D8). App luôn cho biết lần sao lưu gần nhất và nhắc trên màn hình chính khi đã lâu chưa sao lưu. Đây là phần việc của module `backup`, ở trang `/settings/backup` và màn hình chính `/patients`.

## Requirements

### Requirement: Ngày sao lưu gần nhất trong Cài đặt

Cài đặt SHALL có dòng "Sao lưu và nhập dữ liệu" mở `/settings/backup`. Dòng này và trang đó SHALL luôn hiện "Lần sao lưu gần nhất: …", tính theo ngày lịch giờ Việt Nam:

- "hôm nay" hoặc "hôm qua";
- "N ngày trước";
- "Chưa sao lưu lần nào" khi bác sĩ chưa sao lưu lần nào.

Trang `/settings/backup` SHALL kèm ngày dạng dd/MM/yyyy và số bệnh nhân (kể cả trong thùng rác), ghi chú, việc đang có.

#### Scenario: Chưa sao lưu lần nào

- **WHEN** bác sĩ chưa sao lưu lần nào mở Cài đặt
- **THEN** dòng "Sao lưu và nhập dữ liệu" hiện "Chưa sao lưu lần nào"

#### Scenario: Đã sao lưu 3 ngày trước

- **WHEN** lần sao lưu gần nhất của bác sĩ là 3 ngày trước, và bác sĩ mở Cài đặt rồi bấm "Sao lưu và nhập dữ liệu"
- **THEN** cả dòng trong Cài đặt lẫn trang `/settings/backup` hiện "Lần sao lưu gần nhất: 3 ngày trước"

### Requirement: Tải file sao lưu

Nút "Tải file sao lưu" SHALL tạo và lưu về máy **một file** `.zip`, tên `doctor-handbook_<tên-đăng-nhập>_<yyyy-mm-dd>.zip`, ngày theo giờ Việt Nam. Trong lúc tạo file, nút SHALL hiện "Đang tạo file…" và không bấm được. Mất mạng thì app SHALL báo "Không tạo được file vì mất mạng. Thử lại khi có mạng." File MUST NOT có mật khẩu (D18).

#### Scenario: Tải file sao lưu

- **WHEN** bác sĩ "bs.lan" bấm "Tải file sao lưu" ngày 19/11/2026
- **THEN** trình duyệt tải về một file tên `doctor-handbook_bs.lan_2026-11-19.zip`

#### Scenario: Mất mạng khi tải file sao lưu

- **WHEN** bác sĩ bấm "Tải file sao lưu" lúc mất mạng
- **THEN** trang báo "Không tạo được file vì mất mạng. Thử lại khi có mạng." và ngày sao lưu gần nhất không đổi

### Requirement: Nội dung file sao lưu

File sao lưu SHALL gồm:

- `manifest.json`: định danh app, phiên bản định dạng, phiên bản app, ngày giờ sao lưu, tên đăng nhập, số bệnh nhân, ghi chú, việc;
- `data.json`: toàn bộ bệnh nhân của bác sĩ, kể cả bệnh nhân đang ở thùng rác (kèm ngày xoá), với mọi trường bác sĩ đã nhập cùng ngày tạo, ngày sửa; toàn bộ ghi chú kèm ngày tạo, ngày sửa; toàn bộ việc cần làm.

File MUST NOT chứa dữ liệu của bác sĩ khác, mật khẩu, hay dữ liệu chỉ dùng nội bộ (chữ để tìm, mã tài khoản).

#### Scenario: File có cả thùng rác

- **WHEN** bác sĩ có hai bệnh nhân, một trong đó đang ở thùng rác, cùng ba ghi chú, rồi tải file sao lưu
- **THEN** `manifest.json` ghi 2 bệnh nhân, 3 ghi chú, 0 việc, và `data.json` có cả bệnh nhân trong thùng rác kèm ngày xoá

#### Scenario: File không có dữ liệu của bác sĩ khác

- **WHEN** "bs.minh" có bệnh nhân "Lê Văn Tâm", và "bs.lan" tải file sao lưu
- **THEN** file của "bs.lan" không chứa "Lê Văn Tâm"

### Requirement: Ghi lại lần sao lưu và nhắc giữ file

Sau khi tải xong, app SHALL ghi thời điểm này là lần sao lưu gần nhất, rồi báo tên file vừa tải kèm "Giữ file cẩn thận, không gửi cho người khác." Tải không xong thì app MUST NOT ghi. Trang sao lưu SHALL luôn hiện, cạnh nút tải, lời nhắc "File chứa thông tin bệnh nhân. Giữ file cẩn thận, không gửi cho người khác."

#### Scenario: Ghi lại ngày sao lưu

- **WHEN** bác sĩ chưa sao lưu lần nào tải file sao lưu thành công
- **THEN** trang hiện "Lần sao lưu gần nhất: hôm nay"

#### Scenario: Nhắc sau khi tải

- **WHEN** bác sĩ "bs.lan" tải file sao lưu thành công ngày 19/11/2026
- **THEN** trang báo "Đã tải file doctor-handbook_bs.lan_2026-11-19.zip." kèm "Giữ file cẩn thận, không gửi cho người khác."

### Requirement: Khi nào hiện thanh nhắc sao lưu

`/patients` SHALL hiện thanh nhắc sao lưu khi đủ ba điều kiện:

- bác sĩ có dữ liệu;
- đã **quá 7 ngày** kể từ lần sao lưu gần nhất (chưa lần nào thì tính từ ngày tạo tài khoản);
- dữ liệu có thêm, sửa, xoá vào thùng rác hay khôi phục kể từ lần đó (chưa lần nào thì coi là có).

Thanh nhắc SHALL nói số ngày chưa sao lưu, hoặc "Bạn chưa sao lưu dữ liệu lần nào.", và MUST NOT chứa dữ liệu bệnh nhân.

#### Scenario: Quá 7 ngày và có thay đổi

- **WHEN** lần sao lưu gần nhất là 12 ngày trước, bác sĩ đã sửa một bệnh nhân sau đó, rồi mở `/patients`
- **THEN** trang hiện thanh nhắc "Đã 12 ngày chưa sao lưu dữ liệu."

#### Scenario: Quá 7 ngày nhưng không có thay đổi

- **WHEN** lần sao lưu gần nhất là 12 ngày trước và từ đó dữ liệu không đổi
- **THEN** `/patients` không hiện thanh nhắc

#### Scenario: Mới sao lưu

- **WHEN** lần sao lưu gần nhất là 2 ngày trước và bác sĩ đã thêm bệnh nhân sau đó
- **THEN** `/patients` không hiện thanh nhắc

### Requirement: Thao tác trên thanh nhắc sao lưu

Thanh nhắc SHALL có hai nút:

- **"Sao lưu ngay"** tải file sao lưu ngay tại màn hình chính, như nút ở trang sao lưu. Xong thì thanh nhắc biến mất và app báo đã tải kèm lời nhắc giữ file.
- **"Để mai"** ẩn thanh nhắc trên máy đó trong 1 ngày.

#### Scenario: Sao lưu ngay từ thanh nhắc

- **WHEN** thanh nhắc đang hiện và bác sĩ bấm "Sao lưu ngay"
- **THEN** trình duyệt tải về file sao lưu, thanh nhắc biến mất, và Cài đặt hiện "Lần sao lưu gần nhất: hôm nay"

#### Scenario: Để mai

- **WHEN** thanh nhắc đang hiện, bác sĩ bấm "Để mai" rồi tải lại `/patients`
- **THEN** thanh nhắc không hiện

### Requirement: Quyền tải sao lưu

Chỉ bác sĩ đã đăng nhập mới tải được dữ liệu sao lưu, và chỉ của chính mình. Yêu cầu tải dữ liệu từ người chưa đăng nhập hoặc từ Admin MUST bị từ chối và không trả dữ liệu nào. Dữ liệu sao lưu MUST NOT nằm trong URL.

#### Scenario: Chưa đăng nhập hoặc Admin tải sao lưu

- **WHEN** người chưa đăng nhập, hoặc Admin, gửi yêu cầu tải dữ liệu sao lưu
- **THEN** yêu cầu bị từ chối và câu trả lời không có dữ liệu bệnh nhân

### Requirement: Ảnh trong file sao lưu

File sao lưu SHALL chứa ảnh đại diện của mọi bệnh nhân trong file (kể cả thùng rác) trong thư mục `images/`, mỗi ảnh tên theo mã của bệnh nhân trong `data.json`. `manifest.json` SHALL ghi số ảnh. Trình duyệt tải ảnh trực tiếp từ kho; trong lúc đó nút SHALL hiện tiến độ "Đang tải ảnh N/M…". Một ảnh không tải được thì không tạo file và app SHALL báo lỗi như khi mất mạng.

#### Scenario: File có ảnh

- **WHEN** bác sĩ có hai bệnh nhân, chỉ "Nguyễn Văn An" có ảnh, rồi tải file sao lưu
- **THEN** file có `images/<mã của Nguyễn Văn An>.webp`, và `manifest.json` ghi 1 ảnh
