# 요구사항(Requirement) 리뷰

## 검증 방법 (뮤테이션 없음)

저장소 파일은 수정하지 않았다. `Read`/`Grep`/테스트 실행으로만 검증했고, 스크래치 출력은
`/private/tmp/claude-501/.../scratchpad` 에만 썼다. 실행:

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 pass**
- `python3 .claude/tests/test_workflow_scripts.py` → **5/5 pass**
- `grep -rn '\.transaction\s*<\|\.transaction\s*(' codebase/backend/src --include="*.ts" | grep -v spec` →
  총 40줄, 그중 JSDoc 주석 인용 4줄(8574·8577·8590·8593) 제외하면 **정확히 36개**.
  실행 코드 위치 기준 `execution-engine.service.ts` 8곳 + `retry-turn.service.ts` 1곳 = **9개**(모듈 안),
  나머지 **27개**(모듈 밖).
- `ExecutionEngineService` 참조 파일 전수(grep)와 위 27개 파일 목록을 대조 — 교집합은
  `executions.service.ts` 하나뿐임을 확인. 그 트랜잭션 콜백(`executions.service.ts:641`)을
  `Read` 로 직접 열어 콜백 본문이 `manager.createQueryBuilder(...)` 만 쓰고 `this.*` 호출이
  없음을 확인.
- 모듈 안 9개 블록 중 2곳(`execution-engine.service.ts:1024`, `:1158`, `cancelParkedExecution`/
  `markWebChatIdleTimeout`)을 `Read` 로 직접 열어 콜백 본문에 `this.updateExecutionStatus` 호출이
  없음을 확인 (나머지 7곳은 예산상 전수 재확인은 못 했다 — 다음 절 참고).
- `test_workflow_shared_block.py`(옛 가드 파일명) 잔존 여부를 저장소 전수 grep — 남은 참조는 전부
  `review/code/2026/08/30/20_21_06/*.md`(이전 라운드 리뷰 산출물, 시점 기록이라 미수정) 안에만
  있고, 실제 소스(`*.js`/`*.mjs`)에는 0건.
- `REPORT_RETURN_CONTRACT` 정의 위치 전수 grep — `_lib/agent-return.mjs` + 3개 워크플로 미러 +
  테스트 파일 5곳뿐, 놓친 5번째 사본 없음.

## 발견사항

