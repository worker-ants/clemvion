---
title: expression suggestions prefix-drill DRY (#878 W3, behavior-preserving)
worktree: suggestions-prefix-dry-0fae90
started: 2026-07-10
owner: developer
spec_area: spec/5-system/5-expression-language.md
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
- [ ] consistency-check --impl-prep spec/5-system/
- [ ] TEST: lint / unit / build / e2e (화이트리스트 `.ts` → e2e 필수)
- [ ] /ai-review + SUMMARY/RESOLUTION
- [ ] (spec code-glob 매칭) consistency-check --impl-done

## 비고
순수 내부 리팩터. spec·런타임·백엔드·사용자 가시 동작 무변경. 기존 테스트가 회귀 게이트.
