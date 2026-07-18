# RESOLUTION — self-test 가 실제 엔트리포인트를 `.tsx` 로 관통하도록 (2차 fresh review)

리뷰 세션: `review/code/2026/07/18/12_07_35/SUMMARY.md`
위험도 MEDIUM · Critical 0 · **WARNING 1** · INFO 8
대상 커밋: `2765ed767` (1차 resolution). base `463aee139`, 리뷰 스코프 = code 2파일.

## WARNING #1 (Testing) — 엔트리포인트가 `.tsx` 로 한 번도 호출 안 됨 → FIXED

- **지적**: 1차 resolution 이 self-test 를 `parseGuardSource` chokepoint 로 관통시켰지만,
  **프로덕션 엔트리포인트 `collectCodeStringLiterals` 자체는 테스트 어디서도 `.tsx`
  파일명으로 호출되지 않았다.** reviewer mutation: `collectCodeStringLiterals` 내부를
  `parseGuardSource` 우회 + `ts.ScriptKind.TS` 하드코딩으로 되돌려도 8/8 green. 즉
  엔트리포인트의 확장자 처리는 여전히 미검증(구조적 proxy `treeContainsJsx` 만 검증).
- **조치 (설계 단순화 + 강화)**: round-2 스캐폴딩(`parseGuardSource`·
  `collectStringLiteralsFrom`·`treeContainsJsx`) 제거하고, `collectCodeStringLiterals`
  는 `scriptKindForFile(fileName)` 를 인라인 사용. `.tsx`/역방향 두 테스트를 **단일
  대칭 테스트**로 대체 —
  `it("parses angle-bracket syntax by extension, through the guard's own entrypoint")`:
  동일 소스 `const cfg = <Config>{ mode: "cast_literal", n: 1 };` 를 **엔트리포인트로**
  두 확장자에 흘린다.
  - `"hook.ts"` → `<Config>expr` = 타입 단언 → `cast_literal` 수집 (`true`)
  - `"component.tsx"` → `<Config>` = JSX 개시(미닫힘) → 객체 통째 유실 (`false`)
  둘 다 `collectCodeStringLiterals` 자신을 관통하므로 어느 방향 하드코딩이든 한쪽이 깨진다.
- **mutation 재실측**: `collectCodeStringLiterals` 를 TS 하드코딩(MUT-C, **W1 이 지적한
  바로 그 우회**) → `.tsx` 단언(false) red 확인. TSX 하드코딩(MUT-D) → `.ts` 단언(true)
  red 확인. 원복 후 working tree clean.
- **부수 효과**: 이 단순화가 maintainability INFO(#1 walk 보일러플레이트 2회·#7 혼재
  describe)도 함께 해소 — 헬퍼 4→2(`scriptKindForFile`+`collectCodeStringLiterals`).

## INFO 반영

- **#2 (Documentation)** — 파일 상단 "Adding a new value" 체크리스트에
  `INTERACTION_TYPE_VALUES`/`IS_MULTI_TURN_INTERACTION`(값-목록 SoT) 갱신 단계 추가 →
  **반영**. `Exclude` 컴파일 단언이 tsc 를 깨는 fail-safe 순서까지 명시.
- **#3 (Testing)** — 대칭 캐스트 테스트가 TS 파서 각괄호 disambiguation 에 의존 →
  테스트 주석에 "typescript 업그레이드로 flip 시 파서 semantics 변경을 가드 회귀보다
  먼저 의심" 트리아지 노트 **추가**.
- **#1 SPEC-DRIFT** — spec 의 "grep" 잔여 표현은 fork-point 이후 origin/main PR
  `22cc48ef3`(#977)이 **이미 해소**. 이 worktree 가 아직 그 커밋 미수신일 뿐, 이
  changeset 이 만든 drift 아님. → 코드 무변경. merge/rebase 시 #977 자동 합류 확인만.
  (developer 는 `spec/` read-only. planner 후속 §① 은 #977 로 사실상 종결 — plan 갱신 반영.)
- **#4·#5·#6·#7 (Maintainability)** — #1/#7 은 위 단순화로 해소. #4(exhaustiveness
  describe 2회 중복)·#5(타입 단언 관용구)·#6(`readRepoFile` 경로 스타일)은 우선순위
  낮음/현 임계치 미만 → 조치 불요.
- **#8 (Testing, 긍정)** — 함수 분리로 WARNING #2 급 패턴 방지 기록. 단순화 후에도
  `scriptKindForFile` 분리 + 엔트리포인트 직접 단언으로 동일 효과 유지.

## 검증

- 대상 테스트 파일: **7 passed** (self-test 4 + `scriptKindForFile` 1 + 등록사이트 가드 2).
- 신규 대칭 테스트 양방향 mutation(MUT-C 하드코딩 TS→`.tsx` red, MUT-D 하드코딩 TSX→`.ts`
  red) 실측 후 원복.
- TEST WORKFLOW: lint PASS(54s) / unit PASS(69s) / build PASS(124s) /
  e2e PASS(245s — backend 256 + playwright 51).
