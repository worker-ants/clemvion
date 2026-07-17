# API 계약(API Contract) 리뷰

## 리뷰 대상

- `.claude/hooks/guard_review_before_push.py`
- `.claude/tests/test_push_detection.py`

## 발견사항

없음. 두 파일 모두 `.claude/` 하위의 harness 내부 자동화 도구다.

- `guard_review_before_push.py` — Claude Code Bash 툴의 PreToolUse 훅으로, `git push`
  커맨드를 셸 인지 토크나이저로 탐지해 코드 리뷰·plan 갱신 여부를 검사하는 로컬
  가드 스크립트다. HTTP 엔드포인트, 요청/응답 스키마, 라우팅, 인증/인가, 페이지네이션
  등 API 계약 요소를 전혀 포함하지 않는다.
- `test_push_detection.py` — 위 훅의 `_is_git_push` 셸 파싱 로직에 대한 단위테스트로,
  마찬가지로 API 표면과 무관하다.

`codebase/backend`, `codebase/frontend` 등 실제 서비스 API 코드에 대한 변경은 이번
diff 에 포함되어 있지 않다.

## 요약

이번 변경은 git push 시점의 코드 리뷰 강제 훅과 그 테스트에 관한 것으로, REST/GraphQL
엔드포인트, 응답 스키마, 에러 응답, 요청 검증, URL 설계, 페이지네이션, 인증/인가 등
API 계약과 관련된 어떤 요소도 건드리지 않는다. API 계약 관점에서는 해당 없음.

## 위험도

NONE
