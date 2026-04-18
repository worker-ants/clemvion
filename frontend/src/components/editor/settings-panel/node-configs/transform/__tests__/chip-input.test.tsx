import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipInput } from "../chip-input";
import { useLocaleStore } from "@/lib/stores/locale-store";

beforeEach(() => {
  useLocaleStore.setState({ locale: "en" });
});

function setup(initial: string[] = []) {
  const onChange = vi.fn();
  render(<ChipInput values={initial} onChange={onChange} />);
  const input = screen.getByRole("textbox");
  return { onChange, input };
}

describe("ChipInput", () => {
  it("commits on Enter", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, "hello{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["hello"]);
  });

  it("commits on comma", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, "a,");
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("trims whitespace before committing", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, "  x  {Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["x"]);
  });

  it("ignores empty values", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, "{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    await user.type(input, "   {Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("prevents duplicate values", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup(["a"]);
    await user.type(input, "a{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes last chip on Backspace when draft empty", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup(["a", "b"]);
    input.focus();
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
  });

  it("commits on blur", async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, "abc");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(["abc"]);
  });

  it("renders existing chips and removes via × button", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(["foo", "bar"]);
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Remove foo/));
    expect(onChange).toHaveBeenLastCalledWith(["bar"]);
  });
});
