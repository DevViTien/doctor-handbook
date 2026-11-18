# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **`normalizeVi` / `buildSearchText`** (`src/lib/text/normalize-vi.ts`) là cách chuẩn hoá duy nhất: NFD, bỏ dấu, `đ` → `d`, chữ thường, gộp khoảng trắng.
- **Cột `patients.search_text`** = chuẩn hoá của họ tên, quê, số điện thoại, mã bệnh nhân. **Cột `notes.search_text`** = chuẩn hoá nội dung. Cả hai có index GIN `pg_trgm` (migration `0000`/`0001`) và luôn được tính lại khi ghi (`add-patient-records`, `add-patient-notes`). Tóm tắt **không** nằm trong `search_text`.
- **Trang `/patients`**:
  - Server Component, gọi `listPatients(auth)` (id, họ tên, năm/ngày sinh, giới, quê) rồi render `PatientList`;
  - `PatientList` là Server Component của module `patients`, có trạng thái rỗng "Sổ chưa có bệnh nhân nào".
- **Spec `patient-records`**: trang `/patients` không được chứa tóm tắt, số điện thoại hay mã bệnh nhân. Có E2E kiểm cả HTML lẫn dữ liệu RSC.
- **Hook có sẵn**: `useDebouncedValue`, `useOnlineStatus`.
- **Quy ước module** (`src/modules/README.md`, rule 4): module chỉ import của module khác `schemas`, `types`, `constants`, và (từ code server) `server/queries`. Không import component hay hook của nhau.

## Goals / Non-Goals

**Goals:**

- Gõ một phím là danh sách lọc xong, không chờ mạng: tìm tên trong ≤ 5 giây (§6.2).
- Tìm sâu (số điện thoại, mã bệnh nhân, tóm tắt, ghi chú) mà trình duyệt **không bao giờ** nhận nội dung đó.
- Giọng nói chỉ điền chữ vào ô tìm. Tìm bằng giọng nói đi cùng đường với gõ.

**Non-Goals:** giữ từ khoá khi quay lại trang, tô đậm phần khớp, phân trang (xem proposal, "Ngoài phạm vi").

## Decisions

### 1. Cấu trúc và chiều phụ thuộc

```
src/components/common/person-row.tsx   PersonRow: avatar chữ cái đầu, tên (cắt gọn), dòng phụ, nhãn, mũi tên
src/modules/search/
├── constants.ts        SEARCH_LIMITS (min 2, max 100, debounce 300, gợi ý 5), SEARCH_MESSAGES,
│                       NEW_PATIENT_NAME_KEY (khoá sessionStorage)
├── types.ts            SearchablePatient { id, fullName, hometown, meta }, DeepMatch, MatchKind
├── match.ts            searchTokens, matchesLocally, rankLocal (thuần, client + server)
├── deep-match.ts       matchPatientFields(row, query): phone / patientCode / summary (thuần, server)
├── schemas.ts          searchPatientsSchema { query: string, cắt gọn, tối đa 100 }
├── similarity.ts       nameSimilarity: trigram trên họ tên (cùng thước đo pg_trgm similarity)
├── server/queries.ts   searchPatients(auth, query) → { matches, suggestions } (chỉ id + loại khớp)
├── deep-search-client.ts  fetchDeepSearch(query, signal): POST JSON, huỷ được
src/app/api/patients/search/route.ts   POST, chỉ bác sĩ, cùng origin, JSON, Cache-Control: no-store
├── hooks/use-speech-search.ts
└── components/
    ├── search-box.tsx       ô tìm + nút xoá + nút micro + dòng trạng thái giọng nói
    └── patient-search.tsx   "use client": ô tìm, lọc tức thì, tìm sâu, gợi ý, rỗng, danh sách kết quả
src/modules/patients/
├── components/patient-list.tsx   dùng PersonRow; chỉ còn lo trạng thái "Sổ chưa có bệnh nhân nào"
└── components/patient-form.tsx   đọc NEW_PATIENT_NAME_KEY khi mở form thêm
src/app/(doctor)/patients/page.tsx
```

