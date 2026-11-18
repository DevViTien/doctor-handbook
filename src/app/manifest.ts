import type { MetadataRoute } from "next";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

/**
 * Web app manifest (spec app-install): installs the app on the home screen, opening straight on
 * the patient list, full screen. Icons are option A "Bìa sổ" (`pnpm icons` renders them).
 */
export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];
  return {
    id: "/",
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    lang: "vi",
    dir: "ltr",
    start_url: routes.doctor.patients,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: siteConfig.themeColor.light,
    theme_color: siteConfig.themeColor.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    // Long-press on the icon (Android). No patient data in them.
    shortcuts: [
      { name: "Thêm bệnh nhân", url: routes.doctor.newPatient, icons: shortcutIcon },
      { name: "Việc cần làm", url: routes.doctor.todos, icons: shortcutIcon },
    ],
  };
}
