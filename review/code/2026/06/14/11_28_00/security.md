# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 없음 — 아래 양호 사항 확인 목록 참조

이번 변경에서 실제 보안 취약점은 발견되지 않았다. 주요 보안 설계가 올바르게 구현되어 있으며, 변경 내용은 기존 취약점(비밀값 덮어쓰기)을 오히려 수정한다.

---

## 보안 설계 검토 (양호 확인)

### 1. 인젝션 취약점

**[INFO] SQL 인젝션 — 파라미터 바인딩 사용 (양호)**
- 위치: `auth-configs.service.ts` `findAll()` 메서드
- 상세: `qb.where('ac.workspace_id = :workspaceId', { workspaceId })` 및 `qb.andWhere('ac.name ILIKE :search', { search: '%..%' })` 모두 TypeORM 파라미터 바인딩을 사용. 검색 값이 `%${search}%` 로 보간되는 방식도 파라미터로 전달되어 SQL 인젝션 없음.
- 추가 확인: `createQueryBuilder` 내 `.where('e.trigger_id IN (:...triggerIds)', { triggerIds })` 도 안전.

**[INFO] HTTP 헤더 인젝션 — RFC 7230 토큰 검증 (양호)**
- 위치: `auth-config-form.ts` `isValidHeaderName()`, `validateAuthConfigForm()`
- 상세: 헤더 이름을 `/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/` 정규식으로 검증하여 개행(`\n`), 콜론(`:`)을 포함한 비-토큰 문자를 차단. 프론트엔드 테스트도 인젝션 문자열(`X-Api\nKey`, `X-Api:Key`)에 대한 거부를 명시적으로 검증.

### 2. 하드코딩된 시크릿

**[INFO] 하드코딩된 시크릿 없음 (양호)**
- 테스트 파일에서 `WS = 'ws-1'`, `USER = 'user-1'` 상수가 사용되지만 이는 테스트 픽스처이며 실제 자격증명이 아님.
- `bcrypt.hash('pw', 4)` 는 테스트 전용 낮은 cost factor이며 프로덕션 코드에 없음.
- 실제 시크릿(API 키, 토큰)은 `crypto.randomBytes()` 로 생성하며 코드에 하드코딩되지 않음.

### 3. 인증/인가

**[INFO] 비밀값 덮어쓰기 취약점 수정 (이번 변경의 핵심 보안 수정)**
- 위치: `auth-configs.service.ts` `update()` 메서드 (라인 1097-1111)
- 상세: 이전 코드는 `Object.assign(config, data)` 로 전체 data 를 덮어써 클라이언트가 임의의 `config` 객체를 보내면 저장된 비밀값(key/token/secret/password)이 교체될 위험이 있었다. 이번 변경에서 `SECRET_CONFIG_KEYS` Set 을 활용한 shallow-merge 로 비밀 필드 갱신을 서버 측에서 완전히 차단. 마스킹된 값(`wfk_***1234`)이 역류해도 무시됨.
- 제안: 현재 구현 적절. 추가로 컨트롤러 레이어에서 `UpdateAuthConfigDto`의 `config` 필드 내 비밀 키 존재 시 명시적 400 오류를 반환하는 것도 defense-in-depth 로 고려 가능하지만, 서비스 레이어 무시가 이미 충분한 보호를 제공함.

**[INFO] IP Whitelist 검증 — fail-closed 구현 (양호)**
- 위치: `auth-configs.service.ts` `verifyWebhookRequest()`, `ipInWhitelist()`
- 상세: whitelist 설정 시 clientIp 미전달, 파싱 불가 IP, 주소 패밀리 불일치 모두 401로 처리(fail-closed). IPv4-mapped IPv6(`::ffff:x.x.x.x`) 정규화 처리 포함.

**[INFO] 타이밍 공격 방어 (양호)**
- 위치: `auth-configs.service.ts` `constantTimeEquals()`
- 상세: 모든 비밀값 비교(`bearer_token`, `api_key`, `basic_auth`)에 `crypto.timingSafeEqual()` 사용. 길이 불일치 시 RangeError 발생을 방지하기 위해 길이 선검증 후 timingSafeEqual 호출. HMAC 서명 비교도 동일 경로 사용.

**[INFO] HMAC 알고리즘 화이트리스트 (양호)**
- 위치: `auth-configs.service.ts` `HMAC_ALLOWED_ALGORITHMS`, `verifyHmac()`
- 상세: `sha256`, `sha512` 만 허용. 외부 입력이 `crypto.createHmac(algorithm, ...)` 에 전달되기 전에 화이트리스트 검증으로 약한 알고리즘(`md5`, `sha1`) 및 임의 알고리즘 주입을 차단.

**[INFO] Reveal 엔드포인트 — 비밀번호 재확인 (양호)**
- 위치: `auth-configs.service.ts` `reveal()`
- 상세: bcrypt.compare 로 현재 로그인 비밀번호를 재확인하며, OAuth-only 사용자(passwordHash=null)는 401 차단. 성공 시만 audit log 기록.

