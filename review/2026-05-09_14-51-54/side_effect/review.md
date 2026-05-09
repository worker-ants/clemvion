### 발견사항

- **[INFO]** `onModuleInit` 반환 타입이 `async` → `void` 로 변경됨
  - 위치: `execution-engine.service.ts`, `onModuleInit(): void`
  - 상세: NestJS `OnModuleInit` 인터페이스는 `any | Promise<any>` 를 허용하므로 호환성 문제는 없음. 단, `module.get(ExecutionEngineService).onModuleInit()` 을 `await` 하던 외부 테스트나 유틸이 있다면 반환값이 `undefined`(Promise 아님)로 바뀐다. 현재 코드베이스에서는 테스트가 `service.onModuleInit()` 을 `await` 없이 호출하므로 이미 일관성 있음.
  - 제안: 변경 의도가 명확하므로 현행 유지. 다른 곳에서 `await service.onModuleInit()` 패턴이 있는지 확인 권장.

- **[INFO]** `publisher` 필드가 `!` non-null assertion 으로 선언됐으나 런타임에서 `undefined` 방어 가드를 추가함
  - 위치: `continuation-bus.service.ts`, `private publisher!: Redis;`
  - 상세: TypeScript 컴파일러는 `!` 로 인해 `this.publisher` 가 항상 초기화됐다고 간주함. 런타임 가드와 타입 선언이 불일치. 컴파일 오류는 없지만 타입 신뢰도 저하.
  - 제안: `private publisher?: Redis;` 로 선언을 바꾸면 타입과 런타임 의미가 일치. 단, `onModuleInit` 이후 사용 시 `!` 단언이 필요한 내부 로직에 영향을 주므로 가드가 이미 선행된 경로에서는 non-null 로 처리 가능. 현행 유지도 수용 가능하나 `?` 로 통일하면 더 명시적.

- **[INFO]** 테스트에서 `onModuleInit()` 을 이중 호출하는 경로 발생
  - 위치: `execution-engine.service.spec.ts`, `recoverStuckExecutions` describe → `onModuleInit 은 recovery 를 트리거하지 않는다` 테스트
  - 상세: `beforeEach` 에서 이미 `registerContinuationHandlers()` 가 수동 호출됨. 해당 테스트에서 `service.onModuleInit()` 을 재호출하면 `registerHandlers()` + `registerContinuationHandlers()` 가 한 번 더 실행됨. `Map.set()` 은 덮어쓰기이므로 핸들러 중복 등록은 발생하지 않음. `registerHandlers()` 내 `componentRegistry.bootstrap()` 이 멱등성을 보장하는지 확인 필요.
  - 제안: 해당 테스트의 목적(recovery 미트리거 확인)상 실제 부작용 없음. 현행 유지 가능.

- **[INFO]** `releaseLock` 가드 로그 레벨이 `warn`, 나머지는 `error`
  - 위치: `continuation-bus.service.ts`, `releaseLock` 내 `if (!this.publisher)` 블록
  - 상세: `publish` 와 `acquireLock` 의 미초기화 가드는 `logger.error` 를 사용하나, `releaseLock` 은 `logger.warn` 을 사용. 모두 동일한 전제조건 위반(publisher 미초기화)이므로 레벨 불일치가 운영 알람 설정 시 혼란을 줄 수 있음.
  - 제안: 일관성을 위해 `releaseLock` 도 `logger.error` 로 통일하거나, 의도적인 차이라면 주석으로 명시.

- **[INFO]** Plan 문서의 체크리스트가 전부 미체크 상태
  - 위치: `plan/in-progress/fix-continuation-bus-bootstrap-race.md`
  - 상세: 코드 변경이 이미 완료됐음에도 모든 작업 항목이 `[ ]` 상태. PLAN 문서 라이프사이클 규약상 완료 항목은 `[x]` 로 갱신하고, 모든 항목 완료 후 `plan/complete/` 로 `git mv` 해야 함.
  - 제안: 완료된 항목 체크 후 REVIEW WORKFLOW 완료 시 `plan/complete/` 로 이동.

---

### 요약

이번 변경의 핵심은 NestJS 부팅 race 조건 수정으로, 의도치 않은 부작용은 발견되지 않았다. `continuation-bus.service.ts` 의 세 메서드에 추가된 `!this.publisher` 가드는 기존 TypeError crash 를 graceful degradation(safe-default 반환 + 로그)으로 전환하는 것이며 호출자 시그니처는 변경되지 않았다. `execution-engine.service.ts` 에서 `recoverStuckExecutions` 를 `onModuleInit` → `onApplicationBootstrap` 으로 이동한 것은 NestJS 라이프사이클 상 유효하며, 모든 모듈의 `onModuleInit` 완료 후 실행이 보장된다. 테스트의 직접 `publisher` 변조는 try/finally 로 복구되어 격리가 유지된다. 주요 관찰 사항은 타입 선언(`!`)과 런타임 가드의 의미론적 불일치, 로그 레벨 소폭 불일치, plan 문서 미갱신 정도이며 모두 운영 안전성에 영향을 주지 않는다.

### 위험도

**LOW**