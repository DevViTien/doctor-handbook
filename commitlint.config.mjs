/** Conventional Commits: https://www.conventionalcommits.org */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "auth",
        "admin",
        "patients",
        "todos",
        "search",
        "backup",
        "ui",
        "db",
        "config",
        "deps",
        "docs",
        "ci",
      ],
    ],
  },
};

export default config;
