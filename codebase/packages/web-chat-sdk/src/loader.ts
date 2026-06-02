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
        // 재호출 시 이전 인스턴스(iframe + window listener) 정리 후 재할당 — 누수 방지.
        instance?.shutdown();
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
      case "on": {
        const cb = args[1];
        if (typeof cb !== "function") {
          console.warn("[web-chat] on(event, callback): callback 함수가 필요합니다.");
          return undefined;
        }
        return instance?.on(args[0] as WidgetEvent, cb as (p: unknown) => void);
      }
      case "off": {
        // off(event) 또는 off(event, cb) — cb 생략 시 이벤트 전체 해제.
        const cb = args[1];
        return instance?.off(
          args[0] as WidgetEvent,
          typeof cb === "function" ? (cb as (p: unknown) => void) : undefined,
        );
      }
      default:
        // 공개 SDK — 미지원 메서드로 호스트 페이지를 중단시키지 않는다(throw 대신 warn).
        console.warn(`[web-chat] 알 수 없는 메서드: ${String(method)}`);
        return undefined;
    }
  };
}

type InstalledApi = GlobalApi & { __wcInstalled?: boolean };

/** 기본 전역명. loader `<script data-global>` 로 재지정 가능(2-sdk §1 전역명 충돌 방지). */
export const DEFAULT_GLOBAL_NAME = "ClemvionChat";

/** window 에 실제 dispatcher 설치 + 큐 스텁 replay. loader.js 진입점에서 호출.
 *  globalName: 전역 진입점 이름(기본 `ClemvionChat`). 호스트가 `data-global` 로 재지정 시 그 이름.
 *  동명 전역이 **큐 스텁이 아닌 다른 값**으로 점유돼 있으면 silent overwrite 하지 않고 경고 후 중단. */
export function installGlobal(
  win: Window = window,
  bootFn?: (c: BootConfig) => ChatInstance,
  globalName: string = DEFAULT_GLOBAL_NAME,
): GlobalApi {
  // 전역명이 동적이라 Window 인덱스 접근을 위해 캐스팅.
  const w = win as unknown as Record<string, unknown>;
  const existing = w[globalName] as (QueueStub & { __wcInstalled?: boolean }) | undefined;
  // 중복 로드 가드 — 이미 실제 dispatcher 가 설치됐으면 재설치/재replay 하지 않는다.
  if (typeof existing === "function" && existing.__wcInstalled) return existing as GlobalApi;
  // 점유 가드 — 함수(큐 스텁) 가 아닌 값이 점유 중이면 호스트 전역 오염 방지를 위해 덮어쓰지 않는다.
  if (existing !== undefined && typeof existing !== "function") {
    console.warn(
      `[web-chat] window.${globalName} 가 이미 다른 값으로 점유되어 있어 위젯을 설치하지 않습니다. ` +
        `loader <script> 에 data-global="<다른이름>" 으로 전역명을 지정하세요.`,
    );
    return createGlobalApi(bootFn); // 호스트 전역은 건드리지 않고 분리 인스턴스 반환(설치 안 함).
  }

  const api = createGlobalApi(bootFn) as InstalledApi;
  api.__wcInstalled = true;
  const queued = Array.isArray(existing?.q) ? existing!.q! : [];
  w[globalName] = api;
  // 스니펫이 boot 전 큐잉한 호출 순서대로 replay. 형식 불량/예외는 흡수하고 계속 진행.
  for (const call of queued) {
    if (!Array.isArray(call) || typeof call[0] !== "string") continue;
    try {
      api(call[0], ...call.slice(1));
    } catch (e) {
      console.warn("[web-chat] 큐 replay 중 오류", e);
    }
  }
  return api;
}
