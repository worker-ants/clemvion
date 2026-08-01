# Code Review 통합 보고서

## 전체 위험도
**HIGH** — testing 리뷰어가 [CRITICAL]로 분류한 `TriggersService.update()` 의 "커밋 직후 기록(W6)" 불변식 위반(schedule 동기화의 BullMQ 호출이 감사 기록보다 먼저 실행)이 존재하며, 이는 이 PR 이 스스로 세운 핵심 원칙이 한 경로에서 실제로 깨진 사례이자 어떤 테스트도 잡아내지 못한다(architecture·database 리뷰어는 동일 근본원인을 WARNING 으로 평가 — 아래 표 참고). forced whitelist(6개) 전원 결과는 확보되어 안전 게이트 미이행 문제는 없음. 그 외에는 감사 커버리지 완결성(importWorkflow 누락, Schedule↔Trigger 상호쓰기 미기록)과 회귀 테스트 갭(W6 패턴이 create() 에만 적용) 중심의 WARNING 다수, 1건의 [SPEC-DRIFT](이미 planner 턴 대기 중으로 추적됨)가 있다. 신규 인젝션·인증우회·시크릿노출·RBAC 회귀는 발견되지 않았다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / architecture / database | `TriggersService.update()` — schedule 타입 트리거의 `isActive` 변경 시 `syncScheduleActivation()` 내부 BullMQ 외부 호출(`registerJob`/`removeJob`)이 `recordAudit()` 보다 **먼저** 실행돼, 같은 함수가 스스로 명시한 "커밋 직후 기록, 실패 가능한 외부 호출은 그 뒤로" 원칙(W6)을 이 경로에서만 위반한다. `registerJob`이 throw 하면 trigger(및 schedule.is_active)는 이미 DB 커밋됐는데 `trigger.updated` 감사 행은 영구 유실된다. 같은 함수의 다른 두 외부 호출(secret 마이그레이션, chatChannel setup)은 정확히 이 원칙대로 감사 **이후**에 배치돼 대비된다. 자매 서비스 `SchedulesService.update()` 는 반대로 BullMQ 호출을 `recordAudit` **뒤**에 둬 대칭이 깨져 있다. `triggers.service.spec.ts` 의 "Schedule 역방향 동기화" 테스트와 "감사 로깅(trigger.*)" 테스트가 서로 교차하지 않아(전자는 webhook 타입만 사용) 이 조합(schedule 타입 + isActive 변경 + audit)은 어떤 테스트에도 걸리지 않으며, `registerJob`/`removeJob` mock 도 전체 스펙에서 실패하도록 설정된 적이 없다. (testing 은 이를 [CRITICAL], architecture·database 는 [WARNING] 으로 각각 평가 — 근본 원인은 동일, 심각도 판단만 갈림) | `codebase/backend/src/modules/triggers/triggers.service.ts:332-350`(`update()`, `syncScheduleActivation` 호출 → `recordAudit` 순서) / `:827-847`(`syncScheduleActivation` 내부 BullMQ 호출) | `recordAudit()` 호출을 `syncScheduleActivation()` 호출보다 앞(다른 두 외부 호출과 동일 원칙)으로 옮기거나, `syncScheduleActivation` 내부 BullMQ 호출을 감사 기록 뒤로 재배치. "schedule 타입 + isActive 변경 + registerJob 실패" 시나리오를 고정하는 순서(order-array) 회귀 테스트 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / testing / database | `WorkflowsService.importWorkflow()` 가 새 `Workflow` row 를 생성함에도 감사 기록(`recordAudit`)을 남기지 않는다 — 동일 성격의 "생성" 경로인 `create()`/`duplicate()` 는 모두 `workflow.created` 를 남기는 것과 비대칭. 컨트롤러는 이미 `userId` 를 `importWorkflow` 에 전달하고 있어 필요한 인자는 갖춰져 있다. `workflows.service.spec.ts` 에 이 부재(의도/누락)를 확정하는 회귀 테스트가 없어, 향후 실수로 추가/누락이 바뀌어도 어떤 테스트도 깨지지 않는다 | `codebase/backend/src/modules/workflows/workflows.service.ts:451-576`(`importWorkflow()`) | 의도된 스코프 축소라면 "importWorkflow는 감사를 남기지 않는다"를 확정하는 회귀 테스트 1개 추가로 의도를 문서화. 누락이라면 `create()`/`duplicate()` 와 동일 패턴으로 `WORKFLOW_CREATED` 기록 + 테스트 추가 |
| 2 | testing | "W6 순서 고정"(commit → audit → 외부호출) 회귀 가드가 `create()`(model-config 는 `setDefault()`)에만 적용되고 자매 메서드 `update()`, 그리고 model-config `create()`/`update()`의 `isDefault: true` 트랜잭션 분기에는 없다 — 위 Critical #1 이 정확히 이 테스트 갭이 가리키는 지점에서 실제 버그로 이어졌다. 나아가 model-config `create()`의 `isDefault: true` 분기는 스펙 전체에서 단 한 번도 실행(존재 커버리지 자체 부재)되지 않는다 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:319`(update 감사 테스트, 순서 미검증) / `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2299`(update, 순서 미검증) / `codebase/backend/src/modules/model-config/model-config.service.spec.ts:970`(setDefault 순서 테스트만 존재, create/update isDefault:true 분기 미검증) | `create()`에 적용한 순서-테스트 패턴을 `update()`(schedules, triggers)와 `create()`/`update()`의 `isDefault: true` 경로(model-config)에도 동일 적용 |
| 3 | testing | 컨트롤러 → 서비스 `userId` 배선 검증이 4개 모듈에서 비일관적 — model-config 는 update/remove 만 검증(create/setDefault 는 검증 테스트 없음), triggers/workflows 는 create/update/remove(+duplicate) 위임 테스트 전무, schedules 는 컨트롤러 spec 파일 자체가 없음. 서비스 호출부(`this.xService.create(workspaceId, dto, userId)`)는 여전히 위치 인자라 같은 타입(string) 인자 스왑을 컴파일러가 못 잡는데, 이를 잡을 컨트롤러 유닛테스트도 e2e 도 다수 경로에서 부재. 실제 HTTP 요청→`audit_log.user_id` 일치를 검증하는 e2e 는 4개 모듈 전부 없음 | `model-config.controller.spec.ts`(create/setDefault 블록 없음) / `triggers.controller.spec.ts`·`workflows.controller.spec.ts`(create/update/remove/duplicate 위임 테스트 없음) / schedules 컨트롤러 spec 파일 부재 / `test/audit-logs.e2e-spec.ts`(RBAC 만 검증, CRUD→audit row 검증 없음) | model-config 의 update/remove 패턴(서비스 mock 에 전달된 userId 단언)을 나머지 경로에 확장. 4개 모듈 중 최소 1개 액션에 대해 실제 HTTP 요청→`audit_log` row `user_id` 일치를 검증하는 e2e 추가 |
| 4 | requirement | `SchedulesService`/`TriggersService` 상호 직접 쓰기(FK CASCADE 가 아닌 애플리케이션 코드가 명시 실행하는 두 번째 리소스의 INSERT/UPDATE/DELETE)가 상대 리소스의 CRUD 감사를 건너뛴다 — 모듈 docstring 은 "`schedule.*`/`trigger.*` CRUD 감사 기록"을 명시하지만 실제로는 편도만 기록됨. 직전 라운드(10_49_18 Warning #7)에서 이미 발견됐으나 RESOLUTION.md 조치/미조치 표 어느 쪽에도 흡수되지 않고 라운드 사이에서 유실됨 | `codebase/backend/src/modules/schedules/schedules.service.ts`(`create`/`update`/`remove` — `triggerRepository` 직접 조작, `trigger.*` 미기록) / `codebase/backend/src/modules/triggers/triggers.service.ts`(`syncScheduleActivation()` — `scheduleRepository.save` 직접 변경, `schedule.updated` 미기록) | (a) 의도된 설계(주 리소스만 기록)라면 `audit-action.const.ts`/spec 에 명문화, 또는 (b) 4개 지점에 상대측 감사 보강. 어느 쪽이든 `plan/in-progress/spec-sync-auth-gaps.md` 에 명시 등재해 재유실 방지 |
| 5 | requirement | `WorkflowsService.duplicate()` 가 `create()` 와 동일한 "트랜잭션 커밋 뒤 기록" 구조지만, 그 불변식(W6)을 고정하는 순서·롤백 회귀 테스트가 없다 — 현재 구현은 정확하나 향후 리팩터링이 순서를 되돌려도 어떤 테스트도 RED 로 걸리지 않는다. 직전 라운드(10_49_18 Warning #12)에서 이미 발견됐으나 RESOLUTION.md 에 흡수되지 않음 | `codebase/backend/src/modules/workflows/workflows.service.ts`(`duplicate()`) / `workflows.service.spec.ts`(`duplicate` describe — details 단언만 존재, 순서·롤백 미검증) | `create()` 의 순서 고정(`order: string[]`)·롤백 테스트 패턴을 `duplicate()` 에도 대칭 추가 |
| 6 | architecture | `recordAudit` private 헬퍼가 5개 서비스(기존 auth-configs 1 + 이번 신규 4)에 거의 동일한 형태로 중복 구현됨 — 이번 PR 로 "rule of three" 를 넘겼다. 다만 `RESOLUTION.md`(W4)가 "6번째 리소스 추가 시점에 팩토리화 검토"로 이미 명시적으로 유예를 결정했고, `details` 스키마가 도메인별로 갈리는 현재 상태에서 조기 추상화는 오히려 인터페이스를 어색하게 만들 수 있다는 판단(maintainability 재확인)도 여전히 유효함 | `model-config.service.ts:239-254`, `schedules.service.ts:141-154`, `triggers.service.ts:209-224`, `workflows.service.ts:174-189` (+ 기존 `auth-configs.service.ts:78-`) | 즉시 조치 불요(RESOLUTION W4 기 유예). 5번째 신규 리소스(예: `workflow.executed` 구현) 추가 시 공용 팩토리/베이스 클래스 추출 재검토 |
| 7 | api_contract | `AuditLogDto.action` 의 Swagger `description` 이 이번에 추가된 13개 신규 액션(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)을 반영하지 않아 stale — API 문서(및 이를 근거로 생성되는 클라이언트 SDK 문서)가 실제 응답 값 도메인을 과소 표기. 다만 같은 description 이 "DB 는 자유 문자열 컬럼이라 union 밖 값이 있을 수 있다"고 이미 경고해 런타임 파싱 실패로는 이어지지 않음 | `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:30-33` | description 목록에 신규 4개 리소스군 추가하거나, "SoT: `AUDIT_ACTIONS` const 참조"로 대체해 매번 갱신 부담 제거 |
| 8 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/1-auth.md §4.1`(Planned 표) · `spec/data-flow/1-audit.md §1.1`("여전히 미구현") · `spec/conventions/audit-actions.md §3`(상태 컬럼 "미구현") · `spec/2-navigation/2-trigger-list.md`(L182/L252, 액션명 자체도 오기 — `trigger.delete`/`trigger.update` 가 실제로는 `trigger.deleted`/`trigger.updated`) 4곳이 이번 PR 로 구현 완료된 13개 액션을 여전히 "Planned/미구현"으로 서술한다. 코드가 옳고 spec 표기만 낡은 상태(구현이 spec 을 개선/완결시켜 spec 이 뒤처짐) — `developer` 는 `spec/` read-only 라 이번 diff 로 고칠 수 없는 영역이며, 이미 `plan/in-progress/spec-sync-auth-gaps.md`(L18-22)에 "spec SoT 4곳 동기화 — planner 턴 필요"로 정확히 등재돼 있다 | `spec/5-system/1-auth.md §4.1` / `spec/data-flow/1-audit.md §1.1` / `spec/conventions/audit-actions.md §3` / `spec/2-navigation/2-trigger-list.md` L182,L252 | `project-planner` 턴에서 4곳을 한 커밋으로 동시 갱신(Planned→구현 이동, 커버리지 갭 문단 갱신, 상태 컬럼 갱신, 액션명 오기 정정). 이미 tracked — 새 착수 지시 아니라 재확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance / side_effect / database | 신규 `recordAudit` 삽입으로 13개 mutating 엔드포인트(create/update/remove/setDefault/duplicate)마다 응답 반환 전 동기 DB round-trip(INSERT) 1회가 추가됨. 반복문 밖 메서드당 1회 호출이라 N+1 은 아니며, 대상 테이블에 이미 복합 인덱스(`idx_audit_log_workspace_created`)가 있어 INSERT 자체는 가벼움 | `model-config.service.ts:284,337,385,402` / `schedules.service.ts` 3곳 / `triggers.service.ts` 3곳 / `workflows.service.ts` 4곳 | 즉각 조치 불요. p99 latency budget 이 빠듯해지면 fire-and-forget 큐잉(BullMQ) 전환 고려 |
| 2 | security | `TriggersService` 의 시크릿·토큰 회전/폐기 3개 메서드(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)에 대응하는 감사 액션 자체가 없어 "누가 회전/폐기했는가"가 기록되지 않음 — 동일 코드베이스의 `integration.rotated` 선례와 대비. 이번 PR 의 명시된 CRUD-only 스코프 밖(diff 미변경, 기존 갭) | `triggers.service.ts:894`(rotateNotificationSecret) / `:930`(revokePerTriggerToken) / `:975`(rotateBotToken) | 이번 PR 차단 사유 아님. 후속으로 별도 액션 상수 추가 검토 또는 스코프 결정을 `audit-action.const.ts`/spec 에 명문화 |
| 3 | security (재확인) | `TriggersController.rotateBotToken` 에 `@Roles` 데코레이터 부재 — `RolesGuard` default-allow 로 viewer 역할도 chat-channel bot token 회전 가능. 직전 두 라운드가 이미 발견, diff 범위 밖(이번 PR 회귀 아님) | `triggers.controller.ts:229-236` | 이번 PR 차단 사유 아님. 의도된 설계인지 확인 후 필요 시 `@Roles('editor')` 추가 |
| 4 | security / requirement (재확인) | FK CASCADE/애플리케이션 연쇄 삭제로 사라지는 자매 리소스(예: workflow 삭제 시 CASCADE 되는 trigger, trigger 삭제 시 CASCADE 되는 schedule)의 삭제 자체는 감사되지 않음 — 이전 라운드에서 이미 triage 됨, 새 회귀 아님. 인가(삭제 자체의 @Roles+IDOR 스코핑)는 정상 | `workflows.service.ts:254-263` / `triggers.service.ts:849-878` / `schedules.service.ts:264-279` | 조치 불요(이미 triage). "루트 액션만 감사"를 spec/const 에 명문화하는 것을 다음 라운드에서 검토 |
| 5 | security (재확인) | 동시 DELETE 요청 시 삭제 영향 행 수(`affected`) 미검증으로 동일 리소스에 중복 `*.deleted` 감사 행 생성 가능 — `RESOLUTION.md`(10_05_53 W7)가 "기존 auth-configs 패턴 4곳 복제, 5곳 함께 정리하는 별도 트랙"으로 이미 이월 결정 | `model-config.service.ts:394-409` / `schedules.service.ts:264-279` / `triggers.service.ts:849-878` / `workflows.service.ts:254-263` | 조치 불요(이미 별도 트랙 이월). 착수 시 `DeleteResult.affected>=1` 가드로 5곳 일괄 정리 |
| 6 | security / performance / database (재확인) | `AuditLogsService.record()` 가 실패를 삼키는 fail-open 설계이며(`try/catch`+`logger.warn`), `audit_log` 테이블에 보존 정책/pruner 가 없어 무제한 성장 — 이번 PR 로 13개 저빈도 CRUD 액션이 이 경로에 추가로 몰림. 이미 코드 주석·이전 라운드에서 인지·수용된 기존 트레이드오프 | `audit-logs.service.ts:72-97` / `audit-action.const.ts:32-43`(`workflow.executed` 는 카디널리티 이유로 의도적 제외) | 조치 불요(의도된 설계, 이미 추적 중). 신뢰도 요구 강화 시 `record()` 실패 메트릭/알람 승격, 보존 정책(pruner) 선결 검토 |
| 7 | performance | `triggers.service.ts` create/update — `recordAudit` 와 서로 독립적인 `normalizeNotificationSecretRef` 호출이 불필요하게 순차 실행됨(둘 다 서로의 완료에 의존하지 않음) | `triggers.service.ts:262-270`(create), `:344-351`(update) | `Promise.all([recordAudit(...), normalizeNotificationSecretRef(saved)])` 로 병렬화 검토(마이크로 최적화, 우선순위 낮음) |
| 8 | architecture | `recordAudit` 의 `action` 파라미터 타입이 리소스별로 좁혀지지 않고 `AUDIT_ACTIONS` 전체 유니온을 받음 — named-params 로 "포지셔널 스왑 방지"를 노렸으나 `action`↔`resourceType` 불일치는 같은 타입 시스템으로 방어되지 않음(현재 호출부는 전부 정상, 활성 버그 아님) | `model-config.service.ts:242` / `schedules.service.ts:144` / `triggers.service.ts:212` / `workflows.service.ts:177` | 모듈별 액션 서브셋으로 타입 좁히기 검토(예: `Extract<AuditAction, \`model_config.${string}\`>`) |
| 9 | maintainability | `WorkflowsService.create()` 의 `userId` 파라미터 위치(가운데)가 같은 클래스의 `update`/`remove`/`duplicate`(마지막)와 다름 — 기존 `createdBy` 이유로 이전부터 이 위치였고 이번 PR 이 새로 만든 게 아니나, 나머지 3개 메서드가 "userId 마지막" 규약으로 통일되며 비대칭이 부각됨. `dto`/`userId` 타입이 달라 스왑해도 컴파일 에러로 잡혀 기능 위험은 낮음 | `workflows.service.ts:191-194`(create) vs `:229-233,:254,:277-280`(update/remove/duplicate) | 급하지 않음. 다음에 시그니처를 만질 기회에 통일 |
| 10 | maintainability | `@CurrentUser` 사용자 추출 관용구(`@CurrentUser('sub') userId: string` vs `@CurrentUser() user: JwtPayload` + `.sub`)가 `schedules.controller.ts`/`workflows.controller.ts` **파일 내부**에서 혼재 — 두 스타일 모두 코드베이스 전역에 이미 존재하나 같은 파일 안에 공존하는 것은 이번 PR 이 처음 | `schedules.controller.ts:153,203,224` vs `:179` / `workflows.controller.ts:185,206` vs 기존 8곳 | 차단 사유 아님. 여유 있을 때 파일 내 하나로 통일 |
| 11 | maintainability | 4개 신규 서비스가 이미 export 된 `AuditAction` 타입 별칭 대신 `(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 인라인 매핑을 재작성 — 런타임/타입체크 결과 차이 없음 | `model-config.service.ts:242` / `schedules.service.ts:144` / `triggers.service.ts:212` / `workflows.service.ts:177` | 급하지 않음. 다음에 손댈 때 `AuditAction` import 로 축약 |
| 12 | scope | `WorkflowsService.duplicate()` 의 `return this.dataSource.transaction(...)` → `const duplicated = await ...` 전환이 Prettier 재들여쓰기(약 90줄)를 유발해 diff 가 246줄로 부풀려 보임 — `git diff -b` 대조 결과 실질 변경은 `recordAudit` 삽입뿐, 콜백 내부 로직은 문자 그대로 동일. 감사를 커밋 후 남기기 위한 불가피한 부작용 | `workflows.service.ts:294-394` | 조치 불요. 리뷰 시 `git diff -b` 병행 권장 |
| 13 | requirement | `SchedulesService.create()` 는 Trigger row 생성과 Schedule row 생성이 하나의 DB 트랜잭션으로 묶여 있지 않음 — 두 번째 저장 실패 시 감사 기록 없는 고아 Trigger row 가 남을 수 있음. 이번 diff 는 기존 2단계 비-트랜잭션 구조에 시그니처·감사 호출만 추가했을 뿐(사전 존재, 회귀 아님) | `schedules.service.ts`(`create()`) | 조치 불요(범위 밖). 후속으로 `dataSource.transaction()` 통합 리팩터링 고려(`WorkflowsService.create()` 가 선례) |
| 14 | side_effect / api_contract | `userId` 파라미터 필수화(4개 서비스 13개 메서드)와 `AuditLogsModule` 신규 import(4곳)의 파급을 콜러그래프 전수 조사(`grep`)·`tsc --noEmit` 대조로 검증 — 호출자는 각 컨트롤러뿐이며 HTTP 요청/응답 계약(바디·헤더·상태코드) 변경 없음(userId 는 JWT 유래), 새로운 순환 의존도 없음(`AuditLogsModule` 은 leaf 모듈) | `*.controller.ts`(4개) / `*.module.ts`(4개) | 조치 불요 — 확인 목적의 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | Critical #1(W6 순서 위반, schedule 경로 미검증) 직접 특정 + W6 순서 테스트 패턴이 create()에만 있는 구조적 갭 + userId 배선 검증/e2e 부재 |
| architecture | MEDIUM | 동일 W6 순서 위반(WARNING) + importWorkflow 감사 누락 + recordAudit 헬퍼 중복(DRY) |
| requirement | LOW | Schedule↔Trigger 상호쓰기 편도 감사 + duplicate() 회귀 테스트 부재 + SPEC-DRIFT 4곳(이미 추적 중) |
| database | LOW | 동일 W6 순서 위반(WARNING) + audit_log 무제한 보존(기존 트레이드오프) + importWorkflow 갭(INFO) |
| security | LOW | 신규 취약점 없음(인젝션/인증우회/시크릿노출/RBAC 회귀 0건) — INFO 5건 전부 재확인/기존 갭 |
| performance | LOW | 신규 DB round-trip 1회/mutation(구조적 결함 아님) + triggers 병렬화 여지(마이크로 최적화) |
| side_effect | LOW | 시그니처 변경·recordAudit 추가 파급 전수 검증, 위험한 부작용 없음 |
| maintainability | LOW | 새 CRITICAL/WARNING 없음 — 파라미터 위치·관용구 혼재 등 사소한 일관성 항목만(대부분 재조치 불요로 이미 유예) |
| api_contract | LOW | breaking change 없음. Swagger action 설명 stale(WARNING 1건)만 |
| scope | NONE | 19개 파일 diff 전량이 목적(감사 로깅 커버리지)과 정확히 대응, 의도 밖 변경 0건 |
| concurrency | NONE | 경쟁조건·데드락·await 누락·원자성 위반 0건 |

## 발견 없는 에이전트

- concurrency (검토 범위 내 발견사항 0건 — 위험도 NONE)

## 권장 조치사항

1. **(Critical)** `TriggersService.update()` 에서 `recordAudit()` 호출을 `syncScheduleActivation()` 호출보다 앞으로 옮기거나, 후자 내부 BullMQ 호출을 감사 기록 뒤로 재배치. "schedule 타입 + isActive 변경 + registerJob 실패" 시나리오를 고정하는 순서 회귀 테스트 추가.
2. `WorkflowsService.importWorkflow()` 의 감사 기록 부재가 의도인지 확정 — 의도라면 회귀 테스트로 명문화, 누락이라면 `WORKFLOW_CREATED` 기록 추가.
3. "W6 순서 고정" 테스트 패턴을 `update()`(schedules/triggers)와 model-config `create()`/`update()`의 `isDefault: true` 분기에도 동일 적용 — Critical #1 이 지적한 사각지대를 구조적으로 닫는다.
4. 컨트롤러→서비스 `userId` 배선 검증(단위)과 최소 1개 e2e(`audit_log.user_id` 실측)를 4개 모듈에 일관되게 추가.
5. Schedule↔Trigger 상호 직접 쓰기의 편도 감사 갭을 spec 명문화 또는 코드 보강으로 해소하고 `plan/in-progress/spec-sync-auth-gaps.md` 에 등재(라운드 간 유실 방지).
6. `WorkflowsService.duplicate()` 에 순서·롤백 회귀 테스트 추가.
7. `AuditLogDto.action` Swagger 설명에 신규 13개 액션 반영.
8. spec SoT 4곳([SPEC-DRIFT])을 `project-planner` 턴에서 한 커밋으로 동기화 — 이미 `plan/in-progress/spec-sync-auth-gaps.md` 에 대기 중.
9. (급하지 않음) `recordAudit` 헬퍼 중복(5곳)은 RESOLUTION W4 결정대로 6번째 리소스 추가 시점에 팩토리화 재검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, database, concurrency, api_contract` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (6명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | documentation | 라우터 판단(이번 diff 는 코드 전용 변경, 문서 산출물 스코프 밖 — 세부 사유 미제공) |
  | dependency | 라우터 판단(신규/변경 의존성 0건 — 세부 사유 미제공) |
  | user_guide_sync | 라우터 판단(사용자 가이드 영향 없음 — 세부 사유 미제공) |