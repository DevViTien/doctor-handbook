import { pgEnum } from "drizzle-orm/pg-core";

import { ACCESS_CODE_TYPES, ACCOUNT_ROLES, ACCOUNT_STATUSES, GENDERS } from "@/lib/enums";

export const accountRoleEnum = pgEnum("account_role", ACCOUNT_ROLES);
export const accountStatusEnum = pgEnum("account_status", ACCOUNT_STATUSES);
export const accessCodeTypeEnum = pgEnum("access_code_type", ACCESS_CODE_TYPES);
export const genderEnum = pgEnum("gender", GENDERS);
