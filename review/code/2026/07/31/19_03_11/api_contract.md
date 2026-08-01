# API 계약(API Contract) 리뷰

## 대상 확인

이번 변경(diff `origin/main...HEAD`, 11개 파일)은 전부 `.claude/`(harness 자동화 스크립트·훅·테스트) 와
`plan/in-progress/`(진행 문서) 범위에 한정된다:

- `.claude/_shared/block_integrity.py` (신규) — consistency SUMMARY 의 `BLOCK:` 판정과 checker 리포트의
  `[CRITICAL]` 태그 불일치를 찾는 순수 함수 모듈
- `.claude/_shared/retry_state.py` (신규) — `_retry_state.json` 상태 관리 공용 함수(두 orchestrator 의
  중복 코드를 추출)
- `.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_push.py` — Claude Code
  PreToolUse/Stop 훅(스크립트가 stdin JSON 을 읽고 exit code·stdout/stderr 로 신호하는 로컬 CLI 훅)
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
  `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`,
  `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` — argparse 기반 CLI
  오케스트레이터(세션 준비·상태 파일 관리, model 직접 호출 없음)
- `.claude/tests/*` — 위 모듈들의 unit test
- `plan/in-progress/harness-review-gate-ci-backstop.md` — 진행 문서(코드 아님)

`git diff --stat origin/main...HEAD` 확인 결과 `codebase/backend`, `codebase/frontend` 등 실제 제품
API(REST/HTTP 엔드포인트·컨트롤러·라우터)가 위치하는 영역은 **한 파일도 포함되지 않았다.** 변경된 세 개의
대용량 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`)은 프롬프트에
직접 실리지 않아 `Read`/`git diff`로 개별 확인했으며, 마찬가지로 CLI 훅·오케스트레이터 로직만 다룬다.
`@Controller`/`@Get(`/`router.`/`swagger`/`openapi`/`flask`/`fastapi`/`express` 등 웹 API 관련 패턴을
전체 diff 에서 grep 했으나 매치 없음(유일한 "router" 매치는 `review-router` 에이전트 이름을 가리키는
주석이며 HTTP 라우팅과 무관).

즉 이번 변경에는 HTTP/REST API 엔드포인트, 요청/응답 스키마, 페이지네이션, API 버전, 인증/인가 미들웨어
등 본 리뷰 관점이 다루는 대상이 존재하지 않는다. 참고로 `guard_review_before_push.py` 의 diff 는
Claude Code 훅 프로토콜(stdin JSON → exit code 0/2, stdout/stderr 스트림 선택)에 `_report_notes()` 를
추가해 gate 의 advisory 메시지를 exit code 에 따라 올바른 스트림(ALLOW=stdout, BLOCK=stderr)으로
내보내는 변경인데, 이는 로컬 프로세스 간 훅 계약이지 네트워크 API 계약이 아니며 하위 호환성도
유지된다(기존 `_report_fail_open` 과 동일한 스트림 규칙을 그대로 재사용, 기존 필드에는 손대지 않고
`outcome.notes` 를 신설 추가).

## 발견사항

(해당 없음)

## 요약

이번 diff 는 harness 자동화 스크립트(consistency/code-review 오케스트레이터, pre-push 훅, 공용 상태
모듈)와 그 테스트만을 대상으로 하며, `codebase/backend`·`codebase/frontend` 등 실제 REST/HTTP API 표면은
전혀 변경되지 않았다. API 계약(하위 호환성·버전 관리·응답/에러 형식·요청 검증·URL 설계·페이지네이션·
인증/인가) 관점에서 검토할 대상 코드가 없다.

## 위험도

NONE
