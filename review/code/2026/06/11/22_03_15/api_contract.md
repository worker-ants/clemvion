# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] `classifyError` 함수 모듈 공개 export 추가
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `export function classifyError(...)`
- **상세**: 이전에는 파일 내부 함수였던 `classifyError`가 `export`로 공개됨. 테스트 접근성 확보가 목적이나, 이제 모듈 공개 인터페이스의 일부가 됨. 향후 시그니처 변경 시 외부 참조처가 있을 경우 breaking change로 전파될 수 있음.
- **제안**: 테스트 전용 export임을 JSDoc 또는 파일 주석으로 명시(`@internal` 등). 외부 소비자가 이 함수에 직접 의존하지 않도록 관리 필요.

### [INFO] `output.error.details.legacyCode` — 내부 코드 클라이언트 노출
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `failure()` 메서드, `const outputDetails: Record<string, unknown> = { legacyCode: errorCode };`
- **상세**: 공개 에러 코드(`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT`)와 별도로, 내부 분류 코드(`EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED`, `CODE_RUNTIME_ERROR`)가 `output.error.details.legacyCode`에 항상 포함되어 클라이언트에 노출됨. 이 필드가 클라이언트 코드에서 의존되기 시작하면 나중에 제거하기 어려워짐.
- **제안**: `legacyCode` 필드의 수명을 spec에 명시하거나 deprecation 계획을 문서화. 이미 migration 용도라면 제거 시점을 정의할 것.

### [INFO] `LEGACY_TO_NORMALIZED` 테이블 — 신규 에러 코드 추가 시 단일 진입점 확보
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `LEGACY_TO_NORMALIZED` 상수
- **상세**: 이전 triple-ternary 체인을 테이블로 대체한 리팩터링은 에러 코드 매핑의 API 계약 관리를 향상시킴. 그러나 현재 테이블에 없는 코드는 `?? errorCode`로 그대로 통과 — 즉 `classifyError`가 예상치 못한 내부 코드를 반환하면 해당 코드가 공개 API 응답에 그대로 노출될 위험이 있음.
- **제안**: fallthrough (`?? errorCode`) 경로에 대해 `CODE_EXECUTION_FAILED`로 기본 정규화하거나, 알 수 없는 코드 발생 시 로그를 남기는 방어 코드를 추가할 것.

### [INFO] 에러 응답 스키마 일관성 — 신규 에러 코드 i18n 레이블 추가
- **위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts` — `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT` 신규 추가
- **상세**: 신규 에러 코드 3종에 대한 한국어 레이블이 추가됨. API 계약 관점에서 클라이언트가 이 코드를 인식하고 표시할 준비가 된 것으로 긍정적. 에러 코드 값이 스펙과 일치하는지 확인 완료 (`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT`).
- **제안**: 해당 없음 — 올바르게 추가됨.

## 요약

이번 변경은 HTTP API 엔드포인트나 RESTful 라우팅을 직접 수정하지 않으며, code 노드 실행 핸들러의 내부 에러 분류 로직 개선과 테스트 추가가 핵심이다. API 계약 관점에서는 `output.error.code` 공개 에러 코드(`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT`)의 매핑이 `LEGACY_TO_NORMALIZED` 테이블로 명확하게 관리되며, 이전 동작과 동일한 공개 코드를 유지하므로 하위 호환성은 유지된다. 주의할 점은 `output.error.details.legacyCode`에 내부 코드가 항상 노출되어 클라이언트가 의도치 않게 이에 의존할 수 있다는 것과, `LEGACY_TO_NORMALIZED` fallthrough 경로에서 알 수 없는 내부 코드가 비정규화된 채로 공개될 수 있다는 것이다. 두 가지 모두 즉각적인 breaking change는 아니지만 장기 계약 관리 측면에서 정리가 권장된다.

## 위험도

LOW
