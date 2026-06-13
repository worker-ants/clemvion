# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — Warning 2건(Rationale 연속성 경계 모호 + 미사용 plan 항목 병합 후 stale화), Critical 없음

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | CCH-NF-03 큐 적재 → skip+degraded 전환 후 R9 논거가 lifecycle 전용임을 명시하지 않아 독자 혼동 가능 | `spec/5-system/15-chat-channel.md` §R9 | 원 R9 "rate-limit 큐 정책" 문구 (origin/main) | R9 첫 단락에 "(본 R9 논거는 lifecycle 케이스 전용; rate-limit 케이스는 R-CC-19 참조)" 한 문장 추가 |
| 2 | Plan Coherence | `spec-update-gap-callout-plan-links.md` 의 `14-chat-channel.md §1.1 rateLimitPerMinute` 행이 병합 후 무효화됨 (해당 worktree 미착수 상태) | `plan/in-progress/spec-update-gap-callout-plan-links.md` 21행 | `spec/data-flow/14-chat-channel.md §1.1` (worktree에서 이미 구현 완료 주석으로 대체) | target PR 병합 후 해당 행을 "해소됨"으로 표기하거나 제거 (비차단) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/1-data-model.md` `chat_channel_health` 설명이 degraded 트리거 경로 중 CCH-NF-03만 누락 | `spec/1-data-model.md` §2.8 Trigger 표 `chat_channel_health` 행 | CCH-NF-03 cross-link 추가 (기능 모순 없음) |
| 2 | Cross-Spec | `spec/data-flow/14-chat-channel.md` §1.1 sequenceDiagram에 rate-limit alt 블록 미반영 (텍스트 주석과 불일치) | `spec/data-flow/14-chat-channel.md` §1.1 | parseUpdate 직후 `alt rate-limit 초과 → 202 ignored` 블록 삽입 |
| 3 | Rationale Continuity | `spec/data-flow/14-chat-channel.md` "구현 갭" → "구현 완료" 주석 교체 — Rationale 연속성 문제 없음 | `spec/data-flow/14-chat-channel.md` §1.1 | 없음 |
| 4 | Convention Compliance | `1-auth.md` LoginHistory event 타입이 `lower_snake_case` — API surface 노출 여부 불명확 | `spec/5-system/1-auth.md §4.3` | 클라이언트 노출 시 `UPPER_SNAKE_CASE` 정규화 또는 `error-codes.md §4` 등재; 내부 전용이면 현행 유지 |
| 5 | Convention Compliance | `10-graph-rag.md` `## 1. 개요`와 `## Overview` 역할 중복 가능성 | `spec/5-system/10-graph-rag.md` | "제품 수준 요구사항" vs "기술 요약" 역할 구분 명확화 권장 |
| 6 | Convention Compliance | `11-mcp-client.md` `## Rationale` 섹션 부재 | `spec/5-system/11-mcp-client.md` | 주요 설계 결정 근거를 `## Rationale` 섹션으로 통합 이동 권장 (즉각 조치 불필요) |
| 7 | Convention Compliance | `6-websocket-protocol.md` §3.3 Rationale 절 삭제 — 본문 §3.3 존재 여부 확인 필요 | `spec/5-system/6-websocket-protocol.md` §3.3 | 본문이 잔류하면 근거 부재; 본문도 동시 삭제되었다면 정합 |
| 8 | Convention Compliance | `1-auth.md §2.3.B` Rationale에서 "기각된 대안" 문장 삭제 — 역사적 근거 소실 | `spec/5-system/1-auth.md §2.3.B` | 의도적 삭제 확인; 필요 시 Lax 기본 기각 이유를 간략히 보존 |
| 9 | Plan Coherence | `spec-sync-chat-channel-gaps.md` CCH-NF-03 항목 — worktree에서 `[x]` 갱신, 병합 시 반영됨 | `plan/in-progress/spec-sync-chat-channel-gaps.md` | 조치 불필요 |
| 10 | Plan Coherence | `auth-config-webhook-followups.md` active worktree — target 파일과 비경합 | `spec/5-system/1-auth.md` (타 worktree) | 조치 불필요 |
| 11 | Plan Coherence | `refactor-04-followups2-1de843` active worktree — target 파일과 비경합 | `spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md` | 조치 불필요 |
| 12 | Naming Collision | `CHAT_RATE_LIMIT_WINDOW_SEC` vs `MINUTE_WINDOW_SEC` — 동일 값(60초)이나 맥락 다름, 충돌 아님 | `chat-channel-rate-limiter.service.ts` vs `hooks/public-webhook-quota.service.ts` | 공통 추출 필요 시 v2 후속으로 `RATE_LIMIT_MINUTE_SEC` 통일 검토 |
| 13 | Naming Collision | Redis 키 접두사 혼재: `cc:rl:` vs `chat-channel:` (같은 도메인) | `chat-channel-rate-limiter.service.ts` vs `channel-conversation.service.ts` | 기능 충돌 없음; 단일 prefix 규약 채택 시 `spec/conventions/chat-channel-adapter.md §2` 또는 `data-flow/14-chat-channel.md §1`에 Redis 키 패턴 표 명시 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 기능 모순 없음. `spec/1-data-model.md` CCH-NF-03 cross-link 누락·data-flow 다이어그램 미갱신이 INFO급으로 발견됨 |
| Rationale Continuity | LOW | CCH-NF-03 큐→skip 전환 시 R-CC-19 신설로 연속성 갱신 이행됨. R9 논거 경계 명확화가 WARNING 잔류 |
| Convention Compliance | NONE | CRITICAL·WARNING 없음. INFO 5건 모두 Rationale 정보 완결성 또는 명명 스타일 권장 사항 |
| Plan Coherence | LOW | 파일 경합 없음. `spec-update-gap-callout-plan-links.md` 내 병합 후 무효화될 항목이 WARNING |
| Naming Collision | NONE | 신규 식별자 의미 충돌 없음. Redis 키 접두사 혼재가 INFO급 (기능 충돌 없음) |

## 권장 조치사항

1. **(WARNING 해소 — 권장)** `spec/5-system/15-chat-channel.md` §R9 첫 단락에 "본 R9 논거는 lifecycle 케이스 전용이며 rate-limit 케이스는 R-CC-19 참조" 한 문장 추가 — 두 Rationale 경계 명확화.
2. **(WARNING 해소 — 병합 후)** target PR 병합 후 `plan/in-progress/spec-update-gap-callout-plan-links.md` 21행(`14-chat-channel.md §1.1 rateLimitPerMinute`)을 "해소됨" 표기 또는 제거.
3. **(INFO — 후속)** `spec/1-data-model.md` §2.8 `chat_channel_health` 행에 CCH-NF-03 cross-link 추가.
4. **(INFO — 후속)** `spec/data-flow/14-chat-channel.md` §1.1 sequenceDiagram에 rate-limit `alt` 블록 삽입.
5. **(INFO — 확인)** `spec/5-system/6-websocket-protocol.md` §3.3 Rationale 삭제가 본문 §3.3 동시 삭제와 동반되었는지 확인; 본문 잔류 시 Rationale 복원 또는 이유 명시.