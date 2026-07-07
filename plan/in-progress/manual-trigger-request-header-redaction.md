---
worktree: review-main-4d72c9
started: 2026-07-07
owner: planner
---

# Manual Trigger `output.request.headers` 민감값 마스킹 (기존 갭)

> 출처: 2026-07-07 `$trigger`/`$env` 표현식 주입 PR 의 `/consistency-check --impl-done` cross_spec WARNING.
> 관련 spec: spec/5-system/5-expression-language.md §4.5, spec/4-nodes/7-trigger/1-manual-trigger.md §5.2

## 배경

`$trigger` 표현식 뷰는 헤더 값을 `sanitizeResponseHeaders` 로 마스킹해 노출한다(expression-language §4.5). 그러나 Manual Trigger 핸들러가 webhook 실행에서 내보내는 **`output.request.headers` 는 원본(마스킹 미적용)** 이라, `Authorization`/`Cookie`/`X-Api-Key` 등 인증 헤더 값이 그대로:

- `NodeExecution.output_data` 에 durable 영속되고,
- 실행 이력(execution-history) 조회로 **viewer 롤 사용자**에게까지 노출될 수 있다.

이는 `$trigger` 작업 이전부터 존재한 갭(표현식 PR 이 도입한 것 아님)이며, `$trigger` 는 오히려 마스킹된 안전 뷰를 제공한다. 두 노출 표면의 redaction 정책이 비대칭이다.

## 결정 (2026-07-07, 사용자 확정) — Ingestion(저장 시점) 마스킹

재조사에서 노출 표면이 3곳으로 확인됨 (플랜 당초 framing 보다 넓음):
1. `NodeExecution.output_data` → manual_trigger `output.request.headers` (execution 상세).
2. `Execution.inputData.headers` (execution 상세 + Re-run 모달 + Input 탭).
3. background-run 상세 `inputData.headers`.

execution 상세 read 는 `verifyOwnership(workspaceId)` 만 게이트 → **워크스페이스 전 멤버**가 raw 인증 헤더(Authorization/Cookie 등) 열람 가능.

**결정: ingestion(저장) 시점 마스킹** (사용자 확정, display 시점 대비 추천안):
- `hooks.service` 의 두 webhook `execute()` 지점(generic §7 step 8b, chatChannel §7 step 7e)에서 **인증 검증(§4) 이후·`inputData` 저장 이전** `input.headers` 를 `sanitizeResponseHeaders` blacklist 로 마스킹.
- 효과: `inputData`·`output.request.headers`·`$trigger.headers` 3표면 + 향후 신규 read 경로까지 단일 소스로 [REDACTED]. secret at-rest 제거.
- 근거: (a) HMAC/IP/토큰 인증은 마스킹 전 raw 헤더로 이미 수행·§A.3 기록 → 무영향. (b) `output.request.headers` raw 소비 다운스트림 노드 0건 (grep 확인). (c) 비민감 커스텀 헤더는 blacklist 미매칭이라 보존. (d) `$trigger.headers` view-mask 는 idempotent 재적용(defense-in-depth 유지).
- 기각 — display 시점: raw at-rest 잔존 + 모든 read 경로(execution/background-run/신규) 개별 마스킹 필요(whack-a-mole).

## 구현 (2026-07-07)

- [x] spec: `12-webhook §5.3`(신설 SoT) + WH-EP-06·§5·§8·Rationale + §7 참조, `manual-trigger §5.2`(output.request.headers masked), `expression §4.5·§8.5`(양쪽 masked — deferral 해소), `4-execution-engine §6.1.1`·`data-flow/10-triggers §1.2` 시퀀스 cross-ref.
- [x] impl: `hooks.service` 2 지점(generic + chatChannel) execute 직전 `sanitizeResponseHeaders(input.headers)` 마스킹.
- [ ] 테스트: hooks unit(masked headers to execute) + webhook e2e(inputData.headers·output.request.headers·$trigger.headers 마스킹).

## 비고

- SoT redaction 유틸: `codebase/backend/src/nodes/integration/_base/sanitize-response-headers.util.ts` (`$trigger` 가 재사용 중).
- 본 항목은 표현식 PR 범위 밖 — 별도 처리.
