# Plan 정합성 검토 — `plan/in-progress/spec-draft-deletion-cascade-indexes.md`

## 확인한 것

- 선행 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md:4609-4617` 의 «`workflow`·`workspace` 를 참조하는 FK 중 선두 인덱스가 없는 여섯» 원문을 직접 열람 — 여섯 항목(`integration_usage_log.workflow_id` · `alert_rule.workflow_id` · `auth_config.workspace_id` · `knowledge_base.workspace_id` · `integration_oauth_state.workspace_id` · `integration_oauth_preview.workspace_id`)이 target draft 가 인용한 것과 정확히 일치한다.
- target 의 "비대상" 표는 이 여섯 중 `integration_usage_log.workflow_id` 하나만 이번 PR(V114)로 닫고, 나머지 다섯(`alert_rule.workflow_id` 포함 워크스페이스 CASCADE 넷)은 "소형 테이블 — 전수 목록에 남긴다" 로 명시적으로 살려둔다 — 트래커 항목을 일방적으로 폐기하지 않고 "전제 정정"으로 좁혀 대체하는 것으로 서술이 일관됨.
- 선례 `plan/complete/spec-draft-trigger-workflow-index.md` 와 그 spec 반영분(`spec/1-data-model.md:959-987` «Trigger `(workflow_id)` 인덱스» 절, 특히 :979-982 «같은 클래스 전수 — 나머지 여섯은 이 결정에 넣지 않았다»)을 대조 — target 의 S3("그 절의 문장은 그 범위에서 참이라 고치지 않고, 새 절이 넓힌 전수를 가리킨다")는 실제 spec 문구와 정확히 부합한다. 새 Rationale 절을 최상단에 삽입하면 "바로 아래 절" 참조도 순서상 맞다.
- 이 선례는 커밋 `4dfa4ea94`(V111, PR #1349)로 이미 `main` 에 머지됨(git log 확인) — target 이 완료로 가정하는 선행 조건은 실제로 해소돼 있다.
- 새 식별자(`V112`~`V116`, 인덱스 이름 다섯)를 `codebase/`·`spec/`·`plan/` 전수 grep — 0건, 마이그레이션 디렉터리 최신 파일도 `V111` 까지만 존재해 `V112` 부터 비어 있다. 충돌 없음.
- target 이 인용하는 spec 앵커 텍스트(`spec/1-data-model.md` §3 NodeExecution/IntegrationUsageLog/LlmUsageLog 기존 행 수, §2.10.1·§2.24 "인덱스" 줄 말미, `data-flow/3-execution.md:199` "(활성 노드 조회/전이)", `data-flow/5-integration.md:338` "V008 `(integration_id, at DESC)`.", `data-flow/7-llm-usage.md:133` "… 통계용")와 `migrations/README.md:177` "신규 추가에도 0) 을 둡니다" 문구를 실물 대조 — 전부 정확히 일치한다.
- 코드 대조(`node-execution.entity.ts`, `llm-usage-log` 관련 마이그레이션 V008/V014, `relation`/`entity` FK 정의)로 실측 주장(CASCADE/SET NULL 방향, nullable 여부, "다음 후보" 지식베이스 FK 존재)이 코드와 맞음을 확인.
- `plan/in-progress/**` 전수에서 이 topic(삭제 연쇄·인덱스·node_execution 보존)과 충돌하는 "결정 필요" 항목이나 이 draft 가 假定하는 미해소 선행 plan을 찾지 못했다(retention/보존 키워드로 넓게 grep 했으나 관련 plan 은 이것과 무관한 문맥).

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

- **[INFO]** 트래커 반영 문구의 구체성
  - target 위치: `## 트래커 반영` (target 문서 :139-140)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4609-4617`
  - 상세: "전제 정정으로 갱신" 이라고만 서술하고 교체될 정확한 문구(37개 전수 표, 32개 잔여 목록, 다음 후보 항목의 정확한 텍스트)는 구현 시점 재량에 맡겨져 있다. 다만 이는 선례 draft(`spec-draft-trigger-workflow-index.md` `## 트래커 반영` 절)도 동일한 프로즈 서술 방식을 썼던 기존 관례이므로 결함이라기보다 관례 준수다.
  - 제안: 구현 커밋에서 트래커 항목을 갈아 끼울 때, 남기기로 한 다섯 항목(`alert_rule.workflow_id` 포함 워크스페이스 CASCADE 넷)이 새 텍스트에서 실수로 누락되지 않도록 확인.

## 요약

target 은 선행 완료 plan(`spec-draft-trigger-workflow-index.md`, 이미 `main` 머지됨)이 남긴 트래커 항목의 전제(부모를 `workflow`·`workspace` 로 한정한 여섯)를 실측으로 반증하고, 그 항목을 폐기가 아니라 "전제 정정"으로 좁혀 대체하는 방식을 취한다 — 원 여섯 중 다섯을 비대상 표에 명시적으로 존치시켜 트래커 유실이 없다. 인접 spec Rationale 절(«Trigger 인덱스» 같은 클래스 전수)은 그 범위 안에서는 여전히 참이라는 이유로 건드리지 않고 새 절에서 가리키기만 하는 처리도 실제 spec 문구와 정합한다. 새 마이그레이션 식별자·인덱스 이름은 grep 0건으로 충돌이 없고, 인용한 모든 spec 앵커 텍스트·코드 FK 정의가 실물과 일치해 실측 주장의 근거도 탄탄하다. `plan/in-progress/**` 전수에서 이 변경과 충돌하는 미해결 결정이나 해소되지 않은 선행 조건은 발견되지 않았다.

## 위험도
NONE
