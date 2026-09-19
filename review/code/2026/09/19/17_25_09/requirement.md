# 요구사항(Requirement) 리뷰 2라운드 — 엔티티 컬럼 선언 아홉 곳 정정 + 컬럼 층 가드 보강

## 검증 방법

1라운드(`review/code/2026/09/19/17_04_28/requirement.md`)가 9개 컬럼 수정 전부를 Flyway 마이그레이션(V001·V003·V008·V014·V016·V017·V019·V088)과 대조 완료한 상태에서, 이번 라운드는 **차분(diff)** — 커밋 `717382613`이 `entity-schema-declarations.e2e-spec.ts`에 추가한 `COLUMN_LEVEL_SAMPLES` + 전용 판별력 `it` + `catalog()` 전후 비교 — 이 1라운드에서 발견된 두 testing WARNING(정규식 5분기 중 2분기 미검증, `log()` 비공식 API 안전성 미확인)을 실제로 해소했는지에 집중했다. 9곳 수정 자체를 직접 다시 Flyway 마이그레이션(`V016`·`V017`·`V008`·`V014`·`V001`·`V003`·`V088`·`V019`)과 재대조했고, `spec/1-data-model.md` 필드 타입 표·frontmatter `code:` 목록·Rationale을 Grep/Read로 확인했다. 저장소 파일은 쓰지 않았다(`git status --short` 결과 이 세션이 만든 변경 없음 — 워크트리에 보이는 두 `review/code/**` 디렉터리는 병렬 세션의 산출물).

## 발견사항

- **[INFO]** 9곳의 컬럼 선언 수정이 전부 실제 DB(Flyway 마이그레이션)와 line-level로 일치함을 재확인
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:19`, `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:18`, `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:30,33`, `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:20`, `codebase/backend/src/modules/nodes/entities/node.entity.ts:48`, `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`, `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`, `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79`
  - 상세: `type: 'uuid'` 5곳은 `V016`(`alert_rule.workspace_id UUID NOT NULL`)·`V017`(`workspace_invitation.workspace_id UUID NOT NULL`)·`V008`(`integration_usage_log.node_execution_id`/`workflow_id` 둘 다 `UUID NOT NULL`)·`V014`(`llm_usage_log.workspace_id UUID NOT NULL`)와 직접 대조해 일치를 확인했다. `enumName: 'node_category'`/`'edge_type'`은 `V001__initial_schema.sql`의 `CREATE TYPE node_category ...`/`CREATE TYPE edge_type ...`와 정확히 일치(엔티티가 옵션을 생략하면 TypeORM이 `${table}_${column}_enum`으로 잘못 추론한다). `model_config.kind default: 'chat'`은 `V088`의 `ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'chat'`, `workflow_assistant_session.lastInteractionAt default: () => 'now()'`는 `V019`의 `last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`와 각각 일치한다. `spec/1-data-model.md`의 필드 타입 표(§2.6/§2.7/§2.16 등, `workspace_id | UUID`, `kind | Enum` 등)도 이미 이 사실을 서술해 왔으므로, 이번 변경은 spec·DB가 합의한 사실을 엔티티 데코레이터에 뒤늦게 반영한 것 — 새로운 spec-코드 line-level 불일치는 만들지 않는다.
  - 판단: 기능 완전성·spec fidelity 모두 충족. CRITICAL 없음.

- **[INFO]** 1라운드 testing WARNING 1(`COLUMN_LEVEL` 5개 정규식 중 `ADD "..."`·`RENAME COLUMN` 두 분기가 뮤테이션 검증 밖)이 요구사항 관점에서 실질적으로 해소됨
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:73-95`(`COLUMN_LEVEL_SAMPLES`), `:507-518`(신규 `it('컬럼 층 패턴 …')`)
  - 상세: `caught`/`ignored` 표본은 plan(`plan/in-progress/entity-column-declaration-drift.md` "실측 — 가드 뮤턴트" P1~P4 표)에 기록된 실제 TypeORM 0.3.31 출력을 그대로 옮긴 것이라 손으로 지어낸 값이 아니다. 새 `it` 블록은 (a) `caught` 표본이 전부 `isColumnLevel`을 통과, (b) `ignored` 표본이 전부 통과하지 않음, (c) 다섯 정규식이 **각각** 최소 한 표본을 잡는지를 단언해, "컬럼 추가"·"이름 변경" 두 분기가 조용히 깨져도 이 테스트가 잡아낸다는 원래 요구(컬럼 층 드리프트 탐지의 완전성)를 충족한다.

- **[INFO]** 1라운드 testing WARNING 2(비공식 API `driver.createSchemaBuilder().log()` 호출에 안전장치 없음)에 대한 대응은 **탐지**만 추가됐고, 세부 트레이드오프는 이미 이번 라운드 `testing.md` WARNING이 정확히 포착함(중복 기재하지 않음) — 다만 요구사항 관점에서는 "가드가 DB를 바꾸지 않는다"는 전제를 검증하는 자체 단언(catalog 해시 비교, `:523-535`)이 추가된 것으로 기능 요구(부수효과 없는 read-only 비교)는 명시적으로 뒷받침됐다고 판단한다.

