# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `http-connection-tester.ts` 의 SSRF preflight 가 `AbortSignal.timeout` 생성 뒤로 이동해 실제 타임아웃 예산을 잠식하는 부작용(WARNING)과, 판정 아닌 가드 오류 메시지가 3곳에서 마스킹 없이 노출되는 점(WARNING) 등 실질 WARNING 5건이 확인됨. forced(router_safety) 7개 reviewer 전원 결과 확보(누락 없음) — "강제 화이트리스트 미이행" 은 발생하지 않았다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 판정 아닌 가드 오류의 원문 메시지가 4곳 중 3곳에서 `sanitizeMessage` 마스킹을 거치지 않고 클라이언트/결과 메시지로 그대로 노출됨 (`database-query.handler.ts` 만 downstream `IntegrationError` 재검사로 우연히 안전). 오늘 가드는 순수 호스트 문자열 검사라 즉시 악용 경로는 낮지만, 이 diff 가 그 노출을 네 곳 동시에 테스트로 고정하는 지점 | `http-request.handler.ts:362-382,611-637`(`buildPreflightErrorOutput`), `database-connection-tester.ts:146-153`(`clampMessage`), `http-connection-tester.ts:124-129`(`describeFailure`→`clampMessage`) | 4개 호출부 모두 판정 아닌 가드 오류의 message 를 노출 전 `sanitizeMessage`(또는 `toLogError(err).message`) 로 통일 적용 |
| 2 | 부작용 | `outboundBlockReason` preflight 호출이 "던지지 않는다" 계약을 지키려고 `try` 안으로 이동하며, `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 생성 **뒤**로 밀렸다. `AbortSignal.timeout` 은 생성 시점부터 카운트다운하므로 이제 SSRF 가드의 `dns.lookup`(상한 없음) 시간만큼 실제 `fetch` 예산이 줄어들어, 느린 DNS 환경에서 정상 연결도 "10초 timeout" 으로 오분류될 수 있다. 방향은 개선(무한대→10초 상한)이나 문서화·테스트 안 됨(requirement 리뷰가 동일 지점을 확인) | `codebase/backend/src/modules/integrations/http-connection-tester.ts:118-129`(`testHttpConnection`) | `init`(`AbortSignal.timeout` 생성)을 preflight 통과 후로 옮기거나, `fetch` 호출 직전에 시그널을 생성해 가드 시간을 전송 타임아웃 예산에서 분리 |
| 3 | 부작용 / 테스트 | 신설 `http-redirect.spec.ts` 가 `assertSafeOutboundHostResolved` 를 mock 하지 않아, 첫 테스트(`'통과하면 null'`)가 실제 `node:dns/promises` lookup 을 수행한다. 순수 유닛 테스트가 네트워크/DNS 가용성에 의존하게 되어 에어갭/샌드박스 환경에서 flaky·hang 위험 | `codebase/backend/src/nodes/integration/http-request/http-redirect.spec.ts:6-9`(mock 팩토리), `:23-26`(트리거 테스트) | `assertSafeOutboundHostResolved` 도 `jest.fn()` 으로 mock 에 추가하고 `mockResolvedValue(undefined)` 명시 |
| 4 | 문서화 | `database-query.handler.ts` 의 기존 인라인 주석("SSRF guard 의 plain Error 는 `DB_HOST_BLOCKED` 로 승격되므로…")이 이번 diff 이전(무조건 승격 시절) 동작을 설명하던 문장으로, 이제 판정/비판정 두 갈래로 나뉜 현재 동작의 절반만 설명한다 — 결론(mapDbError fallback 으로 안 흐름)은 여전히 참이지만 근거 문장이 오해를 유발 | `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:338-342` | 두 갈래(판정=`DB_HOST_BLOCKED`, 비판정=`INTEGRATION_CALL_FAILED`)를 모두 반영하도록 주석 갱신 |
| 5 | 문서화 / 증거 갭 | `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 목록이 이번 PR 이 직접 수정한 `http-redirect.ts` 를 머지 시점까지 여전히 누락(`--impl-prep` consistency-check 가 이미 WARNING 으로 지적, plan 체크리스트에 "마무리 커밋에서 등재" 로 명시됐으나 미해소). developer 는 spec 쓰기 권한 밖(자기-반증형 소정정 5조건 미충족) | `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` | project-planner 턴에서 `code:` 목록에 `http-redirect.ts` 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 판정/비판정 `instanceof SsrfBlockedError` 분기와 그 근거 주석이 4개 프로덕션 파일에 유사하게 반복됨. plan 문서가 이미 별도 트래커 항목(공용 가드 추출, planner 필요)으로 스코프아웃 | `database-connection-tester.ts:146`, `http-request.handler.ts:362`, `database-query.handler.ts:270`, `http-redirect.ts:36` | 후속 트래커에서 `classifyGuardFailure(err)` 류 헬퍼로 단일화 고려 |
| 2 | 유지보수성 / 문서화 | `testDatabaseConnection`/`testHttpConnection` JSDoc 결과-코드 표가 "가드 자체의 고장"이라는 새 트리거를 예시로 나열하지 않음(인라인 주석에는 있으나 함수 계약 요약엔 없음) | `database-connection-tester.ts:125-134`, `http-connection-tester.ts:74-87` | JSDoc 항목에 "(SSRF 가드 자체의 고장 포함)" 문구 보강 |
| 3 | 테스트 | 신규 `INTEGRATION_CALL_FAILED` 비판정 분기가 `authentication: 'integration'` 한 케이스만 테스트됨(기존 판정 경로는 `none`/`custom` 까지 `it.each` 로 커버 — 비대칭) | `http-request.handler.ts:364`, `http-request.handler.spec.ts:960` | `it.each(['none','custom'])` 로 비판정 분기도 대칭 커버 |
| 4 | 테스트 | `followRedirectsSafely` 루프 내부(리다이렉트 홉)에서 가드가 비판정 오류를 던지는 경로는 직접 테스트되지 않음(구조상 첫 홉과 동일 코드 경로라 위험은 낮음, plan 테스트 목록에도 미포함) | `http-redirect.ts:55-79` | 302 응답 뒤 비판정 오류 케이스 1건 추가 고려(필수 아님) |
| 5 | 부작용 | `outboundBlockReason` 의 "던지지 않는다" 암묵 계약이 이번 diff 로 깨졌으나, 현재 소비자 둘(`http-request.handler.ts`, `http-connection-tester.ts`) 다 함께 갱신되어 실질 위반은 없음 — 향후 세 번째 소비자가 옛 JSDoc("차단은 던지지 않고 반환")만 보고 무방비 호출할 위험만 잠재 | `http-redirect.ts:30-39` | JSDoc 에 신규 throw 경로(비판정 오류는 그대로 전파) 명시 |
| 6 | 문서화 / 요구사항 | `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query}.md` 의 에러 코드 표가 "SSRF 가드가 판정 아닌 오류를 던진 경우 → `INTEGRATION_CALL_FAILED`" 신규 트리거 예시를 아직 나열 안 함. 이미 `--impl-prep` consistency-check(cross_spec) 가 INFO 로 기록, plan 에 "`--impl-done` 이후 planner 턴" 으로 추적 중 | `spec/4-nodes/4-integration/0-common.md` §4.2, `1-http-request.md` §4.2, `2-database-query.md` §6.2 | 별도 조치 불요(이미 계획됨), planner 턴 누락 여부만 후속 확인 |
| 7 | 범위 | `database-connection-tester.spec.ts` 만 신규 import 순서가 나머지 5개 형제 파일과 반대(소문자 우선 vs 대문자/ASCII 우선). 실질 영향 없음 | `database-connection-tester.spec.ts:5-8` | 조치 불요, 다음에 파일을 만질 때 정렬 맞추기 |

