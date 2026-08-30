# 테스트(Testing) 리뷰

## 검증 절차 (재현)

- `node --test .claude/tests/test_agent_return.mjs` — 13/13 통과 확인 (기존 11 + 신규 2).
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -v` — 5 passed / 9 subtests 확인 (plan 문서의 주장과 일치).
- **뮤테이션 재현**: `.claude/workflows/_lib/agent-return.mjs` 의 `REPORT_RETURN_CONTRACT` 를
  scratch 사본에서 초판 문구(`1) 결과를 output_file 에 Write...` / 구분 없는 2·3 항)로 되돌려
  저장소 파일에 `cp` 로 적용 → `node --test` 재실행 → **정확히 신규 2건만 RED, 기존 11건은
  GREEN** (plan 문서 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "RED 2 / 기존
  11 GREEN" 서술과 일치). 즉시 `cp` 로 원복하고 `git status --short` · `diff` 로 원복 확인
  (clean, 잔여물 없음).

## 발견사항

- **[WARNING]** `updateExecutionStatus` self-deadlock JSDoc 갱신이 "새 호출부 추가 시 재확인"
  지시문을 삭제하고 대체하지 않았다 — 이 불변식은 여전히 자동화된 테스트/가드가 전혀 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8577-8588`
    (diff 게이트 기준. `updateExecutionStatus` 선언 바로 위 JSDoc)
  - 상세: 삭제된 원문은 "**이 확인은 어휘적(lexical) 범위다** — 호출 스택 위쪽에서 트랜잭션을
    연 caller 가 있는지까지는 보지 않았다. **새 호출부를 추가할 때는 그 축도 함께 볼 것.**"
    이었다. 새 문구는 "36개 `.transaction(` 블록을 전수로 봤다"는 **한 시점의 감사 결과**만
    적고, 남는 한계(DI·이벤트 핸들러·큐 consumer 의 런타임 경로)를 인정하면서도 **미래
    유지보수자에게 무엇을 언제 재확인해야 하는지 지시하는 문장을 남기지 않았다.** 이 불변식을
    지키는 유일한 방어는 사람이 이 JSDoc 을 읽고 수동으로 grep 하는 것이며, 이번 PR 이 그
    작업을 다시 수행했다는 사실 자체가 "한 번 하면 끝"이 아니라는 증거다(`#1243` → 이번 판이
    두 번째 수행). `sed -n '8560,8596p'` 로 실제 파일을 열어 확인했다 — 새로 `.transaction(`
    을 여는 호출부가 추가돼도 이를 잡아 줄 자동 테스트(예: `test_workflow_scripts.py` 류의
    grep 기반 drift 가드)가 backend 쪽에는 없다.
  - 제안: (a) 삭제한 "새 호출부를 추가할 때는 그 축도 함께 볼 것" 과 동등한 forward-looking
    지시문을 최소한 복원하거나, (b) 이상적으로는 `.claude/tests/test_workflow_scripts.py` 와
    같은 패턴으로 backend 에 `.transaction(` 블록을 전수 스캔해 `updateExecutionStatus` 호출이
    트랜잭션 콜백 안에 있는지 자동 검사하는 정적 가드 테스트를 추가해, "다음 사람이 또 수동
    감사를 반복"하지 않게 한다.

