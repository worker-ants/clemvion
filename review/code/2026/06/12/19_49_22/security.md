# 보안(Security) 코드 리뷰

리뷰 대상: refactor-04-security 브랜치 변경사항 (15개 파일)
리뷰 일시: 2026-06-12

---

## 발견사항

### 인젝션 취약점

- **[INFO]** `safe-regex` 도입으로 ReDoS 방어 강화 (긍정적)
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `filter.handler.ts`, `transform.handler.ts`
  - 상세: 기존에는 `MAX_REGEX_LENGTH`(200자) 길이 제한만으로 ReDoS를 방어했으나, 200자 이내의 `(a+)+$` 같은 지수 백트래킹 패턴이 여전히 컴파일 가능했다. 이번 변경에서 `safe-regex` 라이브러리를 통한 패턴 위험도 사전 검사가 추가되어 단일 chokepoint(`compileUserRegex`)를 통해 길이 + 안전성 + 문법을 통합 검사하도록 개선되었다.
  - 제안: 현재 구현은 양호하다. `safe-regex`는 휴리스틱 기반이므로 false negative 가능성이 있다. 중요도가 높은 환경에서는 정적 분석 기반의 `vuln-regex-detector` 등의 보완 수단도 고려할 수 있다.

- **[INFO]** `safe-regex()` 호출 자체의 예외 처리 미비
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts:1246`
  - 상세: `compileUserRegex` 내부에서 `safeRegex(source)` 호출이 try/catch 없이 실행된다. `safe-regex` 라이브러리 자체가 비정상 입력(예: 매우 특수한 패턴)에서 예외를 throw할 경우 상위 호출자로 uncaught exception이 전파될 수 있다.
  - 제안: `safeRegex(source)` 호출을 try/catch로 감싸서 예외 발생 시 `{ regex: null, reason: 'unsafe' }` 또는 `'invalid'`로 처리하는 방어적 코딩을 추가하라.

- **[INFO]** Prototype pollution 방어 유지 확인
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `transform.handler.ts`
  - 상세: `getNestedValue`가 `__proto__`, `constructor`, `prototype` 경로를 차단하고, `transform.handler.ts`의 `BLOCKED_OBJECT_KEYS`에서도 동일 차단 키를 유지한다. 이번 변경에서도 방어가 유지되고 있음을 확인.
  - 제안: 이상 없음.

### 하드코딩된 시크릿

- **[INFO]** WebSocket 모듈의 JWT fallback 값 `'fallback'`이 blocklist에 미포함
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts:1583`
  - 상세: `JwtModule.registerAsync` 팩토리에 `configService.get<string>('jwt.secret') ?? 'fallback'`이 하드코딩되어 있다. `'fallback'`은 `production-guards.ts`의 `INSECURE_JWT_SECRETS` blocklist에 포함되어 있지 않다. `assertProductionConfig`가 JWT_SECRET의 미설정/빈값/예시값을 검사하므로 `'fallback'`이 실제 production에서 사용될 가능성은 낮지만, 방어 계층이 불완전하다.
  - 제안: `'fallback'`을 `INSECURE_JWT_SECRETS`에 추가하거나, 이 fallback 값을 dev-fallback 와 동일하게 `jwt.config.ts`가 반환하는 값으로 통일하여 blocklist 커버리지를 확보하라.

### 인증/인가

- **[INFO]** WebSocket 채널 IDOR 방어 신규 추가 (긍정적)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: `workflow:<workflowId>` 채널 구독 시 `WorkflowsService.findById(workflowId, workspaceId)`로 소유권 검증을 추가했다. `notifications:<userId>` 채널도 JWT sub 기반 userId 일치 검증을 추가했다. 두 케이스 모두 UUID 형식 사전 검증으로 DB 조회 전 차단하여 ID enumeration 공격을 방지한다.
  - 제안: 이상 없음. 보안 개선사항으로 긍정 평가.

