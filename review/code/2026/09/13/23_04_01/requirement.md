# 요구사항(Requirement) 리뷰 — error-code-emission-axis

## 범위 요약

핵심 코드 변경은 6개 파일이다: `CHANGELOG.md`, `PROJECT.md`, `logic.mdx`/`logic.en.mdx`(유저
가이드 콜아웃 정정), `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`(발행 축
추가). 나머지(파일 7~53)는 `plan/in-progress/**` 트래커 갱신과 지난 9라운드 `/ai-review` ·
`consistency-check` 세션의 산출물(`review/code/**`, `review/consistency/**`) 커밋이다 — 이번
라운드는 그 9라운드짜리 반복 수렴의 마지막 단계로 보인다(`git log`: `feat → 라운드1~9`).

검증 방법: `git diff origin/main..HEAD` 로 실제 diff 를 직접 열어 line-level 대조, 인용된
소스 줄 번호(`execution-engine.service.ts:7121·7125·7130`, `:8017`, `makeshop.handler.ts:436`)를
전부 `grep -n`/`sed -n` 으로 재실측, `spec/5-system/3-error-handling.md §1.4` 및 `CONTAINER_*`
를 언급하는 spec 6파일을 직접 열람, 저장소를 건드리지 않고
`npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts`(82/82 GREEN)와
`.../__tests__/`(23 files, 3382 tests, 전부 GREEN) 를 read-only 로 재실행, `parseWhereRefs` 의
중복-참조 처리 로직을 저장소 밖 scratch(`/private/tmp/.../scratchpad/test_parse.mjs`)에서
별도 재현했다. `git status --short` 로 원복 확인 — 잔여물 없음(세션 산출물 2개만 untracked,
review 대상과 무관).

## 발견사항