Trang `/patients` tính dòng phụ ("Nam · 47 tuổi · Nghệ An") bằng `describePatientMeta` của `patients`. Tầng `app` được import mọi module. Trang truyền `SearchablePatient[]` cho `PatientSearch`.

- Có bệnh nhân: trang render `PatientSearch`.
- Chưa có bệnh nhân nào: trang render `PatientList`, tức là trạng thái rỗng như cũ.

Như vậy giữ đúng quy ước:

- `search` không import component của `patients`.
- `patients` chỉ import `search/constants`.
- Dòng bệnh nhân là `PersonRow` dùng chung, chỉ nhận props thuần (href, tên, dòng phụ, nhãn), không biết gì về module.

Các phương án đã cân nhắc:

- **Đặt toàn bộ tìm kiếm trong `patients`**: làm mất module `search` đã có trong kiến trúc (D11, `src/modules/README.md`).
- **`search` import `PatientList`**: trái rule 4.

### 2. Lọc tức thì (`match.ts`), chạy trên máy

- `searchTokens(query) = normalizeVi(query).split(" ").filter(Boolean)`.
- Với mỗi bệnh nhân, chuẩn hoá trước (`useMemo` theo danh sách) hai chuỗi `name = normalizeVi(fullName)` và `place = normalizeVi(hometown ?? "")`.
- Khớp khi **mọi** từ đều nằm trong `name + " " + place`, bất kể thứ tự.
- Xếp hạng:
  1. khớp hết trong tên;
  2. còn lại (một phần ở quê).

  Trong mỗi nhóm giữ thứ tự của danh sách (mới thêm/sửa trước).

- Chỉ dùng họ tên và quê. Đó là đúng những gì trang đã hiện, nên trang không chứa thêm gì.

### 3. Tìm sâu trên server (`searchPatients`)

Chạy khi `normalizeVi(query)` dài ít nhất 2 ký tự, sau khi ngừng gõ 300 ms. Mọi truy vấn lọc theo `auth.account.id` và `deleted_at IS NULL`.

1. **Số điện thoại, mã bệnh nhân, tóm tắt.** Đọc `id, full_name, hometown, phone, patient_code, summary` của mọi bệnh nhân của bác sĩ (vài trăm dòng). `matchPatientFields` so trong JS:
   - **Số điện thoại**: từ khoá chỉ gồm chữ số, dấu cách và `+ - . ( )`, có ít nhất 3 chữ số, và chữ số của số điện thoại chứa chữ số của từ khoá. "0912345" khớp "0912 345 678".
   - **Mã bệnh nhân**: `normalizeVi(patient_code)` chứa `normalizeVi(query)` (cả chuỗi), hoặc chứa mọi từ.
   - **Tóm tắt**: `normalizeVi(summary)` chứa mọi từ.

   Không lưu tóm tắt đã chuẩn hoá vào database: chuẩn hoá vài trăm đoạn văn mỗi lần tìm chỉ tốn vài mili-giây, và không cần migration.

