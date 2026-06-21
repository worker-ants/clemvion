# Documentation Review

## 발견사항

### [INFO] V101 마이그레이션 SQL — 문서화 수준 양호, 소규모 보완 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/migrations/V101__add_user_email_lower_index.sql`
- 상세: 마이그레이션 파일 자체에 목적(LOWER() 표현식 인덱스), 근거(seq scan 방지), non-unique 선택 이유, IF NOT EXISTS 재실행 안전성, DOWN 스크립트까지 충분히 문서화돼 있다. plan 파일(`plan/complete/email-change-followup-email-lower-index.md`)과 spec/data-flow/2-auth.md Schema 매핑 표에도 V101 인덱스가 반영됐다.
- 제안: 현재 상태로 충분. 추가 작업 불필요.

### [INFO] e2e 테스트 파일 — 모듈 수준 JSDoc 의 커버리지 갭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/test/users-email-change.e2e-spec.ts` 파일 상단 JSDoc (L189–199)
- 상세: 파일 상단 JSDoc이 기존 테스트(request·verify·cancel)는 열거하고 있으나, 이번 변경에서 추가된 3개 케이스(`resend → 토큰 갱신`, `resend without pending → 400`, `verify 시점 선점 → 409 + pending 정리`)가 "검증 대상" 목록에 반영되지 않았다. 테스트 동작을 이해하려는 독자에게 약간의 혼선을 줄 수 있다.
- 제안: JSDoc 내 "검증 대상" 불릿에 세 케이스를 추가하면 완전해진다.
  ```ts
  // 추가:
  //   - resend: 토큰 재발급(pending 유지, 토큰 변경), pending 없으면 400 VALIDATION_ERROR
  //   - verify race: 신규 이메일 선점 시 409 + pending 정리
  ```

### [INFO] 프론트엔드 단위 테스트 파일 — 모듈 수준 주석 없음 (저위험)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx`
- 상세: 신규 테스트 파일 전체가 모듈 수준 설명 없이 시작된다. 다른 e2e/단위 테스트 파일들이 JSDoc 또는 상단 주석으로 "무엇을 검증하는지" 를 밝히는 관례와 일치하지 않는다. 파일명과 describe 블록이 충분히 설명적이므로 기능에 영향은 없다.
- 제안: 파일 상단에 1~2줄 JSDoc을 추가하면 관례와 일치한다.
  ```ts
  /**
   * VerifyEmailChangePage 단위 테스트.
   * URL 토큰 수신 → verify API 호출 → access token 교체 → /profile 리다이렉트 흐름을 검증한다.
   * spec/5-system/1-auth.md §1.1.B / spec/2-navigation/9-user-profile.md §6.1
   */
  ```

### [INFO] profile-info-card 테스트 — renderCard 함수 시그니처 변경, JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx` L692–698
- 상세: `renderCard` 헬퍼의 파라미터 타입에 `pendingEmail?: string | null`이 추가됐다. 내부 유틸 함수라 JSDoc 요구 수준은 낮으나, `pendingEmail`의 의미(확인 대기 중 신규 이메일)를 짧게 주석으로 달면 이후 테스트 케이스 추가 시 혼동을 줄인다. 기존 테스트 케이스들에 비해 신규 케이스 3개는 it 설명이 충분히 한국어로 명확해 별도 조치 불필요.
- 제안: 선택적 개선. 필수 아님.

### [INFO] spec/data-flow/2-auth.md §2.3 외부 Sink 표 — 이메일 변경 메일 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/spec/data-flow/2-auth.md` §2.3 외부 표
- 상세: §1.7.1 에는 이메일 변경 흐름이 새로 추가됐으나, §2.3 외부 Sink 표의 SMTP 행 설명(`이메일 인증·비밀번호 reset·초대 메일`)에 "이메일 변경 확인·통지 메일"이 열거되지 않았다. 다른 이메일 흐름들은 이 표에 포함돼 있어 일관성 차이가 있다.
- 제안: SMTP 행을 아래처럼 갱신하면 완전해진다.
  ```
  이메일 인증·비밀번호 reset·초대 메일·이메일 변경 확인(신규 주소)·변경 통지(옛 주소)
  ```

### [INFO] plan/complete/email-change-followup-email-lower-index.md — "할 일" 체크박스 미완료 상태
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/plan/complete/email-change-followup-email-lower-index.md` §할 일
- 상세: plan 파일의 status frontmatter는 `complete`인데 "할 일" 섹션의 항목들이 체크박스 형식이 아닌 일반 불릿으로 작성돼 있어 완료 여부가 명시적으로 표시되지 않는다. `impl-email-change.md`와 같이 `- [x]` 형식으로 체크돼야 plan lifecycle 규약과 일치한다.
- 제안: 마이그레이션 추가가 완료됐으므로 `- [x]` 체크박스로 변환 권장.

## 요약

이번 변경 세트(V101 인덱스 마이그레이션, e2e 테스트 보강, 프론트엔드 단위 테스트 추가, plan 파일 정리, spec/data-flow 동기화)의 문서화 수준은 전반적으로 양호하다. 핵심 공개 API인 `UsersController`의 4개 email-change 엔드포인트는 Swagger `@ApiOperation`·`@ApiOkWrappedResponse`·에러 응답 데코레이터가 모두 갖춰져 있고, `AuthService`의 신규 메서드 4개와 `SessionsService.reauthenticate`, `UsersService.emailTakenByOther`, `MailService`의 신규 메서드 2개, `User` 엔티티의 신규 컬럼 3개 모두 JSDoc이 작성돼 있다. 사용자 가이드 문서(password-and-sessions.{mdx,en.mdx})도 한국어·영어 양쪽에 이메일 변경 흐름 섹션이 추가됐다. spec/data-flow/2-auth.md에 §1.7.1과 Schema 매핑 행이 동기화됐다. 발견된 항목들은 모두 INFO 수준이며(누락 내용이 실제 테스트 파일의 JSDoc 갱신 누락, §2.3 외부 Sink 표의 부분적 미반영, plan 체크박스 표기 불일치)로 기능·보안·API 계약에 영향을 주지 않는다.

## 위험도

NONE
