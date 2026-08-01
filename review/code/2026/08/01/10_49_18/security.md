STATUS=success 보안 리뷰 완료 — CRITICAL 0 · WARNING 0 · INFO 5
===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위·방법

`model-config` / `schedules` / `triggers` / `workflows` 4개 모듈에 `AuditLogsService` 를 주입해
CRUD(생성/수정/삭제/set-default/duplicate) 감사 로깅 13개 액션을 추가한 변경. 이번 세션(`10_49_18`)은
직전 리뷰 라운드(`review/code/2026/08/01/10_05_53`, risk HIGH — Critical 2·Warning 11)의 조치 커밋
2개(`f77c1e0de` C1 조치, `a92f53df6` C2/W5/W6/W9/W10/W2 조치) 이후의 **fresh 재검토**다.

프롬프트 번들에서 "전체 파일 컨텍스트"가 생략된 파일(model-config/schedules/triggers/workflows 의
controller·service 6개)을 `Read` 로 전문 직접 확인했고, diff 에 없는 연쇄 검증 대상(`audit-logs.service.ts`
sink, `current-user.decorator.ts`, `workspace.decorator.ts`, `roles.guard.ts`, `app.module.ts` 전역 가드
등록, `trigger.entity.ts`/`schedule.entity.ts` FK CASCADE 정의, DTO 파일들)도 직접 `Read`/`grep` 으로
열어 대조했다. 직전 라운드의 `RESOLUTION.md` 가 주장한 조치(W6 커밋-직후 기록 순서, W5 `recordAudit`
중복호출 통합, W9 `try/finally`, W10 죽은 코드 삭제, W2 CHANGELOG)를 코드에서 직접 재확인해 "주장"이
아니라 "실제 반영"임을 검증했다. 의존성 변경은 0건(`package.json`/`pnpm-lock.yaml` diff 없음)이라
관점 8(의존성 보안)은 해당 없음.

## 발견사항

