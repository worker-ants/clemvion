import { expect, test, type Page, type Request } from "@playwright/test";
import { mockAuth, PAGE_READY_TIMEOUT } from "../helpers/mock-auth";

/**
 * e2e: 보안 설정의 Passkey 삭제 (CLE-ACCT-SIGNIN-PASSKEY 「Passkey 삭제」, CLE-T-Q6E11N).
 *
 * 삭제도 계정 비밀번호를 다시 확인한다. 브라우저 confirm 대신 비밀번호를 받는 대화상자를 열고,
 * 비밀번호를 본문으로 보내야 해서 DELETE 대신 `POST …/credentials/:id/delete` 를 부른다.
 * 백엔드 동작(401 PASSWORD_* · 503 먼저 · 분당 10회)은 backend e2e `webauthn-2fa` W 가 맡는다.
 */

const CREDENTIAL = {
  id: "cred-1",
  deviceName: "회사 노트북",
  transports: ["internal"],
  lastUsedAt: null,
  createdAt: "2026-11-01T09:00:00.000Z",
};

interface DeleteMock {
  /** `POST …/cred-1/delete` 로 받은 본문들. */
  deleteBodies: unknown[];
  /** 옛 `DELETE …/credentials/:id` 요청. 없어야 한다. */
  legacyDeletes: Request[];
}

async function mockPasskeyApi(
  page: Page,
  respondDelete: (attempt: number) => { status: number; body?: unknown },
): Promise<DeleteMock> {
  const mock: DeleteMock = { deleteBodies: [], legacyDeletes: [] };
  let deleted = false;

  await page.route("**/api/auth/2fa/webauthn/availability", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { enabled: true } }),
    }),
  );
  await page.route("**/api/auth/2fa/webauthn/credentials", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { items: deleted ? [] : [CREDENTIAL] },
      }),
    }),
  );
  await page.route("**/api/auth/2fa/webauthn/credentials/*", (route) => {
    if (route.request().method() === "DELETE") {
      mock.legacyDeletes.push(route.request());
      return route.fulfill({ status: 404 });
    }
    return route.fallback();
  });
  await page.route(
    "**/api/auth/2fa/webauthn/credentials/cred-1/delete",
    (route) => {
      mock.deleteBodies.push(route.request().postDataJSON());
      const { status, body } = respondDelete(mock.deleteBodies.length);
      if (status === 204) deleted = true;
      return route.fulfill({
        status,
        contentType: "application/json",
        body: body === undefined ? "" : JSON.stringify(body),
      });
    },
  );
  return mock;
}

async function openDeleteDialog(page: Page) {
  await page.goto("/profile/security");
  await expect(page.getByText("회사 노트북")).toBeVisible({
    timeout: PAGE_READY_TIMEOUT,
  });
  await page
    .getByRole("button", { name: /이 인증기 삭제|Delete this authenticator/i })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Passkey 삭제는 비밀번호를 다시 확인한다", () => {
  test("틀린 비밀번호는 안내 뒤 대화상자에 남고, 맞는 비밀번호로 POST …/delete 해 목록에서 지운다", async ({
    page,
  }) => {
    await mockAuth(page);
    const mock = await mockPasskeyApi(page, (attempt) =>
      attempt === 1
        ? {
            status: 401,
            body: { code: "PASSWORD_INVALID", message: "Invalid password" },
          }
        : { status: 204 },
    );
    const dialog = await openDeleteDialog(page);
    const password = dialog.getByLabel(
      /계정 비밀번호 확인|Confirm your account password/i,
    );
    const submit = dialog.getByRole("button", { name: /^(삭제|Delete)$/i });

    await password.fill("WrongP@ss1");
    await submit.click();
    await expect(
      page.getByText(/비밀번호가 맞지 않아요|The password is incorrect/i),
    ).toBeVisible();
    await expect(dialog).toBeVisible();

    await password.fill("RightP@ss1");
    await submit.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("회사 노트북")).toBeHidden();

    expect(mock.deleteBodies).toEqual([
      { password: "WrongP@ss1" },
      { password: "RightP@ss1" },
    ]);
    expect(mock.legacyDeletes).toHaveLength(0);
  });

  test("비밀번호가 없는 계정은 비밀번호 재설정으로 먼저 설정하라고 안내한다", async ({
    page,
  }) => {
    await mockAuth(page);
    const mock = await mockPasskeyApi(page, () => ({
      status: 401,
      body: { code: "PASSWORD_REQUIRED", message: "Password required" },
    }));
    const dialog = await openDeleteDialog(page);

    await dialog
      .getByLabel(/계정 비밀번호 확인|Confirm your account password/i)
      .fill("Anything1!");
    await dialog.getByRole("button", { name: /^(삭제|Delete)$/i }).click();

    await expect(
      page.getByText(/비밀번호 재설정으로 먼저|Set one first with password reset/i),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.getByText("회사 노트북").first()).toBeVisible();
    expect(mock.deleteBodies).toHaveLength(1);
  });
});
