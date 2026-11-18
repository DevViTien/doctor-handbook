# patient-records Specification

## Purpose

Hồ sơ bệnh nhân trong sổ tay của bác sĩ: danh sách, thêm, xem chi tiết, sửa thông tin và tóm tắt. Chỉ họ tên là bắt buộc. Danh sách không lộ nội dung nhạy cảm. Mỗi bác sĩ chỉ thấy bệnh nhân của chính mình. Đây là phần việc của module `patients` ở các trang `/patients/*`.

## Requirements

### Requirement: Danh sách bệnh nhân

Trang `/patients` SHALL liệt kê mọi bệnh nhân chưa xoá của bác sĩ đang đăng nhập, bệnh nhân được thêm hoặc sửa gần nhất ở trên cùng. Đầu trang SHALL hiện số bệnh nhân. Mỗi dòng SHALL gồm chữ cái đầu, họ tên, và một dòng phụ gồm giới tính, tuổi và quê quán (bỏ qua phần chưa có). Bấm một dòng SHALL mở trang chi tiết của bệnh nhân đó.

#### Scenario: Xem danh sách

- **WHEN** `bs.lan` có "Nguyễn Văn An" (nam, sinh 1979, quê Nghệ An), rồi thêm "Trần Thị Bình" chỉ với họ tên
- **THEN** `/patients` hiện "2 bệnh nhân", dòng "Trần Thị Bình" đứng trên dòng "Nguyễn Văn An", và dòng "Nguyễn Văn An" có dòng phụ gồm "Nam", tuổi tính từ năm 1979 và "Nghệ An"

#### Scenario: Sửa thì lên đầu danh sách

- **WHEN** bác sĩ có "Nguyễn Văn An" và "Trần Thị Bình" (thêm sau), rồi sửa quê quán của "Nguyễn Văn An"
- **THEN** ở `/patients`, dòng "Nguyễn Văn An" đứng trên dòng "Trần Thị Bình"

### Requirement: Danh sách không lộ thông tin nhạy cảm

Dòng trong danh sách MUST NOT hiện tóm tắt, số điện thoại hay mã bệnh nhân, vì bệnh nhân và người nhà có thể nhìn vào màn hình. Họ tên quá dài SHALL bị cắt gọn trên một dòng, không làm tràn ngang màn hình 360 px.

#### Scenario: Danh sách không lộ tóm tắt

- **WHEN** bệnh nhân "Nguyễn Văn An" có tóm tắt "Dị ứng Penicillin", số điện thoại "0912345678" và mã bệnh nhân "BN-10234"
- **THEN** trang `/patients` không chứa "Dị ứng Penicillin", "0912345678" hay "BN-10234"

#### Scenario: Họ tên rất dài

- **WHEN** bác sĩ có bệnh nhân với họ tên dài 100 ký tự và mở `/patients` trên màn hình rộng 360 px
- **THEN** trang không cuộn ngang được

### Requirement: Nút thêm và sổ trống

Trang `/patients` SHALL có nút "Thêm bệnh nhân" ở nửa dưới màn hình, mở `/patients/new`. Khi bác sĩ chưa có bệnh nhân nào, trang SHALL hiện "Sổ chưa có bệnh nhân nào" cùng nút "Thêm bệnh nhân".

#### Scenario: Sổ chưa có bệnh nhân

- **WHEN** bác sĩ chưa có bệnh nhân nào mở `/patients`
- **THEN** trang hiện "Sổ chưa có bệnh nhân nào" cùng nút "Thêm bệnh nhân" mở `/patients/new`

### Requirement: Thêm bệnh nhân

Trang `/patients/new` SHALL có form gồm các ô Họ tên, Năm sinh hoặc tuổi, Giới tính (Nam / Nữ / Khác hoặc để trống), Quê quán, Số điện thoại, Mã bệnh nhân và Tóm tắt. Chỉ họ tên là bắt buộc. Lưu thành công SHALL mở trang chi tiết của bệnh nhân vừa thêm, không qua hộp thoại xác nhận nào.

#### Scenario: Thêm chỉ với họ tên

- **WHEN** bác sĩ mở `/patients/new`, gõ "Nguyễn Văn An" vào ô Họ tên rồi bấm "Lưu"
- **THEN** trình duyệt chuyển tới trang chi tiết của "Nguyễn Văn An", và `/patients` có thêm dòng "Nguyễn Văn An"

