# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `readPeerRanges` 의 top-level 키 정규식이 `packages:` 섹션 전용이라는 문서 주장(주석)이 코드로 강제되지 않고, 이를 검증하는 테스트도 없다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:79-93`(docstring, "최상위 `packages:` 아래 두 줄뿐이다"), 실제 매칭 로직 `:106`(`const key = /^ {2}(?<name>...)@(?<version>[^:\s]+):\s*$/`)
  - 상세: 실측 결과 `pnpm-lock.yaml` 은 `packages:` 섹션 외에 `snapshots:` 섹션에도 같은 이름의 패키지가 2-space 들여쓰기로 다시 등장한다(예: `  eslint-plugin-import@2.32.0(@typescript-eslint/parser@...)...:` — `grep -n "^  eslint-plugin-import@" pnpm-lock.yaml` 로 실측, `packages:` 6317줄 1건 + `snapshots:` 16671/16700줄 2건). `version` 캡처 그룹이 `[^:\s]+` 라 콜론만 없으면 괄호·`@`·`/` 를 전부 삼키므로, 이 `snapshots:` 항목도 top-level 키 정규식에 매칭되어 `wanted.has(name)` 조건을 통과하고 `current` 를 덮어쓴다. 현재는 `snapshots:` 섹션 항목들이 진짜 `peerDependencies:` 하위블록을 갖지 않아(`transitivePeerDependencies:` 만 있음 — 전 구간 `awk '/^snapshots:/{f=1} f' pnpm-lock.yaml | grep -c "peerDependencies:"` = 0으로 실측) `out.set()` 이 재호출되지 않아 우연히 오염이 발생하지 않을 뿐이다. 즉 "packages: 섹션만 읽는다" 는 보장이 **정규식 형태가 아니라 lockfile 의 현재 우연한 형태**에 기대고 있고, 이를 고정하는 테스트가 없다.
  - 제안: `eslint10-unblock.test.ts` 의 `describe("readPeerRanges (합성)")` SAMPLE 에 `snapshots:` 스타일의 동일-이름·괄호-한정자 키(`  eslint-plugin-react@7.37.5(eslint@9.0.0):` 형태)를 추가해, 그런 줄이 섞여도 결과가 오염되지 않음(또는 최소한 `packages:` 항목이 우선한다)을 명시적으로 단언하는 케이스를 넣는다. 이 모듈이 이미 표방하는 fail-closed·mutation-검증 철학과 일관되게, "우연히 안전"이 아니라 "구조적으로 안전"임을 테스트로 못박아야 한다.

- **[WARNING]** `termMajorFloor` 의 `~` 연산자 분기가 어떤 테스트로도 도달·관측되지 않는다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:138`(`const m = /^(?<op>\^|~|>=|>)?\s*(?<major>\d+)/.exec(term.trim());`)
  - 상세: `allowsEslint10` 은 `>=`/`>` 외의 모든 항(연산자 없음·`^`·`~`)을 "major 고정" 으로 취급한다(`:168-170`). `eslint10-unblock.test.ts` 의 `describe("allowsEslint10 (합성)")` 세 테스트(:105-128)는 `^`·`>=`·연산자-없음·해석불가만 다루고 `~` 를 쓰는 케이스가 하나도 없다. 정규식 alternation `\^|~|>=|>` 에서 `~` 를 제거하는 뮤테이션을 넣어도 현재 스위트는 전부 GREEN 으로 남는다(수동 검증: 이 alternative 를 참조하는 assertion 이 전무). 이 저장소가 이미 "분기 매트릭스 완성 뒤에도 `??`/`||` 는 각 항이 별도 표면" 이라는 교훈을 갖고 있는 것과 같은 클래스의 갭이다.
  - 제안: `allowsEslint10("~9.5.0")` → `false`, `allowsEslint10("~10.5.0")` → `true` 같은 케이스를 `describe("allowsEslint10 (합성)")` 에 추가한다.

- **[INFO]** `it.each(BLOCKERS)` 4회 반복마다 `readLockfile()` 을 매번 호출해 ~6MB lockfile 을 4번 새로 읽는다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:72`(`const entries = readPeerRanges(readLockfile(), BLOCKER_NAMES);` — `it.each` 콜백 내부, 블록은 `:69-95`)
  - 상세: 정합성 문제는 아니지만(각 반복이 독립적이라 순서 의존성 없음), `readLockfile()` 호출을 `beforeAll` 로 한 번만 끌어올리면 스위트 실행 시간을 줄일 수 있다. 현재도 실패 시 원인 규명이 어려워지진 않으므로 낮은 우선순위.
  - 제안: `beforeAll`/모듈 스코프 상수로 lockfile 텍스트를 1회만 읽어 재사용.

