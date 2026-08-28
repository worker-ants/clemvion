// Guard: frontend·channel-web-chat 의 "eslint 9 잔류" 가 **아직 필요한가**.
//
// ## 이 가드는 방향이 거꾸로다 — 차단이 아니라 캐너리다
//
// 보통의 가드는 "깨지면 실패" 다. 이건 **막던 것이 사라지면 실패**한다. 그 실패가 곧
// "이제 frontend 를 eslint 10 으로 올릴 수 있다" 는 통지다.
//
// 배경 — `#1219` 에서 eslint 9→10 을 11개 워크스페이스 중 **9개만** 올렸다. frontend 와
// channel-web-chat 은 `eslint-config-next` 가 끌고 오는 세 플러그인
// (`eslint-plugin-react` · `jsx-a11y` · `import`)이 peer 로 eslint 9 를 상한에 못 박아
// 막혔다. 그때 실제로 11개를 전부 올려 `--strict-peer-dependencies` 로 그 미충족을
// **관측하고** 되돌렸다.
//
// 그 상태의 문제는 **해제 시점을 아무도 모른다**는 것이다. 지금은 사람이
// `codebase/frontend/eslint.config.mjs` 헤더의 실측 표를 보고 registry 를 다시 재야 안다.
// `--strict-peer-dependencies` 는 **사후**에만 잡는다 — 누군가 올려 봐야 빨간불이 뜬다.
// 능동 신호가 없다. 이 파일이 그 신호다.
//
// ## 무엇을 보장하고 무엇을 보장하지 않는가 (넓게 읽히지 않도록 못 박는다)
//
// 보장 — **우리 트리의 그 세 플러그인이 여전히 eslint 10 을 배제한다**.
// 비보장 — registry 의 최신 버전이 어떤지는 **모른다**. 이 가드는 네트워크를 쓰지 않는다.
//
// 그래서 신호가 오는 시점은 "상류가 릴리스한 순간" 이 아니라 **"그 릴리스가 우리
// lockfile 에 들어온 순간"** 이다. 그 유입은 dependabot 이 담당한다(`eslint-config-next`
// 를 주간으로 올린다). 즉 두 축의 분업이다 — dependabot 이 가져오고, 이 가드가 "이제
// 풀렸다" 를 알린다. 이 가드를 registry 감시로 착각하면 안 된다.
//
// ## 왜 여기(frontend vitest)인가
//
// 차단 대상이 frontend·channel-web-chat 이고, 형제 가드
// `typescript-toolchain.test.ts`(같은 디렉터리)가 같은 성격의 툴체인 계약을 이미 여기서
// 지킨다. backend 쪽 대칭물은 `eslint-unicorn-peer.spec.ts`(jest)다.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BLOCKERS,
  BLOCKER_NAMES,
  allowsEslint10,
  readLockfile,
  readPeerRanges,
} from "./eslint10-unblock-guard";
import { ROOT } from "./_shared";

const NEXT_WORKSPACES = [
  "codebase/frontend/package.json",
  "codebase/channel-web-chat/package.json",
] as const;

