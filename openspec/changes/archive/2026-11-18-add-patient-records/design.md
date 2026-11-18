# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Schema** `src/server/db/schema/patients.ts`: bảng `patients` đã có từ migration `0001`, gồm:
  - `account_id` (khoá ngoại, `ON DELETE CASCADE`);
  - `full_name`, `birth_year` (smallint), `birth_date` (date), `gender` (enum `male | female | other`), `hometown`, `phone`, `patient_code`, `avatar_path`, `summary`;
  - `search_text` (index `pg_trgm`), `deleted_at`, `created_at`, `updated_at`;
  - index `(account_id, deleted_at)`; RLS bật.
- **Module `patients`**: mới có README, chưa có code. `/patients` đang hiện `FeaturePlaceholder`.
- **Dùng chung**:
  - `normalizeVi` / `buildSearchText` (`src/lib/text/normalize-vi.ts`);
  - `InitialsAvatar`, `EmptyState`, `ErrorState`, `FormAlert`;
  - `useOnlineStatus`;
  - `formatDate`, `siteConfig.timeZone = "Asia/Ho_Chi_Minh"`.
- **Khung**:
  - Layout `(doctor)` gọi `requirePageAccess("doctor")`. `DoctorShell` chừa chỗ cho `BottomNav` (`pb-[calc(4rem+safe-area)]`).
  - `(doctor)/loading.tsx` là skeleton danh sách.
- **Next 16**:
  - `params` là `Promise` (`await params`).
  - `error.tsx` nhận prop `retry` (không còn `reset`).
  - `notFound()` hiện `not-found.tsx` gần nhất. Trang có `loading.tsx` thì trạng thái HTTP có thể là 200, spec không đòi mã 404.

## Goals / Non-Goals

**Goals:**

- Thêm một bệnh nhân chỉ với họ tên trong vài giây: mở form, gõ tên, Enter.
- Mọi đọc và ghi đi qua DAL lọc theo `auth.account.id`. Id của bác sĩ khác không bao giờ cho biết bệnh nhân có tồn tại hay không.
- Lưu thất bại (mất mạng, lỗi kiểm, sửa trùng lúc) không làm mất chữ.
- `search_text` luôn đúng sau mọi lần ghi, để change tìm kiếm chỉ cần đọc.

**Non-Goals:** ghi chú, tìm kiếm, ảnh, thùng rác (xem proposal, "Ngoài phạm vi"). Nháp lưu qua lần đóng tab cũng chưa làm; change ghi chú sẽ dựng kho nháp.

## Decisions

### 1. Cấu trúc

```
src/modules/patients/
├── constants.ts            PATIENT_LIMITS, PATIENT_MESSAGES, GENDER_LABELS
├── birth.ts                parseBirthInput, formatBirthInput, ageOf, describeAge (thuần, client + server)
├── duplicates.ts           findPossibleDuplicates (thuần)
├── schemas.ts              patientFormSchema (Zod, dùng chung form và action), updatePatientSchema
├── types.ts                PatientListItem, PatientDetail (DTO, không có search_text)
├── server/
│   ├── queries.ts          listPatients(auth), getPatient(auth, id)
│   ├── mutations.ts        insertPatient(auth, input), updatePatient(auth, id, version, input)
│   └── actions.ts          createPatientFormAction, updatePatientFormAction (createFormAction, "doctor")
└── components/
    ├── patient-list.tsx        danh sách + dòng (Server Component)
    ├── add-patient-button.tsx  nút nổi "Thêm bệnh nhân"
    ├── patient-form.tsx        "use client": form thêm/sửa
    ├── birth-field.tsx         ô năm sinh + dòng diễn giải
    ├── gender-field.tsx        ba nút chọn, bấm lại để bỏ chọn
    ├── duplicate-hint.tsx      "Có phải người này?"
    ├── patient-header.tsx      khối đầu trang chi tiết
    └── patient-summary.tsx     thẻ Tóm tắt (linkify)
src/lib/text/linkify.ts     splitLinks(text): đoạn chữ và đoạn link http(s)
src/config/routes.ts        doctor.newPatient, doctor.patient(id), doctor.editPatient(id)
src/app/(doctor)/patients/
├── page.tsx  error.tsx
├── new/page.tsx
└── [id]/page.tsx  [id]/loading.tsx  [id]/not-found.tsx  [id]/edit/page.tsx
```

