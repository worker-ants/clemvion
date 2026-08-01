# 부작용(Side Effect) Review

## 검토 범위

`main...HEAD` 기준 diff(6개 파일: `audit-action.const.ts`, `model-config.service.ts`,
`schedules.service.ts`, `triggers.service.ts`, `workflows.service.ts`,
`workflows.service.spec.ts`)를 실제 `git diff`로 재확인하고, 프롬프트가 제공한
"전체 파일 컨텍스트"와 대조해 분석했다. 추가로 `AuditLogsService.record()` 구현체,
4개 모듈의 `*.module.ts` DI 배선, 컨트롤러 호출부(4개)를 직접 열어 교차검증했다.

## 발견사항

- **[INFO]** `AuditLogsService` 주입 및 CRUD 경로에 `recordAudit()` 호출 추가로 워크플로/트리거/스케줄/모델설정의 모든 create·update·remove(·setDefault) 요청마다 `audit_log` 테이블에 새 INSERT 부작용이 생긴다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72` (`record()`), 호출부는 `model-config.service.ts:259,297,369,397` / `schedules.service.ts:159,207,267` / `triggers.service.ts:229,289,857` / `workflows.service.ts:194,232,257,280,454`
  - 상세: 새 부작용이지만 `record()`가 전체를 `try/catch`로 감싸 실패를 삼키고 `logger.warn`만 남긴다(69-71행 주석에 "Failures are swallowed — audit logging must never break the primary action" 명시). 따라서 감사 기록 실패가 원본 mutation(생성/수정/삭제) 응답을 깨뜨리지 않는 것을 코드로 확인했다. 커밋 후 기록(각 서비스의 "커밋 직후/뒤" 주석) 순서도 트랜잭션 롤백 시 감사가 남지 않도록, 그리고 이후 실패 가능한 외부 호출(BullMQ 등록, secret store, chatChannel setup)에 감사가 gated 되지 않도록 의도적으로 배치되어 있다. 실질적 위험 없음 — 설계 의도대로 격리됨.
  - 제안: 없음(현행 유지 권장). 다만 `audit_log`에 보존 정책/pruner가 없다는 점(파일 자체 주석에 이미 명시)은 이번 diff로 그 테이블에 쓰기 경로가 4곳 늘었다는 뜻이라, 향후 보존 정책 결정 시 본 4개 리소스도 포함 대상임을 참고.

- **[INFO]** 4개 서비스의 공개 메서드 시그니처가 변경됐다(`userId` 파라미터 신규 추가): `ModelConfigService.{create,update,setDefault,remove}`, `SchedulesService.{create,update,remove}`, `TriggersService.{create,update,remove}`, `WorkflowsService.{update,remove}`.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:259,297,369,397` / `codebase/backend/src/modules/schedules/schedules.service.ts:159,207,267` / `codebase/backend/src/modules/triggers/triggers.service.ts:229,289,857` / `codebase/backend/src/modules/workflows/workflows.service.ts:232,257`
  - 상세: 이 서비스들을 호출하는 모든 지점을 grep으로 전수 조사한 결과 각 컨트롤러(`model-config.controller.ts:120,137,157,173`, `schedules.controller.ts:155,205,226`, `triggers.controller.ts:100,126,165`, `workflows.controller.ts:163,187,208`)만 호출하고 있고, 전부 새 시그니처에 맞춰 `userId`(`@CurrentUser('sub')`)를 넘기도록 이미 갱신돼 있다. 컨트롤러 외 내부 호출자(스케줄러/cron/다른 서비스)는 없었다. 즉 breaking change이지만 현재 코드베이스 안에서 orphaned caller는 없음.
  - 제안: 없음(검증 완료). 신규 서비스/모듈 추가 시 이 4개 서비스의 write 메서드를 다시 호출하는 코드가 생기면 컴파일 타임에 자연히 걸러진다(필수 인자 누락).

