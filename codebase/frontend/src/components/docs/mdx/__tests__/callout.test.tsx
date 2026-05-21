import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "ko" }) }),
}));

import { Callout } from "../callout";

async function renderCallout(props: Parameters<typeof Callout>[0]) {
  const element = await Callout(props);
  render(element);
}

describe("Callout", () => {
  it("renders the note variant with blue container styling", async () => {
    await renderCallout({ type: "note", children: "본문" });
    const aside = screen.getByRole("note");
    expect(aside.className).toContain("border-blue-500/40");
  });

  it("renders the tip variant with emerald container", async () => {
    await renderCallout({ type: "tip", children: "본문" });
    expect(screen.getByRole("note").className).toContain(
      "border-emerald-500/40",
    );
  });

  it("renders the warn variant with amber container", async () => {
    await renderCallout({ type: "warn", children: "본문" });
    expect(screen.getByRole("note").className).toContain("border-amber-500/50");
  });

  it("defaults to the note variant when type is omitted", async () => {
    await renderCallout({ children: "본문" });
    expect(screen.getByRole("note").className).toContain("border-blue-500/40");
  });

  it("falls back to note styling when type is unknown (regression: 'info' crash)", async () => {
    // MDX 작성자가 spec(`note | tip | warn`) 에서 벗어난 값을 적어도 render 가 throw 하지 않아야 한다.
    // CalloutType 유니온이 MDX 경계에서 강제되지 않으므로 런타임 fallback 이 마지막 안전망.
    await renderCallout({
      // @ts-expect-error — 의도된 잘못된 type. TS 가 직접 호출은 잡지만 MDX 는 못 잡는 사실을 표현.
      type: "info",
      children: "본문",
    });
    const aside = screen.getByRole("note");
    expect(aside.className).toContain("border-blue-500/40");
  });

  it("uses the explicit title when provided", async () => {
    await renderCallout({ type: "warn", title: "사용자 정의 제목", children: "본문" });
    expect(screen.getByText("사용자 정의 제목")).toBeInTheDocument();
  });

  it("renders children inside the aside", async () => {
    await renderCallout({ type: "note", children: "본문 텍스트" });
    expect(screen.getByText("본문 텍스트")).toBeInTheDocument();
  });
});
