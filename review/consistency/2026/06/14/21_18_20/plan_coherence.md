# Plan 정합성 검토 결과

## 발견사항

- **[WARNING]** `spec-sync-form-gaps.md` §4/§6.2 체크박스 미갱신 — 부분 완료 미반영
  - target 위치: diff 전체 (execution-engine.service.ts `assertFormSubmissionValid`, executions.controller.ts, interaction.service.ts, websocket.gateway.spec.ts, e2e `external-interaction.e2e-spec.ts`)
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-form-gaps.md` 18행 `- [ ] §4 step5 / §6.2 서버측 폼 검증`
  - 상세: 이 diff 는 `continueExecution` publisher 측에 `assertFormSubmissionValid` 를 주입해 필수/type/validation.* (minLength·maxLength·min·max·pattern) 검증을 실제로 구현했다. 해당 plan 항목의 비-file 부분(필수/type/length/선택지)은 본 diff 로 이행된 상태이나, plan 체크박스는 여전히 `- [ ]` 로 남아 있다. plan 메모(14행)에는 "§4/§6.2·§1.5·§1 file기본값은 파일검증 cluster 로 묶여 별도 PR 권장" 이라고만 기재되어 있고, 비-file 검증의 완료 사실이 plan 에 반영되지 않았다. 체크박스를 완전 체크하면 file 검증까지 완료인 것처럼 오인될 수 있고, 그대로 두면 이미 구현된 항목이 미완료로 오해된다.
  - 제안: plan 항목을 "비-file 검증(필수/type/validation.*) 완료 ✅ — file MIME/size/count 검증은 파일검증 cluster 로 분리 추적" 으로 갱신하거나, 체크박스를 두 줄로 분리(비-file ✅ / file [ ])하여 현 상태를 정확히 반영한다. plan 갱신 주체: developer (plan/** 쓰기 권한).

- **[INFO]** `VALIDATION_ERROR` 코드명·`details[]` 배열 채택 — 완료된 선행 plan 과 정합
  - target 위치: `workflow-errors.ts` `FormValidationError.code = ErrorCode.VALIDATION_ERROR`, `toHttpDetails()` 반환 shape
  - 관련 plan: `/Volumes/project/private/clemvion/plan/complete/spec-fix-eia-token-error-codes.md` (완료 2026-06-14) — 동반 EIA nit 정비에서 `VALIDATION_FAILED` → `VALIDATION_ERROR` (+details 배열, api-convention §5.3 정합) 로 확정
  - 상세: 완료된 plan 이 이미 `VALIDATION_ERROR` + `details[]` shape 를 결정했고, 이 diff 는 그 결정을 따른다. 충돌 없음. 단 해당 결정이 완료 plan 에 묻혀 있어 추적이 어려우므로 메모 수준으로 기록.
  - 제안: 현 상태 유지 (정합). 추적 메모만.

- **[INFO]** file MIME/size/count 검증 미구현 명시 — 선행 plan 및 spec 과 정합
  - target 위치: `execution-engine.service.ts` `assertFormSubmissionValid` JSDoc "file MIME/size/count 검증은 Planned — 본 단계 미적용", spec `form.md §6.2` 마지막 행
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-form-gaps.md` 18-21행 (파일검증 cluster 미완료), `spec/4-nodes/6-presentation/4-form.md §1.5` (Planned 표기)
  - 상세: diff 가 file 검증을 의도적으로 제외한 것은 plan 의 "파일검증 cluster 별도 PR 권장" 방침과 spec 의 "Planned" 표기와 일치한다. 충돌 없음.
  - 제안: 현 상태 유지.

## 요약

이 diff 는 form 노드 서버 측 필드 검증(`assertFormSubmissionValid`)을 publisher chokepoint 에 추가하고, `FormValidationError` 를 `400 VALIDATION_ERROR + details[]` 로 두 진입점(EIA REST, WS ack)에서 일관되게 매핑한다. 미해결 결정을 일방적으로 우회하는 충돌은 발견되지 않았다 — `VALIDATION_ERROR` 코드명과 `details[]` shape 는 완료된 `spec-fix-eia-token-error-codes` plan 에서 이미 확정됐고, file 검증 제외도 `spec-sync-form-gaps` plan 의 "파일검증 cluster 별도 PR" 방침과 일치한다. 유일한 WARNING 은 `spec-sync-form-gaps.md` 의 §4/§6.2 체크박스가 부분 완료 사실을 반영하지 않아 추적 정확도가 떨어진다는 점으로, plan 항목을 "비-file 완료 / file Planned" 로 분리 갱신해야 한다.

## 위험도

LOW
