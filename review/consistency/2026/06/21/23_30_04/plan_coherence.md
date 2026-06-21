## 발견사항

### [INFO] M-1 완료 후 planner 후속 SPEC-DRIFT 미처리 (비차단)
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 및 §6.1 step 3a/1.3/1.5/2.7 구현 참조 텍스트
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-1 항목 "planner 후속(비차단 SPEC-DRIFT)" 메모
- 상세: M-1 1단계(`AiConditionEvaluator`)·2단계(`AiMemoryManager`) 완료 시 기록된 것처럼, spec `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts`·`ai-memory-manager.ts` 가 아직 미등재되어 있고, §6.1 step 3a 구현 참조가 여전히 `ai-agent.handler.ts classifyToolCalls` 를 단독 진입점으로 기술한다. 02-architecture.md 계획은 이를 "M-1 전체 완료 시 일괄 처리" 로 예약한 상태다. 3단계(AiTurnExecutor) 구현 완료 후에도 같은 미처리가 잔존하므로 planner 후속 대상에 `ai-turn-executor.ts` 도 추가 등록이 필요하다.
- 제안: target spec 을 수정하는 것이 아니라, M-1 step 3 완료 직후 02-architecture.md M-1 항목의 planner 후속 메모에 `ai-turn-executor.ts` 를 추가 명시하고, M-1 전체 완료 시 spec frontmatter 및 구현 참조 갱신을 planner 에 위임한다.

### [INFO] `ai-agent-tool-connection-rewrite.md` 미해결 결정과 target 간 충돌 없음 (확인)
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §4 Tool Area (재작성 예정 박스), §1 config 스키마 (`toolNodeIds`/`toolOverrides` 제거 상태)
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 미해결 결정 (도구 등록 모델/시그니처/실행 컨텍스트/결과 라우팅/ND-AG-21 — 전부 TBD)
- 상세: target spec 은 §4 에 "재작성 예정 (현재 제거됨)" 박스를 명시하고, config 스키마에서 `toolNodeIds`/`toolOverrides` 를 이미 제거한 상태를 그대로 반영한다. tool-connection-rewrite 의 5개 미결정 사항을 target 이 일방적으로 채워 결정하는 내용이 없으므로 충돌 없음.
- 제안: 현재 상태 유지 — 충돌 없음.

### [INFO] `ai-context-memory-followup-v2.md` 잔여 backlog 와 target 간 충돌 없음 (확인)
- target 위치: `spec/4-nodes/3-ai/0-common.md` §10, `spec/4-nodes/3-ai/1-ai-agent.md` §1·§6·§7
- 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` 미체크 백로그 항목들 (injectMemoryContext 이중쿼리, ConversationThreadService.updateSummaryState, compactedMessages ND-AG-30 등재, §6.2 d.5 부연, V080 CONCURRENTLY, saveMemories 옵션객체, AgentMemoryAdminService 분리 등)
- 상세: target spec 의 §6.2 d.5/d.6·§7 meta.memory·agent_memory 서술은 이미 구현 완료된 항목(체크된 항목)에 상응한다. 미체크 항목들(코드 내부 리팩터·UX 폴리시·서비스 분리)은 spec 본문 변경을 수반하지 않거나 별도 spec 절(ND-AG-30 등재·§6.2 d.5 부연)로 처리될 예정이며, target 이 이를 선점해 결정하지 않는다.
- 제안: 현재 상태 유지 — 충돌 없음.

### [INFO] `exec-park-durable-resume.md` 와 target 간 선행 조건 확인 필요
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4·§7.5·주석 `_resumeState`/`_resumeCheckpoint` 생명주기 비교표
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` (1-ai-agent.md frontmatter `pending_plans:` 에 등재)
- 상세: target 의 §7.4 `_resumeCheckpoint` 생명주기 비교표와 §7.5 rehydration 단일 경로 서술은 exec-park-durable-resume 계획이 구현을 예약하는 내용과 겹칠 수 있다. 단, target spec 은 해당 내용을 이미 현행 구현 상태의 기술로 포함하고 있으며, exec-park-durable-resume 가 어떤 새로운 결정을 요구하는지 이 검토 범위에서 확인되지 않는다. 충돌보다는 추적 필요 수준.
- 제안: exec-park-durable-resume 착수 시 target §7.4~7.5 내용과 계획 목표 간 구체적 정합 검토.

## 요약

target(`spec/4-nodes/3-ai/0-common.md`·`1-ai-agent.md`) 은 M-1 step 3(AiTurnExecutor 추출, `--impl-done` 검토) 시점에서 진행 중 plan 들과 실질적 충돌이 없다. `ai-agent-tool-connection-rewrite.md` 의 5개 미결정(도구 등록 모델 등)은 target 이 "재작성 예정" 박스를 유지하며 일방 결정하지 않는다. `ai-context-memory-followup-v2.md` 미체크 backlog 는 target spec 변경이 아닌 코드 내부 개선이거나 별도 spec 절 위임 항목이라 충돌 없다. 유일한 추적 필요 사항은 M-1 1·2단계 완료 시와 동일한 "planner 후속 SPEC-DRIFT" — 3단계 완료 후 `ai-turn-executor.ts` 등재를 포함한 일괄 spec 정합이 M-1 전체 완료 시점에 여전히 대기 중이다. 이는 02-architecture.md 가 의도적으로 예약한 비차단 후속이므로 현 구현 진행을 차단하지 않는다.

## 위험도

LOW
