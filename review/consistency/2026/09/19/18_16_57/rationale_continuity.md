# Rationale 연속성 검토

## 검토 범위 및 방법

- 지정 target scope 는 `spec/3-workflow-editor/` 이나, 이 스코프의 spec 델타는 0개 파일이다(프롬프트에도 명시).
- 실제 구현 diff(9파일/320줄, `git diff origin/main...HEAD`)는 백엔드 TypeORM 엔티티 컬럼 선언 9곳(`alert-rule`·`edge`·`integration-usage-log`·`llm-usage-log`·`model-config`·`node`·`workflow-assistant-session`·`workspace-invitation`) 및 `entity-schema-declarations.e2e-spec.ts` 가드 확장이다. 이는 개념적으로 `spec/1-data-model.md`(엔티티·컬럼 정의의 SoT)에 속하며, `spec/3-workflow-editor/`(캔버스·엣지·노드 UX 인터랙션) 의 Rationale 영역과는 층이 다르다.
- 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/entity-column-drift-b83f15`)에서 diff 원문, `spec/1-data-model.md`, 관련 plan 문서(`plan/complete/entity-schema-declaration-drift.md`, `plan/in-progress/entity-column-declaration-drift.md`)를 절대경로로 직접 확인했다.

## 발견사항

### [INFO] 리뷰 스코프와 실제 diff 의 spec 영역 불일치
- target 위치: 프롬프트 헤더 "검토 모드"(`scope=spec/3-workflow-editor/`)
- 과거 결정 출처: 해당 없음(설계 결정이 아니라 이 리뷰 세션의 스코프 지정 문제)
- 상세: `spec/3-workflow-editor/` 델타는 0이고, 실제 코드 diff 는 엔티티 컬럼 선언(데이터 모델 층)이라 `spec/1-data-model.md` 에 속한다. `plan/in-progress/entity-column-declaration-drift.md` 체크리스트도 `--impl-done` 대상으로 `spec/2-navigation/`·`spec/3-workflow-editor/` 둘 다에 `spec/1-data-model.md` 를 "직접 Read 블록" 으로 첨부하도록 이미 명시해 두었다 — 즉 이 비대칭은 작업자도 인지하고 우회책을 마련해 둔 상태다. Rationale 연속성 관점에서 실질적 충돌은 발견되지 않았으나, 이 검토가 "적합한 target" 을 보고 있는지는 별도로 확인이 필요하다.
- 제안: `--impl-done` 스코프에 `spec/1-data-model.md` 를 포함하는 디렉터리(`spec/`) 또는 파일 직접 지정 경로를 쓰는 편이 이 리뷰의 신호 대 잡음비를 높인다. (기능적 문제는 아님 — orchestrator 산출 스코프 선택의 참고사항.)

### [INFO] 컬럼 층 가드 확장은 과거 결정의 승인된 연속(반증 아님)
- target 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 헤더 주석, `UNDECLARED_COLUMNS`/`COLUMN_LEVEL` 신설
- 과거 결정 출처: `plan/complete/entity-schema-declaration-drift.md` §"비대상 — 컬럼 층 (트래커에 등재함)" — 해당 plan 은 "이 PR 의 클래스(없는 인덱스·제약을 주장)와 층이 달라 트래커에 올린다" 고 명시적으로 **미룬** 것이지 기각한 것이 아니다.
- 상세: 이번 diff 는 가드 헤더 주석을 "**방향은 한쪽이다** … 컬럼 정의는 이 가드 밖이다" 에서 "**인덱스·제약 층의 방향은 한쪽이다** … **컬럼 층은 양방향이다**" 로 고쳤다. 겉보기엔 과거 서술("컬럼 정의는 이 가드 밖")을 뒤집는 것처럼 보이지만, (a) `plan/complete/entity-schema-declaration-drift.md` 가 애초에 "트래커에 등재함" 이라 적어 향후 확장을 예고해 두었고, (b) `plan/in-progress/entity-column-declaration-drift.md` 에 사용자 결정("고치고 가드 확장", 2026-09-19)과 근거·뮤테이션 테스트가 함께 실려 있으며, (c) 인덱스·제약 층의 "방향은 한쪽" 원칙 자체는 그대로 보존된다(컬럼 층만 별도 축으로 분리). 새 Rationale 이 spec 문서의 `## Rationale` 에는 아직 없지만(둘 다 `spec_impact: none`), plan 문서에 결정 근거가 충분히 기록되어 있어 "무근거 번복" 에는 해당하지 않는다.
- 제안: 현재로선 문제 없음. 다만 이 가드의 존재는 `spec/1-data-model.md` §"`code:` 에 전용 e2e 가드 셋" Rationale 이 프론트매터로 참조하고 있으므로, 향후 이 plan 이 `complete/` 로 이동할 때 해당 Rationale 항목에 "컬럼 층도 포함(양방향)" 한 줄을 보강하면 spec 자체에서도 추적 가능해진다(선택 사항, 필수 아님).

## 요약

target 스코프(`spec/3-workflow-editor/`)에는 spec 델타가 없고, 실제 구현 diff 는 백엔드 엔티티 컬럼 선언을 실제 DB 스키마에 맞추는 정정 + 회귀 가드 확장으로, 개념적으로는 `spec/1-data-model.md` 층에 속한다. 이 diff 가 재도입한 것으로 보일 수 있는 "컬럼 정의는 가드 밖" 서술의 번복은 과거 plan(`entity-schema-declaration-drift.md`)이 이미 "층이 달라 트래커로 미룬다" 고 명시했던 후속 작업이며, 현재 plan(`entity-column-declaration-drift.md`)에 사용자 결정·실측·뮤테이션 테스트가 함께 기록되어 있어 무근거 번복이 아니다. `spec/3-workflow-editor/` 의 캔버스·엣지·노드 관련 Rationale(팔레트 Recent/Installed, 엣지 분할 스코프, 순환 참조 warn/block, 저장 모델 등)과는 접점이 없으며 위반 사례를 찾지 못했다. `spec/1-data-model.md` 의 데이터 모델 Rationale(인덱스 방향성, FK 처분, `select: false` 사용 기준 등)과도 직접 충돌이 없다.

## 위험도

LOW
