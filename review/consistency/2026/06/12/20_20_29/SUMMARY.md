# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

---

## 전체 위험도

**LOW** — Critical/Warning 수준의 규약 위반 또는 spec 모순 없음. Warning 4건(plan 상태 불일치 2건 + spec 구 메서드명 잔류 1건 + error-codes stale 위험 1건)은 즉각 차단 사유가 아니나 후속 정리 권장.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Naming Collision | `isActiveExecution` 구 메서드명이 spec 에 잔류 — 코드에서는 `getActiveExecutionStatus` 로 대체 완료됐으나 spec 참조가 stale | `spec/4-nodes/7-trigger/providers/telegram.md:190` | `codebase/backend/src/modules/hooks/hooks.service.ts` (`isActiveExecution` 삭제됨) | `telegram.md:190` 해당 셀을 `getActiveExecutionStatus` 로 갱신하거나 "비-terminal status null 반환" 설명으로 교체 |
| W2 | Plan Coherence | `spec-sync-webhook-gaps.md` 에 동일 갭("비활성 chatChannel 트리거의 202+{ignored:true} 분기") 이 여전히 `[ ]` 미완료로 남아 plan 간 상태 불일치 | `plan/in-progress/spec-sync-webhook-gaps.md` (첫 번째 항목) | `plan/in-progress/spec-sync-chat-channel-gaps.md §5.5` (`[x]` 완료) | `spec-sync-webhook-gaps.md` 해당 항목을 `[x]` 로 닫고 "spec-sync-chat-channel-gaps.md 에서 동시 해소 확인됨 (2026-06-12)" 주석 추가 |
| W3 | Plan Coherence | `auth-config-webhook-followups.md §2` 동일 갭("chatChannel 트리거 + isActive=false 처리 순서") 이 미착수로 열려 있어 plan 중복 추적 미해소 | `plan/in-progress/auth-config-webhook-followups.md §2` | `plan/in-progress/spec-sync-chat-channel-gaps.md §5.5` (`[x]` 완료) | `auth-config-webhook-followups.md §2` 에 "chat-channel-gaps-e5e3e8 PR 에서 해소됨 (2026-06-12)" 주석 추가 및 완료 표기 |
| W4 | Convention Compliance | `1-auth.md §1.5.4` historical-artifact 예외 설명이 `error-codes.md §3` 레지스트리를 cross-link 하나, `error-codes.md` 가 변경될 경우 stale 위험 | `spec/5-system/1-auth.md §1.5.4` 주석 | `spec/conventions/error-codes.md §3` | `1-auth.md §1.5.4` 주석에 "SoT: `error-codes.md §3`" 를 명시적으로 강조. 강제 위반 아님 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/0-overview.md §6.1` 에 Chat Channel 이 Webhook 변형임을 안내하는 문구 부재 — 모순은 아님 | `spec/0-overview.md §7` | 용어 정의 항목에 "Chat Channel = Webhook 트리거의 `config.chatChannel` 옵션" 한 줄 부기 고려 (필수 아님) |
| I2 | Cross-Spec | `team_invite` 알림 발송 시점·채널의 명시 부재 — `1-auth.md §1.5` 와 `Notification.type` 간 관계 불명확 | `spec/5-system/1-auth.md §1.5` 또는 `spec/data-flow/8-notifications.md` | `team_invite` 알림의 발송 시점·채널 명시 권장 (현재 충돌 없음) |
| I3 | Cross-Spec | `AuditLog.action` SoT 가 `audit-action.const.ts` 와 `data-flow/1-audit.md §1.1` 양쪽에 분산 언급 | `spec/5-system/1-auth.md §4.1` | `data-flow/1-audit.md §1.1` 에 `user.*` 시제 정규화 결과 반영 권장 (필수 아님) |
| I4 | Convention Compliance | `10-graph-rag.md` 이중 Overview 구조 — `## Overview (제품 정의)` + `## 1. 개요` 재개설로 3섹션 경계 모호 | `spec/5-system/10-graph-rag.md` L684, L861 | `## Overview` 를 1-2문단 요약으로 축소하거나 본문 섹션으로 통합 |
| I5 | Convention Compliance | `11-mcp-client.md` Overview 섹션 없이 `## 1. 개요` 로 직접 시작 (권장 3섹션 미준수) | `spec/5-system/11-mcp-client.md` L21 | `## Overview` 요약 섹션 추가 또는 conventions 에 예외 명시 |
| I6 | Convention Compliance | `10-graph-rag.md §6` `document:graph_error` 가 dead-declared 이지만 코드에 잔류 | `spec/5-system/10-graph-rag.md §6` | 코드 정리 트랙에서 dead symbol 제거 및 spec 이벤트 표에서 삭제 |
| I7 | Convention Compliance | `spec/conventions/cafe24-api-catalog/application.md` `## 표` 섹션명이 `_overview.md` 에 정식 명시 없음 | `spec/conventions/cafe24-api-catalog/application.md` L16 | `_overview.md §1` 에 인덱스 파일 섹션 구조 정식 명시 또는 현행 묵시적 합의 유지 |
| I8 | Naming Collision | `executionStillRunning` 키가 `language-hint-defaults.ts` 에 EN default 없이 인라인 KO 하드코딩 — 다른 키와 일관성 미흡 | `codebase/backend/src/modules/hooks/hooks.service.ts:835` | `language-hint-defaults.ts` 에 `EXECUTION_STILL_RUNNING_DEFAULTS` 상수 추출, 또는 spec §4.1.1 에 "EN 기본값 미제공 — KO fallback 고정" 정책 명시 |
| I9 | Plan Coherence | CCH-NF-03 가 잔여 항목으로 남아 있는 상태에서 spec 에 구현된 것처럼 서술되지 않는지 확인 필요 | `spec/5-system/15-chat-channel.md` CCH-NF-03 관련 섹션 | spec 담당자가 CCH-NF-03 표기를 점검 — plan-lifecycle 상 잔여 항목이 있는 plan 은 `in-progress/` 유지 (정상) |
| I10 | Plan Coherence | stale worktree 2개 (`chat-channel-followups-residual-1be5d3`, `refactor-04-security-286de9`) 가 main 흡수 후 정리되지 않음 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `Trigger.type`, `WebAuthnCredential`, Graph RAG KnowledgeBase 컬럼, MCP Client `auth_type` 등 전 교차 검토에서 직접 모순 없음. INFO 수준 안내 보강 권고 다수 |
| Rationale Continuity | NONE | CCH-CV-03 (b) 분기는 R9 채택 원칙과 정확히 일치. rotate-bot-token 응답 3필드 추가는 예약된 Planned 사항 구현 완료. 기각 대안 재도입 없음 |
| Convention Compliance | LOW | `1-auth.md §1.5.4` historical-artifact 주석 stale 위험 (W4). 문서 구조 INFO 3건(이중 Overview, Overview 누락, dead symbol). 규약 직접 위반 없음 |
| Plan Coherence | LOW | `spec-sync-webhook-gaps.md` + `auth-config-webhook-followups.md §2` plan 간 상태 불일치 WARNING 2건. CRITICAL 급 미해결 결정 우회 없음 |
| Naming Collision | LOW | `isActiveExecution` 구 메서드명 spec 잔류 WARNING 1건 (W1). 신규 식별자 3종 명명 충돌 없음. `executionStillRunning` EN default 미제공 INFO 1건 |

