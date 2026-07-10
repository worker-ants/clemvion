---
title: table/expression 라벨 평가 변수 가용성 불일치 정정 (field=3종 / label=$dataSource만)
worktree: table-label-eval-vars-4f8a12
started: 2026-07-10
owner: project-planner
spec_impact:
  - spec/4-nodes/6-presentation/2-table.md
  - spec/5-system/5-expression-language.md
---

## 배경 (task_986b1dbe)

`expr-autocomplete-table-rows`(#888) 작업 중 cross_spec 이 발견한 내부 불일치. Table 컬럼 표현식의
per-item 변수 가용성이 spec 여러 곳에서 field/label 구분 없이 "3종 모두" 로 과대 서술됨. 실제
`table.handler.ts` 는 **셀(field)=3종, 라벨(label)=`$dataSource`만** 이다.

## 코드 ground truth (`table.handler.ts`)

| 평가 경로 | 주입 변수 | 근거 |
| --- | --- | --- |
| **셀/필드** (`columns[*].field`, 행마다) | `$dataSource` + `$sourceItem` + `$sourceItemIndex` | `:101-103` per-row ctx |
| **라벨** (`columns[*].label`, dynamic 1회) | `$dataSource` **만** | `resolveColumnLabels` `:214-217` (`{...baseCtx, $dataSource}` 뿐) |

## 변경 1 — `spec/4-nodes/6-presentation/2-table.md`

### 1a) §1 "Per-item 표현식 변수" 표에 **가용** 열 추가 (field vs label)
```
**Per-item 표현식 변수**: 컬럼 표현식 평가 시 아래 변수가 추가 주입된다 — 단 주입 범위가 **셀(`columns[*].field`, 행마다 평가)** 과 **라벨(`columns[*].label`, dynamic 모드 1회 평가, §4-7)** 에서 다르다:

| 변수 | 타입 | 가용 | 설명 |
|------|------|------|------|
| `$dataSource` | `unknown[]` | 셀·라벨 | 정규화된 데이터 소스 배열 전체 |
| `$sourceItem` | `unknown` | 셀만 | 현재 순회 중인 배열 항목 (라벨은 행 단위가 아니므로 미주입) |
| `$sourceItemIndex` | `number` | 셀만 | 현재 항목의 0-based 인덱스 (라벨 미주입) |
```
(bold 미사용 — 세 행 "가용" 열 표기 일관, convention INFO 반영)

### 1b) §4 step7 에 §1 상호 참조 한 마디
- "...`$dataSource` 컨텍스트로 평가" 뒤에 "(§1 표의 라벨 가용 범위)" 추가.

### 1c) `## Rationale` 섹션 신설 (rationale_continuity WARNING — 정정 근거 기록; 선례 workflow-list R-4)
```
## Rationale

### R-1 — §1 라벨 per-item 변수 서술 정정 (번복 아님)

§1 은 당초 `columns[*].field`·`columns[*].label` **둘 다** `$sourceItem`/`$sourceItemIndex`/`$dataSource` 3종을 제공한다고 서술했으나, 이는 의도적 설계 결정이 아니라 §4-7·`table.handler.ts`(`resolveColumnLabels`: label 은 dynamic 모드 1회·`$dataSource` 컨텍스트만) 와 애초에 어긋난 부정확 서술이었다. 라벨은 행 단위로 평가되지 않으므로 `$sourceItem`/`$sourceItemIndex` 가 무의미하다. §1 을 코드 진실(field=3종 / label=`$dataSource`만)로 정정한다 — 결정의 *번복*이 아니라 최초 *확정*이다(cf. `2-navigation/1-workflow-list.md` R-4).
```

## 변경 2 — `spec/5-system/5-expression-language.md` (동일 불일치 정합)

### 2a) §4.1 Table 컨텍스트 note(L185) field/label 구분
Before: "> **Table 노드 한정 컨텍스트**: Table 노드의 컬럼 표현식 평가 시 추가로 `$sourceItem`(현재 행 항목), `$sourceItemIndex`(행 인덱스), `$dataSource`(원본 데이터 배열)가 주입된다."
After: "> **Table 노드 한정 컨텍스트**: Table 노드 컬럼 셀(`field`) 표현식 평가 시 `$sourceItem`(현재 행 항목)·`$sourceItemIndex`(행 인덱스)·`$dataSource`(원본 데이터 배열)가 주입된다. 라벨(`label`) 표현식(dynamic 모드 1회 평가)에는 `$dataSource` 만 주입된다 — 상세는 [Table 노드 §1·§4](../4-nodes/6-presentation/2-table.md)."

### 2b) §8.3.3 table 행(L497) field/label 세분화
Before: "| `table` | `columns` | 컬럼 표현식은 행(item)마다 `TableHandler` 내부에서 개별 평가된다 (`$sourceItem` 등 행 컨텍스트 사용) |"
After: "| `table` | `columns` | 셀(`field`)은 행(item)마다 개별 평가(`$sourceItem`/`$sourceItemIndex`/`$dataSource`), 라벨(`label`)은 dynamic 모드 1회 `$dataSource` 컨텍스트로 평가 (`TableHandler` 내부, §4.1·[2-table §1·§4](../4-nodes/6-presentation/2-table.md)) |"

## 워크플로 (project-planner)
- [x] consistency-check --spec — 1차(18_19_18) cross_spec WARNING(expression.md §4.1/§8.3.3 동일 불일치)·rationale WARNING(## Rationale 기록) → scope 확장(expression.md 포함)+Rationale 추가. 2차(18_29_10) **BLOCK:NO** 전수(journal 확보) — INFO만(R-4→§4 앵커·em dash→마침표, 반영)
- [x] spec 반영 (table.md 1a 가용열·1b §4 cross-ref·1c ## Rationale + expression.md 2a §4.1·2b §8.3.3) + **spec-link-integrity 11/11 PASS** (table §1 `#1-설정-config`·workflow-list §4 앵커 실측)
- [ ] plan complete 이동

## 범위 밖
- 에디터 자동완성 과잉 제안(라벨에도 `$sourceItem` 제안)은 UX 힌트로 런타임과 무관(#888 §7.1 note 가 이미 위임). 본 정정으로 그 위임 참조가 정확해짐.

## Rationale (plan)

정정 대상이 table.md 한 곳이 아니라 expression.md §4.1/§8.3.3 에도 동일 과대 서술이 있어(cross_spec
발견) 동일 PR 로 함께 정합화한다 — 반쪽 정정 시 table↔expression 간 새 불일치가 생기기 때문. 근거는
전부 `table.handler.ts` 단일 ground truth 이며 결정 번복이 아닌 부정확 서술 정정이다.
