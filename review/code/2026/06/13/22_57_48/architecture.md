# 아키텍처(Architecture) Review

## 발견사항

### [INFO] AuthModule ↔ UsersModule 순환을 forwardRef 로 해소 — 정당하나 구조적 결합 증가
- 위치: `codebase/backend/src/modules/auth/auth.module.ts:49`, `codebase/backend/src/modules/users/users.module.ts:1231-1235`, `codebase/backend/src/modules/users/users.controller.ts:1102-1105`
- 상세: 기존 단방향(`AuthService → UsersService`, auth.service.ts:36)에 더해 이번 변경으로 역방향(`UsersController → AuthService`)이 추가되어 모듈 레벨 순환이 생겼고 양쪽 `forwardRef` 로 해소했다. `rotateSessionAfterPasswordChange` 가 AuthService 에 응집되어 있고(세션·토큰은 auth 의 도메인 책임) 호출자가 UsersController 인 것은 자연스러운 선택이다. `forwardRef` 는 NestJS 가 명시적으로 제공하는 정공법이며 주석으로 의도가 분명히 문서화돼 있어 수용 가능. 다만 forwardRef 순환은 런타임 초기화 순서 취약성·테스트 부담·향후 추가 결합 유혹을 동반하는 구조적 부채다.
- 제안: (선택, 후속) 세션 회전을 controller→AuthService 직접 호출 대신 도메인 이벤트(`PasswordChangedEvent`) 발행 + auth 측 핸들러 구독으로 디커플링하면 순환을 제거할 수 있다. 현 범위에서는 과한 추상화이므로 즉시 조치 불요 — forwardRef 양방향 추가가 더 늘지 않도록 경계만 유지.

### [INFO] changePassword SRP 분리 — 레이어 책임 정합 (개선)
- 위치: `codebase/backend/src/modules/users/users.service.ts:1407-1439`, `codebase/backend/src/modules/users/users.controller.ts:1128-1197`
- 상세: bcrypt 검증·강도검증·해시·persist 도메인 로직을 controller 에서 `UsersService.changePassword` 로 이전한 것은 SRP·레이어 분리상 명확한 개선이다. controller 는 이제 오케스트레이션(service 위임 → 세션 회전 → 쿠키 설정 → 감사)만 담당한다. 세션 회전·쿠키·workspaceId 귀속을 controller 에 남긴 근거(액터 세션 컨텍스트가 controller 에만 존재)도 jsdoc 에 명시돼 있어 책임 경계가 일관적이다.
- 제안: 없음. 바람직한 방향.

### [INFO] authContextFromRequest DRY 추출 — 중복 제거 적절
- 위치: `codebase/backend/src/modules/auth/utils/auth-context.ts:587-593`
- 상세: auth.controller·webauthn.controller 에 각각 중복 정의돼 있던 동일 함수를 단일 util 로 통합. 반환 타입을 공유 `AuthContext`(types/auth-context.ts)로 명시해 service 전달 계약과 정합. 결합도 관점에서 util→`extractClientIp`(같은 패키지) 단방향 의존만 가지며 순환 없음.
- 제안: 없음.

### [INFO] 감사 record 의 ipAddress 추출 경로 — helper 와 직접 호출 혼재(의도적)
- 위치: `auth.controller.ts:317,366`, `webauthn.controller.ts:155,352` (직접 `extractClientIp`) vs `users.controller.ts:1171` (`authContextFromRequest`)
- 상세: 감사 record 에는 userAgent 가 불필요해 `extractClientIp(req)` 직접 호출, 세션 ctx 전달에는 `authContextFromRequest` 사용으로 갈린다. 의미상 구분이 있어 안티패턴은 아니나, 동일 핸들러 안에서 두 추출 경로가 공존(webauthn delete 는 `extractClientIp` 직접, register 인근은 ctx)해 IP 추출 정책(CF-신뢰 게이트)이 두 진입점에 산재한다. 두 경로 모두 `extractClientIp` 를 단일 출처로 쓰므로 정책 일관성은 유지된다.
- 제안: (선택) `AuthContext` 에서 ip 만 뽑아 audit 에 넘기면(`authContextFromRequest(req).ip ?? undefined`) 핸들러당 추출 호출을 1회로 통일할 수 있다. 기능 영향 없음.

### [INFO] PasswordChangeResultDto 응답 계약 변경 — 기존 토큰 발급 패턴과 정합
- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts:841-849`, FE `change-password/page.tsx:1636-1643`
- 상세: `{ success: boolean }` → `{ accessToken: string }` 응답 계약 변경. login/refresh 등 기존 토큰 발급 응답(`{ data: { accessToken } }`)과 동일 형태라 프론트 통합 패턴이 일관적이다. FE 는 `setAccessToken` 으로 in-memory 교체, refresh 쿠키는 Set-Cookie 자동 회전 — 책임 경계 명확. 다만 이는 breaking change 이므로 동일 spec/문서 동기화(plan 에 추적됨)가 전제되어야 한다.
- 제안: 없음(plan·spec draft 에 계약 변경 추적됨).

### [INFO] revokeAllFamilies 의 SessionsService 응집 — emitter 일관성 유지
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts:476-503`
- 상세: bulk revoke + `session_revoked`(familyId=null) 기록을 SessionsService 에 두어 data-flow §1.2 의 "session_revoked emitter = SessionsService" 단일 책임을 유지했다. `revokeOtherFamilies` 와 동일 패턴(familyId=null)을 따라 응집도가 높고, AuthService 는 이를 위임만 한다(`rotateSessionAfterPasswordChange` → `revokeAllFamilies` + `generateTokens`). 책임 분배가 명확.
- 제안: 없음.

## 요약
이번 변경은 controller 비대화를 해소(changePassword 도메인 로직을 UsersService 로, 세션 회전을 AuthService 로 위임)하고 IP 추출 중복을 단일 util 로 통합한, 전반적으로 SRP·레이어 분리·응집도를 개선하는 리팩터링이다. session_revoked emitter 를 SessionsService 에 일원화해 data-flow 계약 일관성을 지켰고, 응답 DTO 변경도 기존 토큰 발급 패턴과 정합한다. 유일한 구조적 비용은 `UsersController → AuthService` 추가로 발생한 AuthModule↔UsersModule 순환이나, NestJS forwardRef 로 정공법 해소했고 의도가 충분히 문서화되어 있어 수용 가능한 수준이다 — 다만 향후 forwardRef 양방향 결합이 더 늘지 않도록 경계 관리가 필요하다. Critical/Warning 급 아키텍처 결함은 없다.

## 위험도
LOW
