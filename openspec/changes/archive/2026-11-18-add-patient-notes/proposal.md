# Proposal

## Why

Bác sĩ đã ghi được bệnh nhân nhưng chưa ghi được **từng lần gặp**: "15/11 HA 150/90, tăng liều amlodipin". Đây là việc làm nhiều nhất khi khám và là thước đo chính của app: ghi một ý trong **≤ 10 giây** (idea.md §3, §6.2). Sổ giấy ghi nhanh vì không phải bấm "Lưu" và không sợ mất. App phải giữ được hai điều đó, kể cả khi Wi-Fi trong toà nhà chập chờn (§4.3).

Change thứ 2/5 của module **`patients`** (`src/modules/patients`), sau `add-patient-records`. Đáp ứng idea.md:

- D6: tóm tắt tách với **ghi chú theo thời gian**.
- §10.1: mới nhất ở trên, mỗi ghi chú tự gắn ngày giờ, sửa và xoá được.
- BR4: ngày giờ do hệ thống gán khi tạo; sửa không đổi ngày tạo nhưng lưu thời điểm sửa gần nhất.
- N2: lưu tự động, không hộp thoại xác nhận khi lưu.
- §10.6, D10: nháp tự động trên máy, mất mạng hay đóng tab vẫn còn, có mạng lại thì tự gửi, có báo "Đã lưu" / "Đang chờ mạng".
- S3, S7: ghi chú chỉ hiện ở trang chi tiết, chỉ của bác sĩ sở hữu.
- teckstack.md §4.9: nháp bằng IndexedDB qua `idb-keyval`, gửi lại khi có sự kiện `online`.

## What Changes

- **Phần "Ghi chú"** trên trang chi tiết bệnh nhân, ngay dưới thẻ Tóm tắt:
  - mới nhất ở trên;
  - mỗi ghi chú có ngày giờ tạo (`15/11/2026 09:12`) và nội dung giữ nguyên các dòng; link `http(s)` bấm được, như tóm tắt;
  - ghi chú đã sửa có thêm "Đã sửa 16/11/2026 10:05";
  - chưa có ghi chú thì hiện "Chưa có ghi chú".
- **Nút "Ghi chú mới"** nổi ở góc dưới, trong tầm ngón cái. Bấm là mở ô soạn ở đầu phần Ghi chú, con trỏ đặt sẵn, bàn phím bật lên.
- **Tự lưu, không có nút "Lưu" bắt buộc**:
  - Gõ xong ngừng tay khoảng một giây là ghi chú được gửi lên server. Gõ tiếp thì bản trên server được cập nhật.
  - Ô soạn có chỉ báo nhỏ: "Đang lưu…", "Đã lưu", "Đang chờ mạng".
  - Nút "Xong" chỉ để đóng ô soạn; không bấm cũng không mất gì.
  - Ghi chú trống không được tạo.
- **Không mất chữ đang gõ**:
  - Mỗi lần gõ, chữ được ghi ngay vào bộ nhớ trình duyệt (IndexedDB) trước khi gửi.
  - Mất mạng thì báo "Đang chờ mạng" và tự gửi lại khi có mạng.
  - Đóng tab, tải lại trang hay hết pin giữa chừng: mở lại bệnh nhân đó, ghi chú chưa gửi hiện lại trong ô soạn, kèm dòng "Khôi phục ghi chú chưa gửi", rồi tự gửi.
  - Nháp chỉ bị xoá khỏi máy sau khi server xác nhận đã lưu đúng nội dung đó.
- **Sửa ghi chú**: nút "Sửa" trên mỗi ghi chú mở ô soạn tại chỗ, cũng tự lưu. Ngày tạo giữ nguyên, thời điểm sửa được ghi lại (BR4).
- **Xoá ghi chú**: trong ô soạn có "Xoá ghi chú". Thao tác này không hoàn tác được, nên hỏi xác nhận bằng `ConfirmDialog` (bất biến N2 cho phép).
- **Tách theo bác sĩ**:
  - Lệnh lưu hay xoá ghi chú mang id bệnh nhân hoặc id ghi chú của bác sĩ khác bị từ chối, không đổi gì.
  - Nháp trên máy gắn với tài khoản: đăng nhập tài khoản khác trên cùng trình duyệt không thấy nháp của tài khoản trước.

