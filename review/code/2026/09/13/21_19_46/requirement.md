# 요구사항(Requirement) 리뷰 — error-code-emission-axis (라운드 6, `21_19_46`)

## 검토 방법

이 배치는 이미 5라운드의 `/ai-review`(`19_23_22`→`19_51_33`→`20_13_13`→`20_34_32`→`20_57_13`)와
대응 `--impl-done`을 거쳤고, 매 라운드 실제 뮤테이션으로 결함이 발견·수정됐다(궤적
W7→W4→W2→W1→W2, MEDIUM→MEDIUM→LOW→LOW→LOW). 이번 라운드는 그 누적 결과의 최종 diff를
`origin/main`(`afaef5bef`) 대비로 다시 열어, 이전 라운드가 "요구사항" 관점에서 지적한 항목이
실제로 해소됐는지 **독립적으로 재검증**했다 — 프롬프트가 생략한 두 핵심 TS 파일은 `Read`로
전문을 직접 열었고, 저장소를 뮤테이션하지 않고 다음을 직접 실행/대조했다:

- `codebase/frontend`에서 `guide-identifier-existence.test.ts` 단독 실행 → **76/76 passed**
  (plan §체크리스트가 주장한 "71→76"과 일치).
- `execution-engine.service.ts:7121·7125·7130`, `:8016`을 직접 열어 `GUIDE_NON_EMITTED_VOCABULARY`의
  `where` 필드·CHANGELOG·plan이 반복 인용하는 실측(`nodeExec.error = { message }`, `code` 필드
  없음)을 재확인 — 정확히 일치한다.
- `makeshop.handler.ts:436`도 같은 방식으로 재확인 — 일치.
- `spec/5-system/3-error-handling.md §1.4` 원문을 직접 열어 "소비자·분류기 쪽 어휘" 서술,
  "앵커 없는 7종" 카탈로그 인정 서술을 대조 — plan·코드 주석의 인용이 정확하다. `CONTAINER_*`가
  이 카탈로그 표(§1.4)에 **없음**도 확인.
- `spec/`에서 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 grep — plan이 "spec 6파일"로
  등재한 대상(`4-execution-engine.md:332-333`·`3-workflow-editor/2-edge.md:202`·
  `3-workflow-editor/0-canvas.md:636`·`4-nodes/1-logic/0-common.md:83`·`7-map.md:179-180`·
  `9-foreach.md:209-210`)이 정확히 6개 파일이고, 선례로 인용된 `3-loop.md:189-191`은 실제로
  발행 문자열 전문 형식을 이미 쓰고 있음을 확인.
- `git diff origin/main..HEAD`로 이 PR의 실제 diff 범위(두 TS 파일 + 문서 4개 + plan 2개,
  `spec/**` 무변경)를 확인 — plan frontmatter `spec_impact: none`과 일치.
- 코드 주석의 "라운드 7" 참조(FIELD_TABLE_NAME 첫-키 갭·BACKTICK_SPAN 스팬-전체 갭)는 `#1331`
  (이미 `origin/main`에 병합됨)의 이력이지 이 PR의 diff가 아님을 `git diff` 로 확인 — 오독 방지.

## 발견사항

새로 지적할 CRITICAL/WARNING은 찾지 못했다. 5라운드에 걸쳐 축적된 뮤테이션 검증(카탈로그
필터 삭제→RED, 등록 항 삭제→RED, 접두-전용 반전→RED, `staleGuideEntries` 방향 반전→RED,
`where` 둘째 위치 뮤턴트→RED 등)이 이번 최종 상태에서도 유효함을 소스 재확인으로 뒷받침했다.

