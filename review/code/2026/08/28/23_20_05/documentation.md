# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 지정된 SoT(`codebase/frontend/eslint.config.mjs` 헤더)가 이번 정정(차단자 4개)을 반영하지 못해, 같은 오해(registry latest vs 우리 트리 pin)를 다음 사람에게 반복시킬 수 있다.
  - 위치: `codebase/frontend/eslint.config.mjs` (헤더 실측 표, `eslint-plugin-react-hooks 7.1.1` 행) — 이 파일은 이번 diff 에 포함되어 있지 않지만, 이번 PR 이 수정한 두 문서가 **이 파일을 정본(SoT)으로 명시 지목**한다: `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 기존 문구("해제 조건과 실측 표의 SoT: `codebase/frontend/eslint.config.mjs` 헤더", 해당 unified diff 상단 문맥 `183|` 줄 바로 아래)와 새 테스트 헤더 주석(`eslint10-unblock.test.ts` 게이트 `15|` 줄, "지금은 사람이 `codebase/frontend/eslint.config.mjs` 헤더의 실측 표를 보고 registry 를 다시 재야 안다").
  - 상세: `plan/in-progress/deps-peer-gating-and-eslint10.md` 는 이번 PR 에서 "우리 트리의 차단자는 셋이 아니라 넷이다"(게이트 `185`~`200` 줄)로 명시 정정했고, 새 가드(`eslint10-unblock-guard.ts` 게이트 `59`~`66` 줄)도 `eslint-plugin-react-hooks` 를 `kind: "ours"` 차단자로 등재했다. 그런데 실측해 보면 `codebase/frontend/eslint.config.mjs` 헤더는 여전히 옛 registry-latest 프레임 그대로다 — `eslint-plugin-react-hooks 7.1.1 peer eslint … || ^10.0.0 ← 이것만 10 지원` 이라고만 적혀 있고, 우리 트리가 `pnpm-workspace.yaml` 의 `eslint-plugin-react-hooks: 7.0.1` exact 핀 때문에 실제로는 아직 막혀 있다는 사실이 전혀 반영돼 있지 않다. 이 헤더가 "registry latest 만 보고 우리 트리를 안 봤다"는, 이번 정정이 지적한 바로 그 실수를 그대로 담고 있는 셈이다. 다음에 이 헤더만 보고 판단하는 사람은 (실제로 이전 라운드가 그랬듯) react-hooks 를 차단자에서 빼고 셋만 확인한 뒤 상향을 시도할 위험이 있다(자동 가드가 최종적으로 막아 주긴 하지만, 사람이 먼저 잘못된 결론에 도달하게 만드는 문서 drift다).
  - 제안: `codebase/frontend/eslint.config.mjs` 헤더의 실측 표에 4번째 행(우리 트리 pin 기준 `eslint-plugin-react-hooks: 7.0.1` → peer `^9.0.0`, 레버 = `pnpm-workspace.yaml` override 값 상향)을 추가하고, "registry latest" 와 "우리 트리 pin" 을 구분해서 적어라. plan 문서의 정정 블록을 그대로 요약 인용하면 된다.

- **[INFO]** `readLockfile()` 만 이 파일의 다른 모든 export 와 달리 JSDoc 이 없다 — 문서화 밀도가 갑자기 끊긴다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:174` (`export function readLockfile(): string {`)
  - 상세: 같은 파일의 `LOCKFILE`, `Blocker`, `BLOCKERS`, `PeerEntry`, `readPeerRanges`, `termMajorFloor`, `allowsEslint10` 은 전부 "왜" 까지 설명하는 두꺼운 JSDoc 을 갖고 있는데, 마지막 export 인 `readLockfile` 만 한 줄 주석조차 없다. 함수 자체는 자명하지만(단순 `fs.readFileSync` 래퍼), 파일 전체가 세워 둔 문서화 기준에서 보면 눈에 띄는 비대칭이다.
  - 제안: `/** 테스트 주입 지점 — 실제 lockfile 을 읽는다. */` 정도의 한 줄이면 충분하다.

## 요약

이번 diff(`eslint10-unblock-guard.ts` · `eslint10-unblock.test.ts` · `deps-peer-gating-and-eslint10.md`)는 문서화 관점에서 대체로 모범적이다 — 모든 공개 함수/타입에 "왜"를 설명하는 JSDoc이 있고, fail-closed 설계 근거·데이터 출처(lockfile vs require 불가) 근거·가드의 방향(캐너리, 차단 아님)·보장 범위(registry 아님, lockfile 유입 시점)까지 촘촘히 못 박아 두었으며, plan 문서의 정정도 이 저장소 관례대로 원문을 보존하고 하단에 취소선+화살표로 갱신했다. 다만 이번 정정이 지목한 실수(registry latest와 우리 트리 pin의 혼동)를 유발했던 원래 SoT 문서(`codebase/frontend/eslint.config.mjs` 헤더)가 diff 밖에 있다는 이유로 갱신되지 않아, 문서 간 정합성 공백이 남아 있다. 그 외에는 README/CHANGELOG/API 문서 갱신이 필요한 변경 없음(내부 CI 가드·plan 전용 변경, 사용자 영향 없음 — 이 저장소 CHANGELOG 관례와 일치).

## 위험도
LOW
