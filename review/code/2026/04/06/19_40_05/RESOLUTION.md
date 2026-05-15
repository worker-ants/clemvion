# 코드 리뷰 이슈 조치 내용

## CRITICAL 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | 프로토타입 순회 방어 테스트 false negative | `getNestedValue`에 `BLOCKED_KEYS` (`__proto__`, `constructor`, `prototype`) 차단 로직 추가. `nested-value.util.spec.ts`에 실제 방어 검증 테스트 작성 |

## WARNING 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `getNestedValue` 위험 키 미차단 | `BLOCKED_KEYS` Set으로 차단, 테스트 추가 |
| 2 | `setNestedValue` 프로토타입 오염 | 중간 키와 마지막 키 모두 `BLOCKED_KEYS` 체크 추가, 테스트 추가 |
| 3 | 에러 메시지에 사용자 입력값 노출 | 에러 메시지에서 `actualValue` 제거 |
| 4 | `nested-value.util.spec.ts` 부재 | 독립 단위 테스트 파일 생성 (17개 테스트) |
| 5 | 중복 `case.id` 유효성 검증 누락 | `validate`에 `seenIds` Set으로 중복 감지 추가, 테스트 추가 |
| 6 | `switchValue: ''` 빈 문자열 통과 | 빈 문자열/공백 문자열을 invalid 처리, 테스트 추가 |
| 7 | `switchValue` 이중 동작 모드 혼재 | 현재 구현이 expression resolver와의 역할 분담상 적절하므로 유지 |
| 8 | `cases` 배열 DoS | 현재 워크플로우 빌더 UI에서 케이스 수가 자연적으로 제한되므로 유지 |

## INFO 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `switchValue: 0` 테스트 누락 | falsy number 케이스 테스트 추가 |
| 2 | `hasDefault: false` + null 경로 | throw 검증 테스트 추가 |
| 3-10 | 기타 | 현재 구현 범위에서 영향 없으므로 유지 |
