# 문서화(Documentation) 리뷰

## 발견사항

### **[WARNING]** `interaction.controller.ts` Swagger `@ApiBadRequestResponse` description — `details[]` 내부 schema 상세 수준이 `executions.controller.ts`와 차이
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/external-interaction/interaction.controller.ts` line 70
- 상세: 현 worktree 파일에서 `interaction.controller.ts:70`의 `@ApiBadRequestResponse` description은 `'VALIDATION_ERROR (form field — details[]) / INVALID_COMMAND (필수 필드 누락).'`으로 갱신되어 `VALIDATION_FAILED` 잔존 문제는 해소됐다. 그러나 `executions.controller.ts`의 description은 `details[{field,message,code:INVALID_FIELD}]`까지 상세 schema를 기술하는 반면, `interaction.controller.ts`는 `details[]`만 표기해 두 Swagger 문서 간 상세 수준 불일치가 있다. API 소비자가 `interaction.controller.ts` Swagger를 참조 시 `details[]` 배열 구조를 파악할 수 없다.
- 제안: `interaction.controller.ts:70` description을 `'VALIDATION_ERROR (form field — details[{field,message,code:INVALID_FIELD}]) / INVALID_COMMAND (필수 필드 누락).'`으로 보완해 `executions.controller.ts`와 상세 수준을 통일한다.

---

### **[INFO]** `interaction.controller.ts` Swagger `@ApiBadRequestResponse` description — `VALIDATION_FAILED` 잔존 여부 확인 결과 해소됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/external-interaction/interaction.controller.ts` line 70
- 상세: 이전 리뷰 사이클(21_18_20 convention_compliance.md)에서 diff가 의도한 `VALIDATION_FAILED` → `VALIDATION_ERROR` 변경이 파일에 미반영됐다고 WARNING을 부여했다. 현 worktree 파일 직접 확인 결과, `'VALIDATION_ERROR (form field — details[]) / INVALID_COMMAND (필수 필드 누락).'`으로 이미 갱신된 상태다. 기능 정합성 문제 해소 완료.
- 제안: 없음.

---

### **[INFO]** `idempotency.interceptor.ts` 주석 — 현 worktree에서 `VALIDATION_ERROR`로 갱신 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` lines 27, 39, 130
- 상세: 이전 리뷰 사이클(21_30_20 naming_collision.md, rationale_continuity.md)에서 주석 3곳에 `VALIDATION_FAILED` 구 코드명이 잔존한다고 지적했다. 현 worktree 파일 직접 확인 결과, 세 곳 모두 `VALIDATION_ERROR`로 정정된 상태다. 이 항목은 해소 완료.
- 제안: 없음.

---

### **[INFO]** `workflow-errors.ts` JSDoc 블록 순서 — 현 worktree에서 올바른 순서로 배치 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/execution-engine/workflow-errors.ts` lines 228-279
- 상세: 이전 리뷰 사이클(21_13_46 scope.md, 21_18_20 convention_compliance.md)에서 JSDoc 블록 순서 불일치로 TypeDoc이 잘못 매핑할 수 있다고 WARNING을 부여했다. 현 worktree 파일 직접 확인 결과, `ValidationDetail` JSDoc + interface(228-239) → `FormValidationError` JSDoc + class(241-279) 순서로 올바르게 정렬되어 있다. 해소 완료.
- 제안: 없음.

---

### **[INFO]** `ValidationDetail.code` 타입 — 현 worktree에서 리터럴 `'INVALID_FIELD'`로 좁혀져 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/execution-engine/workflow-errors.ts` line 238
- 상세: 이전 리뷰 사이클(21_30_20 documentation.md, api_contract.md)에서 `ValidationDetail.code`가 `string`으로 선언되어 타입 레벨 계약을 강제하지 못한다고 WARNING을 부여했다. 현 worktree 파일 직접 확인 결과, `code: 'INVALID_FIELD'`로 리터럴 타입으로 이미 좁혀져 있다. JSDoc에도 "현재 단계 단일 값 `'INVALID_FIELD'`(`ErrorCode.INVALID_FIELD`) — 타입 레벨 계약 고정"이 명시되어 있다. 이 항목은 해소 완료.
- 제안: 없음.

