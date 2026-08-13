# Code Review 통합 보고서

## 전체 위험도
**LOW** — TypeORM `UPDATE`/`DELETE ... RETURNING` 튜플 shape 오인 결함(소셜 로그인 상시 실패·admission cap 미작동·KB CAS 락 미거절)을 공용 헬퍼(`updateReturningRows`)로 일원화해 바로잡는 수정. CRITICAL 없음. WARNING 4건은 전부 구조적 강제 수단·테스트 커버리지·문서 교차참조의 "잔여 사각지대"(급하지 않음, 즉각 조치 불요)이며, forced whitelist(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `updateReturningRows` 는 "raw `.query()` 직후 반드시 호출한다"는 호출부 규율로만 강제되며, 데이터 접근 경계 자체가 구조적으로 흡수하지 않는다. 강제 수단도 이 PR 이 손댄 3개 파일만 하드코딩으로 나열한 회귀 테스트(`EXPECTED`/`FILES` 배열)뿐 — 새 raw UPDATE/DELETE 지점이 이 3파일 밖에 생기면 아무 가드도 RED 를 내지 않는다 | `codebase/backend/src/common/utils/update-returning-rows.spec.ts:58-64`, `assert-row-array.spec.ts:56-59` | 급하지 않음. 후속으로 raw UPDATE/DELETE 를 감싸는 얇은 래퍼(`DataSource`/`EntityManager` 확장 메서드)로 "호출 즉시 언랩"을 구조적으로 강제하는 것을 검토 |
| 2 | architecture | 두 구조적 회귀 가드가 공유하는 `stripComments` 유틸이 자신의 존재 이유(주석 속 언급이 카운트를 오염시키는 것 방지)를 줄 끝(트레일링) 주석에는 적용하지 않는다 — 정확히 이 결함 클래스가 이미 한 번 이 저장소에서 실제 발생(블록 주석 형태)했다 | `codebase/backend/src/common/utils/__testing__/source-scan.ts:22-33` | 급하지 않음(문서화된 트레이드오프). 세 번째 가드가 재사용하기 전 `countCalls` JSDoc 에 "줄 끝 주석은 사각지대"임을 명시 |
| 3 | documentation | `assertRowArray` JSDoc 이 "튜플도 배열이라 이 가드로는 못 걸렀다"는, 바로 이 PR 이 겪은 결함 클래스를 언급하지 않는다 — 사각지대가 자매 헬퍼(`updateReturningRows`)의 JSDoc·테스트 주석에만 적혀 있어, 다음에 새 raw SQL 소비 지점을 추가하는 엔지니어가 `assertRowArray`를 먼저 발견하면 UPDATE/DELETE 지점에도 오용할 위험 | `codebase/backend/src/common/utils/assert-row-array.ts:1-15`(이번 PR diff 대상 밖) | `assertRowArray` JSDoc 에 "UPDATE/DELETE RETURNING 결과에는 쓰지 말 것 — `updateReturningRows`를 쓴다" 교차 참조 한 줄 추가 |
| 4 | documentation | `updateReturningRows` JSDoc 이 "반환 행의 컬럼명은 raw SQL 이라 snake_case이고 제네릭 `T`는 검증이 아니라 단언"이라는, 이 PR 이 실제로 8곳 중 한 곳(`auth-oauth.service.ts`)에서 겪은 2차 결함 교훈을 담지 않는다. 나머지 7개 호출부는 대소문자 차이가 없는 필드만 써서 우연히 함정을 피했을 뿐 | `codebase/backend/src/common/utils/update-returning-rows.ts:1-35` | JSDoc 에 "반환 행 키는 raw SQL 그대로의 snake_case. entity 타입을 제네릭으로 넘기면 컴파일은 통과하지만 필드가 조용히 undefined" 캐비엇 추가 |
| 5 | testing | `stripComments`가 이 PR 전체가 막으려는 실패 유형(주석 속 심벌 언급→카운트 부풀림→구조적 가드 무력화)에 대해 **줄 끝 주석 케이스만 테스트가 없다** — `source-scan.spec.ts` 4개 테스트는 과소 카운트(URL 절단) 방향만 검증하고 과다 카운트(트레일링 주석 심벌 언급) 방향은 잠그지 않음. 현재 4개 소비 파일엔 해당 사례가 없어 오탐은 없음 | `codebase/backend/src/common/utils/source-scan.ts:27`, `__testing__/source-scan.spec.ts`(전체) | `const x = foo(); // bar(y) 참고` 류 fixture 로 현재 동작(포함 여부)을 명시 고정하는 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | OAuth state anti-replay/CSRF 방어 무력화 결함을 바로잡는 수정 — 수정 전엔 만료/재사용 state 거절과 provider 일치 검사가 무력화됐으나, 부작용으로 모든 콜백이 fail-closed 되어 실질적 우회로 이어지진 않았던 것으로 보임. e2e(`auth-oauth-callback.e2e-spec.ts`)로 회귀 고정됨 | `codebase/backend/src/modules/auth/auth-oauth.service.ts` `handleCallback` | 조치 불요 |
| 2 | security | KB CAS 락(`reExtractAll`/`reEmbedAll`) 및 execution admission cap 의 동시성 가드도 같은 튜플 오인 버그로 사문화돼 있었고 이번 수정으로 복원 | `knowledge-base.service.ts`, `execution-engine.service.ts` `admitExecutionOrDefer` | 조치 불요 |
| 3 | security | 신규/변경 raw SQL 8곳 전부 파라미터 바인딩 유지, SQL 인젝션 신규 표면 없음. 하드코딩 시크릿·자격증명 없음(diff 전체 재스캔) | 전체 변경 파일 | 조치 불요 |
| 4 | side_effect | `updateExecutionStatus` 반환값(`persisted`) 수정이 diff 밖 4개 파일(`ai-turn-orchestrator.service.ts` 등)의 호출자에도 즉시 파급 — plan 문서(`spec-update-node-cancellation-shutdown-classification.md`)와 CHANGELOG 에 이미 전수 열거·교차 인용됨 | `execution-engine.service.ts` `updateExecutionStatus` | 조치 불필요, 배포 후 관측 항목 이미 plan 등재 |
| 5 | side_effect | `AuthOauthService.handleCallback` 의 `rememberMe` 가 "항상 사실상 false"에서 "실제 요청값"으로 바뀌어 refresh 쿠키 Max-Age 가 7일→30일로 변경(의도된 버그 수정) | `auth-oauth.service.ts` | 참고 기록 |
| 6 | maintainability | `AuthOAuthStateRow`(신규 raw-row 타입)와 기존 엔티티 `AuthOAuthState`가 이름이 한 단어 차이라 shape 혼동 위험 잔존 | `auth-oauth.service.ts` | 급하지 않음. 향후 `RawAuthOAuthStateRow` 류 접두어 검토 |
| 7 | maintainability | `knowledge-base.service.ts:727` 주석의 "①" 참조가 실제로는 존재하지 않는 넘버링 체계(대상 주석은 아라비아 숫자 `1)`)를 가리킴 — 5라운드째 미수정, 기능 영향 없음 | `knowledge-base.service.ts:727` | `// 1) 과 같은 CAS 락`으로 표기 정정 |
| 8 | testing | `auth-oauth.service.spec.ts` 신규 3개 테스트만 실제 드라이버 튜플 shape 을 mock, 기존 7개는 여전히 결함을 숨겼던 행 배열 직접 shape 사용(기능적으로 무해 — 헬퍼가 양쪽 다 허용) | `auth-oauth.service.spec.ts:206,213,224,276,296,313,327` | 필수 아님. 나머지 7개도 `[[validState],1]` 형태로 통일 검토 |
| 9 | database | `updateReturningRows` 의 shape 판별이 TypeORM/pg 의 비공개 내부 동작(`Array.isArray(result[0])`)에 의존 — 마이너 업그레이드가 규약을 바꾸면 조용히 재발 가능 | `update-returning-rows.ts:52` | e2e/`update-returning-rows.spec.ts` 를 TypeORM/pg 버전업 PR 의 CI 트리거 경로에 포함 확인(향후 참고) |
| 10 | database | `reEmbedAll` 의 CAS 락 UPDATE 와 문서 리셋 UPDATE 가 단일 트랜잭션으로 묶여 있지 않음(이번 PR 이 만든 구조 아님, 기존 설계) | `knowledge-base.service.ts` `reEmbedAll` | 별도 후속 검토 대상(이번 PR 비블로킹) |
| 11 | concurrency | 동시성 제어 지점(admission cap, KB CAS 락, terminal guard)의 검증이 mock 기반 unit + mutation 사살로만 이뤄졌고, 실제 동시 트랜잭션 레벨 검증은 아직 없음 — plan 에 배포 후 관측 항목으로 이미 등재 | `execution-engine.service.ts`, `knowledge-base.service.ts` | 배포 후 로그/메트릭 관측으로 닫힘 예정, 코드 변경 불요 |
| 12 | concurrency | OAuth state 재사용 거절 e2e 가 순차 재사용만 검증, 주석이 말하는 "동시 콜백 중 하나만 승리"는 `Promise.all` 로 실측되지 않음(원자적 DELETE 자체는 충분히 검증됨) | `auth-oauth-callback.e2e-spec.ts` | 필수 아님. 동시 요청 테스트 추가 시 주석-테스트 범위 일치 |
| 13 | user_guide_sync | `auth-session-flow-change`/`run-debug-flow-change` 매트릭스 트리거에 매칭되나, 셋 다 "이미 문서가 전제한 의도된 동작을 복원"하는 버그 수정이라 실제 문서 갱신 갭 없음(auth 는 e2e 도 동일 changeset 포함) | auth/execution-engine/KB 변경 전반 | 조치 불요. KB 409 관련 문서화는 별도 turn 검토 후보로만 기록 |
| 14 | requirement | spec(`spec/data-flow/2-auth.md` §1.3 등)이 이미 "row 없으면 400 거절, provider 불일치도 거부"를 명시하고 있었고 수정 후 코드가 이를 실제 구현 — spec 자체 결함(SPEC-DRIFT) 아님, 코드가 spec 을 따라잡는 방향 | `spec/data-flow/2-auth.md` §1.3 | 조치 불요 |
| 15 | scope | `review/**` 117개 파일은 이 저장소 관행상 커밋되는 이전 리뷰 라운드 산출물이며 스코프 밖 파일 수정 아님 | `review/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | OAuth state anti-replay/CSRF 및 동시성 가드 복원 수정, 신규 SQL 인젝션·시크릿 노출 없음 |
| architecture | LOW | 헬퍼 강제가 구조적 캡슐화가 아닌 호출부 규율+하드코딩 테스트 목록 의존(WARNING 2) |
| requirement | NONE | spec 대조·타입체크·테스트 전량 재실행 검증, 결함 없음 |
| scope | NONE | 136개 파일 전체가 단일 결함 수정으로 수렴, 스코프 이탈 없음 |
| side_effect | LOW | 공유 메서드 반환값 실질 변경이 diff 밖 호출자에 파급되나 plan/CHANGELOG 에 이미 전수 기록됨 |
| maintainability | LOW | 신규 4커밋 모두 컨벤션 준수, 기존 유예 항목(변수명·보일러플레이트 중복) 상태 변화 없음 |
| testing | LOW | 핵심 수정은 실측 기반 테스트로 뒷받침, `stripComments` 트레일링 주석·기존 mock shape 잔여 갭(WARNING 1) |
| documentation | LOW | CHANGELOG·plan 소급 배너 우수, 헬퍼 자신의 JSDoc 교차참조 누락(WARNING 2) |
| database | LOW | 파라미터 바인딩 유지, 스키마 변경 없음, 드라이버 내부 동작 의존성·기존 트랜잭션 경계는 참고 사항 |
| concurrency | LOW | 새로운 데드락/레이스 없음, 실동시성 검증은 배포 후 관측 항목으로 이미 추적 중 |
| user_guide_sync | NONE | 매칭 트리거 전부 "의도된 동작 복원"이라 문서 갱신 갭 없음 |

## 발견 없는 에이전트

security(NONE, INFO만), requirement(NONE), scope(NONE), user_guide_sync(NONE) — CRITICAL/WARNING 없음.

## 권장 조치사항

1. (문서화 WARNING 3·4) `assertRowArray`/`updateReturningRows` 양쪽 JSDoc 에 서로에 대한 교차 참조와 snake_case 캐비엇을 추가 — 비용 낮고 재발 방지 효과 큼.
2. (테스트 WARNING 5) `source-scan.spec.ts` 에 줄 끝 주석 심벌 언급 fixture 를 추가해 `stripComments` 의 과다 카운트 방향을 명시 고정.
3. (아키텍처 WARNING 1·2) raw UPDATE/DELETE 를 구조적으로 감싸는 얇은 래퍼 도입, `countCalls` JSDoc 에 줄 끝 주석 사각지대 명시 — 급하지 않으나 다음 raw SQL 지점 추가 시 재검토.
4. (INFO 다수) 배포 후 관측 항목(admission cap 실제 거절, KB CAS 409, OAuth state 거절 로그)은 이미 plan 에 등재되어 있으므로 배포 시 해당 관측만 수행하면 됨 — 추가 코드 변경 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (11명)
  - **제외**: 표 (reviewer · 이유, 3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(비관측성/논리 오류 수정)와 성능 특성 변경 무관으로 판단, 제외 |
  | dependency | 신규/변경 외부 의존성 없음(패키지 변경 없음)으로 판단, 제외 |
  | api_contract | 공개 API/엔드포인트 계약 변경 없음(내부 헬퍼·반환값 실질 변경만)으로 판단, 제외 |