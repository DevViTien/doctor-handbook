# Proposal

## Why

Phần tài khoản đã xong, nhưng bác sĩ đăng nhập vào vẫn chưa ghi được bệnh nhân nào: `/patients` vẫn là trang "đang được xây dựng". Danh bạ bệnh nhân là lý do app tồn tại (idea.md §1, G1). Mọi tính năng còn lại đều đứng trên nó: ghi chú, tìm kiếm, ảnh, thùng rác, sao lưu.

Module bệnh nhân lớn, nên được chia thành năm change nối tiếp nhau. Mỗi change ship được riêng và có mockup riêng:

| #   | Change                                 | Nội dung                                                                            |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | **`add-patient-records`** (change này) | Danh sách, thêm, xem chi tiết, sửa thông tin và tóm tắt                             |
| 2   | `add-patient-notes`                    | Ghi chú theo thời gian, nháp trên máy, "Đã lưu" / "Đang chờ mạng" (§10.6)           |
| 3   | `add-patient-search`                   | Ô tìm kiếm không dấu, tìm gần đúng, tìm trong tóm tắt và ghi chú, giọng nói (§10.2) |
| 4   | `add-patient-avatars`                  | Ảnh đại diện: chụp hoặc chọn, nén trên máy, bucket private (S5)                     |
| 5   | `add-patient-trash`                    | Xoá vào thùng rác, khôi phục trong 30 ngày (BR3)                                    |

Change này thuộc module **`patients`** (`src/modules/patients`). Nó đáp ứng các mục sau của idea.md:

- D7, BR1, N2, N4: chỉ bắt buộc họ tên, mọi trường khác không bắt buộc, có Mã bệnh nhân.
- §10.1: các trường; tuổi tự tính; nhập nhanh "45t"; số điện thoại bấm để gọi; tóm tắt tự nhận diện link.
- D6: phần Tóm tắt. Ghi chú theo thời gian thuộc change 2.
- BR2: gợi ý "Có phải người này?" khi trùng tên, không chặn.
- BR5, S3: bác sĩ chỉ thấy và sửa bệnh nhân của mình.
- S7, §4.3: danh sách chỉ hiện tên, tuổi, giới, quê; tóm tắt chỉ hiện ở màn hình chi tiết.
- P6: tuổi, giới, quê cạnh tên để phân biệt người trùng tên.
- §12.6: Bệnh nhân là màn hình mở đầu, nút thêm ở góc dưới.

## What Changes

- **Danh sách bệnh nhân** ở `/patients`, màn hình mở đầu của bác sĩ:
  - Mỗi dòng có chữ cái đầu, họ tên, và dòng phụ "Nam · 47 tuổi · Nghệ An". Phần nào chưa có thì bỏ qua.
  - Danh sách **không** hiện tóm tắt, số điện thoại hay mã bệnh nhân (S7).
  - Thêm hoặc sửa gần nhất ở trên, vì bác sĩ hay mở lại người vừa khám.
  - Đầu trang có số bệnh nhân. Nút **"Thêm bệnh nhân"** ở góc dưới, trong tầm ngón cái.
  - Sổ trống thì hiện hướng dẫn cùng nút thêm.
- **Thêm bệnh nhân** ở `/patients/new`:
  - Form có Họ tên (bắt buộc, con trỏ đặt sẵn), Năm sinh hoặc tuổi, Giới tính (Nam / Nữ / Khác), Quê quán, Số điện thoại, Mã bệnh nhân, Tóm tắt.
  - Gõ tên rồi bấm Enter là lưu được.
  - Lưu xong mở thẳng trang chi tiết. Không có hộp thoại xác nhận.
- **Ô "Năm sinh hoặc tuổi"** hiểu được ba cách nhập. Ngay dưới ô có dòng cho biết app hiểu là gì, ví dụ "Năm sinh 1981 · 45 tuổi".

  | Nhập         | Hiểu là          |
  | ------------ | ---------------- |
  | `1979`       | năm sinh         |
  | `45t`, `45`  | tuổi             |
  | `12/03/1979` | ngày sinh đầy đủ |

- **Gợi ý trùng tên (BR2)**:
  - Khi họ tên gõ vào trùng một bệnh nhân đã có (không phân biệt dấu, hoa thường) và năm sinh không khác nhau, form hiện "Có phải người này?".
  - Gợi ý kèm thẻ người đó và liên kết mở hồ sơ.
  - Không chặn: bấm "Lưu" vẫn thêm người mới.
- **Chi tiết bệnh nhân** ở `/patients/<id>`:
  - Họ tên, giới, tuổi kèm năm hoặc ngày sinh, quê.
  - Số điện thoại bấm để gọi, và mã bệnh nhân.
  - Thẻ **Tóm tắt**. Link `http(s)://` trong tóm tắt bấm được. Chưa có tóm tắt thì hiện lối "Thêm tóm tắt".
  - Nút "Sửa".
