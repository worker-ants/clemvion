# 보안(Security) 리뷰 — refresh 토큰 rotation 원자화 (05 C-1)

## 발견사항

### **[INFO]** TOCTOU 창 — `findOne` 이후 트랜잭션 외부에서 수행되는 만료 검증
- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` — `refresh()` 내 `if (new Date() > stored.expiresAt)` 비교 (line ~565), 이후 트랜잭션 진입
- **상세**: `findOne`→만료 비교→트랜잭션 진입 사이에 경쟁 조건이 이론상 존재한다. 그러나 이번 변경에서 조건부 UPDATE(`{ id, isRevoked: false, expiresAt: MoreThan(new Date()) }`)를 트랜잭션 내부에 적용했기 때문에, 만료 경계에서 동시 요청이 들어오더라도 조건부 UPDATE의 `affected = 0` 경로가 이를 차단한다. 사전 `expiresAt` 비교는 성능 조기 거부용(트랜잭션 불필요 케이스 사전 탈출)이며, 보안 보장은 이미 조건부 UPDATE로 이전되어 있다. 이전 리뷰(08_45_18)에서 W2로 지적된 TOCTOU는 `MoreThan(new Date())` 조건 추가를 통해 **이 PR에서 실질적으로 수정 완료**되었다.
- **제안**: 현행 유지 가능. 원하면 트랜잭션 외부 `expiresAt` 검사를 제거하고 `affected = 0` 단일 경로로 통합할 수 있으나, 성능 트레이드오프 고려 필요.

### **[INFO]** `generateTokens` 의 optional `EntityManager` 파라미터 — trust boundary
- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` — `generateTokens()` 시그니처 `manager?: EntityManager`
- **상세**: 메서드가 `private` 으로 선언되어 있고 JSDoc에 `@internal` 및 `public` 승격 금지가 명시되어 있다. TypeScript의 `private` 접근자는 컴파일 타임 보호이며 런타임(JS) 또는 리플렉션 경로에서는 우회 가능하다. 그러나 NestJS 프레임워크 환경에서 외부 호출자가 임의 `EntityManager` 를 주입해 악의적 트랜잭션 컨텍스트에 RefreshToken INSERT 를 합류시키는 시나리오는 공격 벡터가 아니다 — 호출자가 이미 서비스 내부 코드여야 하기 때문이다. 실질적 위험 없음.
- **제안**: 현행 유지. JSDoc `@internal` 명시는 충분하다.

### **[INFO]** 에러 메시지 — 내부 오류의 클라이언트 노출 가능성
- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` — `dataSource.transaction()` reject 시 에러 전파
- **상세**: 트랜잭션 콜백 내부에서 발생한 일반 `Error`(예: DB 연결 오류, constraint 위반 등)는 호출 스택을 타고 컨트롤러로 전파된다. 이 PR에서 새로 도입한 에러 전파 경로이므로 글로벌 예외 필터가 `Error.message` 를 원문 직렬화하지 않도록 보장되어야 한다. 이 리뷰의 이전 세션(08_45_18 INFO13)에서 이미 식별되었고 "글로벌 예외 필터 책임, 본 변경이 새로 만든 노출 아님"으로 수용되었다. 그러나 이번 변경에서 트랜잭션 경로가 신설되었으므로 글로벌 필터 적용 여부를 재확인하는 것이 적절하다.
- **제안**: 글로벌 예외 필터(`HttpExceptionFilter` 등)가 `Error` 인스턴스를 500 generic 응답으로 변환하고 `message` 를 클라이언트에 직렬화하지 않는지 확인. 본 PR 범위 외 기존 인프라이나 검증 권장.

### **[INFO]** Reuse detection 분기 — family 전체 revoke가 트랜잭션 외부
- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` — `refresh()` 내 `stored.isRevoked` 분기 (line ~544)
- **상세**: 이 PR의 변경 범위 밖이나 관찰을 남긴다. reuse detection 시 family 전체 revoke(`UPDATE WHERE familyId = X`)와 `loginHistory.record()` 가 트랜잭션 없이 순차 실행된다. 두 작업 사이 실패 시 loginHistory 누락이 발생할 수 있다. 단, reuse detection은 family가 이미 compromised로 간주되어 revoke 자체가 완료되었다면 loginHistory 누락이 보안 상 치명적이지 않다(이미 세션을 차단했기 때문). spec §1.4 의 결정과도 일치.
- **제안**: 수용 가능. 원자성이 필요하다고 판단되면 후속 plan으로 별도 원자화 가능.

---

## 요약

이번 변경(05 C-1 refresh 토큰 rotation 원자화)은 보안 관점에서 올바르게 구현되었다. 핵심 취약점이었던 TOCTOU(이중 회전) 문제는 조건부 UPDATE(`{ id, isRevoked: false, expiresAt: MoreThan(new Date()) }`) + `affected = 0` 거부 로직으로 실질적으로 해소되었다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 경로 탐색, LDAP 인젝션 등 OWASP Top 10 해당 취약점은 이번 변경 코드에서 발견되지 않는다. `generateTokens` 의 `private` 접근자 + JSDoc `@internal` 명시로 trust boundary가 문서화되어 있으며, 토큰 해시는 기존 `hashToken()` 경로(SHA-256 계열로 추정)를 그대로 사용해 새로운 암호화 취약점을 도입하지 않는다. 글로벌 예외 필터에서의 에러 메시지 클라이언트 노출 가능성은 기존 인프라 책임이며 이번 변경이 새로 도입한 위험이 아니나 확인을 권장한다.

## 위험도

LOW

---

STATUS: SUCCESS
