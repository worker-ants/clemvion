# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] userId/ipAddress 를 서비스 시그니처에 직접 전파하는 방식
- 위치: `auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 메서드 시그니처
- 상세: `userId`와 `ipAddress`를 서비스 메서드 파라미터로 직접 수용한다. 현재 규모(단일 도메인, 5개 메서드)에서는 허용 가능하지만, 이 패턴을 전체 코드베이스에 확산하면 서비스 시그니처가 감사 로그 관심사를 포함하게 된다. 대안(AuditContext 값 객체 분리, AsyncLocalStorage 기반 요청 컨텍스트 주입)이 존재하나 현재 코드베이스의 일관된 패턴으로 사용된다면 문제 없다.
- 제안: 단기적으로 수용 가능. 단, 새 도메인에 audit 기록을 추가할 때마다 동일 패턴을 반복해야 한다면, `AuditContext` 값 객체(userId + ipAddress)를 common DTO 로 추출해 파라미터 수 증가를 억제하는 것을 검토한다.

### [INFO] 컨트롤러가 `req.ip` 를 직접 참조
- 위치: `auth-configs.controller.ts` — create/update/regenerate/remove 핸들러, `@Req() req: Request`
- 상세: IP 추출 로직이 컨트롤러 4곳에 `req.ip` 인라인으로 분산되어 있다. spec §2.3 에 따르면 클라이언트 IP 추출은 `CF-Connecting-IP` → `X-Forwarded-For` → `req.ip` 순서를 따르는 것이 정책이나, 이 컨트롤러는 `req.ip` 만 사용한다. `reveal` 엔드포인트(동일 서비스)와 IP 추출 로직이 불일치할 경우 감사 로그 품질이 저하된다.
- 제안: 공통 `extractClientIp(req)` 헬퍼 함수(또는 custom `@ClientIp()` 파라미터 데코레이터)를 추출해 CF-Connecting-IP → X-Forwarded-For → req.ip 정책을 단일 위치에서 관리한다. 이는 레이어 책임(HTTP 추출 로직의 단일화)과 직결된다.

### [INFO] `AUDIT_ACTIONS` 상수 파일의 verb 시제 불일치 — 의도된 예외이나 명시적 문서화 필요
- 위치: `audit-action.const.ts` — INTEGRATION_* vs AUTH_CONFIG_*
- 상세: integration 계열은 과거분사(`created`/`updated`/`deleted`), auth_config 계열은 현재형(`create`/`update`/`delete`)로 도메인별 관례가 다르다. 이는 spec §4.1 에 명시된 의도된 설계 결정이며, 상수 파일 주석도 이를 설명한다. 아키텍처 차원의 위험보다는 신규 도메인 추가 시 어느 관례를 따를지 혼란을 야기할 수 있다.
- 제안: 현재 주석 수준으로 충분하다. 단, 추후 `AUDIT_ACTIONS` 에 새 도메인을 추가할 때 spec §4.1 에 해당 도메인의 verb 관례 근거를 명시하는 패턴을 유지한다.

### [INFO] 감사 기록이 주 동작 성공 후 분리된 `await`로 호출됨 — 트랜잭션 원자성 없음
- 위치: `auth-configs.service.ts` — create/update/regenerate/remove 의 `await this.auditLogsService.record(...)` 호출 위치
- 상세: 주 동작(save/remove)과 감사 기록이 별도 `await` 로 호출되어 원자적 트랜잭션을 구성하지 않는다. 서비스 주석에 "best-effort — AuditLogsService.record 가 실패를 내부에서 swallow 한다"는 계약이 명시되어 있어 의도된 설계이다. 그러나 주 동작 성공 + 감사 기록 실패 시 감사 로그 누락이 silent 하게 발생할 수 있다.
- 제안: 설계 의도를 명시적으로 수용한다면 현재 수준으로 적절하다. `reveal` 엔드포인트도 동일 패턴(best-effort)을 따르므로 모듈 내 일관성은 있다. 만약 감사 로그 손실을 허용하지 않는 요구가 생기면 동일 DB 트랜잭션 내에 포함하거나 outbox 패턴을 검토한다.

### [INFO] `verifyWebhookRequest` 가 동일 서비스 클래스에 공존 — 단일 책임 경계 검토
- 위치: `auth-configs.service.ts` — `verifyWebhookRequest`, `ipInWhitelist`, `parseIp`, `verifyBearer`, `verifyApiKey`, `verifyBasicAuth`, `verifyHmac`
- 상세: 이번 변경 범위는 아니지만, 서비스에 CRUD(관리 API용) + 웹훅 인증 검증(런타임 경로)이 공존한다. 두 책임군의 변경 빈도와 소비자(controller vs hooks.service)가 다르다. 현재 규모에서는 허용 가능하나, 서비스가 커질수록 응집도가 낮아진다.
- 제안: 현 시점에서 강제 분리 불요. 웹훅 인증 검증 로직이 독립적으로 진화할 경우(`verifyWebhookRequest` + private verify 메서드들)를 별도 `AuthConfigVerifyService` 로 분리하는 것을 후속 작업으로 등록한다. 이번 PR의 감사 로그 추가 범위와는 무관하다.

## 요약

이번 변경은 AuthConfig CRUD 5개 작업(create/update/delete/regenerate/reveal)에 감사 로그를 추가하는 좁고 일관된 패턴이다. SOLID 원칙 중 개방-폐쇄(기존 로직 무수정 확장), 레이어 책임(감사 기록은 서비스 레이어에서 처리, 컨트롤러는 HTTP 컨텍스트 전파만 담당) 측면에서 올바른 방향을 취한다. `AUTH_CONFIG_RESOURCE_TYPE` 상수 추출로 인라인 문자열을 제거하고, `AUDIT_ACTIONS` 상수 SoT 원칙을 유지한 것도 긍정적이다. 주요 아키텍처 경보는 없으며, IP 추출 정책 불일치(`req.ip` 직접 사용 vs spec 의 CF/XFF/req.ip 폴백 정책)와 audit 컨텍스트 파라미터 확산 패턴이 기술 부채로 등록할 가치가 있는 INFO 수준 관찰이다. 순환 의존성·레이어 위반·안티패턴은 확인되지 않았다.

## 위험도

LOW
