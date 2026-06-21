---
worktree: (unassigned)
started: 2026-06-21
owner: developer
parent: plan/in-progress/impl-email-change.md
---

# follow-up — user.email LOWER() 표현식 인덱스

> 출처: ai-review 2026-06-21 20_21_02 W1 (database). 비차단 보류 항목.

## 배경
`UsersService.emailTakenByOther` 가 대소문자 무시 중복 검사를 `WHERE LOWER(u.email) = LOWER(:email)` 로 수행한다(이메일 변경 §1.1.B). `user.email` 의 기존 UNIQUE B-tree 인덱스는 case-sensitive 라 `LOWER()` 표현식 쿼리에 활용되지 못해 대용량 테이블에서 seq scan 이 가능하다.

## 왜 본 PR 에서 보류했나
- 호출 경로가 **저빈도**다 — 이메일 변경 request/verify 에서만 호출(회원가입 `emailExists` 는 exact match 라 기존 UNIQUE 인덱스 사용). 사용자당 거의 발생하지 않는 동작.
- 인덱스 추가는 독립적 micro-optimization 이라 기능 정확성과 무관. 본 PR 의 코드 재변경(→ ai-review 재실행 루프)을 피하기 위해 분리.

## 할 일
- 마이그레이션 `V101__add_user_email_lower_index.sql`:
  `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email));`
  (non-unique — 기존 case-sensitive UNIQUE 제약과 의미 충돌 없이 LOWER() 조회만 가속. UNIQUE 표현식 인덱스는 기존 case-variant 데이터 존재 시 충돌하므로 비채택.)
- emailTakenByOther / register 의 case-insensitive 조회가 인덱스를 타는지 EXPLAIN 확인.