## 문제 없음으로 확인된 항목 (참고)

- SSRF fail-closed 특성은 네 호출부 전부에서 보존됨 — 판정 아닌 오류가 나도 실제 네트워크/DB 연결 이전에 즉시 반환/재throw 되며 우회(가드 실패 시 통과) 없음(security).
- `http-connection-tester.ts` 의 preflight `try` 이동은 부수적으로 기존 결함(no-throw 계약 위반으로 스택 트레이스 노출 가능 경로)도 함께 고침(security).
- 차단 판정 시 클라이언트에는 항상 일반화 문구만 나가고 원문 host/IP 는 서버 로그에만 남는 기존 정찰 면 축소 설계 그대로 보존(security).
- plan 이 선언한 4+1 소비자의 판정/비판정 분기가 line-level 로 정확히 구현됨, spec 과 모순 없음(requirement).
- `SsrfBlockedError` 실물을 `jest.requireActual` 로 보존한 mock 설계, `cause` 미부착 근거 등 근거-구현 일치 확인(requirement, maintainability).
- 10개 코드 파일 전부 plan 이 선언한 단일 스코프 안에 있고, 무관한 리팩토링/설정 변경 없음(scope).
- 209/209 테스트 GREEN 재현 확인, 대표 분기 하나를 뮤테이션(`if (false)`)해 해당 테스트만 정확히 RED 재현, 원복 후 저장소 clean 확인(testing).
- frontend/i18n/docs 트리거 매트릭스 20개 항목 전수 대조 결과 실질 매칭 없음 — 순수 백엔드 내부 리팩터(user_guide_sync).
- CHANGELOG.md 미갱신은 "오늘은 비판정 경로에 아무도 도달하지 않아 사용자 관측 가능한 동작 차이 없음" 이라는 plan 의 실측 근거와 일치, 결함 아님(documentation).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 판정 아닌 가드 오류 메시지가 4곳 중 3곳에서 미마스킹 노출(WARNING); fail-closed 특성·정찰면 축소는 보존 확인 |
| requirement | LOW | plan 목표 line-level 구현 일치 확인; 타임아웃 예산 변화(side_effect WARNING #2 와 동일 지점) 및 spec 표 갭은 이미 추적 중 |
| scope | NONE | 10개 파일 전부 단일 스코프 내; import 순서 사소한 불일치만(INFO) |
| side_effect | MEDIUM | preflight 재배치로 타임아웃 예산 잠식(WARNING) + 신설 spec 의 실제 DNS 조회(WARNING) |
| maintainability | LOW | 판정 분기 로직 4곳 반복(스코프아웃됨, INFO), JSDoc 완전성 갭(INFO) |
| testing | LOW | 209/209 GREEN + 뮤턴트 RED 재현 확인; 커버리지 비대칭 2건(INFO) |
| documentation | LOW | 기존 주석 stale화(WARNING) + spec frontmatter `code:` 누락 미해소(WARNING); 신규 주석/JSDoc 품질은 양호 |
| user_guide_sync | NONE | frontend docs/dict/backend-labels 트리거 실질 매칭 없음; 순수 백엔드 내부 리팩터 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 INFO 이상을 기록했다(스코프·유저가이드 reviewer 도 사소한 정보성 발견 포함).

## 권장 조치사항

1. `http-connection-tester.ts` 의 `AbortSignal.timeout` 생성 시점을 preflight 통과 후로 옮기거나 `fetch` 직전으로 늦춰, SSRF 가드의 DNS 조회 시간이 연결 테스트 타임아웃 예산을 잠식하지 않도록 한다 (WARNING #2).
2. 판정 아닌 가드 오류의 원문 메시지를 노출하는 3개 호출부(`http-request.handler.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`)에 `sanitizeMessage` 마스킹을 통일 적용한다 (WARNING #1).
3. 신설 `http-redirect.spec.ts` 에서 `assertSafeOutboundHostResolved` 를 mock 하여 유닛 테스트 중 실제 DNS 조회가 발생하지 않도록 한다 (WARNING #3).
4. `database-query.handler.ts:338-342` 의 stale 주석을 판정/비판정 두 갈래 모두 반영하도록 갱신한다 (WARNING #4).
5. project-planner 턴에서 `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 에 `http-redirect.ts` 를 추가하고, 동시에 `0-common.md`/`1-http-request.md`/`2-database-query.md` 의 에러 코드 표에 "SSRF 가드가 판정 아닌 오류를 던진 경우" 트리거 예시를 보강한다 (WARNING #5, INFO #6).
6. (선택) INFO 항목들 — JSDoc 보강, 테스트 커버리지 대칭화, 판정 분기 로직 공용화 — 은 후속 트래커에서 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — **forced 전원 결과 확보됨(누락 없음)**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 변경(catch 분기 판정/비판정 분류 리팩터)과 관련 낮음으로 판정(개별 사유 미제공, 성능 특성 변경 없음) |
  | architecture | 라우터가 이번 변경과 관련 낮음으로 판정(아키텍처 구조 변경 없음, 기존 catch 분기 세분화만) |
  | dependency | 라우터가 이번 변경과 관련 낮음으로 판정(신규 의존성 추가 없음) |
  | database | 라우터가 이번 변경과 관련 낮음으로 판정(DB 스키마/쿼리 로직 불변, 에러 분류만 변경) |
  | concurrency | 라우터가 이번 변경과 관련 낮음으로 판정(동시성 제어 로직 불변) |
  | api_contract | 라우터가 이번 변경과 관련 낮음으로 판정(외부 API 계약/wire 포맷 불변) |
