# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Bảng `todos`**: `id`, `account_id` (cascade theo tài khoản), `content`, `due_date` (kiểu `date`), `completed_at` (null = chưa xong), `created_at`, `updated_at`, index `(account_id, completed_at)`, RLS bật. Bảng đã nằm trong sao lưu và nhập (`add-data-backup`), và đã được tính trong "có thay đổi" của thanh nhắc sao lưu.
- **Route `/todos`** đang render `FeaturePlaceholder`. Thanh điều hướng dưới đã có tab "Việc cần làm".
- **Mẫu có sẵn để dùng lại**:
  - ghi chú: id do trình duyệt tạo, lưu kiểu "thêm hoặc cập nhật" để gửi lại không trùng;
  - thùng rác: toast có "Hoàn tác" trên `DOCTOR_TOASTER_ID`;
  - `ConfirmDialog`, `Sheet` (shadcn), `EmptyState`;
  - `vietnamIsoDay`, `calendarDaysBetween` (`src/lib/date/calendar.ts`), `formatDate`.
- **Giới hạn nội dung**: 1000 ký tự, đang nằm ở `BACKUP_LIMITS.todoContent`.

## Goals / Non-Goals

**Goals:**

- Thêm một việc trong vài giây, không chờ server mới thấy việc hiện ra.
- Không mất chữ đang gõ khi mạng chập chờn; không tạo việc trùng khi gửi lại.
- Không có đường nào để bác sĩ này đọc hay đổi việc của bác sĩ khác.

**Non-Goals:** nháp offline, gắn bệnh nhân, nhắc việc (xem proposal, "Ngoài phạm vi").

## Decisions

### 1. Cấu trúc

```
src/modules/todos/
├── constants.ts          TODO_LIMITS (content 1000), TODO_UNDO_MS (8000), TODO_MESSAGES
├── schemas.ts            todoContent (NFC + trim, 1..1000), dueDate ("yyyy-mm-dd" có thật, nullable),
│                         createTodoSchema, restoreTodoSchema, updateTodoSchema,
│                         setTodoDoneSchema, todoIdSchema
├── types.ts              TodoItem (DTO: id, content, dueDate, completedAt, createdAt — ISO)
├── due.ts                describeDue(dueDate, today) → { text, tone: "overdue"|"today"|"soon"|"plain" },
│                         compareOpen, compareDone (thứ tự ở spec)
├── server/queries.ts     listTodos(auth)
├── server/mutations.ts   insertTodo, updateTodo, setTodoDone, deleteTodo, deleteCompletedTodos
├── server/actions.ts     createTodoAction, restoreTodoAction, updateTodoAction,
│                         setTodoDoneAction, deleteTodoAction, deleteCompletedTodosAction
└── components/
    ├── todo-list.tsx       client: giữ danh sách, cập nhật lạc quan, mục "Đã xong"
    ├── todo-composer.tsx   ô "Thêm việc…" + nút ngày hạn + nút "Thêm"
    ├── todo-item.tsx       vòng tròn + nội dung + nhãn ngày hạn
    └── todo-edit-sheet.tsx bảng "Sửa việc" (Sheet từ dưới lên)

src/app/(doctor)/todos/page.tsx     server: listTodos → <TodoList initial={…} today={…} />
src/app/(doctor)/todos/loading.tsx  khung xám
```

- **Chiều phụ thuộc**: `app → modules/todos → shared`.
- **`backup` đổi theo**: `backup/schemas.ts` lấy giới hạn từ `todos/constants.ts` (import chéo `constants` được phép), và `BACKUP_LIMITS.todoContent` bị bỏ.
- **`FeaturePlaceholder`** không còn route nào dùng nên bị xoá.

### 2. Dữ liệu và lệnh

