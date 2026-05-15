### 발견사항

---

**[INFO] 호출 규약이 문서에만 존재, 타입 시스템 미강제**
- 위치: `login-history.service.ts` JSDoc + 모든 call site
- 상세: `record()` 의 "반드시 `await`" 규약은 JSDoc 주석으로만 명시되어 있다. TypeScript 컴파일러나 ESLint 는 `void loginHistory.record(...)` 재발을 잡아주지 않는다. 미래 개발자가 실수로 `void` 를 재도입해도 빌드가 통과된다.
- 제안: `@typescript-eslint/no-floating-promises` ESLint 규칙을 `backend/.eslintrc` 에 활성화한다. 이 규칙은 `void` 로 무시되지 않은 부동 Promise 를 오류로 취급하며, 현재 `record()` 의 반환 타입 `Promise<void>` 와 바로 연동된다.

---

**[INFO] 감사 이벤트와 트랜잭션 경계 불일치**
- 위치: `auth.service.ts` — `registerWithInvitation` (dataSource.transaction 블록 이후 `record()` 호출), `verifyEmail` (transaction 블록 이후 `record()` 호출)
- 상세: 사용자 생성·이메일 인증 트랜잭션이 커밋된 후 별도 connection 으로 `login_history` INSERT 가 수행된다. 트랜잭션 커밋과 audit INSERT 사이에 DB 장애가 발생하면 인증은 성공했으나 audit row 는 유실된다. `record()` 내부 예외 swallow 로 인해 이 유실은 ERROR 로그 외에는 감지되지 않는다.
- 제안: 현재 설계는 "감사 실패가 인증 흐름을 막아서는 안 된다"는 의도적 트레이드오프이며 이 우선순위 자체는 합리적이다. 단, `login-history.service.ts` 의 `record()` 주석이나 `spec/` 에 이 경계 결정을 명시적으로 기록해 두면 미래 기여자가 의도를 오독하지 않는다.

---

**[INFO] `LoginHistoryService` 직접 주입 — 이벤트 기반 대안 존재**
- 위치: `auth.service.ts` 생성자, `sessions.service.ts` 생성자
- 상세: `AuthService` 와 `SessionsService` 모두 `LoginHistoryService` 를 직접 주입받아 결합되어 있다. 현재 모놀리식 구조에서는 문제없으나, 감사 로그를 비동기 큐(예: BullMQ)로 전환하거나 다른 bounded context 로 분리할 때 모든 call site 를 수정해야 한다.
- 제안: 현 규모에서는 현 구조가 적절하다. 단, `LoginHistoryService` 에 인터페이스(`ILoginHistoryService`)를 추가하면 테스트 격리와 향후 구현 교체가 쉬워진다. 당장 필수는 아니며 INFO 수준.

---

### 요약

이번 변경은 `void`(fire-and-forget) → `await` 전환으로 연결 풀에서 발생하는 read-write 가시성 race 를 정확히 제거한다. SOLID 원칙 준수(SRP: 감사 책임 분리, DI: 서비스 간 의존성 역전), 레이어 경계(비즈니스 로직과 감사 영속화 분리), 모듈 응집도 모두 변경 전후가 동일하게 유지된다. `record()` 내부 예외 swallow 패턴은 인증 흐름 보호라는 아키텍처 결정에 부합한다. 주된 잔여 위험은 "await 규약"이 타입 시스템이 아닌 문서에만 존재한다는 점으로, ESLint `no-floating-promises` 규칙 활성화 하나로 컴파일 타임 가드로 격상할 수 있다.

### 위험도

**LOW**