# 보안(Security) 리뷰 결과

## 발견사항

### [WARNING] IP 주소 신뢰 — X-Forwarded-For 헤더 조작 가능성
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (변경 라인 133, 238), `extractClientIp` 함수 구현
- 상세: `extractClientIp(input.headers)` 결과를 `source_ip` 로 DB에 영속한다. X-Forwarded-For 헤더는 클라이언트가 임의로 조작할 수 있으며, 리버스 프록시 없이 직접 노출된 경우 공격자가 신뢰할 수 없는 IP를 주입할 수 있다. 현재 코드는 XFF 첫 번째 값(`198.51.100.9, 10.0.0.1` → `198.51.100.9`)을 신뢰하는 패턴을 보여준다(테스트 기준). 이 값이 인증 IP Whitelist 검증에도 공용으로 사용되고 있어(`clientIp` 변수 재사용), 조작된 IP가 whitelist 우회 수단으로 활용될 수 있다.
- 제안: `extractClientIp` 구현이 환경(로드밸런서 홉 수, trusted proxy CIDR)을 고려하여 rightmost-trusted 방식 또는 고정 홉 offset 방식으로 구현되었는지 확인 필요. 인증 whitelist 검증과 로깅용 IP 추출 로직을 분리하고, 로깅용은 위험도가 낮지만 whitelist 검증용은 반드시 검증된 trusted-proxy 방식을 사용해야 한다.

### [WARNING] source_ip 컬럼에 입력 검증 없음 — DB 레이어에만 의존
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (변경 라인 776-791), `codebase/backend/src/modules/executions/entities/execution.entity.ts` (변경 라인 821-822)
- 상세: `sourceIp` 값이 `ExecuteOptions`에서 `string | undefined` 타입으로 받아 검증 없이 그대로 DB에 저장된다. SQL 인젝션은 TypeORM 파라미터 바인딩으로 방어되지만, 형식 검증(IPv4/IPv6 형식 준수 여부)이 없어 비정상적으로 긴 문자열이나 비-IP 형식 값이 DB에 저장될 수 있다. `VARCHAR(45)` 길이 제약이 있으나 이는 DB 레이어 최후 방어선이다.
- 제안: hooks.service에서 `extractClientIp` 결과를 `execute()` 에 전달하기 전에 IPv4/IPv6 형식 검증(예: `net.isIP()`)을 적용하거나, ExecuteOptions 레이어에서 허용 형식을 검사한다.

### [WARNING] responseCode 컬럼 — 임의 문자열 저장 가능
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (변경 라인 778-781)
- 상세: `responseCode`는 현재 항상 `WEBHOOK_ACCEPTED_RESPONSE_CODE`(상수 `'202'`) 또는 `undefined`로만 전달되어 사실상 안전하다. 그러나 `ExecuteOptions` 타입 정의에서 `responseCode?: string`으로 열려 있어, 향후 다른 호출 경로에서 임의 문자열을 전달할 여지가 있다. `VARCHAR(10)` 제약이 있으나 숫자 형식 검증은 없다.
- 제안: `responseCode` 필드를 `'202' | '400' | '401' | '410'` 등 허용 HTTP 코드 리터럴 유니온으로 타입을 좁히거나, 숫자 문자열 형식 검증(`/^\d{3}$/)`)을 추가한다.

### [INFO] getUsage API — 인가(Authorization) 검증 확인 필요
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (변경 라인 407-408)
- 상세: `getUsage(id, workspaceId)` 는 `findById(id, workspaceId)` 를 통해 workspaceId 범위 필터링을 수행한다. 변경된 코드 내에서 직접적인 인가 우회는 보이지 않으나, controller 레이어에서 `workspaceId`가 JWT 클레임에서 추출되는지, 요청 파라미터로 주입 가능한지는 이 diff 범위 밖이다. 기존 패턴이 유지된다면 문제없으나 확인이 권장된다.
- 제안: Controller에서 `workspaceId`를 반드시 인증된 세션(JWT 클레임)에서만 읽도록 강제되는지 확인한다.

### [INFO] recentCalls에 source_ip 노출 — 개인정보 고려사항
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` (변경 라인 534-536), `codebase/frontend/src/app/(main)/authentication/page.tsx` (변경 라인 1533-1534)
- 상세: `source_ip` 는 webhook 발신자의 IP 주소이며, GDPR/개인정보보호법 관점에서 개인식별정보(PII)에 해당할 수 있다. 현재 API 응답에 IP를 평문으로 포함하고 있다. 보안 문제라기보다는 규정 준수 관점의 고려사항이다.
- 제안: 개인정보 정책 검토 후, 필요한 경우 IP 일부 마스킹(예: `203.0.113.xxx`) 또는 저장 시 해시 처리를 고려한다.

### [INFO] COUNT FILTER 쿼리 — PostgreSQL 전용 문법
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (변경 라인 440-452)
- 상세: `COUNT(*) FILTER (WHERE ...)` 는 PostgreSQL 전용 문법이다. SQL 인젝션 위험은 없으나, 파라미터 바인딩(`:since24h`, `:since7d`, `:since30d`)을 올바르게 사용하고 있어 안전하다. 단, 시간 파라미터가 서버 시간 기준 `Date.now()`로 생성되어 클라이언트 조작이 불가능한 점은 긍정적이다.
- 제안: 보안 관점에서 추가 조치 불필요.

### [INFO] 하드코딩된 시크릿 없음 확인
- 위치: 전체 변경 파일
- 상세: 변경된 코드에서 API 키, 비밀번호, 토큰 등의 하드코딩된 시크릿은 발견되지 않았다. `WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)` 는 상수이며 민감 정보가 아니다.

## 요약

이번 변경은 webhook 호출 이력(소스 IP, 응답 코드)과 기간별 호출 수를 Execution 테이블에 영속하고 UI에 표시하는 기능이다. SQL 인젝션은 TypeORM 파라미터 바인딩으로 방어되고 있으며, XSS 위험도 React의 자동 이스케이프로 완화된다. 가장 주목할 보안 위험은 X-Forwarded-For 헤더 기반 IP 추출 신뢰성이다 — 동일한 `clientIp` 변수가 인증 IP Whitelist 검증과 호출 이력 로깅에 공용으로 사용되므로, `extractClientIp` 구현이 리버스 프록시 환경을 올바르게 처리하는지 별도 검증이 필요하다. 입력 검증 측면에서 `sourceIp` 와 `responseCode` 에 형식 검증이 없어 DB 제약에만 의존하고 있다. 전반적으로 Critical 취약점은 없으나, IP 추출 신뢰 경로와 입력 형식 검증은 Warning 수준으로 후속 조치가 권장된다.

## 위험도

MEDIUM
