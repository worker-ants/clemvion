# 신규 식별자 충돌 검토 — table/expression 라벨 평가 변수 가용성 정정

## 대상
`plan/in-progress/table-label-eval-vars.md` (spec_impact: `spec/4-nodes/6-presentation/2-table.md`, `spec/5-system/5-expression-language.md`)

## 검토 결과

target 문서를 실제 대상 spec 파일(`spec/4-nodes/6-presentation/2-table.md`, `spec/5-system/5-expression-language.md`)의 현재 내용과 대조한 결과, 본 변경은 **신규 식별자를 도입하지 않는다**. 모든 변경은 기존에 이미 존재하는 식별자(`$dataSource`, `$sourceItem`, `$sourceItemIndex`)의 **가용 범위(scope) 서술을 정정**하는 것으로, 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·config 키·파일 경로 중 어느 것도 새로 만들지 않는다.

### 발견사항

- **[INFO]** 변수명 자체는 기존 식별자 재사용 — 충돌 아님
  - target 신규 식별자: 없음 (`$dataSource`/`$sourceItem`/`$sourceItemIndex`)
  - 기존 사용처: `spec/4-nodes/6-presentation/2-table.md:49-51` (§1 "Per-item 표현식 변수" 표), `spec/5-system/5-expression-language.md:185`(§4.1 note), `:497`(§8.3.3 표)
  - 상세: target 1a/2a/2b 는 이 세 변수명을 **새로 정의**하지 않고, field(셀)/label(라벨) 두 평가 경로에서의 가용 여부를 표/문장에 구분 표기하는 정정이다. 변수명·타입·의미 자체는 변경되지 않는다. 확인 결과 현재 `2-table.md:45-51`, `expression-language.md:185`, `:497` 의 "Before" 인용 문구가 실제 파일 내용과 정확히 일치해 target 이 전제한 현재 상태 서술도 정확하다.
  - 제안: 조치 불요.

- **[INFO]** `## Rationale` / `### R-1` 신설 헤딩 — 기존 컨벤션과 일치, 번호 충돌 없음
  - target 신규 식별자: `spec/4-nodes/6-presentation/2-table.md` 에 신설되는 `## Rationale` 섹션의 `### R-1 — §1 라벨 per-item 변수 서술 정정 (번복 아님)`
  - 기존 사용처: 확인 결과 `2-table.md` 에는 현재 `## Rationale` 섹션이 전혀 없다(grep 결과 0건) — 따라서 `R-1` 번호가 같은 파일 내 기존 항목과 충돌할 여지가 없다. `### R-N` 헤딩 넘버링 자체는 `2-navigation/2-trigger-list.md`, `14-execution-history.md`, `7-statistics.md`, `15-system-status.md`, `_layout.md`, `10-auth-flow.md`, `3-workflow-editor/0-canvas.md` 등 spec 전역 20개 파일이 이미 채택 중인 표준 관례이며, target 이 이를 그대로 따른다.
  - 상세: 충돌 없음. 오히려 프로젝트 표준 관례와 정합적.
  - 제안: 조치 불요.

- **[INFO]** 선례 인용 "workflow-list R-4" 표기가 실제 대상 파일의 헤딩 스타일과 다름 (naming collision 범위 밖, 참고용)
  - target 신규 식별자: 해당 없음 (target 이 새로 만드는 식별자가 아니라, target 이 인용하는 기존 문서의 참조 표기)
  - 기존 사용처: `spec/2-navigation/1-workflow-list.md` §Rationale 은 `### R-N` 형식이 아니라 `### 1. ...`, `### 2. ...`, `### 3. ...`, `### 4. 태그 필터는 단일 free-text 로 하향 (2026-07-06)` 형식의 **평문 번호** 헤딩을 쓴다. `### R-4` 라는 헤딩은 해당 파일에 존재하지 않는다.
  - 상세: target 본문 line 64 "(rationale_continuity WARNING — 정정 근거 기록; 선례 workflow-list R-4)" 및 line 70 "(cf. `2-navigation/1-workflow-list.md` R-4)" 의 "R-4" 표기는 target 이 스스로 채택하는 `### R-1` 표기 관례를 workflow-list.md 에도 있는 것처럼 인용한 것인데, 실제로는 그 파일의 4번째 Rationale 항목 헤딩이 `### 4. ...` 이지 `### R-4` 가 아니다. 이는 신규 식별자 충돌은 아니며(두 파일 다 새 이름을 만들지 않음), 새 식별자가 **존재하지 않는 것을 존재하는 것처럼 인용**하는 참조 정확성 문제에 가깝다 — 본 checker 의 6개 관점(요구사항 ID/엔티티/endpoint/이벤트/환경변수/파일경로 충돌) 밖이라 CRITICAL/WARNING 등급을 매기지 않는다. target 이 이미 이 섹션을 "rationale_continuity WARNING" 대상으로 스스로 표시해 별도 관점(rationale_continuity checker)이 다루도록 위임하고 있다.
  - 제안: naming_collision 관점에서는 조치 불요. 참고로만 병기 (rationale_continuity 검토자가 실제 등급 판정).

## 요약
target 은 `2-table.md`/`5-expression-language.md` 두 기존 spec 파일의 기존 변수(`$dataSource`/`$sourceItem`/`$sourceItemIndex`) 가용 범위 서술을 field/label 로 세분화하는 정정 작업이며, 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수·config 키·spec 파일 경로 중 어느 것도 신규로 도입하지 않는다. 신설되는 `### R-1` Rationale 헤딩도 spec 전역에 이미 확립된 `R-N` 번호 관례를 따르며 대상 파일 내 기존 Rationale 항목이 없어 번호 충돌이 없다. 유일한 특이사항은 신규 식별자 문제가 아닌 "workflow-list R-4" 선례 인용의 정확성(해당 파일은 실제로는 평문 번호 헤딩을 씀)인데, 이는 target 자신이 이미 다른 관점(rationale_continuity)으로 표시해 위임한 사안이다.

## 위험도
NONE
