# 문서화(Documentation) 리뷰 — trigger (workflow_id) 인덱스 (V111) + select 좁히기

## 발견사항

- **[WARNING]** `spec/conventions/migrations.md` §5 의 "인덱스 교체는 별도 패턴이 있다" 콜아웃이 이번 PR 이 README 에 새로 넓힌 범위(신규 추가에도 DROP-먼저 0단계 적용)를 반영하지 못함
  - 위치: `spec/conventions/migrations.md` (§5, "새 마이그레이션 추가 절차" 절 말미 콜아웃 — grep `인덱스 교체는 별도 패턴`)
  - 상세: 이 PR 의 `codebase/backend/migrations/README.md` 변경(§5)은 "**신규 추가에도 0) 을 둡니다**"라는 새 절을 넣어, 교체(REPLACE)뿐 아니라 신규 추가(V111 처럼 짝이 되는 옛 인덱스가 없는 경우)도 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서를 요구하도록 컨벤션을 넓혔다. 그런데 정식 규약 SoT 인 `spec/conventions/migrations.md` §5 는 여전히 "**기존 인덱스를 갈아 끼우는 마이그레이션은** README §5 의 '인덱스 교체는 DROP-먼저' 를 따른다" 로만 적혀 있어, 신규 추가 케이스를 명시적으로 배제하는 것처럼 읽힌다. `spec/conventions/*.md` 만 참고하고 README 세부 절을 다시 안 읽는 developer 라면, "이건 교체가 아니라 신규 추가니까 DROP-먼저 안 해도 된다"고 오판할 수 있다 — 이는 정확히 이 PR 이 지적하는 `V106` 갭(신규 추가에 짝 DROP 을 안 둬서 실패 시 인덱스가 영영 invalid 로 남는 문제)을 재생산하는 경로다. 이 PR 의 diff 에는 `spec/conventions/migrations.md` 수정이 포함되어 있지 않다.
  - 제안: `spec/conventions/migrations.md` §5 콜아웃을 "기존 인덱스를 갈아 끼우거나 새 인덱스를 추가하는 마이그레이션 모두 README §5 의 DROP-먼저(0단계) 패턴을 따른다" 정도로 넓혀, README 의 확장된 범위와 다시 일치시킨다.

- **[INFO]** `V111.sql` 헤더, 신규 e2e 테스트 docstring, `spec/1-data-model.md` Rationale 세 곳이 아직 존재하지 않는 `plan/complete/spec-draft-trigger-workflow-index.md` 를 인용
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:5`(게이트), `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` 신규 `it` 블록 바로 위 JSDoc(게이트 196), `spec/1-data-model.md` `### Trigger (workflow_id) 인덱스` 절 말미 `> 출처: …` 인용문
  - 상세: 저장소 실측 결과(`find plan -iname "*trigger-workflow-index*"`) 해당 파일은 현재 `plan/in-progress/spec-draft-trigger-workflow-index.md` 에만 존재한다. 세 인용 모두 draft 가 `plan/complete/` 로 옮겨진 뒤를 가정한 경로다. 다만 이는 이미 `review/consistency/2026/09/18/12_26_41/convention_compliance.md` 가 동일하게 WARNING 으로 잡았고, plan 체크리스트(`plan/in-progress/spec-draft-trigger-workflow-index.md` §체크리스트)에도 "draft 이동을 이 PR 의 마지막 커밋에서 한다 — 다른 PR 로 떼지 않는다"로 명시적으로 추적 중이며, 선례(`V110`/`#1285`, `plan/complete/spec-draft-schedule-index.md`)도 같은 패턴(마지막 커밋에서 원자적으로 이동)을 썼다. 새로운 결함은 아니지만, `V111.sql`·e2e 테스트는 머지 뒤 사실상 불변(append-only) 자산이라 마지막 이동 커밋이 실제로 수행되지 않으면 영구적인 dangling 참조로 남는다 — 마무리 커밋 체크리스트 항목이 실제로 실행됐는지 재확인 필요.

## 확인한 양호 사항 (참고)

- `V111__trigger_workflow_id_index.sql` 헤더 주석은 spec 근거·grep 전수·실측 표·DROP-먼저 이유·비대칭 비용까지 모두 담아 이 저장소의 마이그레이션 문서화 관례(V110 선례)를 정확히 따른다.
- `TriggerResourceReleaserService.releaseExternalForParent` 의 새 JSDoc이 주장하는 "읽는 컬럼은 `id`·`type`·`config` 뿐"이라는 서술을 `releaseExternalMany`(→ `type` 으로 schedule 판별) 및 `ChatChannelBinderService.teardownChatChannel`(→ `trigger.config.chatChannel` 직접 참조) 실제 코드와 대조 확인 — 정확하다.
- 신규 e2e 스키마 단언(`indisvalid`, `pg_get_indexdef` 정규식)과 그 위 docstring 은 V110 선례(`schedule-trigger.e2e-spec.ts`)와 동일한 패턴·정확도로 작성됐다.
- `migrations/README.md` §5 신규 절(신규 추가에도 0단계)은 기존 "인덱스 교체는 DROP-먼저" 절 바로 아래 위치해 흐름이 자연스럽고, 교체/신규 추가 두 형태를 표로 명확히 구분한다.
- CHANGELOG.md 에 이번 PR 항목이 없으나, 비교 가능한 선례(V110, 순수 인덱스 추가 마이그레이션)도 별도 CHANGELOG 항목 없이 머지된 바 있어 누락이 아니라 기존 관례와 일치한다.
- 단위 테스트(`trigger-resource-releaser.service.spec.ts`)에 추가된 인라인 주석은 `config`/`type` 누락 시의 구체적 실패 모드(조용한 no-op, schedule job 미탐지)를 설명해 왜 이 단언이 필요한지 명확히 전달한다.

## 요약

이번 PR 자체가 만든 코드·마이그레이션·테스트의 문서화 품질은 높다 — 특히 `V111.sql` 헤더와 새 JSDoc 은 근거·실측·소비처까지 추적 가능하게 적혀 있고, 실제 코드 대조로도 정확함을 확인했다. 다만 이번 PR 이 확장한 "신규 추가에도 DROP-먼저" 컨벤션이 `codebase/backend/migrations/README.md` 에만 반영되고 그 상위 SoT 인 `spec/conventions/migrations.md` 의 요약 콜아웃에는 반영되지 않아, 두 문서 간 범위가 어긋난다(WARNING 1건). `plan/complete/` 선참조 3건은 이미 추적 중인 절차적 사안으로 새 결함은 아니지만 마무리 커밋에서 실제로 해소되는지 확인이 필요하다.

## 위험도

LOW
