# Proposal

## Why

Danh sách bệnh nhân đã có, nhưng chưa lọc được. Bác sĩ có vài trăm bệnh nhân thì phải cuộn tìm, chậm hơn lật sổ. idea.md đặt mục tiêu **tìm một bệnh nhân trong ≤ 5 giây** (§3, §6.2; G2). Tìm kiếm là lý do thứ hai khiến bác sĩ bỏ sổ giấy (P1), sau việc ghi nhanh.

Change thứ 3/5 của module bệnh nhân. Code nằm ở module **`search`** (`src/modules/search`) và dùng dữ liệu của module `patients`. Đáp ứng idea.md:

- D11, §10.2: tìm bằng chữ và bằng giọng nói.
- §10.2, các yêu cầu tìm:
  - ô tìm luôn ở trên cùng màn hình Bệnh nhân, kết quả hiện ngay khi gõ;
  - không phân biệt dấu và hoa thường;
  - tìm theo tên, quê, số điện thoại, mã bệnh nhân;
  - tìm trong tóm tắt và ghi chú;
  - tìm gần đúng;
  - kết quả hiện tên, tuổi, giới, quê.
- §10.2, phần giọng nói: dùng nhận dạng có sẵn của trình duyệt; trình duyệt không hỗ trợ thì ẩn nút micro.
- §12.2: không thấy bệnh nhân thì tạo nhanh với tên vừa tìm.
- S3, S7: chỉ tìm trong dữ liệu của bác sĩ đó; danh sách kết quả không lộ nội dung nhạy cảm.

## What Changes

- **Ô tìm kiếm** ở đầu trang `/patients`, ngay dưới tiêu đề:
  - gợi ý trong ô: "Tìm tên, quê, SĐT, mã BN, ghi chú…";
  - nút xoá (×) và nút micro, mỗi nút vùng chạm 44 px;
  - bàn phím điện thoại hiện phím "Tìm".
- **Lọc tức thì theo tên và quê**, ngay trên máy, theo từng phím gõ, không chờ mạng:
  - không phân biệt dấu và hoa thường: "nguyen van an" ra "Nguyễn Văn An";
  - các từ gõ theo thứ tự nào cũng được: "an nghe" ra "Nguyễn Văn An, Nghệ An".
- **Tìm sâu trên server** sau khi ngừng gõ khoảng 0,3 giây, khi từ khoá có ít nhất 2 ký tự, trong:
  - số điện thoại (so chữ số, bỏ qua dấu cách);
  - mã bệnh nhân;
  - tóm tắt;
  - ghi chú.

  Kết quả gộp vào danh sách, kèm nhãn nhỏ cho biết khớp ở đâu: "Khớp số điện thoại", "Khớp mã bệnh nhân", "Khớp trong tóm tắt", "Khớp trong ghi chú". Danh sách **không bao giờ** hiện đoạn nội dung đã khớp (S7).

- **Tìm gần đúng**: không có kết quả khớp thì hiện "Có phải bạn tìm…?" với tối đa 5 bệnh nhân có **họ tên** gần giống (trigram), ví dụ "Nguyn Văn An" vẫn ra "Nguyễn Văn An". Sai dấu như "Hưng" và "Hùng" thì đã khớp ngay vì so không dấu.
- **Không thấy ai**: hiện "Không thấy bệnh nhân nào khớp", cùng nút "Thêm bệnh nhân" mở form thêm với ô Họ tên điền sẵn chữ vừa tìm (§12.2). Chữ này truyền qua bộ nhớ của tab trình duyệt, không qua URL.
- **Tìm bằng giọng nói**:
  - Bấm micro, đọc tên, chữ hiện dần vào ô tìm.
  - Đang nghe thì nút micro đổi trạng thái, kèm dòng "Đang nghe… nói tên bệnh nhân". Bấm lần nữa để dừng.
  - Trình duyệt không hỗ trợ thì không có nút micro.
  - Bị từ chối quyền micro hay không nghe rõ thì báo một dòng ngắn, ô tìm vẫn gõ được.
- **Mất mạng**: lọc theo tên và quê vẫn chạy. Phần tìm sâu báo "Chưa tìm được trong ghi chú vì mất mạng."
- **Riêng tư**: từ khoá không bao giờ lên URL hay tiêu đề tab, không bị ghi log, không lưu lại khi rời trang.

## Capabilities

