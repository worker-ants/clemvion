# 테스트(Testing) Review — interactionType 판정 규칙 단일 SoT 화 (coalesceInteractionType 신설)

검토 대상: `coalesceInteractionType(metaType, flatType)` 신설 + `readPersistedInteractionType` 위임화,
publisher SQL 을 raw 2-컬럼 투영으로 단순화, 그리고 이에 대응한 신규 테스트 3종(coalesceInteractionType
unit 4건 / legacy flat root 표면 unit 2건 / JSONB 이중 투영 단언 갱신 / orphan-node 테스트 주석 재작성).

직전 라운드(`review/code/2026/07/11/00_49_34`) database.md(WARNING)·requirement.md(WARNING)·
maintainability.md(WARNING, MEDIUM)가 3인 수렴 지적한 "SQL COALESCE 가 규칙의 4번째 사본이 되어
`readPersistedInteractionType` 를 dead code 로 만들고, 그 SQL 분기가 어떤 테스트로도 검증되지 않는다"는
지적에 대한 이번 라운드 대응이 실제로 비-vacuous 하게 갭을 메우는지를, 프로덕션 코드(`waiting-surface-guard.ts`,
`execution-engine.service.ts`)와 마이그레이션 DDL 을 직접 대조해 검증했다.

## 발견사항

