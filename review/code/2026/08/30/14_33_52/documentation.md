# 문서화(Documentation) 리뷰 — 5라운드 (`14_33_52`)

## 배경

이 diff 는 `raw-update-guard-scope` PR 의 누적 diff(`origin/main...HEAD`, HEAD=`1d606f7d0`)이며,
실질 코드/문서 변경 7개 파일과 이전 4라운드(`12_41_15`·`13_15_58`·`13_46_53`·`14_11_02`)의
리뷰/일관성-검토 워크플로 산출물 다수로 구성된다. 리포트 서술을 그대로 믿지 않고 실제 파일을
직접 열어 대조했다:

- `CHANGELOG.md`, `plan/in-progress/update-returning-tuple-shape.md` 전문
- `codebase/backend/src/common/__test-utils__/source-scan.ts` / `.spec.ts` 전문
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 전문
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` / `.spec.ts` 전문
- `git log --oneline`, `git status --short`, `git diff --stat origin/main...HEAD` 로 HEAD 상태와
  diff 범위 확인

4라운드(`14_11_02`)가 "developer SKILL §수렴 예외"로 명시적으로 종결 판정을 내렸고(Critical 0
4연속, RISK MEDIUM→LOW, 신규 실행 항목 0), 이후 커밋(`1d606f7d0`)이 그 라운드의 WARNING 1건 +
INFO 1건을 조치했다. 이번 라운드에서는 그 조치가 실제로 코드에 반영됐는지와, 4라운드 동안
누적된 문서(JSDoc·CHANGELOG·plan)가 최종 코드 상태와 정확히 일치하는지를 재검증했다.

## 발견사항

- **[INFO]** `CHANGELOG.md:21` "양성 7 · 음성 8" 수치를 `source-scan.spec.ts` 의 실제
  `it.each` 항목과 직접 세어 대조 — 양성 7개(백틱·작은따옴표·큰따옴표·DELETE·제네릭·중첩
  제네릭·멀티라인), 음성 8개(INSERT…RETURNING·INSERT…ON CONFLICT·RETURNING 없음·주석·
  QueryBuilder·`.query(sqlVar)`·2단계 중첩 제네릭·CTE 접두)로 정확히 일치한다. 4라운드
  RESOLUTION 이 스스로 지적한 "숫자를 세 번 틀렸다"는 패턴이 이번엔 재발하지 않았다.
  - 위치: `CHANGELOG.md:21-25`, `codebase/backend/src/common/__test-utils__/source-scan.spec.ts`
    (`describe('양성 …')`·`describe('음성 …')` 두 `it.each` 블록)
  - 제안: 없음.

- **[INFO]** 4라운드 WARNING("`ALLOWED` 선언값이 `discover()` 실측과 교차검증되지 않는다")과
  INFO("멀티라인 SQL 탐지가 오늘의 소스 형태에 결합돼 있다")가 커밋 `1d606f7d0` 로 정확히
  조치됐음을 코드로 확인했다. `update-returning-rows.spec.ts` 에 `'허용목록의 선언 개수가
  실측과 정확히 일치한다'` 테스트가 신설돼 있고, `ALLOWED` docstring 도 "이 수는 실측값이다"
  라는 과잉 약속 대신 "이 수가 실측과 같다는 보장은 `findUnguarded` 가 아니라 별도 테스트가
  준다"로 정정돼 코드가 실제로 주는 보장과 정확히 일치한다. `source-scan.spec.ts` 양성
  목록에도 멀티라인 백틱 리터럴 캐너리가 추가돼 소스 상태와 무관하게 그 축을 고정한다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:198-202`(docstring
    정정), `:287-302`(신규 테스트), `codebase/backend/src/common/__test-utils__/source-scan.spec.ts`
    (양성 `it.each` 멀티라인 항목)
  - 제안: 없음.

- **[INFO]** `countRawUpdateReturning`/`hasRawUpdateReturning` 의 JSDoc(`source-scan.ts:61-111`)이
  "왜 필요한가"·"판정 축"·"이 축이 안 보는 것"(QueryBuilder 제외·`.query(sqlVar)`·CTE 접두)을
  표와 함께 명시하고, 세 blind spot 모두 `source-scan.spec.ts` 의 음성 `it.each` 에 대응하는
  RED-방향 캐너리가 있다. docstring 서술과 정규식(`CALL`) 동작·테스트 입력을 직접 대조한 결과
  불일치가 없다. CTE 접두 항목은 "1라운드에 지적됐는데 SUMMARY 합성에서 누락돼 두 라운드를
  지나갔다"는 경위까지 docstring 에 인용 형태로 남아 있어, 다음 사람이 같은 경위를 반복하지
  않도록 되어 있다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:86-111`
  - 제안: 없음.

