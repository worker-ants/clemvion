# Testing Review — auth-config-webhook-wiring

## 발견사항

### [CRITICAL] HooksService 테스트가 inline-auth 경로만 커버 — AuthConfig 단일 진입 경로 테스트 전무

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/hooks/hooks.service.spec.ts` 전체 / `hooks.service.ts` `verifyAuth()` 메서드
- 상세: spec 변경(12-webhook.md)은 webhook 인증의 단일 진입을 `trigger.auth_config_id → AuthConfig` FK 경로로 격상하고 inline `config.authType` 경로를 폐지했다. 그러나 실제 `hooks.service.ts` 의 `verifyAuth()` 는 여전히 `config.authType` / `config.bearerToken` / `config.secret` 등 인라인 필드를 읽고 있으며, `authConfigId` 를 통해 `AuthConfigsService.findById()` 를 호출하는 로직이 전혀 존재하지 않는다. `hooks.service.spec.ts` 의 모든 auth 테스트(`bearerTrigger`, `hmacTrigger` 등)도 `config.authType = 'bearer'` / `config.authType = 'hmac'` 인 인라인 픽스처를 사용한다. 즉, spec 에서 설계한 AuthConfig 단일 진입 경로에 대한 구현도 없고 테스트도 없다.
- 제안: (1) `HooksService` 에 `AuthConfigsService` 를 주입하고 `auth_config_id IS NOT NULL` 분기에서 `findById()` → `is_active` 확인 → `ip_whitelist` 검증 → 타입별 검증 → `last_used_at` fire-and-forget UPDATE 흐름을 구현, (2) 다음 테스트 케이스를 추가:
  - `auth_config_id` 가 null 이면 인증 없이 통과
  - AuthConfig.is_active === false 이면 401 AUTH_FAILED
  - bearer_token 타입: 올바른 토큰 통과 / 불일치 401
  - api_key 타입: 커스텀 헤더 포함 올바른 키 통과 / 불일치 401
  - basic_auth 타입: base64 디코드 후 username:password 비교 통과 / 불일치 401
  - hmac 타입: AuthConfig.config.header / config.algorithm 활용 서명 통과 / 불일치 401
  - ip_whitelist 불일치 시 401 AUTH_FAILED
  - `last_used_at` fire-and-forget UPDATE 호출 검증 (성공 시만 갱신, 실패 시 미갱신)
  - AuthConfig row 가 없을 때(삭제된 경우) 401 또는 404 처리 정책 결정 후 테스트

---

### [CRITICAL] 신규 Auth Config Reveal 엔드포인트(`POST /api/auth-configs/:id/reveal`) 구현 및 테스트 부재

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` / `auth-configs.service.ts`
- 상세: spec(1-auth.md) 은 `Auth Config Reveal` 을 별도 권한 행(Owner/Admin 전용)으로 분리하고, `POST /api/auth-configs/:id/reveal` 엔드포인트를 명시한다. 이 엔드포인트는 현재 로그인 비밀번호 재확인 + audit 기록(`auth_config.reveal` 이벤트)을 요구하는 민감 동작이다. 그러나 컨트롤러에 `reveal` 핸들러가 존재하지 않고, 서비스에 `reveal()` 메서드도 없다. `auth-configs.controller.spec.ts` 도 `reveal` 에 대한 케이스가 없다.
- 제안: (1) `AuthConfigsService.reveal(id, workspaceId, password)` 구현 — 비밀번호 재확인 + `AuditLog` 기록 + 평문 반환, (2) 컨트롤러에 `@Post(':id/reveal')`, `@Roles('admin')` 핸들러 추가, (3) 다음 테스트 케이스를 추가:
  - Owner/Admin 은 reveal 성공(평문 반환)
  - Editor/Viewer 는 403 Forbidden
  - 비밀번호 불일치 시 401/400
  - reveal 성공 시 AuditLog `auth_config.reveal` 기록 확인

---