- **[INFO]** 기능 완전성 — "발행 축" 요구사항이 선언대로 구현·배선됨 (확인, 결함 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
    (`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/
    `isMessagePrefixOnly`/`computeNonEmittedOffenders`/`GUIDE_NON_EMITTED_VOCABULARY`),
    `guide-identifier-existence.test.ts`(발행 축 describe 블록 전체)
  - 상세: CHANGELOG/PROJECT.md 가 약속한 "메시지 접두로만 등장 ∩ 카탈로그 미등재 ⇒
    `GUIDE_NON_EMITTED_VOCABULARY` 등록 강제"가 코드에 정확히 반영돼 있다. 등록 3항목
    (`MAKESHOP_UNRESOLVED_PATH_PARAM`, `CONTAINER_MISSING_EMIT`, `CONTAINER_MULTIPLE_EMIT`)의
    `where` 줄 번호를 소스에서 재확인한 결과 전부 정확했다(`execution-engine.service.ts:7121`·
    `:7125`·`:7130`, `makeshop.handler.ts:436`). `why` 서술(예: makeshop 이 `IntegrationError`
    가 아니면 `INTEGRATION_CALL_FAILED` 로 fallback)도 실제 소스(`makeshop.handler.ts:360`,
    `integration-handler-base.ts:146`)와 일치한다. 진리표(`isMessagePrefixOnly` 4행)·경계
    정규식 3종의 캡처 그룹 인덱스도 실제 사용처와 정확히 대응한다. 유저 가이드 정정문
    (`logic.mdx`/`logic.en.mdx`)의 근거("`nodeExec.error = { message }` 에 `code` 필드
    없음")도 `execution-engine.service.ts:8017` 실측과 일치했다.
  - 제안: 조치 불요.

- **[INFO]** 반환값·엣지 케이스 — `parseWhereRefs` 의 동일 `파일:줄` 중복 처리, 우려했으나
  정상 동작 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    (`parseWhereRefs`)
  - 상세: `rest.replace(m[0], "")` 가 문자열 인자라 첫 발생만 지운다는 점이 걱정돼
    `"a.ts:10 · a.ts:10"`(완전 중복 참조)을 저장소 밖에서 별도 재현했다. `matchAll` 이
    원본 `head` 기준으로 두 매치를 각각(같은 부분문자열이라도 위치가 다른 두 occurrence)
    내므로 루프가 두 번 돌며 각 반복이 `rest` 에서 한 번씩 제거해 최종 `residue`가
    정확히 빈 문자열로 떨어졌다 — 우려한 결함은 재현되지 않았다. 등록 3항목도 중복 참조가
    없어 오늘은 무관하다.
  - 제안: 조치 불요(확인 목적 기록).

- **[SPEC-DRIFT]** `spec/` 6개 파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를
  여전히 정식 에러 코드처럼 서술 — 이 PR 이 정정한 유저 가이드 문장과 직접 충돌
  - 위치: `spec/5-system/4-execution-engine.md:332-333`(§3.0, `"…에러로 실행 실패"`),
    `spec/3-workflow-editor/2-edge.md:202`(§6.1, "코드" 열),
    `spec/3-workflow-editor/0-canvas.md:636`(§11.2.2, 형제 `CONTAINER_INVALID_CHILD`·
    `CONTAINER_CYCLE` 도 동형), `spec/4-nodes/1-logic/0-common.md:83`,
    `spec/4-nodes/1-logic/7-map.md:179-180`(§6), `spec/4-nodes/1-logic/9-foreach.md:209-210`
    (§6). 6개 경로 전부 `grep -n`으로 직접 확인.
  - 상세: 이번 PR 은 `execution-engine.service.ts:8017`(`nodeExec.error = { message }`,
    `code` 필드 부재) 을 근거로 유저 가이드 문장을 "메시지 접두일 뿐 전용 코드가 아니다"로
    정정하고, 가드에 `GUIDE_NON_EMITTED_VOCABULARY` 등록으로 그 사실을 고정했다. 그런데
    같은 근거로 spec 본문 6곳은 정정하지 않았다 — spec 이 실제 구현보다 "넓게"(코드가
    있는 것처럼) 서술한 채로 남아 이 PR 의 자기 서술과 spec 이 서로 모순된다. 다만
    같은 파일군에 **정확하게 적은 선례**가 이미 있다 — `spec/4-nodes/1-logic/3-loop.md:189-191`
    은 발행 문자열 전문(``CONTAINER_MISSING_EMIT: Container "<label>" has no body node
    wired to …``)을 인용해 "코드"가 아니라 "메시지"임을 형태로 이미 구분하고 있다. 코드가
    맞고(실측이 뒷받침) spec 6파일이 낡은 쪽이므로 CRITICAL 이 아니라 SPEC-DRIFT다.
  - 판정 근거: 이 PR 은 `developer` 스코프이고 `spec/` 쓰기는 project-planner 소관이라
    직접 고치지 않은 것은 규약에 맞다. 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 담당 미해결 항목("spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다 — 같은
    저장소에 «맞게 적은» 선례가 있다", `[ ]` 미체크)으로 정확히 이 6파일·근거·해법
    (backfill vs 메시지-접두 표기)까지 이미 등재돼 있다. 즉 이번 PR 이 놓친 게 아니라
    **의도적으로 planner 로 위임한 상태**다.
  - 제안: 코드/가이드는 유지. spec 반영은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 해당 항목 집행 시 위 6개 파일(줄 번호 포함)을 `3-loop.md:189-191` 형태(발행 문자열
    전문 인용)로 통일하거나, `3-error-handling.md §1.4` 에 `CONTAINER_*` 를 backfill —
    두 옵션 모두 plan 에 이미 명시돼 있으므로 planner 턴에서 택일만 하면 된다.

- **[INFO]** 자기 참조 SoT 정합성 — `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`
  가 `spec/conventions/user-guide-evidence.md §2` 를 "아직 등재되지 않았다"고 정확히 자백
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` JSDoc,
    `guide-identifier-scan.ts` 헤더 주석, `PROJECT.md:300`
  - 상세: `grep -n "guide-identifier" spec/conventions/user-guide-evidence.md` → 0건으로
    직접 재확인. 세 곳 모두 "가족 규약의 근거 문서이지만 이 가드 자체는 아직 §2 표에
    없다(등재는 planner 트래커 항목)"으로 정확히 서술 — SoT 를 존재하지 않는 곳으로
    가리키는 오류(과거 라운드에서 지적된 클래스)가 이번 판본에는 없다.
  - 제안: 조치 불요.

## 요약

핵심 변경(유저 가이드 문장 정정 2건 + 발행 축 가드 신설)은 CHANGELOG/PROJECT.md 가 약속한
동작을 코드 수준에서 정확히 구현했다 — 인용된 모든 소스 줄 번호·정규식 캡처 그룹·진리표·
등록 항목의 `where`/`why` 서술을 직접 재실측한 결과 전부 일치했고, 전체 docs 가드 스위트
(23 파일 3382 테스트)가 저장소 무변경 상태로 전부 GREEN 이다. 유일한 spec-fidelity 이슈는
spec 6파일이 `CONTAINER_*` 를 여전히 정식 코드처럼 서술해 이 PR 이 정정한 가이드 문장과
모순되는 SPEC-DRIFT 인데, 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 근거·대상 파일·해법 옵션까지 구체적으로 등재돼 planner 위임 상태이므로 이번 PR 의
누락이 아니라 의도된 스코프 경계다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 모든
관점에서 새로 지적할 결함을 찾지 못했다.

## 위험도

LOW
