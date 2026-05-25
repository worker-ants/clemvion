BLOCK: NO

# Consistency Check 통합 보고서

**위험도**: MEDIUM — Critical 없음. WARNING 5건은 모두 기존 plan(`spec-drift-ws-button-config.md` C2·C3, `multiturn-error-preserve.md`)에서 이미 추적 중이거나 target spec 의 내부 문서 정리 항목으로, 본 PR 의 구현 (`waitForAiConversation` else 분기 `button_click` graceful 처리) 과 직접 충돌하지 않는다.

## 본 구현 영향 평가

본 PR 변경 영역은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `waitForAiConversation` 의 else 분기. spec SoT 는 `spec/4-nodes/6-presentation/0-common.md §10.9` line 400/401/407 (button_click enum-complete graceful degradation 명시).

5 checker 모두 본 변경 영역에 대해 충돌 없음 보고. 발견된 WARNING / INFO 는 별도 plan 으로 추적 중이거나 본 PR 와 무관한 문서 구조 항목.

## Critical 위배 (BLOCK 사유)

없음.

## WARNING (5건 — 모두 별도 plan 으로 처리)

| # | 위배 | target | 관련 plan |
|---|------|--------|-----------|
| W1 | "무제한 대기" vs "선택적 타임아웃" — `0-common.md §3·§6.1` vs `_product-overview.md ND-CL-07 등` + WS spec §4.4 | `0-common.md §3·§6.1` | `spec-drift-ws-button-config.md` C2 |
| W2 | Principle 1.1.4 위반 — WS spec §4.4 `buttonConfig.nodeOutput: {type: "carousel"}` 잔존 | `0-common.md §4` | `spec-drift-ws-button-config.md` C3 |
| W3 | `config.buttonConfig` 배치 근거 Rationale 미기재 | `0-common.md §3·§7` | (없음) — 별도 spec 보강 항목 |
| W4 | 섹션 번호 순서 역전 (`§9 CHANGELOG` 가 `§10 AI Tool` 보다 앞) | `0-common.md` | (없음) — 문서 정리 |
| W5 | `## 4.6` heading 레벨 (H2 vs 형제 H3) | `0-common.md` line 135 | (없음) — 문서 정리 |

## INFO (9건 — 권고)

- I1: `## Overview` 섹션 부재
- I2: frontmatter `id: common` 중복 (다른 5개 공통 문서 동일 패턴)
- I3: frontmatter `status: spec-only` 가 실제 구현과 불일치
- I4: `interaction.data` shape vs `spec/1-data-model.md §2.14 interaction_data` 필드 집합 불일치
- I5: `__continue__` 특수 ID 가 WS spec §4.2 에 미기술
- I6: `_product-overview.md ND-CL-08` globalButtons cap 미언급
- I7: `multiturn-error-preserve.md` 영향 spec 표에 `0-common.md §10.9` cross-ref 추가 권고
- I8: `ai-agent-tool-connection-rewrite.md` 확정 시 `0-common.md §10` cross-ref stale 잠재
- I9: stale worktree 3건 정리 권고

## Checker 별 위험도

| Checker | 위험도 |
|---------|--------|
| Cross-Spec | MEDIUM |
| Rationale-Continuity | MEDIUM |
| Convention-Compliance | MEDIUM |
| Plan-Coherence | MEDIUM |
| Naming-Collision | NONE |

## 결정

**BLOCK: NO** — 본 PR 구현 진행 허용. 발견된 WARNING 들은 모두 별도 plan 으로 추적 중 (`spec-drift-ws-button-config.md`) 이거나 target spec 내부 문서 정리 항목 (W3·W4·W5)이며, 본 PR 의 `waitForAiConversation` graceful button_click 처리와 직접 충돌하지 않는다.

본 PR 의 변경은 spec `0-common.md §10.9` line 407 의 "graceful degradation" 명시 의도 그대로 구현 (button_click → warn + loop 재진입, MAX_UNKNOWN_SKIPS 제외). 새 dispatch 분기 도입이나 spec 위배 없음.
