---
worktree: TBD
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

## 미구현 항목 / 결정 필요

- [ ] **결정**: Manual Trigger `output.request.headers` 에도 `sanitizeResponseHeaders` 마스킹을 적용할 것인가?
  - 찬성: 실행 이력 secret 노출 표면 제거(표현식 뷰와 일관).
  - 검토 포인트: `output.request.headers` 를 소비하는 다운스트림 노드가 **원본 헤더 값**(예: 서명 검증용 `X-Signature`)을 필요로 하는 use-case 가 있는지 — 있다면 전량 마스킹은 회귀. 이 경우 (a) 표현식/이력 노출 시점 마스킹 vs (b) 저장 시점 마스킹 중 택.
- [ ] project-planner 로 위임해 spec/4-nodes/7-trigger/1-manual-trigger.md §5.2 + spec/2-navigation/14-execution-history.md 의 redaction 정책 명문화.

## 비고

- SoT redaction 유틸: `codebase/backend/src/nodes/integration/_base/sanitize-response-headers.util.ts` (`$trigger` 가 재사용 중).
- 본 항목은 표현식 PR 범위 밖 — 별도 처리.
