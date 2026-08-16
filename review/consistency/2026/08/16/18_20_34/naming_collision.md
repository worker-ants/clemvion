# 신규 식별자 충돌 검토 — `spec/5-system/` (라운드 `18_20_34`)

## 검토 범위 및 방법

`--impl-done` 모드, diff-base `origin/main`. prompt 번들의 실제 diff 는 컨텍스트 예산 초과로
생략(`<git diff origin/main...HEAD -- code_areas>` 절단)돼 있어, 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서 직접
`git diff origin/main...HEAD`(전체 + `-- spec/5-system/` 필터)를 재실행해 실제 변경분을
확보했다.

이전 라운드(`16_03_57` → `16_32_42` → `16_48_55` → `17_35_13`, 전부 위험도 NONE)가 이미 이
브랜치의 신규 식별자 대부분(함수 `redactStoredErrorForResponse`, private 메서드
`stopInternal`/`toResponseExecution`, TS 타입 `ResponseExecution`, `secret-store.md` 비대상
예외 블록, §R17 확장 불릿, plan 파일 경로)을 전수 대조 완료했다. 본 라운드는 `17_35_13`
이후 새로 쌓인 커밋 2개(`6d57cc7ae` 2라운드 리뷰 fix, `28ac16aa6` 3라운드 문서 정합)의
델타만 추가로 대조했다 — `git show --stat`으로 변경 파일을 확정한 뒤 각 파일을 절대경로로
직접 읽고, 새로 등장한 이름마다 `grep -rn`으로 `codebase/backend/src`·`codebase/frontend/src`·
`spec/` 전체를 훑었다.

## 발견사항

델타가 새로 도입한 식별자는 TS 타입 `ResponseNodeExecution` 하나뿐이며, 충돌 없음.

- **TS 타입 `ResponseNodeExecution`** (`codebase/backend/src/modules/executions/executions.service.ts:91`)
  — `Omit<NodeExecution, 'error'> & { error: Record<string, unknown> | null }`. `17_35_13`
  라운드가 검증한 `ResponseExecution`(Execution 쪽)의 자매 타입으로, 1라운드 fix 가 남긴
  `as NodeExecution` 캐스트를 2라운드에서 제거하며 신설됐다(`6d57cc7ae`). repo 전체를 grep 한
  결과 정의부와 소비처(`ExecutionDetailWithTrigger.nodeExecutions`, `toResponseExecution` 내부
  `.map<ResponseNodeExecution>`) 외에는 등장하지 않는다. frontend 에도 동명 타입 없음. 충돌 없음.
- **`ResponseExecution` 재확인** — `17_35_13` 이후 정의·용례가 그대로다(`stop()` 반환 타입,
  `toResponseExecution` 반환 타입, `ExecutionDetailWithTrigger` 상속). 신규 소비처 추가는
  기존 이름 재참조일 뿐. 충돌 없음.
- **Swagger JSDoc 확장 4곳** (`execution-response.dto.ts` `ExecutionDto.error`/
  `NodeExecutionSummaryDto.error`, `background-run-response.dto.ts` `BackgroundRunNodeExecutionDto.error`)
  — 필드명 변경 없이 doc-comment 만 확장(마스킹 caveat + `EIA §R17` 포인터). 새 필드·타입 없음.
- **문서 교차링크 3건** (`spec/1-data-model.md` §2.14 "응답 마스킹" 행, `12-background.md`
  frontmatter `code:` 등재, `eia-internal-rest-error-masking.md` 갱신) — 전부 기존 식별자
  (`Execution.error`, `nodeExecutions[].error`, §R17, `redact-stored-error.ts`)를 재인용할 뿐
  새 요구사항 ID·엔티티명을 만들지 않는다.
- **`CHANGELOG.md`/`plan-lifecycle.md`/plan 파일 각주** — 상태·수치 정정(plan 레벨 건수 3→4)뿐,
  새 식별자 없음.
- **API endpoint / 이벤트명 / ENV var / 설정키** — 이번 델타(2커밋)도 controller·게이트웨이·
  webhook·queue 정의 파일을 건드리지 않는다(`*.service.ts`·`*.dto.ts`·문서만). 신규 endpoint,
  webhook/queue/SSE 이벤트명, ENV var, config key 도입 없음 — N/A.
- **파일 경로** — 이번 델타에서 신설된 파일 없음. `redact-stored-error.ts`/`.spec.ts` 는 이전
  라운드에서 이미 검증된 파일의 후속 편집일 뿐 신규 생성이 아니다.
- **요구사항 ID (`R17`, `R-5`, `I1`/`D`)** — 전부 기존 tracker/spec 에 이미 등재된 ID 를
  재참조한다. `R17` 은 `14-external-interaction-api.md` 의 기존 rationale 항목("`getStatus`
  실값 노출…")에 새 불릿을 추가한 것이지 신규 `R` 번호를 발급한 게 아니다(`R18`/`R19` 는 그
  이전부터 이미 존재). `I1`/`D` 는 `spec-sync-external-interaction-api-gaps.md` 의 기존 트래커
  항목이다. 충돌 없음.

## 요약

`17_35_13` 라운드가 확인한 신규 식별자 셋(함수·private 메서드 2개·타입 `ResponseExecution`)에
이번 델타(2라운드/3라운드 코드리뷰 fix 커밋)가 더한 신규 식별자는 TS 타입
`ResponseNodeExecution` 하나뿐이다. `codebase/`·`spec/` 전체 대조 결과 동일 이름이 다른 의미로
이미 쓰이는 사례는 없다. 신규 endpoint·이벤트명·ENV var·설정키·spec 파일 경로도 이번 델타
범위에 없으며, 재인용된 요구사항 ID(`R17`/`R-5`/`I1`/`D`)도 모두 기존 등재분이다.

## 위험도

NONE
