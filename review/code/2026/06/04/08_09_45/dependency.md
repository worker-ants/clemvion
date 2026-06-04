# 의존성(Dependency) Review

## 발견사항

### 외부 패키지 변경 없음

이번 변경(HEAD commit `b678fe56`)에서 `package.json` 변경은 전무하다. 4개 파일 모두 기존 내부 모듈만 참조한다.

---

### 내부 의존성 변경 내역

**[INFO] agent-memory-injection.ts — 신규 export `compactMessagesToTail` 추가**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` (+57줄)
- 상세: 기존 `estimateTokens`(knowledge-base), `ConversationTurn`(shared), `ChatMessage`(llm interface) 등 이미 사용 중인 내부 의존성만 활용. 새 외부 패키지 없음.
- 제안: 없음. 현재 의존 그래프가 적절하다.

**[INFO] agent-memory-injection.spec.ts — `ChatMessage` 타입 import 추가**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts` 라인 40
- 상세: `import type { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface'` 추가. `type`-only import이므로 런타임 번들에 영향 없음. 이미 구현 파일에서 사용하던 경로.
- 제안: 없음.

**[INFO] ai-agent.handler.ts — `compactMessagesToTail`, `ConversationTurn` import 추가**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 220, 228 (diff 기준)
- 상세: `compactMessagesToTail`는 동일 디렉터리의 `agent-memory-injection`에서, `ConversationTurn`은 기존에 이미 이 파일이 의존하던 `conversation-thread.types`에서 추가. 새로운 모듈 레이어 의존은 없음.
- 제안: 없음.

**[INFO] ai-agent.memory.spec.ts — 기존 import 그대로 유지, 신규 없음**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts`
- 상세: `AiAgentHandler`, `ConversationThreadService`, `ExecutionContext`, `createEmptyConversationThread`, `AgentMemoryService` 5개 기존 import만 사용. diff 변경에 import 라인 추가 없음.
- 제안: 없음.

---

### 레이어 의존 방향 검토

**[INFO] nodes → modules 방향 단방향 유지**
- `agent-memory-injection.ts` 의존 그래프: `nodes/ai/ai-agent` → `modules/knowledge-base`, `modules/llm`, `modules/llm-config`, `modules/agent-memory`, `shared/conversation-thread`. 모두 기존 의존 경로이며 역방향(modules → nodes) 순환 없음.

---

## 요약

이번 변경은 외부 패키지를 전혀 추가하지 않는다. 모든 의존성 변경은 프로젝트 내부 모듈 간 관계로, `compactMessagesToTail` 신규 export 및 해당 타입 import 추가가 전부다. 기존 내부 의존 경로(`modules/llm`, `shared/conversation-thread` 등)만 사용하며 레이어 방향 위반 및 순환 의존도 없다. 라이선스·취약점·버전 충돌 리스크는 없다.

## 위험도

NONE
