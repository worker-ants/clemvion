### 발견사항

- **[INFO]** 선례 인용 앵커(`R-4`)가 대상 문서에 실존하지 않음
  - target 위치: `plan/in-progress/table-label-eval-vars.md` 변경1 1c) `## Rationale` 신설안, R-1 문단 말미 `(cf. 2-navigation/1-workflow-list.md R-4)`
  - 충돌 대상: `spec/2-navigation/1-workflow-list.md` `## Rationale` 절
  - 상세: `workflow-list.md` 의 Rationale 하위 헤딩은 `### 1.` ~ `### 4.` (plain 숫자) 형식이며 `R-` 접두 규약을 쓰지 않는다 — `### R-4` 라는 헤딩 자체가 그 문서에 존재하지 않는다. 인용하려는 대상(§4 "태그 필터는 단일 free-text 로 하향" — "결정의 번복이 아니라 최초 확정" 문구)은 실제로 존재해 개념적으로는 맞는 선례지만, 앵커 표기가 부정확해 문서 간 상호 참조를 따라가면 혼동을 준다. 반면 `spec/2-navigation/14-execution-history.md`, `2-trigger-list.md`, `6-config.md` 등 다수 문서는 실제로 `### R-1`/`R-2`... 규약을 쓰므로, target 이 신설하는 `table.md` 의 `### R-1` 헤딩 자체(1c)는 프로젝트 전역 컨벤션과 일치해 문제 없음 — 문제는 인용 대상 문서의 앵커 표기 오기재 뿐이다.
  - 제안: table.md 정정 시 해당 문구를 `(cf. `2-navigation/1-workflow-list.md` §4)` 로 고쳐 실제 헤딩 표기(`### 4.`)와 맞추거나, 헤딩 텍스트 전체("4. 태그 필터는 단일 free-text 로 하향")를 인용해 앵커 불일치를 없앤다. workflow-list.md 자체를 `R-N` 규약으로 갱신할 필요는 없음(범위 밖).

### 요약

target 은 `table.handler.ts`(코드 ground truth: 셀 컨텍스트 `:101-103` = `$dataSource`+`$sourceItem`+`$sourceItemIndex` 3종, `resolveColumnLabels` `:214-217` = `$dataSource` 단독)를 실측 확인한 결과와 정확히 일치하며, 수정 대상 두 파일(`spec/4-nodes/6-presentation/2-table.md` §1/§4, `spec/5-system/5-expression-language.md` §4.1/§8.3.3)의 "Before" 인용문도 현재 spec 원문과 글자 단위로 일치한다. `spec/` 전체를 `sourceItem`/`$dataSource`/`columns[*]` 기준으로 grep 한 결과 이 두 파일 외에는 해당 변수를 언급하는 영역이 없어, target 이 손대지 않는 제3의 spec 영역과 새로 어긋날 여지가 없다. `expression-language.md` §7.1(L404-408)의 기존 "에디터 자동완성은 UX 힌트이며 런타임 가용 범위는 Table §1·§4 를 따른다" 각주는 target 이 언급한 위임 관계와 정합하고, target 이 손대지 않는 §8.4.2(L514-527) 자동완성 표도 동일하게 "field/label 미분리·UX 힌트"로 성격이 같아 새로운 모순을 만들지 않는다. 요구사항 ID·데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어느 관점에서도 target 은 신규 개념을 도입하지 않고 기존 두 문서의 부정확한 서술을 코드 진실로 맞추는 순수 정정이라 실질적 충돌이 없다. 유일한 흠은 신설 Rationale 이 인용하는 타 문서 앵커(`R-4`)가 실제 헤딩 표기와 다르다는 표기상의 사소한 문제뿐이다.

### 위험도
NONE