- **[INFO]** `^ALTER TABLE "[^"]+" ADD "` 패턴의 잠재적 취약점 — 스키마 한정(`"public"."table"`) 형태의 컬럼 추가문에는 매치되지 않음
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:61`(`COLUMN_LEVEL` 첫 원소)
  - 상세: 정규식은 `ALTER TABLE "<한 단어>" ADD "` 형태만 잡는다. 실측 샘플(`:78,80`)은 전부 스키마 프리픽스 없는 `ALTER TABLE "alert_rule" ADD ...` 형태라 지금은 문제가 없지만, TypeORM이 향후 버전에서 컬럼 추가문에도 `"public"."table"` 스키마 프리픽스를 붙이게 되면(다른 4개 패턴은 `\b단어\b` 기반이라 영향받지 않는데, 이 패턴만 앵커링·단일 따옴표 쌍 가정에 의존) 이 분기만 조용히 매치를 놓친다. 지금 시점에는 실제로 관측되지 않는 가상 시나리오라 CRITICAL/WARNING이 아니라 참고로만 남긴다.
  - 제안: 조치 불요(현재 실측과 일치). 다음에 TypeORM을 업그레이드해 `COLUMN_LEVEL_SAMPLES`를 재채집할 때 스키마 프리픽스 유무도 함께 확인하면 좋다.

- **[INFO]** plan 헤더 주석(`entity-schema-declarations.e2e-spec.ts:23`)이 아직 존재하지 않는 `plan/complete/entity-column-declaration-drift.md` 경로를 인용 — 실제로는 `plan/in-progress/`
  - 상세: 1라운드 documentation 리뷰(INFO 9)에서 이미 지적된 동일 사안이며, plan 체크리스트의 마무리 단계(트래커 반영·`complete/` 이동)가 완료되면 자연 해소되는 일시적 상태다. 재차 확인만 하고 새 결함으로 집계하지 않는다.

- **[INFO]** plan 체크리스트의 "TEST WORKFLOW" 실측 시점이 이번 라운드가 만든 커밋(`717382613`)보다 하나 앞선 커밋(`3c2b39305`) 기준
  - 위치: `plan/in-progress/entity-column-declaration-drift.md` "체크리스트" 절 ("커밋 `3c2b39305` 기준 lint · unit · build(ratchet 포함) PASS, e2e PASS(backend 354 …)")
  - 상세: `717382613`이 추가한 두 테스트 중 "컬럼 층 패턴 …"은 `db`/`ds`를 쓰지 않는 순수 문자열 매칭이라 로직 결함 위험은 낮지만, 파일 전체가 같은 `describe`의 `beforeAll`(DB 연결)에 묶여 있어 실제 PASS 여부는 e2e 재실행으로만 확인된다. `--impl-done` 이전에 최신 커밋 기준으로 TEST WORKFLOW를 한 번 더 확인해 두는 것이 안전하다 — 다만 이 관찰은 "실측했다"는 문구의 시점 정합성 문제이지, 코드 자체의 기능 결함은 아니다.
  - 제안: `--impl-done` 실행 전 체크리스트 문구를 최신 커밋 기준으로 갱신(또는 재실행 결과 추가).

## 요약

리뷰 대상 diff는 "엔티티 컬럼 선언이 실제 DB와 다른 아홉 곳"이라는 의도한 기능을 완전하게 구현하고, 9건 모두 실제 Flyway 마이그레이션·`spec/1-data-model.md` 필드 타입 표와 line-level로 일치한다 — spec fidelity 관점에서 새로 발생한 불일치는 없다. 이번 2라운드의 실질 변경(컬럼 층 정규식 판별력 테스트 + `log()` 무변경 자체-검증)은 1라운드가 지적한 두 testing WARNING을 요구사항 완전성 관점에서 유효하게 보강했다 — 다섯 정규식 분기 전부가 실측 표본으로 판별력을 갖췄고, "DB를 바꾸지 않는다"는 전제도 카탈로그 해시로 직접 검증한다(단, 예방이 아닌 탐지라는 세부 트레이드오프는 `testing.md` WARNING이 별도로 다룬다). TODO/FIXME/HACK 주석, 반환값 누락, 미완성 에러 처리 등 통상적 결함 패턴은 없다. CRITICAL은 없으며, 발견된 것은 전부 INFO 수준(스키마-프리픽스 정규식 잠재 취약점, 아직 실행되지 않은 `plan/complete/` 경로 인용, 최신 커밋 기준 TEST WORKFLOW 재확인 필요)으로 병합을 막을 사유가 아니다.

## 위험도

LOW