### [CRITICAL] AuthConfig 관련 AuditLog 기록 구현 및 테스트 부재

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` create / update / remove / regenerate 메서드
- 상세: spec(1-auth.md §4.1) 은 `auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal` 5종 감사 로그를 필수로 규정한다. 현재 `AuthConfigsService` 의 어떤 메서드에도 AuditLog 기록 로직이 없다. 이에 따라 테스트도 전무하다.
- 제안: 각 메서드에 `AuditLogService.log(workspaceId, userId, 'auth_config.create', ...)` 호출 추가 후, 서비스 단위 테스트에서 auditLog 호출 여부를 mock 으로 검증하는 케이스 추가.

---

### [WARNING] `auth-configs.controller.spec.ts` — reveal 및 신규 RBAC 행 미검증

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts` L8-13
- 상세: 컨트롤러 spec 은 `create`, `update`, `regenerate`, `remove` 4개의 `@Roles` 만 검증한다. spec 변경으로 추가된 `reveal`(Admin+) 핸들러가 생겼을 때 이 파일에 케이스가 없으면 권한 가드 누락을 조기에 발견하지 못한다. 또한 `remove` 가 현재 `@Roles('editor')` 로 설정되어 있으나 spec §3.2 에서 Auth Config CRUD 는 Admin/Owner 이며 Delete 도 포함인데, 컨트롤러는 editor 로 설정되어 있어 권한 불일치가 있다 — 이에 대한 테스트가 없으면 발견이 불가하다.
- 제안: (1) `reveal` 핸들러가 구현되면 `{ method: 'reveal', expected: ['admin'] }` 케이스 추가, (2) `remove` 의 `@Roles` 가 spec 과 일치하는지 확인 및 테스트 반영.

---

