### 발견사항

없음.

target(`plan/in-progress/table-label-eval-vars.md`)은 `expr-autocomplete-table-rows`(완료, `plan/complete/expr-autocomplete-table-rows.md`)의 명시적 후속(`task_986b1dbe`)으로, 그 plan 의 "범위 밖" 절에서 이미 `table.md §1↔§4 label 평가 변수 가용성 내부 불일치 정정`을 별도 task 로 분리해두었던 항목과 정확히 일치한다. 확인 사항:

- **미해결 결정과의 충돌** — 없음. `plan/in-progress/**` 전체를 검색했으나 `columns[*].label` 의 `$sourceItem`/`$dataSource` 가용 범위에 대해 "결정 필요"로 열어둔 다른 plan 은 없다. `node-output-redesign/table.md` 는 D1·D5 결정이 모두 종결(✅)됐고, 유일 잔여 항목(`resolveColumnLabels` throw 경로 unit 테스트 추가)은 코드 테스트 보강이라 target 의 spec 문서 정정과 다른 트랙 — 충돌 없음.
- **선행 plan 미해소** — 없음. target 이 인용하는 `table.handler.ts` ground truth(셀 평가 `itemCtx = {...baseCtx, $dataSource, $sourceItem, $sourceItemIndex}` vs 라벨 평가 `resolveColumnLabels` 의 `ctx = {...baseCtx, $dataSource}`)를 코드에서 직접 대조 확인 — plan 의 서술과 일치. table.md §4 step7("컬럼 라벨 평가... `$dataSource` 컨텍스트로 평가", line 156)도 이미 정확한 상태라 target 이 전제하는 "§4 는 맞고 §1 만 과대"라는 진단에 선행 불일치 없음.
- **후속 항목 누락** — 없음(단, 참고용 INFO 아래 별도 기재). `spec/5-system/5-expression-language.md` §4.1(line 185)의 "Table 노드의 컬럼 표현식 평가 시 추가로 `$sourceItem`/`$sourceItemIndex`/`$dataSource` 가 주입된다"는 일반 서술도 field/label 을 구분하지 않지만, 동일 문서 §7.1 note(line 408)가 이미 "런타임 가용 범위(`field` vs `label` 평가 차이 포함)는 Table 노드 §1·§4 를 따른다"로 detail 을 table.md 에 위임해뒀고, 이 cross-ref 분리는 선행 plan(`expr-autocomplete-table-rows`)이 의도적으로 내린 스코프 결정("table.md 정정은 별도 task_986b1dbe 로 분리")이다. 따라서 §4.1 line 185 자체를 target 범위에 포함시키지 않은 것은 누락이 아니라 기존 결정을 따른 것.

### INFO (참고, 비차단)
- **[INFO]** `expression-language.md` §4.1(line 185) 표현 정밀도
  - target 위치: 해당 없음(target 은 이 라인을 다루지 않음)
  - 관련 plan: `plan/complete/expr-autocomplete-table-rows.md` (§7.1 note 에서 §1·§4 cross-ref로 위임한 지점)
  - 상세: §4.1 line 185 는 "Table 노드의 컬럼 표현식 평가 시 추가로 `$sourceItem`/`$sourceItemIndex`/`$dataSource` 가 주입된다"고 field/label 구분 없이 요약 서술한다. 상세는 §7.1 note 가 table.md 로 위임하므로 내부 모순은 아니나, target 정정 이후에도 이 요약 라인은 여전히 "컬럼 표현식"이라는 통칭을 유지해 label 평가자가 얕게 읽으면 오해 여지가 남는다.
  - 제안: 차단 사유 아님. 향후 `5-expression-language.md` 를 만질 일이 생기면 §4.1 line 185 에도 "(단, `label` 은 `$dataSource` 만 — §7.1 note)" 같은 짧은 각주를 붙이는 정도로 충분. target PR 의 범위를 넓힐 필요는 없음.

### 요약
target 은 `table.handler.ts` 코드(셀 평가 vs `resolveColumnLabels` 라벨 평가의 주입 변수 차이)를 정확히 반영해 `2-table.md` §1 의 과대 서술만 좁히는 순수 문서 정정이며, 이미 완료된 선행 plan(`expr-autocomplete-table-rows`)이 명시적으로 위임한 후속 task 범위와 정확히 일치한다. `plan/in-progress/**` 전체를 대조한 결과 이 정정과 충돌하는 미해결 결정, 미해소 선행 조건, 누락된 후속 항목은 발견되지 않았다.

### 위험도
NONE