- **`listTodos(auth)`**: mọi việc của tài khoản, `WHERE account_id = $session`. Server không sắp xếp: thứ tự hiển thị do `due.ts` quyết định ở client, để việc vừa thêm hay vừa đổi tự vào đúng chỗ mà không cần tải lại.
- **`insertTodo(auth, { id, content, dueDate, completedAt?, createdAt? })`**:
  - `INSERT … ON CONFLICT (id) DO UPDATE SET content, due_date WHERE account_id = $session` (lần gửi lại có thể mang ngày hạn vừa đổi), rồi đọc lại dòng theo `id` **và** `account_id`;
  - không có dòng nào thì nghĩa là id đã thuộc tài khoản khác (chỉ có thể do trình duyệt bị sửa), và lệnh trả `NOT_FOUND`;
  - gửi lại cùng id thì không tạo dòng thứ hai.

  **Phương án đã cân nhắc**: server tự tạo id. Nhưng khi câu trả lời mất giữa đường, lần gửi lại sẽ tạo việc trùng. Ghi chú đã gặp đúng chuyện này và giải bằng id phía trình duyệt.

- **`restoreTodoAction`** (cho "Hoàn tác") dùng `insertTodo` với `createdAt` và `completedAt` cũ, để việc trở về đúng chỗ.
  - Hai giá trị này do trình duyệt gửi, nhưng chỉ là dữ liệu của chính bác sĩ.
  - Server kẹp chúng ≤ `now()` và kiểm định dạng ISO.
- **`updateTodo`, `setTodoDone`, `deleteTodo`**: `WHERE id = $1 AND account_id = $session`. Không có dòng nào bị đổi thì trả `NOT_FOUND`.
  - `setTodoDone(done)` đặt `completed_at = now()` hoặc `NULL`.
  - Đánh dấu xong một việc đã xong thì giữ nguyên thời điểm cũ (`COALESCE`), để lần bấm thứ hai không đổi thứ tự.
- **`deleteCompletedTodos(auth)`**: `DELETE … WHERE account_id = $session AND completed_at IS NOT NULL`, trả số dòng đã xoá.
- **Action**: mọi action dựng bằng `createAction` với `access: "doctor"`, kiểm bằng Zod. Mọi action đổi dữ liệu đều `revalidatePath("/todos")`: nếu không, nút Back/Forward sẽ dựng lại trang như lần tải đầu (Next dùng lại trang đã lưu) và hiện lại việc đã xoá (review). Danh sách ở client giữ state riêng, nên trang render lại không đè lên những gì đang hiện.

### 3. Cập nhật lạc quan ở client

`TodoList` giữ `items` khởi tạo từ props.

- **Thêm**:
  1. tạo `id = crypto.randomUUID()` và chèn việc vào danh sách ngay;
  2. xoá ô nhập, giữ focus;
  3. gọi `createTodoAction`.
  - Lỗi mất mạng: gỡ việc khỏi danh sách, **trả chữ về ô nhập** (nếu ô vẫn trống) cùng ngày hạn đã chọn, rồi báo "Chưa thêm được vì mất mạng". Lần Enter sau dùng lại **cùng id**, nên server không tạo bản trùng.
  - Lỗi khác (quá dài…): gỡ việc, trả chữ, hiện thông báo lỗi.
- **Xong / mở lại**: đổi `completedAt` tại chỗ (hiệu ứng ngắn, có nhánh `motion-reduce`), gọi action với trạng thái **mong muốn** (không phải "lật"). Chỉ câu trả lời của lần chạm gần nhất mới được hoàn tác; "Thử lại" gửi lại đúng trạng thái đó.
- **Chỉ lần thêm và "Hoàn tác" được chèn dòng vào danh sách**; mọi câu trả lời hay hoàn tác khác chỉ sửa dòng còn đó, để việc vừa xoá không hiện lại (review).
- **Nhiều lần thêm thất bại**: mỗi lần giữ id, chữ và ngày hạn riêng. Ô trống thì chữ và hạn trở lại ô; ô đã có chữ mới thì việc đó hiện dưới ô thành dòng "Chưa thêm được: …" kèm "Thử lại" (review).
- **Sửa**: bảng chỉ đóng sau khi server trả lời. Trong lúc chờ, nút "Lưu" hiện "Đang lưu…".
- **Xoá**: bỏ việc khỏi danh sách và đóng bảng, rồi gọi action.
  - Thành công: hiện toast "Đã xoá việc." kèm "Hoàn tác" (8 giây). Hoàn tác gọi `restoreTodoAction` với bản chụp của việc.
  - Lỗi: đưa việc trở lại và hiện toast lỗi.