- **[WARNING]** 테스트 파일명 리네임(`test_workflow_shared_block.py` → `test_workflow_scripts.py`)
  참조가 3개 워크플로 파일에서 절반만 고쳐졌다 — 같은 파일 안 4줄 위에 스테일 참조가 남았다
  - 위치: `.claude/workflows/ai-review.js:109` (스테일) vs `:113`(수정됨) /
    `.claude/workflows/consistency-check.js:48`(스테일) vs `:52`(수정됨) /
    `.claude/workflows/merge-coordinate.js:58`(스테일) vs `:62`(수정됨)
  - 상세: `grep -n "test_workflow_shared_block\|test_workflow_scripts"` 로 각 파일을 직접
    열어 확인했다. `.claude/workflows/_lib/agent-return.mjs` (정본)는 두 참조(줄 15, 48) 모두
    `test_workflow_scripts.py` 로 정확히 고쳐졌지만, 3개 mirror 파일은 `>>> SHARED-BLOCK` 마커
    줄의 참조만 고치고 그 바로 위 "Report-return contract — MIRROR of..." 블록 안의 동일 문장
    (`` `.claude/tests/test_workflow_shared_block.py` 가 fails the build if these drift
    apart `` )은 그대로 남겼다. 이 diff 자체가 "SHARED-BLOCK 이 verbatim 미러링을 보장한다"는
    전제를 세우는 참인데, 그 전제 **바로 옆줄**에서 미러링이 깨진 것은 아이러니하다 — 다음
    사람이 `test_workflow_shared_block.py` 를 찾다가 존재하지 않는 파일임을 뒤늦게 알게 된다.
  - 제안: 3개 파일의 스테일 줄을 `test_workflow_scripts.py` 로 맞추고, `grep -rn
    test_workflow_shared_block` 전수 재확인(현재 `review/code/2026/08/30/20_21_06/scope.md`,
    `security.md` 에도 같은 문자열이 남아 있으나 이는 리뷰 산출물이라 이 PR 범위 밖으로 보임).

- **[INFO]** 신규 회귀 테스트 2건(`step 1 tells the agent the FILE gets markdown only`,
  `steps 2 and 3 are scoped to the RETURN message`)은 뮤테이션 검증을 통과했다 — 양호
  - 위치: `.claude/tests/test_agent_return.mjs:109-125`, `:127-138`
  - 상세: 직접 재현한 뮤테이션(계약 문구를 초판으로 되돌림)에서 신규 2건만 RED, 기존 11건은
    GREEN 이었다 — plan 문서(`backend-lint-gate-broken-on-main.md`)의 "뮤테이션이 회귀 테스트
    부재를 드러냈다" 서술과 정확히 일치한다. 두 테스트 모두 mock/stub 없이 순수 문자열 매칭이고
    서로 독립적으로 실행 가능해 격리 문제가 없다. 텍스트 위치를 `indexOf('1)')`/`indexOf('2)')`
    로 슬라이스하는 방식은 다소 취약(향후 계약 문구가 "2)" 라는 리터럴을 step 1 본문에
    우연히 포함시키면 오탐 가능)하지만, 현재는 정확히 의도한 3줄 범위만 잘라내고 있고
    실측으로 검증됐으므로 당장 조치가 필요한 결함은 아니다.

- **[INFO]** `.claude/workflows/ai-review.js` / `consistency-check.js` / `merge-coordinate.js`
  에 대한 이번 diff 는 `REPORT_RETURN_CONTRACT` 문자열과 주석만 변경했고 함수 로직은
  변경하지 않았다 — 신규 기능 테스트가 필요 없는 범위이며, verbatim 미러 무결성은
  `test_workflow_scripts.py::SharedBlockDriftTest::test_every_fan_out_workflow_mirrors_the_block_verbatim`
  가 계속 커버한다(실행 확인, PASS).

## 요약

핵심 로직 변경(`parseAgentReturn` 등)은 없고 프롬프트 계약 문구·주석만 바뀐 diff라 테스트
표면은 작지만, 추가된 2개 유닛 테스트는 실제로 뮤테이션 검증을 거쳤고(직접 재현 확인) 정확히
의도한 회귀만 잡는다는 점에서 양호하다. 다만 같은 diff 안에서 두 가지 "부분 수정" 패턴이
관측됐다 — (1) 파일명 리네임 참조가 3개 mirror 파일에서 절반만 고쳐졌고, (2) 별개 파일
(`execution-engine.service.ts`)의 self-deadlock JSDoc 이 "다음 사람이 재확인해야 한다"는
유일한 방어 문구를 삭제하면서도 그 불변식을 지키는 자동 테스트는 여전히 없다. 둘 다 즉각적인
런타임 결함은 아니지만, 프로젝트가 반복 학습한 "narrow fix — 자매 위치 미적용" 클래스에 해당해
WARNING 으로 표기한다.

## 위험도
LOW
