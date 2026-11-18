import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION } from "@/modules/backup/constants";
import type { BackupFileInput } from "@/modules/backup/types";

/** A small valid backup for unit tests (two patients, one in the trash; three notes). */
export const PATIENT_AN = "0b5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a01";
export const PATIENT_BINH = "0b5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a02";

export function sampleBackup(): BackupFileInput {
  return {
    manifest: {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: "0.1.0",
      exportedAt: "2026-11-10T01:30:00.000Z",
      account: { username: "bs.lan" },
      counts: { patients: 2, notes: 3, todos: 1, images: 0 },
    },
    data: {
      patients: [
        {
          id: PATIENT_AN,
          fullName: "Nguyễn Văn An",
          birthYear: 1979,
          birthDate: "1979-03-12",
          gender: "male",
          hometown: "Nghệ An",
          phone: "0912 345 678",
          patientCode: "BN-001",
          summary: "Dị ứng Penicillin",
          createdAt: "2026-10-01T02:00:00.000Z",
          updatedAt: "2026-10-02T02:00:00.000Z",
          deletedAt: null,
        },
        {
          id: PATIENT_BINH,
          fullName: "Trần Thị Bình",
          birthYear: null,
          birthDate: null,
          gender: null,
          hometown: null,
          phone: null,
          patientCode: null,
          summary: null,
          createdAt: "2026-10-03T02:00:00.000Z",
          updatedAt: "2026-10-03T02:00:00.000Z",
          deletedAt: "2026-11-05T02:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "1c5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a01",
          patientId: PATIENT_AN,
          content: "HA 150/90",
          createdAt: "2026-10-01T03:00:00.000Z",
          updatedAt: "2026-10-04T03:00:00.000Z",
        },
        {
          id: "1c5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a02",
          patientId: PATIENT_AN,
          content: "Tái khám sau 2 tuần",
          createdAt: "2026-10-05T03:00:00.000Z",
          updatedAt: "2026-10-05T03:00:00.000Z",
        },
        {
          id: "1c5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a03",
          patientId: PATIENT_BINH,
          content: "Đau đầu",
          createdAt: "2026-10-06T03:00:00.000Z",
          updatedAt: "2026-10-06T03:00:00.000Z",
        },
      ],
      todos: [
        {
          id: "2c5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a01",
          content: "Gọi lại cho phòng xét nghiệm",
          dueDate: "2026-11-20",
          completedAt: null,
          createdAt: "2026-11-01T03:00:00.000Z",
          updatedAt: "2026-11-01T03:00:00.000Z",
        },
      ],
    },
  };
}
