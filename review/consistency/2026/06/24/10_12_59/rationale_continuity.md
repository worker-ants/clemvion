# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
범위: M-3 3단계 — AssistantTurnPersistenceService 분리
대상 spec: `spec/3-workflow-editor/4-ai-assistant.md`
diff-base: origin/main

---

## 발견사항

### [INFO] `makeResumeMeta` 를 `assistant-turn-persistence.service.ts` 에 배치한 근거가 spec Rationale 에 없음

- **target 위치**: `assistant-turn-persistence.service.ts` 파일 상단 JSDoc 주석 ("persist 본체와 한 파일에 둬 두 곳에서 공유한다 (M-3 3단계 — 무상태 collaborator 분리)")
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` § Rationale "10. Stall 자동 복구 UX" — `makeResumeMeta` 는 `workflow-assistant-stream.service.ts` 내 private function 으로 설계됐으며 spec Rationale 은 이 헬퍼를 "stream.service 가 소유" 하는 단일-파일 함수로 기술함
- **상세**: spec Rationale § 10 은 `persistAssistantTurn` 시그니처 확장(resumeMeta 파라미터)을 정의하고, `makeResumeMeta` 는 stream.service 의 turn-scoped stall 카운터(`totalStallCount`) 로부터 메타를 derive 해 persist 에 넘기는 로직으로 묘사되어 있다. 구현은 `makeResumeMeta` 를 `assistant-turn-persistence.service.ts` 로 옮겨 동일 파일에 export 하는 방식을 택했는데, 이 배치 결정을 설명하는 spec Rationale 신규 항목은 없다. stream.service 의 import 주석에는 "turn-scoped 카운터를 소유한 쪽이 streamMessage 이므로 메타 derive 는 호출부에서 하고 persist 는 그 결과만 받는" 설명이 있으나, spec Rationale 에는 반영되지 않았다.
- **제안**: spec 무변경(behavior-preserving) 리팩터링이므로 spec Rationale 갱신이 강제 의무는 아니다. 그러나 M-3 1단계(AssistantToolRouter)·2단계(AssistantFinishGuard) 와 동일한 "무상태 collaborator 추출" 패턴이 plan/in-progress/refactor/02-architecture.md §M-3 에 기록되어 있으므로, 향후 planner 가 `spec/3-workflow-editor/4-ai-assistant.md § Rationale` 에 "Workflow Assistant 서비스 분해 — M-3 단계별 무상태 collaborator 추출" 항목을 추가할 것을 권장한다. 현 시점 구현자 선택(배치 근거 코드 주석에만 기록)은 spec Rationale 에서 명시적으로 기각된 대안과 충돌하지 않는다.

---

### [INFO] `persistAssistantTurn` 의 `finishReason: string` 타입 유지가 spec 결정과 정합함을 확인

- **target 위치**: `assistant-turn-persistence.service.ts` L375 JSDoc — "finishReason 은 의도적으로 `string` — provider 가 돌려주는 원본 finishReason 과 서버 합성 마커가 모두 흘러들고 entity 컬럼도 `string | null`"
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` § 5.3 및 §10 — `finishReason: 'auto_resume_pending'` 같은 서버 합성 마커와 provider 원본 값이 혼용되는 설계가 확정되어 있음
- **상세**: spec 의 기존 결정과 완전히 정합함. spec 기각 대안 재도입 없음. 단순 참고 확인 사항.
- **제안**: 없음.

---

## 요약

M-3 3단계 AssistantTurnPersistenceService 분리는 spec/3-workflow-editor/4-ai-assistant.md 의 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 내용이 없다. `persistAssistantTurn`·`makeResumeMeta` 의 이동은 spec Rationale §10 이 정의한 `resumeMeta` 파라미터 계약·stall 복구 동작·`autoResumed` 필드 의미를 전부 보존한다. `makeResumeMeta` 의 배치 결정(persist 파일 내 공유 export)은 spec Rationale 에 미기록 상태지만, spec 이 "stream.service 소유" 를 명시적으로 고정한 것이 아니라 구현 단계에서 자연스럽게 결정될 수 있는 범위이므로 WARNING 이상으로 분류되지 않는다. plan/in-progress/refactor/02-architecture.md 에 동일 패턴(단계별 무상태 collaborator 추출)이 기록되어 있어 설계 의도는 추적 가능하다.

## 위험도

NONE
