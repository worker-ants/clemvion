---
title: 연결 테스트 결과 코드를 상수 · literal union 으로 · 테스트 빈칸 셋
status: in-progress
owner: developer
worktree: tester-codes-4b9e17
started: 2026-09-19
spec_impact: none
---

# 연결 테스트 결과 코드 · 테스트 빈칸

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목을 닫는다 — «연결 테스트 결과 코드가 원시 문자열로 흩어져
있다»(+ 같은 항목의 «`IntegrationTestResult.code` 를 literal union 으로») · «연결 테스트 spec 의 빈칸 셋». 동작은 바뀌지 않는다.

## 실측 (2026-09-19, `origin/main` `ea27c21b3`)

`IntegrationTestResult.code` 는 `string` 이고, 그 값을 만드는 곳은 일곱이다. 처음 `git grep` 으로는 여섯을 셌다 — 타입을 좁히자 컴파일러가
일곱째(`testConnection` 이 테스터 앞에서 돌려주는 게이트 코드 `INTEGRATION_CREDENTIALS_UNREADABLE` · `INTEGRATION_INCOMPLETE`)를 찾아냈다.
좁히는 것 자체가 전수 조사였다:

| 생산자 | 코드 | 지금 타입 |
|---|---|---|
| `database-connection-tester.ts` | `DB_HOST_BLOCKED` · `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` | 리터럴 |
| `http-connection-tester.ts` | `HTTP_BLOCKED` · `HTTP_AUTH_FAILED` · `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED` + `resolveHttpCredentials` 실패 | 리터럴 · `'INTEGRATION_INCOMPLETE' \| 'INTEGRATION_AUTH_UNSUPPORTED'` |
| `integrations.service.ts` `testEmailTransport` | `EMAIL_HOST_BLOCKED` · `EMAIL_CONNECT_FAILED` | 리터럴 |
| 같은 파일 `testMcpTransport` | `McpFailureCode` ∪ `MCP_CONNECT_FAILED` | union(이미) |
| Cafe24 entity tester(`cafe24.module` → `pingConnection`) | `CAFE24_AUTH_FAILED` · `CAFE24_TRANSPORT_FAILED` · `CAFE24_INSUFFICIENT_SCOPE` · `INTEGRATION_INCOMPLETE` | `code?: string` |
| MakeShop entity tester(`makeshop.module` → `pingConnection`) | `MAKESHOP_AUTH_FAILED` · `MAKESHOP_TRANSPORT_FAILED` · `INTEGRATION_INCOMPLETE` | `code?: string` |

백엔드 안에서 이 `code` 를 비교하는 곳은 없다(`git grep`) — 좁히는 이득은 생산자 쪽 오타 · 노드 런타임 `ErrorCode`(`DB_CONNECTION_ERROR` ·
`HTTP_TRANSPORT_FAILED` — 이름이 가깝다)와의 혼동을 컴파일 에러로 만드는 것이다.

테스트 빈칸(트래커 원문 그대로 확인): (1) `buildMysqlSsl` 의 `require` · `verify-full` → `rejectUnauthorized: true` 를 mysql 경로에서 단언하는
테스트가 없다(postgres `verify-full` 만). (2) `database-driver-sockets.spec.ts` 의 mysql2 케이스는 unit 에서 루프백 연결을 실제로 시도한다 —
소켓 정리가 `try/finally` 가 아니다. (3) rotate 의 `update` 성공 뒤 재조회가 `null`(그 사이 삭제) → 404 분기 테스트가 없다.

## 할 것

1. `modules/integrations/connection-test-codes.ts` — transport tester 가 스스로 내는 코드(EMAIL · DB · HTTP)를 `as const` 객체로,
   `IntegrationTestResult.code` 의 타입 `ConnectionTestResultCode` = 그 코드 ∪ `McpFailureCode` ∪ HTTP 자격증명 실패 ∪ Cafe24 · MakeShop ping 코드.
   생산자 셋(DB · HTTP · Email 테스터)은 상수를 쓴다.
2. Cafe24 · MakeShop `pingConnection` 반환의 `code` 를 각자의 ping 코드 union 으로(내보낸 타입) — entity tester 등록부가 `string` 을 넘기지 못하게.
3. 테스트 빈칸 셋 + 타입이 좁혀졌다는 것을 고정하는 타입 테스트(`@ts-expect-error` — 노드 런타임 코드를 넣으면 컴파일 에러).
   **테스트의 기대값은 리터럴로 둔다** — 상수를 쓰면 상수의 오타가 테스트에도 그대로 들어가 wire 계약을 보는 눈이 사라진다.

## 비대상

- 결과 코드의 지역화(트래커 «결과 코드가 지역화 사전에 없다») — UI 턴.
- spec 의 코드 표기 — 문서라 리터럴이 맞다.

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/19/23_02_33`(scope `spec/2-navigation/` + 보정 블록) BLOCK: NO. WARNING 2: (1) spec §5.3 ·
  §14.1 이 HTTP 연결 테스트가 돌려줄 수 있는 `INTEGRATION_INCOMPLETE` · `INTEGRATION_AUTH_UNSUPPORTED`(`resolveHttpCredentials`)를 적지 않는다 —
  spec 쓰기라 트래커 등재(planner). (2) 새 타입 이름을 `ConnectionTestResultCode` 가 아니라 `IntegrationTestResultCode` 로 — 소유 인터페이스와
  맞추고 비슷한 이름의 다섯째를 만들지 않는다(반영). INFO: 노드와 «의미 공유» vs «이름만 근접» 을 상수 파일 주석에 나눠 적었다.
- [x] 테스트 선작성 → 구현 — `9e00740b2` · `7403fc4a6`. RED 는 상수 모듈 부재 하나(나머지 셋은 기존 동작의 고정이라 GREEN — 대신 뮤턴트로
  판별력 확인: rotate «다시 읽지 않음» RED · mysql «require 는 검증 안 함» RED · 타입 «`code` 를 `string` 으로» 는 tsc 에서 쓰이지 않는
  `@ts-expect-error` 3건). 좁히자 생산자 일곱째(게이트 코드)가 드러났다.
- [x] TEST WORKFLOW (lint · unit · build · e2e 364) — lint 가 `@ts-expect-error` 설명 길이 한 건을 잡아 고쳤다
- [ ] `/ai-review` 수렴
- [ ] `--impl-done`
- [ ] 트래커 두 항목 해소 · 이 plan `plan/complete/` 로
