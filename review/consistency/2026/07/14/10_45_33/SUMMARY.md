# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — 확보된 checker(convention_compliance, naming_collision) 기준 Critical 없음. cross_spec/rationale_continuity/plan_coherence 3개는 success 보고이나 output 파일 미생성(known FS-write flakiness, 3회 연속 관측), `unfinished:[]`.

scope: spec/4-nodes/3-ai/ + 코드 diff vs origin/main.

## 전체 위험도: LOW (Critical 0, WARNING 2, INFO 1)

## WARNING (spec 문서 정정 — 코드 무관)
- **W1 (convention_compliance)**: §4.2 "런타임 판정 위치" 마지막 문장이 fix **이전** 상태("single-turn 은 try/catch 없음")를 서술 → 구현 후엔 single-turn(`buildSingleTurnToolsOrError`)이 throw 를 try/catch 로 흡수해 §7.3 output 직접 반환, multi-turn 이 throw 를 orchestrator 로 전파(`extractAiTurnErrorPayload` 조립). 최종 계약(error 포트 귀결) 동일 → WARNING. → 문장 정정.
- **W2 (convention_compliance)**: §10 "저장 시점 예산 경고" 단락이 config-time graph warning 을 현재형으로 서술하나 미구현(Planned) — `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 코드 참조 0. cross-node-warning-rules §8 은 "⚠ Planned" 명시. → §10 단락에 `0-common.md §8` 관행의 "⚠ 미구현(Planned)" 인라인 마커 추가.

## INFO
- I1 (convention_compliance): §5.8 cross-ref 2건이 절 anchor 없이 파일 최상단 링크 → `#42-…`/`#10-에러-코드` anchor 추가(선택).

## Checker별
| Checker | 상태/위험도 |
|---------|------|
| cross_spec | 재시도 필요 (output 미생성) |
| rationale_continuity | 재시도 필요 (output 미생성) |
| convention_compliance | LOW — §4.2 서술/§10 Planned 마커 (그 외 에러코드·rule id·env·frontmatter 전부 정합) |
| plan_coherence | 재시도 필요 (output 미생성) |
| naming_collision | NONE — 에러코드/env 4종/함수·클래스/rule id/절번호/경로 전수 무충돌. 이전 2라운드 지적(env 명명·에러코드 축·i18n 사각지대) 최종본 전량 반영 재확인 |

## 판정: BLOCK NO → WARNING 2 + INFO 1 은 spec 문서 정정으로 종결(코드 무관, review guard 재무장 없음).
