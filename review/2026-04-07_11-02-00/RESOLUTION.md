# 코드 리뷰 이슈 조치 내용

## 조치 완료

| # | 카테고리 | 이슈 | 조치 내용 |
|---|----------|------|-----------|
| 1 | Architecture / Maintainability | `ROOT_VARIABLES`/`BUILT_IN_VARIABLES` 중복 정의 | `expression-constants.ts`로 추출하여 단일 소스 통합. `use-expression-suggestions.ts`와 `variable-picker.tsx` 모두 공유 상수 참조 |
| 4 | Testing | `useExpressionContext` 테스트 부재 | `use-expression-context.test.ts` 신규 작성 — predecessor 탐색, 변수 수집, `sourceItemSample` 해석 (배열/객체/dataSource 참조/static 모드/미실행) 총 7개 테스트 |
| 6 | Testing | `$var.` 제안 브랜치 테스트 없음 | 3개 테스트 추가 (필터링, 매칭, 빈 결과) |
| 7 | Testing | `$node["..."]` 레이블 선택 제안 테스트 없음 | 2개 테스트 추가 (전체 목록, 접두사 필터링) |
| 8 | Side Effect | `ExpressionData` 인터페이스 소비자 점검 | 소비자 5개 파일 확인 — 모두 expression 모듈 내부이며 `useExpressionContext`가 유일한 생산자. 테스트의 `defaultData`에 `sourceItemSample: null` 추가 완료 |
| 9 | Side Effect / Requirement | `$dataSource.` 필드 확장 분기 누락 | `$dataSource.` 접두사 핸들러 추가 (`sourceItemSample` 기반 필드 드릴다운) + 테스트 2개 추가 |
| 10 | Requirement | `$trigger`, `$env` 누락 | `expression-constants.ts`의 `ROOT_VARIABLES`에 추가 |
| 13 | Requirement | `$dataSource` 피커 불일치 | `VariablePicker`의 `$sourceItem` 섹션에 `$dataSource` 항목 추가, count +2 반영 |
| 14 | Security | 노드 레이블 미검증 표현식 삽입 | `"`, `\` 특수문자 이스케이프 처리 추가 |
| 16 (INFO) | Testing | `$dataSource` 미노출 케이스 검증 누락 | `expect(labels).not.toContain("$dataSource")` 추가 |

## 조치 보류 (기존 이슈, 이번 변경 범위 외)

| # | 카테고리 | 이슈 | 사유 |
|---|----------|------|------|
| 2 | Architecture | 레이블 기반 노드 조회 취약성 | 기존 아키텍처 전반에 걸친 설계 이슈. 별도 리팩토링 필요 |
| 3 | Architecture | 노드 타입 문자열 하드코딩 | 전략 패턴 적용은 대규모 리팩토링 필요 |
| 5 | Testing | `VariablePicker` 컴포넌트 테스트 없음 | 기존 컴포넌트. 별도 테스트 작업으로 분리 필요 |
| 11 | Requirement | 미실행 워크플로우 힌트 미구현 | 기존 미구현 스펙. 별도 작업 필요 |
| 12 | Requirement | 함수 자동완성 시그니처 미포함 | 기존 미구현 스펙. 별도 작업 필요 |
| 15 | Performance | 피커 함수 목록 전체 렌더링 | 내장 함수 수가 제한적이고 스크롤 영역 내부이므로 실질적 성능 영향 없음 |
