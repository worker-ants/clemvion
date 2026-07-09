# Rationale 연속성 검토 — spec-draft-eh-detail-06-id-split.md

## 발견사항

- **[INFO]** ID 분리가 과거 "저위험 판정"을 정식으로 번복하는 지점 — Rationale 에 그 계보를 남기면 추적성이 강화됨
  - target 위치: `plan/in-progress/spec-draft-eh-detail-06-id-split.md` `## Rationale` "왜 (b) 분리 vs (a) 각주만"
  - 과거 결정 출처: `review/consistency/2026/06/05/09_58_17/naming_collision.md` `[INFO] EH-DETAIL-06 요구사항 ID 재사용` (결론: "의미 확장이지 재정의 아님… 강제 수정 불필요") 및 `review/consistency/2026/06/11/09_39_57`·`2026/06/11/10_32_41` 의 동일 취지 INFO(무해 cross-reference 판정)
  - 상세: 이 세 건은 spec 문서 `## Rationale` 은 아니고 소모성 검토 산출물(`review/consistency/**`)이라 본 체크리스트의 "spec Rationale 기각/번복" 엄격 정의에는 해당하지 않는다. 다만 같은 ID 재사용 패턴을 과거엔 "무해·수정 불필요"로 3차례 판정했다가, 이번 cross_spec(2026-07-09, `review/consistency/2026/07/09/11_31_49/cross_spec.md`)에서 WARNING 으로 격상시켜 실제 분리를 수행하는 흐름이다. target 의 새 `## Rationale` 은 이 최신 WARNING 근거만 인용하고, 이전 INFO 판정들이 왜 이제 와서 재평가됐는지(단순 스코프 확장 → 실질 드리프트로 재분류된 계기)는 언급하지 않는다.
  - 제안: target `## Rationale` 첫 항목에 한 줄 — "과거 INFO 판정(2026-06-05/06-11)은 참조 용도로 보아 무해로 봤으나, cross_spec(2026-07-09)이 owner 문서의 ✅ 완료 상태와 참조처의 '미해결 v2 과제' 서술이 실제 충돌한다는 점을 지적해 재평가함" 정도만 추가하면 계보가 완전해진다. 차단 사유는 아님.

## 요약

target 문서(`spec-draft-eh-detail-06-id-split.md`)가 손대는 4개 spec 파일(`spec/2-navigation/14-execution-history.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/data-hydration-surfaces.md`, `spec/conventions/conversation-thread.md`)의 관련 `## Rationale` 절을 전수 확인했다. `conversation-thread.md §8.4`("Execution.conversation_thread 컬럼 채택")의 기각 대안 서술 — "여러 노드의 presentation/AI turn 을 interleave 재구성하는 정책은 본 spec 이 EH-DETAIL-06(v2 UI) 에 위임한 미해결 과제" — 이 이번 ID 분리로 직접 편집되는 지점이지만, target 은 **결정의 실체(컬럼 채택, derived-view-only 기각)는 그대로 두고 참조 ID 라벨만 EH-DETAIL-06 → EH-DETAIL-12 로 정정**하므로 과거 결정의 번복이 아니라 정합화다. `spec/4-nodes/3-ai/1-ai-agent.md §12.1` "v1 vs v2 경계"의 EH-DETAIL-06 참조, `data-hydration-surfaces.md §2.4` Replay 행도 동일하게 라벨 정정에 그친다. owner 문서(`14-execution-history.md`)의 EH-DETAIL-06 행은 상태(✅)·의미(단일 AI Agent 노드 Preview 탭) 모두 불변이며 각주만 추가돼 기존 Rationale R-1~R-5 어느 것과도 충돌하지 않는다. grep 으로 저장소 전체(`EH-DETAIL-06`)를 재검증한 결과 target 이 나열한 7개 위치(owner 1 + ai-agent 1 + data-hydration 1 + conversation-thread 5)가 실제 참조 전부와 정확히 일치해 누락이 없다. 이번 분리는 직전 cross_spec 리뷰(`review/consistency/2026/07/09/11_31_49/cross_spec.md`)가 제시한 두 대안 중 (b) 신규 ID 발급을 채택한 것이며, "1 ID = 1 요구사항 1 status" 원칙을 정면으로 뒷받침하는 새 Rationale 항목도 함께 작성돼 있어 규약상 요구되는 "결정 변경 시 새 Rationale 동반" 요건도 충족한다. CRITICAL/WARNING 급 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회는 발견되지 않았다.

## 위험도

NONE
