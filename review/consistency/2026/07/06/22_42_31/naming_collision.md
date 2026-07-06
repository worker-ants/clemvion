### 발견사항

- **[CRITICAL]** `NotificationsService.findByResource` → `findByBackgroundRun` 리네임이 spec 본문(§2.1)과 코드 사이에서 식별자 불일치를 만듦
  - target 신규 식별자: `NotificationsService.findByBackgroundRun(backgroundRunId)` (코드, `notifications.service.ts`), 컬럼 `notification.background_run_id`(migration V107)
  - 기존 사용처: `spec/data-flow/8-notifications.md:22`(개요 코드 진입점 나열), `:89`(§2.1 "리소스 attribution 조회" 행) — 둘 다 여전히 옛 메서드명 `findByResource` 와 `SELECT WHERE resource_type=? AND resource_id=?` 를 "현재 구현" 으로 서술
  - 상세: `git -C <worktree> diff origin/main...HEAD -- spec/data-flow/8-notifications.md` 결과가 빈 diff — 즉 이 spec 파일은 본 PR 에서 전혀 갱신되지 않았다. 반면 코드는 `findByResource` 를 완전히 삭제하고 `findByBackgroundRun` 으로 대체했으며(`notifications.service.ts` 507-537행 diff), 호출부(`background-runs.service.ts`, `executions.module.ts` 주석)도 전부 갱신됐다. 결과적으로 spec 이 가리키는 메서드(`findByResource`)는 코드에 더 이상 존재하지 않아, spec 을 읽는 사람이 존재하지 않는 API 를 참조하게 된다 — "코드에 없는 식별자가 spec 의 유일한 진실처럼 남아있는" 역방향 충돌.
  - 제안: `plan/in-progress/spec-update-notifications-background-run-id.md` 가 이미 이 정확한 gap 을 "flip 대상"으로 추적 중이다(§2.1 컬럼 목록에 `background_run_id?` 추가, attribution 조회 행을 `findByBackgroundRun` 기준으로 갱신). 코드 PR 이 머지되기 전 이 spec-update 를 같은 슬라이스로 반영하거나, 최소한 별도 후속 PR 로 즉시 처리해 drift 창을 닫을 것.

- **[CRITICAL]** `notification.resource_type='background_run'` 값이 코드에서 폐기됐으나 spec §1.1 의 `background_failed` 행이 갱신되지 않음
  - target 신규 식별자: `resourceType: 'workflow'` (background_failed 알림, `background-execution.processor.ts` 258-272행 diff)
  - 기존 사용처: `spec/data-flow/8-notifications.md:67` (§1.1 `background_failed` 행) — 코드 변경 후에도 여전히 `resource_type='background_run'`/`resourceId=backgroundRunId` 계약을 명시하지 않고(구버전 서술이 남아있어), execution_failed/schedule_failed 행(71-72행)과 달리 딥링크 계약(`resource_type='workflow'`)이 대칭적으로 기술되지 않음
  - 상세: 코드는 이미 `background_failed` 를 `execution_failed`/`schedule_failed` 와 동일하게 `resource_type='workflow'` 로 통일했고(딥링크 정합), attribution 은 별도 컬럼 `background_run_id` 로 분리했다. 그러나 spec 본문은 이 변경 사실을 반영하지 않아, spec 만 읽는 독자는 여전히 `background_run`/`execution` fallback 값이 유효하다고 오인할 수 있다. 이는 §1.1 표 자체의 내부 일관성 문제(다른 두 행과 비대칭)이자, 코드-spec 간 식별자 값 충돌이다.
  - 제안: 위와 동일한 `spec-update-notifications-background-run-id.md` 플랜의 "§1.1 갱신" 항목을 조속히 반영. `execution_failed`/`schedule_failed` 행과 동일한 문구 패턴("resource_type='workflow' / resource_id=workflow.id — 팝오버 딥링크...")을 `background_failed` 행에도 적용해 3개 실패 type 표기를 대칭화.

