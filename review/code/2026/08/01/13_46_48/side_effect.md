# 부작용(Side Effect) Review

## 검토 범위 요약

이번 변경은 `workflow.*` / `trigger.*` / `schedule.*` / `model_config.*` 4개 리소스의 CRUD 경로에
감사 로깅(`AuditLogsService.record`)을 추가하는 작업이다. 프롬프트에 실리지 않은 대용량 파일
(`model-config.service.spec.ts`, `triggers.service.spec.ts`, `triggers.service.ts`,
`workflows.service.spec.ts`, `workflows.service.ts`)은 `Read`로 직접 열람했고, 실제 diff는
`git diff origin/main...HEAD`로 정밀 확인했다(라인 인용은 실제 소스 파일 줄 번호 기준).

## 발견사항

- **[INFO]** 4개 서비스에 `AuditLogsService` 신규 필수 생성자 의존성 추가 — 리포지토리 전체 대조로 DI 파손 없음 확인
  - 위치: `codebase/backend/src/modules/model-config/model-config.module.ts:12` (`AuditLogsModule` import 추가), `codebase/backend/src/modules/schedules/schedules.module.ts:24`, `codebase/backend/src/modules/triggers/triggers.module.ts:27`, `codebase/backend/src/modules/workflows/workflows.module.ts:23`
  - 상세: `WorkflowsService`/`TriggersService`/`SchedulesService`/`ModelConfigService` 생성자에 `AuditLogsService`가 새 필수 인자로 추가됐다. `AuditLogsModule`(`codebase/backend/src/modules/audit-logs/audit-logs.module.ts`)은 `TypeOrmModule`만 의존해 순환 참조 위험이 없음을 확인했다. 또한 백엔드 전역에서 이 4개 서비스를 **실제 클래스로**(mock 아님) `Test.createTestingModule`에 등록하는 spec 파일을 전수 grep 했고(`websocket.gateway.spec.ts`, `workflows.controller.spec.ts` 등 포함), 전부 `useValue` mock으로만 참조해 신규 필수 의존성으로 인한 DI 해석 실패(runtime `Nest can't resolve dependencies...`)가 발생할 곳이 없음을 확인했다.
  - 제안: 조치 불필요(확인 완료). 향후 이 4개 서비스를 real class로 구성하는 신규 spec을 추가할 때는 `AuditLogsService` mock 누락에 주의.

- **[INFO]** 컨트롤러 메서드 시그니처에 `userId` 파라미터 추가 — 호출자 영향 없음을 확인
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts:115-121, 130-138, 150-157, 163-171`, `codebase/backend/src/modules/schedules/schedules.controller.ts:150-157, 199-207, 219-227`, `codebase/backend/src/modules/triggers/triggers.controller.ts:95-101, 120-127, 158-166`, `codebase/backend/src/modules/workflows/workflows.controller.ts:181-188, 202-209`
  - 상세: `ModelConfigService.create/update/setDefault/remove`, `SchedulesService.create/update/remove`, `TriggersService.create/update/remove`, `WorkflowsService.update/remove`에 `userId: string` 필수 인자가 추가됐다. `userId`는 `@CurrentUser('sub')` 데코레이터(JWT)에서 온 값이라 REST 요청/응답 바디 계약(외부 API 인터페이스)에는 영향이 없다. 서비스 메서드의 내부 호출자를 리포지토리 전체 grep으로 확인한 결과, 각 서비스의 컨트롤러 외에 직접 호출하는 곳이 없어(예: `ModelConfigService.create/update/setDefault/remove`는 `model-config.controller.ts`에서만 호출) 시그니처 변경으로 인한 컴파일 브레이크나 런타임 인자 밀림(shift) 위험이 없다.
  - 제안: 조치 불필요(확인 완료).

- **[INFO]** 감사 기록은 개별 서비스 트랜잭션과 분리된 best-effort 부가 쓰기이며, 실패는 항상 삼켜진다(기존 설계 재사용)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:68-97` (`record()`, 이번 diff에서 변경되지 않은 기존 코드)
  - 상세: `record()`는 `try/catch`로 감싸져 있어 `audit_log` INSERT가 실패해도 `logger.warn`만 남기고 예외를 전파하지 않는다. 4개 서비스의 모든 신규 `recordAudit()` 호출은 이 안전판 덕분에 "감사 기록 실패로 정상 CRUD 응답이 500이 되는" 부작용을 일으키지 않는다(검증 완료 — 원치 않는 요청 실패라는 심각한 부작용이 될 뻔했으나 기존 설계로 이미 방지됨). 다만 이 설계의 이면은, 커밋된 리소스 변경과 감사 기록이 원자적이지 않다는 것이다 — 커밋 직후 프로세스가 죽거나(OOM kill 등) DB 쓰기가 실패하면 감사 항목이 조용히 누락된다. 이는 이번 diff가 새로 만든 문제가 아니라 재사용된 기존 설계의 트레이드오프이며, `audit-action.const.ts` 상단 주석에서 보존 정책 미정 등과 함께 이미 알려진 한계로 다뤄지고 있다.
  - 제안: 조치 불필요. 컴플라이언스 요구가 강화되면(무결성 보장 필요) 별도 후속 작업으로 outbox 패턴 등을 검토.

