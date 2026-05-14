## 발견사항

### [CRITICAL] ConversationThread 핵심 기능에 대한 테스트 완전 부재
- **위치**: 전체 diff — `spec/conventions/conversation-thread.md`, `spec/5-system/4-execution-engine.md` 등 대규모 spec 신설
- **상세**: 이번 변경의 핵심인 ConversationThread 기능 자체에 대한 단위 테스트가 단 하나도 없다. 구체적으로 누락된 테스트:
  - `ConversationThreadService.appendPresentationTurn()` / `appendAiUserTurn()` / `appendAiAssistantTurn()` 동작
  - `contextScope` 별 주입 범위 (`none` / `thread` / `lastN`)
  - Cap 한계 (`MAX_INJECTED_TURNS`, `MAX_TURN_TEXT_CHARS`, `MAX_INJECTED_CHARS`) 경계값
  - `system_text` / `messages` 렌더링 모드
  - `createEmptyConversationThread()` 자체의 초기 상태 (`id='default'`, `nextSeq=0`, `turns=[]`, `totalChars=0`)
- **제안**: `conversation-thread.service.spec.ts`, `thread-renderer.spec.ts` 를 신설해 각 누적·주입 경로를 단위 테스트로 커버

---

### [CRITICAL] Background 격리 불변량(ND-BG-05) 테스트 부재
- **위치**: `spec/5-system/4-execution-engine.md` §3.3 — `{ ...thread, turns: [...thread.turns] }` snapshot
- **상세**: 스펙이 "background turn 이 메인 thread 에 영향 없고 그 반대도 마찬가지"를 invariant 로 선언하면서, 구현 명세는 `turns` 배열까지 새 인스턴스로 복사한다고 명시한다. 이 격리 계약을 검증하는 테스트가 없으면 shallow copy 로 구현했을 때 `turns` 배열 참조가 공유되어 오염이 생겨도 탐지 불가능하다.
- **제안**:
  ```ts
  it('background thread 가 main thread 를 오염시키지 않아야 한다', () => {
    const mainThread = createEmptyConversationThread();
    const bgThread = { ...mainThread, turns: [...mainThread.turns] };
    bgThread.turns.push(mockTurn);
    expect(mainThread.turns).toHaveLength(0);
  });
  ```

---

### [WARNING] 테스트 파일 import 경로 확장자 불일치
- **위치**: `buttons.spec.ts`, `chart.handler.spec.ts`, `form.handler.spec.ts` 등 파일 1~7
- **상세**: 기존 핸들러 import 는 `.js` 확장자를 사용(`'./chart.handler.js'`)하는데, 신규 추가된 `createEmptyConversationThread` import 는 확장자 없이 작성되었다. ESM 모드(`"type": "module"`) 환경에서는 확장자 누락이 런타임 오류로 이어진다.
  ```ts
  // 기존
  import { ChartHandler } from './chart.handler.js';
  // 신규 — 확장자 없음
  import { createEmptyConversationThread } from '../../../modules/execution-engine/conversation-thread/conversation-thread.types';
  ```
- **제안**: 프로젝트의 module resolution 설정 확인 후 `.js` 추가 여부 통일:
  ```ts
  import { createEmptyConversationThread } from '../../../modules/execution-engine/conversation-thread/conversation-thread.types.js';
  ```

---

### [WARNING] `manual-trigger.handler.spec.ts` 이중 컨텍스트 — 유지보수 리스크
- **위치**: `manual-trigger.handler.spec.ts` — `makeContext()` 함수(line 7) + 독립 `ctx` 객체(line 24)
- **상세**: 동일 파일에 두 개의 별도 컨텍스트 생성 경로가 있어 이번에 `conversationThread` 를 양쪽 모두에 추가해야 했다. 향후 `ExecutionContext` 인터페이스가 또 변경되면 동일 작업이 반복된다.
- **제안**: `ctx` 를 `makeContext()` 호출로 통일하거나, 두 경로의 존재 이유를 주석으로 명시

---

### [WARNING] `text_classifier` / `information_extractor` v1 push 미구현 상태에서 spec 은 "v1 push 적용"으로 선언
- **위치**: `spec/4-nodes/3-ai/0-common.md` §10 신설 + `spec/conventions/conversation-thread.md` §2.3
- **상세**: consistency review(`2026-05-14_17-19-21/plan_coherence`) 가 명시하듯, Phase 4 plan 은 `ai-agent.handler.ts` 만 다루고 두 핸들러의 push hook 태스크가 누락되어 있다. spec 이 "v1 push 적용" 을 선언했는데 구현이 없으면 spec 과 코드가 괴리된다. 이를 잡을 테스트도 없다.
- **제안**: spec write 전 두 핸들러 grep 확인:
  ```bash
  grep -r "appendAi\|conversationThread" backend/src/nodes/ai/text-classifier/ backend/src/nodes/ai/information-extractor/
  ```
  미구현이면 spec 표기를 "v2 추가 예정 (v1 미적용)"으로 수정

---

### [INFO] 핸들러 테스트가 `conversationThread` 를 passthrough 로만 추가 — 동작 검증 없음
- **위치**: 파일 1~8 전체
- **상세**: 8개 테스트 파일 모두 `conversationThread: createEmptyConversationThread()` 를 TypeScript 타입 오류 해소 목적으로만 추가했고, 핸들러가 이 필드를 올바르게 다루는지(읽는지, 수정하지 않는지, service 에 위임하는지)를 검증하는 assertion 은 없다.
- **제안**: 핸들러 execute 후 `context.conversationThread` 의 불변성(핸들러가 직접 mutate 하지 않아야 함)을 확인하는 테스트 추가

---

### [INFO] `$thread` 표현식 평가 테스트 없음
- **위치**: `spec/5-system/5-expression-language.md` §4.4 신설
- **상세**: `$thread.length`, `$thread.text`, `$thread.turns[0].data.email` 등 신규 표현식 변수에 대한 평가 테스트가 없다.
- **제안**: expression-language 단위 테스트에 `$thread` 관련 케이스 추가 (빈 thread, 누적된 thread, 범위 초과 케이스)

---

### [INFO] WebSocket payload `conversationThread` 필드에 대한 E2E 테스트 없음
- **위치**: `spec/5-system/6-websocket-protocol.md` §4.4.5
- **상세**: `execution.waiting_for_input` payload 에 `conversationThread` 가 선택적으로 포함된다고 명세했으나, 이를 검증하는 E2E/통합 테스트가 없다.
- **제안**: WS E2E 시나리오에 form → ai_agent 흐름을 추가해 `conversationThread` snapshot 포함 여부 검증

---

## 요약

이번 변경에서 기존 8개 테스트 파일은 `ExecutionContext` 인터페이스 변경에 맞춰 `conversationThread` 필드를 추가하는 최소한의 수정만 이루어졌다. 타입 오류 해소라는 즉각적인 목적은 달성했으나, 변경의 실질적인 핵심인 ConversationThread 기능(누적 service, 주입 렌더러, cap 로직, background 격리)에 대한 단위 테스트가 전혀 없다. 특히 Background 격리 불변량(ND-BG-05)은 shallow copy 구현 시 arrays 가 공유될 수 있어 버그 발생 시 탐지 수단이 없으며, ESM 환경에서 import 경로 `.js` 불일치도 런타임 오류 원인이 될 수 있다.

## 위험도

**MEDIUM** — 기존 테스트 자체는 유효하게 유지되지만, 신규 ConversationThread 기능 전체가 테스트 사각지대에 있어 구현 오류 발견이 늦어질 위험이 높다.