- **[INFO]** self-deadlock 불변식 JSDoc(`execution-engine.service.ts:8577-8596`)의 "모듈 안 9개
  블록이 `updateExecutionStatus` 에 도달하지 않는다" 는 주장을 9곳 중 2곳만 직접 열어 확인했다
  (나머지 7곳은 grep 상 `this.updateExecutionStatus` 호출부 라인(652, 2309, 2409, 2485, 2574,
  3569, 4307, 4432, 4755, 5014)과 트랜잭션 블록 시작 라인(1253, 2974, 3342, 8448, 8663, 8729)이
  뚜렷이 분리돼 있어 상충 정황은 없었지만, 각 블록의 닫는 중괄호까지 추적하는 전수 대조는 예산상
  생략했다). 이 JSDoc 이 스스로 "자동 가드는 아직 없다 — 사람이 grep 으로 확인" 이라고 명시하고
  있으므로 이것은 이 PR 의 결함이 아니라 이미 문서화된 한계다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8577-8596`
  - 제안: 조치 불요. 다음에 이 영역을 손댈 사람을 위해, 위 9개 블록의 라인 번호를 JSDoc 이나 plan
    에 명시적으로 나열해 두면 향후 재검증 비용이 준다(선택 사항).

## 확인된 항목 (이전 라운드 `20_21_06` 의 WARNING 4건 재검증 — 전부 해소됨)

이 diff 에는 이전 리뷰 라운드(`20_21_06`)의 산출물(SUMMARY/RESOLUTION 등)이 신규 파일로 포함돼
있고, 그 라운드가 지적한 WARNING 은 이번 커밋(`5a33656f9`)이 이미 수정한 것으로 문서화돼 있다.
그 주장을 독립적으로 재검증했다:

- **W1(가드 파일명 절반 리네임)** — 실측: `test_workflow_shared_block.py` 문자열이 소스 3개
  워크플로 + `_lib` 어디에도 남아있지 않다. 완전히 고쳐졌다.
- **W2(`.transaction(` 개수 35 vs 36 상충)** — 실측: 정확히 36개(위 검증 방법 참고). JSDoc 의
  36/9/27 수치가 정확하고, 이전 라운드 `requirement` 리뷰어의 35 는 제네릭 타입 인자
  (`webauthn.service.ts:338` 의 `.transaction<Outcome>(`)를 놓친 단순 패턴 오류였다는 RESOLUTION
  의 설명과 내 재측정이 일치한다.
- **W3(forward-looking 지시문 삭제)** — 실측: "새 호출부를 추가하거나 새 `.transaction(` 블록을
  열 때는 이 대조를 다시 하라" 문장이 JSDoc 에 복원돼 있다(`:8590`).
- **W4(무관 커밋 혼재)** — 기능 결함 아님, 이미 plan 에 판단 기록됨(재론 불요).

## 기능 완전성 (핵심 diff, 파일 1~5)

`REPORT_RETURN_CONTRACT` 를 "①`output_file`=마크다운 본문만" / "②③=반환 메시지" 로 분리한
정정은 실제 소비 코드와 정합한다:

- `parseAgentReturn(text)` 는 항상 **반환 메시지 문자열**(`text`)에서 STATUS/DELIM 을 파싱한다 —
  파일 내용을 파싱하지 않는다. 새 계약 문구가 요구하는 분리와 함수 동작이 이미 일치한다(함수
  자체는 이번 diff 에서 변경되지 않음, 문구만 바뀜).
- `ai-review.js` Summary phase 프롬프트(`:264-266`)는 "아래 인라인에 없는 reviewer 는
  output_file 을 Read 해 보완하세요" 라고만 지시 — 파일에서 STATUS/DELIM 을 벗겨내라는 지시가
  없다. 새 계약(파일=마크다운 전용)과 정확히 맞물린다. 구계약(파일에도 헤더가 섞임) 상태였다면
  이 Read 경로가 헤더까지 그대로 보고서 본문에 흡수했을 것 — 이번 정정이 바로 그 결함(536개
  산출물의 헤더 유출)의 근본 원인을 막는다.
- `REPORT_RETURN_CONTRACT` 의 5개 정의 위치(정본+3미러+테스트) 모두 동일 문구로 확인됨(정본
  파일 검증 방법 참고) — verbatim 미러링 깨짐 없음.

## 엣지 케이스 / 반환값

- Write 실패 시에도 "아래 2·3 은 반드시 수행" 문구가 유지돼, `parseAgentReturn` 이 no_status 로
  떨어지지 않고 최소한 fatal/no_status + salvaged body 로 처리되는 기존 경로가 그대로 보존된다.
- `usable()`/`needReadList()`/`needPersistList()` 로직 자체는 변경되지 않았고, 새 계약 문구가
  이 함수들의 기존 분기(파일 read 필요/불필요, 본문 persist 필요/불필요)와 충돌하지 않는다.

## TODO/FIXME

- 없음 (diff 대상 5개 harness 파일 + execution-engine.service.ts 해당 구간 전수 grep).

## Spec fidelity

- `spec/` 전수 grep 결과 `REPORT_RETURN_CONTRACT`/`output_file` Write 규약을 정의하는 product
  spec 문서 없음 — 이 계약은 `.claude/` harness 내부 도구 규약이며 `spec/` 이 다루는 제품
  요구사항 영역이 아니다. `.claude/docs/subagent-call-contract.md` 는 정확한 문구를 복제하지
  않고 워크플로 파일을 SoT 로 위임하는 설계이며, 이는 문서화 리뷰어가 이전 라운드에서 이미
  "정상(SoT 단일화)" 으로 확인한 바와 일치한다 — drift 아님.
- `execution-engine.service.ts` 변경분(파일 6)은 순수 JSDoc/주석이며 `updateExecutionStatus` 의
  시그니처·상태 전이 로직·에러 코드는 변경되지 않았다. `spec/5-system/4-execution-engine.md` /
  `spec/data-flow/3-execution.md` (plan `spec_impact` 에 등재된 두 문서)는 이 JSDoc 감사
  서술 자체를 다루지 않으며(구현 세부 불변식이지 API/필드 계약이 아님), 이번 diff 가 그 두 문서와
  line-level 로 불일치하는 지점은 찾지 못했다.

## 요약

핵심 diff(harness report-return 계약을 파일/반환 메시지 두 sink 로 분리)는 실제 defect(536개
리뷰 산출물이 `STATUS=…` 로 시작하는 헤더 유출)를 정확히 겨냥했고, 소비 코드(`parseAgentReturn`,
Summary phase 프롬프트)와 정합하며, 신규 테스트 2건은 실제로 회귀를 잡는다(13/13 GREEN 확인).
이전 라운드(`20_21_06`)가 지적한 WARNING 4건은 모두 이번 커밋에서 실측 재검증상 해소됐다 —
가드 파일명 스테일 참조 0건, `.transaction(` 전수 36개(9+27) 수치 일치, forward-looking 지시문
복원 확인. execution-engine.service.ts 쪽 변경은 순수 주석이라 기능적 위험이 없다. 유일하게 남은
것은 self-deadlock 불변식의 9개 모듈-내 블록 중 7곳을 전수 재확인하지 못한 예산상 한계(INFO)이며,
이는 diff 가 스스로 명시한 기존 한계(자동 가드 부재)와 같은 성격이다.

## 위험도

LOW
