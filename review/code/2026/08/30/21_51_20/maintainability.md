# 유지보수성(Maintainability) 리뷰

## 검증 메모

이 changeset 은 origin/main 대비 5개 커밋(`5a33656f9`~`babc28bc6`)의 누적 diff이며, 그중
4라운드(`20_21_06`/`20_46_48`/`21_12_21`/`21_34_15`)의 유지보수성 리뷰가 이미 같은 파일들을
반복 검토·수정한 이력이 있다. 프롬프트 상 diff 는 크기 제한으로 일부 생략돼 있어, 실제
소스 7개 파일(`.claude/tests/test_agent_return.mjs`, `.claude/tests/test_workflow_scripts.py`,
`.claude/workflows/_lib/agent-return.mjs`, `ai-review.js`, `consistency-check.js`,
`merge-coordinate.js`, `execution-engine.service.ts`)과 plan 문서 3개를 `Read`/`grep` 으로
직접 열어 **현재 저장소 상태**를 기준으로 재검토했다. 저장소에는 아무것도 쓰지 않았다
(`git status --short` 는 신규 세션 디렉터리 외 clean).

확인된 사실:
- 4개 파일(`_lib/agent-return.mjs` + 3개 워크플로)의 `SHARED-BLOCK`~`<<< SHARED-BLOCK` 구간을
  `awk` 로 추출해 diff — **바이트 단위로 완전히 동일**(verbatim 미러링 정상).
- `test_workflow_shared_block.py` 잔여 참조 — 소스 트리(`.claude/workflows/`,
  `.claude/tests/`) 전수 grep 결과 **0건**. 이전 라운드(`20_21_06`)가 지적한 "마커 밖 헤더
  주석 절반만 리네임" 문제는 완전히 해소됐다.
- `execution-engine.service.ts` 의 `updateExecutionStatus` JSDoc 은 현재 32줄
  (8553~8584행)로, `20_46_48` 라운드에서 지적된 "세대별 개정 서사가 누적돼 49줄까지 자람"
  문제가 해소되고 세부 이력은 `plan/in-progress/backend-lint-gate-broken-on-main.md`
  (289~306행, 표 형식)로 옮겨져 있다.

## 발견사항

- **[INFO]** 신규 회귀 테스트 2건이 계약 문구의 번호 리터럴(`'1)'`/`'2)'`/`'3)'`)에 문자열
  위치로 결합돼 있다
  - 위치: `.claude/tests/test_agent_return.mjs:109-125`(특히 113행
    `REPORT_RETURN_CONTRACT.indexOf(step1)`, 114행 `fileClause.indexOf('2)')`),
    `:127-138`(`lines.find(l => l.trim().startsWith(n))`, `n` 이 `'2)'`·`'3)'`)
  - 상세: `REPORT_RETURN_CONTRACT` 배열이 향후 번호 체계를 바꾸거나(예: "①" 표기),
    본문 산문 어딘가에 우연히 `2)` 라는 부분 문자열이 더 일찍 등장하면 `indexOf` 가
    의도치 않은 지점에서 슬라이스해 조용히 다른 위치를 비교하게 된다. 현재는 계약 문구를
    구버전으로 되돌리는 뮤테이션에서 정확히 신규 2건만 RED 가 됨을 실측 확인했으므로
    지금 당장 vacuous 는 아니다 — 다만 결합 자체의 취약성은 남아 있고, 이는 직전 라운드
    (`20_46_48` maintainability INFO)에서도 동일하게 지적되고 조치 불요로 유예된 항목이라
    새 결함은 아니다.
  - 제안: 당장 조치는 불요. 향후 `REPORT_RETURN_CONTRACT` 를 다시 손댈 일이 생기면, 번호
    리터럴 매칭 대신 각 단계를 명명된 배열 인덱스나 구조화된 객체로 분리해 파싱 취약성을
    없애는 리팩터를 함께 고려할 것.

