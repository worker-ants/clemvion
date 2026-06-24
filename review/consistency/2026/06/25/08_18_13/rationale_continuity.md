# Rationale 연속성 검토 결과

검토 대상: 03-maintainability C-2 후속 W7 — `recordMultiTurnNonProviderToolResults` condition deferral `toolCallCount++` 제거, single/multi-turn 정책 통일

## 발견사항

### [INFO] W6 코드 주석 "동기화 금지 INVARIANT" 의 성격 명확화 필요
- **target 위치**: `ai-turn-executor.ts` — 제거된 JSDoc 블록 (`INVARIANT (03 C-2 review W6/INFO-5): condition deferral 의 toolCallCount 처리는 … 동기화 금지`)
- **과거 결정 출처**: spec `4-nodes/3-ai/1-ai-agent.md §12 Rationale` — 해당 INVARIANT 는 spec §12 에 **없음**. 코드 주석(W6 리뷰 산출물)에만 존재.
- **상세**: W6 리뷰가 남긴 `INVARIANT` 주석은 "behavior-preserving 분해 단계에서 multi-turn 의 버그(조건 도구 합산)를 의도적으로 보존"한다는 임시 제약이었고, "플래너 위임 백로그"로 명시됐다. spec §7.1 `meta.toolCalls` 정의(`KB·MCP·일반 도구 호출 횟수 합산 — 조건 도구 제외`)는 처음부터 single/multi-turn 구분 없이 동일 정책을 명시한다. 즉 "동기화 금지"는 spec Rationale 에서 나온 설계 원칙이 아니라 일시적 drift 보존 주석이었으며, W7 변경은 이를 spec §7.1 에 맞춰 해소한 것이다.
- **제안**: 별도 조치 불필요 — 변경이 올바른 방향이며 spec Rationale 을 위반하지 않는다. 향후 리뷰어를 위해 spec `1-ai-agent.md §12` 에 "W7 SPEC-DRIFT 해소: multi-turn condition 도구 미합산 통일 — 구 W6 INVARIANT 주석은 임시 drift 보존이었고 spec §7.1 과 충돌하지 않음"을 INFO 항목으로 추가하면 이력 투명성이 높아진다 (의무는 아님).

---

## 요약

Rationale 연속성 관점에서 본 W7 변경은 문제가 없다. spec `4-nodes/3-ai/1-ai-agent.md §7.1`의 `meta.toolCalls` 정의("조건 도구 제외")는 기존 결정이고, W7 이전의 multi-turn 합산 동작이 그 정의를 위반하는 drift 였다. W6 리뷰 주석의 "INVARIANT — 동기화 금지"는 spec §12 Rationale 에 없는 임시 코드 제약이었으며, spec이 명시적으로 기각한 대안을 재도입하거나 합의된 원칙을 위반하는 요소는 발견되지 않는다. 오히려 기각됐어야 할 drift 를 제거해 spec Rationale 과의 정합성을 회복했다. cleanup 항목들(상수화, Date.now 단일 캡처, 섹션 번호 §3.f-g→§6.1.f-g 갱신)도 모두 기존 Rationale 결정과 충돌하지 않는 리팩터다.

## 위험도

NONE
