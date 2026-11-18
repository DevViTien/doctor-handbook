# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Bảng `notes`** (`src/server/db/schema/patients.ts`, migration `0001`) có các cột:
  - `id` uuid;
  - `patient_id`;
  - `account_id`, chép lại chủ sở hữu của bệnh nhân;
  - `content`, `search_text`, `created_at`, `updated_at`.

  Khoá ngoại ghép `(patient_id, account_id) → patients (id, account_id)` bảo đảm ở tầng database rằng ghi chú luôn cùng chủ với bệnh nhân. Bảng có index `(patient_id, created_at desc)` và RLS.

- **Trang chi tiết** `src/app/(doctor)/patients/[id]/page.tsx`: khối đầu và thẻ Tóm tắt (change `add-patient-records`).
- **Dùng chung**:
  - `splitLinks` (`src/lib/text/linkify.ts`), `formatDateTime` (`dd/MM/yyyy HH:mm`, giờ Việt Nam), `buildSearchText`;
  - `ConfirmDialog`, `useOnlineStatus`, `createAction` (gọi bằng object).
- **teckstack.md §4.9** đã chốt nháp bằng IndexedDB qua `idb-keyval`, gửi lại khi có sự kiện `online`.

## Goals / Non-Goals

**Goals:**

- Ghi một ý trong ≤ 10 giây: bấm "Ghi chú mới", gõ, xong. Không có nút "Lưu" bắt buộc.
- Không bao giờ mất chữ đã gõ:
  - chữ luôn nằm trên máy trước khi gửi;
  - nháp chỉ được xoá khi server đã có đúng nội dung đó;
  - gửi lại nhiều lần không bao giờ tạo bản trùng.
- Lần gửi cũ không bao giờ đè lên nội dung mới hơn: gõ nhanh, mạng chậm, hai tab, trang bệnh nhân và bộ gửi nền chạy cùng lúc.
- Mọi đọc và ghi lọc theo `auth.account.id`.

**Non-Goals:** xem ghi chú khi hoàn toàn offline, tìm trong ghi chú, đính kèm, đọc để ghi (xem proposal, "Ngoài phạm vi").

## Decisions

### 1. Cấu trúc

```
src/modules/patients/
├── constants.ts               + NOTE_LIMITS (5000), NOTE_AUTOSAVE_DELAY_MS (1000), NOTE_MESSAGES
├── schemas.ts                 + saveNoteSchema, deleteNoteSchema
├── types.ts                   + PatientNote { id, content, createdAt, updatedAt } (ISO)
├── note-drafts.ts             kho nháp IndexedDB (idb-keyval) + Zod khi đọc
├── note-sync.ts               sendNoteDraft(key): khoá theo ghi chú, gửi bản mới nhất, xoá nháp khi khớp
├── hooks/use-note-autosave.ts trạng thái một ô soạn (idle/saving/saved/offline/error)
├── server/queries.ts          + listNotes(auth, patientId)
├── server/mutations.ts        + saveNote(auth, input), deleteNote(auth, input)
├── server/actions.ts          + saveNoteAction, deleteNoteAction (createAction, "doctor")
└── components/
    ├── patient-notes.tsx      "use client": phần Ghi chú, nút "Ghi chú mới", khôi phục nháp
    ├── note-composer.tsx      ô soạn: textarea tự cao, trạng thái, Xong, Xoá ghi chú
    ├── note-item.tsx          một ghi chú: ngày giờ, "Đã sửa …", nội dung (splitLinks), "Sửa"
    └── note-draft-sync.tsx    "use client", không hiện gì: gửi nháp còn tồn khi vào trang và khi có mạng
src/app/(doctor)/layout.tsx    + <NoteDraftSync accountId=… />
src/app/(doctor)/patients/[id]/page.tsx  + listNotes, <PatientNotes …/>
```

Chiều phụ thuộc:

- `NoteDraftSync` là component của module, gắn ở layout `(doctor)` trong `src/app`. Tầng `app` được phép import module.
- Không gắn vào `DoctorShell`, vì `src/components/layout` là tầng dùng chung, không được import module.
- `note-drafts.ts` và `note-sync.ts` chỉ chạy phía client. Chúng import server action qua `"use server"`, giống form bệnh nhân.

