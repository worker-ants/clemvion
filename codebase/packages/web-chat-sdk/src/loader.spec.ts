/**
 * @jest-environment jsdom
 */
import { afterEach } from "@jest/globals";
import { createGlobalApi, installGlobal, type QueueStub } from "./loader";
import type { ChatInstance } from "./types";

afterEach(() => {
  // 전역 오염 정리.
  delete (window as unknown as { ClemvionChat?: unknown }).ClemvionChat;
});

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
    on: () => {
      calls.push("on");
      return () => void calls.push("unsub");
    },
    off: () => void calls.push("off"),
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

  it("모든 instance 메서드 위임", () => {
    const inst = fakeInstance();
    const api = createGlobalApi(() => inst);
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    api("show");
    api("hide");
    api("close");
    api("updateProfile", { plan: "pro" });
    api("on", "message", () => {});
    expect(inst.calls).toEqual(["show", "hide", "close", "updateProfile", "on"]);
  });

  it("on: callback 누락 시 throw 없이 warn", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const inst = fakeInstance();
    const api = createGlobalApi(() => inst);
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    api("on", "message"); // callback 없음
    expect(inst.calls).not.toContain("on");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("off 위임 — off(event) / off(event, cb)", () => {
    const inst = fakeInstance();
    const api = createGlobalApi(() => inst);
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    api("off", "message");
    api("off", "unread", () => {});
    expect(inst.calls).toEqual(["off", "off"]);
  });

  it("알 수 없는 메서드 → throw 없이 warn(호스트 중단 방지)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const api = createGlobalApi(() => fakeInstance());
    expect(() => api("nope")).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("boot 재호출 시 이전 인스턴스 shutdown 후 재할당(누수 방지)", () => {
    const first = fakeInstance();
    const second = fakeInstance();
    const insts = [first, second];
    const api = createGlobalApi(() => insts.shift()!);
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    expect(first.calls).toContain("shutdown");
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

  it("스니펫 미실행(window.ClemvionChat 없음) → 빈 큐로 설치", () => {
    const inst = fakeInstance();
    delete (window as unknown as { ClemvionChat?: unknown }).ClemvionChat;
    const api = installGlobal(window, () => inst);
    expect(typeof api).toBe("function");
    api("boot", { apiBase: "a", triggerEndpointPath: "t" });
    api("open");
    expect(inst.calls).toEqual(["open"]);
  });

  it("중복 install → 재설치/재replay 하지 않음", () => {
    const inst = fakeInstance();
    delete (window as unknown as { ClemvionChat?: unknown }).ClemvionChat;
    const first = installGlobal(window, () => inst);
    const second = installGlobal(window, () => fakeInstance());
    expect(second).toBe(first); // 동일 dispatcher
  });

  it("data-global: 커스텀 전역명에 설치", () => {
    const inst = fakeInstance();
    const w = window as unknown as Record<string, unknown>;
    delete w.SupportChat;
    installGlobal(window, () => inst, "SupportChat");
    expect(typeof w.SupportChat).toBe("function");
    (w.SupportChat as (m: string, ...a: unknown[]) => unknown)("boot", {
      apiBase: "a",
      triggerEndpointPath: "t",
    });
    (w.SupportChat as (m: string, ...a: unknown[]) => unknown)("open");
    expect(inst.calls).toEqual(["open"]);
    delete w.SupportChat;
  });

  it("점유 가드: 비-함수 전역이 점유 중이면 덮어쓰지 않고 warn", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const w = window as unknown as Record<string, unknown>;
    w.ClemvionChat = { foreign: true }; // 호스트가 이미 동명 객체 사용
    const api = installGlobal(window, () => fakeInstance());
    expect(warn).toHaveBeenCalled();
    // 전역은 보존(silent overwrite 금지)
    expect(w.ClemvionChat).toEqual({ foreign: true });
    // 반환된 분리 인스턴스는 동작(전역 미설치)
    expect(typeof api).toBe("function");
    warn.mockRestore();
  });
});

describe("installGlobal — boot 예외 및 off 엣지 케이스 (Info#16, Info#17)", () => {
  it("boot 예외 발생 시 큐 replay 중 오류 흡수 후 다음 항목 계속 실행 (Info#16)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const inst = fakeInstance();
    let callCount = 0;
    const bootFn = () => {
      callCount++;
      if (callCount === 1) throw new Error("boot failed");
      return inst;
    };

    const stub = ((...a: unknown[]) => {
      (stub as QueueStub).q!.push(a as [string, ...unknown[]]);
    }) as QueueStub;
    stub.q = [];
    (window as unknown as { ClemvionChat: QueueStub }).ClemvionChat = stub;
    // Queue: first boot (throws), then open
    stub("boot", { apiBase: "a", triggerEndpointPath: "t" }); // will throw
    stub("open"); // boot 전 no-op (instance null)

    // replay should not throw; open runs but no instance → no-op
    expect(() => installGlobal(window, bootFn)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("boot 전 off 호출 시 throw 없음 (Info#17)", () => {
    const inst = fakeInstance();
    const api = createGlobalApi(() => inst);
    // No boot yet — off should silently no-op
    expect(() => api("off", "message")).not.toThrow();
    expect(inst.calls).toEqual([]);
  });
});
