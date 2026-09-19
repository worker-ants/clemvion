# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `database` 리뷰어가 지적한 MySQL 연결 테스트의 정리(cleanup) 영구 hang 이 신규 도입된 프로세스 전역 동시성 슬롯(2개)을 영구히 점유해, 재발 시 Database·HTTP 뿐 아니라 MCP·Email 연결 테스트 전체가 프로세스 재기동 전까지 마비될 수 있다(개별 에이전트 표기는 HIGH 지만 발견사항 자체는 CRITICAL 태그). forced 화이트리스트(7명) 전원 결과가 확보되어 이 판단을 가릴 사각지대는 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database/동시성 | MySQL 연결 테스트에서 쿼리 타임아웃이 `mysql2` 드라이버 내부 커맨드 큐를 해제하지 않음 — 응답 없는(black-hole) 서버 대상 시 `finally` 의 `connection.end()` 가 영구 hang. 이 호출은 프로세스 전역 `pLimit(2)` 슬롯 안에서 실행되므로, 슬롯 하나가 영구히 반환되지 않고 두 번 반복되면 Database·HTTP 뿐 아니라 MCP·Email 연결 테스트 전체가 재기동 전까지 마비된다. (PG 경로는 `pg` 라이브러리가 강제 종료를 처리해 이 위험이 없음 — 비대칭) | `codebase/backend/src/modules/integrations/database-connection-tester.ts:52-68`(`probeMysql`), `codebase/backend/src/modules/integrations/integrations.service.ts:1542`(`dispatchTest`/`connectionTestLimit`) | `finally` 에서 무조건 graceful `connection.end()` 를 기다리지 말 것 — 실패 경로에서 내부 `Connection.destroy()`(동기, 서버 응답 불필요) 사용, 또는 `Promise.race([connection.end(), delay(짧은 상한)])` 로 정리 자체에도 상한을 걸어 슬롯 반환을 보장 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `resolveHttpCredentials` 의 `INTEGRATION_INCOMPLETE` 3분기(api_key/bearer_token/basic 필수 필드 누락)가 신규 공용 모듈 승격 후에도 어느 spec 에서도 exercise 되지 않음 — `preview-test`/`:id/test` 응답 `code` 로 그대로 노출되는 경로라 회귀 시 조용히 틀린 응답을 반환해도 무감지 | `codebase/backend/src/nodes/integration/http-request/http-credentials.ts:44-92`, `codebase/backend/src/modules/integrations/http-connection-tester.spec.ts` | `http-connection-tester.spec.ts` 에 api_key/bearer_token/basic 필수 필드 누락 케이스 3~4개 추가, 또는 `http-credentials.ts` 전용 `.spec.ts` 신설(순수함수라 비용 낮음) |
| 2 | 문서화 | spec Rationale·트래커 문서 3곳이 아직 `plan/in-progress/` 에 있는 계획 문서를 `plan/complete/` 경로로 조기 인용 — 이 저장소 관례("이동 완료 후에만 complete/ 인용")를 위반, 병합 전 미해소 시 깨진 경로가 커밋 이력에 영구 고정 | `spec/2-navigation/4-integration.md:1174`, `plan/in-progress/spec-draft-nullable-notation-followups.md:3594`, `:4785` | 병합 전 두 plan(`spec-draft-integration-connection-tests.md`, `integration-db-http-testers.md`)을 실제로 `plan/complete/`로 이동해 참조를 유효화하거나, 이동 전까지 인용을 `plan/in-progress/`로 임시 수정 |
| 3 | 동시성 | 신규 `connectionTestLimit`(`pLimit(2)`) 동시 상한이 스스로 명시한 목적(연결 테스트 전체의 libuv DNS 스레드풀 보호)과 달리 `dispatchTest`/`transportTesters`(mcp·email·database·http) 경로에만 걸리고, cafe24·makeshop 의 entity-aware 테스터(`testConnection()` 의 `entityTester` 분기)는 이 상한을 거치지 않아 같은 스레드풀 고갈 위험이 그 두 서비스를 통해 여전히 열려 있음 | `codebase/backend/src/modules/integrations/integrations.service.ts`(`testConnection()` 게이트 967-977, `dispatchTest()` 게이트 1525-1548) | cafe24·makeshop `entityTester` 도 `connectionTestLimit` 으로 감싸거나, 최소한 백로그 항목에 "entity-aware 테스터는 상한 밖" 한 줄을 추가해 보장 범위를 실제와 맞출 것 |
| 4 | 보안/인가 (기존, 상태 확인용) | `POST /api/integrations/preview-test` 가 workspace/role 검증 없이 인증된 임의 사용자에게 Database·HTTP 실제 outbound 연결(분당 20회)을 허용 — SSRF 가드가 사설 대역은 막지만 공인 대역은 통과, 응답 코드로 열린 포트·닫힌 포트·타임아웃·인증실패를 구분 가능한 오라클. **1라운드 리뷰(`13_58_22`)에서 이미 지적됐고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 결정 대기로 명시적으로 유예된 상태** — 이번 diff 는 해당 부분을 건드리지 않아 신규 결함 아님, open 상태 재확인 | `codebase/backend/src/modules/integrations/integrations.controller.ts:159-178`(`previewTest()`), `integrations.service.ts:980-983`(`previewTest()`) → `dispatchTest()` | 이번 라운드 추가 조치 불필요 — 기존 트래커 항목(워크스페이스 컨텍스트 요구 · 메시지 일반화 · accepted risk 명문화 중 택1) 진행 대기 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/동시성 | `pLimit(2)` 뒤 대기열이 무제한 — 상한 초과 요청이 큐에 무한정 쌓여 연결 테스트 기능 자체의 지연을 키울 수 있음(프로세스 전체 마비는 아님). 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 낮은 우선순위로 등재됨 | `integrations.service.ts:405-408`(`connectionTestLimit`) | 조치 불요 — 추적 중 |
| 2 | 보안/성능 | SSRF 사전검사(`assertSafeOutboundHostResolved`)와 실제 connect/fetch 사이 DNS 재해석 TOCTOU + 중복 DNS 조회(리다이렉트 홉마다 반복, 최대 10회) — 기존 accepted risk, 유틸 자신이 인지하고 egress 방화벽 defense-in-depth 를 안내. preview-test WARNING(#4)과 결합 시 시도 가능 대상 풀만 넓어짐 | `http-safety.ts:129-162`, `database-connection-tester.ts:84-104`, `http-connection-tester.ts:29-37,147-152`, `http-redirect.ts:49-58` | 조치 불요 — 근본 해법(해석한 IP 직접 연결)은 백로그 항목에 defer 로 기재됨 |
| 3 | 보안 | HTTP 통합이 `http://`(비TLS) `base_url` 을 허용 — 연결 테스트가 이번에 처음 실제 요청을 태우면서, 테스트 시점에도 Bearer/Basic/API key 자격증명이 평문 전송될 수 있는 경로가 새로 열림(노드 실행 경로는 기존부터 동일 설계) | `http-credentials.ts:26-110`, `http-safety.ts:102-122`, `http-connection-tester.ts:133-154` | 낮은 우선순위 — 플랫폼 차원 결정(HTTPS 강제 여부) 선행 필요, 이 PR 범위 밖 |
| 4 | Database | `rotate()` 부분 저장(`save({id, ...changes})`)이 TypeORM 내부적으로 존재-확인 `SELECT` 를 추가로 발생시킴(정확성 문제는 아님 — diff 계산은 명시된 컬럼만 반영해 `lastUsedAt` 등이 섞이지 않음, 회귀 테스트로 검증됨) | `integrations.service.ts:1124` | 필요 시 `repository.update({id}, changes)` 로 대체해 추가 조회 제거 가능(필수 아님) |
| 5 | Database | `rotate()` 의 자격증명 저장 · 감사 로그 기록 · 캐시 무효화가 단일 트랜잭션으로 묶여 있지 않음(이번 diff 이전부터 동일, 신규 아님) | `integrations.service.ts:1124-1135` | 참고용 기재, 조치 불요 |
| 6 | 동시성 | `rotate()` 의 read-merge-test-write 패턴에 낙관적 잠금/버전 검사가 없어 동시 `rotate()` 두 건이 같은 옛 `credentials` 를 베이스로 병합 시 먼저 저장된 교체가 조용히 유실될 수 있음(diff 범위 밖, 기존 동작이며 이번 PR 이 새로 만든 결함 아님) | `integrations.service.ts:1067-1124`(`rotate()`) | 필요 시 후속으로 조건부 update(버전/값 비교) 검토 |
| 7 | 요구사항/문서 | spec §5.4 본문이 "연결 대기는 10초"만 언급하고 `SELECT 1` 쿼리 자체의 대기 상한(10초)은 명시하지 않음(코드·CHANGELOG·사용자 가이드는 정확히 "연결·쿼리 각 10초"로 서술) | `spec/2-navigation/4-integration.md` §5.4 | spec 문장을 "연결·쿼리 각 10초"로 보강(project-planner 몫) |
| 8 | 문서화 | `POST /:id/rotate` 의 Swagger 설명이 Database·HTTP 에도 실제 아웃바운드 연결(최대 10초)이 걸린다는 사실을 반영하지 않음(Email 은 기존부터 동일 특성, 범위만 확대) | `integrations.controller.ts` `rotate()` `@ApiOperation` | `preview-test` 와 같은 톤으로 한 줄 추가(낮은 우선순위) |
| 9 | API 계약 | `rotate()` 는 `dispatchTest` 가 반환하는 세분화된 `code`(DB_AUTH_FAILED 등)를 버리고 항상 `INTEGRATION_TEST_FAILED` 로 응답 — preview-test/`:id/test` 와 세분성이 다름(기존 동작이나 이번 PR로 Database/HTTP 실패가 흔해지며 실질 영향 확대) | `integrations.service.ts` `rotate()` | 의도된 설계라면 DTO 주석에 명시, 세분화 필요하면 `test.code` 노출로 통일 |
| 10 | API 계약 | `PreviewTestResultDto`/`TestConnectionResultDto.code` 가 유한 집합인데 Swagger 스키마가 무제약 `string`(enum 미선언) — 기존 컨벤션(MCP_*/EMAIL_* 때부터 동일) | `integration-response.dto.ts` | 우선순위 낮음 — 추후 API 스키마 강화 작업에서 처리 |
| 11 | 문서 동기화(i18n) | 신규 `DB_*`/`HTTP_*` 결과 코드가 프런트 지역화 사전(`backend-labels.ts` `ERROR_KO`)에 없어 영문 원문이 그대로 노출 — 기존 email/mcp 코드도 동일 상태였던 선례, 이미 백로그에 4계열 통합 정리 항목으로 등재 | `database-connection-tester.ts`, `http-connection-tester.ts`, `codebase/frontend/.../test-step.tsx`(code 미소비, message 그대로 노출) | 조치 불요 — 추적 중(mcp·email·database·http 일괄 정리 예정) |
| 12 | 테스트 | `clamp-message.ts` 의 `!raw → 'Unknown error'` 폴백 분기가 신규 소비자(database/http 테스터) 어느 spec 에서도 검증되지 않음 | `clamp-message.ts:11` | 전용 `clamp-message.spec.ts` 추가(undefined/빈문자열/경계값/초과 4케이스, 순수함수라 비용 낮음) |
| 13 | 유지보수성 | `DB_HOST_BLOCKED_MESSAGE`(`_MESSAGE` 접미) vs `SSRF_BLOCKED_CLIENT_MESSAGE`(`_CLIENT_MESSAGE` 접미) — 동일 목적 상수의 네이밍 패턴 불일치 | `database-connection.ts:25`, `http-safety.ts:33` | 급하지 않음 — 다음 상수 추가 시 접미사 통일 |
| 14 | 부작용 | 신규 프로세스 전역 `pLimit(2)` 가 기존 MCP·Email 연결 테스트에도 소급 적용 — 의도된 설계(싱글턴 DI 확인됨)이나 기존 두 기능의 동작을 바꾸는 부작용, 큐 무제한(#1)과 결합 | `integrations.service.ts`(`connectionTestLimit`, `transportTesters`) | 조치 불요 — 설계 의도 확인, 혼합 대기열 회귀 케이스 존재 여부만 재확인 권장 |
| 15 | 스코프 | 핸들러 로직 추출(`database-connection.ts`/`http-credentials.ts`/`http-redirect.ts` 신설)과 `rotate()` 부분저장·동시성 상한 도입이 "테스터 추가"라는 원 목적보다 넓은 변경이나, `git diff -w` 대조로 로직 변경 없음 확인 + plan 설계 문서로 사전 정당화됨(순환 import 회피, 이번 기능이 드러낸 기존 결함 수정) | `database-query.handler.ts`, `http-request.handler.ts`, `integrations.service.ts` | 조치 불요 — 스코프 이탈 아님, 참고 기록 |

## 발견 없는 에이전트

- `performance`: 신규 테스터의 자원 사용(일회성 DB 연결, 10초 타임아웃, 응답 본문 미소비)이 절제됨. N+1·O(n²)·비적절 자료구조 없음.
- `requirement`: Database·HTTP 연결 테스트 구현이 spec §5.3/§5.4/§9.2/§14.1 과 line-level 로 일치. 이전 라운드 지적사항(동시성 상한·rotate 전체저장·리다이렉트 중복) 전부 해소 확인.
- `scope`: 42개 파일 diff 전부 목표(실제 접속 구현) 또는 그로 인해 드러난 파생 결함 수정에 정확히 대응. 포맷팅·주석·임포트 노이즈 없음.
- `maintainability`: 함수 분리·네이밍·매직넘버의 명명 상수화·근거 JSDoc 양호. 실질적 결함 없음(INFO만).
- `user_guide_sync`: docs matrix 22개 행 중 관련 4갈래 모두 이행 완료 또는 회색지대(내부 리팩터)로 확인. CRITICAL/WARNING 급 동반 갱신 누락 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| database | HIGH (finding-level CRITICAL 1건 포함) | MySQL 쿼리 타임아웃 후 정리 hang → 동시성 슬롯 영구 점유 |
| security | MEDIUM | preview-test 인가 공백(기존, 유예 중) 재확인 + HTTP 평문 자격증명 전송 가능성 신규 기록 |
| testing | LOW | http-credentials INTEGRATION_INCOMPLETE 3분기 · clamp-message 폴백 미검증 |
| documentation | LOW | plan/complete/ 조기 인용 3곳, rotate Swagger 설명 미반영 |
| concurrency | LOW | pLimit(2) 가 entity-aware 테스터(cafe24·makeshop) 미커버 |
| side_effect | LOW | pLimit 소급 적용(mcp/email), preview-test 실접속 확장 — 둘 다 의도·추적 중 |
| api_contract | LOW | rotate() code 뭉개짐, DTO enum 미선언 — 기존 패턴 |
| performance | NONE | 자원 사용 절제, N+1/O(n²) 없음 |
| requirement | NONE | spec 정합 확인, 미세 서술 간극(INFO) 1건 |
| scope | NONE | 42파일 diff 전부 목표 정당화됨 |
| maintainability | NONE | 네이밍 비대칭 등 사소 INFO만 |
| user_guide_sync | NONE | 매트릭스 대응 완료, 신규 갭 없음 |

## 권장 조치사항

1. **[Critical]** MySQL 연결 테스터의 `probeMysql` 정리(cleanup) 경로에 강제 종료/타임아웃을 추가해, 응답 없는 서버 대상 시 `connectionTestLimit` 슬롯이 반드시 반환되도록 고친다 — 병합 전 필수.
2. **[Warning]** `resolveHttpCredentials` 의 `INTEGRATION_INCOMPLETE` 3분기(api_key/bearer_token/basic)에 대한 테스트를 추가한다 — 공개 API `code` 응답 경로라 회귀 무감지 위험이 실질적.
3. **[Warning]** spec/트래커의 `plan/complete/` 조기 인용 3곳을 병합 전 해소한다(실제 이동 또는 `in-progress/` 로 임시 수정).
4. **[Warning]** `connectionTestLimit` 의 보장 범위를 cafe24·makeshop entity-aware 테스터까지 넓히거나, 백로그 문서에 그 갭을 명시해 "보증 범위" 서술을 실제와 맞춘다.
5. **[확인만]** `preview-test` 인가 공백은 이미 planner 결정 대기 트래커 항목이므로 이번 PR 에서 추가 조치 불요 — 다음 planner 턴에서 처리.
6. 낮은 우선순위 INFO(clamp-message 폴백 테스트, rotate Swagger 설명, DTO enum 선언, HTTP 평문 전송 경고 배지 등)는 별도 후속으로 누적 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (12명)
  - **제외**: 표 (2명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨**, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단(개별 사유 prompt 미포함) — diff 가 신규 아키텍처 계층/모듈 경계 변경이 아닌 기존 패턴 확장으로 판단된 것으로 추정 |
  | dependency | router 판단(개별 사유 prompt 미포함) — 신규 의존성이 `p-limit` 1건뿐이라 저위험으로 판단된 것으로 추정 |

---

참고: `summary_output_file` Write 는 하네스가 `SUMMARY.md` basename 을 차단해 실패했다(예상된 동작, workflow 모드 §개요 참조). 12개 reviewer 결과 파일(`security.md`~`user_guide_sync.md`)은 모두 디스크에 이미 존재함을 확인했다(`ls` 실측) — 누락 파일 영속화 단계는 불필요했다. 호출자(main)가 위 전문을 `SUMMARY.md` 에 멱등 기록해야 한다.
