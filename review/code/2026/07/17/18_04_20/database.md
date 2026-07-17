# 데이터베이스(Database) 리뷰

## 리뷰 대상 요약

본 변경(`plan/in-progress/harness-session-anchor-guards.md` — "하네스 가드 2건: 세션 앵커 reap + push 가드 오탐")에
포함된 7개 파일은 모두 `.claude/` 하위의 **하네스 인프라 코드**다:

1. `.claude/hooks/guard_review_before_push.py` — `git push` 커맨드 문자열을 shlex 로 토큰화해 실제 `push` 서브커맨드
   실행 여부를 판정하는 PreToolUse hook
2. `.claude/tools/reap-merged-worktrees.sh` — merge 된 PR 의 git worktree/local branch 를 정리하는 bash 스크립트
3. `.claude/tools/bootstrap-session.sh` — SessionStart 시 git hooksPath 설정·npm 의존성 설치·상태 파일 GC·reaper 호출
4. `.claude/tests/test_push_detection.py` — ①의 유닛 테스트 (문자열/shlex 토큰화 검증)
5. `.claude/tests/test_reap_merged_worktrees.py` — ②의 통합 테스트 (임시 git repo + `gh` stub)
6. `.claude/docs/worktree-policy.md` — worktree 운영 정책 문서 (mermaid 없음, 순수 서술)
7. `plan/in-progress/harness-session-anchor-guards.md` — 작업 추적 plan 문서

모든 파일을 확인한 결과, SQL 쿼리·ORM 호출(TypeORM/Prisma/Knex 등)·DB 스키마·마이그레이션 파일·커넥션 풀·
트랜잭션 코드가 **전혀 없다**. 다루는 대상은:

- git 커맨드 문자열 파싱(`shlex`, 정규식) — DB 아님
- git worktree/branch 조작(`git worktree`, `git branch`) — DB 아님
- `gh pr view` CLI 호출(GitHub API, 로컬 CLI 경유) — DB 아님
- 파일시스템 상태 마커(`.claude/state/reap_last_run` 등, `mtime` 기반 GC) — 파일시스템이지 DB 아님
- 테스트에 등장하는 "임시 git repo"(`tempfile.mkdtemp()` + `git init`)는 이 프로젝트의 RDBMS(Postgres 등)와
  무관한 순수 로컬 git 저장소이며, 세션/데이터 레이어 스토리지도 아니다.

`codebase/backend`(NestJS + TypeORM 추정) 나 `codebase/frontend`, `codebase/packages` 등 애플리케이션 DB 접근
계층 코드는 이번 변경셋에 포함되어 있지 않다.

## 발견사항

없음.

## 요약

이번 변경은 harness(worktree/push-guard) 스크립트·테스트·문서·plan 파일로만 구성되어 있으며, 데이터베이스
쿼리·스키마·마이그레이션·트랜잭션·커넥션 관리 등 DB 관련 코드를 전혀 포함하지 않는다. 데이터베이스 관점의
리뷰 대상이 아니다.

## 위험도

NONE
