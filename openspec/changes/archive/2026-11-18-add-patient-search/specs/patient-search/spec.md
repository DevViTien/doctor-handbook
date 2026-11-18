# Spec Delta

## Purpose

Tìm một bệnh nhân trong vài giây trên trang danh sách: lọc tức thì theo tên và quê ngay trên máy, tìm sâu trong số điện thoại, mã bệnh nhân, tóm tắt và ghi chú, gợi ý gần đúng, và tìm bằng giọng nói. Kết quả không bao giờ lộ nội dung nhạy cảm. Đây là phần việc của module `search` trên trang `/patients`.

## ADDED Requirements

### Requirement: Ô tìm kiếm trên danh sách bệnh nhân

Trang `/patients` SHALL có ô tìm kiếm ngay dưới tiêu đề, gợi ý "Tìm tên, quê, SĐT, mã BN, ghi chú…", kiểu `search`, `autocomplete="off"`, chữ cỡ ít nhất 16 px. Khi ô có chữ, nút "Xoá từ khoá" (vùng chạm ≥ 44 px) SHALL xoá chữ và hiện lại toàn bộ danh sách. Khi đang tìm, đầu danh sách SHALL hiện số kết quả thay cho số bệnh nhân.

#### Scenario: Xoá từ khoá

- **WHEN** bác sĩ có 3 bệnh nhân, gõ "bình" vào ô tìm rồi bấm "Xoá từ khoá"
- **THEN** ô tìm trống và danh sách hiện lại cả 3 bệnh nhân

#### Scenario: Thuộc tính ô tìm

- **WHEN** bác sĩ mở `/patients`
- **THEN** ô tìm có `type="search"`, `autocomplete="off"` và cỡ chữ ít nhất 16 px

### Requirement: Lọc tức thì theo tên và quê

Mỗi lần gõ, danh sách SHALL chỉ còn các bệnh nhân có họ tên hoặc quê chứa mọi từ đã gõ. Hai bên được so sau khi bỏ dấu, không phân biệt hoa thường. Các từ khớp được theo thứ tự bất kỳ. Việc lọc này MUST chạy ngay trên máy, không cần mạng. Bệnh nhân khớp tên đứng trước bệnh nhân chỉ khớp quê.

#### Scenario: Gõ không dấu

- **WHEN** bác sĩ có "Nguyễn Văn An" và "Trần Thị Bình", rồi gõ "nguyen van an"
- **THEN** danh sách chỉ còn "Nguyễn Văn An"

#### Scenario: Từ theo thứ tự bất kỳ, gồm cả quê

- **WHEN** bác sĩ có "Nguyễn Văn An" quê "Nghệ An" và "Nguyễn Văn An" quê "Thanh Hoá", rồi gõ "an nghe"
- **THEN** danh sách chỉ còn "Nguyễn Văn An" quê "Nghệ An"

#### Scenario: Lọc khi mất mạng

- **WHEN** bác sĩ đã mở `/patients`, mất mạng, rồi gõ "bình"
- **THEN** danh sách vẫn lọc còn "Trần Thị Bình"

### Requirement: Tìm trong số điện thoại, mã bệnh nhân, tóm tắt và ghi chú

Khi từ khoá có ít nhất 2 ký tự và bác sĩ ngừng gõ, hệ thống SHALL tìm thêm trong số điện thoại (so phần chữ số), mã bệnh nhân, tóm tắt và ghi chú của bệnh nhân, cùng cách so không dấu. Bệnh nhân khớp SHALL được gộp vào danh sách kèm nhãn "Khớp số điện thoại", "Khớp mã bệnh nhân", "Khớp trong tóm tắt" hoặc "Khớp trong ghi chú". Danh sách MUST NOT hiện đoạn nội dung đã khớp.

#### Scenario: Tìm trong ghi chú

- **WHEN** bệnh nhân "Nguyễn Văn An" có ghi chú "Dị ứng Penicillin", và bác sĩ gõ "penicillin"
- **THEN** danh sách hiện "Nguyễn Văn An" kèm "Khớp trong ghi chú", và trang không chứa chữ "Dị ứng Penicillin"

#### Scenario: Tìm trong tóm tắt

- **WHEN** bệnh nhân "Trần Thị Bình" có tóm tắt "Tiền sử đái tháo đường", và bác sĩ gõ "dai thao duong"
- **THEN** danh sách hiện "Trần Thị Bình" kèm "Khớp trong tóm tắt"

#### Scenario: Tìm theo số điện thoại

- **WHEN** bệnh nhân "Nguyễn Văn An" có số điện thoại "0912 345 678", và bác sĩ gõ "0912345"
- **THEN** danh sách hiện "Nguyễn Văn An" kèm "Khớp số điện thoại", và trang không chứa "0912 345 678"

#### Scenario: Tìm theo mã bệnh nhân

- **WHEN** bệnh nhân "Nguyễn Văn An" có mã "BN-10234", và bác sĩ gõ "bn-10234"
- **THEN** danh sách hiện "Nguyễn Văn An" kèm "Khớp mã bệnh nhân"

### Requirement: Tìm gần đúng

Khi không bệnh nhân nào khớp, kể cả khớp ở phần tìm sâu, hệ thống SHALL tìm các bệnh nhân có họ tên gần giống từ khoá, ví dụ sai hay thiếu một vài chữ. Chỉ họ tên được so; số điện thoại, mã bệnh nhân và quê MUST NOT tạo ra gợi ý. Nếu có, trang SHALL hiện "Có phải bạn tìm…?" cùng tối đa 5 bệnh nhân, giống nhất ở trên.

