### 발견사항

- **[INFO]** `finalizeFailedExecution` 신규 회귀 테스트는 재개(rehydrated) 경로만 직접 커버, 초기 세그먼트 호출부는 간접 커버
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:899-952` (신규 describe), 대비 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4390` (`runExecution` catch → `finalizeFailedExecution(savedExecution, err)`, opts 생략)
  - 상세: 신규 테스트는 `finalizeFailedExecution` 을 `{ rehydrated: true }` 로 직접 호출해 재개 경로(옛 버그 A 발생 지점)를 정확히 타겟팅한다. 초기 세그먼트(`runExecution` catch, `opts` 생략 = `rehydrated` 미설정)는 기존 `should emit EXECUTION_FAILED on error in background` (라인 5255)가 `execute()` 전체 흐름을 통해 간접적으로 태우지만, 이 기존 테스트는 status/emit 만 검증하고 `execution_failed` dispatch(`createMany` 호출)는 검증하지 않는다. `dispatchExecutionFailedNotification` 자체의 단위 테스트(라인 620~897)는 별도로 충실하나, "초기 세그먼트 catch → finalizeFailedExecution → dispatch" 전체 체인을 관통하는 direct 테스트는 없다. 헬퍼 추출이 behavior-preserving 리팩터이므로 위험은 낮지만, 대칭성을 위해 초기 세그먼트도 동일한 형태(rehydrated 옵션 미설정)로 직접 호출하는 테스트가 있으면 "양쪽 다 커버" 라는 주석의 의도(버그 A 류 재발 방지)가 더 명확히 보장된다.
  - 제안: `finalizeFailedExecution(saved, err)` (opts 생략) 케이스를 같은 describe 블록에 추가해 로그 라벨 분기(`rehydrated` 유무)와 무관하게 초기 세그먼트 종결도 동일하게 4가지(status/save/emit/dispatch)를 수행함을 명시적으로 검증. 선택 사항이나 "회귀 가드" 라는 테스트 이름의 의도를 완전하게 만든다.

- **[INFO]** 새 테스트가 `error.message` 값 자체(`'boom'`)를 dispatch payload 에서 검증하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:946-950`
  - 상세: `createMany` 호출 여부와 `type === 'execution_failed'` 만 검증한다. `savedExecution.error.message` 나 `dispatchExecutionFailedNotification` 에 전달된 `errMessage` 값(`'boom'`)이 실제로 이어지는지는 미검증. `dispatchExecutionFailedNotification` 자체의 sanitize 테스트(라인 863-896)가 메시지 전달 경로를 이미 별도로 강하게 검증하므로 실질 위험은 낮음 — 이 테스트는 "발사 여부(횟수·type)" 라는 좁은 목적에 집중한 설계로 보인다.
  - 제안: 필요 시 `expect(createMany.mock.calls[0][0][0].message).toContain('boom')` 한 줄 추가로 헬퍼가 error 객체를 올바르게 relay 하는지까지 봉인 가능. 필수는 아님.

- **[INFO]** Mock 캐스팅(`service as unknown as {...}`)이 private 메서드 직접 호출 패턴을 반복 사용
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:928-936` 및 파일 전반(예: 725-734, 811-816)
  - 상세: `finalizeFailedExecution` 이 `private` 이므로 `as unknown as {...}` 캐스팅으로 우회 호출한다. 이는 기존 파일 전반에서 이미 확립된 패턴(`dispatchExecutionFailedNotification`, `getNotificationsService` 등)과 일관되어 신규 이슈는 아니다. 다만 헬퍼가 두 호출부(초기·재개)에서 공유되는 구조상, private 메서드에 직접 접근하는 화이트박스 테스트보다는 `execute()`/`applyContinuation()` 같은 public 진입점을 통한 블랙박스 통합 테스트가 리팩터링 내성(구현 세부 변경에도 테스트 안정)이 더 높다. 현재는 화이트박스(직접 호출)+블랙박스(라인 5255 등) 혼합이라 균형은 적절.
  - 제안: 변경 불필요 — 기존 파일 컨벤션을 따른 선택으로 판단됨.

- **[INFO]** `emitSpy` 가 `eventEmitter.emitExecution` 을 스파이하며 원본 구현을 `mockResolvedValue` 로 대체
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:917-919`
  - 상세: `ExecutionEventEmitter` 는 real provider(라인 457)로 등록되어 있고, `emitExecution` 을 spy+mock 으로 override 한다. 이는 실제 emit 로직(WebsocketService.emitExecutionEvent 위임 등)을 건너뛰고 호출 여부/인자만 검증하는 의도적 설계로 보이며, `WebsocketService` 자체가 이미 mock(라인 566-574)이므로 emit 체인 하위는 어차피 mock 이다. 괴리 크지 않음.
  - 제안: 변경 불필요.

### 요약

신규 테스트(`finalizeFailedExecution — 초기·재개 세그먼트 공유 FAILED 종결`)는 PR #841 버그 A(재개 경로에서 `execution_failed` dispatch 누락)의 정확한 재발 지점을 타겟팅하는 잘 설계된 회귀 가드다. status 마킹·DB save·WS emit·notification dispatch 4가지를 한 번에 검증하고, 기존 `dispatchExecutionFailedNotification` 전용 테스트군(라인 620-897) 및 초기 세그먼트를 관통하는 `execute()` 통합 테스트(라인 5255)와 상호 보완적으로 커버리지 공백을 메운다. `finalizeFailedExecution` 헬퍼 추출 자체는 behavior-preserving 리팩터이며 두 호출부 모두 최소 하나 이상의 기존/신규 테스트로 exercise 되므로 회귀 위험은 낮다. 다만 신규 테스트가 재개 경로(`rehydrated: true`)만 직접 호출하고 초기 세그먼트(`rehydrated` 미설정) 직접 호출 케이스가 없어 "양쪽 경로 대칭 커버" 라는 회귀 가드의 완전성이 100% 는 아니다(간접 커버로 실질 위험은 낮음). Mock 구성과 테스트 격리(각 `it` 독립적 mock 설정, `beforeEach` 재생성)는 파일 전반의 확립된 컨벤션을 그대로 따르고 있어 가독성·격리 모두 양호하다.

### 위험도
LOW
