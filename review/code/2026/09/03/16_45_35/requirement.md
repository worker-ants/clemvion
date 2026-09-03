# 요구사항(Requirement) 리뷰 — entity nullable 타입 정합 배치 2 (30필드/9파일)

## 검증 방법

정적 대조 외에 다음을 직접 실행해 확인했다 (저장소 트리 뮤테이션 없음 — 전부 read-only 실행):

- `npx tsc --noEmit -p tsconfig.json` → 전체 198건 에러 중 **비-spec(`*.spec.ts` 아닌) 소스 에러 0건** (plan 이 주장하는 "타입 오류 0건 증가" 를 직접 재현·확인)
- `npx jest src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` → **12/12 PASS** (이 배치의 회귀 가드 자체)
- `npx jest src/shared/utils/redact-stored-error` → **34/34 PASS**
- 9개 변경 엔티티 파일에 대해 `nullable: true` 인데 아직 non-null TS 타입으로 남은 필드가 있는지 별도 스캔 → **0건** (plan 의 "9파일 30필드 완료" 주장과 일치, 파일 내 비대칭 완전 해소 확인)
- `git status --short` → 리뷰 중 저장소 변경 없음, 원복 불필요

## 발견사항

- **[INFO]** 필드 개수/분류 실측 재검증 — plan 문서의 "9파일 30필드(column 24·relation 6)" 주장을 diff 를 직접 세어 대조: `execution.entity.ts`(10) + `knowledge-base.entity.ts`(1) + `node-execution.entity.ts`(5) + `node.entity.ts`(3) + `notification.entity.ts`(3) + `schedule.entity.ts`(1) + `trigger.entity.ts`(2) + `user.entity.ts`(3) + `workflow.entity.ts`(2) = 30, relation 6(`trigger`/`executor`/`parentExecution`/`container`/`toolOwner`/`folder`) · column 24 — **정확히 일치**.
  - 위치: 리뷰 대상 파일 1~9 전체
  - 상세: 수치 주장이 검증 가능했고 실측이 일치했다. 별도 조치 불요.

- **[INFO]** `type:` 추가 대상(4건: `Execution.durationMs`, `NodeExecution.durationMs`, `Notification.resourceType`, `Trigger.endpointPath`, `User.avatarUrl`/`oauthProvider`/`oauthProviderId`)의 DB 실제 컬럼 타입을 `migrations/*.sql` 로 직접 대조.
  - 위치: `codebase/backend/migrations/V001__initial_schema.sql:16,28,29,151` (VARCHAR), `codebase/backend/migrations/V001__initial_schema.sql:223,242` + `V083__execution_active_running_ms.sql` (INTEGER)
  - 상세: `duration_ms` 는 두 테이블 모두 `INTEGER` → `type: 'int'` 정확. `avatar_url`/`oauth_provider`/`oauth_provider_id`/`endpoint_path`/`resource_type` 은 전부 `VARCHAR(n)` → `type: 'varchar'` 정확. 앞서 부팅 실패를 낸 `Object` 방출 클래스(TypeORM `design:type`)가 이번엔 전부 회피됐다.
  - 제안: 없음(확인 완료).

- **[INFO]** `spec/1-data-model.md` §2.6/2.9/2.13/2.14/2.19/2.20(Trigger)/2.1(User)/2.4(Workflow)/2.11(KnowledgeBase) 의 nullable 표기(`?` 접미사 관례)와 line-level 대조.
  - 위치: `spec/1-data-model.md:62,74,75,118,159,235,343,465,469,470,472,473,475,476,481,549,550,552,555,727,728,732`
  - 상세: 이번에 넓힌 필드(`avatarUrl`·`oauthProvider`·`oauthProviderId`·`description`(3곳: Workflow/Node/KnowledgeBase)·`endpointPath`·`trigger`/`triggerId`·`finishedAt`·`durationMs`·`inputData`/`outputData`(NodeExecution 은 `error` 만 해당, `inputData` 는 non-null 유지 — 코드도 `inputData: Record<string, unknown>`(non-null, `default: {}`) 로 그대로라 spec 의 `JSONB`(non-null) 표기와 일치)·`executedBy`/`executor`·`parentExecutionId`/`parentExecution`·`interactionData`·`resourceType`/`resourceId`·`emailSentAt`·`lastRunAt`·`lastTriggeredAt`·`container`/`toolOwner`·`folder`) 전부 spec 이 이미 `?`/nullable 로 표기하고 있었다. **코드가 spec 을 뒤늦게 따라잡는 정합 배치**이지, spec 과 어긋나는 곳이 없다.
  - 제안: 없음.

