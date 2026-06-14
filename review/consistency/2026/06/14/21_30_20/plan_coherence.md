# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target scope: `.impldone-scope` (spec/4-nodes/6-presentation/4-form.md + 구현 diff)

---

## 발견사항

### [INFO] spec-sync-form-gaps.md 미해소 항목이 target 범위에 명시되어 있음
- target 위치: `spec/4-nodes/6-presentation/4-form.md §1.5 / §6.2` 본문 내 "(Planned)" 표기 및 `plan/in-progress/spec-sync-form-gaps.md 추적` 참조
- 관련 plan: `plan/in-progress/spec-sync-form-gaps.md` — `validation.min`/`max`/`pattern` 검증, file MIME/크기/개수 검증, §1.5 클라이언트 검증, §1 file 기본값
- 상세: 구현(diff)은 `continueExecution` chokepoint 에서 필수/type(email·number)/minLength·maxLength/select·radio 검증을 구현했다. `spec-sync-form-gaps.md` 에 이미 `[x]` 완료 체크로 반영되어 있고 미해소 항목(validation.min/max/pattern, file 검증, 클라이언트 검증, file 기본값)은 "잔존" 으로 표기되어 있다. target spec 본문도 해당 항목들을 "(Planned)" + plan 참조로 정확히 표기하고 있다. plan 과 target 이 정합.
- 제안: 조치 불요. plan 체크박스가 이미 구현 완료 항목과 잔여 항목을 정확히 반영하고 있음.

### [INFO] VALIDATION_ERROR / INVALID_FIELD 에러 코드 신설 — spec-fix-eia-token-error-codes plan 완료본과 정합
- target 위치: diff `codebase/backend/src/nodes/core/error-codes.ts` 에 `VALIDATION_ERROR` / `INVALID_FIELD` 추가
- 관련 plan: `plan/complete/spec-fix-eia-token-error-codes.md` (완료, 2026-06-14) + `spec/conventions/error-codes.md` §1 "시스템 전역 공용 코드는 prefix 없이 쓰는 기존 범주"
- 상세: `spec-fix-eia-token-error-codes.md` 의 동반 EIA nit 정비에 `VALIDATION_FAILED`→`VALIDATION_ERROR` (+details 배열) 변경이 반영되어 있고, EIA spec(`14-external-interaction-api.md`) 에 `VALIDATION_ERROR` + `INVALID_FIELD` 가 이미 명시되어 있다(§5.1 에러 표, §8 idempotency R8). `error-codes.md` 규약의 "시스템 전역 공용 코드는 prefix 없이" 도 충족. 충돌 없음.
- 제안: 조치 불요.

### [INFO] idempotency.interceptor.ts 주석 VALIDATION_FAILED → VALIDATION_ERROR 정정 — EIA spec 갱신과 정합
- target 위치: diff `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 주석 정정
- 관련 plan: `plan/complete/spec-fix-eia-token-error-codes.md` — "VALIDATION_FAILED→VALIDATION_ERROR" 코드 일관성 정비
- 상세: 코드 주석의 `VALIDATION_FAILED` → `VALIDATION_ERROR` 정정은 plan complete 의 EIA nit 정비와 동일 방향이며 충돌 없음.
- 제안: 조치 불요.

---

## 요약

구현 변경(submit_form field-level 검증, FormValidationError, EIA/WS/UI 3 경로 400 응답)은 `plan/in-progress/spec-sync-form-gaps.md` 에서 추적하는 §4/§6.2 미구현 항목을 정확히 이행한 것이며, plan 체크박스가 이미 완료/잔여를 올바르게 구분하고 있다. `spec-fix-eia-token-error-codes` plan 은 완료 상태이고, VALIDATION_ERROR·INVALID_FIELD 코드 신설은 spec·error-codes 규약과 정합한다. 미해결 결정과의 충돌, 선행 plan 미해소, 후속 항목 누락 모두 발견되지 않았다.

## 위험도

NONE
