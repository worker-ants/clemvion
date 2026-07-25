# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 로 원 보고된 1건은 다른 두 checker(convention_compliance, plan_coherence)가 동일 사실을 직접 실사해 "developer 의 `spec/` 쓰기 권한 부재로 인해 이미 명시적으로 project-planner 에 위임되고 승격 조건까지 문서화된 상태"임을 확인, 실질적으로 이번 PR 을 막을 사유가 아님을 확인했다. 다만 이 항목은 두 checker 의 상반된 등급 판단이 있었으므로 아래 표에 그 원 판정과 근거를 그대로 남긴다.

## 전체 위험도
**MEDIUM** — 기능적 결함은 없으나(코드는 §4/§5.1 규약을 정확히 구현), `node-cancellation.md` 문서 자체(§6 표·§4 예시·§5.1 서술 2건)가 실제 코드/구현과 어긋난 지점이 다수 남아 있고, 그 정정은 `project-planner` 몫으로 이미 위임돼 있으나 아직 실행되지 않았다.

## Critical 위배 (BLOCK 사유)

_해당 없음 — 아래 참고._

> cross_spec 은 `node-cancellation.md §6` 구현 현황 표(MakeShop/Cafe24 signal 전파 = "미구현")가 실제 코드(`makeshop.handler.ts`/`makeshop-api.client.ts`/`cafe24.handler.ts`/`cafe24-api.client.ts`, 이번 diff 로 §4 cascade + §5.1 AbortError 재throw 완료)·자신이 참조하는 추적 plan(`node-cancellation-residual-signal-propagation.md`, 두 항목 모두 `[x]` 완료 체크)과 정반대라는 이유로 **CRITICAL** 로 판정했다. 그러나 convention_compliance·plan_coherence 두 checker 가 동일 사실을 별도로 실사한 결과, 이는 방치가 아니라 `plan/in-progress/node-cancellation-residual-signal-propagation.md` + `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 에 **§6 표 갱신을 명시적으로 project-planner 에 위임**(승격 전 handler propagate 검증 조건까지 명문화)한 상태이며, CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규칙을 정확히 준수한 결과임을 확인했다. build-time 가드(`spec-code-paths.test.ts`)도 이 gap 으로 실패하지 않는다. 이에 따라 통합 판단에서는 **WARNING** 으로 재분류해 아래 표에 반영하고 BLOCK 사유에서 제외한다 — 단, 다음 project-planner 턴에서 반드시 정정돼야 한다(3개 checker 중복 지적).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec(원 CRITICAL) / convention_compliance / plan_coherence | `node-cancellation.md §6` 표 2행("MakeShop/Cafe24 노드 signal 전파" = 미구현)이 실제로는 이미 구현·완료됨에도 stale 상태 — 단 이미 project-planner 에 명시 위임됨 | `spec/conventions/node-cancellation.md` §6 (137~139행) | `makeshop.handler.ts`/`makeshop-api.client.ts`/`cafe24.handler.ts`/`cafe24-api.client.ts` (§4 cascade + §5.1 재throw 구현 완료), `plan/in-progress/node-cancellation-residual-signal-propagation.md`(두 항목 `[x]`) | project-planner 다음 턴에 §6 두 행을 ✓(구현됨)로 갱신 + 코드 근거 명시 + frontmatter `code:` 목록에 4개 파일 추가. "2026-06-03 코드 대조" 갱신 주석도 최신화 |
| 2 | cross_spec | `error.code: 'AbortError'` 가 프로젝트 표준 `UPPER_SNAKE_CASE` 명명 규약과 어긋나며 `error-codes.md §3` 예외 레지스트리에 미등재 | `node-cancellation.md §5.1`, `5-system/6-websocket-protocol.md §4.1` | `node-output.md §3.2`("code 는 UPPER_SNAKE_CASE"), `error-codes.md §1/§3`(예외는 명시 등재 필수) | (a) `error-codes.md §3` 에 `AbortError` 를 historical-artifact 예외로 등재 + 근거 기술, 또는 (b) `NODE_CANCELLED` 같은 신규 UPPER_SNAKE_CASE 코드로 교체(코드/테스트/두 spec 동반 갱신) — 이미 구현·테스트가 붙어 있어 (a) 가 저비용 |
| 3 | cross_spec | `§5.1` 의 `meta.success = false` 서술이 실제 엔진 구현(어디서도 `meta` 필드를 set 하지 않음) 및 `6-websocket-protocol.md §4.1` 페이로드 정의(해당 필드 없음)와 불일치 | `node-cancellation.md §5.1` | `execution-engine.service.ts:5698-5732`(AbortError catch, `meta` 미설정), `5-system/6-websocket-protocol.md §4.1`(페이로드에 `meta` 없음) | `meta.success = false` 문구 삭제, 또는 엔진에 실제로 `meta: { success:false }` 추가 + WS 페이로드 표 동반 갱신 — 셋 중 하나로 통일 |
| 4 | convention_compliance (rationale_continuity 도 동일 사실 INFO 로 확인) | `§4` cascade 예시 코드가 upstream 리스너 해제를 로컬 `controller.signal` 의 `'abort'` 이벤트에만 걸어 정상 완료 경로에서 리스너가 leak — 이번 PR 코드 리뷰가 실제로 발견해 cafe24/makeshop 구현은 `finally` 기반으로 이미 수정, spec 예시만 미수정 | `node-cancellation.md §4` (76~99행) | 실제 구현(`finally` 기반 cleanup), `http-request.handler.ts`(같은 결함 선재 확인) | project-planner 가 §4 예시를 `finally` 기반(또는 성공 경로 포함 해제)으로 교체 — `spec-update-node-cancellation-shutdown-classification.md` 위임 목록에 이미 등재됨 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `4-nodes/3-ai/1-ai-agent.md §12.16` 이 이미 `plan/complete/` 로 이동한 `node-cancellation-infrastructure` plan 을 여전히 가리킴(실제 추적처는 `node-cancellation-residual-signal-propagation.md`) | `spec/4-nodes/3-ai/1-ai-agent.md:1374` | 언급을 `node-cancellation-residual-signal-propagation` 으로 갱신 |
| 2 | convention_compliance | `cafe24-api-catalog` 하위 `store.md` 의 `privacy_*` id 접두와 별도 `privacy.md` resource 간 개념 혼동 가능성(resource 내 unique 규칙은 위반 아님) | `spec/conventions/cafe24-api-catalog/store.md` 85~90행 | 조치 불요(이미 낮은 우선순위로 문서 내 follow-up 언급됨) |
| 3 | convention_compliance | `cafe24-api-catalog/_overview.md` 가 명시적 `## Overview` 헤더 없이 H1 타이틀에 "— Overview"만 표기 (스타일 불일치, 강제 아님) | `spec/conventions/cafe24-api-catalog/_overview.md` 최상단 | 스타일 일관성 위해 `## Overview` 헤더 추가 권장(선택) |
| 4 | rationale_continuity / plan_coherence | SIGTERM/workflow-timeout abort 의 `failed` vs `cancelled` 분류 충돌 — developer 가 배선을 구현하지 않고 `⛔ BLOCKED — project-planner 결정 대기`로 명시 분리, 별도 plan 에 두 대안 택일 위임. 결정 우회 없음 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`, `node-cancellation-residual-signal-propagation.md` 4번째 항목 | project-planner 결정 시 `execution-engine.md §11`(Rationale 서브섹션 포함)·`data-flow/3-execution.md`·`1-data-model.md` 동반 갱신 |
| 5 | rationale_continuity | 직전 라운드(21_58_52) CRITICAL(handler 가 client 의 재throw `AbortError` 를 다시 흡수해 §5.1 `cancelled` 분류 미도달) 이 이후 커밋(`0cfd547a8`)으로 해소 확인, 인용 선례(`database-query.handler.ts`)도 실사로 진위 확인됨 | cafe24/makeshop handler+client (diff) | 조치 불요(해소 확인) |
| 6 | plan_coherence | 이전 라운드(19_13_33/21_58_52)가 지적한 CRITICAL/WARNING 전항목(handler 흡수, worktree sentinel, G2 교차참조) 이 이번 커밋들로 모두 해소됨 | `plan/in-progress/node-cancellation-residual-signal-propagation.md` 등 | 조치 불요(해소 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | §6 표 stale(원판정 CRITICAL, 통합 시 WARNING 재분류) · `AbortError` naming 미등재 · `meta.success` 서술 불일치 |
| rationale_continuity | LOW | 직전 라운드 Critical 해소 확인, SIGTERM 분류 충돌은 적절히 위임·격리 유지, cascade 구현이 §5.1 invariant 준수 |
| convention_compliance | LOW | §6 표·§4 예시 stale 이나 이미 개발자가 올바르게 project-planner 위임(절차 위반 아님) |
| plan_coherence | LOW | plan 2건 상호 정합, 이전 두 라운드 이슈 전항목 해소 확인 |
| naming_collision | NONE | `spec/conventions/` diff 0, 코드 신규 필드(`signal`)는 기존 확립 명명 재사용 — 신규 충돌 없음 |

## 권장 조치사항
1. project-planner: `node-cancellation.md §6` 표 두 행(MakeShop/Cafe24 signal 전파)을 ✓(구현됨)로 갱신 + 코드 근거·frontmatter `code:` 목록 반영, 상단 코드-대조 갱신일 최신화.
2. project-planner: `§4` cascade 예시 코드를 `finally` 기반 cleanup 으로 교체(리스너 leak 정정).
3. project-planner: `error.code:'AbortError'` 를 `error-codes.md §3` 예외 레지스트리에 등재하거나 UPPER_SNAKE_CASE 코드(`NODE_CANCELLED` 등)로 교체 결정.
4. project-planner: `§5.1` `meta.success = false` 문구를 실제 구현/`6-websocket-protocol.md` 와 동기화(삭제 또는 구현 추가).
5. (낮은 우선순위) `4-nodes/3-ai/1-ai-agent.md §12.16` 의 stale plan 이름 갱신.
6. SIGTERM/workflow-timeout 노드 abort 의 `failed` vs `cancelled` 분류는 project-planner 결정 대기 상태 유지 — `spec-update-node-cancellation-shutdown-classification.md` 참고해 계속 진행.