2. **Ghi chú**: một câu SQL lấy các `patient_id` khác nhau.

   ```sql
   SELECT DISTINCT n.patient_id
   FROM notes n
   JOIN patients p ON p.id = n.patient_id
   WHERE n.account_id = $account AND p.deleted_at IS NULL
     AND n.search_text LIKE $tok1 ESCAPE '\' AND …
   ```

   Mỗi `$tok` có dạng `%tok%`, trong đó `%`, `_` và `\` của từ khoá đã được thoát. Index `pg_trgm` có sẵn phục vụ `LIKE '%…%'`.

3. **Họ tên và quê**: server cũng chạy `matchesLocally` (bước 2 ở mục trên), chỉ để biết đã có kết quả hay chưa.
4. **Tìm gần đúng**: chỉ chạy khi cả bước 1–3 không có kết quả.
   - `nameSimilarity(query, fullName)` tính bằng JS, trên những dòng đã đọc ở bước 1.
   - Thước đo giống `similarity()` của `pg_trgm`: mỗi từ được đệm hai dấu cách phía trước và một phía sau, rồi lấy tỉ lệ trigram chung. Lấy điểm cao nhất giữa cả họ tên và mọi đoạn từ liên tiếp có cùng số từ với từ khoá, nên "nguyn" vẫn ra "Nguyễn Văn An".
   - **Chỉ so họ tên**, không so `search_text`. `search_text` có cả số điện thoại, mã bệnh nhân và quê: gõ sai một số điện thoại sẽ gợi ý ngay chủ số đó, gõ "nghe am" sẽ gợi ý mọi người quê Nghệ An.
   - Ngưỡng 0.35 và tối đa 5 người. Unit test chốt các ví dụ: "nguyn van an" ra, "xyz" và "0912 345 679" không ra.

Trả về `{ matches: { id, kinds: ("phone" | "patientCode" | "summary" | "notes")[] }[], suggestions: string[] }`.

- **Chỉ có id.** Trình duyệt đã có dòng của từng bệnh nhân (tên, tuổi, giới, quê), nên lấy dòng đó ra để hiện.
- Một bệnh nhân có thể có nhiều loại khớp. Giao diện hiện nhãn đầu tiên theo thứ tự: số điện thoại, mã bệnh nhân, tóm tắt, ghi chú.

Các phương án đã cân nhắc:

- **Gửi `search_text` xuống trình duyệt** (teckstack.md §4.7): làm lộ số điện thoại và mã bệnh nhân trong trang danh sách, trái spec `patient-records`. `teckstack.md` sẽ được sửa cho khớp.
- **Tìm gần đúng bằng `word_similarity` trên `search_text`**: so cả số điện thoại, mã bệnh nhân và quê (xem bước 4).
- **Server Action cho tìm sâu**: Next chạy Server Action lần lượt từng cái trên client, và không huỷ được. Một lần tìm bị treo trên Wi-Fi không ra internet sẽ chặn mọi lần tìm sau, kể cả lưu ghi chú ở trang khác. Route Handler với `AbortController` huỷ được lần tìm cũ và có thời hạn.
- **Thêm tóm tắt vào `patients.search_text`**: phải tính lại cột cho mọi dòng đã có. Mà phép tính dùng `normalizeVi` của JS, không chạy được trong migration SQL.
- **Extension `unaccent`**: `teckstack.md` đã loại, vì vấn đề với index và vì lệch với `normalizeVi`.

### 4. `PatientSearch` (client)

- **Từ khoá** nằm trong state của component. Không có trong URL, `sessionStorage` hay tiêu đề, và mất khi rời trang (xem proposal).
- **Kết quả tại chỗ**: `rankLocal(rows, tokens)` ngay trong render.
- **Tìm sâu**:
  - `useDebouncedValue(query, 300)`;
  - effect gọi `fetchDeepSearch` khi từ khoá đã chuẩn hoá có ít nhất 2 ký tự. Từ khoá mới **huỷ** lần tìm cũ (`AbortController`);
  - mỗi lần tìm có thời hạn 10 giây. Quá hạn thì coi như mất mạng;
  - kết quả lưu kèm từ khoá đã gửi. Một kết quả tới muộn của từ khoá cũ thì bị bỏ, vì không khớp từ khoá đang có;
  - trạng thái "đang tìm" được suy ra (đã gửi mà chưa có kết quả cho từ khoá này), không đặt state đồng bộ trong effect;
  - trong lúc chờ, **giữ kết quả tìm sâu trước** nếu từ khoá chỉ dài thêm hoặc ngắn bớt, để dòng tìm được theo số điện thoại không nhấp nháy mất sau mỗi phím. Đầu danh sách hiện "Đang tìm…" thay cho "0 kết quả";
  - mất mạng thì hiện dòng nhắc, rồi thử lại khi có sự kiện `online` **và** mỗi 15 giây. Sự kiện `online` có thể tới trước khi mạng thật sự chạy, rồi không tới nữa. Mỗi lần thử thất bại lại đặt lại bộ thử.
- **Gộp kết quả**: kết quả tại chỗ trước; sau đó các bệnh nhân chỉ khớp ở tìm sâu, theo thứ tự danh sách và kèm nhãn.
- **Gợi ý "Có phải bạn tìm…?"**: chỉ khi kết quả gộp rỗng và tìm sâu đã trả `suggestions`.
- **"Không thấy bệnh nhân nào khớp"**: khi kết quả gộp rỗng, không có gợi ý, và tìm sâu đã xong (hoặc từ khoá dưới 2 ký tự, hoặc mất mạng).
  - Nút "Thêm bệnh nhân" ghi `{ name, at }` (từ khoá đã cắt gọn và thời điểm) vào `sessionStorage[NEW_PATIENT_NAME_KEY]`, rồi điều hướng tới `/patients/new`.
  - Form thêm đọc khoá đó **một lần** khi mở, xoá ngay, và chỉ điền vào ô Họ tên nếu giá trị chưa quá 60 giây.
  - Trang danh sách xoá khoá mỗi khi mở. Nhờ vậy, một lần thêm không mở được (mất mạng giữa chừng) không điền tên cũ vào một lần thêm khác.
  - Giá trị chỉ sống trong tab đó, vài giây.
- **Đầu danh sách**: "`n` kết quả" khi đang tìm, "`n` bệnh nhân" khi không tìm.
- **Ô tìm và tiêu đề dính trên cùng** khi cuộn (`sticky top-0`, nền `--background`), để bác sĩ đổi từ khoá bằng một tay mà không phải cuộn ngược lên.

### 5. Giọng nói (`useSpeechSearch`)

- **Phát hiện hỗ trợ**:
  - `useSyncExternalStore` đọc `window.SpeechRecognition ?? window.webkitSpeechRecognition`;
  - phía server luôn `false`, nên nút micro chỉ hiện sau khi trang hydrate. Không lệch hydrate.
- **Cấu hình**: `lang = "vi-VN"`, `interimResults = true`, `continuous = false`, `maxAlternatives = 1`.
- **Nhận chữ**:
  - `onresult` ghép các đoạn đã nhận rồi gọi `onTranscript(text)`, nên ô tìm cập nhật dần và danh sách lọc theo;
  - kết thúc (`onend`) thì nút về trạng thái thường.
- **Lỗi** (`onerror`):

  | Mã lỗi                               | Thông báo                                                    |
  | ------------------------------------ | ------------------------------------------------------------ |
  | `not-allowed`, `service-not-allowed` | "Không dùng được micro. Hãy cho phép micro, hoặc gõ để tìm." |
  | `no-speech`                          | "Không nghe rõ. Bấm micro và nói lại."                       |
  | `network`                            | "Cần có mạng để nhận giọng nói."                             |
  | `aborted` (bác sĩ tự dừng)           | không báo gì                                                 |
  | còn lại                              | "Chưa nhận được giọng nói. Hãy gõ để tìm."                   |

- **Nút micro**: `aria-pressed` khi đang nghe, `aria-label="Tìm bằng giọng nói"` / "Dừng nghe". Dòng trạng thái có `role="status"`.
- **Rời trang khi đang nghe**: component tháo ra thì gọi `abort()`.
- **Ghép chữ**: các đoạn được ghép bằng dấu cách. Safari và một số máy Android trả nhiều đoạn, ghép liền thì "Trần Thị" + "Bình" thành "Trần ThịBình".
- **Chữ từ giọng nói** cũng bị cắt còn 100 ký tự như khi gõ.
- **Bấm dừng** đưa nút về trạng thái thường ngay, không đợi `onend`, vì vài trình duyệt không gửi `onend`.
- **Lỗi micro** bị xoá khi bác sĩ gõ, và luôn nhường dòng trạng thái cho tìm sâu (mất mạng, đang tìm).
- **Kiểu dữ liệu**: TypeScript DOM lib không có `SpeechRecognition` chuẩn, nên khai báo một kiểu tối thiểu trong hook, không thêm `@types`.

### 6. Lỗi và quyền

| Tình huống                                   | Xử lý                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Từ khoá dài hơn 100 ký tự                    | Cắt còn 100 ở client. Schema từ chối, `VALIDATION_FAILED`, không hiện lỗi riêng                                                              |
| Chưa đăng nhập / Admin                       | 401 / 403 JSON từ Route Handler (`requireAccess("doctor")`, `toErrorResponse`). Client hiện thông báo phiên hết hạn nếu là `UNAUTHENTICATED` |
| Origin khác hoặc thiếu, thân không phải JSON | 403 / 422. Cookie `SameSite=Lax` vốn đã không đi kèm yêu cầu từ trang khác                                                                   |
| Lỗi server                                   | `INTERNAL`. Hiện "Chưa tìm được trong ghi chú. Thử lại sau." Kết quả tại chỗ vẫn giữ                                                         |

- Không log từ khoá: `toErrorResponse` chỉ log tên route và lỗi, và `logger` bỏ tham số của lỗi SQL.
- Từ khoá chỉ đi trong thân POST JSON, không bao giờ trên URL. Câu trả lời có `Cache-Control: no-store`.

### 7. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-patient-search/mockup/index.html`. Đây là file local, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng, gồm các điểm nêu trong mockup: lọc tức thì theo tên và quê trên máy; tìm sâu trên server chỉ trả id và nhãn khớp, không hiện nội dung; lệch teckstack.md §4.7 vì riêng tư; gần đúng chỉ khi không ai khớp; thêm bệnh nhân với họ tên điền sẵn qua `sessionStorage`; từ khoá không giữ khi rời trang.

