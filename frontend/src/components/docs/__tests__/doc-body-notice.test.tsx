import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DocBodyNotice } from "../doc-body-notice";

describe("DocBodyNotice", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when the page has a translated body (no fallback)", () => {
    const { container } = render(<DocBodyNotice fellBackToKorean={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Korean-body notice only when we fell back to KO", () => {
    const { container } = render(<DocBodyNotice fellBackToKorean={true} />);
    // Presence is what matters here — exact wording depends on the active
    // dictionary (ko/en). The fellBackToKorean prop is the real gate under test.
    expect(container.firstChild).not.toBeNull();
    expect((container.textContent ?? "").length).toBeGreaterThan(0);
  });
});