Chiều phụ thuộc giữ đúng `app → modules → lib/components/server`:

- `linkify.ts` nằm ở `src/lib`, vì ghi chú (change 2) cũng dùng.
- `birth.ts` và `duplicates.ts` thuần và an toàn cho client. Chúng ở trong module vì chỉ module này dùng.
- Đường dẫn có tham số là hàm trả `Route`, ví dụ `` `/patients/${id}` as Route ``. Vẫn qua `typedRoutes`.

### 2. Dữ liệu tách theo bác sĩ

- Các hàm DAL nhận `AuthContext` và luôn lọc `account_id = auth.account.id AND deleted_at IS NULL`. Không hàm nào nhận account id từ client.
- **Page** gọi `requirePageAccess("doctor")`, rồi gọi DAL với `auth` đó. Layout cũng kiểm, nhưng layout không chạy lại khi điều hướng phía client.
- **Action** lấy `auth` từ `createFormAction`.
- **Id trên URL** được kiểm bằng `z.uuid()` trước khi truy vấn:
  - Sai định dạng thì gọi `notFound()` ngay, không để PostgreSQL ném lỗi `invalid input syntax for type uuid` (sẽ thành 500).
  - Không có dòng nào khớp cả id lẫn account cũng gọi `notFound()`.
  - Hai trường hợp ra cùng một trang, nên không lộ bệnh nhân có tồn tại hay không.
- **`updatePatient`** chạy một câu `UPDATE … WHERE id = $id AND account_id = $account AND deleted_at IS NULL AND <version> RETURNING id`. Không có dòng nào được cập nhật thì đọc lại theo `(id, account)` để biết lý do:
  - không thấy dòng: ném `NOT_FOUND`;
  - thấy dòng: ném `CONFLICT` (mục 4).
- **Admin**: không có code admin nào đụng tới bảng `patients` (N6).

### 3. Ô "Năm sinh hoặc tuổi" (`birth.ts`)

Hàm `parseBirthInput(text, today)` trả `{ kind: "empty" }`, `{ kind: "ok", birthYear, birthDate | null }` hoặc `{ kind: "error", message }`. Tham số `today` là `{ year, month, day }` theo giờ Việt Nam, lấy bằng `Intl.DateTimeFormat(…, { timeZone })`. Nhờ đó test cố định được ngày. Thứ tự nhận diện:

1. Trống: không có năm sinh.
2. `^\d{4}$`: năm sinh. Phải từ 1900 tới năm nay, nếu không báo "Năm sinh phải từ 1900 tới năm nay."
3. `^\d{1,3}\s*(t|tuổi|tuoi)?$` (không phân biệt hoa thường): tuổi.
   - Lớn hơn 120 thì báo "Tuổi phải từ 0 tới 120." (tuổi 120 quy ra năm 1906, vẫn trong mốc 1900).
   - Năm sinh = năm nay − tuổi. Không có ngày sinh.
   - `1979` không bao giờ rơi vào nhánh này, vì nhánh 2 chạy trước và nhánh này chỉ nhận tối đa ba chữ số.
4. `^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$`: ngày sinh. Kiểm ngày có thật (31/02 sai) và không ở tương lai, nếu không báo "Ngày sinh không có thật hoặc ở tương lai." Lưu `birth_date` dạng `YYYY-MM-DD`, và `birth_year` = năm đó.
5. Còn lại: báo "Nhập năm sinh (1979), tuổi (45t) hoặc ngày sinh (12/03/1979)."

Các hàm phụ:

- `describeAge(birthYear, birthDate, today)`:
  - trả "45 tuổi", hoặc "Dưới 1 tuổi" khi tuổi bằng 0;
  - có ngày sinh thì tính tuổi tròn, chưa tới ngày sinh nhật trong năm thì trừ 1.