---

### **[INFO]** `assertFormSubmissionValid` JSDoc — `min`/`max`/`pattern` 미구현 명시 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` lines 4317-4319
- 상세: 현 worktree 파일 직접 확인 결과, JSDoc에 "**미적용 (Planned)**: `validation.min`/`max`(숫자 범위)·`pattern`(정규식)·`type:'file'` MIME/size/count (`plan/in-progress/spec-sync-form-gaps.md` 추적)"이 명시되어 있다. 이전 사이클 documentation.md의 INFO 지적 사항이 이미 반영된 상태다.
- 제안: 없음.

---

### **[INFO]** 사용자 문서 `triggers.mdx`·`triggers.en.mdx` — 현 worktree에서 이미 `VALIDATION_ERROR`로 갱신 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/frontend/src/content/docs/02-nodes/triggers.mdx` lines 283, 298; `triggers.en.mdx` lines 272, 287
- 상세: 이전 리뷰 사이클(21_30_20 convention_compliance.md)에서 두 사용자 문서 파일에 `VALIDATION_FAILED` + `details.fieldErrors`가 잔류해 CRITICAL로 분류했다. 현 worktree 파일 직접 확인 결과, 두 파일 모두 `VALIDATION_ERROR` + `error.details[{ field, message, code }]`로 정확히 갱신된 상태다. CRITICAL 항목 해소 완료.
- 제안: 없음.

---

### **[INFO]** spec 4개 파일 — `VALIDATION_FAILED` → `VALIDATION_ERROR` 정정 및 API 문서 갱신 완료
- 위치: `spec/conventions/chat-channel-adapter.md` §4.1·§4.2, `spec/4-nodes/7-trigger/providers/slack.md` line 116, `spec/7-channel-web-chat/1-widget-app.md` line 44
- 상세: 이번 diff에서 네 spec 위치 모두 `VALIDATION_FAILED + fieldErrors` → `VALIDATION_ERROR + error.details[{field,message,code}]`로 정정됐다. 이전 사이클 cross_spec.md·convention_compliance.md·rationale_continuity.md의 WARNING 항목 조치 반영 완료.
- 제안: 없음.

---

### **[INFO]** `spec/5-system/14-external-interaction-api.md §R13` + `spec/5-system/4-execution-engine.md §7.5.2` — `FormValidationError` API 문서 등재 완료
- 위치: `spec/5-system/14-external-interaction-api.md` §R13 표; `spec/5-system/4-execution-engine.md` §7.5.2 선례 목록
- 상세: 이번 diff에서 §R13 표에 `FormValidationError | VALIDATION_ERROR | 400 VALIDATION_ERROR (+ details[])` 행이 추가됐고, §7.5.2 선례 목록에도 `FormValidationError` 항목이 추가됐다. 이전 사이클 cross_spec.md WARNING 조치 반영 완료. typed error ↔ WS ack ↔ EIA REST 3단 매핑 SoT가 갱신된 상태.
- 제안: 없음.

---

### **[INFO]** `spec/5-system/6-websocket-protocol.md §4.2` — `VALIDATION_ERROR` 에러 코드 표 등재, WS ack `details[]` 미포함 명시 권장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표
- 상세: 이번 diff에서 `VALIDATION_ERROR` 항목이 등재됐다. 이전 사이클 cross_spec.md WARNING 해소 완료. 다만 WS ack가 REST와 달리 `details[]`를 포함하지 않는 설계 결정이 등재된 항목 설명에 명시되어 있지 않아, 향후 클라이언트 구현자가 WS ack에서도 `details[]`를 기대하는 혼란 여지가 있다.
- 제안: 해당 항목 설명에 "ack field-level details 미포함 — 상세 오류는 EIA REST 경로 참조" 한 줄을 부연하는 것을 권장한다. (INFO 수준, 차단 불필요)

