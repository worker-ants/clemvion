// 스니펫 로더 — 전역 ClemvionChat(method, payload) + 명령 큐. spec/7-channel-web-chat/2-sdk §1.
// 스니펫이 먼저 큐 스텁을 만들고(boot 전 호출 버퍼링), loader.js 가 로드되면 실제 dispatcher 로 교체·replay.

import { boot as defaultBoot } from "./index";
import type { BootConfig, ChatInstance, WidgetEvent } from "./types";

export type GlobalCall = [method: string, ...args: unknown[]];

/** 스니펫이 설치하는 큐 스텁 형태. */
export interface QueueStub {
  (method: string, ...args: unknown[]): void;
  q?: GlobalCall[];
}

export type GlobalApi = (method: string, ...args: unknown[]) => unknown;

/** 전역 함수 dispatcher 생성. boot 는 DI(테스트). */
export function createGlobalApi(bootFn: (c: BootConfig) => ChatInstance = defaultBoot): GlobalApi {
  let instance: ChatInstance | null = null;

  return function dispatch(method: string, ...args: unknown[]): unknown {
    switch (method) {
      case "boot":
        instance = bootFn(args[0] as BootConfig);
        return instance;
      case "shutdown":
        instance?.shutdown();
        instance = null;
        return undefined;
      case "open":
        return instance?.open();
      case "close":
        return instance?.close();
      case "show":
        return instance?.show();
      case "hide":
        return instance?.hide();
      case "sendMessage":
        return instance?.sendMessage(String(args[0] ?? ""));
      case "updateProfile":
        return instance?.updateProfile((args[0] as Record<string, unknown>) ?? {});
      case "on":
        return instance?.on(args[0] as WidgetEvent, args[1] as (p: unknown) => void);
      default:
        throw new Error(`[web-chat] 알 수 없는 메서드: ${method}`);
    }
  };
}

/** window 에 실제 dispatcher 설치 + 큐 스텁 replay. loader.js 진입점에서 호출. */
export function installGlobal(
  win: Window & { ClemvionChat?: QueueStub | GlobalApi } = window,
  bootFn?: (c: BootConfig) => ChatInstance,
): GlobalApi {
  const api = createGlobalApi(bootFn);
  const existing = win.ClemvionChat as QueueStub | undefined;
  const queued = existing?.q ?? [];
  win.ClemvionChat = api as GlobalApi;
  // 스니펫이 boot 전 큐잉한 호출 순서대로 replay.
  for (const [method, ...args] of queued) {
    api(method, ...args);
  }
  return api;
}