### 2. Id do trình duyệt tạo, lưu kiểu "thêm hoặc sửa"

Bấm "Ghi chú mới" thì trình duyệt tạo `noteId = crypto.randomUUID()` ngay. Mọi lần tự lưu sau đó đều gửi `{ patientId, noteId, content, editing }` tới `saveNoteAction`. Server chạy một trong hai câu.

**Ghi chú mới** (`editing = false`): thêm-hoặc-sửa.

```sql
INSERT INTO notes (id, patient_id, account_id, content, search_text)
SELECT $noteId, p.id, p.account_id, $content, $searchText
FROM patients p
WHERE p.id = $patientId AND p.account_id = $accountId AND p.deleted_at IS NULL
ON CONFLICT (id) DO UPDATE
  SET content = excluded.content, search_text = excluded.search_text
  WHERE notes.account_id = $accountId AND notes.patient_id = $patientId
RETURNING id, created_at, updated_at
```

**Sửa ghi chú đã có** (`editing = true`): chỉ một câu `UPDATE … SET …, updated_at = now() WHERE id AND account_id AND patient_id AND` bệnh nhân còn thuộc bác sĩ và không ở thùng rác. Câu này **không bao giờ tạo lại** một ghi chú đã bị xoá ở thiết bị khác: kết quả là `NOT_FOUND`, và chữ vẫn còn trên máy.

Nhờ hai câu này:

- **Gửi lại bao nhiêu lần cũng chỉ có một ghi chú.** Lần đầu thêm, các lần sau sửa. Mất trả lời giữa đường, gửi lại cũng không tạo bản trùng.
- **Không ghi được vào bệnh nhân của người khác**:
  - `SELECT … FROM patients` không ra dòng nào, nên không có gì được thêm.
  - Khoá ngoại ghép ở tầng database cũng chặn thêm một lớp.
- **Không đè được ghi chú của người khác**: nếu `noteId` trùng một ghi chú của tài khoản khác, mệnh đề `WHERE` của `DO UPDATE` sai, nên không có dòng nào đổi.
- **Cả hai trường hợp trên** trả về 0 dòng, và action báo `NOT_FOUND`.
- **`editing`** cho biết ô soạn mở từ nút "Sửa" (ghi chú đã có từ trước):
  - Lần thêm đầu gán `created_at = updated_at = now()`. Các lần gửi lại của ghi chú mới **giữ nguyên** `updated_at`, nên ghi chú mới không hiện "Đã sửa", còn ghi chú đã sửa ở tab khác cũng không mất dấu "Đã sửa".
  - Sửa thì đặt `updated_at = now()`. Giao diện hiện "Đã sửa" khi `updated_at > created_at`.
  - Cờ này do trình duyệt gửi, nhưng chỉ đổi cách hiện ghi chú của chính bác sĩ đó. Nó không mở được quyền gì.
- **`created_at`** do database gán ở lần thêm đầu tiên (BR4) và không bao giờ đổi.

Các phương án đã cân nhắc:

- **Server tạo id ở lần lưu đầu, rồi trình duyệt dùng id đó**: nếu trả lời của lần đầu bị mất, lần gửi lại sẽ tạo ghi chú thứ hai.
- **Thêm cột `edited_at`**: cần migration và phải thêm vào sao lưu. Hai cột sẵn có, cộng cờ `editing`, đã đủ cho BR4.
- **Hiện "Đã sửa" khi `updated_at` lệch `created_at` quá N phút**: ngưỡng tuỳ tiện, và sai với ghi chú gõ lâu.

### 3. Nháp trên máy (`note-drafts.ts`)

**Kho**: `createStore("doctor-handbook", "note-drafts")` của `idb-keyval`.

- Khoá: `${accountId}/${noteId}`.
- Giá trị: `{ v: 1, accountId, patientId, noteId, editing, content, savedAt }`.
- Đọc ra luôn qua `noteDraftSchema.safeParse`. Bản không hợp lệ (định dạng cũ, hỏng) bị bỏ, không làm vỡ trang.

