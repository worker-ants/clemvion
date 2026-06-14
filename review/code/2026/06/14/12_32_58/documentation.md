# Documentation Review — EIA MessageTooLongError HTTP 400 매핑 (refactor-04-a1-eia-msglen-ba62ae)

## 발견사항

### [INFO] `dispatchContinuation` JSDoc 미갱신 — 새 에러 매핑 미언급
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/codebase/backend/src/modules/external-interaction/interaction.service.ts` — `dispatchContinuation` 메서드 JSDoc
- 상세: 기존 JSDoc 은 `InvalidExecutionStateError → STATE_MISMATCH(409)` 매핑만 서술하며 "그 외 에러는 그대로 전파" 라는 의미를 내포한다. 이번 변경으로 `MessageTooLongError → MESSAGE_TOO_LONG(400)` 매핑이 추가됐으나 JSDoc 에는 반영되지 않았다.
- 제안: JSDoc 에 `MessageTooLongError` → `400 MESSAGE_TOO_LONG` 매핑 줄 추가. 인라인 주석(`// I-5 ...`)만으로는 메서드 시그니처 레벨 문서가 불완전하다.

### [INFO] 클래스 레벨 JSDoc `dispatch 매핑` 표에 에러 경로 미언급
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `InteractionService` 클래스 JSDoc
- 상세: 클래스 레벨 JSDoc 은 dispatch 매핑 표를 기술하되 에러 흐름을 서술하지 않는다. `dispatchContinuation` JSDoc 개선(상기 항목)으로 대체 가능하므로 별도 조치 불필요.
- 제안: `dispatchContinuation` JSDoc 갱신으로 충족. 클래스 레벨 JSDoc 변경 생략 가능.

### [INFO] plan 문서 체크박스 상태 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/plan/in-progress/eia-message-length-error-mapping.md` `## 작업` 섹션
- 상세: plan 문서에서 `be`(`interaction.service.ts` 구현)와 `be test`(`interaction.service.spec.ts`) 항목이 미완(`[ ]`)으로 표시돼 있으나, 리뷰 대상 diff 에는 두 항목 모두 이미 구현된 상태다. plan 문서가 코드 현황을 반영하지 않아 완료 기준 추적이 부정확하다.
- 제안: 두 항목을 `[x]` 로 갱신 필요:
  - `[ ] **be** interaction.service.ts dispatchContinuation 에 MessageTooLongError catch` → `[x]`
  - `[ ] **be test** interaction.service.spec: submit_message 길이 초과 → 400 MESSAGE_TOO_LONG` → `[x]`

### [INFO] 인라인 주석 품질 — 충분
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` 신규 블록 (dispatchContinuation 내 MessageTooLongError catch), `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` 신규 테스트 인라인 주석
- 상세: 구현 주석("I-5 (refactor 04 A-1 후속) — submit_message 길이 초과 typed error 를 generic 500 대신 400 으로 매핑한다 ..."), 누출 차단 원칙("내부 길이 수치는 serverDetail 전용이라 응답에 노출되지 않는다"), 테스트 주석("누출 차단: 내부 길이 수치는 응답에 포함되지 않는다") 모두 의도를 명확히 서술한다. 추가 개선 불필요.

### [INFO] 스펙 문서 업데이트 — 완료 및 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/5-system/14-external-interaction-api.md` §5.1 에러 표, `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-eia-msglen-ba62ae/spec/5-system/4-execution-engine.md` §7.5.2
- 상세: API 문서 §5.1 에러 표에 `MESSAGE_TOO_LONG` 행이 추가됐고, 실행 엔진 스펙에 EIA 진입점 매핑 cross-ref note 가 추가됐다. 두 스펙 문서의 상호 참조(`[실행 엔진 §7.5.2]`↔`[§14 EIA §5.1 에러 표]`)가 명시적으로 연결되며, WS 평면 ack `EXECUTION_MESSAGE_TOO_LONG` 와의 의미 등가도 명시돼 있다. 스펙 문서화 관점에서 충분하다.

### [INFO] CHANGELOG 업데이트 필요성 — 해당 없음
- 상세: 프로젝트에 별도 CHANGELOG 파일이 없고 plan/spec 이 변경 이력 역할을 대신하는 구조이므로, 별도 CHANGELOG 업데이트 불필요.

---

## 요약

이번 변경은 스펙 문서(`14-external-interaction-api.md` §5.1, `4-execution-engine.md` §7.5.2)와 구현(`interaction.service.ts`), 테스트(`interaction.service.spec.ts`) 간 문서화 정합이 전반적으로 양호하다. 인라인 주석도 구현 의도와 누출 차단 원칙을 충분히 서술한다. 개선이 필요한 사항은 두 가지로 모두 LOW 등급이다: (1) `dispatchContinuation` JSDoc 에 `MessageTooLongError → 400 MESSAGE_TOO_LONG` 매핑이 언급되지 않아 메서드 시그니처 레벨 문서가 불완전하고, (2) `plan/in-progress/eia-message-length-error-mapping.md` 의 `be` / `be test` 체크박스가 코드 현황을 반영해 `[x]` 로 갱신되어야 한다. API 동작이나 기능 정확성에는 영향이 없다.

## 위험도

LOW
