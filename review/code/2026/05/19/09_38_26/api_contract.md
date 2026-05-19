### 발견사항

해당 없음

변경 대상은 모두 프론트엔드 자동 폼 렌더러의 UI DSL 내부 타입(`UiHint.requiredWhen`)과 그 런타임 평가 로직(`visibility.ts`)입니다. 이 DSL은 캔버스 UI의 asterisk 표시 여부를 결정하는 순수 클라이언트 사이드 메타데이터이며, 백엔드 API 엔드포인트의 요청/응답 계약과는 무관합니다.

- `GET /nodes/definitions` 응답 스키마 자체는 변경되지 않았습니다. `UiHint` 타입 내의 `requiredWhen` 필드 shape가 좁아졌지만(`oneOf`·`notEquals` 제거 → `equals` 단일 shape 통일), 이 필드는 UI 렌더링 힌트이며 API 클라이언트가 직접 소비하는 비즈니스 계약 필드가 아닙니다.
- 백엔드 `NodeHandler.validate()` 및 HTTP 상태코드·에러 응답·인증/인가·페이지네이션 등 API 계약 영역에 영향을 주는 코드 변경은 없습니다.

### 요약

이번 변경은 `UiHint.requiredWhen` DSL을 `notEquals`·`oneOf` 복수 shape에서 `equals: value | readonly value[]` 단일 shape로 단순화한 내부 타입 정비입니다. 변경 범위는 프론트엔드 자동 폼 렌더러의 UI 힌트 평가 로직과 백엔드 인터페이스 파일의 JSDoc·타입 선언에 한정되며, HTTP API 엔드포인트의 요청/응답 계약, 인증/인가, 에러 응답 형식, 버전 관리 등 API 계약 검토 대상 영역에는 영향이 없습니다.

### 위험도
NONE
