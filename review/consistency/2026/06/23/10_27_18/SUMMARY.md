# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 즉각적인 차단 사유 없음.

검토 모드: --impl-done
검토 대상: M-8 2단계 — trigger-detail-drawer god-component 카드 파일 분리 + hooks 추출
검토 범위: spec/2-navigation (diff-base=origin/main)

---

## 전체 위험도
**LOW** — Critical 0건, Warning 2건(모두 spec 변경 필요 → project-planner 위임 사안), Info 7건. 구현 자체는 Rationale·Plan·Naming 세 checker 에서 NONE(위험도 없음) 판정. 차단 사유 없음.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/2-navigation` 8개 문서에 `## Overview` 섹션 누락 (3섹션 권장 구조 미준수) | `spec/2-navigation/0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `15-system-status.md`, `16-agent-memory.md` | CLAUDE.md "정보 저장 위치" 권장 3섹션(Overview/본문/Rationale), `14-execution-history.md` 기준 패턴 | 각 파일 상단에 `## Overview` 섹션 추가. spec 변경 → project-planner 위임. |
| 2 | Convention Compliance | `AUTH_CONFIG_NOT_FOUND` 에러 코드가 공식 에러 카탈로그 미등재 | `spec/2-navigation/2-trigger-list.md §3 API` (`PATCH /api/triggers/:id` 설명) | `spec/5-system/3-error-handling.md §1.1` 공식 에러 코드 카탈로그 | `3-error-handling.md §1.1` 또는 `§1.3` 에 `AUTH_CONFIG_NOT_FOUND \| AuthConfig 리소스 부재 또는 워크스페이스 불일치 \| 404` 등재. spec 변경 → project-planner 위임. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/2-navigation/2-trigger-list.md` `code:` 글로브가 신규 서브디렉터리(`cards/`, `hooks/`) 미포함 | `spec/2-navigation/2-trigger-list.md` frontmatter `code:` | `code:` 에 `codebase/frontend/src/components/triggers/cards/*.tsx`, `hooks/*.ts`, `lib/api/triggers.ts` 추가 또는 글로브를 `**/*.tsx` 로 확장. 가드 현재 통과 중. |
| 2 | Cross-Spec | `spec/conventions/user-guide-evidence.md` `ImplAnchor` 예시 `file` 경로가 `ChatChannelCard` 정의 파일과 분리 | `spec/conventions/user-guide-evidence.md` L118–119 | `file` 값을 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 로 갱신 권고. 가드 통과 중, 우선순위 낮음. |
| 3 | Cross-Spec | 상위 spec 3개(`15-chat-channel.md`, `slack.md`, `discord.md`) `code:` 에 `chat-channel-card.tsx` 미등재 (orphan 파일) | `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/slack.md`, `discord.md` frontmatter | 해당 spec `code:` 에 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 추가. 다음 spec 갱신 PR 포함 권장. |
| 4 | Plan Coherence | spec `2-trigger-list.md §2.3.1` Auth Config 독립 카드 행(6카드)과 현 구현(5카드) gap 미확정 | `spec/2-navigation/2-trigger-list.md §2.3.1` | project-planner 가 5카드 behavior-preserving 유지를 spec 에 명시 확정. |
| 5 | Plan Coherence | spec Rationale R-2 TBD 구절이 R-14 채택 후에도 cleanup 안 됨 | `spec/2-navigation/2-trigger-list.md` Rationale R-2 | R-2 에 "R-14 채택으로 v1.1 예약 폐기 — TBD 항목 소멸" 주석 추가. project-planner 위임. |
| 6 | Convention Compliance | `spec/2-navigation/10-auth-flow.md §2` 하위 섹션 번호 역전 (§2.6 이 §2.5 앞에 배치) | `spec/2-navigation/10-auth-flow.md` L482–L505 | §2.4 → §2.5 → §2.6 순서 재배치 또는 renumber. |
| 7 | Naming Collision | impl-prep 시점 WARNING 3건(`OverviewCard` 이중 정의, `TYPE_BADGE_STYLES` 중복, query key 이중 관리) — 구현에서 전부 해소됨 | `codebase/frontend/src/components/triggers/` | 조치 불필요. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec `code:` 글로브 outdated (3건 INFO). 가드 현재 통과, 역방향 커버리지 gap. |
| Rationale Continuity | NONE | R-4~R-16 전 항목 정합. 기각 대안 재도입 없음. |
| Convention Compliance | LOW | Overview 섹션 누락(W-1), AUTH_CONFIG_NOT_FOUND 카탈로그 미등재(W-2). spec 수정 사안. |
| Plan Coherence | NONE | 5카드 behavior-preserving 선택 plan 에 명시 완료. 미해결 결정 우회 없음. |
| Naming Collision | NONE | impl-prep WARNING 3건 전부 해소. 신규 exported 식별자 7종 충돌 없음. |

---

## 권장 조치사항

1. **(BLOCK 사유 없음)** 이번 구현은 즉시 통과 가능.
2. **(project-planner 위임 — spec 갱신)** `spec/5-system/3-error-handling.md` 에 `AUTH_CONFIG_NOT_FOUND` 등재 (W-2).
3. **(project-planner 위임 — spec 갱신)** `spec/2-navigation` 문서들 `## Overview` 섹션 일괄 추가 (W-1, `14-execution-history.md` 패턴 참조).
4. **(spec 동기화 backlog)** `2-trigger-list.md` frontmatter `code:` 글로브 확장 + 상위 spec 3개(`15-chat-channel.md`, `slack.md`, `discord.md`) `code:` 에 `chat-channel-card.tsx` 추가 (INFO #1, #3).
5. **(spec 동기화 backlog)** Rationale R-2 TBD cleanup + `§2.3.1` 5카드 확정 명시 (INFO #4, #5).
6. **(낮은 우선순위)** `10-auth-flow.md` 섹션 번호 재배치 및 `user-guide-evidence.md` 예시 경로 갱신 (INFO #6, #2).