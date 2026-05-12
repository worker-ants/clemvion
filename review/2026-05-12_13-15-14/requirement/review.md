스펙 문서 확인 완료. 요구사항 충족 관점에서 전체 분석합니다.

---

## 요구사항 코드 리뷰

### 발견사항

---

**[WARNING] `invitationToken` DTO에 MaxLength 미적용**
- 위치: `register.dto.ts:65` — `@MinLength(16)`만 있고 `@MaxLength` 없음
- 상세: 스펙 §1.5.1은 토큰을 48 random bytes → 64 char base64url로 명시한다. 그러나 DTO에는 하한선(`@MinLength(16)`)만 있어 임의 길이의 문자열이 통과된다. 서비스는 DB 조회 후 404/410을 반환하므로 기능 오류는 없지만, 규격 밖 입력이 검증 계층을 통과하는 것은 요구사항 불일치이다.
- 제안: `@MaxLength(64)` (또는 `@Length(64, 64)`) 추가. 형식 검증이 필요하면 `@Matches(/^[A-Za-z0-9_-]+$/)` 추가.

---

**[WARNING] `getMetaByToken`/`resend` — workspace 삭제 시 빈 이름 반환**
- 위치: `workspace-invitations.service.ts` — `getMetaByToken` 끝부분 `workspaceName: workspace?.name ?? ''`; `resend` 의 `workspace?.name ?? ''`
- 상세: 초대 생성 후 워크스페이스가 삭제된 경우 `workspaceName: ''`를 응답하거나 빈 이름으로 이메일을 발송한다. 스펙 §1.5.2는 토큰 메타 조회 응답에 `workspaceName`이 있어야 함을 명시하므로, 삭제된 워크스페이스에 대해 404를 반환하는 것이 의미상 올바르다. `resend`도 동일.
- 제안:
  ```typescript
  if (!workspace) throw new NotFoundException({ code: 'workspace_not_found', ... });
  ```

---

**[WARNING] 스로틀이 워크스페이스·초대자 단위가 아닌 전역 엔드포인트 단위**
- 위치: `workspaces.controller.ts:340,377` — `@Throttle({ default: { ttl: 60_000, limit: 10 } })`
- 상세: 스펙 §1.5.1은 "workspace/inviter unit, per-minute cap"을 명시한다. 현재 구현은 NestJS 전역 쓰로틀러를 사용하며 클라이언트 IP 기준으로 카운팅된다. 워크스페이스 또는 초대자 단위가 아니므로 동일 초대자가 다른 워크스페이스에서 초대를 남용할 수 있고, 반대로 동일 IP에서 정상적인 여러 초대자를 동시에 막을 수 있다. 스펙에 "TBD"로 표기되어 있으나, 구현과 스펙 의도 간 괴리가 존재한다.
- 제안: 스펙 §1.5.1의 "TBD" 상태를 해소하여 확정된 단위로 구현하거나, plan 문서에 미해결 항목으로 명기.

---

**[WARNING] `termsAccepted: false`가 DTO 검증을 통과**
- 위치: `register.dto.ts:50` — `@IsBoolean()`
- 상세: `@IsBoolean()`은 값이 boolean 타입인지만 검사하고, `true`인지는 검사하지 않는다. 초대 토큰 흐름이든 일반 흐름이든 `termsAccepted: false`로 가입 요청을 보내면 DTO 검증을 통과한다. 서비스 계층에도 이 값을 확인하는 코드가 없다.
- 제안: `@Equals(true, { message: '이용약관에 동의해야 합니다.' })` 추가.

---

**[INFO] `consumeForRegistration` — 토큰 형식 재검증 없음**
- 위치: `workspace-invitations.service.ts:295` — `consumeForRegistration`
- 상세: 이 메서드는 `AuthService`에서 이미 `getMetaByToken`으로 검증한 토큰을 다시 받는다. 단, 트랜잭션 내에서 `applyAccept`가 atomic UPDATE(WHERE accepted_at IS NULL)로 중복 소비를 방지하므로, 기능적으로는 안전하다. 설계 의도와 구현이 일치한다.

