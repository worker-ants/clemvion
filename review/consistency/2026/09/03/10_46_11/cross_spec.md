# Cross-Spec 일관성 검토 — `spec/5-system/` (change-password 실패 코드 정렬)

## 검토 범위

- target 델타: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`
- 구현: `PASSWORD_VERIFY_CODES`(`codebase/backend/src/common/utils/password.util.ts`)를
  `AuthService.verifyPasswordForUser`·`SessionsService.verifyReauth`·
  `UsersService.changePassword` 세 발행처가 공유하도록 정렬, `INVALID_PASSWORD` wire 코드 은퇴.
- 대조: `spec/conventions/error-codes.md`(§3/§5), `spec/1-data-model.md`(§2.18.2 `login_history`),
  `spec/2-navigation/9-user-profile.md`(§5/§6.1 API 표), `spec/data-flow/2-auth.md`(시퀀스 다이어그램),
  코드베이스 3개 발행처(`password.util.ts`/`auth.service.ts`/`sessions.service.ts`/`users.service.ts`).

## 발견사항

없음 — 아래 교차 지점을 모두 실측했고 전부 정합했다.

1. **wire 코드 카탈로그 (`3-error-handling.md` §1.2 vs §1.2.1)**: 은퇴된 `INVALID_PASSWORD` 행이
   §1.2 표에서 완전히 제거됐고(라인 47~49 사이 부재 확인), 신규 3-way 분기(`PASSWORD_REQUIRED`·
   `PASSWORD_INVALID`·`REAUTH_REQUIRED`)는 §1.2.1 에 형제 흐름과 함께 정확히 등재돼 있다.
2. **conventions/error-codes.md §5 Rename 이력**: `INVALID_PASSWORD → PASSWORD_REQUIRED/PASSWORD_INVALID`
   (2026-09-02, 등급 B)가 그대로 등재돼 target 의 서술(§1.2.1 note, `1-auth.md` §2.3 note)과 근거·
   등급·날짜가 일치한다. §3 historical-artifact 레지스트리에는 `INVALID_PASSWORD` 잔존 참조가 없다
   (은퇴 코드는 §5 전용, §3 과 목적 레이어가 분리돼 있다는 원칙과 정합).
3. **`login_history.failure_reason` 감사값 (레이어 분리)**: `spec/1-data-model.md:710`,
   `spec/data-flow/2-auth.md:76` 둘 다 `INVALID_PASSWORD` 를 **로그인 실패**(`AuthService.login`)
   감사값으로 계속 사용 — target 이 명시한 "wire 은퇴 vs 감사값 존속" 구분과 모순 없음(다른 도메인·
   다른 레이어이므로 요구사항 ID/코드 재사용 충돌 아님).
4. **`spec/2-navigation/9-user-profile.md`**: §5.4/§6.3(엔드포인트 표)·§2.2(보안 설정 표)·§3(sub-route
   진입) 모두 새 코드(`PASSWORD_REQUIRED`)와 §1.1.A 안내 경로를 가리키며 `1-auth.md` 와 SoT 포인터가
   양방향으로 일치한다.
5. **코드베이스 정합 (참고용, impl-done 보조 확인)**: `password.util.ts` 의 `PASSWORD_VERIFY_CODES`
   가 `auth.service.ts`(L75/82)·`sessions.service.ts`(L270)·`users.service.ts`(L291/300) 세 곳
   모두에서 동일 상수로 소비되며 spec 의 "세 발행처 공유" 서술과 일치. 헬퍼 함수 자체를 공유하지
   않는 이유(`UsersService`↔`AuthService` 순환 의존)도 spec Rationale 과 코드 주석이 동형.
6. **API 계약**: `POST /users/me/change-password` 의 endpoint·method·응답 shape(`{ accessToken }` +
   refresh 쿠키 회전)은 변경되지 않았다 — 이번 변경은 실패 코드 분기뿐이라 계약 충돌 대상 자체가 없다.

## 요약

target 은 이미 여러 라운드의 `--spec`/`--impl-prep`/`--impl-done`·`/ai-review` 를 거쳐 반영된
변경(#1268 후속, 사용자 결정 2026-09-02)이며, 본 재검토에서도 데이터 모델·API 계약·요구사항 ID·
상태 전이·RBAC·계층 책임 6개 관점 전부에서 `spec/**` 타 영역과의 직접 모순이나 잠재 충돌을 찾지
못했다. `INVALID_PASSWORD` 의 "wire 은퇴 vs 감사값 존속" 이라는 레이어 분리가 유일하게 헷갈릴 수
있는 지점이었으나, `error-codes.md §5`·`1-data-model.md`·`data-flow/2-auth.md` 세 곳이 일관되게
그 구분을 반영하고 있어 오탐 소지가 없다.

## 위험도

NONE
