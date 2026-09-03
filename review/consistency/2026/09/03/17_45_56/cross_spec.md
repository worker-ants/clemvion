# Cross-Spec 일관성 검토 — entity nullable 컬럼 타입 정합화 (배치 2, 최종 라운드)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 델타: **0개 파일** — 정상. `plan/in-progress/entity-nullable-column-type-mismatch.md` frontmatter `spec_impact: none` 과 일치.
- 실제 diff: 13개 파일 / 396줄. TypeORM 엔티티 9개(`Execution`·`KnowledgeBase`·`NodeExecution`·`Node`·`Notification`·`Schedule`·`Trigger`·`User`·`Workflow`)의 컬럼 타입을 `nullable: true` DB 컬럼에 맞춰 `| null` 로 넓히고(배치 2 — "파일 내 비대칭 해소" 기준), 일부 컬럼에 누락된 `type:`(TypeORM `design:type` 메타데이터 방출 버그 회피)을 추가. 부수로 `shared/utils/redact-stored-error.ts`/`.spec.ts` 의 시그니처·주석·테스트 캐스트를 새 타입에 맞춰 정정.
- `HEAD` 는 `af41a3c6e`(`change-password` 실패 코드 정렬, #1269 — spec/5-system/1-auth.md 이미 병합 완료) 이후 `255aa8597`~`adb91ea3e`(entity nullable 배치 1·2 + 리뷰 3라운드, 조치 없음으로 수렴) 를 포함한다. 이번 검토는 그 최종 상태를 대상으로 한다.
- 이 diff 자체는 **DB 스키마 변경이 아니다** — 모든 대상 컬럼이 원래부터 `@Column({ nullable: true })` 였고, TS 타입만 non-null 로 거짓 서술하던 것을 바로잡는 코드 전용 정정이다.

## 발견사항

### 데이터 모델 정합성 확인 (충돌 없음)

diff 가 넓힌 9개 엔티티의 필드를 `spec/1-data-model.md §2` 핵심 엔티티 표와 전수 대조했다(이번 라운드에서 `type:` 이 새로 추가된 컬럼 — `Notification.resourceType`(varchar), `Trigger.endpointPath`(varchar), `User.avatarUrl`/`oauthProvider`/`oauthProviderId`(varchar) — 도 포함해 재확인). 전부가 **이미 `?`(nullable) 로 문서화**돼 있고, 추가된 `type:` 은 스칼라 종류(String→varchar, Integer→int)만 명시할 뿐 spec 이 서술하는 타입(String?/Integer?)과 어긋나지 않는다.

| 엔티티.필드 | spec/1-data-model.md 표기 | 코드 |
|---|---|---|
| Execution.trigger_id/executed_by/parent_execution_id | `UUID?` (§2.13) | `string \| null` |
| Execution.finished_at | `Timestamp?` (§2.13) | `Date \| null` |
| Execution.duration_ms | `Integer?` (§2.13) | `number \| null` |
| Execution.input_data/output_data | `JSONB?` (§2.13) | `Record<string,unknown> \| null` |
| NodeExecution.finished_at/duration_ms | `Timestamp?`/`Integer?` (§2.14 인근) | `\| null`, `type: 'int'` |
| NodeExecution.output_data/error/interaction_data | `JSONB?` | `\| null` |
| NodeExecution.input_data | `JSONB`(non-null, `default: {}`) | **변경 안 됨** — 정합 유지 |
| Trigger.endpoint_path | `String?` (§2.8, 2798행) | `\| null`, `type: 'varchar'` |
| Trigger.last_triggered_at | `Timestamp?` (2800행) | `Date \| null` |
| Schedule.last_run_at | `Timestamp?` | `Date \| null` |
| User.avatar_url/oauth_provider/oauth_provider_id | `String?` (§2.1) | `\| null`, `type: 'varchar'` |
| Node.description | `String?` (§2.6) | `string \| null` |
| Workflow.description | `String?` (§2.4) | `string \| null` |
| KnowledgeBase.description | `String?` | `string \| null` |
| Notification.resource_type | `String?` (§2.19, 3290행) | `\| null`, `type: 'varchar'` |
| Notification.resource_id/email_sent_at | `UUID?`/`Timestamp?` (§2.19) | `\| null` |

**주의해서 배제한 오탐**: `spec/1-data-model.md:3232-3233` 의 `resource_type`/`resource_id`(non-nullable `String`/`UUID`)는 **AuditLog**(§2.18) 표이며, 이 diff 가 건드리는 **Notification**(§2.19)과는 다른 엔티티다 — 같은 필드명이 두 도메인에 있어 줄 번호만으로 인용하면 혼동될 수 있는 자리였다(주어까지 확인).

### API 계약 — `§5.4 부재 표현` 컨벤션과 정합 (충돌 없음)

`2-api-convention.md §5.4`(부재 표현 — `null` vs 키 생략)의 기본 규칙은 "값이 없으면 키는 유지하고 `null`" 이다. 이번 diff 로 넓혀진 필드들(`outputData`/`error`/`resourceType` 등)은 이미 이 규칙을 따르는 응답 필드이고, `redact-stored-error.ts::maskIfPresent`/`redactNodeExecutionRowForResponse` 는 `null` 을 **그대로 보존**(키 생략하지 않음)한다 — 타입 정정이 wire 표현을 바꾸지 않았다. `outputData`/`error` 가 이제 **정적으로도** `null` 이 도달한다는 사실은 오히려 §5.4 서술("이 필드는 응답 계약에 상시 존재하며 지금은 값이 없다")과 타입이 이제 일치함을 뜻한다.

### [INFO] 이미 추적 중인 선재 gap 2건 — 이 diff 가 만든 것 아님, 재확인만

- **`spec/1-data-model.md:260` `Schedule.next_run_at`** 표기가 `Timestamp`(non-null)로, 바로 아래 `last_run_at`(`Timestamp?`)과 비대칭. DB 는 처음부터 `nullable: true`. `entity-nullable-column-type-mismatch.md` "할 일" 목록에 **planner-turn 후속으로 이미 등재**돼 있고(developer 권한 밖), 이번 diff 는 `nextRunAt` 을 건드리지 않았다.
- **`2-api-convention.md §2.2`** 의 리소스 URL 명명 규칙에 `/api/auth/{verb}` 형태 15개 이상이 명시된 두 예외(RPC-style `{id}` 필수 / `/api/external/*`) 어디에도 포섭되지 않는다는 gap 도 같은 plan 문서에 **planner-turn 후속으로 이미 기록**돼 있다.

두 항목 모두 이 PR(entity nullable 배치 2)이 만든 drift 가 아니며, 이번 diff 병합을 막을 사유가 아니다. 재확인 결과 이전 라운드(`17_09_09` cross_spec)와 상태 변화 없음(둘 다 여전히 `[ ]` 미체크, planner 턴 대기).

### 그 외 충돌 관점 (해당 없음)

- **요구사항 ID 충돌** — 신규 ID 부여 없음.
- **상태 전이 충돌** — 상태 머신 변경 없음(`ExecutionStatus`/`NodeExecution` 상태 값 불변).
- **RBAC 충돌** — 권한 구조 변경 없음.
- **계층 책임 충돌** — 엔티티 타입 정정은 데이터 계층 내부 작업이며, 저장소가 이미 확립한 "엔티티 타입은 DB nullable 을 반영한다" 선례(`Execution.error`, `llm-usage-log.workflowId`/`executionId`)를 그대로 따른다. `type:` 메타데이터 보강도 기존 관례(`Node.containerId`, `KnowledgeBase.embeddingDimension` 이 이미 `type: 'uuid'`/`'int'` 명시)와 일치.

## 요약

이번 diff(entity nullable 컬럼 타입 정합화 배치 2, 코드 리뷰 3라운드를 거쳐 "조치 없음"으로 수렴한 최종 상태)는 `spec/5-system/` 을 포함해 어떤 spec 영역도 변경하지 않는 순수 코드 정정이며, `spec/1-data-model.md` 의 기존 엔티티 필드 표(대상 필드 전부가 이미 `?` nullable 로 문서화됨)·`spec/5-system/2-api-convention.md §5.4`(부재 표현은 `null` 유지, 키 생략 아님) 와 완전히 정합한다. 이전 라운드(`17_09_09`)에서 발견된 유일한 관련 항목(`Schedule.next_run_at` 문서 오기)은 재확인 결과 이번 diff 의 원인도 아니고 여전히 별도 plan 의 planner-turn 후속으로 정상 추적 중이라 이 PR 을 막을 사유가 아니다. 이번 라운드에서 새로 추가된 `type:` 명시 컬럼들(varchar 4건)도 spec 서술과 어긋나지 않음을 확인했다.

## 위험도

NONE
