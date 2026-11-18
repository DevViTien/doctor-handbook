# Proposal

## Why

Trong lúc khám, bác sĩ hay phát sinh việc phải làm sau: gọi lại báo kết quả xét nghiệm, nộp báo cáo, hỏi khoa Dược. Sổ giấy để những việc này lẫn trong ghi chép và dễ quên (idea.md P4). Tab "Việc cần làm" đã nằm trên thanh điều hướng nhưng vẫn là khung "đang được xây dựng". Đây là mục Must lớn nhất còn thiếu của MVP (§11).

Change đầu tiên của module **`todos`** (`src/modules/todos`). Đáp ứng idea.md:

- D5: danh sách việc cần làm cơ bản.
- D15: ngày hạn không bắt buộc, không có thông báo.
- §10.3:
  - gõ rồi nhấn Enter là thêm xong;
  - chạm vòng tròn là xong việc;
  - việc quá hạn tô đỏ;
  - việc đã xong thu gọn ở cuối, xoá hàng loạt được.
- §11: thêm / sửa / xoá / đánh dấu xong (Must); ngày hạn (Should).
- §12.2: thêm việc ngay trong luồng khám.
- N2: thêm việc ≤ 10 giây; không hỏi xác nhận cho thao tác hoàn tác được.
- S3, S7, BR5: chỉ bác sĩ sở hữu thấy và thao tác; thông báo nổi, URL và tiêu đề không chứa nội dung việc, vì việc có thể ghi tên bệnh nhân.

## What Changes

- **Trang `/todos`**, thay khung "đang được xây dựng":
  - tiêu đề "Việc cần làm" kèm số việc chưa xong;
  - ô thêm nhanh "Thêm việc…" ở trên, kèm nút chọn ngày hạn;
  - danh sách việc chưa xong;
  - mục "Đã xong (N)" thu gọn ở cuối.
- **Thêm việc**: gõ nội dung rồi nhấn Enter (hoặc nút "Thêm"). Ngày hạn chọn thêm nếu cần. Việc mới hiện ngay, ô nhập trống lại và vẫn giữ con trỏ để gõ việc tiếp theo.
  - Mất mạng thì chữ đã gõ vẫn còn trong ô, kèm thông báo "Chưa thêm được vì mất mạng".
  - Bấm Enter hai lần, hay gửi lại sau khi mất mạng, không tạo việc trùng.
- **Thứ tự việc chưa xong**: việc có ngày hạn trước, hạn sớm nhất ở trên; sau đó là việc không có hạn, mới nhất ở trên.
- **Ngày hạn hiển thị theo giờ Việt Nam**:
  - "Quá hạn · 16/11" đỏ, kèm icon;
  - "Hôm nay" màu cảnh báo;
  - "Ngày mai";
  - còn lại là "dd/MM", hoặc "dd/MM/yyyy" khi khác năm nay.
- **Đánh dấu xong**: chạm vòng tròn (vùng chạm 44 px). Việc chuyển xuống "Đã xong". Chạm lại vòng tròn ở mục "Đã xong" thì mở lại việc.
- **Sửa**: chạm vào nội dung việc mở bảng "Sửa việc" từ dưới lên, gồm nội dung, ngày hạn (có nút bỏ ngày hạn), "Lưu" và "Xoá việc".
- **Xoá một việc**: không hỏi xác nhận. App hiện thông báo "Đã xoá việc." kèm nút "Hoàn tác" trong khoảng 8 giây. Hoàn tác đưa việc trở lại như cũ.
- **Xoá việc đã xong**: nút "Xoá các việc đã xong" trong mục "Đã xong". Vì xoá nhiều việc cùng lúc và không hoàn tác được, nút này hỏi bằng `ConfirmDialog`.
- **Trống**: chưa có việc nào thì hiện "Chưa có việc nào" và một câu gợi ý cách thêm.
- **Tách theo bác sĩ**: mọi thao tác chỉ áp dụng cho việc của bác sĩ đang đăng nhập. Gửi id việc của người khác thì bị từ chối và không đổi gì.

## Capabilities

### New Capabilities

- `todo-list`: danh sách việc cần làm của bác sĩ. Gồm trang việc, thêm nhanh, ngày hạn và cách hiển thị, đánh dấu xong và mở lại, sửa, xoá có hoàn tác, xoá các việc đã xong, và quyền truy cập.

### Modified Capabilities

(Không có.) `data-backup` và `data-import` đã gồm bảng `todos` với đủ các cột (nội dung, ngày hạn, ngày xong, ngày tạo, ngày sửa). Change này không thêm cột, nên không đổi requirement nào của sao lưu.

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, sáng/tối, điện thoại/máy tính. Gồm:
  - danh sách (quá hạn, hôm nay, có hạn, không hạn);
  - đang thêm, có ngày hạn;
  - mất mạng khi thêm;
  - trống;
  - bảng sửa;
  - đã xoá kèm "Hoàn tác";
  - mục "Đã xong" mở ra, kèm hộp thoại xoá.

  Người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.

- **Module `todos`**:
  - `constants.ts`, `schemas.ts`, `types.ts`, `due.ts` (cách hiện ngày hạn, thứ tự);
  - `server/queries.ts`: `listTodos`;
  - `server/mutations.ts`: `saveTodo`, `updateTodo`, `setTodoDone`, `deleteTodo`, `deleteCompletedTodos`;
  - `server/actions.ts`: năm action (`createAction`, `access: "doctor"`);
  - `components/`: `todo-list.tsx`, `todo-composer.tsx`, `todo-item.tsx`, `todo-edit-sheet.tsx`.
- **Route**: `src/app/(doctor)/todos/page.tsx` (bỏ `FeaturePlaceholder`), thêm `loading.tsx`.
- **Tầng dùng chung**: dùng lại `ConfirmDialog`, `Sheet`, `EmptyState`, Toaster của khu bác sĩ (`DOCTOR_TOASTER_ID`), `calendarDaysBetween` / `vietnamIsoDay`. `FeaturePlaceholder` không còn route nào dùng, nên xoá luôn.
- **Database**: dùng bảng `todos` có sẵn, gồm index `(account_id, completed_at)`. **Không đổi schema, không migration.**
- **Sao lưu**: không đổi định dạng. Giới hạn độ dài nội dung việc (`BACKUP_LIMITS.todoContent` = 1000) chuyển về `todos/constants.ts`, giữ nguyên 1000 để file sao lưu cũ vẫn nhập được.
- **Thư viện, dịch vụ**: không thêm.
- **Bất biến**:
  - DAL lọc theo `auth.account.id`; id của việc do trình duyệt tạo (như ghi chú) nhưng mọi lệnh đều kiểm chủ sở hữu.
  - Thông báo nổi không chứa nội dung việc.
  - Chỉ "Xoá các việc đã xong" mới hỏi xác nhận (N2).

## Ngoài phạm vi

- **Gắn việc với bệnh nhân**: Could (§11), để sau.
- **Thông báo, nhắc việc**: Won't (D15).
- **Lưu nháp việc khi mất mạng** (như ghi chú): chưa làm. Chữ đang gõ vẫn nằm trong ô cho tới khi thêm được; đóng tab lúc mất mạng thì mất dòng đang gõ. Một việc ngắn, gõ lại nhanh.
- **Kéo thả để sắp xếp, việc lặp lại, danh mục**: chưa làm, đúng tinh thần "đơn giản" của D5.
- **Hiện việc quá hạn ở tab hay màn hình chính** (huy hiệu số): chưa làm.
