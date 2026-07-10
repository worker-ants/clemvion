# Rationale 연속성 검토 — table-label-eval-vars

## 검토 대상
- target: `plan/in-progress/table-label-eval-vars.md`
- spec_impact: `spec/4-nodes/6-presentation/2-table.md`, `spec/5-system/5-expression-language.md`

## 조사 방법
- `spec/4-nodes/6-presentation/2-table.md` (현재 Rationale 없음 — 신설 예정)와 `spec/5-system/5-expression-language.md`(기존 `## Rationale` 보유)의 실제 내용을 직접 확인.
- `git log -p`로 문제의 "Per-item 표현식 변수" 표(field/label 3종 서술)와 §8.3.3 table 행 서술의 도입 커밋(`db496a3c2` 계열, docs(spec) 전수 상호 감사)을 추적 — 해당 서술이 field/label 을 의도적으로 동일 취급하기로 한 별도 결정(Rationale 항목)에서 나온 것이 아니라, 표 신설 시 부정확하게 일반화된 서술임을 확인.
- 선행 완료 plan `plan/complete/expr-autocomplete-table-rows.md`(#888, task_986b1dbe 부모 작업) 확인 — 해당 작업이 이미 "cross_spec: table.md §1↔§4 label 평가 변수 가용성 내부 불일치" 를 발견하고 "table.md 정정은 별도 task `task_986b1dbe`로 분리" 라고 명시적으로 위임한 사실을 확인. 즉 본 target 은 그 위임의 직접 후속.
- `spec/5-system/5-expression-language.md` §4.1(L185)/§7.1 note(L408)/§8.3.3(L497) 현재 서술과 table.md §1(라벨 행: "dynamic 모드는 핸들러가 `$dataSource` 컨텍스트로 평가")·§4 step7("컬럼 라벨 평가... `$dataSource` 컨텍스트로 평가")을 대조 — §7.1 note 는 이미 "런타임 가용 범위(`field` vs `label` 평가 차이 포함)는 [Table 노드 §1·§4]를 따른다" 로 field/label 구분을 앞서 위임해 두었음을 확인 (target 의 정정과 정확히 합치).
- `spec/5-system/4-execution-engine.md` §ExpressionContext 제외 규칙(`table`/`columns` 행)과 `spec/conventions/node-output.md` 를 확인 — field/label 을 대칭 취급해야 한다는 별도 설계 원칙이나 invariant 는 없음.
- 관련 spec들의 `## Rationale` 전체(0-overview, 1-data-model, 2-navigation/*)를 검토해 "Table 라벨도 `$sourceItem` 등 3종을 제공해야 한다"는 취지로 명시적으로 채택된 대안이 과거에 존재했는지 확인 — 발견되지 않음. 즉 target 이 뒤집는 대상은 "의도된 설계 결정"이 아니라 "미확정 상태에서의 오기"이며, target 의 R-1 문구("정정이며 번복이 아니다")와 부합.
- 선례로 인용된 `spec/2-navigation/1-workflow-list.md` Rationale "4. 태그 필터는 단일 free-text 로 하향"의 "결정의 *번복*이 아니라 최초 *확정*이다" 패턴과 target R-1 의 서술 패턴을 대조 — 동일 프레이밍으로 일관성 있게 사용됨을 확인.

## 발견사항

- **[INFO]** 선례 인용 라벨("R-4")이 실제 헤딩 번호와 다름
  - target 위치: `plan/in-progress/table-label-eval-vars.md` 변경1-1c) 신설 `## Rationale` 초안, "cf. `2-navigation/1-workflow-list.md` R-4" 구절
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` `## Rationale`의 실제 헤딩은 `### 4. 태그 필터는 단일 free-text 로 하향 (2026-07-06)` — `R-4` 프리픽스가 아니라 plain 숫자 `4.` 이다 (해당 문서는 `R-1`/`R-2`... 스타일을 쓰지 않음. `R-` 프리픽스 스타일은 trigger-list.md·execution-history.md 등 다른 문서의 관례).
  - 상세: 프로즈 참조라 실제 링크 anchor 는 걸려있지 않아 spec-link-integrity 는 깨지지 않지만, 독자가 workflow-list.md 안에서 "R-4" 헤딩을 찾으면 존재하지 않아 순간 혼동될 수 있다. 인용하려는 내용 자체(결정 번복이 아닌 최초 확정 프레이밍)는 정확히 일치한다.
  - 제안: spec 반영 시 "R-4" 를 "§4 (태그 필터 단일화)" 등 문서 고유 넘버링에 맞는 표현으로 다듬거나, workflow-list.md 링크(`#4-태그-필터는-단일-free-text-로-하향-2026-07-06`)를 명시.

## 요약
target 은 `table.handler.ts`(라벨 평가는 `resolveColumnLabels` 의 `$dataSource`-only 경로) ground truth 에 맞춰 §1 "Per-item 표현식 변수" 표의 과대 일반화(field=label=3종)를 정정하는 작업이다. 조사 결과 이 field/label 3종 동일 서술은 어떤 spec Rationale 에서도 의도적으로 채택된 결정이 아니라, `db496a3c2`(전수 상호 감사) 커밋에서 도입 당시 §4 step7·`table.handler.ts` 와 대조 없이 일반화된 부정확 서술이었다. 오히려 §4 step7 은 애초부터 라벨을 `$dataSource` 컨텍스트로만 평가한다고 정확히 서술해 왔고, 선행 완료 작업(`expr-autocomplete-table-rows`, #888)이 이미 이 내부 불일치를 발견해 본 target 으로 명시적으로 위임했으며 `expression-language.md §7.1` note 도 이미 이 정정을 예상하고 field/label 구분을 table.md §1·§4 로 미리 위임해 두었다. 따라서 target 은 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하지도, 합의된 설계 원칙을 위반하지도 않으며, "결정 번복 시 새 Rationale 동반" 원칙도 workflow-list.md R-4(§4)와 동일한 프레이밍("번복이 아닌 최초 확정")으로 충실히 따르고 있다. 유일한 사소한 흠은 그 선례 인용 시 실제 헤딩 넘버링("§4")과 다른 라벨("R-4")을 썼다는 점으로, INFO 수준의 표현 정합 문제일 뿐 내용상 충돌은 없다.

## 위험도
NONE
