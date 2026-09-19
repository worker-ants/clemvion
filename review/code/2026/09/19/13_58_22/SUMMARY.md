# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `preview-test`(워크스페이스 저장 없이 호출 가능)를 통해 타임아웃 없는 DNS lookup 이 노출되어 libuv 스레드풀 고갈 DoS 로 이어질 수 있다(concurrency reviewer). 그 외에는 아키텍처 중복·인가 모델 불일치·문서 정합성 갭 등 WARNING 급 사안이 다수이나 즉시 서비스 영향은 제한적이다. 라우터 forced 화이트리스트(7명) 전원 결과 확보됨 — 화이트리스트 미이행으로 인한 거짓 clean 판정은 없다. 다만 `maintainability` reviewer 의 STATUS 라인이 `no_status`(정상 `success` 아님)로 기록됐으나, 인라인 전문이 정상적으로 확보되어 있어 내용은 그대로 반영했다(재시도 불요).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency | `assertSafeOutboundHostResolved` 의 `dns.lookup`(libuv 스레드풀, 기본 4슬롯)에 타임아웃이 전혀 없다. 이전엔 `database`/`http` 가 `transportTesters` 에 없어 도달 불가했으나, 이번 PR 로 저장 없이 호출 가능한 `preview-test` 에서 응답하지 않는 권위 DNS 서버를 지정하면 이 lookup 이 무한정 매달릴 수 있다. `@Throttle(20/60s)` 는 요청 "속도"만 제한하고 이미 매달린 요청의 "동시 개수"는 제한하지 않아, 소수 요청만으로 프로세스 전체가 공유하는 스레드풀이 고갈될 수 있다(다른 `dns.lookup`/일부 `fs` 연산까지 연쇄 정체) | `database-connection-tester.ts:86`, `http-connection-tester.ts:30`, `http-safety.ts`(`assertSafeOutboundHostResolved`, 기존 코드지만 노출 경로가 새로 생김) | `assertSafeOutboundHostResolved` 호출부(또는 내부)에 `Promise.race` 등으로 명시적 타임아웃 상한(예: `DB_TEST_TIMEOUT_MS`/`HTTP_TEST_TIMEOUT_MS` 급)을 적용하거나 c-ares 기반 `dns.promises.resolve4/resolve6` 로 전환 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency | `rotate()` 는 read(`requireEntity`) → (이제 실제 네트워크 I/O로 최악 ~20초까지 늘어난) `dispatchTest` → 엔티티 전체 `save()` 순서라, 그 사이 동시 `logUsage()` 의 원자적 `UPDATE`(정확히 이런 종류의 lost-update 를 피하려고 설계된 것으로 코드 주석에 명시됨)를 stale 값으로 되돌릴 수 있다(`lastError`/`lastUsedAt`/`status` 손실) | `integrations.service.ts` `rotate()`(1048~1101행 부근) vs `logUsage()`(1012~1029행, 원자적 `update()`) | `rotate()` 성공 후에도 변경 필드만 부분 `update()`로 쓰거나 `@VersionColumn` 낙관적 락 도입 |
| 2 | Security | `preview-test` 가 workspace/role 검증 없이 `database`/`http` 에 실제 TCP 연결을 트는 오라클이 됐다 — `DB_HOST_BLOCKED`/`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`(원본 드라이버 메시지, 길이만 clamp) 세 갈래 응답으로 ECONNREFUSED·타임아웃·TLS 실패·프로토콜 불일치를 구분할 수 있어, 임의의 인증된 사용자가 플랫폼을 프록시 삼은 제한적 포트스캔/정찰에 재사용 가능 | `integrations.controller.ts`(`previewTest`, `@Post('preview-test')`, workspace/role guard 없음), `integrations.service.ts`(`previewTest`/`dispatchTest`), `database-connection-tester.ts:106-110`, `http-connection-tester.ts:179-184` | workspace 컨텍스트/합산 throttle 도입, 또는 `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 메시지를 SSRF 차단 경로처럼 일반화, 또는 accepted risk 로 spec Rationale 에 명시 |
| 3 | Architecture | HTTP 리다이렉트 추종 + 홉별 SSRF 재검증 알고리즘이 노드 실행 경로(핸들러)와 연결 테스트 경로(테스터)에 독립적으로 중복 구현됨 — 이미 홉 상한 표현이 갈라짐(핸들러는 리터럴 `5`, 테스터는 export 된 명명 상수). 이 PR 이 다른 로직(자격증명 조립, DB 연결 옵션)엔 정확히 적용한 "공유 모듈 추출" 원칙이 여기만 빠짐 | `http-connection-tester.ts:146-168`(`testHttpConnection` 의 `while` 루프) vs `http-request.handler.ts:425-467`(diff 밖 기존 코드) | 리다이렉트 루프(상태머신+홉 카운터+홉별 SSRF 재검증)를 `http-safety.ts` 또는 신규 `http-redirect.ts` 공유 모듈로 추출, 최소한 홉 상한 상수라도 통일 |
| 4 | Scope / Documentation | `SSRF_BLOCKED_CLIENT_MESSAGE` 상수를 `http-safety.ts` 로 이관하며 원래 위치(`http-request.handler.ts`)의 6줄짜리 JSDoc(CWE-209 근거, `IntegrationUsageLog`/Activity API 노출 경위)을 지우지 않아 orphan 상태로 남았고, 새 위치의 JSDoc 은 더 짧아 그 핵심 근거가 유실됨. 같은 커밋의 `database-connection.ts` 이관은 주석까지 온전히 함께 이동해 이 파일만 누락된 사례 | `http-request.handler.ts:29-37`(orphan 블록), `http-safety.ts:24-27`(새 짧은 JSDoc) | orphan 블록 삭제 + CWE-209·Activity API 노출 근거를 `http-safety.ts` 의 JSDoc 으로 병합 |
| 5 | Documentation | spec 신규 Rationale 이 아직 `plan/in-progress/`에 있는 draft 를 `plan/complete/...` 경로로 인용 — draft 자신의 체크리스트("이 draft `plan/complete/`로")도 미완료(`[ ]`)라 현재 상태로 머지되면 dangling reference | `spec/2-navigation/4-integration.md:1174` | plan 이동 커밋에서 참조 경로 재확인, 이동 전 머지 시 `plan/in-progress/...`로 임시 정정하거나 이동 커밋을 같은 PR에 포함 |
| 6 | Documentation | 이 저장소가 반복해 온 CHANGELOG "Behavior change" 관례(예: "이전엔 조용히 성공하던 것이 이제 실제로 검증한다")와 같은 성격의 변경인데, 이번 PR 은 `CHANGELOG.md` 항목이 없음 — 잘못된 자격증명으로 저장된 기존 통합의 `rotate` 가 이제 거부될 수 있는 실사용자 영향 변화 | `CHANGELOG.md`(신규 항목 없음), 비교 대상: `integrations.service.ts:404-412`(transportTesters 배선) | 기존 항목과 같은 형식으로 "Unreleased — Behavior change" 항목 추가, 영향 범위 명시 |
| 7 | Maintainability | `testHttpConnection` 하나가 URL 검증·헤더 병합·SSRF 1차 검사·리다이렉트 추종 루프·상태 분류·예외 분기까지 6가지 책임을 담당, 분기점 10개 이상으로 순환 복잡도가 높음 | `http-connection-tester.ts:110-186`(특히 `:148-168` 리다이렉트 루프) | 리다이렉트 추종 루프를 `followRedirects(...)` 등 별도 함수로 추출 |
| 8 | Testing | HTTP 테스터의 `clampMessage` 경로가 DB 테스터(`database-connection-tester.spec.ts:185-191`, 긴 메시지 clamp 를 명시적으로 단언)와 달리 unit spec 에서 전혀 검증되지 않음 — plan 뮤테이션 표의 HTTP 14개 뮤턴트 목록에도 애초에 없었던 대칭 커버리지 갭 | `http-connection-tester.ts:183`(`clampMessage(describeFailure(err))`) | DB 테스터와 대칭되는 긴 에러 메시지 clamp 단언 테스트 추가 |
| 9 | API Contract | `INTEGRATION_TEST_FAILED` 상태 코드가 spec(422, `4-integration.md` §9.4) vs 구현(`BadRequestException`=400) vs 다른 spec 문서(400, `11-mcp-client.md`)에서 3중으로 어긋난 채, 이번 PR 이 `rotate` 의 DB/HTTP 인증 실패 경로를 처음 실사용시키고 신규 e2e 는 상태 코드 범위(`400~499`)만 단언해 우회함 — 기존 트래커(`plan/in-progress/integration-db-http-testers.md`, `review/consistency/2026/09/19/13_21_00` WARNING #1)에 이미 등재되어 재지적이지만, 병합 전 실제 반영/결정 여부 재확인 필요 | `integrations.service.ts`(`rotate()`), `test/integration-connection-test.e2e-spec.ts:152-156` | (a) rotate 도 예외 대신 `{success:false, code}` 200 응답으로 통일하거나 (b) 422로 상태 코드 확정 — 스코프 확정 전 결정 필요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | DNS rebinding TOCTOU — SSRF 재검증과 실제 접속 사이 재해석 창구(기존 accepted risk, 이번 PR 신규 아님). `preview-test` 인가 갭(WARNING #2)과 결합하면 노출 대상이 넓어짐 | `http-safety.ts:119-127`, `database-connection-tester.ts:82-96`, `http-connection-tester.ts:27-37` | 별도 조치 불요(기존 accepted risk) |
| 2 | Requirement | Database 연결 테스트의 실제 최악 대기시간이 연결(10초)+쿼리(10초) 독립 타임아웃으로 문서상 "10초"보다 길어질 수 있음(HTTP는 리다이렉트 체인 전체가 10초 하나를 공유해 비대칭 없음) | `database-connection-tester.ts:38-68`, `spec/2-navigation/4-integration.md:490`, 가이드 mdx | spec/가이드에 "연결 10초 + 쿼리 10초(독립)" 세분화 또는 "최대 약 20초"로 완화 |
| 3 | Concurrency / Database / Performance | 연결 테스트 엔드포인트는 사용자당 요청 "속도"(20/분)만 제한하고 동시에 열려 있는 아웃바운드 연결 "개수"는 제한하지 않음(최대 ~20초 연결이 사용자 수만큼 누적 가능) — 대상은 이 앱 자체 DB 가 아닌 사용자가 등록한 외부 서비스 | `integrations.controller.ts`(`@Throttle`), `database-connection-tester.ts`, `http-connection-tester.ts` | 필요 시 in-flight probe 세마포어로 전역 동시성 상한 도입 (낮은 우선순위) |
| 4 | Concurrency | `http-connection-tester.ts` 의 모듈 스코프 `BLOCKED` 상수 객체가 동시 호출 간 참조로 공유됨 — 현재는 읽기 전용이라 무해하나 향후 mutate 코드가 붙으면 교차 오염 가능 | `http-connection-tester.ts:20-24`, 반환 지점 `:137,158,164` | 반환 시 `{ ...BLOCKED }` 얕은 복사 |
| 5 | Testing | e2e 는 SSRF 차단 배선만 검증하고, 실제 pg/mysql2 happy path(라이브 소켓)는 어떤 계층도 검증하지 않음(e2e 샌드박스가 사설 host 를 항상 차단하는 구조적 제약, 의식적 트레이드오프로 plan 에 기록됨) | `test/integration-connection-test.e2e-spec.ts`, `database-connection-tester.ts:37-50` | 조치 불요 — 향후 드라이버 옵션 키 변경 회귀는 이 스위트로 못 잡는다는 점만 인지 |
| 6 | User Guide Sync | 신규 `DB_*`/`HTTP_*` 에러 코드가 `backend-labels.ts ERROR_KO`·프런트 `INTEGRATION_ERROR_CODE_TO_I18N` 화이트리스트에 미등록 — 다만 기존 `EMAIL_*` 코드도 동일하게 미등록된 기존 패턴의 일관된 확장이며 이번 PR 이 새로 깨뜨린 것은 아님 | `database-connection-tester.ts`, `http-connection-tester.ts`, `frontend/.../integration-error-codes.ts` | 이번 PR 범위 조치 불요. 후속에서 email/mcp/database/http 4종 i18n 매핑 일괄 정리 권장 |
| 7 | Database | 연결 테스트용 커넥션이 노드 실행 커넥션 풀과 의도적으로 분리(매 호출 새 연결, `try/finally` 로 항상 종료) — 설계 의도가 spec 본문에는 아직 명시 안 됨(기존 consistency 리뷰에서 이미 트래킹 중) | `database-connection-tester.ts:70-73` | 조치 불요(이미 트래킹) — 구현 자체는 누수 없음 |
| 8 | Architecture | 신규 테스터-서비스 간 순환 회피가 `import type` 소거(런타임 무효화)에만 의존, `consistent-type-imports` 같은 lint 강제가 없어 사람이 실수하면 조용히 순환 재도입 가능 | `database-connection-tester.ts:13`, `http-connection-tester.ts:10`, `integrations.service.ts:54-55` | `IntegrationTestResult` 를 중립 타입 전용 모듈로 분리 + `@typescript-eslint/consistent-type-imports` 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | CRITICAL | DNS lookup 무타임아웃 스레드풀 고갈 DoS(신규 노출 경로), rotate() lost-update 창 확대 |
| security | MEDIUM | preview-test 인가 갭이 포트스캔 오라클로 남용 가능, DNS rebinding TOCTOU(기존) |
| architecture | MEDIUM | 리다이렉트+SSRF 재검증 로직 핸들러/테스터 중복(공유 모듈 미추출) |
| performance | LOW | 매 호출 신규 커넥션(의도적), 전역 동시성 상한 부재, redirect 루프 방어는 양호 |
| requirement | LOW | spec fidelity 대체로 일치, DB 최악 대기시간 문서 정밀도 갭만 |
| scope | LOW | orphan JSDoc 1건 외 diff 는 목적에 밀착 |
| side_effect | LOW | 기존 mcp/email 선례와 일관된 확장, dangling import 없음, 커넥션 정리 확인 |
| maintainability | LOW | `testHttpConnection` 책임 과다, 자격증명 캐스팅 방식 형제 메서드 간 불일치 |
| testing | LOW | HTTP clamp 테스트 갭 외엔 분기 커버리지 촘촘, 뮤테이션 실측 우수 |
| documentation | LOW | orphan JSDoc, plan/complete 미이동 참조, CHANGELOG 누락 3건 |
| database | LOW | SQL 인젝션 없음, 커넥션 정리 확인, 동시 연결 수 상한 부재만 참고 |
| api_contract | LOW | 응답 계약 하위호환 유지, 상태코드 400/422 불일치(기존 트래킹) 재확인 필요 |
| user_guide_sync | NONE | 매트릭스 22행 대비 동반 갱신 누락 없음, docs mdx ko/en 동시 갱신 확인 |

## 발견 없는 에이전트

없음 — 13개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고했다.

## 권장 조치사항

1. **(CRITICAL, 최우선)** `assertSafeOutboundHostResolved` 의 DNS lookup 에 명시적 타임아웃을 적용해 `preview-test` 를 통한 libuv 스레드풀 고갈 DoS 경로를 차단한다.
2. `rotate()` 의 read-modify-write 창에서 발생 가능한 `logUsage()` lost-update 를 부분 `update()` 또는 낙관적 락으로 방지한다.
3. `preview-test` 의 인가 모델(workspace/role 미검증)과 새로 활성화된 실제 outbound 능력 사이의 불일치를 해소하거나(합산 throttle/메시지 일반화), 최소한 accepted risk 로 spec Rationale 에 명시한다.
4. HTTP 리다이렉트 추종 + 홉별 SSRF 재검증 로직을 노드 핸들러와 연결 테스터가 공유하는 모듈로 추출해 두 구현의 drift 를 막는다.
5. `http-request.handler.ts` 의 orphan JSDoc(CWE-209 근거)을 삭제하고 `http-safety.ts` 의 새 문서로 병합한다.
6. spec Rationale 의 `plan/complete/...` 참조를 실제 이동 시점과 동기화하고, 이 저장소 관례에 맞춰 `CHANGELOG.md` behavior-change 항목을 추가한다.
7. HTTP 테스터의 `clampMessage` 경로에 DB 테스터와 대칭되는 unit 테스트를 추가한다.
8. `INTEGRATION_TEST_FAILED` 400/422 상태 코드 불일치가 트래커에 실제로 반영·결정됐는지 병합 전 재확인한다(이미 알려진 이슈, 이번 PR 이 그 경로를 처음 실사용시킴).
9. (낮은 우선순위) `testHttpConnection` 을 리다이렉트 루프 분리로 리팩터링하고, `http-connection-tester.ts` 의 `BLOCKED` 상수는 반환 시 얕은 복사한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨**(화이트리스트 미이행 없음). 단 `maintainability` 의 STATUS 라인이 `no_status` 로 기록되어 있었으나 인라인 전문이 정상 확보되어 내용은 그대로 반영했다(재시도 불요, 거짓 clean 아님).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단으로 이번 diff 와 관련도 낮음으로 제외(구체 사유 미기재 — 신규 npm 패키지 추가나 의존성 버전 변경이 없는 변경 특성상 타당해 보임) |