- **[INFO]** FK CASCADE 로 연쇄 삭제되는 자매 리소스(Workflow→Trigger, Trigger→Schedule)는 그 삭제
  자체가 감사되지 않음 — 이번 PR 이 채우려는 "설정·자동화 변경 이력" 목표의 사각지대
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:254-263`(`remove` — `workflowRepository.remove(workflow)` 뒤 `workflow.deleted` 만 기록, 이 워크플로우에 속한 `Trigger` 행들은 `trigger.entity.ts:46`(`@ManyToOne(() => Workflow, { onDelete: 'CASCADE' })`)로 DB 레벨 동반 삭제되지만 `trigger.deleted` 없음) · `codebase/backend/src/modules/triggers/triggers.service.ts:849-878`(`remove` — 코드 자체 주석 851-852 "schedule 타입은 trigger 삭제(**FK CASCADE 로 schedule row 동반 삭제**) 전에 BullMQ job scheduler 엔트리를 해제한다"가 이 사실을 스스로 인지하고 있음에도 `trigger.deleted` 만 기록하고 `schedule.deleted` 는 기록 안 함, `schedule.entity.ts:28` `@ManyToOne(() => Trigger, { onDelete: 'CASCADE' })` 로 재확인) · `codebase/backend/src/modules/schedules/schedules.service.ts:264-279`(`remove` — `triggerRepository.delete(schedule.triggerId)`(269-271)로 **애플리케이션 레벨**에서 직접 연결 트리거를 지우면서도 `schedule.deleted` 만 기록, `trigger.deleted` 없음)
  - 상세: `record()` 호출은 각 서비스의 최상위(root) 액션에서만 발생하고, 그 실행이 DB FK CASCADE(선언적) 또는 같은 트랜잭션 내 명시적 삭제(schedules 의 경우)로 유발하는 부수적 리소스 삭제에는 대응하는 감사 행이 없다. 결과적으로 `GET /audit-logs?resourceType=trigger` 로 "이 트리거가 언제 없어졌는가"를 조회하면, 그 트리거가 (a) `TriggersService.remove()` 로 직접 지워진 경우엔 나오지만 (b) 소속 워크플로우 삭제의 부수효과로 없어진 경우엔 **아무 행도 나오지 않는다** — 사후 컴플라이언스 조사에서 "언제·누가"를 오판할 수 있다. 다만 이 근본 패턴은 이번 diff 가 처음 만든 게 아니라 직전 리뷰 라운드에서 architecture 리뷰어가 이미 INFO(#3)로 식별·triage 했고("의도된 설계일 수 있으나 명문화된 근거가 없음"), 이번 두 후속 커밋(C1/C2/W5/W6/W9/W10/W2 조치)의 조치 대상에도 포함되지 않았다(RESOLUTION.md 어디에도 언급 없음 — 애초에 Critical/Warning 목록 밖) — 즉 **새 회귀가 아니라 기존에 triage 된 미해결 갭이 그대로 남아 있는 상태**다. 실제 공격 표면(인가 우회·데이터 유출)은 아니며, 삭제 자체의 인가(`@Roles('editor')` + `findById(id, workspaceId)` IDOR 스코핑)는 정상 동작한다 — 순수하게 감사 트레일의 완결성 문제다.
  - 제안: 이번 PR 을 차단할 사유는 아님. `audit-action.const.ts` 또는 `spec/data-flow/1-audit.md` 에 "FK CASCADE/애플리케이션 레벨 연쇄 삭제는 루트 액션만 감사하고 자매 리소스는 별도 기록하지 않는다"를 한 줄 명문화하거나(architecture INFO#3 의 제안과 동일), 컴플라이언스 요구가 커지면 `schedules.service.ts` 의 `triggerRepository.delete()` 호출 지점에 `trigger.deleted` 를 함께 기록하는 것부터 검토(애플리케이션 레벨 삭제라 상대적으로 손대기 쉬움 — FK CASCADE 케이스는 DB 트리거/이벤트가 필요해 더 큰 작업).

- **[INFO]** 동시 삭제(DELETE) 요청 시 동일 리소스에 중복 `*.deleted` 감사 행 생성 가능 — 직전 라운드 concurrency 리뷰(WARNING)가 이미 식별, `RESOLUTION.md` W7 로 의도적 이월(비차단)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:394-409`(`remove`) · `codebase/backend/src/modules/schedules/schedules.service.ts:264-279`(`remove`) · `codebase/backend/src/modules/triggers/triggers.service.ts:849-878`(`remove`) · `codebase/backend/src/modules/workflows/workflows.service.ts:254-263`(`remove`)
  - 상세: 네 `remove()` 모두 `find*(id, workspaceId)` → `repo.remove(entity)` → `recordAudit(*_DELETED)` 순서이며 트랜잭션/락으로 묶여 있지 않다. TypeORM `Repository.remove()` 는 영향 행 수를 보고하지 않아 이미 삭제된 행에 재호출해도 조용히 통과하고, `AuditLog` 엔티티는 append-only 라 유니크 제약이 없어 동시 요청(더블클릭·재시도) 시 동일 삭제 이벤트에 두 개의 `*.deleted` 행이 남을 수 있다. 근본 인가·데이터 무결성 침해는 아니다(삭제 자체는 정상적으로 1회만 반영되고, 감사 조회가 깨지지도 않는다) — 로그 중복이라는 완결성 문제다. 기존 `auth-configs.service.ts` 패턴이 이번 PR 로 4곳 더 복제된 것이며, `RESOLUTION.md`(`review/code/2026/08/01/10_05_53/RESOLUTION.md` W7)가 "이번 PR 이 만든 회귀가 아니고 4곳+기존 1곳을 함께 바꾸는 별도 트랙이 맞다"고 명시적으로 이월을 결정했다 — 그 판단은 여전히 타당하다.
  - 제안: 조치 불요(이미 별도 트랙으로 이월 결정됨). 착수 시 `Repository.delete()`/`manager.delete()` + `DeleteResult.affected>=1` 가드로 5곳(신규 4 + 기존 auth-configs 1)을 한 번에 통일 권장.