- **[INFO]** `spec/` 6개 파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 여전히
  "코드"처럼 서술한다 — **spec fidelity 상 불일치이지만 코드가 아니라 spec 이 낡은 케이스는
  아니다.** 정확히는 **spec 내부 문서 간 불일치**(`3-loop.md`는 발행 문자열 전문 형식,
  나머지 6개는 코드처럼 표기)이고, 이 PR의 가이드 정정(logic.mdx/en.mdx)이 옳은 쪽(실측:
  `execution-engine.service.ts:8016`이 `code` 필드 없이 `{ message }`만 기록)과 일치한다.
  developer는 `spec/`을 직접 고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md:3446`에
  planner 항목으로 정확히 등재했다 — CLAUDE.md의 역할 경계(`spec/` 쓰기는 project-planner
  전속)를 지킨 올바른 처리다.
  - 위치: `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`,
    `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`,
    `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210`
    (전부 이 PR 의 diff 밖 — 기존 spec 파일, 이번 변경으로 새로 생긴 불일치가 아니다)
  - 상세: 이미 `--impl-done` 라운드 1(`review/consistency/2026/09/13/19_23_31`
    cross_spec WARNING#1)이 등재하고, 라운드 3~5 RESOLUTION이 "권한 밖·등재분"으로 반복
    확인한 항목과 동일하다. 새 결함이 아니라 이 PR이 우연히 드러낸 기존 spec 내부 불일치다.
  - 제안: 조치 불필요(이 PR 범위 밖) — planner가 등재분을 집행할 때 §1.4 backfill 여부와
    함께 판정.
- **[INFO]** `guide-identifier-existence.test.ts`(및 그 발행 축 확장)가 `spec/conventions/user-guide-evidence.md §2`의
  "Build-time 가드 3건" 표에 여전히 등재돼 있지 않다 — spec 문서 자체가 이 가드 패밀리를
  다루지 않는다.
  - 위치: `spec/conventions/user-guide-evidence.md:68-76` (§2 표, 3행 — `impl-anchor-existence`·
    `integrations-coverage`·`triggers-coverage`만 나열)
  - 상세: `grep`으로 `spec/conventions/*.md` 전체를 확인한 결과 `guide-identifier-existence`/
    `guide-identifier-scan`/구명 `guide-error-code-*` 어느 것도 인용되지 않는다. 이 가드
    패밀리는 이 PR 이전부터 이미 존재했고(`#1330`/`#1331`), 5라운드 전부 이 항목을 "선재·
    등재분"으로 동일하게 처분했다 — 이번 PR이 새로 만든 gap이 아니다.
  - 제안: 조치 불필요(이 PR 범위 밖, 이미 반복 확인된 pre-existing gap).
- **확인 후 문제 없음**: `GUIDE_NON_EMITTED_VOCABULARY`의 3개 등록 항목 각각이 `where`(실제
  소스 줄)·`why`(사유) 필드를 갖추고, 그 값이 실제 소스와 일치함을 직접 재확인했다(위 검토
  방법 참조). 등록 상한(`NON_EMITTED_VOCABULARY_CAP = 5`)·거울상 목록(`GUIDE_EXTERNAL_VOCABULARY`)과의
  제약 대칭(존재축=기준집합에 없을 것 / 발행축=기준집합에 있을 것)도 코드·테스트·주석 3곳이
  일치한다.
- **확인 후 문제 없음**: `computeNonEmittedOffenders`(판정 정본)가 베이스라인 단언과
  `[한계]`/`[대조군]` 테스트에서 **같은 함수**를 호출하도록 통합돼 있어, 라운드 5가 지적한
  "헬퍼 테스트 ≠ 호출부 테스트" 갭이 구조적으로 닫혀 있다. 다만 plan·RESOLUTION이 스스로
  기록하듯 카탈로그 항 자체는 실코퍼스에서 한 번도 발화하지 않아(§한계 테스트가 그 사실을
  단언으로 고정) 실코퍼스 기반 회귀로는 검증 불가능한 영역이 남아 있다 — 이는 합성 진리표
  (`describe("computeNonEmittedOffenders — 네 항이 각각 무는가")`)로 별도 커버되고 있음을
  확인했다.

## 요약

이 PR의 실질 코드 변경(`guide-identifier-scan.ts`의 발행 축 수집기 3종 + 판정 정본
`computeNonEmittedOffenders`/`isMessagePrefixOnly` + `GUIDE_NON_EMITTED_VOCABULARY`, 그리고
`guide-identifier-existence.test.ts`의 대응 단언·진리표·뮤테이션 대조군)은 5라운드의 반복
`/ai-review`·`--impl-done`을 거치며 실제 결함(카탈로그 필터 미검증·`where` 단일 매치·이름
충돌·JSDoc 표류 등)을 뮤테이션으로 증명하고 고쳐 온 이력이 있고, 이번 라운드에서 그 최종
상태를 독립적으로 재검증한 결과 코드·문서·spec 인용 전부가 실제 소스 줄 번호·동작과 일치했다
(76/76 GREEN 직접 재현, `execution-engine.service.ts`/`makeshop.handler.ts` 인용 줄 전수
재확인). 기능 완전성·엣지 케이스(빈 목록·중복·경계 정규식)·에러 시나리오·반환값 모든 경로가
합성 대조군으로 커버돼 있고 TODO/FIXME 류 미완성 표식은 없다. 유일한 두 발견사항은 둘 다
이 PR 이전부터 존재하던 spec 문서 간·spec-conventions 등재 갭이며, developer가 이미 올바르게
plan 트래커에 등재하고 `spec/` 직접 수정을 자제했다 — 5라운드 전부가 동일하게 "조치 불요,
등재분"으로 판정한 항목이라 이번에도 같은 결론을 유지한다. 새로 보고할 CRITICAL/WARNING은
없다.

## 위험도

NONE
