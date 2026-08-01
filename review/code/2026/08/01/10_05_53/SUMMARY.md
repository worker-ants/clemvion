# Code Review 통합 보고서

## 전체 위험도

**HIGH** — 프로덕션 런타임 영향은 없다는 데 전 reviewer 가 동의하지만, 이 PR 이 스스로 도입한 회귀 안전망이 두 가지 CRITICAL 로 무력화돼 있다: (1) 같은 PR 이 수정한 기존 테스트 호출부 약 70곳이 신규 필수 `userId` 인자를 반영하지 못해 `tsc --noEmit` 타입체크가 깨져 있는데 lint/unit/build 어떤 CI 게이트도 이를 잡지 못하고, (2) `triggers`/`workflows`/`schedules` 3개 서비스의 다수 `recordAudit` 호출부(create/update/remove)가 어떤 테스트로도 검증되지 않아 — 실제로 그 코드를 지우고 재실행해도 전체 테스트가 통과함을 mutation 으로 실측 확인 — 향후 리팩터링이 감사 트레일을 조용히 깨도 아무도 잡지 못한다. 여기에 spec/plan SoT 4곳이 이미 완료된 구현을 여전히 "미구현"으로 서술하는 `[SPEC-DRIFT]`, `WorkflowsService` 자체 선언 범위 안에서의 커버리지 공백(`saveCanvas`/`restoreVersion`/`importWorkflow`), `triggers`/`schedules` 의 커밋~감사기록 사이 불변식 위반, 동시 삭제 시 중복 감사 행 가능성 등 MEDIUM급 구조적 이슈가 다수 겹친다. forced(router_safety) 7개 reviewer 는 전원 결과가 확보되어 이 판단에 누락된 시각은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 4개 서비스(model-config/schedules/triggers/workflows)의 create/update/remove/setDefault 에 필수 `userId` 인자가 추가됐는데, 같은 PR 이 수정한 5개 spec 파일의 **기존** 호출부 약 70곳이 갱신되지 않아 `tsc --noEmit`(spec 포함)에서 TS2554 70건 발생. `tsconfig.build.json` 이 `**/*spec.ts` 를 exclude 하고 `jest`(ts-jest, `isolatedModules:true`)도 이 진단을 강제하지 않아 lint/unit/build 3개 CI 게이트 어디서도 검출되지 않음(직접 tsc/jest 실행으로 실측). 프로덕션 호출부(4개 컨트롤러)는 전부 올바르며 런타임 영향은 없음 — requirement·side_effect 도 동일 사실을 확인했으나 "런타임 무영향"을 근거로 WARNING 등급을 매겼고, testing 은 실측(mutation·tsc 직접 실행) 기반으로 "회귀 안전망 정면 훼손"을 이유로 CRITICAL 을 유지함(reviewer 간 등급 이견 존재, 본 요약은 더 엄격한 실측 근거를 채택) | `model-config.service.spec.ts`(29곳), `triggers.service.spec.ts`(32곳), `schedules.service.spec.ts`(4곳), `workflows.service.spec.ts`(3곳), `triggers.web-chat.spec.ts`(2곳) — 총 70곳 | 각 호출부에 더미 `userId`(예: `'u-1'`) 인자 추가. 재발 방지로 `tsc --noEmit`(spec 포함)을 별도 CI/pre-push 단계로 추가하는 것을 권장 |
| 2 | 테스트 | `TriggersService.create/update`(chatChannel 유무 2분기씩, 총 4곳), `WorkflowsService.update/remove`, `SchedulesService.update/remove` 의 `recordAudit` 호출이 테스트로 전혀 검증되지 않음 — 해당 호출부를 실제로 삭제한 뒤 관련 유닛 테스트를 재실행하니 전부 통과했다(mutation 실측, 이후 `cp` 로 원복 및 `git status` 무잔여 확인). e2e 로도 보완되지 않음(`audit-logs.e2e-spec.ts` 는 SQL INSERT 로 seed 만 하고 실제 API 호출로 `audit_log` 를 단언하는 e2e 는 0건). `SchedulesService.update/remove` 는 감사뿐 아니라 메서드 자체가 어떤 테스트에서도 호출되지 않음. model-config 만 create/update/setDefault/remove 전체(트랜잭션 순서·실패 시 미기록 포함)를 촘촘히 검증해 나머지 3개 서비스와 뚜렷이 대비된다(requirement 도 동일 비대칭을 정적 분석으로 별도 확인, WARNING 등급 부여 — 근본 원인은 동일) | `triggers.service.ts:271-287,356-372`, `workflows.service.ts:245-250,257-262`, `schedules.service.ts:251-256,269-274` | `model-config.service.spec.ts` 패턴(정상 경로/실패 시 미기록/트랜잭션 커밋 순서 단언)을 나머지 3개 서비스의 누락 CRUD 동작 전부에 동일 적용. `SchedulesService.update/remove` 는 감사 이전에 기능 자체의 기본 유닛 테스트부터 필요 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] 4개 서비스에 13개 감사 액션 구현이 완료됐음(컨트롤러→서비스→`AuditLogsService.record()` 전체 배선 확인)에도 spec/plan SoT 4곳이 여전히 "Planned/미구현"으로 서술 — 코드가 옳고 spec 표기가 낡았다. 이 PR 이 스스로 번들한 impl-prep consistency-check(`review/consistency/2026/08/01/09_11_58/`)가 "구현 완료 시 4개 SoT 를 한 커밋에서 동시 갱신"을 이미 명시적으로 예견·권고했음에도 미이행됐다. `workflow.executed` 는 보존정책 미정으로 이번에도 의도적으로 미구현(Planned 잔류가 맞음)이라 단순 일괄 승격이 아니라 세심한 분리가 필요하다(requirement·documentation·user_guide_sync 3개 reviewer 가 각자 다른 각도로 독립 확인) | `spec/5-system/1-auth.md:429-438`, `spec/data-flow/1-audit.md:82-88`, `spec/conventions/audit-actions.md:56-59`, `spec/2-navigation/2-trigger-list.md:182,252`(`trigger.delete`→`trigger.deleted` 오기 포함), `plan/in-progress/spec-sync-auth-gaps.md:15` | project-planner 턴으로 4개 spec 문서 동시 갱신(13개 액션을 "구현된 액션" 표로 이동, `workflow.executed` 만 Planned 잔류) + `2-trigger-list.md` 액션명 오기 정정 + plan 체크박스 체크. developer 범위에서는 `plan/in-progress/spec-update-audit-logging-coverage.md` 제안 노트로 위임을 유도할 수 있음 |
| 2 | 문서화 | 사용자 대면 신규 감사 커버리지(4모듈 13액션)에 대해 `CHANGELOG.md` 기재가 누락됨 — 이 저장소의 확립된 관행(과거 리뷰로 강제 이행된 선례 있음)과 어긋난다 | `CHANGELOG.md`(diff 에 변경 없음) | `## Unreleased` 에 감사 로깅 커버리지 확장 항목(신규 액션 목록, `workflow.executed` 제외 사유) 추가 |
| 3 | 아키텍처 | `WorkflowsService` 의 `workflow.*` 감사 커버리지가 PR 자신이 선언한 범위(`workflow.updated` 등) 안에서도 불완전 — 실제 캔버스 편집 경로인 `saveCanvas`/`restoreVersion`/`importWorkflow` 세 메서드가 `recordAudit` 호출 자체가 없음. `duplicate()`는 동일 성격(신규 workflow 행 생성)인데 감사되는 것과 대비해 `importWorkflow()`만 빠진 것도 비일관 | `workflows.service.ts:451`(importWorkflow), `:578`(saveCanvas), `:642`(restoreVersion) | `saveCanvas`/`importWorkflow` 커밋 후 기존 액션(`WORKFLOW_UPDATED`/`WORKFLOW_CREATED`) 재사용해 `recordAudit` 추가, `restoreVersion` 은 `saveCanvas` 경유로 자동 해결, 대응 테스트 추가 |
| 4 | 유지보수성 | `recordAudit` private 래퍼가 구조적으로 동일한 형태로 5개 서비스(기존 auth-configs 1 + 신규 4)에 손으로 반복 구현됨 — "positional 인자 순서 스왑 위험" 근거 주석까지 파일마다 복제돼 있어, 향후 감사 대상 리소스가 늘수록(spec 이 이미 예고) 유지비가 선형 증가 | `model-config.service.ts:239`, `schedules.service.ts:141`, `triggers.service.ts:209`, `workflows.service.ts:174`(+ `auth-configs.service.ts:78` 기존) | `AuditLogsService` 에 `scopedRecorder(resourceType)` 팩토리 도입 검토(즉시 필수는 아님, 6번째 리소스 추가 시점 권장) |
| 5 | 아키텍처/유지보수성 | `TriggersService.create`/`update` 내부에서 `recordAudit` 호출 자체가 메서드당 2곳(chatChannel 재조회 분기·폴백 분기)으로 중복 — 향후 `details` 필드 추가 시 한쪽만 반영되고 다른 쪽을 놓치는 drift 위험 | `triggers.service.ts:271,281`(create), `:356,366`(update) | `const result = refreshed ?? saved;` 로 통합한 뒤 `recordAudit` 를 1회만 호출 |
| 6 | 부작용 | `triggers`/`schedules` 서비스의 `create`/`update` 는 DB 저장과 감사 기록 사이에 실패 가능한 외부 호출(secret store rotate, BullMQ `registerJob`/`removeJob`)을 끼워 넣어, 같은 PR 이 `model-config`/`workflows` 에서 지키는 "커밋 직후 기록" 불변식을 어긴다 — 그 외부 호출이 실패하면(try/catch 로 보호 안 됨) 리소스는 생성/수정되지만 감사 기록은 전혀 남지 않는다 | `triggers.service.ts:258-260`(normalizeNotificationSecretRef, gate 271/281 recordAudit), `schedules.service.ts:190`(registerJob, gate 193), `:246-248`(registerJob/removeJob, gate 251) | `recordAudit` 호출을 최초 커밋 직후로 앞당기거나, 외부 호출을 try/catch 로 감싸 실패해도 `recordAudit` 는 반드시 실행되도록 보정 |
| 7 | 동시성 | 동시 삭제(DELETE) 요청이 동일 리소스에 대해 중복 `*.deleted` 감사 로그를 생성할 수 있음 — 4개 서비스 모두 `find→remove→recordAudit` 이 트랜잭션/락 없이 실행되고 TypeORM `Repository.remove()` 는 영향 행 수를 보고하지 않아 이미 삭제된 리소스에 재호출해도 조용히 통과하며, `AuditLog` 엔티티도 append-only 라 유니크 제약이 없다. 기존 `auth-configs.service.ts` 패턴이 4곳으로 확장 복제된 것 | `model-config.service.ts:394-409`, `schedules.service.ts:260-275`, `triggers.service.ts:859-888`, `workflows.service.ts:254-263` | `Repository.delete()`/`manager.delete()` 로 바꿔 `DeleteResult.affected>=1` 일 때만 `recordAudit` 호출하거나 `SELECT...FOR UPDATE` 로 직렬화. 4곳 공통 헬퍼로 일괄 수정 권장 |
| 8 | 테스트 | 컨트롤러 계층의 `userId` 배선(`@CurrentUser('sub')`→서비스 호출) 검증이 비일관적 — `model-config` 의 `update`/`remove` 2곳에만 "userId 까지 단언"하는 테스트가 존재하고 `create`/`setDefault` 는 없음. `schedules.controller.spec.ts` 파일 자체가 저장소에 없음. `triggers`/`workflows` controller spec 도 `create`/`update`/`remove` 의 userId 포워딩은 다루지 않으며 e2e 로도 보완되지 않음 | `model-config.controller.ts:115-121,152-158`, `schedules.controller.ts`(spec 파일 부재), `triggers.controller.spec.ts`, `workflows.controller.spec.ts` | `model-config` 의 `update`/`remove` 패턴을 `create`/`setDefault` 에도 적용, `schedules.controller.spec.ts` 신설, 여력 시 e2e 1건(실제 API 호출 후 `audit_log.user_id` 단언) 추가 |
| 9 | 테스트 | `workflows.service.spec.ts` 신규 트랜잭션 순서 테스트 2건이 suite 공유 `mockDataSource.transaction` 을 `finally`/`afterEach` 없이 테스트 본문 맨 끝에서만 복원 — 중간 `expect()` 가 실패(바로 이 테스트가 잡으려는 회귀가 실제 발생한 경우)하면 복원 줄이 실행되지 않아 이후 무관한 테스트 전체로 오염이 번질 수 있다(`model-config.service.spec.ts` 는 `beforeEach` 에서 mock 을 통째로 재생성해 이 문제가 구조적으로 없음 — 대비됨) | `workflows.service.spec.ts:783-828` | `try{...} finally{ mockDataSource.transaction = origTx; }` 또는 `afterEach` 로 복원 이동 |
| 10 | 유지보수성/문서화 | `triggers.service.spec.ts` 신규 감사 로깅 describe 블록에 죽은 코드 — 첫 `auditLogs` 할당(즉시 재할당돼 폐기)과 `const idx = moduleRef as unknown as {...} as unknown as never; void idx;` 4줄이 아무 효과 없이 버려진다. "여기서 override" 주석이 가리키는 지점과 실제 override(`moduleRef.get(AuditLogsService)`) 위치가 어긋나 읽는 사람이 오인하거나 다른 파일로 복제할 위험 | `triggers.service.spec.ts:2154, 2166-2170` | 죽은 코드 4~5줄 삭제, "여기서 override" 주석을 실제 override 줄로 이동 |
| 11 | 스코프 | 감사 로깅과 무관한 `notification-config.dto.ts` 의 `@IsIn` 타입 캐스트 제거가 "포맷 전용"이라 주장하는 3번째 커밋(`65087584b`)에 섞여 유입됨 — `git diff -w` 로도 이 hunk 는 실제 토큰 삭제(공백 차이 아님)로 남아, 커밋 메시지의 "실질 변경 0줄" 주장이 이 파일에 한해 사실이 아니다(같은 커밋의 나머지 8개 파일은 실제로 0줄임을 확인). 근본 원인은 `lint:fix` 를 diff 파일 목록이 아니라 모듈 디렉터리 단위로 실행한 것으로 추정. 런타임 위험은 없음(순수 타입 단언 제거) | `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:105` | 별도 독립 커밋으로 분리하거나 되돌리기. 향후 `lint:fix`/`eslint --fix` 실행 범위를 diff 로 변경된 파일 목록으로 한정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/동시성/성능 | 감사 sink(`AuditLogsService.record()`)가 DB 쓰기 실패를 전부 삼킴(try/catch, `logger.warn` 만) — 기존 트레이드오프가 이번에 4개 도메인·13개 액션으로 확대 적용됨. 부하/일시 장애 시 다수 특권 작업이 무흔적으로 수행될 수 있음(OWASP A09 관점) | `audit-logs.service.ts:72-97`(diff 밖, 기존 sink) | 조치 불요(의도된 설계). 향후 감사 신뢰도가 중요해지면 실패 시 메트릭/알람 승격 검토 |
| 2 | 보안/성능 | `audit_log` 테이블 무제한 보존(pruner 없음, action/resource_type/user_id 전용 인덱스 없음) — 이번 diff 가 저빈도 CRUD 4곳(13액션)을 신규 쓰기 소스로 추가해 기존에 알려진 보존정책 공백의 소진 속도·조회 성능 저하 시점이 앞당겨짐. `workflow.executed`(고빈도)는 이 이유로 의도적으로 제외됨(판단 자체는 합리적) | `audit-action.const.ts:38-43`, `migrations/V002__indexes.sql:33` | 조치 불요(이미 추적 중인 기존 갭). 조회 성능 저하가 실측되면 보조 인덱스/pruner 검토 |
| 3 | 아키텍처 | FK CASCADE 로 연쇄 삭제되는 자매 리소스(Workflow→Trigger, Trigger↔Schedule)는 감사 트레일에 흔적이 남지 않음 — 의도된 설계(루트 액션만 기록)일 수 있으나 명문화된 근거가 없음 | `workflows.service.ts:254`, `triggers.service.ts:859`, `schedules.service.ts:260`; `trigger.entity.ts:46`, `schedule.entity.ts:28`(onDelete:CASCADE) | 현재 동작 유지 시 `audit-action.const.ts` 또는 `1-audit.md` 에 "cascade 삭제는 별도 감사하지 않는다"를 한 줄 명문화 |
| 4 | 아키텍처 | Trigger 의 시크릿/토큰 회전 엔드포인트(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)는 감사 범위 밖 — spec §4.1 목표 동사(created/updated/deleted)와는 정합이나, 이미 구현된 `auth_config.regenerate` 감사 선례와 비대칭 | `triggers.service.ts:904,940,985` | 이번 PR 스코프 유지, 후속 필요 여부는 project-planner 확인 권장(차단 아님) |
| 5 | 아키텍처/유지보수성 | 신규 4개 서비스가 이미 export 된 `AuditAction` 타입 별칭을 재사용하지 않고 4곳 모두 `(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 를 인라인 재정의 — 스스로 인용한 선례(`auth-configs.service.ts`)는 `AuditAction` 을 정상 재사용함 | `model-config.service.ts:242`, `schedules.service.ts:144`, `triggers.service.ts:212`, `workflows.service.ts:177` | `import { AUDIT_ACTIONS, AuditAction } from '../audit-logs/audit-action.const'` 로 정리 |
| 6 | 보안 | `TriggersController.rotateBotToken` 에 `@Roles` 데코레이터 부재(diff 범위 밖, 기존 상태) — RolesGuard 기본 Allow 정책상 workspace viewer 도 chat-channel bot token 회전 가능 | `triggers.controller.ts:229-239` | 이번 PR 차단 사유 아님, 의도된 설계인지 담당자 확인 권장 |
| 7 | 유지보수성/아키텍처 | `@CurrentUser` 데코레이터 스타일이 `schedules.controller.ts`/`workflows.controller.ts` 내부에서 혼재(`user:JwtPayload`+`.sub` vs `@CurrentUser('sub') userId`) — 서비스 메서드 인자 순서도 파일마다 제각각 | `schedules.controller.ts:153,179,203,224`, `workflows.controller.ts:158,181` | 차단 아님, 여유 시 파일 내 스타일 통일 |
| 8 | 유지보수성/스코프 | `WorkflowsService.duplicate()` diff 100줄 이상이 로직 변경이 아닌 prettier 재들여쓰기 노이즈 — `git diff -w` 로 실제 변경은 3가지(트랜잭션 결과 변수 캡처·`recordAudit` 추가·반환)뿐임을 확인(scope 리뷰어가 "문제 없음"으로 별도 검증) | `workflows.service.ts` `duplicate()` ~277-405 | 차단 아님. 향후 유사 변경 시 콜백을 named 함수로 분리하면 diff 가 로직 변경에만 집중 |
| 9 | 문서화 | `workflow.executed` 제외 근거(보존정책 미정)가 spec 이 아닌 review 세션 산출물 경로만 인용 — spec 갱신 시 Rationale 로 승격 필요 | `audit-action.const.ts:41-43` | WARNING #1(SPEC-DRIFT) 작업 시 이 근거를 spec 의 `## Rationale` 섹션으로 함께 이관 |
| 10 | 테스트 | `ModelConfigService.create()` 의 `isDefault:true`(saveWithDefaultSwap) 경로는 감사 테스트가 다루지 않음 — `setDefault`/`update` 의 동일 분기는 테스트가 있음 | `model-config.service.spec.ts:913-933` | `isDefault:true` 로 생성하는 케이스 테스트 추가 |
| 11 | 테스트 | `notification-config.dto.ts` 의 `@IsIn` 캐스트 제거에 대응하는 회귀 테스트 없음(`NotificationConfigDto` 참조 spec 자체가 저장소에 없음) — 런타임 동작 보존 가능성은 높으나 테스트로 확정 불가 | `notification-config.dto.ts:105` | 우선순위 낮음. 여유 시 `events` 화이트리스트 통과/거부 케이스 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 결함 없음(행위자 스푸핑 불가·RBAC/IDOR 회귀 없음·SQL 인젝션 없음 확인). 감사 sink 실패 삼킴 확대 적용·무제한 보존은 기존에 알려진 INFO 재확인 |
| performance | LOW | CRITICAL/WARNING 급 성능 결함 없음. 감사 INSERT 로 소폭 레이턴시 증가(의도된 트레이드오프), 무제한 테이블 소진 가속(기존 INFO) |
| architecture | MEDIUM | `WorkflowsService` 감사 커버리지가 자체 선언 범위 내에서도 불완전(saveCanvas/restoreVersion/importWorkflow 누락), `recordAudit` 래퍼 5중 반복, `TriggersService` 내부 호출 중복 |
| requirement | MEDIUM | `[SPEC-DRIFT]` spec 3곳 미동기화, 기존 테스트 호출부 70곳 타입에러(WARNING 등급), 3개 서비스 감사 테스트 편중 |
| scope | LOW | `notification-config.dto.ts` 무관 변경 유입(커밋 메시지 부정확), 신규 테스트 죽은 코드. 그 외 스코프 통제는 양호 |
| side_effect | MEDIUM | 테스트 호출부 70곳 타입에러(WARNING 등급), `triggers`/`schedules` 의 커밋~감사기록 사이 실패가능 외부호출 끼어듦(불변식 위반) |
| maintainability | LOW | `triggers.service.spec.ts` 죽은 코드, `TriggersService` create/update 내부 `recordAudit` 중복 호출 |
| testing | HIGH | CRITICAL 2건 — 테스트 호출부 70곳 타입에러(tsc 실측)·다수 `recordAudit` 호출부 무검증(mutation 실측, 코드 삭제해도 전체 테스트 통과) |
| documentation | MEDIUM | spec/plan SoT 4곳 미동기화, `CHANGELOG.md` 미기재, 죽은 코드+주석 위치 오류 |
| concurrency | MEDIUM | 동시 삭제 요청 시 중복 `*.deleted` 감사 로그 가능성(4개 서비스 공통 패턴), 감사 기록 비원자적 쓰기(기존 계약의 확대 적용) |
| user_guide_sync | MEDIUM | `spec-defect-found` 매트릭스 행 매칭 — 구현 완료된 13개 액션이 spec 4곳에서 여전히 미구현으로 서술됨(requirement/documentation 과 동일 근본 발견을 독립 교차 확인) |

