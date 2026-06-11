# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] service 메서드 시그니처 변경 — 내부 직접 호출자 없음 확인 필요
- 위치: `auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 시그니처
- 상세: 4개 메서드 모두 `userId: string`(필수) + `ipAddress?: string`(선택) 파라미터가 추가됐다. NestJS 컨트롤러 외부에서 `AuthConfigsService`를 직접 호출하는 코드(e.g. 다른 서비스, 마이그레이션 스크립트, seeder)가 있다면 컴파일 오류가 발생한다. 테스트 파일(`auth-configs.service.spec.ts`)은 이미 `USER` 상수를 모든 호출에 주입하도록 일괄 갱신되어 있어 테스트 레이어는 안전하다. `verifyWebhookRequest`(webhook 인증 경로)는 시그니처 미변경이므로 영향 없음.
- 제안: `grep -r "authConfigsService\.\(create\|update\|remove\|regenerate\)" codebase/` 로 타 도메인 호출자가 없는지 확인. 현재 다른 서비스가 이 메서드를 직접 호출하는 패턴은 보이지 않으나 빌드 CI 통과를 증거로 삼을 것.

### [INFO] `regenerate` 응답이 평문 노출 — 감사 로그 기록 전 반환 경로 검토
- 위치: `auth-configs.service.ts` `regenerate()` 라인 1823-1833
- 상세: `regenerate`는 `saved`(새 키/토큰 평문 포함)를 반환하되 마스킹(`toMasked`) 없이 반환한다. 감사 로그는 `save` 성공 후 비동기(`await`)로 기록되어 순서는 올바르다. `AuditLogsService.record`가 실패를 내부에서 swallow한다는 best-effort 계약이 JSDoc에 명시되어 있어 감사 실패가 응답을 차단하지는 않는다. 이는 기존 `reveal` 패턴과 동일하므로 의도된 설계다. 부작용은 없으나 감사 실패 시 평문 노출 사실이 기록되지 않는 위험은 문서화된 trade-off다.
- 제안: 현행 best-effort 정책 유지 시 별도 조치 불요. 향후 감사 실패를 메트릭으로 노출할 필요가 있다면 `AuditLogsService` 레이어에서 처리한다.

### [INFO] `remove` 후 감사 기록 — 삭제 성공 후 audit DB 장애 시 기록 누락
- 위치: `auth-configs.service.ts` `remove()` 라인 1843-1851
- 상세: `authConfigRepository.remove(config)` 성공 후 `auditLogsService.record` 호출 순서다. best-effort 계약에 의해 audit 실패는 무시된다. 삭제는 완료됐는데 감사 로그가 누락되는 시나리오는 감사 가용성 측면의 known trade-off로 JSDoc에 명시되어 있다. 롤백 없음이라고 명시된 것도 일관성 있다.
- 제안: 현재 설계 범위 내에서 추가 대응 불요.

### [INFO] 모듈 레벨 상수 `AUTH_CONFIG_RESOURCE_TYPE` 도입
- 위치: `auth-configs.service.ts` 라인 1659
- 상세: `'auth_config'` 문자열을 `AUTH_CONFIG_RESOURCE_TYPE` 상수로 추출했다. 기존 `reveal`의 인라인 `'auth_config'` 문자열도 이 상수로 대체됐다. 이 상수는 모듈 스코프 `const`이며 export되지 않으므로 외부 상태 오염 없음. 의도적인 DRY 정리다.
- 제안: 현행 유지.

### [INFO] `AUDIT_ACTIONS` 상수 union 타입 확장
- 위치: `audit-action.const.ts` — `AUTH_CONFIG_CREATE/UPDATE/DELETE/REGENERATE` 4종 추가
- 상세: `AuditAction` union은 `typeof AUDIT_ACTIONS`의 값으로 도출되므로 신규 상수 4종이 자동으로 union에 추가된다. 이는 `AuditLogsService.record({ action })`의 타입 검사 범위를 넓히는 것이며 기존 사용자에게 breaking이 아니다. `AUDIT_ACTIONS` 객체를 직접 iterate하거나 switch/case 전체 망라 구조(`exhaustive switch`)를 사용하는 코드가 있다면 Typescript 오류 또는 런타임 분기 누락이 발생할 수 있으나, 감사 로그 소비자(필터 UI, 조회 API)는 union 타입을 강제하지 않는 read 경로이므로 영향 없다.
- 제안: 문제 없음.

### [INFO] `reveal` 테스트의 `audit.record.mockClear()` 추가 — 테스트 격리 개선
- 위치: `auth-configs.service.spec.ts` — `잘못된 비밀번호 → 401` 및 `passwordHash 없음 → 401` 케이스
- 상세: `create` 호출 후 `auth_config.create` audit 기록이 남아 있어 기존 테스트가 `audit.record`를 호출한 횟수로 reveal 실패를 검증할 때 false positive가 발생할 수 있었다. `mockClear()` 추가로 각 테스트가 reveal 실패만 독립 검증한다. 부작용 없음.

## 요약

이번 변경은 `AuthConfigsService`의 `create/update/regenerate/remove` 메서드에 `userId`(필수) + `ipAddress?`(선택) 파라미터를 추가하고, 각 CRUD 성공 후 best-effort 감사 로그를 기록하는 것이 핵심이다. 가장 주의할 부작용은 서비스 메서드 시그니처 변경으로 인한 타 호출자 컴파일 오류 가능성이나, 컨트롤러 레이어와 테스트 파일이 모두 갱신되어 있고 다른 도메인 서비스가 이 메서드를 직접 호출하는 패턴은 확인되지 않는다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 접근, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 없다. `AUDIT_ACTIONS` 상수 확장은 additive이며 기존 union 사용처에 breaking change를 일으키지 않는다.

## 위험도

LOW