- **[INFO]** `userId` 파라미터의 위치가 형제 메서드 간, 그리고 서비스 간 일관되지 않는다 — 예: `WorkflowsService.create(workspaceId, userId, dto)`(2번째) vs `WorkflowsService.update(id, workspaceId, dto, userId)`(마지막) vs `WorkflowsService.remove(id, workspaceId, userId)`(마지막, 3번째). `id`/`workspaceId`/`userId`는 전부 `string`이라 인접한 두 인자가 뒤바뀌어도 컴파일러가 잡지 못한다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:194`(create), `:232`(update), `:257`(remove) — 다른 3개 서비스도 동일 패턴(`triggers.service.ts:229,289,857`, `schedules.service.ts:159,207,267`, `model-config.service.ts:259,297,369,397`)
  - 상세: 각 서비스 내부의 `recordAudit(params: {...})` 헬퍼는 named 필드로 이 정확한 리스크를 스스로 문서화하며 회피했다("positional 이면 동일 타입(string) 인자 순서 스왑을 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다" — 4개 파일 공통 주석). 그런데 그 상위 경계인 컨트롤러→서비스 공개 메서드 호출은 여전히 positional string 인자다. 현재 호출부는 6차 리뷰(`0028b78a1` 테스트)로 전수 검증돼 있어 지금 당장 버그는 아니지만, `create`만 `userId`를 dto 앞에 두고 나머지는 뒤에 두는 비일관성은 향후 편집 시 실수 유발 표면을 넓힌다.
  - 제안: 필수 대응 아님(현재 안전). 여유가 되면 다음 라운드에 4개 서비스 write 메서드의 `userId` 위치를 통일(예: 항상 마지막)하는 정리를 고려할 수 있다.

- **[INFO]** DI 배선 확인 — `AuditLogsModule`을 신규로 import한 4개 모듈(`model-config.module.ts`, `schedules.module.ts`, `triggers.module.ts`, `workflows.module.ts`) 전부 확인한 결과 `AuditLogsModule`은 leaf 모듈(자신은 어떤 feature 모듈도 import하지 않음)이라 순환 의존을 만들지 않는다. `forwardRef` 불필요, 기존 `WorkflowsModule → ExecutionEngineModule` forwardRef 등 기존 순환 처리와도 무관.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.module.ts` 전체, `codebase/backend/src/modules/{model-config,schedules,triggers,workflows}.module.ts`의 `imports` 배열
  - 상세: 문제 없음, 확인 목적의 기록.
  - 제안: 없음.

이벤트/콜백(`ModelConfigService.notifyInvalidated`), 환경변수, 파일시스템, 외부 네트워크 호출 관점에서는 이번 diff가 기존 동작을 변경하지 않았다 — `notifyInvalidated` 호출 시점·순서는 이전과 동일하고, `recordAudit`는 그 뒤에 추가됐을 뿐이다. 네트워크 호출(BullMQ 등록, secret store, chat-channel adapter)의 순서·조건도 이번 diff로 바뀌지 않았다(단지 그 앞/뒤로 감사 기록이 삽입됐을 뿐이며, 삽입 위치는 각 파일 주석에 "리뷰 W6" 근거로 명문화돼 있다).

## 요약

이번 변경은 audit-logging 기능의 7차 리뷰 라운드 산출물로, `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 액션에 감사 기록을 추가하는 것이 핵심이다. 새로 추가된 유일한 부작용은 `audit_log` 테이블 INSERT이며, 이는 `AuditLogsService.record()`의 try/catch로 완전히 격리되어 원본 mutation의 성공/실패에 영향을 주지 않는다. 4개 서비스의 공개 메서드 시그니처(`userId` 파라미터 추가)는 breaking change이지만 컨트롤러 호출부 전수 조사 결과 orphaned caller가 없고, 이전 리뷰 라운드(6차 W1)에서 이미 배선 테스트로 고정돼 있다. DI 그래프에도 신규 순환 의존이 없다. 남은 관찰사항은 `userId` 위치의 형제 메서드 간 비일관성 정도이며, 이는 현재 안전하지만 향후 실수 표면을 넓히는 유지보수성 이슈다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
