# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. SSRF 가드의 "판정(SsrfBlockedError) vs 가드의 고장" 분류 자체는 8개 리뷰어 전원이 견고하다고 확인했으며, 남은 이슈는 전부 마스킹 대칭성·문서 최신성·테스트 격리·스타일 수준의 WARNING/INFO. forced(router_safety) 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보되어 강제 화이트리스트 미이행은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | 가드 "고장"(비판정) 오류를 client/Activity 로그로 승격할 때 쓰는 `sanitizeMessage`/`toLogError` 는 자격증명 패턴만 마스킹하고 host/IP 는 마스킹하지 않는다 — "판정"(`SsrfBlockedError`) 분기가 완전 일반화 문구로 치환하는 CWE-209 원칙과 비대칭. 현재 가드가 던질 수 있는 유일한 비판정 오류(`isBlockedHostname` 의 `TypeError`)엔 host/IP 가 없어 즉시 유출은 없음 | `http-request.handler.ts` 362-381, `database-query.handler.ts` 270-280, `database-connection-tester.ts` 145-154 (마스킹: `integration-handler-base.ts:156-171` `SECRET_PATTERNS`) | 세 곳 모두 client-facing 메시지를 고정 일반화 문구로 바꾸거나 `sanitizeMessage` 에 host/IP 패턴 추가. 급하지 않으나 트래커 등재 권고 |
| 2 | SIDE_EFFECT / DOCUMENTATION | `outboundBlockReason` 의 throw 계약 변경(이번 diff 의 핵심)으로 **리다이렉트 홉**에서의 가드 고장이 `http-request.handler.ts` 의 `HTTP_TRANSPORT_FAILED` catch-all 로 떨어져 `sanitizeMessage` 조차 거치지 않고 원문 message 가 나간다 — 같은 사건(가드 고장)이 검사 시점(첫 preflight vs 리다이렉트 홉)에 따라 마스킹 여부가 갈리는 비일관을 이번 PR 이 새로 만듦. `followRedirectsSafely` 의 JSDoc(51-53행)도 이 새 던짐 경로를 반영하지 못해 "이 함수 밖으로 나가는 예외 = fetch 오류"로 오인될 수 있음. 오늘은 홉 URL 이 항상 유효 문자열이라 도달 불가 | `http-redirect.ts` 21-38(`outboundBlockReason`), 51-53(JSDoc), 74(`followRedirectsSafely`); `http-request.handler.ts` 약 533-558(`HTTP_TRANSPORT_FAILED` catch-all) | JSDoc 을 "fetch 전송 오류 + 홉 검사 중 가드의 판정 아닌 오류도 그대로 던진다"로 갱신하고, 도달 가능해지면 홉 오류도 `instanceof SsrfBlockedError` 로 갈라 마스킹 대칭을 맞춘다. 최소한 트래커에 한 줄 등재 |
| 3 | REQUIREMENT | `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 가 여전히 누락 — 1라운드 WARNING 5 의 미해소 잔여(코드는 이 파일을 직접 수정하고 신규 spec 까지 만들었음). developer 자기-반증형 소정정 대상 아님이 이미 확인됐고 planner 백로그에 등재됨 | `spec/4-nodes/4-integration/1-http-request.md` frontmatter (1-8행); 등재처: `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/ssrf-catch-instanceof.md` | 코드 수정 아님 — `project-planner` 턴에서 `code:` 에 `http-redirect.ts` 추가 (이미 계획됨, 병합 시점 기준 재확인) |
| 4 | MAINTAINABILITY | 같은 `catch` 블록 안에서 `err instanceof Error ? err.message : String(err)` 동일 표현이 두 번 인라인 반복 — 형제 파일(`database-connection-tester.ts`, `http-request.handler.ts`)은 catch 진입부에서 한 번만 계산해 재사용하는데 이 파일만 다른 패턴 | `database-query.handler.ts:272, 279` | catch 진입부에서 `const detail = ...` 로 한 번 추출해 `logger.warn` 과 `sanitizeMessage(detail)` 양쪽에서 재사용 |
| 5 | TESTING | 신규 타임아웃-신호 회귀 테스트가 파일 자체의 `afterEach` 스파이 복구 관례(같은 파일의 `fetchMock` 은 `afterEach` 로 복구)를 따르지 않고, 테스트 본문 마지막 줄에서만 수동 `mockRestore()` 호출 — 앞선 `expect` 가 실패하면 `AbortSignal.timeout` 스파이가 복구되지 않은 채 이후 테스트로 새어나감(전역 `restoreMocks: true` 없음). 기능적 영향은 낮음(call-through) | `http-connection-tester.spec.ts:246-255` | `timeoutSpy` 를 지역 변수로 끌어올려 `afterEach` 에서 복구하거나 `try/finally` 로 감쌈 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | PERFORMANCE | `toLogError(err)` 가 같은 catch 블록에서 두 번 호출돼 `sanitizeMessage` regex 패스가 중복 실행. 요청당 1회·짧은 문자열이라 실질 영향 미미 | `http-request.handler.ts:369, 379` | `const logError = toLogError(err);` 로 한 번만 계산해 재사용 |
| 2 | PERFORMANCE | `sanitizeMessage` 가 `clampMessage` 이전, 길이 상한 없는 원문 전체에 실행됨(신규 호출 경로). 현재 관측되는 입력은 짧아 문제 없음 | `database-connection-tester.ts:152` | 현 상태로 충분. 가드가 긴 문자열을 던지게 되면 `clampMessage` 를 먼저 적용하는 순서 고려 |
| 3 | PERFORMANCE(개선) | `AbortSignal.timeout` 생성을 preflight(DNS 조회) 뒤로 이동 — 가드의 블로킹 I/O 가 fetch 타임아웃 워터마크를 잠식하던 부작용 제거. 회귀 아니라 개선 | `http-connection-tester.ts:120-129` | 조치 불요 |
| 4 | SCOPE | import 나열 순서가 형제 파일 5곳과 다름(`SsrfBlockedError` 가 뒤에 옴). 1라운드에서 이미 조치 불요로 처분, 실질 영향 없음 | `database-connection-tester.spec.ts:5-8` | 조치 불요 — 다음에 파일을 만질 때 정렬만 맞추면 됨 |
| 5 | MAINTAINABILITY | "판정 아니면 승격" 패턴이 4개 호출부(`database-connection-tester.ts`, `database-query.handler.ts`, `http-request.handler.ts`, `http-redirect.ts`)에 구조적으로 반복. 처리 방식이 서로 달라 얇은 공용 헬퍼로 묶으면 오히려 가독성 저하 우려. 1라운드에서 이미 근거와 함께 보류 결정됨 | 4개 파일 각 guard 분기 | 지금 조치 불요. 두 번째 비판정 예외 유형이 필요해지는 시점에 공용 위치 이동과 함께 재고 |
| 6 | TESTING | "판정 아닌 오류 → `INTEGRATION_CALL_FAILED`" 분기가 `authentication: 'integration'` 한 케이스만 테스트(차단 경로는 `it.each` 로 `none`/`custom` 까지 커버). 같은 `if` 조건을 인증 방식과 무관하게 공유해 회귀 위험 낮음. 1라운드부터 유지, 필수 아님 | `http-request.handler.ts:363` 부근; 테스트 `http-request.handler.spec.ts:960` | 필수 아님 |
| 7 | TESTING | `outboundBlockReason` 이 리다이렉트 홉 도중(`followRedirectsSafely` 내부 재호출) 판정 아닌 오류를 던지는 경로는 첫 호출 경로로만 간접 검증되고 직접 테스트되지 않음. 1라운드부터 유지, 신규 악화 아님 | `http-redirect.ts`(`followRedirectsSafely`); 테스트 `http-redirect.spec.ts:47` | 필수 아님(WARNING 2 해소 시 함께 보강 고려) |
| 8 | DOCUMENTATION | 인라인 주석의 "§아래 JSDoc" 참조가 실제로는 위쪽 JSDoc 을 가리킴(방향 오기, 내용은 정확) | `database-connection-tester.ts:146` | "§아래 JSDoc" → "§위 JSDoc" 으로 정정 |
| 9 | DOCUMENTATION | 트래커 종결 메모("뮤턴트 다섯으로 판별력 확인")와 원본 plan 체크리스트("뮤턴트 넷") 사이 개수 불일치 — 다섯 번째가 무엇인지 명시 안 됨(정황상 1라운드 W2 타임아웃 순서 회귀 테스트로 추정) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4923-4926` vs `plan/in-progress/ssrf-catch-instanceof.md:81-83` | 트래커 문구에 다섯 번째 뮤턴트를 괄호로 명시하거나 원본 체크리스트에 반영 |
| 10 | REQUIREMENT | `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트(리뷰 수렴·`--impl-done`·`plan/complete/` 이동)가 아직 미체크인데, 같은 diff 의 다른 트래커 문서는 이미 "해소"로 체크하고 존재하지 않는 `plan/complete/ssrf-catch-instanceof.md` 를 참조 — 시점상 이름 | `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트; `plan/in-progress/spec-draft-nullable-notation-followups.md` 해당 항목 | 이번 리뷰가 Critical/Warning 수렴 처리되면 마무리 커밋에서 plan 체크 3항목 완료 + `plan/complete/` 실제 이동 |
| 11 | SECURITY / REQUIREMENT | 가드 고장 메시지가 `sanitizeMessage` 없이 노출되는 기존 2개 경로(`http-connection-tester.ts` 의 `describeFailure`→`clampMessage`, redirect-hop `HTTP_TRANSPORT_FAILED`)는 1라운드 RESOLUTION 이 "이 PR 이 만든 경로가 아니다"로 명시적으로 스코프아웃한 결정이며 spec(`3-error-handling.md` §6.3)도 위반하지 않음 | `http-connection-tester.ts`(catch 블록); `http-request.handler.ts`(redirect-hop catch, WARNING 2 와 동일 근본원인) | 조치 불요(기결정) — WARNING 2 해소 시 함께 정리 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | sanitizeMessage 가 호스트/IP 미마스킹 — 판정 분기와 비대칭(현재 도달 불가) |
| performance | NONE | 순수 에러분류 리팩터, 새 반복/블로킹 I/O 없음. AbortSignal 타이밍 개선 포함 |
| requirement | LOW | spec frontmatter `code:` 누락 잔여(계획됨) + plan/트래커 완료 서술 시점 불일치 |
| scope | NONE | 32개 파일 전량이 선언된 단일 스코프 내, drive-by 변경 없음 |
| side_effect | LOW | 리다이렉트 홉 경유 신규 미마스킹 경로(WARNING 2) |
| maintainability | LOW | `database-query.handler.ts` 표현식 중복 스타일 불일치 |
| testing | LOW | 신규 회귀 테스트의 mock 복구가 `afterEach` 관례를 벗어남 |
| documentation | LOW | `followRedirectsSafely` JSDoc 이 자신이 바꾼 throw 계약을 반영 못함 |

