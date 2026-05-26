import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelSelectField } from "../model-select-field";
import type { ModelInfo } from "@/lib/api/llm-configs";

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

const MODELS: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4o", type: "chat" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", type: "chat" },
];

const defaultProps = {
  value: "",
  onChange: vi.fn(),
  models: [],
  errorMessage: null,
  isPending: false,
  canLoad: true,
  hasAttemptedLoad: false,
  load: vi.fn(),
  formatSavedFallback: (model: string) => `Saved: ${model}`,
  loadRequiredHint: "load-required-hint",
  loadedHint: "loaded-hint",
  testIdPrefix: "test-field",
};

function getSelect(): HTMLSelectElement {
  return screen.getByTestId("test-field-select") as HTMLSelectElement;
}

function getLoadButton(): HTMLButtonElement {
  return screen.getByTestId("test-field-load") as HTMLButtonElement;
}

function optionValues(): string[] {
  return Array.from(getSelect().options).map((o) => o.value);
}

describe("ModelSelectField", () => {
  it("renders the default option label (name (id) format) when renderOption is not provided", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={MODELS}
        hasAttemptedLoad={true}
      />,
    );

    expect(optionValues()).toContain("gpt-4o");
    expect(optionValues()).toContain("gpt-4o-mini");
    // default format: "name (id)"
    const options = Array.from(getSelect().options);
    const gpt4o = options.find((o) => o.value === "gpt-4o");
    expect(gpt4o?.textContent).toBe("GPT-4o (gpt-4o)");
  });

  it("uses renderOption to customise option text when provided", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={MODELS}
        hasAttemptedLoad={true}
        renderOption={(m) => `[custom] ${m.id}`}
      />,
    );

    const options = Array.from(getSelect().options);
    const gpt4o = options.find((o) => o.value === "gpt-4o");
    expect(gpt4o?.textContent).toBe("[custom] gpt-4o");
  });

  it("shows the isEmpty message when hasAttemptedLoad=true, models=[], no error", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={[]}
        hasAttemptedLoad={true}
        errorMessage={null}
        isPending={false}
      />,
    );

    // key returned as-is by the mock t()
    expect(screen.getByText("llmConfigs.noModelsFound")).toBeInTheDocument();
  });

  it("does NOT show the isEmpty message when isPending=true (no flicker)", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={[]}
        hasAttemptedLoad={true}
        errorMessage={null}
        isPending={true}
      />,
    );

    expect(screen.queryByText("llmConfigs.noModelsFound")).not.toBeInTheDocument();
  });

  it("shows the loadRequiredHint when no load has been attempted", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={[]}
        hasAttemptedLoad={false}
      />,
    );

    expect(screen.getByText("load-required-hint")).toBeInTheDocument();
  });

  it("shows the loadedHint after models are loaded", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={MODELS}
        hasAttemptedLoad={true}
      />,
    );

    expect(screen.getByText("loaded-hint")).toBeInTheDocument();
  });

  it("shows the error message and no isEmpty message when errorMessage is set", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={[]}
        hasAttemptedLoad={true}
        errorMessage="Something went wrong"
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText("llmConfigs.noModelsFound")).not.toBeInTheDocument();
  });

  it("disables both the select and the load button when disabled=true", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={MODELS}
        hasAttemptedLoad={true}
        disabled={true}
      />,
    );

    expect(getSelect()).toBeDisabled();
    expect(getLoadButton()).toBeDisabled();
  });

  it("disables the select when no models have been loaded", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={[]}
        hasAttemptedLoad={false}
      />,
    );

    expect(getSelect()).toBeDisabled();
  });

  it("enables the select when models are loaded and disabled is not set", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={MODELS}
        hasAttemptedLoad={true}
        value="gpt-4o"
      />,
    );

    expect(getSelect()).not.toBeDisabled();
  });

  it("calls onChange when a new option is selected", () => {
    const onChange = vi.fn();
    render(
      <ModelSelectField
        {...defaultProps}
        models={MODELS}
        hasAttemptedLoad={true}
        value="gpt-4o"
        onChange={onChange}
      />,
    );

    fireEvent.change(getSelect(), { target: { value: "gpt-4o-mini" } });
    expect(onChange).toHaveBeenCalledWith("gpt-4o-mini");
  });

  it("shows the saved-value placeholder option when the saved value is missing from loaded models", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        models={MODELS}
        hasAttemptedLoad={true}
        value="legacy-model-id"
        formatSavedFallback={(m) => `Saved: ${m}`}
      />,
    );

    expect(optionValues()).toContain("legacy-model-id");
    const savedOption = Array.from(getSelect().options).find(
      (o) => o.value === "legacy-model-id",
    );
    expect(savedOption?.textContent).toBe("Saved: legacy-model-id");
  });

  it("calls load when the load button is clicked", () => {
    const load = vi.fn();
    render(
      <ModelSelectField
        {...defaultProps}
        load={load}
      />,
    );

    fireEvent.click(getLoadButton());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("disables the load button when canLoad=false", () => {
    render(
      <ModelSelectField
        {...defaultProps}
        canLoad={false}
      />,
    );

    expect(getLoadButton()).toBeDisabled();
  });
});