#### Scenario: Thêm với đủ thông tin

- **WHEN** bác sĩ điền họ tên "Nguyễn Văn An", năm sinh "1979", giới tính "Nam", quê "Nghệ An", số điện thoại "0912 345 678", mã bệnh nhân "BN-10234", tóm tắt "Dị ứng Penicillin" rồi bấm "Lưu"
- **THEN** trang chi tiết hiện đúng từng giá trị đó

#### Scenario: Bỏ chọn giới tính

- **WHEN** bác sĩ chọn "Nam" rồi bấm "Nam" lần nữa (hoặc nhấn phím cách khi đang ở ô đó), điền họ tên rồi bấm "Lưu"
- **THEN** không giới tính nào được chọn, và bệnh nhân được lưu không có giới tính

#### Scenario: Thiếu họ tên

- **WHEN** bác sĩ để trống ô Họ tên (hoặc chỉ gõ dấu cách) rồi bấm "Lưu"
- **THEN** dưới ô Họ tên hiện "Nhập họ tên bệnh nhân.", và không bệnh nhân nào được thêm

### Requirement: Giới hạn các ô thông tin

Hệ thống SHALL cắt khoảng trắng ở đầu và cuối mỗi ô văn bản, và lưu ô trống là "chưa có". Giới hạn: Họ tên và Quê quán tối đa 100 ký tự; Số điện thoại tối đa 20 ký tự, chỉ gồm chữ số, dấu cách và `+ - . ( )`; Mã bệnh nhân tối đa 50 ký tự; Tóm tắt tối đa 5000 ký tự. Ô sai SHALL hiện lỗi ngay dưới ô đó và không có gì được lưu.

#### Scenario: Số điện thoại sai

- **WHEN** bác sĩ gõ "09ab" vào ô Số điện thoại rồi bấm "Lưu"
- **THEN** dưới ô Số điện thoại hiện "Số điện thoại chỉ gồm chữ số, dấu cách và + - . ( )", và không bệnh nhân nào được thêm

#### Scenario: Họ tên quá dài

- **WHEN** bác sĩ gõ họ tên dài 101 ký tự rồi bấm "Lưu"
- **THEN** dưới ô Họ tên hiện "Họ tên tối đa 100 ký tự.", và không bệnh nhân nào được thêm

### Requirement: Nhập năm sinh hoặc tuổi

Ô "Năm sinh hoặc tuổi" SHALL nhận ba cách nhập: năm sinh bốn chữ số (`1979`); tuổi từ 0 tới 120, có thể kèm "t" hoặc "tuổi" (`45t`, `45 tuổi`, `45`), quy ra năm sinh bằng năm hiện tại trừ tuổi; ngày sinh dạng ngày/tháng/năm (`12/03/1979`, cũng nhận dấu `-` hoặc `.`). Trong lúc gõ, ngay dưới ô SHALL hiện cách app hiểu giá trị đó.

#### Scenario: Nhập tuổi nhanh

- **WHEN** năm hiện tại là 2026, bác sĩ gõ "45t" vào ô Năm sinh hoặc tuổi rồi lưu
- **THEN** dưới ô hiện "Năm sinh 1981 · 45 tuổi" trước khi lưu, và trang chi tiết hiện "45 tuổi (1981)"

#### Scenario: Nhập ngày sinh đầy đủ

- **WHEN** hôm nay là 18/11/2026 và bác sĩ lưu ngày sinh "12/03/1979"
- **THEN** trang chi tiết hiện "47 tuổi (12/03/1979)"

### Requirement: Kiểm năm sinh

Năm sinh MUST nằm trong khoảng từ 1900 tới năm hiện tại; ngày sinh MUST là ngày có thật và không ở tương lai. "Hiện tại" tính theo giờ Việt Nam. Giá trị sai hay không theo cách nhập nào được nhận SHALL bị báo lỗi dưới ô, và không có gì được lưu.

#### Scenario: Năm sinh ở tương lai

- **WHEN** năm hiện tại là 2026 và bác sĩ gõ "2030" rồi bấm "Lưu"
- **THEN** dưới ô hiện "Năm sinh phải từ 1900 tới năm nay.", và không có gì được lưu

#### Scenario: Ngày không có thật

- **WHEN** bác sĩ gõ "31/02/1979" rồi bấm "Lưu"
- **THEN** dưới ô hiện "Ngày sinh không có thật hoặc ở tương lai.", và không có gì được lưu