- `formatBirthInput`: đổi giá trị đã lưu thành chữ cho form sửa (`1979` hoặc `12/03/1979`).
- Dòng diễn giải dưới ô: "Năm sinh 1981 · 45 tuổi" hoặc "Ngày sinh 12/03/1979 · 47 tuổi".

Cách dùng hai phía:

- **Client**: gọi cùng hàm để hiện dòng diễn giải trong lúc gõ.
- **Server**: `patientFormSchema` gọi hàm qua `z.string().transform(…)`, lỗi thì `ctx.addIssue` vào ô `birth`. Server không tin kết quả client đã tính.

Lệch ngày giữa máy và server chỉ có thể xảy ra quanh nửa đêm 31/12. Server luôn dùng giờ Việt Nam, nên kết quả lưu vẫn nhất quán.

Các phương án đã cân nhắc:

- **Ba ô riêng** (ngày, tháng, năm) hoặc bộ chọn ngày: chậm hơn nhiều trên điện thoại, và đi ngược với "45t" trong §10.1.
- **Bắt buộc gõ "t" mới hiểu là tuổi**: bác sĩ hay gõ "45". Dòng diễn giải luôn hiện cách app đã hiểu, nên số trần vẫn an toàn.

### 4. Không ghi đè bản sửa ở nơi khác

Trang sửa đặt một ô ẩn `version` chứa `updated_at` dạng ISO. Câu `UPDATE` chỉ chạy khi `date_trunc('milliseconds', updated_at) = $version`, và đặt `updated_at = now()`. Phải so tới mili-giây vì `timestamptz` lưu tới micro-giây, còn `Date` của JS chỉ giữ mili-giây. Không khớp thì báo `CONFLICT` với "Bệnh nhân vừa được sửa ở thiết bị khác. Tải lại trang để xem bản mới nhất." Form giữ chữ (mục 5).

Các phương án đã cân nhắc:

- **Ai lưu sau thì thắng**: âm thầm làm mất bản sửa của thiết bị kia.
- **Thêm cột `version integer`**: cần migration và phải thêm cột vào sao lưu. `updated_at` đã đủ: hai lần lưu ở hai thiết bị gần như không thể rơi vào cùng một mili-giây.

### 5. Form và việc giữ chữ (`patient-form.tsx`)

Form dùng `useActionState`, nhưng truyền vào một **hàm client bọc server action**:

1. Hàm bọc gọi server action trong `try/catch`:
   - **Gọi được**: lấy `result` của action.
   - **Ném lỗi**: dùng thông báo mất mạng. Action đã tự bắt mọi lỗi phía server, nên lời gọi bị ném lỗi chỉ có thể là yêu cầu hoặc trả lời bị mất trên đường truyền. Điều này đúng cả khi máy vẫn báo có mạng (Wi-Fi không ra được internet), nên không dựa vào `navigator.onLine`.

   Nếu không bọc, lỗi này sẽ bay lên `error.tsx` và thay cả form, mất hết chữ.

2. Sau khi có kết quả, hàm bọc đọc lại mọi giá trị **đang có trong form lúc đó** (`new FormData(form)`), gọi là `values`, rồi trả `{ result, values }`. Các ô vẫn sửa được trong lúc đang lưu, nên chữ gõ thêm khi mạng chậm cũng được giữ.

3. Các ô là **uncontrolled**, có `defaultValue = state?.values.x ?? initial.x`:
   - React tự `form.reset()` sau mỗi lần action chạy xong. `reset()` đưa ô về `defaultValue`, mà lúc đó `defaultValue` đã là `values` ở bước 2, nên chữ còn nguyên.
   - Đây đúng là cách form đăng nhập giữ lại tên đăng nhập.
   - Ô năm sinh và ô họ tên có thêm `onChange` ghi vào state cục bộ, chỉ để hiện dòng diễn giải và gợi ý trùng tên. Giá trị gửi lên vẫn lấy từ DOM.
   - Lỗi năm sinh từ server chỉ hiện khi chữ trong ô vẫn là chữ đã gửi. Gõ chữ khác thì dòng diễn giải mới hiện ngay, không bị lỗi cũ che.
   - Ô Tóm tắt không đặt `maxLength`: trình duyệt sẽ cắt âm thầm đoạn dán quá dài, còn spec đòi báo lỗi và không lưu gì.