---

**[INFO] `GET /invitations/:token` 엔드포인트에 Rate Limit 미적용**
- 위치: `invitations.controller.ts:29`
- 상세: 이 공개 엔드포인트는 스펙 §2.6에서 UI prefill 용도로 정의한다. 토큰이 48 random bytes(64 char base64url)이므로 열거형 공격은 현실적으로 불가능하다. 기능 요구사항 위반이 아니나, 운영 관점에서 방어적 스로틀 적용을 권장한다.

---

**[INFO] 초대 등록 흐름에서 `rememberMe = false` 고정**
- 위치: `auth.service.ts` — `registerWithInvitation` 내 `generateTokens(savedUser, false, undefined, ctx)`
- 상세: 초대 경로 자동 로그인 시 Refresh Token이 항상 7일 만료로 발급된다. 스펙에 명시적 언급은 없으나, 이 동작이 의도적임을 코드 또는 스펙에 명기하면 좋다.

---

**[INFO] `void loginHistory.record(...)` — 실패 시 조용히 무시**
- 위치: `auth.service.ts` — `registerWithInvitation` 끝부분
- 상세: 로그인 히스토리 기록 실패가 가입·로그인 흐름에 영향을 주지 않는다. 이는 `login` 등 다른 경로와 일관된 패턴이므로 의도적이나, 기록 누락이 감사(audit) 요구사항에 영향을 줄 수 있다면 검토 필요.

---

### 긍정적 구현

- **단일 트랜잭션**: 사용자 생성 + 워크스페이스 멤버 추가 + `invitation.acceptedAt` 스탬프가 하나의 트랜잭션 안에서 처리되며, 중간 실패 시 전체 롤백된다 (스펙 §1.5.2 ✓).
- **Atomic UPDATE**: `applyAccept`의 `WHERE id = :id AND accepted_at IS NULL` 패턴이 동시 수락 경쟁을 올바르게 처리한다 (affected=0 → GoneException).
- **개인 워크스페이스 자동 생성 억제**: `resolveTokenWorkspaceContext`의 3단계 폴백(개인 ws → 소속 팀 ws → 생성)이 초대 경로에서 개인 워크스페이스가 만들어지지 않도록 정확히 구현되었다 (스펙 §1.5.2 step 6 ✓).
- **이메일 정규화 일관성**: `dto.email.trim().toLowerCase()` ↔ `meta.email.toLowerCase()` 비교가 양쪽 모두 소문자 정규화 후 수행된다.
- **토큰 강도 향상**: 기존 24 byte hex(48자) → 48 byte base64url(64자)로 강화, 스펙 §1.5.1 명세와 일치.
- **HTTP 상태 코드 분리**: 404(토큰 없음) / 410(만료·사용됨) / 400(이메일 불일치) / 409(이미 멤버)가 명확히 분리되어 있다 (스펙 §1.5.4 ✓).
- **테스트 커버리지**: 이메일 불일치 거부, 정상 초대 가입(검증 이메일 미발송·자동 로그인), 이미 소비된 토큰 에러 전파, 동시 수락 경쟁, `resend` 플로우 모두 테스트된다.

---

### 요약

핵심 요구사항(단일 트랜잭션 초대 가입, 이메일 검증 생략 + 자동 로그인, 개인 워크스페이스 미생성, atomic 중복 수락 방지, 토큰 재발급 시 기존 토큰 즉시 무효화)은 스펙 §1.5와 정확히 일치하게 구현되어 있다. 다만 DTO 검증 경계의 두 가지 허점(`invitationToken` 길이 상한 없음, `termsAccepted: false` 통과), 워크스페이스 삭제 시 빈 이름 방치, 스로틀 단위의 스펙-구현 불일치가 미충족 요구사항으로 남아 있다.

---

### 위험도

**MEDIUM** — 기능 핵심 흐름은 스펙을 충족하나, DTO 검증 허점과 스로틀 단위 불일치가 운영 시 예상치 못한 동작을 유발할 수 있다.