import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { UnsearchableBanner } from "../unsearchable-banner";

function setRole(role: "owner" | "admin" | "editor" | "viewer" | null) {
  useWorkspaceStore.setState({
    workspaces: role
      ? [{ id: "ws-1", name: "Test", type: "team", slug: "team-1", role }]
      : [],
    currentWorkspaceId: role ? "ws-1" : null,
    loaded: true,
  });
}

describe("UnsearchableBanner", () => {
  beforeEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.getState().reset();
  });

  it("idle + editor: shows 're-embedding required' and a 'Re-embed now' CTA that calls onReembed", () => {
    setRole("editor");
    const onReembed = vi.fn();
    render(
      <UnsearchableBanner reembedStatus="idle" onReembed={onReembed} />,
    );

    expect(
      screen.getByText("Re-embedding required · not searchable"),
    ).toBeInTheDocument();

    const cta = screen.getByRole("button", { name: "Re-embed now" });
    fireEvent.click(cta);
    expect(onReembed).toHaveBeenCalledTimes(1);
  });

  it("idle + viewer: shows the warning text but NO CTA (re-embed is a write action)", () => {
    setRole("viewer");
    const onReembed = vi.fn();
    render(
      <UnsearchableBanner reembedStatus="idle" onReembed={onReembed} />,
    );

    expect(
      screen.getByText("Re-embedding required · not searchable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Re-embed now" }),
    ).toBeNull();
  });

  it("in_progress: shows 're-embedding…' progress text, no CTA, not the idle warning", () => {
    setRole("editor");
    const onReembed = vi.fn();
    render(
      <UnsearchableBanner reembedStatus="in_progress" onReembed={onReembed} />,
    );

    expect(screen.getByText("Re-embedding…")).toBeInTheDocument();
    expect(
      screen.queryByText("Re-embedding required · not searchable"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Re-embed now" }),
    ).toBeNull();
  });

  it("renders no manual dismiss (X) control — it is a state-driven auto-dismiss alert", () => {
    setRole("editor");
    render(
      <UnsearchableBanner reembedStatus="idle" onReembed={vi.fn()} />,
    );
    // Only the re-embed CTA button exists; no close/dismiss button.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("idle + editor + pending: CTA is disabled while a re-embed is in flight", () => {
    setRole("editor");
    render(
      <UnsearchableBanner reembedStatus="idle" onReembed={vi.fn()} pending />,
    );
    expect(
      screen.getByRole("button", { name: "Re-embed now" }),
    ).toBeDisabled();
  });

  it.each(["admin", "owner"] as const)(
    "%s (≥ editor) also sees the CTA — role hierarchy regression guard",
    (role) => {
      setRole(role);
      render(
        <UnsearchableBanner reembedStatus="idle" onReembed={vi.fn()} />,
      );
      expect(
        screen.getByRole("button", { name: "Re-embed now" }),
      ).toBeInTheDocument();
    },
  );

  it("renders the per-state description paragraph", () => {
    setRole("editor");
    const { rerender } = render(
      <UnsearchableBanner reembedStatus="idle" onReembed={vi.fn()} />,
    );
    expect(
      screen.getByText(/excluded from search because re-embedding has not run/),
    ).toBeInTheDocument();

    rerender(
      <UnsearchableBanner reembedStatus="in_progress" onReembed={vi.fn()} />,
    );
    expect(
      screen.getByText(/Re-embedding is in progress\. Search will be restored/),
    ).toBeInTheDocument();
  });
});
