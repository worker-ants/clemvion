# 문서화(Documentation) 리뷰 — 6라운드 (`15_07_17`)

## 배경

이 diff 는 `raw-update-guard-scope` PR 의 누적 diff(`origin/main...HEAD`, HEAD=`e5b237377`)다.
실질 코드/문서 변경은 여전히 7개 파일(`CHANGELOG.md`, `source-scan.ts`/`.spec.ts`,
`update-returning-rows.spec.ts`, `kb-stats.helper.ts`/`.spec.ts`, plan 문서)이고, 나머지는
1~5라운드(`12_41_15`·`13_15_58`·`13_46_53`·`14_11_02`·`14_33_52`)의 리뷰/consistency-check
산출물이다. 직전 5라운드(`14_33_52`)는 7명 reviewer 전원 NONE(maintainability 만 LOW, 내용은
문서 중복 1건)으로 수렴했고, 그 뒤 유일한 실 변경은 `e5b237377`(`kb-stats.helper.spec.ts` 주석
영→한 정정, `--impl-done` `14_43_41` INFO #3 대응) 하나다. 이번 라운드는 그 fix 가 실제로
완전한지와, 5라운드 동안 누적된 문서(JSDoc·CHANGELOG·plan)가 여전히 최종 코드 상태와
정확히 일치하는지를 재검증했다. 서술을 그대로 믿지 않고 다음을 직접 확인했다:

- `git log --oneline`, `git diff --stat origin/main...HEAD`, `git status --short` — 범위·클린 상태
- `git show e5b237377` — 이번 라운드의 유일 신규 커밋 전문
- `codebase/backend/src/common/__test-utils__/source-scan.ts`/`.spec.ts` 전문
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 의 `ALLOWED`/`discover`/
  `findUnguarded` 블록
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` 전문
- `CHANGELOG.md` 상단 신규 섹션 전문과 실제 테스트 `it.each` 항목 수 대조
- `plan/in-progress/update-returning-tuple-shape.md` frontmatter·체크리스트·완료 배너
- `spec/data-flow/6-knowledge-base.md:296-300` — `e5b237377` 커밋 메시지가 인용한 spec 문구
- `git diff origin/main...HEAD -- codebase | grep 로 잔존 영어 주석 확인`
- 저장소 트리에는 아무것도 쓰지 않았다(뮤테이션 불필요 — 전부 정적 대조로 판정 가능).

## 발견사항

- **[INFO]** `kb-stats.helper.spec.ts` 주석 영→한 정정(`e5b237377`)이 완전하다 — 잔존 영어
  주석 없음을 직접 확인.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts:19-25,44`
  - 상세: `git diff origin/main...HEAD -- codebase | grep -E '^\+' | grep -viE '[가-힣]'` 로
    이번 diff 전체의 비-한글 추가 줄을 훑은 결과, 남은 것은 정규식 리터럴·SQL 문자열·JSDoc
    구두점(`/**`, ` * `, `|---|---|`) 뿐이고 서술형 주석은 전부 한국어다. 직전 라운드의
    consistency-check(`14_43_41` convention_compliance INFO 3)가 지적한 "이 파일만 영어" 불일치가
    해소됐고, `--impl-done` 게이트가 재확인할 다음 라운드에서도 같은 항목이 재발할 표면이
    남아 있지 않다.
  - 제안: 없음.

- **[INFO]** `e5b237377` 커밋 메시지가 인용한 spec 문구("`kb-stats.helper.ts` 의 과거 경위
  주석만 남아 있다")를 직접 열어 대조 — 정확하고, 이번 편집이 그 블록을 건드리지 않았음을
  확인.
  - 위치: `spec/data-flow/6-knowledge-base.md:299`, `kb-stats.helper.ts:4-19`(클래스 docstring,
    KB-level batch 이벤트 dead-path 경위)
  - 상세: spec 이 참조하는 "과거 경위 주석"은 클래스 레벨 JSDoc(4~19행, `kb:graph_stats_updated`
    가 dead path 였던 경위)이고, 이 PR 이 새로 추가한 텍스트는 `refresh()` 메서드 본문 안
    (26~35행, 타입 정정 근거)이라 spec 이 가리키는 블록과 물리적으로 분리돼 있다. spec 을
    낡게 만들지 않는다는 커밋의 주장이 코드 대조로 확인된다.
  - 제안: 없음.

- **[INFO]** `CHANGELOG.md` 신규 섹션의 "양성 7 · 음성 8" 수치를 `source-scan.spec.ts` 의 실제
  `it.each` 배열과 다시 세어 재확인 — 정확히 일치.
  - 위치: `CHANGELOG.md:21` 부근, `codebase/backend/src/common/__test-utils__/source-scan.spec.ts`
    (`describe('양성 …')` 7건, `describe('음성 …')` 8건)
  - 상세: 5라운드가 이미 확인했지만, 그 이후 코드 변경(`e5b237377`)이 이 카운트에 영향이
    없는 comment-only 커밋임을 직접 diff 로 재확인했다 — 테스트 배열 항목 수는 그대로다.
    이 저장소가 3라운드에 걸쳐 반복한 "숫자를 세 번 틀렸다" 패턴이 이번 라운드에서도
    재발하지 않았다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/update-returning-tuple-shape.md` 체크리스트의 "`ALLOWED` 설명
  중복" 항목(5라운드 maintainability INFO 6 대응)이 유예 근거와 함께 정확히 기록돼 있고,
  실제 코드의 중복도 그 서술과 일치한다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:280-288`(체크리스트 항목),
    `codebase/backend/src/common/utils/update-returning-rows.spec.ts:198-202`(ALLOWED docstring)
    vs `:288-294`(신규 테스트 내부 주석)
  - 상세: 두 위치 모두 "`findUnguarded` 는 상한 검사만 하고 정확 일치는 별도 테스트가
    담당한다"는 취지를 거의 같은 문장으로 반복한다 — plan 서술이 실측과 정확히 일치한다.
    내용이 상충하지 않고(겹침이지 오류가 아님) 침묵 실패 위험이 없다는 유예 근거도
    코드 확인상 타당하다. 신규 지적 아님.
  - 제안: 없음(plan 이 이미 처방까지 기록 — "다음에 이 영역을 손댈 때 상호 참조로 축약").

- **[INFO]** (기존 채널이 이미 추적 중, 신규 아님) `spec/conventions/node-cancellation.md`
  `pending_plans:` 미등재 + spec Rationale 소급 각주 5건 미반영은 여전히 열려 있다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:434-435` 부근(`[planner 위임]`),
    `review/consistency/2026/08/30/14_43_41/SUMMARY.md` INFO #1
  - 상세: `developer` 는 `spec/` 쓰기 권한이 없어(CLAUDE.md skill 경계) 이 코드 PR 의 조치
    대상이 아니다. plan 이 `[planner 위임]`으로 스스로 인지·기록하고 있고, 직전 라운드
    consistency-check 도 같은 결론(BLOCK: NO, INFO 비차단)이다. 이번 라운드에서 상태 변화
    없음 — 참고 표기만 유지.
  - 제안: planner 턴에서 처리(plan 이 `complete/` 이동 전).

## 요약

6라운드에 걸쳐 문서화 관점의 실질 결함(CHANGELOG 수치 오기·plan 서술 낡음·`findUnguarded`
다중 보고 미검증·CTE blind spot 미공개·허용목록 선언값 미교차검증·멀티라인 축 소스 결합·주석
언어 불일치)이 전부 실측으로 조치됐고, 이번 라운드는 마지막 항목(주석 언어)의 완결을 직접
확인했다 — `git diff` 전체를 훑어 잔존 영어 서술형 주석이 없음을 확인했고, 그 fix 가 인용한
spec 문구·spec 이 가리키는 코드 블록의 물리적 경계도 대조해 spec staleness 가 없음을 확인했다.
CHANGELOG 의 구체적 수치·plan 완료 배너·JSDoc 서술은 여전히 실제 코드와 정확히 일치하며,
새로 도입된 문서화 결함은 발견되지 않았다. 유일하게 남은 gap(spec Rationale 소급 각주 5건 +
`pending_plans` 미등재)은 developer 권한 밖으로 이미 별도 채널(consistency-check, plan
`[planner 위임]`)이 추적 중이며 이번 라운드에서 상태 변화가 없다 — 새 지적이 아니다.

## 위험도
NONE
