# API 계약(API Contract) 리뷰

## 대상 확인

`git diff --stat origin/main...HEAD` 기준 이번 변경분은 17개 파일 전부가 `.claude/**`(하네스 훅·서브에이전트 오케스트레이터·상태 관리 라이브러리·테스트) 와 `plan/in-progress/**`(작업 추적 문서) 뿐이다. `codebase/backend`·`codebase/frontend`·`codebase/packages`·`codebase/channel-web-chat` 등 애플리케이션 코드는 단 한 줄도 포함되지 않았다.

변경 내용은 다음 두 축으로 요약된다.
- `block_integrity.py`(신규) — consistency SUMMARY 의 `BLOCK:` 판정이 checker 리포트의 `[CRITICAL]` 태그와 모순되는지 검사하는 백스톱.
- `retry_state.py`(신규) — `code_review_orchestrator.py`/`consistency_orchestrator.py`/`merge_coordinator_orchestrator.py` 세 오케스트레이터가 각자 들고 있던 `_retry_state.json` 부기 로직(`load_state`/`save_state`/`reconcile_state_with_disk`/`apply_status_update`/`emit_summary_state`)을 공유 모듈로 추출.
- `failopen_state.py` 를 `guard_review_before_push.py` 에서 `guard_review_before_stop.py` 로도 공유해 Stop 훅의 fail-open 3경로(import 실패·`evaluate_*()` 예외·`main()` 예외)를 동일하게 카운트/보고.
- `evaluate_review()` 에 `in_flight_ok` 키워드 인자를 추가해 push 게이트(hard block)와 Stop 게이트(soft nudge)의 in-flight 억제 범위를 분리(§동봉 plan 문서 참고).
- 그 외 SKILL.md/agent 프롬프트 문서 갱신, 테스트 3개 신규/보강.

Grep 으로 diff 전체를 `route|endpoint|@(get|post|...)|http|status\(|res\.(json|send|status)|controller|swagger|openapi|pagination|api/v[0-9]` 패턴 대조했으나 매칭은 모두 "router"(리뷰어 라우팅/디스패치 로직을 가리키는 하네스 내부 용어)·"routing=" 필드 문자열뿐이었고, HTTP 라우트·컨트롤러·응답 직렬화 등 실제 REST/HTTP API 코드는 전무하다. Stop 훅의 stdout 이 `{"decision": "block", "reason": ...}` JSON 을 실어 나르는 부분(`guard_review_before_stop.py`)과 오케스트레이터들의 CLI 인자 계약(`argparse`, `--summary-state`/`--update` 출력 라인)은 프로세스 간 로컬 프로토콜/CLI 인터페이스이지, 외부 클라이언트가 소비하는 API 계약(REST 버저닝·페이지네이션·인증/인가·HTTP 상태 코드 등)의 대상이 아니다.

## 발견사항

(해당 없음 — 이번 변경에 API 관련 코드가 없음)

## 요약

이번 변경분(`.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py`, 훅/오케스트레이터/SKILL 문서, 신규 테스트, plan 문서)은 전부 Claude Code 하네스 내부 도구 체계(리뷰 게이트, 재시도 상태 관리, fail-open 보고)에 관한 것이며 `codebase/**` 아래 애플리케이션 REST/HTTP API 코드를 전혀 건드리지 않는다. 따라서 하위 호환성·버전 관리·응답 스키마·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 등 API 계약 관점의 점검 대상이 존재하지 않는다. 해당 없음.

## 위험도

NONE
