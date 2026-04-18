import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DocBodyNotice } from "../doc-body-notice";
import { useLocaleStore } from "@/lib/stores/locale-store";

describe("DocBodyNotice", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });

  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("renders nothing for the Korean locale (body already matches)", () => {
    const { container } = render(<DocBodyNotice />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Korean-body notice for English users", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<DocBodyNotice />);
    expect(
      screen.getByText(/Body content is currently available in Korean only/i),
    ).toBeDefined();
  });
});
