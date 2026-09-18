# 변경 범위(Scope) 리뷰 — trigger (workflow_id) 인덱스

## 검토 대상 요약

- 마이그레이션: `codebase/backend/migrations/V111__trigger_workflow_id_index.{sql,conf}` (신규)
- 코드: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` — `releaseExternalForParent` 의 `find()` 에 `select: { id, type, config }` 추가
- 테스트: 동 서비스 unit spec 의 `select` 단언 추가, `trigger-deletion-releases-resources.e2e-spec.ts` 에 인덱스 스키마 단언(`indisvalid`, `indexdef`) 추가
- plan: `plan/in-progress/spec-draft-trigger-workflow-index.md` (신규 draft)
- spec: `spec/1-data-model.md` §3·Rationale, `spec/data-flow/10-triggers.md` §2.1
- `review/consistency/2026/09/18/{12_18_52,12_26_41}/**` — `--spec`/`--impl-prep` 게이트 산출물 (프로젝트 관례상 커밋 대상, 코드 변경 아님)

## 발견사항

- **[INFO]** spec 편집이 원 트래커의 "첫째·셋째 불릿" 범위를 한 행 초과한다 — `notification_health` 부분 인덱스 행 추가
  - 위치: `spec/1-data-model.md:925` (diff 게이트 기준, §3 인덱스 전략 표)
  - 상세: draft 의 목표(트래커 "부모 삭제 경로의 성능 후속" 첫째·셋째 불릿)는 `(workflow_id)` 인덱스와 `select` 좁히기 두 가지다. 그런데 §3 표에 `Trigger | (notification_health) WHERE notification_health = 'degraded' | …` 행이 함께 추가됐다(V061 이 이미 만든, 문서에 미등재였던 기존 인덱스). 이는 `--spec` 컨시스턴시 체크(`review/consistency/2026/09/18/12_18_52/cross_spec.md` INFO 1)가 지적한 "S1 이 건드리는 바로 그 표에 이미 있던 문서화 갭"을 같은 턴에 메운 것으로, plan 체크리스트에도 `(+ INFO 1 V061 행 · INFO 2 링크)` 로 명시 disclosure 돼 있다. 코드 변경은 전혀 없고 순수 문서 갭 보강이라 실질 위험은 낮지만, 엄밀히는 원래 요청(첫째·셋째 불릿)의 범위를 한 칸 넘어선 추가다.
  - 제안: 현재처럼 plan 체크리스트/커밋 메시지에 근거를 남겨 두면 충분 — 별도 되돌림은 불필요. 다만 이런 "발견된 인접 갭을 같은 PR 에서 메운다" 패턴이 반복되면 범위가 조금씩 넓어질 수 있어, 다음에도 트래커에 별도 항목으로 등재하는 옵션과 저울질할 것.

- **[INFO]** V111 의 DROP-먼저 패턴이 애초 계획(target snapshot)에서 구현 중 변경됨
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` (전체) vs `review/consistency/2026/09/18/12_18_52/_target/spec-draft-trigger-workflow-index.md:84-86` (최초 draft — CREATE-only, V106 형태)
  - 상세: 최초 `--spec` 체크 시점의 target 은 "V106 형태"(CREATE 단독)였으나, 같은 체크의 INFO 3(V110 대비 패턴 차이 사유 미기재)을 받아 최종 구현은 DROP INDEX CONCURRENTLY IF EXISTS 를 앞에 두는 V110 형태로 바뀌었다. 이 자체는 코드 범위를 벗어난 게 아니라 같은 PR 내 반복 리뷰가 정상적으로 반영된 것이며, SQL 파일 주석에도 이유가 상세히 남아 있어 문제되지 않는다. 참고용으로만 기록.

## 스코프 내로 확인된 항목 (문제 없음)

- `releaseExternalForParent` 의 `select` 좁히기는 트래커 "셋째 불릿" 그대로이고, 이를 뒷받침하는 unit/e2e 테스트 변경도 딱 그 범위(선택 컬럼 고정, 인덱스 유효성 단언)에 국한된다 — 추가 리팩토링이나 무관한 로직 변경 없음.
- JSDoc/주석 추가(`trigger-resource-releaser.service.ts`, unit spec)는 모두 이번에 바뀐 `select` 동작을 설명하는 용도로, 불필요한 주석 변경이 아니다.
- `review/consistency/**` 산출물 커밋은 이 프로젝트의 게이트 관례(`--spec`/`--impl-prep`)에 따른 정상 산출물이며 코드 스코프와 무관.
- import/설정 변경 없음. `.conf` 파일은 `CONCURRENTLY` 마이그레이션의 필수 동반 설정(`executeInTransaction=false`)으로 스코프 내.

## 요약

이 변경은 plan draft 가 명시한 스코프(V111 인덱스 + `select` 컬럼 좁히기 + 대응 테스트 + spec 반영)를 정확히 따른다. 유일한 예외는 §3 표에 `notification_health` 부분 인덱스 행을 함께 추가한 것인데, 이는 코드 변경이 아니라 문서 갭 보강이고 plan 체크리스트에 근거가 명시돼 disclosure 되어 있어 실질적 스코프 위반으로 보기 어렵다. 그 외 리팩토링·기능 확장·무관한 파일 수정·포맷팅 혼입·불필요한 임포트/설정 변경은 발견되지 않았다.

## 위험도

LOW