- **[INFO]** mock 을 전혀 쓰지 않고 실제 `pnpm-lock.yaml`·`package.json` 을 읽는 설계는 이 파일의 목적(캐너리/실측 가드)에 부합하는 의도적 선택이며 적절하다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:52-101`(전제 실측 describe 블록), `:69-95`(it.each)
  - 상세: 헤더 주석이 "이 가드는 캐너리다 — 막던 것이 사라지면 실패한다" 는 목적을 명확히 밝히고 있고, 그 목적상 실제 lockfile 상태를 읽는 것이 필수다(mock 을 쓰면 가드 자체가 무의미해진다). 실패 메시지도 다음 행동(어떤 파일을 함께 갱신할지)까지 구체적으로 안내해 가독성이 좋다. 결함이 아니라 긍정적 평가로 기록.

- **[INFO]** `readPeerRanges` 의 "peerDependencies 블록이 `eslint:` 를 만나지 못한 채 형제 키로 끝나는" 경로(:119-120, `if (inPeerBlock && /^ {4}\S/.test(raw)) inPeerBlock = false;`)가 합성 SAMPLE 로 직접 커버되지 않는다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:131-169`(`describe("readPeerRanges (합성)")`)
  - 상세: 현재 SAMPLE 의 두 패키지 모두 `peerDependencies:` 블록 안에 결국 `eslint:` 가 등장한다. "peerDependencies 는 있지만 eslint 피어가 없는" 패키지(예: `optionalDependencies:` 만 따라오는 경우)가 결과에서 조용히 빠지는 것이 의도된 동작인지 회귀로 고정해두면 좋다. 심각도는 낮음 — 이미 "없는 패키지는 결과에 없다" 테스트(:167-169)가 최종 관측 가능 동작은 동일하게 커버한다.

## 요약

새로 추가된 `eslint10-unblock-guard.ts`/`eslint10-unblock.test.ts` 는 순수 함수로 분리된 설계, fail-closed 예외 처리, vacuity 방지(`it.each([])` 공집합 가드), 실측 전제 검증(devDependency 버전 재확인) 등 테스트 용이성·가독성·회귀 방지 측면에서 전반적으로 완성도가 높다. mock 을 쓰지 않고 실제 lockfile/package.json 을 읽는 것도 이 가드의 "캐너리" 목적에 부합하는 적절한 선택이다. 다만 두 가지 실질적 커버리지 갭이 있다 — (1) `readPeerRanges` 의 top-level 키 정규식이 `packages:` 섹션에서만 안전하다는 주석의 주장이 실제로는 lockfile 의 `snapshots:` 섹션에도 같은 이름의 키가 매칭될 수 있는데(실측 확인) 이를 검증하는 테스트가 없어 "우연히 안전"한 상태이고, (2) `termMajorFloor` 의 `~` 연산자 분기가 어떤 테스트로도 도달되지 않아 그 alternative 를 제거하는 뮤테이션이 생존한다. 둘 다 지금 당장 관측되는 결함은 아니지만, 이 모듈이 스스로 표방하는 "fail-closed·뮤테이션 검증" 기준에는 못 미치는 지점이라 WARNING 으로 기록한다.

## 위험도
LOW
