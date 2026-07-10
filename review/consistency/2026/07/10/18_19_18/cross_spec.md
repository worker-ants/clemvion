### 발견사항

- **[WARNING]** `table.md` 정정 후에도 `spec/5-system/5-expression-language.md` §4.1(변수 목록)이 field/label 구분 없이 3변수 주입을 단언 — 새 cross-spec 불일치 잔존
  - target 위치: `plan/in-progress/table-label-eval-vars.md` §"변경 — `spec/4-nodes/6-presentation/2-table.md`" (§1 표에 "가용" 열 추가, field=3종/label=1종 구분) + §"범위 밖"(다른 문서 변경 언급 없음)
  - 충돌 대상: `spec/5-system/5-expression-language.md:185` — "> **Table 노드 한정 컨텍스트**: Table 노드의 컬럼 표현식 평가 시 추가로 `$sourceItem`(현재 행 항목), `$sourceItemIndex`(행 인덱스), `$dataSource`(원본 데이터 배열)가 주입된다." (§4.1, "컬럼 표현식" 을 field/label 구분 없이 일괄 서술)
  - 상세: target 이 `2-table.md §1` 을 "셀(field)=3종 / 라벨(label)=`$dataSource`만" 로 정정하면, 같은 사실을 다루는 `expression-language.md §4.1` 의 무조건적 서술("컬럼 표현식 평가 시 추가로 3종 모두 주입")과 정면으로 어긋난다. 동일 문서 §7.1(자동완성, line 408)은 이미 "런타임 가용 범위(`field` vs `label` 평가 차이 포함)는 Table 노드 §1·§4 를 따른다"고 위임 헤지를 달아뒀지만(#888 `expr-autocomplete-table-rows` 작업 결과), §4.1(런타임 변수 목록 섹션) 자체는 헤지 없이 과대 서술을 유지한다. `plan/complete/expr-autocomplete-table-rows.md` 의 "발견 처분" 절에 "table.md 정정은 별도 task `task_986b1dbe` 로 분리" 라고 명시돼 있는데, 그 task 가 바로 본 target 이다 — 즉 §4.1 갱신이 본 target 범위로 넘어왔어야 할 가능성이 높은데 target 의 "범위 밖" 절에는 이 파일이 전혀 언급되지 않는다.
  - 제안: 본 target 의 변경 범위(`spec_impact`)에 `spec/5-system/5-expression-language.md` 를 추가하고, §4.1(line 185) 을 field/label 구분을 반영하도록 수정(예: "…컬럼 표현식 평가 시 추가로 주입된다 — 단 `label` 은 `$dataSource` 만 가용, 상세는 [Table 노드 §1](../4-nodes/6-presentation/2-table.md#1-설정-config))"). 최소한 §7.1 라인 408 과 동일한 위임 헤지를 §4.1 에도 추가해 두 섹션 간 정합을 맞춘다.

- **[WARNING]** `expression-language.md §8.3.3` 핸들러 제외 규칙 표가 "컬럼 표현식은 행마다 평가" 로 일반화 — label 의 1회·비행단위 평가와 모순
  - target 위치: `plan/in-progress/table-label-eval-vars.md` §"§4 step7 에 §1 상호 참조 한 마디(선택)" — `table.md` §4 step7 만 언급, `expression-language.md` 는 대상에 없음
  - 충돌 대상: `spec/5-system/5-expression-language.md:497` — `| \`table\` | \`columns\` | 컬럼 표현식은 행(item)마다 \`TableHandler\` 내부에서 개별 평가된다 (\`$sourceItem\` 등 행 컨텍스트 사용) |` (§8.3.3 핸들러별 제외 규칙 표)
  - 상세: target 자체의 코드 ground truth(`table.handler.ts:214-217`, `resolveColumnLabels`)에 따르면 label 평가는 dynamic 모드에서 **1회**, `$dataSource` 컨텍스트로만 수행되며 행 순회(per-row) 가 아니다. 그런데 §8.3.3 은 "컬럼 표현식은 행(item)마다 … 개별 평가된다 (`$sourceItem` 등 행 컨텍스트 사용)" 라고 field/label 구분 없이 일반화해, label 평가 경로를 부정확하게 기술한다. 이는 target 이 고치는 `table.md §1` 의 내용과 직접 어긋나는 서술이 여전히 다른 spec 파일에 남는 경우다.
  - 제안: §8.3.3 의 `table` 행 설명을 "셀(`field`)은 행마다 개별 평가(`$sourceItem` 등 행 컨텍스트), 라벨(`label`)은 dynamic 모드에서 1회 `$dataSource` 컨텍스트로 평가(§4.1 참조)" 로 세분화. `spec_impact` 에 포함해 같은 PR 에서 갱신하는 것을 권장.

- **[INFO]** `spec/conventions/node-output.md:228` 의 table 행이 "dataSource 에서 per-row expression 평가" 로 rows 전용 서술이라 label 과는 무관 — 확인 결과 충돌 아님, 참고로만 기록
  - target 위치: 해당 없음 (참고용 교차 확인)
  - 충돌 대상: `spec/conventions/node-output.md:228`
  - 상세: 이 표는 `output.rows`/`totalRows` shape 설명이며 label 평가를 다루지 않아 target 변경과 직접 충돌하지 않는다. 별도 조치 불필요.

### 요약
target 은 `2-table.md` 내부(§1↔§4)의 field/label 변수 가용성 불일치를 코드(`table.handler.ts`) ground truth 에 맞게 정확히 정정한다. 다만 동일한 "field=3종/label=`$dataSource`만" 이라는 사실을 다루는 `spec/5-system/5-expression-language.md` 에는 두 곳(§4.1 line 185 런타임 변수 목록, §8.3.3 line 497 핸들러 제외 규칙 설명)이 field/label 구분 없이 "컬럼 표현식은 (행마다) 3변수 모두 주입" 이라는 과대/부정확 서술을 그대로 유지하고 있다. 같은 문서의 §7.1(line 408, 자동완성 절)은 이미 #888 작업에서 "런타임 가용 범위는 Table §1·§4 를 따른다" 는 위임 헤지를 달아 정합을 맞춰뒀는데, §4.1·§8.3.3 은 같은 처리가 안 됐다. `plan/complete/expr-autocomplete-table-rows.md` 가 이 정정을 "task_986b1dbe(본 target)" 로 명시적으로 이관했으므로, 본 target 의 `spec_impact` 를 `spec/5-system/5-expression-language.md` 로 확장해 §4.1·§8.3.3 을 함께 갱신하지 않으면 `2-table.md` 는 정확해지고 `5-expression-language.md` 는 부정확한 채로 남아 새로운(그러나 이미 예견된) cross-spec 불일치가 생긴다. 그 외 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서는 충돌 없음.

### 위험도
MEDIUM
