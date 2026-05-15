## 발견사항

### [CRITICAL] 초대 이메일 URL 포맷 변경 — 프론트엔드 라우트 깨짐 가능
- **위치**: `mail.service.ts` — `sendWorkspaceInvitationEmail`
- **상세**: URL이 `/invitations/accept?token=…` → `/invitations/${token}` 으로 변경됨. 이 변경이 프론트엔드 라우터 업데이트 없이 배포되면 기존 대기 중인 초대 링크뿐 아니라 새로 발송되는 모든 초대 링크가 404 처리됨. 커밋 메시지나 플랜 문서에 프론트엔드 라우팅 변경 계획이 확인되지 않음.
- **제안**: 프론트엔드 라우트 변경과 반드시 동시 배포하거나, 이 커밋의 범위를 명시적으로 "frontend route도 함께 변경"으로 확장할 것.

---

### [CRITICAL] HTTP 에러 코드 변경 — 기존 클라이언트와 API 계약 파괴
- **위치**: `workspace-invitations.service.ts` — `accept()`, `getMetaByToken()`
- **상세**: 
  - 만료/사용된 초대: `409 ConflictException` → `410 GoneException`
  - 이메일 불일치: `403 ForbiddenException` → `400 BadRequestException`
  
  이는 기존 프론트엔드가 `409` 코드로 에러 처리를 분기하고 있다면 조용히 실패하게 만드는 Breaking Change임. 스펙(spec)상 의도된 변경인지, 프론트엔드 에러 핸들러가 이미 업데이트되었는지 확인 필요.
- **제안**: 프론트엔드 에러 처리 코드의 동반 변경을 확인하거나, 변경 이력을 plan 문서에 명시할 것.

---

### [WARNING] `resolveTokenWorkspaceContext` 리팩토링이 모든 로그인 흐름에 영향
- **위치**: `auth.service.ts:582–617` — `generateTokens` 내 `resolveTokenWorkspaceContext` 추출
- **상세**: 기존 로직은 `findOrCreatePersonalWorkspace` → `getMemberRole` 의 2단계였으나, 새 로직은 `findPersonalWorkspace` → `listForUser` → `findOrCreatePersonalWorkspace` 의 3단계로 변경됨. 초대 가입 경로에만 적용되는 것이 아니라 **기존 일반 로그인, refresh, OAuth 콜백, verify-email 등 토큰 발급 전체 경로**에 영향을 줌. 특히 `findPersonalWorkspace`가 null을 반환하고 `listForUser`도 빈 배열을 반환하는 엣지 케이스(DB에 개인 워크스페이스 멤버십 레코드가 누락된 기존 사용자)에서 토큰 claim의 `workspaceId`가 달라질 수 있음.
- **제안**: 이 리팩토링이 기존 사용자에게 미치는 영향을 별도 테스트로 검증하거나, `invitationToken` 경로에서만 개인 워크스페이스 생성을 건너뛰는 플래그를 `generateTokens`에 넘기는 방식으로 기존 경로를 보호할 것.

---

### [WARNING] 중복 초대 정책 변경 — 기존 관리자 워크플로우에 영향
- **위치**: `workspace-invitations.service.ts:102–130` — `invite()`
- **상세**: 기존 동작은 동일 이메일의 대기 초대가 있으면 `ConflictException(409)`을 던져 관리자에게 명시적으로 알렸으나, 이제 **조용히 기존 토큰을 무효화하고 새 토큰으로 덮어씀**. 관리자가 실수로 이미 초대한 이메일을 다시 초대했을 때 이전 토큰으로 수락 시도하던 사용자가 영향을 받을 수 있음. 이 정책 변경은 spec에 명시되어 있지만, 기존 `ConflictException`에 의존하는 프론트엔드 UX(안내 메시지 등)가 있다면 조용히 깨짐.
- **제안**: `spec/5-system/1-auth.md §1.5.1` 기준으로 정책이 명시됐다면 범위 내이지만, 프론트엔드에서 `409`로 "이미 초대됨" 안내를 표시하던 로직이 있다면 동반 수정 필요.

---

### [WARNING] `resend` 기능 — 핵심 작업 범위 외 추가 기능
- **위치**: `workspace-invitations.service.ts:175–220`, `workspaces.controller.ts:377–420`
- **상세**: 브랜치 목표(`미가입자 초대 토큰 흐름 + register 자동 가입`)에서 `resend` 엔드포인트는 명시적으로 요청된 기능이 아님. 유용한 기능이지만 scope expansion에 해당하며, 테스트·API 검토·Swagger 문서 업데이트가 모두 이 브랜치에 묶임.
- **제안**: 별도 작업 아이템으로 분리하거나, plan 문서에 의도적 추가임을 명시할 것.

---

### [WARNING] `invitedByName` 이메일 노출 — 개인정보 검토 필요
- **위치**: `mail.service.ts:buildInvitationHtml()`, `buildInvitationText()`
- **상세**: 초대자 이름(`invitedByName`)을 초대 이메일 본문에 노출함. 조직 내부 사용자 이름이 외부 수신자에게 노출되는 것에 대한 개인정보 정책 검토가 필요함. 이 변경은 "register 자동 가입" 핵심 작업의 직접적 요구사항이 아님.
- **제안**: 스펙에 이 UX가 명시되어 있다면 범위 내이지만, 그렇지 않다면 별도 작업으로 분리할 것.

---

### [INFO] 토큰 포맷 변경 (hex → base64url)
- **위치**: `workspace-invitations.service.ts:30–32` — `generateToken()`
- **상세**: `randomBytes(24).toString('hex')` (48자) → `randomBytes(48).toString('base64url')` (64자). 엔트로피가 2배로 강화되었으나, 기존 발급된 토큰과 포맷이 달라짐. `RegisterDto`의 `@MinLength(16)` 유효성 검사가 두 포맷 모두 통과하므로 하위 호환성 문제는 없음.
- **제안**: 현재 유효한 초대 토큰은 여전히 DB에서 조회되므로 기능적 문제는 없음. INFO 수준.

---

### [INFO] `Throttle` 데코레이터 추가 — 범위 외 보안 강화
- **위치**: `workspaces.controller.ts:340`, `workspaces.controller.ts:377`
- **상세**: 초대 생성·재발송 엔드포인트에 Rate Limiting 추가. 핵심 기능과 무관하지만 적절한 보안 강화이며 사이드이펙트가 없음.
- **제안**: 유지해도 무방. Plan 문서에 의도적 추가임을 기록하는 것이 좋음.

---

## 요약

이 변경 세트는 "미가입자 초대 토큰 기반 회원가입 자동 처리"라는 핵심 목표를 잘 구현하고 있으나, **의도된 범위를 상당히 초과**하고 있다. 특히 초대 이메일 URL 포맷 변경과 HTTP 에러 코드 변경(`409→410`, `403→400`)은 프론트엔드와의 API 계약을 파괴하는 Breaking Change로, 프론트엔드 동반 변경 없이 배포되면 기존 초대 수락 흐름이 실패할 수 있다. `resolveTokenWorkspaceContext` 리팩토링은 모든 토큰 발급 경로에 영향을 주는 잠재적 회귀 지점이며, `resend` 기능과 이메일에 초대자 이름 표시는 요청되지 않은 기능 추가다. 핵심 구현 자체는 트랜잭션 원자성, 이메일 검증 우회 정당성 등 설계가 건전하나, 범위 관리 측면에서 여러 Breaking Change와 기능 확장이 단일 커밋에 묶여 있어 롤백 시 복잡도가 높다.

## 위험도

**HIGH**