4. **Thành công**: server action trả `{ id }`. Hàm bọc gọi `router.replace(routes.doctor.patient(id))` cho cả form thêm lẫn form sửa, để nút Back không bao giờ quay lại form vừa lưu.
   - Không dùng `redirect()` trong action: cách nó đi qua hàm bọc phía client không được tài liệu nêu rõ, còn trả id thì dễ test.
   - Sau khi ghi, action gọi `revalidatePath` cho danh sách và trang chi tiết.

5. **Trước khi trang hydrate**: React render form có action là hàm client với thuộc tính `action="javascript:throw …"`. Bấm Lưu lúc đó không gửi gì, nên không có chuyện quay về GET làm lộ chữ lên URL. Một unit test render sang HTML và kiểm thuộc tính này.

6. **Mất mạng**: `useOnlineStatus()` sai thì form hiện dòng nhắc `role="status"` (nền `--warning-bg`, chữ `--warning`).

7. **Focus**: lỗi ở ô thì focus vào ô lỗi đầu tiên. Lỗi chung (mất mạng, `CONFLICT`) hiện trong `FormAlert` `role="alert"`.

Các phương án đã cân nhắc:

- **`onSubmit` tự gọi action**: trái quy ước module, và form không có `action` sẽ GET khi chưa hydrate.
- **Ô controlled**: `form.reset()` của React 19 vẫn đặt lại giá trị DOM của ô controlled, gây lệch với state. Dùng uncontrolled kèm `defaultValue` thì đơn giản hơn.
- **Tự lưu từng ô**: xem proposal, phần N2.

**Ô giới tính**: ba radio thật, ẩn bằng `sr-only` trong `<label>`. Bỏ chọn bằng cách bấm lại: con trỏ chạm vào nhãn chứ không chạm vào radio bị ẩn, nên trạng thái "đã chọn trước đó" được ghi ở `pointerdown` của nhãn. Bàn phím: phím cách, Delete hoặc Backspace trên radio đang chọn sẽ bỏ chọn.

**Chuẩn hoá chữ**: mọi ô văn bản được chuẩn hoá NFC trước khi cắt khoảng trắng và đo độ dài. Một số bộ gõ tiếng Việt gõ dạng tổ hợp (NFD, 2–3 đơn vị mã mỗi chữ), làm giới hạn 100 ký tự từ chối một họ tên trông ngắn hơn nhiều.

### 6. Gợi ý trùng tên (`duplicates.ts`)

- Trang `/patients/new` (Server Component) lấy `listPatients(auth)` và truyền xuống form. Mỗi phần tử gồm id, họ tên, năm sinh, ngày sinh, giới tính, quê.
- Danh sách này đúng bằng những gì trang `/patients` đã hiện, nên không lộ thêm gì.
- Form gọi `findPossibleDuplicates(candidates, { fullName, birthYear })` mỗi khi họ tên hay năm sinh đổi. So bằng `normalizeVi(a) === normalizeVi(b)`. Năm sinh khớp khi bằng nhau, hoặc khi một bên `null`.
- Hiện tối đa 3 người.

Các phương án đã cân nhắc:

- **Hỏi server mỗi lần gõ**: thêm một action đọc và độ trễ mạng, trong khi danh sách vài trăm dòng đã nằm sẵn trên trang.
- **Chặn lưu, bắt bấm "Vẫn thêm"**: trái BR2 ("không chặn") và N2.

### 7. Danh sách

