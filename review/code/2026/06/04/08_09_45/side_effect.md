### 발견사항

- **[INFO]** `compactMessagesToTail` — 순수 함수, 입력 배열 무변경
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` lines 744-772
  - 상세: 새 배열 `[messages[0], ...messages.slice(cutIndex)]`를 반환한다. 입력 `messages` 배열 자체를 변경하지 않으며, 무변경 경로에서는 동일 참조를 그대로 반환한다. 전역 변수·파일시스템·네트워크 호출 없음. 부작용 없음.
  - 제안: 없음.

- **[WARNING]** `messages` 배열 in-place 교체 (`messages.length = 0; messages.push(...)`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `processMultiTurnMessage` 내 compacted 적용 블록 (diff lines 2329-2336)
  - 상세: 핸들러 내부의 로컬 `messages` 배열은 두 곳에서 `.length = 0` + `.push(...)` 패턴으로 in-place 교체된다. `compacted` 경로(신규)도 동일 패턴을 사용한다. 이 배열이 외부(caller 또는 `_resumeState`)에서 참조를 공유하고 있다면 의도치 않은 변경이 전파될 수 있다. 그러나 기존 코드도 이미 동일 패턴으로 `mem.messages`를 적용하고 있으므로, 신규 코드가 추가로 도입한 위험은 없다 — 기존과 동일한 위험 프로파일이다.
  - 제안: 이 패턴이 기존에도 사용되던 것이어서 신규 부작용은 아니지만, 향후 참조 안전성 검토 시 두 곳 모두를 대상으로 한다.

- **[INFO]** `thread` in-memory mutate (`mutable.runningSummary`, `mutable.summarizedUpToSeq`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 내 `injectMemoryContext` (기존 코드, 변경 없음)
  - 상세: 이 변경 집합에서 해당 mutate 로직은 신규가 아니다. 변경된 diff에서 이 패턴이 추가되거나 범위가 확장되지 않았다.
  - 제안: 없음.

- **[INFO]** `keepUserExchanges` 계산을 위해 `conversationThreadService.getThread(args.target)` 추가 호출
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` diff lines 1259-1271, 2294-2306
  - 상세: 기존에 `getThreadExcludingNode`를 사용하던 경로 외에, 동일 메서드가 이미 `scheduleMemoryExtraction`에서 호출되고 있다. 신규로 `getThread` 호출이 추가되었으나, 이 메서드는 읽기 전용이고 상태를 변경하지 않는다. `conversationThreadService` 또는 `args.target`이 없을 때 `undefined`로 안전하게 분기된다.
  - 제안: 없음.

- **[INFO]** `memoryMeta` 재할당 (`compactedMessages` 필드 추가)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` diff lines 2332-2336
  - 상세: `memoryMeta = { ...mem.memory, compactedMessages: ... }`로 스프레드 후 신규 필드를 추가하는 방식이다. 원본 `mem.memory` 객체는 변경되지 않는다 (스프레드 복사). 부작용 없음.
  - 제안: 없음.

- **[INFO]** 새 export `compactMessagesToTail` 공개 API 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` line 744
  - 상세: `export function compactMessagesToTail` 신규 추가. 기존 export 시그니처 변경 없음. 추가만이므로 기존 사용자(호출자)에 영향 없음.
  - 제안: 없음.

- **[INFO]** `injectMemoryContext` 반환 타입에 `keepUserExchanges: number` 필드 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `injectMemoryContext` 반환 타입 diff
  - 상세: private 메서드이므로 외부 공개 인터페이스 변경에 해당하지 않는다. 내부 호출자(3곳)는 모두 이 변경에 대응해 `keepUserExchanges`를 수신하도록 업데이트되었다. 누락된 호출자 없음.
  - 제안: 없음.

- **[INFO]** `meta.memory` 타입 확장 — `compactedMessages?: number` 옵셔널 필드 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` diff lines 2304-2308
  - 상세: 기존 `memory` 메타 객체에 옵셔널 필드가 추가된다. `undefined`이면 기존 소비자에게 투명하다. breaking change 없음.
  - 제안: 없음.

- **[INFO]** 테스트 파일 2개 (spec.ts) — 부작용 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts`, `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts`
  - 상세: 테스트 전용 헬퍼 함수(`assertPairingIntact`, `user`, `asst`, `toolResult`, `queueAnswer`, `queueSummary`)가 describe 스코프 내에 선언된다. 모듈 수준 전역 변수 도입 없음. `beforeEach`에서 상태 초기화가 올바르게 이루어진다.
  - 제안: 없음.

### 요약

이번 변경의 핵심인 `compactMessagesToTail`은 완전한 순수 함수로, 입력 배열을 변경하지 않고 새 배열을 반환하거나 동일 참조를 반환한다. 핸들러 통합 경로(`processMultiTurnMessage`)에서 `messages` 배열을 in-place 교체하는 패턴은 기존 코드와 동일한 방식이며, 신규 코드가 새로운 위험을 추가하지 않는다. 공개 API 변경은 신규 export 추가와 internal 메서드 반환 타입 확장에 그치며, 기존 호출자에 breaking change가 없다. 전역 변수·파일시스템·네트워크·이벤트/콜백 측면에서 의도치 않은 부작용은 발견되지 않았다.

### 위험도

LOW
