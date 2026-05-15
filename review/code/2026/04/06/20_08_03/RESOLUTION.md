# 코드 리뷰 이슈 조치 내용

## WARNING 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | coerceCaseValue 단방향 변환 비대칭 | 의도된 설계: case value는 UI에서 항상 string으로 저장되므로 case 쪽만 변환하면 됨. actualValue는 expression resolver 또는 getNestedValue가 이미 올바른 타입으로 반환. 경로 조회 + number valueType 매칭 테스트 추가로 동작 명시 |
| 2 | 비대칭 동작 테스트 누락 | `should match number via path lookup with valueType number` 테스트 추가 |
| 3 | 기존 데이터 valueType 미포함 정규화 | `valueType` 미지정(undefined) = `string`으로 처리. `validate()`에 `valueType` 허용값 검증 추가하여 잘못된 값 차단 |

## INFO 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | validate에 valueType 허용값 검증 | `VALID_VALUE_TYPES` Set으로 검증 추가, 테스트 추가 |
| 3 | 경로 조회 숫자값 매칭 테스트 | `{ x: 42 }` + `value: '42'` + `valueType: 'number'` 테스트 추가 |
| 8 | 테스트명 모호 | `"should use strict equality when valueType is not specified"`로 수정 |
| 2,4,5,6,7,9,10 | 기타 | 현재 구현 범위에서 실질적 영향 없으므로 유지 |
