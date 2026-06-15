### 발견사항

- **[INFO]** `MB_IN_BYTES` 상수가 backend 공개 export 와 frontend 로컬 상수로 이중 정의됨
  - target 신규 식별자: `export const MB_IN_BYTES = 1024 * 1024` (`codebase/backend/src/modules/chat-channel/shared/form-mode.ts:53`) + `const MB_IN_BYTES = 1024 * 1024` (`codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:64`)
  - 기존 사용처: main 브랜치 어디에도 `MB_IN_BYTES` 가 없었음 — 양쪽 모두 이번 변경이 최초 도입
  - 상세: 두 파일이 각각 독립적으로 동일 이름·동일 값(`1024 * 1024`)으로 정의한다. frontend 는 backend NestJS 모듈을 직접 import 할 수 없어 복제라고 코드 주석에 명시되어 있으며 의미 충돌은 없다. 그러나 향후 값 변경 시 두 곳을 동시 갱신해야 하는 암묵적 의존이 생긴다.
  - 제안: 현 상태로 허용 가능(same semantics, 빌드 분리 제약 때문). 공유 패키지 추출은 아키텍처 백로그 B-1 에 이미 추적 중이므로 별도 조치 불필요.

- **[INFO]** `DEFAULT_FILE_*` 상수 4종이 backend export 와 frontend module-level 로컬 상수로 이중 정의됨
  - target 신규 식별자: `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES` — backend `form-mode.ts` 에서 `export const` 로, frontend `dynamic-form-ui.tsx` 에서 파일 내부 `const` 로
  - 기존 사용처: main 브랜치에 존재하지 않음 — 이번 변경이 최초 도입
  - 상세: `MB_IN_BYTES` 와 동일 패턴. 이름과 값이 완전히 동일하고 의미 충돌은 없다. frontend 주석이 "spec §1 + 양쪽 미러를 함께 갱신"이라고 명시함.
  - 제안: 현 상태로 허용 가능. B-1 백로그 추적 중.

- **[INFO]** `validateFilesClient` (frontend) 와 `validateFileField` (backend) 의 역할 유사성 — 네이밍이 다른 영역에서 다른 이름을 사용
  - target 신규 식별자: frontend의 `validateFilesClient` (module-private), backend의 `validateFileField` (exported)
  - 기존 사용처: main 브랜치에 없음
  - 상세: 두 함수는 같은 논리(MIME→per-file size→total size→count 순서)를 수행하지만 이름이 다르다. `validateFilesClient`는 "클라이언트 UX 가드" 의도를, `validateFileField`는 "서버측 필드 단위 검증" 의도를 드러내므로 의미 혼선은 없다. 코드 주석이 서로를 참조하여 대칭임을 명시하고 있다.
  - 제안: 현 이름 체계가 역할 경계를 잘 드러냄. 변경 불필요.

- **[INFO]** `isPositiveFinite` 가 `form-mode.ts` 에서 비공개(unexported) 함수로 도입됨
  - target 신규 식별자: `function isPositiveFinite` (`codebase/backend/src/modules/chat-channel/shared/form-mode.ts:56`)
  - 기존 사용처: 이름이 같은 함수가 codebase 어디에도 없었음
  - 상세: `export` 되지 않으므로 모듈 외부 충돌 불가. 의미 충돌 없음.
  - 제안: 해당 없음.

충돌 항목 없음 요약:
- `validateScalarField`, `validateFileField`, `validateAllFields` — main 브랜치 `form-mode.ts` 에 없었던 신규 export. 기존 유일한 export는 `validateFormSubmission`이었으며 이는 유지됨(hooks.service.ts scalar-only 경로).
- `coerceFormSubmission` — 이번 변경으로 `execution-engine.service.ts`에서 삭제됨(private 함수). 다른 곳에서 사용 없었음. 삭제 후 잔류 참조 없음.
- i18n 키 4종(`formFileMimeRejected` 등) — main 브랜치 ko/editor.ts 및 en/editor.ts에 존재하지 않았음. 기존 키와 이름 충돌 없음.
- `FormModalField` 인터페이스 확장 필드(`allowedMimeTypes`, `maxFileSize`, `maxTotalSize`, `maxFiles`) — main 브랜치 types.ts에 없었음. frontend `FormField` 인터페이스에는 `allowedMimeTypes`, `maxFiles`가 이미 main 브랜치에 존재했으며, 이번 변경이 `maxFileSize`, `maxTotalSize`를 추가하는 것으로 확장만 수행함. 의미 충돌 없음.
- `errors`, `handleError`, `setErrors` — DynamicFormUI 컴포넌트에 main 브랜치 기준 해당 상태/핸들러가 없었음. 신규 추가이며 충돌 없음.

### 요약

이번 변경이 도입하는 신규 식별자(`validateScalarField`, `validateFileField`, `validateAllFields`, `MB_IN_BYTES`, `DEFAULT_FILE_*` 4종, `validateFilesClient`, `renderFileField`, `isPositiveFinite`, i18n 키 4종, `FormModalField` 확장 필드 4종)는 기존 codebase 어디에도 다른 의미로 사용되고 있지 않다. `MB_IN_BYTES`와 `DEFAULT_FILE_*` 상수가 backend-export 와 frontend-local 로 이중 정의되어 있으나, 이는 빌드 분리 제약 때문임이 주석에 명시되어 있고 값과 의미가 동일하므로 실질적 충돌이 아니다. 기존 `validateFormSubmission`(scalar 전용 경로, hooks.service 사용) 및 `coerceFormValue`는 이름 변경 없이 유지되거나 깔끔하게 제거되었으며 잔류 참조가 없다.

### 위험도

NONE
