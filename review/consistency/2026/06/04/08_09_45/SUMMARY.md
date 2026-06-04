# Consistency Check (--impl-done, v2 멀티턴 물리압축) 통합 보고서

**BLOCK: NO** — Critical 0. 메모리 기능 spec-impl 정합 결함 0.

전체 위험도 MEDIUM. WARNING 2건은 **information-extractor 의 pre-existing 결함**(본 v2 변경 무관),
INFO 7건은 드리프트 예방 보완(경미).

## WARNING (둘 다 본 변경 무관 — pre-existing)
- W-1: `information-extractor.md` `config.schema` vs `outputSchema` 명명 불일치 — **문서가 §8 에서 스스로
  "알려진 결함 W-1" 로 자인한 pre-existing 이슈**. 본 v2(멀티턴 물리압축) 변경과 무관. (information-extractor 소관)
- W-2: 위 W-1 추적 plan 미등록 — 동일 결함 파생, 동 소관.

## INFO (경미 — followup-v2 백로그)
- I-7: `meta.memory.compactedMessages` 가 ND-AG-30 열거에 미포함(drift만, 충돌 아님).
- I-2: `0-common §10` 표 "AI Agent 한정" 명시.
- I-1: text_classifier/extractor config 표에 excludeFromConversationThread 행.
- 기타 I-3~I-6: 선택적 보완.

## Checker별 위험도
| Checker | 위험도 |
|---|---|
| Cross-Spec | LOW (INFO만) |
| Rationale Continuity | NONE |
| Convention Compliance | MEDIUM (W-1/W-2 = pre-existing information-extractor, 본 변경 무관) |
| Plan Coherence | NONE (active worktree 실질 경합 0 — kb-quality 충돌 재발 없음) |
| Naming Collision | NONE (compactedMessages PRD 열거 누락 1 INFO) |

## 결정
**BLOCK: NO**. 본 v2(멀티턴 물리압축)의 spec-impl 정합 결함 0. WARNING 2건은 information-extractor
pre-existing(무관). INFO 는 followup-v2 백로그.