### 4. 입력 검증

**[INFO] DTO 레이어 검증 (양호)**
- 위치: `update-auth-config.dto.ts`
- 상세: `@IsString()`, `@MaxLength(255)`, `@IsIn(AUTH_CONFIG_TYPES)`, `@IsArray()`, `@IsString({ each: true })` 데코레이터로 필드별 타입·형식·열거형 검증 적용.

**[INFO] IP/CIDR 프론트엔드 검증 (양호)**
- 위치: `auth-config-form.ts` `isValidIpOrCidr()`, `isValidIpv6OrCidr()`
- 상세: IPv4 옥텟 범위(0-255), prefix 범위(/0-32, /0-128), IPv6 그룹 형식, `:::` 방지 등 pragmatic 검증. 백엔드에서는 `ip-address` 라이브러리 기반 fail-closed 매칭으로 이중 검증.
- 주의: `isValidIpOrCidr("javascript:alert(1)")` 와 `isValidIpOrCidr("; rm -rf /")` 테스트가 명시적으로 거부를 확인하고 있어 인젝션 입력 가드 확인됨.

**[INFO] 편집 폼 — 비밀값 미전송 (양호)**
- 위치: `auth-config-form.ts` `buildAuthConfigUpdatePayload()`
- 상세: `basic_auth` 편집 시 `username` 만 포함하고 `password` 는 제외. 프론트엔드 테스트(`never includes type or secrets`)에서 명시적으로 검증됨.

### 5. OWASP Top 10

**[INFO] 에러 메시지 정보 노출 없음 (양호)**
- 위치: `auth-configs.service.ts` `authFailed()`
- 상세: 인증 실패 시 타입·이유 무관하게 단일 메시지 `'Authentication failed'` 반환(enumeration 방지). `verifyWebhookRequest` 에서 config 미존재와 isActive=false 도 동일 401 처리.

**[INFO] 에러 처리 — 스택 트레이스 미노출 (양호)**
- 상세: 모든 오류는 NestJS 표준 예외(`NotFoundException`, `UnauthorizedException`)로 래핑되어 구조화된 `{ code, message }` 만 반환. 내부 DB 에러가 그대로 노출되는 경로 없음.

### 6. 암호화

**[INFO] 비밀값 생성 엔트로피 (양호)**
- `api_key`: `randomBytes(24)` → 192비트 엔트로피
- `bearer_token`: `randomBytes(32)` → 256비트 엔트로피
- `hmac secret`: `randomBytes(32)` → 256비트 엔트로피
- 모두 암호학적으로 안전한 난수 생성기(`crypto.randomBytes`) 사용.

**[INFO] basic_auth 비밀번호 저장 — 평문 저장 (낮은 위험, 설계 상 수용)**
- 위치: `auth-configs.service.ts` `create()`
- 상세: `basic_auth` 의 `password` 는 JSONB `config` 컬럼에 평문 저장됨. Webhook 검증 시 상수 시간 비교가 가능해야 하므로 bcrypt 해시 불가 — 이는 Basic Auth 프로토콜의 근본 제약이며 설계 상 수용된 트레이드오프. 응답 마스킹(`***last4`)으로 노출은 제한됨.
- 제안: DB 레벨 컬럼 암호화(예: TypeORM transformer + AES-GCM)로 at-rest 보호를 강화할 수 있으나, 이는 현재 변경 범위 밖의 아키텍처 결정이며 위험도는 DB 접근 통제에 의존한다.

### 7. 의존성 보안

**[INFO] 사용 라이브러리 검토**
- `bcrypt`: 비밀번호 해싱에 표준 라이브러리 사용 (비용 인수 `10` 이상을 프로덕션에서 사용하는지 별도 확인 필요 — 테스트는 `4` 사용, 이는 테스트 전용으로 적절)
- `ip-address`: IP 파싱/CIDR 매칭 라이브러리 — known CVE 없음(검토 시점 기준)
- `crypto`: Node.js 내장 모듈

---

## 요약

이번 변경(편집 폼 신설 + 백엔드 `update` 수정)은 보안 관점에서 전반적으로 안전하게 설계되었으며, 오히려 기존에 잠재했던 취약점(config wholesale-replace 시 비밀값 파손 가능성)을 수정한다. 비밀값은 서버 측에서 `SECRET_CONFIG_KEYS` 필터로 완전히 보호되고, 프론트엔드도 비밀 필드를 PATCH 페이로드에서 제외하는 이중 방어를 구현한다. IP Whitelist는 fail-closed, HMAC은 알고리즘 화이트리스트, 인증 비교는 타이밍 공격 방어가 모두 유지된다. 유일한 설계 수준 주의사항은 `basic_auth` 비밀번호의 at-rest 평문 저장이나, 이는 Basic Auth 프로토콜 제약으로 인해 현 아키텍처 범위 내에서 수용된 트레이드오프다.

## 위험도

LOW