#### Scenario: Nhập không hiểu được

- **WHEN** bác sĩ gõ "khoảng 40" rồi bấm "Lưu"
- **THEN** dưới ô hiện "Nhập năm sinh (1979), tuổi (45t) hoặc ngày sinh (12/03/1979).", và không có gì được lưu

### Requirement: Cách tính tuổi hiển thị

Tuổi hiển thị SHALL được tính theo ngày giờ Việt Nam: chỉ có năm sinh thì lấy năm hiện tại trừ năm sinh; có ngày sinh thì lấy số năm tròn đã qua. Tuổi bằng 0 SHALL hiện "Dưới 1 tuổi".

#### Scenario: Chưa tới sinh nhật trong năm

- **WHEN** hôm nay là 18/11/2026 và bệnh nhân có ngày sinh "20/12/1979"
- **THEN** trang chi tiết hiện "46 tuổi (20/12/1979)"

#### Scenario: Chưa đầy một tuổi

- **WHEN** năm hiện tại là 2026 và bệnh nhân có năm sinh 2026
- **THEN** danh sách và trang chi tiết hiện "Dưới 1 tuổi"

### Requirement: Gợi ý trùng tên khi thêm

Trên form thêm, khi họ tên đang gõ trùng họ tên một bệnh nhân đã có (so sau khi bỏ dấu, không phân biệt hoa thường và khoảng trắng thừa) và năm sinh không mâu thuẫn (giống nhau, hoặc một bên chưa có), form SHALL hiện "Có phải người này?" cùng họ tên, giới tính, tuổi, quê của người trùng và liên kết mở hồ sơ. Gợi ý MUST NOT chặn việc lưu.

#### Scenario: Trùng tên và năm sinh

- **WHEN** bác sĩ đã có "Nguyễn Văn An" sinh 1979, rồi ở form thêm gõ họ tên "nguyen van an" và năm sinh "1979"
- **THEN** form hiện "Có phải người này?" cùng thẻ "Nguyễn Văn An" có liên kết tới trang chi tiết của người đó

#### Scenario: Khác năm sinh thì không gợi ý

- **WHEN** bác sĩ đã có "Nguyễn Văn An" sinh 1979, rồi ở form thêm gõ "Nguyễn Văn An" và năm sinh "1990"
- **THEN** form không hiện "Có phải người này?"

#### Scenario: Gợi ý không chặn việc thêm

- **WHEN** form đang hiện "Có phải người này?" cho "Nguyễn Văn An" và bác sĩ bấm "Lưu"
- **THEN** một bệnh nhân mới được thêm, và `/patients` có hai dòng "Nguyễn Văn An"

### Requirement: Chi tiết bệnh nhân

Trang `/patients/<id>` SHALL hiện họ tên làm tiêu đề, giới tính, tuổi kèm năm hoặc ngày sinh, quê quán, số điện thoại dưới dạng liên kết gọi điện (`tel:`), mã bệnh nhân, và thẻ "Tóm tắt" giữ nguyên các dòng như lúc nhập. Phần nào chưa có thì không hiện; tóm tắt trống thì thẻ hiện "Chưa có tóm tắt." cùng liên kết "Thêm tóm tắt". Trang SHALL có nút "Sửa" và lối về danh sách.

#### Scenario: Gọi điện từ trang chi tiết

- **WHEN** bệnh nhân có số điện thoại "0912 345 678"
- **THEN** trang chi tiết có liên kết "0912 345 678" trỏ tới `tel:0912345678`

#### Scenario: Chưa có tóm tắt

- **WHEN** bác sĩ mở trang chi tiết của bệnh nhân chỉ có họ tên
- **THEN** thẻ Tóm tắt hiện "Chưa có tóm tắt." cùng liên kết "Thêm tóm tắt" mở trang sửa, và trang không hiện dòng số điện thoại hay mã bệnh nhân

### Requirement: Liên kết trong tóm tắt

Trong tóm tắt, mọi địa chỉ bắt đầu bằng `http://` hoặc `https://` SHALL thành liên kết mở ở thẻ mới. Mọi phần khác MUST hiện đúng như chữ đã nhập, không bao giờ được hiểu thành HTML hay liên kết kiểu khác.

#### Scenario: Link trong tóm tắt

- **WHEN** tóm tắt là "KQ XN: https://lab.example.vn/kq/123 và <b>đậm</b>"
- **THEN** "https://lab.example.vn/kq/123" là liên kết mở ở thẻ mới, và "<b>đậm</b>" hiện nguyên văn dưới dạng chữ

