import { expect, type Page, test } from "@playwright/test";

import { ACCOUNTS } from "./db";

type AccountKey = keyof typeof ACCOUNTS;

export function usernameInput(page: Page) {
  return page.getByLabel("Tên đăng nhập");
}

export function passwordInput(page: Page) {
  // `exact` so the "Hiện mật khẩu" toggle button is not matched.
  return page.getByLabel("Mật khẩu", { exact: true });
}

/** Fills and submits the login form, without waiting for the outcome. */
export async function submitLogin(page: Page, username: string, password: string) {
  await usernameInput(page).fill(username);
  await passwordInput(page).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

/**
 * The session cookie is `Secure` in production builds. Playwright's WebKit on Windows/Linux
 * drops Secure cookies on plain-HTTP localhost (Chromium does not), so tests that rely on staying
 * signed in cannot run on the iPhone project over HTTP. Real iPhones always use HTTPS. Every
 * other test still runs on WebKit.
 */
export function skipWhenSecureCookiesUnsupported(page: Page) {
  const browserName = page.context().browser()?.browserType().name();
  const baseURL = test.info().project.use.baseURL ?? "";
  test.skip(
    browserName === "webkit" && baseURL.startsWith("http://"),
    "Playwright WebKit drops Secure cookies on http://localhost; covered on Chromium",
  );
}

/** Logs a sample account in from /login and waits until it has left the login page. */
export async function loginAs(page: Page, key: AccountKey, path = "/login") {
  skipWhenSecureCookiesUnsupported(page);
  await page.goto(path);
  await submitLogin(page, ACCOUNTS[key].username, ACCOUNTS[key].password);
  await expect(page).not.toHaveURL(/\/login/);
}

export function formAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: /./ }).first();
}

/**
 * Waits for a failed login to settle: the error is shown AND React has reset the form (the
 * password is cleared after the action). Filling the next attempt earlier would race that reset.
 */
export async function expectLoginError(page: Page, message: string) {
  await expect(formAlert(page)).toHaveText(message);
  await expect(passwordInput(page)).toHaveValue("");
}
