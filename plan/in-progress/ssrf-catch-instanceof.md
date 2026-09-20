---
title: SSRF 가드 소비자 넷이 «판정» 과 «다른 오류» 를 가르게 — catch 를 instanceof SsrfBlockedError 로
status: in-progress
owner: developer
worktree: ssrf-catch-instanceof-7b3f1a
started: 2026-09-20
spec_impact: none
---

# SSRF 가드 소비자 넷의 catch

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로»
(`/ai-review` `review/code/2026/09/19/22_00_32` architecture WARNING 2 — 수렴 예외로 넘어온 것).

## 무엇이 문제인가

`http-safety.ts` 의 가드는 **차단 판정**을 `SsrfBlockedError` 로 던진다. 그런데 네 호출부는 가드가 던진 것을 **무엇이든** 차단으로 옮긴다:

| 호출부 | 지금 |
| --- | --- |
| `http-request.handler.ts` preflight (`assertSafeOutboundUrl` → `assertSafeOutboundHostResolved`) | `catch (err)` → 무조건 `HTTP_BLOCKED` + 일반화 문구 + usage 로그 `HTTP_BLOCKED` |
| `http-redirect.ts` `outboundBlockReason` | `catch (err)` → 무엇이든 «차단 사유» 문자열 |
| `database-query.handler.ts` `execute` preflight | `catch {}` → 무조건 `DB_HOST_BLOCKED` |
| `database-connection-tester.ts` `testDatabaseConnection` | `catch (err)` → 무조건 `DB_HOST_BLOCKED` 결과 |

SMTP 가드(`send-email/smtp-host-guard.ts` `isSmtpHostBlocked`)만 이미 가른다 — «판정은 `SsrfBlockedError` 하나뿐이다. 다른 오류가 여기로 오면 판정이
아니므로 삼키지 않는다».

**지금 동작 차이가 없다는 것은 실측이다** — 가드의 두 진입점은 던지는 것이 전부 `SsrfBlockedError` 다: `assertSafeOutboundUrl` 은
`new URL()` 실패까지 판정으로 감싸고, `assertSafeOutboundHostResolved` 는 `lookup` 실패를 삼킨다(fail-open). 남는 비판정 경로는
`hostname` 이 문자열이 아닐 때의 `TypeError`(`isBlockedHostname` 의 `.toLowerCase()`) 하나인데, 저장·테스트 두 경로 모두
`validateCredentials`(`service-registry.ts` `validateCredentials` — `field.type === 'string'` 이면 `typeof value !== 'string'` 를 거절)를 지나므로 API 로는
닿지 않는다.

그래서 이 변경이 고치는 것은 **오늘의 오동작이 아니라 내일의 오분류**다. 가드에 판정 아닌 실패가 하나 생기는 순간(새 검사 · 라이브러리
교체 · fail-open 철회), 네 곳이 그것을 «SSRF 로 막혔다» 고 사용자에게 보고한다 — 차단된 적 없는 요청에 대해. 판정과 고장을 가르는 것은
가드를 쓰는 쪽의 계약이다.

## 호출부마다 정한 기대 동작

원칙: **판정만 차단으로. 판정이 아니면 그 호출부의 «분류되지 않은 실패» 경로로** — 그 경로는 이미 각 파일에 있다.

| 호출부 | `SsrfBlockedError` | 그 밖 |
| --- | --- | --- |
| `http-request.handler.ts` preflight | 지금 그대로 (`HTTP_BLOCKED` · 일반화 문구 · usage `HTTP_BLOCKED`) | usage `toLogError(err)` + `buildPreflightErrorOutput(err, …)` → `port:'error'` · `INTEGRATION_CALL_FAILED`. 자격증명 resolve 실패가 이미 쓰는 같은 경로(`resolveIntegration`/`buildHttpCredentials` catch), 공통 §4.2 가 그 코드를 «기타 일반 예외(분류되지 않은 실패)» 로 정의한다 |
| `http-redirect.ts` `outboundBlockReason` | 사유 문자열 (그대로) | **그대로 던진다**. 호출자 둘 다 `try` 안에서 부르므로 각자의 실패 경로로 간다 — 노드는 `HTTP_TRANSPORT_FAILED`, 테스터는 `HTTP_CONNECT_FAILED` |
| `database-query.handler.ts` | `DB_HOST_BLOCKED` (그대로) | `IntegrationError('INTEGRATION_CALL_FAILED', …)` 로 승격. **그냥 던지면 바깥 catch 가 `mapDbError` 로 `DB_QUERY_FAILED`** 를 매기는데 쿼리는 시작도 안 했고, 같은 실패의 usage 로그는 `toLogError` 로 `INTEGRATION_CALL_FAILED` 가 된다 — 승격이 둘을 한 코드로 맞춘다 |
| `database-connection-tester.ts` | `DB_HOST_BLOCKED` 결과 (그대로) | `DB_CONNECT_FAILED` 결과 + `logger.warn`. **던지지 않는다** — 이 함수의 문서화된 계약(JSDoc «던지지 않는다 — 결과를 돌려준다»)이자 `dispatchTest` 의 tester 계약 |

