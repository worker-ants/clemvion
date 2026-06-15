# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `renderField` 시그니처에 `onError`/`t` 파라미터 추가 — 내부 함수, 호출자 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `renderField` 함수
- 상세: `renderField` 는 동일 파일(`dynamic-form-ui.tsx`) 내부에서만 호출되는 모듈 비공개 함수다. 파라미터가 `(field, idx, value, onChange)` 4개에서 `(field, idx, value, onChange, onError, t)` 6개로 늘었으나, 모든 호출부(`DynamicFormUI` 컴포넌트 내 단일 호출 지점)가 동일 변경에서 함께 업데이트되었다. 공개 API 경계가 없으므로 외부 호출자 영향은 없다.
- 제안: 해당 없음. 변경이 올바르게 단일 파일 내에서 완결된다.

### [INFO] `validateFormSubmission` 내부 구현 변경 — 공개 시그니처 및 외부 동작 불변
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission`
- 상세: 내부 루프가 인라인 scalar 로직에서 `validateScalarField(value, def)` 위임으로 리팩터링되었다. 함수 시그니처(`fields: Record<string,string>, defs: FormModalField[]`)·반환 타입(`{field,message}|null`)·동작(scalar 검증 FIRST 오류)은 완전히 동일하다. `hooks.service.ts` 등 기존 호출자는 수정 없이 동작을 유지한다.
- 제안: 해당 없음.

### [INFO] `coerceFormSubmission` 삭제 — 내부 private static 메서드, 외부 계약 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission` 삭제, `assertFormSubmissionValid` 리팩터
- 상세: `coerceFormSubmission` 은 `private static` 메서드였으므로 클래스 외부에서 직접 호출 불가능했다. 삭제에 따른 외부 계약 변경은 없다. 그 기능(formData → `Record<string,unknown>` 단순화)은 `assertFormSubmissionValid` 인라인 타입 단언으로 대체되었다. 이전에 전체 필드를 string 맵으로 선변환 후 검증하던 2-패스 구조가 file/scalar 분기 단일 패스로 바뀐 것이며, 외부로 노출되는 `assertFormSubmissionValid`의 시그니처(`executionId: string, formData: unknown`)는 변경되지 않았다.
- 제안: 해당 없음.

### [INFO] `FormModalField` 인터페이스 확장 — 선택적 필드 추가, 기존 사용자 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/types.ts` — `FormModalField` 인터페이스
- 상세: `allowedMimeTypes?`, `maxFileSize?`, `maxTotalSize?`, `maxFiles?` 가 모두 `?`(optional)로 추가되었다. TypeScript 구조적 타이핑 특성상 기존 `FormModalField` 객체 리터럴을 넘기는 모든 호출자는 추가 필드를 생략해도 타입 오류가 발생하지 않는다. 기존 코드가 이 인터페이스를 destructure·spread 하더라도 알려지지 않은 선택적 필드는 `undefined`로 처리되어 런타임 부작용이 없다.
- 제안: 해당 없음.

### [INFO] `extractFormFields` — file 필드에만 기본값 주입, 비-file 필드 상태 불변 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields` 내 file 기본값 주입 블록
- 상세: 기본값 주입은 `if (type === 'file')` 분기 내에서만 일어난다. 비-file 필드는 기존 동작 그대로 유지된다(Principle 1.1). `DEFAULT_FILE_ALLOWED_MIME_TYPES` 가 `readonly` 배열로 선언되어 있고, 실제 대입 시 `[...DEFAULT_FILE_ALLOWED_MIME_TYPES]` 스프레드로 새 배열을 생성하므로 상수 원본이 변경될 위험이 없다. `maxFileSize`, `maxTotalSize`, `maxFiles`는 원시값(number)이므로 복사 문제 없음.
- 제안: 해당 없음.

### [INFO] `DynamicFormUI` — `errors` state 추가, 기존 `values` state 및 `onSubmit` 콜백 동작 불변
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `DynamicFormUI` 컴포넌트
- 상세: 파일 검증 에러를 추적하는 `errors: Record<string, string>` state가 신규 추가되었다. 이 state는 UI에서 에러 메시지 표시에만 사용되며, `handleSubmit`이 호출할 때 `onSubmit(values)`는 `errors`와 무관하게 기존과 동일하게 `values`만 전달한다. 따라서 부모 컴포넌트가 받는 데이터 형태는 변경되지 않는다. `handleError` 함수는 이미 `prev[name] === undefined` 조기 반환으로 불필요한 state 업데이트를 방지하고 있어 불필요한 리렌더를 유발하지 않는다.
- 제안: 해당 없음.

### [INFO] file 검증 실패 시 `input.value = ""` DOM 조작 — 의도된 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `renderField` 내 `case "file":` onChange 핸들러
- 상세: MIME/크기/개수 위반 시 `input.value = ""`로 HTMLInputElement의 value를 직접 초기화한다. 이는 검증 실패한 파일 선택을 브라우저 수준에서도 취소하기 위한 의도된 DOM 부작용이다. 동시에 `onChange([])` 미호출(early return)로 `values` state도 갱신하지 않아 제출 시 빈 배열이 전달되는 일관된 동작을 보장한다. React controlled input이 아닌 file input은 `value`를 직접 쓸 수 없으므로(읽기 전용 특성) 이 방식이 유일하게 유효한 초기화 방법이다.
- 제안: 해당 없음. 의도된 설계이며 동작이 명확하다.

### [INFO] `useT` hook 도입 — 컴포넌트 렌더링 컨텍스트 의존성 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `import { useT }` 추가 및 `DynamicFormUI` 내 `const t = useT()`
- 상세: `useT` 는 React hook이므로 `DynamicFormUI` 가 반드시 React 렌더링 컨텍스트(함수 컴포넌트 또는 커스텀 hook) 안에서만 사용되어야 한다는 규칙은 이미 이 컴포넌트가 함수 컴포넌트이므로 자연히 충족된다. `t` 함수는 `renderField`에 파라미터로 전달되어 순수 함수처럼 사용된다. hook 자체가 전역 state를 변경하거나 외부 부작용을 일으키지 않는다(i18n context read-only access).
- 제안: 해당 없음.

### [INFO] i18n 딕셔너리 추가 — 기존 키 불변, 추가 전용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/lib/i18n/dict/en/editor.ts`, `ko/editor.ts`
- 상세: `formFileMimeRejected`, `formFileSizeExceeded`, `formFileTotalExceeded`, `formFileCountExceeded` 4개 키가 `runResults` 블록에 추가되었다. 기존 키는 삭제·변경되지 않았다. 동일 키명이 다른 네임스페이스에 존재하는지 확인이 필요하나, `editor.runResults` 네임스페이스 내 이름이 충분히 구체적이어서 충돌 가능성이 낮다.
- 제안: 해당 없음.

---

## 요약

이번 변경에서 의도하지 않은 부작용은 발견되지 않았다. 주요 변경들(공개 함수 시그니처 불변·`validateFormSubmission` 외부 동작 유지·`coerceFormSubmission` 삭제는 private 메서드·`FormModalField` optional 필드 추가만)은 모두 기존 호출자에 투명하다. `extractFormFields`의 file 기본값 주입은 `readonly` 상수 스프레드 복사로 상수 변이 위험이 없고 비-file 필드는 영향받지 않는다. 프론트엔드의 `input.value = ""` DOM 조작은 file input 특성상 불가피한 의도된 부작용이며 React state와 일관성을 유지한다. 전역 변수 도입·파일시스템 조작·환경 변수 접근·네트워크 호출·이벤트 시스템 변경은 없다.

## 위험도

NONE

STATUS: SUCCESS
