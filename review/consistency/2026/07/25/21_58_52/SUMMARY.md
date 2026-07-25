# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 있음 (cross_spec, convention_compliance 2개 checker가 독립적으로 동일 결함 확증)

## 전체 위험도
**CRITICAL** — 이번 PR의 핵심 목적(Cafe24/MakeShop 노드 취소 시 `cancelled` 분류)이 handler 계층의 재throw 가드 누락으로 실제로는 관측 불가능하다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | Cafe24/MakeShop 핸들러가 client 가 재throw 한 raw `AbortError` 를 handler 자신의 catch 에서 다시 흡수 → `mapClientErrorToOutput` 이 `AbortError` 분기가 없어 "Unknown failure" 기본분기로 떨어져 `{code:'CAFE24_TRANSPORT_FAILED'/'MAKESHOP_TRANSPORT_FAILED', port:'error'}` 로 정상 반환됨(throw 되지 않음). 엔진의 `executeNode` catch(`isAbortError`)는 handler 가 reject 해야만 도달하므로 이 경로에선 영구히 도달 불가 → §5.1 `cancelled` 분류·`execution.node.cancelled` WS 이벤트 미발생, `NodeExecution.status` 는 `failed` 로 잘못 기록됨 | `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` (inner catch ~L262, outer catch ~L346, `mapClientErrorToOutput` ~L494) / `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts` (inner catch ~L249, outer catch ~L333, `mapClientErrorToOutput` ~L459) | `spec/conventions/node-cancellation.md §5.1` + 이를 강제하는 `execution-engine.service.ts` `executeNode` catch (`isAbortError`, ~L5698-5729, 주석이 §5.1 직접 인용) · 참조 구현 `database-query.handler.ts:320` (`if (err.name==='AbortError') throw err;` 를 D4 매핑 이전에 실행) | 양쪽 handler 의 inner+outer catch 진입 직전 모두에 `database-query.handler.ts` 와 동형인 `if (err instanceof Error && err.name === 'AbortError') { throw err; }` 가드 추가. `apiClient.call` 이 `AbortError` 로 reject 될 때 handler 가 이를 그대로 propagate 하는지 검증하는 단위 테스트를 `cafe24.handler.spec.ts`/`makeshop.handler.spec.ts` 에 추가(현재 "abortSignal forwarding" describe 는 forward 여부만 검증하고 reject 반응은 미검증). 수정 전엔 `spec-update-node-cancellation-shutdown-classification.md` 의 §6 표 ✓ 승격 제안을 보류할 것 — 지금 승격하면 미충족 계약을 "구현됨"으로 잘못 기록하게 된다. `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 "commerce 2건" `[x]` 완료 표시도 재검토 필요 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, plan_coherence | `node-cancellation-residual-signal-propagation.md` 의 `worktree:` frontmatter 가 착수 후에도 sentinel `(unstarted)` 로 남아 실제 작업 worktree 를 가리키지 않음(다수 커밋이 이 worktree 에서 이미 진행됨) | `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter (`worktree: (unstarted)`) | `.claude/docs/plan-lifecycle.md §4` ("착수 시 실제 `<task>-<slug>` 로 교체") | `worktree: node-cancel-signal-b4d1` 로 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, plan_coherence | `node-cancellation.md §6` 표(MakeShop/Cafe24 signal 전파 두 행)·§4 cascade 예시가 아직 실제 구현 완료 상태·리스너 누수 수정을 반영 못함 — 단 developer 가 `spec/` 쓰기 권한이 없어 `spec-update-node-cancellation-shutdown-classification.md` 로 이미 명시적으로 위임됨(조치 불요, project-planner 다음 턴 확인 대상) | `spec/conventions/node-cancellation.md §6` 137~139행, §4 예시 | project-planner 가 §6 표 갱신 시 위 Critical(실제로는 §5.1 미충족)을 함께 반영해야 함 — 그렇지 않으면 표 갱신이 CRITICAL 실체를 "구현 완료"로 덮어버리는 새 SPEC-DRIFT 가 됨 |
| 2 | convention_compliance | `review/code/2026/07/25/21_35_11/RESOLUTION.md` 의 "fixture path 통일(product→products)" claim 이 실제 코드와 부분 불일치 — `cafe24-api.client.spec.ts:285` 한 곳만 `'product'`(단수) 잔존(기능적 해는 없음, 해당 테스트가 path 값을 단언하지 않음) | `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:285` | 285행을 `path: 'products'` 로 통일하거나 RESOLUTION claim 을 "일부 반영"으로 정정 |
| 3 | rationale_continuity | SIGTERM/workflow-timeout abort 의 `failed` vs `cancelled` 분류 충돌 — 이번 PR 은 배선하지 않고 `⛔ BLOCKED — project-planner 결정 대기` 로 분리, 별도 plan 에 (a)/(b) 택일 + 동반 spec 갱신 대상을 미리 열거해 위임함(결정 번복·근거 없는 우회 없음, 조치 불요) | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` | 없음. planner 가 택일 시 `execution-engine.md §11 Rationale`·`data-flow/3-execution.md` 상태 다이어그램·`1-data-model.md` 에러코드 표 동반 갱신 재확인 |
| 4 | rationale_continuity | cafe24/makeshop cascade 최종 구현이 §5.1 "cancelled ≠ failed" invariant 를 위반 없이 정확히 준수(1차 리뷰 이전 오분류 시도는 이미 교정됨) | client 코드(`cafe24-api.client.ts`/`makeshop-api.client.ts`) | 없음(정합 확인 기록) |
| 5 | naming_collision | 신규 필드 `Cafe24CallOptions.signal`/`MakeshopCallOptions.signal` 은 §4 기존 cascade 패턴의 자연스러운 적용이며 카탈로그·`execution-context.md` 어디서도 다른 의미로 쓰이지 않아 충돌 없음 | `cafe24-api.client.ts`/`makeshop-api.client.ts` | 없음 |
| 6 | naming_collision | 신규 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 파일명은 기존 `spec-update-*` 컨벤션에 정확히 부합, 경로·ID 충돌 없음 | 해당 plan 파일 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | handler 가 AbortError 를 삼켜 §5.1 cancelled 분류 도달 불가; §6/§4 spec-drift 는 이미 적절히 위임됨 |
| rationale_continuity | LOW | §5.1 invariant 준수 확인, SIGTERM/timeout 분류 충돌 적절히 격리·위임, §4 예시 누수 정정도 올바른 경로로 위임 |
| convention_compliance | HIGH | 동일 CRITICAL(§5.1 위반) 독립 확증 + worktree frontmatter sentinel WARNING + RESOLUTION claim 불일치 INFO |
| plan_coherence | LOW | §6 표 미반영·worktree frontmatter 는 INFO 수준(이미 위임/경미); 이전 라운드 CRITICAL/WARNING 은 모두 해소 확인 |
| naming_collision | NONE | scope(`spec/conventions/`) 내 diff 0, 코드 신규 `signal` 필드도 기존 패턴 확장이라 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 최우선) `cafe24.handler.ts` / `makeshop.handler.ts` 양쪽 inner+outer catch 에 `AbortError` 재throw 가드 추가 (`database-query.handler.ts` 패턴과 동형), 대응 단위 테스트("apiClient.call 이 AbortError 로 reject 되면 handler 도 그대로 propagate") 추가.
2. 수정 완료 전까지 `spec-update-node-cancellation-shutdown-classification.md` 의 §6 표 ✓ 승격 제안 보류 — 승격 시 미충족 계약을 "구현됨"으로 기록하는 새 SPEC-DRIFT 를 만들게 됨.
3. `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 "commerce 2건" `[x]` 완료 표시 재검토(§5.1 미충족 상태이므로).
4. `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter `worktree:` 를 `node-cancel-signal-b4d1` 로 갱신.
5. `review/code/2026/07/25/21_35_11/RESOLUTION.md` 의 fixture path claim 정정 또는 `cafe24-api.client.spec.ts:285` 를 `'products'` 로 통일.
6. 이번 PR 범위 밖이지만 동일 근본 결함이 이미 있는 `http-request.handler.ts`/`text-classifier.handler.ts` 를 project-planner 경유 후속 plan 으로 별도 추적(§6 "✓" 표기가 §5.1 을 실제로 검증하지 않은 채 방치되지 않도록).