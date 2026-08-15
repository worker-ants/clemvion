# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 방법

target 스코프(`spec/5-system/14-external-interaction-api.md` 등)의 diff 를
`plan/in-progress/eia-db-wire-invariant.md`(본 워크트리 `eia-r8-cache-scope-4ae434` 의 작업
단위)와 그 정본 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, 그리고
동일 워크트리의 자매 plan `update-returning-tuple-shape.md`·`eia-terminal-payload.md`,
호출부를 공유하는 `retry-turn-terminal-guard.md` 대조로 검증했다. §6.5(cancelled durationMs
"해소" 표기)·§6.3·§5.3(REST `durationMs`)·필드 집합 표 변경이 plan ①②③ 체크리스트와
1:1 대응하는지 코드(`retry-turn.service.ts` `finalizeGuarded`, `execution-engine.service.ts`
`finalizeCancelledExecution`)까지 직접 대조했다.

## 발견사항

- **[WARNING]** §6.5 "DB=wire 해소" 선언이 기대는 COALESCE+RETURNING 메커니즘이 여전히
  mock 전용 검증이고, 그 사실을 아는 자매 plan 항목이 갱신되지 않았다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.5 (`execution.cancelled`
    payload) — *"~~알려진 예외 1건~~ **(2026-08-15 해소)** — CANCELLED 분기의 `COALESCE`
    UPDATE 에 `RETURNING` 을 달아 **DB 가 실제로 고른 값**을 되읽어 emit 한다"*
  - 관련 plan:
    - `plan/in-progress/eia-db-wire-invariant.md` ② (*"CANCELLED 분기에 `.returning(...)` →
      영속값 되읽기. 뮤테이션 RED (1234 vs 600000)"*, `[x]` 완료 표시)
    - `plan/in-progress/retry-turn-terminal-guard.md` 코드 후속 표 #4 (*"COALESCE 경로 실 DB
      e2e — 신규 패턴이고 현재 근거는 TypeORM 소스 정적 확인뿐"*, P2, **미해결**)
  - 상세: `retry-turn.service.ts` `finalizeGuarded` 의 CANCELLED 분기는 `retry-turn-terminal-guard`
    작업(5R)이 도입한 `SET finishedAt/durationMs = COALESCE(col, :new)` UPDATE 다. 그 plan은
    **당시부터** 이 COALESCE UPDATE 를 "신규 패턴 · 실 DB 검증 없음(TypeORM 소스 정적 확인뿐)"
    으로 P2 미해결 등재해 뒀다(#4). `eia-db-wire-invariant.md` ②는 바로 그 UPDATE 문에
    `.returning(['duration_ms','finished_at'])` 를 추가해 emit 값을 그 반환으로 덮어쓰도록
    확장했다 — 즉 **정확히 그 미검증 패턴을 새 불변식("DB=wire")의 근거로 승격**시켰다.
    직접 대조한 결과 ② 의 검증은 `retry-turn.service.spec.ts` 의 QueryBuilder mock
    (`returning: jest.fn().mockReturnThis()`, `result.raw = [{duration_ms: 1234, ...}]` 식)
    뿐이고, 저장소 전체에 `retryLastTurn`/`finalizeGuarded` 를 실 Postgres 로 왕복시키는
    e2e 는 0건이다(확인: `grep -rl "retryLastTurn\|finalizeGuarded" **/*.e2e-spec.ts` 무결과).
    `update-returning-tuple-shape.md` 가 확립한 실측(직접 Postgres 프로브)은 raw
    `dataSource.query()` 튜플 형태에 대한 것이라 이 QueryBuilder `.execute().raw` 경로와는
    다른 API 표면이다(별도 확인: `UpdateQueryBuilder.execute()` → `UpdateResult.from()` 은
    `result.raw = queryResult.records`(평 배열)라 `dataSource.query()` 의 `[rows,count]` 튜플
    문제 자체는 없다 — 다만 이는 "shape 버그 없음" 확인이지 "COALESCE 가 실제로 기대한 값을
    고르는가" 라는 #4 가 원래 묻던 질문에 대한 답은 아니다). `eia-db-wire-invariant.md` 의
    "다른 plan 과의 관계" 절은 같은 호출부의 열린 항목으로 `retry-turn-terminal-guard.md` **#2**
    (`cancelledBy`)만 인지하고 **#4 는 언급하지 않는다**
  - 제안: 둘 중 하나. (a) `eia-db-wire-invariant.md`(또는 그 정본 트래커)에 #4 참조를
    추가하고, §6.5 "해소" 문구에 "메커니즘은 mock 검증까지, 실 DB e2e 는 별도 트랙(#4)" 캐비엇을
    붙인다 — 이 저장소가 `durationMs` 후속 W10(`TERMINAL_DURATION_MS_SQL` 미검증)에 이미 쓰는
    것과 같은 패턴. (b) `retry-turn-terminal-guard.md` #4 를 이 PR 범위로 끌어와 실 DB e2e 를
    추가하고 나서 "해소" 로 확정한다. 어느 쪽이든 현재는 target 의 "해소" 단정과 자매 plan 의
    "미검증" 상태가 서로를 참조하지 않은 채 나란히 존재한다.

## 교차 검증한 항목 (충돌 없음 확인)

아래는 이번 diff와 plan 대응을 직접 대조해 **정합함을 확인**한 항목들이다(발견사항에는
포함하지 않지만 검토 범위를 밝히기 위해 기록):

- `spec-sync-external-interaction-api-gaps.md` "retry-turn 재진입 시 DB 와 emit 의 `durationMs`
  가 어긋난다" 절의 3항목(①자매 1곳·②threading test·③`.returning()`) — 전부 `[x]`, 코드(
  `finalizeCancelledExecution` 의 `persisted` 분기 + `finalizeGuarded` 의 `.returning()`)와
  1:1 대응 확인
- 같은 문서 "durationMs 후속 2건" 의 REST `durationMs` 항목(③) — `[x]`, §5.3 예시·
  `ExecutionStatusDto` 갱신 확인
- `update-returning-tuple-shape.md` 의 "세 번째 stale" 각주(`finalizeCancelledExecution` 이
  이제 반환값을 읽는다는 재분류) — 이미 그 문서 자체에 소급 정정돼 있음(§2.4 caveat 집행 전
  재실측 요구, planner 위임으로 정확히 등재됨)
- `spec/conventions/node-cancellation.md` §2.4 매트릭스·Rationale — plan 이 주장한 "guarded
  UPDATE 가 걸러낸다" 과대서술 정정이 실제 파일에 반영됨(라인 198, 213-227) 확인
- `result.outputs`(§6 필드 집합, 여전히 "미구현 Planned")·분산 SSE/notification fan-out(§R10)·
  `getStatus` nodeOutput 키-allowlist(§R17 잔여) 등 트래커의 다른 미해결 항목은 이번 diff 가
  손대지 않았고 spec 표기도 그대로 "Planned"/미언급 상태 — 일방적 결정 없음
- `retry-turn-terminal-guard.md` #2(`cancelledBy` 누락, P2)는 spec §6 필드 집합 표·plan 양쪽에서
  일관되게 "미완료" 로 유지됨 — 충돌 없음

## 요약

이번 PR(`eia-db-wire-invariant`)의 spec 변경(§6.5 cancelled `durationMs` "해소", §6.3/§5.3
정합)은 정본 트래커·소급 정정 각주와 대부분 정확히 1:1 대응하며, 이전 라운드(`15_01_13`)가
지적한 "세 번째 stale" 교차 참조도 이미 반영돼 있다. 유일하게 새로 발견한 간극은, target 이
"DB=wire 해소" 를 선언하는 근거 메커니즘(COALESCE UPDATE + `.returning()`)이 자매 plan
(`retry-turn-terminal-guard.md` #4)이 이미 "실 DB 미검증" 으로 등재해 둔 바로 그 코드 경로를
확장한 것인데, 이번 PR 이 그 열린 항목을 인지·갱신하지 않았다는 점이다 — 결정 우회는 아니고
후속 항목 cross-reference 누락 수준이라 WARNING 으로 판정한다.

## 위험도

LOW
