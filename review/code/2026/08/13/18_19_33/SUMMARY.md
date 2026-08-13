# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(문서화: 회귀 테스트 주석의 근거 세션 오귀속), 나머지는 전부 INFO. 프로덕션 로직(가드 판정·트랜잭션 스코프·routing release 대칭)에 대한 8개 reviewer(전원 forced) 검증 결과 기능적 회귀는 발견되지 않음. (참고: `scope.md` 결과 파일이 디스크에 없어 본 요약 작성 중 인라인 전문으로 영속화했음 — 내용 자체는 확보되어 있어 "재시도 필요" 항목 아님, forced 화이트리스트 8명 전원의 결과 텍스트는 정상 확보됨.)

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 신규 회귀 테스트 JSDoc 이 "가드를 한 곳에만 적용하고 자매를 안 세는" 결함 패턴을 `ai-review 14_18_42 → 17_15_21 연속 지적`으로 인용하나, `14_18_42`는 실제로는 `review/code/`가 아닌 `review/consistency/2026/08/13/14_18_42/`의 consistency-check 세션이고, 그 산출물을 전수 확인해도 해당 sibling-coverage 지적은 없음(실제 지적은 `17_15_21` requirement WARNING 1 단독) | `codebase/backend/src/common/utils/assert-row-array.spec.ts:33` | `(ai-review \`14_18_42\` → \`17_15_21\` 연속 지적)`을 `(ai-review \`17_15_21\` 지적)`로 정정. 반복 실패 계열을 함께 언급하고 싶다면 정확한 세션 ID·정확한 지적 내용을 재확인 후 기재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `assertRowArray`가 던지는 예외가 4개 호출부 모두 일반 `Error`이며 호출부별 전용 에러 코드(`ErrorCode` enum)가 없음. HTTP 경계에서는 `GlobalExceptionFilter`가 일반 문구로 마스킹해 노출 위험은 없음 | `codebase/backend/src/common/utils/assert-row-array.ts` | 조치 불요. 필요 시 내부 전용 에러 클래스로 통일 고려 |
| 2 | side_effect | 헬퍼 추출로 예외 메시지 문구가 다시 재구성됨(지점별 개별 접두 → 공통 "raw SQL 결과가 배열이 아님" 접두 통일). throw 여부·트랜잭션 롤백 여부는 불변, 기능 회귀 없음. 문자열 매칭 기반 외부 모니터링이 있다면 매칭이 끊길 가능성만 존재(확인된 규칙 없음) | `codebase/backend/src/common/utils/assert-row-array.ts`, 소비부 4곳(`execution-engine.service.ts:2937,8206,8523`, `executions.service.ts:325`) | 조치 불요(의도된 리팩터). 운영 알림 규칙이 있다면 문구 갱신 검토 |
| 3 | side_effect | 신규 구조적 회귀 테스트가 `readFileSync`로 프로덕션 소스 2개 파일을 직접 읽음 — 읽기 전용, 쓰기/삭제 없음. 대상 파일이 이동/개명되면 assertion 실패 대신 `ENOENT`로 실패 | `codebase/backend/src/common/utils/assert-row-array.spec.ts:44-64` | 조치 불요(설계상 트레이드오프) |
| 4 | side_effect, maintainability | `SNAPSHOT_CACHE_MAX_ENTRIES`가 `const`→`export const`로 가시성 확대. 값·의미 변경 없고 소비처는 정의부/내부/테스트뿐이나, 자매 export 상수 `MAX_EXECUTION_PATH_ROWS`가 갖는 "왜 export 됐는지" 설명 주석과 짝을 이루지 못함(이전 라운드에서 이미 트리아지·유예됨) | `codebase/backend/src/modules/executions/executions.service.ts:64` (cf. `:43`) | 조치 불요(선택: JSDoc에 export 사유 한 줄 추가) |
| 5 | maintainability | `dispatcher as unknown as { handle: ... }` 인라인 타입 캐스트가 파일 내 4곳(이번 diff로 2곳 추가)에 반복 타이핑됨. 직전 라운드에서 2곳일 때 유예됐으나 4곳으로 늘어 재검토 여지 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:795,823,889,907` | 로컬 타입 별칭(`type DispatcherWithHandle = ...`)으로 통합 재사용 고려 |
| 6 | testing | `assertRowArray` 타입 좁히기(`asserts rows is unknown[]`) 검증 주체를 이 jest 테스트가 확인하는 것처럼 주석이 서술하나, 실제 타입 좁히기 컴파일 검증은 별도 `typecheck-ratchet` CI job(jest는 타입 strip) 몫 — 저장소가 반복 겪은 "타입 가드 테스트가 실제로 타입체크되는지" 함정과 동일 형태 | `codebase/backend/src/common/utils/assert-row-array.spec.ts:10-11` | 주석을 "런타임 접근 확인(컴파일 검증은 typecheck-ratchet 몫)"으로 명확화 |
| 7 | testing | "자매 지점 전수" 회귀 가드의 대상 범위(`FILES`)가 이 PR이 손댄 2개 파일로 하드코딩되어, backend 내 유사 raw-query 소비 패턴(예: `integration-oauth.service.ts` `consumeOAuthState`, 검증 없이 `queryResult[0]`/`.length` 소비)까지는 못 미침 | `codebase/backend/src/common/utils/assert-row-array.spec.ts:45-48` | 이번 diff 스코프 밖. `FILES` 범위 사유 명시 또는 나머지 지점 감사 백로그 등록 고려 |
| 8 | testing | "자매 지점 전수" 가드의 `CONSUMING_QUERY` 정규식이 `const X = await Y.query(` 형태만 매치 — `let`/구조분해/체이닝 형태의 신규 미가드 지점은 카운트에 안 잡혀 GREEN 유지한 채 놓칠 수 있음 | `codebase/backend/src/common/utils/assert-row-array.spec.ts:51-52` | 정규식 확장 또는 사각지대 주석화 고려 |
| 9 | concurrency | `updateExecutionStatus` else 분기는 트랜잭션 밖 단발 UPDATE라 throw가 이미 커밋된 UPDATE를 되돌리지 못함 — 가드 도입 이전에도 동일 지점에서 동일하게 예외가 전파되던 기존 동작(진단 메시지만 개선), 새로운 위험 아님 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8486-8528` | 조치 불요. 추후 이 분기를 트랜잭션화하면 더 강한 보장 가능(참고용) |
| 10 | concurrency, side_effect | `chat-channel.dispatcher.spec.ts` 신규 테스트 2건이 `jest.spyOn(Logger.prototype, ...)`으로 전역 patch. 현재 순차 실행+`finally` 복원이라 안전하나, 향후 `it.concurrent` 전환 시 교차 오염 가능성 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:790-791,818-819` | 현재로선 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음. `computeChainDepth` 가드가 RR-PL-05 fail-open 우회를 닫는 실질적 하드닝으로 평가, 내부 에러 메시지는 `GlobalExceptionFilter`가 마스킹해 노출 위험 없음 |
| requirement | NONE | 발견 없음(INFO 1). 4개 호출부와 관련 spec(§9.1 RR-PL-05, EIA §6)을 line-level 대조 + 497+38건 테스트 GREEN 재현 |
| scope | NONE | 스코프 위반 없음. 프로덕션 변경 전량이 plan 백로그/선행 3라운드 리뷰의 소급 설명 대상, `git show --stat` 대조로 확인 |
| side_effect | NONE | 판정 로직(throw 조건·트랜잭션 스코프·routing release) 불변 확인. INFO 4건(메시지 문구 변경, 파일 읽기, export 확대 등) |
| maintainability | LOW | INFO 2건(캐스트 반복 2→4곳, export 상수 문서화 비대칭) — 모두 이전 라운드 유예 항목의 연장 |
| testing | LOW | 535건 직접 실행 GREEN. INFO 3건(검증 주체 오귀속 주석, 회귀 가드 범위 한정, 정규식 사각지대) |
| documentation | LOW | **WARNING 1건**(회귀 테스트 근거 세션 오귀속) — 유일한 실질 발견 |
| concurrency | NONE | 락/advisory-lock/트랜잭션 로직 불변 확인. INFO 3건(트랜잭션 밖 지점 특성, routing release 대칭 재확인, Logger 전역 patch) |

## 발견 없는 에이전트

security, requirement, scope (Critical/Warning 없음; INFO 포함 기준으로는 side_effect·concurrency도 실질 로직 결함 없음이나 INFO 존재)

## 권장 조치사항
1. [WARNING] `assert-row-array.spec.ts:33`의 JSDoc 인용을 `(ai-review \`17_15_21\` 지적)`로 정정 — 잘못된 세션(`14_18_42`, consistency-check)을 가리키는 근거 링크를 바로잡는다.
2. (선택) `chat-channel.dispatcher.spec.ts`의 반복 캐스트(4곳)를 로컬 타입 별칭으로 통합.
3. (선택) `assert-row-array.spec.ts:10-11` 주석을 "런타임 접근 확인 — 컴파일 검증은 typecheck-ratchet CI job 몫"으로 명확화해 향후 오귀속 방지.
4. (선택, 스코프 밖) `integration-oauth.service.ts` 등 유사 raw-query 소비 패턴에 대한 별도 감사를 백로그에 등록.
5. 그 외 INFO 항목은 전부 조치 불요(의도된 설계이거나 이전 라운드에서 이미 트리아지 완료).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨. concurrency 는 router 자연 선택)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련도 낮음(변경이 타입 가드 추가/리팩터 위주, 성능 특성 불변) |
  | architecture | router 판단상 이번 diff 와 관련도 낮음(아키텍처 경계 변경 없음) |
  | dependency | router 판단상 이번 diff 와 관련도 낮음(신규/변경 의존성 없음) |
  | database | router 판단상 이번 diff 와 관련도 낮음(SQL 쿼리 문자열 자체는 불변, 반환값 검증만 추가) |
  | api_contract | router 판단상 이번 diff 와 관련도 낮음(공개 API/엔드포인트 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 관련도 낮음(사용자 가이드 대상 표면 변경 없음) |
