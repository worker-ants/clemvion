import { describe, it, expect } from "vitest";
import { canReRun } from "../can-rerun";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";

/** 권한 매트릭스 (spec/5-system/13-replay-rerun.md §RR-PL-06). */
describe("canReRun", () => {
  const ME = "user-me";
  const OTHER = "user-other";

  function user(role: WorkspaceRole | null, id: string | null = ME) {
    return { id, role };
  }

  it("viewer 는 자신의 실행이어도 거부", () => {
    expect(canReRun(user("viewer"), { executedBy: ME })).toBe(false);
  });

  it("워크스페이스 멤버 아님(role=null) 은 거부", () => {
    expect(canReRun(user(null), { executedBy: ME })).toBe(false);
  });

  it("editor 는 자신이 시작한 실행을 허용", () => {
    expect(canReRun(user("editor"), { executedBy: ME })).toBe(true);
  });

  it("editor 는 타인이 시작한 실행을 거부", () => {
    expect(canReRun(user("editor"), { executedBy: OTHER })).toBe(false);
  });

  it("editor 는 시작자 없는 자동 실행(executedBy=null) 을 허용", () => {
    expect(canReRun(user("editor"), { executedBy: null })).toBe(true);
    expect(canReRun(user("editor"), {})).toBe(true);
  });

  it("admin 은 타인의 실행도 허용", () => {
    expect(canReRun(user("admin"), { executedBy: OTHER })).toBe(true);
  });

  it("owner 는 타인의 실행도 허용", () => {
    expect(canReRun(user("owner"), { executedBy: OTHER })).toBe(true);
  });

  it("admin 은 자동 실행도 허용", () => {
    expect(canReRun(user("admin"), { executedBy: null })).toBe(true);
  });

  it("editor 인데 currentUserId 가 null 이면 타인 실행으로 간주해 거부", () => {
    expect(canReRun(user("editor", null), { executedBy: ME })).toBe(false);
  });
});
