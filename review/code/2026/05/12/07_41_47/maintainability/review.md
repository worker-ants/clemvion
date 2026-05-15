## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `auth.service.ts` — `loginHistory.record()` 호출 패턴 반복 중복

- 위치: `auth.service.ts` login() 메서드 내 실패 분기들 (USER_NOT_FOUND, ACCOUNT_LOCKED, EMAIL_NOT_VERIFIED, PASSWORD_NOT_SET, INVALID_PASSWORD)
- 상세: 동일한 `ctx.ip ?? null`, `ctx.userAgent ?? null` 패턴이 9개 이상의 record 호출에 반복됨. ctx 자체를 record()에 직접 스프레드하거나, `fromCtx(ctx)` 헬퍼로 추출하면 변경 지점이 단일화됨
- 제안:
  ```ts
  // auth.service.ts 내부 헬퍼
  private ctxFields(ctx: AuthContext) {
    return { ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null };
  }
  // 사용 시
  await this.loginHistory.record({ ...this.ctxFields(ctx), userId, email, event });
  ```

---

**[WARNING]** `sessions.service.ts` — `verifyReauth()` 의 제어 흐름이 복잡하고 암묵적 우선순위가 있음

- 위치: `sessions.service.ts:155–205` `verifyReauth()` 메서드
- 상세: "password 보유 + 2FA 모두 가진 사용자는 둘 중 하나만 통과하면 됨" 이라는 정책이 메서드 시그니처나 주석 밖에서는 읽히지 않음. 현재 로직은 `hasPassword && auth.password` → 즉시 return/throw, `has2fa && auth.totpCode` → 즉시 return/throw 순으로 흘러가므로 password 우선 정책이 코드에 암묵적으로 박혀 있음. 정책 변경 시 발견이 어려움
- 제안: 메서드 상단에 정책 주석 또는 별도 상수로 우선순위 명시

---

**[WARNING]** `sessions-panel.tsx` — `reauthMode` 추론 로직이 불완전하고 주석으로 우회됨

- 위치: `sessions-panel.tsx:52–58`
- 상세: `passwordHash`는 `/users/me` 응답에서 노출되지 않으므로 `twoFactorEnabled`만으로 mode를 결정한다는 사실이 인라인 주석으로만 설명되어 있음. 이 로직이 향후 `/users/me` 응답 구조 변경 시 조용히 깨질 수 있음
- 제안: `ReauthMode` 결정 로직을 `deriveReauthMode(user)` 순수 함수로 분리하고 단위 테스트를 추가. 현재는 테스트 대상 없음

---

**[WARNING]** `auth.service.ts` — `generateTokens()` 파라미터 수 증가로 가독성 저하

- 위치: `auth.service.ts` `generateTokens()` 시그니처 및 호출부
- 상세: `(user, rememberMe, familyId, ctx)` 4개 위치 인자 중 `undefined` 플레이스홀더 패턴이 여러 호출부에 반복됨(`generateTokens(user, false, undefined, ctx)`). 특히 `familyId`가 optional임에도 positional로 넘겨야 해서 실수 가능성 있음
- 제안: 옵션 객체로 리팩토링하거나 최소한 named parameter 형태로 변경 고려

---

**[INFO]** `login-history-pruner.service.ts` — 타임존 의존성이 주석에만 명시

- 위치: `jobs/login-history-pruner.service.ts:8`
- 상세: `EVERY_DAY_AT_3AM`은 서버 로컬 타임존 기준이라는 사실이 주석으로만 있음. 배포 환경(컨테이너 TZ 설정)이 바뀌면 의도치 않은 시각에 실행될 수 있음. 현재는 추적 방법이 없음
- 제안: 환경변수(`TZ=Asia/Seoul`)를 인프라 레벨에서 고정하고, 해당 내용을 배포 runbook 또는 `.env.example`에 명시

---

**[INFO]** `login-history.service.ts` — `findForUser()` 쿼리 빌더에서 컬럼명 하드코딩

- 위치: `login-history.service.ts:65–76`
- 상세: `'lh.user_id = :userId'`, `'lh.created_at < :cursor'` 등 DB 컬럼명이 문자열로 하드코딩되어 있음. 엔티티 컬럼명이 변경될 경우 컴파일 타임에 감지 불가
- 제안: TypeORM의 `select` / `where` Object 방식이 가능한 경우 사용하고, 불가피하다면 상수로 분리. 현재 규모에서는 낮은 위험이나 장기적 유지보수 부담

---

**[INFO]** `sessions.service.ts` — `void IsNull` 사용이 코드 냄새

- 위치: `sessions.service.ts` 마지막 줄
- 상세: `void IsNull;` 주석으로 "unused import 방지용" 이라고 설명하지만 실제 IsNull이 사용되지 않는다면 import 자체를 제거해야 함. eslint-disable 주석이 더 명시적이며, 사용하지 않는 import를 코드에 남기는 것은 혼란을 줌
- 제안: `IsNull` import 제거 후 해당 줄 삭제

---

**[INFO]** `revoke-confirm-dialog.tsx` — JSDoc 주석이 구현 제약을 props 설명에 기술

- 위치: `revoke-confirm-dialog.tsx:26–30` `onClose` prop 주석
- 상세: "Parent should conditionally render..." 제약은 컴포넌트 props 주석보다 컴포넌트 레벨 주석이나 storybook에 적합. 사용 방법 제약을 props 타입으로 강제할 수 없으므로 런타임 실수 가능성 있음
- 제안: 주석 유지는 괜찮으나 컴포넌트 상단으로 이동

---

**[INFO]** `plan/in-progress/auth-sessions.md` — 체크리스트 항목과 실제 구현 상태 불일치

- 위치: `plan/in-progress/auth-sessions.md` Backend 체크리스트
- 상세: `refresh-token.entity.ts`, `login-history.entity.ts`, `utils/client-ip.ts` 등이 실제로는 구현 완료되었음에도 `[ ]` 미체크 상태. plan 문서와 코드 간 동기화가 깨져 있음
- 제안: 구현 완료 시 plan 문서 즉시 갱신 (CLAUDE.md 규약에도 명시된 사항)

---

### 요약

전체적으로 코드 구조와 모듈 분리가 명확하며, 인터페이스·DTO·유틸 분리, 테스트 커버리지, i18n 처리 등 유지보수성이 높은 방향으로 설계되어 있다. 주요 유지보수 위험은 세 가지로 압축된다: `auth.service.ts`의 `loginHistory.record()` 반복 패턴(변경 지점 분산), `generateTokens()`의 positional 인자 증가(호출 오류 가능성), `verifyReauth()`의 암묵적 우선순위 정책(정책 변경 시 추적 어려움). 이 세 가지를 정리하면 장기 유지보수 부담이 크게 낮아진다.

### 위험도

**LOW**