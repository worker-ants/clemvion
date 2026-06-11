# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `req.ip` 직접 사용 — spec §2.3 IP 추출 정책 미준수로 포렌식 정확도 저하 가능
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `create`, `update`, `regenerate`, `remove` 핸들러 (각각 `req.ip` 전달 라인)
  - 상세: 본 변경이 추가한 4개 핸들러 모두 `req.ip` 를 그대로 감사 로그 `ipAddress` 로 전달한다. Express 의 `req.ip` 는 `trust proxy` 설정이 없으면 프록시/로드밸런서 IP 를 반환하고, 반대로 `trust proxy` 를 과도하게 설정하면 `X-Forwarded-For` 헤더 위조를 통해 임의 IP 를 감사 로그에 기록시킬 수 있다(IP 스푸핑). spec §2.3 에는 `CF-Connecting-IP → X-Forwarded-For → req.ip` 우선순위 정책이 정의되어 있으나 이 컨트롤러는 이를 따르지 않는다. 단, 기존 `reveal` 핸들러도 동일하게 `req.ip` 를 직접 사용하므로 본 PR 이 신규로 도입한 위험은 아니다. 감사 로그 IP 는 인가 게이트가 아니라 포렌식 목적이므로 실제 권한 우회 위협은 없다.
  - 제안: 공통 `extractClientIp(req)` 헬퍼(또는 `@ClientIp()` 커스텀 파라미터 데코레이터)를 추출해 spec §2.3 의 CF-Connecting-IP → X-Forwarded-For → req.ip 폴백 정책을 단일 위치에서 관리. `reveal` 핸들러까지 포함한 광범위 변경이므로 `auth-config-webhook-followups.md §3` 후속 작업으로 추적 권장.

- **[INFO]** `ipAddress` optional(`?`) — 내부 경로에서 호출 시 IP 미기록 가능
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 시그니처 (`ipAddress?: string`)
  - 상세: 서비스 메서드가 `ipAddress` 를 선택적 파라미터로 받는다. 현재 컨트롤러 경로는 항상 `req.ip` 를 전달하므로 정상 HTTP 경로에서는 문제 없다. 그러나 향후 배치 작업·마이그레이션 스크립트 등 내부 경로에서 서비스를 직접 호출할 경우 `ipAddress` 누락으로 감사 로그에 IP 가 `NULL` 로 기록된다. spec/data-flow/1-audit.md §1.1 에 "auth_config 계열은 모두 `ipAddress` 를 함께 전달"이라고 명시되어 있으므로 이 계약이 깨질 수 있다. best-effort 설계 의도와 일치하나 내부 호출 컨벤션 문서화가 부재하다.
  - 제안: 서비스 JSDoc `@remarks` 에 "내부 직접 호출 시 `ipAddress` 를 제공하지 않으면 감사 로그에 IP 가 기록되지 않음"을 명시하거나, 내부 호출 전용 `AuditContext` 타입(`{ userId: string; ipAddress?: string }`)을 도입해 호출부에서 IP 생략 여부를 의식적으로 결정하도록 유도.

- **[INFO]** `Object.assign(config, data)` — DTO 우회 시 mass-assignment 가능
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `update` 메서드 내 `Object.assign(config, data)` 라인
  - 상세: `data` 파라미터가 `Partial<AuthConfig>` 타입이고 컨트롤러에서 `UpdateAuthConfigDto` 로 검증하지만, `Object.assign` 은 화이트리스트 기반이 아니라 `data` 에 포함된 모든 키를 엔티티에 덮어쓴다. DTO 검증을 우회하거나(내부 직접 호출, 테스트 코드 등) DTO 에 허용하지 않으려 했던 필드가 실수로 포함되면 `workspaceId`, `id` 등 민감 필드가 덮어씌워질 수 있다. 현재 DTO 가 충분히 제한적이라면 HTTP 경로에서는 낮은 위험이나, 방어 깊이(defense in depth) 관점에서 서비스 레이어도 필드를 명시적으로 선택해야 한다. 이 패턴은 본 PR 이전부터 존재한다.
  - 제안: `Object.assign` 대신 허용된 필드만 명시적으로 구조 분해/pick 하거나(`const { name, type, config: cfg } = data; Object.assign(config, { name, type, config: cfg })`), TypeORM 의 `update({ id }, { ...allowedFields })` partial update 를 사용. 최소한 `id`, `workspaceId` 를 `Omit` 한 타입으로 제한 권장.

