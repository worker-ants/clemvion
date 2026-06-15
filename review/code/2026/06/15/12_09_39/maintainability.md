# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일: codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx

- **[WARNING]** 프론트엔드 상수와 백엔드 상수의 중복 정의
  - 위치: `dynamic-form-ui.tsx` L26~45 (새로 추가된 `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES`, `MB_IN_BYTES`)
  - 상세: `form-mode.ts` 에 이미 동일한 이름과 동일한 값으로 정의된 상수(`DEFAULT_FILE_ALLOWED_MIME_TYPES` 14개 MIME 목록 등)가 프론트엔드에 그대로 복사·재정의되어 있다. 파일 내 주석에 "backend `form-mode.ts` 의 DEFAULT_FILE_* 상수와 값이 일치해야 한다"는 메모가 있으나, 이는 향후 두 값이 조용히 달라질 가능성을 열어둔 취약한 관리 방식이다. MIME 목록이 변경될 때 두 파일을 동시에 수정해야 한다는 암묵적 규약이 강제되지 않는다.
  - 제안: 공유 패키지(`packages/`) 또는 별도 shared 모듈에 단일 상수를 정의하고 양쪽에서 import 하도록 한다. 단기적으로 적용이 어렵다면 최소한 두 상수 선언부에 단위 테스트로 값 일치를 강제하는 동기화 테스트를 추가한다.

- **[INFO]** `validateFilesClient` 에서 파일을 두 번 순회함
  - 위치: `dynamic-form-ui.tsx` L73~77 (MIME 루프) 및 L78~82 (per-file size 루프)
  - 상세: MIME 검사와 per-file size 검사가 각각 별도 `for...of` 루프로 구현되어 배열을 두 번 순회한다. 백엔드 `validateFileField` 와 구조가 다르며, 파일 수가 많지 않아 실용상 문제는 없으나 단일 루프로 통합하면 코드 의도가 더 명확해진다.
  - 제안: FIRST 오류 순서를 유지하면서 단일 루프 내에서 MIME과 per-file size를 함께 검사하도록 통합할 수 있다. 단, 현재 구현도 명세의 오류 순서를 올바르게 구현하고 있으므로 필수 수정은 아니다.

- **[INFO]** `handleError` 함수 내 `prev[name] === undefined` 조기 반환
  - 위치: `dynamic-form-ui.tsx` L151~161
  - 상세: `msg === null` 분기에서 `prev[name] === undefined`를 체크해 불필요한 리렌더를 방지하는 최적화가 있으나, 이 미묘한 동작이 주석 없이 인라인으로만 처리되어 있다. 향후 유지보수 시 의도가 불명확하게 보일 수 있다.
  - 제안: 짧은 주석("// 이미 없으면 state 변경 없이 반환(리렌더 방지)")으로 의도를 명시한다.

### 파일: codebase/backend/src/modules/chat-channel/shared/form-mode.ts

- **[INFO]** `validateFileField` 와 `validateScalarField` 의 JSDoc 참조 밀도 불균형
  - 위치: `form-mode.ts` `validateFileField` JSDoc (L459~476)
  - 상세: `validateFileField` JSDoc은 매우 상세하고 잘 작성되어 있다. 반면 리팩터링 결과 추출된 `validateScalarField`의 JSDoc은 함수 목적·파라미터 계약·호출자 관계를 충분히 기술하고 있어 일관성은 유지된다. 전반적으로 문서화 품질이 양호하다.

- **[INFO]** `extractFormFields` 내 file 제약 주입 블록의 패턴 반복
  - 위치: `form-mode.ts` L282~302 (file 필드 제약 주입 4개 항목)
  - 상세: `maxFileSize`, `maxTotalSize`, `maxFiles` 세 항목이 동일한 `typeof f.X === 'number' && f.X > 0 ? f.X : DEFAULT` 패턴을 반복한다. 현재 3개 필드이므로 허용 범위이나, 향후 필드가 늘어나면 헬퍼 함수로 추출하는 것을 고려할 수 있다.
  - 제안: 현재 수준에서는 수정 불필요. 파일 제약 필드가 추가될 경우 `resolvePositiveNumber(val, defaultVal)` 형태의 소규모 헬퍼로 추출한다.

### 파일: codebase/backend/src/modules/execution-engine/execution-engine.service.ts

