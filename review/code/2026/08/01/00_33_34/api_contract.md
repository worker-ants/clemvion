# API 계약(API Contract) 리뷰 결과

## 해당 없음, 위험도 NONE

### 발견사항

없음.

### 요약

`git diff origin/main...HEAD`(review 산출물 제외) 로 실제 변경 범위를 직접 재확인했다 — 15개 파일 전부
`.claude/**` 하네스 도구(`_shared/block_integrity.py` 신설, `_shared/retry_state.py` 신설, 각
orchestrator 스크립트, push/stop hook, sub-agent 프롬프트 `.md`, `.claude/tests/**` 단위테스트)와
`plan/in-progress/harness-review-gate-ci-backstop.md` 뿐이다. `codebase/backend`, `codebase/frontend`
등 제품 코드는 이번 diff 에 단 한 줄도 포함되지 않았다. 프롬프트에 전문이 실리지 않은 대형 파일 4건
(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`) 은 `Read`/`grep` 으로 직접 열어 확인했으며, HTTP 라우트·컨트롤러·
요청/응답 DTO 등 REST API 관련 패턴은 전혀 없다.

존재하는 것은 (a) orchestrator 들의 CLI 인자 계약(`--update`/`--summary-state`/`--resume` 등),
(b) sub-agent 호출·반환 규약(`STATUS=... BLOCK=...` 라인, `_retry_state.json` JSON 스키마),
(c) Claude Code 자체의 Stop/PreToolUse hook stdin/stdout 프로토콜뿐이며, 이들은 하네스 내부
프로세스 간 계약으로 이 체크리스트가 겨냥하는 제품 REST API(엔드포인트 URL 설계, HTTP 상태코드,
페이지네이션, 엔드포인트 인증/인가, 외부 클라이언트 하위 호환성)와는 성격이 다르다.

참고로 이 내부 계약들도 diff 안에서 스스로 호환성을 관리하는 것을 확인했다 — 예:
- `_shared/retry_state.py` 추출은 AST 비교로 5개 함수 중 4개가 (docstring 제외) 동일함을 확인 후
  이동했고, `test_retry_state_shared.py` 가 두 orchestrator 의 `--summary-state` stdout 라인·
  `reconciled` stderr 알림이 기존과 동일하게 유지됨을 고정한다.
- `review_guard.evaluate_review()` 에 추가된 `in_flight_ok: bool = False` 는 키워드 전용 +
  기본값 유지 파라미터라 기존 호출부(`guard_review_before_push.py` 의 `_evaluate_over_targets` →
  `evaluate(target)` 위치 인자 호출)에 하위 호환이며, 오직 `guard_review_before_stop.py` 만
  명시적으로 `in_flight_ok=True` 를 opt-in 한다(직접 grep 으로 두 호출부 확인).
- `failopen_state.Outcome.notes` 필드 신설과 `guard_review_before_stop.py` 의 stderr 전용
  advisory 출력은 push 훅의 "stderr on refuse / stdout on allow" 규칙을 Stop 훅(stdout=JSON
  decision 프로토콜)에 잘못 이식하지 않도록 스트림을 분리해 두었다.

따라서 API 계약 관점에서는 리뷰할 대상이 없다. (참고: 동일 계열 diff 에 대한 직전 세션
`review/code/2026/08/01/00_03_38/api_contract.md` 도 독립적으로 동일 결론(NONE)에 도달했다.)

### 위험도

NONE
