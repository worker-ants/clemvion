# Cross-Spec 일관성 검토 — entity nullable 컬럼 타입 정합화 (배치 2)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 델타: **0개 파일** (정상 — 이 작업은 spec 변경을 동반하지 않음, `plan/in-progress/entity-nullable-column-type-mismatch.md` frontmatter 의 `spec_impact: none` 과 일치)
- 실제 diff: TypeORM 엔티티 9개(`Execution`·`KnowledgeBase`·`NodeExecution`·`Node`·`Notification`·`Schedule`·`Trigger`·`User`·`Workflow`) 의 컬럼 타입을 `nullable: true` DB 컬럼에 맞춰 `| null` 로 넓히고, 일부는 누락된 `type:`(TypeORM `design:type` 메타데이터 방출 버그 회피)을 추가. 부수로 `shared/utils/redact-stored-error.ts`/`.spec.ts` 의 시그니처·주석·테스트 캐스트를 새 타입에 맞춰 정정.
- 이 diff 자체는 **DB 스키마 변경이 아니다** — 모든 대상 컬럼이 원래부터 `@Column({ nullable: true })` 였고, TS 타입만 non-null 로 거짓 서술하던 것을 바로잡는 코드 전용 정정이다.

## 발견사항

### 데이터 모델 정합성 확인 (충돌 없음)

diff 가 넓힌 9개 엔티티의 필드를 `spec/1-data-model.md §2` 핵심 엔티티 표와 전수 대조했다. 아래 필드 전부가 **이미 `?`(nullable) 로 문서화**돼 있어, 이번 코드 정정은 spec 과의 **새로운 불일치를 만들지 않고 오히려 기존 spec 서술에 코드를 맞춘 것**이다.

| 엔티티.필드 | spec/1-data-model.md 표기 | 코드 변경 후 |
|---|---|---|
| Execution.trigger_id | `UUID?` (§2.13) | `string \| null` |
| Execution.finished_at | `Timestamp?` (§2.13) | `Date \| null` |
| Execution.duration_ms | `Integer?` (§2.13) | `number \| null` |
| Execution.input_data / output_data | `JSONB?` (§2.13) | `Record<string,unknown> \| null` |
| Execution.executed_by / parent_execution_id | `UUID?` (§2.13) | `string \| null` |
| NodeExecution.finished_at / duration_ms | `Timestamp?` / `Integer?` (§2.14) | `\| null` |
| NodeExecution.output_data / error / interaction_data | `JSONB?` (§2.14) | `\| null` |
| Trigger.endpoint_path / last_triggered_at | `String?` / `Timestamp?` (§2.8) | `\| null` |
| Schedule.last_run_at | `Timestamp?` (§2.9) | `Date \| null` |
| User.avatar_url / oauth_provider / oauth_provider_id | `String?` (§2.1) | `\| null` |
| Node.description | `String?` (§2.6) | `string \| null` |
| Workflow.description | `String?` (§2.4) | `string \| null` |
| KnowledgeBase.description | `String?` (§2.11) | `string \| null` |
| Notification.resource_type / resource_id / email_sent_at | `String?` / `UUID?` / `Timestamp?` (§2.19) | `\| null` |

`NodeExecution.input_data` 는 spec 상 `JSONB`(non-nullable, §2.14) 이고 diff 도 이 필드를 건드리지 않았다 — `default: {}` 이며 `nullable: true` 가 없으므로 정합 유지.

### [INFO] Schedule.next_run_at — 선재 데이터 모델 문서 오기 (이 diff 는 원인이 아님, 이미 추적 중)

- target 위치: 없음 (이 diff 는 `Schedule.nextRunAt` 을 건드리지 않음 — 코드는 이미 이전부터 `Date | null`)
- 충돌 대상: `spec/1-data-model.md:260` — `| next_run_at | Timestamp | 다음 실행 예정 시각 |` (nullable 표기 `?` 누락. 같은 표 바로 아래 `:261` `last_run_at` 은 `Timestamp?` 로 정확히 표기돼 있어 비대칭)
- 상세: DB 는 처음부터 `nullable: true` 이고 `spec/data-flow/10-triggers.md §3.2`(`cron 파싱 실패 시 next_run_at 은 NULL`) 도 nullable 을 전제하는데, `1-data-model.md` 표만 `Timestamp`(non-null)로 서술한다. 이 diff 가 만든 drift 는 아니며(`nextRunAt` 은 이번 배치의 변경 대상이 아님), `entity-nullable-column-type-mismatch.md` 의 "할 일" 목록에 **이미 planner-turn 후속 항목으로 등재**돼 있다(developer 권한 밖 — 자기-반증형 소정정 예외 미해당).
- 제안: 별도 조치 불요 — 기존 planner-turn 후속(위 plan 문서)에서 처리 예정. 이번 diff 병합을 막을 사유 아님.

### 그 외 충돌 관점 (해당 없음)

- **API 계약** — 이 diff 는 endpoint·DTO·응답 shape 을 변경하지 않는다 (`redact-stored-error.ts` 는 내부 헬퍼이며 export 되는 함수 시그니처의 `| null` 확장은 `T extends {...}` 제네릭 제약을 넓히는 상위호환 변경 — 기존 non-null 호출부는 여전히 대입 가능).
- **요구사항 ID / 상태 전이 / RBAC** — 신규 ID·상태 머신·권한 변경 없음.
- **계층 책임** — 엔티티 타입 정정은 데이터 계층 내부 작업이며 기존 "엔티티 타입은 DB nullable 을 반영한다" 관례(plan 이 인용하는 선례: `Execution.error`, `LlmUsageLog.workflowId/executionId`)를 그대로 따른다. `type:` 메타데이터 보강도 같은 파일 내 기존 컬럼들의 관례(예: `Node.containerId`, `KnowledgeBase.embeddingDimension` 이 이미 `type: 'uuid'`/`'int'` 명시)와 일치.

## 요약

이번 diff(entity nullable 컬럼 타입 정합화 배치 2)는 `spec/5-system/` 을 포함해 어떤 spec 영역도 변경하지 않는 순수 코드 정정이며, `spec/1-data-model.md` 의 기존 엔티티 필드 표(모든 대상 필드가 이미 `?` nullable 로 문서화됨)와 완전히 정합한다 — 오히려 코드가 그동안 spec 서술보다 좁은 타입을 갖고 있던 것을 바로잡았다. 발견된 유일한 관련 항목(`Schedule.next_run_at` 의 `1-data-model.md` 문서 오기)은 이 diff 가 만든 것이 아니고 대상 필드도 이번 변경 범위 밖이며, 이미 같은 plan 문서에 planner-turn 후속으로 명시 등재돼 있어 이 PR 을 막을 사유가 되지 않는다.

## 위험도

NONE
