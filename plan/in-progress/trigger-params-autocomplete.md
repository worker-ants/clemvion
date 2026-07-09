---
title: $params.<name> 표현식 자동완성 (spec 이미 규정, 구현 catch-up)
worktree: trigger-params-autocomplete-30acb1
started: 2026-07-10
owner: developer
spec_area: spec/5-system/5-expression-language.md
---

## 배경

`trigger-param-output-enricher`(PR #875) 후속. enricher 로
`$node["…"].output.parameters.<name>` 와 `$input.parameters.<name>` 자동완성은
해소됐으나, **`$params` 는 ROOT_VARIABLES 에 아예 없어** 최상위 후보로도 안 뜨고
`$params.<name>` 하위키 자동완성도 없다(ai-review W1 확인).

spec 은 이미 `$params` 를 규정한다:
- `spec/5-system/5-expression-language.md:171` — `$params | Object | $input.parameters 단축 참조 | {{ $params.userId }}`
- `spec/4-nodes/7-trigger/1-manual-trigger.md:150` — `$params.orderId → "abc-123" (단축 — $input.parameters 별칭)`

즉 **구현이 spec 을 따라가는 catch-up** — spec 변경 불필요.

## 설계

`$params` ≡ `$input.parameters` (resolver: `expression-resolver.service.ts:77-88`
`paramsFromInput = inputObject.parameters`). 자동완성도 동일 소스에 매핑:

- [ ] `expression-constants.ts` ROOT_VARIABLES 에 `$params`(isExpandable) 추가 —
      `$input` 바로 뒤, detail "Trigger parameters shortcut (= $input.parameters)".
      $input 과 동일하게 전역 root var (값 없으면 하위키 빈 결과 — $input 과 일관).
- [ ] `use-expression-suggestions.ts` 에 `$params.` drill 핸들러 추가 —
      `buildNestedSuggestions(inputSample.parameters, prefix, inputSchema.properties.parameters)`.
      `inputSchema` 는 이미 predecessor `.output` 로 descend 돼 있어(enricher 로 트리거
      직속 successor 는 `.properties.parameters` 가 이름별로 enrich 됨).

## 테스트
- [ ] `use-expression-suggestions.test.ts` — `$params` root 후보 노출 + `$params.` →
      트리거 param 이름 하위키 (enriched inputSchema 기반) + 비-successor 노드 빈 결과

## 워크플로 체크
- [x] consistency-check --impl-prep spec/5-system/ — **BLOCK: NO** (5 checker 0 Critical; naming/rationale NONE, cross/convention LOW=내 변경 무관 인접문서, plan_coherence LOW WARNING=상위 후속 2건 갱신 절차 누락). Workflow 자동 BLOCK:YES 는 FS-flakiness 오탐(4/5 파일 미기록), journal 로 전수 확인. **WARNING 해소**: node-output-redesign line 140 완전해소 + enricher 후속 체크박스 체크.
- [x] TEST: **lint PASS / unit PASS(48 파일) / build PASS / e2e PASS(247)** — origin/main(#877) rebase 후 재수행(stale-base 교정). 백엔드 무회귀.
- [x] /ai-review — **MEDIUM / Critical 0 / Warning 3** (rebased base, 범위 정상). W1(picker 테스트)·W2(방어가드 테스트) fix, W3(DRY) 후속. INFO#1(JSDoc 정정)·#5(주석)·#6(tokenStart 테스트)·CHANGELOG·§7.1 행 fix. 누락 3 reviewer journal 확인 전부 LOW. SUMMARY·RESOLUTION 기록(`review/code/2026/07/10/00_52_26/`).
- [x] 리뷰 fix 후 unit 재통과 (suggestions+picker 62)
- [x] 최종 TEST WORKFLOW: **lint PASS / unit PASS(48) / build PASS / e2e PASS(247)** (e2e 1차 postgres 시작 실패는 docker 디스크 압박 — `make e2e-down`+prune 으로 21GB 확보 후 재시도 통과, transient 확정)
- [x] (spec code-glob 매칭) consistency-check --impl-done spec/5-system/ — **BLOCK: NO** (5 checker 전원 실제 diff 기준 NONE/0 Critical). Workflow BLOCK:YES 는 오탐(orchestrator payload 가 무관 target 1-auth/10-graph-rag 전달 + 3파일 FS-flakiness). checker 들은 실제 `git diff` 자가보정 검토(journal 확인), convention 은 실제 diff 로 Agent 재실행 → NONE. 5파일 전수 확보.

## 비고
- spec 변경 없음(이미 규정). enricher(§7.2)가 만든 inputSchema.parameters 를 재사용.
- `$params` 전역 노출은 `$input` 과 동일 정책 — 값 없는 노드에선 하위키 없음(오도 없음).
