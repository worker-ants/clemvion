---
title: 통합 노드·연결 테스트 spec 의 사실 정정 넷 — code: 증거 · 가드 고장 트리거 · HTTP 테스트 결과 둘 · MakeShop «동일» 범위
status: draft
owner: project-planner
worktree: spec-integration-facts-6b21f8
started: 2026-09-20
spec_impact:
  - spec/4-nodes/4-integration/0-common.md
  - spec/4-nodes/4-integration/1-http-request.md
  - spec/4-nodes/4-integration/2-database-query.md
  - spec/2-navigation/4-integration.md
---

# 통합 계열 spec 사실 정정 넷

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 planner 항목 둘을 한 턴에 닫는다. 넷 다 **구현이
이미 그렇게 동작하는데 문서만 비어 있는** 사실 정정이다 — 제품 결정이 아니다.

| # | 대상 | 무엇이 어긋났나 | 근거 |
| --- | --- | --- | --- |
| ① | `1-http-request.md` frontmatter `code:` | §4 step 9(리다이렉트 5홉 + 홉마다 SSRF 재검증)를 구현하는 `http-redirect.ts` 가 증거 목록 넷에 없다 | `--impl-prep` `review/consistency/2026/09/20/09_06_34` convention W2 · `/ai-review` `review/code/2026/09/20/09_35_16` W5 |
| ② | `0-common.md` §4.2 · `1-http-request.md` §4 step 8 · §4.2 · `2-database-query.md` §6.2 | «SSRF 가드가 **판정 아닌 오류**(가드 자체의 고장)를 던지면 `INTEGRATION_CALL_FAILED`» 가 표에 없다. 세 문서가 «가드 실패 = 항상 차단 코드» 처럼 읽힌다 | 구현 `plan/complete/ssrf-catch-instanceof.md`(#1364) · cross_spec INFO 1 |
| ③ | `2-navigation/4-integration.md` §5.3 · §14.1 | HTTP 연결 테스트가 자격증명을 붙이기 **전** 실패하는 두 코드(`INTEGRATION_INCOMPLETE` · `INTEGRATION_AUTH_UNSUPPORTED`)가 결과 목록·어휘 표에 없다 | `--impl-prep` `review/consistency/2026/09/19/23_02_33` cross_spec W1 |
| ④ | 같은 문서 §5.9 | MakeShop 연결 테스트를 Cafe24 와 «정책 동일» 이라 적는데 403 처리가 다르다 | `--impl-done` `review/consistency/2026/09/20/00_07_48` cross_spec INFO 1 |

## 실측 (이 draft 를 쓰며 확인한 것)

- ① `http-redirect.ts` 는 실재하고 `followRedirectsSafely` · `outboundBlockReason` 을 내보낸다. `1-http-request.md`
  frontmatter `code:` 는 handler · schema · http-safety · sanitize-response-headers 넷뿐이다.
- ② `http-request.handler.ts` 는 preflight 에서 판정이 아니면 `IntegrationError('INTEGRATION_CALL_FAILED', …)` 로,
  `database-query.handler.ts` 도 같은 코드로 승격한다(#1364). `0-common.md` §4.2 는 그 코드를 «기타 일반 예외» 로 이미
  정의하므로 **새 코드를 만들지 않는다** — 트리거만 적는다.
- ③ `resolveHttpCredentials`(노드와 공유)의 실패 union 은 `INTEGRATION_INCOMPLETE | INTEGRATION_AUTH_UNSUPPORTED` 이고
  (`http-credentials.ts`), `testHttpConnection` 은 그것을 **그대로** `IntegrationTestResult.code` 로 돌려준다
  (`http-connection-tester.ts` — `if (!resolved.ok) return { success: false, code: resolved.code, … }`).
  `IntegrationTestResultCode` union 도 `Extract<HttpCredentialsResult, { ok: false }>['code']` 로 그 둘을 이미 담는다.
- ④ `5-makeshop.md` 가 403 을 `MAKESHOP_AUTH_FAILED` 로 묶는 것을 **의도**로 적는다. Cafe24 는 403 을
  `CAFE24_INSUFFICIENT_SCOPE` 로 가른다. 즉 «동일» 한 것은 401 자가회복(재시도)과 실패 카운터 정책이지 결과 코드 분류가 아니다.

## 변경안

### ① `1-http-request.md` frontmatter `code:` 에 한 줄

```yaml
code:
  - codebase/backend/src/nodes/integration/http-request/http-request.handler.ts
  - codebase/backend/src/nodes/integration/http-request/http-request.schema.ts
  - codebase/backend/src/nodes/integration/http-request/http-safety.ts
  - codebase/backend/src/nodes/integration/http-request/http-redirect.ts   # 추가 — §4 step 9
  - codebase/backend/src/nodes/integration/_base/sanitize-response-headers.util.ts
```

### ② «가드의 고장» 트리거 — 세 자리

- `0-common.md` §4.2 `INTEGRATION_CALL_FAILED` 행의 의미에 한 구 추가:
  «… `IntegrationError` 가 아닌 throw 의 기본 코드 (`toLogError` fallback). **SSRF 가드가 차단 판정(`SsrfBlockedError`)이
  아닌 오류를 던진 경우**(가드 자체의 고장)도 이 코드로 surface 된다 — 차단 코드(`HTTP_BLOCKED` · `DB_HOST_BLOCKED`)는
  판정에만 쓴다.»
- `1-http-request.md` §4 step 8 끝에 한 문장: «가드가 던진 것이 차단 판정이 아니면(가드 자체의 고장) `HTTP_BLOCKED` 가
  아니라 `INTEGRATION_CALL_FAILED` 로 라우팅한다 — 막힌 적 없는 요청을 «막혔다» 고 보고하지 않기 위해서다.»
  §4.2 표에도 행 하나: `SSRF 가드의 고장(판정 아닌 오류)` → `failed` → `INTEGRATION_CALL_FAILED`.
- `2-database-query.md` §6.2 의 `INTEGRATION_*` 행 조건에 한 구: «… + SSRF 가드가 판정 아닌 오류를 던진 경우
  (`DB_HOST_BLOCKED` 는 차단 **판정** 에만)».

### ③ HTTP 연결 테스트의 두 코드

- §5.3 «결과:» 목록 끝에 한 줄: «자격증명을 붙이기 전 실패(필수 필드 누락 · 지원하지 않는 `auth_type`) →
  `INTEGRATION_INCOMPLETE` · `INTEGRATION_AUTH_UNSUPPORTED` — 요청을 보내지 않는다. 노드와 같은
  `resolveHttpCredentials` 를 쓰므로 노드가 같은 자격증명으로 낼 코드와 같다.»
- §14.1 어휘 표에 두 행:
  - `INTEGRATION_AUTH_UNSUPPORTED` | HTTP 자격증명 해소에서 지원하지 않는 `auth_type` | 노드는 `error` 포트, 연결
    테스트는 `result.code`(요청 전 실패)
  - (`INTEGRATION_INCOMPLETE` 행은 이미 있다 — «연결 테스트에서도 같은 코드로 나온다(요청 전)» 를 그 행에 덧붙인다.)

### ④ §5.9 «정책 동일» 의 범위를 좁힌다

§5.9 첫 문단의 «공유 메커니즘(… 연결 테스트 401 자가회복)» 은 그대로 두고, 연결 테스트를 다루는 자리에 한 문장:
«연결 테스트의 **401 자가회복과 실패 카운터**는 Cafe24(§5.8)와 같다. **403 은 다르다** — Cafe24 는
`CAFE24_INSUFFICIENT_SCOPE` 로 가르고 MakeShop 은 `MAKESHOP_AUTH_FAILED` 로 묶는다([`5-makeshop.md`](../4-nodes/4-integration/5-makeshop.md) 가
의도로 적은 차이).»

## 비대상

- 트래커의 «spec 네 곳의 기존 drift»(`21_02_09` W1~4) — 그중 §3.1 실행 실패 분류표는 **제품 판단**이 필요해 이 묶음과
  성격이 다르다. 별 턴.
- 가드 고장 메시지의 host/IP 마스킹 정책 · 홉/preflight 코드 통일 — 둘 다 developer 항목이고 결정이 남아 있다.
- 새 코드·새 규약 — 없다. 넷 다 이미 도는 동작의 기록이다.

## Rationale (spec 반영 시 각 문서에 옮길 요지)

- **왜 «가드의 고장» 을 표에 적나**: 차단 코드는 사용자에게 «당신의 주소가 정책에 막혔다» 고 말한다. 가드가 고장 나서
  난 오류를 그 코드로 보고하면 **없는 사실**을 통지하고 Activity 로그에도 남는다. 구현은 #1364 에서 갈랐고, 표가 그
  구분을 담지 않으면 다음 사람이 «가드 실패 = 차단» 으로 되돌린다.
- **왜 §5.9 를 좁히나**: «정책 동일» 은 읽는 사람에게 결과 코드까지 같다고 약속한다. 실제로 다른 지점(403)이 있으면
  그 약속이 구현보다 넓다 — 이 저장소가 반복해 밟은 형태다.

## 체크리스트

- [ ] `/consistency-check --spec plan/in-progress/spec-draft-integration-error-facts.md` → BLOCK: NO
- [ ] spec 네 파일 반영
- [ ] 트래커 두 항목 해소 · 이 draft `plan/complete/` 로
