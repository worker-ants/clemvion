# Code Review Resolution

## WARNING 이슈 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | static 모드 컬럼 추가 시 기존 row에 새 field 미초기화 | `addColumn()` 시 기존 rows에 `{ ...row, [newField]: "" }` 추가 | RESOLVED |
| 2 | static 모드 컬럼 삭제 시 row에서 해당 field 미제거 | `removeColumn()` 시 rows에서 해당 field key 제거 처리 추가 | RESOLVED |
| 3 | 모듈 수준 가변 전역 변수 `tableRowId` | `crypto.randomUUID()`로 교체하여 컴포넌트 인스턴스별 격리 | RESOLVED |
| 4 | `config.rows` 항목 타입 미검증 | `execute()` 내 rows 배열 항목이 객체인지 `.filter()` 적용 | RESOLVED |
| 5 | `sortBy`가 column 목록에 없는 임의 필드 허용 | `validate()`에 `sortBy`가 정의된 column field 목록 내 값인지 검증 추가 | RESOLVED |
| 6 | `toDisplayString` object/array 렌더링 테스트 누락 | object/array 값 렌더링 결과 검증 테스트 추가 | RESOLVED |
| 7 | 정렬 로직의 null 값 처리 테스트 누락 | null 값 포함 데이터의 정렬 결과 검증 테스트 추가 | RESOLVED |
| 8 | `TableConfig` 컴포넌트 단위 테스트 전무 | 프론트엔드 컴포넌트 테스트는 향후 과제로 분류 (현재 프로젝트 내 다른 config 컴포넌트도 동일한 수준) | DEFERRED |
| 9 | 프론트엔드-백엔드 도메인 규칙 암묵적 중복 | Carousel 노드와 동일한 패턴. 프로젝트 전체적 구조 개선 시 함께 검토 | DEFERRED |
| 10 | `mode` 타입이 타입 시스템에 표현되지 않음 | `type TableMode = 'static' | 'dynamic'` 선언 및 타입 적용 | RESOLVED |

## INFO 이슈 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | static rows에 내부 `id` 필드 다운스트림 노출 | static 모드에서도 columns의 field에 맞는 값만 추출하도록 수정 (id 자동 제거) | RESOLVED |
| 2 | `pageSize` 백엔드 상한선 미적용 | 기존 동작 유지. 프론트엔드에서 max=100 제한 | NOTED |
| 3 | `async` 제거로 동기 예외 처리 경로 변화 | CarouselHandler와 동일한 패턴(`Promise.resolve()`) 유지 | NOTED |
| 4-13 | 기타 성능/문서/유지보수 개선 | 프로젝트 전체적 개선 시 함께 검토할 사항으로 분류 | NOTED |