- **Sửa thông tin** ở `/patients/<id>/edit`: cùng form với lúc thêm, bấm "Lưu" rồi quay về chi tiết. Nếu bệnh nhân vừa được sửa ở thiết bị khác, form báo và **không ghi đè**. Chữ đang nhập vẫn còn.
- **Không mất chữ khi lưu thất bại**: mất mạng hay lỗi server thì form giữ nguyên mọi ô và báo cách làm tiếp. Khi máy báo mất mạng, form hiện sẵn dòng nhắc.
- **Riêng tư trên màn hình và URL**:
  - Tiêu đề tab không bao giờ chứa tên bệnh nhân.
  - URL chỉ chứa id ngẫu nhiên.
  - Không có toast mang dữ liệu bệnh nhân.
- **Tách dữ liệu theo bác sĩ**:
  - Mở id của bác sĩ khác, hay id không có thật, đều ra "Không tìm thấy bệnh nhân". Hai trường hợp không phân biệt được với nhau.
  - Lệnh sửa gửi id của người khác bị từ chối.
- Gỡ `FeaturePlaceholder` khỏi `/patients`.

## Capabilities

### New Capabilities

- `patient-records`: hồ sơ bệnh nhân của bác sĩ, gồm danh sách, thêm, xem chi tiết, sửa thông tin và tóm tắt. Capability này cũng quy định cách nhập năm sinh hoặc tuổi, gợi ý trùng tên, riêng tư trên màn hình, và việc tách dữ liệu theo bác sĩ.

### Modified Capabilities

(Không có.) `access-gate` đã quy định `/patients` là trang chính của bác sĩ. Các trang con `/patients/*` nằm trong khu vực bác sĩ, theo đúng quy tắc tiền tố đã có.

## Impact

- **Thiết kế**: mockup local `mockup/index.html` cho danh sách, form thêm/sửa, chi tiết, không tìm thấy. Có đủ các trạng thái, sáng/tối, điện thoại/máy tính. Người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.
- **Module `patients`** (mới có code):
  - `schemas.ts`, `constants.ts`, `types.ts`;
  - `birth.ts`: hiểu "1979 / 45t / 12/03/1979" và tính tuổi theo giờ Việt Nam;
  - `duplicates.ts`;
  - `server/queries.ts`, `server/mutations.ts`, `server/actions.ts` (`createFormAction`, `access: "doctor"`);
  - `components/`.
- **Route**: `src/app/(doctor)/patients/` gồm `page.tsx`, `error.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/not-found.tsx`, `[id]/loading.tsx`, `[id]/edit/page.tsx`. Thêm đường dẫn vào `src/config/routes.ts`.
- **Tầng dùng chung**:
  - `src/lib/text/linkify.ts` (mới): tách link `http(s)://` trong văn bản. Ghi chú ở change 2 sẽ dùng lại.
  - Dùng lại `normalizeVi`, `buildSearchText`, `InitialsAvatar`, `EmptyState`, `ErrorState`, `FormAlert`, `useOnlineStatus`, `formatDate`.
- **Database**:
  - Bảng `patients` đã có từ migration `0001`, nên **không đổi schema và không có migration**.
  - Mỗi lần thêm hoặc sửa đều tính lại `search_text` từ họ tên, quê, số điện thoại, mã bệnh nhân, để change tìm kiếm dùng được ngay.
- **Sao lưu**: module `backup` chưa có. Khi có, nó MUST gồm mọi cột của `patients` mà change này ghi. Ghi lại trong README module `backup`.
- **Thư viện và dịch vụ**: không thêm.
- **Bất biến**:
  - DAL lọc theo `auth.account.id` từ phiên. Action dựng bằng `createFormAction` với `access: "doctor"`. Không log dữ liệu bệnh nhân. Danh sách không hiện tóm tắt.
  - **N2 "lưu tự động"**: form hồ sơ dùng **một nút "Lưu"** (hoặc Enter), không tự lưu từng ô. Lý do:
    - Tạo bệnh nhân cần một thao tác dứt khoát. Tự lưu sẽ sinh ra hồ sơ rác khi bác sĩ mới gõ dở.
    - Thông tin hồ sơ ít khi sửa.
  - Phần cần ghi trong ≤ 10 giây là **ghi chú**, và ghi chú sẽ tự lưu kèm nháp ở change 2.
  - Không có hộp thoại xác nhận nào khi lưu, nên tinh thần N2 vẫn giữ.
  - Người dùng xác nhận cách hiểu này khi duyệt mockup (ghi vào design.md).

## Ngoài phạm vi

- **Ghi chú theo thời gian**, nháp IndexedDB, chỉ báo "Đã lưu / Đang chờ mạng": change 2 (`add-patient-notes`). Change này chỉ giữ chữ trên form khi lưu thất bại, không lưu nháp qua lần đóng tab.
- **Ô tìm kiếm, tìm bằng giọng nói, tìm gần đúng**: change 3 (`add-patient-search`). Danh sách ở change này chưa lọc được.
- **Ảnh đại diện**: change 4 (`add-patient-avatars`). Change này chỉ hiện chữ cái đầu.
- **Xoá bệnh nhân, thùng rác**: change 5 (`add-patient-trash`). Change này đã bỏ qua bệnh nhân có `deleted_at`, nên thùng rác thêm vào sau không phải sửa lại danh sách.
- **Phân trang, cuộn ảo**: vài trăm bệnh nhân mỗi bác sĩ (A1) thì hiện hết được. Change tìm kiếm sẽ xem lại.
- **Nhãn, ghim bệnh nhân; gắn việc cần làm với bệnh nhân**: Could, chưa làm (§11).
