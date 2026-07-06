# 정식 규약 준수 검토 — spec/data-flow/8-notifications.md (알림 파이프라인 후속 하드닝 3건, --impl-prep)

검토 대상: `spec/data-flow/8-notifications.md` + 연관 `spec/1-data-model.md §2.19`,
`spec/2-navigation/_layout.md §3.1`. 계획 3항목(항목1: background_failed resource_id 분리,
항목2: execution_failed e2e, 항목3: dispatchEmails decouple 보류).

대조한 정식 규약: `spec/conventions/migrations.md`, `spec/conventions/swagger.md`,
`spec/conventions/spec-impl-evidence.md`, `spec/conventions/error-codes.md`(관련성 낮아 배제).
실제 코드(`codebase/backend/src/modules/notifications/**`,
`codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts`,
`codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`,
`codebase/backend/migrations/V107__notification_background_run_id.sql`)를 함께 대조했다.

---

### 발견사항

- **[CRITICAL] --impl-prep 검토 시점인데 항목 1 구현이 이미 완료돼 있음 (게이트 우회)**
  - target 위치: target 문서 "계획된 구현 (개발자 착수 직전 검토 대상)" 서두 + 항목 1 전체
  - 위반 규약: 직접적으로는 `spec/conventions/*` 항목이 아니라 `CLAUDE.md` "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무. Critical 발견 시 차단" 및 `plan/in-progress/notif-hardening-followups.md` 자체 체크리스트("impl-prep consistency-check" 가 항목 1의 **첫** 미체크 항목으로 되어 있음)
  - 상세: 실측 결과 다음이 **이미 작업트리에 존재**한다 — `codebase/backend/migrations/V107__notification_background_run_id.sql` (untracked), `notification.entity.ts`(`backgroundRunId` 컬럼, modified), `notifications.service.ts`(`findByBackgroundRun`, `createMany`/`notify` 의 `backgroundRunId` 처리, modified), `background-execution.processor.ts`(`resourceType:'workflow'`/`resourceId:workflowId`/`backgroundRunId` 세팅으로 이미 전환 완료), `background-runs.service.ts`(`findByBackgroundRun` 소비로 전환 완료). 즉 "착수 직전 검토" 라는 이 문서의 전제와 달리 코드 구현은 이미 실질적으로 끝난 상태다. 이 상태에서 --impl-prep 이 지금 실행되는 것은 게이트가 사후적으로(post-hoc) 수행됨을 뜻하며, 검토에서 Critical 이 나와도 "구현 착수를 막는" 본래 기능을 하지 못한다.
  - 제안: (a) 이번 turn 은 예외적으로 이미 작성된 코드를 대상으로 한 사후 정합성 확인으로 처리하되, (b) 향후 동일 plan 에서는 체크리스트의 "impl-prep consistency-check" 를 실제 코드 작성 **이전** 시점에 완료해야 게이트 취지가 보존된다는 점을 developer 워크플로에 환기. plan 파일의 체크리스트 순서(§impl-prep 이 최상단)는 이미 올바르므로, 프로세스 준수 자체를 교정 대상으로 플래그.

