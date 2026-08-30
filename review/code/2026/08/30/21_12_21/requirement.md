# 요구사항(Requirement) 리뷰 — report-return sink 분리 + guard 사각지대 폐쇄 + self-deadlock 수치 확정 + 오지 않은 날짜 정정

## 검증 방법 메모

- 저장소 파일은 뮤테이션 검증 1건(아래)을 제외하면 읽기만 했다. 뮤테이션은 `sed -i` 로
  `.claude/workflows/ai-review.js` 를 직접 고친 뒤 **원본을 scratch 에 미리 `cp` 해 둔 것으로
  즉시 복원**했다. 복원 직후 `git status --short` 로 잔여 0건, `pytest` 재실행으로 6
  passed/17 subtests 회복을 확인했다.
- diff 가 세 커밋(`7d6854cb9` → `5a33656f9` → `ca260d87e`)의 누적이라 `git show <sha> --stat`
  으로 각 라운드가 review 산출물 20_21_06/20_46_48 을 어디서 추가했는지 실측 대조했다.
- `.transaction(` 전수는 독립적으로 `grep -rnE '\.transaction(<[^>]*>)?\('` 로 재현(주석 줄
  제외 python 후처리) — JSDoc 의 36/9/27 과 정확히 일치.

## 발견사항

이번 최종 상태(3커밋 누적)에서 **CRITICAL/WARNING 급 결함을 찾지 못했다.** 이전 두 라운드
(`20_21_06`, `20_46_48`)에서 나온 WARNING 은 이번 라운드에서 전부 실측 재확인상 해소돼 있다:

- **[INFO] (확인, 조치 불요)** 가드 파일명 드리프트(`test_workflow_shared_block.py` →
  `test_workflow_scripts.py`) 의 잔여가 이번 최종 상태에는 없다.
  - 위치: `.claude/workflows/ai-review.js:109,113`, `.claude/workflows/consistency-check.js:48,52`,
    `.claude/workflows/merge-coordinate.js:58,62`, `.claude/workflows/_lib/agent-return.mjs:15,48`
  - 상세: `20_21_06` 라운드가 지적한 "SHARED-BLOCK 마커 줄만 고치고 그 위 로컬 헤더 주석은
    옛 이름을 가리킨다" 결함은 `5a33656f9` 에서 3개 워크플로 전부 정정됐다. 이번 세션에서
    `grep -n "test_workflow_shared_block\|test_workflow_scripts"` 로 4개 정본+미러 전수를 다시
    훑어 옛 이름 잔존 0건을 재확인했다. `find -iname test_workflow_shared_block.py` 도 0건.
  - **재발 방지가 구조적으로 닫혔다는 점이 이번 라운드의 실질 개선이다** — `test_workflow_scripts.py`
    에 새로 추가된 `test_guard_filename_references_point_at_this_file` 이 마커 **밖**의
    파일명 언급까지 정규식(`\.claude/tests/(test_\w+\.py)`)으로 스캔해 "이 가드 파일 이름과
    다르면 fail" 하도록 만들어졌다. `ai-review.js` 를 scratch 백업 후 `sed -i` 로 옛 이름으로
    되돌려 재현했더니 정확히 이 신규 테스트만 **2 서브테스트 RED**(line 109, 113) — 즉 이전
    라운드가 "구조적으로 가드 밖" 이라고 지적한 사각지대를 이번 커밋이 실제로 메웠다(검증됨,
    vacuous 아님). 즉시 원복 후 6 passed/17 subtests 회복 확인.

