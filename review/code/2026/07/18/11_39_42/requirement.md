# 요구사항(Requirement) 리뷰 — interaction-type-guard-fixes

## 발견사항

- **[WARNING]** `.tsx` self-test 가 실제로 고정(lock-in)해야 할 회귀 — `collectCodeStringLiterals` 내부의 `scriptKindForFile(fileName)` 호출 자체 — 를 검출하지 못한다 (mutation 실측으로 확인).
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` — `collectCodeStringLiterals` L96-103(특히 L102 `scriptKindForFile(fileName)`), `treeContainsJsx` L123 이하, self-test `"parses a .tsx site's JSX as JSX so its branch literals stay sound"` L247-263.
  - 상세: 이번 diff 의 핵심 fix 는 `collectCodeStringLiterals` 안에서 `ts.ScriptKind.TS` 하드코딩을 `scriptKindForFile(fileName)` 호출로 바꾼 것이다(파일 1 diff, `- ts.ScriptKind.TS,` / `+ scriptKindForFile(fileName),`). 이 정확한 라인을 되돌리는 mutation(하드코딩 복원)을 로컬에서 직접 주입해 재현했다:
    ```
    - scriptKindForFile(fileName),
    + ts.ScriptKind.TS, // MUTATION
    ```
    `npx vitest run src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 결과 **7/7 전부 green** — 새로 추가된 `.tsx` self-test 를 포함해 어떤 테스트도 이 회귀를 잡지 못했다(mutation 은 즉시 원복, working tree clean 재확인 완료).
    원인은 self-test 의 두 단언 경로가 실제로는 `collectCodeStringLiterals` 의 내부 배선을 통과하지 않기 때문이다:
    - `collectCodeStringLiterals(tsxSite, "result-view.tsx").has("ai_form_render")` — 테스트 자신의 주석대로 "The literal survives either way by error-recovery luck" 라서 ScriptKind 가 틀려도 항상 true.
    - `treeContainsJsx(tsxSite, scriptKindForFile("result-view.tsx"))` — `scriptKindForFile` 을 **직접** 호출해 얻은 kind 를 `treeContainsJsx` 에 넘길 뿐, `collectCodeStringLiterals` 를 전혀 거치지 않는다. 즉 `collectCodeStringLiterals` 가 실제로 `scriptKindForFile(fileName)` 을 호출하는지는 검증되지 않고, `scriptKindForFile` 자체의 반환값만 독립적으로 검증된다(이는 이미 `describe("scriptKindForFile")` 블록이 직접 검증하는 것과 중복).
    반면 같은 방식으로 `scriptKindForFile` 함수 **본문**을 하드코딩(`return ts.ScriptKind.TS`)하는 mutation 은 2개 테스트가 정확히 red 로 전환됨을 확인했다 — 즉 plan 문서의 "scriptKind 하드코딩 변조 → 해당 테스트 red 확인" 실측은 `scriptKindForFile` 함수 자체를 변조한 경우에는 성립하지만, **이번 diff 가 실제로 고친 호출부**(`collectCodeStringLiterals` 내부)를 변조하면 성립하지 않는다. 나머지 2개 신규 self-test(regex 오수집 비오염, ternary/union 등 폼별 descent skip)는 각각 대응 mutation 주입 시 정확히 red 로 전환됨을 별도로 확인했다 — 문제는 `.tsx` self-test 1건에 국한된다.
  - 제안: `treeContainsJsx` 를, `collectCodeStringLiterals` 가 실제로 사용하는 파싱 경로(같은 `ts.createSourceFile(fileName, source, ..., scriptKindForFile(fileName))` 호출)의 산출물(`sourceFile`)을 인자로 받거나, `collectCodeStringLiterals` 가 파싱한 `sourceFile` 을 재사용하도록 리팩터해 self-test 가 `collectCodeStringLiterals` 의 실제 내부 호출을 관통하도록 배선한다. 최소 수정으로는 `collectCodeStringLiterals` 에서 파싱한 `sourceFile` 을 (테스트 전용으로) 노출하는 helper 를 추가해 `treeContainsJsx` 에 전달하는 방식.

- **[INFO]** `[SPEC-DRIFT]` 이미 추적 중 — spec 본문이 여전히 가드를 "grep" 으로 서술.
  - 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3 ("등록된 grep 대상 파일"), §2.1 `system_error`/`rag` 행 ("AST 가드 대상 코드 파일 (test `SOURCE_REGISTRY_SITES` — grep 검증 대상은 …)")
  - 상세: 이번 diff(파일 2)는 `interaction-type-registry.ts` 의 주석을 "grep 가드" → "AST 가드" 로 3곳 전부 정정해 구현 실체(TypeScript AST 파싱, `ts.createSourceFile`)와 로컬 정합을 맞췄다. 그런데 SoT 인 `spec/conventions/interaction-type-registry.md` 본문은 여전히 "grep 대상 파일"/"grep 검증 대상"/"코드 grep 결과" 표현을 쓴다 — 코드가 옳고(AST 파싱이 실제 구현) spec 부차 서술이 낡은 전형적 SPEC-DRIFT 다.
  - 제안: 코드 되돌리기 아님. `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 "후속" 섹션에 이미 `[project-planner]` 담당으로 등록돼 있고(spec §1.2 rule 3 · §2.1 두 행 · §5 표현 정정), impl-prep/`/ai-review`/impl-done 세 게이트가 독립적으로 동일 항목을 지적해 비차단으로 합의됐다는 기록도 있다. 신규 차단 사유 아님 — 기존 추적 항목 재확인.

## 요약

이번 diff 는 §1.2/§2.1 AST 가드 자체의 REGISTRY_SITES/SOURCE_REGISTRY_SITES 를 건드리지 않아 **현재 프로덕션 가드 동작에는 회귀가 없다**(모든 등록 사이트가 여전히 `.ts` 이므로 `scriptKindForFile` 은 항상 `ts.ScriptKind.TS` 를 반환하고, 실측으로도 7/7 테스트가 green). `interaction-type-registry.ts` 의 "grep→AST" 주석 정정은 3곳 전부 정확히 반영됐고, 신규 self-test 3건 중 2건(regex 비오염, 폼별 리터럴 형태 descent)은 mutation 실측으로 실제 회귀 검출력을 확인했다. 다만 `.tsx` 확장 대비 self-test 1건은 plan 문서가 주장하는 것과 달리 이 diff 의 실제 fix 라인(`collectCodeStringLiterals` 내부 `scriptKindForFile(fileName)` 호출)을 되돌려도 green 을 유지한다 — 즉 향후 누군가 이 정확한 라인을 실수로 되돌리면(코드 리뷰 없이, 혹은 merge conflict 해소 과정에서) 아무 테스트도 잡지 못한다. 이 plan 자체가 "가드의 false-negative 를 없앤다"는 주제이므로, 그 fix 를 고정하기 위해 새로 추가한 self-test 안에 동일 계열의 false-negative 가 남아있다는 점은 주제상 특히 눈여겨볼 필요가 있다. 나머지(TODO/FIXME 없음, 반환값 누락 없음, 에러 시나리오·데이터 유효성 해당 없음 — 순수 테스트/문서 파일)는 문제 없음.

## 위험도
LOW
