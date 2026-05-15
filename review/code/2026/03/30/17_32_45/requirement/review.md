## 리뷰 결과: 요구사항 관점 분석

### 발견사항

---

**[WARNING] 이메일 인증 트랜잭션에서 이미 워크스페이스가 존재하는 경우 처리 누락**
- 위치: `auth.service.ts` - `verifyEmail()` 내 트랜잭션 블록
- 상세: 트랜잭션 내에서 `createPersonalWorkspace`에 해당하는 로직을 직접 수행하지만, 사용자에게 이미 워크스페이스가 존재하는 경우를 확인하지 않습니다. `generateTokens`에서 호출되는 `findOrCreatePersonalWorkspace`는 멱등성이 보장되지만, 트랜잭션 내 직접 생성 로직은 중복 생성 가능성이 있습니다. 특히 재시도나 동시 요청 시 `slug` 중복으로 DB 오류가 발생할 수 있습니다.
- 제안: 트랜잭션 내 워크스페이스 생성 전 `findPersonalWorkspace` 확인 추가, 또는 `slug`에 UNIQUE 제약 처리와 retry 로직 추가

---

**[WARNING] 이메일 인증 트랜잭션과 `generateTokens` 간 워크스페이스 이중 생성 위험**
- 위치: `auth.service.ts` - `verifyEmail()` L93~L125 → `generateTokens()` L307~L316
- 상세: `verifyEmail()`은 트랜잭션에서 워크스페이스를 직접 생성한 후, `return this.generateTokens(userByToken)`을 호출합니다. `generateTokens`는 다시 `findOrCreatePersonalWorkspace`를 호출하므로 트랜잭션 커밋 후 재조회합니다. 이 흐름은 정상이지만, 트랜잭션 성공과 `generateTokens` 호출 사이에 실패가 발생하면 워크스페이스는 생성됐으나 토큰이 반환되지 않는 불일치가 발생합니다.
- 제안: `generateTokens` 내에서도 워크스페이스를 다루므로, `verifyEmail` 트랜잭션 범위에 토큰 생성을 포함하거나 명확한 분리 전략 문서화

---

**[WARNING] `verifyEmail` 테스트에서 `emailVerified: true` 상태인 사용자 재인증 시나리오 누락**
- 위치: `auth.service.spec.ts` - `verifyEmail` describe 블록
- 상세: 이미 인증된 사용자가 동일 토큰으로 재호출 시 동작(멱등성 or 오류)이 테스트되지 않습니다. 실제 구현에서 `emailVerified: true` 체크가 없으므로 중복 인증이 처리 없이 통과됩니다.
- 제안: 이미 인증된 사용자에 대한 처리 정의 및 테스트 추가

---

**[WARNING] `findOrCreatePersonalWorkspace` Race Condition 미처리**
- 위치: `workspaces.service.ts` - `findOrCreatePersonalWorkspace()`
- 상세: `findPersonalWorkspace` → 없으면 `createPersonalWorkspace`의 패턴은 동시 요청 시 두 요청 모두 "없음"으로 판단하여 중복 생성 시도할 수 있습니다.
- 제안: DB 레벨 UNIQUE 제약 + upsert 패턴, 또는 `INSERT ... ON CONFLICT DO NOTHING` 활용

---

**[INFO] `verifyEmail` 트랜잭션에서 이미 인증된 사용자(`emailVerified: true`) 검사 없음**
- 위치: `auth.service.ts` - `verifyEmail()` L73~L95
- 상세: 토큰이 유효하고 만료되지 않았더라도 이미 인증된 사용자인 경우 트랜잭션을 다시 실행합니다. 비즈니스 요구사항상 1회만 인증 허용이 일반적입니다.
- 제안: `userByToken.emailVerified === true` 체크 후 적절한 예외 또는 조기 반환 추가

---

**[INFO] TODO 주석 - 이메일 발송 미구현**
- 위치: `auth.service.ts` - `register()` L62, `forgotPassword()` L210
- 상세: 이메일 인증 발송, 비밀번호 재설정 이메일이 미구현 상태로 `console.log`로 대체되어 있습니다. 현재는 개발 편의를 위한 것이나, 프로덕션 요구사항 미충족 상태입니다.
- 제안: 추적 이슈 등록 및 mailer service 구현 계획 수립

---

**[INFO] `generateTokens` 테스트가 `generateTokens (via login)` describe에만 위치**
- 위치: `auth.service.spec.ts`
- 상세: `verifyEmail`도 내부적으로 `generateTokens`를 호출하지만, `verifyEmail` 테스트에서 워크스페이스 ID가 JWT payload에 올바르게 포함되는지는 검증하지 않습니다.
- 제안: `verifyEmail` 성공 시 반환된 토큰의 워크스페이스 컨텍스트 검증 추가

---

### 요약

변경된 코드는 핵심 요구사항인 "이메일 인증 시 원자적 워크스페이스 생성"과 "로그인 시 워크스페이스 자동 생성" 기능을 구현하고 있으며, `findOrCreatePersonalWorkspace`를 통한 멱등성 확보 시도도 적절합니다. 그러나 `verifyEmail` 트랜잭션과 이후 `generateTokens` 호출 간의 이중 워크스페이스 접근 구조, 동시성 환경에서의 race condition, 이미 인증된 사용자에 대한 재인증 처리 누락 등 실제 운영 환경에서 문제가 될 수 있는 엣지 케이스들이 남아 있습니다. 특히 이메일 미발송 TODO는 프로덕션 출시 전 반드시 해결이 필요한 기능 공백입니다.

### 위험도

**MEDIUM**