# RESOLUTION — interaction-type AST 가드 주석 정정 + self-test 보강 (#972 후속 ②③)

리뷰 세션: `review/code/2026/07/18/11_39_42/SUMMARY.md`
위험도 LOW · Critical 0 · **WARNING 2** · SPEC-DRIFT 1 · INFO 6
대상 커밋: `ef1227b76` (base `463aee139`, 3 files)

두 WARNING 모두 이번 PR 이 강화하려던 self-test **자체의 false-negative** 를 정확히
짚었다 (이 plan 의 주제가 "가드의 주석 false-negative 제거" 라는 점에서 반드시 반영).
둘 다 fix 후 **양방향 mutation 으로 재실측** 했다.

## WARNING #1 (Testing/Documentation) — 역방향 미고정 → FIXED

- **지적**: `.tsx` 오파싱 방지(정방향)만 self-test 로 고정됐고, `scriptKindForFile`
  JSDoc 이 스스로 명시하는 역방향 리스크(`.ts` 안 `<Config>{…}` 각괄호 캐스트가 TSX 로
  파싱되면 리터럴 통째 유실)는 어떤 테스트로도 안 잡힘. 두 reviewer 가 직접 재현.
- **조치**: 역방향 self-test 추가 —
  `it("parses a .ts angle-bracket cast as a cast, keeping its literal (not TSX)")`.
  `collectCodeStringLiterals('const cfg = <Config>{ mode: "cast_kept_literal", … }',
  "fixture.ts").has("cast_kept_literal") === true` 를 **가드 경유**로 단언하고,
  같은 소스를 강제 TSX 로 파싱하면 리터럴이 유실됨(`false`)을 대조 단언.
- **mutation 실측**: 파스 chokepoint 를 `ts.ScriptKind.TSX` 하드코딩(MUT-B) → 이 테스트
  red 확인 → 원복.

## WARNING #2 (Requirement) — self-test 가 실제 fix 라인을 미관통 → FIXED

- **지적**: 이번 diff 의 진짜 fix 라인(`collectCodeStringLiterals` 내부
  `scriptKindForFile(fileName)` 호출)을 舊 `ts.ScriptKind.TS` 하드코딩으로 되돌려도
  `.tsx` self-test 포함 7/7 green 유지. 원인: 옛 `.tsx` 테스트가 `scriptKindForFile` 을
  **직접** 호출하고 `.has("ai_form_render")`(에러복구로 항상 true)만 봐서 프로덕션
  파스 경로를 관통하지 않음. → plan 주제와 동일 계열의 false-negative 가 self-test 안에 잔존.
- **조치**: 파스 단일 chokepoint `parseGuardSource(source, fileName)` 추출 —
  `collectCodeStringLiterals` 와 `.tsx` self-test **둘 다 이 함수로 파싱**. `treeContainsJsx`
  는 `(source, kind)` 대신 이미 파싱된 `ts.SourceFile` 를 받도록 시그니처 변경 →
  호출부가 `parseGuardSource(tsxSite, "result-view.tsx")` 트리를 먹인다. 벡큐어스했던
  `.has("ai_form_render")` 단언은 제거하고 트리 형태(JSX 인식) 단언으로 교체. walk 는
  `collectStringLiteralsFrom(sourceFile)` 로 분리해 역방향 테스트가 강제-TSX 트리에 재사용.
- **mutation 실측**: `parseGuardSource` 를 `ts.ScriptKind.TS` 하드코딩(MUT-A, **W2 가 지적한
  바로 그 회귀**) → `.tsx` 정방향 테스트 red 확인(이전엔 green 이던 것) → 원복.

## SPEC-DRIFT #1 — 조치 불요 (기존 추적 항목)

`spec/conventions/interaction-type-registry.md` 의 "grep" 잔여 표현 4곳(L56/77/78/143) 은
project-planner 담당. `plan/in-progress/interaction-type-guard-comment-false-negative.md`
후속 §①(프롬프트 A) 에 이미 등록됐고 impl-prep·`/ai-review`·impl-done 세 게이트가 독립
지적해 **비차단** 합의된 항목. developer 는 `spec/` read-only 라 코드만 정정(본 PR),
spec 표현은 planner 후속. 코드를 되돌릴 사안 아님.

## INFO #1–#6 — 조치 불요

- #1 AST walk 보일러플레이트 2회 → 이번 리팩터로 walk 는 `collectStringLiteralsFrom` 로
  1곳 수렴, `treeContainsJsx` 만 별도 순회(목적 다름). 3번째 순회 등장 전 추출 불요.
- #2 `treeContainsJsx` 고정 파일명 문서화 갭 → 시그니처가 `SourceFile` 로 바뀌며 소멸.
- #3 파일 성장 → 현 규모 정당(방어적 문서화). 향후 헬퍼 증가 시 유틸 모듈 분리 고려.
- #4 JSX 3분기 중 `JsxElement` 만 exercise · #5 `.mts/.cts` 미고려 · #6 신규 헬퍼 plan
  문구 미명시 → 전부 우선순위 낮음/범위 내, 현 스코프 조치 불요.

## 검증

- 대상 테스트 파일: **8 passed** (self-test 6 + 등록사이트 가드 2).
- TEST WORKFLOW (resolution 반영본): lint PASS(51s) / unit PASS(67s) /
  build PASS(117s) / e2e PASS(264s — backend 256 + playwright 51).
- 신규/변경 케이스 전부 양방향 mutation 실측 후 원복(working tree clean).
