### 발견사항

- **[WARNING]** `team_invite` 발사가 초대 대상에게 이메일 2통(초대 링크 메일 + 알림 이메일)을 새로 유발 — 기존 사용자 대상 부작용 확대
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `invite()` — 기존 `mailService.sendWorkspaceInvitationEmail(...)` 호출 바로 다음에 신규 `dispatchTeamInviteNotification(...)` → `notificationsService.notify({..., channel: 'both', ...})` 추가. `NotificationsService.notify()`(`notifications.service.ts` `dispatchEmails`)가 `channel='both'`를 보고 `MailService.sendNotificationEmail`을 다시 호출한다.
  - 상세: 이번 diff 이전에는 워크스페이스 초대 시 초대 링크 이메일 1통만 발송됐다. PR3 는 "기존 가입자(비멤버)" 케이스에 한해 `team_invite` 알림을 `channel: 'both'`로 발사하므로, 이제 그 사용자는 (a) 기존 초대 링크 이메일과 (b) 신규 "워크스페이스 초대" 알림 이메일을 **동시에** 받는다. 이는 `invite()` 호출자(컨트롤러/기존 테스트)가 예상하지 못했던 신규 외부 이메일 발송 side effect이며, plan 문서(`spec-update-notifications-firing.md` "team_invite 이메일 2통 (side-effect 재검토)")에도 이미 자체적으로 인지·기록돼 있다. 즉 개발자 스스로도 "UX 상 중복 가능"이라 표시했고 최종 결정(channel=both 유지 vs in_app 하향 vs 링크 메일 생략)을 planner 에게 미룬 상태다.
  - 제안: 코드 자체는 spec-literal(§1.1 "in-app + 이메일 둘 다")을 정확히 구현했으므로 버그는 아니나, **push 전에 이 부작용이 의도된 것인지 재확인**할 필요가 있다. 이미 위임된 `plan/in-progress/spec-update-notifications-firing.md`의 결정 항목(a/b/c)이 종결되기 전까지는 "기존 가입자가 이메일 2통을 받는다"는 사실이 운영 관점에서 최종 확정이 아님을 인지하고 배포할 것.

- **[WARNING]** 3개 서비스에 `NotificationsService`(및 신규 리포지토리) 강제 DI 추가 — 생성자 시그니처 변경이 실제 프로덕션 앱 부팅 그래프를 확장
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 `@Optional() notificationsService?`), `codebase/backend/src/modules/schedules/schedule-runner.service.ts` (신규 필수 `workflowRepository`, `notificationsService`), `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` (신규 필수 `notificationsService`) + 대응 module 파일 3곳(`schedules.module.ts`, `workspaces.module.ts`, 그리고 이미 PR2 에서 바뀐 `notifications.module.ts`)
  - 상세: `ExecutionEngineService`는 `@Optional()`로 미주입 시 no-op guard 를 둬 하위호환을 배려했지만, `ScheduleRunnerService`와 `WorkspaceInvitationsService`는 **필수 생성자 인자**로 `NotificationsService`를 추가했다. 두 클래스를 테스트 외 다른 곳에서 `new ScheduleRunnerService(...)` / `new WorkspaceInvitationsService(...)` 식으로 직접 인스턴스화하는 코드가 남아 있다면(예: 다른 모듈에서 수동 provider 팩토리) 컴파일 타임에 걸리겠지만, 런타임 NestJS DI 그래프 확장이므로 각 모듈이 `NotificationsModule`을 새로 import 해야 하고(실제로 `schedules.module.ts`/`workspaces.module.ts`에 반영됨), 순환참조 회피 근거가 각 모듈 주석에 기록돼 있어 설계 자체는 신중하다. 다만 `ScheduleRunnerService`가 BullMQ `WorkerHost`이므로, `NotificationsService`(나아가 `MailModule`, SMTP 설정)의 초기화 실패가 스케줄 워커 프로세스의 부팅 자체를 막을 잠재 경로가 생겼다(기존에는 스케줄 워커가 Mail/Notifications 모듈에 의존하지 않았음).
  - 제안: 이미 app-boot e2e(236 passed, RESOLUTION 기록)가 배선 정상 동작을 검증했다고 기록돼 있으나, `ScheduleRunnerService`가 별도 프로세스/워커로 분리 배포되는 경우가 있다면 그 배포 단위가 `NotificationsModule`/`MailModule`/SMTP 설정을 함께 갖추고 있는지 별도 확인 필요(현재 monolith 배포라면 위험 낮음).

- **[INFO]** `execution_failed` 발사가 실행 실패 경로에 `WorkflowRepository.findOne` 추가 DB 조회를 유발(선재 부작용, best-effort로 격리됨)
  - 위치: `execution-engine.service.ts` `dispatchExecutionFailedNotification()` — `runExecution` 의 FAILED 분기(`EXECUTION_FAILED` emit 직후) 에서 호출
  - 상세: 기존에는 실행 실패 시 이미 로드된 `savedExecution`만 사용했으나, 이제 매 top-level 실행 실패마다 `workflowRepository.findOne`(owner 조회) + `notificationsService.createMany`(추가 INSERT) + (channel=in_app 이므로 이메일은 없음, 하지만 `emitNew` WS push)가 추가로 발생한다. `try/catch`로 감싸 예외를 삼키므로 실행 종료(FAILED 마킹) 흐름을 되돌리지는 않지만, **finally 이전에 await로 순차 실행**되어 실행 실패 처리 경로의 지연 시간이 소폭 늘어난다(네트워크/DB 응답 대기).
  - 제안: 별도 조치 불요 — best-effort/예외 격리가 적절히 돼 있음. 대량 동시 실행 실패가 몰릴 때(장애 전파 시나리오) DB/알림 서비스에 추가 부하가 걸릴 수 있다는 점만 인지 권장(성능 리뷰 영역과 중첩).

