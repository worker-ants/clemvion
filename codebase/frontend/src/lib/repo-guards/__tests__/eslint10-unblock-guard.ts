// frontend·channel-web-chat 의 "eslint 9 잔류" 해제 감시 — 파서·판정 순수 로직.
//
// 소비처는 형제 파일 `eslint10-unblock.test.ts`. 목적과 배치 근거는 그 파일 헤더에 있다.
// 본 모듈은 lockfile 에서 peer range 를 뽑고 "그 range 가 eslint 10 을 허용하는가" 만
// 판정한다 (단일 파일 다중 책임 회피 — 형제 가드들과 같은 분리 규약).

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./_shared";

export const LOCKFILE = path.join(ROOT, "pnpm-lock.yaml");

/**
 * frontend·channel-web-chat 을 eslint 9 에 붙잡아 두는 차단자 — **우리 트리 기준 4개**.
 *
 * ⚠️ **registry 기준과 다르다.** `#1219` 는 상류 latest 를 재서 차단자를 셋으로 적고
 * `eslint-plugin-react-hooks` 는 "이미 `^10.0.0` 을 넣어 차단자가 아니다" 라고 했다.
 * 그건 **registry latest(7.1.1)** 의 이야기다. 우리 트리에는 `pnpm-workspace.yaml` 의
 * `eslint-plugin-react-hooks: 7.0.1` **exact 핀**이 걸려 있고, 그 버전의 peer 상한은
 * `^9.0.0` 이다(2026-08-28 lockfile 실측). 즉 **우리 트리에서는 그것도 차단자**다.
 *
 * 이 구분이 가드의 정확성에 직결된다 — react-hooks 를 빼면 나머지 셋이 풀린 순간 이
 * 가드가 "해제됐다" 고 알리지만 실제로는 여전히 못 올린다. **넷을 다 봐야 그 주장이 참이다.**
 * (이 갭은 뮤테이션 검증 중 발견됐다. 무효 뮤턴트 하나가 설계 결함을 드러낸 사례다.)
 *
 * `eslint-config-next` 자신은 여기 없다. 그 peer 는 `>=9.0.0` 이라 형식상 eslint 10 을
 * 허용하는데 실제로는 아래 것들을 통해 막힌다 — **peer 를 그대로 믿으면 틀린다**는 것이
 * 이 상향에서 얻은 교훈이고, 그래서 판정 대상을 실제 차단자로 좁힌다.
 */
export type BlockerKind = "upstream" | "ours";

export interface Blocker {
  readonly name: string;
  /**
   * 푸는 **레버가 어디 있는가**.
   * `upstream` — 상류가 릴리스해야 풀린다. `ours` — 우리 override 핀이라 값만 올리면 된다.
   */
  readonly kind: BlockerKind;
  /** 실패 메시지에 실을 "그래서 무엇을 하면 되는가". */
  readonly lever: string;
}

export const BLOCKERS: readonly Blocker[] = [
  {
    name: "eslint-plugin-react",
    kind: "upstream",
    lever: "상류 릴리스 대기 — `eslint-config-next` 가 끌고 오는 전이 의존",
  },
  {
    name: "eslint-plugin-jsx-a11y",
    kind: "upstream",
    lever: "상류 릴리스 대기 — `eslint-config-next` 가 끌고 오는 전이 의존",
  },
  {
    name: "eslint-plugin-import",
    kind: "upstream",
    lever: "상류 릴리스 대기 — `eslint-config-next` 가 끌고 오는 전이 의존",
  },
  {
    name: "eslint-plugin-react-hooks",
    kind: "ours",
    lever:
      "`pnpm-workspace.yaml` 의 `eslint-plugin-react-hooks: 7.0.1` **exact 핀**을 올린다. " +
      "그 핀에는 근거 주석이 없다(`ef3617a79` pnpm 마이그레이션에서 유입) — 올리기 전에 " +
      "왜 exact 였는지부터 확인할 것",
  },
] as const;

export const BLOCKER_NAMES: readonly string[] = BLOCKERS.map((b) => b.name);

/** lockfile 에서 읽어낸 한 패키지의 peer 선언. */
export interface PeerEntry {
  /** lockfile 키의 버전 부분 — `eslint-plugin-react@7.37.5` 의 `7.37.5`. */
  readonly version: string;
  /** `peerDependencies.eslint` 원문. */
  readonly eslintPeer: string;
}