- **[INFO]** `.transaction(` 감사 수치(20/36/9/27/35/39)가 코드 JSDoc 과 plan 문서 두 곳에
  거의 동일한 문장으로 중복 기재돼 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8571-8583`
    vs `plan/in-progress/backend-lint-gate-broken-on-main.md:289-306`
  - 상세: JSDoc 은 "현재 스냅샷"만 담고 세대별 정정 이력은 plan 의 표로 옮겨졌지만, 최신
    수치 자체(20곳/36개/9/27, 세는 패턴의 두 함정 35·39)는 여전히 양쪽에 따로 적혀 있다.
    한쪽만 갱신되면 두 SoT 가 어긋날 수 있다. 다만 이는 `20_21_06`/`20_46_48` 라운드에서
    이미 같은 구조로 지적·인지됐고, JSDoc 쪽 서술("이 수치가 세 판에 걸쳐 어떻게
    틀렸다 고쳐졌는지는 plan 의 해당 항목에 있다")이 plan 을 SoT 로 가리키도록 명시적으로
    설계돼 있어 완전한 무단 중복은 아니다 — 코드를 읽는 사람에게 필요한 최소 정보(현재
    유효한 제약)는 JSDoc 에, 이력은 plan 에 있는 구조로 이미 상당히 개선된 상태다.
  - 제안: 조치 불요. 다음에 이 수치를 갱신할 일이 생기면 JSDoc 을 고치고 plan 표에도
    반영하는 두 곳 동시 갱신을 잊지 말 것 — 자동 가드는 없다(JSDoc 자신도 그렇게 명시).

- **[INFO, 확인]** 가드 테스트 파일명 리네임에 대한 신규 회귀 가드(`test_workflow_scripts.py`
  의 `test_guard_filename_references_point_at_this_file`)는 파일명을 하드코딩하지 않고
  자기 이름과 대조하는 설계로, 향후 같은 클래스의 드리프트를 구조적으로 방지한다 — 좋은
  패턴
  - 위치: `.claude/tests/test_workflow_scripts.py:114-140`
  - 상세: `Path(__file__).name` 을 정답으로 삼아 `LIB` + `FAN_OUT` 3개 파일 전체를
    라인 단위로 정규식(`\.claude/tests/(test_\w+\.py)`) 매칭해 대조한다. `_extract_block()`
    이 `SHARED-BLOCK` 마커 사이만 비교해 마커 밖 헤더 주석을 구조적으로 못 보는 사각지대를
    정확히 겨냥해 닫았다. 3중 for-루프(파일→줄→매치)가 있지만 각 단계가 얕고 목적이
    명확해 가독성에 문제는 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 4라운드에 걸친 자기 반복 리뷰·수정 사이클의 결과물로, 실제 소스 코드
(`.claude/workflows/_lib/agent-return.mjs` 및 3개 워크플로 미러, 신규 테스트 2건,
`execution-engine.service.ts` JSDoc)는 이미 상당히 정돈된 상태다: verbatim 미러 4곳이
바이트 단위로 일치하고, 이전 라운드에서 지적된 "가드 파일명 리네임 절반 반영"·"JSDoc
개정 서사 무한 누적" 문제 모두 구조적으로 해소됐다(정규식 기반 자기참조 가드 신설,
이력을 plan 표로 이관). 함수 길이·중첩 깊이·네이밍 컨벤션 모두 기존 코드베이스 패턴과
일관되며 새로 도입된 복잡도는 없다. 남은 것은 경미한 INFO 두 건뿐이다 — 신규 테스트의
번호-리터럴 문자열 결합(뮤테이션으로 vacuous 아님은 확인됨)과 감사 수치의 JSDoc/plan
이중 기재(의도적으로 plan 을 SoT 로 가리키는 구조라 완전한 무단 중복은 아님) — 둘 다 이미
이전 라운드에서 인지·유예된 사안이라 이번에 새로 발견된 결함은 없다.

## 위험도

LOW
