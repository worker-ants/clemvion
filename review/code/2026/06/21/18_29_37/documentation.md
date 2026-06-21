# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `emailChangeExpiresAt` 엔티티 필드에 JSDoc 누락
- 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` — `emailChangeExpiresAt` 컬럼 (라인 652–657 상당)
- 상세: `pendingEmail` 과 `emailChangeToken` 두 필드에는 JSDoc 이 있으나, `emailChangeExpiresAt` 에는 JSDoc 이 없다. 같은 그룹의 세 필드 중 하나만 주석이 없어 일관성이 깨진다.
- 제안: `pendingEmail` / `emailChangeToken` 와 동일한 수준으로 "이메일 변경 확인 토큰 만료 시각 (발급 + 1h, spec/5-system/1-auth.md §1.1.B). 확인/취소 시 NULL." 형태의 JSDoc 추가.

---

### [INFO] `isUniqueEmailViolation` 프라이빗 메서드에 주석 없음
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `isUniqueEmailViolation` (라인 272–276 상당)
- 상세: TypeORM PostgreSQL UNIQUE 위반 감지 로직(`code === '23505'`)은 DB 드라이버 의존적인 비자명 로직이다. 현재 인라인 설명이 없다. 동일 파일의 다른 복잡 로직(`clearPendingEmailChange`, `verifyEmailChange`)에는 주석이 있는 반면 이 헬퍼만 누락됐다.
- 제안: `// PostgreSQL UNIQUE violation code (23505). TypeORM may surface it as e.code or e.driverError.code.` 한 줄 추가.

---

### [INFO] `sendEmailChangedNotice` — console transport 로깅 분기 누락
- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `sendEmailChangedNotice` (라인 422 상당)
- 상세: `sendEmailChangeVerification` 는 `MAIL_TRANSPORT=console` 시 `this.logger.debug(verifyUrl)` 로 raw URL 을 출력하는 개발용 분기가 있다. `sendEmailChangedNotice` 에는 그 분기가 없다. `resetUrl` 은 고정 경로라 토큰이 아니므로 보안 위험은 없지만, 두 메서드의 일관성이 깨지고, 기존 JSDoc (`Raw token URL is only logged when MAIL_TRANSPORT=console (dev)`) 이 `sendEmailChangeVerification` 에만 해당됨이 명시되지 않아 독자가 두 메서드가 동일하게 동작한다고 오해할 여지가 있다.
- 제안: `sendEmailChangedNotice` JSDoc 에 "(console transport 로깅 없음 — resetUrl 은 토큰 아님)" 한 줄 추가하거나, 두 메서드의 JSDoc 에서 로깅 동작 차이를 명시.

---

