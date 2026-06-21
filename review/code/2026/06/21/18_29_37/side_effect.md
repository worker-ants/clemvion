# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `verifyEmailChange` — 세션 revoke 후 DB 업데이트 실패 시 불완전한 상태 잔류
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `verifyEmailChange` 메서드 (라인 196–220)
- 상세: `usersService.update`(email 교체)가 성공한 뒤 `sessionsService.revokeAllFamilies`가 호출된다. email은 이미 변경된 상태인데 이후 `generateTokens`가 실패하면(예: DB 오류) 반환 토큰 없이 함수가 예외를 던진다. 이 경우 `pendingEmail/emailChangeToken/emailChangeExpiresAt`은 NULL로 정리됐지만 세션 revoke는 이미 완료된 상태가 된다. 호출자가 에러를 받아도 사용자는 모든 세션에서 강제 로그아웃된 채 남아있어 재로그인이 필요하다. 이는 기존 `rotateSessionAfterPasswordChange` 패턴과 동일한 한계이므로 새로 도입된 버그는 아니지만, 부작용의 범위(세션 전체 revoke가 이미 실행됨)가 호출자에게 명시되지 않는다.
- 제안: 주석에 "generateTokens 실패 시 세션 revoke는 이미 완료된 상태" 임을 명시하거나, 현재 구현 이상으로 롤백이 불가능하다는 점을 문서화.

### [WARNING] `requestEmailChange` — 메일 발송 실패 시 DB에 pending 상태 잔류
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `requestEmailChange` 메서드 (라인 143–154)
- 상세: `usersService.update`(pendingEmail, emailChangeToken, emailChangeExpiresAt 저장)가 성공한 뒤 `mailService.sendEmailChangeVerification`이 실패하면 예외가 그대로 전파된다. 이때 DB에는 pending 상태가 저장된 채 남아 클라이언트는 에러를 받는다. 사용자 입장에서는 "요청 실패"로 보이지만, 실제 DB에는 pending 행이 존재하므로 다시 요청하면 resend 플로우가 아닌 request 플로우가 다시 실행되어 토큰이 재발급된다. 이 불일치는 멱등성 관점에서 혼란을 일으킬 수 있으나, `resendEmailChange`가 이를 커버하므로 사용성 측면 영향은 낮다. 단, 클라이언트에 에러를 반환하면서 DB 상태가 바뀌었다는 점은 부작용에 해당한다.
- 제안: 메일 발송 실패 시 `clearPendingEmailChange`를 호출해 DB 상태를 롤백하거나, "메일 발송 실패 시 이미 저장된 pending 상태가 남을 수 있음"을 명시하는 주석 추가.

### [WARNING] `verifyEmailChange` — 옛 이메일 통지 실패를 호출자가 감지 불가
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `verifyEmailChange` 메서드 (라인 222–231)
- 상세: `sendEmailChangedNotice` 실패를 `catch {}`로 완전 삼킨다. 이는 "best-effort" 설계 의도이며 주석에도 명시되어 있으나, `mailService.sendEmailChangedNotice` 내부에서도 throw하기 때문에(`mail.service.ts` 라인 443: `throw error`) catch로 다시 잡는 구조다. 즉 MailService는 실패를 throw하고 AuthService는 그것을 삼킨다. 보안 통지 누락이 무음으로 처리되므로, 로그가 MailService 내부에서만 남고 AuthService 레벨에서 별도 경고 로그가 없어 운영 모니터링이 어렵다.
- 제안: `catch` 블록 내에서 logger.warn 또는 logger.error 수준의 로깅을 추가해 통지 실패를 AuthService 레벨에서도 가시화.

### [INFO] `reauthenticate` — 공개 메서드로 `verifyReauth` 위임 노출
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts` `reauthenticate` 메서드 (라인 310–316)
- 상세: 기존 private `verifyReauth`를 감싸는 public `reauthenticate`를 새로 도입했다. `verifyReauth`는 기존에 내부(세션 종료 흐름)에서만 사용되던 private 메서드다. 이제 `AuthService`에서 `SessionsService.reauthenticate`를 통해 동일 재인증 로직을 외부에서 호출할 수 있게 된다. 새로운 진입점이 생기는 것이므로 다른 서비스가 임의로 재인증을 우회할 수 있는 경로가 아닌지 확인 필요하나, 현재 사용처는 `AuthService.requestEmailChange`뿐이고 NestJS DI로 주입 범위가 제한되므로 실질적 위험은 낮다.
- 제안: JSDoc에 "현재 호출자: AuthService.requestEmailChange (이메일 변경 step-up)" 을 명시해 의도된 호출자를 제한.

### [INFO] `UserProfileDto.pendingEmail` 추가 — 기존 직렬화 사용자에 대한 하위 호환
- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` (라인 593–599)
- 상세: `UserProfileDto`에 `pendingEmail?: string | null` 필드가 추가되었다. optional 필드이므로 기존 응답 파싱 코드가 해당 필드를 무시하면 하위 호환이 유지된다. 단, 프론트엔드 `UserProfile` 인터페이스(`codebase/frontend/src/lib/api/users.ts` 라인 1568–1569)에도 동일 필드가 추가되어 API 계약 변경이 프론트엔드까지 전파된다. 외부 클라이언트(예: channel-web-chat, 외부 API 소비자)가 응답을 엄격하게 파싱하는 경우 불필요한 필드가 추가되는 부작용이 있으나, nullable optional이므로 영향은 낮다.
- 제안: 없음 (설계 의도에 부합).

