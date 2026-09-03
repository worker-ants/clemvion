# Rationale 연속성 검토

## 검토 대상

- target scope: `spec/5-system/` (이번 브랜치의 `spec/5-system/` 델타는 0개 파일 — 정상, 코드 전용 PR)
- 실제 diff: `codebase/backend/src/**` 엔티티 13개 파일(`nullable: true` 인 DB 컬럼인데 TS 타입이 non-null 이던 것을 `| null` 로 넓히는 배치, `plan/in-progress/entity-nullable-column-type-mismatch.md` "배치 2") + `redact-stored-error.ts`/그 spec + fixture 2건의 캐스트 제거
- 대조군: `spec/5-system/2-api-convention.md`·`1-auth.md`·`3-error-handling.md` 의 `## Rationale`(본문 포함), `spec/1-data-model.md`·`spec/data-flow/8-notifications.md`·`spec/5-system/14-external-interaction-api.md`·`spec/5-system/13-replay-rerun.md` 의 관련 절(예산 절단으로 프롬프트에 없어 리포지토리에서 직접 `Read`/`grep`)

## 발견사항

없음.

이 diff 는 spec Rationale 이 명시적으로 기각한 대안을 재도입하지도, 합의된 설계 원칙을 위반하지도 않는다. 근거:

1. **§5.4(부재 표현 — `null` vs 키 생략, `2-api-convention.md`)와 충돌하지 않는다.** 이 규칙은 **API 응답 DTO** 필드의 wire 표현(`null` present vs 키 생략)에 관한 것이고, 본 diff 는 DTO 를 전혀 건드리지 않는다 — TypeORM 엔티티(영속 계층) 타입만 DB 의 실제 `nullable: true` 에 맞춰 넓혔다. DTO/wire 계약은 diff 범위 밖이다.

2. **오히려 이미 문서화된 nullable 계약과 코드를 정렬시키는 방향이다.** `spec/1-data-model.md` 는 이번에 넓혀진 모든 컬럼을 이미 `?`(nullable)로 표기하고 있었다 — `avatar_url String?`·`oauth_provider String?`·`oauth_provider_id String?`·`description String?`(Workflow/Node)·`folder_id UUID?`·`endpoint_path String?`·`last_triggered_at Timestamp?`·`last_run_at Timestamp?`·`trigger_id UUID?`(Execution)·`finished_at Timestamp?`·`duration_ms Integer?`·`input_data/output_data JSONB?`·`executed_by UUID?`·`parent_execution_id UUID?`·`interaction_data JSONB?`(NodeExecution)·`resource_type String?`/`resource_id UUID?`(Notification)·`email_sent_at Timestamp?`. TS 타입만 non-null 로 거짓말하고 있었던 선재 결함이었고, diff 는 이를 DB·spec 과 일치시킨다.
   - `spec/5-system/14-external-interaction-api.md` §(durationMs 행)은 "**알 수 없으면 `null`**" 을 명시 계약으로 두고 있어, `Execution.durationMs`/`NodeExecution.durationMs` 를 `number | null` 로 넓힌 것은 이 계약을 코드로 실현한 것이다.
   - `spec/data-flow/8-notifications.md` Rationale ("딥링크와 attribution 을 별도 컬럼으로 분리")은 `resource_type`/`resource_id` 가 상황에 따라 없을 수 있음을 전제로 설계돼 있어, `resourceType`/`resourceId` 를 `| null` 로 넓힌 것과 상충하지 않는다.

3. **"기각된 대안" 재도입 사례 없음.** `spec/5-system/*.md` 의 `## Rationale` 전 항목("410 기본 코드 미신설", "§10.4 위임", "413 공존", "비-페이징 `{data:{items}}` 유지", "conversationThread 키 생략" 등)과 `spec/1-auth.md`·`3-error-handling.md`·`1-data-model.md` 의 `## Rationale` 전 항목을 훑었으나, 엔티티 nullable 타이핑·TypeORM `design:type`·null 처리 방식에 대해 이 diff 와 상충하는 "기각한 대안" 서술은 없다.

4. **코드 내 자기-정정(`redact-stored-error.ts`/그 spec)도 Rationale 연속성 문제가 아니다.** 이 docstring 은 spec `## Rationale` 이 아니라 코드 주석이며, 원문을 취소선(`~~...~~`)으로 **보존한 채** "전제가 무너졌다"는 근거(엔티티가 두 컬럼을 실제로 `| null` 로 넓혔다는 사실)를 명시하고 정정했다 — 무근거 번복이 아니라 근거를 남긴 정정이다.

## 요약

diff(엔티티 nullable 타입 배치 2)는 `spec/5-system/`·`spec/1-data-model.md`·`spec/data-flow/8-notifications.md` 의 `## Rationale`/본문이 이미 기록해 둔 nullable 계약을 코드에 뒤늦게 반영하는 정렬 작업이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 발견되지 않았다. spec 델타가 0인 것도 이 diff 가 DTO/API 계약이 아니라 내부 영속 계층 타입만 건드리기 때문으로, 정합적이다.

## 위험도

NONE