/**
 * `pnpm-lock.yaml` 의 `packages:` 절에서 `<name>@<version>` 항목의 `peerDependencies.eslint`
 * 를 뽑는다.
 *
 * **왜 lockfile 을 읽는가 — `require()` 가 안 되기 때문이다(실측).** 이 셋은 frontend 의
 * 전이 의존이라 pnpm 의 isolated node-linker 아래에서 `codebase/frontend` 기준으로
 * 해소되지 않는다(`MODULE_NOT_FOUND`). `eslint-config-next` 는 한 술 더 떠 `exports` 맵이
 * `./package.json` 을 막는다(`ERR_PACKAGE_PATH_NOT_EXPORTED`) — `eslint-plugin-unicorn@73`
 * 에서 이미 겪은 것과 같은 클래스다. lockfile 은 체크인돼 있고 네트워크가 필요 없으며
 * 이 저장소의 해소 결과에 대한 정본이라 그 셋 중 유일하게 성립하는 출처다.
 *
 * YAML 파서를 끌어오지 않고 줄 단위로 읽는다 — lockfile 은 6MB 급이고 필요한 것은
 * 최상위 `packages:` 아래 두 줄뿐이다. 들여쓰기 폭에 기대지 않도록 **키 줄의 형태**
 * (`  <name>@<ver>:`)와 그 블록 안의 `eslint:` 만 본다.
 */
export function readPeerRanges(
  lockText: string,
  names: readonly string[],
): Map<string, PeerEntry> {
  const wanted = new Set(names);
  const out = new Map<string, PeerEntry>();

  let current: { name: string; version: string } | null = null;
  let inPeerBlock = false;

  for (const raw of lockText.split("\n")) {
    // 최상위 패키지 키 — `  eslint-plugin-react@7.37.5:` (들여쓰기 2칸).
    const key = /^ {2}(?<name>@?[^@\s/]+(?:\/[^@\s]+)?)@(?<version>[^:\s]+):\s*$/.exec(raw);
    if (key?.groups) {
      const { name, version } = key.groups;
      current = wanted.has(name) ? { name, version } : null;
      inPeerBlock = false;
      continue;
    }
    if (!current) continue;

    if (/^ {4}peerDependencies:\s*$/.test(raw)) {
      inPeerBlock = true;
      continue;
    }
    // peerDependencies 형제 키(같은 4칸 들여쓰기)를 만나면 블록이 끝난 것이다.
    if (inPeerBlock && /^ {4}\S/.test(raw)) inPeerBlock = false;

    if (inPeerBlock) {
      const peer = /^ {6}eslint:\s*(?<range>.+?)\s*$/.exec(raw);
      if (peer?.groups) {
        // lockfile 은 `^3 || ^4` 처럼 따옴표 없이 쓰기도 하고 `'>=9'` 처럼 감싸기도 한다.
        const range = peer.groups.range.replace(/^['"]|['"]$/g, "");
        out.set(current.name, { version: current.version, eslintPeer: range });
        current = null;
        inPeerBlock = false;
      }
    }
  }
  return out;
}

/** semver range 한 항(term)이 허용하는 major 하한. 해석 불가면 null. */
function termMajorFloor(term: string): number | null {
  const m = /^(?<op>\^|~|>=|>)?\s*(?<major>\d+)/.exec(term.trim());
  if (!m?.groups) return null;
  return Number(m.groups.major);
}

/**
 * `||` 로 이어진 peer range 가 **eslint 10 을 허용하는가**.
 *
 * 판정 규칙 — 항 하나라도 10 을 받으면 참:
 *   - `^10` · `^10.4` → major 10 을 받는다.
 *   - `>=9` · `>=10.4` → 10 이상을 받는다(하한이 10 이하인 `>=`).
 *   - `^9.7` · `^8` → major 가 고정이므로 10 을 받지 않는다.
 *
 * **해석 불가는 예외로 던진다.** 조용히 `false`(=아직 막혀 있다)로 떨어뜨리면 상류가
 * 표기를 바꾼 순간 이 가드가 영원히 초록인 채 아무것도 감시하지 않는다 — 이 저장소가
 * `parseGteFloor` 에서 이미 배운 fail-closed 규약이다.
 */
export function allowsEslint10(range: string): boolean {
  const terms = range.split("||").map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) {
    throw new Error(`peer range 를 항으로 나눌 수 없다: ${JSON.stringify(range)}`);
  }
  return terms.some((term) => {
    const floor = termMajorFloor(term);
    if (floor === null) {
      throw new Error(
        `peer range 항을 해석할 수 없다: ${JSON.stringify(term)} (원문 ${JSON.stringify(range)}). ` +
          `상류 표기가 바뀌었다면 이 파서를 함께 갱신하라 — 통과시키지 않는다.`,
      );
    }
    if (/^(>=|>)/.test(term)) return floor <= 10;
    // `^`·`~`·연산자 없음 → major 고정.
    return floor === 10;
  });
}

export function readLockfile(): string {
  return fs.readFileSync(LOCKFILE, "utf8");
}
