# 테스트(Testing) 리뷰

## 범위에 대한 메모

이번 changeset(파일 목록 기준)의 대다수는 `review/consistency/2026/09/01/**`(6라운드 consistency
checker 세션 산출물)와 `review/code/2026/09/01/{22_25_37,22_44_29,23_09_35}/**`(선행 세 코드 리뷰
라운드 산출물), `plan/**` 트래킹 문서 갱신이다. 사람이 유지보수하는 실행 코드/테스트는 여전히 4개뿐이다 —
`.claude/hooks/_lib/plan_guard.py`, `.claude/tests/test_plan_guard.py`,
`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`,
`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규). 이 4개는 이미 선행 세
라운드(`22_25_37`, `22_44_29`, `23_09_35`)의 testing 리뷰가 WARNING 4건을 냈고, 첨부된
`RESOLUTION.md` 세 건과 실제 소스를 직접 대조 + **독립 재실행/재뮤테이션**한 결과 다음이 실제로
반영돼 있음을 확인했다:

- 체크박스 비대칭 카운팅(`plan_guard.py:95-98,249-282`) — 열린 항목은 인용문 안이어도 거부권,
  닫힌 항목은 자기 것만 증거로 인정. 회귀 테스트 6건(`test_plan_guard.py:265-353`)이 양방향 +
  참 경로(자기+인용 닫힘 공존)까지 고정한다.
- `plan/complete/**` 링크 가드 예외 계약(`plan-lifecycle.md:46`)이 이제
  `spec-links.test.ts:164-169,207-218`의 `sealed.md` fixture 로 코드 레벨 봉인됐다 — 자매
  스코프 결정들(하위 폴더·`0-`/`_` 접두·코드펜스)과 동일한 패턴.
- `stray-tool-tags.test.ts` 의 "스캔이 실제로 돌았다" 전제 테스트가 루트별 하한(`plan:250`,
  `spec:190`)이고, `EXPECTED_ROOTS`(테스트 본문 리터럴)로 "집합을 함께 줄이는" 뮤턴트까지
  방어한다.
- `_all_checkboxes_done()` docstring 이 비대칭 규칙을 함수 자체에서도 설명한다
  (`plan_guard.py:247-253`).

아래는 이 확인된 사항을 재지적하지 않고, 직접 재검증(pytest/vitest 재실행 + 독립 뮤테이션)과
새로 살펴본 지점에 집중한다.

## 검증 (직접 재실행)

- `python3 -m pytest .claude/tests/test_plan_guard.py -q` → **39 passed, 15 subtests passed**.
- `npx vitest run stray-tool-tags.test.ts spec-links.test.ts` (frontend 패키지 디렉터리에서) →
  **2 files / 37 tests passed**.
- **독립 뮤테이션**: `_all_checkboxes_done` 의 `elif not _QUOTED.search(m.group("quote")):
  done_count += 1` 을 원 비대칭 이전 형태(`else: done_count += 1`)로 되돌려 재실행 —
  예측대로 `test_quoted_done_checkbox_alone_is_not_completion` **1건 RED**(나머지 38건은
  이 분기와 무관해 GREEN 유지, 예상과 일치). 원복은 `cp` 로 즉시 수행하고
  `diff`/`git status --short` 로 잔여 없음을 확인했다(저장소 트리 이상 없음).

## 발견사항

- **[INFO]** `stray-tool-tags.test.ts` 의 `archive/` 제외가 **경로가 아니라 basename 단독**으로
  매칭돼, fixture 가 검증하는 범위보다 실제 스코프가 넓다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:101`
    (`skipDir: (name) => name === "archive"`) / 대응 fixture: `:173-189`
    (`it("archive/ 는 스캔하지 않는다 — 그 밖은 스캔한다 (대조군 포함)")`)
  - 상세: `skipDir` 콜백은 `walkTree` 가 넘겨주는 두 인자(basename, root 기준 relPath) 중
    basename 만 쓴다 — 즉 트리 어디에 있든 이름이 정확히 `"archive"` 인 디렉터리는 전부
    건너뛴다. 헤더 주석은 이 제외의 의도를 "`plan/complete/archive/` 는 옛
    memory/user_memo 보관소" 로 좁게 서술하는데, 실제 구현은 그 경로에 고정돼 있지 않다.
    fixture(`:173-189`)도 정확히 `plan/complete/archive/from-x/old.md` 딱 그 경로만 심어서
    "제외됨" 을 확인하므로, "경로 무관 이름 매칭" 이라는 실제 폭은 어떤 테스트로도 직접
    드러나지 않는다. 지금은 저장소에 `archive` 라는 이름의 디렉터리가 `plan/complete/`
    아래 하나뿐이라(확인: `find plan spec -type d -iname archive`) 실제 오탐은 없지만,
    향후 `spec/` 이나 `plan/` 다른 위치에 무관한 목적의 `archive/` 디렉터리가 생기면 그
    안의 진짜 위반이 이 가드에서 조용히 빠진다 — 그 실패 모드는 정확히 이 가드 자신이
    경계하는 "제외 로직이 fixture 폭보다 넓어 소리 없이 사각지대를 만든다" 패턴과 같은
    모양이다.
  - 제안: fixture 에 `plan/complete/archive/`(의도된 경로)와는 다른 위치 — 예:
    `plan/in-progress/some-cluster/archive/x.md` — 를 하나 더 심어 "이름만 같으면 경로
    무관 제외" 라는 실제 동작을 명시적으로 고정하거나, 그럴 계획이 없다면 주석에 "경로가
    아니라 이름만 본다" 는 한 줄을 추가해 다음 사람이 스코프를 오해하지 않게 한다. 차단
    사유는 아님 — 현재 실제 오탐 사례가 없다.

## 확인했으나 문제 없음 (근거 기록, 독립 재검증)

- `_all_checkboxes_done` 비대칭 카운팅의 discriminating power 를 직접 뮤테이션으로 재확인했다
  (위 "검증" 절). RESOLUTION.md 가 주장한 RED 수치를 그대로 받아쓰지 않고 별도로 재현했다.
- `spec-links.test.ts` 의 `plan/complete/sealed.md` fixture(`:164-169`)는 "제외됨" 단정과
  "살아있는 쪽은 여전히 잡힘" 대조군(`:214-217`, `toEqual(["DEAD ./moved.md"])`)을 함께
  고정해 vacuous 위험을 스스로 차단한다 — `beforeAll`/`afterAll` 로 `mkdtempSync`/`rmSync`
  격리도 유지된다.
- `stray-tool-tags.test.ts` 의 `MIN_EXPECTED_MD_FILES`(plan:250, spec:190)와 `EXPECTED_ROOTS`
  리터럴 이중 방어(집합-공유 뮤턴트 방지)는 헤더 주석이 서술한 실패 이력(1판 `it.each` 뮤턴트
  통과, 2판 상수-리터럴 동시 축소 뮤턴트 통과)과 현재 구조가 정확히 대응한다 — 소스 재대조로
  확인.
- `codebase/backend/src/nodes/core/error-codes.ts` 의 변경은 JSDoc 주석 확장뿐으로 런타임
  동작 변화가 없어 테스트 추가가 불필요하다.
- `plan/*.md`·`review/**` 의 나머지 변경은 트래킹 문서/세션 산출물이라 이 관점의 대상이 아니다.

## 요약

핵심 코드 4개 파일에 대한 선행 세 라운드 testing WARNING 4건은 소스 대조뿐 아니라 pytest/vitest
재실행과 독립 뮤테이션(비대칭 카운팅 무력화 → 예측한 1건 RED)으로 직접 재검증했고 전부 실제
반영을 확인했다. 이번 라운드에서 새로 찾은 것은 INFO 하나 — `stray-tool-tags.test.ts` 의
`archive/` 제외가 fixture 가 보여주는 것보다 실제로는 더 넓은 범위(경로 무관, basename 단독
매칭)로 동작하는데 그 폭 자체는 아직 테스트되지 않았다. 현재 저장소 상태에서 오탐은 없고 차단
사유도 아니다. 나머지 변경(`error-codes.ts` JSDoc, plan 트래킹 문서, review 세션 산출물)은
테스트가 필요 없거나 이미 세션 기록이라 이 관점의 대상이 아니다.

## 위험도

LOW
