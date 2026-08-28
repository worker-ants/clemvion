# 테스트(Testing) 리뷰

## 검증 방법

이번 diff 는 직전 리뷰 라운드(`review/code/2026/08/28/23_20_05/`)의 결과물(SUMMARY/RESOLUTION 포함)과, 그 라운드에서 지적된 WARNING 2건을 고친 후속 커밋(`0e3eafe08`)을 함께 담고 있다. 직전 라운드의 testing 리뷰(WARNING 2건)가 실제로 해소됐는지 재현 검증했다:

- `termMajorFloor` 정규식에서 `~` 를 제거하는 뮤테이션 → **RED** (`~` 항도 major 고정으로 읽는다` 테스트가 실패). 해소 확인.
- `readPeerRanges` 의 `if (!inPackagesSection) continue;` 가드를 제거하는 뮤테이션 → **RED 2건** (`snapshots:` 섹션 오염 테스트, `packages:` 밖 문서 테스트). 해소 확인.
- `pnpm vitest run src/lib/repo-guards/__tests__/eslint10-unblock.test.ts` → 15/15 통과. `src/lib/repo-guards/__tests__/` 전체 → 117/117 통과(형제 가드와 격리, 상호 오염 없음).
- 실제 `pnpm-lock.yaml` 의 `eslint-plugin-react-hooks@7.0.1` 항목(`packages:` 6347행)이 `peerDependencies.eslint: ^3.0.0 || … || ^9.0.0` 임을 직접 확인 — 가드/테스트의 "우리 트리는 4번째 차단자를 가진다" 주장과 정확히 일치.

두 WARNING 모두 fix 가 실질적으로 유효함을 독립 재현으로 확인했다. 새로 지적할 CRITICAL/WARNING 은 없다.

## 발견사항

- **[INFO]** `readPeerRanges` 의 "`peerDependencies:` 블록 안에 `eslint:` 키가 끝내 등장하지 않고 형제 키로 블록이 끝나는" 경로가 합성 SAMPLE 로 직접 커버되지 않는다. (직전 라운드 INFO 로 이미 지적·의도적 보류된 항목 — 재확인만 함)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:137-138` (`if (inPeerBlock && /^ {4}\S/.test(raw)) inPeerBlock = false;`), 테스트 부재 지점: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:141-212` (`describe("readPeerRanges (합성)")`)
  - 상세: 현재 SAMPLE·`withSnapshots`·`onlySnapshots` 세 fixture 모두 대상 패키지의 `peerDependencies:` 블록 안에 결국 `eslint:` 가 나오거나(SAMPLE), 그 패키지 자체가 검색 대상이 아니거나(snapshots 케이스들), `packages:` 밖이라 애초에 안 읽는다. "`peerDependencies:` 는 있지만 `eslint:` 피어가 없는" 패키지가 결과 Map 에서 조용히 빠지는 것이 의도된 동작인지 회귀로 고정해 두면 좋다. 최종 관측 가능 동작 자체는 "없는 패키지는 결과에 없다" 테스트(:177-179)가 동일하게 커버하므로 심각도는 낮다.
  - 제안: SAMPLE 에 `peerDependencies:` 블록은 있지만 `eslint:` 키 없이 형제 키(예: `'@types/react': '*'` 만)로 끝나는 패키지를 하나 추가해 `.size` 또는 `.get(name)` 이 `undefined` 임을 명시적으로 단언.

- **[INFO]** `readPeerRanges` 에서 동일 패키지명이 `packages:` 섹션 안에 두 번 나타나는 경우 `Map.set` 이 조용히 마지막 값으로 덮어쓴다 — 이 모듈이 표방하는 fail-closed 철학과 다소 비일관. (직전 라운드 RESOLUTION 에서 "현재 데이터로 미관측·pnpm lockfile 형식상 발생 안 함" 으로 이미 보류된 항목 — 재확인만 함)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:145`
  - 상세: 조치하지 않아도 현재 실측 lockfile 구조상 트리거되지 않으므로 급하지 않다. 다만 테스트가 없어 향후 pnpm lockfile 포맷이 바뀌어 중복 키가 생겨도 조용히 통과한다.
  - 제안: 우선순위 낮음 — 조치 불요로 유지 가능. 조치한다면 중복 발견 시 throw 하는 테스트 케이스 추가.

- **[INFO]** (긍정 평가, 재확인) mock 없이 실제 `pnpm-lock.yaml`/`package.json` 을 읽는 설계는 이 파일의 "캐너리" 목적에 정확히 부합한다 — mock 을 썼다면 가드 자체가 무의미해진다. 테스트 격리도 충분하다: 모든 테스트가 읽기 전용이고 상태 공유가 없어 순서 무관·병렬 안전.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:52-103` (실측 전제 describe), `:106-139` (`allowsEslint10` 합성 describe)

- **[INFO]** (긍정 평가) `it.each([])` 공집합 시 스위트가 조용히 통과하는 vacuity 함정을 `BLOCKERS.length >= 4` 단언으로 명시적으로 방지했고, `~`/`>=`/연산자 없음/해석불가 각 분기를 별도 케이스로 나눠 분기 매트릭스를 촘촘히 채웠다. `readPeerRanges` 도 `packages:`/`snapshots:` 양쪽을 합성 fixture 로 갈라 회귀를 구조로 고정했다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:99-103`, `:106-139`, `:181-212`

## 요약

직전 라운드 testing WARNING 2건(`packages:`/`snapshots:` 섹션 혼동, `~` 연산자 미커버)은 후속 커밋에서 실제로 고쳐졌음을 뮤테이션 재현으로 독립 확인했다 — 두 뮤턴트 모두 RED 로 정확히 잡힌다. 전체 스위트(117/117)도 통과해 형제 가드와 격리도 유지된다. 신규 코드(`eslint10-unblock-guard.ts`/`.test.ts`)는 순수 함수 분리, fail-closed 예외, vacuity 방지, mock-free 실측 검증 등 테스트 용이성·격리·가독성이 전반적으로 높은 수준이다. 남은 갭은 두 건의 저우선순위 INFO(‘`eslint:` 없는 peerDependencies 블록’ 미커버, `Map.set` 중복 덮어쓰기 미검증)뿐이며 둘 다 현재 실측 데이터로는 트리거되지 않고 이미 developer 가 근거를 대며 보류한 항목이라 재차 WARNING 으로 올릴 근거는 없다.

## 위험도
NONE
