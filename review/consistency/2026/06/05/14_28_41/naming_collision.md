# 신규 식별자 충돌 검토 — memory-autoinject-extend-e102af

worktree: `.claude/worktrees/memory-autoinject-extend-e102af`
비교 범위: `git diff 9e65f853..HEAD`
검토일: 2026-06-05

---

## 발견사항

### [INFO] `DEFAULT_CONTEXT_SCOPE_N` — 중복 심볼, 단방향 재수출로 정리됨

- target 신규 식별자: `DEFAULT_CONTEXT_SCOPE_N` in `shared/conversation-context-schema.ts`
- 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:16` — main 브랜치에서 ai-agent 스키마가 직접 `export const DEFAULT_CONTEXT_SCOPE_N = 20;` 으로 소유
- 상세: worktree에서 `ai-agent.schema.ts`는 shared 모듈로부터 `DEFAULT_CONTEXT_SCOPE_N as SHARED_DEFAULT_CONTEXT_SCOPE_N` 로 import한 뒤 `export const DEFAULT_CONTEXT_SCOPE_N = SHARED_DEFAULT_CONTEXT_SCOPE_N;` 으로 재수출한다. 두 심볼이 공존하지 않고 재수출 체계로 단일 진실이 유지된다. 값도 동일(`20`). 충돌이 아닌 이관 패턴.
- 제안: 현 구조는 하위 호환성을 보존하면서 소유권을 shared 로 이전하는 올바른 방식이다. 이후 ai-agent 스키마의 `re-export` 를 deprecated 처리하고 호출처를 shared import 로 직접 전환할 로드맵을 comment 로 남겨두면 충분.

### [INFO] `mapTurnsToChatMessages` — ai-agent.handler 에서 shared 로 이전, 기존 로컬 정의 삭제 확인 필요

- target 신규 식별자: `mapTurnsToChatMessages` exported from `shared/conversation-context-injection.ts:63`
- 기존 사용처: main 브랜치 `ai-agent.handler.ts:521` — module-private `function mapTurnsToChatMessages` 로 존재
- 상세: worktree의 `ai-agent.handler.ts` 에서 기존 로컬 정의(`function mapTurnsToChatMessages`)가 제거되고 대신 `shared/conversation-context-injection.ts` 의 동명 함수를 사용한다. grep 결과 worktree `ai-agent.handler.ts` 에 로컬 정의가 없음을 확인. 중복 정의는 없다. `agent-memory-injection.ts:396` 주석에서 `mapTurnsToChatMessages` 를 참조 문서 형태로만 언급하는 것도 오해의 소지가 없음.
- 제안: 이상 없음.

### [INFO] `meta.contextInjection` 키 — ai-agent 기존 키와 동일, 의미 통일

- target 신규 식별자: `meta.contextInjection` — text-classifier·information-extractor 핸들러가 새로 추가하는 output meta 키
- 기존 사용처: `ai-agent.handler.ts:2016`, `2218` (main·worktree 동일) 및 spec `spec/4-nodes/3-ai/1-ai-agent.md:515`, `spec/conventions/node-output.md:90`, `spec/conventions/conversation-thread.md:259`
- 상세: `meta.contextInjection` 은 ai-agent 가 먼저 사용하고 있으며 spec 에도 정의된 공식 키다. target이 text-classifier·information-extractor 에도 동일 키를 동일 shape(`{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }`)로 추가하는 것은 spec/conventions/node-output.md §LLM 계열 공통 컨벤션과 정합된다. 의미 충돌 없음.
- 제안: 이상 없음.

### [INFO] `ConversationContextInjectionResult` — 기존 타입과 이름 유사성

- target 신규 식별자: `ConversationContextInjectionResult` in `shared/conversation-context-injection.ts:41`
- 기존 사용처: 기존 코드베이스에 동명 타입 없음 (grep 확인). main 브랜치 ai-agent 는 result shape 를 인라인 리터럴로 사용.
- 상세: 신규 공식 타입으로 도입. `information-extractor.handler.ts:29` 가 이를 import 해 로컬 `type ContextInjectionMeta = ConversationContextInjectionResult['injection']` 으로 축약 사용. 이름 충돌 없음.
- 제안: 이상 없음.

### [INFO] plan 파일명 `memory-autoinject-extend.md` — 기존 파일과 비충돌

- target 신규 식별자: `plan/in-progress/memory-autoinject-extend.md`
- 기존 사용처: main 브랜치 `plan/in-progress/` 에 해당 파일 없음. 유사 파일(`ai-context-memory-auto.md`, `ai-context-memory-followup-v2.md`, `ai-context-memory-research.md`)은 다른 기능 단위.
- 상세: 충돌 없음.
- 제안: 이상 없음.

---

## 요약

target 이 도입하는 신규 식별자 중 실질적 충돌(동일 이름·다른 의미)은 발견되지 않았다. `DEFAULT_CONTEXT_SCOPE_N` 은 main 브랜치 `ai-agent.schema.ts` 에 존재하지만 worktree 에서 shared 로 소유권 이전 후 ai-agent.schema 가 재수출 래퍼로만 남아 있어 이름 공간 충돌이 없다. `mapTurnsToChatMessages` 는 ai-agent.handler 로컬 정의가 삭제되고 shared 로 이전되어 중복 정의가 해소됐다. `meta.contextInjection` 은 spec 에 명시된 LLM 계열 공통 키로 세 노드에 동일 shape 로 확장되어 일관성을 강화한다.

## 위험도

NONE

---

BLOCK: NO
