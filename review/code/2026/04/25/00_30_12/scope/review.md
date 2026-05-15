## Scope 코드 리뷰

### 발견사항

---

**[INFO] `anthropic.client.ts`: `disable_parallel_tool_use: false` 명시 설정**
- 위치: `chat()` 메서드 (l.75–87), `stream()` 메서드 (l.201–213)
- 상세: `feat(assistant): encourage parallel tool calls` 커밋 목적과 직접 일치. `chat()`·`stream()` 양쪽에 대칭 적용되어 누락 없음. `toolChoice === 'none'` 케이스에서 `disable_parallel_tool_use`를 붙이지 않는 것도 의도적으로 올바름 (도구 자체가 없는 상황).
- 제안: `chat()` 주석 7줄 · `stream()` 주석 5줄이 동일 내용을 반복. "Mirror of the non-streaming branch." 한 줄로 두 번째 주석 대체 가능.

---

**[WARNING] `tool-definitions.ts`: `planStepIds` 배열 파라미터 — 범위 판단 불명확**
- 위치: `add_node`, `update_node`, `remove_node`, `add_edge`, `remove_edge` 5개 도구 전부
- 상세: 커밋 메시지("encourage parallel tool calls")에는 언급되지 않은 스키마 확장. 병렬 배치 시 하나의 호출로 복수 plan step을 처리하려는 목적이라면 관련성은 있으나, 동일 PR에서 별도 기능(planStepIds 집계)이 조용히 추가된 형태. 롤백·비즈니스 로직 리뷰 시 변경 범위가 불투명해짐.
- 제안: `planStepIds` 추가가 병렬 호출 피처의 필수 지원 요소라면 커밋 메시지 또는 PR 설명에 명시. 독립 변경이라면 별도 커밋으로 분리.

---

**[WARNING] `system-prompt.ts`: 턴 결정 테이블(turn decision table) — 구조적 재편**
- 위치: `STATIC_BLOCK_1_ROLE_AND_TURN_OP` 내 `### Turn decision table` 섹션
- 상세: 마크다운 5-행 테이블로 "Single edit / Multi-node / Plan-only / openQuestions / Question-only"를 정의. 병렬 호출 가이드를 위한 컨텍스트 제공은 이해되나, 기존 "Clarify → Plan → Execute" 산문을 표 형태로 전면 재구성하는 것은 병렬 호출 범위를 넘어서는 prompt 아키텍처 변경. 테스트(`surfaces a turn-type decision table with every row named`)가 존재하는 것으로 보아 의도적 변경임은 명확하나, 별도 커밋 없이 단일 feature 커밋에 포함.
- 제안: 턴 결정 테이블이 병렬 호출 피처의 필수 전제라면 `feat(assistant): restructure turn decision table` 등 별도 커밋으로 분리해 이력 추적성 확보.

---

**[INFO] `anthropic.client.ts`: `({ type: 'none' } as never)` 타입 캐스팅**
- 위치: `chat()` l.78, `stream()` l.204
- 상세: Anthropic SDK의 `ToolChoiceNone`에 `disable_parallel_tool_use` 필드가 없어 `as never`로 타입 우회. 런타임에는 해당 분기에서 `disable_parallel_tool_use`가 붙지 않으므로 동작은 정상이지만, 추후 SDK 업데이트 시 조용히 타입 오류 없이 흘러갈 수 있음.
- 제안: `as never` 대신 `as Anthropic.ToolChoiceNone` 또는 별도 타입 단언으로 의도 명확화.

---

**[INFO] `system-prompt.spec.ts`: `resetExpressionCacheForTesting` export 추가**
- 위치: import 구문, `edge cases` describe 내 마지막 테스트
- 상세: 테스트 격리용 유틸리티로, 캐시 오염 방지 목적은 타당. 범위를 벗어나지 않음.

---

**[INFO] `workflow-assistant-stream.service.spec.ts`: 테스트 파일 포함 범위**
- 상세: 제공된 코드가 truncated 상태라 전체 변경 내용 확인 불가. 보이는 범위 내에서는 `pendingUserConfig` 관련 테스트(`candidateLookup` mock 포함)가 앞선 커밋(`fix(assistant): dedupe pendingUserConfig`)과 혼재할 가능성 있음.
- 제안: 파일 전체 diff 확인 후 각 테스트 블록이 어느 커밋 단위에 속하는지 정렬 권장.

---

### 요약

핵심 변경(`anthropic.client.ts`의 `disable_parallel_tool_use: false`와 `system-prompt.ts`·`spec.ts`의 병렬 도구 호출 섹션)은 커밋 목적과 명확히 일치한다. 다만 `planStepIds` 스키마 확장과 턴 결정 테이블 재구성이 단일 커밋 안에 조용히 포함되어 있어 이력 추적성이 다소 희석된다. 동작 정확성보다는 변경 단위 관리의 문제이며, 각 변경이 롤백·리뷰·비즈니스 논의의 단위로 분리될 필요가 있는지 팀 내 정책에 따라 판단이 필요하다.

### 위험도

**LOW**