### [INFO] 프론트엔드 `verify/page.tsx` 컴포넌트 레벨 JSDoc/주석 없음
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx` — `VerifyEmailChangeInner` 함수
- 상세: `ran.current` ref 로 React Strict Mode 이중 실행을 방어하는 패턴과, 토큰 부재를 effect 밖에서 파생하는 이유가 인라인 주석으로만 설명되어 있다. 이 컴포넌트는 URL 토큰을 1회성으로 소비하는 비자명 흐름이다. 다른 백엔드 파일들은 `/**` 블록 주석을 공개 함수에 일관적으로 사용하는 반면, 프론트엔드 컴포넌트에는 없다. 프로젝트 스타일상 리액트 컴포넌트에 JSDoc 을 강제하지 않으므로 INFO 수준.
- 제안: 기존 인라인 주석(`// 토큰은 1회성이라 ...`, `// verify 실패만 state 로 둔다`) 은 충분히 명확하므로 현행 유지 가능. 단, 컴포넌트 상단에 1행 목적 주석(`// Email-change verify landing: consumes the one-time token from the link and swaps the access token.`)을 추가하면 파악 속도가 개선된다.

---

### [INFO] `EmailChangeRequestBody` 인터페이스에 JSDoc 없음
- 위치: `codebase/frontend/src/lib/api/users.ts` — `EmailChangeRequestBody` 인터페이스 (라인 1575 상당)
- 상세: 같은 파일의 `UserProfile` 인터페이스는 `pendingEmail` 필드에 JSDoc 이 있다. `EmailChangeRequestBody` 는 public API 타입이나 클래스 수준 설명이 없다. 백엔드 `EmailChangeRequestDto` 에는 상세한 JSDoc 이 있어 대응 타입임을 알기 어렵다.
- 제안: `/** 이메일 변경 시작 API 요청 본문 (spec/5-system/1-auth.md §1.1.B). */` 1행 추가.

---

### [INFO] 사용자 가이드 문서(MDX)에 `verify` 페이지 URL 경로 직접 노출
- 위치: `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.en.mdx` 및 `.mdx` — "Changing your email address" 섹션
- 상세: 링크 확인 절차에서 "The link is only processed in your current logged-in session." 이라는 설명이 있으나, verify URL(`/profile/change-email/verify`) 자체는 문서에 링크로 노출되지 않아 사용자 탐색에 문제가 없다. 단, "Click the link in the confirmation email" 절차에서 세션 요구사항(이미 로그인된 세션에서만 처리됨)이 기능적으로 중요한 제약인데, 일반 사용자가 이를 충분히 인지하지 못할 수 있다. 현재 en.mdx 의 문구는 이를 명시하고 있어 양호하나, 한국어 mdx 의 대응 문장("확정은 현재 로그인된 세션에서만 처리돼요")도 동일하게 명시되어 있다. 특이사항 없음 — 이 항목은 주의 환기용 INFO.

---

### [INFO] `resendEmailChange` 와 `cancelEmailChange` API 함수에 빈 body `{}` 전달
- 위치: `codebase/frontend/src/lib/api/users.ts` — `resendEmailChange`, `cancelEmailChange` (라인 1594–1603 상당)
- 상세: 빈 body `{}` 를 POST 로 전송하는 이유(일부 HTTP 클라이언트가 body-less POST 를 다르게 처리함)가 주석으로 설명되지 않는다. 향후 유지보수자가 `{}` 를 제거하려 할 수 있다.
- 제안: `// body 없이 POST 하면 일부 클라이언트가 Content-Type 을 생략함 — 빈 객체 유지` 주석 한 줄 추가.

---

### [INFO] `plan/in-progress/impl-email-change.md` 변경 이력 문서
- 위치: `plan/in-progress/impl-email-change.md`
- 상세: 문서화 관점에서 plan 파일 자체는 잘 구조화되어 있고 체크리스트와 설계 메모가 명확하다. `## 설계 변경 노트` 에서 WebAuthn narrow 결정과 spec status sync 가 기록되어 있어 변경 이력이 적절히 남겨져 있다. CHANGELOG 는 이 프로젝트에서 별도 관리되지 않는 것으로 보이며, plan/spec 파일이 그 역할을 대체한다. 특이사항 없음.

---

## 요약

이번 변경셋은 전체적으로 문서화 품질이 높다. 백엔드 공개 메서드(`requestEmailChange`, `verifyEmailChange`, `resendEmailChange`, `cancelEmailChange`, `reauthenticate`, `emailTakenByOther`)에는 JSDoc 이 일관되게 작성되어 있고, API 엔드포인트에는 Swagger `@ApiOperation` 과 응답 데코레이터가 충실히 적용되었다. SQL 마이그레이션 파일에는 헤더 주석과 DB `COMMENT ON COLUMN` 이 함께 제공되어 schema-level 문서화가 완결적이다. 사용자 가이드(MDX 한국어·영어)가 신기능과 함께 추가되었고, i18n 사전도 양 언어 동시 갱신됐다. 주요 미흡 사항은 세 가지 소규모 누락(엔티티 `emailChangeExpiresAt` JSDoc, `isUniqueEmailViolation` 설명 주석, 두 메일 함수 간 console-transport 로깅 일관성)으로 모두 INFO 수준이며 차단 요소가 없다.

## 위험도

LOW

STATUS: SUCCESS
