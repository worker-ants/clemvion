# 유지보수성(Maintainability) 리뷰

## 발견사항

### **[WARNING]** DEFAULT_FILE_* 상수 백엔드/프론트엔드 이중 정의 — 수동 동기화 의무
- **위치**: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L30–53 / `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L42–61
- **상세**: `DEFAULT_FILE_ALLOWED_MIME_TYPES`(14종), `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES`, `MB_IN_BYTES` 5개 상수가 두 파일에 동일하게 복사돼 있다. 프론트엔드 JSDoc 에 "변경 시 spec §1 + 양쪽 미러를 함께 갱신한다"는 수동 의무가 명시돼 있으나, 빌드·타입 시스템이 이를 강제하지 않는다. MIME 목록 한 줄 추가 시 두 파일을 동시에 수정하지 않으면 서버/클라이언트 검증 결과가 조용히 불일치하게 된다.
- **제안**: 단기 조치로 두 상수 집합의 값 동치를 단언하는 통합 테스트 추가. 중장기 조치는 `packages/` 공유 모듈 추출(아키텍처 백로그 B-1)로 단일화. 현 JSDoc 의무 명시는 방향성 확인이나 기계적 보장이 아님을 주의.

### **[WARNING]** `renderField` 파라미터 6개 — file 전용 관심사 누수
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L133–140
- **상세**: `renderField(field, idx, value, onChange, onError, t)` 로 시그니처가 6개 파라미터로 늘었다. `onError`와 `t`(TFunction)는 오직 `case "file"` 분기에서만 사용되며, 나머지 8개 case(textarea, number, email, date, select, radio, checkbox, default)는 이 두 파라미터를 전혀 사용하지 않는다. 순수 렌더링 헬퍼가 에러 상태 관리 콜백과 i18n 의존성을 함께 받는 구조는 single responsibility 측면에서 혼재를 나타낸다. 새 필드 타입 추가 시 파라미터 목록이 더 늘어날 수 있다.
- **제안**: file 렌더링을 `renderFileField(field, idx, value, onChange, onError, t)` 별도 함수로 분리하면 `renderField` 파라미터가 4개로 줄고 file 전용 로직이 캡슐화된다. 현재 규모에서는 즉각 의무는 아니나 첫 번째 신규 타입 추가 시 분리를 권장한다.

### **[INFO]** `validateFilesClient`와 `validateFileField` 검증 루프 분리 — 유사 구조 이중화
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L80–112 / `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L354–409
- **상세**: 두 함수는 동일한 검증 순서(MIME → per-file size → total size → count)를 독립적으로 구현한다. JSDoc 에 "검사 순서는 서버 `validateFileField` 와 동일"이라 명시돼 있지만, 새 검증 규칙 추가 시 두 곳을 함께 수정해야 한다는 암묵적 계약이 타입 시스템이나 테스트로 강제되지 않는다. 상수 중복(WARNING 1)과 동일한 근본 원인이며, 공유 패키지 추출이 이 문제도 해소한다.
- **제안**: 단기적으로 두 함수의 검증 순서 동치를 명시하는 주석 또는 통합 테스트. B-1 공유 패키지 추출 시 로직 자체를 단일화.

### **[INFO]** `extractFormFields` 내 인라인 람다 — `posFinite` 이름 반복 없이 재사용 불가
- **위치**: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L169–170
- **상세**: `const posFinite = (v: unknown): v is number => Number.isFinite(v) && (v as number) > 0;` 가 `extractFormFields` 함수 본문 내부에 인라인으로 선언돼 있다. 현재는 한 곳에서만 쓰이므로 문제가 없지만, 향후 같은 모듈에서 동일 가드가 필요한 경우 지역 유틸리티를 발견하지 못하고 중복 작성할 위험이 있다. 모듈 레벨 헬퍼(`isPositiveFinite`)로 올리면 재사용성과 테스트 가능성이 향상된다.
- **제안**: 모듈 상단 또는 utils 영역에 `function isPositiveFinite(v: unknown): v is number { return Number.isFinite(v) && (v as number) > 0; }` 로 분리. 현재 규모에서는 INFO 수준.

### **[INFO]** `handleError` 상태 업데이트 — `undefined` vs 키 부재 불일치
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L346–356
- **상세**: `handleError` 에서 `if (prev[name] === undefined) return prev;` 로 early-return 하는데, TypeScript 타입이 `Record<string, string>` 이라 `undefined`가 타입에 없으나 런타임에서는 키 부재 시 `undefined`를 반환한다. 의도는 명확하지만 `!(name in prev)` 가 더 의미론적으로 정확하다. 현재 동작에는 문제없으나 일관성 측면에서 주의.
- **제안**: `if (!(name in prev)) return prev;` 로 변경하면 의도가 더 명시적이다.

### **[INFO]** `validateFilesClient` — empty-array 조기 반환이 `required` 체크를 암묵적으로 skip
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L85
- **상세**: `if (files.length === 0) return null;` 은 클라이언트 측에서 빈 파일 목록을 항상 통과시킨다. 이는 file input 의 `required` 속성이 HTML 네이티브 유효성 검사에 위임된다는 의도인데, 코드에는 이 결정이 명시적으로 문서화돼 있지 않다. 서버 `validateFileField` 는 required 를 명시적으로 처리한다. 두 경로의 required 처리 방식이 다름을 향후 유지보수자가 혼동할 수 있다.
- **제안**: 해당 조기 반환에 "required 는 HTML 네이티브 validation 에 위임 — 클라이언트 가드는 선택된 파일에만 적용" 주석 추가.

### **[INFO]** `execution-engine.service.ts` 인라인 타입 단언 — 책임 분산
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff L492–495
- **상세**: `coerceFormSubmission` 제거 후 `const rawData = formData && typeof formData === 'object' ? (formData as Record<string, unknown>) : {};` 가 `assertFormSubmissionValid` 내에 인라인으로 남았다. 기존에는 별도 private 메서드가 타입 변환을 담당해 책임이 명확했으나, 이제 호출 사이트에서 직접 처리한다. 현재 3줄 분량이라 과도한 추상화는 아니지만, formData 정규화 로직이 다시 필요해지면 함수로 격리할 지점임을 주석으로 표시하면 유용하다.
- **제안**: 현재 구조 유지. 단, 향후 확장 시 분리 지점을 가리키는 TODO 주석을 선택적으로 추가.

---

## 요약

이번 변경은 `type:'file'` 필드 검증을 백엔드(`validateFileField`, `extractFormFields` 기본값 주입)와 프론트엔드(`validateFilesClient`, 에러 상태 관리)에 걸쳐 일관된 구조로 추가했으며, 기존 코드 패턴(FIRST 오류, pure 함수, 방어적 guard)을 충실히 따르고 있다. 네이밍은 전반적으로 명확하고 함수 분리도 적절하다. 주요 유지보수성 위험은 두 가지다. 첫째, `DEFAULT_FILE_*` 상수가 백엔드/프론트엔드에 각각 복사돼 있어 MIME 목록 변경 시 수동 동기화가 필요하다(타입 시스템 미강제). 둘째, `renderField` 가 file 전용 `onError`/`t` 파라미터를 받으면서 비-file case 에 불필요한 관심사가 노출된다. 나머지 발견사항은 INFO 수준으로 현재 기능 정확성에는 영향이 없다.

## 위험도

LOW