**Ghi**: mỗi lần `onChange`, ô soạn ghi nháp ngay, không đợi. Ghi IndexedDB nhanh hơn một khung hình, và nhờ vậy đóng tab sau một phím gõ cũng không mất chữ.

**Gắn với tài khoản**:

- `accountId` lấy từ phiên ở server rồi truyền xuống component. Đây là id của chính người đang đăng nhập; server không dùng nó để cấp quyền.
- Tài khoản khác chỉ đọc khoá có tiền tố của mình, nên không thấy nháp của người khác.
- Đăng xuất **không** xoá nháp chưa gửi. Xoá là mất chữ mà bác sĩ tin đã ghi. Đăng nhập lại đúng tài khoản đó thì nháp được gửi tiếp.

Các phương án đã cân nhắc:

- **`localStorage`**: dung lượng nhỏ, iOS hay xoá, và chỉ đọc đồng bộ (teckstack.md §4.9).
- **Tự viết lớp bọc IndexedDB**: `idb-keyval` (khoảng 600 byte sau nén) đã được chốt và đủ dùng.

### 4. Gửi nháp không bao giờ đè bản mới hơn (`note-sync.ts`)

`sendNoteDraft(key)` là đường **duy nhất** gửi một nháp lên server. Ô soạn, `NoteDraftSync` và lần thử lại khi có mạng đều gọi hàm này.

1. **Khoá theo ghi chú**: `navigator.locks.request("note-draft:" + key, …)`. Web Locks có trên Chrome và trên Safari từ 15.4, và khoá được cả giữa các tab. Trình duyệt không có Web Locks thì dùng một hàng đợi promise trong tab. Vì vậy mỗi ghi chú chỉ có một lần gửi tại một thời điểm.
2. **Bên trong khoá**, đọc nháp **mới nhất** từ IndexedDB:
   - không còn nháp: gửi bản ô soạn đang giữ trong bộ nhớ, nếu có (máy chặn IndexedDB, đầy bộ nhớ, ghi nháp thất bại). Nhờ vậy trang đang mở vẫn tự lưu được, chỉ mất phần "đóng tab vẫn còn";
   - nội dung chỉ có khoảng trắng: không gửi, xem mục 6;
   - quá 5000 ký tự: không gửi, trả `too-long`.
3. Gọi `saveNoteAction`.
   - **Lời gọi ném lỗi** (mạng): trả `offline`, nháp giữ nguyên.
   - **Chưa trả lời sau 15 giây**: ô soạn chuyển sang "Đang chờ mạng", nhưng **vẫn giữ khoá** tới khi lời gọi kết thúc. Nhả khoá sớm sẽ cho bản cũ này tới server sau một lần gửi mới hơn.
   - **`ok`**: đọc lại nháp. Nếu nội dung vẫn đúng bằng nội dung vừa gửi thì xoá nháp. Nếu bác sĩ đã gõ thêm trong lúc gửi thì giữ nháp và gửi tiếp vòng nữa.
   - **`NOT_FOUND`**: bệnh nhân hoặc ghi chú không còn thuộc bác sĩ này. Giữ nháp, trả lỗi để ô soạn báo. Không bao giờ âm thầm xoá chữ.

Vì luôn gửi bản mới nhất bên trong khoá, một lần gửi cũ không thể tới server sau một lần gửi mới hơn của cùng ghi chú.

**Hook `useNoteAutosave`** quản lý trạng thái của một ô soạn:

| Lúc nào                                                    | Trạng thái                             |
| ---------------------------------------------------------- | -------------------------------------- |
| Chưa gõ gì                                                 | `idle`, hiện "Tự lưu khi bạn ngừng gõ" |
| Vừa gõ: ghi nháp ngay, hẹn 1000 ms rồi gọi `sendNoteDraft` | —                                      |
| Đang gửi                                                   | `saving`, "Đang lưu…"                  |
| Server xác nhận đúng nội dung đang hiện                    | `saved`, "Đã lưu"                      |
| Mất mạng                                                   | `offline`, "Đang chờ mạng"             |
| Server từ chối                                             | `error`, kèm thông báo                 |

