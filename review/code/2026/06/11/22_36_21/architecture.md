# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] userId/ipAddress 를 서비스 메서드 시그니처에 직접 전파하는 방식 — 감사 컨텍스트 누수
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 메서드 시그니처
- 상세: `userId: string`과 `ipAddress?: string`이 비즈니스 로직 파라미터(workspaceId, data 등)와 동일 계층에 혼재한다. 서비스 메서드의 1차 책임은 도메인 CRUD인데, 감사 컨텍스트(행위자·요청 IP)가 그 계층까지 노출됨으로써 단일 책임 원칙(SRP) 경계가 흐려진다. 현재 규모(도메인 1개, 메서드 4개+reveal)에서는 감수할 수 있으나, 이 패턴을 여러 도메인 서비스로 확산할 경우 모든 서비스 시그니처에 감사 관심사가 침투한다.
- 제안: 단기적으로 수용 가능. 중기적으로는 `{ userId: string; ipAddress?: string }` 형태의 `AuditContext` 값 객체를 공통 DTO로 추출하거나, `AsyncLocalStorage` 기반 요청 컨텍스트 주입(NestJS `REQUEST` 스코프 또는 `CLS` 모듈)으로 서비스 시그니처에서 감사 컨텍스트를 제거하는 것을 검토한다.

---

### [INFO] 컨트롤러가 `req.ip`를 직접 참조 — IP 추출 로직이 분산됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `create`, `update`, `regenerate`, `remove` 핸들러
- 상세: IP 추출이 `req.ip` 단순 참조로 4개 핸들러에 인라인 분산돼 있다. spec §2.3 은 `CF-Connecting-IP → X-Forwarded-For → req.ip` 순서를 정의하는데, 이 정책이 컨트롤러 안에서 구현되지 않고 Express 기본 동작에 위임되어 있다. 또한 `reveal` 엔드포인트가 동일 서비스 내에 있어 IP 추출 방식이 두 경로에서 달라질 위험이 있다. 레이어 책임(HTTP 컨텍스트 추출 정책의 단일화) 관점에서 개선 여지가 있다.
- 제안: `extractClientIp(req: Request): string | undefined` 공통 헬퍼 함수 또는 `@ClientIp()` 커스텀 파라미터 데코레이터를 도입해 `CF-Connecting-IP → X-Forwarded-For → req.ip` 폴백 정책을 단일 위치에서 관리한다. 이미 `reveal` 핸들러가 같은 패턴을 사용하므로, 헬퍼 도입 시 `reveal`도 함께 통합하면 모듈 내 일관성이 확보된다.

---

### [INFO] `AuthConfigsService`에 CRUD 관리 경로와 웹훅 인증 검증 경로가 공존 — 응집도 저하 소지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `verifyWebhookRequest`, `ipInWhitelist`, `parseIp`, `verifyBearer`, `verifyApiKey`, `verifyBasicAuth`, `verifyHmac`
- 상세: 이번 변경 범위는 CRUD audit 추가이지만, 결과적으로 `create/update/regenerate/remove/reveal`(관리 API 경로)와 `verifyWebhookRequest/ipInWhitelist/parseIp/verify*`(런타임 웹훅 검증 경로)가 단일 서비스 클래스에 공존한다. 두 책임군의 변경 빈도·소비자(컨트롤러 vs 훅 서비스)·관심사가 다르다. 현재 규모에서는 허용 범위이나, CRUD 메서드에 감사 로직이 추가됨에 따라 클래스 크기가 커지고 응집도가 낮아지는 방향으로 진행 중이다.
- 제안: 즉각 분리 필요는 없으나, 웹훅 검증 로직(`verifyWebhookRequest` + private verify 메서드들)이 독립적으로 진화할 경우 `AuthConfigVerifyService`로 분리하는 것을 후속 작업으로 등록한다. 이번 PR 범위는 아니다.

---

