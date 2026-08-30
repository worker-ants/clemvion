# 테스트(Testing) 리뷰

## 검증 절차 (뮤테이션 재현)

리포지토리 트리는 건드리지 않고 scratch 디렉터리에서 재현했다(`git status --short` 로 전후 확인, 잔존물 없음):

- `.claude/workflows/_lib/agent-return.mjs` 를 scratch 로 복사해 `REPORT_RETURN_CONTRACT` 의 1)·2)·3) 항목을
  이 PR 이전 문구로 되돌리고(`test_agent_return.mjs` 도 scratch 로 복사해 import 경로만 mutant 를 향하도록 수정),
  `node --test` 로 실행 → **정확히 신규 2건만 RED, 기존 11건은 GREEN**(RESOLUTION.md 의 주장과 일치, 재현 성공).
- `node --test .claude/tests/test_agent_return.mjs` (원본, 무수정) → **13/13 PASS**.
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -q` → **5 passed, 9 subtests passed**.
- `git show 5a33656f9 -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 를
  `grep`으로 주석(`*`/`//`) 외 변경 줄만 필터 → **0줄**. 커밋 메시지의 "코드 동작 변경 0" 주장과 일치.

### 발견사항

- **[WARNING]** 드리프트 가드의 구조적 사각지대가 재발 이력이 있는데도 이번에도 자동 테스트로 닫히지 않았다
  - 위치: `.claude/tests/test_workflow_scripts.py` — `_extract_block()` 함수, `test_every_fan_out_workflow_mirrors_the_block_verbatim`
  - 상세: `_extract_block()`은 `text.find(BEGIN)` ~ `END` 사이만 잘라 4개 사본(정본+워크플로 3개)을 verbatim 비교한다. 이번 diff(파일 2~5)에서 정정한 두 종류의 문자열 중 `>>> SHARED-BLOCK: agent-return (... guard: ...)` 마커 줄은 이 범위 **안**이라 자동으로 검증되지만, 그 4~5줄 위의 "MIRROR of..."/"guard 파일명 언급" 로컬 헤더 주석은 마커 **밖**이라 이 가드가 구조적으로 볼 수 없다. `review/code/2026/08/30/20_21_06/RESOLUTION.md` 의 W1 서술 자체가 "내가 `guard: …` 가 붙은 형태로만 문자열 치환을 걸어 다른 문장 형태를 놓쳤다"고 명시한다 — 이번 diff 는 그 3곳(파일 3·4·5의 로컬 헤더 줄)을 **수동으로** 고치고 "저장소 전수 재확인"으로 검증했을 뿐, 사각지대 자체를 닫는 회귀 테스트는 추가하지 않았다. 같은 파일을 다음에 손대는 사람이 또 헤더 한 줄만 놓칠 수 있는 구조가 그대로 남아 있다 — 정확히 이번에 고친 결함 클래스가 재발할 수 있는 경로다.
  - 제안: `_extract_block()`의 비교 범위를 "MIRROR of..." 주석부터 END 마커까지로 넓히거나, 로컬 헤더의 가드 파일명 언급을 정규식으로 뽑아 실제 가드 테스트 경로(`Path(__file__).name`)와 일치하는지 별도로 단언하는 서브테스트를 추가할 것. (SUMMARY WARNING #1 의 제안과 동일 — 아직 미착수임을 테스트 관점에서 재확인)

- **[WARNING]** `.transaction(` 전수 카운트 불변식이 여전히 자동 가드 없이 사람의 수동 grep 에만 의존한다 (이전 라운드 testing WARNING 이 유예된 채 남음)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus` 메서드 상단 JSDoc(diff 게이트 8574~8601 범위, `updateExecutionStatus`)
  - 상세: 이 JSDoc 은 self-deadlock 방지를 위해 "backend 전체 `.transaction(` 블록 36개(제네릭 포함, 주석 제외)가 `updateExecutionStatus` 를 호출하지 않는다"는 불변식을 사람이 수동으로 grep 하여 확인한 서사를 담고 있다. 이번 diff 에서 그 서사가 갱신되긴 했지만, RESOLUTION.md/SUMMARY.md 가 기록하듯 리뷰어 두 명(`requirement` 35/26, `documentation` 36/27)이 **직접 셌는데도 서로 다른 수를 냈다** — 사람이 반복 재현해도 일관되지 않을 만큼 절차가 취약하다는 증거다. 그럼에도 이번 diff 는 forward-looking 지시문("새 호출부 추가 시 재확인")을 복원하고 세는 방법(제네릭 포함·주석 제외)을 문서화하는 데 그쳤고, `test_workflow_scripts.py` 류의 자동 정적 가드는 추가하지 않았다. 이는 전 라운드 SUMMARY의 testing WARNING #3("자동 정적 가드 테스트를 backend에 추가")가 이번 라운드에서도 실질적으로 미해결 상태로 넘어온 것이다.
  - 제안: `.transaction\s*(<[^>]*>)?\s*\(` 패턴으로 backend 전체를 스캔해 그 콜백 본문(AST 또는 정규식 기반)이 `updateExecutionStatus`/`this.updateExecutionStatus` 를 참조하지 않는지 검사하는 정적 가드 unit test 를 backend 쪽에 추가할 것. 수동 grep 의 재현 불일치가 이미 실측됐으므로 우선순위를 올릴 것을 권고.

### 확인된 양호 사항 (참고)

- 신규 unit test 2건(`step 1 tells the agent the FILE gets markdown only...`, `steps 2 and 3 are scoped to the RETURN message...`, `.claude/tests/test_agent_return.mjs`)은 pure function(`REPORT_RETURN_CONTRACT` 문자열)만 다뤄 mock 이 전혀 없고, 테스트 간 상태 공유도 없어 격리가 양호하다. 위 절차대로 뮤테이션을 직접 재현해 **RED 2 / GREEN 11** 을 확인했다 — vacuous 아님.
- `parseAgentReturn`/`usable`/`inlineReports`/`needPersistList`/`needReadList` 를 검증하는 기존 9개 테스트는 이번 diff 가 계약 **문구**만 바꾸고 파싱 로직은 그대로 두었으므로 회귀 없이 유효하다(직접 실행하여 13/13 확인).
- 3개 워크플로 파일(`ai-review.js` 등)은 top-level `return` 때문에 `node --test` 로 직접 로드할 수 없어, verbatim 미러링 여부는 오직 `test_workflow_scripts.py` 의 `test_every_fan_out_workflow_mirrors_the_block_verbatim` 에 의존한다 — 직접 실행해 통과를 확인했다(정상).
- `review/code/2026/08/30/20_21_06/**` (RESOLUTION.md·SUMMARY.md·`_retry_state.json`·meta.json·per-reviewer `*.md`)는 실행되는 애플리케이션 코드가 아니라 이전 라운드 리뷰 세션의 정적 기록이므로, 테스트 부재를 지적할 대상이 아니다.

### 경미한 참고 (INFO, 상향 불요)

- `.claude/tests/test_agent_return.mjs` 의 신규 두 테스트는 `REPORT_RETURN_CONTRACT.indexOf('1)')`/`indexOf('2)')` 문자열 탐색과 `lines.find(l => l.trim().startsWith(n))` 방식으로 계약 문구를 슬라이싱한다. 현재는 정확히 의도한 범위만 잘라내지만(직접 확인함), 문자열 매칭 기반이라 계약 문구가 더 늘어나 다른 위치에 "1)"/"2)" 같은 부분 문자열이 등장하면 오탐 여지가 있다. 이미 이전 라운드 SUMMARY(INFO #6)에서 동일 취약성이 지적·처분(조치 불요)됐으므로 이번 라운드에서 등급을 올리지 않고 참고로만 남긴다.

## 요약

이번 diff 의 실제 동작 변경은 리뷰 계약 **문구**(파일 sink vs 반환 메시지 sink 분리) 하나뿐이고, backend 코드(`execution-engine.service.ts`)와 plan 문서는 순수 주석·서술 변경이다. 계약 문구 변경에 대해서는 mock 없는 pure-function 단위테스트 2건이 추가됐고, 그 비-vacuous 성을 직접 뮤테이션으로 재현·검증했다(RED 2/GREEN 11) — 이 부분의 테스트 품질은 양호하다. 다만 이 PR 이 고친 두 결함(가드 파일명 로컬 헤더 드리프트, `.transaction(` 수동 카운트 불일치)은 모두 "사람이 수동으로 재확인해서 고쳤다"는 서사로 마무리됐을 뿐, 재발을 막는 자동 테스트는 이번에도 추가되지 않았다 — 특히 로컬 헤더 드리프트는 방금 고친 바로 그 파일들에서 구조적으로 여전히 무방비이고, `.transaction(` 카운트는 사람이 직접 세어도 두 리뷰어가 갈릴 만큼 신뢰도가 낮다는 사실이 이번 라운드 자체에서 실측됐다. 기능적 회귀 위험은 없으나(코드 동작 변경 0, 직접 확인) 동일 결함 클래스의 재발 가능성은 테스트 미비로 열려 있다.

## 위험도
LOW
