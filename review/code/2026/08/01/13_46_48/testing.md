STATUS=success testing review complete — 1 WARNING, 3 INFO, 0 CRITICAL
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사)

## 컨텍스트

이 변경은 6차 리뷰까지 거친 상태(commit log 기준 `test(backend): 6차 리뷰 W1 — 컨트롤러→서비스 행위자(userId) 배선 단언` 등)로, 이미 상당수의 뮤턴트-검출형 회귀 테스트(트랜잭션 커밋-후-기록 순서, 롤백 시 미기록, 삭제-전 필드 스냅샷, positional 인자 스왑 방지)가 4개 모듈(workflow/trigger/schedule/model_config) 전반에 체계적으로 심어져 있다. 아래는 그 바닥 위에서 남은 실제 갭만 추린 것이다.

## 발견사항

- **[WARNING]** `WorkflowsService.duplicate`/`importWorkflow` 감사 기록에 이 파일의 다른 진입점(create/update/setDefault 류)과 동일한 "커밋 후 순서" + "실패 시 미기록" 회귀 테스트가 없다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:408` (`describe('duplicate', ...)` — 순서 테스트는 있는데 실패 테스트가 없음), `codebase/backend/src/modules/workflows/workflows.service.spec.ts:1786` (`describe('importWorkflow', ...)` — 순서 테스트도 실패 테스트도 없음, 유일한 감사 단언은 `it('importWorkflow 도 workflow.created 를 남긴다 (details.imported)')`)
  - 상세: `WorkflowsService.duplicate`/`importWorkflow` 는 `const duplicated = await this.dataSource.transaction(...)` 다음 줄에서 `await this.recordAudit(...)` 를 호출하는, `create`(같은 파일 `감사 로깅` describe, 커밋 경계 `tx-start`/`tx-commit` 양쪽을 다 찍는 순서 테스트 + 트랜잭션 실패 시 `auditLogs.record` 미호출 테스트 존재)와 정확히 동일한 코드 형태다. 그런데 `duplicate` 는 순서 테스트(`it('duplicate 도 트랜잭션 **커밋 뒤**에 기록한다 (W5)')`, 744행)만 있고 트랜잭션 실패 시 미기록 테스트가 없으며, `importWorkflow` 는 둘 다 없다. 이 팀은 바로 이 파일의 커밋 메시지(`c3515fa7b`)에서 "뮤턴트 7종 전부 RED: setDefault/create 기록을 트랜잭션 안으로" 같은 실측을 근거로 순서 테스트를 심었고, `triggers.service.ts` 의 실제 회귀(4차 리뷰가 잡은 C1 — `syncScheduleActivation` 뒤로 감사가 밀려난 사고)가 이 정확한 버그 클래스가 실전에서 났음을 보여준다. `duplicate`/`importWorkflow` 는 같은 취약 패턴(비동기 트랜잭션 결과 → 그 뒤 `await recordAudit`)을 쓰면서 같은 종류의 가드가 없어, 향후 리팩터링이 `recordAudit` 을 트랜잭션 콜백 안으로 조용히 옮기거나(롤백 시에도 감사가 남는 버그) `await` 를 빠뜨려도(fire-and-forget) 어떤 테스트도 RED 가 되지 않는다.
  - 제안: `create`/`setDefault`(model-config) 패턴을 그대로 복제 — `order: string[]` 로 `tx-start`/`tx-commit`/`audit` 를 찍는 순서 테스트와, 트랜잭션 콜백 실행 후 reject 하는 실패 테스트를 `duplicate`(실패 케이스 추가)·`importWorkflow`(순서+실패 둘 다 추가)에 보충한다.

- **[INFO]** `SchedulesService.update` 의 `isActive=false` 분기(→ `removeJob`)에는 감사 기록 순서 회귀 테스트가 없다 — `registerJob` 분기(`isActive=true`)만 커버됨.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:246`(`recordAudit`) ~ `:254-258`(if/else `registerJob`/`removeJob`) — 테스트는 `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 의 `it('감사 로깅 — update 도 BullMQ 재등록 **전에** 기록한다 (W2)')`, 이 테스트는 `isActive: true` mock 만 사용해 `registerJob` 경로만 관측한다.
  - 상세: `recordAudit` 호출이 if/else 분기 이전에 단 한 줄로 존재하므로 코드 구조상 두 분기 모두 자동으로 같은 순서를 보장한다 — 즉시 위험한 갭은 아니다. 다만 이 프로젝트가 이미 "분기별 형태가 다르면 각 분기마다 다른 값을 넣어 관측해야 한다"는 원칙(트리거 서비스의 `chat_channel` 분기 중복 기록 회귀 테스트 등)을 실천 중이므로, `removeJob` 분기도 동일 순서로 커버해두면 향후 두 분기가 갈라지는 리팩터링(예: `removeJob` 실패 시에만 예외 처리 추가)에도 안전망이 유지된다.
  - 제안: `isActive: false` 스케줄을 mock 하고 `order` 배열로 `commit → audit → bullmq(removeJob)` 를 단언하는 테스트 1개 추가 (선택적, 낮은 우선순위).

- **[INFO]** `ModelConfigService` 의 비-트랜잭션 경로(`create` isDefault≠true, `update` isDefault≠true)에는 "저장 실패 시 감사 미기록" 테스트가 없다 — `setDefault`(트랜잭션 실패)만 커버됨. 반면 `TriggersService`(`it('저장이 실패하면 감사를 남기지 않는다 (create/update)')`)와 `SchedulesService`(`it('감사 로깅 — 생성이 실패하면 남기지 않는다')`), `WorkflowsService`(`it('트랜잭션이 실패하면 create 는 감사를 남기지 않는다')`)는 각 모듈에서 이 패턴을 최소 한 번씩 검증한다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:924`(`describe('감사 로깅 (model_config.*)', ...)`)
  - 상세: `service.create`/`service.update` 의 일반 경로는 `await this.repo.save(...)` 직후 `await this.recordAudit(...)` 를 호출하는 단순 순차 코드라 위험도는 낮다(제어 흐름상 자명). 그러나 4개 모듈 중 model-config 만 이 형태의 명시적 회귀 테스트가 전무해, 다른 3개 모듈과의 커버리지 대칭이 깨져 있다.
  - 제안: `mockRepo.save.mockRejectedValue(...)` 로 `create`/`update` 각각에 대해 `auditLogs.record` 미호출을 단언하는 테스트 1~2개 추가.

