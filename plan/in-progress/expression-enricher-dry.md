---
title: expression autocomplete enricher DRY 리팩터 (behavior-preserving)
worktree: expression-enricher-dry-fbb5ce
started: 2026-07-10
owner: developer
spec_area: spec/5-system/5-expression-language.md
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
- [ ] `cloneSchema(s)` — structuredClone(+JSON fallback) 추출.
- [ ] `mergeObjectProp(parent, key, props)` — `parent.properties[key]` object 노드
      get-or-create + `.properties` 병합. info_extractor(result.extracted)·form
      (interaction.data)·manual_trigger(parameters) 공용.
- [ ] `enrichByProjecting(base, items, buildProps, attach, warnLabel)` — 공통 골격
      (empty short-circuit·clone·output 탐색·dev-warn·attach). info/form/table/
      manual 4개가 사용. **transform 은 output 을 통째 교체하므로 제외**(별도 유지,
      단 cloneSchema 는 공용).
- [ ] `OUTPUT_SCHEMA_ENRICHERS: Record<string, enricher>` export.

`use-expression-context.ts`:
- [ ] 2곳 dispatch 를 `OUTPUT_SCHEMA_ENRICHERS[type]?.(schema, config) ?? schema` 로.

## 테스트
- [ ] **기존 테스트 전수 통과 = behavior-preserving 보증** (enrichers 40+·
      use-expression-context wiring·suggestions). 신규 동작 없음.
- [ ] `OUTPUT_SCHEMA_ENRICHERS` 5개 타입 매핑 완전성 테스트 1개.

## 워크플로 체크
- [x] consistency-check --impl-prep spec/5-system/ — **BLOCK: NO** (Critical 0). orchestrator target 오선정(무관 문서 평가) + 3파일 FS-flakiness 있었으나 behavior-preserving 순수 리팩터라 위반 여지 없음. 정식 판정은 impl-done.
- [x] TEST(부분): lint PASS / expression unit PASS(248) / build PASS(tsc). 전체 e2e 는 커밋 후 수행
- [ ] /ai-review + SUMMARY/RESOLUTION
- [ ] (spec code-glob 매칭) consistency-check --impl-done spec/5-system/

## 범위 밖 (별도)
- suggestions `$input.`/`$params.`/`$sourceItem.`/`$dataSource.` prefix 분기 DRY
  (#878 W3) — 다른 파일·다른 패턴(drill 핸들러). 이 PR 에 묶으면 scope 비대 → 별도.
- `0-common.md §3` `output:$params` 표기(project-planner lane).

## 비고
순수 내부 리팩터. spec·런타임·백엔드·사용자 가시 동작 무변경. 기존 테스트가 회귀 게이트.