---

### **[INFO]** `spec/4-nodes/6-presentation/4-form.md` — `## Rationale` 섹션 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/spec/4-nodes/6-presentation/4-form.md` 전체 문서
- 상세: 이번 diff에서 §6.2 검증 조건 표가 개선되고 검증 지점 callout 블록이 추가됐으나, 문서 말미에 `## Rationale` 섹션은 여전히 없다. CLAUDE.md 규약(결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`)에 따르면 이 섹션이 필요하다. "FIRST 오류 단일 반환" 정책, publisher 측 동기 검증 위치 선택, file 검증 Planned defer 근거 등이 산재한 주석에 흩어져 있다.
- 제안: spec 완성 시점에 `## Rationale` 섹션 추가. 현 `status: partial` 상태이므로 즉각 차단 불필요. (project-planner 권한 작업)

---

### **[INFO]** `chat-channel/shared/form-mode.ts` cross-import 구조 결정 — spec Rationale 부재
- 위치: `spec/4-nodes/6-presentation/4-form.md` §6.2 및 `spec/5-system/4-execution-engine.md`
- 상세: `execution-engine.service.ts`가 `chat-channel/shared/form-mode.ts`의 `validateFormSubmission`·`extractFormFields`를 cross-import하는 구조 결정의 Rationale이 spec 어디에도 기록되어 있지 않다. 향후 `form-mode.ts`에 채널 전용 변경(Discord modal hard limit 등)이 가해질 경우 실행 엔진 검증에 의도치 않은 영향을 줄 수 있다.
- 제안: `spec/4-nodes/6-presentation/4-form.md` §6.2 또는 실행 엔진 spec Rationale에 cross-import 구조 결정과 "도메인 중립 공유 레이어로 재배치 예정(W-4 BACKLOG)" 문구를 추가한다. (project-planner 권한 작업, INFO 수준)

---

### **[INFO]** CHANGELOG.md — 변경 이력 기록 적절
- 위치: `CHANGELOG.md`
- 상세: 이전 코드 리뷰 사이클(21_13_46 scope.md)에서 CHANGELOG에 "Unreleased — EIA submit_form 서버 측 field 검증" 섹션이 적절히 추가된 것으로 확인됐다. 응답 shape, first-error 정책, waiting 상태 유지, WS ack 매핑까지 기술되어 있다.
- 제안: 없음.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 높으며, 이전 리뷰 사이클(21_13_46, 21_30_20)에서 지적된 주요 문서화 격차 대부분이 해소됐다. 사용자 문서 2개(`triggers.mdx`, `triggers.en.mdx`)의 `VALIDATION_FAILED` + `details.fieldErrors` 오기 수정(이전 CRITICAL 해소), `idempotency.interceptor.ts` 주석 3곳 갱신, WS spec §4.2 `VALIDATION_ERROR` 등재, EIA spec §R13 매핑 표 `FormValidationError` 행 추가, spec 4개 파일의 `VALIDATION_FAILED` 코드명 통일이 모두 반영됐다. `workflow-errors.ts` JSDoc 블록 순서 문제, `ValidationDetail.code` 타입 리터럴 좁히기, `assertFormSubmissionValid` JSDoc의 미구현 항목 명시도 이미 적용된 상태다. `interaction.controller.ts` Swagger의 `VALIDATION_FAILED` 잔존 문제도 해소됐다. 남은 단일 WARNING은 `interaction.controller.ts` `@ApiBadRequestResponse` description이 `details[]` 배열 내부 schema(`{field,message,code:INVALID_FIELD}`)를 생략해 `executions.controller.ts`와 Swagger 문서 상세 수준이 불일치하는 점이다. INFO 항목으로는 WS ack `details[]` 미포함 설계 결정의 spec 명시 부재, `spec/4-nodes/6-presentation/4-form.md`의 `## Rationale` 섹션 부재, cross-import 구조 Rationale 미기록이 있다.

## 위험도

LOW

STATUS=success ISSUES=1
