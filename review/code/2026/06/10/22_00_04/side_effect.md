# 부작용(Side Effect) 리뷰

## 발견사항

### **[WARNING]** `deepFreeze` 가 원본 컨텍스트 값 객체를 직접 변이(mutate)시킴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `deepFreeze` 함수 + `freezeSharedCacheValues` 호출부 (라인 26-41, 212-215)
- 상세: `freezeSharedCacheValues({ ...context.nodeOutputCache })` 는 shallow copy 된 새 객체의 top-level 키를 분리하지만, 해당 값 객체(예: `context.nodeOutputCache['nodeA']`)는 원본과 동일한 참조다. `deepFreeze(v)` 는 그 공유 참조를 `Object.freeze` 로 변이시킨다. 즉, branch 1 이 먼저 실행되어 freeze 를 적용하면 원본 `context.nodeOutputCache` 가 가리키는 값 객체도 frozen 상태가 된다. `setNodeOutput(context-key, nodeId, output)` 은 `context.nodeOutputCache[nodeId] = output` 으로 top-level 키를 교체하므로 frozen 값의 내부를 쓰지는 않아 즉각 TypeError 는 발생하지 않는다. 그러나 같은 실행 컨텍스트에서 나중에 동일 값 객체를 참조하는 다른 경로(예: 표현식 평가 중 `nodeOutputCache[prevNodeId].output.someField` 에 dot-assign)가 있다면 dev/test 에서 예상치 못한 TypeError 를 받게 되는 숨은 부작용이 존재한다. production 에서는 freeze 가 건너뛰어지므로 이 차이가 결함 은닉(dev/test 에서 pass, prod 에서 silent mutate)으로 이어질 수 있다. 다만 현재 코드베이스에서 값 객체 내부에 직접 assign 하는 패턴은 확인되지 않아 실제 충돌 가능성은 낮다.
- 제안: freeze 는 shallow copy 된 값 객체의 deep clone 위에 적용하거나, 원본 값 객체를 건드리지 않도록 `deepFreeze(structuredClone(v))` 패턴을 검토한다. 또는 "freeze 는 공유 참조에 적용된다"는 사실을 JSDoc 에 명시해 의도임을 명확히 한다.

### **[WARNING]** `FREEZE_BRANCH_CACHE` 모듈 로드 시 `process.env.NODE_ENV` 를 읽어 전역 상수로 고정
- 위치: `/Volumes/project/private/clemvion/.claire/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` 라인 24 (`const FREEZE_BRANCH_CACHE = process.env.NODE_ENV !== 'production'`)
- 상세: 모듈 import 시점에 `process.env.NODE_ENV` 를 평가하여 상수로 고정한다. 테스트 환경에서 `jest.resetModules()` 없이 `process.env.NODE_ENV` 를 변경해도 이미 캐싱된 값이 적용된다. 이는 환경 변수 변경이 동적으로 반영되지 않는 숨은 상태다. 일반적인 Jest 실행(NODE_ENV=test)에서는 freeze 가 항상 활성화되므로 `production` 환경을 테스트로 시뮬레이션하는 케이스에서 의도와 다른 동작이 발생할 수 있다.
- 제안: 허용 가능한 수준의 트레이드오프이나, 이미 주석에 "production 미적용" 의도가 명시되어 있으므로 현 상태 유지 시 테스트에서 NODE_ENV 변경 후 모듈 재로드가 필요함을 문서화하는 것으로 충분하다.

### **[INFO]** `toEiaEvent` export alias 제거 — 동일 모듈 외부의 잔류 참조 없음 확인됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (alias 제거)
- 상세: `export const toEiaEvent = toChatChannelEvent` alias 가 삭제되었다. grep 결과 `codebase/backend/src` 에서 `toEiaEvent` 를 import 하거나 호출하는 런타임 코드는 잔류하지 않음(JSDoc 주석 1건만 존재). 테스트 파일도 `toChatChannelEvent` 로 모두 교체되었다. 외부 소비자 파괴(breaking change) 부작용은 없다.
- 제안: 별도 조치 불필요.

### **[INFO]** `registerContinuationHandlers` 및 `ContinuationBusService.on()` 제거 — 호출자 파괴 없음 확인됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (private 메서드 제거), `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` (`on()` 제거)
- 상세: `registerContinuationHandlers` 는 `private` 메서드로 외부 인터페이스가 아니며, `onModuleInit` 에서의 호출도 함께 제거되었다. `ContinuationBusService.on()` 은 Phase 2 에서 no-op 이었으며, grep 결과 런타임 호출처가 모두 제거되었다. 테스트 setUp 코드에서의 직접 호출 2건도 함께 삭제되었다.
- 제안: 별도 조치 불필요.

### **[INFO]** `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` deprecated 상수 제거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/system-status/system-status.constants.ts`
- 상세: 두 상수는 모듈 로드 시 env 를 읽어 고정하는 문제를 가진 deprecated 항목이었다. 잔류 사용처 grep 결과 codebase 전체에서 0건으로, 삭제로 인한 런타임 파괴가 없다.
- 제안: 별도 조치 불필요.

### **[INFO]** `onModuleInit` 에서 `registerContinuationHandlers()` 호출 제거 — 이벤트/콜백 체계 변경
- 위치: `execution-engine.service.ts` `onModuleInit` (라인 886-890)
- 상세: 이전에 `onModuleInit` 이 in-memory listener 를 등록하던 경로가 완전 제거되었다(full B3). continuation 이벤트 dispatch 는 이제 전적으로 BullMQ Worker(`continuation-execution.processor.ts`)가 담당한다. 이는 의도된 Phase 2 이관이며 이벤트/콜백 흐름이 in-memory → BullMQ 로 전환됨을 의미한다. 이 전환 자체는 의도된 설계이나, BullMQ Worker 가 실제로 등록·실행되지 않는 환경(예: 일부 단위 테스트 모듈)에서는 continuation 이벤트가 소비되지 않는 silent drop 이 발생할 수 있다.
- 제안: 통합 테스트 및 e2e 에서 BullMQ Worker 경유 continuation 흐름을 커버하는 케이스가 존재하는지 별도 확인 권장.

---

## 요약

이번 변경은 크게 세 묶음이다. (1) `toEiaEvent` alias 제거 및 테스트 rename — 순수 리네이밍으로 외부 상태 부작용 없음. (2) dead code(`registerContinuationHandlers`, `on()`, deprecated 상수) 제거 — 잔류 호출처가 없어 런타임 파괴 없음. (3) `freezeSharedCacheValues` 도입 — 핵심 부작용 주의: `deepFreeze` 가 shallow copy 의 값 객체(원본과 동일 참조)에 직접 `Object.freeze` 를 적용하므로, branch 실행 중 원본 컨텍스트의 cache 값 객체들이 dev/test 환경에서 frozen 상태가 된다. 현재 코드베이스에서 값 객체 내부에 직접 assign 하는 패턴이 없어 즉각적인 TypeError 는 발생하지 않지만, 미래 핸들러가 값 내부를 mutate 하려 할 때 dev/test 에서만 TypeError 가 발생하고 production 에서는 통과하는 진단 비대칭이 존재한다. 이 비대칭은 설계 의도(dev 에서 조기 검출)이지만, freeze 가 원본 공유 참조를 변이시킨다는 점이 명시적으로 문서화되지 않으면 혼란을 유발할 수 있다.

---

## 위험도

LOW
