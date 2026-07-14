# Plan 정합성 검토 — spec/5-system/4-execution-engine.md (--impl-done)

## 검토 범위 및 방법

- target: `spec/5-system/4-execution-engine.md` (§7.5.1 Publisher 측 사전 검증 중심)
- 관련 구현 diff: `execution-engine.service.ts`(F-1/F-6 nodeId 가드), `interaction.service.ts`,
  `websocket.gateway.ts`, `hooks.service.ts`(F-2/F-4 안내 발송), `language-hint-defaults.ts`/
  `markdown-v2.ts`(F-5), `chat-channel-config.dto.ts`(F-5 DTO 검증) — 모두
  `plan/in-progress/eia-command-waiting-surface-guard.md` 소속.
- 확인: 해당 plan 문서(`plan/in-progress/eia-command-waiting-surface-guard.md`, 210줄)를 직접
  Read. **F-1 / F-2 / F-3 / F-4 / F-5 / F-6 전 항목의 체크박스가 예외 없이 `[x]`** 이며, 각 항목
  끝에 "**완료 (2026-07-14)**" 표기. 잔여 서술은 전부 "**미채택(백로그)**"/"**스코프 밖(검토 중
  명시)**" 라벨의 비차단 backlog 메모(체크박스 아님) — 사용자가 확인한 상태와 일치.
- `plan/in-progress/**` 전체(29개 파일) 중 `expectedNodeId` / `resolveWaitingNodeExecutionId` /
  `assertNodeId` / `surfaceMismatch` / `STATE_MISMATCH` / `§7.5.1` 식별자를 참조하는 다른 plan은
  `eia-command-waiting-surface-guard.md` 자신뿐 (grep 전수 확인) — 교차 참조 충돌 없음.
- 인접 후보 plan(`execution-engine-residual-gaps.md` G1/G2/G3, `spec-sync-external-interaction-api-gaps.md`,
  `spec-sync-websocket-protocol-gaps.md`, `chat-channel-discord-gateway.md`,
  `chat-channel-slack-socket-mode.md`)을 개별 확인 — 모두 다른 축(SIGTERM grace-shutdown,
  outbound rate-limit/분산 SSE, WS 미구현 이벤트, Discord Gateway/Slack Socket Mode 착수 조건)이라
  본 변경과 무관.
- target frontmatter `pending_plans: [execution-engine-residual-gaps.md, exec-intake-followups.md]`
  — `eia-command-waiting-surface-guard.md` 는 애초에 여기 등재된 적이 없고(별도 plan), 전체 완료
  상태와도 정합(추가 pending 유발 없음).
- target 본문 §7.5.1 (nodeId 불일치 행 + "nodeId 검사 진입점별 커버리지" 표: EIA `/interact`
  적용 / `in_process_trusted` 면제 / WS `execution.*` 적용(F-6, nodeId 제공 시) / REST `/continue`
  미적용)이 diff 의 실제 구현(F-1 4종 continue* expectedNodeId 스레딩, F-6 WS gateway 3-handler
  forwarding)과 문자열 수준으로 대응 — spec 과 코드 간 새 괴리 없음.

## 발견사항

없음. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 쪽도 발견되지 않았다.

- **[INFO]** plan 완료 이동 검토 권장
  - target 위치: (해당 없음 — plan 문서 자체에 대한 절차 메모)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md`
  - 상세: `.claude/docs/plan-lifecycle.md §3` "모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는
    PR 안에 `complete/` 로 이동" 기준을 이 plan이 충족한다(F-1~F-6 전 체크박스 `[x]`, 잔여는 전부
    비차단 backlog 메모). Stop hook 의 plan-complete nudge 대상이기도 하다.
  - 제안: 본 PR(또는 이 turn 이 속한 PR)에 `chore(plan): mark eia-command-waiting-surface-guard
    complete` 커밋으로 `plan/complete/` 이동 + `spec_impact` frontmatter 필드 선언을 함께 처리할
    것을 권장. 정합성 위반은 아니므로 BLOCK 사유는 아니다.

## 요약

`spec/5-system/4-execution-engine.md` §7.5.1 의 이번 갱신(nodeId 불일치 검증 + 진입점별 커버리지
표)은 `plan/in-progress/eia-command-waiting-surface-guard.md` 의 F-1/F-6 완료 내역과 정확히
대응하며, F-2/F-3/F-4/F-5 도 각자의 spec 반영(chat-channel §4.1/§4.1.1, telegram.md, CHANGELOG)이
체크리스트에 완료로 기록돼 있다. plan 전체 체크박스가 `[x]` 이고 잔여는 사용자가 이미 확인한 대로
비차단 미채택 백로그뿐이라, 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 어느 카테고리에서도
문제를 찾지 못했다. `plan/in-progress/**` 나머지 28개 문서를 grep/발췌 확인한 결과 이번 변경(nodeId
가드, surfaceMismatch 안내, MarkdownV2 raw-send 검증)과 충돌하거나 이를 전제로 하는 미해결 항목도
없다. 유일한 관찰은 절차적 INFO(plan 완료 이동 시점 도래)이며 BLOCK 사유는 아니다.

## 위험도

NONE