**Hướng hình ảnh**: bảng màu A, không thêm token. Điểm nhấn là **ô tìm**: cao 52 px, viền `--input`, focus viền `--primary` 2 px. Bên trái là kính lúp; bên phải là nút xoá và nút micro. Khi đang nghe, nút micro chuyển nền `--primary` và có vòng nhịp chậm (tắt khi `prefers-reduced-motion`). Nhãn khớp ở mỗi dòng là chữ 13 px màu `--primary` kèm icon nhỏ, nằm dưới dòng phụ, không phải huy hiệu màu.

**Bố cục điện thoại (390 px)**:

- vùng dính trên cùng: tiêu đề "Bệnh nhân" với số đếm, rồi ô tìm;
- dòng trạng thái tìm sâu, chữ nhỏ;
- danh sách kết quả là các `PersonRow`;
- nút "Thêm bệnh nhân" nổi như cũ.

**Máy tính (1280 px)**: cùng cột 672 px.

**Trạng thái trong mockup:**

- chưa gõ;
- đang gõ, đã lọc tên;
- đang tìm sâu;
- có kết quả khớp trong ghi chú, tóm tắt, số điện thoại;
- gợi ý gần đúng;
- không thấy ai, có nút thêm;
- mất mạng;
- đang nghe giọng nói;
- lỗi micro;
- trình duyệt không hỗ trợ giọng nói (không có nút micro).