- **[INFO]** `ModelConfigService.update()`에서 캐시 무효화 콜백(`notifyInvalidated`)이 감사 기록보다 먼저 실행 — 같은 PR의 다른 3개 서비스와 순서 원칙이 다름
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:336-343` (`this.notifyInvalidated(id);` 다음에 `await this.recordAudit({...})`)
  - 상세: `workflows.service.ts`(`create/duplicate/importWorkflow`), `triggers.service.ts`(`create/update`), `schedules.service.ts`(`create/update`)는 모두 "커밋 직후, **실패할 수 있는 외부 호출(BullMQ 등록·secret store 마이그레이션·chat-channel setup) 이전에** 감사를 남긴다"는 원칙을 코드 주석(예: `triggers.service.ts:334-341`의 "리뷰 W6" 주석)으로 명시하고 지킨다. 반면 `model-config.service.ts:update()`는 `notifyInvalidated(id)`(`LlmService` 등 in-process 리스너에 대한 캐시 무효화 콜백 팬아웃)를 `recordAudit()`보다 먼저 호출한다. `notifyInvalidated`는 리스너별로 `try/catch`(`model-config.service.ts:76-88`)로 감싸여 있어 그 자체로 throw 하지 않으므로 실질적인 데이터 유실 위험은 없지만, 이 PR이 다른 3곳에서 명문화한 "감사 → 실패 가능한 부작용" 순서 불변식과 형식적으로 어긋난다. `remove()`는 반대로 `notifyInvalidated(id)`가 `recordAudit()`보다 **먼저** 오는 동일 패턴을 재현한다(`model-config.service.ts:401-408`).
  - 제안: 기능상 버그는 아니므로 필수 조치는 아니지만, 일관성을 위해 `notifyInvalidated()` 호출을 `recordAudit()` 뒤로 옮기거나, 이 서비스만 순서가 다른 이유(콜백이 throw 하지 않음을 이미 보장)를 한 줄 주석으로 남기면 향후 리뷰어의 혼선을 줄일 수 있다.

- **[INFO]** `AUDIT_ACTIONS` 상수·감사 응답 DTO 설명 문구 변경은 순수 추가/문서 갱신 — 기존 값 rename·삭제 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:53-89`, `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:28-40`
  - 상세: `git diff`로 대조한 결과 기존 액션 키/값(`INTEGRATION_*`, `AUTH_CONFIG_*`, `USER_*` 등)은 그대로이고 `WORKFLOW_*`/`TRIGGER_*`/`SCHEDULE_*`/`MODEL_CONFIG_*` 13개가 추가만 됐다. Swagger `description` 텍스트 변경은 런타임 동작에 영향 없는 메타데이터다.
  - 제안: 조치 불필요.

## 요약

이번 diff는 4개 도메인 서비스에 감사 로그 쓰기라는 새로운(그러나 명확히 의도된) 부작용을 일관되게 추가한다. 신규 필수 생성자 의존성·컨트롤러 시그니처 변경은 리포지토리 전체 대조로 호출자 파손이 없음을 확인했고, 감사 쓰기 자체는 기존에 검증된 삼킴(swallow) 설계를 재사용해 주 작업의 성공/실패에 영향을 주지 않는다. "커밋 후, 실패 가능한 외부 호출 전에 감사를 남긴다"는 원칙이 workflow/trigger/schedule 3곳에서는 일관되게 지켜지는 반면 `ModelConfigService.update/remove`에서는 (해가 없는) 캐시 무효화 콜백이 감사보다 먼저 실행돼 형식적 일관성만 어긋난다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
