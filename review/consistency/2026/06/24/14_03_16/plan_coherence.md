### 발견사항

- **[INFO]** spec §10 body 와 §1072 결정 간 내부 불일치 — 플래너 후속에서 처리 예정
  - target 위치: 해당 없음 (target 은 `system-prompt.ts` 프롬프트 문자열 수정)
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-3 **planner 후속(비차단 SPEC-DRIFT)** 항목
  - 상세: `spec/3-workflow-editor/4-ai-assistant.md` §952-961 의 `review skip 조건` 목록이 여전히 `state.finishBlockCount > 0` 를 나열하고 있으나, 같은 파일 §1072-1088 "Review guard 항상 발동" 에서 이 조건의 **제거**가 확정 결정으로 기록됨. target 변경(system-prompt.ts 에서 `PLAN_NOT_COMPLETE` clause 제거)은 §1072-1088 결정 및 실제 코드(`shouldSkipReview` — finishBlockCount 미체크)와 일치. §952-961 의 stale 내용은 별도 planner 후속 작업(M-3 전체 완료 후 일괄 처리로 기록됨)에서 갱신 예정 — target 이 이를 우회하거나 충돌하지 않음.
  - 제안: 이미 plan 의 planner 후속에 등재된 사항이므로 추가 조치 불요. 단, spec §952-961 의 `finishBlockCount` 행 제거를 planner 후속 일괄 작업(`4-ai-assistant.md` §10 갱신) 시 함께 처리해야 함을 추적 메모로 남길 것.

### 요약

target(`system-prompt.ts` 에서 `PLAN_NOT_COMPLETE` 이미 발동 시 review skip 안내 문구 제거)은 plan/in-progress 내 미해결 결정과 충돌하지 않는다. 이 변경의 근거인 "Review guard 항상 발동" 결정(`finishBlockCount > 0` skip 제거)은 `spec/3-workflow-editor/4-ai-assistant.md §1072-1088` 에 명시 확정됐고, M-3 2단계(`AssistantFinishGuard` 분리 — `plan/in-progress/refactor/02-architecture.md` [x] 완료)에서 코드로 구현됐으며, spec 유지보수 체크리스트(§992, §1349)가 "Review skip 조건 변경 시 `system-prompt.ts` 동기화"를 명시 의무화하고 있다. 선행 plan 은 해소되어 있고, 유일한 주의사항은 spec §952-961 body 에 여전히 stale `finishBlockCount` 항목이 남아 있다는 것인데 이는 M-3 planner 후속(비차단 SPEC-DRIFT)으로 이미 추적 중이다.

### 위험도
NONE
