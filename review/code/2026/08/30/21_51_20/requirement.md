# 요구사항(Requirement) 리뷰 — report-return 계약 파일/반환 sink 분리 + self-deadlock 호출 스택 축 audit (4라운드 종결 후 재확인)

## 검증 방법 (뮤테이션 없음, 저장소 트리 무변경)

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 PASS**.
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -v` → **6 passed, 17 subtests passed**.
- `execution-engine.service.ts` JSDoc 이 주장하는 `.transaction(` 계수(전수 36 = 모듈 안 9 + 밖 27,
  주석 포함 시 39, 제네릭 인자 누락 시 35)를 `grep -rn '\.transaction\s*<\|\.transaction\s*('
  src --include="*.ts" | grep -v '\.spec\.ts'` 로 직접 재계산 — **정확히 일치**(총 39줄 매치, 그중
  3줄이 이 JSDoc 자신의 프로즈, 코드상 36개, 모듈 안 9 / 밖 27).
- 8개 모듈 내 `.transaction(` 블록 시작 지점(1024/1158/1253/2974/3342/8448/8646/8712)의 콜백 바디를
  열어 `updateExecutionStatus` 재귀 호출이 없는지 스팟체크(특히 1253 — resume claim 이 의도적으로
  choke point 를 우회함, 8712 — `updateExecutionStatus` 자기 자신의 트랜잭션이라 재귀 아님)했고
  모두 주장과 일치.
- `test_workflow_shared_block.py` 잔존 참조를 저장소 전수 grep — `.claude/` 안에서 **0건**(새 가드
  테스트 자신의 히스토리 서술 docstring 1건만 예외, 이는 과거 결함을 설명하는 텍스트라 정상).
  이전 라운드(`20_21_06` documentation/maintainability/side_effect)가 지적했던 "SHARED-BLOCK 마커
  밖 헤더 주석 3곳 미반영" WARNING 은 현재 HEAD 기준 **완전히 해소**됨(`ai-review.js:109`,
  `consistency-check.js:48`, `merge-coordinate.js:58` 모두 새 이름으로 정정 확인).
- `plan/complete/spec-draft-raw-query-results.md` 배너 날짜(`2026-08-31`→`2026-08-30`) 정정은
  frontmatter `started: 2026-08-30` 및 커밋 `#1242`(2026-08-30) 시점과 정합 — 미도래 날짜 오기
  정정으로 타당.
- `git status --short` clean 확인, 검증 중 저장소 파일 변경 없음.

## 발견사항

없음 — CRITICAL/WARNING 급 신규 결함을 찾지 못했다. 아래는 참고용 INFO 뿐이다.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이 changeset 이 직접
  닫지 못하는 체크박스 2개가 열려 있다("새 계약이 실제 실행 경로에 붙는지 다음 세션에서 확인",
  "planner 턴 draft 를 커밋하는 것을 절차로 못박는다").
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (`- [ ]` 두 항목, self-deadlock
    항목 직후·직전)
  - 상세: 두 항목 모두 "왜 이 세션 안에서 원리적으로 닫을 수 없는지"와 재개 조건이 본문에 명시돼
    있다(세션 스냅샷 캐시 문제로 새 top-level 세션에서만 검증 가능하다는 실측 근거 포함). 기능
    누락이 아니라 의도적으로 트래킹된 후속 작업이라 판단.
  - 제안: 조치 불요 — 다음 top-level 세션에서 재개 조건 그대로 확인하면 됨.

- **[INFO]** spec fidelity: 파일 1~6(`.claude/` 하네스 워크플로 스크립트·테스트)은 `spec/`
  도메인 밖(harness 오케스트레이션 내부 계약)이라 대응하는 spec 문서가 없다 — 정상.
  파일 7(`execution-engine.service.ts`)은 `spec/5-system/4-execution-engine.md`(§원자성 보장,
  `updateExecutionStatus`/`linkedNodeExec`/`dataSource.transaction` 관련 기존 서술)과 대조했으나
  이번 diff 는 **코드 로직 변경이 전혀 없는 JSDoc 주석 추가뿐**이라 spec 본문과의 line-level
  불일치가 발생할 여지가 없다. 기존 spec 서술과도 모순되지 않음.

## 요약

이 changeset 은 이미 4라운드에 걸쳐 ai-review 가 Critical 0 · Warning 4→5→1→0 으로 수렴시킨
결과물이다(핵심: `REPORT_RETURN_CONTRACT` 를 `output_file`=마크다운 본문 전용 / 반환 메시지=
STATUS 헤더+구분자 전용으로 분리해 review 산출물 536개의 헤더 오염 발생원을 차단, 그리고
`updateExecutionStatus` self-deadlock 확인의 "호출 스택" 축을 채워 3판에 걸친 수치 오기(11→20,
어휘적→호출 스택, 27중26→27)를 정정). 이번 재검토에서 신규 코드 뮤테이션 없이 테스트 재실행·수치
재계산·grep 전수 대조로 독립 검증한 결과, 이전 라운드가 잡았던 결함(가드 파일명 미러링 누락 3곳,
`.transaction(` 집계 오차, 세는 방법 안내 비대칭)은 모두 현재 HEAD 에서 실제로 해소돼 있음을
확인했다. 신규 회귀 테스트 2건(`test_agent_return.mjs`)은 뮤테이션에 RED 로 반응하는 non-vacuous
테스트이고(PR 서술과 실행 결과 일치), 새 drift guard 테스트(`test_workflow_scripts.py`)도 통과한다.
기능 코드(런타임 로직) 변경은 이 changeset 전체에서 0건(전부 프롬프트 계약 문구·주석·테스트·plan
문서)이며, 반환값 누락·에러 시나리오 미정의·TODO/FIXME 잔존·spec 본문 불일치는 발견되지 않았다.

## 위험도

NONE
