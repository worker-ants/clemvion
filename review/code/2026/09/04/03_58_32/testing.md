# 테스트(Testing) 리뷰 — repo-guards walker 통합 + nullable-type-lie-cast 신규 가드 (7R)

## 검증 방법

이 변경 세트는 이미 6개 리뷰 라운드(01_48_39 ~ 03_37_37)를 거쳤고, testing 관점 발견은
`동작(1R: sort() 커버리지 반증·stripLiterals 무테스트) → 오탐(2R: 이름 충돌) → 구조(6R:
includeSpec wiring 미검증) → 문서(3R~5R)` 순으로 수렴해 왔다. 7R 로서 과거 지적을 그대로
받지 않고 직접 재검증했다:

- `npx jest --testPathPatterns="(source-scan|masked-reject-callers|nullable-type-lie-cast|audit-action-binding|engine-error-code-anchor|redis-fail-open-catalog)"`
  → **6 suites / 119 tests 전부 PASS**.
- **6R WARNING(`listSourceFiles` 의 `includeSpec: true` 배선 미검증)이 실제로 고쳐졌는지
  직접 재현** — 저장소 파일이 아니라 scratch 사본(`/private/tmp/.../scratchpad/`)에 원본을
  먼저 백업한 뒤, `masked-reject-callers-guard.ts` 의 `collectTsFiles(rootDir, { includeSpec: true })`
  를 `collectTsFiles(rootDir)` 로 뮤테이션하고 `masked-reject-callers.spec.ts` 를 실행 →
  **예측 RED, 실측 1 failed / 16 passed** — RESOLUTION 6R 이 주장한 수치와 정확히 일치.
  실패 지점도 정확히 신규 테스트(`` `listSourceFiles` 가 `.spec.ts` 를 담는다 ``)였다.
  `cp` 로 원복 후 `git status --short`·`git diff --stat -- codebase/` 로 클린 확인(잔여물 없음,
  세션 자신의 리뷰 출력 디렉터리만 untracked로 남음).
- `grep -n "OneToOne" nullable-type-lie-cast.spec.ts` → 0건. 6R INFO#2(`@OneToOne` 분기
  미실행)가 여전히 유효함을 확인.

## 발견사항