- **[WARNING]** 인라인 타입 캐스팅 패턴의 가독성 저하
  - 위치: `execution-engine.service.ts` L803~806 (개선된 `assertFormSubmissionValid` 내부)
  - 상세: `formData && typeof formData === 'object' ? (formData as Record<string, unknown>) : {}` 패턴이 인라인으로 작성되어 있어 `assertFormSubmissionValid` 함수 내부의 핵심 로직(필드별 분기)이 시작되기 전에 타입 변환 로직이 혼재된다. 이전 코드에서는 `coerceFormSubmission`이 이 역할을 담당했는데, 그 함수를 제거하면서 변환 로직이 인라인으로 이동했다.
  - 제안: 타입 가드를 `const rawData = toRawRecord(formData)` 형태로 로컬 헬퍼로 추출하거나, 최소한 블록 주석으로 "타입 정규화" 단계임을 명시한다.

### 파일: codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts

- **[INFO]** `fileMeta` 헬퍼 함수가 `describe` 블록 외부(중간 위치)에 정의됨
  - 위치: `execution-engine.service.spec.ts` L662~668 (`const fileMeta = ...`)
  - 상세: `fileMeta` 헬퍼가 `describe` 블록 내 이전 `it` 블록들과 이후 `it` 블록들 사이에 위치해 있다. TypeScript/Jest에서 동작상 문제는 없으나, 헬퍼 함수가 사용 지점 이후에 나타나는 테스트 파일 내 위쪽 `it` 블록에서는 해당 헬퍼를 쓰지 않으므로 구조가 다소 산만하다. 테스트 파일의 `form-mode.spec.ts`에서는 헬퍼를 `describe` 블록 상단에 정의하는 패턴을 사용하고 있다.
  - 제안: `fileMeta` 헬퍼를 해당 `describe` 블록 또는 파일 관련 테스트 묶음의 상단으로 이동하거나, 별도 inner `describe`로 파일 검증 테스트를 묶어 헬퍼 정의를 해당 블록 상단에 위치시킨다.

- **[INFO]** 매직 넘버 `1024 * 1024` 가 테스트 파일에 직접 사용됨
  - 위치: `execution-engine.service.spec.ts` L694 (`11 * 1024 * 1024`), L721 (`2 * 1024 * 1024`)
  - 상세: `form-mode.ts`에 `MB_IN_BYTES`가 export 되어 있음에도 서비스 테스트 파일에서는 리터럴 `1024 * 1024`를 직접 사용한다. `form-mode.spec.ts`는 `MB_IN_BYTES`를 import 하여 사용하고 있어 일관성이 없다.
  - 제안: `execution-engine.service.spec.ts`에서도 `MB_IN_BYTES`를 import 하여 사용한다.

### 파일: codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx

- **[INFO]** `MB` 상수가 테스트 로컬로 재정의됨
  - 위치: `dynamic-form-ui.test.tsx` L863 (`const MB = 1024 * 1024`)
  - 상세: 프론트엔드 `MB_IN_BYTES`가 `dynamic-form-ui.tsx`에 정의되어 있으나 export 되지 않아 테스트에서 재정의가 필요한 상황이다. 백엔드와의 일관성 문제와 함께, `MB_IN_BYTES`를 export 하면 이 중복을 제거할 수 있다.
  - 제안: `dynamic-form-ui.tsx`에서 `MB_IN_BYTES`를 export 하거나 공유 상수 모듈로 이동시키고, 테스트에서 import 하여 사용한다.

---

## 요약

이 변경은 `type:'file'` 필드 검증을 서버(백엔드)와 클라이언트(프론트엔드) 양쪽에 추가하는 기능 구현으로, 전반적으로 설계가 명확하고 JSDoc 문서화가 충실하며 기존 패턴(FIRST 오류 반환, 방어적 처리)을 잘 따르고 있다. `validateFormSubmission`을 `validateScalarField` + `validateFileField`로 분리한 리팩터링은 단일 책임 원칙 측면에서 개선이다. 가장 주목할 유지보수 위험은 백엔드 `form-mode.ts`와 프론트엔드 `dynamic-form-ui.tsx`에 MIME 목록을 포함한 파일 제약 상수가 중복 정의되어 있다는 점으로, 두 파일의 값을 수동으로 동기화해야 하는 암묵적 규약이 생겼다. 나머지 발견사항은 테스트 파일 내 헬퍼 위치, 매직 넘버 import 일관성 등 소소한 수준이다.

## 위험도

LOW

STATUS: SUCCESS
