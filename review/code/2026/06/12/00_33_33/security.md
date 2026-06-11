# 보안(Security) 리뷰

## 발견사항

### **[INFO]** `recordAudit` 래퍼의 인자 순서 — 위치 혼동 위험
- 위치: `auth-configs.service.ts` — `recordAudit(action, workspaceId, userId, resourceId, ipAddress?)`
- 상세: 이전에는 `auditLogsService.record({...})` 를 named-object 형태로 호출하여 필드 혼동이 없었다. 리팩터링 이후 `recordAudit` 는 positional parameter (action, workspaceId, userId, resourceId, ipAddress) 를 받는다. `workspaceId`·`userId`·`resourceId` 가 모두 동형 `string` 이므로 호출부에서 순서 실수 시 컴파일 오류 없이 감사 로그 주체·대상이 뒤바뀐다. 실제로 controller spec 의 "userId/req.ip 전파" 테스트가 이 위험을 명시적으로 커버하고 있어 현재 호출부는 올바르다고 확인되나, 함수 시그니처 자체의 구조적 취약성은 잔존한다.
- 제안: 함수 시그니처를 `(params: { action, workspaceId, userId, resourceId, ipAddress? })` 형태의 단일 객체로 변경하거나, 또는 `userId`·`workspaceId`·`resourceId` 에 branded type/opaque type 을 적용하면 위치 혼동을 컴파일 타임에 차단할 수 있다. 기존 named-object 방식이 더 안전했다.

### **[INFO]** `req.ip` undefined 전파 — 감사 로그 IP 누락 허용
- 위치: `auth-configs.controller.spec.ts` — "req.ip 미설정(trust proxy off) 시 undefined 를 그대로 전파" 테스트
- 상세: Express의 `req.ip` 는 `trust proxy` 가 비활성화된 환경에서 `undefined` 가 될 수 있다. 이 값이 서비스까지 그대로 전달되어 감사 로그의 `ipAddress` 필드가 NULL로 저장된다. 이는 명시적으로 허용된 설계이나, 프록시 미설정 환경에서 모든 민감 작업(reveal, regenerate 등)의 IP 추적이 무력화된다.
- 제안: 배포 환경에서 `trust proxy` 를 반드시 설정하도록 운영 가이드/인프라 설정에 명시하고, 미설정 상태를 경고 로그로 기록하는 미들웨어를 고려한다. 선택적으로 IP 미수집 시 감사 로그에 `ipAddress: 'unknown'` 형태의 명시적 sentinel 값을 쓰면 "수집 불가" 와 "수집 미시도" 를 구분할 수 있다.

### **[INFO]** `HMAC_ALLOWED_ALGORITHMS` 화이트리스트 — 제한적 알고리즘 집합
- 위치: `auth-configs.service.ts` — `const HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512'])`
- 상세: HMAC 알고리즘을 sha256/sha512 로 제한하는 화이트리스트가 이미 구현되어 있고 테스트(md5 → 401)도 통과 확인. 이는 임의 알고리즘을 `crypto.createHmac` 에 전달하는 커맨드 인젝션 유형 위험을 차단한다. 양호.

### **[INFO]** `constantTimeEquals` — 길이 불일치 시 조기 반환으로 타이밍 오라클 노출
- 위치: `auth-configs.service.ts` — `constantTimeEquals` 메서드
- 상세: 길이가 다르면 `false` 를 즉시 반환하여 공격자가 응답 시간으로 비밀 길이를 추측할 수 있다. 이는 `crypto.timingSafeEqual` 의 `RangeError` 방지를 위한 불가피한 트레이드오프이나, 실제 공격 조건(네트워크 레이턴시 우세)에서는 실질적 위험이 매우 낮다. 허용 가능한 설계다.
- 제안: 완전한 타이밍 안전을 원한다면 두 버퍼를 동일 최대 길이로 패딩한 뒤 `timingSafeEqual` 을 실행하고, 결과와 별도로 길이 동일성을 `&` 연산으로 결합하는 방식을 사용할 수 있다. 현 코드도 실용적 보안 수준은 충분하다.

### **[INFO]** `update()` 에서 `Object.assign(config, data)` — 검증 없는 병합
- 위치: `auth-configs.service.ts` — `update` 메서드 내 `Object.assign(config, data)`
- 상세: `data` 는 `Partial<AuthConfig>` 타입으로 컨트롤러/서비스 수준에서 DTO 유효성 검증이 이뤄진다고 전제한다. 그러나 `data.config` 를 통해 `SECRET_CONFIG_KEYS` 에 속하는 필드를 사용자가 직접 덮어쓸 수 있는지 여부는 이 diff 범위 내에서 확인되지 않는다. DTO 레벨에서 `config` 필드의 비밀 키 직접 수정을 막는지 검토가 필요하다. (본 변경에서 해당 로직의 신규 도입은 없으므로 pre-existing 이슈다.)

## 요약

이번 변경은 `auth_config.*` 감사 로그를 `recordAudit` 단일 래퍼로 일원화하고, `AUDIT_ACTIONS` const 를 테스트까지 전파한 리팩터링이다. 보안 관점에서 신규로 도입된 취약점은 없다. HMAC 알고리즘 화이트리스트, 상수 시간 비교, ip_whitelist fail-closed 정책, 역할 기반 Admin 가드, 비밀번호 재확인(reveal) 등 핵심 방어 메커니즘이 모두 유지·검증되고 있다. 다만 `recordAudit` 의 positional string 파라미터 순서로 인한 감사 로그 주체 혼동 가능성(컴파일 미탐지)과 `trust proxy` 미설정 시 IP 누락이 구조적 개선 포인트로 남아 있다.

## 위험도

LOW
