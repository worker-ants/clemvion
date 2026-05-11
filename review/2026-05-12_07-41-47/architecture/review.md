## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** `AuthContext` / `RevokeContext` 동일 구조 중복 정의
- 위치: `auth.service.ts:23-26`, `sessions.service.ts:22-25`
- 상세: 두 인터페이스가 `{ ip?: string | null; userAgent?: string | null }` 로 완전히 동일함에도 이름만 달리 정의됨. 향후 필드 추가 시 양쪽을 동기화해야 하는 암묵적 규칙이 생김.
- 제안: `auth/types/auth-context.ts` 에 `AuthContext`로 단일 정의하고 양쪽에서 import. `sessions.service.ts`의 `RevokeContext`는 제거하거나 `type RevokeContext = AuthContext`로 alias.

---

**[WARNING]** 컨트롤러 레이어에서 도메인 변환 로직 수행
- 위치: `sessions.controller.ts:175-182` (`getLoginHistory` 내 `.map()` 블록)
- 상세: 컨트롤러가 `deriveDeviceLabel(row.userAgent)` 호출과 `createdAt.toISOString()` 변환을 직접 수행함. 이 변환은 서비스 레이어 또는 전용 매퍼에 속함. 컨트롤러가 유틸리티 함수에 직접 의존하는 구조는 테스트 격리를 어렵게 하고 레이어 책임 경계를 흐림.
- 제안: `LoginHistoryService.findForUser()`가 `LoginHistoryItemDto[]`를 직접 반환하거나, 별도 mapper 함수(`toLoginHistoryItemDto`)를 서비스 레이어에 두고 컨트롤러는 호출만 하도록 분리.

---

**[WARNING]** 로그인 이력 기록이 인증 흐름에 동기적으로 결합
- 위치: `auth.service.ts` — `login`, `logout`, `refresh`, `verifyEmail`, `loginWithTotp` 전반
- 상세: `loginHistory.record()` 가 각 메서드 곳곳에 직접 삽입됨. 오류는 삼키지만 DB write 지연은 모든 인증 호출에 추가됨. 또한 인증 로직에 이벤트 기록 결정이 분산 배치되어 AuthService의 책임이 비대해짐.
- 제안: 즉각 필요하지 않다면 NestJS EventEmitter(`@nestjs/event-emitter`)로 `auth.login_success`, `auth.login_failed` 등의 이벤트를 발행하고 `LoginHistoryService`가 리스너로 처리하는 방식으로 분리 가능. 현재 규모에서는 선택사항이지만 확장성 관점에서 고려할 만함.

---

**[WARNING]** `failureReason` 필드 의미 오용
- 위치: `sessions.service.ts:161` — `failureReason: 'revoke_others'`
- 상세: `session_revoked` 이벤트에 `failureReason`을 범위 구분자(`'revoke_others'`)로 사용함. 컬럼명과 enum값의 의미가 "실패 이유"인데, 이를 "액션 범위"로 전용하는 것은 의미론적 불일치. 조회 시 혼란을 야기할 수 있고 `login_history.dto.ts`의 설명(`login_failed/totp_failed 시 사유 코드`)과도 상충.
- 제안: `login_history` 에 `scope VARCHAR(16)` 컬럼 추가(`single` / `all`)를 고려하거나, 단일 이벤트를 `session_revoked_bulk`로 구분. 최소한 `failureReason: null` 로 두고 단건 revoke와 구분하지 않아도 기능상 문제없음.

---

**[WARNING]** 크론 잡 타임존 미지정 + 멀티 인스턴스 위험
- 위치: `jobs/login-history-pruner.service.ts:16`
- 상세: `CronExpression.EVERY_DAY_AT_3AM` 은 서버 로컬 타임존에 의존. 컨테이너/서버 타임존 설정에 따라 실제 실행 시각이 달라짐. 또한 수평 확장 시 모든 인스턴스에서 동시에 실행되어 중복 DELETE가 발생함 (幂等이므로 데이터 손상은 없지만 불필요한 DB 부하 발생).
- 제안: `@Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })` 처럼 타임존 명시. 멀티 인스턴스 배포 계획이 있다면 분산 락(Redis `SET NX`) 또는 DB-level advisory lock 도입 검토.

---

**[INFO]** `trust proxy: true` — 모든 홉 신뢰
- 위치: `main.ts:42`
- 상세: `true` 는 전체 프록시 체인을 신뢰함. Cloudflare 1홉 뒤에 있는 구조라면 `1`(숫자)이 더 정밀한 설정. 단, `client-ip.ts`가 `CF-Connecting-IP`를 1순위로 처리하므로 실질적 위험은 낮음.
- 제안: `expressInstance.set('trust proxy', 1)` 으로 변경해 의도를 명시적으로 표현.

---

**[INFO]** `SessionsController`가 auth 모듈에 위치하나 URL은 `users/me` 네임스페이스
- 위치: `sessions.controller.ts:46` — `@Controller('users/me')`
- 상세: 기능 경계(세션 관리는 인증 도메인)와 URL 경계(`users` 네임스페이스) 불일치. `RefreshToken` 리포지토리 의존성 때문에 auth 모듈에 둔 결정은 실용적으로 타당하나, 이 결정이 명시적으로 문서화되어 있지 않으면 후속 개발자가 혼란을 겪을 수 있음.
- 제안: 현 구조 유지하되 `auth.module.ts` 주석에 "세션 API는 users/me 경로를 사용하지만 RefreshToken 의존성으로 인해 AuthModule에 위치" 한 줄 기록.

---

**[INFO]** `LoginHistoryService` export 범위
- 위치: `auth.module.ts:49` — `exports: [AuthService, TotpService, LoginHistoryService]`
- 상세: 현재 `LoginHistoryService`를 모듈 외부로 export하나 외부에서 사용하는 케이스가 없음. export를 열어두면 타 모듈이 로그인 이력을 임의로 기록하는 결합이 생길 수 있음.
- 제안: 현시점에서는 export에서 제거하고, 실제 외부 수요가 생길 때 추가.

---

### 요약

전체 아키텍처는 NestJS의 모듈/서비스/컨트롤러 레이어를 잘 따르고 있으며, `LoginHistoryService` / `SessionsService` 신설과 기존 `AuthService` 확장 방식은 합리적이다. 그러나 `AuthContext`·`RevokeContext` 중복, 컨트롤러 레이어의 도메인 변환 로직 혼입, `failureReason` 필드 의미 오용이라는 세 가지 결합도·응집도 문제가 중단기적으로 유지보수 비용을 높일 수 있다. 크론 잡의 타임존 미지정은 배포 환경에 따라 동작이 달라지는 잠재적 운영 문제다. 보안상 민감한 인증 흐름에 동기 DB write가 추가된 구조는 현재 트래픽 수준에서는 무방하지만 이벤트 기반 분리로의 이행 경로를 열어 두는 것이 확장성 측면에서 유리하다.

### 위험도

**LOW** — 기능 정확성과 보안 경계는 유지되고 있으며, 발견된 이슈는 주로 유지보수성·확장성 범주에 속한다.