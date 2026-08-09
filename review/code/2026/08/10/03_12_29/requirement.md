# 요구사항(Requirement) 리뷰 — review/consistency 산출물 26건 + spec/conventions/spec-impl-evidence.md

## 검토 방법

번들 27개 파일은 (a) 4개 라운드(`01_53_28`/`02_18_34`/`02_33_44`/`02_47_31`)의
`review/consistency/**` 산출물 26건 — plan-lifecycle-gates 기능(빌드 가드 3종: 완료 plan
`status` 종료값·살아있는 plan 상대링크·frontmatter 3필드)에 대한 자기-검증 보고서, (b)
`spec/conventions/spec-impl-evidence.md` 의 실제 diff 1건 뿐이다. 순수 리포트/문서 변경이라
"비즈니스 로직" 류 관점은 이 파일들 자체엔 성립하지 않아, 각 보고서가 인용하는 코드 사실
(파일명·줄번호·함수 시그니처·상수 값·커밋 해시)이 현재 워킹트리·git 이력과 실제로
line-level 로 일치하는지를 전수 대조했다 — 이것이 리포트류 변경에 대한 "spec fidelity"의
실질이다. 대조 대상: `codebase/frontend/src/lib/docs/__tests__/{plan-scan.ts,spec-links.ts,
plan-frontmatter.test.ts,plan-scan.test.ts}`, `.claude/docs/plan-lifecycle.md`, `PROJECT.md:277`,
`plan/in-progress/docs-guard-walker-dedup.md`, `plan/in-progress/harness-env-value-subpattern-dedup.md`,
`git log`.

## 발견사항

