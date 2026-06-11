# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 없음 (CLEAN)

이번 변경은 순수 리팩토링(인라인 문자열 → `AUDIT_ACTIONS` 상수 참조)과 API 예제값 수정으로 구성되어 있으며, 새로운 보안 취약점을 도입하지 않는다.

아래는 변경 범위에서 확인한 기존 보안 처리의 현황이다.

---

**[INFO] 감사 액션 상수화 — 인라인 문자열 제거**
- 위치: `audit-action.const.ts` + 각 서비스 파일 (`auth-configs`, `executions`, `integrations`, `workspaces`)
- 상세: `action: 're_run_initiated'`, `action: 'integration.created'` 등 인라인 문자열을 `AUDIT_ACTIONS` 상수로 일괄 교체. `AuditLogsService.record()` 의 `action` 파라미터 타입이 `string` → `AuditAction` union 으로 강화되어 컴파일 타임에 임의 문자열 삽입이 차단된다. 보안적으로 긍정적인 변경이다.

**[INFO] `getSortColumn` 화이트리스트 — SQL 오더 인젝션 차단 확인**
- 위치: `audit-logs.service.ts` lines 231–238
- 상세: `sort` 파라미터를 `allowed` 맵으로 화이트리스트 검증 후 `al.${sortColumn}` 으로 동적 조합한다. 허용 목록 외 값은 `'created_at'` 으로 폴백하므로 SQL 오더 인젝션 위험 없음.

**[INFO] TypeORM 파라미터 바인딩 — SQL 인젝션 차단 확인**
- 위치: `audit-logs.service.ts` `findAll()`, `auth-configs.service.ts` `findAll()`
- 상세: 모든 WHERE 조건이 `:param` 바인딩 방식으로 처리된다 (`{ action }`, `{ workspaceId }` 등). 인라인 문자열 연결 없음.

**[INFO] 비밀값 마스킹 — 민감 필드 노출 차단 확인**
- 위치: `auth-configs.service.ts` `maskConfig()`, `SECRET_CONFIG_KEYS`
- 상세: `key`, `token`, `secret`, `password` 키를 `***{last4}` 로 마스킹한다. 목록 응답 경로(`findAll` → `toMasked`)와 단건 읽기(`findByIdForResponse`) 모두 마스킹이 적용된다.

**[INFO] `reveal()` 비밀번호 재확인 — 인증 게이트 확인**
- 위치: `auth-configs.service.ts` `reveal()` lines 520–551
- 상세: `bcrypt.compare` 로 사용자 비밀번호 재확인 후 평문 config 반환. OAuth 단독 계정(`passwordHash === null`)은 즉시 401 반환. 감사 로그(`AUTH_CONFIG_REVEAL`) 기록도 정상 확인.

**[INFO] HMAC 알고리즘 화이트리스트**
- 위치: `auth-configs.service.ts` `HMAC_ALLOWED_ALGORITHMS` + `verifyHmac()`
- 상세: `sha256`, `sha512` 만 허용. 데이터베이스에서 읽어온 `algorithm` 값이 그대로 `crypto.createHmac` 에 전달되기 전에 화이트리스트 검사를 거쳐 임의 알고리즘 사용이 차단된다.

**[INFO] timing-safe 비교**
- 위치: `auth-configs.service.ts` `constantTimeEquals()`
- 상세: `crypto.timingSafeEqual` 사용. 길이 불일치 시 즉시 `false` 반환(RangeError DoS 방지)하며 타이밍 공격을 차단한다.

**[INFO] IP 화이트리스트 fail-closed 정책**
- 위치: `auth-configs.service.ts` `verifyWebhookRequest()`
- 상세: `ipWhitelist` 가 설정되고 `clientIp` 를 알 수 없는 경우 즉시 거부한다. IP 파싱 오류 시에도 매칭에서 제외(fail-closed).

**[INFO] 에러 메시지 — 정보 노출 없음**
- 위치: `auth-configs.service.ts` `authFailed()`, `audit-logs.service.ts` `record()` 예외 catch
- 상세: 인증 실패 시 type 무관 단일 `AUTH_FAILED` 코드 반환(열거 공격 차단). 감사 로그 실패는 `logger.warn` 으로 흡수하며 내부 DB 오류가 클라이언트에 노출되지 않는다.

**[INFO] 하드코딩 시크릿 없음**
- 상세: `wfk_`, `wft_`, `whs_` 프리픽스의 값은 `randomBytes` 로 런타임 발급된다. 코드에 실제 시크릿 값이 포함되어 있지 않다.

**[INFO] 테스트 픽스처 이메일(`u@e.com`)**
- 위치: `executions-rerun.service.spec.ts` line 888
- 상세: 테스트 전용 픽스처이며 실제 자격증명이나 PII 아님. 동일 파일에서 응답에 `@` 포함 여부를 명시적으로 assert(`not.toMatch(/@/)`) 하고 있어 이메일 노출 회귀 방지가 검증된다.

---

## 요약

이번 diff 는 감사 로그 액션 식별자를 인라인 문자열에서 타입-safe 상수(`AUDIT_ACTIONS`)로 일괄 교체하는 리팩토링이다. 신규 보안 위험을 도입하지 않으며, 오히려 `AuditAction` union 타입 강제로 컴파일 타임에 임의 액션 문자열 삽입을 차단하는 점에서 보안 측면의 개선이 있다. 기존 코드(HMAC 알고리즘 화이트리스트, timing-safe 비교, IP fail-closed, 비밀값 마스킹, bcrypt 재확인, TypeORM 파라미터 바인딩)는 모두 적절히 구현되어 있음을 확인하였다.

## 위험도

NONE
