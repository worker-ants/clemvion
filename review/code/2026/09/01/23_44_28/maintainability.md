# 유지보수성(Maintainability) 코드 리뷰

## 범위에 대한 메모

이번 프롬프트는 125개 파일을 나열하지만, 그중 다수(파일 17~124, `review/code/**`·
`review/consistency/**`)는 **이전 5라운드 리뷰의 세션 산출물**(RESOLUTION/SUMMARY/각
reviewer 리포트·`_retry_state.json`·`meta.json`)이고, 8개(`plan/**`)는 plan 위생 정리
(도구 아티팩트 태그 제거, 체크박스 상태 갱신, outgoing 링크 절 추가), 1개는
`spec/conventions/error-codes.md` 문서 갱신이다. 이들은 사람이 계속 손으로 유지보수하는
소스가 아니라 **봉인된 세션 기록**이거나 **한 번 쓰고 마는 plan 트래킹 텍스트**라 함수
길이·중첩·매직 넘버 같은 코드 품질 기준의 적용 대상이 아니다.

실제 "코드"에 해당하는 변경은 6개 파일이다 — `.claude/hooks/_lib/plan_guard.py`,
`.claude/tests/test_plan_guard.py`, `codebase/backend/src/nodes/core/error-codes.ts`(JSDoc
전용 diff), `codebase/frontend/src/lib/docs/__tests__/{spec-links.test.ts,
stray-tool-tags.test.ts, tree-walk.ts}`. 이번 changeset 은 이미 4라운드의 리뷰·수정을
거쳤고(각 라운드 RESOLUTION.md 확인), maintainability 축 지적(1R INFO #4 매직넘버,
1R INFO #5 태그 순서, 4R W1 `readonly string[]` 타입 오류)이 전부 해당 라운드 안에서
조치된 상태로 diff 에 반영돼 있다 — 아래는 그 반영본을 직접 다시 읽고 확인한 결과다.

## 발견사항

- **[INFO]** `_QUOTED` 를 위해 단일 문자 포함 검사에 컴파일 정규식을 쓴다
  - 위치: `.claude/hooks/_lib/plan_guard.py` — `_QUOTED = re.compile(r">")` 정의부와
    `_all_checkboxes_done` 안의 `elif not _QUOTED.search(m.group("quote")):` 사용부
  - 상세: `m.group("quote")` 는 `_CHECKBOX` 의 `[\s>]*` 캡처 결과라 공백과 `>` 문자만
    담을 수 있다. `>` 존재 여부만 물으므로 `re.compile(r">")` + `.search()` 대신
    `">" in m.group("quote")` 로 충분하다 — 같은 결과를 내면서 정규식 컴파일·엔진
    호출이라는 간접 계층이 하나 줄어든다. 기능·성능에 실질적 영향은 없고(문자열이
    짧고 컴파일은 모듈 로드 시 1회), 다음 사람이 "왜 이 검사만 정규식인가" 를 잠깐
    멈춰 생각하게 만드는 정도다.
  - 제안: `elif ">" not in m.group("quote"):` 로 바꾸고 `_QUOTED` 정의를 제거. 차단
    사유는 아님 — 참고 수준.

- **[INFO]** `plan_guard.py` 의 셸 스크립트 자매(`plan-stale-audit.sh`) 와의 정규식 drift 가 이번에도 남아 있다 (기존에 등재된 항목, 재확인만)
  - 위치: `.claude/hooks/_lib/plan_guard.py:95`(`_CHECKBOX` 신규 정규식) vs
    `.claude/tools/plan-stale-audit.sh:123-125`(옛 형태 유지)
  - 상세: 두 파일이 "체크박스를 센다" 는 같은 로직을 독립적으로 구현하고 있고, 이번
    PR 이 `plan_guard.py` 쪽만 blockquote 지원으로 확장해 두 구현이 다시 벌어졌다.
    `plan_guard.py` 의 `_CHECKBOX` 주석 자신이 "이 페어가 두 번 drift 했다" 고 적어
    이번이 세 번째임을 인지하고 있다. 이 자체는 새로 발견한 것이 아니라
    `review/code/2026/09/01/23_09_35/RESOLUTION.md` W5 에서 이미 방향(셸 쪽이 실제보다
    "더 완료" 로 과대 보고)까지 적어 `harness-review-gate-followups.md` 에 등재했고,
    "검증 표면이 없는 셸 정규식은 이번 PR 에서 안 고친다" 는 근거도 기록돼 있다.
    유지보수성 관점에서도 그 판단에 동의한다 — 정정 없이 넘어간다.
  - 제안: 조치 불요(이미 등재·유예 근거 타당). 다음에 이 정규식 쌍을 다시 만질 때
    함께 통합하는 것을 권장.

## 확인했으나 문제 없음 (근거 기록)

- **4R W1(타입 오류) 수정이 실제로 반영돼 있다**: `tree-walk.ts:72` 의 `walkTree` 시그니처가
  `bases: readonly string[]` 로 넓어졌고, 저장소 안 `walkTree` 호출 15곳(`impl-anchor-parse.ts`,
  `spec-frontmatter-parse.ts`, `plan-scan.ts`, `spec-links.ts` 4곳, `stray-tool-tags.test.ts`,
  `tree-walk.test.ts` 6곳)을 전수 확인한 결과 전부 배열 리터럴을 그대로 넘겨 `readonly`
  로의 확장과 충돌하지 않는다. `npx tsc --noEmit` 을 이 3개 테스트 파일 대상으로 재실행해
  오류 0건도 직접 확인했다.
- **1R INFO #4(매직 넘버 `100`) 수정이 반영돼 있다**: `stray-tool-tags.test.ts` 의 하한이
  이름 있는 `MIN_EXPECTED_MD_FILES: Record<ScanRoot, number>` 로 상수화됐고, 그 위 주석에
  실측치(`plan/` 505 · `spec/` 386)와 값 선정 근거("실측의 절반 언저리")가 명시돼 있다.
  루트별로 나뉜 것도 2R 에서 "합계 하나로 걸면 한 루트가 통째로 빠져도 통과한다" 는 지적을
  반영한 결과다(회귀 테스트 `it.each` 로 고정).
- **1R INFO #5(배열 순서) 수정이 반영돼 있다**: `TOOL_TAGS` 배열이 알파벳순
  (`antml < content < function_calls < invoke < parameter`)으로 정렬됐고 그 기준이 JSDoc
  주석에 명시돼 있다.
- **함수 길이·중첩**: 실질 변경분(`_all_checkboxes_done`, `collectScanTargets`,
  `findStrayTags`, `walkTree`)은 전부 30줄 이내이고 중첩은 2단(반복문 안 조건문) 을
  넘지 않는다. `walkTree` 의 스택 기반 DFS 도 단일 while-for-if 구조로 얕다.
  `_all_checkboxes_done` 의 frontmatter 스킵 로직이 조건 분기가 조금 촘촘하지만
  (`seen_first`/`in_frontmatter` 이중 플래그), 각 분기에 인라인 주석이 붙어 있고 이미
  `test_plan_guard.py` 의 fixture 테스트가 그 경계를 고정하고 있어 실질 위험은 낮다.
- **중복 코드**: `stray-tool-tags.test.ts` 의 `collectScanTargets` 는 자체 주석대로
  "초판이 `walkTree` 호출을 두 곳에 복제했던" 것을 한 곳으로 합친 결과이고, 실제로
  파일 안에서 `walkTree` 직접 호출은 그 함수 한 곳뿐임을 확인했다(`grep -n "walkTree("`).
  `plan_guard.py` 는 git 프로브 5~6개를 `_shared/git_probe.py` 로 위임하고
  `GitProbesAreNotReDuplicatedTest`(AST 비교) 로 재복제를 원천 차단하는 구조를 그대로
  유지한다.
- **네이밍·일관성**: `_CHECKBOX`/`_QUOTED`/`_BRANCH_ANNOT` 같은 모듈 프라이빗 상수의
  `_` 접두, `MIN_EXPECTED_MD_FILES`/`SCAN_ROOTS`/`TOOL_TAGS` 의 `UPPER_SNAKE_CASE` 상수
  컨벤션 모두 같은 파일·인접 파일의 기존 패턴과 일치한다. `error-codes.ts` 의 JSDoc
  확장도 코드를 중복하지 않고 `spec/conventions/error-codes.md` §Overview 로 위임하는
  이 저장소의 기존 SoT 원칙을 그대로 따른다.

## 요약

실질 코드 변경(6개 파일)은 이미 4라운드에 걸친 리뷰·수정으로 잘 다듬어진 상태이며,
직접 재확인한 결과 이전에 지적된 매직 넘버·타입 오류·태그 순서 문제가 모두 diff 에
반영돼 있고 회귀를 fixture 로 고정해 두었다. 함수는 짧고 중첩은 얕으며, 중복은
공유 헬퍼(`walkTree`, `_shared/git_probe.py`)로 이미 흡수됐다. 남은 것은 사소한
스타일 지점(단일 문자 검사에 정규식을 쓴 것) 하나와, 이미 등재·유예 처리된 셸 스크립트
자매 drift 재확인 하나뿐이며 둘 다 차단 사유가 아니다. 나머지 100여 개 파일은 사람이
유지보수하는 소스가 아닌 세션 산출물/plan 트래킹 문서라 이 관점의 채점 대상에서 제외했다.

## 위험도

NONE
