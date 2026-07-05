# 정식 규약 준수 검토 — `spec/4-nodes/4-integration/`

검토 모드: `--impl-done` (구현 완료 후)
Target: `spec/4-nodes/4-integration/1-http-request.md`, `2-database-query.md`(부분), `spec/2-navigation/4-integration.md`(부분), `spec/5-system/2-api-convention.md`(부분)
Diff base: `origin/main`
대조 규약: `spec/conventions/node-output.md`, `spec/conventions/error-codes.md`, `spec/conventions/chat-channel-adapter.md`
참고 코드(HEAD 워킹트리 절대경로): `codebase/backend/src/nodes/integration/http-request/{http-request.handler.ts,http-request.handler.spec.ts}`

## 배경

직전 라운드(`review/consistency/2026/07/05/12_55_17/convention_compliance.md`, `--impl-prep`)가 지적한 WARNING 2건:

1. SSRF 차단 메시지 "일반화" 원칙이 HTTP Request 노드에서만 미구현(DB Query/Send Email 과 비대칭, raw hostname/IP 노출)
2. Redirect-hop SSRF 차단이 spec 표(§4.2/§6)의 `HTTP_BLOCKED` 약속과 달리 일반 catch 로 떨어져 `HTTP_TRANSPORT_FAILED` 로 오분류될 개연성

본 라운드는 이 두 갭을 메우는 구현(`ssrf-error-generalize` worktree)의 결과물을 검토한다.

## 발견사항

### [해소 확인] SSRF 차단 메시지 일반화 — HTTP/DB/Email 3-노드 대칭 완성