- **[WARNING]** 이 리뷰 라운드(`03_12_29`)의 diff 범위 자체가 이 PR 의 가장 최근 실질 프로덕션
  코드 변경 2건을 누락했다 — `bc10e215e`(`fix(harness): frontmatter 판정을 plan-scan.ts 로
  추출 + negative-path fixture`, 03:07:38)와 `e64b1218b`(`fix(harness): isIsoDate 라운드트립
  비교를 하나로`, 03:10:27). 둘 다 이 라운드가 시작(`03:12:29`)하기 **직전**에 커밋됐고
  `plan-scan.ts`(`checkPlanFrontmatter`/`isIsoDate` 신설·수정)·`plan-frontmatter.test.ts`·
  `plan-scan.test.ts` 를 실제로 바꾸는데, 27개 파일 목록 어디에도 이 세 `.ts` 파일이 없다.
  router 프롬프트(`_prompts/_router.md`)도 "변경 파일 27개 중 소스 코드 파일 **0개**"로
  판정해 14명 후보 중 `documentation`/`requirement` 만 강제됐다 — security/testing/scope 등
  나머지 12명은 이 실질 로직 변경을 볼 기회 자체가 없다.
  - 위치: 세션 메타 `review/code/2026/08/10/03_12_29/meta.json` (`"files"` 배열 27건) 및
    `_prompts/_router.md` ("소스 코드 파일 0개")
  - 상세: `git log --format='%h %ad %s' -25` 로 확인한 실제 커밋 시각과, `git log --follow --
    review/code/2026/08/10/02_47_31/SUMMARY.md` 결과 이 파일 자체가 `bc10e215e` 에서 커밋됐음을
    확인했다 — 즉 `bc10e215e` 는 "이전 라운드의 WARNING/SPEC-DRIFT 를 고치는 코드"와 "그 라운드의
    review 산출물을 커밋하는 것"을 한 커밋에 같이 했다. 그런데 그 fix 자체(추출된
    `checkPlanFrontmatter`/`isIsoDate` 로직, `plan-scan.test.ts` negative-path fixture 11+건)를
    검증하는 **새로운** `/ai-review` 라운드가 없다 — 이번(`03_12_29`) 라운드가 그 자리여야
    했다면 diff 계산이 대상을 놓친 것이다.
  - 제안: 이 라운드가 `bc10e215e`/`e64b1218b` 를 이미 다른 병행 라운드에서 커버한 것이
    아니라면, `codebase/frontend/src/lib/docs/__tests__/{plan-scan.ts,plan-scan.test.ts,
    plan-frontmatter.test.ts}` 를 대상으로 한 별도 `/ai-review` 를 push 전에 수행할 것. 직접
    코드 대조로는 내용 자체(아래 참조)는 견고해 보이나, harness 규약(CLAUDE.md "구현 완료
    후 자동 review/fix 는 상시 승인된 강제 의무")상 이 단계를 건너뛰면 안 된다.

- **[WARNING]** `review/code/2026/08/10/02_47_31/RESOLUTION.md` 가 존재하지 않는다 — 이 PR 의
  code-review 라운드 8개(`23_43_28`/`00_04_39`/`00_20_50`/`00_39_31`/`00_53_35`/`02_06_01`/
  `02_18_34`/`02_33_44`/`02_47_31`) 중 유일하게 RESOLUTION.md 가 없다(`git ls-files
  "review/code/2026/08/10/*/RESOLUTION.md"` 결과 7건만 나오고 `02_47_31` 은 빠짐). 그 라운드의
  `SUMMARY.md` 는 WARNING 1건(frontmatter 4종 판정 positive-only)·SPEC-DRIFT 1건
  (`.claude/docs/plan-lifecycle.md:83` 가 `TERMINAL_PLAN_STATUSES` 소재를 `plan-frontmatter.test.ts`
  로 잘못 지목)을 냈고, 두 항목 모두 실제로 `bc10e215e` 커밋에서 line-level 로 해소된 것을
  직접 diff 대조로 확인했다(`git show bc10e215e -- .claude/docs/plan-lifecycle.md` 의 "그 파일의
  `TERMINAL_PLAN_STATUSES`" → "`plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES`" 정정, 그리고
  `plan-scan.ts` 의 `checkPlanFrontmatter`/`plan-scan.test.ts` 의 negative-path fixture 11건
  추가). 즉 **내용은 고쳐졌는데 그 라운드를 formal 하게 닫는 RESOLUTION.md 만 빠졌다** — 이 PR
  이 지금까지 7번 지켜온 "라운드마다 SUMMARY→fix→RESOLUTION" 패턴이 마지막 라운드에서만 깨졌다.
  - 위치: `review/code/2026/08/10/02_47_31/` (디렉터리 리스팅에 `RESOLUTION.md` 없음)
  - 상세: `git log --follow -- review/code/2026/08/10/02_47_31/RESOLUTION.md` 실행 결과
    빈 출력(이력 자체가 없음). 다른 7개 라운드는 전부 "docs(review): NN_NN_NN RESOLUTION …"
    형태의 별도 커밋(`d79dd057b`, `c703039ba`, `3b037bc26`, `dfc7a25f9`, `1658b2fdb`,
    `74b87b2c4`, `9e66357f4`, `03321b7ac`)으로 이 파일을 남긴다.
  - 제안: `review/code/2026/08/10/02_47_31/RESOLUTION.md` 를 작성해 WARNING#1·SPEC-DRIFT#1 이
    `bc10e215e`(+`e64b1218b`)로 해소됐음을 명문화 — 특히 W2(prettier 포맷)는 "저장소에
    prettier 설정·의존성이 없어 미반영"이라는 기각 근거가 이미 커밋 메시지에 있으니 그대로
    옮기면 됨. push-gate freshness 판정이 이 파일 존재 여부에 의존하는 다른 harness 라운드가
    있다면(과거 "resolution 후 fresh review" 관행), 이 라운드가 그 계약을 지키지 않은 상태로
    남는다.

- **[INFO]** 위 두 항목을 제외하면, 26개 review/consistency 산출물이 인용하는 사실 관계는
  전수 대조에서 전부 정확했다 — `plan-scan.ts:83`(`collectLivePlanMarkdown` 정의),
  `spec-links.ts:17`(import)·`:304`(`export { collectLivePlanMarkdown }` re-export),
  `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}`(코드·
  `spec-impl-evidence.md §4.2`·`PROJECT.md:277`·`plan-lifecycle.md §4` 4곳 일치), 도입 커밋
  `9e880e908` 의 실제 author date(`2026-08-09 23:33:51`, 정정 전 "2026-08-10" 은 오기였고
  현재 spec·plan-lifecycle·test 3곳 모두 08-09 로 동기화됨 확인), `plan/in-progress/
  docs-guard-walker-dedup.md` 실존·frontmatter(`started: 2026-08-10`, `spec_impact: none`) 및
  본문 인용문 일치, `harness-env-value-subpattern-dedup.md` 의 `#970` 인용 범위 축소 서술과
  실제 파일 내용 일치. TODO/FIXME/HACK/XXX 마커는 26개 리포트 전체에서 0건
  (`grep -rln "TODO\|FIXME\|HACK\|XXX"` 결과 없음).
  - 위치: 해당 없음(정합 확인, 조치 불요)

## spec fidelity (관점 9)

`spec/conventions/spec-impl-evidence.md` 의 실제 diff(§2.2 신규 `status:` plan-frontmatter
구분 문단, §4.2 표의 `plan-frontmatter.test.ts` 행 (1)(2)(3) 3분류 명문화, frontmatter `code:`
에 `plan-scan.ts` 추가)는 현재 코드(`plan-scan.ts`/`spec-links.ts`/`plan-frontmatter.test.ts`)
및 자매 SoT 문서(`PROJECT.md:277`, `.claude/docs/plan-lifecycle.md §4/§5`)와 line-level 로
정확히 일치함을 직접 대조로 확인했다. spec 이 코드보다 낡았거나(SPEC-DRIFT) spec 이 요구하는
동작과 구현이 어긋나는 지점은 발견하지 못했다.

## 요약

번들의 26개 review/consistency 산출물과 1개 spec 정정(`spec-impl-evidence.md`)이 인용하는 코드
사실(줄번호·상수값·커밋 해시·plan frontmatter)은 전수 대조에서 예외 없이 정확했고, 이 라운드
자체의 "요구사항 충족"(3종 plan 라이프사이클 가드가 spec 서술과 일치하는지)에는 결함이 없다.
다만 프로세스 완전성 관점에서 두 가지를 발견했다: (1) 이 라운드(`03_12_29`)의 diff 계산이
직전 두 커밋(`bc10e215e`/`e64b1218b`, 실질 `.ts` 로직 변경)을 완전히 누락해 router 가 "소스
코드 0개"로 오판했고, (2) `review/code/2026/08/10/02_47_31/RESOLUTION.md` 가 이 PR 의 8개
code-review 라운드 중 유일하게 없다 — 해당 라운드의 WARNING/SPEC-DRIFT 는 실제로 고쳐졌지만
그 사실을 닫는 문서가 빠졌다. 두 항목 모두 근본 원인이 같다(가장 최근 fix 커밋에 대한 사후
검증 라운드 부재)고 보이며, push 전에 확인이 필요하다.

## 위험도

MEDIUM