- `listPatients` chỉ chọn các cột `id, full_name, birth_year, birth_date, gender, hometown, avatar_path`. Lọc theo account và `deleted_at IS NULL`, sắp theo `updated_at desc, id desc`. Không giới hạn số dòng (A1: vài trăm).
- Phân trang để change tìm kiếm quyết định, vì lọc tức thì phía client cần đủ danh sách.
- **Không bao giờ** chọn `summary`, `phone`, `patient_code` cho danh sách: DTO `PatientListItem` không có các trường đó, nên chúng không thể lọt vào HTML.
- Đầu trang hiện "`n` bệnh nhân".
- **Nút "Thêm bệnh nhân"**:
  - nút nổi có chữ, `fixed`, cách đáy `calc(4rem + safe-area + 16px)`, sát mép phải của cột nội dung 672 px;
  - danh sách có thêm khoảng đệm đáy để nút không che dòng cuối;
  - trên máy tính vẫn ở vị trí đó, để chỉ có một chỗ.

### 8. Chi tiết và tóm tắt

- **Tiêu đề** `h1` là họ tên. Dòng phụ: "Nam · 47 tuổi (1979) · Nghệ An".
- **Số điện thoại**: `<a href="tel:…">`. `href` bỏ mọi ký tự trừ chữ số và dấu `+` ở đầu. Chữ hiển thị giữ nguyên như bác sĩ nhập.
- **Tóm tắt**: `splitLinks(text)` tách văn bản thành đoạn chữ và đoạn link.
  - Link khớp `https?://[^\s<>"']+`, rồi bỏ dấu câu ở cuối (`.,;:!?)`). Phần chữ render bằng text node của React, không bao giờ dùng `dangerouslySetInnerHTML`.
  - Thẻ link có `target="_blank" rel="noopener noreferrer"`. `noreferrer` giữ cho id bệnh nhân trên URL không bị gửi sang trang ngoài qua `Referer`.
- **Giữ dòng**: thẻ tóm tắt dùng `whitespace-pre-wrap break-words`.
- **Tiêu đề tab**: `metadata = { title: "Bệnh nhân" }` cố định cho chi tiết, "Thêm bệnh nhân" và "Sửa thông tin" cho hai form. Không dùng `generateMetadata`.

### 9. Lỗi

| Tình huống             | Xử lý                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| Ô sai                  | `VALIDATION_FAILED` + `fieldErrors`, chữ hiện dưới ô              |
| Sửa trùng lúc          | `CONFLICT` + `PATIENT_MESSAGES.changedElsewhere`                  |
| Id không thuộc bác sĩ  | `NOT_FOUND`. Trang thì `notFound()`                               |
| Chưa đăng nhập / Admin | `UNAUTHENTICATED` / `FORBIDDEN` từ `createFormAction`             |
| Lỗi bất ngờ            | `INTERNAL`. `createAction` log tên action và lỗi, không log input |
| Lỗi khi đọc trang      | `error.tsx`: `ErrorState` + nút "Thử lại" gọi `retry()`           |

Không log dữ liệu bệnh nhân ở đâu cả. Lỗi `CONFLICT` của PostgreSQL không được dùng vì không có ràng buộc duy nhất nào ở bảng này.

### 10. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-patient-records/mockup/index.html`. Đây là file local, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng. Duyệt cũng xác nhận năm điểm nêu trong mockup:

- cách hiểu N2: form hồ sơ có một nút "Lưu";
- danh sách xếp theo thêm/sửa gần nhất;
- ô năm sinh nhận cả số trần là tuổi;
- gợi ý trùng tên khi một bên chưa có năm sinh;
- giới tính hiện bằng chữ.

**Hướng hình ảnh**: bảng màu A "Mực bút bi", Be Vietnam Pro, không thêm token. Điểm nhấn duy nhất là **dòng diễn giải năm sinh**: một vệt nhỏ màu `--primary` ngay dưới ô, cho bác sĩ thấy "45t" đã thành "1981". Mọi thứ khác giữ yên lặng để đọc nhanh dưới đèn phòng khám.

**Bố cục điện thoại (390 px):**

- **Danh sách**:
  - tiêu đề "Bệnh nhân" kèm số bệnh nhân;
  - một thẻ chứa các dòng: avatar chữ cái đầu 40 px, họ tên 16 px đậm vừa, dòng phụ 14 px màu `--muted-foreground`, mũi tên phải;
  - mỗi dòng cao ít nhất 64 px;
  - nút nổi "Thêm bệnh nhân" ở góc dưới phải.