---

## 권장 조치사항

1. **(W1 — spec 오류 수정, 우선)** `spec/4-nodes/7-trigger/providers/telegram.md:190` 의 `isActiveExecution` 을 `getActiveExecutionStatus` 로 갱신 — 코드와 spec 참조 동기화.
2. **(W2 — plan 정합)** `plan/in-progress/spec-sync-webhook-gaps.md` 의 "비활성 chatChannel 트리거의 202+{ignored:true} 분기" 항목을 `[x]` 완료로 닫고 "spec-sync-chat-channel-gaps.md 에서 동시 해소 확인됨 (2026-06-12)" 주석 추가.
3. **(W3 — plan 정합)** `plan/in-progress/auth-config-webhook-followups.md §2` 에 "chat-channel-gaps-e5e3e8 PR 에서 해소됨 (2026-06-12)" 주석 추가 및 완료 표기.
4. **(W4 — 권고)** `spec/5-system/1-auth.md §1.5.4` 주석에 "SoT: `error-codes.md §3`" 명시 강화 (선택적).
5. **(I8 — 선택적)** `executionStillRunning` 키의 EN default 상수화 또는 spec §4.1.1 에 "KO fallback 고정" 정책 명시.
6. **(I10 — 선택적)** stale worktree 2개 정리: `./cleanup-worktree-all.sh --yes --force`.