#### Scenario: Không biến địa chỉ lạ thành liên kết

- **WHEN** tóm tắt là "javascript:alert(1)"
- **THEN** tóm tắt không chứa liên kết nào

### Requirement: Sửa thông tin bệnh nhân

Trang `/patients/<id>/edit` SHALL hiện form như lúc thêm, điền sẵn giá trị hiện có (năm sinh dạng `1979`, ngày sinh dạng `12/03/1979`), không có gợi ý trùng tên, và theo cùng quy tắc kiểm. Xoá trắng một ô không bắt buộc SHALL làm thông tin đó thành "chưa có". Lưu thành công SHALL quay về trang chi tiết.

#### Scenario: Sửa và xoá một ô

- **WHEN** bác sĩ mở trang sửa của "Nguyễn Văn An" (quê "Nghệ An"), đổi họ tên thành "Nguyễn Văn Ân", xoá trắng ô Quê quán rồi bấm "Lưu"
- **THEN** trang chi tiết hiện "Nguyễn Văn Ân" và không còn hiện quê quán

### Requirement: Không ghi đè bản sửa ở nơi khác

Nếu bệnh nhân đã được sửa ở nơi khác sau khi form sửa được mở, hệ thống MUST NOT ghi đè. Form SHALL báo "Bệnh nhân vừa được sửa ở thiết bị khác. Tải lại trang để xem bản mới nhất." và giữ nguyên chữ đang nhập.

#### Scenario: Sửa cùng lúc ở hai thiết bị

- **WHEN** bác sĩ mở trang sửa của một bệnh nhân trên hai thiết bị, lưu ở thiết bị thứ nhất, rồi bấm "Lưu" ở thiết bị thứ hai
- **THEN** thiết bị thứ hai hiện "Bệnh nhân vừa được sửa ở thiết bị khác. Tải lại trang để xem bản mới nhất.", chữ trong form vẫn còn, và bản đã lưu ở thiết bị thứ nhất không bị đổi

### Requirement: Không mất chữ khi lưu thất bại

Khi bấm "Lưu" mà không lưu được, form thêm và form sửa MUST giữ nguyên mọi giá trị đang nhập, kể cả chữ gõ thêm trong lúc đang lưu. Không nhận được trả lời vì mạng (kể cả khi máy vẫn báo có mạng) thì form SHALL báo "Không gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Lưu lại khi có mạng." Khi trình duyệt báo đang mất mạng, form SHALL hiện sẵn dòng nhắc "Đang mất mạng. Chữ đã nhập vẫn còn trên trang này."

#### Scenario: Mất mạng khi lưu

- **WHEN** bác sĩ điền họ tên "Nguyễn Văn An" và tóm tắt, mất mạng, rồi bấm "Lưu"
- **THEN** form báo "Không gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Lưu lại khi có mạng.", ô Họ tên vẫn là "Nguyễn Văn An" và tóm tắt vẫn còn

#### Scenario: Mạng hỏng dù máy báo vẫn có mạng

- **WHEN** máy vẫn báo có mạng (Wi-Fi không ra được internet) và yêu cầu lưu không nhận được trả lời
- **THEN** form báo "Không gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Lưu lại khi có mạng." và ô Họ tên vẫn giữ chữ đã nhập

#### Scenario: Lỗi ở một ô không xoá các ô khác

- **WHEN** bác sĩ điền họ tên, quê quán, tóm tắt và số điện thoại sai, rồi bấm "Lưu"
- **THEN** chỉ ô Số điện thoại báo lỗi, và các ô còn lại giữ nguyên giá trị đã nhập

### Requirement: Riêng tư trên màn hình và trong URL

Tiêu đề tab của mọi trang bệnh nhân MUST NOT chứa họ tên hay thông tin nào của bệnh nhân; các trang dùng tiêu đề cố định ("Bệnh nhân", "Thêm bệnh nhân", "Sửa thông tin"). URL MUST chỉ chứa mã định danh ngẫu nhiên của bệnh nhân, không chứa giá trị bác sĩ nhập. Thêm và sửa MUST NOT hiện thông báo nổi (toast) mang dữ liệu bệnh nhân.

#### Scenario: Tiêu đề tab của trang chi tiết

