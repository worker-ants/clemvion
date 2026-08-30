STATUS=success requirement review complete
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `hasRawUpdateReturning` 의 `CALL` 정규식이 **중첩 제네릭 타입 인자**(`.query<Array<{...}>>(`)를 만나면 매치 자체가 실패해 그 지점을 통째로 못 본다 — docstring 의 "이 축이 안 보는 것 (의도)" 절이 QueryBuilder 제외만 명시하고 이 blind spot 은 disclose 하지 않는다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:97` (`const CALL = /\.query\s*(?:<[^>]*>)?\s*\(\s*(...)/g;`)
  - 상세: `[^>]*`는 `>` 문자를 하나라도 만나면 그 안에서 멈추므로, 타입 인자에 `>`가 두 번 이상 나오는 `Array<{...}>>`류 제네릭 앞에서는 `(?:<[^>]*>)?` 가 전체 실패하고, 옵션 그룹을 생략한 경로도 다음 문자가 `<` 라 실패해 결국 `CALL` 이 그 호출부를 전혀 캡처하지 못한다. 실제로 노드 스크립트로 재현했다:
    ```
    node -e '
    const CALL = /\.query\s*(?:<[^>]*>)?\s*\(\s*(`[^`]*`|\x27[^\x27]*\x27|"[^"]*")/g;
    const src = "await dataSource.query<Array<{ id: string }>>(`UPDATE foo SET x=1 WHERE id=$1 RETURNING id`, [id])";
    console.log([...src.matchAll(CALL)].length); // 0
    '
    ```
    이 스타일(`.query<Array<{...}>>(`)은 가상의 사례가 아니다 — 현재 `src/**` 안에 **5곳**이 이미 이 패턴을 쓴다: `scripts/eval-retrieval.ts:162`, `scripts/migrate-button-ids.ts:227`, `scripts/migrate-node-output-refs.ts:549`, `modules/knowledge-base/graph/graph-query.service.ts:150,274`. 지금은 전부 `SELECT` 라 우연히 무해하지만(직접 확인함), 이 PR 의 존재 이유가 정확히 "새 raw UPDATE/DELETE...RETURNING 지점이 목록 밖에 생겨도 아무 가드도 RED 를 내지 않는 것"을 막는 것이므로, 이미 저장소에 5곳이나 있는 스타일로 새 지점이 쓰이면 **이 새 가드도 조용히 통과**한다 — 이 PR 이 스스로 진단한 실패 모드를 다른 구문으로 재현한다. `WITH ... UPDATE ... RETURNING`(CTE 접두) 같은 leading-keyword 우회나, SQL 을 변수에 담아 `.query(sqlVar)` 로 넘기는 간접 호출(자매 `CONSUMING` 정규식이 이미 문서화한 것과 같은 종류의 한계, `01_57_36` 후속 항목이 이를 일반적으로 언급하지만 이 함수 자신의 docstring 에는 없음)도 같은 범주다.
  - 제안: docstring 의 "이 축이 안 보는 것" 절에 이 두 가지(중첩 제네릭·비-리터럴 SQL 변수)를 명시하거나, `CALL` 정규식을 `<(?:[^<>]|<[^<>]*>)*>` 류로 한 단계 넓혀 단일 중첩까지는 잡을 것. 최소한 문서화만이라도 우선 반영 권장 — 다음 사람이 "이 스캐너는 전수를 본다"고 오해하지 않도록.

- **[WARNING]** 새 discover-기반 가드는 **파일 단위**로만 "헬퍼를 거치는가"를 판정해, 한 파일 안에 raw UPDATE/DELETE...RETURNING 지점이 여러 개고 그중 일부만 `updateReturningRows` 를 거치는 경우를 놓친다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:184-189`(`discover()`), `:191-203`(`발견된 지점은 모두 헬퍼를 거치거나 사유와 함께 허용목록에 있다`)
  - 상세: `hasRawUpdateReturning`(`source-scan.ts:93-105`)는 파일 안에서 매치되는 **첫** raw UPDATE/DELETE...RETURNING 을 찾는 순간 `true` 를 반환하는 존재-판정 함수다(같은 파일에 몇 개가 더 있는지는 안 본다). 그리고 신규 테스트의 "unguarded" 판정도 `countCalls(src, 'updateReturningRows') === 0` — 즉 파일 안에 헬퍼 호출이 **하나라도** 있으면 통과다. 그 결과: 새 파일에 raw UPDATE...RETURNING 지점이 2개 생기고 개발자가 1개만 헬퍼로 감싸면, `discover()` 는 그 파일을 찾고(true), `countCalls` 는 1(≠0)이라 "guarded" 로 분류돼 `unguarded` 배열에 안 들어간다 — 테스트는 GREEN 인데 실제로는 미가드 지점이 하나 남는다. 이는 이 PR/트래커가 반복해서 강조한 "개수(count)가 곧 정밀도"라는 자기 규율(예: `EXPECTED` 배열이 파일별 **정확한 개수**를 `toBe(count)` 로 고정하는 것)과 대비된다 — 새 discover 경로는 그 정밀도를 갖추지 않았다.
  - 다만 **현재는 활성 버그가 아니다**: `discover()` 가 실제로 찾는 파일은 정확히 7개이고, 그중 헬퍼가 필요한 3개(`execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts`)는 전부 기존 `EXPECTED` describe 블록(occurrence-level exact count, 이 diff 로 변경되지 않음)이 이미 정밀하게 커버하고, 나머지 4개는 `ALLOWED`(0개 필요)다 — 직접 실행해 15/15 테스트 통과를 확인했다. 이 gap 은 **"EXPECTED·ALLOWED 어느 쪽에도 없는 완전히 새로운 다중-지점 파일"** 이 생길 미래 시나리오에서만 열린다.
  - 제안: `discover()` 를 파일 목록이 아니라 (파일, 매치 개수) 튜플로 바꾸고, `unguarded` 판정을 `countCalls(...) >= rawCount` 로 강화하거나, 최소한 이 한계를 describe 블록 docstring 의 "왜 필요한가" 절에 명시해 다음 사람이 "이 가드가 개수까지 본다"고 오해하지 않게 할 것.

- **[INFO]** spec fidelity — `raw UPDATE/DELETE ... RETURNING → updateReturningRows` 불변식이 `spec/conventions/` 어디에도 아직 문서화돼 있지 않음 (spec 부재, 위반 아님)
  - 위치: `spec/conventions/migrations.md` 등 전수 grep 0건 (직접 확인 — `updateReturningRows`/`RETURNING` 언급 없음)
  - 상세: 이 PR 은 코드/plan/test 전용이고 `spec/` 을 건드리지 않는다(developer 의 쓰기 권한 범위 안). `plan/in-progress/update-returning-tuple-shape.md:409-412`(`[planner 위임]`)가 이미 이 규약 승격을 명시적으로 다음 turn 으로 위임해 뒀고, 같은 세션의 consistency-check(`review/consistency/2026/08/30/12_17_21/cross_spec.md` INFO 1, `plan_coherence.md` INFO)도 독립적으로 같은 결론(부재이지 모순 아님)에 도달했다. 조치 불요 — 이미 추적되는 항목.

### 요약

핵심 신규 로직(`hasRawUpdateReturning`, discover-기반 `describe` 블록, `kb-stats.helper.ts` 타입 정정)은 의도한 기능("손으로 고른 3파일 밖의 새 raw UPDATE/DELETE...RETURNING 지점을 발견")을 대체로 충실히 구현한다 — 직접 `jest` 를 실행해 관련 4개 스위트(신규 23개 테스트 포함) 전부 GREEN 을 확인했고, `ALLOWED` 4개 항목의 사유를 각 소스 파일과 대조해 전부 정확함을 검증했으며, INSERT...RETURNING·INSERT ON CONFLICT DO UPDATE...RETURNING 오탐 배제와 QueryBuilder(§7.4/§7.5 의도된 conditional UPDATE) 구조적 제외도 코드 레벨에서 실측 확인했다. 다만 스캐너 자체의 정밀도에 두 개의 실증 가능한 gap 이 있다 — (1) 중첩 제네릭 타입 인자(`.query<Array<{...}>>(` — 저장소에 이미 5곳 선례가 있는 스타일)를 만나면 정규식이 그 호출부를 통째로 못 보고, (2) 새 discover 경로는 파일 단위(존재 여부)로만 판정해 한 파일 안의 다중 raw 지점 중 일부만 가드된 경우를 놓친다. 둘 다 오늘 활성 버그는 아니지만(현재 발견되는 7개 파일 전부 EXPECTED/ALLOWED 로 정밀하게 커버됨), 이 PR 이 스스로 "입력 집합 자체가 커버리지" 라고 밝힌 설계 목표를 정확히 겨냥하는 미래 회귀 경로라 문서화 또는 강화가 바람직하다. spec 쪽은 관련 규약이 아직 `spec/conventions/` 에 없음을 확인했으나 이미 plan 에 planner 위임으로 추적 중이라 INFO 로 남긴다.

### 위험도

LOW
