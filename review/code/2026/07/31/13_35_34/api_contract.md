# API Contract Review

## 스코프 확인

`git diff --name-only origin/main...HEAD` 로 이 브랜치의 전체 변경 파일을 직접 대조했다. 변경은
전부 `.claude/` 하위 harness 도구(agents/hooks/skills/tests)와 `plan/in-progress/**` 문서다:

- `.claude/agents/consistency-summary.md` — sub-agent 프롬프트 정의 (md)
- `.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_stop.py` — Claude Code
  Stop/Push 훅 스크립트 (stdin JSON 페이로드 → stdout JSON `{"decision":...}` / 없음)
- `.claude/skills/code-review-agents/SKILL.md`, `.claude/skills/consistency-checker/SKILL.md` —
  skill 문서
- `.claude/skills/code-review-agents/scripts/_probe_main.py`,
  `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
  `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` — CLI 오케스트레이터
  (argparse 기반, 파일시스템·git 서브프로세스만 다룸)
- `.claude/tests/**` — 위 스크립트들의 단위 테스트
- `plan/in-progress/*.md` — 작업 추적 문서

`codebase/backend`·`codebase/frontend` 변경은 **0건**이다. 위 Python 스크립트 전체를 대상으로
HTTP 서버/클라이언트·라우팅 프레임워크 시그니처(Flask/FastAPI/`@app.route`/`APIRouter`/
`requests.*`/`http.server` 등)를 grep 했으나 일치하는 코드가 없었다 — 전부 로컬 CLI + 파일 I/O +
git subprocess 호출이다. Stop 훅의 stdin/stdout JSON 은 Claude Code 하네스와의 내부 플러그인
프로토콜이지 REST/HTTP API 가 아니며, URL 설계·페이지네이션·인증/인가·HTTP 상태 코드가 적용될
여지가 없다.

## 발견사항

없음 — 리뷰 대상 코드에 REST/HTTP API 계약(엔드포인트, 요청/응답 스키마, 버전 관리, 인증/인가,
페이지네이션 등)과 관련된 변경이 없다.

## 요약

이번 변경은 코드 리뷰·일관성 검토 harness(sub-agent 정의, Stop/Push 훅, CLI 오케스트레이터,
관련 테스트·plan 문서)에 국한되며, 제품의 backend/frontend API 코드는 전혀 건드리지 않는다.
API 계약 관점(하위 호환성·버전 관리·응답/에러 형식·요청 검증·URL 설계·페이지네이션·인증/인가)에서
평가할 대상이 없다.

## 위험도

NONE