- **[INFO]** 신규 감사 액션 13개(workflow/trigger/schedule/model_config CRUD) 전부 unit test(jest, `AuditLogsService` mock)로만 검증되며 e2e/통합 테스트가 없다 — 실제 `audit_log` 테이블 write 나 각 모듈의 `AuditLogsModule` DI 배선(순환·export 누락 등)은 앱 부팅 레벨에서 검증되지 않는다.
  - 위치: `codebase/backend/test/` 하위에 이번 diff 로 추가된 e2e 스펙 없음 (`codebase/backend/test/audit-logs.e2e-spec.ts` 는 기존 파일로 무변경)
  - 상세: 다만 이는 신규 결함이 아니라 기존 프로젝트 관례(예: `auth-configs`/`integrations`/`workspace` 등 다른 감사 액션도 e2e 검증 없이 unit mock 만 사용, e2e 감사 검증은 `users-change-password`/`users-email-change` 등 소수 보안 민감 흐름에만 존재)와 일치한다. 각 모듈 `*.module.ts`(`model-config.module.ts:12`, `schedules.module.ts:24`, `triggers.module.ts:28`, `workflows.module.ts:24`)에 `AuditLogsModule` import 는 코드 리뷰로 확인했으며 정적으로는 문제없다.
  - 제안: 필수 조치는 아님. 다만 이후 순환 의존/모듈 배선 회귀가 걱정되면 기존 CRUD e2e 스펙(workflow/trigger/schedule/model-config 각각 존재할 것으로 추정) 중 하나에 `GET /api/audit-logs` 로 방금 생성한 리소스의 감사 행이 실제로 남는지 스팟체크 1건만 추가해도 DI 배선 회귀를 잡을 수 있다.

## 요약

전반적으로 이 PR 의 테스트 품질은 상당히 높다 — 트랜잭션 커밋-후-기록 순서, 롤백 시 미기록, 삭제 전 필드 스냅샷, 컨트롤러→서비스 positional 인자 스왑 방지(4개 컨트롤러 모두 "위치까지 고정" 방식) 등 실제로 리뷰 라운드에서 발견된 버그 클래스(C1 등)를 뮤턴트 관점에서 재발 방지하는 테스트가 체계적으로 심어져 있고, mock 은 `AuditLogsService` 를 부수효과로 격리하면서도 별도 describe 로 실제 기록 여부를 단언하는 방식이라 적절하다. 유일한 실질적 갭은 `WorkflowsService.duplicate`/`importWorkflow` 가 같은 파일의 다른 진입점과 동일한 취약 패턴(비동기 트랜잭션 → 그 뒤 감사 기록)을 쓰면서도 순서/실패 회귀 테스트가 빠져 있다는 점이며, 나머지는 낮은 우선순위의 대칭성 보완 사항이다.

## 위험도
LOW