- **[WARNING]** `background_run_id` 식별자가 기존 `V047` 인덱스 대상(JSONB path `meta.backgroundRunId`)과 표기가 유사해 혼동 소지
  - target 신규 식별자: `notification.background_run_id` (신규 물리 컬럼, UUID, migration V107)
  - 기존 사용처: `codebase/backend/migrations/V047__node_execution_background_run_id_index.sql` — `node_execution` 테이블의 `output_data #>> '{meta,backgroundRunId}'` JSONB 경로에 대한 부분 expression 인덱스 `idx_node_execution_background_run_id`. `spec/4-nodes/1-logic/12-background.md:320` 도 이 인덱스를 서술.
  - 상세: 두 식별자 모두 "backgroundRunId 관련 인덱스/컬럼"이라는 점에서 이름이 유사하지만 (1) 테이블이 다르고(`node_execution` vs `notification`), (2) 저장 형태가 다르며(JSONB path expression vs 실제 컬럼), (3) 목적이 다르다(모니터링 API의 backgroundRunId 단일 조회 vs 알림의 per-run attribution). migration V107 파일 자체에 "컬럼명이 V047 인덱스명과 표기가 유사하나 무관" 이라는 방어적 주석이 이미 있어 개발자가 인지하고 있었음 — 등급을 CRITICAL 이 아닌 WARNING 으로 판단(실질 충돌 없음, 문서화 필요성만 존재).
  - 제안: `spec-update-notifications-background-run-id.md` 의 Rationale 섹션 추가 시("딥링크와 attribution 을 별도 컬럼으로 분리한 이유"), V047 인덱스와의 명칭 유사성·무관계를 explicit 하게 1문장 언급해 spec 독자의 혼동도 예방할 것(코드 주석 수준의 설명이 spec 에는 아직 없음).

- **[WARNING]** `spec/1-data-model.md §2.19` Notification 필드 표에 신규 컬럼 `background_run_id` 미기재
  - target 신규 식별자: `notification.background_run_id UUID NULL` (migration V107, `notification.entity.ts` 신규 `@Column`)
  - 기존 사용처: `spec/1-data-model.md:712-728` (§2.19 Notification 필드 표) — 현재 9개 필드만 나열, `background_run_id` 없음
  - 상세: 데이터 모델 spec 이 엔티티의 단일 진실이어야 하는데 실제 스키마(코드+마이그레이션)에 존재하는 컬럼이 목록에서 완전히 누락됐다. 이는 엄밀히는 "명명 충돌"이라기보다 "누락"에 가깝지만, 신규 식별자가 아직 spec 에 "도입"되지 않은 상태이므로 향후 다른 작업자가 우연히 같은 이름을 다른 의미로 재사용할 위험(진짜 충돌)을 방지하려면 조속한 등재가 필요하다.
  - 제안: `spec-update-notifications-background-run-id.md` 플랜의 §2.19 flip 항목을 조속히 실행. `select: false`(REST 미노출) 특성도 함께 명시해 이후 다른 API 가 이 필드를 실수로 노출시키는 회귀를 예방.

- **[INFO]** `spec/4-nodes/1-logic/12-background.md §8.2` 의 `notifications` 필드 설명이 attribution 메커니즘 변경(옛 `resource_type='background_run'` → 신규 `background_run_id` 컬럼)을 반영하지 않음
  - target 신규 식별자: `background_run_id` 컬럼 기반 attribution
  - 기존 사용처: `spec/4-nodes/1-logic/12-background.md:248` — "notifications | Notification[] | 본 backgroundRun 와 연관된 알림. type: background_failed..." 로만 서술, attribution 메커니즘 언급 없음(직접적 충돌은 아니나 §8.2 응답 스키마 문서가 최신 조회 방식을 설명하지 않아 향후 독자가 옛 `resource_type='background_run'` 가정으로 오독할 여지)
  - 상세: 이미 `spec-update-notifications-background-run-id.md` 플랜에 5번째 flip 항목으로 포함되어 있음. 급박한 충돌은 아니고 위 CRITICAL 항목들과 함께 일괄 처리하면 되는 낮은 우선순위 보완.
  - 제안: 위 플랜 실행 시 함께 반영.

### 요약

본 PR(코드 diff)이 도입하는 신규 식별자 자체(`background_run_id` 컬럼, `findByBackgroundRun` 메서드, `resourceType='workflow'` 통일)는 기존 spec 코퍼스 전체(§0-overview, §1-data-model, §2-navigation/_layout §3.1, 다른 notification type 행)와 의미상 충돌하지 않는다 — 오히려 기존 `execution_failed`/`schedule_failed` 의 딥링크 계약과 정합을 맞추는 방향의 변경이며, V047 의 유사 명칭과도 실질적 충돌이 없다(코드 주석으로 이미 명확히 구분됨). 다만 핵심 문제는 "충돌"이 아니라 **spec 미동기화** — `git diff origin/main...HEAD -- spec/data-flow/8-notifications.md` 가 완전히 빈 상태로, 코드가 폐기한 옛 식별자(`findByResource`, `resource_type='background_run'`)가 spec 본문에는 여전히 "현재 구현"으로 박제되어 있다. 이는 이미 `plan/in-progress/spec-update-notifications-background-run-id.md` 로 추적되고 있는 기지(既知) gap 이며, planner 위임이 아직 미완료(`[ ]` 5건) 상태다. 신규 식별자 충돌 관점에서는 코드-스펙 간 이 drift 창이 닫히기 전까지 "spec 이 가리키는 이름 ≠ 실제 코드의 이름"이라는 실효적 충돌이 존재한다고 평가한다.

### 위험도
MEDIUM
