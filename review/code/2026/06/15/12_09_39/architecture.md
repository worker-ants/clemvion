# 아키텍처(Architecture) 리뷰 결과

**리뷰 대상**: form file validation cluster (A-2) — type:'file' 서버측 + 클라이언트 검증 + 공유 기본값
**리뷰 일시**: 2026-06-15

---

## 발견사항

### **[WARNING]** DEFAULT_FILE_* 상수 중복 정의 — 단일 진실 원칙 위반
- **위치**: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` (L239–262) 및 `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` (L1026–1045)
- **상세**: `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES`, `MB_IN_BYTES` 가 백엔드와 프런트엔드에 각각 별도 복사본으로 존재한다. 14개 MIME 목록이 두 파일에 그대로 중복 선언되어 있다. 코드 주석조차 "backend `form-mode.ts` 의 DEFAULT_FILE_* 상수와 값이 일치해야 한다"고 수동 동기화 의무를 명시하고 있다. 이는 DRY 원칙 및 단일 책임 원칙(SRP) 관점에서 취약점이다. 향후 MIME 허용 목록 변경 시 두 파일을 동시에 수정해야 하며, 한쪽만 바뀌면 서버/클라이언트 검증 불일치가 발생한다.
- **제안**: 프런트엔드와 백엔드가 공유 가능한 패키지(예: `packages/` 하위 공유 라이브러리)에 상수를 추출하거나, 백엔드 API 응답에 field 정의(allowedMimeTypes 포함)를 함께 전달하여 프런트엔드가 직접 기본값을 하드코딩하지 않도록 설계를 개선한다. 단기적으로는 두 파일이 같은 레포지터리에 있으므로 심볼릭 임포트 경로가 없다면 최소한 공통 상수 파일을 `packages/` 또는 `codebase/shared/` 에 배치하고 양쪽이 동일 소스를 임포트하도록 리팩터한다.

### **[WARNING]** `validateFormSubmission` 공개 API 시그니처 유지 vs. 내부 책임 분리 혼재
- **위치**: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `validateFormSubmission` 함수
- **상세**: `validateFormSubmission` 은 `validateScalarField` 를 래핑하는 얇은 루프로 남아 있으며, JSDoc 에 "chat-channel modal 경로 — file 필드는 modal 미수용이라 도달하지 않으므로 scalar 만 검사" 라고 명시되어 있다. 그런데 `execution-engine.service.ts` 는 이 함수를 직접 호출하지 않고 `validateScalarField` + `validateFileField` 를 별도로 호출하는 단일 루프를 직접 구성한다. 즉, 이 레이어에는 두 가지 "검증 조합 방식"이 공존한다: (1) `validateFormSubmission` (scalar 전용 루프 = chat-channel modal 경로), (2) execution-engine 자체 루프 (scalar + file). 이는 서로 다른 소비자가 같은 도메인 로직을 다른 방식으로 호출하는 구조로, 향후 검증 규칙 추가 시 두 경로 모두 수정해야 한다는 점이 명확하지 않다.
- **제안**: 두 경로의 의도적 분리(chat-channel modal 은 file 미수용)가 아키텍처적으로 타당하다면, `validateFormSubmission` 의 JSDoc 에 이 함수가 "file 제외 경로 전용"임을 더 명시적으로 표시하고, execution-engine 루프를 별도 함수(`validateAllFields` 등)로 추출하여 두 경로가 각각 적절한 공개 API 를 갖도록 한다. 이렇게 하면 "scalar-only path" vs "all-field path" 의 모듈 경계가 명확해진다.

### **[INFO]** `renderField` 함수 시그니처 확장 — 파라미터 증가로 인한 응집도 저하 위험
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `renderField` 함수
- **상세**: 이번 변경으로 `renderField(field, idx, value, onChange, onError, t)` 로 파라미터가 6개가 되었다. 파라미터 증가 자체는 문제가 아니지만, `onError` 콜백과 `t(TFunction)` 가 file 필드에만 사용되면서 함수 내부에서 타입에 따라 분기되고 있다. 순수 렌더링 함수가 에러 상태 관리 콜백과 i18n 의존성을 함께 받는 구조는 단일 책임 원칙(SRP) 관점에서 책임이 섞이고 있음을 나타낸다.
- **제안**: file 타입 렌더링을 별도의 `renderFileField` 컴포넌트로 분리하여 file 전용 에러 상태와 검증 로직을 캡슐화하는 것을 고려한다. 단기적으로는 현재 구조가 파일 규모상 관리 가능한 수준이므로 즉각 리팩터링 의무는 아니다.

### **[INFO]** `assertFormSubmissionValid` 내 `coerceFormSubmission` 제거 후 인라인 타입 단언
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4340 부근
- **상세**: `coerceFormSubmission` 삭제 후, `formData` 를 `(formData as Record<string, unknown>)` 로 직접 캐스팅하는 인라인 로직이 `assertFormSubmissionValid` 안에 남았다. 기존에는 별도 private 메서드가 이 변환을 담당해 책임이 명확했으나, 이제 호출 사이트에서 직접 처리하고 있다. 코드 규모는 줄었지만, formData 의 타입 안전성 확보 책임이 분산된 형태다.
- **제안**: 현재 구조는 단순화 측면에서 합리적이다. 단, 미래에 formData 정규화 로직이 다시 필요해지면 private 헬퍼로 격리하도록 주석이나 TODO 를 남기는 것이 유지보수성에 도움이 된다.

### **[INFO]** 클라이언트 검증(`validateFilesClient`)과 서버 검증(`validateFileField`)의 검증 순서 미러링 — 명시적 계약 부재
- **위치**: `dynamic-form-ui.tsx` `validateFilesClient` (L1059–1091) vs `form-mode.ts` `validateFileField`
- **상세**: 두 함수는 MIME → per-file size → total size → count 순으로 동일하게 구현되어 있다. 이 순서는 spec §1.5 에 명시된 것이지만, 코드 수준에서 두 함수가 "같은 순서를 따라야 한다"는 명시적 계약(공통 상수·공통 타입 등)이 없다. 향후 한쪽만 순서가 바뀌면 사용자가 클라이언트와 서버에서 서로 다른 에러 메시지를 보는 상황이 발생할 수 있다.
- **제안**: 검증 순서를 주석 또는 공통 타입으로 명시적으로 연결한다. 이상적으로는 앞서 언급한 상수 공유 패키지에 검증 함수 자체를 공유하는 것이 최선이다.

---

## 요약

이번 변경은 `validateScalarField` 추출, `validateFileField` 신규 추가, `extractFormFields` 의 file 기본값 주입을 통해 scalar 검증과 file 검증의 책임을 명확히 분리하고 `validateFormSubmission` 의 단일 책임을 유지하는 방향으로 구조를 개선했다. 레이어 책임 분리(비즈니스 로직 = `form-mode.ts`, 오케스트레이션 = execution-engine, 프레젠테이션 = `dynamic-form-ui.tsx`)도 전반적으로 잘 준수되고 있다. 주요 아키텍처 위험은 백엔드·프런트엔드에 동일한 14개 MIME 목록과 숫자 상수가 중복 선언되어 수동 동기화 의무가 생긴 점으로, 단일 진실 원칙을 위반하여 향후 편집 오류 시 서버/클라이언트 검증 불일치 버그로 이어질 수 있다. 이 점을 제외하면 모듈 경계, 결합도, 확장성은 합리적인 수준이다.

---

## 위험도

LOW
