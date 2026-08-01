# API 계약(API Contract) Review — round 9

## 발견사항

**해당 없음.**

`git diff origin/main...HEAD --stat` 로 이번 변경분의 실제 범위를 확인했다: 149개 파일 중
`codebase/**`(제품 backend/frontend, 즉 실제 REST/HTTP API 가 사는 곳)는 **0건**이고, 전부
`.claude/**`(sub-agent 오케스트레이션 스크립트·리뷰/plan 게이트 훅·상태 관리 라이브러리·
sub-agent 정의·테스트) + `plan/in-progress/harness-review-gate-ci-backstop.md`(추적 문서) +
`review/**`(이전 라운드 산출물)뿐이다. 본 리뷰 관점(하위 호환성·버전관리·응답 스키마·에러
응답·요청 검증·URL/경로 설계·페이지네이션·인증/인가)이 겨냥하는 "제품이 노출하는 API" 표면
자체가 이번 diff 에 존재하지 않는다.

프롬프트가 크기 제한으로 잘라낸 6개 파일(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`, `test_block_integrity.py`,
`.claude/tests/README.md`, `merge_coordinator_orchestrator.py` 후반부)은 판단 전 전부 `Read`
로 직접 열었고, 18개 파일 전체를 HTTP 서버/라우팅 프레임워크 시그니처로 grep 했다
(`flask|fastapi|@app\.route|http\.server|BaseHTTPRequestHandler|requests\.(get|post)|
urllib\.request|socket\.socket|aiohttp|express\(|app\.(get|post|put|delete)\(`) — 전 파일
0건. 즉 "API 관련 코드 없음" 은 추정이 아니라 diff 범위 실측 + 전수 grep 으로 확인한 사실이다.

참고로 이 코드베이스에서 "API" 에 가장 가까운 것은 제품 REST API 가 아니라 내부 CLI/JSON
계약(sub-agent 반환 프로토콜, `_retry_state.json` 스키마, Stop 훅의 `{"decision":...}` JSON,
`evaluate_review()` 의 키워드 인자 계약)이다. 라운드 9 의 "고쳤다는 주장을 실측으로 검증하라"
는 지시에 따라 이 표면도 코드로 직접 대조했으나, 이번 diff 가 만든 회귀는 찾지 못했다:

- **`evaluate_review(cwd=None, *, in_flight_ok=False)` 의 opt-in 계약** — push 와 stop 두
  호출자가 같은 함수를 공유하면서 in-flight 억제 범위만 갈라야 하는 지점. 실제 호출부를
  확인: `guard_review_before_push.py:846`(`_evaluate_over_targets`, 809행 정의)은
  `evaluate(target)` 또는 `evaluate()` 만 호출해 `in_flight_ok` 를 절대 넘기지 않으므로
  기본값 `False` 가 유지되고, `guard_review_before_stop.py:350`은 명시적으로
  `evaluate_review(in_flight_ok=True)` 를 호출한다 — plan 문서가 서술한 "opt-in 화로 push
  계약은 무변경" 이 코드로 확인된다.
- **`summary_block_verdict()` 가 "single parser" 라는 docstring 주장** —
  `review_guard.py:754` 의 `_summary_block_is_no()` 가 실제로
  `_block_integrity.summary_block_verdict(text)` 에 위임하는 것을 확인, 중복 `BLOCK:` 정규식
  없음(주석의 "Change both" 회피 주장과 일치).
- **CLI 출력 계약(`pending=… success=… fatal=… last_reset=…`)** —
  `code_review_orchestrator.py`/`consistency_orchestrator.py` 양쪽은 `_shared/retry_state.py`
  의 `emit_summary_state()` 로 위임해 동일 포맷을 내지만, `merge_coordinator_orchestrator.py`
  는 branch/base 필드 때문에 로컬 `_emit_summary_state`(113-125행)를 그대로 유지해 포맷이
  다르다. 이 비대칭은 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 신규 후속
  9번에 "merge_coordinator 만 `reconcile_state_with_disk` 자기치유가 없다" 로 기존 결함
  등재돼 있어(성능 리뷰어도 동일 결론 재확인), 이번 라운드의 새 발견으로 잡지 않는다.

이상 모두 확인용 관찰이며 CRITICAL/WARNING 급 발견은 없다.

## 요약

이번 diff 는 `.claude/` 하네스 도구(sub-agent 오케스트레이션·리뷰/plan 게이트 훅·상태 관리
라이브러리)와 그 테스트·plan 추적 문서에 한정되고, `codebase/**`(제품 backend/frontend) 변경은
전무하다 — `git diff origin/main...HEAD --stat` 로 실측 확인했다. API 계약 체크리스트(하위
호환성·버전관리·응답 스키마·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가)가 대상으로
하는 제품 REST/HTTP API 표면이 이번 변경에 존재하지 않으므로 해당 관점에서 평가할 대상이
없다. 가장 근접한 내부 유사물(CLI 출력 포맷·`_retry_state.json` 스키마·sub-agent 반환
프로토콜·`evaluate_review(in_flight_ok=...)` 키워드 계약)도 프롬프트가 잘라낸 파일들을 포함해
직접 코드를 읽고 호출부를 대조했으나, 이번 라운드가 새로 만든 회귀는 없었다. 유일하게 남는
비대칭(`merge_coordinator_orchestrator.py` 의 CLI 출력·자기치유 부재)은 이미 plan 문서에 기존
결함으로 기록돼 있는 항목이다.

## 위험도

NONE