- **[INFO]** 감사 sink 가 쓰기 실패를 삼키고(swallow), `audit_log` 가 보존 정책 없이 무제한 — 이번 PR 로 적용 도메인이 4개 확대(기존에 이미 알려진 트레이드오프)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:80-96`(`record()` — `try/catch` 로 감싸 실패 시 `logger.warn` 만 남기고 항상 정상 resolve. 본 diff 밖의 기존 파일이나 신규 13개 액션 전부가 이 sink 로 몰림) · `codebase/backend/src/modules/audit-logs/audit-action.const.ts:38-43`(신규 주석 — `audit_log` "보존 정책 미정, pruner 없음"을 스스로 인지하고 고빈도 `workflow.executed` 를 의도적으로 제외한다고 명시)
  - 상세: OWASP A09(Security Logging and Monitoring Failures) 관점에서, DB 부하·일시 장애 시 다수의 특권 작업(모델 설정 삭제, 트리거/스케줄 삭제, 워크플로우 삭제 등)이 감사 흔적 없이 조용히 수행될 수 있다는 점은 여전히 유효하다. 다만 이는 사전에 내려진 설계 결정이고 이번 diff 가 그 자체를 바꾸지 않으며, 직전 라운드 security 리뷰(INFO#1/#2)와 consistency 리뷰(`plan_coherence.md` INFO)가 이미 동일하게 확인·수용한 기존 갭이다.
  - 제안: 조치 불요(의도된 fail-open, 이미 추적 중). 감사 신뢰도가 중요해지면 `record()` 실패의 메트릭/알람 승격, `workflow.executed` 등 고빈도 액션 추가 전 보존 정책(pruner) 선결을 검토.

- **[INFO] (diff 범위 밖 — 참고용, 재확인)** `TriggersController.rotateBotToken` 에 `@Roles` 데코레이터 부재
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:229-240`(`@Post(':id/chat-channel/rotate-bot-token')`)
  - 상세: 같은 파일에서 이번 diff 가 수정한 `create`/`update`/`remove`(84,104,149,174,197행)는 전부 `@Roles('editor')` 를 유지하지만(회귀 없음, 직접 재확인), `rotateBotToken` 은 `@Roles(...)` 가 없다. `RolesGuard`(`codebase/backend/src/common/guards/roles.guard.ts:35` 주석 "`@Roles()`가 없는 라우트는 자동 통과(default Allow)", 49-51행 구현으로 재확인)에 따라 이 엔드포인트는 워크스페이스 `viewer` 역할도 chat-channel bot token 회전을 수행할 수 있다. 이번 diff 의 변경 대상이 아닌 사전 상태이며, 직전 라운드 security 리뷰가 이미 동일하게 발견해 INFO 로 남겼다.
  - 제안: 이번 PR 차단 사유 아님. 의도된 설계(예: 채널 소유자 자기서비스 목적으로 viewer 허용)인지 담당자 확인 후 필요 시 `@Roles('editor')` 추가 검토.

## 확인된 안전한 설계 패턴 (positive findings, 직접 재검증)

- **행위자(userId) 스푸핑 불가**: 모든 신규 `userId` 는 `@CurrentUser('sub')`(`current-user.decorator.ts:10-19`, `request.user.sub` — JWT 검증 후 payload)에서만 나온다. `model-config`/`schedules`/`triggers`/`workflows` 의 4개 create/update DTO 어디에도 client-controlled `userId` 필드가 없음을 `grep` 으로 재확인(0건) — 요청 바디로 감사 행위자를 위조할 수 없다.
- **인증·인가 전역 강제**: `JwtAuthGuard`·`RolesGuard` 가 `app.module.ts:200-204` 에 `APP_GUARD` 로 전역 등록되어 모든 라우트(명시적 `@Public` 제외)에 적용됨을 확인. 이번 diff 가 시그니처를 바꾼 모든 mutating 엔드포인트(model-config/schedules/triggers/workflows 의 create/update/remove/setDefault/duplicate)에 `@Roles('editor')`(또는 그 이상)가 그대로 유지됨을 전수 확인 — RBAC 회귀 없음.
- **IDOR 방지 유지**: `remove`/`setDefault`/`update`/`duplicate` 계열은 모두 감사 기록 이전에 `findEntity(id, workspaceId)`/`findById(id, workspaceId)` 로 워크스페이스 스코프 조회를 선행한다(직접 확인: `model-config.service.ts:394-395`, `schedules.service.ts:265`, `triggers.service.ts:850`, `workflows.service.ts:235,255,283`). 타 워크스페이스 리소스는 그 이전에 404 로 차단되므로, 신규 `recordAudit` 호출이 크로스-워크스페이스 리소스에 도달할 경로가 없다. `WorkspaceId` 데코레이터의 `X-Workspace-Id` 헤더 우선 신뢰는 `RolesGuard` 의 멤버십 검증(비멤버 403)으로 보완되는 기존 설계임을 재확인.
- **행위자·대상 뒤바뀜 방지**: 4개 서비스 모두 `recordAudit(params: {...})` 를 object 파라미터로 설계해 "동일 타입(string) positional 인자 순서 스왑을 컴파일러가 못 잡는" 클래스의 버그를 원천 차단(`auth-configs W-1` 선례 인용 주석 확인).
- **트랜잭션 경계 정확성**: `model-config.setDefault`(`model-config.service.ts:370-391`)·`workflows.create`/`duplicate`(`workflows.service.ts:196-227`, `294-404`)는 감사 기록을 트랜잭션 **커밋 뒤**로 옮기고, 그 순서를 관측 가능한 형태로 단언하는 테스트가 있다 — 롤백된 작업이 감사에 남는 위양성을 방지.
- **W6 조치 실제 반영 확인**: 직전 라운드 Warning(triggers/schedules 의 감사 기록이 실패 가능한 외부 호출(secret store rotate, BullMQ 등록) 뒤에 있어 "리소스는 생겼는데 감사가 안 남을 수 있음")이, 이번 재검토 시점 코드에서 실제로 `triggers.service.ts:259-268`(create)/`341-350`(update), `schedules.service.ts:186-193`(create)/`245-251`(update) 전부 **커밋 직후로 이동**했음을 직접 확인 — 주장이 아니라 실측.
- **W5 조치 실제 반영 확인**: `triggers.service.ts` create/update 의 `recordAudit` 이 `let result = saved;` 패턴으로 통합돼 1회만 호출됨을 확인(`:271,281`/`:352,361`) — chatChannel 분기별 중복 호출 제거.
- **정보 노출 최소화**: `details` 필드에는 `kind`(chat/embedding/rerank), `type`(webhook/schedule/chat_channel), `duplicatedFrom`(UUID) 같은 저위험 값만 기록되며, apiKey·webhook HMAC secret·자유 텍스트(`dto.name` 등)는 어디에도 노출되지 않는다. `model-config.service.ts` 의 API 키 암호화(`encrypt`/`decrypt`, `crypto.util.ts`)·마스킹(`maskApiKey`) 로직은 이번 diff 로 변경되지 않았음을 파일 상단 import/구조 확인으로 재검증.
- **SQL 인젝션 없음**: 신규/기존 조회 경로 전부 TypeORM `QueryBuilder` 파라미터 바인딩(`:workspaceId` 등, `audit-logs.service.ts:37-54`) 또는 `Repository`/`EntityManager` 메서드를 사용하며 원시 문자열 결합이 없다. `resourceId` 는 항상 `ParseUUIDPipe` 로 검증된 라우트 파라미터이거나 DB 생성 `saved.id` — 사용자 자유 입력이 아니다. `getSortColumn()` 은 3개 컬럼 allowlist 로 제한.
- **하드코딩 시크릿 없음**: 신규/변경 spec 픽스처(`sk-test123456789abcdef`, `xoxb-fake-token`, `111:TestToken` 등)는 명백한 더미이며 `grep` 으로 실제 시크릿 패턴 없음을 재확인. `ENCRYPTION_KEY` 는 `randomBytes(32)` 로 테스트마다 새로 생성.
- **입력 검증 약화 없음**: `notification-config.dto.ts:105` 의 `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], ...)` → `@IsIn(NOTIFICATION_EVENT_TYPES, ...)` 변경은 동일 `as const` 배열 참조를 그대로 넘기는 컴파일 타임 전용 타입 단언 제거다 — `class-validator` 런타임 화이트리스트 값·동작은 무변화임을 파일 전문 확인으로 재검증.
- **의존성 변경 없음**: `package.json`/`pnpm-lock.yaml` diff 0건 — 신규 서드파티 의존성으로 인한 공급망 리스크 없음.

