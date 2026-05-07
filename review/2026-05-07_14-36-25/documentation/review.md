## 발견사항

### [WARNING] `candidate-lookup.service.spec.ts` 모듈 docstring 숫자 미갱신
- **위치**: `candidate-lookup.service.spec.ts` 전체 파일 컨텍스트 상단 (라인 6–8)
- **상세**: 모듈 주석이 `"본 spec 은 4 widget 각각에 대해 fillCandidates 가 알맞은 서비스로 위임하고..."` 로 고정되어 있으나, 이번 변경으로 `mcp-server-selector` 가 추가되어 실제로는 5개 widget 을 다룬다. `system-prompt.spec.ts` 에서는 "4가지 → 5가지" 를 정확히 수정했는데 이 파일만 누락.
- **제안**: `"본 spec 은 4 widget"` → `"본 spec 은 5 widget"` 으로 수정

---

### [WARNING] plan 문서 TODO 체크박스가 실제 완료 상태를 반영하지 않음
- **위치**: `plan/in-progress/ai-assistant-pending-config-mcp-multi.md` TODO 섹션
- **상세**: diff 를 보면 backend 테스트·구현, frontend 테스트·구현이 모두 완료됐는데 TODO 항목은 `[ ]` 그대로다. "backend 테스트 선작성", "backend 구현", "frontend 테스트 선작성", "frontend 구현", `node-component.interface.ts` 검증도 이미 처리됐다. plan 문서가 현황을 반영하지 못하면 후속 작업자(또는 다음 세션)가 중복 작업하거나 미완으로 오인할 수 있다.
- **제안**: 완료된 항목을 `[x]` 로 갱신하고, "TEST WORKFLOW", "REVIEW WORKFLOW", "plan/complete 이동" 만 `[ ]` 로 유지

---

### [WARNING] plan 문서가 로컬 경로(`~/.claude/plans/`)를 참조
- **위치**: `plan/in-progress/ai-assistant-pending-config-mcp-multi.md` 2번 라인
- **상세**: `승인된 계획 원본: ~/.claude/plans/ai-sleepy-garden.md (요약 사본)` 은 개인 로컬 경로로 팀원이나 CI 컨텍스트에서 접근 불가. 이력 추적 목적의 링크가 실질적으로 끊어져 있다.
- **제안**: 로컬 경로 참조를 제거하거나, 핵심 context 를 plan 문서 자체에 인라인으로 기술

---

### [INFO] `CandidatePickerSubmission` 타입에 JSDoc 없음
- **위치**: `candidate-picker.tsx` exported type 선언부
- **상세**: `export type CandidatePickerSubmission = | { mode: "single"; id: string } | { mode: "multi"; ids: string[] }` 가 `onConfirm` 콜백의 계약을 정의하는 핵심 타입인데, 한 줄 설명이 없다. 피커 소비자(`assistant-message.tsx`)가 이 타입을 직접 import 하므로 brief 설명이 있으면 import 탐색 없이도 의도를 파악할 수 있다.
- **제안**: `/** Picker Confirm payload — scalar fields emit single·id, array fields emit multi·ids[]. */` 한 줄 추가

---

### [INFO] `buildPickerSubmissionValue` fallback 분기 설명이 불완전
- **위치**: `assistant-message.tsx`, multi 모드 fallback 주석
- **상세**: "실제로는 detector 가 widget→mode 매핑을 강제하므로 여기 도달하지 않는다" 라고 기술했지만, 향후 새 multi-widget 을 추가할 때 `MULTI_SELECT_WIDGETS`(backend)과 `buildPickerSubmissionValue`(frontend) 양쪽을 모두 갱신해야 한다는 계약 요건이 언급되지 않는다. 한쪽만 업데이트하면 fallback 로직이 조용히 오동작할 수 있다.
- **제안**: 주석에 "새 multi widget 추가 시 MULTI_SELECT_WIDGETS(detect-pending-user-config.ts) 와 이 함수를 동시에 갱신해야 한다" 1문장 추가

---

### [INFO] `system-prompt.ts` 의 `kb-selector` 설명에 multi-select 추가됐으나 `llm-config-selector` 는 single 임을 명시 안 함
- **위치**: `system-prompt.ts` diff, 선택 모드 설명 부분
- **상세**: `mcp-server-selector` 와 `kb-selector` 에 `Multi-select` 가 명시됐지만, 반대로 `integration-selector` · `llm-config-selector` · `workflow-selector` 가 single 임을 system prompt 상에서 명시적으로 구분하지 않는다. LLM 이 selector 종류에 따른 데이터 모델 차이를 이해하는 데 도움이 될 수 있다. (현재 `system-prompt.spec.ts` 에서 검증하지 않는 내용)
- **제안**: 필수는 아니나, "Single-select" 레이블도 나머지 세 widget 에 대칭적으로 추가하면 prompt 일관성이 높아짐

---

## 요약

전반적으로 문서화 품질이 높다. 백엔드 `detect-pending-user-config.ts` 의 모듈 docstring과 `PendingUserConfigField.selectionMode` JSDoc, 프론트엔드 `candidate-picker.tsx` 의 상태 분기 설명, `buildPickerSubmissionValue` 의 widget별 데이터 모델 설명 등 WHY가 명확히 기술되어 있다. 다만 세 가지 실질적 개선점이 있다: `candidate-lookup.service.spec.ts` 모듈 주석의 widget 수 불일치, plan 문서 TODO 체크박스가 현재 완료 상태를 반영하지 않는 점, plan 문서의 로컬 경로 참조 문제. `CandidatePickerSubmission` 타입 JSDoc 누락과 fallback 주석 보완은 낮은 우선순위.

## 위험도
**LOW**