# Cross-Spec 일관성 검토 — engine-split (AiTurnOrchestrator 추출)

검토 모드: 구현 완료 후 검토 (--impl-done)
scope: `spec/5-system/4-execution-engine.md`
diff-base: `claude/engine-split-s1-nodebootstrap`

---

## 발견사항

### [INFO] `spec/5-system/4-execution-engine.md` 의 `code:` frontmatter 에 신규 파일 미등록

- **target 위치**: diff 에서 신규 생성된 파일들 (`ai-conversation-helpers.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` frontmatter `code:` 블록 (라인 4–7)
- **상세**: 현재 spec frontmatter 의 `code:` 항목은 `codebase/backend/src/modules/execution-engine/**` 로 glob 을 사용하므로 신규 파일이 자동 포함된다. 그러나 `spec/conventions/interaction-type-registry.md` 의 `code:` 섹션 (라인 6–11) 은 `WaitingInteractionType` 의 단일 진실 위치로 `execution-engine.service.ts` 를 명시적으로 핀한다 (`§1.1 단일 진실 위치` 표). `AiTurnOrchestrator` 가 `execution-engine.service.ts` 에서 import (`import type { WaitingInteractionType } from './execution-engine.service'`) 하므로 단일 진실 위치는 그대로이지만, spec 에는 `engine-driver.interface.ts` 가 새로운 DI 토큰·인터페이스 계층으로 존재한다는 사실이 반영되어 있지 않다. 정합성 권장.
- **제안**: `spec/conventions/interaction-type-registry.md §1.1` 표 "Backend" 행에 `engine-driver.interface.ts` 가 새 계층으로 추가됐음을 주석 또는 별도 행으로 반영 (단순 sync — WaitingInteractionType SoT 위치 변경 아님). 또는 추후 spec-sync 패스 시 통합.

---

### [INFO] `interaction-type-registry.md §1.1` — `WaitingInteractionType` 정의 단일 진실 코드 위치 pin 이 여전히 `execution-engine.service.ts` 단일

- **target 위치**: `ai-conversation-helpers.ts` 파일 주석 라인 50–54 (C-1 step3 W3 설명), `ai-turn-orchestrator.service.ts` 라인 1697–1700
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/interaction-type-registry.md §1.1` 표 (라인 29–33)
- **상세**: 코드 주석은 `WaitingInteractionType` 정의가 `interaction-type-registry.md §1.1 핀에 따라 엔진 파일(execution-engine.service.ts)에 잔류` 한다고 명시하며 실제로도 그렇게 구현돼 있다. Orchestrator 는 `import type` (런타임 소거)만 사용하므로 ES module 순환은 없다. spec 의 단일 진실 매트릭스 `§1.1` 표와 실제 코드가 일치하는 **정합 상태**다. 충돌 없음.
- **제안**: 해당 없음 (현재 정합).

---

### [INFO] `spec/5-system/4-execution-engine.md §1.3` — `_resumeCheckpoint` 영속 로직이 `AiTurnOrchestrator` 로 이관됐으나 spec 본문은 여전히 `engine` 단일 주체로 기술

- **target 위치**: `ai-turn-orchestrator.service.ts` 의 `emitAiWaitingForInput` (라인 1993~) 및 `handleAiMessageTurn` 내 NodeExecution.outputData 영속 블록
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §1.3` 의 "보존 예외 — `_resumeCheckpoint`" 설명 (라인 163–170). 특히 "waiting_for_input 진입(`emitAiWaitingForInput`)과 매 turn 영속(`handleAiMessageTurn`) 시점에 엔진이 ... `NodeExecution.outputData._resumeCheckpoint` 에 DB 영속한다" 표현
- **상세**: 현재 spec 은 영속 주체를 "엔진(execution-engine.service)"으로 서술하나, 이 구현이 `AiTurnOrchestrator` 로 이관됐다. 기능적 동작(체크포인트 persist, credential strip, `_resumeState` 제거 정책)은 보존됐으므로 **스펙 의도와 동작은 일치**하지만, 서술 주체가 정확하지 않다.
- **제안**: spec §1.3 본문 "엔진이 ..." 표현을 "실행 엔진(`AiTurnOrchestrator.emitAiWaitingForInput` / `handleAiMessageTurn`)이 ..." 로 갱신. 단 기존 `code:` glob 이 `execution-engine/**` 전체를 포함하므로 기능 커버리지 자체는 변경 없음.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` — `execution-engine.service.ts` 직접 참조 항목이 잔류

- **target 위치**: 해당 없음 (diff 내 ai-agent.md 미변경)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 항목 (라인 7) — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- **상세**: spec ai-agent.md 는 멀티턴 AI lifecycle (§7.x 섹션들) 의 구현 근거 코드로 `execution-engine.service.ts` 를 단독 참조한다. 실제 AI 멀티턴 로직의 일부가 `AiTurnOrchestrator` 로 이관됐으므로, 이 단독 참조는 spec 의 코드 커버 의도와 일부 벗어난다. 기능 의미 충돌이 아니라 code 포인터 불완전성.
- **제안**: spec/4-nodes/3-ai/1-ai-agent.md frontmatter 에 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 를 추가. 추후 spec-sync 패스 시 처리 가능.

---

### [INFO] `spec/conventions/interaction-type-registry.md §1.2` `ai_conversation` 행 "Backend emit 위치" 기술 — 이관 후 갱신 필요

- **target 위치**: diff 내 orchestrator 이관 완료
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/interaction-type-registry.md §1.2` 값-분기 매트릭스 표 `ai_conversation` 행 (라인 44), 하단 "재개(resume) turn 라우팅 진입점" 주석 (라인 52)
- **상세**: 매트릭스는 `ai_conversation` 의 "Backend emit 위치" 를 "ai-agent.handler multi-turn waiting (interactionType meta)" 로 기술하고, 재개 라우팅 진입점으로 `dispatchResumeTurn → handleAiResumeTurn` 경로를 설명한다. `handleAiResumeTurn` / `processAiResumeTurn` 이 이제 `AiTurnOrchestrator` 에 존재하므로 주석의 파일 위치 맥락이 달라졌다. 그러나 매트릭스 자체의 **값(enum value)·분기 위치·동작 의미**는 변경이 없다 — 순수 파일 주체(어느 서비스에 메서드가 있는가) 서술만 달라진 것이다.
- **제안**: `§1.2` 하단 "재개 turn 라우팅" 주석에서 경로 묘사 (`dispatchResumeTurn → handleAiResumeTurn`) 시 `AiTurnOrchestrator` 서비스 이름을 명시적으로 추가. 분기 매트릭스 기능 자체는 정합.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.5` rehydration 경로 기술 — `AiTurnOrchestrator` 위임 명시 없음

- **target 위치**: `ai-turn-orchestrator.service.ts` `handleAiResumeTurn` (라인 1739), `processAiResumeTurn` (라인 1849)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.5` (rehydration 절차 설명) 및 `§1.3` "소비" 단락 마지막 문장 (`... → handleAiResumeTurn → processAiResumeTurn(단발 turn 처리기)에 전달해 그 turn 을 처리`)
- **상세**: spec 의 §1.3 설명은 `handleAiResumeTurn` / `processAiResumeTurn` 이 어느 클래스에 있는지 명시하지 않는다. 코드 동작은 보존됐고 메서드 이름도 동일하므로 **기능적 충돌은 없다**. 단 spec 을 읽는 사람이 해당 메서드가 `ExecutionEngineService` 에 있다고 오해할 수 있다 (`code:` frontmatter 에 `execution-engine.service.ts` 명시).
- **제안**: §1.3 "소비" 단락 또는 §7.5 에서 `handleAiResumeTurn` / `processAiResumeTurn` 이 `AiTurnOrchestrator` 서비스에 속한다는 주석을 추가. 불급 시 추후 spec-sync 패스에서 통합.

---

## 요약

이번 변경(C-1 step2 — `AiTurnOrchestrator` 추출)은 `ExecutionEngineService` 의 AI 멀티턴 수명주기 메서드를 전담 orchestrator 서비스로 이관하면서, `WaitingInteractionType` 정의는 `interaction-type-registry.md §1.1 핀` 에 따라 엔진 파일에 그대로 잔류시키고 `import type` 으로만 참조하는 구조다. 핵심 데이터 모델(`RehydrationError` 코드, `WaitingInteractionType` 값, 상태 전이 규칙, `_resumeCheckpoint` / `_resumeState` 영속 정책, `execution.ai_message` WS 이벤트 shape, `details.retryable` 분류 기준)은 모두 기존 spec(4-execution-engine §1.1/§1.3/§7.5, conventions/node-output Principle 3.2.1, conventions/interaction-type-registry §1.1/§1.2, 6-websocket-protocol §4.4)의 계약을 충실히 따르며 **CRITICAL 또는 WARNING 수준의 충돌은 없다**. 발견된 항목은 전부 INFO 등급으로, 신규 파일(ai-turn-orchestrator.service.ts / ai-conversation-helpers.ts / engine-driver.interface.ts)이 추가됨에 따라 spec 본문의 "주체(어느 서비스/파일에 코드가 있는가)" 서술이 실제 코드 위치와 일부 엇갈린 것들이며, 추후 spec-sync 패스에서 정정하면 충분하다.

## 위험도

NONE
