# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 성능/DB/동시성 세 관점이 독립적으로 지목한 "이 PR이 새로 도입한 `trigger.workflow_id` 쿼리에 인덱스 부재 + 잠금에 timeout 미적용" 조합이 워크플로/워크스페이스 대량 삭제 시 seq scan과 결합해 무기한 hang 으로 이어질 수 있어 MEDIUM으로 판정한다. 12개 reviewer(강제 7명 포함) 전원 결과 확보 — 누락 없음, forced 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터베이스/성능 | `trigger.workflow_id` 컬럼에 인덱스가 없는 채로 이번 PR이 그 컬럼 조건 `trigger` 조회를 처음 도입 — 워크플로 삭제마다 seq scan이 발생하고, 그중 하나(`lockParentAndListTriggerIds`)는 부모 행 `pessimistic_write` 락을 쥔 트랜잭션 **안에서** 돈다. 이 저장소는 `schedule.trigger_id`(`V106`)에서 같은 클래스 결함을 이미 겪고 고친 선례가 있다 | `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:64`(`releaseExternalForParent`), `:85-88`(`lockParentAndListTriggerIds`); 호출부 `workflows.service.ts:267-278` | `V106` 패턴과 동일하게 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workflow_id ON trigger (workflow_id);` 마이그레이션 추가 |
| 2 | 데이터베이스 | `WorkflowsService.remove()`/`WorkspacesService.deleteWorkspace()`가 새로 획득하는 부모 행 `pessimistic_write` 락에 `lock_timeout`을 걸지 않는다 — 같은 PR이 `TriggersService.remove()`/`SchedulesService.remove()`(`acquireTriggerConfigLock`으로 `SET LOCAL lock_timeout` 적용)에 확립한 "외부 자원을 되돌릴 수 없게 먼저 해제했으면 뒤따르는 행 잠금은 무한 대기하지 않는다"는 원칙이 신규 호출부 두 곳엔 빠졌다 — Postgres `lock_timeout` 기본값 0(무제한)이라 동시 트랜잭션과 겹치면 "외부 자원은 이미 사라졌는데 행은 남은" 반쯤 삭제 상태가 관측 불가능한 hang으로 굳을 수 있다 | `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:68-90`(`lockParentAndListTriggerIds`); 호출부 `workflows.service.ts:263-291`, `workspaces.service.ts:498-551` | `lockParentAndListTriggerIds(manager, parent, { timeoutMs })` 옵션 추가, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(또는 `trigger-config-lock.ts`의 `toLockTimeoutMs` 클램프 헬퍼) 재사용해 락 획득 직전 `SET LOCAL lock_timeout` 실행 |
| 3 | 성능 | `deleteTriggerSecretsAfterCommit`이 트리거 수만큼 `secret_store` DELETE를 순차 `await`(N+1) — 워크플로/워크스페이스 삭제처럼 트리거가 여러 개인 경로에서 트리거 수에 비례해 DB 왕복 발생 | `codebase/backend/src/modules/triggers/trigger-resource-release.ts:54-70` | `deleteByPrefix` 다건 버전(`WHERE ref LIKE ANY(ARRAY[...])`) 추가 또는 최소 `Promise.allSettled`로 병렬화 |
| 4 | 성능 | `releaseExternalMany`의 chat-channel teardown 및 `removeScheduleJobsOrRestore`의 BullMQ job 해제가 동시성 제한 없이 완전 순차 — 트리거가 많은 워크스페이스 삭제 시 요청 지연이 트리거 수 × provider 지연에 선형 비례. provider 과부하 방지 의도(주석 명시)는 있으나 상한이 아예 없다 | `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:136-152`(`releaseExternalMany`), `:162-195`(`removeScheduleJobsOrRestore`) | 완전 직렬(1) 대신 작은 동시성 상수(2~3)로 배치 처리, 또는 spec에 "대량 트리거 삭제는 O(n) 지연" 명시해 타임아웃과 연결 |
| 5 | 아키텍처/유지보수성 | "부모 잠금→열거→콜백→커밋→비밀정리→실패 로그" 안무가 이제 네 곳(트리거·스케줄·워크플로·워크스페이스)에서 손으로 반복된다 — 1라운드가 이미 "호출부 3개 이상이면 템플릿 메서드로 승격 고려"라고 적어 뒀는데, 이번 처분 커밋이 다른 중복(지연 해석 헬퍼)은 통합하면서 이 중복은 오히려 새로 늘렸다 | `codebase/backend/src/modules/workflows/workflows.service.ts:263-291`(catch 블록 `:279-287`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-551`(catch 블록 `:537-546`), 유사 구조 `triggers.service.ts:1069-1083`, `schedules.service.ts:316-330` | 로그+재던짐 부분만이라도 `logHalfDeletedAndRethrow(...)` 공유 헬퍼로 통합, 또는 안무 전체를 포트가 소유하는 템플릿 메서드로 승격 |
| 6 | 동시성 | `releaseExternalForParent`(락 없는 스냅샷)과 `lockParentAndListTriggerIds`(잠금된 열거) 사이의 시차 — 그 사이 같은 부모 아래 새로 생긴 트리거는 CASCADE로 삭제·비밀도 정리되지만, 그 트리거가 등록한 외부 자원(BullMQ job·provider 등록·listener)은 `releaseExternalMany` 호출 어디에도 포함되지 않아 영구히 미해제 상태로 남을 수 있다. 1라운드와 동일 결함 — 코드 변경 없이 "문서화 + 백로그 등재(sweeper 재판단 항목)"로만 처분됨, race window 자체는 여전히 열려 있음 | `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:55-66` vs `:68-90`; 호출부 `workflows.service.ts:268`, `workspaces.service.ts:513` | 이번 PR 스코프 내 코드 조치는 불요(근거 타당). 단, plan `complete/` 이동 전 §164 "sweeper 재판단 항목 신설"이 실제 트래커 문서로 옮겨졌는지 확인 필요 — 안 그러면 추적 소유자를 잃는다 |
| 7 | SPEC-DRIFT | `[SPEC-DRIFT]` 세 spec 문서(및 관련 표)가 이 PR 착지로 낡았다 — 코드는 네 삭제 경로 모두 자원 정리를 완료했는데, 문서는 여전히 "미구현(Planned)"·과도기 문구·`status: partial`을 유지 중. 구현이 spec을 앞서간 것으로, revert가 아니라 spec 갱신이 필요 | `spec/2-navigation/2-trigger-list.md:287`(§4.3 과도기 註), `spec/data-flow/10-triggers.md:139,142`(Planned 태그), `spec/data-flow/12-workspace.md:188,202`(Planned 태그), `spec/conventions/secret-store.md:3`(frontmatter `status: partial`) | 코드는 유지. `2-trigger-list.md §4.3` 과도기 문구 삭제, `data-flow/10-triggers.md`·`12-workspace.md`의 Planned 태그 정합, `secret-store.md` frontmatter를 `implemented`로 갱신 — planner 후속 턴(1라운드부터 이미 plan 체크리스트에 예약됨) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/부작용/동시성 | 워크스페이스 삭제의 "잠금없는 선검사→외부 해제→잠금 재검사" 사이 역할-변경 창 — 재검사가 거부되면 워크스페이스는 안 지워지지만 이미 실행된 외부 해제(schedule job·provider teardown)는 되돌리지 않는다. 인가 우회는 아니고(최종 삭제 결정은 여전히 정확), 1라운드부터 알려진 트레이드오프이며 이번엔 error 로그로 가시화됨 + 회귀 테스트로 고정됨 | `workspaces.service.ts` `deleteWorkspace()`/`assertWorkspaceDeletable()`(:502-597), 회귀 테스트 `workspaces.service.spec.ts` | 조치 불요(이미 추적됨). 향후 이 경로 재작업 시 "외부 해제 자체를 잠금 뒤로" 이동 검토 |
| 2 | 아키텍처/보안/부작용 | `ModuleRef.get(TOKEN, {strict:false})` 서비스 로케이터가 Nest 모듈 `exports` 캡슐화를 우회 — DI 그래프 순환은 피했지만 모듈 경계가 엔티티/런타임 결합 층위에서 흐려짐. 보안 표면은 아니며(사용자 입력 미관여), 부모 타입 2종 스코프에서는 수용 가능 | `trigger-resource-release.ts:136-141`, `trigger-resource-releaser.service.ts:10-11`(Workflow/Workspace 엔티티 직접 import) | 부모 타입이 3종 이상으로 늘면 잠금 대상 엔티티를 호출자가 넘기는 형태로 역전 검토 |
| 3 | 문서화 | `plan/in-progress/trigger-deletion-release.md` 체크리스트 안 단위 테스트 통과 건수가 두 줄에서 다름(9,746 vs 9,747) — 실제 결함 가능성은 낮으나(측정 시점 차이) 어느 쪽이 최신 실측인지 문서만으로 판별 불가 | `plan/in-progress/trigger-deletion-release.md:159, :161` | 트래커 종결 전 두 숫자를 최신 실행 결과로 통일하거나 시점 명시 |
| 4 | 테스트 | `removeScheduleJobsOrRestore`의 다중 실패 메시지 조합(`join('; ')`)이 직접 단언되지 않음(현재 테스트는 항상 단일 실패만 구성), `TriggerResourceReleaserService.releaseExternal`(단일 트리거 진입점)의 직접 유닛 테스트 부재(통합 경로로는 커버됨) | `trigger-resource-releaser.service.ts`(`removeScheduleJobsOrRestore`, `releaseExternal`) | 다중 실패 케이스 1건 추가, `releaseExternal` 직접 호출 얇은 테스트 1건 추가(필수 아님) |
| 5 | 유지보수성 | (a) 회귀 테스트 2건이 `beforeEach` provider 배열을 그대로 복제해 drift 위험, (b) `ChatChannelBinderService.setupChatChannel`이 여전히 268줄+클로저 3개, (c) `trigger-resource-release.ts` vs `trigger-resource-releaser.service.ts` 파일명 한 글자 차이로 서술 시 혼동 여지, (d) `lockParentAndListTriggerIds`의 if/else 두 분기 반복(1라운드에서 이미 "유지" 결정) | `workflows.service.spec.ts:1049-1069`, `workspaces.service.spec.ts:685-701`, `chat-channel-binder.service.ts:89-356`, `trigger-resource-releaser.service.ts:72-84` | 급하지 않음. provider 배열을 변수로 빼 파생시키거나, 클로저를 private 메서드로 승격 고려 |
| 6 | 요구사항/데이터베이스 | 부모 잠금 결과(`findOne` null) 미확인 레이스, 워크스페이스 트랜잭션 내 이중 잠금(no-op) — 둘 다 1라운드에서 "새 결함 아님·후속 등재/유지"로 이미 처분된 항목이 코드 불변 상태로 재확인됨 | `trigger-resource-releaser.service.ts`(`lockParentAndListTriggerIds`), `workspaces.service.ts:520,528` | 차단 사유 아님 — 처분 유지 |
| 7 | 성능 | `releaseExternalForParent`가 필요 이상으로 넓은 컬럼(전체 엔티티)을 적재, 같은 트리거 목록을 삭제 한 번에 두 번 조회(트랜잭션 밖 스냅샷 + 안 재조회) — 의도된 설계(§4.3 트레이드오프)지만 인덱스 부재(WARNING#1)와 겹치면 비용이 두 배 | `trigger-resource-releaser.service.ts:63-66` | `select: { id, type, config }`로 축소 검토(필수 아님) |
| 8 | 부작용 | 로그 접두 `TriggersService:`→`ChatChannelBinderService:` 정정(4곳) — 코드 관점 문제 없음, 다만 이 문자열을 grep하는 외부 로그 알림/대시보드가 있다면 매칭이 조용히 끊길 수 있음 | `chat-channel-binder.service.ts` | 배포 체크리스트에 "로그 파싱 규칙 확인" 한 줄 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 워크스페이스 역할-변경 창(INFO, 인가 우회 아님), ModuleRef 로케이터(표면 아님). 신규 하드코딩 시크릿·인젝션·인증 우회 없음 |
| performance | MEDIUM | `trigger.workflow_id` 인덱스 부재(락 안에서 seq scan), secret 삭제 N+1, chat-channel/schedule teardown 완전 순차 |
| architecture | LOW | 1라운드 지적 전부 처분 확인. 삭제 안무+실패로그 블록이 4곳으로 늘어난 drift 위험(WARNING) |
| requirement | LOW | spec-code line-level 대조 완료, 위반 없음. SPEC-DRIFT 3개 문서(이미 추적됨) |
| scope | NONE | 44개 파일 전부 1라운드 처분표와 1:1 대응, 스코프 이탈 없음 |
| side_effect | LOW | 1라운드 WARNING(워크스페이스 미복구)이 "가시화"로 처분됨 재확인. 새 CRITICAL/WARNING 없음 |
| maintainability | LOW | 1라운드 WARNING 3건 전부 해소 확인. 잔여 INFO만 |
| testing | LOW | 신규 로직(배치 해제/복구, 판정 API 전환) 3단 커버리지 확인, GREEN 실행 확인. 좁은 INFO 2건 |
| documentation | NONE | 1라운드 WARNING 2건 해소 확인. plan 체크리스트 숫자 불일치만 INFO |
| database | MEDIUM | `trigger.workflow_id` 인덱스 부재, `WorkflowsService`/`WorkspacesService` 부모 락에 `lock_timeout` 미적용(신규 발견) |
| concurrency | MEDIUM | 1라운드 CRITICAL/WARNING 해소 확인. "스냅샷 vs 잠금 열거 시차" 레이스는 여전히 열려 있음(문서화 처분) |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 대조, 매칭 0건 — 유저 가이드 갱신 대상 아님 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 기록.

## 권장 조치사항

1. `trigger.workflow_id`에 인덱스 추가(`CREATE INDEX CONCURRENTLY`) — performance·database 두 관점이 독립적으로 지목, 락을 쥔 트랜잭션 안에서 seq scan이 도는 구조라 우선순위 최상위.
2. `WorkflowsService.remove()`/`WorkspacesService.deleteWorkspace()`의 부모 행 락에 `lock_timeout` 적용 — 이 PR 자신이 다른 두 경로(`TriggersService`/`SchedulesService`)에 이미 확립한 원칙을 두 신규 호출부에도 동일 적용해야 "무기한 hang" 재발을 막는다.
3. 트리거별 secret 삭제·chat-channel/schedule job teardown의 순차 처리를 배치 또는 제한된 동시성으로 개선(대량 트리거 워크스페이스 삭제 지연 완화).
4. 삭제 안무+실패 로그 블록(4곳 반복)을 공유 헬퍼 또는 템플릿 메서드로 통합해 drift 위험 축소.
5. `[SPEC-DRIFT]` 3개 spec 문서(`2-trigger-list.md §4.3`, `data-flow/10-triggers.md`, `data-flow/12-workspace.md`, `secret-store.md` frontmatter) — planner 후속 턴으로 갱신(코드는 유지, plan 체크리스트에 이미 예약됨 — `complete/` 이동 전 실제 신설 여부 확인).
6. 동시성 WARNING#6(스냅샷-열거 시차)의 "sweeper 재판단 항목"이 plan `complete/` 이동 전 실제 트래커로 옮겨졌는지 확인.
7. 나머지 INFO 항목은 즉시 조치 불요 — 다음 관련 작업 시 함께 정리 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (12명)
  - **제외**: 표 (reviewer · 이유, 2명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단(이번 변경에 신규/변경 의존성 패키지 없음) |
  | api_contract | router 판단(컨트롤러·DTO·API 스키마 변경 없음, 서비스 계층 내부 리팩터) |

(참고: 모든 reviewer 산출물(`security.md`~`user_guide_sync.md`)은 세션 디렉토리에 이미 존재함이 확인되어 별도 영속화가 불필요했다. `SUMMARY.md` 자체는 basename 차단 규칙에 따라 Write가 차단됐다 — 호출자가 위 전문을 동일 경로에 멱등 기록해야 한다.)