- **[INFO]** `Optional` 주입 가드로 인한 "조용한 no-op" 가능성 — 프로덕션 설정 실수 시 무음 실패
  - 위치: `execution-engine.service.ts` 생성자 `@Optional() private readonly notificationsService?: NotificationsService`, `dispatchExecutionFailedNotification()`의 `if (!this.notificationsService) return;`
  - 상세: 코드 주석은 "프로덕션은 항상 주입된다"고 명시하지만, 만약 향후 리팩터링으로 `execution-engine.module.ts`가 실수로 `NotificationsModule` import 를 제거하면 `execution_failed` 알림 발사가 **에러 없이 조용히 비활성화**된다(컴파일/부팅 타임에 어떤 신호도 없음). 이는 의도치 않은 상태 변경이라기보다 "의도치 않은 기능 소실이 감지되지 않는" 유형의 잠재 부작용이다.
  - 제안: 별도 조치 불요(현재 diff 범위에서는 정상 배선 확인됨) — 다만 향후 module 리팩터링 시 회귀 방지용 통합 테스트(예: `execution-engine.module` 부팅 시 `NotificationsService` 실제 주입 여부 assert)를 고려할 만하다.

- **[INFO]** `resource_type='execution'` 값 공유로 인한 잠재적 조회 혼선 (naming-collision checker 가 이미 WARNING 으로 포착·조치 계획 있음)
  - 위치: `execution-engine.service.ts` `dispatchExecutionFailedNotification()` — `resourceType: 'execution', resourceId: execution.id`
  - 상세: 신규 `execution_failed` 알림이 `background_failed`의 옛 NodeExecution fallback과 동일한 `(resource_type, resource_id)` 키 공간을 공유한다. 이 자체는 코드 버그는 아니지만, 향후 `NotificationsService.findByResource('execution', executionId)`류의 신규 소비자가 추가되면 의미가 다른 두 알림 계열이 뒤섞이는 부작용으로 이어질 수 있다(현재 유일한 소비처는 `background_run` 스코프로 한정돼 즉각 영향 없음). 이미 코드 주석과 consistency-check(naming_collision)에서 인지·기록됨.
  - 제안: 별도 조치 불요 — 이미 plan(`spec-update-notifications-firing.md`)에 반영 계획 있음. 회귀 확인용으로만 인지.

- **[INFO]** `execution-engine.service.ts` non-notification 리팩터 구간(체크포인트/재개 필드 기본값 캐스팅 단순화, advisory-lock 쿼리 결과 unwrap 단순화)은 순수 코드 정리이며 관찰 가능한 부작용 변화 없음
  - 위치: `execution-engine.service.ts` `@@ -2659`~`-2677`(advisory lock UPDATE 결과 `as unknown[]` 캐스팅 제거), `@@ -4763`~`-4936`(`resolvedConfig.xxx as T | undefined ?? default` → `resolvedConfig.xxx ?? default` 타입 캐스팅 단순화)
  - 상세: 두 구간 모두 런타임 동작(반환 값·기본값 로직)은 동일하며 TypeScript 타입 단언 스타일만 정리한 것으로 보인다(타입이 이미 넓혀졌거나 인터페이스가 좁혀졌을 가능성). 새로운 부작용은 발견되지 않음.
  - 제안: 조치 불필요 — 타입 시스템이 실제로 이 값들의 타입을 이미 좁혀줬는지만 빌드 통과 여부로 확인(이미 TEST 결과에 build 통과 기록됨).

### 요약

이번 diff(PR3: `execution_failed`/`schedule_failed`/`team_invite` 발사 소스 + 앞서 병합된 PR1/PR2 리뷰 산출물)는 3개 기존 서비스(`ExecutionEngineService`, `ScheduleRunnerService`, `WorkspaceInvitationsService`)에 `NotificationsService` 의존을 새로 주입하고, 각 실패/이벤트 경로에 알림 발사(DB insert, 조건부 WS emit, 조건부 이메일 발송)라는 신규 부작용을 추가한다. 모든 발사 지점이 `try/catch`로 감싸져 있고 실행 실패/스케줄 실패/초대 생성이라는 원 흐름을 절대 되돌리지 않는 best-effort 설계는 일관되게 잘 지켜졌다. 가장 주목할 부작용은 (1) `team_invite`(channel=both)로 인해 기존 가입자가 초대 시 이메일을 2통 받게 되는 사용자 체감 변화(개발자 스스로 인지하고 planner 결정에 위임한 상태이나 아직 미확정)와, (2) `ScheduleRunnerService`/`WorkspaceInvitationsService`가 `NotificationsService`를 **필수** 의존으로 갖게 되어 배포 토폴로지에 따라 부팅 실패 표면이 넓어질 수 있다는 점이다. `ExecutionEngineService`는 `@Optional()` 가드로 하위호환을 지켰으나, 이는 반대로 향후 배선 실수를 무음으로 만들 잠재 리스크이기도 하다. 신규 전역 변수·파일시스템 부작용·환경변수 오남용·의도치 않은 외부 네트워크 호출은 발견되지 않았으며(이메일 발송은 명시적으로 의도된 기능), 공개 API(컨트롤러/DTO) 시그니처 변경도 없다.

### 위험도
MEDIUM