Khi `offline`, hoặc khi server báo lỗi tạm thời (`INTERNAL`), hook thử lại lúc có sự kiện `online`, và cứ 15 giây một lần đề phòng trình duyệt không báo. "Đã lưu" chỉ hiện khi server xác nhận **đúng** chữ đang hiện.

Bấm "Xong" khi chữ chưa lên server thì ghi chú vẫn hiện trong danh sách với một nhãn:

- "Đang chờ mạng": sẽ tự gửi;
- "Chưa lưu được": server đã từ chối (quá dài, không tìm thấy), không tự gửi được.

Mở lại ghi chú đó thì ô soạn tiếp tục gửi; đóng lại mà không gõ gì thì nhãn vẫn còn.

**`NoteDraftSync`** (gắn ở layout của bác sĩ) gọi `sendNoteDraft` cho mọi nháp của tài khoản trong ba lúc:

- khi vào bất kỳ trang bác sĩ nào, kể cả điều hướng phía client (theo dõi `usePathname`, vì layout không mount lại);
- khi có sự kiện `online`;
- khi app quay lại màn hình trước (`visibilitychange`).

Nhờ vậy một ghi chú gõ lúc mất mạng vẫn tới server dù bác sĩ đã sang trang khác. Nháp đang mở trong ô soạn cũng có thể được bộ gửi nền gửi đi; khoá ở bước 1 bảo đảm hai bên không giẫm lên nhau.

### 5. Khôi phục nháp trên trang bệnh nhân

**Khi trang mở**, và chỉ một lần, `PatientNotes` đọc các nháp có `accountId` và `patientId` khớp. Làm mới trang không mở lại các ô soạn bác sĩ đã đóng khi đang chờ mạng.

- Nháp của ghi chú mới: mở một ô soạn ở đầu danh sách.
- Nháp của ghi chú đang sửa: mở ô soạn tại ghi chú đó, chứa chữ của nháp.
- Nháp sửa của một ghi chú không còn trên trang (đã bị xoá ở nơi khác): mở ở đầu danh sách, để chữ không bị giấu.
- Mọi trường hợp đều có dòng "Khôi phục ghi chú chưa gửi", và tự gửi ngay.

**Vị trí của ô soạn** (đầu phần Ghi chú, hay tại chỗ ghi chú) được chốt lúc mở. Đổi chỗ sau đó sẽ làm React gắn lại ô soạn: mất focus, đóng bàn phím, và hiện lại chữ cũ.

**Sau khi lưu thành công**, ô soạn cập nhật ghi chú trong danh sách của trang từ kết quả trả về: id, ngày tạo, ngày sửa. Không gọi `revalidatePath` ở mỗi lần tự lưu, vì sẽ bắt server render lại trang mỗi giây.

Trang có `staleTimes.dynamic = 0` theo mặc định của Next 16, nên điều hướng quay lại luôn lấy dữ liệu mới. Xoá ghi chú cũng chỉ cập nhật danh sách tại chỗ.

### 6. Trống, quá dài, đóng ô soạn

- **Nội dung trống**, sau khi cắt khoảng trắng, không bao giờ được gửi.
  - Ghi chú mới mà trống, bấm "Xong": đóng ô soạn và bỏ nháp.
  - Ghi chú đã lưu bị xoá hết chữ, bấm "Xong": server vẫn giữ nội dung cũ, ghi chú hiện lại như trước, nháp bị bỏ.
  - Muốn bỏ hẳn một ghi chú thì dùng "Xoá ghi chú". Không lặng lẽ xoá chỉ vì ô trống.
- **Quá 5000 ký tự**:
  - Ô soạn báo "Ghi chú tối đa 5000 ký tự." ngay, kể cả khi đang offline. Từ 4500 ký tự trở lên, ô soạn hiện bộ đếm "4.620/5.000"; quá giới hạn thì bộ đếm chuyển màu `--destructive`. Kiểm này chạy phía client; server vẫn kiểm lại bằng `saveNoteSchema`.
  - Không gửi gì, nhưng nháp vẫn được ghi.
  - Không đặt `maxLength`, để đoạn dán quá dài không bị cắt âm thầm (bài học từ `add-patient-records`).
