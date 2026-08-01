# 부작용(Side Effect) 리뷰

## 개요

이번 변경은 `model-config` / `schedules` / `triggers` / `workflows` 4개 모듈의 CRUD 경로에 감사 로깅(`AuditLogsService.record`)을 추가한 것이 핵심이다. 대상 파일 19개 diff 를 `git diff 7c10c9f0..HEAD` 로 직접 대조하고, 프롬프트에 내용이 실리지 않은 `triggers.service.ts` / `triggers.service.spec.ts` / `workflows.service.ts` / `workflows.service.spec.ts` 는 `Read` 로 전문을 확인했다. 콜러 그래프(`grep`)와 `tsc --noEmit` 로 시그니처 변경의 파급 범위도 직접 검증했다.

## 발견사항

- **[INFO]** 4개 서비스의 `create`/`update`/`remove`(+`setDefault`) 메서드에 필수(optional 아님) `userId` 파라미터가 추가되어 시그니처가 바뀜.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:256`(create), `:294`(update), `:366`(setDefault), `:394`(remove) / `codebase/backend/src/modules/schedules/schedules.service.ts` `create`/`update`/`remove` / `codebase/backend/src/modules/triggers/triggers.service.ts:226`(create), `:286`(update), `:849`(remove) / `codebase/backend/src/modules/workflows/workflows.service.ts:229`(update), `:254`(remove)
  - 상세: `grep -rn "modelConfigService\.\|schedulesService\.\|triggersService\.\|workflowsService\."` 로 프로덕션 코드 전체를 훑은 결과 이 메서드들의 호출자는 각 모듈의 controller 뿐이며, 4개 controller 모두 같은 diff 안에서 `@CurrentUser('sub') userId` 를 추가해 동기화됐다. `TriggersService`/`ModelConfigService`/`SchedulesService`/`WorkflowsService` 를 주입받는 다른 서비스(`workflow-channel-authorizer.ts`, `notification-secret-rotator.service.ts`, `chat-channel-token-rotator.service.ts`, `llm.service.ts`, `embedding.service.ts` 등)는 이 메서드들을 호출하지 않아 영향이 없다. `npx tsc --noEmit` 으로 재확인한 결과 `workflows.service.spec.ts` 에 남은 타입 에러(mock repo `insert`/`update` 부재, `SaveCanvasDto` 미해석)는 merge-base(`7c10c9f0`)에서도 동일하게 존재해 본 diff 와 무관한 기존 결함임을 확인했다(`git checkout 7c10c9f0 -- ...` 로 대조 후 원복). HTTP API 표면(요청/응답 바디)은 변경되지 않았다 — `userId` 는 `@CurrentUser('sub')` 로 JWT(`request.user.sub`)에서 서버 측에서 채워지며 클라이언트가 보내는 필드가 아니다(각 DTO 에 `userId` 필드 없음을 확인).
  - 제안: 없음 — 시그니처 변경의 파급을 확인했고 안전함.

- **[INFO]** CRUD 경로마다 `AuditLogsService.record()`(DB INSERT, await) 가 새로 추가되어 모든 create/update/remove/setDefault 요청에 지연·DB 쓰기 부작용이 하나씩 늘어남.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:239`(`recordAudit` 헬퍼), `:284`·`:337`·`:385`·`:402`(호출부) / `schedules.service.ts`·`triggers.service.ts`·`workflows.service.ts` 의 동일 패턴 `recordAudit` 호출
  - 상세: `AuditLogsService.record()`(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72`)는 내부 `try/catch` 로 실패를 삼키므로(“Failures are swallowed — audit logging must never break the primary action”) 신규 `recordAudit` 호출이 주 동작을 실패시키거나 unhandled rejection 을 만들 위험은 없다. 이 패턴은 `auth-configs`/`integrations`/`users`/`workspaces`/`executions`/`workspace-invitations` 에 이미 존재하는 기존 관례를 그대로 따른 것이며, 새 코드가 아니다. 각 서비스의 `recordAudit` 호출은 실제 DB 커밋(또는 삭제)이 성공한 **뒤**에만 실행되도록 배치되어 있고, 그 순서 자체를 `*.service.spec.ts` 의 신규 “감사 로깅” describe 블록이 명시적으로 회귀 테스트로 고정한다 — 예: “트랜잭션이 실패하면 create/setDefault 는 감사를 남기지 않는다”, “chatChannel 분기가 있어도 기록은 한 번이다(W5)”, “remove 는 삭제 전에 읽은 type/kind 를 남긴다”, “create 는 secret 마이그레이션 전에 기록한다(W6)”. 부작용 관점에서 우려되는 항목(이중 기록, 실패 시 유령 감사row, 삭제 후 필드 유실)이 이미 테스트로 커버되어 있음을 직접 코드로 확인했다(`triggers.service.spec.ts:2245-2395`, `model-config.service.spec.ts` 322행대 `감사 로깅` describe, `workflows.service.spec.ts` 108행대 `감사 로깅` describe).
  - 제안: 없음 — 의도된 기능이며 실패 격리·순서 보장이 코드와 테스트 양쪽에서 확인됨.

- **[INFO]** `ModelConfigService.update()`/`remove()` 에서 기존 옵저버 콜백 `notifyInvalidated()`(LLM 클라이언트 캐시 무효화, `LlmService.onModuleInit` 이 구독) 호출과 신규 `recordAudit()` 호출의 순서 관계.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:336`(notifyInvalidated) → `:337-343`(recordAudit) / `:401`(notifyInvalidated) → `:402-408`(recordAudit)
  - 상세: diff 를 좁혀 확인한 결과 `notifyInvalidated(id)` 호출 자체는 이 PR 이전부터 있던 코드이고, 이번 변경은 그 뒤에 `recordAudit` 호출을 추가만 했다(순서를 뒤집거나 옮기지 않음). `notifyInvalidated`(`:76-88`)는 각 리스너 호출을 `try/catch` 로 격리해 리스너 예외가 전파되지 않고, `recordAudit`(→`AuditLogsService.record`)도 내부에서 실패를 삼키므로, 두 호출의 상대 순서가 바뀌어도 관측 가능한 부작용 차이는 없다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `AuditLogsModule` 이 `ModelConfigModule`/`SchedulesModule`/`TriggersModule`/`WorkflowsModule` 4곳에 신규 import 됨.
  - 위치: `codebase/backend/src/modules/model-config/model-config.module.ts:8` / `schedules.module.ts:23` / `triggers.module.ts:27` / `workflows.module.ts:23`
  - 상세: `AuditLogsModule`(`codebase/backend/src/modules/audit-logs/audit-logs.module.ts`)은 `TypeOrmModule.forFeature([AuditLog])` 만 import 하는 leaf 모듈이라, 4개 모듈에 추가돼도 새로운 순환 의존을 만들지 않는다(`triggers`↔`schedules`, `workflows`↔`execution-engine` 등 기존 forwardRef 순환과 무관). `AUDIT_ACTIONS` 상수 추가(`audit-action.const.ts`)도 새 값만 추가하는 순수 확장이라 기존 액션 문자열에 영향이 없다.
  - 제안: 없음.

## 요약

핵심 변경은 4개 서비스에 감사 로깅 호출(신규 DB INSERT 부작용)과 그에 필요한 필수 `userId` 파라미터를 추가한 것으로, 둘 다 의도된 기능 변경이다. 시그니처 변경은 콜러 그래프 전수 조사와 `tsc --noEmit` 대조(merge-base 대비 신규 에러 없음 확인)로 안전함을 검증했고, HTTP 요청/응답 계약은 그대로다(`userId` 는 JWT 유래, 클라이언트 입력 아님). 새로 추가된 `recordAudit` 호출은 기존 6개 모듈에서 이미 쓰이던 "실패를 삼키는" `AuditLogsService.record` 패턴을 그대로 따르고, 실제 자원 변경(커밋/삭제) 이후에만 실행되도록 배치돼 있으며, 이중 기록·유령 감사row·삭제 후 필드 유실 같은 전형적 부작용 위험은 신규 회귀 테스트(W5/W6 순서 고정, 트랜잭션 실패 시 미기록 등)로 명시적으로 방어되어 있다. `notifyInvalidated` 콜백과의 순서 관계, `AuditLogsModule` 신규 import 도 확인했으나 실질적 위험은 없다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
