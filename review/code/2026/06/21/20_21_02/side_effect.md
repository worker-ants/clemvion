# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `requestEmailChange` — 메일 발송 실패 시 DB pending 롤백 구현됨 (W6 해소 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/auth/auth.service.ts` L841-854
- 상세: 이전 리뷰(W6)에서 지적된 "메일 발송 실패 시 DB pending 상태 잔류" 문제가 이번 변경에서 해소됐다. `sendEmailChangeVerification` 실패 시 `clearPendingEmailChange(userId)`를 호출해 `pendingEmail`, `emailChangeToken`, `emailChangeExpiresAt` 세 필드를 NULL로 롤백한다. 롤백 자체가 실패해도 내부 catch로 삼키고 주 오류(`mailErr`)를 rethrow 하는 구조로, 주 오류 전파 우선 원칙을 준수한다.
- 제안: 없음 — 올바른 처리.

### [INFO] `verifyEmailChange` — 세션 revoke 후 `generateTokens` 실패 시 강제 로그아웃 시나리오 주석 명시됨 (W10 해소 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/auth/auth.service.ts` L921-923
- 상세: 이전 리뷰(W10)에서 지적된 "generateTokens 실패 시 이메일 변경·revoke 완료 상태로 토큰 미발급(강제 로그아웃)" 시나리오가 인라인 주석으로 명시됐다. 사용자는 새 이메일로 재로그인하면 복구 가능하다는 점도 명시되어 있어 운영자·유지보수자가 해당 상태를 인지하고 대응 가능하다.
- 제안: 없음 — 허용 가능한 상태로 문서화됨.

### [INFO] `verifyEmailChange` — `sendEmailChangedNotice` 실패 시 `logger.warn` 추가됨 (W7 해소 확인)
- 위치: `/Volumes/project/private/clemvion/.claire/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/auth/auth.service.ts` L937-943
- 상세: 이전 리뷰(W7)에서 지적된 "빈 catch 블록 — 운영 모니터링 불가" 문제가 해소됐다. `catch (noticeErr)` 블록 내에서 `this.logger.warn(...)` 을 호출해 AuthService 레벨에서도 실패를 기록한다. 옛 이메일 주소(보안 통지 누락 여부)와 오류 메시지를 모두 로그에 포함시키므로 운영자가 알림 채널 이상을 감지할 수 있다.
- 제안: 없음 — 올바른 처리.

### [INFO] `Logger` 인스턴스 도입 — `private readonly logger` 필드 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/auth/auth.service.ts` L57
- 상세: `private readonly logger = new Logger(AuthService.name)` 가 클래스 레벨에 추가됐다. NestJS `Logger`는 클래스별 인스턴스로 사용하는 표준 패턴이며, 전역 상태를 변경하지 않는다. 생성자 주입 없이 클래스 프로퍼티로 즉시 초기화되는 방식이라 DI 컨테이너 부작용도 없다. 기존 `AuthService` 사용자(테스트 포함)에게 영향이 없다.
- 제안: 없음.

### [INFO] `EMAIL_CHANGE_TTL_MS` 모듈 레벨 상수 도입
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/auth/auth.service.ts` L53
- 상세: `const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000` 이 모듈 최상위에 선언됐다. `export` 없이 파일 내부에서만 사용되므로 외부 모듈의 네임스페이스에 영향을 주지 않는다. 기존 하드코딩 2곳을 이 상수로 대체해 일관성을 높였다.
- 제안: 없음.

### [INFO] `EmailChangeVerifyDto` — `@MaxLength(128)` 추가 (INFO#2 해소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/users/dto/email-change-verify.dto.ts` L336
- 상세: 기존 `@MinLength(1)` 만 있던 DTO에 `@MaxLength(128)`이 추가됐다. 입력 검증 강화로 대용량 문자열 입력이 `hashToken`(SHA-256) 연산에 도달하기 전에 거부된다. 기존 정상적인 호출자(UUID v4 기반 36자 토큰 전송)에게 영향이 없다. 클래스 검증 데코레이터 추가는 외부 API에 대해 더 엄격한 입력 제약을 추가하므로 이론적으로는 매우 긴 토큰을 사용하는 클라이언트에게 breaking change이지만, 정상 흐름에서 이러한 클라이언트는 존재하지 않는다.
- 제안: 없음.

### [INFO] `users.controller.ts` Swagger 데코레이터 변경 — API 계약 문서 레벨 부작용 없음 (INFO#20, INFO#21 해소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/users/users.controller.ts` L394-414
- 상세: `@ApiForbiddenResponse` 데코레이터 추가 및 `@ApiUnauthorizedResponse` 설명 문구 변경. Swagger 메타데이터 데코레이터는 런타임 HTTP 응답 동작을 변경하지 않으며, OpenAPI 문서 생성 출력에만 영향을 미친다. 실제 HTTP 상태 코드 반환 로직은 서비스 레이어에서 결정되므로 이 변경은 문서 정확성 개선이다. 기존 API 소비자에게 런타임 부작용이 없다.
- 제안: 없음.

### [INFO] `User` 엔티티 JSDoc 추가 — 런타임 부작용 없음 (INFO#17 해소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/users/entities/user.entity.ts` L358-362
- 상세: `emailChangeExpiresAt` 필드에 JSDoc 주석 추가. 런타임 동작에 영향을 미치지 않는다.
- 제안: 없음.

