# 성능(Performance) 리뷰 결과

대상: 이메일 변경 프로세스 구현 (spec/5-system/1-auth.md §1.1.B)
검토일: 2026-06-21

---

## 발견사항

### [INFO] `verifyEmailChange` 내 `findById` 이중 호출
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` 메서드
- 상세: `verifyEmailChange` 는 메서드 진입 시 `usersService.findById(userId)` 를 한 번 호출해 토큰 검증과 `oldEmail` 확보에 사용하고, 이메일 교체 후 `revokeAllFamilies` 가 완료된 다음 `usersService.findById(userId)` 를 다시 호출해 `updated` 엔티티를 얻어 `generateTokens` 에 넘긴다. 두 번째 조회는 `email` 필드 갱신 결과를 반영한 엔티티를 얻기 위한 것인데, 직전 `usersService.update(userId, { email: newEmail, ... })` 가 반환값(갱신된 엔티티)을 버리기 때문에 두 번 읽어야 하는 구조가 됐다. `update` 가 갱신 후 엔티티를 반환하도록 변경하거나, TypeORM `save` / `findOneAndUpdate` 패턴을 사용하면 DB round-trip 을 1회 줄일 수 있다.
- 제안: `UsersService.update` 가 갱신된 엔티티를 반환하도록 시그니처를 확장하거나(`return this.userRepository.save(...)` 결과 반환), 두 번째 `findById` 호출 대신 첫 번째 조회 결과(`user`)를 복사해 변경 필드만 덮어쓰는 in-memory 패치(`{ ...user, email: newEmail, emailVerified: true, pendingEmail: null, ... }`) 를 활용한다. 이 흐름은 비밀번호 변경 경로(`rotateSessionAfterPasswordChange`)에도 동일한 패턴이 있으므로, 프로젝트 차원의 `update-and-return` 유틸 도입을 고려할 만하다.

---

### [INFO] `requestEmailChange` 내 직렬 DB/서비스 호출 순서 — 병렬화 기회 없음(정상)
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` 메서드
- 상세: `reauthenticate` → `findById` → `emailTakenByOther` → `update` → `sendEmailChangeVerification` 순으로 모두 직렬 실행한다. 각 단계가 이전 단계 결과에 의존하므로 직렬이 올바르다. 성능 이슈 없음.
- 제안: 현행 구조 유지.

---

### [INFO] `emailTakenByOther` — LOWER() 함수 인덱스 미사용 가능성
- 위치: `codebase/backend/src/modules/users/users.service.ts` — `emailTakenByOther` 메서드
- 상세: `LOWER(u.email) = LOWER(:email)` 조건은 컬럼에 함수식 인덱스(`CREATE INDEX ON "user" (LOWER(email))`)가 없다면 풀스캔을 유발한다. 이메일 변경 요청은 저빈도이므로 실제 TPS 영향은 미미하지만, 기존 `emailExists` 메서드도 동일 패턴(`LOWER`)을 사용한다고 가정하면 해당 인덱스가 이미 존재하거나 존재하지 않는 상황이 동일하게 적용된다. `V100` 마이그레이션에 함수식 인덱스가 포함되지 않았으므로, 기존 인덱스 상황을 확인하고 없다면 추가를 검토할 것.
- 제안: 마이그레이션 파일(또는 별도 마이그레이션)에 `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email));` 추가 검토. 단 저빈도 관리 API 이므로 즉각 조치 우선도는 낮다.

---

### [INFO] HTML 이메일 템플릿 — 매 호출마다 문자열 생성
- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `buildEmailChangeVerificationHtml`, `buildEmailChangedNoticeHtml`
- 상세: HTML 이메일 본문을 템플릿 리터럴로 즉시 빌드한다. 개인화 변수(name, email, URL)가 포함돼 있어 요청별로 매번 생성해야 하므로 전역 캐싱은 불가하다. 문자열 길이는 수백 바이트 수준이며 이메일 발송은 저빈도이다. 연산 비용은 무시 가능 수준.
- 제안: 현행 구조 유지. 향후 이메일 템플릿 수가 증가한다면 Handlebars / Nunjucks 같은 컴파일된 템플릿 엔진으로 전환해 템플릿 파싱 오버헤드를 1회로 줄일 수 있다(현재 문제 없음).

---

### [INFO] `verifyEmailChange` — race condition 처리 시 추가 DB 쓰기
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` (UNIQUE 위반 catch 블록)
- 상세: UNIQUE 제약 위반(`23505`) 감지 후 `clearPendingEmailChange` 를 추가로 호출한다. 이는 예외 경로이므로 정상 동작 TPS 에 영향 없음. race condition 자체가 극히 드문 케이스이므로 성능 관점 이슈 없음.
- 제안: 현행 구조 유지.

---

### [INFO] 프론트엔드 verify 페이지 — `useEffect` 단발 API 호출 패턴
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx` — `VerifyEmailChangeInner`
- 상세: `useRef(false)` 로 Strict Mode 이중 실행을 방지하는 패턴은 올바르다. 불필요한 중복 호출 없음. 단일 POST 요청이며 React Query 를 사용하지 않으므로 캐싱 레이어가 없지만, 1회성 토큰 소비 흐름에서는 오히려 캐싱이 부적절하다.
- 제안: 현행 구조 유지.

---

### [INFO] `reauthenticate` — `findById` 조회 후 `verifyReauth` 내 추가 조회 여부 확인
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts` — `reauthenticate`
- 상세: `reauthenticate` 는 `findById` 로 user 를 조회한 뒤 `verifyReauth(user, auth)` 에 넘긴다. `verifyReauth` 내부가 user 객체를 그대로 받아 사용한다면 추가 DB 조회가 없어 적절하다. `requestEmailChange` 가 `reauthenticate` 반환 후 다시 `findById` 를 호출하므로 총 2회 조회가 발생한다. 두 조회 간 지연이 무시 가능한 인증 흐름이지만, `reauthenticate` 가 user 객체를 반환하도록 시그니처를 변경하면(`Promise<User>`) `requestEmailChange` 의 `findById` 를 제거할 수 있다.
- 제안: 성능 민감 경로라면 `reauthenticate` 를 `Promise<User>` 반환으로 변경해 `requestEmailChange` 의 두 번째 `findById` 를 제거. 저빈도 흐름이므로 즉각 조치 우선도는 낮다.

---

## 요약

이번 변경은 이메일 변경 프로세스(request → verify → resend/cancel) 를 신규 추가하는 기능 구현이다. 알고리즘 복잡도는 O(1) 조회·갱신 패턴으로 문제없고, N+1 쿼리·대규모 메모리 할당·블로킹 I/O·잘못된 자료구조 사용 등 명확한 성능 결함은 없다. 주요 관찰 사항은 `verifyEmailChange` 내 `findById` 이중 호출(DB round-trip 1회 추가)과 `requestEmailChange` 에서 `reauthenticate` 완료 후 재조회로 총 2회 `findById` 가 발생하는 구조인데, 두 가지 모두 저빈도 관리 API 경로이고 정확성을 위한 의도적 설계 선택으로도 볼 수 있어 즉각적인 성능 위험은 없다. `LOWER(email)` 함수식 인덱스 부재 가능성도 저빈도 관리 API 특성상 실질 영향이 미미하다. 전반적으로 성능 관점의 차단 사유는 없다.

## 위험도

LOW

---

STATUS: SUCCESS