- target 위치: `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표, §Rationale 8.3(신설)
- 관련 규약: `spec/conventions/node-output.md` §3.2(`output.error` 표준 envelope) 및 target 문서 자신이 선언한 3-노드 SSRF posture 통일 원칙
- 확인 내용: `http-request.handler.ts:36` 에 `SSRF_BLOCKED_CLIENT_MESSAGE = 'Request blocked by SSRF policy.'` 상수를 신설해 preflight SSRF 차단(§362-398)·redirect-hop SSRF 차단(§438-462) 양쪽 모두에서 `output.error.message` 와 `logUsage` 의 usage-log message 를 이 고정 문구로 치환했다. 원본 hostname/IP 는 `logger.warn` (서버 로그 전용)에만 남긴다. `database-query.handler.ts`(`DB_HOST_BLOCKED`)·`send-email.handler.ts`(`EMAIL_HOST_BLOCKED`) 의 기존 고정 일반화 문구 패턴과 동일 형태로 정렬됐다. `http-request.handler.spec.ts` 도 `toMatch(/SSRF_BLOCKED/)` (원본 패턴 검증) → `toBe('Request blocked by SSRF policy.')` + `not.toContain('169.254')` 로 갱신되어 일반화가 테스트로 고정됐다.
- 결론: 직전 라운드 WARNING 1 해소. spec 서술(§Rationale 8.3, `2-database-query.md` Rationale 의 "HTTP Request 도 2026-07-05 동일 일반화 완료" 각주)과 코드가 일치한다.

### [해소 확인] Redirect-hop SSRF 차단의 `HTTP_BLOCKED` 라우팅 정정

- target 위치: `spec/4-nodes/4-integration/1-http-request.md` §4.2 Usage 로깅 매트릭스, §6 에러 코드 표(`HTTP_BLOCKED` 조건에 "redirect 대상 재검증" 추가), §Rationale 8.3
- 관련 규약: `spec/conventions/node-output.md` §3.2.2(코드 의미 정합) / `spec/conventions/error-codes.md` §1(의미 기반 명명 — 클라이언트는 코드 의미로 분기)
- 확인 내용: `http-request.handler.ts` 의 redirect follow 루프(§432-466) 는 이제 (a) 5홉 초과 시 `throw new IntegrationError(ErrorCode.HTTP_BLOCKED, ...)`, (b) 매 hop 의 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 실패 시 동일하게 `IntegrationError(HTTP_BLOCKED)` 로 승격해 throw 하도록 변경됐다. 바깥 catch(§537)는 `err instanceof IntegrationError` 분기를 신설해 이 경우 `buildPreflightErrorOutput` 로 code/message 를 보존하고, 그 외(진짜 transport 실패)만 기존 `HTTP_TRANSPORT_FAILED` 매핑으로 떨어지도록 분리했다. spec 표가 약속한 "redirect 한도 초과 = `HTTP_BLOCKED`" 계약과 실제 코드가 이제 일치한다. 신규 테스트(`blocks redirect to internal host with HTTP_BLOCKED...`, `blocks redirect chain exceeding 5 hops with HTTP_BLOCKED...`)가 이 분기를 커버한다.
- 결론: 직전 라운드 WARNING 2 해소.

### [INFO] `spec/2-navigation/4-integration.md` 에러 코드 표의 "메시지는 일반화" 각주가 `HTTP_{status}` 행에는 없음

- target 위치: `spec/2-navigation/4-integration.md` 표 (diff 대상 라인: `HTTP_BLOCKED` 행 및 바로 위 `HTTP_{status}` 행)
- 위반 규약: 없음(엄밀한 위반은 아님) — `node-output.md` §3.2 의 message 서술 정합성 관점의 사소한 비일관
- 상세: 이번 diff 는 `HTTP_BLOCKED` 행에만 "(메시지는 host/IP 미포함 일반화)" 각주를 추가했다. `DB_HOST_BLOCKED` 행은 기존에 이미 이 각주를 갖고 있다. `HTTP_{status}`(4xx/5xx)·`HTTP_TRANSPORT_FAILED` 행은 애초에 host/IP 노출 우려가 없는 케이스라 각주가 없는 것이 자연스러우며 이는 문제가 아니다. 다만 `EMAIL_HOST_BLOCKED` 관련 행(문서 상단 어딘가, 이번 diff 범위 밖)에도 동일 각주가 있는지는 본 diff 로 확인되지 않았다 — 3-노드 표기 일관성 재확인은 후속 사소 개선 후보로만 남긴다.
- 제안: 강제 아님. 다음 편집 시 `EMAIL_HOST_BLOCKED` 행에도 동일 각주가 있는지 훑어보는 정도로 충분.

### [검토 범위 밖 확인 — 문제 없음]

- **명명 규약**: `SSRF_BLOCKED_CLIENT_MESSAGE` 라는 새 코드 상수명은 `error.code` enum 자체가 아니라 client-facing message 리터럴이므로 `error-codes.md` 의 코드 명명 규율(§1, UPPER_SNAKE_CASE 등) 적용 대상이 아니다. `HTTP_BLOCKED` 코드 자체는 변경되지 않았다(§2 rename 안정성 정책 위반 없음 — 이번 변경은 message 내용만 바꿨을 뿐 code 는 그대로).
- **에러 컨트랙트(Principle 3.2)**: `output.error.{code, message, details?}` 형태 유지. `details` 는 여전히 `{ url, method }` 만 실어 host/IP 를 별도로 노출하지 않는다(§Rationale 8.3 이 기각한 대안 (B) "details 로 이전" 을 코드도 따르지 않음 — 일치).
- **chat-channel-adapter.md 매핑**: `HTTP_BLOCKED` 는 이미 §3.1 표에 `executionFailedInternal` 로 분류되어 있으며, 이번 변경(message 일반화·redirect 라우팅 정정)은 `error.code` 값 자체를 바꾸지 않으므로 이 매핑에 영향이 없다.
- **API 문서 규약(swagger.md)**: 이번 diff 는 노드 핸들러 계약만 다루고 REST controller/DTO 데코레이터를 건드리지 않아 스코프 밖(N/A).
- **anchor 링크 수정**(`spec/5-system/2-api-convention.md`): `#비-페이징-고정-컬렉션은-datitems-유지...` → `...-dataitems-유지...` 오타 수정. 실제 헤딩(`### 비-페이징 고정 컬렉션은 \`{data:{items}}\` 유지 ...`)의 slug 와 일치시킨 정확성 개선이며 규약 위반이 아니다.
- **문서 구조(Overview/본문/Rationale)**: `1-http-request.md` 는 기존 `## 8. Rationale` 섹션 안에 `### 8.3` 하위 섹션을 신설하는 형태로 확장했다 — 기존 3-섹션 구조를 유지하며 CLAUDE.md 문서 구조 컨벤션에 부합한다. `0-common.md` 의 Rationale 섹션 부재(직전 라운드 INFO)는 이번 diff 범위 밖이라 재언급하지 않는다(그 문서는 변경되지 않음).

## 요약

이번 구현은 직전 `--impl-prep` 라운드가 지적한 두 WARNING(SSRF 차단 메시지의 HTTP/DB/Email 3-노드 비대칭, redirect-hop SSRF 차단의 오분류 위험)을 정확히 겨냥해 해소했다. `output.error.message` 일반화, `logger.warn` 을 통한 서버 전용 원본 보존, redirect-hop SSRF 의 `HTTP_BLOCKED` 승격 및 catch 분기 재정렬이 spec 서술(§6, §4.2, §Rationale 8.3)과 코드(`http-request.handler.ts`) 양쪽에서 정확히 대응되며, 신규 테스트도 일반화 문구·`169.254` 비노출·redirect 분기를 구체적으로 검증한다. `node-output.md`(Principle 3.2 에러 envelope) · `error-codes.md`(§1 의미 기반 명명, §2 rename 안정성 — code 불변 유지) · `chat-channel-adapter.md`(코드-분류 매핑 무영향) 어느 정식 규약도 위반하지 않는다. 발견된 유일한 사항은 `2-navigation/4-integration.md` 표의 각주 표기 일관성에 관한 INFO 수준 제안뿐이다.

## 위험도

NONE
