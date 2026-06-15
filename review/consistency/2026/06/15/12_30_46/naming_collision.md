## 발견사항

충돌 또는 경고로 분류할 사항이 없다. 각 신규 식별자를 관점별로 검토한 결과는 아래와 같다.

### [INFO] `MB_IN_BYTES` 상수가 frontend/backend 양쪽에 module-private 으로 중복 선언됨
- target 신규 식별자: `MB_IN_BYTES` (backend `form-mode.ts` export, frontend `dynamic-form-ui.tsx` 모듈 private)
- 기존 사용처: 없음 — main 브랜치에서 두 파일 모두 해당 상수 없음
- 상세: backend 는 `export const MB_IN_BYTES = 1024 * 1024` 로 공개하고, frontend 는 같은 값을 파일-로컬 `const MB_IN_BYTES`(비export) 로 별도 선언한다. 테스트 파일(`dynamic-form-ui.test.tsx`)도 `const MB = 1024 * 1024` 로 또 다른 이름으로 선언한다. 의미·값이 모두 동일하고 이름 충돌(동일 스코프 중복)은 없으나, 3중 미러가 형성돼 장기적으로 값 drift 가 생길 수 있다. 주석에서 스스로 "런타임 중립 공유 패키지로 추출은 아키텍처 백로그 B-1" 로 추적 중임을 인정하고 있다.
- 제안: 현 상태로 충돌 위험 없음. 다만 단일 shared 패키지로의 추출 전까지 backend `form-mode.ts` 의 `DEFAULT_FILE_*` + `MB_IN_BYTES` 를 유일한 값 SoT 로 명시하고, frontend 와 test 의 복제본에 이를 명시하는 주석이 이미 존재한다 — 추가 조치 불필요.

---

### 요구사항 ID 충돌 (관점 1)

이번 diff 는 새 요구사항 ID(예: `ND-FM-*`, `FORM-*` 패턴 ID)를 부여하지 않는다. 코드 내 section 참조(`§1`, `§6.2`, `§1.5`, `Principle 1.1`)는 기존 `spec/4-nodes/6-presentation/4-form.md` 의 동일 절을 그대로 가리킨다 — 의미 충돌 없음.

### 엔티티/타입명 충돌 (관점 2)

- `validateScalarField`, `validateFileField` — main 브랜치에 존재하지 않는 신규 함수. `validateFormSubmission` 은 기존 함수를 리팩터링으로 내부적으로 `validateScalarField` 를 위임 호출하도록 변경됐으며 공개 시그니처는 유지된다. `hooks.service.ts` 는 여전히 `validateFormSubmission` 을 호출하므로 외부 충돌 없음.
- `FormModalField` 에 추가된 4 필드(`allowedMimeTypes`, `maxFileSize`, `maxTotalSize`, `maxFiles`) — `form.schema.ts` 의 `formFieldSchema` 에 이미 동일 이름·동일 타입으로 V072 이전부터 존재. 인터페이스 확장이 스키마와 일치하므로 충돌 없음.
- `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES` — 코드베이스 전체에서 신규. 유사 이름의 기존 상수 없음.

### API endpoint 충돌 (관점 3)

이번 diff 에 신규 endpoint 없음.

### 이벤트/메시지명 충돌 (관점 4)

이번 diff 에 신규 webhook·queue·SSE 이벤트명 없음.

### 환경변수·설정키 충돌 (관점 5)

이번 diff 에 신규 ENV var 또는 config key 없음.

### i18n 키 충돌 (확장 관점)

`editor.runResults.{formFileMimeRejected, formFileSizeExceeded, formFileTotalExceeded, formFileCountExceeded}` 4개 키 — main 브랜치의 `en/editor.ts`, `ko/editor.ts` 양쪽에 기존에 존재하지 않음. `runResults` 네임스페이스 내 인접 키(`configMissing` 등)와 명명 패턴이 일관(camelCase, `formFile` prefix)하다. 충돌 없음.

### 파일 경로 충돌 (관점 6)

이번 diff 에 신규 파일 없음. 기존 파일 수정만 포함.

---

## 요약

이번 diff 가 도입하는 신규 식별자(`validateScalarField`, `validateFileField`, `DEFAULT_FILE_*`, `MB_IN_BYTES`, `validateFilesClient`, i18n 4개 키, `FormModalField` 필드 확장)는 기존 코드베이스 및 spec 어디에서도 다른 의미로 사용 중이지 않다. `FormModalField` 의 4개 file 제약 필드는 `form.schema.ts` 에 이미 동명·동타입으로 존재해 인터페이스 확장이 스키마와 정합하며, `validateFormSubmission` 의 공개 시그니처가 유지돼 `hooks.service.ts` 의 기존 호출자가 영향 받지 않는다. `MB_IN_BYTES` 가 backend export 와 frontend 모듈-private 두 곳에 선언되나 스코프가 분리돼 있고 값과 의미가 동일하며 미러 주석이 명시돼 있다. 신규 식별자 충돌 관점에서 CRITICAL 또는 WARNING 등급 항목이 없다.

## 위험도
NONE
