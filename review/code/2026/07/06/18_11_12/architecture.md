### 발견사항

- **[INFO]** `NotificationsService`가 알림 발사 소스 3곳(execution-engine, schedule-runner, workspace-invitations)에 개별 `dispatchXxxNotification` 헬퍼로 중복 이식된 패턴
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:247-285`(`dispatchExecutionFailedNotification`), `codebase/backend/src/modules/schedules/schedule-runner.service.ts:930-958`(`dispatchScheduleFailedNotification`), `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts:1181-1206`(`dispatchTeamInviteNotification`)
  - 상세: 세 헬퍼 모두 (1) workflow/workspace 소유자 조회 → (2) 수신자 산출 → (3) `notify()`/`createMany()` 호출 → (4) try/catch 로 예외 삼킴("best-effort") 이라는 동일 구조를 반복한다. 각 서비스가 자기 도메인 컨텍스트(workflow owner, executor, invitee)를 갖고 있어 완전한 공용화는 어렵지만, "예외를 삼키고 error 로그만 남기는 best-effort 알림 발사"라는 횡단 관심사 자체는 별도 유틸(`safeNotify(fn)` 래퍼 같은)로 추출할 여지가 있다. 각 호출자가 SRP 상 알림 발사를 자기 책임으로 갖는 것은 합리적(발사 조건이 도메인 지식)이므로 이 자체가 결함은 아니다.
  - 제안: 현재 3곳이면 허용 범위. 4번째 발사 소스(`marketplace_update`)가 추가되는 시점에 "실패를 삼키는 알림 발사" 공통 wrapper(`this.notifyBestEffort(entry, logger)` 형태)를 `NotificationsService` 또는 공용 유틸에 추출할 것을 권고(Rule of Three).

- **[INFO]** `ExecutionEngineService`에 `@Optional() notificationsService`를 두어 알림 의존성을 옵셔널화한 설계
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:190-195`
  - 상세: 프로덕션에서는 `NotificationsModule`이 항상 import 되어 non-null 이지만, 방대한 기존 `TestingModule` 셋업(주석상 4곳)이 mock provider를 추가하지 않아도 되도록 optional 로 완화했다. 이는 테스트 편의를 위해 프로덕션 타입 계약(`notificationsService?: NotificationsService`)을 약화시키는 절충으로, "필수 협력자를 옵셔널로 선언"하는 것은 일반적으로 안티패턴에 가깝다 — 실수로 프로덕션 module wiring 이 깨져도(NotificationsModule import 누락) 컴파일 타임에 잡히지 않고 조용히 no-op 된다.
  - 제안: 현재 규모(단일 실행 실패 알림, DI 그래프 안정)에서는 감내 가능한 트레이드오프이나, 이런 `@Optional` 패턴이 서비스에 누적되면 "실제로 필수인 의존성"과 "진짜 옵셔널"의 구분이 흐려진다. 향후 유사 케이스가 늘면 테스트 헬퍼(공용 `createTestingModuleWithNotifications()` 등)로 실제 mock 주입을 표준화하는 편이 타입 안전성 측면에서 더 낫다.

- **[INFO]** `execution_failed`와 `background_failed`가 동일 `resource_type='execution'` 키공간을 의도적으로 공유
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:242-245`(주석), `plan/in-progress/spec-update-notifications-firing.md:19`
  - 상세: 코드 주석과 plan 모두 두 알림 계열이 `resource_type='execution'`을 공유하며, 현재 소비처(`background-runs.service`)가 `background_run` 스코프로 한정되어 있어 당장 충돌은 없다고 명시한다. 이는 "우연한 결합(accidental coupling)"이 아니라 문서화된 의도적 설계이지만, 향후 `findByResource('execution', …)` 같은 범용 조회가 도입되면 두 알림 유형이 뒤섞일 잠재 위험이 이미 인지되어 있다.
  - 제안: 이미 spec-update plan(`spec-update-notifications-firing.md`)에 반영 대상으로 등재되어 있으므로 추가 조치 불요. 실제 범용 조회 도입 시점에 `resource_type`을 `execution_failed`/`background_failed`로 세분화하는 후속을 권고(이미 plan에 캡처됨).

- **[INFO]** `NotificationsService.dispatchEmails`가 `notify()`/`createMany()` 내부에서 인라인 `await` 되어 이메일 발송(SMTP I/O)이 적재 경로에 직결
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:667`, `:675`
  - 상세: 계층 관점에서 "알림 적재(비즈니스 write)"와 "이메일 발송(외부 I/O side-effect)"이 같은 트랜잭션적 흐름 안에 순차 결합되어 있다. 현재는 모든 호출자가 백그라운드 워커(execution-engine, schedule-runner, workspace-invitations)이므로 API 응답 latency 영향은 없다는 것이 이미 이전 리뷰 라운드(16_24_00 WARNING 1)에서 확인·defer 처리되었다.
  - 제안: 기존 defer 결정이 합리적이므로 재론 불요 — 다만 향후 API 동기 경로(HTTP 핸들러)에서 `notify()`를 직접 호출하는 case 가 생기면 큐 기반 decouple(예: BullMQ job)을 재검토할 것.

### 요약

이번 변경은 알림 파이프라인의 3번째 슬라이스(발사 소스 3종: `execution_failed`/`schedule_failed`/`team_invite`)로, 각 발사 로직이 해당 도메인 서비스(execution-engine/schedule-runner/workspace-invitations) 안에 위치해 "누가 언제 어떤 알림을 쏘는가"라는 도메인 지식과 결합도를 유지하는 자연스러운 설계다. `NotificationsService`는 단일 진입점(`notify`/`createMany`)을 그대로 유지하며 이메일 발송·WS emit·DB 적재라는 3개 관심사를 캡슐화하고 있어 호출자 쪽 결합도가 낮다. 모듈 경계도 견고하다 — `NotificationsModule`은 `MailModule`(app-level 순환 없음)만 의존하고, `ExecutionEngineModule`/`SchedulesModule`/`WorkspacesModule`이 단방향으로 `NotificationsModule`을 import하는 구조라 순환 의존성이 발생하지 않으며, 기존 `WebsocketModule` 순환 회피(ModuleRef 지연 해석) 설계도 그대로 보존됐다. best-effort(예외 삼킴 + 로그) 정책이 3개 발사 지점에 일관되게 반복 구현된 점은 사소한 코드 중복이지만 발사 조건 자체가 도메인 특화적이라 SRP 위반은 아니며, `@Optional()` DI 완화는 테스트 편의를 위한 의도적·문서화된 트레이드오프다. `resource_type` 키공간 공유(execution_failed/background_failed)는 잠재적 리스크로 이미 인지·문서화되어 후속 spec 트랙에 등재되어 있다. 전반적으로 레이어 책임 분리, 모듈 경계, 확장성(4번째 발사 소스 marketplace_update 추가 시에도 동일 패턴 재사용 가능) 모두 양호한 수준이다.

### 위험도
LOW