- **[INFO]** `constantTimeEquals` — 길이 불일치 시 즉시 `false` 반환으로 길이 정보 누출
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `constantTimeEquals` 메서드 (`private constantTimeEquals(a, b)`)
  - 상세: 두 문자열 길이가 다를 경우 즉시 `false` 를 반환한다. 엄밀히는 `timingSafeEqual` 이 `RangeError` 를 던지지 않게 막는 방어 코드이나, 응답 시간으로 토큰 길이를 추론하는 timing side-channel 이 이론적으로 가능하다. 현재 `wfk_`, `wft_`, `whs_` prefix + 고정 길이 hex 구조의 토큰을 사용하므로 실용적 위협은 매우 낮다. 또한 본 PR 의 신규 도입이 아니라 기존 코드이다.
  - 제안: 위협도 낮음. 순수한 constant-time 비교가 필요하다면 두 버퍼를 최대 길이로 패딩 후 `timingSafeEqual` 로 비교하는 방식을 검토. 현재 고정 길이 토큰 맥락에서는 수용 가능.

- **[INFO]** `basic_auth` 타입 — `regenerate` 호출 시 자격증명 미교체 상태로 `auth_config.regenerate` 감사 기록
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `regenerate` 메서드 내 `basic_auth` 미처리 분기
  - 상세: `regenerate` 는 `api_key`, `bearer_token`, `hmac` 세 타입에 대해서만 새 값을 발급한다. `basic_auth` 타입은 처리 분기 없이 그대로 저장되고 `auth_config.regenerate` 감사 로그가 기록된다. 즉, 실제 자격증명은 바뀌지 않았는데 "재발급" 이벤트가 감사 로그에 남는다. 감사 로그가 실제 상태 변화를 정확히 반영하지 못해 포렌식 오류 가능성이 있다. 보안 결함이라기보다 감사 무결성 문제이다. 이 동작은 본 PR 이전부터 존재한다.
  - 제안: `basic_auth` 타입에 `BadRequestException` 을 던지거나(`재발급 불가 타입`), 감사 로그 기록 전에 실제 변경이 있었는지 확인하는 조건을 추가. spec/5-system/1-auth.md 에 `basic_auth` 의 regenerate 허용 여부를 명시하는 것도 선행 필요 (project-planner 영역).

- **[INFO]** `reveal` 엔드포인트 — rate limiting 미적용 (기존 인지 항목)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `reveal` 핸들러 (`@Post(':id/reveal')`)
  - 상세: 비밀번호 재확인 + bcrypt 비교가 있어 brute-force 비용이 높지만, `@Throttle` 데코레이터 또는 전역 Throttler 미적용 시 병렬 요청 폭격이 가능하다. plan/in-progress/auth-config-webhook-followups.md §4 에서 이미 추적 중인 항목이며 본 PR 의 신규 도입이 아니다.
  - 제안: `@Throttle` 데코레이터 또는 전역 Throttler 설정 적용. plan §4 에서 이미 추적 중이므로 해당 후속 작업에 위임.

---

## 요약

이번 변경은 AuthConfig CRUD 4종(create/update/regenerate/remove)에 감사 로그 기록을 추가하는 보안 강화 작업으로, 행위 주체(`@CurrentUser('sub')`) 와 요청 IP(`req.ip`)를 capture 해 audit trail 을 확장하는 올바른 방향이다. `@Roles('admin')` 가드로 모든 CRUD 접근을 Admin+ 로 제한하고, HMAC 알고리즘 화이트리스트(`sha256/sha512`), constant-time 비교(`timingSafeEqual`), `SECRET_CONFIG_KEYS` 마스킹, bcrypt reveal 재확인 등 기존 보안 설계가 잘 유지되고 있다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 경로 탐색, 알려진 취약 의존성은 발견되지 않았다. 주요 잔여 위험은 (1) `req.ip` 가 spec §2.3 의 IP 추출 정책을 따르지 않아 프록시 환경에서 IP 스푸핑 가능성(포렌식 정확도 문제, 인가 우회 아님), (2) `Object.assign` 기반 update 의 서비스 레이어 mass-assignment 방어 부재이며 모두 INFO 수준이다. 두 항목 모두 기존 코드 패턴이고 본 PR 이 신규로 도입한 위험이 아니다.

## 위험도

LOW
