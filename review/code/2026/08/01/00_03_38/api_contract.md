# API 계약(API Contract) 리뷰

## 발견사항

없음.

## 요약

이번 변경 세트 14개 파일은 전부 `.claude/**` 하네스 도구(`_shared/block_integrity.py`, `_shared/retry_state.py`, 각 orchestrator 스크립트, hook, sub-agent 프롬프트 `.md`, `.claude/tests/**` 단위테스트)와 `plan/in-progress/**` 계획 문서다. `codebase/backend`, `codebase/frontend` 등 제품 API 서버·클라이언트 코드는 이번 diff 에 전혀 포함되지 않았다(대형 파일 4건 — `review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py` — 은 프롬프트에 전문이 실리지 않아 직접 `Read`/`grep` 으로 확인했으며, HTTP 라우트·컨트롤러·요청/응답 스키마 등 REST API 관련 패턴은 전혀 발견되지 않았다). 존재하는 것은 (a) orchestrator 들의 CLI 인자 계약(`--update`/`--summary-state`/`--resume` 등), (b) sub-agent 호출·반환 규약(`STATUS=... BLOCK=...` 라인, `_retry_state.json` JSON 스키마), (c) Claude Code 자체의 Stop/PreToolUse hook stdin/stdout 프로토콜이며, 이들은 하네스 내부 프로세스 간 계약일 뿐 이 체크리스트가 겨냥하는 제품 REST API(엔드포인트 URL 설계, HTTP 상태코드, 페이지네이션, 엔드포인트 인증/인가, 외부 클라이언트 하위 호환성)와는 성격이 다르다. 참고로 이 내부 계약들도 diff 안에서 스스로 호환성을 관리하고 있음은 확인했다 — `retry_state.py` 추출은 AST 비교로 5개 함수 중 4개가 바이트 단위 동일함을 확인한 뒥 이동했고, `test_retry_state_shared.py`가 두 orchestrator의 `--summary-state` stdout 라인이 기존과 동일하게 유지됨을 고정한다. 따라서 API 계약 관점에서는 리뷰할 대상이 없다.

## 위험도

NONE
