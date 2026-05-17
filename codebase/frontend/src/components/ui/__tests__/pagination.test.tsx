import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { Pagination } from "../pagination";

describe("Pagination", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });
  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when totalPages is 0", () => {
    const { container } = render(
      <Pagination page={1} totalPages={0} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all page numbers when totalPages is small", () => {
    render(<Pagination page={2} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("disables prev on first page", () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  it("disables next on last page", () => {
    render(<Pagination page={5} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("calls onPageChange with the clicked number", async () => {
    const handler = vi.fn();
    render(<Pagination page={1} totalPages={5} onPageChange={handler} />);
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(handler).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange(page-1) when prev is clicked", async () => {
    const handler = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={handler} />);
    await userEvent.click(screen.getByLabelText("Previous page"));
    expect(handler).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange(page+1) when next is clicked", async () => {
    const handler = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={handler} />);
    await userEvent.click(screen.getByLabelText("Next page"));
    expect(handler).toHaveBeenCalledWith(4);
  });

  it("highlights the current page", () => {
    render(<Pagination page={3} totalPages={5} onPageChange={() => {}} />);
    const current = screen.getByRole("button", { name: "3" });
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders ellipsis when there are many pages — current near start", () => {
    render(<Pagination page={2} totalPages={20} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
    expect(screen.queryAllByText("…").length).toBeGreaterThan(0);
    // 1, 2, 3, 4, 5, …, 20 (no ellipsis on the left when current is near start)
    expect(screen.queryByRole("button", { name: "10" })).not.toBeInTheDocument();
  });

  it("renders ellipsis when there are many pages — current in middle", () => {
    render(<Pagination page={10} totalPages={20} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
    expect(screen.queryAllByText("…").length).toBe(2);
  });

  it("renders ellipsis when there are many pages — current near end", () => {
    render(<Pagination page={19} totalPages={20} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "19" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
    // No ellipsis on the right when current is near end
    expect(screen.queryByRole("button", { name: "10" })).not.toBeInTheDocument();
  });

  it("does not call onPageChange when clicking the current page", async () => {
    const handler = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={handler} />);
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(handler).not.toHaveBeenCalled();
  });
});
