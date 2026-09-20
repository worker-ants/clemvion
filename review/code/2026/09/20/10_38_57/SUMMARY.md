# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical 0건. WARNING 3건(스펙 `code:` 목록 누락은 developer 권한 밖 · SSRF 가드 "고장" 시 발생 시점에 따라 `error.code` 가 갈리는 비일관성 · 리다이렉트 홉 마스킹 변경에 대한 회귀 테스트 부재를 뮤테이션으로 실증) — 코드 자체는 fail-closed 로 안전하고 새 Critical 은 없으나, 최고위험 에이전트(testing)가 실측(뮤테이션)으로 실질 커버리지 갭을 확인해 MEDIUM 으로 수렴.

forced(router_safety) 화이트리스트 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 확인 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 2라운드에서 "리다이렉트 홉 가드 고장도 마스킹"으로 고친 `toLogError(err).message` 변경이 회귀 테스트 없이 병합됨. 뮤테이션으로 실증: 이 줄을 마스킹 이전 상태(`err instanceof Error ? err.message : String(err)`)로 되돌려도 `http-request.handler.spec.ts` 75건이 전부 그대로 PASS(생존) — `followRedirectsSafely` 를 거쳐 이 예외가 handler 의 전송 catch 로 떨어지는 경로를 검증하는 spec 이 없다(`grep -rn "followRedirectsSafely" --include="*.spec.ts"` 0건) | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:560` (대비: `codebase/backend/src/nodes/integration/http-request/http-redirect.spec.ts:47-55` 는 `outboundBlockReason` 을 직접 호출할 뿐 handler 통합 경로는 커버 못 함) | `http-redirect.spec.ts` 또는 `http-request.handler.spec.ts` 에 "두 번째 이상 홉에서 가드가 판정 아닌(가급적 시크릿 패턴 포함) 오류를 던지면 `HTTP_TRANSPORT_FAILED` 의 `message` 가 마스킹된 값이다"를 직접 단언하는 케이스 1건 추가 |
| 2 | API Contract | 같은 근본 원인("SSRF 가드 자체의 고장", 판정이 아닌 오류)이 `http-request.handler.ts` 안에서 **발생 시점에 따라 서로 다른 `output.error.code`** 로 나감 — preflight 시점은 `INTEGRATION_CALL_FAILED`, redirect 홉 시점은 `HTTP_TRANSPORT_FAILED`(비판정 오류가 `IntegrationError` 로 승격되지 않은 채 outer catch 까지 raw 로 전파되기 때문). `http-connection-tester.ts` 는 preflight/홉 구분 없이 `HTTP_CONNECT_FAILED` 로 통일되어 있어 node 핸들러만 이 비대칭을 가짐. 이 저장소는 정확히 같은 모양의 문제를 "차단 판정" 케이스에서는 이미 한 번 고쳐 `HTTP_BLOCKED` 로 통일한 전례가 있다 | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:362`(preflight catch) vs `:566`(제네릭 fallback) · 근본 원인 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:36-38`(`outboundBlockReason` 이 비판정 오류를 그대로 재throw) | (1) planner 가 spec §4.2 표에 "가드 고장" 트리거를 추가할 때 preflight/redirect-홉 두 코드를 구분해 명시하거나, (2) `outboundBlockReason`/`followRedirectsSafely` 가 비판정 오류도 `IntegrationError('INTEGRATION_CALL_FAILED', …)` 로 승격해 두 시점을 통일 — 어느 쪽이든 홉 비판정을 handler 레벨에서 주입해 최종 `error.code` 를 단언하는 회귀 테스트 추가(WARNING 1과 동일 테스트로 함께 커버 가능) |
| 3 | Documentation | `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 목록에 이번 PR 이 직접 수정·신설한 `http-redirect.ts`(§4 step 9, 리다이렉트 5홉+홉마다 SSRF 재검증 구현)가 여전히 누락 — `spec/conventions/spec-impl-evidence.md` §2.1 위반 소지. developer 는 `spec/` 쓰기 권한이 없고 자기-반증형 소정정 대상도 아님(증거 목록 누락, 예고 문장 정정 아님) | `spec/4-nodes/4-integration/1-http-request.md:1-7`(frontmatter `code:` 배열) / 실제 코드 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` | 조치는 코드가 아닌 `project-planner` 턴 — `code:` 목록에 `http-redirect.ts` 추가(이미 1·2라운드 코드리뷰 + `--impl-prep` consistency check 가 지적, `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 백로그에 등재됨) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / API Contract | 가드 "고장"(판정 아닌 오류) 메시지에는 `sanitizeMessage` 가 자격증명 패턴만 가리고 host/IP 패턴은 마스킹하지 않아, "차단 판정"(고정 일반화 문구)과 마스킹 보장 수준이 다르다(CWE-209 비대칭). 실측: 오늘 가드가 낼 수 있는 유일한 비판정 오류(`isBlockedHostname` 의 `TypeError`, host/IP 미포함, `validateCredentials` 로 API 도달 불가)에는 즉시 악용 가능성 없음. 이미 두 라운드에 걸쳐 지적됐고 이번 diff 가 근거·해법 후보와 함께 plan 백로그에 정식 등재 | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:560` · `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` 판정 아닌 분기 · `codebase/backend/src/modules/integrations/database-connection-tester.ts:150` · `codebase/backend/src/modules/integrations/http-connection-tester.ts:148-152`(`describeFailure`→`clampMessage`, 자격증명 마스킹조차 없음) | 조치 불요(이미 백로그 등재: `plan/in-progress/spec-draft-nullable-notation-followups.md`) — 향후 처리 시 고정 문구 치환 vs `sanitizeMessage` host/IP 패턴 확장 중 택1 |
| 2 | Documentation / Requirement | spec 에러 코드 표 3곳에 "가드 고장 → `INTEGRATION_CALL_FAILED`/`DB_CONNECT_FAILED`" 신규 트리거가 등재돼 있지 않음(모순은 아니고 완전성 갭) | `spec/4-nodes/4-integration/0-common.md:85` · `spec/4-nodes/4-integration/1-http-request.md:339` · `spec/4-nodes/4-integration/2-database-query.md:344` | 조치 불요(이미 등재, `--impl-done` 이후 planner 턴에서 세 표에 한 줄씩 추가) |
| 3 | Documentation / Requirement | `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 아직 존재하지 않는 `plan/complete/ssrf-catch-instanceof.md` 를 선인용("2026-09-20 해소"). 정작 `plan/in-progress/ssrf-catch-instanceof.md` 자신의 체크리스트 3항목(`/ai-review` 수렴 · `--impl-done` · 트래커 해소·`plan/complete/` 이동)도 미체크 | `plan/in-progress/ssrf-catch-instanceof.md:85-87` | 이번 라운드가 Critical·Warning(코드 대상) 0으로 수렴하면 마무리 커밋에서 체크리스트 3항목 체크 + `plan/complete/` 실제 이동 |
| 4 | Maintainability | 판정/비판정 분기(`if (!(err instanceof SsrfBlockedError))`)와 근거 주석이 프로덕션 코드 4~5곳(SMTP 가드 포함)에 거의 동일 문구로 반복 — 각 호출부의 사후 처리가 달라 공용 헬퍼 추출 시 파라미터가 늘어나는 트레이드오프. 1·2라운드에서 이미 지적·유예됨 | `database-connection-tester.ts:147` · `database-query.handler.ts:271` · `http-request.handler.ts:362` · `http-redirect.ts:36` | 조치 불요(유예 확정) — 가드가 두 번째 비판정 예외 유형을 구분해야 할 때 공용 위치 이동과 함께 재고 |
| 5 | Maintainability | `http-request.handler.ts` 의 `execute()` 가 이미 약 450줄인 상태에서 이번 diff 가 판정/비판정 분기(~25줄)를 더 얹어 길어짐 | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` `execute()`(140행~), 신규 분기 358~386행 | 조치 불요(선행 라운드 판단과 동일) — 향후 이 함수를 다시 손댈 때 preflight 에러 처리를 private 메서드로 분리 고려 |
| 6 | Side Effect | `database-connection-tester.ts` 가 처음으로 `nodes/integration/_base/integration-handler-base.ts` 를 import 하며 `integrations.service.ts → database-connection-tester.ts → integration-handler-base.ts → integrations.service.ts` 모듈 순환 참조가 새로 생김. `transpileModule` 로 직접 컴파일해 확인한 결과 `IntegrationsService` 참조는 타입 전용이라 컴파일된 JS 에서 제거됨 — 런타임 순환 없음(무해 실측) | `codebase/backend/src/modules/integrations/database-connection-tester.ts`(신규 import) / `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:2` | 조치 불요(실측 무해) — `integration-handler-base.ts` 가 향후 `IntegrationsService` 를 값으로도 쓰게 되면(예: 데코레이터 추가) 실제 순환으로 바뀔 수 있음을 기록만 |
| 7 | Testing | `http-connection-tester.ts` 는 preflight 와 홉 검사가 같은 `try` 블록을 공유하는데, 신규 테스트는 첫 preflight 실패만 검증하고 홉-단계 가드 고장 경로는 여전히 미검증 — 기존 추적 항목(신규 아님), 이미 트래커 등재 | `codebase/backend/src/modules/integrations/http-connection-tester.ts`(catch 블록, ~139-151행) | 조치 불요(이미 등재) — WARNING 1의 테스트 추가 시 함께 커버 가능 |
| 8 | Scope / Maintainability | `database-connection-tester.spec.ts` 만 import 순서가 형제 파일 5곳과 다름(알파벳 소문자 우선 vs `SsrfBlockedError` 우선) — 3회째 재확인, 실질 영향 없어 두 라운드에서 명시적 defer 확정 | `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts:5-8` | 조치 불요(defer 확정) — 다음에 이 파일을 만질 때 정렬만 맞추면 됨 |
| 9 | Performance | `sanitizeMessage` → `clampMessage` 순서로 원문 전체에 정규식 3패스가 돈다 — 정규식 자체는 선형(중첩 정량자 없음)이고, 이 경로에 도달하는 `detail` 은 오늘 기준 짧은 고정 `TypeError` 문구뿐이라 실질 크기 리스크 없음. INFO 1 과 같은 백로그 항목으로 이미 등재 | `codebase/backend/src/modules/integrations/database-connection-tester.ts`(`clampMessage(sanitizeMessage(detail))`) | 현행 유지 — 가드가 향후 외부 입력을 그대로 실어 나르게 바뀌면 `clampMessage` 를 `sanitizeMessage` 보다 먼저 적용하는 순서로 재검토 |

### 문제 없음으로 확인된 항목 (참고, 표에서 제외)

- 핵심 판정/비판정 분기 4곳(HTTP 노드 preflight · `outboundBlockReason` · DB 핸들러 preflight · DB 연결 테스터)은 testing 이 직접 뮤테이션(대상 조건을 되돌려 RED 확인 → 원복 → clean)으로 재검증 — 전부 견고.
- 1·2라운드 WARNING(연결-테스트 타임아웃 예산 잠식, 리다이렉트 홉 미mock DNS, `toLogError`/`detail` 중복 계산, JSDoc-코드 불일치, 주석 방향 오기)은 커밋 `e8d810405`·`fff0d14bf` 로 모두 소스 대조 재확인상 반영 완료.
- `AbortSignal.timeout` 생성을 preflight 뒤로 옮긴 것은 회귀가 아니라 타임아웃 예산 정확도 개선.
- SQL 인젝션·커넥션 관리·트랜잭션·스키마·N+1 등 데이터베이스 관점 대상 없음(database 리뷰).
- wire 스키마·엔드포인트·인증·페이지네이션 영향 없음, 재사용 에러 코드도 기존 닫힌 union 안이라 하위 호환성 파괴 없음.

### 관측된 이상 상태 — 이번 라운드의 결함 아님 (병렬 세션 흔적)

security.md 와 maintainability.md 가 리뷰 도중 각각 `database-query.handler.ts`/`http-redirect.ts`, `http-request.handler.ts:560` 에서 이 PR 의 판정/고장 분기를 되돌리는 형태의 일시적 미커밋 변경을 관측했다고 보고했다. testing.md 는 같은 라운드에서 `cp` 백업/복원 방식으로 정확히 이런 모양의 뮤테이션 3건을 의도적으로 수행했다고 명시했고(대상 스펙 실행 후 매번 `git status --short` clean 확인), 이 SUMMARY 작성 시점에 재확인한 `git status --short` 결과도 `review/code/2026/09/20/10_38_57/`(이번 라운드 산출물) 외 변경 없이 clean 하다. 즉 이는 같은 워크트리를 공유하는 병렬 reviewer 세션(특히 testing 의 뮤테이션 검증)의 흔적일 가능성이 높고, 이번 라운드의 코드 결함이 아니다. 다음 사람이 같은 잔여물을 다시 보더라도 이 라운드 탓으로 오인하지 말 것.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 가드 고장 메시지 host/IP 마스킹 부재(즉시 유출 없음, 백로그 등재) |
| performance | NONE | 신규 이슈 없음, 1·2라운드 지적 전부 반영 확인 |
| requirement | LOW | spec `code:` 목록 누락(developer 권한 밖) · 에러코드 표 완전성 갭 · plan 시점 불일치 |
| scope | NONE | import 순서 불일치(3회째 defer 확정) 외 없음 |
| side_effect | LOW | 신규 모듈 순환 참조 생성(타입 전용, 런타임 무해 실측) |
| maintainability | LOW | 판정분기 반복·함수 길이 증가(모두 유예) + 병렬 세션 미커밋 잔여물 관측(비결함) |
| testing | MEDIUM | 리다이렉트 홉 가드-고장 마스킹 변경에 회귀 테스트 부재 — 뮤테이션으로 실증(생존) |
| documentation | LOW | spec `code:` 목록 누락 + 에러코드 표 갭 + plan 선인용 |
| database | NONE | 검토 대상 변경 없음(SSRF preflight 단계만, DB 접속/쿼리 미변경) |
| api_contract | LOW | SSRF 가드 고장 시 발생 시점(preflight vs redirect hop)별 `error.code` 비일관성 |

## 발견 없는 에이전트

- database — SQL/커넥션/트랜잭션/스키마 어느 것도 변경되지 않아 검토 대상 자체가 없음.

## 권장 조치사항

1. **(WARNING 1·2 통합 대응)** `followRedirectsSafely` 의 2번째 이상 홉에서 가드가 판정 아닌 오류(가급적 시크릿 패턴 포함)를 던지는 상황을 `http-request.handler.spec.ts`(또는 `http-redirect.spec.ts`)에 추가해, 최종 `output.error.code`/`message` 가 기대값(마스킹된 메시지, 일관된 코드)인지 직접 단언한다. 이 테스트 하나가 WARNING 1(회귀테스트 부재)과 WARNING 2(비일관 코드 실증)를 함께 커버한다.
2. **(WARNING 2)** `outboundBlockReason`/`followRedirectsSafely` 가 비판정 오류도 `IntegrationError('INTEGRATION_CALL_FAILED', …)` 로 승격해 preflight/redirect-홉 두 시점의 `error.code` 를 통일할지, 아니면 spec 표에 두 코드를 모두 명시할지 결정한다.
3. **(WARNING 3, planner 턴)** `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 추가 + §4.2/§6.2 에러코드 표에 "가드 고장" 트리거 행 추가(INFO 2 동시 해소).
4. **(마무리 커밋)** 이번 라운드가 Critical·Warning(코드 대상) 0으로 수렴했으므로, `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트 3항목 체크 후 `plan/complete/` 로 이동해 `spec-draft-nullable-notation-followups.md` 의 선인용과 실제 상태를 일치시킨다(INFO 3 해소).
5. **(선택, 백로그)** 가드 "고장" 메시지의 host/IP 마스킹 정책(고정 문구 vs `sanitizeMessage` 패턴 확장)을 확정한다 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된 별도 결정 사항(INFO 1).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (10명)
  - **제외**: 표 (아래, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단(변경이 아키텍처 경계·모듈 구조 자체를 재편하지 않는 catch-분기 리팩터라는 스코프 판단으로 추정, 세부 사유는 라우터 산출에 개별 기재되지 않음) |
  | dependency | router 판단(신규 외부 패키지·의존성 버전 변경 없음으로 추정) |
  | concurrency | router 판단(락·트랜잭션·비동기 경쟁 조건과 무관한 동기 catch-분기 변경으로 추정) |
  | user_guide_sync | router 판단(사용자 대면 가이드 문서 영향 없음으로 추정) |

---