## 요약

이번 diff(직전 HIGH 리스크 라운드의 Critical 2·Warning 11 조치 이후 fresh 재검토)는 4개 모듈(model-config/
schedules/triggers/workflows)에 감사 로깅을 추가하는 기능 확장이며, 신규로 도입된 인젝션·인증 우회·시크릿
노출·권한 검증 누락 취약점은 발견되지 않았다. 직전 라운드가 지적한 보안 인접 항목(W6: 커밋~감사기록 사이
실패 가능 외부호출, W5: 중복 audit 호출, W9/W10: 테스트 오염·죽은 코드)은 코드에서 실제로 반영됐음을
`Read`/`grep` 으로 직접 재검증했다 — RESOLUTION.md 의 주장이 사실과 일치한다. 행위자(userId)는 검증된
JWT claim 에서만 취해지고, RBAC(`@Roles`)·IDOR 방지(`workspaceId` 스코프 선행 조회)·SQL 인젝션 방지
(파라미터 바인딩)·시크릿 비노출(`details` 필드 저위험 값만)이 4개 모듈 전수에서 회귀 없이 유지된다.
남은 항목은 전부 INFO 수준이며 이번 PR 을 차단할 사유가 아니다 — (1) FK CASCADE/애플리케이션 레벨
연쇄 삭제로 사라지는 자매 리소스(trigger/schedule)가 감사되지 않는 완결성 갭(기존 architecture INFO,
새 회귀 아님), (2) 동시 삭제 시 중복 감사 행 가능성(기존 concurrency WARNING, `RESOLUTION.md` W7 로
의도적 이월 확정), (3) 감사 sink 의 실패 삼킴(swallow)·`audit_log` 무제한 보존이라는 기존에 이미
문서화된 트레이드오프의 적용 범위 확대, (4) 이번 diff 밖의 인접 엔드포인트(`rotateBotToken`) `@Roles`
부재 재확인. 신규 서드파티 의존성 변경도 없다.

## 위험도

LOW