describe("frontend·channel-web-chat 의 eslint 9 잔류 전제 (실측)", () => {
  it("두 워크스페이스가 여전히 eslint 9 를 선언한다 — 전제가 살아 있다", () => {
    for (const rel of NEXT_WORKSPACES) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(ROOT, rel), "utf8"),
      ) as { devDependencies?: Record<string, string> };
      const declared = pkg.devDependencies?.eslint;
      // vacuity 방지 — 선언이 사라지면 아래 비교가 의미를 잃는다.
      expect(typeof declared, `${rel} 에 eslint devDependency 가 없다`).toBe("string");
      expect(
        declared,
        `${rel} 이 이미 eslint 9 가 아니다(${declared}). 잔류가 풀렸다면 이 가드와 ` +
          "`codebase/frontend/eslint.config.mjs` 헤더의 실측 표를 함께 정리하라.",
      ).toMatch(/^\^?9(\.|$)/);
    }
  });

  // lockfile 은 6MB 급이다. `it.each` 안에서 읽으면 케이스마다 재파싱한다 — 한 번만 읽는다.
  const entries = readPeerRanges(readLockfile(), BLOCKER_NAMES);

  it.each(BLOCKERS)(
    "$name ($kind) 가 여전히 eslint 10 을 배제한다 — 배제가 풀리면 이 케이스가 RED 로 알린다",
    ({ name, kind, lever }) => {
      const entry = entries.get(name);

      // fail-closed — lockfile 에서 못 찾으면 "막는 것이 없다" 가 아니라 **구조가 바뀐 것**이다.
      // 조용히 통과시키면 이 가드는 그 순간부터 아무것도 감시하지 않는다.
      expect(
        entry,
        `${name} 를 pnpm-lock.yaml 에서 찾지 못했다. 의존 트리에서 빠졌거나 lockfile ` +
          "형식이 바뀐 것이다 — 둘 다 이 가드의 전제가 무너진 것이므로 통과시키지 않는다.",
      ).toBeDefined();

      expect(
        allowsEslint10(entry!.eslintPeer),
        `🎉 ${name}@${entry!.version} (${kind}) 의 peer 가 이제 eslint 10 을 허용한다 ` +
          `(${entry!.eslintPeer}).\n` +
          "    이건 결함이 아니라 **해제 신호**다.\n" +
          `    이 차단자의 레버: ${lever}\n` +
          "    다만 **차단자는 넷이다** — 나머지도 풀렸는지 확인한 뒤에야 올릴 수 있다.\n" +
          "    전부 풀렸다면 frontend·channel-web-chat 의 eslint 를 ^10 으로 올리고\n" +
          "    `codebase/frontend/eslint.config.mjs` 헤더의 실측 표와 이 가드를 정리하라.\n" +
          "    (plan/in-progress/deps-peer-gating-and-eslint10.md §2 해제 조건)",
      ).toBe(false);
    },
  );

  it("차단자 목록이 비어 있지 않다 — 비면 위 it.each 가 통째로 사라진다", () => {
    // vacuity 방지. `it.each([])` 는 0개 케이스로 **조용히 통과**하므로, 목록이 비는
    // 리팩터가 이 가드를 무력화해도 스위트는 초록이다.
    expect(BLOCKERS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("allowsEslint10 (합성)", () => {
  it("실제 차단자들의 range 를 배제로 읽는다", () => {
    // 2026-08-28 registry 실측값 그대로.
    expect(allowsEslint10("^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7")).toBe(false);
    expect(allowsEslint10("^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9")).toBe(false);
    expect(allowsEslint10("^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9")).toBe(false);
  });

  it("해제된 형태를 허용으로 읽는다", () => {
    // `eslint-plugin-react-hooks@7.1.1` 의 실제 값 — 이미 풀린 쪽.
    expect(
      allowsEslint10("^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0 || ^10.0.0"),
    ).toBe(true);
    expect(allowsEslint10("^10.0.0")).toBe(true);
    expect(allowsEslint10(">=10.4")).toBe(true);
    // `>=9` 는 10 을 **받는다** — `eslint-config-next` 의 `>=9.0.0` 이 열려 보이는 이유.
    expect(allowsEslint10(">=9.0.0")).toBe(true);
  });

  it("`~` 항도 major 고정으로 읽는다", () => {
    // 이 케이스가 없던 동안 `termMajorFloor` 의 정규식에서 `~` 를 지우는 뮤테이션이
    // **생존했다**(스위트 전부 GREEN). 연산자 하나하나가 별도 표면이다.
    expect(allowsEslint10("~9.5.0")).toBe(false);
    expect(allowsEslint10("~10.5.0")).toBe(true);
    expect(allowsEslint10("^8 || ~9.7")).toBe(false);
  });

  it("해석 불가한 항은 조용히 false 가 아니라 throw 다 (fail-closed)", () => {
    // 조용히 false 면 "아직 막혀 있다" 로 읽혀 가드가 영원히 초록이 된다.
    expect(() => allowsEslint10("latest")).toThrow(/해석할 수 없다/);
    expect(() => allowsEslint10("^9 || next")).toThrow(/해석할 수 없다/);
    expect(() => allowsEslint10("")).toThrow(/나눌 수 없다/);
  });
});

describe("readPeerRanges (합성)", () => {
  const SAMPLE = [
    "packages:",
    "",
    "  eslint-plugin-react@7.37.5:",
    "    resolution: {integrity: sha512-xxx}",
    "    engines: {node: '>=4'}",
    "    peerDependencies:",
    "      eslint: ^3 || ^8 || ^9.7",
    "",
    "  eslint-plugin-import@2.32.0:",
    "    resolution: {integrity: sha512-yyy}",
    "    peerDependencies:",
    "      '@typescript-eslint/parser': '*'",
    "      eslint: ^2 || ^9",
    "",
  ].join("\n");

  it("이름·버전·peer range 를 뽑는다", () => {
    const got = readPeerRanges(SAMPLE, ["eslint-plugin-react", "eslint-plugin-import"]);
    expect(got.get("eslint-plugin-react")).toEqual({
      version: "7.37.5",
      eslintPeer: "^3 || ^8 || ^9.7",
    });
    // peerDependencies 안에 eslint 아닌 키가 먼저 와도 건너뛰고 찾는다.
    expect(got.get("eslint-plugin-import")).toEqual({
      version: "2.32.0",
      eslintPeer: "^2 || ^9",
    });
  });

  it("요청하지 않은 패키지는 담지 않는다", () => {
    const got = readPeerRanges(SAMPLE, ["eslint-plugin-react"]);
    expect([...got.keys()]).toEqual(["eslint-plugin-react"]);
  });

  it("없는 패키지는 결과에 없다 — 호출부가 fail-closed 로 처리한다", () => {
    expect(readPeerRanges(SAMPLE, ["eslint-plugin-jsx-a11y"]).size).toBe(0);
  });

  it("`snapshots:` 섹션의 동명 키에 오염되지 않는다", () => {
    // 실측(2026-08-28): 실제 lockfile 에서 `eslint-plugin-react` 키 정규식이 **2건** 매칭된다
    // — `packages:` 의 `…@7.37.5:` 와 `snapshots:` 의 `…@7.37.5(eslint@9.39.4(jiti@2.7.0)):`.
    // 지금은 snapshots 항목에 `peerDependencies:` 가 없어 오염이 안 날 뿐이라 **우연히**
    // 안전했다. 아래 fixture 는 그 우연을 없애고 섹션 한정을 구조로 고정한다.
    const withSnapshots = [
      SAMPLE,
      "snapshots:",
      "",
      "  eslint-plugin-react@7.37.5(eslint@9.39.4(jiti@2.7.0)):",
      "    peerDependencies:",
      "      eslint: ^99 || ^100",
      "",
    ].join("\n");

    const got = readPeerRanges(withSnapshots, ["eslint-plugin-react"]);
    // `packages:` 값이 남아야 한다 — snapshots 의 `^99 || ^100` 에 덮이면 안 된다.
    expect(got.get("eslint-plugin-react")?.eslintPeer).toBe("^3 || ^8 || ^9.7");
  });

  it("`packages:` 밖에서 시작하는 문서는 아무것도 읽지 않는다", () => {
    // 섹션 추적이 사라지면(=항상 읽으면) 이 케이스가 RED 가 된다.
    const onlySnapshots = [
      "snapshots:",
      "",
      "  eslint-plugin-react@7.37.5(eslint@9.39.4):",
      "    peerDependencies:",
      "      eslint: ^10.0.0",
      "",
    ].join("\n");
    expect(readPeerRanges(onlySnapshots, ["eslint-plugin-react"]).size).toBe(0);
  });
});