#### Scenario: Gõ sai một chữ

- **WHEN** bác sĩ có "Nguyễn Văn An", rồi gõ "nguyn van an"
- **THEN** trang hiện "Có phải bạn tìm…?" cùng "Nguyễn Văn An"

#### Scenario: Gõ sai số điện thoại không gợi ý ai

- **WHEN** bệnh nhân "Nguyễn Văn An" có số điện thoại "0912 345 678", và bác sĩ gõ "0912 345 679"
- **THEN** trang không hiện "Có phải bạn tìm…?"

### Requirement: Không thấy bệnh nhân nào

Khi không có kết quả khớp và cũng không có gợi ý gần đúng, trang SHALL hiện "Không thấy bệnh nhân nào khớp", cùng nút "Thêm bệnh nhân". Nút này mở form thêm với ô Họ tên điền sẵn từ khoá vừa tìm. Từ khoá MUST NOT được truyền qua URL.

#### Scenario: Thêm từ kết quả trống

- **WHEN** bác sĩ gõ "Phạm Thu Hà" mà không ai khớp, rồi bấm "Thêm bệnh nhân"
- **THEN** form thêm mở ra với ô Họ tên là "Phạm Thu Hà", và URL là `/patients/new`

### Requirement: Tìm bằng giọng nói

Khi trình duyệt có nhận dạng giọng nói, ô tìm SHALL có nút "Tìm bằng giọng nói". Bấm nút SHALL bắt đầu nghe tiếng Việt (`vi-VN`), hiện "Đang nghe… nói tên bệnh nhân", và điền chữ nghe được vào ô tìm, lọc như khi gõ. Bấm lần nữa SHALL dừng nghe. Trình duyệt không hỗ trợ thì nút MUST NOT xuất hiện. Không có quyền micro hay không nghe rõ thì SHALL báo một dòng ngắn.

#### Scenario: Đọc tên để tìm

- **WHEN** trình duyệt có nhận dạng giọng nói, bác sĩ bấm "Tìm bằng giọng nói" và đọc "Trần Thị Bình"
- **THEN** ô tìm chứa "Trần Thị Bình" và danh sách chỉ còn "Trần Thị Bình"

#### Scenario: Trình duyệt không hỗ trợ giọng nói

- **WHEN** trình duyệt không có nhận dạng giọng nói
- **THEN** trang không có nút "Tìm bằng giọng nói"

#### Scenario: Lỗi micro không che dòng mất mạng

- **WHEN** trình duyệt đã từ chối quyền micro, rồi bác sĩ mất mạng và gõ "penicillin"
- **THEN** trang hiện "Chưa tìm được trong ghi chú vì mất mạng." thay cho thông báo lỗi micro

#### Scenario: Bị từ chối quyền micro

- **WHEN** bác sĩ bấm "Tìm bằng giọng nói" và trình duyệt từ chối quyền micro
- **THEN** trang hiện "Không dùng được micro. Hãy cho phép micro, hoặc gõ để tìm." và ô tìm vẫn gõ được

### Requirement: Mất mạng khi tìm sâu

Không gửi được phần tìm sâu vì mạng thì trang SHALL hiện "Chưa tìm được trong ghi chú vì mất mạng." và giữ kết quả lọc theo tên và quê. Có mạng lại thì phần tìm sâu SHALL chạy lại với từ khoá đang có.

#### Scenario: Tìm ghi chú khi mất mạng

- **WHEN** bác sĩ mất mạng rồi gõ "penicillin"
- **THEN** trang hiện "Chưa tìm được trong ghi chú vì mất mạng."; khi có mạng lại, "Nguyễn Văn An" hiện kèm "Khớp trong ghi chú"

### Requirement: Riêng tư khi tìm

Từ khoá MUST NOT xuất hiện trong URL, tiêu đề tab hay log của server. Kết quả tìm chỉ hiện những gì danh sách bệnh nhân đã hiện (tên, tuổi, giới, quê) và nhãn khớp ở đâu. Phần tìm sâu trả về trình duyệt chỉ mã định danh bệnh nhân và loại khớp, không trả nội dung.

#### Scenario: Từ khoá không lên URL hay tiêu đề

- **WHEN** bác sĩ gõ "penicillin" vào ô tìm và đợi kết quả
- **THEN** không URL nào đã đi qua và tiêu đề tab không chứa "penicillin"

### Requirement: Tìm kiếm tách theo bác sĩ

Tìm kiếm SHALL chỉ trả về bệnh nhân chưa xoá của bác sĩ đang đăng nhập; tài khoản lấy từ phiên. Lệnh tìm không kèm phiên MUST bị từ chối với `UNAUTHENTICATED`, lệnh của Admin với `FORBIDDEN`.

#### Scenario: Không tìm thấy ghi chú của bác sĩ khác

- **WHEN** bệnh nhân của `bs.lan` có ghi chú "Dị ứng Penicillin", và `bs.minh` gõ "penicillin" trên trang của mình
- **THEN** danh sách của `bs.minh` không có bệnh nhân nào, và trang hiện "Không thấy bệnh nhân nào khớp"

#### Scenario: Chưa đăng nhập hoặc Admin gửi lệnh tìm

- **WHEN** lệnh tìm được gửi không kèm phiên, hoặc do Admin gửi
- **THEN** lệnh trả về lần lượt `UNAUTHENTICATED` và `FORBIDDEN`
