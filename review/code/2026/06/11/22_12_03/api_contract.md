# API 계약(API Contract) 리뷰 결과

## 발견사항

- **[INFO]** `ApiForbiddenResponse` 설명 문구 변경: `Editor 미만 권한` → `Admin 미만 권한`
  - 위치: `auth-configs.controller.ts` — `create`, `update`, `remove` 엔드포인트 Swagger 데코레이터
  - 상세: 권한 레벨 상향을 API 문서에 올바르게 반영. 실제 `@Roles('admin')` 가드와 일치하므로 breaking change 없음. 기존에 Editor 권한으로 호출하던 클라이언트는 이미 403을 받았을 것이므로(가드가 먼저 적용됨) 문서 변경은 정정이지 계약 변경이 아님.
  - 제안: 이 변경은 적절함. 추가 조치 불필요.

- **[INFO]** `create` / `update` / `regenerate` / `remove` 서비스 메서드 시그니처에 `userId: string`, `ipAddress?: string` 파라미터 추가
  - 위치: `auth-configs.service.ts` — 4개 메서드 시그니처
  - 상세: 서비스 레이어 내부 메서드 시그니처 변경. 이 메서드들은 외부 REST API 경계가 아니라 NestJS 내부 계층 간 호출이므로 API 클라이언트에 직접 노출되지 않음. REST 응답 구조·URL·HTTP 상태 코드는 변경 없음. `ipAddress` 는 선택적(`?`) 파라미터라 기존 테스트 호출에 대한 backward compatibility 도 유지됨.
  - 제안: 이 변경은 적절함.

- **[INFO]** 감사 로그 액션 상수 4개 추가: `AUTH_CONFIG_CREATE`, `AUTH_CONFIG_UPDATE`, `AUTH_CONFIG_DELETE`, `AUTH_CONFIG_REGENERATE`
  - 위치: `audit-action.const.ts` — `AUDIT_ACTIONS` 객체
  - 상세: 외부 API 응답 형식에 직접 영향 없음. 감사 로그 API(`GET /audit-logs` 등)가 있다면 `action` 필드에 새 값이 추가되는 것이므로 additive change — 기존 클라이언트가 알 수 없는 action 값을 무시하면 하위 호환 유지.
  - 제안: 감사 로그 API 를 소비하는 클라이언트(대시보드 등)가 `action` 열거형을 엄격하게 검증한다면 신규 값을 화이트리스트에 추가해야 함. 서버측 계약 변경 자체는 문제 없음.

- **[INFO]** `reveal` 엔드포인트의 `resourceType` 하드코딩 `'auth_config'` → `AUTH_CONFIG_RESOURCE_TYPE` 상수 참조로 변경
  - 위치: `auth-configs.service.ts` L1624 (diff 기준)
  - 상세: 문자열 값 동일, 리팩터링 수준. API 계약 영향 없음.
  - 제안: 이 변경은 적절함.

## 요약

이번 변경은 `auth-configs` 도메인의 CRUD 작업 전반에 감사 로그(`auth_config.create/update/delete/regenerate`)를 추가하는 내부 구현 변경이다. REST API 의 URL 구조, HTTP 메서드, 요청/응답 스키마, HTTP 상태 코드, 페이지네이션 구조는 모두 그대로 유지되며 breaking change 가 없다. 권한 설명 문구(`ApiForbiddenResponse`) 변경은 이미 적용 중이던 `@Roles('admin')` 가드를 Swagger 문서에 올바르게 반영한 정정이다. 유일한 주의 사항은 외부 감사 로그 목록 API 소비자가 `action` 필드 값을 열거형 화이트리스트로 엄격 검사하는 경우 신규 4개 액션 값을 인지해야 한다는 점이나, 이는 additive change 로 통상적인 하위 호환성 범주 내에 있다.

## 위험도

LOW