- **`NOT_FOUND`** ở bất kỳ lệnh nào (việc đã bị xoá ở thiết bị khác): bỏ việc khỏi danh sách và báo "Không tìm thấy việc này."

### 4. Ngày hạn (`due.ts`, hàm thuần, có unit test)

`today` lấy bằng `vietnamIsoDay(new Date())`. Server tính sẵn và truyền xuống làm giá trị đầu, rồi client tính lại sau khi hydrate, để tab mở qua nửa đêm vẫn đúng.

| Khoảng cách tới hạn | Chữ                                       | Tông               |
| ------------------- | ----------------------------------------- | ------------------ |
| < 0                 | "Quá hạn · 16/11", kèm icon `CircleAlert` | `destructive`      |
| 0                   | "Hôm nay"                                 | `warning`          |
| 1                   | "Ngày mai"                                | chữ thường, đậm    |
| ≥ 2                 | "20/11", hoặc "20/11/2027" khi khác năm   | `muted-foreground` |

- **Việc chưa xong**:
  - việc có hạn trước, `dueDate` tăng dần, cùng hạn thì `createdAt` giảm dần;
  - sau đó là việc không hạn, `createdAt` giảm dần.
- **Việc đã xong**: `completedAt` giảm dần. Ngày hạn của việc đã xong hiện màu `muted`, không đỏ.

### 5. Chọn ngày hạn

- **Điều khiển**: dùng `<input type="date">` gốc của trình duyệt. Trên điện thoại nó mở bộ chọn ngày quen thuộc của máy, và không cần thêm thư viện.
- **Nút "Ngày hạn"** (icon lịch, 44 px) cạnh ô thêm, gọi `showPicker()` (có phương án dự phòng là focus vào input).
- **Sau khi chọn**: một "chip" hiện ngày theo cách ở §4 ("Ngày mai"), có nút × để bỏ.
- **Trong bảng sửa**: ô ngày hạn hiện rõ, có nhãn, kèm nút "Bỏ ngày hạn".

### 6. Lỗi

| Tình huống                      | Mã                              | Hiển thị                                                                                        |
| ------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Chưa đăng nhập / Admin          | `UNAUTHENTICATED` / `FORBIDDEN` | (action từ chối, client chuyển hướng như các trang khác)                                        |
| Nội dung trống                  | —                               | Không gửi; Enter không làm gì                                                                   |
| Nội dung > 1000 ký tự           | `VALIDATION_FAILED`             | "Việc tối đa 1000 ký tự." dưới ô nhập                                                           |
| Việc không còn / của người khác | `NOT_FOUND`                     | "Không tìm thấy việc này." (toast), bỏ khỏi danh sách                                           |
| Mất mạng khi thêm               | (fetch lỗi)                     | "Chưa thêm được vì mất mạng" ngay dưới ô, chữ còn nguyên                                        |
| Mất mạng khi xong / sửa / xoá   | (fetch lỗi)                     | Toast "Chưa lưu được vì mất mạng. Thử lại khi có mạng." kèm "Thử lại"; trạng thái trả về như cũ |

Thông báo không bao giờ chứa nội dung việc.

### 7. Giao diện (theo mockup)

