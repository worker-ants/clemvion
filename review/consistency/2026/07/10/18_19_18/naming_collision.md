# 신규 식별자 충돌 검토 — `plan/in-progress/table-label-eval-vars.md`

### 발견사항

없음.

본 target 은 `spec/4-nodes/6-presentation/2-table.md` §1 의 "Per-item 표현식 변수" 표에 **가용** 열을 추가하고, 셀(`columns[*].field`)과 라벨(`columns[*].label`) 간 변수 주입 범위 차이를 명시하는 **정합성 정정**이다. 검토 관점 6개 항목에 대해 각각 확인한 결과 새로 도입되는 식별자가 없다.

1. **요구사항 ID 충돌** — target 은 어떤 요구사항 ID 도 신설하지 않는다. `table` 노드 spec 의 `id: table` frontmatter 는 기존 그대로이며 변경 없음.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스가 없다. 언급되는 `ColumnDef`, `RowDef` 등은 기존 정의(§1) 그대로이며 target 은 손대지 않는다.
3. **API endpoint 충돌** — 해당 없음. target 은 endpoint 를 다루지 않는다.
4. **이벤트/메시지명 충돌** — 해당 없음.
5. **환경변수·설정키 충돌** — 해당 없음. 새 config key 나 ENV var 없음.
6. **파일 경로 충돌** — 새 spec 파일을 생성하지 않는다. 기존 `spec/4-nodes/6-presentation/2-table.md` 를 in-place 수정할 뿐이며, 경로/네이밍 컨벤션 변경 없음.

target 이 언급하는 `$dataSource` / `$sourceItem` / `$sourceItemIndex` 변수명 자체는 신규가 아니라 이미 `spec/4-nodes/6-presentation/2-table.md:39-51,152,156` 및 `spec/5-system/5-expression-language.md:185,404-408,497,524-527` 에서 "Table 노드 한정 컨텍스트" 변수로 정의·참조되고 있는 기존 식별자다. target 은 이 세 변수의 **의미를 바꾸거나 새 변수를 추가하는 것이 아니라**, 두 spec 문서(§1 vs §4)가 서로 다르게 서술하던 "라벨 평가 시 가용 범위"를 코드(`table.handler.ts` `resolveColumnLabels` :214-217)에 맞춰 통일하는 순수 문서 정정이다. `expression-language.md` 의 §4.1/§7 서술과도 이미 정합적이므로(§4.1 은 "Table 노드 한정 컨텍스트" 3변수를 함께 나열하되 field/label 세분은 table.md 에 위임 — expression-language.md:408 "런타임 가용 범위는 Table 노드 §1·§4 를 따른다"), 이번 정정이 그 참조를 더 정확하게 만든다.

새 파일 생성이나 새 식별자 부여가 전혀 없으므로 이 관점에서 충돌 가능성 자체가 성립하지 않는다.

### 요약
target 문서는 신규 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로)를 전혀 도입하지 않는, 기존 `table.md` 내부 §1↔§4 서술 불일치를 코드 ground truth 에 맞춰 정정하는 순수 문서 수정이다. 언급된 세 변수(`$dataSource`/`$sourceItem`/`$sourceItemIndex`)는 이미 `2-table.md` 와 `5-expression-language.md` 양쪽에서 일관되게 정의되어 있고 이번 변경은 그 가용 범위 서술을 코드와 맞추는 것뿐이므로, 신규 식별자 충돌 관점에서는 점검 대상 자체가 없다.

### 위험도
NONE