## Capabilities

### New Capabilities

- `patient-notes`: ghi chú theo thời gian của một bệnh nhân. Gồm xem, thêm, tự lưu, nháp trên máy và gửi lại khi có mạng, sửa, xoá, giới hạn độ dài, và tách dữ liệu theo bác sĩ.

### Modified Capabilities

(Không có.) `patient-records` giữ nguyên requirement: trang chi tiết vẫn như cũ, chỉ có thêm phần Ghi chú bên dưới. Danh sách bệnh nhân vẫn không hiện ghi chú, đúng requirement "Danh sách không lộ thông tin nhạy cảm" đã có.

## Impact

- **Thiết kế**: mockup local `mockup/index.html` cho trang chi tiết có phần Ghi chú, ở mọi trạng thái (soạn, đang lưu, đã lưu, chờ mạng, khôi phục nháp, sửa, xác nhận xoá, quá dài, trống), sáng/tối, điện thoại/máy tính. Người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.
- **Module `patients`**:
  - `schemas.ts`: `saveNoteSchema`, `deleteNoteSchema`;
  - `server/queries.ts`: `listNotes`;
  - `server/mutations.ts`: `saveNote` (thêm-hoặc-sửa theo id do trình duyệt tạo), `deleteNote`;
  - `server/actions.ts`: `saveNoteAction`, `deleteNoteAction` (`createAction`, `access: "doctor"`);
  - `note-drafts.ts`: kho nháp IndexedDB, kiểm dữ liệu đọc ra bằng Zod;
  - `hooks/use-note-autosave.ts`;
  - `components/`: `patient-notes.tsx`, `note-composer.tsx`, `note-item.tsx`.
- **Route**: `src/app/(doctor)/patients/[id]/page.tsx` đọc thêm ghi chú và hiện phần Ghi chú. `[id]/loading.tsx` có thêm khung chờ cho ghi chú.
- **Database**: bảng `notes` đã có từ migration `0001`. Cột `search_text` của ghi chú được tính lại mỗi lần lưu, để change tìm kiếm dùng được ngay. **Không đổi schema, không migration.**
- **Sao lưu**: thêm `notes` (`content`, `created_at`, `updated_at`) vào danh sách cột phải có trong README module `backup`.
- **Thư viện**: `idb-keyval@6.3.0`, đã chọn trong teckstack.md §4.9. Phát hành 08/07/2026, đủ tuổi theo chính sách của pnpm. Không có install script. Không thêm dịch vụ ngoài.
- **Bất biến**:
  - DAL lọc theo `auth.account.id` từ phiên. Action dựng bằng `createAction` với `access: "doctor"`.
  - Không log nội dung ghi chú. Ghi chú không xuất hiện ở URL, tiêu đề tab, toast hay danh sách.
  - Lưu tự động, không hỏi xác nhận khi lưu (N2). Chỉ xoá mới hỏi.
  - Nháp nằm trên máy của bác sĩ. Đó là dữ liệu bệnh nhân ở dạng chưa mã hoá trong trình duyệt. Rủi ro này đã được chấp nhận ở D13 (bác sĩ tự bảo vệ thiết bị) và đúng quyết định ở teckstack.md §4.9.

## Ngoài phạm vi

- **Tìm trong nội dung ghi chú**: change 3 (`add-patient-search`). Change này chỉ giữ `search_text` của ghi chú luôn đúng.
- **Xem ghi chú khi hoàn toàn offline** (mở trang khi không có mạng): Phase 2 theo idea.md §10.6 và teckstack.md §4.9. Change này chỉ giữ chữ đang gõ trên trang đã mở.
- **Đọc để ghi chú (dictation)**: Could, chưa làm (§11). Bàn phím điện thoại đã có micro.
- **Đính kèm ảnh/file vào ghi chú**: Could, chưa làm.
- **Đưa bệnh nhân vừa có ghi chú lên đầu danh sách**: danh sách vẫn xếp theo lần thêm/sửa thông tin bệnh nhân. Muốn đổi thì phải tách "lần gặp gần nhất" khỏi `updated_at` (đang dùng để chống ghi đè); để change tìm kiếm cân nhắc.
- **Service worker, cài PWA**: change riêng.