**Tương phản**: chỉ dùng các cặp đã kiểm ở `add-patient-records` §10. Nhãn khớp dùng `--primary` trên `--card`: 8.72:1 (sáng), 7.47:1 (tối).

**Kiểm tra trước khi coi là xong:**

- xem ở 360/390/1280 px, sáng và tối;
- bàn phím mở không che ô tìm, vì ô dính trên cùng;
- rà bằng `web-design-guidelines`.

## Risks / Trade-offs

- [Mỗi lần tìm sâu đọc mọi bệnh nhân của bác sĩ] → Vài trăm dòng (A1) thì nhẹ, có debounce 300 ms. Trên 1000 bệnh nhân thì đo lại, có thể thêm cột chuẩn hoá của tóm tắt.
- [Ngưỡng gần đúng 0.35 có thể quá rộng hoặc quá hẹp] → Có unit test với các ví dụ chốt. Gợi ý chỉ hiện khi không có kết quả nào khác, nên không gây nhiễu.
- [Web Speech trên iPhone khi chạy như app cài lên màn hình chính có thể lỗi (R8)] → Lỗi chỉ hiện một dòng, ô tìm vẫn gõ được. Micro của bàn phím iPhone là đường dự phòng. Cần thử trên máy thật trước đợt dùng thử.
- [Âm thanh gửi tới Google/Apple] → Đã chấp nhận ở idea.md §10.2. Chỉ bật khi bác sĩ bấm micro.
- [`sessionStorage` giữ tên vừa tìm trong vài giây] → Xoá ngay khi form thêm đọc. Không bao giờ vào URL.

## Migration Plan

Không đổi schema, không migration, không thêm thư viện. Rollback bằng cách deploy lại bản trước.
