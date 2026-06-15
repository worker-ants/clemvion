# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/6-presentation/4-form.md` — 구현 완료 후 검토 (diff-base=origin/main)
검토 일시: 2026-06-15

---

## 발견사항

### [INFO] 백엔드 검증 메시지의 한국어 직접 박기 — 기존 패턴 승계이나 주의 요함
- **target 위치**: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFileField` 함수 내 반환 메시지 리터럴 (`'필수 입력 항목입니다.'`, `'허용되지 않은 파일 형식입니다.'`, `` `파일 크기는 ${def.maxFileSize}MB 이하여야 합니다.` `` 등 4종)
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 3 — "❌ 금지: 백엔드 응답에 한국어 문자열을 직접 박는 행위 (지역화 불가능 상태)"
- **상세**: 신규 추가된 `validateFileField`의 4개 에러 메시지(MIME 거부·단일 크기 초과·합계 크기 초과·개수 초과)가 한국어 문자열 리터럴로 직접 박혀 있다. 이는 i18n-userguide.md Principle 3이 금지하는 패턴이다.
  - 단, `validateScalarField`(구 `validateFormSubmission`)에 이미 동일 패턴의 한국어 직접 박기가 존재하며(`'필수 입력 항목입니다.'`, `'올바른 이메일 형식이 아닙니다.'` 등), 이번 구현은 그 기존 패턴을 일관되게 승계한 것이다. 규약 위반이 신규 도입된 것이 아니라 기존 technical debt 의 연장선상에 있다.
- **제안**: 이번 diff 의 직접 책임은 낮다 (기존 패턴 준수). 단, 신규 메시지들도 기존 scalar 메시지와 동일한 debt 상태임을 기록한다. 향후 scalar 메시지 i18n화 트랙과 함께 `ERROR_KO` 또는 별도 매핑 테이블로 정리하는 것이 적절하다.

---

### [INFO] 프론트엔드 에러 메시지 i18n 키 패턴 — 규약 부합 확인됨
- **target 위치**: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `validateFilesClient` 함수에서 `t("editor.runResults.formFileMimeRejected")` 등 4개 키 사용; `dict/ko/editor.ts` 및 `dict/en/editor.ts` 동시 추가
- **위반 규약**: 없음. `spec/conventions/i18n-userguide.md` Principle 1 (TSX 하드코딩 금지) · Principle 2 (ko/en parity) 를 모두 준수한다.
- **상세**: frontend 측 file 검증 에러 메시지는 dict 키를 통해 `t()` 호출로 노출하고, ko·en 사전 양쪽에 동일 PR 안에서 추가되었다. Principle 1·2 정합.
- **제안**: 없음.

---

### [INFO] `spec/4-nodes/6-presentation/4-form.md` 문서 구조 — 3섹션 규약 준수
- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` (본 검토의 scope 문서)
- **위반 규약**: 없음. CLAUDE.md 에서 권장하는 "Overview / 본문 / Rationale" 3섹션 구성을 따르고 있다(`## 1.` ~ `## 7.` 본문 + `## Rationale` 존재).
- **상세**: 파일명(`4-form.md`)은 번호 prefix 방식으로 디렉토리 내 순서를 표현하며 `_product-overview.md` 별도 파일을 두지 않고 단일 파일로 구성된 구조다 — 이는 해당 spec 영역의 기존 패턴과 일치한다.
- **제안**: 없음.

---

### [INFO] 에러 코드 `VALIDATION_ERROR` / `INVALID_FIELD` 명명 — 규약 준수
- **target 위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `FormValidationError.code = 'VALIDATION_ERROR'`, `details[].code = 'INVALID_FIELD'`
- **위반 규약**: 없음. `spec/conventions/error-codes.md` §1 의 의미 기반 명명(조건의 의미를 기술) 및 `UPPER_SNAKE_CASE` 표기를 따른다. `VALIDATION_ERROR` 는 §1 의 "시스템 전역 공용 코드 / prefix 없음" 범주에 해당한다.
- **상세**: 이번 diff는 `FormValidationError`의 JSDoc 설명(검증 대상 목록)만 갱신했을 뿐 에러 코드 값을 변경하지 않는다. 기존 규약 코드 그대로 유지.
- **제안**: 없음.

---

### [INFO] 함수 명명 — `validateScalarField` / `validateFileField` / `validateAllFields` 식별자
- **target 위치**: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — 신규 export 함수 3종
- **위반 규약**: 해당하는 명명 규약 위반 없음. 프로젝트 전체의 camelCase 함수 명명 컨벤션과 일치하며, 기존 `validateFormSubmission` 패턴과 동일 형식이다.
- **상세**: `validateScalarField`(단일 비-file 필드), `validateFileField`(file 필드 metadata 배열), `validateAllFields`(전 필드 단일 패스) 는 이름이 기능을 명확히 기술하며 의미 중복이나 오해 소지가 없다.
- **제안**: 없음.

---

### [INFO] frontend 상수 중복 선언 — 규약 주석에 근거 명시됨
- **target 위치**: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES`, `MB_IN_BYTES` 상수가 backend `form-mode.ts` 와 동일 값으로 복제 선언
- **위반 규약**: 단일 진실 원칙(CLAUDE.md) 위반 가능성 — 단, 코드 주석에 이 사실과 이유(frontend/backend 빌드 분리 + 아키텍처 백로그 B-1)를 명시하고 있어 의도적 결정임이 문서화되어 있다.
- **상세**: 주석에 "변경 시 spec §1 + 양쪽 미러를 함께 갱신" 이라는 invariant 와 미래 개선 경로(공유 패키지 추출, 아키텍처 백로그 B-1)가 기록되어 있다. spec conventions 문서 자체에 이 패턴을 명시적으로 금지하는 항목은 없다.
- **제안**: 현 상태를 유지하되, 향후 추출 시 spec §1 상수 섹션과 공유 패키지를 단일 SoT 로 묶는 것을 권장한다.

---

## 요약

이번 diff(`spec/4-nodes/6-presentation/4-form.md` 구현 완료 — form file 검증 server/client 양측 추가)는 정식 규약 관점에서 전반적으로 양호하다. 프론트엔드 i18n 키 처리(Principle 1·2)와 에러 코드 명명(error-codes.md §1), 문서 구조(3섹션)는 모두 규약에 부합한다. 발견된 항목 중 실질적 규약 거리가 있는 것은 백엔드 `validateFileField`의 한국어 메시지 직접 박기(i18n-userguide.md Principle 3)뿐이나, 이는 `validateScalarField`(구 `validateFormSubmission`)에 이미 존재하던 기술 부채를 일관되게 승계한 것으로 신규 위반 패턴 도입이 아니다. frontend 상수 복제도 의도적 결정이며 주석에 근거가 명시되어 있다. 모든 발견사항은 INFO 등급으로, 채택을 차단할 CRITICAL·WARNING 은 없다.

---

## 위험도

LOW
