# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] e2e 테스트 파일 내 `seedPendingEmailChange` 헬퍼 추출 — 범위 내 리팩토링
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: 기존 3개 테스트의 인라인 `db.query(UPDATE "user" ...)` 블록을 `seedPendingEmailChange()` 헬퍼로 추출하면서 기존 케이스의 코드가 함께 변경됐다. 이는 직전 ai-review(21_27_56)의 W3 "DB seed UPDATE 4회 중복" 권고에 대한 명시적 fix이며 RESOLUTION.md에 기재돼 있다. 신규 기능 추가가 아닌 기존 코드의 중복 제거이므로 이 변경의 의도(ai-review W3 follow-up) 범위 안에 있다.
- 제안: 없음.

### [INFO] `profile-info-card.test.tsx` `renderCard` 타입 확장 — 범위 내
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx` L529–534
- 상세: `renderCard` 헬퍼에 `pendingEmail?: string | null` 옵셔널 필드를 추가한 것은 새로 추가되는 `pendingEmail` 표시 테스트 케이스를 지원하기 위한 최소 변경이다. 기존 시그니처 파괴 없이 옵셔널로 확장했고, 변경 의도(pendingEmail 표시 단위 테스트 추가)와 직결된다.
- 제안: 없음.

### [INFO] plan/complete/ 문서 3건 신규 추가 — 범위 내
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/plan/complete/email-change-followup-email-lower-index.md`, `impl-email-change.md`, `spec-draft-email-change.md`
- 상세: 이 문서들은 이메일 변경 구현 완료 기록 및 V101 follow-up 추적을 위한 plan 파일이다. CLAUDE.md 규약상 `plan/complete/` 는 완료 작업의 정식 저장소이며 developer 쓰기 권한 범위(`plan/**`)에 속한다. 이번 후속 작업(email-change-followup)의 의도에 직접 연결된다.
- 제안: 없음.

### [INFO] review/ 산출물 파일 다수 포함 — 범위 내
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/review/code/2026/06/21/21_27_56/` 하위 전체 (SUMMARY.md, RESOLUTION.md, api_contract.md, database.md, documentation.md, maintainability.md, _retry_state.json 등)
- 상세: ai-review 21_27_56 세션의 산출물이다. CLAUDE.md 규약상 코드 리뷰 산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`에 보관하며 gitignored가 아니므로 커밋에 포함된다. RESOLUTION.md에 따르면 W1·W2·W3·INFO 10~12 fix의 근거와 결과가 기록돼 있다. 이 변경의 의도(fresh ai-review 후속 fix 결과 커밋)와 일치한다.
- 제안: 없음.

## 요약

이번 변경의 의도는 직전 ai-review(21_27_56)에서 제기된 W1(resend e2e 만료 시각 단언 누락)·W2(resend 메일 실패 시 롤백 미검증 테스트 부재)·W3(e2e DB seed 중복) 및 INFO 10~12(JSDoc 갱신·spec data-flow SMTP 행·plan 체크박스)에 대한 fix이며, V101 LOWER() 인덱스 마이그레이션과 신규 테스트(resend·race e2e, VerifyEmailChangePage 단위 테스트, profile-info-card pendingEmail 단위 테스트)를 추가하는 것이다. 변경된 모든 파일(마이그레이션 SQL, 테스트 파일 3개, plan 문서 3개, review 산출물)은 이 의도에 직접 연결되며, 의도와 무관한 파일 변경, 불필요한 리팩토링, 무관한 기능 추가, 포맷팅만의 변경, 미사용 임포트 추가·삭제, 의도치 않은 설정 파일 변경은 발견되지 않았다. `seedPendingEmailChange` 헬퍼 추출은 W3 follow-up의 명시적 범위이며 기존 기능 케이스를 수반하므로 over-engineering이 아니다.

## 위험도

NONE
