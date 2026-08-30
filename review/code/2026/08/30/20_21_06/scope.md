# 변경 범위(Scope) 리뷰 — scope.md

## 발견사항

- **[WARNING]** 서로 무관한 두 결함 수정이 한 커밋(`7d6854cb9`)에 섞여 있다 — report-return 계약 fix 와 `updateExecutionStatus` self-deadlock 호출 스택 감사가 별개 주제인데 함께 커밋됐다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8577-8591` (JSDoc 코멘트 블록), `plan/in-progress/backend-lint-gate-broken-on-main.md:289-301` (해당 항목 체크리스트)
  - 상세: 이 changeset 은 두 개의 독립된 주제를 담고 있다.
    1. 파일 1~5(`.claude/tests/test_agent_return.mjs`, `.claude/workflows/_lib/agent-return.mjs`, `ai-review.js`, `consistency-check.js`, `merge-coordinate.js`) — `REPORT_RETURN_CONTRACT` 가 `output_file`(파일)과 반환 메시지(2개의 다른 sink)를 구분하지 않아 STATUS 헤더/구분자가 리뷰 산출물 본문에 새는 결함의 수정. 서로 긴밀히 결합돼 있고(정본 + 3개 워크플로 verbatim 미러 + 회귀 테스트) 일관된 하나의 의도다.
    2. 파일 6(`execution-engine.service.ts`) — `updateExecutionStatus` self-deadlock 확인의 "호출 스택 축"을 새로 감사해 JSDoc 에 결과를 추가한 것. 코드 로직 변경은 전혀 없고 주석뿐이지만, 주제 자체가 (1)의 STATUS/구분자 계약과 아무 관련이 없다.
    실제로 커밋 메시지 자체가 `fix(harness): 리뷰 산출물 헤더 누출의 발생원 + self-deadlock 확인의 호출 스택 축` 로 "+" 를 써서 두 작업을 명시적으로 이어붙였고, `git log origin/main..HEAD` 결과 이 changeset 전체가 **단일 커밋**임을 확인했다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 diff 도 같은 커밋 안에서 서로 다른 체크리스트 항목 두 개(self-deadlock 호출 스택 축 완료, 헤더 누출 발생원 완료)를 동시에 `[x]` 로 닫고 있어, 두 작업이 계획 단계에서도 별개 트래킹 항목이었음을 스스로 보여준다.
    이 프로젝트가 이미 학습한 원칙과도 배치된다 — 같은 plan 파일 안에 "무관한 대량 정리를 같은 커밋에 섞지 않기 위해서다" 라는 서술이 남아 있는데(다른 항목에 대한 언급이지만 원칙은 동일), 정작 이번 커밋은 서로 다른 두 결함을 하나로 묶었다.
  - 제안: 기능적 위험은 낮다(파일 6 변경은 순수 주석 추가이며 로직 변경 없음, 두 작업 모두 자체적으로 잘 문서화·근거 제시됨). 다만 향후에는 커밋/PR 단위를 주제별로 분리해, 리뷰·되돌리기·이력 추적 시 두 개의 독립된 결정이 하나의 diff 로 얽히지 않게 하는 편이 낫다. 이미 머지된 커밋이므로 지금 되돌릴 필요는 없다고 판단되면 그 판단을 plan/PR 설명에 명시할 것.

- **[INFO]** 가드 테스트 파일명 오기 정정(`test_workflow_shared_block.py` → `test_workflow_scripts.py`)이 본 PR 의 주 목적(파일 vs 반환 메시지 sink 분리)과는 별개의 사실 정정이지만, 같은 SHARED-BLOCK 주석 안에 있어 손을 대지 않을 수 없는 위치다
  - 위치: `.claude/workflows/_lib/agent-return.mjs:15,48`, `.claude/workflows/ai-review.js:113`, `.claude/workflows/consistency-check.js:52`, `.claude/workflows/merge-coordinate.js:62`
  - 상세: 저장소에는 `test_workflow_shared_block.py` 파일이 존재한 적이 없고(`git log --all -- .claude/tests/test_workflow_shared_block.py` 결과 없음) `test_workflow_scripts.py` 만 존재한다(`f562c04f6` 최초 도입). 즉 기존 주석이 애초부터 잘못된 가드 파일명을 가리키고 있었고, 이 PR 이 그것을 바로잡았다. 정본(`_lib/agent-return.mjs`)과 3개 워크플로 미러 전부에 동일하게 반영해야 mirror-drift 가드가 유지되므로, 4곳 모두 고친 것은 drive-by 가 아니라 필수 동반 수정이다.
  - 제안: 조치 불요 — scope 위반이 아니라 정확한 미러 유지에 필요한 수정으로 판단된다. 참고용으로만 기록.

- **[INFO]** 파일 1~5 내부는 서로 강하게 결합돼 있어 (정본 1개 + verbatim 미러 3개 + 회귀 테스트 1개) 별도 파일로 분리돼 있음에도 실질적으로 하나의 원자적 변경이다
  - 위치: `.claude/workflows/_lib/agent-return.mjs`, `.claude/workflows/ai-review.js`, `.claude/workflows/consistency-check.js`, `.claude/workflows/merge-coordinate.js`, `.claude/tests/test_agent_return.mjs`
  - 상세: 워크플로 샌드박스가 `import` 를 지원하지 않아(`_lib/agent-return.mjs` 파일 헤더에 명시) 3개 워크플로 파일이 정본을 verbatim 으로 복사해 유지하는 것이 이 코드베이스의 기존 관례다. 5개 파일의 diff 가 100% 동일한 편집(REPORT_RETURN_CONTRACT 재작성 + 가드 파일명 정정)을 반복하는 것은 리팩토링이 아니라 이 관례를 지키기 위한 필수 동반 수정이며, 신규 테스트 2개도 같은 계약을 고정하는 회귀 테스트로 범위 안에 있다.
  - 제안: 조치 불요.

## 요약

이 changeset 은 커밋 하나에 실질적으로 서로 무관한 두 결함 수정을 담고 있다 — (1) 파일 1~5 에 걸친 `REPORT_RETURN_CONTRACT`(파일 vs 반환 메시지 sink 분리) 수정과 (2) 파일 6 의 `execution-engine.service.ts` self-deadlock 호출 스택 축 JSDoc 추가(순수 주석, 로직 변경 없음)다. 두 작업 모두 자체적으로 근거·측정치·테스트가 잘 갖춰져 있고 기능적 위험은 낮지만, 서로 다른 주제가 하나의 커밋으로 묶인 것은 이 리뷰 관점(scope)에서 명확한 지적 대상이다. 파일 1~5 내부의 반복적인 diff 는 워크플로 샌드박스의 import 제약 때문에 필요한 verbatim 미러링이며 리팩토링/drive-by 가 아니다. 가드 테스트 파일명 정정도 정본과 미러 4곳 모두에 필요한 동반 수정으로 판단된다.

## 위험도

MEDIUM