### New Capabilities

- `patient-search`: tìm bệnh nhân trên trang danh sách. Gồm lọc tức thì theo tên và quê, tìm sâu (số điện thoại, mã bệnh nhân, tóm tắt, ghi chú), tìm gần đúng, không thấy kết quả, giọng nói, mất mạng, riêng tư, và tách dữ liệu theo bác sĩ.

### Modified Capabilities

(Không có.) `patient-records` giữ nguyên requirement. Danh sách vẫn chỉ hiện tên, tuổi, giới, quê. Vì kết quả tìm sâu chỉ trả về id, trang `/patients` vẫn không chứa số điện thoại, mã bệnh nhân hay tóm tắt.

## Impact

- **Thiết kế**: mockup local `mockup/index.html` cho trang danh sách có ô tìm kiếm, ở mọi trạng thái. Có sáng/tối, điện thoại/máy tính. Người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.
- **Module `search`** (mới có code):
  - `match.ts`: lọc tức thì, thuần, chạy cả client và server;
  - `schemas.ts`, `constants.ts`, `types.ts`;
  - `server/queries.ts`: tìm trong `patients` và `notes` của tài khoản;
  - `similarity.ts`: tìm gần đúng theo trigram trên họ tên (cùng thước đo với `pg_trgm`);
  - `deep-search-client.ts`: gọi Route Handler `POST /api/patients/search` (`src/app/api/patients/search/route.ts`, chỉ bác sĩ, cùng origin, JSON). Không dùng Server Action, vì Next chạy Server Action lần lượt từng cái: một lần tìm bị treo sẽ chặn mọi lần sau, mà Server Action thì không huỷ được;
  - `hooks/use-speech-search.ts`;
  - `components/patient-search.tsx`, `search-box.tsx`.
- **Module `patients`**:
  - trang `/patients` dùng `PatientSearch` bọc quanh danh sách;
  - `PatientList` nhận thêm nhãn "khớp ở đâu" cho từng dòng;
  - form thêm đọc họ tên điền sẵn từ `sessionStorage`.
- **Route**: `src/app/(doctor)/patients/page.tsx`; thêm Route Handler `src/app/api/patients/search/route.ts`.
- **Tầng dùng chung**: dùng lại `normalizeVi`, `useDebouncedValue`, `useOnlineStatus`.
- **Database**:
  - Dùng cột `search_text` và index `pg_trgm` có sẵn của `patients` và `notes`.
  - Tóm tắt được chuẩn hoá ngay trên server mỗi lần tìm, vì vài trăm dòng là rất nhẹ. Không thêm cột.
  - **Không đổi schema, không migration.** Không ảnh hưởng sao lưu.
- **Thư viện và dịch vụ**:
  - Không thêm thư viện.
  - Giọng nói dùng Web Speech API của trình duyệt. Âm thanh do trình duyệt gửi tới dịch vụ của Google hoặc Apple để chuyển thành chữ. idea.md §10.2 đã chấp nhận rủi ro này, vì chỉ là tên bệnh nhân cần tìm.
- **Lệch so với teckstack.md §4.7**: không gửi `search_text` xuống trình duyệt, vì cột đó có số điện thoại và mã bệnh nhân, mà spec `patient-records` cấm trang danh sách chứa hai thứ này. Thay vào đó:
  - trình duyệt chỉ lọc tên và quê;
  - server tìm phần còn lại.

  Sửa `teckstack.md` §4.7 cho khớp.

- **Bất biến**:
  - DAL lọc theo `auth.account.id`. Action dựng bằng `createAction`.
  - Không log từ khoá. Từ khoá không lên URL hay tiêu đề.
  - Danh sách không hiện tóm tắt hay ghi chú (S7).

## Ngoài phạm vi

- **Giữ từ khoá khi quay lại từ trang chi tiết**: chưa làm. Bấm Back thì ô tìm trống. Nếu dùng thử thấy cần thì làm sau; muốn giữ thì phải lưu tên bệnh nhân trên máy.
- **Tô đậm phần khớp trong tên**: chưa làm.
- **Phân trang, cuộn ảo**: vài trăm dòng (A1) vẫn lọc tức thì được. Đo lại khi có bác sĩ trên 1000 bệnh nhân.
- **Tìm việc cần làm**: module `todos` chưa có.
- **Đọc để ghi chú (dictation)**: Could, chưa làm.
