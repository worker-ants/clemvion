# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] resolution-applier 적용 변경 — 모두 이전 리뷰(18_29_37) SUMMARY/RESOLUTION 항목 직접 대응
- 위치: 파일 1~14 전체
- 상세: 이번 변경셋은 `review/code/2026/06/21/18_29_37/RESOLUTION.md` 에 기록된 W1~W10, INFO#2/#10/#17/#18/#20/#21 항목의 resolution-applier 적용 결과다. 각 파일 변경이 RESOLUTION 테이블의 commit 71fd0f02 로 추적된 항목과 1:1 대응한다. 범위 이탈 없음.

---

### [INFO] `auth.service.ts` — Logger 추가, EMAIL_CHANGE_TTL_MS 상수 추출, 주석 보강 — 범위 내
- 위치: `codebase/backend/src/modules/auth/auth.service.ts`
- 상세:
  - `Logger` 임포트 및 `this.logger` 인스턴스: W7 해소 (sendEmailChangedNotice 실패 시 warn 로그 가시화)에 필요한 최소 추가. 기존 코드 수정 없음.
  - `EMAIL_CHANGE_TTL_MS` 상수: INFO#10 (하드코딩 1h TTL 두 곳 중복) 해소. `requestEmailChange` 와 `resendEmailChange` 두 곳에서 기존 `60 * 60 * 1000` 리터럴을 대체함. 동작 변경 없음.
  - TOCTOU 주석 (W8), rollback 주석 (W6/W9), generateTokens 실패 주석 (W10), 23505 PostgreSQL 주석 (INFO#18): 모두 RESOLUTION 에 기록된 항목 그대로. 코드 동작 변경 없음.
  - `sendEmailChangedNotice` catch 블록에 `logger.warn` 추가 (W7): RESOLUTION 직접 대응.
  - `requestEmailChange` 메일 실패 시 `clearPendingEmailChange` 롤백 추가 (W6/W9): RESOLUTION 직접 대응. 해당 메서드는 이미 클래스 내 존재하는 `private` 메서드.
- 제안: 없음.

---

### [INFO] `sessions.service.spec.ts` — `reauthenticate` 테스트 3건 추가 — 범위 내
- 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts`
- 상세: W2 해소를 위한 테스트 추가. 신규 describe 블록 1개, it 블록 3개. 기존 테스트 수정 없음. 기존 describe 블록 순서 변경 없음.
- 제안: 없음.

---

### [INFO] `mail.service.spec.ts` — 신규 2개 메서드 테스트 추가 — 범위 내
- 위치: `codebase/backend/src/modules/mail/mail.service.spec.ts`
- 상세: W4 해소. `sendEmailChangeVerification` 3건, `sendEmailChangedNotice` 4건. 기존 테스트 수정 없음.
- 제안: 없음.

---

### [INFO] `email-change-verify.dto.ts` — `@MaxLength(128)` 추가 — 범위 내
- 위치: `codebase/backend/src/modules/users/dto/email-change-verify.dto.ts`
- 상세: INFO#2 해소. `MaxLength` 임포트 1개 추가, `@MaxLength(128)` 데코레이터 1개 추가. 기존 코드 수정 없음.
- 제안: 없음.

---

### [INFO] `user.entity.ts` — `emailChangeExpiresAt` JSDoc 추가 — 범위 내
- 위치: `codebase/backend/src/modules/users/entities/user.entity.ts`
- 상세: INFO#17 해소. 기존 컬럼 데코레이터 앞에 JSDoc 블록 추가. 컬럼 정의 자체 변경 없음.
- 제안: 없음.

---

### [INFO] `users.controller.ts` — Swagger 데코레이터 수정 2건 — 범위 내
- 위치: `codebase/backend/src/modules/users/users.controller.ts`
- 상세: INFO#20 (`verifyEmailChange` ApiUnauthorizedResponse 설명 명확화), INFO#21 (`requestEmailChange` `@ApiForbiddenResponse` 추가). `ApiForbiddenResponse` 임포트 추가. 컨트롤러 로직 변경 없음.
- 제안: 없음.

---

### [INFO] `users.service.spec.ts` — `emailTakenByOther` 테스트 추가 — 범위 내
- 위치: `codebase/backend/src/modules/users/users.service.spec.ts`
- 상세: W3 해소. `makeQb` 헬퍼 함수와 `createQueryBuilder` mock 추가, `emailTakenByOther` describe 블록 3건. 기존 테스트 수정 없음. 기존 `repo` mock 타입에 `createQueryBuilder` 필드 추가 — 기존 동작에 영향을 주지 않는 추가.
- 제안: 없음.

---

### [INFO] `plan/in-progress/spec-draft-email-change.md` — 체크박스 갱신 — 범위 내
- 위치: `plan/in-progress/spec-draft-email-change.md`
- 상세: 항목 5 체크박스 `[ ]` → `[x]` 갱신 및 설명 업데이트. consistency-check (18_58_39) INFO#6 에서 "실제 상태 반영 필요" 로 지적된 항목의 직접 해소. plan 파일 수정으로 plan-lifecycle 규약 준수.
- 제안: 없음.

---

### [INFO] `review/code/2026/06/21/18_29_37/` 산출물 파일들 (RESOLUTION.md, SUMMARY.md, _resolution_log.md, _resolution_state.json, _retry_state.json, 각 리뷰어 결과 .md) — 범위 내
- 위치: `review/code/2026/06/21/18_29_37/` 하위 전체
- 상세: CLAUDE.md 및 MEMORY "plan 체크박스 = 실제 상태" 규약에 따라 review/ 산출물은 커밋 대상이다. `_retry_state.json` 포함은 이전 리뷰(18_29_37/scope.md)에서도 "프로젝트 규약에 따라 허용" 으로 명시 확인됨. 모든 파일이 18_29_37 세션 산출물로 동일 기능 PR의 리뷰 워크플로 결과물이다.
- 제안: 없음.

---

### [INFO] `review/consistency/2026/06/21/18_58_39/` 산출물 파일들 — 범위 내
- 위치: `review/consistency/2026/06/21/18_58_39/` 하위 전체
- 상세: 구현 완료 후 `--impl-done` consistency-check 세션 산출물. 동일 PR 의 품질 검증 단계 결과물로 범위 내.
- 제안: 없음.

---

### [INFO] `spec/2-navigation/9-user-profile.md` / `spec/5-system/1-auth.md` 소폭 수정 — 범위 내
- 위치: `spec/2-navigation/9-user-profile.md` L626, `spec/5-system/1-auth.md` L651
- 상세:
  - `9-user-profile.md`: consistency-check WARNING 1 ("등록 2FA" → "등록 TOTP + WebAuthn 미지원 명시") 해소. 단일 행 문구 수정.
  - `1-auth.md §1.1.B-6 Rationale`: convention_compliance INFO#4 해소 ("§4.1.A 가 예고한" → "§4.1.A 및 audit-actions.md 의 확정 규약"). 단일 문장 수정.
  - 두 수정 모두 RESOLUTION/consistency-check 산출물에서 추적된 항목으로 범위 내.
- 제안: 없음.

---

### [INFO] `auth.service.spec.ts` — diff omitted (파일 1)
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts`
- 상세: 프롬프트에서 "diff omitted due to prompt size limit" 로 생략됨. W1 해소를 위한 AuthService 4개 메서드(`requestEmailChange`, `verifyEmailChange`, `resendEmailChange`, `cancelEmailChange`) 단위 테스트 추가가 RESOLUTION 에 기록돼 있다. 기존 spec 패턴을 따른 테스트 추가이므로 범위 이탈 가능성이 낮으나, 실제 diff 확인 불가로 이 항목은 직접 검증 생략.
- 제안: 파일 크기 제한으로 검토 불가. RESOLUTION commit 71fd0f02 와 일치하는 것으로 추정.

---

## 요약

이번 변경셋은 `review/code/2026/06/21/18_29_37/RESOLUTION.md` 에 기록된 W1~W10 및 선택적 INFO 항목들의 resolution-applier 적용 결과로, 변경 범위 관점에서 매우 집중도가 높다. 코드 변경(테스트 추가, 주석/로그/롤백 보강, Swagger 데코레이터 수정, 상수 추출, DTO MaxLength 추가)이 모두 이전 리뷰 RESOLUTION 항목과 1:1 대응하며, 관련 없는 리팩토링이나 기능 확장은 발견되지 않는다. spec 파일 2개의 소폭 수정도 consistency-check WARNING 해소를 위한 직접 적용이다. `review/` 산출물 파일들의 커밋 포함은 프로젝트 규약에 따른 정상 범위다. `_retry_state.json` 커밋은 이전 리뷰에서도 동일하게 허용 판정됐다.

## 위험도

NONE

STATUS=success ISSUES=0 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/scope.md RESET_HINT=
