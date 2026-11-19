import {
  KeyRoundIcon,
  ListTodoIcon,
  type LucideIcon,
  MessageSquareTextIcon,
  SettingsIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import type { Route } from "next";

import { routes } from "@/config/routes";

export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

/** Bottom navigation for doctors. Order matters: the first item is the landing screen. */
export const doctorNavItems: readonly NavItem[] = [
  { href: routes.doctor.patients, label: "Bệnh nhân", icon: UsersIcon },
  { href: routes.doctor.todos, label: "Việc cần làm", icon: ListTodoIcon },
  { href: routes.doctor.settings, label: "Cài đặt", icon: SettingsIcon },
];

export const adminNavItems: readonly NavItem[] = [
  { href: routes.admin.accessCodes, label: "Mã truy cập", icon: KeyRoundIcon },
  { href: routes.admin.accounts, label: "Tài khoản", icon: UserCogIcon },
  { href: routes.admin.feedback, label: "Góp ý", icon: MessageSquareTextIcon },
];
