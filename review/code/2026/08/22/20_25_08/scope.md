# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main...HEAD --stat` 로 68개 파일 전체를 실측했다. 4개 backend 코드 파일은
`git diff origin/main...HEAD -- <파일>` 로 최종 diff 를 직접 열어 프롬프트의 unified diff 와
바이트 단위로 대조했고, `plan/**` · `spec/**` 변경분도 원본 파일을 직접 읽어 대조했다. 이번
브랜치는 5개 커밋(`b2c604469` 코스메틱 4건 → `5ad216901`/`d1d8a95bc` 리뷰 RESOLUTION →
`4a1c8bc48`/`a578366c7` consistency-check WARNING 반영)의 누적이며, 이 세션(`20_25_08`)은 그
전체 누적 diff 를 대상으로 한다. 직전 3회의 scope 리뷰(`19_25_39`/`19_36_12`/`20_05_07`)가
같은 질문(spec frontmatter 1줄, review 산출물 커밋)을 각각 NONE 으로 판정한 바 있어, 이번
라운드는 **그 판정이 여전히 성립하는지 + 최신 2개 커밋이 새 스코프를 열지 않았는지**에 집중했다.

## 발견사항

- **[INFO]** 68개 파일 중 61개가 이전 리뷰/consistency-check 세션의 산출물(`review/code/**`,
  `review/consistency/**`)이고, "실질" 변경은 7개(코드 4 · plan 2 · spec frontmatter 1)뿐이다
  - 위치: `review/code/2026/08/22/{19_25_39,19_36_12,20_05_07}/**`,
    `review/consistency/2026/08/22/{19_03_59,19_48_18,20_05_10}/**` (전부 `new file mode`)
  - 상세: 이 저장소 워크플로(`CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제
    의무")상 developer 는 구현 착수 직전 `consistency-check --impl-prep`, 완료 후
    `/ai-review` + fix, 그리고 fix 마다 `consistency-check --impl-done` 재실행이 의무이고
    그 산출물은 `review/**`(gitignore 제외)에 남는 것이 표준이다. 이번 라운드에 새로 늘어난
    두 세션(`20_05_07` 코드 리뷰 · `20_05_10` consistency)도 정확히 그 패턴 — 직전 라운드
    (`20_05_07`)가 지적한 Swagger 길이 초과 WARNING 을 `a578366c7` 이 반영한 흔적이다.
  - 제안: 조치 불요 — 정상 프로세스 산출물이며, 이미 세 차례 같은 결론에 도달했다.

- **[INFO]** 4개 코드 파일의 최종 diff는 여전히 실행 코드 0줄 — declared 4건(Swagger
  description · base JSDoc wrapper 역참조 · `REASON_TO_DETAIL` JSDoc 3종 · 주석 언어 통일)에
  정확히 대응
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`REASON_TO_DETAIL` 세 항목 JSDoc), `.../utils/resolve-trigger-parameters.ts`
    (`resolveTriggerParameters` JSDoc), `codebase/backend/src/modules/executions/dto/re-run.dto.ts`
    (`inputOverride` `@ApiPropertyOptional.description`), `codebase/backend/src/modules/workflows/workflows.controller.ts`
    (`320-322`, catch 블록 인라인 주석)
  - 상세: `re-run.dto.ts` 는 이번 브랜치 안에서 세 차례(304자→236자→129자) 다듬어졌지만
    (`b2c604469`→`4a1c8bc48`→`a578366c7`), 매 변경이 **같은 필드의 같은 `description`
    문자열** 안에서만 일어났다 — 데코레이터(`@IsOptional()`/`@IsObject()`)·타입(`type: Object`)·
    검증 로직은 세 커밋 내내 무변경. 다른 3개 파일도 `origin/main` 대비 diff 가 JSDoc/주석
    추가·번역에 한정된다. import·시그니처·분기·throw 조건 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** spec frontmatter `code:` 목록 1줄 추가는 여전히 `consistency-check --impl-prep`
  WARNING 반영으로 근거가 명시돼 있다(신규 확장 아님)
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:10`
    (`codebase/backend/src/modules/executions/executions.service.ts` 추가)
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md` "작업" 절이 `19_03_59`
    consistency-check WARNING(§6 이 인용하는 파일이 `code:` 어디에도 없음)의 반영으로
    명시 귀속한다. 변경은 리스트 항목 1줄, 본문·데이터 무변경.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 정본 트래커가 이번
  브랜치 안에서 두 차례(`b2c604469`, `a578366c7`) 갱신됐다 — 체크박스 동기화 + 신규 이월 항목
  등재, 코드 스코프 확장 아님
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 상세: `b2c604469` 는 declared 4건에 대응하는 체크박스 4개를 `[ ]`→`[x]` 로 닫고 실측 근거를
    붙였다. `a578366c7` 는 `20_05_10` consistency-check WARNING(`swagger.md §3` 길이-예외의
    문면 범위가 응답 필드로 좁아 요청 필드인 `inputOverride` 를 포괄하지 못함)을 **코드로
    고치는 대신** 트래커에 신규 이월 항목으로 등재했다 — "예외 범위 확장은 규약 개정이라
    planner 턴" 이라는 이유를 명시했고, 실제로 이번 diff 는 `swagger.md` 를 건드리지 않았다.
    두 갱신 모두 코드 파일을 늘리지 않고 트래커 기록으로만 처리되어 이번 PR 의 "코스메틱 4건"
    스코프를 벗어나지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `plan/complete/masked-marker-cosmetic-followups.md` 는 `5ad216901` 커밋에서
  `in-progress`→`complete` 로 이동하며 체크리스트 미체크 3개를 마저 닫았고, 이후 두 커밋
  (`d1d8a95bc`, `4a1c8bc48`, `a578366c7`)은 이 plan 파일 자체를 더 이상 건드리지 않는다
  - 위치: `plan/complete/masked-marker-cosmetic-followups.md`
  - 상세: `d1d8a95bc`(19_36_12 RESOLUTION)이 이 사실을 스스로 확인해 뒀다 — *"리뷰어 지적대로
    `masked-marker-cosmetic-followups.md` 는 이미 `status: complete` 라 손대지 않았다"*.
    complete 로 봉인된 plan 은 재오픈하지 않고 후속 지적(swagger 길이 초과 등)은 별도
    in-progress 트래커(`spec-sync-external-interaction-api-gaps.md`)로만 흘러간다 — plan
    라이프사이클 규약과 일치.
  - 제안: 조치 불요.

## 요약

68개 파일 diff 중 실질 코드/spec 변경은 7개(코드 4 · plan 2 · spec frontmatter 1)뿐이며, 나머지
61개는 이전 3라운드 `/ai-review` + 3라운드 `/consistency-check` 세션의 표준 산출물이다.
declared "코스메틱 4건"(Swagger description · base JSDoc wrapper 역참조 ·
`REASON_TO_DETAIL` JSDoc 3종 · 주석 언어 통일)은 브랜치 전 구간에 걸쳐(3차례 Swagger 문구
다듬기 포함) 실행 코드 0줄을 유지하며 정확히 그 4건 범위 안에서만 반복 수정됐다. 새로
관측된 두 항목(spec frontmatter 1줄, 정본 트래커 체크박스/신규 이월 항목)도 각각 이전
consistency-check WARNING 반영으로 plan/트래커에 근거가 명시돼 있어 은폐된 확장이 아니다.
직전 3회 scope 리뷰(`19_25_39`/`19_36_12`/`20_05_07`)의 NONE 판정이 이번 최신 2개 커밋
(`4a1c8bc48`, `a578366c7`)에 대해서도 그대로 유지된다 — 새로운 CRITICAL/WARNING 소견 없음.

## 위험도

NONE