- **[INFO]** (6R INFO#2 재확인, 조치 없음 — 판단 유지) `widenedEntityFields` 의 `@OneToOne`
  분기가 유닛/저장소-전수 테스트 어느 쪽으로도 실행되지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:169`
    (`WIDENED_DECL` 의 `@(?:Column|ManyToOne|OneToOne)` 분기)
  - 상세: `nullable-type-lie-cast.spec.ts` 의 관계 테스트는 `@ManyToOne`+`@JoinColumn` 조합만
    다룬다. 저장소에 `@OneToOne` 사용처가 없어(6R 확인) 실행 경로 자체가 죽어 있다 —
    false-negative 방향이라 당장 위험하지 않지만, 회귀가 나도 어떤 테스트도 못 잡는다.
  - 제안: 우선순위 낮음 — 조치 불필요(이미 6R에서 판단·유예됨). `ENTITY` 픽스처에
    `@OneToOne` 필드 하나만 추가하면 해소된다.

- **[INFO]** (6R INFO#3 재확인, 조치 없음) `isNullableType` 이 `Type | null = <default>`
  형태(기본값이 붙은 필드 선언)에서 `null` 세그먼트가 `null = null` 로 오염돼 매치에
  실패한다 — 문서화되지 않은 위음성.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:180`
    (`isNullableType`), `WIDENED_DECL` 의 `([^;]+)` 캡처가 `= null` 까지 삼킨다.
  - 상세: 저장소 grep 결과 `| null = ` 패턴 0건(6R 실측)이라 현재는 잠재적. 가드가 이미
    표기 순서·공백 변형(`Date|null`·`null | Date`)은 캐너리로 고정했는데, 기본값 대입
    형태만 비대칭적으로 미고정.
  - 제안: 우선순위 낮음 — 조치 불필요. 다음에 이 함수를 만질 때 한 줄 캐너리로 고정 권장.

- **[INFO]** (6R INFO#4 재확인, 조치 없음) `WIDENED_DECL` 의 "추가 데코레이터 1개까지만"
  한계에 `stripLiterals` 의 "중첩 백틱" 한계와 달리 회귀-고정 테스트(`[알려진 한계]` 라벨)가
  없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:160-166`
    (docstring "한계" 절)
  - 상세: docstring 은 "저장소 전수에 그런 조합은 없다(2026-09-04 실측)" 를 근거로 대는데,
    그 실측 자체를 지키는 캐너리가 없어 다음에 3-데코레이터 필드가 추가되면 조용히 통과한다.
  - 제안: 우선순위 낮음 — 조치 불필요. `stripLiterals` 와 대칭 맞추는 것은 다음 접촉 시점.

## 확인된 수정 사항 (문제 없음)

- **6R WARNING** — `masked-reject-callers-guard.listSourceFiles` 의 `includeSpec: true` 옵션
  배선이 리팩터 실수로 빠져도 어떤 테스트도 안 죽던 사각지대. `masked-reject-callers.spec.ts`
  에 tmpdir 픽스처로 `listSourceFiles` 의 반환값을 직접 단언하는 테스트 2건(양성 케이스 +
  허용목록 전제)이 추가됐고, 위 "검증 방법" 에서 뮤테이션으로 직접 재현해 실제로 RED 가 됨을
  확인했다.
- `collectTsFiles` 단위 테스트(정렬·`.spec.ts` 포함/제외·`.d.ts`·`node_modules`/`dist`)와
  `stripLiterals` 전용 스위트(따옴표 보존·템플릿 멀티라인·이스케이프 조기종료 안 함·알려진
  한계 고정)는 이전 라운드에서 지적된 커버리지 갭(1R W1·W2)이 실제로 메워진 채 유지되고
  있다.
- `findStaleSpecCasts`/`widenedEntityFields` 의 이름-충돌 오탐(2R W1)은 대조군 테스트
  (`userId` 충돌 시나리오 · `onlyHereAt` 비충돌 시나리오)로 고정돼 있고, "저장소 전수" 3개
  테스트가 전제(entities>30, specs>300, widened>100)를 먼저 단언해 vacuous pass 를 막는
  설계가 그대로다.
- 테스트 격리: 신규/변경된 테스트는 전부 `os.tmpdir()` 기반 fixture + `try/finally`(또는
  `beforeEach`/`afterEach`) 로 정리되고, 실제 소스 트리를 변형하지 않는다 — 자매 spec 헤더가
  "실제 소스를 변형했다가 무효 뮤턴트를 낸 사고" 를 명시적으로 반면교사로 남겨 둔 것과 일치.
- Mock 사용: 이 diff 는 mock/stub 을 쓰지 않고 실제 `fs` + tmpdir fixture 로 검증한다 —
  `node:fs` 의 non-configurable 속성 때문에 spy 시도가 실패했던 이력(1R)이 docstring 에
  남아 있어 이 선택이 임의가 아니라 실측 근거가 있다.

## 요약

7R 시점에서 이 변경 세트의 테스트 커버리지는 6라운드에 걸쳐 동작 → 오탐 → 구조(wiring) →
문서 순으로 수렴했고, 직전 라운드(6R)의 유일한 WARNING(`includeSpec` 배선 미검증)을 이번
라운드에서 독립적으로 재현해 실제로 고쳐졌음을 확인했다(뮤테이션 1 failed/16 passed, 보고된
수치와 일치). 남은 것은 전부 6R에서 이미 판단·유예된 INFO 3건(`@OneToOne` 분기 미실행 ·
기본값 대입 위음성 · 데코레이터 다단 스택 한계 무캐너리)으로, 셋 다 false-negative 방향이고
저장소 실사례가 0건이라는 근거가 docstring 에 명시돼 있다 — 새로 escalate 할 근거를 찾지
못했다. 6 suites/119 tests 전부 GREEN, 저장소 상태는 리뷰 종료 시점 클린(untracked 산출물
제외).

## 위험도

LOW