- **"Xong"** đóng ô soạn. Nếu còn nháp chưa gửi, việc gửi vẫn tiếp tục qua `sendNoteDraft` và `NoteDraftSync`. Ghi chú hiện trong danh sách với chữ mới nhất, kèm nhãn nhỏ "Đang chờ mạng" cho tới khi lưu được.

### 7. Xoá

- "Xoá ghi chú" chỉ có ở ô soạn của ghi chú đã lưu.
- Bấm nút mở `ConfirmDialog` có tiêu đề "Xoá ghi chú này?", lời giải thích "Ghi chú sẽ bị xoá vĩnh viễn, không khôi phục được.", và hai nút "Xoá ghi chú" / "Không xoá".
- Server chạy `DELETE FROM notes WHERE id = $noteId AND patient_id = $patientId AND account_id = $accountId RETURNING id`. Không có dòng nào thì báo `NOT_FOUND`.
- Xoá thành công thì xoá nháp, bên trong khoá của ghi chú đó.
- Lỗi (mất mạng, `NOT_FOUND`) hiện ngay trong hộp thoại, theo kiểu của `ConfirmDialog`.

### 8. Hiện ghi chú

- **Đầu mỗi ghi chú**: `formatDateTime(createdAt)` in đậm, không xuống dòng. Nếu `updatedAt > createdAt` thì có thêm một dòng riêng ngay dưới: "Đã sửa `formatDateTime(updatedAt)`", chữ nhỏ màu `--muted-foreground`. Để chung một dòng thì ở 390 px ngày giờ bị gãy.
- **Ghi chú chưa lên server** (ô soạn đã đóng khi đang chờ mạng): chưa có ngày giờ của server, nên hiện "Vừa ghi" cùng nhãn "Đang chờ mạng" (`--warning` trên `--warning-bg`, có icon) tới khi lưu được.
- **Nội dung**: `whitespace-pre-wrap break-words`, link bằng `splitLinks` (`target="_blank" rel="noopener noreferrer"`), như thẻ Tóm tắt.
- **Nút "Sửa"**: nút chữ 44 px ở góc phải đầu ghi chú, `aria-label="Sửa ghi chú lúc 15/11/2026 09:12"` để trình đọc màn hình phân biệt các nút.
- **Danh sách**: phần tử `<ol>`, mới nhất ở trên, thứ tự `created_at desc, id desc`. Tải mọi ghi chú của một bệnh nhân. Vài chục tới vài trăm ghi chú thì vẫn nhẹ.

### 9. Lỗi

| Tình huống                                | Xử lý                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Quá dài                                   | `VALIDATION_FAILED`, hiện ở ô soạn, giữ nháp                                                           |
| Bệnh nhân hoặc ghi chú không thuộc bác sĩ | `NOT_FOUND`: "Không lưu được: bệnh nhân hoặc ghi chú không còn trong sổ." Giữ nháp                     |
| Mất mạng                                  | `offline`, "Đang chờ mạng", tự gửi lại                                                                 |
| Chưa đăng nhập / Admin                    | `UNAUTHENTICATED` / `FORBIDDEN` từ `createAction`                                                      |
| Phiên hết hạn trong lúc soạn              | `UNAUTHENTICATED`: "Phiên đăng nhập không còn hiệu lực…". Nháp còn trên máy, đăng nhập lại là gửi tiếp |

Không log nội dung ghi chú: `createAction` chỉ log tên action và mã lỗi.

### 10. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-patient-notes/mockup/index.html`. Đây là file local, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng, gồm các điểm nêu trong mockup: tự lưu không có nút "Lưu", nháp trên máy gửi lại từ mọi trang, "Đã sửa" chỉ khi sửa ghi chú cũ, chỉ xoá mới hỏi xác nhận, nháp không bị xoá khi đăng xuất, danh sách bệnh nhân không đổi thứ tự khi có ghi chú.

