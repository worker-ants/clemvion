# Architecture Review — memory-strategy-extend-ie (IE persistent memory)

**Scope**: `git diff 21fa8194..HEAD -- codebase/`
**Reviewer role**: Architecture
**Date**: 2026-06-05

---

## CRITICAL

없음.

---

## WARNING

### W-1 — IE 가 `ai-agent/` 내부 비공개 파일을 직접 참조 (모듈 경계 침해)

**위치**
- `/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` L30–37
- `/codebase/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts` L12

**상세**
`information-extractor.handler.ts` 는 `'../ai-agent/agent-memory-injection'` 과
`'../ai-agent/ai-agent.schema'` 를 직접 import 한다. `ai-agent/index.ts` 는
`ai-agent.schema` 와 `ai-agent.component` 만 re-export 하며, `agent-memory-injection.ts`
는 공개 API 에 포함되지 않는다. 형제 모듈(`information-extractor`)이 다른 노드
(`ai-agent`)의 내부 구현 파일을 직접 참조하는 구조는 모듈 경계를 침해한다.

현재는 컴파일 에러 없이 작동하지만, `ai-agent/` 의 내부 리팩터링(파일 이동, rename,
삭제)이 `information-extractor` 를 암묵적으로 파괴할 수 있다. 결합도 위험은 낮지 않다.
`DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 두 상수도 `ai-agent.schema` 에
정의돼 있어 IE 는 ai_agent schema 의 스키마 변경에 간접 노출된다.

**제안**
`buildRecallBlock`, `appendStablePrefix`, `DEFAULT_MEMORY_*` 상수를
`nodes/ai/shared/agent-memory-injection.ts` 같은 공유 위치로 이동하거나, 최소한
`ai-agent/index.ts` 에 명시적으로 re-export 해 "공개 계약"을 선언한다. 이 조치만으로
IE 의 import path 를 `'../ai-agent'` 단일 진입점으로 교체할 수 있다.

---

### W-2 — `resolveMemoryTtlDays` / `scheduleMemoryExtraction` / `resolveMemoryStrategy` 3개 private 메서드가 ai-agent.handler 와 구현 중복

**위치**
- `information-extractor.handler.ts` L259–424 (`resolveMemoryStrategy`, `injectRecallPrefix`, `scheduleMemoryExtraction`, `resolveMemoryTtlDays`)
- `ai-agent.handler.ts` L950–1048 (동일 로직 4개 메서드)

**상세**
두 handler 가 동일한 로직을 각자 private 메서드로 보유한다. 현재 구현체를 diff 하면:

- `resolveMemoryTtlDays` — 두 파일 모두 비트 단위 동일. 함수이므로 공유 가능.
- `scheduleMemoryExtraction` — IE 판은 `selfNodeId` 인수를 받지 않는다(IE 는
  `getThreadExcludingNode` 가 아닌 `getThread` 사용). 이 차이가 의도적인지
  주석으로 설명되어 있지 않다.
- `injectRecallPrefix` — ai_agent 의 `injectMemoryContext` 중 `[5a]` 블록만 추출한
  하위 집합. summary_buffer / `[5b]` 없이 `[5a]`만 처리함은 명확하고 합리적이지만,
  `summary_buffer` 전략이 IE 에 추가되는 시점(또는 향후 공통 필드 추가 시) 두 곳을
  동시에 수정해야 한다.

단일 책임 원칙 위반은 아니지만, 응집도(shared utility module)가 낮고 미래 변경 시
두 파일을 동시에 수정해야 하는 散漫한 결합이 형성된다.

**제안**
`resolveMemoryTtlDays` 는 즉시 `agent-memory-injection.ts` 또는 공유 helper 로 추출
가능하다. `scheduleMemoryExtraction` 의 공통 로직(watermark / snapshot / enqueue)은
순수 함수로 분리하고, `selfNodeId` 유무 차이만 파라미터로 제어하는 방안을 검토한다.
단, 이번 PR 에서 기능 정확성이 이미 검증된 상태이므로 이 리팩터링은 후속 PR 에서
처리해도 블로킹 없이 수용 가능하다.

---

## INFO

### I-1 — `MultiTurnState` 에 `memoryConfig: Record<string, unknown>` 로 운반 — 타입 안전성 약함

**위치**
- `information-extractor.handler.ts` L158, L716–726, L1214

**상세**
`memoryConfig` 는 종결 경로(`buildMultiTurnFinalOutput`)가 context 없이
`scheduleMemoryExtraction` 에 넘기기 위해 state 에 실린다. 타입이
`Record<string, unknown>` 으로 약하게 선언돼 있어, `memoryConfig.model` 같은 접근이
`as string | undefined` 캐스트를 필요로 한다. ai-agent 는 이 패턴 없이 `state.model`
등 구체 타입 필드로 운반한다. 동일한 정보를 두 패턴으로 운반하는 차이가 생겼다.

**제안**
전용 인터페이스(`interface MemoryConfigSnapshot { memoryKey?: string; model?: string; ... }`)
를 선언하거나, `MultiTurnState` 에 직접 개별 필드로 올린다. 현재 구조도 동작상 안전하나,
필드 추가 시 캐스트 코드가 분산된다.

---

### I-2 — 멀티턴 종결 경로 추출 enqueue 가 `void ... .catch()` fire-and-forget — watermark 영속 없음

**위치**
- `information-extractor.handler.ts` L1211–1218

**상세**
단일턴 경로(`L585–594`)는 `await scheduleMemoryExtraction(...)` 로 watermark 를
단일 실행 내에서 처리하고 종료한다. 멀티턴 종결 경로는 `void ... .catch(() => undefined)`
로 fire-and-forget 을 쓰며, 반환된 watermark 는 버려진다. 멀티턴 종결 후 state 가
더 이상 resume 되지 않기 때문에 watermark 유실이 기능적으로 무해하다는 점은 주석에
명시되어 있다. 이 판단 자체는 옳다.

그러나 미래에 멀티턴-후-재시작 시나리오가 생기거나, 멀티턴 중간 turn 에서도 종결 경로가
호출될 수 있는 edge case 가 생기면 silent watermark 유실이 버그가 된다. 현재는 INFO
수준.

**제안**
주석에 "종결 후 state resume 없음 → watermark 영속 생략 의도적" 임을 명시한다
(이미 L1197에 부분적으로 기재됨). 추가로 `// TODO: if multi-turn restart is introduced, promote to await + state persist` 같은 forward-looking 주석을 달아 미래 위험을 표시한다.

