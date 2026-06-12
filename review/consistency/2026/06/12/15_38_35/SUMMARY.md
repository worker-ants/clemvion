# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

## 전체 위험도
**LOW** — 모든 5개 checker 에서 Critical/BLOCK 수준 위배 없음. 유일한 실질적 비일치는 `spec/5-system/11-mcp-client.md §3.1` Internal Bridge 표에서 `makeshop` 행 누락 (INFO). 나머지는 모두 문서 표기 정합 또는 추적 메모 수준.

## Critical 위배 (BLOCK 사유)

_없음_

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/5-system/10-graph-rag.md` 의 `## Overview (제품 정의)` 섹션이 문서 최상단이 아닌 `---` 구분선 뒤에 위치하며 이후 `## 1. 개요` 가 다시 등장하는 이중 구조 — 다른 domain 문서 구조와 불일치 | `spec/5-system/10-graph-rag.md` line 684 | CLAUDE.md §정보 저장 위치 (3섹션 권장 구조) | 규약이 권장 수준이므로 차단 아님. 신규 문서 작성 시 `## Overview` → 본문 → `## Rationale` 순서 명시적 준수 권장; 또는 혼재 용인을 Rationale 에 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/11-mcp-client.md §3.1` Internal Bridge 표에 `makeshop`(`MakeshopMcpToolProvider`) 행 누락 — §2.3 본문·`spec/1-data-model.md §2.10`·`spec/0-overview.md §6.1` 모두 makeshop 구현 완료 명시 | `spec/5-system/11-mcp-client.md §3.1` | `spec/1-data-model.md §2.10`, `spec/0-overview.md §6.1`, `spec/5-system/11-mcp-client.md §2.3` 와 불일치 | `§3.1` 표에 `makeshop` / `MakeshopMcpToolProvider` / `[Spec MakeShop 노드 §8]` 행 추가 |
| 2 | Cross-Spec | `spec/5-system/1-auth.md §5` `resend-verification` 설명 "(24h 유효)" 가 §1.1 표에는 없음 | `spec/5-system/1-auth.md §5` | `spec/5-system/1-auth.md §1.1` | §1.1 에도 "24h 유효" 동기화하거나 §5 에서 해당 언급 제거 |
| 3 | Cross-Spec | `spec/5-system/1-auth.md §4.1` `model_config.*` 감사 액션의 SoT 위치 불명확 (auth.md vs data-flow/1-audit.md) | `spec/5-system/1-auth.md §4.1` | `spec/1-data-model.md §2.16`, `spec/0-overview.md §6.1` | 향후 `model_config.*` 구현 시 SoT 명확화 cross-reference 추가 |
| 4 | Rationale Continuity | `spec/5-system/15-chat-channel.md` `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED` 변경에 대한 Rationale 주석 부재 | `spec/5-system/15-chat-channel.md §5.4` | `spec/5-system/3-error-handling.md §1.3` | Rationale 에 "옛 `401 WORKSPACE_REQUIRED` 는 controller 인라인 코드였으며, `@WorkspaceId()` 데코레이터 이관 후 canonical `400 WORKSPACE_ID_REQUIRED` 로 통일됨" 한 줄 추가 |
| 5 | Convention Compliance | `spec/5-system/15-chat-channel.md` `WORKSPACE_REQUIRED`(401)→`WORKSPACE_ID_REQUIRED`(400) 가 spec 오기 수정인지 코드베이스 동반 수정인지 명시 없음 | `spec/5-system/15-chat-channel.md §5.4` | `spec/conventions/error-codes.md §2` (breaking change 절차) | spec 에 "spec 오기 수정 (코드베이스는 이미 `WORKSPACE_ID_REQUIRED` 발행)" 한 줄 주석; 만약 실제 발행 코드 변경이었다면 `error-codes.md §5 Rename 이력` 등재 |
| 6 | Plan Coherence | `spec-sync-audit` worktree stale (PR #443, #440 merged), `spec-sync-chat-channel-gaps.md` frontmatter `worktree: spec-sync-audit` 가 stale 참조. `code-node-followups-close`, `code-node-followups-finalize` 도 stale | `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter | 해당 plan frontmatter | `cleanup-worktree-all.sh --yes --force` 후 frontmatter `worktree` 필드 정리 |
| 7 | Convention Compliance | `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 4개 경로 실존 여부 — diff 미변경이나 `spec-pending-plan-existence.test.ts` 가드 대상 | `spec/5-system/15-chat-channel.md` frontmatter | `spec/conventions/spec-impl-evidence.md §4` | build-time 테스트가 강제하므로 별도 조치 불필요; plan 완료 시 frontmatter 동기화 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `11-mcp-client.md §3.1` makeshop 행 누락(INFO), 나머지 모두 INFO 수준 표기 비일치 |
| Rationale Continuity | NONE | 3개 변경 모두 기존 Rationale 원칙과 정합. `401→400` 변경 Rationale 주석 부재만 INFO |
| Convention Compliance | LOW | `10-graph-rag.md` Overview/본문 이중 구조 WARNING(권장 위반, 차단 아님); `15-chat-channel.md` 변경은 모두 규약 준수 |
| Plan Coherence | NONE | target 변경이 소유 plan 체크리스트에 대응. stale worktree 3건 cleanup 권장(INFO) |
| Naming Collision | NONE | 3개 식별자 변경 모두 기존 사용처와 충돌 없음, canonical 정의와 완전 정합 |

## 권장 조치사항
1. (INFO — 문서 동기화) `spec/5-system/11-mcp-client.md §3.1` 표에 `makeshop` / `MakeshopMcpToolProvider` / `[Spec MakeShop 노드 §8]` 행 추가 — §2.3 본문·data-model·overview 와 정합
2. (INFO — Rationale 보완) `spec/5-system/15-chat-channel.md` Rationale 에 `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED` 변경 경위 한 줄 주석 추가
3. (INFO — stale cleanup) `spec-sync-audit`, `code-node-followups-close`, `code-node-followups-finalize` worktree cleanup + `spec-sync-chat-channel-gaps.md` frontmatter `worktree` 필드 정리
4. (WARNING — 비필수) `spec/5-system/10-graph-rag.md` Overview/본문 이중 구조 정리 또는 혼재 용인 Rationale 명시 (규약이 권장 수준이므로 즉각 수정 의무 없음)
5. (INFO — 선택) `spec/5-system/1-auth.md §1.1` 에 "24h 유효" 유효기간 동기화