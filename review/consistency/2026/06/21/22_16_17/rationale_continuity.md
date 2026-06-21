# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (scope=`spec/4-nodes/3-ai`, diff-base=`origin/main`)
대상 커밋: M-1 2단계 — `AiMemoryManager` 추출 (`e5a5ad76`·`5b544621`·`5a193984`)

---

## 발견사항

발견된 CRITICAL / WARNING 항목 없음.

아래는 확인된 보존 항목 목록 (INFO 참고 수준).

---

### [INFO] §12.9 `memoryStrategy` 별도 필드 원칙 — 완전 보존

- target 위치: `ai-memory-manager.ts:75-81` `resolveMemoryStrategy()`, `ai-agent.handler.ts:1096,1112`
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.9` — "enum 에 `auto` 를 섞지 않고 별도 1급 필드 `memoryStrategy` 를 도입. `manual` 기본 경로는 contextScope 5필드 완전 무변경."
- 상세: `resolveMemoryStrategy` 가 `manual`/`summary_buffer`/`persistent` 3값만 인정하고 unknown → `manual` fallback. 핸들러는 `if (memoryStrategy === 'manual')` 분기로 manual 경로를 아예 manager 를 거치지 않는 경로로 보존. contextScope 5필드(contextScope/contextScopeN/contextInjectionMode/includeToolTurns/excludeFromConversationThread)는 manager 내부에서 읽히지 않는다.
- 평가: §12.9 "manual 경로 완전 무변경" 핵심 불변식을 구조적으로 보장.

---

### [INFO] §12.10 language-aware lite 휴리스틱 (정확 tokenizer 미채택) — 완전 보존

- target 위치: `ai-memory-manager.ts:294` `estimateWorkingMemoryTokens(...)`, `shared/agent-memory-injection.ts` 공유 헬퍼 위임
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.10` — "정확 tokenizer(js-tiktoken 등 신규 의존성) 도입 금지. A4 lite(스크립트군별 chars-per-token 가중: Latin ~4, CJK ~1.7, 그 외 ~3) 근사 개선. v3 로드맵 잔존."
- 상세: `AiMemoryManager` 는 `agent-memory-injection.ts:estimateWorkingMemoryTokens`를 재사용하며 신규 tokenizer 의존성을 도입하지 않는다. 신규 npm 패키지 import 없음.
- 평가: "신규 의존성 0 원칙" 및 v3 로드맵 유보 결정 준수.

---

### [INFO] §12.11 안정 프리픽스 ordering (recall→summary 안정, volatile tail 후방) — 완전 보존

- target 위치: `ai-memory-manager.ts:249-296` (appendStablePrefix → tail prepend 순서)
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.11` — "[5a] recall → [5b] summary → [6] volatile tail. 요약·회수 블록은 system_text 안정 프리픽스에 배치, 요약 갱신은 임계치 도달 시에만."
- 상세: `appendStablePrefix(finalSystemPrompt, recallBlock, summaryBlock)` 로 [5a]+[5b] 를 system prompt 에 먼저 반영한 뒤, `messages` 모드에서는 `tailMessages` 를 system 다음 위치에 `splice` 로 prepend. `system-only` 모드(multi-turn 누적)에서는 꼬리를 재주입하지 않고 system 메시지만 갱신. `update.summarized` 가 true 일 때만 `mutable.runningSummary` / `mutable.summarizedUpToSeq` mutate(임계치 도달 시에만 갱신 불변식).
- 평가: 캐시 안정 프리픽스 보호 불변식 완전 보존.

---

### [INFO] §12.12 `summaryModelConfigId`/`extractionModelConfigId` — ModelConfig id 저장·provider 디커플 — 완전 보존

- target 위치: `ai-memory-manager.ts:109-226` (`summaryModelConfigId` → `llmService.resolveConfig` 경로), `agent-memory-injection.ts:651` (`extractionModelConfigId`)
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.12` 재번복 결정 — "등록 ModelConfig 선택 (`config.id` 저장). 세 필드를 `embeddingModelConfigId`/`summaryModelConfigId`/`extractionModelConfigId` 로 개명. 미설정 시 노드 main llmConfig 폴백(기존 동작 100% 유지). provider 디커플."
- 상세: `summaryModelConfigId` 설정 시 `llmService.resolveConfig(args.summaryModelConfigId, workspaceId)` 로 독립 config 해소, `resolvedSummaryModel = summaryLlmConfig.defaultModel`. 미설정이면 `args.llmConfig` + `args.model` 그대로 사용(폴백). `extractionModelConfigId` 도 `sharedScheduleMemoryExtraction` 로 동일 패턴 위임.
- 평가: "모델명 문자열 저장" 안(초기 v1 기각 → 재도입)이 재도입되지 않았음. 재번복 결정(config.id) 준수.

---

### [INFO] §12.13 요약 유실 graceful degradation — 완전 보존

- target 위치: `ai-memory-manager.ts:211-247` — `thread?.runningSummary` / `thread?.summarizedUpToSeq` nullable 처리
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.13` — "유실된 요약을 재요약으로 복구하지 않고, 원문 thread 로 컨텍스트를 재구성하는 graceful degradation."
- 상세: `priorSummary`/`priorUpToSeq` 가 undefined 이어도 `buildSummaryBufferUpdate` 가 null-safe 하게 처리(재요약 강제 없음). manager 자체는 요약 유실 시 재요약 시도 없음.
- 평가: "요약 손실은 토큰 효율 저하일 뿐 대화 무결성 손상이 아니다" 원칙 보존.

---

### [INFO] §12.14 멀티턴 누적 messages 물리 압축 — user 경계 불변식 보존

- target 위치: `ai-memory-manager.ts:262-287` (`keepUserExchanges` 도출), `ai-agent.handler.ts:2048-2067` (`compactMessagesToTail` 호출)
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.14` — "user 메시지 경계에서만 잘라 tool_use↔tool_result 페어링 보존. manual 은 압축 대상 아님."
- 상세: `keepUserExchanges` 는 `fullTurns` (self 포함 전체 thread) 에서 `seq > summarizedUpToSeq` 구간의 `ai_user` / `presentation_user` turn 수로 계산. 핸들러가 `mem.memory.summarized && mem.keepUserExchanges > 0` 조건에서만 `compactMessagesToTail` 호출. `manual` 분기에서는 manager 자체를 거치지 않으므로 물리 압축 코드 경로에 진입하지 않음.
- 평가: user 경계 보존 불변식 및 manual 회귀 0 불변식 모두 보존.

---

## 요약

M-1 2단계 `AiMemoryManager` 추출은 `ai-agent.handler.ts` 에서 자동 메모리 전략 관련 로직(resolveMemoryStrategy / injectMemoryContext / scheduleMemoryExtraction)을 행위 보존 방식으로 분리한 refactoring 이다. 검토 결과 `spec/4-nodes/3-ai/1-ai-agent.md §12.9~12.14` 에 박힌 모든 Rationale 불변식이 구조적으로 보존되었다. 과거에 기각된 대안(contextScope enum 확장 / 정확 tokenizer 도입 / 모델명 문자열 저장 / 재요약 강제 복구 / arbitrary turn 경계 압축)이 재도입된 흔적이 없으며, 합의된 설계 원칙(manual 경로 완전 무변경 · 안정 프리픽스 ordering · ModelConfig id 저장 · graceful degradation · user 경계 압축)은 모두 코드 구조 레벨에서 강제된다. Rationale 연속성 위반 없음.

---

## 위험도

NONE
