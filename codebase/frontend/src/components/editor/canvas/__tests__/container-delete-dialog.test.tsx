import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ContainerDeleteDialog } from "../container-delete-dialog";

// §11.3 컨테이너 삭제 확인 다이얼로그 — 라디오(Delete-all vs Ungroup, Ungroup 기본)
// + Cancel/Delete 동작. i18n 은 실제 dict 를 사용하므로 텍스트 대신 role/testid 로 질의.

afterEach(() => cleanup());

describe("ContainerDeleteDialog (§11.3)", () => {
  it("자식 수를 메시지에 표시하고 라디오 2개를 렌더한다 (Ungroup 기본 선택)", () => {
    render(
      <ContainerDeleteDialog
        containerLabel="Process Items"
        childCount={3}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // 컨테이너 라벨·자식 수가 표시된다.
    expect(screen.getByRole("dialog").textContent).toContain("Process Items");
    expect(screen.getByRole("dialog").textContent).toContain("3");
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    // DOM 순서: [deleteAll, ungroup]. 기본 선택은 ungroup(두 번째).
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
  });

  it("기본(Ungroup)으로 Delete 누르면 onConfirm('ungroup')", () => {
    const onConfirm = vi.fn();
    render(
      <ContainerDeleteDialog
        containerLabel="L"
        childCount={1}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("container-delete-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith("ungroup");
  });

  it("Delete-all 라디오 선택 후 Delete 누르면 onConfirm('deleteAll')", () => {
    const onConfirm = vi.fn();
    render(
      <ContainerDeleteDialog
        containerLabel="L"
        childCount={2}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    fireEvent.click(radios[0]); // deleteAll
    fireEvent.click(screen.getByTestId("container-delete-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith("deleteAll");
  });

  it("Cancel 버튼은 onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <ContainerDeleteDialog
        containerLabel="L"
        childCount={1}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    // Cancel 은 첫 번째 버튼 (variant outline). testid 없는 버튼 중 Delete 아닌 것.
    const buttons = screen.getAllByRole("button");
    const cancelBtn = buttons.find(
      (b) => b.getAttribute("data-testid") !== "container-delete-confirm-btn",
    )!;
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});
