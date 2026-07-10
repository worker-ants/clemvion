---
title: expression §7.1/§8.4.2 자동완성 표에 Table 노드 컨텍스트 트리거 행 문서화
worktree: expr-autocomplete-table-rows-48830f
started: 2026-07-10
owner: project-planner
spec_area: spec/5-system/5-expression-language.md
spec_impact:
  - spec/5-system/5-expression-language.md
---

## 배경 (후속 A)

Manual-Trigger-param 세션 라인 spec-sync 후속 A. #878 W3 자동완성 리팩터(#885) ai-review
INFO 로 지적된 pre-existing 갭: `use-expression-suggestions.ts` 는 `$sourceItem.`·`$dataSource.`
드릴과 Table 컨텍스트 루트 변수를 지원하나, spec §7.1/§8.4.2 자동완성 트리거 표에 미기재.
behavior 는 이미 병합 완료 → **문서 갭만 메우는 additive 변경**(코드·런타임 무변).

## 코드 ground truth

- `TABLE_CONTEXT_VARIABLES`(`expression-constants.ts:56-60`): `$sourceItem`(expandable)·`$sourceItemIndex`(scalar)·`$dataSource`.
- 루트 `{{` 목록: `isTableContext` 시 `[...scopedRoots, ...TABLE_CONTEXT_VARIABLES]`(`use-expression-suggestions.ts:344-346`) — Table 노드 선택 시에만 합류.
- 드릴: `NESTED_DRILL_SOURCES`(`use-expression-suggestions.ts:186-191`) — `$sourceItem.`·`$dataSource.` 둘 다 `sourceItemSample`(실행 결과 행 샘플) 기반 필드 제안.
- §4.1 L185 이 이미 "Table 노드 한정 컨텍스트($sourceItem/$sourceItemIndex/$dataSource 주입)" 서술 → 신규 앵커 불요, cross-ref.

## 변경 — `spec/5-system/5-expression-language.md`

### §7.1 트리거 조건 표: `$var.` 행 다음에 2행 추가
```
| `$sourceItem.` 입력 | 현재 행 항목 필드 목록 (**Table 노드 컬럼 표현식 한정** — §4.1) — 실행 결과 행 샘플 기반 |
| `$dataSource.` 입력 | 원본 데이터 배열 요소 필드 목록 (**Table 노드 한정**, `$sourceItem` 과 동일 행 샘플 기반) |
```
### §7.1 표 직후 note 추가
```
> Table 노드 컬럼 표현식을 편집할 때는 최상위 참조 변수 목록(`{{`)에 `$sourceItem`·`$sourceItemIndex`·`$dataSource`(§4.1)가 추가로 표시된다. 다른 노드 컨텍스트에는 나타나지 않는다.
```

### §8.4.2 자동완성 표: `$var.` 행 다음에 2행 추가
```
| `$sourceItem.` (Table 노드 한정) | 현재 행 항목 필드 목록 | 실행 결과 행 샘플(`sourceItemSample`) |
| `$dataSource.` (Table 노드 한정) | 원본 배열 요소 필드 목록 | 실행 결과 행 샘플(동일) |
```
### §8.4.2 "표현식 시작" 행 보강
- 현재: `| 표현식 시작 | \`$input\`, \`$node\`, \`$var\`, \`$execution\`, ... | 내장 참조 변수 목록 |`
- Table 노드 컨텍스트에서 `$sourceItem`·`$sourceItemIndex`·`$dataSource` 도 포함됨을 셀에 명시.

## 워크플로 (project-planner)
- [x] consistency-check --spec (10_59_05) — **BLOCK:NO** (Critical 0). naming_collision 디스크 기록, 4개 checker journal 복구. WARNING 3(cross_spec table.md 확산·plan_coherence suggestions 후속·convention 트리거열) + INFO 반영
- [x] spec 반영 (§7.1 2행+note·§8.4.2 2행+표현식시작 보강) + **spec-link-integrity 11/11 PASS** (§4.1 `#41-변수-목록`·table.md 링크 유효)
- [x] suggestions-prefix-dry.md §후속 갱신 (자동완성 행·§2.3 재인증 항목 해소 표기) — plan_coherence WARNING
- [x] plan complete 이동 (커밋 5ac677824 spec 반영 → 본 chore(plan))

## 발견 처분 (consistency WARNING)
- cross_spec: `table.md §1↔§4` label 평가 변수 가용성 내부 불일치 → 내 note 를 "에디터 노출" 로 한정 + §4.1·table.md cross-ref(field/label 미주장). table.md 정정은 **별도 task `task_986b1dbe`** 로 분리.
- convention: §8.4.2 `(Table 노드 한정)` 을 제안 내용 열로 이동(트리거 열 리터럴만).
- rationale: §7.1 note 를 §4.1 cross-ref 링크로(재서술 대신).

## 범위 밖
- `$sourceItem.`/`$dataSource.` 드릴 semantics 세부(sourceItemSample 파생)는 §7.2/§8.3.3 소관 — 미변경.
- `table.md §1↔§4` label 평가 변수 정정 → `task_986b1dbe`.
- 재인증 spec(후속 B·C)은 별 PR(#887).
