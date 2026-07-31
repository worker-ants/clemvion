# API 계약(API Contract) 리뷰

## 해당 없음

이번 변경 세트(15개 파일)는 전부 `.claude/**`(하네스 훅·스킬 스크립트·에이전트 정의·테스트)와
`plan/in-progress/**`(작업 추적 문서)로 구성되어 있고, 제품 코드 영역(`codebase/backend`,
`codebase/frontend` 등)의 REST/GraphQL 엔드포인트, 컨트롤러, 라우터, 응답 스키마는 하나도
포함하지 않는다.

확인 절차:
- 리뷰 대상 파일 15개 전수 확인 — 전부 `.claude/agents|hooks|skills|tests/**` 또는
  `plan/in-progress/**` 경로. `codebase/**` 파일 없음.
- 프롬프트 크기 제한으로 인라인되지 않은 2개 대용량 파일
  (`.claude/hooks/_lib/review_guard.py`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`)
  및 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, `.claude/tests/README.md`
  에 대해 `app.get/post/put/delete`, `router.`, `@Controller`, `@Get(`, `res.status`, `res.json`,
  `express`, `fastify`, `HttpException` 등 HTTP/REST 프레임워크 패턴을 grep 했으나 매치 0건
  (우연히 걸린 3건은 모두 "router"라는 단어가 들어간 주석/변수명이며 HTTP 라우팅과 무관 —
  `review-router.md`/`router_prompt_path`는 이 저장소 자체의 리뷰-라우터 sub-agent 를 가리킴).

내용상으로도 이 변경은 Claude Code 하네스의 내부 거버넌스 로직이다: Stop/Push 훅의 fail-open
집계(`review_guard.py`/`guard_review_before_stop.py`), consistency-summary 에이전트의 하향 금지
규약, 리뷰·consistency 오케스트레이터의 컨텍스트 번들 우선순위 산정(`prioritize_bundle_files`),
그리고 이를 검증하는 단위/통합 테스트다. 이들이 주고받는 것은 로컬 stdin/stdout JSON(하네스
프로토콜), 파일시스템 경로(`output_file`/`summary_output_file`), sub-agent 호출 규약
(`subagent-call-contract.md`)이며, 본 checklist 가 다루는 하위 호환성·버전 관리·HTTP 응답
형식·에러 상태 코드·URL/RESTful 설계·페이지네이션·엔드포인트 인증/인가 어느 항목도 대상이
존재하지 않는다.

참고로 근접한 아날로그(엄밀한 "API"는 아니므로 findings 로 세지 않음, 정보 제공 목적):
- Stop 훅의 `{"decision":"block","reason":...}` stdout 프로토콜과 `evaluate_review(cwd=None, *, in_flight_ok=False)` 키워드 전용 인자 추가는 내부 함수 시그니처 변경이지만, 호출부가 이 저장소 안에 전부 있고 외부 소비자가 없어 "하위 호환성 breaking change" 개념이 적용되지 않는다.
- `code_review_orchestrator.py`/`consistency_orchestrator.py` 의 CLI 플래그(`--impl-done`, `--diff-base` 등)는 이 저장소 자체 워크플로만 호출하므로 마찬가지.

## 요약
API 계약 관점에서 검토할 대상 코드가 없다. 변경분 전체가 `.claude/` 하네스 도구와 `plan/`
문서로, 제품의 HTTP/REST API 표면(엔드포인트·요청 검증·응답 스키마·에러 코드·페이지네이션·
인증)에 대한 수정이 전혀 없다.

## 위험도
NONE

STATUS=success ISSUES=0