**Hướng hình ảnh**: bảng màu A, không thêm token. Điểm nhấn là **ô soạn đang mở**: viền `--primary` 2 px, cùng một dòng trạng thái nhỏ có icon. Bác sĩ liếc là biết chữ đã an toàn ("Đã lưu") hay đang chờ ("Đang chờ mạng"). Các ghi chú cũ giữ yên lặng, như dòng chữ trong sổ.

**Bố cục điện thoại (390 px)**, dưới thẻ Tóm tắt:

- tiêu đề "Ghi chú" kèm số ghi chú;
- ô soạn (khi mở);
- danh sách ghi chú trong một thẻ, ngăn bởi đường kẻ: ngày giờ in đậm cỡ 14 px, nội dung cỡ 16 px;
- nút nổi "Ghi chú mới" ở góc dưới phải, cùng vị trí với nút "Thêm bệnh nhân" ở danh sách. Nút ẩn khi đang có ô soạn ghi chú mới.

**Ô soạn**:

- textarea tối thiểu 4 dòng, tự cao lên theo nội dung, tối đa khoảng 12 dòng rồi cuộn trong ô;
- hàng dưới: trạng thái ở bên trái; "Xoá ghi chú" (khi sửa) và "Xong" ở bên phải.

**Máy tính (1280 px)**: cùng cột 672 px.

**Trạng thái trong mockup:**

- danh sách có ghi chú (gồm một ghi chú đã sửa và một ghi chú có link);
- chưa có ghi chú;
- ô soạn mới chưa gõ;
- đang lưu;
- đã lưu;
- đang chờ mạng;
- khôi phục nháp;
- quá dài;
- không lưu được (`NOT_FOUND`);
- đang sửa ghi chú cũ;
- hộp thoại xoá;
- đang tải (khung chờ).

**Tương phản**: chỉ dùng các cặp đã kiểm ở `add-patient-records` §10, gồm `--muted-foreground`, `--primary` và `--warning` trên `--warning-bg`. Viền ô soạn `--primary` trên `--card` đạt 8.72:1 (sáng) và 7.47:1 (tối), quá ngưỡng 3:1 cho viền điều khiển.

**Kiểm tra trước khi coi là xong:**

- xem ở 360/390/1280 px, sáng và tối, so với mockup;
- bàn phím điện thoại mở không che ô soạn: dùng `scrollIntoView({ block: "center" })` khi mở;
- rà bằng `web-design-guidelines`.

## Risks / Trade-offs

- [Nháp là dữ liệu bệnh nhân lưu chưa mã hoá trong trình duyệt] → Đã chấp nhận ở D13 và teckstack.md §4.9. Nháp chỉ sống tới khi server xác nhận, nên bình thường kho trống.
- [Đăng xuất không xoá nháp chưa gửi] → Cố ý, để không mất chữ. Nháp gắn tài khoản, nên người khác đăng nhập trên cùng máy không thấy.
- [Safari bị xoá dữ liệu trang web sau 7 ngày không mở (ITP)] → Chỉ ảnh hưởng nháp chưa gửi được trong 7 ngày, hiếm. App cài lên màn hình chính thì không bị.
- [Cờ `editing` do trình duyệt gửi] → Chỉ đổi việc hiện "Đã sửa" trên ghi chú của chính bác sĩ, không mở quyền gì.
- [Gửi mỗi giây khi gõ liên tục] → Có độ trễ 1 giây, và mỗi ghi chú chỉ có một lần gửi tại một thời điểm. Một bác sĩ gõ một ghi chú sinh vài yêu cầu nhỏ, trong giới hạn gói miễn phí.
- [Hai tab cùng sửa một ghi chú] → Web Locks giữ thứ tự gửi. Nội dung cuối cùng là của tab gõ sau cùng; với một bác sĩ thì chấp nhận được.

## Migration Plan

Không đổi schema, không migration. Thêm `idb-keyval@6.3.0` vào `dependencies`; gói không có install script, nên không cần sửa `allowBuilds`. Rollback bằng cách deploy lại bản trước: ghi chú đã lưu vẫn nằm trong bảng `notes`, bản cũ không đọc tới. Nháp còn trên máy sẽ được gửi khi bản mới quay lại.
