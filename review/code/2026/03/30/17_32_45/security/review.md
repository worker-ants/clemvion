## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] 이메일 인증 후 토큰 생성 시 상태 불일치 위험**
- 위치: `auth.service.ts` - `verifyEmail()` 메서드 (트랜잭션 블록 이후 `generateTokens` 호출)
- 상세: `dataSource.transaction()` 내에서 `emailVerified: true`로 업데이트하지만, 이후 `generateTokens(userByToken)`에 전달되는 `userByToken` 객체는 트랜잭션 실행 전에 조회된 **stale 객체**입니다. DB 상태와 메모리 객체 불일치로, 만약 토큰 생성 로직이 `emailVerified` 상태를 신뢰한다면 잘못된 정보 기반 토큰이 발급될 수 있습니다.
- 제안: 트랜잭션 완료 후 DB에서 사용자를 다시 조회하거나, 트랜잭션 내부에서 최신 상태를 반환하여 토큰 생성에 사용하세요.

---

**[WARNING] `findOrCreatePersonalWorkspace` 레이스 컨디션 (TOCTOU)**
- 위치: `workspaces.service.ts` - `findOrCreatePersonalWorkspace()` (L57-64)
- 상세: `findPersonalWorkspace` 조회 후 `createPersonalWorkspace` 호출 사이에 다른 요청이 동일 사용자에 대해 워크스페이스를 생성하면 중복 워크스페이스가 생성될 수 있습니다. 이메일 인증 직후 로그인이 빠르게 연속될 때 발생 가능합니다.
- 제안: DB에 `(ownerId, type)` 복합 유니크 제약조건을 추가하고, `INSERT ... ON CONFLICT DO NOTHING` 또는 `upsert` 패턴을 사용하세요.

---

**[WARNING] `generateTokens`가 `verifyEmail` 트랜잭션 외부에서 실행**
- 위치: `auth.service.ts` - `verifyEmail()` 마지막 라인 `return this.generateTokens(userByToken)`
- 상세: 이메일 인증(DB 업데이트)은 트랜잭션으로 보호되지만, refresh token 저장(`generateTokens` 내부)은 트랜잭션 밖에서 실행됩니다. 트랜잭션 실패 후 재시도 시 이미 발급된 토큰이 존재할 수 있으며, 이메일 인증은 성공했으나 토큰 저장이 실패하면 사용자는 인증 완료 후 로그인 불가 상태가 됩니다.
- 제안: refresh token 저장도 동일 트랜잭션 내에 포함하거나, 실패 시 명확한 재시도 경로를 제공하세요.

---

**[WARNING] 슬러그 엔트로피 부족으로 인한 예측 가능성**
- 위치: `auth.service.ts` - `verifyEmail()` 내 슬러그 생성 (L112-113), `workspaces.service.ts` - `createPersonalWorkspace()` (L24-25)
- 상세: 슬러그가 `localPart-XXXX` (4자리 hex) 형태로 생성됩니다. 16^4 = 65,536가지 경우의 수밖에 없어, 이메일 주소를 아는 공격자가 다른 사용자의 워크스페이스 슬러그를 열거할 수 있습니다. 슬러그가 공개 URL로 노출된다면 정보 유출 위험이 있습니다.
- 제안: `uuidv4().substring(0, 8)` 이상으로 늘리거나, 슬러그를 직접 접근 키로 사용하지 말고 내부 ID 기반 접근 제어를 유지하세요.

---

**[WARNING] 개발용 토큰 콘솔 출력이 프로덕션에서도 실행 가능**
- 위치: `auth.service.ts` - `register()` L63-65, `forgotPassword()` L255-256
- 상세: `console.log`로 이메일 인증 토큰과 비밀번호 재설정 토큰을 출력합니다. 환경 구분 없이 항상 실행되어 프로덕션 로그에 민감 토큰이 노출될 수 있습니다. 로그 수집 시스템(CloudWatch, ELK 등)에 토큰이 평문으로 저장됩니다.
- 제안: `if (process.env.NODE_ENV !== 'production')` 조건으로 감싸거나, 즉시 메일 발송 서비스로 교체하세요.

---

**[INFO] `null as unknown as string` 타입 캐스팅 안전성**
- 위치: `auth.service.ts` - `verifyEmail()` (L100-101), `resetPassword()` (L275-276)
- 상세: TypeScript 타입 시스템을 우회하는 이중 캐스팅 패턴입니다. 기능상 문제는 없으나, 엔티티 타입 정의에서 `null`을 허용(`string | null`)하지 않는 구조적 문제를 감추고 있습니다.
- 제안: `User` 엔티티의 `emailVerifyToken`, `passwordResetToken` 필드 타입을 `string | null`로 수정하세요.

---

**[INFO] 테스트 코드에서 `as never` 타입 캐스팅 남용**
- 위치: `auth.service.spec.ts` - `generateTokens (via login)` 테스트 (L333)
- 상세: `mockResolvedValue({ id: 'new-ws-uuid' } as never)` 패턴은 타입 안전성을 완전히 포기합니다. 실제 `Workspace` 타입과 불일치하는 mock이 테스트를 통과시켜 런타임 버그를 놓칠 수 있습니다.
- 제안: `Partial<Workspace>`를 사용하거나 필요한 필드를 갖춘 완전한 mock 객체를 사용하세요.

---

### 요약

전반적으로 bcrypt(12 rounds), SHA-256 토큰 해싱, refresh token 재사용 감지, 이메일 열거 방지 등 기본 보안 설계는 양호합니다. 그러나 이메일 인증 트랜잭션과 토큰 발급의 원자성 부재, `findOrCreatePersonalWorkspace`의 TOCTOU 레이스 컨디션, 개발용 토큰의 프로덕션 로그 노출 가능성이 실제 서비스에서 문제를 일으킬 수 있는 주요 위험 요소입니다. 슬러그 엔트로피 부족도 워크스페이스가 공개 접근 가능한 구조라면 정보 열거 공격에 취약할 수 있습니다.

### 위험도

**MEDIUM**