### [WARNING] `hooks.service.spec.ts` — `activeTrigger.config` 픽스처가 폐지 예정 inline 필드 사용

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/hooks/hooks.service.spec.ts` L104 (`config: { authType: 'none' }`)
- 상세: spec 은 V065 cleanup migration 으로 `trigger.config` 의 `authType` / `bearerToken` / `secret` / `hmacHeader` / `hmacAlgorithm` 필드를 제거한다. 현재 테스트 픽스처가 이 필드들을 그대로 사용하기 때문에, 실제 구현이 spec 대로 인라인 필드를 무시하도록 변경되면 기존 테스트가 잘못된 시나리오를 검증하게 된다. `bearerTrigger`, `hmacTrigger` 픽스처도 동일 문제.
- 제안: V065 migration 적용 이후 픽스처를 `config: {}` (또는 비인증 관련 필드만 포함)로 교체하고, 인라인 필드가 코드에서 무시되는지 확인하는 회귀 테스트 추가.

---

### [WARNING] `HooksService` 에서 AuthConfig row 삭제(트리거 참조 중 삭제) 시 동작 미검증

- 위치: `hooks.service.ts` — 미구현 AuthConfig 조회 경로
- 상세: spec §7.6b 는 `authConfigsService.findById(trigger.auth_config_id, trigger.workspace_id)` 로 AuthConfig 를 조회한다. AuthConfig 가 이미 삭제된 상태에서 webhook 이 호출되면 `findById` 는 `NotFoundException` 을 던지는데, 이 예외가 webhook 처리 흐름에서 어떻게 처리될지 정의가 없고 테스트도 없다. 이 경우 500 이 노출될 가능성이 있다.
- 제안: AuthConfig not found 시 401 AUTH_FAILED 로 정규화하는 catch 처리 추가 + 테스트 케이스.

---

### [WARNING] `last_used_at` fire-and-forget UPDATE — 실패 시 미갱신 동작 테스트 부재

- 위치: spec 12-webhook.md WH-SC-08 / `hooks.service.ts` — 미구현
- 상세: spec 은 인증 성공 후 `last_used_at = NOW()` 를 트랜잭션 외에서 fire-and-forget으로 갱신하고, 실패 시 미갱신을 명시한다. 이 fire-and-forget 패턴은 DB 오류가 webhook 응답을 블로킹하지 않아야 하는 요구사항이므로 별도 테스트가 필요하다.
- 제안: `authConfigRepository.update()` 가 reject 하더라도 webhook 응답 `202` 는 정상 반환됨을 검증하는 테스트 케이스 추가.

---

### [WARNING] Basic Auth — base64 디코딩 엣지 케이스 테스트 필요

- 위치: spec 12-webhook.md §4.5 (미구현)
- 상세: spec 은 `Authorization: Basic base64(username:password)` 형식을 `basic_auth` 타입으로 지정한다. Base64 디코딩 중 `:` 구분자 누락, 잘못된 base64 문자열, 빈 username/password 등의 엣지 케이스에 대한 검증이 필요하다.
- 제안: basic_auth 구현 시 다음 케이스를 테스트로 포함: 정상 username:password 매칭, `:` 없는 base64, 빈 username, 올바르지 않은 base64 인코딩.

---

### [WARNING] IP Whitelist 검증 — CIDR 표기 및 IPv6 엣지 케이스 미정의

- 위치: spec 12-webhook.md WH-SC-09 / 1-auth.md §3.2
- 상세: spec 은 `AuthConfig.ip_whitelist` 가 설정된 경우 클라이언트 IP allowlist 를 시행한다고 명시하지만, CIDR 블록 지원 여부, IPv6 형식 일치, Cloudflare `CF-Connecting-IP` 헤더 우선순위 등 구체적인 비교 방식이 정의되어 있지 않다. 구현 시 테스트가 없으면 IP 파싱 오류로 인한 false reject/accept 위험이 있다.
- 제안: (1) spec 에 CIDR 지원 여부와 IP 추출 헤더 우선순위(CF-Connecting-IP → X-Forwarded-For → req.ip)를 명시, (2) 구현 시 정확한 IP 매칭 / CIDR 내 IP / 화이트리스트 외 IP 거부 / 헤더 없음 처리 케이스를 테스트로 작성.

---

### [INFO] `AuthConfigsService.findById` — workspace_id 격리 확인 테스트 부재

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L45-56
- 상세: `findById` 는 `{ id, workspaceId }` 조건으로 조회하므로 다른 워크스페이스의 AuthConfig 는 조회되지 않는다. 그러나 이 격리 동작을 명시적으로 검증하는 단위 테스트가 없다. webhook 인증 경로에서 `HooksService` 가 `authConfigsService.findById(trigger.auth_config_id, trigger.workspace_id)` 를 호출할 때 workspace_id 가 정확히 전달되는지도 검증이 필요하다.
- 제안: `AuthConfigsService` 단위 테스트에 "다른 workspaceId 로 조회 시 404" 케이스 추가.

---

### [INFO] `hooks.service.spec.ts` — import 중복(`UnauthorizedException` 두 번 import)

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/hooks/hooks.service.spec.ts` L10 및 L22
- 상세: `UnauthorizedException` 이 두 곳에서 import 되어 있다(L10: `@nestjs/common` 묶음, L22: 단독). 컴파일은 통과하지만 코드 품질 문제이며 향후 혼란 가능성이 있다.
- 제안: 중복 import 제거.

---

## 요약

이번 변경은 spec 4개 파일(`1-auth.md`, `12-webhook.md`, `secret-store.md`, `data-flow/10-triggers.md`)에 대한 설계 수정만 포함되며 구현 코드는 변경되지 않았다. 그러나 spec 에서 선언한 핵심 기능 두 가지 — (1) webhook 인증 경로를 `trigger.auth_config_id → AuthConfig` 단일 진입으로 격상하는 것, (2) `Auth Config Reveal` 엔드포인트 신설 — 의 구현과 테스트가 전무한 상태다. 실제 `hooks.service.ts` 는 여전히 폐지 예정인 inline `config.authType` 경로만 사용하고 `authConfigId` 를 활용하지 않으며, `hooks.service.spec.ts` 의 모든 auth 테스트도 인라인 픽스처 기반이다. spec 이 명시한 `is_active` 확인, `ip_whitelist` 시행, `last_used_at` fire-and-forget 갱신, `AUTH_FAILED` 단일 메시지 정책, `reveal` RBAC, AuditLog 기록 등의 동작은 모두 테스트 커버리지가 없다. spec 선행 변경 후 구현이 뒤따르는 SDD 방식임을 감안하더라도, 본 PR 에 해당하는 plan 파일에 구현 phase 가 명확히 계획되어 있는지, 그리고 구현 PR 에서 위 테스트 케이스들이 반드시 작성되어야 함을 강조한다.

## 위험도

HIGH
