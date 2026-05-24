# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

검토 모드: `--impl-prep`
대상: `spec/5-system/15-chat-channel.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`
세션: `review/consistency/2026/05/25/01_36_06/`

---

## 전체 위험도

**MEDIUM** — WebSocket protocol spec 이 두 개의 active worktree 와 미해결 plan 에 의해 경합 중이며, 구현 범위가 해당 영역에 걸치는지에 따라 선행 조치 필요. 본 fix 범위는 envelope wrapper 보강만으로 §4.2/§4.4 wire shape 미변경 — 무관 영역으로 진행 가능.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 본 fix 영향 |
|---|---------|------|-------------|-----------|-------------|
| W1 | Plan Coherence | `6-websocket-protocol.md §4.2` 를 `workflow-resumable-execution` worktree 가 PR 미발행으로 경합 중 | §4.2 ack 계약 | `workflow-resumable-execution-6b105e/phase2-a6b133` | 영향 없음 — envelope wrapper 변경만, ack 계약 미변경 |
| W2 | Plan Coherence | `spec-drift-ws-button-config` plan 미결 — §4.4 `buttonConfig.timeout` 모순 | §4.4 buttonConfig | `plan/in-progress/spec-drift-ws-button-config.md` | 영향 없음 — buttonConfig 미수정 |
| W3 | Plan Coherence | `retry-handler-followup.md` W1~W5 spec 미반영 | §4.2 retry 흐름 | `plan/in-progress/retry-handler-followup.md` | 영향 없음 — retry 흐름 미수정 |
| W4 | Convention Compliance | `15-chat-channel.md` frontmatter `pending_plans:` 의 `chat-channel-dispatcher-split.md` 정리 | frontmatter | `plan/in-progress/` vs `plan/complete/` 양쪽 잔존 | 별 PR 책임 — plan 라이프사이클 정리 |
| W5 | Naming Collision | `R8` Rationale ID 가 EIA / Chat Channel 두 spec 에서 충돌 | `15-chat-channel.md §Rationale R8` | `14-external-interaction-api.md §Rationale R8` | 별 PR 책임 — spec rename |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 |
|---|---------|------|------|
| I1 | Cross-Spec | `CCH-AD-05`/§3.2/§7 의 "NotificationDispatcher EventEmitter" 표현이 R8 확정 구조 ("WebsocketService.executionEvents$ RxJS Subject") 와 불일치 | `15-chat-channel.md` |
| I2 | Cross-Spec | `mcpDiagnostics.serverSummaries[].status` 의 `skipped` 가 DB enum 아님을 미명시 | `11-mcp-client.md §6.2` |
| I3 | Cross-Spec | `inboundSigningRef` SoT 가시성 (현행 cross-link 유지 충분) | `15-chat-channel.md §4.1` |
| I4 | Cross-Spec | `Integration.scope` 기본값 교차 확인 권장 | `11-mcp-client.md §3.1` |
| I5 | Rationale Continuity | R8 fan-out 추상 수준 표현 차이 (EIA R10 vs CCH R8) | `15-chat-channel.md §3.2`, R8 |
| I6 | Rationale Continuity | CCH-NF-03 rate-limit 큐 vs R9 기각 running 큐 구분 미명시 | `15-chat-channel.md §3.5` |
| I7 | Rationale Continuity | `11-mcp-client.md` Rationale 절 부재 (stdio·세션풀 미도입 근거 인라인) | `11-mcp-client.md` |
| I8 | Convention Compliance | `botToken`/`inboundSigningPlaintext` DTO `@ApiProperty({writeOnly:true})` 의무 안내 부재 | `15-chat-channel.md §4.1` |
| I9 | Convention Compliance | `11-mcp-client.md`, `6-websocket-protocol.md` `## Overview` 헤더 부재 | 두 파일 §1 |
| I10 | Plan Coherence | `plan/in-progress/trigger-list-chat-channel-ui.md` — PR #283 MERGED, 미이동 | plan 라이프사이클 |
| I11 | Plan Coherence | `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` — PR #281 MERGED, 미이동 | plan 라이프사이클 |
| I12 | Plan Coherence | MERGED stale worktree 8건 로컬 잔류 | `./cleanup-worktree-all.sh --yes --force` |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | 직접 모순 없음. INFO 4건 (표현 정정 권장) |
| Rationale Continuity | LOW | 기각된 대안 재도입 없음. INFO 3건 (구조 보완) |
| Convention Compliance | LOW | WARNING 1건 (pending_plans), INFO 2건 |
| Plan Coherence | MEDIUM | §4.2/§4.4 영역 spec drift 3건 — 본 fix 범위와 무관 |
| Naming Collision | LOW | `R8` ID 충돌 1건 — 별 PR 책임 |

---

## 본 fix 의 진행 판단

5개 WARNING + 12개 INFO 가 검출됐으나 **본 PR (`fix-chat-channel-dispatcher-and-cafe24-warn`) 의 변경 범위와는 무관**:

- **변경 범위**: `WebsocketService.executionEvents$` 의 fanout envelope 에 `(triggerId, chatChannel)` routing context 자동 첨부 + `McpToolProvider.openServer` 의 비-mcp service_type silent skip
- **§4.2/§4.4 wire shape**: 변경 없음. frontend 가 받는 envelope 은 그대로 (routing context 는 fanout 전용 envelope 에만 추가).
- **W4/W5 (plan/spec 정리)**: 본 fix 와 직교한 정리 작업. 별 PR 로 분리.

→ **진행 가능**. 잔여 W/I 항목은 본 PR 의 RESOLUTION 또는 별 PR 로 추적.
