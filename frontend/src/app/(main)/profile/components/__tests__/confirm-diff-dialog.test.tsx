import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDiffDialog } from "../confirm-diff-dialog";

function renderWith(props: Partial<React.ComponentProps<typeof ConfirmDiffDialog>> = {}) {
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

  it("invokes onClose when cancel is clicked", () => {
    const { onClose } = renderWith();
    fireEvent.click(screen.getByRole("button", { name: /취소|cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onConfirm when save is clicked and disables buttons while pending", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn().mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    renderWith({ onConfirm });
    const saveBtn = screen.getByRole("button", { name: /저장|save/i });
    fireEvent.click(saveBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(saveBtn).toBeDisabled());
    resolve();
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });
});
