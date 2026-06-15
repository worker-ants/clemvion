# 부작용(Side Effect) 리뷰

## 발견사항

### **[WARNING]** `validateFormSubmission` 시그니처 유지 vs. `hooks.service.ts` 호출 불일치 위험

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 470
- 상세: 이번 diff 에서 `validateFormSubmission` 은 **그대로 유지**되고 내부적으로 `validateScalarField`를 위임하도록 리팩터링됐다. `hooks.service.ts` 는 여전히 `validateFormSubmission(filteredFields as Record<string, string>, state.pendingFormModal!.fields)` 를 호출하고 있으며 이 시그니처는 변경되지 않았다. 따라서 컴파일 오류는 없지만, **`hooks.service.ts` 경로는 `file` 타입 필드를 처리하지 않는다** — `validateFormSubmission`은 `Record<string, string>` scalar 맵만 받아 scalar 루프를 돌 뿐 `validateFileField`를 호출하지 않는다. chat-channel modal 경로(Discord 등)는 원래 `file` 미수용이라 의도된 제한이지만, 주석이나 경고가 없으면 향후 유지보수자가 `file` 필드 검증이 `hooks.service.ts` 경로에서도 적용된다고 오해할 수 있다.
- 제안: `validateFormSubmission`의 JSDoc 에 "file 필드는 chat-channel modal 미수용이므로 이 함수는 scalar 전용이다. EIA 경로(`assertFormSubmissionValid`)만 `validateFileField`를 호출한다." 를 명시. 또는 `hooks.service.ts` 호출 위치에 주석 추가.

---

### **[WARNING]** 프론트엔드와 백엔드 기본값 상수 복제 — 동기화 편차 위험

- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` (라인 30-53)
  - `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` (라인 1026-1045)
- 상세: `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES`, `MB_IN_BYTES` 가 프론트엔드에 그대로 복제됐다. 주석에 "backend `form-mode.ts` 의 DEFAULT_FILE_* 상수와 값이 일치해야 한다" 고 명시했으나 타입 시스템·빌드 파이프라인이 이 동기를 강제하지 않는다. 미래에 어느 한 쪽만 수정해도 런타임 오류 없이 클라이언트/서버 검증 결과가 달라지는 조용한 부작용이 생긴다.
- 제안: 공유 상수를 `packages/` 하위 공용 패키지로 추출하거나, 프론트엔드가 서버 응답(`extractFormFields` 결과)에서 받은 값만 사용하도록 설계 변경. 단기적으로는 적어도 통합 테스트로 두 값의 동치를 확인.

---

### **[INFO]** `coerceFormSubmission` private 메서드 제거 — 테스트에서 cast 접근 여부 확인

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: 이번 diff 에서 `private static coerceFormSubmission` 을 삭제했다. spec 파일 내에 `// ExecutionEngineService 의 private static 메서드를 cast 로 접근` 주석과 `coerceFormValue 타입 분기` describe 블록이 남아 있는데, `coerceFormValue`는 유지됐으므로 문제없다. 그러나 `coerceFormSubmission` 을 직접 테스트하던 케이스가 있었다면 해당 케이스가 무음으로 사라질 수 있다. diff 내 해당 describe 블록에는 `coerceFormSubmission` 호출이 없어 직접적 문제는 없으나, 제거 이력을 확인하는 것이 좋다.
- 제안: `coerceFormSubmission` 관련 기존 테스트 케이스가 완전히 정리됐는지 git 로그로 확인.

---

### **[INFO]** `renderField` 시그니처 확장 — 비-file 필드 경로 무조건 `onError` 추가

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` 라인 100, 378
- 상세: `renderField` 에 `onError` 와 `t` 가 추가됐다. 이 함수는 컴포넌트 내부 전용(`export function DynamicFormUI` 내부 로직)이라 외부 API 노출 없음. 다만 비-file 필드 렌더링 분기들은 `onError`를 전혀 호출하지 않으며 기존 onChange 방식과 동일하게 동작한다. `onError(null)` 클리어 호출도 비-file 쪽에서는 없으므로, 이론상 file → 비-file 필드 전환 같은 edge 케이스에서 `errors` 상태가 잔류할 수 있지만, 현재 `DynamicFormUI`에서 필드 타입이 런타임에 동적으로 바뀌지 않으므로 실질적 문제는 없다.
- 제안: 특이사항 없음. 다만 향후 `renderField`가 컴포넌트 외부로 노출될 경우 `onError` 파라미터 계약을 문서화.

---

### **[INFO]** `DEFAULT_FILE_ALLOWED_MIME_TYPES` readonly 배열 — spread 복사 적용 여부

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` 라인 289
- 상세: `extractFormFields`에서 `mimes && mimes.length > 0 ? mimes : [...DEFAULT_FILE_ALLOWED_MIME_TYPES]` 로 readonly 배열을 spread 복사하여 `FormModalField.allowedMimeTypes?: string[]`(mutable) 에 할당한다. 이는 원본 상수를 보호하는 올바른 방어적 복사다. 외부가 반환된 배열을 변경해도 상수가 오염되지 않는다.
- 제안: 현재 구현 정상. 추가 조치 불필요.

---

## 요약

이번 변경은 순수 함수(pure function) 중심으로 설계됐으며 전역 상태 변경, 파일시스템·네트워크 부작용, 환경 변수 접근은 없다. 가장 주목할 위험은 두 가지다. 첫째, `validateFormSubmission`이 그대로 유지되면서 `hooks.service.ts` 경로는 여전히 `file` 필드 검증을 하지 않는데 이 의도가 코드상 명확히 주석처리되지 않아 향후 혼동 가능성이 있다. 둘째, 프론트엔드와 백엔드에 동일 기본값 상수가 복제됐고 빌드 시스템이 동기를 강제하지 않아 한 쪽만 수정 시 조용한 불일치가 발생할 수 있다. 그 외 시그니처 변경(함수 분리·`renderField` 확장)은 모두 내부 범위에 국한되거나 기존 호환성을 유지한다.

## 위험도

LOW
