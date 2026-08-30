# 유지보수성(Maintainability) 리뷰

## 검증 방법

저장소 파일은 수정하지 않았다(`Read`/`Grep`/`Bash` 읽기 전용). 이 diff 는 이미 세 라운드
(`20_21_06` → `20_46_48` → `21_12_21`)에 걸쳐 유지보수성 관점으로 촘촘히 검토됐고, 그
라운드들의 WARNING/INFO 가 실제 최종 상태에 반영됐는지를 직접 재확인하는 데 집중했다:

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 PASS**.
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -q` → **6 passed / 17 subtests**.
- `grep -rn "2026-08-31" …` (JSDoc·plan·계약 5곳) → **0건**(`20_46_48` W3 "오지 않은 날짜 11곳"
  잔여 없음).
- `grep -rln "test_workflow_shared_block" --include="*.js" --include="*.mjs" --include="*.py" --include="*.ts" .` (review/** 제외) → 유일한 매치는
  `.claude/tests/test_workflow_scripts.py`(신규 테스트가 과거 드리프트 사건을 설명하는
  docstring 인용, 참조 아님). `ai-review.js`/`consistency-check.js`/`merge-coordinate.js` 의
  "Editing rule" 헤더 주석과 `SHARED-BLOCK` 마커 줄 모두 `test_workflow_scripts.py` 로 통일돼
  있다(`20_21_06` W1 완전 해소, 직접 파일을 열어 확인).
- `execution-engine.service.ts:8571-8582` 의 `updateExecutionStatus` JSDoc 을 직접 읽었다.
  `21_12_21` maintainability 라운드가 지적한 "9 가 두 무관한 집합(호출부 개수/블록 개수)을
  가리켜 혼동 여지가 있다" 는 이번 최종 상태에 **"이 9는 블록 수라 앞의 '경유 9곳' 과 무관한
  집합이다"** 라는 괄호 명시로 해소돼 있다(`21_12_21` 이후 추가 커밋으로 반영된 것으로 보임).
- `git status --short` → 세션 산출물 디렉터리(`review/code/2026/08/30/21_34_15/`) 외 잔여물 없음.

## 발견사항

- **[INFO]** 신규 회귀 테스트 2건이 계약 문구를 `indexOf('1)')`/`indexOf('2)')` 문자열 리터럴로
  슬라이스해 찾는다 — 문구 결합이 다소 취약함
  - 위치: `.claude/tests/test_agent_return.mjs` — `step 1 tells the agent the FILE gets
    markdown only …` 테스트(113~114행), `steps 2 and 3 are scoped to the RETURN message …`
    테스트(129~130행)
  - 상세: `REPORT_RETURN_CONTRACT.split('\n').find(l => l.trim().startsWith('1)'))` 와
    `fileClause.indexOf('2)')` 로 계약 배열의 특정 줄을 찾는다. 앞으로 계약 문구를 고치면서
    본문 어딘가(예: step 1 설명 안)에 우연히 리터럴 `"2)"` 가 들어가면 슬라이스 경계가
    틀어져 오탐/누락이 생길 수 있다. 이미 `20_46_48` maintainability 라운드가 같은 지점을
    INFO 로 지적하고 "당장 조치 불요, 다음에 계약을 다시 만질 때 배열 인덱스/명명 상수로
    리팩터 고려"로 유예한 항목이며, 이번 라운드까지 코드가 그 지점에서 변경되지 않아 재확인
    외에 새로 추가할 내용은 없다.
  - 제안: 지금 당장 조치는 불요. `REPORT_RETURN_CONTRACT` 를 다음에 편집할 기회에, 배열
    인덱스(`REPORT_RETURN_CONTRACT_LINES[0]` 류) 또는 named 상수로 각 단계를 참조하도록
    리팩터하면 문구 변경에 덜 취약해진다.

- **[INFO]** self-deadlock 감사 수치(`.transaction(` 36 = 모듈 안 9 + 밖 27)가 JSDoc 과 plan
  문서 두 곳에 거의 동일한 문장으로 중복 기재돼 있다 — SoT 가 둘로 갈린 상태
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8571-8572`
    (JSDoc "현재 스냅샷"), `plan/in-progress/backend-lint-gate-broken-on-main.md:291-293`
    (후속 체크리스트 항목 본문)
  - 상세: 이번 라운드에서 JSDoc 은 "현재 스냅샷 + 남는 한계 + 재대조 지시"만 남기고 세대별
    개정 서사는 plan 문서의 정정 이력 표로 옮겨 무한 누적 문제(`20_46_48` W5)를 잘 해소했다.
    다만 그 과정에서 **같은 정량 수치(36/9/27)가 JSDoc 요약과 plan 본문 양쪽에 독립적으로
    남았다** — 향후 새 호출부·`.transaction(` 블록이 추가돼 이 수치를 갱신해야 할 때, JSDoc
    만 고치고 plan 을 놓치거나 그 반대가 되면 두 사본이 다시 어긋날 수 있다. 이 프로젝트가
    이미 반복 학습한 "narrow fix — 자매 위치 미적용" 클래스와 같은 모양이다. 다만 JSDoc 쪽이
    plan 문서를 "해당 항목에 있다" 로 명시적으로 가리키고 있어 완전한 암묵적 중복은 아니다.
  - 제안: 지금 당장 병합할 필요는 없다(JSDoc 은 코드 옆 요약, plan 은 이력 — 역할이 다르다는
    것이 이전 라운드의 근거였고 타당하다). 다만 다음에 이 수치를 다시 대조할 때는 JSDoc 을
    갱신한 뒤 plan 의 같은 문장도 함께 고치는 것을 편집 체크리스트에 명시해 두면 재발을
    막을 수 있다.

## 확인 사실 (조치 불요, 참고용)

- 세 라운드에 걸쳐 지적됐던 실질적 유지보수성 문제 — 가드 테스트 파일명 리네임의 절반 반영
  드리프트(`20_21_06`), JSDoc 서사 무한 누적(`20_21_06`/`20_46_48`), 오지 않은 날짜 11곳
  (`20_46_48`), forward-looking 지시문 삭제(`20_46_48`) — 는 모두 이번 최종 상태에서 실측
  재확인 가능하게 해소돼 있다.
- `.claude/workflows/_lib/agent-return.mjs` + 3개 워크플로 미러의 `SHARED-BLOCK` 구간은 여전히
  바이트 단위로 완전히 동일하다(verbatim 미러링 관례 준수). `export`/import 제약으로 인한
  구조적 중복이며 리팩터 대상이 아니다.
- 신규 테스트 `test_guard_filename_references_point_at_this_file` (`.claude/tests/
  test_workflow_scripts.py`)은 가드 파일명을 하드코딩하지 않고 `Path(__file__).name` 과
  대조해, 다음에 이 테스트 파일 자신이 리네임돼도 단언이 함께 따라가도록 설계돼 있다 — 좋은
  패턴.
- `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21}/**` 하위에 새로 추가된 파일들은 이전
  리뷰 라운드의 산출물이 이 커밋에 포함된 것으로, 그 시점의 기록이라 편집 대상이 아니다.
  코드가 아닌 리뷰 로그이므로 본 관점(유지보수성)에서 별도로 평가하지 않았다.

## 요약

이 diff 의 핵심(파일/반환 메시지 sink 분리 계약, 3개 워크플로 verbatim 미러, self-deadlock
호출 스택 축 감사, 신규 드리프트 가드 테스트)은 이미 세 라운드의 유지보수성 검토를 거치며
정제된 최종 상태이고, 직접 재실행·재대조한 결과 이전에 지적된 문제(가드 파일명 부분 리네임,
JSDoc 서사 누적, 오지 않은 미래 날짜, "9" 값의 이중 의미)가 전부 해소돼 있음을 확인했다.
새로 발견한 것은 두 건의 경미한 INFO 뿐이다 — 신규 회귀 테스트의 문자열 리터럴 슬라이스가
계약 문구 변경에 다소 취약한 점(기존에 유예된 항목의 재확인), 그리고 `.transaction(` 감사
수치가 JSDoc 요약과 plan 이력 두 곳에 중복 기재돼 향후 한쪽만 갱신될 위험이 남아 있는 점.
둘 다 기능에는 영향이 없고 즉각 조치가 필요한 결함이 아니다. 함수 길이·중첩 깊이·순환
복잡도 측면에서는 이번 diff 로 추가/변경된 코드(`parseAgentReturn`, `_extract_block`,
`_check_syntax`, 신규 테스트 함수들)가 모두 짧고 단일 책임을 유지한다.

## 위험도

LOW
