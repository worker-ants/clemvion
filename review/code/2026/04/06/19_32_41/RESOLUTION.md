# 코드 리뷰 이슈 조치 내용

## WARNING 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | 빈 `cases` 배열 미검증 | `validate`에서 `cases.length === 0` 체크 추가, 테스트 추가 |
| 2 | null 중간 경로 처리 미검증 | `{ user: null }` + `switchValue: 'user.role'` 테스트 추가 (기존 `getNestedValue`가 정상 처리) |
| 3 | `hasDefault` 생략 시 동작 미검증 | `hasDefault` 미포함 config 테스트 추가 (default port로 fall-through 확인) |
| 4 | 중복 case 방어 | first-match 동작 보장 테스트 추가 (`Array.find`가 자연스럽게 first-match) |
| 5 | config 타입 강화 | 런타임 검증으로 충분히 방어되므로 현재 유지 |

## INFO 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | validate 오류 메시지 미검증 | `case has no id` 및 빈 문자열 id 케이스에 `toContain` 검증 추가 |
| 2 | hasDefault 타입 검증 | `hasDefault: 'yes'` 입력 시 에러 반환 테스트 추가 |
| 3 | 타입 불일치 비교 정책 | `switchValue: '1'` vs `value: 1` strict equality 테스트 추가 |
| 4 | 프로토타입 오염 방어 | `__proto__.constructor` 경로 테스트 추가 |
| 5 | switchValue null 검증 | `switchValue: null` invalid 반환 테스트 추가 |
| 6 | 빈 문자열 id 검증 | `{ id: '', value: 'a' }` 케이스 테스트 추가 |
| 7 | switchValue 이중 책임 | 현재 설계가 expression resolver와의 역할 분리상 적절하므로 유지 |
| 8 | context 활용 테스트 | 구현체에서 context 미사용이므로 불필요 |
| 9 | beforeAll 최적화 | stateless이지만 기존 패턴(if-else 등)과 일관성 유지를 위해 beforeEach 유지 |
| 10 | default 포트 상수화 | 단일 사용이므로 현재 유지 |