---

### I-3 — contextScope 주입 후 recall 블록이 system 메시지에 append — ordering 주석이 부분적

**위치**
- `information-extractor.handler.ts` L480–515 (단일턴), L756–795 (멀티턴 첫 진입)

**상세**
ordering 은 `injectConversationContext` (contextScope turns) → `injectRecallPrefix`
(recall 블록 append) 순이다. ai_agent 의 `injectMemoryContext` 와 비교하면 spec §11.4
의 `[5a] recall → [6] volatile tail` 순서와 일치한다. IE 의 contextScope 가
persistent 전략일 때 `gateOnManualMemoryStrategy: true` 로 UI 에서 숨겨지므로, 런타임에서
`contextScope === 'none'` 일 가능성이 높다. 그러나 코드 레벨에서는 두 주입이 공존하며,
`persistent + contextScope != none` 조합이 이론적으로 가능하다(스키마 default 가
`none` 이지만 API 직접 호출 시 덮어쓸 수 있다).

이 공존 상황에서 recall 블록이 contextScope 주입 위에 append 됨으로써 `[contextScope turns]\n\n[recall block]` 순서가 되는데, spec §11.4 의 `[5a] recall → [6] turns` 역순이다.
ai_agent 와의 정렬 여부를 명확히 해야 한다.

**제안**
`persistent + contextScope != none` 조합을 validation 에서 명시적으로 경고하거나, 두
주입 순서를 spec §11.4 와 일치시킨다. 최소한 주석에 "persistent 전략이면 UI 에서
contextScope 는 숨겨지므로 런타임 공존 없음 — 방어 코드만"임을 기재한다.

---

### I-4 — IE handler 가 `ai-agent.schema.ts` 의 `DEFAULT_MEMORY_TOP_K`·`DEFAULT_MEMORY_THRESHOLD` 를 import — schema 모듈 의존 방향

**위치**
- `information-extractor.schema.ts` L12

**상세**
IE schema 가 ai-agent schema 의 export 상수를 re-use 한다. 이는 W-1 과 동일 계열
문제이나 severity 가 낮다. `ai-agent.schema` 가 `index.ts` 를 통해 공개되어 있으므로
import path `'../ai-agent/ai-agent.schema.js'` 는 내부 파일 직접 참조에 해당한다
(`'../ai-agent'` 경유가 아님). 기능 영향 없으나 모듈 경계 일관성 차원에서 지적한다.

---

## 요약

IE 의 `AgentMemoryService.recall` / `scheduleExtraction` 직접 호출 전략은 **결합도
측면에서 적절한 선택**이다. ai_agent 의 `injectMemoryContext` 는 `summary_buffer` /
persistent 양쪽을 처리하고 `tailMode`, `keepUserExchanges` 등 IE 에 불필요한 working-memory
관리까지 포함한다. 이를 통째로 재사용하면 과도한 의존이 발생하며, IE 는 IE 만의 단순한
`[5a] recall-only` 경로가 명확히 분리돼 있어 직접 구현이 오히려 SRP 에 부합한다.

핵심 경고(W-1)는 `agent-memory-injection.ts` 와 `ai-agent.schema.ts` 가 공유 표면으로
선언되지 않은 채 형제 모듈에서 직접 참조되는 **모듈 경계 침해**다. 이를 `ai-agent/index.ts`
re-export 또는 `shared/` 이전으로 해소하면 나머지 WARNING(W-2, 구현 중복)은
자연히 리팩터링 가능해진다. MultiTurnState 의 `memoryConfig: Record<string, unknown>` (I-1),
멀티턴 종결 watermark fire-and-forget (I-2), contextScope–recall 순서 (I-3) 는 현재
기능적으로 안전하나 미래 변경 시 주의 지점이다.

---

## 위험도

**MEDIUM** (W-1 모듈 경계 침해가 해소되지 않으면 ai-agent 내부 리팩터링이
information-extractor 를 암묵적으로 파괴할 수 있음)

---

BLOCK: NO
