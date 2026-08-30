# 테스트(Testing) 리뷰

## 컨텍스트 (5라운드째 리뷰)

이번 diff(`origin/main..HEAD`, 6개 커밋)는 `.claude/tests/test_agent_return.mjs` 신규 단언
2건, `.claude/tests/test_workflow_scripts.py` 신규 서브테스트 1건을 포함하고, 나머지는
harness 프롬프트 문구·`execution-engine.service.ts` JSDoc·plan 문서·**이전 4라운드
(`20_21_06`/`20_46_48`/`21_12_21`/`21_34_15`) 리뷰 산출물의 커밋**이다. 이미 네 라운드가
Critical 0 을 유지한 채 WARNING 을 5 → 1 → 0 으로 닫았고, 그 라운드들의 `testing.md` 가 같은
관점을 이미 상세히 다뤘다. 아래는 그 결론을 액면으로 받지 않고 직접 재실행·재검증한 결과다.

## 검증 절차 (재현, 저장소 뮤테이션 없음)

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 PASS** (직접 실행 확인).
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -v` → **6 passed / 17 subtests
  passed** (직접 실행 확인, 신규 `test_guard_filename_references_point_at_this_file` 포함).
- `execution-engine.service.ts` JSDoc 의 세는 방법 안내(제네릭 포함·주석 제외 시 36, 제네릭
  누락 시 35, 주석 포함 시 39)를 `grep`으로 독립 재현: 정확히 **36 / 35 / 39** — 세 수치
  전부 일치. `src/modules/execution-engine/` 안 9개도 일치.
- `grep -rn "2026-08-31"`(소스 전수, `review/**` 제외) → 0건 — 이전 라운드가 잡은 오지 않은
  날짜 잔여 없음.
- 저장소 파일은 읽기 전용으로만 다뤘다. `git status --short` 는 이 세션 자신의 출력 디렉터리
  외 변경 없음.

## 발견사항

- **[INFO]** 신규 pytest 가드의 정규식이 **전체 경로 접두어**를 요구해, 접두어 없는 stale
  참조는 통과시킨다 (현재 실제 사례는 없음 — 이론적 사각지대)
  - 위치: `.claude/tests/test_workflow_scripts.py` — `test_guard_filename_references_point_at_this_file`
    (`stale = re.compile(r"\.claude/tests/(test_\w+\.py)")`)
  - 상세: 이 정규식은 `.claude/tests/test_xxx.py` 형태만 매치한다. 만약 미래에 헤더 주석이
    "가드: `test_workflow_scripts.py`" 처럼 경로 접두어 없이 파일명만 적으면(현재 4개 대상
    파일 어디에도 그런 형태는 없음 — `grep` 으로 전수 확인) 이 가드는 구조적으로 못 잡는다.
    이 테스트 자체의 존재 이유가 "마커 밖 텍스트는 SHARED-BLOCK 가드의 사각지대"였는데, 그
    사각지대를 닫으면서 좁은 조건(정확한 경로 문자열)에만 반응하는 정규식을 썼다 — 이
    프로젝트가 반복 기록한 "방어의 정의를 한 칸 좁게 잡는다" 패턴과 형태가 같다.
  - 제안: 당장 조치 불요(실제 사례 없음, hypothetical). 다음에 이 가드를 만질 기회가 있으면
    정규식을 `(?:\.claude/tests/)?(test_\w+\.py)` 로 넓혀 접두어 유무와 무관하게 잡는 것을
    고려.

- **[INFO]** 같은 가드는 "이 4개 파일이 언급하는 모든 `test_*.py` 는 자기 자신이어야 한다"는
  다소 넓은 가정을 암묵적으로 깔고 있다
  - 위치: 상동 (`test_guard_filename_references_point_at_this_file`)
  - 상세: 정규식은 필터 없이 `LIB`/`FAN_OUT` 4개 파일 전체 텍스트에서 `test_\w+\.py` 패턴을
    모두 뽑아 `me`(`test_workflow_scripts.py`) 와 비교한다. 지금은 이 4개 파일이 정확히
    그 가드 파일 하나만 언급하므로 문제가 없지만, 향후 누군가 이 근처에 "관련 테스트는
    `test_something_else.py` 도 참고" 같은 **정당한** 교차 참조 주석을 추가하면 이 가드가
    거짓 실패를 낸다. 의도(가드 파일명 드리프트 방지)에 비해 매칭 범위가 넓다.
  - 제안: 당장 조치 불요. 실제로 그런 교차 참조가 생기면 매칭 대상을 `SHARED-BLOCK` 헤더
    주석 블록(예: "Report-return contract — MIRROR of..." ~ 마커 시작 사이)으로 좁히는 것을
    고려.

- **[INFO, 확인]** 이 PR 의 실제 결함("agent 가 계약 문구를 못 따라 파일에 STATUS 헤더가
  샌 것")은 프롬프트 **문구**가 아니라 LLM 이 그 문구를 실제로 따르는지에 있다 — 이는
  구조적으로 단위 테스트로 증명 불가능하고, plan 이 그 사실을 정확히 반영해 열어 두고 있다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:311`
    (`- [ ] **새 계약이 실제 실행 경로에 붙는지 다음 세션에서 확인**`)
  - 상세: 신규 mjs 테스트 2건은 "계약 **문자열**이 파일/반환 메시지를 올바르게 구분해
    서술하는가"만 단언할 수 있다(그리고 뮤테이션으로 non-vacuous 함이 4라운드에 걸쳐
    검증됐다 — 재확인함, 13/13 GREEN). 그러나 이 문구가 실제 프로덕션 fan-out 호출에서
    agent 의 행동을 바꾸는지는 이 세션 안에서는 원리적으로 검증 불가능하다는 사실이 이미
    `21_12_21` 라운드에서 실측(persisted 워크플로 스크립트 18개가 세션 시작 스냅샷으로 고정)
    으로 확정됐고, 그 체크박스는 **`[ ]`(미완)** 로 정직하게 열려 있다 — "완료" 로 거짓
    닫히지 않았음을 직접 파일을 열어 확인했다. 결함이 아니라 양호 사례로 기록한다.
  - 제안: 조치 불요. 다음 top-level 세션에서 `grep -c "마크다운 본문만" <persisted script>`
    확인이 필요하다는 plan 의 절차를 그대로 따를 것.

- **[INFO, 확인]** 신규 회귀 테스트 2건은 pure-function/pure-string 단언뿐이라 mock 이 없고
  테스트 간 상태 공유도 없어 격리가 양호하다 — 뮤테이션 검증도 재현됨
  - 위치: `.claude/tests/test_agent_return.mjs` — `step 1 tells the agent the FILE gets
    markdown only …`, `steps 2 and 3 are scoped to the RETURN message …`
  - 상세: `REPORT_RETURN_CONTRACT` 문자열 상수만 다루며 외부 I/O·타이머·전역 상태가 전혀
    없다. 두 테스트를 개별로 돌려도, 파일 전체로 돌려도 결과가 같다(순서 의존 없음). 이전
    라운드가 기록한 뮤테이션 결과(구버전 3줄로 되돌리면 신규 2건만 RED, 기존 11건 GREEN)는
    이번에 직접 재실행하지는 않았으나(저장소 뮤테이션 최소화 원칙에 따름), 코드를 읽어보면
    두 단언 모두 신 문구에만 있는 리터럴(`마크다운 본문만`, `넣지 마세요`, `반환 메시지`)에
    의존하므로 그 재현 결과는 신뢰할 만하다.
  - `indexOf('1)')`/`indexOf('2)')` 문자열 리터럴 슬라이스는 계약 문구가 늘어나 우연히
    같은 리터럴이 다른 위치에 등장하면 취약해질 수 있다는 점은 `20_46_48`/`21_34_15` 라운드가
    이미 INFO 로 지적하고 "다음에 계약을 만질 때 배열 인덱스/명명 상수로 리팩터 고려"로
    유예했다 — 이번 라운드에도 그 지점은 코드가 바뀌지 않아 재확인 외에 새로 더할 내용이
    없다.

## 확인된 양호 사항

- `parseAgentReturn`/`usable`/`inlineReports`/`needPersistList`/`needReadList` 를 검증하는
  기존 11개 테스트는 이번 diff 가 계약 **문구**만 바꾸고 파싱 로직은 그대로 두었으므로 회귀
  없이 유효함을 직접 실행으로 재확인했다(13/13, 새 2건 포함).
- `execution-engine.service.ts` 는 diff 전체가 JSDoc 프로즈이고 실행 코드 변경이 없어(직접
  파일을 열어 hunk 범위 확인) 이 파일에 대해 새 단위 테스트가 필요하지 않다는 판단은 타당하다.
  다만 이 JSDoc 자체가 "수동으로 세어 재확인하라"는 절차서 역할을 하고 있고, 그 불변식(트랜잭션
  콜백 안에서 `updateExecutionStatus` 호출 금지)을 지키는 자동 정적 가드는 여전히 없다 — 이미
  `20_46_48` W2 라운드가 "AST 수준이라야 하고, 정규식으로 하면 이 저장소가 반복 기록한 '유한한
  문제를 무한한 문제와 바꾸지 말 것' 에 걸린다"는 근거로 유예했다. 그 근거는 여전히 유효하다고
  판단해 재상향하지 않는다.
- 3개 워크플로 미러(`ai-review.js`/`consistency-check.js`/`merge-coordinate.js`)의
  `SHARED-BLOCK` 구간은 `test_every_fan_out_workflow_mirrors_the_block_verbatim` 이 여전히
  byte-identical 을 보증하고, 그 가드의 사각지대(마커 밖 로컬 헤더)는 이번 diff 의 신규
  `test_guard_filename_references_point_at_this_file` 로 닫혔다 — 좋은 설계 패턴이다: 파일명을
  하드코딩하지 않고 `Path(__file__).name` 과 대조해 다음 리네임에도 단언이 따라간다.
- `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21,21_34_15}/**` 는 실행되는 애플리케이션
  코드가 아니라 이전 리뷰 라운드의 정적 기록이므로, 테스트 부재를 지적할 대상이 아니다.

## 요약

이번 diff 의 테스트 표면은 작다 — 계약 **문구** 정정에 대응하는 mock-free 단위 테스트 2건과,
그 문구가 이미 겪은 실제 드리프트 사각지대(마커 밖 로컬 헤더)를 닫는 pytest 서브테스트 1건
뿐이며, 셋 다 직접 재실행해 GREEN 을 확인했고 뮤테이션 비-vacuous 성도 코드 검토로 재확인했다.
기존 11개 파싱 테스트는 회귀 없이 유효하다. 이번 라운드에서 새로 찾은 것은 신규 pytest 가드의
정규식이 경로 접두어를 요구해(현재 실사례 없음) 아주 좁은 형태 변형을 놓칠 수 있다는 점과,
같은 가드가 "이 4곳은 자기 자신만 언급해야 한다"는 다소 넓은 가정을 깔고 있다는 점 — 둘 다
당장 조치가 필요한 결함이 아니라 향후 그 가드를 다시 만질 때 고려할 사항이다. 이 PR 이 고치는
실제 결함(agent 의 프롬프트 준수)은 단위 테스트로 증명 불가능한 종류이고, plan 이 그 사실을
정확히 인지해 검증 절차를 미완(`[ ]`)으로 정직하게 열어 두고 있다는 점도 확인했다 — 거짓
"완료" 로 닫히지 않았다.

## 위험도

LOW
