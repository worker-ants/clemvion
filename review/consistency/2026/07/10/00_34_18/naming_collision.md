# 신규 식별자 충돌 검토

## 검토 범위 확인

`prompt_file` 의 "Target 문서" 섹션은 `spec/5-system/` 디렉터리를 알파벳 순으로 덤프하다 크기
한도에 걸려 `1-auth.md`(status: partial) 와 `10-graph-rag.md`(status: implemented) 만 담고
잘렸다 — 정작 이번 작업이 손대는 `5-expression-language.md` 는 포함되지 못했다. 실제 target 을
`plan/in-progress/trigger-params-autocomplete.md` 와 `git diff`/`git status` 로 직접 확인한 결과:

- 이번 작업(`$params.<name>` 표현식 자동완성)은 **spec 변경이 없다** — plan §비고: "spec 변경
  없음(이미 규정)". `$params` 는 이미 `spec/5-system/5-expression-language.md:171`,
  `spec/4-nodes/7-trigger/1-manual-trigger.md:150` 에 규정돼 있고, PR #875 에서
  `5-expression-language.md` 의 enricher 표(§7.2) 에 `manual_trigger` 행이 이미 추가됐다(4→5개
  노드 타입). 즉 spec 레벨에서 이번 세션이 새로 부여하는 식별자는 없다.
- 실제 uncommitted 변경은 코드 3곳뿐이다: `expression-constants.ts`(ROOT_VARIABLES 에
  `$params` 항목 추가), `use-expression-suggestions.ts`(`$params.` prefix drill 핸들러 추가),
  `use-expression-suggestions.test.ts`(`describe("$params suggestions", …)` 블록 추가).

아래는 이 3개 신규 코드 식별자와 `1-auth.md`/`10-graph-rag.md`(payload target)·
`spec/4-nodes/7-trigger/**`·`spec/5-system/**`·`spec/1-data-model.md`·`plan/in-progress/**`
전체를 대조한 결과다.

## 발견사항

없음 (충돌 미발견).

검토 근거:

- **`$params` (ROOT_VARIABLES label)**: `expression-constants.ts` 의 `ROOT_VARIABLES` 배열
  전체(`$input`/`$node`/`$var`/`$execution`/`$thread`/`$now`/`$loop`/`$item`/`$itemIndex`/
  `$itemIsFirst`/`$itemIsLast`/`$trigger`/`$env` 등)를 대조해도 `$params` 라벨 중복이 없다.
  spec 코퍼스 전수(`grep -rl '\$params' spec/`)는 `spec/4-nodes/7-trigger/0-common.md`,
  `1-manual-trigger.md`, `spec/5-system/12-webhook.md`, `4-execution-engine.md`,
  `5-expression-language.md` 5개 파일에 걸쳐 나오지만, 모두 "`$input.parameters` 단축 참조"
  라는 동일 의미로만 쓰인다 — 다른 의미(예: URL route params, HTTP query params 등)로 재사용된
  곳은 없다.
- **`$params.` prefix drill 핸들러**: `use-expression-suggestions.ts` 의 기존
  `trimmedToken.startsWith(...)` 분기(`$input.`, `$var.`, `$sourceItem.`, `$dataSource.`)와
  대조해도 `$params.` 분기가 겹치지 않으며, 문자열 접두사 순서상 오탐(예: 다른 분기가 먼저
  매칭)도 없다.
- **`describe("$params suggestions", …)` 테스트 블록**: 프론트엔드 전체
  (`codebase/frontend/src`)에 동일 문자열의 `describe` 블록이 재사용된 곳이 없다(단일 정의).
- **payload target (`spec/5-system/1-auth.md`, `10-graph-rag.md`)**: 둘 다 이번 세션의 diff
  범위 밖(최근 커밋 이력도 각각 #865, 그 이전으로 이번 작업과 무관)이며 이미
  partial/implemented 로 정착된 기존 식별자만 담고 있다 — 이번 신규 식별자 3개와 이름이
  겹치는 요구사항 ID·엔티티명·엔드포인트·이벤트명·ENV 키·파일 경로도 없다(예:
  `spec/5-system/10-graph-rag.md` 의 `KB-GR-*` 요구사항 ID 계열은 이번 변경과 접두사·의미
  모두 무관).
- **파일 경로**: 신규 spec 파일도 신규 코드 파일도 생성되지 않았다(기존 3개 파일 편집뿐) —
  경로 충돌 대상 자체가 없다.

## 요약

이번 작업은 spec 이 이미 규정한 `$params` 표현식 단축 참조를 프론트엔드 자동완성에 구현으로
따라잡는 catch-up 이며, spec 레벨 신규 식별자를 도입하지 않는다. 유일한 신규 코드 식별자
(`ROOT_VARIABLES` 의 `$params` 항목, `$params.` drill 핸들러, `"$params suggestions"` 테스트
describe 블록)는 모두 기존 spec 정의·기존 코드 분기·기존 테스트 블록과 이름이 겹치지 않고
의미도 일관된다. `prompt_file` 의 payload target 이 크기 한도로 실제 변경 파일 대신
`1-auth.md`/`10-graph-rag.md` 를 담았지만, 그 내용도 이번 신규 식별자와 무관한 기존
구현체라 대조 결과에 영향이 없다. 신규 식별자 충돌 관점에서는 리스크가 없다.

## 위험도

NONE
