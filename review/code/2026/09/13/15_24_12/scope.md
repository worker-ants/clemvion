# 변경 범위(Scope) 리뷰 — guide-identifier-existence (라운드 3, `15_03_06` 이후)

## 검증 방법

`git diff --stat origin/main...HEAD`(71 files, 소스 diff 는 CHANGELOG.md · PROJECT.md ·
`guide-error-code-{existence.test,scan}.ts`(삭제) · `guide-identifier-{existence.test,scan}.ts`
(신규) · `guide-sanitized-message-parity.test.ts`(주석 1줄) · `plan/in-progress/*.md` 2개 ·
나머지는 전부 `review/code/**`·`review/consistency/**` 산출물)를 직접 조회하고, 라운드 2
(`review/code/2026/09/13/15_03_06`) 이후 실제로 새로 커밋된 diff(`938060138`)를 `git show`로
단독 확인했다. 저장소는 뮤테이션하지 않았다(`git status --short` 로 세션 시작 시점 대비 변경
없음 확인 — 이 세션이 만든 `review/code/2026/09/13/15_24_12/`·`review/consistency/2026/09/13/15_23_53/`
untracked 산출물만 존재).

## 발견사항

- **[INFO]** 라운드 2 fix 커밋(`938060138`)의 유일한 실 코드 변경은 리뷰어 지적에 **1:1로
  결속**돼 있음 — 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
  - 상세: 이번 라운드 델타는 (1) bare `hh_mm_ss` 인용(`14_41_14` → `review/code/2026/09/13/14_41_14`)을
    전체 경로로 교체(`--impl-done` CRITICAL 직접 대응), (2) `collectEnvDeclarations` 의 무검증
    분기(`^#?`)를 겨눈 대조군 5건 추가(`/ai-review` testing WARNING 직접 대응), (3) 그 새 대조군이
    참조해야 하는 `root`/`readIfPresent`/`envExampleTexts` 를 `describe` 블록 안에서 모듈
    top-level 로 끌어올린 것뿐이다. (3)은 순수해 보이는 위치 이동이지만 (2)의 새 `describe`
    블록이 그 변수들을 참조하기 위한 **필수 전제**이지 임의 리팩토링이 아니다 — 변수 값·로직
    자체는 바뀌지 않았다(`git show 938060138` 로 직접 대조).
  - 제안: 없음. 스코프 이탈 아님.

- **[INFO]** 이전 두 라운드가 이미 지적·처분한 두 경계 사례가 diff 에 그대로 남아 있음 —
  이번 라운드에서 새로 발견된 것은 아니며, 처분 근거가 유효한지만 재확인
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(`cafe24-api-metadata.md §4`
    Principle 7→0 오인용 항목 신규 등재) / `guide-error-code-{existence.test,scan}.ts` →
    `guide-identifier-{existence.test,scan}.ts` (delete+create, `git mv` 아님)
  - 상세: 전자는 이번 PR 목적(식별자 실재성 가드)과 내용상 무관하지만, `developer` 가
    `spec/` 쓰기 권한이 없어 발견 즉시 `plan/` 백로그로 등재해야 하는 프로젝트 관례를 따른
    것이고 plan 체크리스트 자체가 "(선재, 무관)" 이라고 스스로 명시해 은폐가 없다(라운드 1
    scope 리뷰 INFO#1 과 동일 결론). 후자는 재설계 규모(축 구조·기준집합·허용목록 전부 변경)를
    감안하면 순수 리네임이 아니었고, 라운드 1 scope 리뷰가 `--find-renames=25%` 로도 D+A 로
    기록됨을 실측 확인한 뒤 "회고적 이력 재작성은 비용 > 이익" 으로 조치 불요 처리했다 — 이번
    라운드에도 그 처분을 뒤집을 새 근거는 없다.
  - 제안: 조치 불요(재확인).

- **[INFO]** 라운드 1·2 산출물(`review/code/2026/09/13/{14_41_14,15_03_06}/**`,
  `review/consistency/2026/09/13/{12_33_41,14_41_43,15_03_36}/**`)이 이번 diff 의 71개 파일 중
  62개를 차지함 — 스코프 이탈 아님, 프로젝트 관례
  - 위치: `review/code/**`, `review/consistency/**`
  - 상세: 이 저장소는 fix→리뷰 루프에서 각 라운드의 리뷰 산출물을 다음 커밋에 함께 커밋하는
    것이 확립된 관례다(원 리뷰가 stale 판정되지 않으려면 코드 커밋과 리뷰 산출물이 같은
    이력에 있어야 한다). 이번 PR 자체의 목적("가이드 식별자 실재성 가드")과 직접 관련된
    항목이 아니라 **그 목적을 검증한 과정의 기록**이므로 별도 카테고리로 다루되, 스코프
    크리프로 보지 않는다.
  - 제안: 없음.

- **[INFO]** MDX 가이드 본문 자체는 이번 diff 에서 전혀 수정되지 않음 — 스코프가 검증 harness 로
  정확히 국한됨을 재확인
  - 위치: `git diff origin/main...HEAD --name-only` 전수 확인 — `codebase/frontend/src/content/docs/**`
    매치 0건
  - 상세: 이 PR 은 "가이드가 적은 식별자가 실재하는가" 를 검증하는 **가드**만 바꾸고, 검증
    대상인 가이드 문서 자체는 건드리지 않는다. 트래커 항목의 처분 범위와 정확히 일치한다.
  - 제안: 없음.

## 요약

라운드 3 시점 전체 diff(71 files)는 이전 두 라운드의 scope 리뷰가 이미 LOW 로 판정한 범위와
동일하며, 라운드 2 이후 실제로 추가된 코드 변경(커밋 `938060138`)은 그 라운드의 CRITICAL·
WARNING 지적 각각에 1:1로 결속된 최소 수정(전체 경로 인용 교체, 무검증 분기를 겨눈 대조군
5건, 그 대조군이 요구하는 변수 스코프 상향)뿐이다. 요청 이상의 기능 확장·무관한 리팩토링·
포맷팅 드리프트·불필요한 임포트/주석 변경은 관찰되지 않았다. 경계에 있는 두 항목(무관
cafe24 백로그 신규 등재, delete+create 형태의 리네임)은 이전 라운드에서 이미 실측 근거와
함께 조치 불요로 처분됐고 이번 라운드에서 그 처분을 무효화할 새로운 사실은 없다. 다수를
차지하는 `review/**` 산출물은 이 프로젝트의 fix→리뷰 루프 관례에 따른 필수 동반 커밋이다.

## 위험도

LOW