### [INFO] `AUDIT_ACTIONS` 상수의 동사 시제 혼재 — 확장 시 관례 판단 어려움
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- 상세: `INTEGRATION_*` 계열은 과거분사(`created/updated/deleted`), `EXECUTION_RE_RUN`은 복합형, `AUTH_CONFIG_*`은 현재형(`create/update/delete`)이다. 파일 JSDoc이 "도메인별 일관 유지" 를 명시하고 있어 의도된 설계이며, auth_config 현재형 근거도 spec §4.1에 추가됐다. 아키텍처 위험보다는 신규 도메인 추가 시 어느 관례를 따를지 혼란을 야기할 수 있는 설계 부채다.
- 제안: 현재 JSDoc 수준으로 충분하다. 단, 향후 신규 도메인 감사 action 추가 시 JSDoc 예시 행에 해당 도메인 verb 관례 근거를 병기하는 패턴을 유지한다.

---

### [INFO] 감사 기록이 주 동작(save/remove) 성공 후 분리된 `await`로 호출됨 — 트랜잭션 원자성 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create/update/regenerate/remove` 의 `await this.auditLogsService.record(...)` 호출 위치
- 상세: 주 동작과 감사 기록이 별도 `await`로 호출되어 원자적 트랜잭션을 구성하지 않는다. `AuditLogsService.record`가 내부에서 실패를 swallow하는 best-effort 계약이 JSDoc에 명시되어 있어 의도된 설계다. 그러나 주 동작 성공 + 감사 기록 실패 조합 시 감사 로그 누락이 silent하게 발생할 수 있으며, 특히 `remove` 의 경우 삭제 완료 후 기록 실패 시 삭제 이벤트가 감사 로그에서 완전 소실된다. `reveal` 엔드포인트도 동일 패턴이므로 이번 변경이 신규 도입한 위험은 아니다.
- 제안: best-effort 정책을 명시적으로 수용한다면 현재 수준으로 적절하다. 감사 로그 손실을 허용하지 않는 강화된 요구가 생길 경우, 동일 DB 트랜잭션 내 포함 또는 outbox 패턴을 검토한다.

---

### [INFO] `crypto` 이중 임포트 — `import * as crypto` + `import { randomBytes } from 'crypto'`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 라인 8-9
- 상세: 동일 모듈에서 namespace import와 named import가 동시에 사용된다. 기능적으로는 문제없으나 모듈 경계의 명확성 측면에서 불필요한 중복이며, 향후 유지보수자가 두 방식 중 어느 것을 사용해야 하는지 혼란을 줄 수 있다. 이 파일은 이번 변경 이전부터 존재했던 패턴이다.
- 제안: `import * as crypto`를 제거하고 필요한 심볼(`randomBytes`, `createHmac`, `timingSafeEqual` 등)을 named import로 통일하거나, 반대로 named import를 제거하고 `crypto.randomBytes(...)`로 통일한다. 코드베이스 내 다른 서비스의 관례를 따른다.

---

## 요약

이번 변경은 `AuthConfig` CRUD 4개 메서드에 감사 로그(`auth_config.create/update/delete/regenerate`)를 추가하는 좁고 일관된 패턴이다. `AUDIT_ACTIONS` 상수 SoT 강제, `AUTH_CONFIG_RESOURCE_TYPE` 상수 추출로 인라인 문자열을 제거한 것, JSDoc을 통한 best-effort 계약 명시, 레이어 책임(감사 기록은 서비스 레이어, HTTP 컨텍스트 추출은 컨트롤러) 분리 방향은 올바르다. 순환 의존성·레이어 역전·안티패턴은 확인되지 않았다. 주요 아키텍처 기술 부채는 두 가지로, 첫째 감사 컨텍스트(userId, ipAddress)가 서비스 시그니처에 직접 침투해 CRUD 관심사와 감사 관심사가 혼재하는 점(SRP 경계 흐림), 둘째 `req.ip` 직접 참조가 4개 핸들러에 분산되어 spec §2.3 IP 추출 정책과 불일치한다는 점이다. 두 항목 모두 INFO 수준이며, 현재 단일 도메인 범위에서는 허용 가능하나 패턴이 확산될 경우 공통화가 필요하다.

## 위험도

LOW
