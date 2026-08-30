STATUS=success requirement review complete
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `ALLOWED` 3-tuple 의 세 번째 요소(허용 지점 수)가 **선언값일 뿐 실측과 교차검증되지 않는다** — 값을 부풀리면(오타·과다 선언) 그 파일 안에 새로 생기는 미가드 raw 지점이 조용히 통과한다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 함수 `findUnguarded`(정의부는 게이트 기준 `167`~`182`행, 특히 `176`행 `if (rawCount > allowedCount) unguarded.push(rel);`)
  - 상세: `findUnguarded` 는 ALLOWED 항목에 대해 `rawCount > allowedCount` 인 경우에만 unguarded 로 분류한다. 즉 `allowedCount` 는 "이 사유가 실제로 검토한 지점 수" 라는 상한으로만 쓰이고, 그 값 자체가 오늘의 실제 `countRawUpdateReturning` 결과와 **정확히 일치하는지**를 검증하는 테스트가 없다. 직접 재현했다(저장소 파일은 건드리지 않고 `findUnguarded` 로직만 scratch 스크립트로 재구현해 실행 — `/private/tmp/.../scratchpad/verify_allowed_inflation.mjs`, 원본 함수 그대로 복붙):
    ```
    findUnguarded(
      [['modules/knowledge-base/graph/kb-stats.helper.ts', 2]], // 실제로 새 raw 지점이 하나 더 생겨 rawCount=2 가 됨
      new Map([['modules/knowledge-base/graph/kb-stats.helper.ts', 99]]), // ALLOWED 에 오타/과다로 99 를 적었다고 가정
      () => 0,
    )
    // => []  (unguarded 로 잡히지 않음 — 새 미가드 지점이 조용히 통과)
    ```
    현재 4개 ALLOWED 항목(`stuck-document-recovery.service.ts`=2, `agent-memory-admin.service.ts`=2, `integration-oauth.service.ts`=2, `kb-stats.helper.ts`=1)은 실제 소스를 직접 grep 해 대조한 결과 **오늘은 전부 정확히 일치**한다(활성 버그 아님). 다만 이 PR/트래커가 세 라운드에 걸쳐 정확히 이 형태의 문제("숫자가 아니라 존재만 본다" → "파일 단위 전면 면제" → "개수 판정으로 좁힘")를 겹겹이 닫아 왔는데, 그 마지막 겹인 **"개수 판정 자체의 진실성"** 은 여전히 사람이 수기로 넣은 값을 그대로 신뢰한다. `discover()` 가 이미 파일별 실측 `rawCount` 를 갖고 있으므로 "ALLOWED 의 선언값이 discover() 의 실측값과 정확히 일치하는가" 를 검증하는 것이 기술적으로 가능한데, 그 축은 아직 테스트되지 않는다. docstring(`194`~`198`행)이 "이 수는 실측값이다" 라고 명시적으로 주장하고 있어 코드의 실제 보장 범위(상한 검사일 뿐, 정합성 검사 아님)와 문서의 주장 사이에 괴리가 있다.
  - 제안: `discover()` 결과를 `Map` 으로 만들어 ALLOWED 각 항목의 선언 count 가 discover() 의 실측 rawCount 와 **정확히 일치**하는지 검증하는 `it` 을 추가하거나(예: `expect(discoveredMap.get(rel)).toBe(declaredCount)`), 최소한 docstring 의 "이 수는 실측값이다" 문장 옆에 "선언값이 실측보다 크면 그 차이만큼 조용히 미검증 상태가 남는다"는 한계를 명시할 것.

- **[INFO]** 핵심 신규 로직(`countRawUpdateReturning`/`hasRawUpdateReturning`, `findUnguarded`, discover 기반 `describe`, `kb-stats.helper.ts` 타입 정정)은 3라운드에 걸쳐 반복 지적된 모든 항목(중첩 제네릭 미탐지·전용 단위테스트 부재·파일단위 존재-only 판정·허용목록 파일단위 전면 면제·다중 unguarded 미검증·CTE 접두 blind spot·CHANGELOG 수치 오기)이 실측으로 해소됐음을 직접 확인했다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:112-138`(`countRawUpdateReturning`/`hasRawUpdateReturning`), `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:67-165`(양성 6·음성 7 — CHANGELOG·`source-scan.spec.ts` 실측 개수 일치 확인), `codebase/backend/src/common/utils/update-returning-rows.spec.ts:167-379`(`findUnguarded` + 합성 테스트 7개, 다중 unguarded 보고 케이스 포함)
  - 상세: `npx jest src/common/utils/update-returning-rows.spec.ts src/common/__test-utils__/source-scan.spec.ts src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` 를 직접 실행해 **3 suites / 46 tests 전부 GREEN** 을 재확인했다. `kb-stats.helper.ts` 의 `.query<>()` 제네릭이 `{...}[]` → `[{...}[], number]` 로 정정된 것도 실제 소비 여부(반환값 미소비)와 대조해 안전함을 확인했다. `ALLOWED` 4개 항목의 선언 count(2/2/2/1)는 대응 소스 파일의 실제 `RETURNING` 발생 지점 수와 grep 대조 결과 오늘 시점 정확히 일치한다.
  - 제안: 조치 불요 — 참고 기록.

- **[INFO]** spec fidelity — `raw UPDATE/DELETE … RETURNING → updateReturningRows`(및 개수 매칭) 불변식이 `spec/conventions/` 에 문서화된 규약으로 존재하지 않는다(`spec/` 전수에서 `updateReturningRows` 언급 0건).
  - 위치: `spec/conventions/` 전수 grep 0건(직접 확인), 관련 서술은 `plan/in-progress/update-returning-tuple-shape.md:409`(`[planner 위임]`)
  - 상세: 이미 3라운드 전부(1·2·3차 requirement 리뷰)가 독립적으로 같은 결론(부재이지 위반 아님, planner 위임으로 추적 중)에 도달했다. 이번 diff 는 `spec/` 을 건드리지 않으며 developer 쓰기 권한 밖이라 이번 코드 PR 의 조치 대상이 아니다.
  - 제안: 조치 불요(이미 추적 중, planner 턴에서 처리).

### 요약

이번 diff 는 3라운드에 걸쳐 자기 자신의 blind spot(중첩 제네릭·파일단위 존재-only 판정·허용목록 파일단위 전면 면제·다중 보고 미검증·CTE 접두 미탐지·CHANGELOG 수치 오기)을 겹겹이 찾아 닫은 raw UPDATE/DELETE…RETURNING 발견형 가드다. 직접 실행(`3 suites / 46 tests` 전부 GREEN)과 grep 대조로 확인한 결과 이전 라운드가 지적한 모든 항목은 실제로 해소됐다. 다만 이번 라운드에서 새로 발견한 것은, 이 가드의 마지막 방어선인 `ALLOWED` 의 "사유가 검토한 지점 수" 라는 선언값 자체가 오늘의 실측(`discover()`)과 교차검증되지 않는다는 점이다 — scratch 스크립트로 `findUnguarded` 로직을 직접 재현해, 선언값이 부풀려지면 그 파일 안에 새로 생긴 미가드 지점이 조용히 통과함을 실증했다. 오늘 4개 ALLOWED 항목의 값은 실제와 정확히 일치해 활성 버그는 아니지만, 이 PR 이 스스로 세 번 반복해 닫아 온 "가드가 자기 결함 클래스를 가졌다" 패턴의 다음 겹으로 보인다. spec 쪽은 관련 규약이 `spec/conventions/` 에 아직 없음을 재확인했으나 이미 planner 위임으로 추적 중이라 문제 삼지 않는다.

### 위험도

LOW
