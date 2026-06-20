# API 계약(API Contract) 리뷰 결과

## 발견사항

변경 범위는 다음 네 파일이다.

- `auth.controller.spec.ts` — 테스트 픽스처 정리 (bcrypt / UsersService 직접 참조 제거, `verifyPasswordForUser` mock 교체)
- `auth.controller.ts` — `disable2fa` 내부 raw bcrypt 검증 로직을 `authService.verifyPasswordForUser()` 호출로 교체, `UsersService` / `bcrypt` 의존성 제거
- `auth.service.spec.ts` — `verifyPasswordForUser` 단위 테스트 추가
- `auth.service.ts` — `verifyPasswordForUser(userId, plainPassword): Promise<void>` 신규 메서드 추가

이 변경은 **내부 레이어 정렬 리팩터링**으로, 외부 HTTP API 계약(엔드포인트 경로, 요청/응답 스키마, HTTP 상태 코드, 에러 형식) 에는 변경이 없다.

구체적으로:

- `POST /auth/2fa/disable` 엔드포인트의 요청 DTO(`Disable2faDto`), 응답 형식(`{ data: { ok: true } }`), HTTP 상태 코드(200), 에러 응답 코드·메시지(`PASSWORD_REQUIRED`, `PASSWORD_INVALID`, 401) 는 변경 전과 동일하게 보존된다.
- 코드 주석 및 서비스 명세(`data-flow/2-auth.md §1.2` 언급) 에서도 "에러 코드·메시지·401 shape 동일 보존" 을 명시하고 있으며, 신규 서비스 메서드의 에러 응답 구조가 기존 컨트롤러 코드와 동일하게 구현되어 있음을 확인했다.
- 다른 모든 엔드포인트(register, login, refresh, logout, verify-email, 2fa/setup, 2fa/verify 등)는 이번 변경의 영향권 밖이다.

### - [INFO] `verifyPasswordForUser` 의 사용자 미존재 에러 코드가 login 의 코드와 상이
  - 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser` (새 메서드)
  - 상세: `login()` 에서 사용자를 찾지 못한 경우 `code: 'LOGIN_FAILED'` 를 반환하지만, `verifyPasswordForUser()` 는 같은 상황(사용자 미존재 또는 passwordHash 없음)에서 `code: 'PASSWORD_REQUIRED'` 를 반환한다. 이는 각 엔드포인트의 맥락이 다르므로 의도된 설계(2FA 비활성화 재인증 경로 전용)로 보이며, 기존 컨트롤러 코드의 동작을 그대로 유지한 것이다. API 클라이언트가 `disable2fa` 에서 해당 에러 코드를 이미 처리 중이라면 breaking change 가 아니다.
  - 제안: 현재 설계 유지 가능. 다만 향후 동일 메서드를 다른 엔드포인트에서 재사용할 경우 `PASSWORD_REQUIRED` 가 의미론적으로 적절한지 재검토 필요.

## 요약

이번 변경은 `POST /auth/2fa/disable` 의 비밀번호 재확인 로직을 컨트롤러에서 서비스 레이어로 이관하는 순수 내부 리팩터링이다. 외부에 노출되는 API 계약(경로, 요청 스키마, 응답 구조, HTTP 상태 코드, 에러 코드 및 메시지)은 변경되지 않으며, 테스트 코드도 변경된 의존성 구조에 맞게 일관되게 업데이트되었다. breaking change 없음, 하위 호환성 완전 유지.

## 위험도

NONE
