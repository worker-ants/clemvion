import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "ko" as const,
}));

import { ConfirmDiffDialog } from "../confirm-diff-dialog";

function renderWith(
  props: Partial<React.ComponentProps<typeof ConfirmDiffDialog>> = {},
) {
  const onClose = vi.fn();
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  render(
    <ConfirmDiffDialog
      open
      changes={[
        { label: "이름", before: "Old Name", after: "New Name" },
        { label: "테마", before: "라이트", after: "다크" },
      ]}
      onClose={onClose}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onClose, onConfirm };
}

describe("ConfirmDiffDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDiffDialog
        open={false}
        changes={[]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders each change row with before/after values", () => {
    renderWith();
    expect(screen.getByTestId("diff-before-이름")).toHaveTextContent("Old Name");
    expect(screen.getByTestId("diff-after-이름")).toHaveTextContent("New Name");
    expect(screen.getByTestId("diff-before-테마")).toHaveTextContent("라이트");
    expect(screen.getByTestId("diff-after-테마")).toHaveTextContent("다크");
  });

  it("invokes onClose when [diff-cancel] is clicked", () => {
    const { onClose } = renderWith();
    fireEvent.click(screen.getByTestId("diff-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onConfirm when [diff-confirm] is clicked and disables it while pending", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn().mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    renderWith({ onConfirm });
    const saveBtn = screen.getByTestId("diff-confirm");
    fireEvent.click(saveBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(saveBtn).toBeDisabled());
    resolve();
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });

  it("re-enables the confirm button after onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("boom"));
    renderWith({ onConfirm });
    const saveBtn = screen.getByTestId("diff-confirm");
    fireEvent.click(saveBtn);
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });
});