- **Form**:
  - thanh trên có nút quay lại và tiêu đề "Thêm bệnh nhân" / "Sửa thông tin";
  - các ô xếp dọc, Họ tên ở đầu;
  - Giới tính là ba nút Nam / Nữ / Khác cao 44 px;
  - Tóm tắt là ô nhiều dòng cao khoảng 6 dòng;
  - thanh nút "Lưu" dính đáy, ngay trên `BottomNav`.
- **Chi tiết**:
  - thanh trên có nút quay lại và nút "Sửa";
  - khối đầu: avatar 56 px, họ tên, dòng phụ;
  - các dòng Số điện thoại (bấm gọi) và Mã bệnh nhân;
  - thẻ Tóm tắt.

**Máy tính (1280 px)**: cùng cột nội dung rộng tối đa 672 px, căn giữa. Form không chia hai cột, để thứ tự đọc giữ như trên điện thoại.

**Trạng thái trong mockup:**

| Màn hình  | Trạng thái                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Danh sách | có dữ liệu (gồm tên rất dài và người trùng tên), sổ trống, đang tải, lỗi                                                                           |
| Form thêm | mặc định, đang nhập "45t", có gợi ý trùng tên, lỗi ô (họ tên trống, năm sinh sai, số điện thoại sai), đang lưu, mất mạng, gửi thất bại vì mất mạng |
| Form sửa  | điền sẵn, bị sửa ở thiết bị khác (`CONFLICT`)                                                                                                      |
| Chi tiết  | đủ thông tin (tóm tắt có link), chỉ có họ tên, không tìm thấy                                                                                      |

**Token**: không thêm, không đổi. Tỉ số tương phản của bảng màu A đã kiểm ở change `add-account-login` (design §6). Các cặp dùng nhiều nhất ở change này:

| Cặp màu                                          | Sáng   | Tối    |
| ------------------------------------------------ | ------ | ------ |
| `--muted-foreground` trên `--card` (dòng phụ)    | 6.72:1 | 6.88:1 |
| `--primary` trên `--card` (dòng diễn giải, link) | 8.72:1 | 7.47:1 |
| `--warning` trên `--warning-bg` (nhắc mất mạng)  | 6.24:1 | 9.62:1 |

**Kiểm tra trước khi coi là xong:**

- xem ở 360/390/1280 px, sáng và tối, so với mockup;
- không cuộn ngang ở 360 px với họ tên 100 ký tự;
- rà bằng `web-design-guidelines`.

## Risks / Trade-offs

- [Danh sách không giới hạn số dòng] → Với vài trăm bệnh nhân (A1), HTML chỉ vài chục KB. Change tìm kiếm sẽ đo lại và quyết phân trang hoặc cuộn ảo.
- [So `updated_at` tới mili-giây] → Hai lần lưu trong cùng một mili-giây sẽ không bị phát hiện. Với một bác sĩ trên hai thiết bị, chấp nhận được.
- [Số trần "45" được hiểu là tuổi] → Dòng diễn giải luôn hiện kết quả trước khi lưu, và trang chi tiết hiện cả năm sinh.
- [Danh sách ứng viên trùng tên gửi xuống trang thêm] → Đây đúng là dữ liệu trang danh sách đã hiện, không có tóm tắt hay số điện thoại.
- [Chữ chưa lưu mất khi đóng tab] → Nằm ngoài phạm vi. Change ghi chú dựng kho nháp IndexedDB, rồi có thể dùng cho form này.
- [`autocomplete="off"`] → Một số trình duyệt bỏ qua giá trị này với ô có tên giống "name" hay "tel". Đặt `name` của ô theo kiểu riêng (`patientFullName`…) để trình duyệt không đoán ra.

## Migration Plan

Không có migration, không đổi schema. Triển khai là deploy bình thường. Rollback bằng cách deploy lại bản trước: dữ liệu đã thêm vẫn nằm trong bảng `patients`, bản cũ không đọc tới.