### [INFO] 테스트 파일 변경 — 실 서비스 코드 부작용 없음
- 위치: `auth.service.spec.ts`, `sessions.service.spec.ts`, `users.service.spec.ts`, `mail.service.spec.ts`
- 상세: 테스트 파일에 신규 `describe` 블록 추가. 테스트 파일은 프로덕션 런타임에 로드되지 않으므로 서비스 코드의 부작용과 무관하다. `makeQb` 헬퍼 함수가 모듈 스코프에 추가됐으나 테스트 파일에만 존재한다. jest mock 패턴을 사용하므로 실 DB·네트워크 호출이 없다.
- 제안: 없음.

### [INFO] `resendEmailChange` — 메일 발송 실패 시 새 토큰이 DB에 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/auth/auth.service.ts` L960-970
- 상세: `resendEmailChange`는 `usersService.update`(새 토큰 저장) 후 `sendEmailChangeVerification`을 호출한다. 메일 발송이 실패하면 새 토큰은 DB에 저장됐지만 이메일이 발송되지 않은 상태가 된다. `requestEmailChange`와 달리 `clearPendingEmailChange` 롤백이 없다. 그러나 이 경우 사용자는 resend를 다시 호출하면 토큰이 재발급되어 복구 가능하다. 또한 토큰이 DB에 저장된 상태이므로 혹시 메일이 뒤늦게 도착하더라도 유효한 토큰을 사용한 verify가 성공한다. 이는 requestEmailChange와 의미론적으로 다른 케이스이며, 기존 이전 리뷰(RESOLUTION.md)에서도 resend 발송 실패 롤백은 명시적 처리 대상으로 포함되지 않았다. 부작용이 존재하나 복구 가능하고 INFO 수준이다.
- 제안: 선택적 개선으로, `resendEmailChange`에도 메일 발송 실패 시 rollback 또는 경고 로그를 추가할 수 있다. 그러나 resend 실패 시 사용자가 다시 resend 가능하므로 기능적 블로킹이 없어 현재 우선도는 낮다.

### [INFO] `SessionsService.reauthenticate` 공개 메서드 도입 — 인터페이스 확장
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts` (`reauthenticate` 신규 public 메서드)
- 상세: 기존 `private verifyReauth`를 래핑하는 `public reauthenticate`가 추가됐다. 이는 `SessionsService`의 공개 인터페이스를 확장하는 변경이다. 기존 호출자에게는 영향이 없으나(추가만 했으므로), `SessionsService`를 주입받는 다른 서비스가 이 새 메서드를 임의로 호출할 수 있는 진입점이 생긴다. NestJS DI 컨테이너 내에서는 주입받지 않으면 호출 불가이고, 현재 유일한 호출자는 `AuthService.requestEmailChange`이다. 범용 재인증 우회 경로가 되지 않도록 JSDoc으로 호출자를 제한하는 것이 권장된다.
- 제안: JSDoc에 `@internal` 표시 또는 "현재 호출자: AuthService.requestEmailChange (이메일 변경 step-up)" 주석 추가.

### [INFO] `AUDIT_ACTIONS.USER_EMAIL_CHANGED` — `AuditAction` 유니온 자동 확장
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` L84
- 상세: `as const` 객체에 새 키 추가로 `AuditAction` 유니온 타입이 자동 확장된다. 이 코드베이스에서 `AuditAction`을 exhaustive switch로 소비하는 패턴이 없으므로 타입 에러 발생 가능성이 낮다. 기존 코드에 부작용이 없다.
- 제안: 없음.

### [INFO] `UserProfileDto.pendingEmail` 추가 — API 응답 스키마 additive 변경
- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts`
- 상세: `pendingEmail?: string | null` 필드가 optional로 추가됐다. 기존 클라이언트가 추가 필드를 무시하는 경우 하위 호환성이 유지된다. 프론트엔드 `UserProfile` 인터페이스도 동시에 갱신됐다. 외부 API 소비자(channel-web-chat 등)가 strict 파싱을 한다면 불필요한 필드가 추가되는 것을 감지할 수 있으나, nullable optional 필드이므로 영향이 낮다.
- 제안: 없음.

---

## 요약

이번 변경셋의 부작용 관점 평가는 전반적으로 양호하다. 이전 리뷰(18_29_37)에서 WARNING으로 지적된 주요 부작용 3건(W6: requestEmailChange 메일 실패 시 DB 잔류, W7: verifyEmailChange sendEmailChangedNotice 빈 catch, W10: generateTokens 실패 시 강제 로그아웃 미문서화)이 모두 해소됐다. `requestEmailChange`의 메일 발송 실패 시 `clearPendingEmailChange` 롤백이 적용됐고, `verifyEmailChange`의 구 이메일 통지 실패가 `logger.warn`으로 가시화됐으며, 강제 로그아웃 시나리오가 주석으로 명시됐다. 잔여 부작용으로는 `resendEmailChange`에서 메일 발송 실패 시 새 토큰이 DB에 잔류하는 점이 있으나, 사용자가 재시도 가능하고 기능 블로킹이 없어 INFO 수준이다. 전역 변수 도입, 의도치 않은 환경 변수 읽기/쓰기, 예상 외 네트워크 호출, 이벤트/콜백 변경 등의 부작용은 발견되지 않았다. 공개 인터페이스 변경은 `SessionsService.reauthenticate` 메서드 추가(additive), `UserProfileDto.pendingEmail` 필드 추가(additive), `EmailChangeVerifyDto @MaxLength(128)` 제약 강화(더 엄격한 입력 거부)로 제한적이며 기존 정상 호출자에게 영향이 없다.

## 위험도

LOW

STATUS=success ISSUES=0 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/side_effect.md RESET_HINT=
