# 테스트(Testing) 리뷰 — update-returning-rows 3라운드 (`23_07_11`)

## 검증 방법

주장을 그대로 받지 않고 실제로 재현했다 — 각 대상 파일을 백업 후 헬퍼 호출을 되돌리는
뮤턴트를 직접 심고 `jest` 를 실행해 RED/GREEN 을 확인했으며, 검증이 끝난 뮤턴트는 즉시
원본으로 복원했다(`git status --porcelain` 으로 작업 트리 클린 확인). 구조적 가드의
`EXPECTED`/`guards` 숫자도 실제 소스에 `grep -c` 로 직접 대조했다.

## 발견사항

- **[WARNING]** `knowledge-base.service.ts` 의 5개 `updateReturningRows` 소비 지점 중
  **3곳(embedding 재큐·graph 재큐·reset)은 실측 튜플 shape(`[[…], n]`) 를 쓰는 회귀 테스트가
  여전히 하나도 없다** — 직접 뮤테이션으로 재확인.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:544`
    (`retryFailedDocuments` embedding 분기의 `rowsOut = updateReturningRows(...)`),
    `:578`(graph 분기), `:751`(`reEmbedAll` reset). 대응 테스트 부재 지점:
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts` 의
    `retryFailedDocuments (embedding, shared chunk helper)` describe(845행대),
    graph 재큐 관련 테스트(1151행대), `reEmbedAll` 성공 경로(683행대) — 전부
    `[{id:'d1'}]`/`[]` 형(행 배열 직접, fallback 분기)만 mock 한다.
  - 상세: 실제로 `knowledge-base.service.ts:544` 의
    `const rowsOut = updateReturningRows<{ id: string }>(rows, ...)` 를
    `const rowsOut = rows as { id: string }[]` 로 되돌리고(= 이번 PR 이 고친 결함을 재현)
    `npx jest knowledge-base.service.spec.ts` 를 돌리면 **54 passed 그대로, RED 가 하나도
    없다.** 즉 이 지점(그리고 동일 패턴인 :578, :751)은 헬퍼가 통째로 사라지거나
    unwrap 로직이 미묘하게 잘못돼도 현재 스위트로는 검출되지 않는다. 이건 가정이 아니라
    이 자리에 이미 있는 주석이 정확히 경고하는 그 결함이다 — "튜플을 그대로 map 하면
    `[undefined, undefined]` — 가짜 job 2개가 큐잉된다"(`:542-543`) — 인데 그 시나리오를
    실측 shape 로 재현하는 테스트가 없다. plan 문서(`plan/in-progress/update-returning-tuple-shape.md:50-52`)
    의 위험표에도 이 세 지점이 "가짜 job 2개"/"빈 KB 가 in_progress 로 좌초" 로 명시돼
    있는데, 체크리스트·후속 항목 어디에도 이 테스트 갭을 메우겠다는 항목은 없다.
    한편 이번 라운드에 새로 추가된 KB CAS 락 2곳(`reExtractAll`:346, `reEmbedAll`:729)의
    0행 거절 테스트는 같은 방식(헬퍼 호출을 인라인 `Array.isArray` 캐스트로 치환)으로
    뮤테이션했을 때 **정확히 RED 로 죽는 것을 확인했다** — 그 2곳은 실질적으로 판별력이
    있다. 다만 이 2곳도 "1행 튜플이면 CAS 성공"(accept 경로, `[[{id}],1]`)을 실측 shape 로
    검증하는 테스트는 없고, 여전히 `[{id:'kb-1'}]`(행 배열 직접) mock 으로만 성공 경로를
    돈다 — CAS 는 `.length` 만 보므로 fallback 분기와 결과가 같아 실질 위험은 낮지만,
    "튜플 unwrap 자체가 옳은가"를 accept 방향에서 검증하는 테스트는 8개 소비 지점
    전체에서 admission(execution-engine)·auth-oauth 2곳 정도에 국한된다.
  - 제안: 최소한 embedding 재큐·graph 재큐·reset 세 곳에 `mockDataSource.query`가
    `[[{ id: 'd1' }], 1]`(1행, id 가 실제로 꺼내지는지) 와 `[[], 0]`(0행, `reset` 의 빈 KB
    idle 복귀 분기가 진짜로 타는지) 을 반환하는 케이스를 최소 1개씩 추가하고, 헬퍼 호출을
    되돌리는 뮤테이션으로 RED 확인. 세 지점 모두 CAS 락과 달리 언랩된 `rows`/`resetRows`
    의 **값**(`.map(r => r.id)`)을 실제로 소비하므로 판별력 있는 테스트를 만들기 쉽다
    (CAS 락처럼 `.length` 만 보는 게 아니라 `id` 값 자체를 단언하면 된다).