- **[WARNING] `NotificationDto.resourceType` Swagger 문서가 이미 전환된 실제 값과 불일치**
  - target 위치: target 문서 항목 1 "`notification.entity.ts` / `notification-response.dto.ts` 갱신" 부분
  - 위반 규약: `spec/conventions/swagger.md` §1-1 (JSDoc·`@ApiProperty` 는 실제 필드 의미를 정확히 설명해야 함) 및 §3 (description 톤·정확성)
  - 상세: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts` 의 `resourceType` 필드는 `@ApiPropertyOptional({ example: 'execution', description: '연관 리소스 종류 — 현재 발행되는 값: `execution`, `background_run`' })` 로 문서화돼 있다. 그러나 `background-execution.processor.ts` 는 이미 `resourceType: 'workflow'` 로 전환됐고 (`execution_failed`/`schedule_failed` 도 원래 `workflow`), target 문서 자체도 "legacy `execution` fallback 제거" 를 항목 1의 계획으로 서술한다. 즉 **코드는 이미 `workflow` 로 통일됐는데 Swagger 문서 description 은 옛 `execution`/`background_run` 값을 여전히 광고**하고 있어 API 소비자에게 오도된 계약을 노출한다. `type` 필드의 `@ApiProperty({ example: 'workflow.failed' })` 도 실제 enum 표기(`execution_failed` 등 snake_case, dot 아님 — `1-data-model.md §2.19`)와 다른 예시를 든다.
  - 제안: 항목 1 완료 커밋에 `notification-response.dto.ts` 의 `resourceType`/`type` JSDoc·example 을 실제 발행 값(`workflow`, `execution_failed` 등)으로 갱신하는 작업을 명시적으로 포함시킬 것. target 문서가 "`notification-response.dto.ts` 갱신" 을 계획에 넣은 것은 맞으나, 실제로는 컬럼 추가(`backgroundRunId` 비노출)만 반영되고 기존 `resourceType`/`type` 문서 정확성 갱신은 누락됐다.

- **[WARNING] `spec/1-data-model.md §2.19` 가 `status: implemented` 이면서 이미 구현된 `background_run_id` 컬럼 미기재**
  - target 위치: target 문서 항목 1 "이는 spec §2.1(Schema 매핑) 과 §2.19(데이터 모델) 에 신규 컬럼 문서화를 요구 → 별도 spec-update 로 planner 위임 예정" 부분
  - 위반 규약: 직접적인 `spec/conventions/*` 항목은 아니지만, `spec-impl-evidence.md` 의 근본 취지("spec 가 약속한 surface 와 실제 구현 코드 사이의 정적 증거") 및 SDD 원칙(CLAUDE.md "개발 방법론")과 배치. `1-data-model.md` 자체는 `EXCLUDE_BASENAMES` 로 frontmatter 가드 대상에서 빠져 있어 build 는 이 drift 를 잡아내지 못한다.
  - 상세: `spec/1-data-model.md §2.19` 의 Notification 필드 표에는 `resource_id UUID?` 단일 컬럼만 있고 `background_run_id` 컬럼은 없다. 그러나 코드에는 이미 이 컬럼이 마이그레이션 V107 로 추가되고 entity/service 에서 사용 중이다. `status: implemented` 문서에 실제 구현된 컬럼이 누락된 상태로 남아있는 기간이 길어지면(§2.1 Schema 매핑도 동일), "spec 이 코드를 선도한다"는 SDD 원칙과 반대로 코드가 spec 보다 앞서가는 역전이 발생한다.
  - 제안: 항목 1 구현 커밋과 **같은 PR** 안에서 `1-data-model.md §2.19`·`8-notifications.md §2.1` 의 컬럼 표를 갱신할 것(target 문서가 "별도 spec-update 로 planner 위임" 이라 적었으나, 코드가 이미 merge 대기 상태라면 지연 리스크가 실현된 상태 — CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙에 따라 이 위임을 **즉시** 처리해야 하며 후속 사이클로 미루면 drift 창이 계속 열려 있게 된다).

- **[INFO] 마이그레이션 V107 명명·구조는 규약 완전 준수**
  - target 위치: target 문서 항목 1 "마이그레이션 V0xx 신설"
  - 위반 규약: 없음 (positive finding) — `spec/conventions/migrations.md` 대조
  - 상세: `V107__notification_background_run_id.sql` 은 (a) 직전 `V106` 다음 단조 증가, (b) `snake_case` 설명자, (c) nullable 컬럼 + partial index 조합으로 `CONCURRENTLY` 불요를 정확히 판단(§3 append-only 원칙과 상충 없음), (d) 파일 헤더 주석에 관련 spec 경로 3개를 모두 명시, (e) DOWN 마이그레이션 주석 포함. `V047` 과의 인덱스명 유사성에 대한 명시적 비주의 사항 코멘트도 남겨 향후 혼동을 예방했다.
  - 제안: 없음 — 그대로 유지.

- **[INFO] DTO 파일 위치·명명은 swagger.md §5-1 규약 준수**
  - target 위치: target 문서 항목 1 "`notification-response.dto.ts` 갱신"
  - 위반 규약: 없음 (positive finding)
  - 상세: `codebase/backend/src/modules/notifications/dto/responses/{notification-response,dismiss-notification-response,dismiss-all-notifications-response}.dto.ts` 경로·명명이 `swagger.md §5-1` (`dto/responses/*-response.dto.ts`) 을 정확히 따른다.
  - 제안: 없음.

---

### 요약

target 문서(항목 1~3)가 서술하는 **설계 방향 자체**(딥링크/attribution 컬럼 분리, `workflow` resource_type 통일, 별도 nullable 컬럼 + partial index)는 `migrations.md`·`swagger.md`·`_layout.md §3.1` 딥링크 계약과 완전히 정합하며 규약 위반이 없다. 그러나 실측 결과 이 "계획된 구현" 이 이미 워크트리에 코드로 존재하는 상태(마이그레이션 V107, entity/service/processor 전부 반영)이며, 이는 --impl-prep 게이트가 코드 작성 이전이 아니라 사후에 수행되고 있음을 뜻한다(CRITICAL). 그 결과로 두 가지 실제 drift 가 이미 발생했다 — Swagger DTO 문서(`resourceType`/`type` 의 example·description)가 옛 값을 그대로 광고하는 점(WARNING), 그리고 `1-data-model.md §2.19`(status: implemented)에 이미 구현된 `background_run_id` 컬럼이 반영되지 않은 점(WARNING). 둘 다 target 문서가 "별도 spec-update 로 planner 위임 예정" 이라 적었으나, 코드가 이미 존재하는 이상 이 위임은 지연이 아니라 즉시 처리가 필요하다.

### 위험도

MEDIUM