### [INFO] `MessageResponseDto` 신규 클래스 — `user-response.dto.ts` 내 범용 DTO 추가
- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` (라인 601–604)
- 상세: `MessageResponseDto`가 이메일 변경 전용이 아닌 범용 메시지 응답 DTO로 추가되었다. 이 클래스가 다른 모듈에서도 임포트·재사용될 경우 users 모듈에 종속성이 생긴다. 현재는 UsersController 내에서만 사용되므로 문제없으나, 향후 범용 사용이 늘어나면 `common` 모듈로 이동하는 것이 적절하다.
- 제안: 범용 사용이 예상된다면 `codebase/backend/src/common/dto/` 등 공통 위치로 이동 고려.

### [INFO] `emailTakenByOther` — SQL LOWER() 인덱스 미사용 가능성
- 위치: `codebase/backend/src/modules/users/users.service.ts` `emailTakenByOther` (라인 982–992)
- 상세: `LOWER(u.email) = LOWER(:email)` 조건은 `email` 컬럼에 일반 인덱스가 있어도 해당 인덱스를 사용하지 못할 수 있다. 기존 `emailTaken` 메서드도 동일 패턴을 사용하므로 신규 도입 문제는 아니나, 이메일 변경 verify 시점(높은 지연이 허용되지 않는 경로)에 전체 테이블 스캔이 발생할 수 있다. 단, 사용자 수가 크지 않은 초기 단계에서는 무시 가능하다.
- 제안: `email` 컬럼에 `lower(email)` 표현식 인덱스가 있는지 확인. 없다면 마이그레이션에 추가 고려(V100 또는 후속 마이그레이션).

### [INFO] `verify/page.tsx` — `setAccessToken` 전역 상태 변경
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx` (라인 1208)
- 상세: 이메일 변경 verify 성공 시 `setAccessToken(res.data.data.accessToken)`을 호출해 전역 access token 상태를 교체한다. 이는 `change-password` 페이지의 기존 패턴과 동일하므로 신규 위험은 아니다. 단, `ran.current` ref로 strict mode 중복 실행을 방지하는 로직이 `token`이 null인 경우 early return하므로 토큰이 늦게 로드되는 경우(SSR edge case)에 `ran.current`가 false로 유지되어 두 번 실행될 수 있다. 현재 구조상 `token`은 `searchParams.get("token")`으로 클라이언트 렌더 시점에 즉시 가용하므로 실제 위험은 낮다.
- 제안: 없음 (기존 패턴과 일치).

### [INFO] `V100` 마이그레이션 — nullable 컬럼 추가는 기존 row에 영향 없음
- 위치: `codebase/backend/migrations/V100__add_email_change_fields.sql`
- 상세: 세 컬럼 모두 `NULL` default이므로 기존 row의 데이터 변경이 없다. `ALTER TABLE` 단일 구문으로 안전하다. `NOT VALID/VALIDATE 2-step` 불필요한 이유도 주석에 명시되어 있다. 부작용 없음.
- 제안: 없음.

### [INFO] `AUDIT_ACTIONS.USER_EMAIL_CHANGED` — 기존 `AuditAction` 유니온 타입 자동 확장
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (라인 84)
- 상세: `as const` 객체에 새 키를 추가하면 `AuditAction` 유니온 타입이 자동 확장된다. 기존에 `AuditAction`을 switch/exhaustive check 패턴으로 소비하는 코드가 있다면 새 케이스 처리 누락으로 타입 에러가 발생할 수 있다. 그러나 audit-action 상수를 exhaustive check 하는 패턴은 이 코드베이스에서 일반적이지 않으므로 실질 위험은 낮다.
- 제안: 없음 (기존 패턴 일치).

---

## 요약

이번 변경은 이메일 변경 흐름(request → verify → resend/cancel)을 DB 마이그레이션, 엔티티, 서비스, 컨트롤러, 프론트엔드까지 일관되게 추가한다. 전반적으로 기존 패턴(비밀번호 변경, 이메일 인증 토큰)을 충실히 복제하여 설계적 일관성이 높다. 주요 부작용 위험은 두 가지로, `requestEmailChange`에서 메일 발송 실패 시 DB pending 상태가 롤백되지 않고 잔류하는 점, 그리고 `verifyEmailChange`에서 세션 revoke 완료 후 `generateTokens` 실패 시 사용자가 강제 로그아웃 상태로 남는 점이다. 둘 다 설계 상 "best-effort" 또는 "롤백 불가" 영역이지만 호출자에게 명시적으로 문서화되지 않아 운영 혼란을 야기할 수 있다. 옛 이메일 통지 실패를 AuthService 레벨에서 무음 처리하는 점도 모니터링 가시성 측면에서 개선 여지가 있다. 전역 변수 도입, 의도치 않은 네트워크 호출, 환경 변수 읽기/쓰기 등의 부작용은 발견되지 않았다.

---

## 위험도

LOW
