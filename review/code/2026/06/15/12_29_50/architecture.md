# 아키텍처(Architecture) 리뷰 결과

**리뷰 대상**: form file validation cluster (A-2) — type:'file' 서버측 + 클라이언트 검증 + 공유 기본값
**리뷰 일시**: 2026-06-15

---

## 발견사항

### **[WARNING]** DEFAULT_FILE_* 상수 중복 정의 — 단일 진실 원칙 위반 (DRY)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` (L30–53) 및 `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` (L840–859)
- **상세**: `DEFAULT_FILE_ALLOWED_MIME_TYPES`(14종 MIME), `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES`, `MB_IN_BYTES` 가 백엔드와 프론트엔드에 각각 리터럴 복사본으로 선언된다. 프론트엔드 JSDoc 이 "backend form-mode.ts 의 DEFAULT_FILE_* 와 값이 일치해야 한다"는 수동 동기화 의무를 명시하고 있으나, 타입 시스템·빌드 파이프라인이 이를 강제하지 않는다. MIME 목록 한 항목만 추가·제거해도 서버/클라이언트 검증 결과가 조용히 달라질 수 있다. SRP 관점에서 "파일 검증 기본값의 진실"이 두 곳에 분산된다.
- **제안**: 중기적으로 `packages/` 하위 런타임 중립 공유 라이브러리에 상수(및 검증 함수)를 단일화하고 양쪽이 import 하도록 리팩터(아키텍처 백로그 B-1). 단기적으로는 두 상수 집합 값의 동치를 자동 검증하는 통합 테스트(또는 상수 파일 snapshot 테스트)를 추가해 무음 편차를 빌드 시점에 탐지한다.

### **[WARNING]** 검증 경로 이원화 — `validateFormSubmission` vs `assertFormSubmissionValid` 루프 공존
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` (`validateFormSubmission` L321–332) 및 `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`assertFormSubmissionValid` L4347–4358)
- **상세**: 현재 scalar 검증을 수행하는 두 가지 "루프 방식"이 공존한다. (1) chat-channel modal 경로(`hooks.service.ts`)는 `validateFormSubmission`(scalar-only 루프 래퍼)를 호출하고, (2) EIA/WS 경로는 `assertFormSubmissionValid` 안에서 `validateScalarField` + `validateFileField` 를 직접 디스패치하는 단일 루프를 구성한다. 새 필드 검증 규칙이 추가될 때 두 경로 모두 수정해야 한다는 사실이 구조상 명확하지 않다. 개방-폐쇄 원칙 관점에서 규칙 추가 비용이 두 배다. 현재 `validateFormSubmission` JSDoc 에 경로 분리 의도가 명시되어 있으나, 새 기여자가 이 이원 구조를 파악하지 못하고 한쪽만 수정하면 경로 간 검증 정합이 깨진다.
- **제안**: `assertFormSubmissionValid` 루프를 독립 순수 함수 `validateAllFields(rawData, fields)` 로 추출해 두 경로의 모듈 경계를 명확히 한다. `validateFormSubmission` 은 scalar-only 컨슈머임을 JSDoc + 파라미터 타입으로 더 명시한다. 혹은 chat-channel modal 경로도 동일 `validateAllFields` 를 호출하되 file 필드는 isFieldModalCompatible 로 이미 배제되므로 실질 동작 변경 없이 경로를 통합할 수 있다.

### **[INFO]** `renderField` 파라미터 누증 — file 전용 의존성이 범용 렌더러에 유입
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `renderField` 함수 (6개 파라미터: `field, idx, value, onChange, onError, t`)
- **상세**: `onError` 콜백과 `t(TFunction)` 는 file 필드 onChange 분기에서만 사용된다. 나머지 필드 타입(text, email, select 등)은 두 파라미터를 무시한다. 순수 렌더링 함수가 에러 상태 관리 콜백과 i18n 의존성을 함께 수용하는 구조는 SRP 위반이다. 파라미터 수 자체보다, file 관련 교차 관심사가 범용 렌더러에 은닉된다는 점이 장기 유지보수 부담이다.
- **제안**: 즉각적인 리팩터 의무는 아니다(현 코드 규모상 관리 가능). 향후 file 필드에 미리보기·진행률 등 추가 상태가 생기면 `renderFileField` 를 별도 React 컴포넌트로 분리해 file 전용 에러 상태와 i18n 의존성을 캡슐화한다.

### **[INFO]** `coerceFormSubmission` 제거 후 인라인 타입 캐스팅 잔존
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `assertFormSubmissionValid` L4343–4346
- **상세**: `coerceFormSubmission` private 메서드 제거 후, `formData` 정규화 책임이 `assertFormSubmissionValid` 안으로 인라인되었다(`formData as Record<string, unknown>`). 코드 규모는 줄었고 현재 단순 캐스팅이라 문제는 없으나, formData 타입 안전성 확보 책임이 호출 사이트에 흡수되어 명시적 경계가 사라졌다. 향후 formData 정규화 로직이 다시 복잡해지면 책임 소재가 불명확해질 수 있다.
- **제안**: 현재 구조는 단순화 측면에서 타당하다. formData 가 복잡한 정규화를 다시 필요로 하면 그 시점에 private 헬퍼로 재추출한다.

### **[INFO]** 클라이언트-서버 검증 순서 동기화 계약 미명시
- **위치**: `dynamic-form-ui.tsx` `validateFilesClient` (MIME → per-file size → total size → count) vs `form-mode.ts` `validateFileField` (동일 순서)
- **상세**: 두 함수가 동일한 FIRST 오류 순서를 따른다는 것은 spec §1.5 요구사항이다. 그러나 코드 수준에서 이 순서 동치를 강제하는 공통 타입·상수·테스트가 없다. 한쪽 함수의 순서가 변경되면 사용자가 클라이언트와 서버에서 서로 다른 오류 메시지를 볼 수 있다.
- **제안**: 위 W1(공유 패키지 추출)이 해결되면 자연히 해소된다. 단기적으로는 두 함수의 JSDoc 에 "§1.5 FIRST 오류 순서: MIME → per-file size → total → count" 를 동일하게 명시해 순서 동치 의도를 문서화한다.

---

## 요약

이번 변경은 `validateScalarField` 추출, `validateFileField` 신규 추가, `extractFormFields` 의 file 기본값 주입을 통해 scalar 검증과 file 검증의 책임을 명확히 분리하였다. 레이어 책임 분리(비즈니스 로직 = `form-mode.ts`, 오케스트레이션 = execution-engine, 프레젠테이션 = `dynamic-form-ui.tsx`)는 전반적으로 잘 준수되고 있으며, `validateFormSubmission` 의 scalar-only 경로와 execution-engine 루프의 all-field 경로 분리 의도도 JSDoc 으로 명시되어 있다. 주요 아키텍처 위험은 두 가지다: (1) 14개 MIME 목록과 숫자 상수가 backend/frontend 에 리터럴 중복 선언되어 수동 동기화 의무만으로 일관성이 보장되는 DRY 위반, (2) 검증 경로가 이원화(chat-channel modal vs EIA/WS)되어 새 규칙 추가 시 두 경로 모두 수정해야 한다는 사실이 구조상 불명확한 점. 두 WARNING 은 기능 정확성에는 현재 영향을 주지 않으나 장기 유지보수 위험이다.

---

## 위험도

LOW
