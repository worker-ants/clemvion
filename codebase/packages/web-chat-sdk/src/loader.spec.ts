/**
 * @jest-environment jsdom
 */
import { createGlobalApi, installGlobal, type QueueStub } from "./loader";
import type { ChatInstance } from "./types";

function fakeInstance(): ChatInstance & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    open: () => void calls.push("open"),
    close: () => void calls.push("close"),
    show: () => void calls.push("show"),
    hide: () => void calls.push("hide"),
    sendMessage: (t: string) => void calls.push(`send:${t}`),
    updateProfile: () => void calls.push("updateProfile"),
    on: () => void calls.push("on"),
    shutdown: () => void calls.push("shutdown"),
  };
}

describe("createGlobalApi", () => {
  it("boot 후 메서드 호출이 인스턴스로 위임", () => {
    const inst = fakeInstance();
    const api = createGlobalApi(() => inst);
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    api("open");
    api("sendMessage", "안녕");
    expect(inst.calls).toEqual(["open", "send:안녕"]);
  });

  it("boot 전 메서드는 인스턴스 없음 → no-op", () => {
    const inst = fakeInstance();
    const api = createGlobalApi(() => inst);
    expect(() => api("open")).not.toThrow();
    expect(inst.calls).toEqual([]);
  });

  it("알 수 없는 메서드 → throw", () => {
    const api = createGlobalApi(() => fakeInstance());
    expect(() => api("nope")).toThrow(/알 수 없는 메서드/);
  });

  it("shutdown 후 인스턴스 해제", () => {
    const inst = fakeInstance();
    const api = createGlobalApi(() => inst);
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    api("shutdown");
    api("open"); // 해제됐으므로 no-op
    expect(inst.calls).toEqual(["shutdown"]);
  });
});

describe("installGlobal — 큐 스텁 replay", () => {
  it("스니펫이 큐잉한 호출을 순서대로 replay", () => {
    const inst = fakeInstance();
    // 스니펫 스텁 시뮬레이션
    const stub = ((...a: unknown[]) => {
      (stub as QueueStub).q!.push(a as [string, ...unknown[]]);
    }) as QueueStub;
    stub.q = [];
    (window as unknown as { ClemvionChat: QueueStub }).ClemvionChat = stub;

    stub("boot", { apiBase: "a", triggerEndpointPath: "t" });
    stub("open");
    stub("sendMessage", "큐");

    installGlobal(window, () => inst);
    expect(inst.calls).toEqual(["open", "send:큐"]);
    // 설치 후 새 호출도 동작
    (window as unknown as { ClemvionChat: (m: string, ...a: unknown[]) => unknown }).ClemvionChat("close");
    expect(inst.calls).toContain("close");
  });
});
