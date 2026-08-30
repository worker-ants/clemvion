# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 리네임된 가드 테스트 파일명이 같은 파일 안에서 두 줄 차이로 자기모순 — 워크플로 3파일의 "MIRROR" 서문 주석이 여전히 존재하지 않는 옛 이름을 가리킨다
  - 위치: `.claude/workflows/ai-review.js:109`, `.claude/workflows/consistency-check.js:48`, `.claude/workflows/merge-coordinate.js:58`
  - 상세: 이번 diff 는 `.claude/workflows/_lib/agent-return.mjs` 자신의 모듈 docstring(line 15)과, 3개 워크플로 파일의 `>>> SHARED-BLOCK` 마커 줄(예: `ai-review.js:113`)에서 `test_workflow_shared_block.py` → `test_workflow_scripts.py` 로 가드 테스트 파일명을 정정했다. 그런데 각 워크플로 파일에서 그 마커 바로 **2줄 위**에 있는 "Report-return contract — MIRROR of …" 서문 주석(SHARED-BLOCK 마커 밖이라 mirror 무결성 가드 대상이 아님)은 정정에서 빠져, 여전히 `` `.claude/tests/test_workflow_shared_block.py` fails the build if these drift apart; `` 라고 적혀 있다. 실제로 그 파일은 저장소에 존재하지 않는다(확인: `ls .claude/tests/test_workflow_shared_block.py` → No such file). 같은 파일 안에서 두 줄 아래 마커 주석은 새 이름을, 서문은 옛 이름을 가리키는 자기모순 상태다. 부수적: `test_workflow_scripts.py` 는 `>>> SHARED-BLOCK … <<< SHARED-BLOCK` 사이만 4파일 바이트 비교하므로(README.md 서술) 이 서문 텍스트는 그 가드의 검사 범위 밖이라 앞으로도 자동으로는 안 잡힌다.
  - 제안: 3개 워크플로 파일의 서문 주석도 같은 문자열로 정정. (기능·상태에 영향은 없는 순수 주석 drift라 위험도는 INFO 로 제한.)

## 전반 평가

핵심 변경은 `.claude/workflows/_lib/agent-return.mjs` 의 `REPORT_RETURN_CONTRACT` 문자열(및 이를 verbatim 미러링하는 `ai-review.js`/`consistency-check.js`/`merge-coordinate.js` 3곳)이다 — sub-agent 프롬프트에 매 fan-out 호출마다 덧붙는 지시문을, "`output_file` 은 마크다운 본문만 / STATUS 헤더·구분자는 반환 메시지에만" 으로 두 sink 를 명시적으로 갈랐다. 이는 이 워크플로들을 거치는 **모든 향후** reviewer/checker/analyzer 호출의 산출물 형태를 바꾸는 저장소 전역 행동 변경이지만, 의도된 변경이고(PR 의 목적 자체) 3개 파일에 걸쳐 문자 그대로 동일하게 미러링됐음을 diff 로 확인했다. `parseAgentReturn`/`usable`/`inlineReports`/`needPersistList`/`needReadList` 등 기존 함수 시그니처·로직은 전혀 건드리지 않았고, 이 계약 문자열을 파싱·소비하는 곳은 저장소 전체에서 이 5개 파일(lib·워크플로 3개·테스트)뿐임을 grep 으로 확인했다 — 다른 orchestrator(`.py`)나 SKILL.md 어디에도 `output_file` 이 STATUS 헤더를 포함한다고 전제하는 코드는 없다. `node --test .claude/tests/test_agent_return.mjs` 13개 전부 GREEN(회귀 없음, 저장소 mutation 없음 — `git status --short` 로 확인). `execution-engine.service.ts`(파일 6)와 plan 문서(파일 7)의 변경은 각각 JSDoc 주석 갱신과 plan 서술 갱신뿐으로 실행 경로에 영향이 없다. 전역 변수 도입, 함수/공개 API 시그니처 변경, 예기치 못한 파일시스템 쓰기, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 관찰되지 않았다. 저장소 트리에 대한 뮤테이션 테스트는 수행하지 않았다(순수 문자열/주석 diff라 재현 필요성이 낮다고 판단) — 대신 기존 GREEN 테스트만 read-only 로 재실행해 회귀 부재를 확인했다.

## 위험도

LOW
