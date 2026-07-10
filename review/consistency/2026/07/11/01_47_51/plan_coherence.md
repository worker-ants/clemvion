# Plan 정합성 검토 — spec-draft-waiting-surface-guard.md

## 검토 대상
- Target: `plan/in-progress/spec-draft-waiting-surface-guard.md`
- 선행 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` (S-1 = "spec 동기" 섹션, target 이 인수하는 위임 항목)
- 자매 aggregator: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

## 발견사항

- **[WARNING]** §7.5.1 publisher lookup key 서술이 신설 문단(1b)과 인접 기존 문단 사이에서 상충 — F-1 갭을 그대로 노출
  - target 위치: target 문서 "변경 1 — §7.5.1" §1b (`lookup 은 execution_id + status='waiting_for_input' 후 …`)
  - 관련 plan: `eia-command-waiting-surface-guard.md` "F-1. `assertNodeId` 가 실제 대기 nodeId 와 일치 검사를 안 함 — 같은 클래스, **선행 작업 필요**"
  - 상세: 실제 구현(`execution-engine.service.ts:5189 resolveWaitingNodeExecutionId`)은 `execution_id + status = WAITING_FOR_INPUT` 만으로 조회하고 `node_id` 는 필터에 쓰지 않는다(`waiting-surface-guard.ts` 의 `resolveWaitingSurface` 도 nodeId 를 받지 않음). target 의 1b 신설 문장은 이를 정확히 반영해 "execution_id + status" 만 명시한다. 그런데 같은 §7.5.1 절 상단 L1041("`nodeId → nodeExecutionId` DB lookup … `execution_id + node_id + status='waiting_for_input'`")과 L1045("nodeId 미일치")·L1054("`execution_id + node_id + status`")는 그대로 남아, node_id 가 실제로 매칭 키에 쓰이는 것처럼 계속 서술한다. 이는 F-1 이 명시적으로 지적한 pre-existing 갭("`assertNodeId` 는 존재 여부만 확인, 실제 일치 검사는 안 함")이며, target 이 정확한 신규 문장을 바로 옆에 추가함으로써 같은 절 안에 두 개의 상반된 lookup key 서술이 공존하게 된다.
  - 제안: target 의 1b 에 F-1 cross-ref 한 줄을 추가하거나(예: "node_id 자체 일치 검사는 미구현 — `eia-command-waiting-surface-guard.md` F-1 후속"), 최소한 L1041/L1054 의 "node_id" 문구를 "node_id 는 존재 확인용, 실제 매칭은 execution_id+status 단일 row 가정"으로 완화. 이번 열거-갭 정정 PR 이 §7.5.1 을 이미 편집하는 시점이라 함께 바로잡는 편이 재작업 비용이 적다.

- **[WARNING]** F-1/F-2/F-3 후속 항목이 자매 spec-sync aggregator 에 미등재 — plan 완료·아카이브 시 유실 위험
  - target 위치: target 문서 전체 (S-1 스코프에 F-1/F-2/F-3 미포함, 의도된 축소이나 후속 등재 누락)
  - 관련 plan: `eia-command-waiting-surface-guard.md` "## 후속 항목 (본 PR 범위 밖)" F-1/F-2/F-3, `spec-sync-external-interaction-api-gaps.md`(EIA 미구현 항목 aggregator), `plan/complete/spec-sync-chat-channel-gaps.md`(F-2 자연 목적지였으나 이미 complete 로 이동)
  - 상세: `eia-command-waiting-surface-guard.md` 의 S-1(spec 동기)만 target 이 인수했고, F-1(nodeId 실일치 미검증)·F-2(chat-channel 표면 불일치 graceful 안내)·F-3(외부 EIA 클라이언트 breaking-change 공지 결정)는 "본 PR 범위 밖" 으로 남았다. 이 셋은 어느 진행 중 aggregator 에도 등재돼 있지 않다 — `spec-sync-external-interaction-api-gaps.md`(F-1/F-3 자연 목적지)의 "미구현 항목" 목록에 없고, F-2 자연 목적지였을 `spec-sync-chat-channel-gaps.md` 는 이미 `plan/complete/` 로 이동해 현재 열린 목적지가 없다. `eia-command-waiting-surface-guard.md` 가 S-1(본 target) 완료 후 체크리스트 전항목 `[x]` 로 아카이브되면, F-1/F-2/F-3 를 추적할 유일한 문서가 사라진다 — "RESOLUTION 후속 이관은 committed plan 등록이 필요하다"는 선례(V-05 plan_coherence 교훈)와 동일 패턴.
  - 제안: target 커밋과 병행해 F-1·F-3 을 `spec-sync-external-interaction-api-gaps.md` "## 미구현 항목" 에, F-2 를 (a) `spec-sync-chat-channel-gaps.md` 재오픈 또는 (b) 신규 항목으로 등재. 최소한 `eia-command-waiting-surface-guard.md` 자체가 F-1/F-2/F-3 미해소 상태로는 `plan/complete/` 로 옮기지 않도록 plan lifecycle 가드 확인.

- **[INFO]** `expectedCommands` 신규 "미구현 문서 필드" disclosure — aggregator 체크리스트 미등재 (frontmatter 는 이미 충족)
  - target 위치: target 문서 "변경 2 — §6.2 payload 하단 note" 2b (`expectedCommands 는 현재 미구현 문서 필드`)
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md`
  - 상세: `14-external-interaction-api.md` frontmatter 가 이미 `status: partial` + `pending_plans: spec-sync-external-interaction-api-gaps.md` 를 갖고 있어 spec-impl-evidence R-5 가드(문서→plan 역링크 유효성)는 이 신규 disclosure 로도 위반되지 않는다. 다만 aggregator 의 "## 미구현 항목" 체크리스트 자체에는 `expectedCommands` 관련 행이 없어 discoverability 가 낮다(다른 항목들은 개별 체크박스로 추적됨).
  - 제안: 필수는 아니나, aggregator 에 짧은 항목 하나 추가 권장 (예: "`expectedCommands` 필드 실제 구현 — 서버 권장 명령 광고, 현재 문서 선언만").

## 요약
Target 은 `eia-command-waiting-surface-guard.md` S-1 이 위임한 5개 spec 위치(§7.5.1 표/서술, EIA §5.1/§6.2, Presentation §10.9, `/continue` 422, interaction-type-registry cross-ref)를 빠짐없이 반영하고 있고, 코드가 이미 검증(BLOCK:NO, ai-review Critical 0)된 동작을 신규 계약 없이 열거만 정정한다는 스코프 제한도 정확히 지켰다 — 자매 aggregator(`spec-sync-external-interaction-api-gaps.md`)의 다른 open 항목(분산 SSE fan-out, `getStatus` 일반 키-allowlist, host resetSession 가드)과도 직접 충돌은 없다. 다만 (1) 신설 1b 문단이 §7.5.1 상단의 기존 "node_id 포함 lookup key" 서술과 나란히 상충 상태로 남고 이는 정확히 F-1 이 지적한 pre-existing 갭이며, (2) eia plan 의 F-1/F-2/F-3 후속 항목이 어느 진행 중 aggregator 에도 등재되지 않아 eia plan 아카이브 시 유실 위험이 있다. 둘 다 target 자체를 되돌릴 필요는 없고 병행 갱신으로 해소 가능한 수준이다.

## 위험도
MEDIUM
