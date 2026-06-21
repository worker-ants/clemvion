-- V101: user.email 의 LOWER() 표현식 인덱스 추가.
-- (ai-review 2026-06-21 W1 후속 — plan/in-progress/email-change-followup-email-lower-index.md)
--
-- 이메일 변경 흐름(spec/5-system/1-auth.md §1.1.B)의 대소문자 무시 중복 검사
-- `UsersService.emailTakenByOther` 가 `WHERE LOWER(u.email) = LOWER(:email)` 로 조회한다.
-- `user.email` 의 기존 UNIQUE B-tree 인덱스는 case-sensitive 라 LOWER() 표현식 조회에
-- 활용되지 못해 대용량 테이블에서 seq scan 이 가능하다. 함수 기반 인덱스로 가속한다.
--
-- non-unique 로 둔다: 기존 case-sensitive UNIQUE 제약(email)은 그대로 두고 LOWER() 조회만
-- 가속한다. UNIQUE 함수 인덱스는 기존에 case-variant 중복 이메일이 있으면 생성 실패하고
-- 대소문자 무시 유일성이라는 새 제약을 도입하게 되므로 의도(조회 가속)와 무관하다.
--
-- IF NOT EXISTS — 재실행 안전.
CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email));

-- DOWN:
-- DROP INDEX IF EXISTS idx_user_email_lower;
