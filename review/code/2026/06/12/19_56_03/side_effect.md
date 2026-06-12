# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `rotateBotToken` 반환 타입 확장 — 호출자 타입 추론 변경
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 반환 타입 (`Promise<{ rotatedAt: string }>` → 4필드 객체)
- 상세: `ChatChannelController.rotateBotToken` 의 반환 타입이 `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` 로 변경되어 `TriggersService.rotateBotToken` 시그니처에 구조적으로 결합된다. 현재 코드베이스 내 해당 메서드 호출자가 `ChatChannelController` 하나뿐이고 컨트롤러 반환 타입도 동시에 갱신했으므로 컴파일 타임 오류는 없다. 그러나 이 반환 타입에 의존하는 클라이언트(프론트엔드 API 타입 생성, Swagger 스키마, OpenAPI 코드젠 등)가 존재하면 런타임 계약 변경이 된다. 기존에 `{ rotatedAt }` 만 기대하던 소비자가 추가 필드를 무시하면 문제없으나, 타입을 강하게 검사하는 클라이언트는 영향을 받는다.
- 제안: Swagger `@ApiResponse` 데코레이터 또는 DTO 클래스가 `{ rotatedAt }` 만 선언하고 있다면 함께 갱신 필요. 프론트엔드 API 클라이언트 타입 재생성 여부를 확인한다.

### [WARNING] `isActiveExecution` → `getActiveExecutionStatus` 교체 — `private` 메서드지만 동작 변경이 공개 흐름에 영향
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 약 778–807, 508–769
- 상세: 이전 `isActiveExecution` 은 `boolean` 을 반환했고, 호출 지점에서 `&&` 조건으로 `hasActiveExecution` 을 결정했다. 신규 `getActiveExecutionStatus` 는 `ExecutionStatus | null` 을 반환한다. 이 변경으로 인해 `running`/`pending` 상태의 execution 이 있는 채널에 메시지가 오면 기존에는 `interactionService.interact` 호출(인터랙션 forwarding)이 발생했으나, 이제는 `sendExecutionStillRunningNotice` + `{ executionId: 'ignored' }` 응답으로 동작이 바뀐다. 이것이 의도된 CCH-CV-03 (b) 구현이지만, 기존에 `running` 상태에서도 forwarding 이 되던 동작에 의존하는 사용자나 워크플로가 있다면 행동 변경이다. 특히 `button_callback` / `contact_share` / `file_upload` 도 `running` 상태에서 모두 무시되는데, 이전에는 forwarding 됐다면 breaking change 에 해당한다.
- 제안: `waiting_for_input` 미도달 시 `button_callback` / `contact_share` / `file_upload` 도 동일하게 무시하는 것이 스펙 의도인지 확인. 스펙 CCH-CV-03 이 이 4가지 명령 종류 모두를 포함하는지 명시적으로 검증한다.

### [INFO] `sendExecutionStillRunningNotice` — 새로운 외부 네트워크 호출 경로 추가
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 약 815–836
- 상세: `running`/`pending` 상태 감지 시 `adapter.sendMessage` 가 새로운 코드 경로로 호출된다. 이는 의도된 외부 채널(Telegram/Slack/Discord 등) 호출이지만, 기존에 해당 경로에서는 어떤 아웃바운드 네트워크 호출도 없었다. 실패 시 `logger.warn` 으로 swallow 하므로 전파 부작용은 없다.
- 제안: 이미 `try/catch + warn` 패턴으로 안전하게 처리됨. 추가 조치 불필요.

### [INFO] `executionsService['executionRepository']` bracket-access 유지 — 비공개 필드 직접 접근
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 약 788–800
- 상세: `this.executionsService['executionRepository']?.findOne?.(...)` 패턴이 `isActiveExecution` 에서 `getActiveExecutionStatus` 로 명칭만 바뀌어 그대로 유지된다. 이는 `ExecutionsService` 의 내부 구현 세부사항에 결합되어 있어, `ExecutionsService` 리팩터링 시 런타임 오류가 발생하지만 컴파일 타임에 잡히지 않는다. 기존 위험이 그대로 이월된 것이며 이 변경에서 새로 도입된 것은 아니다.
- 제안: 기존 위험과 동일. 별도 PR 에서 `ExecutionsService` 에 `findExecutionStatus(id)` 같은 공개 메서드를 추가하는 것이 장기적으로 안전하다.

### [INFO] `ROTATE_RESULT` 상수 — 테스트 파일 내 공유 픽스처, 부작용 없음
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` 라인 35–41
- 상세: `describe` 스코프 내 `const` 로 선언되어 있고 객체 리터럴이므로 테스트 간 공유 상태 변경이 없다. `as const` 리터럴 타입 사용으로 타입 안전성이 오히려 향상됐다.
- 제안: 없음.

### [INFO] `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter `worktree` 변경
- 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` 라인 2
- 상세: `worktree: spec-sync-audit` → `worktree: chat-channel-gaps` 로 변경됐다. plan 파일 자체는 상태 추적 문서이고 코드 실행 경로에 영향을 주지 않으므로 런타임 부작용은 없다. 다만 기존 worktree 명(`spec-sync-audit`)을 참조하는 스크립트나 자동화가 있다면 영향을 받을 수 있다.
- 제안: `.claude/tools/ensure-worktree.sh` 등 worktree 이름을 읽는 스크립트가 있다면 영향 없음을 확인한다.

---

## 요약

이번 변경의 가장 유의미한 부작용 위험은 두 가지다. 첫째, `TriggersService.rotateBotToken` 반환 타입이 `{ rotatedAt }` 에서 4필드 객체로 확장됨에 따라 컨트롤러 반환 계약이 바뀌어 Swagger 스키마 및 클라이언트 타입 코드젠에 전파될 수 있다(WARNING). 둘째, `running`/`pending` 상태 execution 이 있을 때 `button_callback` 등 모든 인터랙션 명령을 무시하는 새 분기가 추가됨으로써 기존에 해당 상태에서도 forwarding 이 일어나던 동작이 사라졌다(WARNING). 두 변경 모두 스펙 의도에 부합하며 의도적 변경이지만, 외부 API 소비자와 기존 동작을 기대하는 통합 테스트에 대한 영향을 확인해야 한다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 이벤트 변경은 없다. `executionRepository` bracket-access 는 기존부터 내재된 위험이며 이번 변경이 심화시킨 것은 아니다.

---

## 위험도

LOW
