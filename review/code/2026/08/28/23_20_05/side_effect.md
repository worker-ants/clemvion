# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `readLockfile()` / `readPeerRanges()` 는 파일시스템에서 **읽기만** 한다 (`fs.readFileSync`) — 쓰기·생성·삭제 없음. 의도된 관측(observability) 목적의 read-only I/O로 부작용 우려 없음.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:174-176` (`readLockfile`), `:94-134` (`readPeerRanges`)
  - 상세: `LOCKFILE`(`pnpm-lock.yaml`, 최대 ~6MB) 을 매 테스트 케이스마다(`it.each(BLOCKERS)` 4회) 동기적으로 전체 읽는다. 파일 변경/생성은 없다.
  - 제안: 없음 (문제 아님, 참고용 기록).

- **[INFO]** 신규 모듈 최상위 `export const` 3개(`LOCKFILE`, `BLOCKERS`, `BLOCKER_NAMES`) — 새 전역이지만 `readonly`/`as const` 로 선언되고 모듈 스코프에 한정돼 있어 기존 전역 상태를 건드리지 않는다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:11`(`LOCKFILE`), `:43-67`(`BLOCKERS`), `:69`(`BLOCKER_NAMES`)
  - 상세: `as const` 는 TS 타입 레벨 불변성만 보장하고 런타임 `Object.freeze` 는 아니므로 이론상 캐스팅을 통한 변형이 가능하나, 현재 소비처(테스트 파일)는 읽기만 하므로 실질 위험은 없음.
  - 제안: 조치 불요.

- **[INFO]** `_shared.ts` 의 기존 모듈 최상위 부작용(`export const ROOT = repoRoot()` — import 시점에 동기 파일시스템 탐색을 수행)이 이번 PR 이 추가한 두 신규 파일에 의해 새로운 소비처를 얻는다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:9` / `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:45` (둘 다 `import { ROOT } from "./_shared"`)
  - 상세: `_shared.ts` 자체는 이번 diff 에 포함되지 않은 기존 파일이며, 다른 형제 가드들도 이미 같은 방식으로 import 하고 있어 새로운 부작용 패턴이 아니라 기존 관례의 재사용이다.
  - 제안: 조치 불요 (기록 목적).

- **[INFO]** 신규 테스트 파일이 `codebase/frontend/package.json` · `codebase/channel-web-chat/package.json` 을 읽어 `devDependencies.eslint` 값을 단언한다 — 읽기 전용, 두 파일에 대한 쓰기 없음.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:54-65`
  - 상세: `fs.readFileSync` + `JSON.parse` 뿐이며 부수효과 없음.
  - 제안: 조치 불요.

- **[INFO]** `allowsEslint10()` / `termMajorFloor()` 는 순수 함수(입력 → 출력, 외부 상태 참조·변경 없음). 해석 불가 시 `throw` 하는 설계는 부작용이 아니라 명시적 fail-closed 정책(문서화됨).
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:137-141`(`termMajorFloor`), `:155-172`(`allowsEslint10`)
  - 상세: 신규 함수이므로 기존 시그니처 변경도 아니고 기존 호출자 영향도 없음(완전히 새 모듈, 소비처는 동봉된 신규 테스트뿐).
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/deps-peer-gating-and-eslint10.md` 변경분은 문서(정정 주석 + 체크리스트 갱신)뿐이며 코드 실행 경로에 영향 없음.
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` (§2 정정 블록, 체크리스트 §완료 표시)
  - 상세: 부작용 관점에서 검토 대상 아님.
  - 제안: 조치 불요.

## 요약
이번 변경은 신규 파일 2개(순수 판정 로직 + 이를 소비하는 vitest 스위트)와 plan 문서 갱신으로 구성되며, 기존 프로덕션 코드의 시그니처·공개 인터페이스·전역 상태·환경 변수·네트워크 호출·이벤트/콜백 어느 것도 건드리지 않는다. 유일한 파일시스템 접근은 `pnpm-lock.yaml` 과 두 `package.json` 에 대한 읽기 전용 접근(`fs.readFileSync`)이며, 이는 가드의 설계 목적(lockfile 을 정본으로 삼아 peer range 를 실측) 그대로다. 새로 도입된 모듈 레벨 상수(`BLOCKERS`, `BLOCKER_NAMES`, `LOCKFILE`)는 새 파일 안에 격리돼 있어 기존 전역과 충돌하지 않는다. 부작용 관점에서 Critical/Warning 급 발견사항은 없다.

## 위험도
NONE
