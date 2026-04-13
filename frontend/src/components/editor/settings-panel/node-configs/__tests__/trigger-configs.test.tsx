import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManualTriggerConfig } from "../trigger-configs";

describe("ManualTriggerConfig", () => {
  it("renders an empty parameter list initially", () => {
    const onChange = vi.fn();
    render(<ManualTriggerConfig config={{}} onChange={onChange} />);
    expect(screen.getByText(/Input Parameters/i)).toBeInTheDocument();
    expect(screen.queryByText(/Parameter 1/i)).not.toBeInTheDocument();
  });

  it("adds a new parameter via Add Parameter button", () => {
    const onChange = vi.fn();
    render(<ManualTriggerConfig config={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Add Parameter/i));
    expect(onChange).toHaveBeenCalledWith({
      parameters: [
        {
          name: "",
          type: "string",
          required: false,
          defaultValue: "",
          description: "",
        },
      ],
    });
  });

  it("edits parameter name", () => {
    const onChange = vi.fn();
    render(
      <ManualTriggerConfig
        config={{ parameters: [{ name: "x", type: "string" }] }}
        onChange={onChange}
      />,
    );
    const nameInput = screen.getByDisplayValue("x");
    fireEvent.change(nameInput, { target: { value: "orderId" } });
    expect(onChange).toHaveBeenCalledWith({
      parameters: [{ name: "orderId", type: "string" }],
    });
  });

  it("toggles required on and hides default input", () => {
    const onChange = vi.fn();
    render(
      <ManualTriggerConfig
        config={{ parameters: [{ name: "x", type: "string" }] }}
        onChange={onChange}
      />,
    );
    const checkbox = screen.getByLabelText(/Required/i);
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({
      parameters: [{ name: "x", type: "string", required: true }],
    });
  });

  it("removes parameter when trash button clicked", () => {
    const onChange = vi.fn();
    render(
      <ManualTriggerConfig
        config={{ parameters: [{ name: "a", type: "string" }] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Remove parameter 1/i));
    expect(onChange).toHaveBeenCalledWith({ parameters: [] });
  });
});