- **[INFO][SPEC-DRIFT 아님 — 기존에 이미 추적됨]** `spec/1-data-model.md:260`(`Schedule.next_run_at | Timestamp |`, non-null 표기)이 DB 실제(`nullable: true`, 코드 `Date | null`, batch 1 에서 이미 넓힘)와 다르다는 사실을 확인했으나, 이는 **이번 diff(batch 2)가 새로 만든 불일치가 아니라 선재 spec 오류**이고, `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158`(리뷰 대상 파일 11) 자신이 이미 "**developer 권한 밖 — planner 턴 후속**" 으로 정확히 식별·등재해 두었다. 같은 문서가 `2-api-convention.md §2.2` 액션 네임스페이스 gap 도 별도 후속으로 등재. 절차가 이미 올바르므로 이 리뷰가 추가로 취할 조치는 없다 — 다만 SUMMARY 집계 시 "이 PR 의 spec 정합 상태" 판단에 참고하라고 명시해 둔다.
  - 위치: `spec/1-data-model.md:260-261`, `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158`
  - 제안: 없음 — 이미 planner 턴 대기 항목으로 정확히 이월돼 있음. project-planner 가 다음 턴에 처리.

- **[INFO]** `redact-stored-error.ts` 의 docstring 자기수정(취소선 보존 + 정정문 추가, `maskIfPresent`/`redactNodeExecutionRowForResponse` 시그니처를 `| null` 로 확장)이 실제 동작과 일치하는지 로직 대조.
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:156-161`(`maskIfPresent`), `:176-191`(`redactNodeExecutionRowForResponse`)
  - 상세: `value == null` 가드는 변경 전과 동일한 본문이라 `null`/`undefined` 두 부재 형태 모두 기존과 같은 결과를 낸다 — 시그니처만 실제 정적 도달 가능성을 반영하도록 넓어졌다. 이 파일은 `spec/` 이 아니라 코드 내부 docstring 자기수정이라 "자기-반증형 소정정"(spec 한정) 규약과 무관하며, 코드 파일 자기수정에는 별도 승인 절차가 걸리지 않는다. `NodeExecution.inputData`/`outputData`/`error` 가 이번 배치로 `| null` 이 됐고 호출부(`executions.service.ts:709`)가 `NodeExecution` 엔티티 그대로 넘기므로 제네릭 제약 확장이 실제로 필요했던 변경이다(그렇지 않았다면 `tsc` 가 여기서 에러를 냈을 것 — 실측상 0건이므로 정합).
  - 제안: 없음.

- **[INFO]** `NodeExecution.parentNodeExecutionId` 관계-공급 예외가 실측대로 동작하는지 가드 코드(`nullable-type-lie-cast-guard.ts:109-126`)를 직접 열어 확인 — `@JoinColumn({ name })` 과 컬럼명이 정확히 일치할 때만 면제하는 로직이며, 경계(불일치 시 미면제)까지 대조군 테스트(`nullable-type-lie-cast.spec.ts` "[예외 경계]" 케이스)로 고정돼 있다. `Execution.triggerId`/`executedBy`/`parentExecutionId` 도 동일 예외로 `type:` 미부여 상태가 정당함을 확인(각각 `trigger`/`executor`/`parentExecution` 의 `@JoinColumn` 컬럼명과 일치).
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:109-126`
  - 제안: 없음.

## 요약

리뷰 대상은 엔티티 9개 파일의 nullable 컬럼 TS 타입 비대칭 30필드 해소(batch 2) + 그로 인해 정적 전제가 깨진 `redact-stored-error.ts` 시그니처 정정 + 진행 기록 plan 문서 갱신이다. 모든 타입 확장을 DB 마이그레이션 실측(`VARCHAR`/`INTEGER`)과 `spec/1-data-model.md` 의 nullable 표기(`?` 접미사)에 line-level 로 대조했고, 전부 일치했다 — spec 을 어기는 곳이 없고 오히려 코드가 이미 nullable 이었던 spec 표기를 뒤늦게 따라잡는 정합 작업이다. `tsc --noEmit` 을 직접 실행해 비-spec 소스 에러 0건을 재확인했고, 이 클래스의 전용 회귀 가드(`nullable-type-lie-cast.spec.ts`, `findUntypedNullableColumns`)와 `redact-stored-error.spec.ts` 를 모두 실행해 통과를 확인했다. 배치 문서가 스스로 밝힌 "혼재 9파일 30필드(column 24·relation 6)" 수치도 diff 를 직접 세어 정확히 일치함을 검증했다. 유일하게 발견된 spec 불일치(`Schedule.next_run_at` non-null 표기 vs 실제 nullable)는 이번 diff 가 만든 것이 아닌 선재 오류이며, 리뷰 대상 plan 문서 자신이 이미 "developer 권한 밖 — planner 턴 후속" 으로 정확히 식별·이월해 둔 상태라 이 diff 범위에서 조치할 대상이 아니다. TODO/FIXME 류 미완성 표식은 없고, 모든 반환 경로·null 분기가 테스트로 커버된다.

## 위험도

NONE
