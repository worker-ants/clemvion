# Security Review

## 발견사항

### **[INFO]** 테스트 파일에 평문 자격증명 사용 (test fixture)
- 위치: `auth-configs.service.spec.ts` 전체, 예: 라인 `config: { username: 'u', password: 'p' }`, `{ secret: 'whs_test' }`, `passwordHash: await bcrypt.hash('pw', 4)`
- 상세: 테스트 fixture 에 사용된 평문 자격증명(`'u'`, `'p'`, `'pw'`, `'whs_test'` 등)은 프로덕션 코드나 Git Secret 스캐닝 도구(truffleHog, gitleaks 등)가 false positive 를 발생시킬 수 있다. 이 값들은 실제 시크릿이 아닌 테스트 전용 픽스처이므로 실질적 위험은 없으나, 스캔 노이즈를 줄이기 위해 명시적 접두사(예: `test-only-`) 또는 주석을 붙이는 것이 권장된다.
- 제안: 테스트 자격증명에 `// test-only` 주석 추가 또는 상수명에 `TEST_` 접두사 활용. 실질적 보안 위험은 없음.

---

### **[INFO]** `constantTimeEquals` — 길이 비교 후 false 반환 시 타이밍 정보 누출 가능성 (이미 인지된 트레이드오프)
- 위치: `auth-configs.service.ts` 라인 1964–1969 (`constantTimeEquals` 메서드)
- 상세: 현재 구현은 길이가 다르면 즉시 `false` 를 반환한다. 코드 주석에서도 "RangeError 방지를 위한 사전 길이 비교"로 명시하고 있다. 길이 차이 자체가 타이밍 채널이 될 수 있으나, 토큰·API 키 등의 길이가 고정된(예: `wfk_` + 48 hex) 경우에는 실질적으로 문제가 되지 않는다. 단, `basic_auth` 의 username/password 는 사용자 정의 길이이므로 이론적으로 길이 오라클이 가능하다.
- 제안: 현재 위험도는 낮으나, 더 엄격한 타이밍 안전성을 원한다면 두 버퍼를 최대 길이로 zero-pad 후 `timingSafeEqual` 을 수행하는 방식을 고려할 수 있다. 기존 주석 수준의 인지된 트레이드오프로 봐도 무방.

---

### **[INFO]** `HMAC_ALLOWED_ALGORITHMS` 화이트리스트 적용 확인 (긍정적 패턴)
- 위치: `auth-configs.service.ts` 라인 1526, `verifyHmac` 메서드
- 상세: HMAC 알고리즘 허용 목록(`sha256`, `sha512`)이 화이트리스트로 구현되어 있으며, 외부 입력이 `crypto.createHmac` 에 직접 전달되기 전에 검증된다. MD5 등의 약한 알고리즘을 차단하는 테스트(`'hmac: 허용 목록 밖 algorithm → 401'`)도 존재한다. 이는 올바른 방어적 패턴이다.
- 제안: 현 구현 유지.

---

### **[INFO]** 감사 로그 스왈로(best-effort) 계약의 보안 함의
- 위치: `audit-logs.spec.ts` (새 describe 블록), `auth-configs.service.ts` `recordAudit` 래퍼
- 상세: 감사 로그 실패가 주 CRUD 동작을 차단하지 않는 best-effort 패턴은 가용성 측면에서 올바르나, 감사 DB 장애 또는 의도적 과부하 시 감사 이벤트가 묵살될 수 있다. 이 설계 결정은 코드 주석과 스펙에서 명시적으로 문서화되어 있어 의도된 트레이드오프임을 확인한다.
- 제안: 현재 설계 유지. 다만 감사 DB 연결 실패 시 별도 알림(메트릭/알람) 채널을 통한 모니터링을 권장.

---

### **[INFO]** `req.ip` trust proxy 미설정 시 `undefined` 전파
- 위치: `auth-configs.controller.spec.ts` 라인 403–413
- 상세: `req.ip` 가 `undefined` 인 경우(trust proxy 미설정 환경)에도 `ipAddress: undefined` 로 감사 로그에 기록되는 것이 테스트로 검증된다. IP 주소 없이 감사 로그가 기록되는 경우 사후 추적이 어려울 수 있다. 그러나 이는 인프라 설정 문제이며, 애플리케이션 코드 수준에서의 처리는 적절하다.
- 제안: 프로덕션 배포 시 NestJS `app.set('trust proxy', 1)` 등의 trust proxy 설정을 확인하고, 빈 IP 로 기록된 감사 로그를 모니터링 대상에 포함할 것을 권장.

---

### **[INFO]** `findAll`/`findOne`/`getUsage` 엔드포인트에 `@Roles` 미적용 — viewer 접근 허용
- 위치: `auth-configs.controller.spec.ts` 라인 448–467
- 상세: 읽기 엔드포인트(`findAll`, `findOne`, `getUsage`)는 `@Roles` 데코레이터가 없어 인증된 모든 멤버(viewer 포함)가 접근 가능하다. 이는 스펙 권한 매트릭스상 의도된 설계(`Editor=R`)이며 테스트로 명시 검증된다. 단, `findOne`/`findAll` 응답에서 민감 필드(key, token, secret, password)가 마스킹(`maskConfig`)되는지 별도 보장이 필요하다.
- 제안: 읽기 응답 마스킹 로직(`toMasked`/`findByIdForResponse`)이 모든 응답 경로에서 일관되게 적용되는지 주기적으로 검토.

---

## 요약

이번 변경의 핵심은 감사 로그 관련 상수(`AUDIT_ACTIONS`)를 하드코딩 문자열에서 중앙화된 const 참조로 마이그레이션하고, `recordAudit` 래퍼를 통해 named parameter 패턴으로 인자 순서 스왑 버그를 컴파일러 수준에서 방지한 것이다. 보안 관점에서 이번 변경은 전반적으로 긍정적이다. 인증 검증 코드(`verifyWebhookRequest`)에서 constant-time 비교, HMAC 알고리즘 화이트리스트, IP 화이트리스트 fail-closed 패턴, bcrypt 비밀번호 재확인 등 주요 보안 패턴이 올바르게 구현되어 있으며 테스트로 회귀 차단이 보장된다. 새로 추가된 test fixture 내 평문 자격증명은 실제 시크릿이 아닌 테스트 전용 값이므로 실질적 위험은 없다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인증 우회 등의 취약점은 발견되지 않았다.

## 위험도

NONE
