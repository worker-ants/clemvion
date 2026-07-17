# API 계약(API Contract) 리뷰

## 발견사항

없음 — 해당 없음.

## 요약

이번 변경셋은 `.claude/hooks/guard_review_before_push.py`(git push PreToolUse 훅), `.claude/tools/reap-merged-worktrees.sh`(머지된 워크트리 GC 스크립트), `.claude/tools/bootstrap-session.sh`(세션 부트스트랩 스크립트), 두 개의 테스트 파일(`test_push_detection.py`, `test_reap_merged_worktrees.py`), 정책 문서(`worktree-policy.md`), plan 문서로 구성된다. 전부 Claude Code 하네스 자체의 로컬 개발 도구(git hook·bash 스크립트·유닛/통합 테스트·문서)이며, `codebase/backend` 또는 `codebase/frontend` 의 REST/HTTP 엔드포인트, 요청/응답 DTO, 라우팅, 스키마를 전혀 건드리지 않는다. 유일하게 외부 서비스와 접촉하는 지점은 `reap-merged-worktrees.sh` 가 `gh pr view <branch> --json state --jq .state` 로 GitHub CLI(내부적으로 GitHub REST/GraphQL API 를 감쌈)를 호출하는 부분인데, 이는 이 코드베이스가 노출하는 API 를 정의·변경하는 것이 아니라 안정된 서드파티 CLI 를 소비(consume)하는 것뿐이라 하위 호환성·버전관리·응답 스키마·페이지네이션·인증/인가 같은 API 계약 관점의 평가 대상이 아니다. 훅의 exit-code 계약(0/2/기타)이나 스크립트의 CLI 플래그(`--dry-run`/`--force`/`--keep`)·환경변수 인터페이스는 본 리뷰 관점이 명시하는 URL 설계·페이지네이션·HTTP 상태코드·인증/인가 등 REST API 설계 기준과는 성격이 다른 로컬 프로세스 인터페이스이므로 범위에 포함하지 않는다. 따라서 API 계약 관점에서는 검토할 대상이 없다.

## 위험도

NONE