- **[INFO]** `notifications:` 채널의 workspaceId 가드 의존 관계 암묵적
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:1514`
  - 상세: `handleSubscribe`에서 `!workspaceId` 가드가 모든 채널에 공통 적용된다. `notifications:` authorizer 주석에 "인증된 소켓은 JWT에 workspaceId를 함께 담으므로 정상 경로를 막지 않는다"고 적혀 있다. 이 의존 관계(JWT 페이로드에 workspaceId 필드 포함 보장)가 JWT 구조 변경 시 드러나지 않을 수 있다.
  - 제안: JWT에 workspaceId가 포함된다는 의존 관계에 대한 명시적 assertion 또는 테스트를 추가하는 것을 고려하라.

- **[INFO]** Swagger UI production 비노출 게이팅 추가 (긍정적)
  - 위치: `codebase/backend/src/main.ts`, `codebase/backend/src/common/config/production-guards.ts`
  - 상세: `isSwaggerEnabled` 함수가 production에서 기본 비활성화하고 `ENABLE_SWAGGER_IN_PROD=true` opt-in 시만 허용하도록 명시적 게이팅이 추가되었다. Swagger는 인증 없이 전체 API 엔드포인트와 DTO 구조를 노출하므로 OWASP A05(Security Misconfiguration) 관점에서 적절한 보안 강화다.
  - 제안: `ENABLE_SWAGGER_IN_PROD=true` opt-in 활성화 시 Swagger 엔드포인트에 별도 인증(IP 제한, Basic Auth 등)을 요구하는 후속 개선을 고려하라. 현재는 opt-in만으로 무인증 노출이 복귀한다.

### 입력 검증

- **[INFO]** UUID 형식 사전 검증으로 DB 쿼리 전 차단
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: `workflow:`, `execution:`, `background:run:` 채널 모두 `isValidUuid()` 형식 검증을 거친 후 DB 조회를 수행한다. 비-UUID 입력은 DB 쿼리 이전에 거부하여 ID enumeration을 방지한다.
  - 제안: 이상 없음.

### OWASP Top 10

- **[INFO]** ALLOW_PRIVATE_HOST_TARGETS SSRF warn-only 처리 (의도적 설계)
  - 위치: `codebase/backend/src/main.ts:1178-1186`
  - 상세: `ALLOW_PRIVATE_HOST_TARGETS=true`인 경우 throw 대신 warning으로 처리하는 설계는 self-host 용도를 위한 의도적 결정이다. 운영자에게 egress 방화벽/IP allowlist 병행을 권고하는 경고 메시지가 출력된다. SSRF 표면 확장 위험은 인지되어 있다.
  - 제안: `ALLOW_PRIVATE_HOST_TARGETS` 활성화 이벤트를 감사 로그에도 기록하는 것을 고려하라.

- **[INFO]** x-powered-by 헤더 비활성화 유지
  - 위치: `codebase/backend/src/main.ts:1204`
  - 상세: `expressInstance.disable('x-powered-by')`가 이번 리팩터링에서도 유지되어 기술 스택 노출을 방지하고 있다.
  - 제안: 이상 없음.

### 암호화

- **[INFO]** KNOWN_EXAMPLE_ENCRYPTION_KEYS blocklist 유지
  - 위치: `codebase/backend/src/common/config/production-guards.ts:786-791`
  - 상세: `0000...` (전체 zero) 및 `0123456789abcdef...` 패턴이 blocklist에 포함되어 있으며, 둘 모두 엔트로피가 극히 낮아 사실상 평문 키에 해당한다. Production 부팅 시 즉시 throw로 차단되어 적절히 방어되고 있다.
  - 제안: 이상 없음.

### 에러 처리

- **[INFO]** WebSocket 에러 메시지 일반화로 내부 정보 미노출
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
  - 상세: `workflow:` IDOR 거부 시 `'Not authorized for this workflow'`처럼 일반화된 메시지를 반환한다. `findById` throw 내용을 직접 클라이언트에 노출하지 않고 `.catch(() => false)`로 평탄화하여 내부 오류 구현을 숨기고 있다.
  - 제안: 이상 없음.

### 의존성 보안

- **[INFO]** `safe-regex@2.1.1` + `regexp-tree@0.1.27` 신규 의존성 추가
  - 위치: `codebase/backend/package.json`, `codebase/backend/package-lock.json`
  - 상세: 두 라이브러리 모두 알려진 CVE가 없다. `safe-regex`는 ReDoS 패턴 감지를 위한 well-known 라이브러리이며 프로덕션 의존성으로 추가된 것은 적절하다. `@types/safe-regex@1.1.6`은 devDependency로 올바르게 분류되었다.
  - 제안: 이상 없음.

- **[INFO]** `@nestjs-modules/mailer` 내 `chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0` optional peer dependency 추가
  - 위치: `codebase/backend/package-lock.json`
  - 상세: 세 패키지 모두 `optional: true`, `peer: true`로 표시되어 있어 직접 번들링되지 않는다. `chokidar`는 파일 시스템 감시 라이브러리로 production 런타임에서 사용되지 않는 것으로 보이며, 알려진 CVE가 없다.
  - 제안: 이상 없음.

---

## 요약

이번 변경은 전반적으로 보안 강화 방향의 리팩터링으로 긍정적으로 평가된다. 핵심 개선사항은 세 가지다: (1) 사용자 입력 regex에 대한 ReDoS 방어를 `safe-regex` 휴리스틱 기반으로 강화하여 길이 제한만으로는 막지 못했던 지수 백트래킹 패턴을 컴파일 전 단일 chokepoint에서 거부하도록 확립했다. (2) WebSocket 채널 구독에 `workflow:` 및 `notifications:` IDOR 방어 authorizer를 추가하여 cross-workspace 이벤트 도청 위험을 제거했다. (3) Swagger UI를 production에서 기본 비노출로 변경하여 무인증 API 표면 정찰을 차단했다. 주목할 개선 권고 사항은 `safe-regex()` 호출 자체에 대한 try/catch 방어 부재 및 `websocket.module.ts`의 JWT `'fallback'` 값이 blocklist에 미포함된 점이나, 두 사항 모두 즉각적인 보안 위험은 낮다. Critical 또는 Warning 수준의 신규 보안 취약점은 발견되지 않았다.

---

## 위험도

LOW