- **[INFO] (검증 완료, 긍정)** 직전 라운드(`22_45_24`) CRITICAL — `updateExecutionStatus`
  의 `persisted` 계산에 실측 shape 회귀 테스트가 전무하다는 지적 — 이번 라운드에서
  실제로 해소됐다. 직접 뮤테이션으로 재확인.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8549-8553`
    소스, 테스트는 `execution-engine.service.spec.ts` 신규 2건(0행 튜플 케이스가 판별자).
  - 상세: `updateReturningRows<{ id: string }>(updated, ...).length > 0` 를
    `(updated as { id: string }[]).length > 0`(구 코드와 동일한 의미)로 되돌리고
    `npx jest execution-engine.service.spec.ts -t "실측 shape"` 를 실행한 결과,
    "0행 튜플([[],0])이면 persisted=false" 테스트가 정확히 **1 failed** 로 죽었다
    (`Expected: false, Received: true`). 1행 튜플 성공 케이스는 (구/신 코드가 우연히
    같은 결과를 내는) 비판별 케이스이지만, 0행 케이스가 실제 판별자로 동작함을 실측으로
    확인했다 — RESOLUTION.md 의 "사살 확인" 주장이 사실과 일치한다.

- **[INFO] (검증 완료, 긍정)** `auth-oauth.service.ts` 콜백 CAS 소비, `knowledge-base.service.ts`
  의 `reEmbedAll` CAS 락도 동일한 방식으로 직접 뮤테이션해 각각 RED 를 확인했다
  (`auth-oauth.service.spec.ts` "실측 shape([rows,count])로도 정상 콜백이 성공해야 한다" 1건
  실패, `knowledge-base.service.spec.ts` "실측 shape: 0행 튜플([[],0])이면 409 를 던진다" 1건
  실패). 8개 소비 지점 중 5곳(admission·updateExecutionStatus·auth-oauth·KB CAS 2곳)은
  이제 실측 shape 뮤테이션에 실제로 판별력을 갖는다.

- **[INFO]** 구조적 회귀 가드(`update-returning-rows.spec.ts` `EXPECTED`, `assert-row-array.spec.ts`
  `guards`)의 하드코딩된 개수를 `grep -c 'updateReturningRows[<(]'`/`assertRowArray\(` 로
  각 소스 파일에서 직접 재확인 — execution-engine 2, knowledge-base 5, auth-oauth 1,
  engine `assertRowArray` guards 1 (queries 3) 모두 일치. 문서화된 숫자와 실제 소스가
  어긋나 있지 않다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:49-54`,
    `codebase/backend/src/common/utils/assert-row-array.spec.ts:82-93`

## 요약

이번 라운드는 직전(`22_45_24`) 테스트 리뷰가 HIGH 로 표시했던 핵심 갭 — `updateExecutionStatus`
(동시 cancel 선점 분기)에 대한 실측 shape 회귀 테스트 부재 — 를 실제로 메웠고, `auth-oauth`·
`knowledge-base` CAS 락 2곳도 함께 추가됐다. 위 5개 지점 모두 헬퍼를 되돌리는 뮤테이션을 직접
심어 RED 로 떨어짐을 재확인했으므로 "덮는다" 는 주장은 이번엔 검증 가능한 사실이다. 다만
`knowledge-base.service.ts` 의 나머지 3개 소비 지점(embedding 재큐·graph 재큐·reset)은 여전히
행 배열 직접(fallback) mock 에만 의존한다 — 동일한 방식으로 뮤테이션해 본 결과 스위트가
100% GREEN 을 유지해, 이 세 곳은 헬퍼가 사라지거나 unwrap 로직이 깨져도 현재 테스트로는
검출되지 않는다. 이 세 곳은 CAS 락처럼 "거절/승인" 이분법이 아니라 언랩된 행의 `id` 값을
실제로 소비(`enqueueEmbedChunked` 인자)하는 지점이라, 회귀 시 조용히 잘못된(또는 `undefined`)
문서 ID 가 큐잉될 수 있다 — 이 PR 자신의 코드 주석과 plan 위험표가 정확히 그 시나리오를
경고하고 있다. 프로덕션 코드 자체는 (구조적 grep 가드 + 소스 직접 대조로) 정확함이 확인됐으므로
현재 시점의 기능 결함은 아니지만, "이번에 고친 결함 클래스가 재발해도 잡을 안전망" 관점에서는
8개 지점 중 3곳이 비어 있다.

## 위험도

MEDIUM — 이 사고의 가장 파급력 큰 지점(admission·updateExecutionStatus·auth-oauth 상시 로그인
실패)은 이제 뮤테이션 검증된 회귀 테스트로 실제로 덮인다. 남은 갭(KB 3개 지점)은 프로덕션
코드가 정확함이 별도로 확인된 상태에서의 순수 커버리지 부재라 CRITICAL 로 올리지 않았으나,
동일 PR 이 두 라운드 연속으로 "완료" 라고 선언한 뒤에도 남아 있던 패턴이라는 점에서 다음
라운드로 미루지 않는 편이 낫다.
