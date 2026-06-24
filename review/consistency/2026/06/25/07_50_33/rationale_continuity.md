# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `03-maintainability C-2 후속 (W7 SPEC-DRIFT 해소)` — `recordMultiTurnNonProviderToolResults` 의 condition deferral `toolCallCount++` 제거 + INFO cleanup (상수화·JSDoc 정정·Date.now 단일캡처)

---

## 발견사항

### 발견사항 없음 — Rationale 연속성 관점 적합

이 target 변경은 기존 spec 의 합의 결정을 **위반하는 것이 아니라 복원**하는 버그픽스다. 아래는 검토 근거를 명시한다.

---

### [INFO] single-turn 미합산·multi-turn 합산 비대칭이 의도된 결정으로 보존되었다가 제거되는 경로

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `recordMultiTurnNonProviderToolResults` (L1962~1964 JSDoc INVARIANT 주석, L1983~1987 `[SPEC-DRIFT]` 주석, L1987 `toolCallCount++`)
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.toolCalls` 필드 정의 — `"KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)"` (L524). 이 정의는 single/multi-turn 구분 없이 **조건 도구를 항상 제외**한다.
- **상세**: C-2 2차 슬라이스 (PR 배경 주석 L1962~1964) 에서 `recordSingleTurnNonProviderToolResults` 는 spec 과 일치하게 조건 도구를 미합산하지만, `recordMultiTurnNonProviderToolResults` 는 pre-existing 동작(`toolCallCount++`) 을 `[SPEC-DRIFT]` 주석과 함께 보존했다. 코드 주석은 "합산/spec 정정 결정은 project-planner 위임 (백로그)" 으로 표기. W7 target 은 그 백로그를 실행해 spec 과 정합시킨다.
- **평가**: 이 변경은 spec §7.1 의 "조건 도구 제외" 원칙을 위반하지 않는다. 오히려 pre-existing 드리프트를 제거해 spec 원칙을 회복한다. spec 의 Rationale 섹션에 조건 도구를 합산해야 한다는 근거나 합산 결정이 존재하지 않으므로, 드리프트 제거는 기각된 대안의 재도입이나 합의 원칙 위반에 해당하지 않는다.
- **제안**: 현행 W7 target 방향이 옳다. spec 변경 불요 (코드를 기존 spec 에 맞추는 버그픽스). 구현 후 `recordMultiTurnNonProviderToolResults` 의 `[SPEC-DRIFT]` 주석과 L1962~1964 의 "동기화 금지" INVARIANT 주석을 함께 제거해 코드베이스에서 의도적 비대칭 흔적을 정리할 것.

---

### [INFO] `executeProviderToolBatch` 인라인 리터럴 → `TOOL_BUDGET_EXCEEDED_ERROR` 상수 치환 (INFO cleanup)

- **target 위치**: `ai-turn-executor.ts` L962 인라인 `'tool_call_budget_exceeded'` 문자열
- **과거 결정 출처**: 상수 `TOOL_BUDGET_EXCEEDED_ERROR` 는 이미 L550 에 선언되어 있고 `recordSingleTurnNonProviderToolResults` / `recordMultiTurnNonProviderToolResults` 에서 사용 중. L962 만 인라인 리터럴로 남아 있는 비일관.
- **상세**: 기존 Rationale 에 "인라인 리터럴을 허용한다" 는 결정 없음. 상수로 치환하는 것은 Rationale 에 기록된 어떤 결정도 번복하지 않는 일관성 정리다.
- **제안**: INFO cleanup 으로 분류 적절. 진행 무방.

---

### [INFO] JSDoc §3.f-g 표기 정정 (INFO cleanup)

- **target 위치**: `ai-turn-executor.ts` L1137 / L1182 / L1574 / L1964 의 JSDoc·주석 내 `§3.f-g` 참조
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 단계 3.f / 3.g 는 각각 Promise.all 병렬 실행(f) 과 maxToolCalls 초과 truncate(g) 를 정의하는 실행 로직 단계다. `§3.f` / `§3.g` 라는 표기는 spec 단락 번호 체계와 불일치.
- **상세**: 코드 JSDoc 의 `§3.f-g` 는 spec 의 독립 단락 번호가 아닌 "6.1 단계 3 의 f, g 서브항목" 의 의도로 쓰였으나 독자가 spec 에서 §3.f / §3.g 를 직접 찾으면 미존재한다. Rationale 에 이 표기 방식을 채택한다는 결정이 없으므로 정정은 무방하다.
- **제안**: INFO cleanup 진행 무방.

---

### [INFO] condition-route `Date.now()` 이중호출 → 단일캡처 (INFO cleanup)

- **target 위치**: `ai-turn-executor.ts` condition routing 경로의 `Date.now()` 중복 호출 지점
- **과거 결정 출처**: spec 에 `Date.now()` 호출 방식에 대한 결정 없음 (구현 세부).
- **상세**: 단일 캡처는 race 없는 정확한 타임스탬프를 보장하는 방어적 코딩이며, Rationale 에 기록된 어떤 결정도 번복하지 않는다.
- **제안**: INFO cleanup 진행 무방.

---

## 요약

W7 target 의 핵심 변경(multi-turn `recordMultiTurnNonProviderToolResults` 의 condition deferral `toolCallCount++` 제거)은 `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §7.1 에서 "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)" 로 명시된 합의 정책을 **복원**하는 버그픽스다. 기존 spec Rationale 어디에도 multi-turn 에서 조건 도구를 합산해야 한다는 결정이 존재하지 않으며, 코드 주석 자체가 `[SPEC-DRIFT]` 로 이것을 드리프트로 표면화하고 있었다. 따라서 이 변경은 기각된 대안의 재도입도, 합의 원칙 위반도, 무근거 번복도 아니다. 동봉된 INFO cleanup 3건(상수화·JSDoc 정정·Date.now 단일캡처) 역시 Rationale 에 기록된 어떤 결정과도 충돌하지 않는다. spec 변경 없이 구현만으로 닫을 수 있는 드리프트 수정이다.

## 위험도

NONE