- **[INFO] (확인, 조치 불요)** `updateExecutionStatus` self-deadlock JSDoc 의 `.transaction(`
  전수 수치(총 36 = 모듈 안 9 + 밖 27)가 독립 재측정과 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `updateExecutionStatus` 상단 JSDoc(약 8553~8582행 부근, "현재 스냅샷 (2026-08-30)" 단락)
  - 상세: `20_21_06` 라운드에서 requirement 리뷰어가 35/26 을 주장해 documentation 리뷰어의
    36/27 과 상충했던 사안. `5a33656f9` 가 "제네릭 인자(`.transaction<T>(`) 포함 + 주석 줄
    제외" 패턴으로 재측정해 36/9/27 을 확정했다고 주장한다. 이번 세션에서 그 방법론을 그대로
    재현: `grep -rnE '\.transaction(<[^>]*>)?\('` 로 backend `src/` 전수(`*.spec.ts` 제외)를
    수집한 뒤 각 줄의 실제 소스 내용을 확인해 `*`/`//` 로 시작하는 주석 줄(JSDoc 프로즈 자체가
    `.transaction(` 문자열을 담아 자기참조 오염을 일으키는 3줄)을 제외하니 **정확히 36건**이
    남았다. 그중 `execution-engine.service.ts` 8건 + `retry-turn.service.ts` 1건 = **모듈 안
    9건**, 나머지 **모듈 밖 27건**. `webauthn.service.ts:338` 의
    `this.dataSource.transaction<Outcome>(` (제네릭 타입 인자 형태)도 정확히 포함됐다.
  - 모듈 밖 27건 중 엔진 서비스를 참조하는 유일한 파일이라는 `executions.service.ts:641` 도
    직접 열어 확인: 트랜잭션 콜백 본문이 `manager.createQueryBuilder`/`manager.find` 만
    쓰고 `this.*` 서비스 메서드 호출이 없다 — JSDoc·plan 서술과 일치.
  - `spec/5-system/4-execution-engine.md:111-114`("else 분기도 트랜잭션 안에서 돈다
    (2026-08-30)")·`:1521-1526` 도 "두 분기 모두 트랜잭션을 연다" 는 전제를 이미 담고 있어
    이 JSDoc 의 self-deadlock 경고와 모순 없음 — spec fidelity 문제 없음(단, 이 spec 파일
    자체는 이번 diff 의 변경 대상이 아니며 이전 PR(#1243)에서 이미 반영됨).

- **[INFO] (확인, 조치 불요)** `REPORT_RETURN_CONTRACT` 의 파일-sink/반환-sink 분리가 4개
  파일(정본 + 3개 미러) 전체에서 byte-identical 하다.
  - 위치: `.claude/workflows/_lib/agent-return.mjs:48-104`(SHARED-BLOCK), 3개 워크플로의 동일
    마커 구간
  - 상세: `awk '/>>> SHARED-BLOCK/,/<<< SHARED-BLOCK/'` 로 4개 파일의 마커 구간을 추출해
    `diff` — 4곳 모두 완전 일치. `node --test .claude/tests/test_agent_return.mjs` 13/13
    통과(신규 2건 포함). `python3 -m pytest .claude/tests/test_workflow_scripts.py` 6
    passed/17 subtests(신규 8 서브테스트 포함, 종전 5 passed/9 subtests 에서 증가) 통과.

- **[INFO] (확인, 조치 불요)** 오지 않은 미래 날짜("2026-08-31") 정정이 완전하다.
  - 상세: `ca260d87e` 커밋 메시지가 "11곳" 정정을 주장한다. 이번 세션에서
    `grep -rln "2026-08-31"` 을 저장소 전체(코드/문서, `review/code/**` 의 과거 리뷰
    산출물 제외 — 그건 그 시점 기록이라 불변이 맞다)에 돌려 잔여 **0건**을 확인했다.

- **[INFO] (확인)** `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329` 의
  "새 계약이 실제 실행 경로에 붙는지" 항목은 체크박스 `[ ]`(미완료)로 정직하게 열려 있다.
  "발생원을 고쳤다" 로 과대 주장하지 않고 "고친 자리가 실행 경로임을 확인했고 반영은
  미검증"으로 서술을 낮췄다 — 코드 fix(반환값·에러 시나리오)가 실제로 검증되지 않은 채
  성공으로 잘못 보고되는 흔한 실패 패턴을 이 PR 스스로 회피했다. 반환값 정확성 관점에서
  모범적.

## TODO/FIXME/HACK/XXX

변경 파일 7개(`.claude/tests/test_agent_return.mjs`, `.claude/tests/test_workflow_scripts.py`,
`.claude/workflows/_lib/agent-return.mjs`, `ai-review.js`, `consistency-check.js`,
`merge-coordinate.js`, `execution-engine.service.ts`) 전수 grep — 0건.

## 반환값 / 에러 시나리오

- `parseAgentReturn()` 은 로직 변경 없음(문자열 계약만 변경) — status 4갈래(success/fatal/
  no_status/기타 문자열)와 body salvage 로직은 기존 13개 테스트로 이미 커버됨, 이번 diff 로
  회귀 없음(13/13 GREEN 유지, 신규 2건 추가).
- 신규 가드 테스트 `test_guard_filename_references_point_at_this_file` 는 매칭이 없는 경우
  (정상 상태) `stale.findall(line)` 이 빈 리스트를 반환해 루프가 그냥 통과 — 빈 컬렉션 경로가
  명시적으로 안전(`for referenced in []` 는 no-op). 정규식이 자기 자신(`test_workflow_scripts.py`
  라는 문자열이 own guard 파일 안에서도 등장)을 잘못 걸리지 않는지도 확인: `me` 와
  `referenced` 가 같으면 `assertEqual` 통과이므로 self-reference 는 안전.

## 요약

세 커밋에 걸쳐 스스로 실측하고 스스로 정정한 흔치 않게 꼼꼼한 changeset이다. 핵심 기능(파일
sink 와 반환 메시지 sink 분리)은 4곳 verbatim 미러링·13/13 유닛테스트·뮤테이션 검증(RED 2)으로
완전히 뒷받침된다. 이전 두 라운드가 지적한 세 가지 실질 문제 — (1) 가드 파일명 드리프트가
마커 밖에서 절반만 반영, (2) `.transaction(` 전수 수치 35/26 vs 36/27 상충, (3) 오지 않은
"2026-08-31" 날짜 11곳 — 는 이번 최종 상태에서 전부 실측 재검증상 해소됐고, (1)은 재발 방지
가드까지 신설돼 구조적으로 닫혔다(뮤테이션으로 검증). `updateExecutionStatus` self-deadlock
호출 스택 축 감사는 spec(`spec/5-system/4-execution-engine.md`)의 기존 서술과 모순 없다. 유일한
미완료 항목("새 계약이 반영됐는지")은 이 세션에서 검증 불가능하다는 사실을 정직하게 인정하고
`[ ]`로 열어 둔 상태이며, 이는 반환값 과대 주장을 피하는 바람직한 처신이다. CRITICAL/WARNING
없음.

## 위험도

NONE