- **WHEN** bác sĩ mở trang chi tiết và trang sửa của "Nguyễn Văn An"
- **THEN** tiêu đề tab của cả hai trang không chứa "Nguyễn Văn An"

#### Scenario: URL không chứa dữ liệu đã nhập

- **WHEN** bác sĩ thêm "Nguyễn Văn An" với quê "Nghệ An" và mã bệnh nhân "BN-10234", rồi sửa thông tin đó
- **THEN** không URL nào đã đi qua chứa họ tên, quê hay mã bệnh nhân đó, ở dạng gốc hay dạng mã hoá URL

### Requirement: Bệnh nhân tách theo bác sĩ

Mọi thao tác đọc, thêm, sửa bệnh nhân SHALL chỉ áp dụng cho bệnh nhân của bác sĩ đang đăng nhập; tài khoản lấy từ phiên, không bao giờ từ dữ liệu trình duyệt gửi lên. Mở `/patients/<id>` hay `/patients/<id>/edit` với id của bác sĩ khác, id không có thật hay id sai định dạng SHALL hiện cùng trang "Không tìm thấy bệnh nhân" kèm lối về danh sách, không phân biệt được ba trường hợp.

#### Scenario: Mở bệnh nhân của bác sĩ khác

- **WHEN** `bs.minh` đăng nhập và mở URL trang chi tiết của một bệnh nhân thuộc `bs.lan`
- **THEN** trang hiện "Không tìm thấy bệnh nhân", và không có thông tin nào của bệnh nhân đó

#### Scenario: Danh sách chỉ có bệnh nhân của mình

- **WHEN** `bs.lan` có "Nguyễn Văn An" và `bs.minh` có "Trần Thị Bình"
- **THEN** `/patients` của `bs.minh` hiện "1 bệnh nhân", chỉ có "Trần Thị Bình"

#### Scenario: Id sai định dạng

- **WHEN** bác sĩ mở `/patients/khong-phai-id`
- **THEN** trang hiện "Không tìm thấy bệnh nhân"

### Requirement: Từ chối lệnh thêm và sửa không hợp lệ

Lệnh sửa mang id bệnh nhân của bác sĩ khác (hoặc không có thật) MUST bị từ chối với mã `NOT_FOUND` và không thay đổi gì. Lệnh thêm hoặc sửa không kèm phiên đăng nhập MUST bị từ chối với `UNAUTHENTICATED`; lệnh do Admin gửi MUST bị từ chối với `FORBIDDEN`.

#### Scenario: Sửa bệnh nhân của bác sĩ khác

- **WHEN** lệnh sửa của `bs.minh` mang id một bệnh nhân của `bs.lan`
- **THEN** lệnh trả về `NOT_FOUND`, và bệnh nhân của `bs.lan` không đổi

#### Scenario: Chưa đăng nhập gửi lệnh thêm bệnh nhân

- **WHEN** lệnh thêm bệnh nhân được gửi không kèm phiên đăng nhập
- **THEN** lệnh trả về `UNAUTHENTICATED` và không có bệnh nhân nào được thêm

#### Scenario: Admin gửi lệnh thêm bệnh nhân

- **WHEN** Admin đang đăng nhập gửi lệnh thêm bệnh nhân
- **THEN** lệnh trả về `FORBIDDEN` và không có bệnh nhân nào được thêm

### Requirement: Form bệnh nhân dùng tốt trên điện thoại

Form thêm SHALL đặt con trỏ sẵn ở ô Họ tên; nhấn Enter trong ô một dòng SHALL lưu form. Ô Số điện thoại SHALL có `type="tel"`. Mọi ô SHALL có `autocomplete="off"` để trình duyệt không tự điền thông tin của chính bác sĩ, và chữ cỡ ít nhất 16 px. Nút "Lưu" SHALL nằm trong tầm ngón cái, không bị thanh điều hướng che; lúc đang lưu, nút bị vô hiệu và hiện "Đang lưu…".

#### Scenario: Thuộc tính ô của form

- **WHEN** bác sĩ mở `/patients/new`
- **THEN** ô Họ tên đang có con trỏ, ô Số điện thoại có `type="tel"`, và mọi ô có `autocomplete="off"`

#### Scenario: Enter để lưu nhanh

- **WHEN** bác sĩ mở `/patients/new`, gõ "Nguyễn Văn An" rồi nhấn Enter
- **THEN** bệnh nhân được thêm và trình duyệt chuyển tới trang chi tiết
