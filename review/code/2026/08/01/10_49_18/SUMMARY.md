# Code Review 통합 보고서

## 검토 컨텍스트

audit-logging 브랜치(`model-config`/`schedules`/`triggers`/`workflows` 4개 모듈에 CRUD 감사 로깅 도입)의
**2차/조치 라운드** 리뷰다. 1차 라운드(`review/code/2026/08/01/10_05_53`, risk HIGH — Critical 2·Warning 11)
이후 조치 커밋 2개(`f77c1e0de` C1, `a92f53df6` C2·W5·W6·W9·W10·W2)가 반영된 현재 HEAD 를 11개 reviewer 가
독립적으로 fresh 재검토했다. 대부분의 reviewer가 1차 라운드 지적사항이 실제로 해소됐음을 소스 레벨에서
재확인했으나, 이번 라운드 자체가 새로 만든 결함(아래 Critical #1)과 잔존/신규 Warning 다수가 발견됐다.

## 전체 위험도

**HIGH** — 신규 보안·데이터 무결성 취약점은 없으나(RBAC/IDOR/SQLi 회귀 없음, 신규 의존성 0건), (1) 이번
조치 라운드 자신이 만든 CRITICAL 1건(`schedules.service.spec.ts` 신규 테스트의 import 누락으로 `tsc` 신규
오류 — RESOLUTION.md의 "tsc 오류 0건" 자체 검증 주장과 상충하며, 이 PR 이 이미 한 번 CRITICAL 로 판정·수정한
것과 동일한 결함 클래스의 재발), (2) `[SPEC-DRIFT]` 로 태깅된 spec 4곳의 구현-후 미동기화, (3) 동시 삭제 시
중복 감사 행 생성 가능성(WARNING 재론), (4) `RESOLUTION.md`의 사실 오류(존재하지 않는 커밋 해시 인용) 등
"감사 추적 기능 자신의 신뢰성"에 관한 실질적 Warning 다수가 겹쳐 HIGH 로 판정한다. 프로덕션 런타임을 즉시
깨뜨리는 항목은 없다(전 테스트 스위트 GREEN 실측, 배포 스코프 `tsc --noEmit -p tsconfig.build.json` clean).

**forced(router_safety) 대상 7개 reviewer(documentation, maintainability, requirement, scope, security,
side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.** 11개 reviewer 전원이 최소 1건
이상(WARNING 또는 INFO)을 발견했으며 "재시도 필요" 항목은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `schedules.service.spec.ts` 신규 감사 로깅 테스트(`24d0db60a`)가 `UpdateScheduleDto` 를 import 없이 `as unknown as UpdateScheduleDto` 로 참조 — `tsc --noEmit -p tsconfig.json` 신규 오류(`TS2552`) 발생을 직접 실측 재현. `jest`(`isolatedModules`)와 `pnpm build`(`tsconfig.build.json` 이 `*spec.ts` exclude) 어느 게이트도 못 잡음. `RESOLUTION.md`의 "내 변경이 만든 tsc 오류 0건" 자체 검증 주장과 상충하며, 이 PR 이 C1 에서 이미 한 번 CRITICAL 로 판정·수정한 것과 동일한 결함 클래스(spec 파일의 타입 안전망 훼손)가 그 수정 대상이 아니었던 신규 블록에서 재발한 것 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:301`(참조부), import 블록 `:1-11`(`UpdateScheduleDto` 부재) | `import { UpdateScheduleDto } from './dto/update-schedule.dto';` 한 줄 추가. `RESOLUTION.md:9`의 해시 오류(아래 Warning #4)와 함께 정정 권장. *(side_effect 리뷰어는 이 사실관계를 CRITICAL로, requirement 리뷰어는 동일 사실관계를 WARNING으로 각각 독립 판정 — 자체 검증 문서 신뢰성 훼손 + 동일 결함 클래스 재발이라는 근거로 본 요약은 높은 쪽을 채택)* |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | 아키텍처 | 4개 서비스의 `recordAudit(params)` 헬퍼에서 `action` 파라미터 타입이 자신의 리소스로 좁혀지지 않고 시스템 전체 33개 액션의 union 을 그대로 받음 — 엉뚱한 리소스의 액션 상수를 복붙해도 컴파일이 통과한다. 현재 13개 신규 호출부는 전부 정확하지만(활성 버그 아님), `auth-configs.service.ts` 선례를 5곳으로 확장하며 표면적도 함께 넓어짐 | `model-config.service.ts:242`, `schedules.service.ts:144`, `triggers.service.ts:212`, `workflows.service.ts:177` (비교: `auth-configs.service.ts:79`) | 서비스별 액션 타입을 좁힘(템플릿 리터럴 타입 `Extract<AuditAction, \`trigger.${string}\`>` 또는 리터럴 union). 5곳(auth-configs 포함) 한 번에 정리 권장 |
| 3 | SPEC-DRIFT | `[SPEC-DRIFT]` spec 4곳이 이번에 구현 완료된 CRUD 감사 액션들을 여전히 "Planned/미구현"으로 서술 — 코드가 옳고 spec 표기가 낡음. `audit-action.const.ts` 자신의 SoT 주석("§4.1 '구현된 액션' 표")과도 상충. `2-trigger-list.md` 는 한 걸음 더 나아가 액션명 자체가 오기(`trigger.delete`/`trigger.update` — 실제는 과거분사 `trigger.deleted`/`trigger.updated`) | `spec/5-system/1-auth.md:414-438`(Planned 표에 잔류) · `spec/data-flow/1-audit.md:40,82-92`("여전히 미구현" 서술, Writer 카운트 stale) · `spec/conventions/audit-actions.md:56-59`(상태 컬럼 "미구현") · `spec/2-navigation/2-trigger-list.md:182,252`(액션명 오기) | (project-planner 턴) 4곳 동시 동기화 — Planned→구현 이동(`workflow.executed`만 Planned 잔류), 커버리지 갭 문단·Writer 표 갱신, 상태 컬럼 정정, 액션명 오기 정정. `plan/in-progress/spec-sync-auth-gaps.md:38-42`에 이미 정확히 큐잉됨(developer 권한 밖, 코드 변경 불요) |
| 4 | 문서화 | `plan/in-progress/spec-sync-auth-gaps.md` §4.1 항목이 새로 삽입한 "**CRUD 13개 구현 완료(2026-08-01)**." 문장 바로 뒤에 옛 본문("...액션이 미구현. 실측: ... import **0건**.")을 그대로 남겨 한 문단이 자기모순됨. "import 0건" 주장은 현재 시점 기준 사실이 아님(4개 모듈 모두 `AuditLogsModule` import 확인) | `plan/in-progress/spec-sync-auth-gaps.md:15-17` | 옛 실측 문장을 과거 시제/이력 표기로 전환하거나 삭제 — 완료 서술과 원래 갭 설명이 한 문단에서 충돌하지 않게 정리 |
| 5 | 문서화 | `RESOLUTION.md` 가 C1 조치 커밋으로 저장소에 존재하지 않는 해시(`2a1f8c1`)를 인용 — `git log --all --oneline` 매치 0건. 서술 내용 자체(70곳 userId 추가, 잔여 20건 등)는 실제 커밋 `f77c1e0de`의 메시지와 정확히 일치하나 해시만 오기. 감사 추적 문서 자신의 근거가 재현 불가능해짐(`git show <hash>` 불가) | `review/code/2026/08/01/10_05_53/RESOLUTION.md:9`(C1 행) | `2a1f8c1` → `f77c1e0de` 로 정정. 향후 RESOLUTION 작성 시 `git rev-parse --short HEAD` 로 커밋 직후 재확인 권장 |
| 6 | 스코프 | 감사 로깅과 무관한 `notification-config.dto.ts`의 타입 단언 제거 hunk(`@IsIn(... as unknown as string[], ...)` → `@IsIn(..., ...)`)가 `65087584b`("style: eslint --fix") 커밋에 섞여 유입된 문제가 1차 라운드(W11)에서 이미 지적됐음에도, 이번 두 조치 커밋 어느 쪽도 손대지 않았고 `RESOLUTION.md`/`plan/` 어디에도 "의도적으로 보류"라는 근거가 기록되지 않은 채 추적에서 완전히 누락됨. 런타임 위험은 없음(순수 타입 단언 제거) | `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:105` | 이번 라운드에서 (a) hunk 되돌리기/별도 커밋 분리 또는 (b) `RESOLUTION.md` "미조치 — 근거" 표에 명시적으로 등재해 의도적 이월 근거를 남길 것 |
| 7 | 부작용 | `SchedulesService`↔`TriggersService`가 서로의 리포지토리에 직접 접근해(상대의 `recordAudit`를 거치지 않고) 상대 테이블 row 를 생성·수정·삭제 — 어느 엔드포인트로 조작했는지에 따라 감사 기록 유무가 갈리는 비일관성. 스케줄 생성 시 연결 Trigger row 신규 INSERT 되지만 `trigger.created` 없음, 스케줄 이름/활성여부 변경 시 `Trigger.name/isActive`도 바뀌지만 `trigger.updated` 없음, 반대로 트리거의 `isActive` 변경이 `Schedule.isActive`를 갱신해도 `schedule.updated` 없음, `SchedulesService.remove()`의 `Trigger` 직접 삭제도 `trigger.deleted` 없음(FK CASCADE 삭제 공백보다 넓은 범위 — create/update 포함) | `schedules.service.ts:162-170`(create)·`:213-223`(update)·`:270`(remove) / `triggers.service.ts:339,827-846`(syncScheduleActivation)·`:870`(remove, CASCADE) | 의도된 설계(1:1 결합 리소스는 한쪽만 기록)라면 `audit-action.const.ts`/`spec/data-flow/1-audit.md`에 명문화. 아니라면 상대측 `recordAudit`(또는 `details` 부기) 호출 보강 검토 |
| 8 | 데이터베이스/동시성 | 4개 서비스 `remove()` 모두 `find→remove→recordAudit` 패턴이며 삭제 실제 발생 여부(`affected` row 수)를 검증하지 않음 — 동시 DELETE 요청(더블클릭·재시도) 시 동일 리소스에 대해 중복 `*.deleted` 감사 행이 생길 수 있음. `AuditLog`는 append-only 라 유니크 제약도 없음. 근본 패턴은 기존 `auth-configs.service.ts`를 답습한 것(회귀 아님)이나, 이번 PR 이 4곳의 신규 관측 가능한 진입점을 새로 열었음 | `model-config.service.ts:394-409`, `schedules.service.ts:264-279`, `triggers.service.ts:849-878`, `workflows.service.ts:254-263` | `Repository.remove()` 대신 `delete()`/`manager.delete()` + `DeleteResult.affected>=1` 가드로 5곳(신규 4+기존 auth-configs) 공통 정리. *(security 리뷰어는 1차 라운드 RESOLUTION.md W7 의 의도적 이월 결정을 타당하다고 수용해 INFO 로 하향 평가한 반면, database·concurrency 리뷰어는 독립적으로 "이번 PR 이 관측 가능성을 새로 열었다"는 근거로 WARNING 유지를 주장 — 판단이 갈리므로 상위 심각도를 채택)* |
| 9 | 요구사항/테스트 | `triggers`/`schedules`는 W6("커밋 직후 기록") 불변식을 코드로는 올바르게 구현했지만(직접 추적 확인), `model-config`/`workflows`(둘 다 `order: string[]` 순서 고정 테스트 보유)와 달리 그 순서를 고정하는 회귀 테스트가 없음 — 향후 리팩터링이 `recordAudit`를 `normalizeNotificationSecretRef`/`registerJob` 등 외부 호출 뒤로 되돌려도(정확히 이번 PR이 고친 W6 버그의 재발) 현재 테스트는 GREEN 으로 남는다 | `triggers.service.spec.ts`(`감사 로깅 (trigger.*)` describe, 순서 미검증) · `schedules.service.spec.ts`(동일) — 대조군 `model-config.service.spec.ts`/`workflows.service.spec.ts`(order 배열 단언 보유) | model-config/workflows 와 동일한 `order: string[]` 패턴으로 triggers create/update, schedules create/update 순서 테스트 추가 |
| 10 | 요구사항/테스트 | 4개 컨트롤러 13개 엔드포인트 중 컨트롤러 레벨에서 `userId` 전달(스왑 방지)을 실제로 단언하는 것은 `model-config.controller.spec.ts`의 update/remove 2곳뿐 — create/setDefault 는 model-config 에서도 미검증, `schedules.controller.spec.ts` 자체 부재, `triggers`/`workflows` controller spec 은 신규 `userId` 파라미터를 전혀 검증 안 함. 실제 코드는 13곳 전부 정확함을 직접 대조 확인(활성 버그 아님) | `model-config.controller.spec.ts:166-207`(update/remove만) / `triggers.controller.spec.ts`(rotateBotToken만) / `workflows.controller.spec.ts`(delegation 테스트 0건) / `schedules.controller.spec.ts`(부재) | 낮은 우선순위(plan W8 로 이미 추적). model-config create/setDefault 보강, `schedules.controller.spec.ts` 신설, triggers/workflows delegation 테스트 추가 |
| 11 | 테스트 | `TriggersService.create/update`의 `chatChannel` 분기 존재 시 `recordAudit` 이중 호출(1차 라운드 W5 실버그) 회귀를 잡을 테스트가 없음 — `auditLogs.record` 를 단언하는 3개 테스트 전부 `chatChannel` 없는 입력만 쓰고, `toHaveBeenCalledTimes` 단언도 없음(자매 모듈 `model-config`만 호출 횟수를 명시적으로 잠금) | `triggers.service.spec.ts:2245-2336`(감사 로깅 describe) / 대응 코드 `triggers.service.ts:226-284`(create, chatChannel 분기 `273-282`)·`:286-364`(update, `353-362`) | `chatChannel` 포함 create/update 케이스 추가 + `expect(auditLogs.record).toHaveBeenCalledTimes(1)` 단언(model-config 패턴 재사용) |
| 12 | 테스트 | `workflows.service.duplicate()`는 `create()`와 동일한 "트랜잭션 커밋 후 기록" 구조를 갖지만, `create()`에만 순서 고정·롤백 테스트가 있고 `duplicate()`는 없음(비대칭) — `create()`용 mock override 를 그대로 재사용하면 isolation-level 2-인자 시그니처 처리 미비로 `TypeError` 나는 함정도 확인 | `workflows.service.spec.ts:732-742`(duplicate, 순서 미검증) / `:798-847`(create 전용 순서·롤백 테스트) / 대응 코드 `workflows.service.ts:277-405`(`recordAudit` 호출 `397-403`) | `create()`의 순서 고정·롤백 테스트를 `duplicate()`에도 대칭 추가. override 작성 시 기본 `mockDataSource`와 동일하게 isolation-level 인자 흡수하도록 처리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | FK CASCADE 연쇄 삭제(Workflow→Trigger, Trigger→Schedule)로 사라지는 자매 리소스는 그 삭제 자체가 감사되지 않음 — 기존 architecture INFO#3(1차 라운드)와 동일 갭, 새 회귀 아님 | `workflows.service.ts:254-263`(remove) · `triggers.service.ts:849-878`(remove, 주석이 CASCADE 자체를 인지) · `schedules.service.ts:264-279`(remove) | 조치 불요. `audit-action.const.ts`/spec 에 "루트 액션만 감사, 자매 리소스 별도 기록 안 함" 명문화 검토 |
| 2 | 보안/성능/데이터베이스 | 감사 sink(`AuditLogsService.record()`)가 실패를 `try/catch`로 삼키고(fail-open) `audit_log`는 보존 정책(pruner) 없이 무제한 증가, `action`/`resource_type`/`user_id` 필터 전용 인덱스도 없음(`(workspace_id, created_at DESC)` 복합 인덱스만 존재) — 기존에 이미 알려진 트레이드오프이며 이번 PR로 쓰기 소스가 4곳(13개 액션) 확대되어 체감 시점만 앞당겨짐. `workflow.executed`(고빈도)는 바로 이 이유로 의도적으로 범위 제외됨 | `audit-logs.service.ts:80-96`(record) · `audit-action.const.ts:32-44`(자체 인지 주석) · `migrations/V002__indexes.sql:33` | 조치 불요(설계상 인지된 트레이드오프). 후속으로 조회 성능 실측 저하 시 보조 인덱스 또는 pruner 도입 검토 |
| 3 | 보안 | `TriggersController.rotateBotToken`에 `@Roles` 데코레이터 부재 — `RolesGuard` default-allow 로 viewer 도 chat-channel bot token 회전 가능. diff 범위 밖(이번 PR 이 만든 회귀 아님), 1차 라운드에서 이미 동일 발견 | `triggers.controller.ts:229-240` | 이번 PR 차단 사유 아님. 의도된 설계인지 확인 후 필요 시 `@Roles('editor')` 추가 검토 |
| 4 | 성능 | `recordAudit` 호출 14곳 모두 요청당 직렬 DB round-trip 1회 추가(N+1 아님, 반복문 밖 확인) — 기존에 이미 INFO 로 추적, 이번 diff 로 악화 없음 | model-config/schedules/triggers/workflows 4개 서비스 14개 호출부 전수 | 조치 불요. 레이턴시 실측 문제화 시 비동기 큐 위임 검토(현재 설계 목표와 트레이드오프) |
| 5 | 성능 | W5 조치("중복 호출 통합")는 실제로는 상호배타적 분기(`if(refreshed){...return;} ... recordAudit()`)라 조치 전에도 요청당 항상 1회만 호출됐음 — `RESOLUTION.md`의 "2회→1회" 서술이 "런타임 중복 INSERT 버그 수정"으로 오독될 소지. 코드 조치 자체(소스 중복 통합)는 유지보수성 개선으로 유효 | `triggers.service.ts` create/update, 대조: `git diff 65087584b a92f53df6` | 조치 불요(코드는 정상). `RESOLUTION.md` 서술을 "소스 중복 1곳→1곳 통합, 런타임 호출 횟수는 조치 전후 동일"로 표현 정정 권장 |
| 6 | 아키텍처 | 신규 mutating 메서드 추가 시 `recordAudit` 호출을 강제하는 구조적 장치(데코레이터/인터셉터 등)가 없어 전적으로 수동 규율에 의존 — `WorkflowsService.saveCanvas`/`importWorkflow` 커버리지 누락이 실례(1차 라운드 발견, 현재 의도적 범위 제외로 추적 중) | 4개 서비스의 create/update/remove(+setDefault/duplicate) 전체 | 조치 불요. 6번째 리소스 추가 시점에 `recordAudit` 공통화 논의와 함께 데코레이터/인터셉터 방식 저울질 권장 |
| 7 | 아키텍처 | `AuditLogsService`가 read(`findAll`)/write(`record`)를 한 클래스로 노출 — 5개 소비 서비스는 `record()`만 필요. 코드베이스 전반이 인터페이스 기반 DI 를 쓰지 않는 일관된 스타일이라 실질 위험 낮음 | `audit-logs.service.ts:18(findAll)·72(record)` | 조치 불요. 코드베이스가 인터페이스 기반 DI로 전환하는 시점에 함께 고려 |
| 8 | 요구사항 | `workflow.updated` 감사가 `saveCanvas`/`importWorkflow`/`restoreVersion`(캔버스 편집, 가장 흔한 변경 경로)에는 미적용되고 `PATCH /workflows/:id`(이름/설정 변경, 상대적으로 드묾)에만 적용 — spec §4.1이 세부 트리거 지점을 특정하지 않아 spec 위반은 아니나, 감사 로그 본연의 목적과는 비대칭. 이미 plan(W3)에 후속 등재됨 | `workflows.service.ts` `saveCanvas()`(:578-640)·`importWorkflow()`(:451-576)·`restoreVersion()`(:642-686) — recordAudit 없음. `update()`(:229-252)만 기록 | 조치 불요(이미 plan 후속 항목). 다음 라운드에서 커버 여부 결정 시 카디널리티·pruner 부재 함께 고려 |
| 9 | 유지보수성 | `WorkflowsService.create(workspaceId, userId, dto)`만 `userId`가 가운데 위치, 같은 클래스의 `update`/`remove`/`duplicate`(전부 마지막) 및 인용 선례 `auth-configs.service.ts`(payload 바로 뒤 일관)와 위치가 다름. `create` 시그니처 자체는 이번 diff 가 만든 게 아니며, 인접 타입(dto vs userId)이 달라 스왑 위험은 낮음 | `workflows.service.ts:191-195`(create) vs `:229-234,254,277-281`(나머지 3개) | 급하지 않음. 다음에 `create()` 시그니처를 만질 기회에 `(workspaceId, dto, userId)`로 통일 검토 |
| 10 | 유지보수성 | `recordAudit()` named-param 래퍼 뼈대(resourceType 고정+named-param+순서-스왑 방지 주석)가 5개 서비스(기존 auth-configs 1+이번 4)에 손으로 반복 — 1차 라운드에서 이미 지적(W4)되었고 "6번째 리소스 추가 시점에 팩토리화 검토"로 의도적으로 유예됨. 현재 4개 구현의 `details` 셰이프가 도메인별로 달라 조기 추상화 시 오히려 어색해진다는 판단은 여전히 타당 | `model-config.service.ts:239-254`, `schedules.service.ts:141-154`, `triggers.service.ts:209-224`, `workflows.service.ts:174-189` | 재조치 불요 — 5번째 리소스 추가 시점에 재검토 |
| 11 | 유지보수성 | 4개 서비스 모두 이미 export 된 `AuditAction` 타입 별칭(`audit-action.const.ts:83`) 대신 동일 인라인 매핑 타입(`(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]`)을 재작성 — 1차 라운드부터 지적된 INFO, 기능 차이 없음 | `model-config.service.ts:242`, `schedules.service.ts:144`, `triggers.service.ts:212`, `workflows.service.ts:177` | 급하지 않음. 다음에 블록을 손댈 때 `action: AuditAction;`로 축약 |
| 12 | 데이터베이스 | `schedules.service.ts` `create()`의 Trigger→Schedule 2단계 INSERT(`triggerRepository.save` → `scheduleRepository.save`)가 트랜잭션으로 묶여있지 않음(pre-existing, 이번 diff 는 시그니처·감사 호출만 추가) — 두 번째 저장 실패 시 첫 번째 Trigger row 가 고아로 남을 수 있음 | `schedules.service.ts:156-202`(create) | 이번 PR 범위 밖. 후속으로 `dataSource.transaction()` 으로 두 저장 묶기 검토(`workflows.service.ts` create() 가 선례 제공) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 보안 취약점 없음. FK CASCADE 미감사·동시삭제 중복(W7 이월 수용)·sink 실패삼킴 전부 INFO로 하향, 기존에 triage 된 갭 재확인 |
| performance | LOW | N+1 없음, 새 성능 결함 없음. W5 조치 서술("2회→1회")이 실제 런타임 변화 없다는 점 INFO로 정정 권고 |
| architecture | LOW | `recordAudit` action 타입 미좁힘(WARNING #2), 구조적 강제장치 부재·인터페이스 미분리는 INFO |
| requirement | LOW | UpdateScheduleDto import 누락(WARNING, side_effect는 CRITICAL), [SPEC-DRIFT] spec 4곳(WARNING #3), W6 회귀테스트 부재(WARNING #9), 컨트롤러 userId 비일관(WARNING #10) |
| scope | LOW | notification-config.dto.ts 무관 hunk 2라운드째 미추적(WARNING #6) — 유일 발견 |
| side_effect | HIGH | UpdateScheduleDto import 누락을 CRITICAL로 판정(#1) + Schedule↔Trigger 상호쓰기 감사 사각지대(WARNING #7) |
| maintainability | LOW | 1차 라운드 WARNING 2건(죽은 코드·이중호출) 해소 재확인. 신규는 전부 INFO(userId 위치·헬퍼 반복·타입 별칭) |
| testing | LOW | triggers 이중호출 회귀테스트 부재(WARNING #11), workflows.duplicate() 순서/롤백 테스트 비대칭(WARNING #12) |
| documentation | MEDIUM | spec SoT 4곳 미동기화(WARNING #3, [SPEC-DRIFT]) + 이번 라운드 자신이 만든 문서결함 2건: plan 자기모순(#4)·RESOLUTION.md 잘못된 커밋 해시(#5) |
| database | MEDIUM | 동시 DELETE 중복 감사행(WARNING #8) — WARNING 유지 주장. 필터 인덱스 부재·schedules 비트랜잭션 2단계 INSERT는 INFO |
| concurrency | MEDIUM | 동시 DELETE 중복 감사행(WARNING #8, database와 동일 이슈) — RESOLUTION.md W7 의 이월 결정에 대해 "관측가능성을 이번 PR이 새로 열었다"는 근거로 명시적 재반박 |

## 발견 없는 에이전트

해당 없음 — 11개 에이전트 전원이 최소 1건 이상(WARNING 또는 INFO)을 발견함. "문제 없음"만 보고한 에이전트는 없음.

## 권장 조치사항

1. `schedules.service.spec.ts`에 `import { UpdateScheduleDto } from './dto/update-schedule.dto';` 한 줄 추가(Critical #1 — tsc 오류 해소, RESOLUTION.md 자체검증 신뢰성 복구)
2. `review/code/2026/08/01/10_05_53/RESOLUTION.md:9`의 커밋 해시 `2a1f8c1` → `f77c1e0de` 정정(Warning #5)
3. `plan/in-progress/spec-sync-auth-gaps.md:15-17`의 자기모순 문장 정리 — "구현 완료"와 옛 "미구현...0건" 서술 충돌 해소(Warning #4)
4. (project-planner 턴) spec 4곳 `[SPEC-DRIFT]` 동기화 — `1-auth.md §4.1`, `data-flow/1-audit.md §1.1`, `conventions/audit-actions.md §3`, `2-navigation/2-trigger-list.md` 액션명 오기(Warning #3) — `plan/in-progress/spec-sync-auth-gaps.md`에 이미 큐잉됨
5. `notification-config.dto.ts` 무관 hunk를 되돌리거나 `RESOLUTION.md`에 명시적 이월 근거 기록(Warning #6) — 3번째 라운드 재발 방지
6. 4개 서비스 `remove()`에 `DeleteResult.affected>=1` 가드 추가(동시 삭제 중복 감사 방지, Warning #8) — auth-configs 포함 5곳 공통 헬퍼 권장
7. `SchedulesService`/`TriggersService` 상호 직접 쓰기 시 상대 리소스 `recordAudit` 호출 보강 또는 "1:1 결합 리소스는 한쪽만 기록" 설계 의도 명문화(Warning #7)
8. 회귀 테스트 보강 3종: triggers `chatChannel` 이중호출 방지(Warning #11), `workflows.duplicate()` 트랜잭션 순서/롤백(Warning #12), triggers/schedules W6 순서 고정(Warning #9)
9. `recordAudit`의 `action` 파라미터 타입을 서비스별로 좁히기(Warning #2) — 템플릿 리터럴 타입 또는 리터럴 union, 5곳 일괄 정리
10. 컨트롤러 레벨 `userId` 배선 테스트 보강(Warning #10, 낮은 우선순위 — 이미 plan W8 추적 중)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | prompt 에 개별 사유 텍스트 미첨부. 실측 근거(교차확인): `package.json`/`pnpm-lock.yaml` diff 0건, 신규 서드파티 의존성 없음(security·scope 리뷰어가 각각 재확인) |
  | api_contract | prompt 에 개별 사유 텍스트 미첨부. 실측 근거(교차확인): 외부 API 응답 스키마·Swagger 데코레이터 무변경, 신규 `userId`는 JWT-derived 값이라 요청/응답 바디에 노출되지 않음(documentation·side_effect 리뷰어가 각각 재확인) |
  | user_guide_sync | prompt 에 개별 사유 텍스트 미첨부. 실측 근거(교차확인): 사용자 대면 UI/문서 변경 없음(백엔드 서비스 레이어 한정 변경), Swagger 문서 무변경(documentation 리뷰어 재확인) |