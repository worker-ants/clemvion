import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeEach,
} from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";

const writeText = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { SecretRevealBox, SECRET_AUTO_HIDE_MS } from "../secret-reveal-box";

const SECRET = "wsk_super_secret_value_1234567890";

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  useLocaleStore.setState({ locale: "en" });
  Object.assign(navigator, { clipboard: { writeText } });
});

afterEach(() => {
  cleanup();
  useLocaleStore.setState({ locale: "ko" });
  vi.useRealTimers();
});

describe("SecretRevealBox", () => {
  it("masks the secret by default (plaintext not in the DOM)", () => {
    render(
      <SecretRevealBox title="New secret" secret={SECRET} onDismiss={vi.fn()} />,
    );
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    // 마스킹은 고정 폭 bullet — 실제 길이를 노출하지 않는다.
    expect(screen.getByText("•".repeat(12))).toBeInTheDocument();
  });

  it("reveals the plaintext when the reveal button is clicked, and re-masks on toggle", () => {
    render(
      <SecretRevealBox title="New secret" secret={SECRET} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText(SECRET)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
  });

  it("calls onDismiss automatically after the auto-hide timeout", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <SecretRevealBox
        title="New secret"
        secret={SECRET}
        onDismiss={onDismiss}
      />,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SECRET_AUTO_HIDE_MS);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("clears the timer on unmount (no onDismiss after unmount)", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(
      <SecretRevealBox
        title="New secret"
        secret={SECRET}
        onDismiss={onDismiss}
      />,
    );
    unmount();
    vi.advanceTimersByTime(SECRET_AUTO_HIDE_MS);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("copies the real secret even while masked", () => {
    writeText.mockResolvedValueOnce(undefined);
    render(
      <SecretRevealBox title="New secret" secret={SECRET} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
  });
});
