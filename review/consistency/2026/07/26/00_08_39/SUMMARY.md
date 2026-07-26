# Consistency Check 통합 보고서

**BLOCK: YES** — `cross_spec` 이 낸 Critical 1건이 있어 현행 규약(Critical 1건 이상 → BLOCK:YES, 하향 예외 미문서화)에 따라 차단

> 5개 checker 전원이 성공(success) 상태로 인라인 전문을 제공했다. 누락된 checker 는 없다 — 아래 판정은 전 checker 의 보고서를 근거로 한 것이다.
>
> **중요 맥락**: 유일한 Critical 은 이번 diff(`node-handler.interface.ts` JSDoc + plan 2건, `spec/conventions/**` 자체는 0줄 변경)가 직접 저지른 위반이 아니라, diff 가 참조하는 기존 spec 문서(`node-cancellation.md`)에 이미 있던 자기모순이다. developer 는 `spec/` 쓰기 권한이 없어 CLAUDE.md 절차대로 project-planner 앞 구체 수정 제안까지 첨부해 정당하게 위임했다(`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5"). 그럼에도 **정확히 이런 상황에서 summary 가 재량으로 Critical→Warning 하향을 해도 되는가는 아직 결정되지 않은 채로 남아 있다** (`plan/in-progress/harness-consistency-summary-downgrade-rule.md`, 옵션 a/b/c 미선택, P2). 지난 라운드(`--impl-done 22_28_51`)에서 summary 가 근거 있는 하향을 규약 조항 없이 수행했고, 이번 라운드(`00_08_39`)에서 `cross_spec` 이 같은 §6 drift 를 다시 Critical 로 냈다 — 이는 그 plan 이 우려한 "재발" 이 실제로 일어난 것이다. 이번 요약은 규약 문면(현재 하향을 허용하는 조항 없음)을 그대로 따라 **BLOCK: YES** 로 판정하며, 하향 여부를 자의적으로 재도입하지 않는다. 이 거버넌스 갭 자체의 해소는 §권장 조치 4번 참고.

## 전체 위험도
**MEDIUM** — 유일한 Critical 은 기능 결함이 아니라 기존 spec 문서 간 자기모순(이미 project-planner 앞 위임 완료)이며, 이번 PR 의 실질 코드/plan 변경(3파일, `spec/conventions/**` 0줄)은 그 모순을 정정하는 방향이다. 다만 현행 규약상 Critical 1건 존재만으로 BLOCK 이 걸린다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec (rationale_continuity·convention_compliance 도 같은 위배를 WARNING 각도로 중복 확인 — 최강 등급으로 통합) | `node-cancellation.md` 가 chat-channel 을 "노드"로 오분류 — 데이터 모델/chat-channel 시스템 스펙과 정면 모순 | `spec/conventions/node-cancellation.md` §1 목적(24행: "HTTP / DB / AI / Email / chat-channel / 이커머스 통합 Cafe24·MakeShop"), §6 구현 현황 표(137행: `chat-channel 노드 signal 전파 — 미구현 (Planned)`) | `spec/1-data-model.md` §2.8 Trigger.type(chat-channel 은 `webhook` 트리거의 `config.chatChannel` 변형이지 별도 type 아님), `spec/5-system/15-chat-channel.md` CCH-AD-05(`ChatChannelDispatcher` 는 `executionEvents$` 를 **구독**하는 outbound 어댑터이지 `context.abortSignal` 을 받는 node dispatch 대상 아님), 같은 디렉토리의 `spec/conventions/chat-channel-adapter.md`(어댑터로 명명) | project-planner 가 §1 나열에서 `chat-channel` 제거(→ `HTTP / DB / AI / Email / Cafe24·MakeShop`, 이미 `node-handler.interface.ts` JSDoc 은 이렇게 정정됨), §6 표의 `chat-channel 노드 signal 전파` 행을 삭제하거나 "노드 아님 — `webhook` 트리거 어댑터, outbound-only 라 §4 cascade 대상 아님" 으로 재기재. 구체 문구가 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-25 #5)" 에 이미 작성돼 있어 그대로 반영 가능 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec (convention_compliance·plan_coherence 는 INFO 로 기록 — 최강 등급으로 통합) | 같은 §6 표의 MakeShop/Cafe24 행이 이미 병합된 구현과 불일치 (spec-vs-code staleness) | `spec/conventions/node-cancellation.md` §6 표(138~139행: `MakeShop/Cafe24 노드 signal 전파 — 미구현 (Planned)`) | 이미 `origin/main` 에 병합된 커밋 `e83da5052`("feat(nodes): MakeShop·Cafe24 노드에 execution abortSignal 전파 (§4 cascade + §5.1 분류) (#1019)") — 이 커밋은 `spec/` 을 건드리지 않아 표가 stale 상태로 남음 | Critical #1 정정과 같은 PR/커밋에서 이 두 행을 `✓ 구현됨` 으로 함께 갱신 (`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-25)" 에 이미 위임됨) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | `spec/4-nodes/3-ai/1-ai-agent.md:1374` 가 완료·이동된 `node-cancellation-infrastructure` plan 을 여전히 가리키는 stale 포인터 | `spec/4-nodes/3-ai/1-ai-agent.md:1374` (target_path 범위 밖이나 같은 결함 클래스) | 실제 추적처인 `node-cancellation-residual-signal-propagation.md` 로 정정. 이미 위임 plan "추가 위임 #4(3)" 에 낮은 우선순위로 기재돼 신규 누락 아님 |
| 2 | convention_compliance | `node-cancellation.md` 가 `## Overview` 리터럴 헤딩 없이 `## 1. 목적` 으로 바로 시작 | `spec/conventions/node-cancellation.md` 최상단 | 강제 규약 아님(권장 사항). 같은 디렉토리의 `audit-actions.md`/`spec-impl-evidence.md` 는 `## Overview` 사용 — 차기 정리 시 일관성 차원 고려 가능 |
| 3 | naming_collision | 신규 식별자 없음 확인 | 해당 없음 | 조치 불요 — diff 가 참조하는 `CCH-AD-05`/`recordNetworkFailure`/`config.chatChannel`/`modules/chat-channel/**`/`executionEvents$` 전부 grep 으로 기존 정의 확인, 신규 도입 0건 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM (자체 평가) — Critical 행 1건 포함 | chat-channel "노드" 오분류가 `1-data-model.md`/`15-chat-channel.md` 와 정면 모순; MakeShop/Cafe24 §6 표 staleness도 부수 확인 |
| rationale_continuity | LOW | 같은 오분류가 반증된 전제로 문서에 남아있으나, developer 가 spec 권한 밖이라 project-planner 앞으로 정당하게 위임(은폐 아님) |
| convention_compliance | LOW | 같은 오분류가 `chat-channel-adapter.md` 의 어댑터 명명 체계와 불일치 — 단 신규 위반 아니고 이미 위임됨. `spec/conventions/**` 자체 diff 는 0줄 |
| plan_coherence | LOW | plan 구조·target 상태 정합 양호. 유일 잔여는 이미 위임된 §6 표/§1 drift + `harness-consistency-summary-downgrade-rule.md` 거버넌스 갭 재부상(참고용) |
| naming_collision | NONE | 신규 식별자 0건 — diff 는 기존 식별자 재참조뿐, 충돌 리스크 없음 |

## 권장 조치사항

1. **(BLOCK 해소 우선)** project-planner 가 `spec/conventions/node-cancellation.md` §1(24행)에서 `chat-channel` 을 노드 목록에서 제거하고, §6 표(137행)의 `chat-channel 노드 signal 전파` 행을 삭제하거나 "노드 아님 — `webhook` 트리거 어댑터, cascade 대상 아님" 으로 재기재한다. 구체 문구는 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5" 에 이미 있다.
2. 같은 갱신 작업에서 §6 표의 MakeShop/Cafe24 행(138~139행)을 이미 병합된 구현(`e83da5052`)에 맞춰 `✓ 구현됨` 으로 함께 정정한다 (WARNING 해소).
3. `spec/4-nodes/3-ai/1-ai-agent.md:1374` 의 stale plan 포인터를 `node-cancellation-residual-signal-propagation.md` 로 정정한다 (낮은 우선순위, INFO).
4. **(거버넌스, 별도 트랙)** `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 의 (a)/(b)/(c) 결정이 여전히 미선택 상태이고, 이번 라운드에서 정확히 그 plan 이 우려한 재발(동일 §6 drift 가 다시 Critical 로 판정)이 일어났다. 사용자 또는 harness 관리자가 이 결정을 내려야 — "developer 권한 밖 + 이미 위임 완료된 spec drift"가 매번 impl-done 을 BLOCK 시키는 현상을 규칙으로 다룰 수 있다. 이번 요약은 결정이 없는 현 상태에서 규약 문면대로 BLOCK:YES 를 유지했다.