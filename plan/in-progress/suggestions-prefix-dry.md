---
title: expression suggestions prefix-drill DRY (#878 W3, behavior-preserving)
worktree: suggestions-prefix-dry-0fae90
started: 2026-07-10
owner: developer
spec_area: spec/5-system/5-expression-language.md
spec_impact: none
---

## 배경

#878 ai-review W3: `use-expression-suggestions.ts` 의 4개 drill 핸들러
(`$input.`·`$params.`·`$sourceItem.`·`$dataSource.`)가 `buildNestedSuggestions(sample,
prefix, schema)` 패턴을 반복. "prefix → {getSample, getSchema} 매핑 테이블 + 공통
dispatcher" 로 추출 권장(후속 백로그). #880(enricher DRY) 과 동형 패턴.

## 설계 (behavior-preserving)

- [ ] 모듈 레벨 `NESTED_DRILL_SOURCES` 테이블: `{prefix, getSample, getSchema?, available?}`.
      - `$input.`: getSample=inputSample, getSchema=inputSchema.
      - `$params.`: getSample=guarded(inputSample.parameters→{}), getSchema=inputSchema.properties.parameters.
      - `$sourceItem.`: getSample=sourceItemSample, available=!!sourceItemSample (게이트 — false 시 fall-through).
      - `$dataSource.`: 동일.
- [ ] 4개 if-block → 단일 loop(prefix 매칭 + available 게이트 + buildNestedSuggestions).
      `$var.`(별도 패턴)·`$node[...]`(별도)는 유지. loop 위치는 기존 `$input.` 자리.
- [ ] `$sourceItem.`/`$dataSource.` 미가용 시 root block fall-through 정확 보존.

## 테스트
- [ ] 기존 use-expression-suggestions 테스트 전수 통과 = behavior 보증(신규 동작 없음).

## 워크플로
- [x] consistency-check --impl-prep spec/5-system/ — BLOCK: NO (cross_spec·rationale 확인, 내 리팩터 behavior-preserving·#880 선례 정합. WARNING은 slug-routing auth spec으로 무관)
- [x] rebase onto origin/main(#882 방금 머지, stale-base 교정) — ai-review 범위 정상화
- [x] TEST: **lint PASS / unit PASS(48) / build PASS / e2e PASS(249)**. (unit 1차 FAIL은 `kb-tool-provider.spec.ts` jest-worker SIGSEGV 크래시 = transient flaky, 재실행 PASS. 별개로 origin/main Gate C red(완료 plan 2건 spec_impact 누락)는 fix로 해소)
- [x] /ai-review — **LOW / Critical 0 / Warning 1**(getSample 캐스팅 암묵계약) fix + INFO#4($dataSource nested) fix. SUMMARY/RESOLUTION 기록
- [x] (spec code-glob 매칭) consistency-check --impl-done spec/5-system/ — **BLOCK: NO**(본 PR 기준). 내 diff 는 spec 변경 0(behavior-preserving). Workflow BLOCK:YES 는 orchestrator target 오선정으로 걸린 `1-auth.md §2.3` pre-existing CRITICAL(내 PR 무관) — 별도 task 분리(`task_10ac843b`). cross_spec·naming_collision 이 "diff 는 codebase/frontend 한정, target scope 무관" 독립 확인.

## 후속 (별도, 이 plan 밖)
- ~~spec §7.1/§8.4.2 자동완성 표에 `$sourceItem`/`$dataSource` 트리거 행~~ → **해소**(PR expr-autocomplete-table-rows, 2026-07-10).
- ~~`1-auth.md §2.3` 재인증 3자 불일치 → `task_10ac843b`~~ → **해소**(PR #887 auth-reauth-spec-accuracy, 2026-07-10).

## 비고
순수 내부 리팩터. spec·런타임·백엔드·사용자 가시 동작 무변경. 기존 테스트가 회귀 게이트.