- **[INFO]** `kb-stats.helper.ts` 의 신규 인라인 주석(26-35행)은 기존 주석("RETURNING 절은
  향후 호출자가 활용할 수 있도록 유지")을 지우지 않고 그 옆에 "그 문구가 소비를 초대하는
  위험한 서술이었다"는 정정 맥락을 덧붙였다 — 코드(타입 인자가 `[{...}[], number]` 튜플로
  정정됨, 반환값은 여전히 미소비)와 정확히 일치한다. `kb-stats.helper.spec.ts` 의 mock
  (`[[{...}], 1]` / `[[], 0]`)도 실제 드라이버 계약과 일치하는 튜플 shape 이고, 그 옆 주석이
  "왜 이 shape 이어야 하는가"(4개월 결함과 같은 오류 형태)를 명시한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:26-38`,
    `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts:19-27,42-43`
  - 제안: 없음.

- **[INFO]** `plan/in-progress/update-returning-tuple-shape.md` 의 완료 배너(304행 항목)가
  4라운드 전체 이력을 라운드별 표("가드가 막으려던 것" vs "가드 자신이 가졌던 것")로 정리하고,
  "숫자를 세 번 틀렸고 원인은 순서였다"는 자기 진단과 "코드를 먼저 얼리고 마지막 편집으로
  숫자를 썼다"는 이번 라운드의 절차 변경까지 기록한다. `## 체크리스트`(211행)와 `## 후속`
  (254행) 두 섹션 간 중복이 없고, `spec_impact` frontmatter 5건이 본문의 `[planner 위임]`
  항목과 1:1 대응하며 developer 권한 밖임을 명시해 CLAUDE.md 의 skill 경계와 일치한다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:304-444`
  - 제안: 없음.

- **[INFO]** (기존 채널이 이미 추적 중, 신규 아님) `spec/conventions/node-cancellation.md`
  frontmatter `pending_plans:` 에 이 plan 이 여전히 미등재. `review/consistency/2026/08/30/
  12_17_21/**` 와 이전 4라운드의 documentation 리뷰가 이미 포착·기록했고, plan 본문도
  `[planner 위임]` 항목으로 스스로 인지하고 있다. `spec/` 은 developer 쓰기 권한 밖이라 이
  코드 PR 의 조치 대상이 아니다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:434-435`
  - 제안: planner 턴에서 처리(기존 추적, 신규 조치 불요).

- **[INFO]** README 갱신 필요성 없음 확인 — 이 diff 는 사용자 대상 기능·설정·API 를 추가하지
  않는 내부 테스트 인프라 확장(발견형 회귀 가드)과 타입 정정 1건이다. `codebase/backend` 하위
  README 를 grep 한 결과 `source-scan`/`updateReturningRows`/"raw UPDATE" 를 참조하는 곳이
  없어 README 와의 정합성 문제도 없다.
  - 위치: 해당 없음(부재 확인)
  - 제안: 없음.

- **[INFO]** (carry-forward, won't-do 로 이미 처분됨) `findUnguarded`(update-returning-rows.spec.ts:167)
  바로 앞에 있는 설계 배경 JSDoc 블록(119-145행)이 함수 선언과 빈 줄 하나로 떨어져 있어
  IDE/TypeDoc 자동 연결에서 누락될 수 있다는 점은 4라운드에서 이미 "won't-do — 앞 블록은
  `describe` 전체의 배경이라 함수에 붙이면 오히려 좁아진다"로 근거와 함께 처분됐다
  (`review/code/2026/08/30/14_11_02/RESOLUTION.md`). 이번 라운드에서 새로 지적할 사항 아님.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:119-166`
  - 제안: 없음(기존 처분 유지).

## 요약

4라운드에 걸쳐 문서화 관점 WARNING·INFO 전량(CHANGELOG 수치 오기 2회·plan 완료 배너 낡은
서술·`findUnguarded` 다중 보고 미검증·CTE blind spot 미공개·허용목록 선언값 미교차검증·
멀티라인 축 소스 결합)이 실측으로 조치됐음을 이번 라운드에서 코드·문서를 직접 열어 재확인했다
— 지어낸 서술이나 미조치 항목은 발견되지 않았다. `CHANGELOG.md` 의 구체적 수치("양성 7·음성
8")는 `source-scan.spec.ts` 의 실제 테스트 개수와 정확히 일치하고, 신설 함수의 JSDoc 은 판정
축·의도된 세 가지 blind spot(변수 SQL·2단계 중첩 제네릭·CTE 접두)을 표와 캐너리 테스트로
빠짐없이 대응시킨다. `kb-stats.helper.ts`/`.spec.ts` 의 주석·mock 정정도 실제 코드 shape과
일치하며 기존 주석을 지우지 않고 정정 맥락을 옆에 남기는 방식을 취해 다음 사람이 같은 오해를
반복하지 않도록 한다. `plan/in-progress/update-returning-tuple-shape.md` 는 4라운드 전체
이력·수렴 판정 근거를 정확히 기록하고 있으며 체크리스트·`spec_impact`·`[planner 위임]` 항목이
모두 정합적이다. 새로 도입된 CRITICAL·WARNING 급 문서화 결함은 발견되지 않았고, 남은 유일한
gap(`spec/conventions/node-cancellation.md` `pending_plans` 미등재)은 developer 권한 밖으로
이미 별도 채널이 추적 중이다.

## 위험도
NONE
