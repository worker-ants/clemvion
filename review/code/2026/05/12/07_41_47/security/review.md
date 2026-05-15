## 발견사항

---

### **[WARNING]** `trust proxy: true` — IP 스푸핑으로 Throttler 우회 가능
- **위치**: `backend/src/main.ts` — `expressInstance.set('trust proxy', true)`
- **상세**: Express의 `trust proxy`를 `true`(boolean)로 설정하면 X-Forwarded-For 헤더의 **모든 홉을 무조건 신뢰**한다. Cloudflare를 우회해 서버에 직접 접근하는 공격자가 `X-Forwarded-For: 1.1.1.1` 헤더를 임의로 삽입하면 `req.ip`가 조작되고, `ThrottlerGuard`가 의존하는 IP 기반 속도 제한이 무력화된다. 로그인 엔드포인트(`POST /auth/login`) 브루트포스 방어가 우회될 수 있다. `client-ip.ts`의 CF-Connecting-IP 우선 로직은 로그인 이력 기록에는 올바르게 적용되지만, ThrottlerGuard는 별도로 `req.ip`를 사용한다는 점에서 두 경로가 분리되어 있다.
- **제안**: `true` 대신 `1`(Cloudflare 단일 홉 신뢰) 또는 Cloudflare 공개 IP 대역 목록으로 교체.
  ```ts
  expressInstance.set('trust proxy', 1);
  ```

---

### **[WARNING]** CF-Connecting-IP 헤더 위조 가능성 (Cloudflare 미경유 트래픽)
- **위치**: `backend/src/modules/auth/utils/client-ip.ts` — 코드 주석에도 명시
- **상세**: `client-ip.ts`의 주석이 이미 인지한 리스크다("CF IP 대역 외부 트래픽을 차단하지 않으면 CF-Connecting-IP 위변조가 가능하다"). 서버가 직접 노출되어 있으면 로그인 이력의 IP 정보와 세션 메타데이터 전체가 공격자가 주입한 값으로 채워진다. 보안 감사 로그의 신뢰성을 해친다.
- **제안**: 인프라 레벨에서 Cloudflare IP 대역 외 직접 접근 차단(방화벽 규칙)을 의무화하거나, 헤더 서명/토큰 방식의 Origin Pull 설정 적용. 현재 코드는 헤더 레벨만 처리하므로 인프라 보완이 필수.

---

### **[WARNING]** `familyId` 경로 파라미터에 UUID 형식 검증 누락
- **위치**: `backend/src/modules/auth/sessions.controller.ts` — `@Param('familyId') familyId: string`
- **상세**: `DELETE /users/me/sessions/:familyId` 경로의 `familyId`는 DTO가 아닌 raw `string`으로 수신되며 `@IsUUID()` 유효성 검사가 없다. TypeORM 쿼리는 파라미터화되어 SQL 인젝션 위험은 없지만, 비정상적으로 긴 문자열이나 특수문자가 포함된 값이 DB 쿼리까지 도달한다.
- **제안**: `ParseUUIDPipe`를 적용.
  ```ts
  @Param('familyId', ParseUUIDPipe) familyId: string,
  ```

---

### **[WARNING]** `RevokeSessionDto.password`에 최대 길이 제한 없음 — bcrypt 부하
- **위치**: `backend/src/modules/auth/dto/requests/revoke-session.dto.ts`
- **상세**: `@IsString()`만 적용되어 수십 MB 크기의 문자열을 password로 전송해도 `bcrypt.compare()`까지 도달한다. bcrypt는 내부적으로 입력을 72바이트에서 자르므로 보안 우회는 되지 않지만, 인증된 사용자가 의도적으로 반복 호출 시 CPU 부하를 일으킬 수 있다.
- **제안**: `@MaxLength(128)` 추가.

---

### **[INFO]** `userAgent` 필드 — 애플리케이션 레벨 길이 제한 없음
- **위치**: `backend/src/modules/auth/entities/login-history.entity.ts` — `userAgent: TEXT`  
  및 `refresh-token.entity.ts`
- **상세**: raw User-Agent는 DB에 TEXT(무제한)로 저장된다. Cloudflare가 헤더 크기를 16 KB로 제한하므로 실질적 위험도는 낮다. 그러나 Cloudflare 없이 직접 접근하거나 미래 인프라 변경 시 매우 긴 UA가 누적될 수 있다. `device_label`은 64자로 잘 제한되어 있다.
- **제안**: `userAgent` 컬럼에 `length: 2048` 등 상한을 적용하는 것 권장.

---

### **[INFO]** `SessionsController`에 명시적 JWT 가드 데코레이터 부재
- **위치**: `backend/src/modules/auth/sessions.controller.ts`
- **상세**: `@UseGuards(JwtAuthGuard)` 없이 `@CurrentUser()`로만 인증 컨텍스트를 가져온다. 전역 `APP_GUARD`로 JWT 검증이 보장된다면 동작상 문제없지만, 컨트롤러 자체만 보면 인증 요구사항이 명시적으로 선언되어 있지 않아 코드 가독성과 유지보수 시 위험 요소가 된다.
- **제안**: 다른 보안 컨트롤러와 동일하게 클래스 레벨에 `@UseGuards(JwtAuthGuard)` 추가.

---

### **[INFO]** 커서 파라미터 ISO 타임스탬프 형식 미검증
- **위치**: `backend/src/modules/auth/login-history.service.ts` — `findForUser()`
- **상세**: `cursor`는 사용자가 입력한 문자열을 `new Date()`로 파싱하며, NaN 여부만 확인한다. TypeORM이 파라미터화하므로 SQL 인젝션 위험은 없다. 다만 `new Date("Invalid but parseable")` 같은 예상치 못한 값이 DB에 전달될 수 있다.
- **제안**: ISO 8601 정규식으로 형식 사전 검증 추가.

---

## 요약

이번 변경은 세션 관리·로그인 이력 기능을 전반적으로 안전하게 구현했다. 세션 소유권 검증, 정보 누출 방지(404 통일), bcrypt 비교, 파라미터화 쿼리, TOTP 재인증 흐름 등 핵심 보안 설계는 올바르다. 가장 주목해야 할 이슈는 **`trust proxy: true` 설정**으로, 이 때문에 `ThrottlerGuard`의 IP 기반 속도 제한이 X-Forwarded-For 스푸핑으로 우회될 수 있고 이는 로그인 브루트포스 방어를 약화시킨다. `trust proxy: 1`로 수정하고, Cloudflare IP 대역 외 직접 접근을 인프라 수준에서 차단하는 것이 이 기능의 보안 전제조건이다.

## 위험도

**MEDIUM**