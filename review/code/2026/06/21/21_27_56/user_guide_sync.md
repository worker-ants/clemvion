# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음 — 본 변경 set 의 어떤 파일도 doc-sync-matrix.json 의 trigger 에 매칭되지 않습니다.

**매칭 판정 근거 (파일별):**

1. `codebase/backend/migrations/V101__add_user_email_lower_index.sql`
   - 새 함수 기반 인덱스 추가. 노드(`codebase/backend/src/nodes/**`) 아님, 인증 소스(`codebase/backend/src/modules/auth/**`) 아님, 표현식 엔진(`codebase/packages/expression-engine/**`) 아님.
   - error-codes.ts 변경 없음, warningRules 변경 없음, UI 문자열 변경 없음.
   - 어떤 glob/semantic trigger 에도 매칭 안 됨.

2. `codebase/backend/test/users-email-change.e2e-spec.ts`
   - e2e 테스트 파일. 신규 케이스(resend, race-condition) 추가.
   - 프로덕션 소스 경로 아님 — trigger glob 중 어디에도 해당 없음.

3. `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx`
   - 신규 단위 테스트 파일 (`__tests__/` 하위). 프로덕션 TSX 컴포넌트 아님.
   - `new-ui-string` trigger (semantic) 는 TSX 컴포넌트의 신규 i18n 키 등록 누락을 검출하는 것이며 테스트 파일 자체가 새 UI 문자열을 추가하지는 않음.
   - 테스트 내 `"유효하지 않은 링크"` 는 기존 dict 키에 대한 assertion — 신규 등록 대상 아님.

4. `codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx`
   - 기존 단위 테스트 수정. `pendingEmail` prop 추가·관련 케이스 3건 추가.
   - `__tests__/` 하위 테스트 파일, 프로덕션 컴포넌트 경로 아님.
   - 추가된 테스트 케이스들은 기존 dict 키(`"유효하지 않은 링크"` 류)에 대한 검증이며 신규 i18n 키를 도입하지 않음.

5. `plan/complete/email-change-followup-email-lower-index.md`, `plan/complete/impl-email-change.md`, `plan/complete/spec-draft-email-change.md`
   - plan 완료 파일 이동. doc-sync-matrix 의 어떤 trigger 에도 해당 없음.

6. `spec/data-flow/2-auth.md`
   - `spec-major-change` trigger glob: `spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**`.
   - 이 파일의 경로는 `spec/data-flow/2-auth.md` — `spec/data-flow/` 하위이며 `spec/2-*/` 패턴과 **매칭되지 않음**.
   - spec-major-change trigger 에 해당 없음.

## 요약

doc-sync-matrix.json (총 18개 rows, 17개 고유 id)를 적재하여 8개 변경 파일 전체를 매칭한 결과, 어떤 trigger 에도 매칭되는 파일 없음. 변경 내용은 (a) DB 표현식 인덱스 migration, (b) 기존 이메일 변경 흐름의 e2e 테스트 보강, (c) 프론트엔드 단위 테스트 추가/수정, (d) plan 완료 파일 이동, (e) `spec/data-flow/` 하위 spec 보강으로 구성되며, 유저 가이드 MDX·i18n dict·backend-labels 동반 갱신 대상에 해당하지 않음. 매칭 0건, 누락 0건.

## 위험도

NONE
