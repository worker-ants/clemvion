// eslint-plugin-unicorn ↔ eslint peer 정합 가드 — 파서·비교 순수 로직.
//
// 소비처는 형제 파일 `eslint-unicorn-peer.spec.ts`. 배경·배치 근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 frontend 형제 가드
// `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` 와 동일하다 —
// 같은 저장소에서 같은 일을 하는 파서를 두 벌 두면 한쪽만 고쳐지는 드리프트가 생긴다.

export type SemverTriple = readonly [number, number, number];

/**
 * `>=X.Y.Z` 형태의 단일 하한 range 파싱(예: `eslint-plugin-unicorn` 의 `peerDependencies.eslint`).
 * 그 외 형태(복합 range·`^`·`~` 등)는 null — 호출부가 fail-closed 로 처리한다.
 */
export function parseGteFloor(range: string): SemverTriple | null {
  const m = /^\s*>=\s*(\d+)\.(\d+)\.(\d+)\s*$/.exec(range);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** `^X.Y.Z` caret range 의 하한(예: backend package.json 의 `devDependencies.eslint`). */
export function parseCaretFloor(range: string): SemverTriple | null {
  const m = /^\s*\^\s*(\d+)\.(\d+)\.(\d+)\s*$/.exec(range);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 순수 `X.Y.Z` 버전 문자열(설치본 실측, 예: `require('eslint/package.json').version`). */
export function parseVersion(version: string): SemverTriple | null {
  const m = /^\s*(\d+)\.(\d+)\.(\d+)\s*$/.exec(version);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 사전식(lexicographic) triple 비교 — a<b: 음수, a===b: 0, a>b: 양수. */
export function compareTriple(a: SemverTriple, b: SemverTriple): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** `version` 이 `floor` 이상인가. */
export function satisfiesFloor(
  version: SemverTriple,
  floor: SemverTriple,
): boolean {
  return compareTriple(version, floor) >= 0;
}