**동반 1건** — `http-connection-tester.ts` 의 preflight `outboundBlockReason` 호출은 `try` **밖**에 있다. 위에서 `outboundBlockReason`
이 비판정 오류를 던지게 되면 이 테스터가 던지게 되어 같은 no-throw 계약이 깨진다 — 그 호출을 아래 `try` 안으로 옮긴다(판정 경로의 동작은
그대로: `blocked(reason)` 반환).

## 비대상

- 가드 자체(`http-safety.ts`)의 판정 로직 · 대역 · fail-open 정책 — 바꾸지 않는다.
- SMTP 가드 — 이미 가른다.
- 공용 가드를 `http-request/` 밖으로 옮기는 것 — 트래커의 별 항목(spec `code:` 동반 변경이라 planner 필요).

## 테스트

호출부마다 «가드가 판정 아닌 오류를 던졌다» 를 주입해 **차단으로 보고하지 않는지**. 주입은 모듈 mock
(`jest.requireActual` 로 `SsrfBlockedError` 실물을 남기고 함수만 `jest.fn`) — 판정 경로 기존 테스트는 실물 가드를 그대로 쓰게 한다.

1. `http-request.handler.spec.ts` — 비판정 → `output.error.code === 'INTEGRATION_CALL_FAILED'`, `port: 'error'`, usage 로그가
   `HTTP_BLOCKED` 가 **아님**.
2. `http-redirect.spec.ts`(없으면 `http-connection-tester.spec.ts` 경유) — 비판정 → `outboundBlockReason` 이 던진다.
3. `database-query.handler.spec.ts` — 비판정 → `INTEGRATION_CALL_FAILED`, `DB_HOST_BLOCKED` 아님.
4. `database-connection-tester.spec.ts` — 비판정 → `DB_CONNECT_FAILED` 결과, 던지지 않음.
5. `http-connection-tester.spec.ts` — 비판정 → `HTTP_CONNECT_FAILED` 결과, 던지지 않음(동반 1건).

판별력: 각 분기를 되돌리면(= `instanceof` 조건 제거) 해당 테스트가 RED 인지 뮤턴트로 확인한다.

## 체크리스트

- [x] `--impl-prep spec/4-nodes/4-integration/` — `review/consistency/2026/09/20/09_06_34` BLOCK: NO (Critical 0 · WARNING 2).
  WARNING 둘은 이 변경 밖이다: (1) 번들 예산이 `spec/conventions/*.md` 원문을 떨구고 cafe24/makeshop 카탈로그를 실었다
  (checker 가 직접 Read 로 보완해 판정) · (2) `1-http-request.md` frontmatter `code:` 에 `http-redirect.ts` 가 없다 —
  둘 다 마무리 커밋에서 등재한다. INFO: `INTEGRATION_CALL_FAILED` 의 새 트리거를 spec 표에 한 줄(planner) ·
  `IntegrationError` 승격에 `cause` 부착 여부를 §6.3.1 C1/C2 로 판정(→ C2 로 미부착, 주석에 근거)
- [x] 테스트 선작성 · 구현 · 뮤턴트로 판별력 — `840e8e7f9`. 새 테스트 셋 + `http-redirect.spec.ts` 신설(종전 0건).
  뮤턴트 넷(각 판정 분기 삭제 = 옛 동작) 전부 RED: redirect(«rejected 대신 resolved») · http-request(`HTTP_BLOCKED`) ·
  database-query(`DB_HOST_BLOCKED`) · db tester(`DB_HOST_BLOCKED`)
- [x] TEST WORKFLOW (lint · unit · build · e2e 366) + 백엔드 타입체크 ratchet(194건 — baseline 일치)
- [ ] `/ai-review` 수렴
- [ ] `--impl-done`
- [ ] 트래커 해소 · 이 plan `plan/complete/` 로
