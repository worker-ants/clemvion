# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: chat-channel-gaps PR (CCH-CV-03 (b) 분기 + §5.4 rotate-bot-token 응답 확장)

---

## 발견사항

### [WARNING] `executionsService['executionRepository']` — private 필드 bracket 접근이 두 메서드에 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` — `getActiveExecutionStatus` (라인 ~1337) 및 이전 `isActiveExecution` 패턴 동일
- 상세: `this.executionsService['executionRepository']` 처럼 문자열 키로 private 필드를 우회하는 패턴은 테스트와 프로덕션 양쪽에서 깨지기 쉽다. `ExecutionsService` 에 `findExecutionStatus(id: string)` 같은 공개 메서드를 두는 것이 encapsulation 원칙과 유지보수성 모두에 낫다. 현재는 `getActiveExecutionStatus` 한 곳에만 남아 있으나, 테스트 코드에서도 동일 패턴(`moduleRef.get(ExecutionsService) as { executionRepository: ... }`)을 4개 케이스에서 반복한다.
- 제안: `ExecutionsService` 에 `getStatus(id: string): Promise<ExecutionStatus | null>` (또는 유사 이름) 공개 메서드 추가. `HooksService.getActiveExecutionStatus` 는 그 메서드를 호출하도록 위임. 테스트도 `executionRepository` 직접 mock 대신 `getStatus` mock 으로 전환하면 내부 구현 변경에 무관해진다.

### [WARNING] 테스트 내 `execRepo` cast 블록 4회 중복 — copy-paste 취약
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.spec.ts` — 추가된 4개 테스트 케이스 각각
- 상세: 아래 패턴이 4개의 `it()` 블록에서 동일하게 반복된다.
  ```
  const execRepo = (
    moduleRef.get(ExecutionsService) as {
      executionRepository: jest.Mocked<{
        findOne: jest.MockedFunction<() => Promise<{ status: string }>>;
      }>;
    }
  ).executionRepository;
  ```
  이 10줄 cast 블록은 타입도 길고, 네 테스트 모두에서 완전히 같다. `ExecutionsService` internal 구조 변경 시 4곳을 동시에 수정해야 한다.
- 제안: `beforeEach` 또는 `describe` 스코프 바깥에 헬퍼 함수 혹은 `let execRepo: ...` 변수를 둔다. 예:
  ```ts
  function getExecRepo(moduleRef: TestingModule) {
    return (moduleRef.get(ExecutionsService) as { executionRepository: jest.Mocked<...> }).executionRepository;
  }
  ```
  또는 `isActiveExecution → getActiveExecutionStatus` 리팩토링(위 첫 번째 제안) 이 적용되면 이 중복 자체가 사라진다.

### [INFO] `getActiveExecutionStatus` 반환 타입의 이중 캐스팅 (`as ... | null | undefined`)
- 위치: `hooks.service.ts` `getActiveExecutionStatus`, 라인 ~1342
- 상세: `(await ...) as { status: ExecutionStatus } | null | undefined` 형태는 `undefined` 와 `null` 을 동시에 허용한다. `.catch(() => null)` 이 null 만 반환하므로 `undefined` 는 논리적으로 도달 불가다. 이중 캐스팅이 독자에게 "undefined 가 올 수 있나?" 혼란을 줄 수 있다.
- 제안: `as { status: ExecutionStatus } | null` 로 축소. `?.findOne?.` 옵셔널 체이닝이 `undefined` 를 반환할 수 있다는 우려라면 `.catch(() => null) ?? null` 로 명시적으로 null 정규화하거나, 타입을 한 단계 더 좁히는 중간 변수 도입.

### [INFO] `Awaited<ReturnType<TriggersService['rotateBotToken']>>` — controller 반환 타입
- 위치: `chat-channel.controller.ts` 라인 ~226
- 상세: 반환 타입을 서비스 메서드 시그니처에서 derive 하는 것은 DRY 이고, 서비스 타입 변경 시 controller 가 자동으로 따라가는 장점이 있다. 다만 `Awaited<ReturnType<...>>` 패턴은 다른 controller 파일들이 인라인 객체 타입(`Promise<{ rotatedAt: string }>`)을 사용하는 관행과 다를 수 있다 — 코드베이스 일관성 측면에서 확인 필요.
- 제안: 이 패턴이 코드베이스 전반에 도입할 만한 convention 이라면 그대로 유지. 일부 controller 만 사용하는 고립 패턴이라면 서비스 측에 named response type(`RotateBotTokenResponse`)을 export 해 양쪽에서 명시 참조하는 방식이 더 가독성이 좋다.

### [INFO] `activeStatus !== ExecutionStatus.WAITING_FOR_INPUT` 조건 — 의도 전달 약함
- 위치: `hooks.service.ts` 라인 ~1045
- 상세: `hasActiveExecution && ... && activeStatus !== WAITING_FOR_INPUT` 을 읽는 사람은 "active 인데 waiting_for_input 이 아니라는 게 정확히 어떤 상태인가?" 를 comment 없이는 바로 파악하기 어렵다. 현재 인라인 주석(CCH-CV-03(b))이 바로 위에 있어 보완되지만, 조건 자체가 부정문이다.
- 제안: `activeStatus === ExecutionStatus.RUNNING || activeStatus === ExecutionStatus.PENDING` 으로 양성 조건으로 바꾸거나, `isExecutionStillRunning(activeStatus)` 헬퍼로 추출하면 의도가 자명해진다. 단, 미래에 새 비-terminal 상태가 추가될 때 부정문이 자동 포함한다는 장점도 있으므로 trade-off 문서화 권장.

### [INFO] `sendExecutionStillRunningNotice` vs `maybeNotifyIgnored` — 유사 구조의 두 메서드
- 위치: `hooks.service.ts` 라인 ~1357 및 ~1183
- 상세: 두 메서드 모두 "kind: 'text' 메시지를 adapter.sendMessage 로 발송, 실패 시 logger.warn 으로 swallow" 패턴이다. 구조가 거의 동일하나 목적이 달라 통합하기 어렵다는 점을 현재 JSDoc 주석이 언급한다. 이 구조 유사성을 독자가 인지할 수 있도록 공통 private 헬퍼 `trySendTextMessage(conversationKey, text, config, adapter)` 를 두면 중복 try/catch 패턴이 사라진다.
- 제안: `trySendTextMessage` 또는 `sendTextSafe` 헬퍼를 추출하고 두 메서드가 이를 호출. 현재 WARNING 수준은 아니나 메서드 수가 늘어나면 중복 부채가 증가한다.

---

## 요약

이번 변경은 `isActiveExecution`(boolean) 을 `getActiveExecutionStatus`(status-aware) 로 확장하고, `rotateBotToken` 응답에 3개 필드를 추가하는 작업으로, 변경 범위에 비해 전체적인 코드 구조와 네이밍은 명확하다. 핵심 로직 흐름(CCH-CV-03 분기)도 인라인 주석과 spec 참조로 잘 설명된다. 다만 `executionsService['executionRepository']` private 필드 bracket 접근 패턴이 `getActiveExecutionStatus` 구현과 이를 mock 하는 테스트 4곳에서 중복되어, `ExecutionsService` 내부가 변경되면 여러 지점을 동시에 수정해야 하는 유지보수 부채가 남아 있다. 이 부분이 가장 큰 유지보수성 위험이다. 나머지 발견사항은 타입 정확성·조건 가독성·메서드 구조 유사성에 관한 INFO 수준이며, 즉각 차단 사유는 없다.

---

## 위험도

LOW
