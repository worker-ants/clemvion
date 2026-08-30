STATUS=success requirement review complete
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `countRawUpdateReturning` 의 "선두 키워드" 판정 축이 **CTE(`WITH ...`)로 시작하는 top-level `UPDATE`/`DELETE ... RETURNING`** 을 놓친다 — 이 가드가 스스로 3라운드에 걸쳐 닫아 온 것과 **같은 클래스의 미공개 blind spot**이 하나 더 남아 있다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` 함수 `countRawUpdateReturning`(`/^\s*(UPDATE|DELETE)\b/i.test(sql)` 판정부) — "이 축이 **안** 보는 것" docstring 절(QueryBuilder 제외·`.query(sqlVar)` 두 항목만 나열)에 미기재.
  - 상세: 직접 재현했다.
    ```
    node -e '
    function stripComments(s){return s.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");}
    function countRawUpdateReturning(src){
      const clean = stripComments(src);
      const CALL = /\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(`[^`]*`|\x27[^\x27]*\x27|"[^"]*")/g;
      let c=0;
      for (const m of clean.matchAll(CALL)) {
        const sql = m[1].slice(1,-1);
        if (/^\s*(UPDATE|DELETE)\b/i.test(sql) && /\bRETURNING\b/i.test(sql)) c++;
      }
      return c;
    }
    const src = "await db.query(`WITH updated AS (SELECT id FROM t) UPDATE t SET x = 1 WHERE id IN (SELECT id FROM updated) RETURNING id`);";
    console.log(countRawUpdateReturning(src)); // 0
    '
    ```
    top-level 커맨드가 `UPDATE`(CTE 는 앞쪽 절일 뿐)라 pg/TypeORM 은 여전히 `[rows, affectedCount]` 튜플을 돌려주는데, SQL 리터럴의 **문자 그대로 첫 단어**가 `WITH` 라 정규식이 `count=0`으로 놓친다 — `hasRawUpdateReturning` 도 `false`. 이 결함 클래스는 실은 이 PR **1라운드 리뷰가 이미 지적**했다: `review/code/2026/08/30/12_41_15/requirement.md:15` 가 "`WITH ... UPDATE ... RETURNING`(CTE 접두) 같은 leading-keyword 우회나 ... `.query(sqlVar)` ... 도 같은 범주다" 라고 **두 blind spot 을 한 문단에 나란히** 적었다. 그런데 그 라운드의 SUMMARY 합성(`review/code/2026/08/30/12_41_15/SUMMARY.md` WARNING #1)은 `.query(sqlVar)` 만 남기고 CTE 접두 언급을 요약에서 떨궜다 — 이후 resolution-applier 는 SUMMARY 항목만 처리하므로 `.query(sqlVar)` 는 docstring 공개 + 2·3라운드에서 캐너리 테스트까지 얻었지만(`source-scan.spec.ts` 음성 케이스), CTE 접두는 SUMMARY 에 없었던 탓에 세 라운드 내내 **한 번도 조치 대상이 되지 못했다**. 오늘 저장소에 CTE + top-level UPDATE...RETURNING 조합의 실 사용처는 없음을 확인했다(`grep -rln '\.query(' src | xargs grep -l 'WITH '` → `executions.service.ts`·`rag-search.service.ts` 2곳뿐이고 둘 다 `WITH RECURSIVE ... SELECT` 로 top-level 이 SELECT — 직접 열람해 확인, RETURNING 없음)이라 활성 버그는 아니지만, 이 가드의 존재 이유가 정확히 "새 raw UPDATE/DELETE...RETURNING 지점이 조용히 미가드로 남는 것"을 막는 것이고, docstring 이 "이 축이 안 보는 것"을 완전히 나열한다고 암묵적으로 전제하는 만큼(QueryBuilder·`.query(sqlVar)` 두 항목만), CTE 접두 우회는 같은 절에 있어야 할 세 번째 항목이 빠진 것이다.
  - 제안: docstring "이 축이 안 보는 것" 절에 "`WITH ... UPDATE/DELETE ... RETURNING`(CTE 로 시작하는 top-level UPDATE/DELETE)도 첫 키워드가 `WITH` 라 놓친다" 를 명시 추가하고, `source-scan.spec.ts` 음성 `describe` 에 합성 케이스(`'WITH x AS (SELECT 1) UPDATE t SET a=1 RETURNING id'`)를 넣어 `hasRawUpdateReturning(...) === false` 로 RED 방향 고정할 것 — 이 저장소가 이미 `.query(sqlVar)`·2단계 중첩 제네릭에 적용한 것과 동일한 처리.

- **[INFO]** 핵심 하드닝 3라운드(nested-generic 정규식 확장 · `ALLOWED` 파일 단위 전면 면제 → 개수 기반 · `findUnguarded` 순수 함수 추출 + 합성 입력 테스트)를 직접 소스 대조·테스트 실행·수치 재계산으로 검증 — 전부 확인됨, 새 문제 없음.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 함수 `findUnguarded`(허용목록 `rawCount > allowedCount` 분기·비허용 `guardCountOf(rel) < rawCount` 분기), `describe('findUnguarded — 합성 입력으로 판정 로직 자체를 고정한다')`.
  - 상세: (1) `npx jest`로 `source-scan.spec.ts`·`update-returning-rows.spec.ts`·`assert-row-array.spec.ts`·`kb-stats.helper.spec.ts` 4개 스펙 51 테스트 전부 GREEN 재확인. (2) `ALLOWED` 3-tuple 의 개수(`stuck-document-recovery.service.ts`=2, `agent-memory-admin.service.ts`=2, `integration-oauth.service.ts`=2, `kb-stats.helper.ts`=1)를 `countRawUpdateReturning` 로직을 직접 재구현해 각 소스 파일에 돌려 정확히 일치함을 확인(허용 수가 실제보다 여유(slack)를 두지 않는다 — 즉 새 raw 지점이 생기면 바로 초과해 unguarded 로 잡힌다). (3) 경계값(`rawCount === allowedCount`/`guardCount === rawCount` 통과, `guardCount < rawCount` 실패, `rawCount=0` 은 애초에 `discover()` 필터로 미도달 — 주석으로 명시)이 합성 테스트 4건으로 정확히 고정돼 있다. (4) `git status --short` — 내가 검증에 쓴 스크립트는 전부 저장소 밖 `node -e`(파일 미생성)였고 저장소 트리는 무변경.

- **[INFO]** spec fidelity — `raw UPDATE/DELETE … RETURNING → updateReturningRows`(개수 매칭 포함) 불변식은 여전히 `spec/conventions/` 문서화 대상이 없다(전수 grep 0건, 3라운드 전체 동일 결론). `plan/in-progress/update-returning-tuple-shape.md:409` 가 planner 위임을 이미 명시했고 developer 쓰기 권한 밖이라 이번 코드 PR 의 조치 대상이 아니다. 신규 결함 아님, 반복 확인.

### 요약

핵심 로직(`countRawUpdateReturning`/`hasRawUpdateReturning`, `findUnguarded` 기반 발견형 구조 가드, `kb-stats.helper.ts` 타입 정정)은 3라운드에 걸쳐 리뷰가 지적한 CRITICAL 급 실패 없이 정확히 하드닝됐다 — 중첩 제네릭 정규식 확장, 파일 단위 존재-only → 개수 판정, 허용목록의 파일 전체 면제 → 사유가 검토한 개수까지로 축소, 판정 로직의 순수 함수 추출 + 합성 입력으로 영속 고정까지 전부 코드·테스트로 직접 확인했고, 실행(51 테스트 GREEN)·정확한 허용목록 개수(4개 파일 전수 재계산 일치)로 재검증했다. 다만 이 가드 자신의 "선두 키워드" 판정 축에 아직 닫히지 않은 blind spot 이 하나 더 있다 — `WITH ... UPDATE/DELETE ... RETURNING`(CTE 접두) 는 첫 문자가 `WITH` 라 이 가드를 완전히 우회한다. 이 항목은 1라운드 리뷰가 `.query(sqlVar)` 와 "같은 범주"로 이미 언급했지만 SUMMARY 합성 과정에서 누락돼 이후 두 라운드 어디에서도 조치 대상이 되지 못했다 — 오늘 활성 버그는 아니지만(저장소에 실 사용처 없음, 직접 확인), 이 가드가 이미 disclose 한 두 blind spot 과 정확히 같은 성격이라 docstring 명시 + 캐너리 테스트로 마저 닫는 것이 이 PR 이 스스로 세운 기준과 일관적이다. spec 관련 규약 부재는 이미 planner 위임으로 추적 중이라 문제 삼지 않는다.

### 위험도

LOW
