/**
 * 설치 대기 단계의 만료 안내 — NERV CLE-INT-OAUTH 「만료된 설치 대기 행은 상점 자리를 놓는다」, Task CLE-T-395HK2.
 *
 * 설치 기한이 지나 만료된(`install_timeout`) 설치 대기 행은 상점 자리를 놓으므로 그 행을 지우지 않아도 같은 상점을 다시
 * 등록할 수 있다. 이름은 놓지 않으므로 같은 이름이면 409 `INTEGRATION_NAME_TAKEN` 이다. 안내는 삭제를 요구하지 않고
 * 다시 등록하는 길과 이름 충돌을 알린다. 다른 이유로 끝난 행은 상세 화면으로 보내는 문구를 그대로 쓴다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { IntegrationDto } from "@/lib/api/integrations";
import { translate, type Locale } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "acme" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const pollMock = vi.fn();
vi.mock("@/lib/integrations/use-cafe24-pending-polling", () => ({
  useCafe24PendingPolling: () => pollMock(),
}));
vi.mock("@/lib/integrations/use-makeshop-pending-polling", () => ({
  useMakeshopPendingPolling: () => pollMock(),
}));

import { Cafe24PrivatePendingStep } from "../cafe24-private-pending-step";
import { MakeshopPendingStep } from "../makeshop-pending-step";

const STEPS = [
  ["Cafe24 Private", Cafe24PrivatePendingStep],
  ["MakeShop", MakeshopPendingStep],
] as const;

/** 언어마다 «삭제 없이 다시 등록» 과 «이름이 겹치면 바꾼다» 를 알아보는 구절, 그리고 삭제를 요구하는 옛 구절. */
const COPY: Record<
  Locale,
  { reRegister: RegExp; renameOnConflict: RegExp; deleteRequired: RegExp }
> = {
  ko: {
    reRegister: /이 통합을 지우지 않아도 같은 상점을 새로 등록할 수 있어요/,
    renameOnConflict: /이름이 겹치면 다른 이름으로 등록해 주세요/,
    deleteRequired: /삭제/,
  },
  en: {
    reRegister: /register the same store again without deleting this integration/,
    renameOnConflict: /If the name is taken, use a different name/,
    deleteRequired: /Delete/,
  },
};

function poll(overrides: Partial<IntegrationDto>): Partial<IntegrationDto> {
  return { id: "int-1", status: "pending_install", statusReason: null, ...overrides };
}

function renderStep(Step: (typeof STEPS)[number][1], locale: Locale) {
  render(
    <Step
      appUrl="https://app.example.com/install/tok"
      callbackUrl="https://app.example.com/callback"
      integrationId="int-1"
      t={(key, params) => translate(locale, key, params)}
    />,
  );
}

describe("설치 대기 단계 — 만료 안내", () => {
  beforeEach(() => {
    pollMock.mockReset();
  });
  afterEach(() => cleanup());

  describe.each(STEPS)("%s", (_name, Step) => {
    it.each(["ko", "en"] as const)(
      "%s — install_timeout 만료는 삭제 없이 같은 상점을 다시 등록하고 이름이 겹치면 바꾸라고 안내한다",
      (locale) => {
        pollMock.mockReturnValue({
          poll: poll({ status: "expired", statusReason: "install_timeout" }),
          timedOut: false,
          lastErrorMessage: null,
        });
        renderStep(Step, locale);

        const notice = screen.getByRole("status");
        expect(notice).toHaveTextContent(COPY[locale].reRegister);
        expect(notice).toHaveTextContent(COPY[locale].renameOnConflict);
        expect(notice).not.toHaveTextContent(COPY[locale].deleteRequired);
      },
    );

    it("다른 이유의 만료는 상세 화면 안내를 보인다", () => {
      pollMock.mockReturnValue({
        poll: poll({ status: "expired", statusReason: "token_expired" }),
        timedOut: false,
        lastErrorMessage: null,
      });
      renderStep(Step, "en");

      const notice = screen.getByRole("status");
      expect(notice).toHaveTextContent(/no longer pending/);
      expect(notice).not.toHaveTextContent(COPY.en.reRegister);
    });
  });
});
