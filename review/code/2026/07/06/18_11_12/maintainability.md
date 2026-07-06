### 발견사항

- **[INFO]** `execution_failed`/`schedule_failed`/`team_invite` 세 dispatch 함수가 구조적으로 거의 동일한데 각 서비스에 개별 구현되어 경미한 중복 존재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `dispatchExecutionFailedNotification()`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts` `dispatchScheduleFailedNotification()`, `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `dispatchTeamInviteNotification()`, 그리고 기존 `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` 의 `background_failed` 발사부
  - 상세: 네 곳 모두 "try 블록으로 감싸고, `notificationsService.notify()`(또는 `createMany`) 호출, catch 에서 `this.logger.error`로 동일 포맷(``Failed to dispatch ${type} notification (...): ${err instanceof Error ? err.message : String(err)}``) 로그" 패턴을 반복한다. 각 함수가 워크플로우/리소스 컨텍스트가 달라 완전한 추출은 어렵지만, 최소한 "best-effort 삼킴 + 표준 에러 로그" 부분은 공용 헬퍼(`notifyBestEffort(fn, logCtx)` 류)로 뽑을 여지가 있다. 다만 이 반복은 새 코드가 기존 `background_failed` 패턴을 의도적으로 그대로 재현한 것으로(일관성 관점에서는 오히려 바람직), 리팩터링 강제 사유는 아니다.
  - 제안: 발사 소스가 더 늘어날 경우(마켓플레이스 등) 공용 `dispatchBestEffortNotification(logger, type, fn)` 헬퍼 도입을 고려. 현재 3~4곳 수준에서는 즉시 조치 불필요.

- **[INFO]** `execution-engine.service.ts` 의 `?? ` 캐스트 제거 리팩터링이 알림 기능과 무관한 diff에 섞여 있음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (예: `maxTurns: (resolvedConfig.maxTurns as number | undefined) ?? 20` → `maxTurns: resolvedConfig.maxTurns ?? 20`, `rows` 캐스트 제거 등, diff L199-365 부근)
  - 상세: 가독성은 개선(불필요한 `as` 캐스트 제거)되지만, 이번 PR 의 주제(알림 발사 소스 3종 추가)와 직접 관련이 없는 별도 클린업이 같은 커밋/diff에 섞여 있다. 리뷰 대상 범위를 흐릴 수 있고, 향후 `git blame`/변경 이력 추적 시 "왜 이 파일이 알림 PR에서 바뀌었나"를 파악하기 어렵게 만든다. (타입이 이미 좁혀져 캐스트가 실질적으로 불필요해졌다면 별도 커밋으로 분리하는 편이 이력 추적에 유리하다.)
  - 제안: 향후 유사 상황에서는 리팩터링성 변경을 별도 커밋/PR로 분리 권장. 이번 건은 이미 병합 대상이므로 조치 불필요(기록만).

- **[INFO]** 매직 스트링(알림 `type`/`channel`/`resourceType` 리터럴)이 여러 파일에 흩어져 문자열로 하드코딩됨
  - 위치: `execution-engine.service.ts` (`'execution_failed'`, `'in_app'`, `'execution'`), `schedule-runner.service.ts` (`'schedule_failed'`, `'schedule'`), `workspace-invitations.service.ts` (`'team_invite'`, `'both'`, `'workspace_invitation'`)
  - 상세: 알림 `type`/`channel`/`resourceType` 값이 각 서비스 파일에 리터럴 문자열로 직접 등장한다. 오타 시 컴파일 타임에 잡히지 않고(단순 `string` 타입이라면) 런타임에야 발견될 수 있다. 기존 `background_failed` 발사부도 동일한 스타일(리터럴 문자열)이라 이번 PR은 기존 컨벤션을 그대로 따른 것으로 보이며, 새로운 문제는 아니다.
  - 제안: 만약 `Notification` 엔티티/DTO 쪽에 `type`/`channel` 에 대한 union 타입 또는 상수 enum이 이미 존재한다면 그것을 재사용하도록 통일하는 후속 리팩터링을 고려(이번 PR 범위 밖, 기존 패턴 준수 우선).

- **[INFO]** `dispatchExecutionFailedNotification`/`dispatchScheduleFailedNotification`/`dispatchTeamInviteNotification` 세 함수 모두 함수 길이·중첩 깊이 양호
  - 위치: 3개 파일의 신규 private 메서드
  - 상세: 각 함수는 순차적 단일 책임(조건 가드 → 조회 → 수신자 계산 → notify 호출 → catch 로그)으로 15~30줄 내외이며 중첩 깊이도 최대 2단계(try 안 if)로 낮다. JSDoc 주석이 "왜"(top-level만 발사하는 이유, background_failed와의 resource_type 키공간 공유 주의, 이메일 2통 발생 가능성 등)를 상세히 설명해 가독성이 좋다.
  - 제안: 조치 불필요 — 모범적인 함수 분리 사례로 참고할 만함.

- **[INFO]** 세 함수의 네이밍 컨벤션 일관성 양호
  - 위치: `dispatchExecutionFailedNotification`, `dispatchScheduleFailedNotification`, `dispatchTeamInviteNotification` (신규) vs 기존 `dispatchEmails`, `dispatchEmail`(background_failed 발사부의 함수명 패턴)
  - 상세: `dispatch<Context>Notification` 패턴이 기존 `background_failed` 발사부 및 새 3개 함수 간에 일관되게 유지된다. private 메서드 접근제어자·`Promise<void>` 반환 타입·에러 처리 스타일도 통일되어 있다.
  - 제안: 조치 불필요.

### 요약

이번 변경(execution_failed/schedule_failed/team_invite 알림 발사 3종 추가)은 유지보수성 관점에서 전반적으로 양호하다. 각 dispatch 함수는 단일 책임을 가지며 15~30줄 수준으로 짧고, 중첩 깊이도 낮으며, JSDoc이 "왜 이 조건인지"(top-level 전용 게이트, resource_type 키공간 공유, 중복 이메일 가능성 등)를 명확히 기술해 가독성이 높다. 네이밍은 기존 `background_failed` 발사 패턴(`dispatch<Context>Notification`)을 그대로 재현해 컨벤션 일관성을 지켰고, best-effort try/catch + 표준 로그 포맷도 기존 스타일과 동일하다. 다만 세 함수 간 "try-notify-catch-log" 뼈대가 거의 동일하게 반복되는 경미한 중복이 있고(발사 소스가 더 늘어나면 공용 헬퍼 추출을 고려할 만함), `execution-engine.service.ts`에는 이번 PR 주제와 무관한 캐스트 제거 클린업이 같은 diff에 섞여 있어 변경 이력 추적성을 다소 흐린다. 매직 스트링(type/channel 리터럴)도 산재하지만 이는 기존 코드베이스 패턴을 그대로 따른 것이라 새로운 문제는 아니다. 모두 CRITICAL/WARNING 수준은 아니며 차단 사유가 없다.

### 위험도
NONE