## 발견 없는 에이전트

없음 — 8개 에이전트 전원이 최소 1건 이상(WARNING 또는 INFO)을 보고했다. 단, 어느 에이전트도 CRITICAL 은 보고하지 않았고, SSRF 우회·인젝션·인증 우회·하드코딩 시크릿 등 실질적 보안 결함은 발견되지 않았다.

## 권장 조치사항

1. `outboundBlockReason`/`followRedirectsSafely` 의 리다이렉트 홉 경로가 새로 연 미마스킹 노출(WARNING 2)을 트래커에 등재하거나 JSDoc 갱신 — 이 PR 이 명시적으로 지키려 한 CWE-209 원칙과 정면으로 부딪히는 잔여 항목이므로 우선순위가 가장 높음.
2. `sanitizeMessage` 의 host/IP 마스킹 갭(WARNING 1)을 같은 트래커 항목으로 묶어 후속 처리.
3. `http-connection-tester.spec.ts` 신규 회귀 테스트의 스파이 복구를 `afterEach`/`try-finally` 로 교정(WARNING 5) — 디버깅 노이즈 예방 차원의 저비용 수정.
4. `database-query.handler.ts` 표현식 중복(WARNING 4) 정리 — 사소하지만 즉시 반영 가능.
5. spec frontmatter `code:` 목록 갱신(WARNING 3)은 이미 planner 백로그에 등재됨 — `project-planner` 턴에서 처리.
6. 이번 라운드가 Critical/Warning 실질 조치로 수렴하면, 마무리 커밋에서 `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트 완료 + `plan/complete/` 이동으로 트래커 서술과 실제 상태를 일치시킨다(INFO 10).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단 — 세부 사유는 이번 워크플로 입력에 포함되지 않음(routing decision 상세 미제공) |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |
