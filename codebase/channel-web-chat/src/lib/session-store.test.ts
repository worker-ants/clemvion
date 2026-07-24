import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, loadSession, clearSession, type PersistedSession } from "./session-store";

const API = "https://api.example.com";

const endpoints = {
  stream: "/s",
  submit: "/i",
  status: "/st",
  cancel: "/c",
  refresh: "/r",
};

function session(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    executionId: "exec-1",
    token: "iext_abc",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    endpoints,
    apiBase: API,
    ...overrides,
  };
}

beforeEach(() => sessionStorage.clear());

describe("session-store", () => {
  it("save → load 라운드트립", () => {
    saveSession("trig-1", session());
    const loaded = loadSession("trig-1", API);
    expect(loaded?.executionId).toBe("exec-1");
    expect(loaded?.token).toBe("iext_abc");
    // apiBase 왕복도 단언 — 반환 객체를 필드별로 재구성하는 리팩터가 들어오면 누락을 잡는다.
    expect(loaded?.apiBase).toBe(API);
  });

  it("trigger 별 격리", () => {
    saveSession("trig-1", session({ executionId: "a" }));
    saveSession("trig-2", session({ executionId: "b" }));
    expect(loadSession("trig-1", API)?.executionId).toBe("a");
    expect(loadSession("trig-2", API)?.executionId).toBe("b");
  });

  it("미존재 → null", () => {
    expect(loadSession("none", API)).toBeNull();
  });

  it("만료 토큰 → null + 폐기", () => {
    saveSession("trig-1", session({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(loadSession("trig-1", API)).toBeNull();
    expect(sessionStorage.getItem("clemvion-web-chat:session:trig-1")).toBeNull();
  });

  it("clear 후 null", () => {
    saveSession("trig-1", session());
    clearSession("trig-1");
    expect(loadSession("trig-1", API)).toBeNull();
  });

  it("손상된 JSON → null", () => {
    sessionStorage.setItem("clemvion-web-chat:session:trig-1", "{bad");
    expect(loadSession("trig-1", API)).toBeNull();
  });


  // ── 발급 origin 바인딩 (재전송 시 옛 토큰 오전송 방지) ──────────────────────
  //
  // 세션은 **발급된 apiBase 에 묶인다**. `applyConfig` 재전송이 apiBase 를 바꾸면
  // `clientRef` 는 새 apiBase 로 교체되는데 저장 세션은 옛 origin 의 것이라, 바인딩이
  // 없으면 **옛 세션의 단명 토큰이 새 origin 으로 전송**될 수 있다(세션과 엔드포인트의
  // 축 분리). 불일치는 조용히 무시하지 않고 **폐기**한다 — 잘못된 origin 에 토큰을
  // 보내느니 새 대화를 시작하는 편이 안전하다.

  it("apiBase 불일치 → null + 폐기 (옛 토큰이 새 origin 으로 새지 않는다)", () => {
    saveSession("trig-1", session());
    expect(loadSession("trig-1", "https://evil.example.com")).toBeNull();
    // 폐기까지 확인 — null 만 반환하고 남겨두면 다음 로드에서 되살아난다.
    expect(sessionStorage.getItem("clemvion-web-chat:session:trig-1")).toBeNull();
  });

  it("apiBase 미기록(레거시 세션) → null + 폐기 (fail-safe)", () => {
    // 본 필드 도입 이전에 저장된 세션은 발급 origin 을 증명할 수 없다. "아마 같겠지" 로
    // 통과시키면 정확히 이 결함이 남으므로 폐기한다(최악의 비용 = 새 대화 1회).
    const legacy = session();
    delete (legacy as Partial<PersistedSession>).apiBase;
    sessionStorage.setItem("clemvion-web-chat:session:trig-1", JSON.stringify(legacy));
    expect(loadSession("trig-1", API)).toBeNull();
    expect(sessionStorage.getItem("clemvion-web-chat:session:trig-1")).toBeNull();
  });

  it("trailing slash 는 같은 origin 으로 본다", () => {
    // `apiBase` 는 호출부마다 슬래시 유무가 갈린다(기존 코드도 `.replace(/\/$/, "")` 로
    // 정규화). 이걸 불일치로 보면 정상 세션이 매번 폐기돼 가드가 무력화된다.
    saveSession("trig-1", session({ apiBase: "https://api.example.com/" }));
    expect(loadSession("trig-1", "https://api.example.com")?.executionId).toBe("exec-1");
  });

  it("경로가 다르면 불일치 (apiBase 는 `/api` 등 경로를 포함할 수 있다)", () => {
    saveSession("trig-1", session({ apiBase: "https://api.example.com/api" }));
    expect(loadSession("trig-1", "https://api.example.com/api-v2")).toBeNull();
  });

  it("기본 저장소 = sessionStorage (localStorage 아님 — 탭 종료 시 소거, §R6)", () => {
    localStorage.clear();
    saveSession("trig-1", session());
    expect(sessionStorage.getItem("clemvion-web-chat:session:trig-1")).not.toBeNull();
    expect(localStorage.getItem("clemvion-web-chat:session:trig-1")).toBeNull();
  });
});