## 발견 없는 에이전트

없음 — 실행된 11개 에이전트 모두 최소 INFO 이상의 발견사항을 보고했다.

## 권장 조치사항

1. 기존 테스트 호출부 약 70곳(`model-config.service.spec.ts`/`triggers.service.spec.ts`/`schedules.service.spec.ts`/`workflows.service.spec.ts`/`triggers.web-chat.spec.ts`)에 더미 `userId` 인자를 추가해 `tsc --noEmit`(spec 포함)을 클린화한다. 재발 방지로 스펙 포함 타입체크를 별도 CI/pre-push 단계로 추가하는 것을 검토한다.
2. `triggers`/`workflows`/`schedules` 의 미검증 `recordAudit` 호출부(triggers `create`/`update` 각 2분기, workflows `update`/`remove`, schedules `update`/`remove`)에 `model-config.service.spec.ts` 수준(정상/실패 시 미기록/트랜잭션 커밋 순서 단언)의 테스트를 추가한다. `SchedulesService.update`/`remove` 는 감사 이전에 기능 자체의 기본 유닛 테스트부터 필요하다.
3. project-planner 턴으로 spec 4곳(`spec/5-system/1-auth.md §4.1`, `spec/data-flow/1-audit.md §1.1`, `spec/conventions/audit-actions.md §3`, `spec/2-navigation/2-trigger-list.md`) + `plan/in-progress/spec-sync-auth-gaps.md` 체크박스를 동기화하고(`[SPEC-DRIFT]`), `CHANGELOG.md` 에 Unreleased 항목을 추가한다.
4. `WorkflowsService.saveCanvas`/`restoreVersion`/`importWorkflow` 에 기존 액션(`WORKFLOW_UPDATED`/`WORKFLOW_CREATED`)을 재사용해 `recordAudit` 호출을 추가한다.
5. `triggers`/`schedules` 의 `create`/`update` 에서 `recordAudit` 호출을 커밋 직후로 앞당기거나, 그 사이에 낀 외부 호출(secret rotate, BullMQ registerJob/removeJob)을 try/catch 로 감싸 실패해도 감사 기록이 반드시 실행되도록 보정한다.
6. 4개 서비스의 `remove()` 에 `DeleteResult.affected` 체크를 추가(또는 `SELECT...FOR UPDATE` 직렬화)해 동시 삭제 요청 시 중복 `*.deleted` 감사 행을 방지한다 — 공통 헬퍼로 일괄 수정 권장.
7. `TriggersService.create`/`update` 의 두 분기 `recordAudit` 중복 호출을 `const result = refreshed ?? saved;` 로 통합해 단일 호출 지점으로 정리한다.
8. `triggers.service.spec.ts` 의 죽은 코드(`idx`/`void idx`, 불필요한 `auditLogs` 재할당)를 제거하고 "여기서 override" 주석을 실제 위치로 옮긴다.
9. `notification-config.dto.ts` 변경을 별도 커밋으로 분리하거나 되돌리고, 향후 `lint:fix` 실행 범위를 diff 파일 목록으로 한정한다.
10. `model-config.controller.spec.ts` 의 `update`/`remove` userId 포워딩 단언 패턴을 `create`/`setDefault` 에도 적용하고, `schedules.controller.spec.ts` 를 신설한다. `workflows.service.spec.ts` 의 트랜잭션 순서 테스트 mock 복원은 `finally`/`afterEach` 로 옮긴다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — forced 전원 결과 확보됨(확인 완료, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터가 별도 사유를 전달하지 않음(매니페스트에 이름만 명시). 참고: scope 리뷰어가 "임포트·설정 파일(package.json, eslint.config.mjs, tsconfig*, CI 설정 등) 변경 0건"을 별도로 확인해 정합 |
  | database | 라우터가 별도 사유를 전달하지 않음. 참고: 이번 diff 에 신규 `.sql` 마이그레이션 파일이 없고, 기존 마이그레이션(`V089__model_config_kind_default_unique.sql`, `V002__indexes.sql`)은 여러 reviewer 가 참조만 했을 뿐 스키마 변경 대상이 아님 |
  | api_contract | 라우터가 별도 사유를 전달하지 않음. 참고: user_guide_sync 리뷰어가 `backend-api-change` 매트릭스 행을 직접 판단해 "client-visible API 계약 변화 없음"(신규 `userId` 파라미터가 JWT 파생값이라 swagger 미노출)으로 결론 |