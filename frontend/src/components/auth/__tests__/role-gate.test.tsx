import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleGate, useHasRole } from "../role-gate";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

function setupStore(role: "owner" | "admin" | "editor" | "viewer" | null) {
  useWorkspaceStore.setState({
    workspaces: role
      ? [
          {
            id: "ws-1",
            name: "Test",
            type: "team",
            slug: "team-1",
            role,
          },
        ]
      : [],
    currentWorkspaceId: role ? "ws-1" : null,
    loaded: true,
  });
}

describe("RoleGate", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  it("Editor는 minRole=editor 통과", () => {
    setupStore("editor");
    render(
      <RoleGate minRole="editor">
        <span>visible</span>
      </RoleGate>,
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("Viewer는 minRole=editor 차단, fallback 노출", () => {
    setupStore("viewer");
    render(
      <RoleGate minRole="editor" fallback={<span>nope</span>}>
        <span>visible</span>
      </RoleGate>,
    );
    expect(screen.queryByText("visible")).toBeNull();
    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("Admin은 minRole=admin 통과", () => {
    setupStore("admin");
    render(
      <RoleGate minRole="admin">
        <span>v</span>
      </RoleGate>,
    );
    expect(screen.getByText("v")).toBeInTheDocument();
  });

  it("Editor는 minRole=admin 차단", () => {
    setupStore("editor");
    render(
      <RoleGate minRole="admin">
        <span>v</span>
      </RoleGate>,
    );
    expect(screen.queryByText("v")).toBeNull();
  });

  it("워크스페이스 미선택은 모두 차단", () => {
    setupStore(null);
    render(
      <RoleGate minRole="viewer">
        <span>v</span>
      </RoleGate>,
    );
    expect(screen.queryByText("v")).toBeNull();
  });
});

describe("useHasRole", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  it("Owner는 admin 권한 보유", () => {
    setupStore("owner");
    function Probe() {
      return <span>{useHasRole("admin") ? "yes" : "no"}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("yes")).toBeInTheDocument();
  });

  it("Viewer는 editor 권한 없음", () => {
    setupStore("viewer");
    function Probe() {
      return <span>{useHasRole("editor") ? "yes" : "no"}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("no")).toBeInTheDocument();
  });
});