- **[WARNING]** `coalesceInteractionType` 의 "비-문자열 무시(string-guard)" 분기는 실제 SQL 호출부에서는 도달 불가능한 dead branch — 신규 unit 테스트가 검증하는 입력은 프로덕션에서 결코 발생하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts:111-117` (`coalesceInteractionType`), `codebase/backend/src/modules/execution-engine/waiting-surface-guard.spec.ts:381-384` (`it('비-문자열은 무시 (string-guard)', ...)` — `coalesceInteractionType(7, 'buttons')` / `coalesceInteractionType({}, null)`), `execution-engine.service.ts:67-73`(`WaitingNodeRow` — `metaInteractionType: string | null`), `execution-engine.service.ts:5306-5309`(실제 호출부 `coalesceInteractionType(row.metaInteractionType, row.flatInteractionType)`)
  - 상세: PostgreSQL `->>` 연산자는 대상 JSON 값이 `null` 이 아닌 한 항상 **text 로 강제 캐스팅**해 반환한다(숫자 `7`→`'7'`, 불리언 `true`→`'true'`, JSON `null`→SQL `NULL`). 즉 `ne.output_data -> 'meta' ->> 'interactionType'` 로 투영되는 시점에 이미 원본 JSON 타입 정보는 사라지고, node-postgres 드라이버는 이를 항상 JS `string`(또는 `null`)으로 반환한다. 이것이 바로 `WaitingNodeRow` interface 가 `metaInteractionType: string | null`(⁠`unknown` 아님)로 타입돼 있는 이유다 — 실제 SQL 호출부(`5306-5309`)가 `coalesceInteractionType` 에 넘기는 두 인자는 **타입 레벨에서부터 이미 `string | null` 로 좁혀져 있어, `typeof x === 'string'` 이 `false` 가 될 수 있는 유일한 경우는 `null` 뿐**이다. 다시 말해 SQL 경로에서는 "비-문자열이지만 non-null인 값"이 원천적으로 만들어질 수 없으므로, 신규 unit 테스트가 검증하는 `coalesceInteractionType(7, 'buttons')`(raw JS 숫자 `7`)류 입력은 **이 함수의 유일한 실제 소비처(SQL 투영 결과)로는 결코 도달할 수 없는 시나리오**다. 이 입력이 유효한 유일한 호출부는 `readPersistedInteractionType`(in-memory `outputData` 객체, `meta.interactionType` 이 파싱된 JSON 원본 타입을 그대로 보존)뿐이다.
  - 직전 라운드가 지적한 실제 문제(`meta.interactionType = 7`, `interactionType = 'buttons'` 같은 손상 데이터에서 `readPersistedInteractionType`(in-memory)은 `'buttons'`를 반환하지만 SQL `COALESCE` 는 `'7'`을 반환해 두 "동일 규칙" 구현이 실제로 갈린다는 divergence)는, 이번 리팩터로 SQL 이 `COALESCE` 대신 raw 2-값만 추출하도록 바뀌었어도 **여전히 재현된다**: SQL 이 `metaInteractionType = '7'`(text 로 이미 캐스팅됨)을 반환하면, `coalesceInteractionType('7', 'buttons')` 는 `typeof '7' === 'string'` 이 `true` 이므로 `'7'` 을 채택한다 — 리팩터 이전과 정확히 같은 결과다. `->>` 가 원본 JSON 타입 정보를 이미 소거해버리는 한, "string-guard 를 TS 함수 하나가 단독 소유한다"는 코드 주석(`execution-engine.service.ts:64-65`, `5203`)의 주장은 SQL 로 공급되는 값에 대해서는 구조적으로 성립할 수 없다.
  - 즉 신규 unit 테스트는 `coalesceInteractionType` 함수 자체의 로직(고립된 순수 함수 계약)에 대해서는 non-vacuous 하지만, **직전 라운드가 실제로 문제 삼은 "SQL 분기의 비-문자열 divergence"라는 시나리오는 여전히 어떤 테스트로도(unit·e2e 불문) 검증되지 않는다** — 검증하려면 실제 Postgres 에 `meta.interactionType` 을 숫자/불리언 JSON 값으로 저장하고 `->>` 투영 결과를 관찰하는 e2e/SQL fragment 테스트가 필요하나 이번 커밋에는 없다(commit 서술의 "비문자열 무시" 테스트는 이 시나리오를 커버한다고 오인되기 쉬운 이름이다).
  - 실무 영향은 직전 라운드 3개 리뷰가 이미 확인한 대로 낮다: 정상 handler 는 항상 `meta.interactionType` 에 유효한 enum 문자열만 기록하고, divergence 가 발생하는 유일한 경로(손상 데이터)에서도 결과는 fail-closed(`INVALID_EXECUTION_STATE`) 방향으로 수렴한다. 그러나 "왜 안전한지"에 대한 근거가 "테스트가 검증해서"가 아니라 "실무 데이터가 항상 유효해서" 라는 점은 이번 커밋 이후에도 바뀌지 않았다.
  - 제안: (a) 최소한 JSDoc·commit 메시지에서 "coalesceInteractionType 의 string-guard 는 in-memory 소비처(`readPersistedInteractionType`) 전용이며, SQL 로 공급되는 두 값은 이미 `string | null` 로 확정돼 있어 이 분기가 도달하지 않는다"는 사실을 명시할 것 — 현재 JSDoc(`waiting-surface-guard.ts:105-109`)은 두 소비처가 완전히 동등하게 이 함수를 공유한다는 인상을 준다. (b) 만약 SQL 쪽 divergence 자체를 진짜로 닫고 싶다면 `jsonb_typeof(ne.output_data->'meta'->'interactionType') = 'string'` 가드를 SQL 에 추가해 비-문자열이면 SQL 레벨에서 NULL 을 투영하도록 해야 하며, 그래야 `coalesceInteractionType` 의 string-guard 가 SQL 경로에서도 실질적 의미를 갖는다. 지금 상태로는 (a) 수준의 문서 정정만으로도 "새 테스트가 이 divergence 를 닫았다"는 오인을 막을 수 있다.

- **[WARNING]** Orphan-node(JOIN 탈락) 테스트 주석의 "실 JOIN 은 e2e 커버" 서술이 부정확 — 그 시나리오는 e2e 를 포함해 어떤 테스트로도 검증되지 않으며, 구조적으로 검증 불가능하다
  - 위치: `execution-engine.service.spec.ts:2294-2298`(신규 주석), `it('JOIN 탈락(빈 rawRows) → INVALID_EXECUTION_STATE', ...)`; 비교: `migrations/V001__initial_schema.sql:237` (`node_id UUID NOT NULL REFERENCES node(id) ON DELETE CASCADE`)
  - 상세: 신규 주석은 "실제 JOIN 탈락 semantics 는 e2e(실 Postgres)가 커버한다"고 명시하지만, 저장소 전체(`codebase/backend/test/*.e2e-spec.ts`)를 검색한 결과 "노드 정의가 삭제된 NodeExecution 행" 시나리오를 만들거나 검증하는 e2e 는 존재하지 않는다. 게다가 `node_execution.node_id` 는 `NOT NULL` + `ON DELETE CASCADE` FK 로 DB 레벨에서 강제되므로(이 사실은 같은 라운드의 `database.md` INFO (b) 가 이미 명시), 그 시나리오 자체가 커밋된 데이터에서 구조적으로 발생 불가능하다 — 즉 e2e 로도 "만들 수" 없는 상태다. 따라서 e2e 스위트가 실제로 검증하는 것은 "노드 정의가 존재하는 정상 케이스에서 INNER JOIN 이 매칭에 성공한다"는 happy-path 뿐이며, 테스트 이름·주석이 암시하는 "노드 정의 부재로 인한 JOIN 탈락(drop-out)" semantics 자체는 e2e 로도 실증되지 않는다.
  - 직전 라운드 testing.md WARNING("JOIN 탈락 유닛 테스트는 실제 SQL JOIN 동작을 검증하지 않고 기존 0건 케이스를 재기술할 뿐")에 대해, 이번 개정은 최소한 "이 unit 테스트 자체는 mock 특성상 실 SQL 을 검증하지 않는다"는 점을 정직하게 인정한 점은 개선이다. 그러나 그 대체 근거로 제시한 "e2e 가 커버한다"는 주장이 검증 결과 사실이 아니므로, 정직성 개선이 완전하지 않다 — 더 정확한 서술은 "이 시나리오는 FK 무결성으로 인해 정상 운영에서 도달 불가능하므로 별도 테스트가 없다(database.md 참조)"일 것이다.
  - 제안: 주석에서 "실 JOIN 은 e2e 커버" 문구를 "이 시나리오는 `node_id NOT NULL + ON DELETE CASCADE` FK 로 인해 커밋된 데이터에서 구조적으로 도달 불가능하므로, e2e 를 포함해 별도 실증 테스트가 없다(안전성의 근거는 FK 무결성이지 테스트 커버리지가 아니다)"로 정정할 것. 코드 정정은 불필요.

- **[INFO]** `waitingRawRows` mock 의 타입이 production `WaitingNodeRow` interface 에 정적으로 바인딩돼 있지 않음 — 이번 리팩터가 막으려는 "사본 간 조용한 drift" 클래스의 재발 방지 여지가 남음
  - 위치: `execution-engine.service.spec.ts:237` (`let waitingRawRows: Array<Record<string, unknown>>;`) vs `execution-engine.service.ts:67-73` (`interface WaitingNodeRow { ... }`, export 되지 않음)
  - 상세: `WaitingNodeRow` 는 export 되지 않아 spec 파일이 이를 import 해 `waitingRawRows: WaitingNodeRow[]` 로 강타입할 수 없다. 현재 타입(`Record<string, unknown>`)은 임의의 키를 허용하므로, 향후 누군가 프로덕션에서 `metaInteractionType`/`flatInteractionType` 필드명을 바꾸거나 필드를 추가/삭제해도 이 mock 은 컴파일 타임에 아무 에러 없이 통과하고, 런타임에만(그리고 오직 관련 단언이 있는 테스트에서만) 조용히 어긋난 값(예: `undefined` → 항상 flat-fallback 취급)으로 새는 채로 그린을 유지할 수 있다. 실제로 이번 diff 에서 필드명이 `interactionType` 단일 → `metaInteractionType`/`flatInteractionType` 이중으로 바뀌었을 때, 4곳의 mock 리터럴을 수작업으로 전부 찾아 갱신했는데(grep 결과 누락은 없음을 확인했으나) 이는 컴파일러가 아니라 사람이 보장한 정합성이다.
  - 제안: `WaitingNodeRow` 를 export 하고 `waitingRawRows: WaitingNodeRow[]` 로 좁히면, 향후 필드 shape 변경 시 mock 리터럴이 자동으로 컴파일 실패해 "SQL 투영 shape 변경을 mock 이 놓친다"는 이번 커밋이 겨냥한 것과 같은 클래스의 실수를 원천 차단할 수 있다. 즉시 조치 불요(현재는 grep 으로 누락 없음을 확인했음).

- **[INFO]** `armSlowPathResume` 헬퍼가 여전히 `coalesceInteractionType`/`readPersistedInteractionType` 를 호출하지 않고 규칙을 손수 재구현(3번째 사본) — 직전 라운드가 이미 인지한 잔여 갭, 이번 커밋 범위 밖
  - 위치: `execution-engine.service.spec.ts:1058-1076` — `metaInteractionType: typeof meta?.interactionType === 'string' ? meta.interactionType : null`, `flatInteractionType: typeof rawPersisted.interactionType === 'string' ? rawPersisted.interactionType : null`
  - 상세: 직전 라운드 maintainability.md INFO("`armSlowPathResume` 테스트 헬퍼의 규칙 재구현은 별도 조치 불요하나 인지 필요")가 이미 특정한 항목과 동일 — 이번 커밋은 필드명만 두 컬럼으로 갱신했을 뿐, 여전히 `typeof === 'string'` 판정을 인라인으로 재구현한다(`coalesceInteractionType` import·호출 아님). 우연히 지금은 프로덕션 규칙과 일치하지만, 이 헬퍼가 `coalesceInteractionType(meta?.interactionType, rawPersisted.interactionType)` 를 직접 호출하도록 바꾸면 이런 "제3의 사본" 자체가 없어진다.
  - 제안: 즉시 조치 불요(직전 라운드에서 이미 non-blocking 으로 판단됨). 후속 정리 시 함께 처리 권장.

## 확인된 강점 (비-vacuity 실증)

- `coalesceInteractionType` 의 meta-우선/flat-fallback/둘다-부재 3개 테스트는 실제 export 된 순수 함수를 mock 없이 직접 호출해 정확한 precedence 계약을 검증한다 — production 호출부(`execution-engine.service.ts:5306-5309`, `waiting-surface-guard.ts:135` 의 `readPersistedInteractionType` 위임)와 동일 함수라 non-vacuous.
- legacy flat root 표면 unit 2건(`armWaitingSurface(..., 'flat')`)은 실제 `resolveWaitingNodeExecutionId`(mock QueryBuilder) → `assertCommandMatchesWaitingSurface` → `coalesceInteractionType` → `resolveWaitingSurface` 전체 체인을 통과시켜, "meta 부재·flat 만 존재"일 때 buttons 표면이 거부/통과 양쪽에서 정확히 판정됨을 end-to-end 로 검증한다 — 이는 flat-fallback 분기가 (SQL 의 raw 값 형태 제약 안에서는) 실제 코드 경로로 작동함을 정확히 실증한다.
- JSONB 이중 투영 단언(`'meta' ->> 'interactionType'` 별도 정규식 vs `'meta'` 미포함 `->> 'interactionType'` 별도 정규식)은 두 `addSelect` 호출이 실제로 분리돼 있는지 정확히 구분해 가드한다 — 이전 라운드의 단일 문자열 포함 검사(`/interactionType/.test`)보다 엄밀해졌다.
- `waiting-surface-guard.spec.ts` 의 기존 `readPersistedInteractionType` 테스트(6건, 비-문자열 `meta.interactionType: 7` 케이스 포함)는 리팩터 후에도 `coalesceInteractionType` 위임을 통해 그대로 유효하다 — 회귀 없음을 확인했다.

## 요약

직전 라운드가 지적한 "SQL 분기 미검증" 문제 중 **precedence(meta 우선 vs flat fallback) 축**은 이번 커밋으로 실질적으로 닫혔다 — `coalesceInteractionType` 이 SQL/TS 양쪽에서 공유되는 단일 함수가 됐고, 신규 legacy-flat unit 2건이 그 함수를 실제 프로덕션 호출 체인(mock QueryBuilder → 판정 → publish)으로 end-to-end 실증하며, JSONB 이중 투영 단언도 두 컬럼이 실제로 분리 투영됨을 정밀하게 가드한다. 그러나 **string-guard(비-문자열 값 거부) 축**은 구조적으로 닫힐 수 없는 상태로 남아 있다 — PostgreSQL `->>` 가 non-null JSON 스칼라를 항상 text 로 캐스팅하므로 SQL 이 공급하는 두 값은 이미 `string | null` 로 확정되고, 신규 "비-문자열 무시" unit 테스트가 넣는 raw JS 숫자/객체 입력은 이 함수의 유일한 실제 소비처(SQL 결과)로는 결코 도달할 수 없는 시나리오다. 즉 이 테스트는 함수 자체의 계약에는 non-vacuous 하지만, 직전 라운드가 실제로 문제 삼은 "SQL COALESCE 의 divergence 시나리오"는 여전히 어떤 테스트로도 검증되지 않는다(다만 실무 데이터는 항상 유효한 문자열이고 divergence 방향도 fail-closed 라 위험은 낮다는 직전 3개 리뷰의 결론은 그대로 유효하다). Orphan-node(JOIN 탈락) 테스트 주석은 "unit 이 실 SQL 을 검증하지 않는다"는 점은 정직하게 인정했으나, 그 대체 근거인 "e2e 가 실 JOIN 탈락을 커버한다"는 서술은 검증 결과 사실이 아니다 — 그 시나리오는 FK(`NOT NULL` + `ON DELETE CASCADE`) 로 인해 커밋된 데이터에서 구조적으로 발생 불가능하며, 실제로 어떤 e2e 도 이를 만들거나 검증하지 않는다(안전성의 진짜 근거는 FK 무결성이지 테스트 커버리지가 아니다). 이 세 항목 모두 신규 회귀나 CRITICAL 급 결함은 아니며, 직전 3개 라운드가 이미 "실무 위험 낮음"으로 수렴한 동일 axis 의 잔여 문서/테스트 정확성 이슈다. 부가적으로 mock 타입(`Array<Record<string, unknown>>`)이 프로덕션 `WaitingNodeRow` 에 정적으로 바인딩되지 않은 점(테스트 용이성 개선 여지)과 `armSlowPathResume` 의 규칙 재구현(직전 라운드가 이미 인지한 잔여 갭)도 낮은 우선순위로 병기한다.

## 위험도

LOW — 신규 회귀는 발견되지 않았고, 남은 갭은 모두 직전 3개 라운드(database/requirement/maintainability)가 이미 "실무 도달 불가능·fail-closed 방향" 으로 결론지은 동일 axis 의 문서·테스트 정확성 이슈다. 다만 "SQL 분기가 이제 테스트로 검증된다"는 커밋 메시지의 주장은 precedence 축에서만 사실이고 string-guard 축에서는 구조적으로 성립하지 않으므로, 후속 커밋에서 JSDoc/주석 정정(코드 변경 불요)을 권고한다.