Mockup: `openspec/changes/add-todo-list/mockup/index.html`, file local, mở trực tiếp bằng trình duyệt.

**Hướng hình ảnh**: bảng màu A, không thêm token. Điểm nhấn duy nhất là **vòng tròn đánh dấu xong**:

- vòng tròn viền 2 px, chạm vào thì đầy màu `primary` kèm dấu tích;
- việc mờ đi rồi trượt xuống "Đã xong", có nhánh `motion-reduce`.

Còn lại giữ yên: dòng việc là một danh sách viền mảnh như danh sách bệnh nhân.

**Điện thoại (390 px):**

- **Đầu trang**: tiêu đề "Việc cần làm" kèm số việc chưa xong ("3 việc"). Ngay dưới là ô "Thêm việc…" cao 52 px, nút lịch 44 px bên phải, và nút "Thêm" chỉ hiện khi đã gõ chữ. Đầu trang dính trên cùng khi cuộn, như ô tìm bệnh nhân.
- **Mỗi việc**:
  - vòng tròn bên trái, vùng chạm 44 px;
  - nội dung bên phải, xuống dòng tự nhiên, không cắt chữ;
  - nhãn ngày hạn dưới nội dung.
- **Mục "Đã xong (N)"**: dùng `<details>` có nút mở/đóng; khi mở, nút chữ đỏ "Xoá các việc đã xong" nằm ở cuối mục.
- **Bảng sửa**: trượt từ dưới lên, gồm ô nội dung (textarea), ô ngày hạn, "Bỏ ngày hạn", nút "Lưu" (chính) và "Xoá việc" (chữ đỏ).

**Máy tính (1280 px)**: cùng cột 672 px như các trang khác. Bảng sửa là hộp thoại giữa màn hình (`Sheet` side `bottom` trên điện thoại, `Dialog` trên máy tính; hoặc một `Sheet` canh giữa với `max-w`).

**Trạng thái:**

- danh sách có quá hạn / hôm nay / ngày mai / ngày thường / không hạn;
- đang gõ và đã chọn ngày hạn;
- mất mạng khi thêm;
- trống;
- bảng sửa, và bảng sửa khi đang lưu;
- vừa xoá (toast "Hoàn tác");
- "Đã xong" mở ra;
- hộp thoại "Xoá N việc đã xong?";
- đang tải (khung xám).

**Tiếp cận**:

- ô thêm có `<label>` (ẩn bằng `sr-only`) là "Thêm việc";
- vòng tròn là `<button>` với `aria-label` "Đánh dấu xong: <đầu nội dung>" / "Mở lại việc: …" và `aria-pressed`;
- thông báo lỗi dưới ô có `role="alert"`;
- số việc có `aria-live="polite"`.

**Trạng thái duyệt**: người dùng duyệt mockup ngày 19/11/2026, nguyên trạng, cùng bảy quyết định nêu khi trình duyệt.

## Risks / Trade-offs

- **Đóng tab lúc đang mất mạng làm mất dòng đang gõ** → chấp nhận cho MVP (một việc ngắn). Nếu dùng thử thấy cần, dùng lại cơ chế nháp IndexedDB của ghi chú.
- **Hai thiết bị cùng mở** → mỗi trang giữ danh sách riêng tới lần điều hướng sau. Lệnh vào việc đã bị xoá thì nhận `NOT_FOUND` và tự bỏ việc đó; không bao giờ ghi đè dữ liệu của tài khoản khác.
- **Danh sách "Đã xong" dài dần** → thu gọn mặc định, và có "Xoá các việc đã xong". Vài trăm dòng vẫn nhẹ.
- **Nội dung việc có thể là dữ liệu bệnh nhân** → không đưa vào toast, tiêu đề, URL hay log. `aria-label` của vòng tròn chỉ nằm trên trang.

## Migration Plan

Không có migration: bảng `todos` có sẵn. Triển khai một lần; rollback bằng revert code.
