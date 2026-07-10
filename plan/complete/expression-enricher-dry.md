---
title: expression autocomplete enricher DRY 리팩터 (behavior-preserving)
worktree: expression-enricher-dry-fbb5ce
started: 2026-07-10
owner: developer
spec_area: spec/5-system/5-expression-language.md
spec_impact: none
---

## 배경

ai-review 가 #875(W3/W4)·#878(W3)에서 반복 지적한 중복. "즉시 차단 아님, 6번째
enricher 추가 전 권장". 지금 5개 enricher + `$params.` 추가로 중복이 정점 → 소비.

- **W3**: 5개 `enrich*OutputSchema` 가 `clone → output 노드 탐색 → dev-warn fallback
  → 중첩 경로 병합` 골격 반복. `isSafeFieldName` 필터 루프도 5회 반복.
- **W4**: `use-expression-context.ts` 의 5-way `if/else if` dispatch 가 2곳(`$input`
  fallback L178-201, `$node` output L248-257) 중복 → 노드타입 추가 시 2곳 수정, 하나
  빠뜨리면 조용한 부분회귀.

## 설계 (behavior-preserving, spec/런타임 무변경)

`node-output-schema-enrichers.ts`:
- [x] `cloneSchema(s)` — structuredClone(+JSON fallback) 추출.
- [x] leaf/intermediate 병합 헬퍼 — `mergeLeafProps`(leaf 교체)·`getOrCreateObjectChild`
      (intermediate 보존). info_extractor(result.extracted)·form(interaction.data)·
      manual_trigger(parameters) 공용. + `collectProps`(safe-name 필터 루프 공용).
- [x] `enrichByProjecting(base, items, buildProps, attach, warnLabel)` — 공통 골격
      (empty short-circuit·clone·output 탐색·dev-warn·attach). info/form/table/
      manual 4개가 사용. **transform 은 output 을 통째 교체하므로 제외**(collectProps/
      cloneSchema 만 공용).
- [x] `OUTPUT_SCHEMA_ENRICHERS` export — **null-proto + frozen**(ai-review W1: prototype-key
      dispatch 차단).

`use-expression-context.ts`:
- [x] 2곳 dispatch 를 `OUTPUT_SCHEMA_ENRICHERS[type]?.(schema, config)` 로. import 5→1.

## 테스트
- [x] **기존 테스트 전수 통과 = behavior-preserving 보증** (expression 248 전수).
- [x] `OUTPUT_SCHEMA_ENRICHERS` 완전성 + safe-dispatch(prototype-key undefined) 테스트 2종.

## 워크플로 체크
- [x] consistency-check --impl-prep spec/5-system/ — **BLOCK: NO** (Critical 0). orchestrator target 오선정(무관 문서 평가) + 3파일 FS-flakiness 있었으나 behavior-preserving 순수 리팩터라 위반 여지 없음. 정식 판정은 impl-done.
- [x] TEST: **lint PASS / unit PASS(48 파일) / build PASS / e2e PASS(247)** (커밋 후 전체 수행, prune 으로 디스크 이슈 예방). behavior-preserving 무회귀.
- [x] /ai-review — **LOW / Critical 0 / Warning 2** — W1(레지스트리 null-proto+frozen)·W2(table attach 방어초기화) fix. INFO#4(Form JSDoc 복원)·#6(plan 갱신) fix, 나머지 수용/후속. 누락 3 reviewer journal 확인 전부 LOW/NONE. SUMMARY·RESOLUTION 기록.
- [x] 리뷰 fix 후 관련 unit 재통과(73)
- [ ] 최종 TEST WORKFLOW 재수행 (lint/unit/build/e2e)
- [ ] (spec code-glob 매칭) consistency-check --impl-done spec/5-system/

## 범위 밖 (별도)
- suggestions `$input.`/`$params.`/`$sourceItem.`/`$dataSource.` prefix 분기 DRY
  (#878 W3) — 다른 파일·다른 패턴(drill 핸들러). 이 PR 에 묶으면 scope 비대 → 별도.
- `0-common.md §3` `output:$params` 표기(project-planner lane).

## 비고
순수 내부 리팩터. spec·런타임·백엔드·사용자 가시 동작 무변경. 기존 테스트가 회귀 게이트.
