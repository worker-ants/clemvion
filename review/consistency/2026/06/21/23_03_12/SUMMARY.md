# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — WARNING 2건(중복 통합 1건), INFO 다수. 모두 선행 단계(M-1 1·2단계) spec 동기화 미반영에서 비롯된 드리프트이며 Step 3 자체가 새로운 모순을 도입하지 않는다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Convention-Compliance (통합) | `1-ai-agent.md` frontmatter `code:`에 M-1 1·2단계 신설 파일(`ai-condition-evaluator.ts`, `ai-memory-manager.ts`) 미등재 — `spec-impl-evidence.md §2.1` `code:` 필드 매치 의무 위반. plan 은 "M-1 전체 완료 시 일괄 처리" 비차단 후속으로 명시 중. | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md §2.1` | 3단계 PR 시점에 `ai-condition-evaluator.ts`, `ai-memory-manager.ts`, `ai-turn-executor.ts` 세 파일을 `code:` 목록에 등재. **developer 판정: spec/ read-only 권한이라 developer 가 직접 처리 불가 — planner 위임(비차단 잔존).** |
| 2 | Cross-Spec | `1-ai-agent.md` §7 각주의 `ToolCallTrace` shape 기술(`startedAt?`/`finishedAt?` 미포함)이 `6-websocket-protocol.md §4.4`(동일 필드 영속 명시)와 상충. 구현은 WS spec 권위를 따르므로 impl-prep 비차단. | `spec/4-nodes/3-ai/1-ai-agent.md` line 530 | `spec/5-system/6-websocket-protocol.md §4.4` (lines 605·646·1026) | Step 3 chain 종료 후 planner 가 `1-ai-agent.md` §7 각주를 `{ toolCallId, name, providerKey, status, durationMs, startedAt?, finishedAt?, error? }` 로 갱신. (pre-existing drift — 본 refactor 와 직교) |

## Developer 판정 (비차단 근거)

본 작업은 **behavior-preserving refactor**(M-1 3단계 `AiTurnExecutor` 추출)로 spec 본문·shared 헬퍼·`ToolCallTrace` shape·메모리/조건 동작을 일절 변경하지 않는다.

- **WARNING #1·#2 + INFO #1~#7**: 전부 M-1 1·2단계(PR #665·#668) 이후 누적된 **pre-existing spec-drift** 로 plan §M-1 의 "planner 후속(비차단 SPEC-DRIFT)" 으로 이미 추적 중. `code:` frontmatter 등재·§7 각주·§6.1 구현 참조 경로 갱신은 **developer 의 spec 쓰기 권한 밖**(CLAUDE.md: developer `spec/` read-only) → planner 일괄 위임 항목. 본 refactor 가 새 모순을 도입하지 않으므로 비차단.
- **INFO #8 (일반 도구 stub 변경 금지)**: 준수 — stub 동작 코드를 verbatim 이전만 했고 변경 없음. backend unit 7302 PASS 로 입증.
- **INFO #11 / §12.14 (`compactMessagesToTail` 호출 순서)**: 준수 — 멀티턴 루프 전체를 verbatim 이전했으므로 요약 갱신→압축 순서가 핸들러 원본과 byte-identical. ai-agent.memory.spec 포함 unit/e2e 전수 PASS 로 입증.
- **spec build-guard**(`spec-status-lifecycle`/`spec-pending-plan-existence`, frontend vitest) **223 PASS** — spec status lifecycle 무결성 경험적 확인.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Plan-Coherence / Convention-Compliance (통합) | `1-ai-agent.md` §6.1 step 3a 구현 참조 `ai-agent.handler.ts classifyToolCalls` — 실제 구현은 M-1 1단계(PR #665)에서 `ai-condition-evaluator.ts` 로 이전됨. plan 이 비차단 SPEC-DRIFT로 추적 중. | `spec/4-nodes/3-ai/1-ai-agent.md` line 370 | M-1 전체 완료 시 planner 가 `"구현: AiConditionEvaluator.classifyToolCalls (ai-condition-evaluator.ts)"` 로 정정. |
| 2 | Plan-Coherence / Convention-Compliance (통합) | `1-ai-agent.md` §6.1 step 1.3/1.5/2.7 구현 참조가 `ai-agent.handler.ts` 암시이나 M-1 2단계(PR #668)에서 `ai-memory-manager.ts` 로 이전됨. plan 이 비차단 후속으로 추적 중. | `spec/4-nodes/3-ai/1-ai-agent.md §6.1` | M-1 전체 완료 시 planner 가 관련 구현 참조 경로 일괄 갱신. |
| 3 | Cross-Spec | `AiTurnOrchestrator`(엔진 레이어)와 `AiTurnExecutor`(노드 레이어) 계층 구분이 `1-ai-agent.md §6` 에서 invisible. `spec/5-system/4-execution-engine.md §1.3` 은 명시하므로 모순 없음 — 보완 권장. | `spec/4-nodes/3-ai/1-ai-agent.md §6` 서두 | Step 3 chain 종료 후 planner 가 §6 서두에 계층 구조 주석 추가. |
| 4 | Convention-Compliance | `0-common.md` frontmatter `id: common` — basename `0-common` 기반 권장 규약 불일치. 동 영역 타 파일은 basename 기반 준수. | `spec/4-nodes/3-ai/0-common.md` frontmatter | `id: 0-common` 으로 변경하거나 규약에 "번호 prefix 생략 허용" 예외를 명시. |
| 5 | Convention-Compliance | `1-ai-agent.md` 에 `## Rationale` 표준 헤딩 없음 — `## 12. Rationale` 번호 형식으로 운영 중(`#rationale` slug 직접 접근 불가). | `spec/4-nodes/3-ai/1-ai-agent.md` | `## 12. Rationale` → `## Rationale` 표준화 또는 최상위 `## Rationale` 추가로 3섹션 구조 충족. |
| 6 | Convention-Compliance | `0-common.md §5`·`§9`에서 `output.result` wrapper 근거를 "CONVENTIONS Principle 11"로 오인용. 실제 근거는 Principle 8.2. | `spec/4-nodes/3-ai/0-common.md §5·§9` | `(CONVENTIONS Principle 8.2)` 로 수정 또는 Principle 8·11 관계를 규약 문서에 명시. |
| 7 | Convention-Compliance | `0-common.md §11.7` — "default 값과 일치하면 echo 에서 생략" 정책이 Principle 7("비민감 값 항상 echo") 본문에 없는 해석을 도입. | `spec/4-nodes/3-ai/0-common.md §11.7` | Principle 7 에 "optional 필드 선택적 echo" 조항을 명시하거나 §11.7에서 undefined 생략과 default 일치 생략을 구분 서술. |
| 8 | Plan-Coherence | `ai-agent-tool-connection-rewrite.md §1` 디자인 결정 5개 전부 TBD — AiTurnExecutor 추출 시 일반 도구 stub 동작을 변경하면 CRITICAL이 됨. | `1-ai-agent.md §6.1 step 3a` "미구현(Planned)" | 3단계 구현 시 stub 동작 변경 없이 handler → executor 동일 코드 이전만 수행. **(준수 확인)** |
| 9 | Plan-Coherence | `ai-context-memory-followup-v2.md` backlog 미완료 — step 3 와 직교하나 `AiTurnExecutor` 가 `AiMemoryManager` 를 주입받아 호출하는 구조를 유지해야 backlog 추후 구현 가능. | `1-ai-agent.md §6.1 step 1.5·§6.2 d.5` | `AiMemoryManager` collaborator 주입 구조 유지. **(준수 확인 — 생성자 주입)** backlog 별도 처리. |
| 10 | Naming-Collision | `ToolCallTrace` vs `PresentationCallTrace` — 유사 이름의 별개 trace 인터페이스. 의미·스코프 다르고 기능 충돌 없음. | `ai-turn-executor.ts:62` vs `agent-tool-provider.interface.ts:168` | `ToolCallTrace` JSDoc 에 "provider tool(KB·MCP) 전용 — `render_*`의 `PresentationCallTrace` 와 구별" 명시. |
| 11 | Rationale-Continuity | `processMultiTurnMessage` polymorphic 계약 보존·co-location 규칙·`IExecutionEventEmitter` 미도입·§12.9~12.14 불변식 — 모두 현행 구현 설계에서 준수 확인. | `ai-turn-executor.ts` 전반 | §12.14 `compactMessagesToTail` 호출 위치(요약 갱신 이후)가 핸들러 이동 전과 동일 — verbatim 이전이라 보장. **(준수 확인)** |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건 (frontmatter `code:` 미등재, `ToolCallTrace` shape 기술 드리프트). INFO 3건. |
| Rationale-Continuity | NONE | 핵심 결정 전부 준수 확인. §12.14 호출 순서 확인 권장(INFO). |
| Convention-Compliance | LOW | WARNING 1건 (frontmatter `code:` 미등재 — Cross-Spec과 동일 이슈). INFO 4건. |
| Plan-Coherence | NONE | plan 추적 중인 비차단 SPEC-DRIFT만 확인. 일반 도구 stub 변경 금지 주의(INFO). |
| Naming-Collision | NONE | 실질 충돌 없음. `ToolCallTrace` / `PresentationCallTrace` 명 혼동 가능성(INFO). |

## 권장 조치사항

1. **(BLOCK 없음 — 착수/진행 가능)** M-1 3단계(`AiTurnExecutor` 추출) 구현. Critical 차단 사유 없음.
2. **(planner 위임 — developer spec 권한 밖)** `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts`, `ai-memory-manager.ts`, `ai-turn-executor.ts` 세 파일 등재 (WARNING #1). plan §M-1 "planner 후속" 일괄 처리.
3. **(준수 확인)** 일반 도구 stub 동작 무변경 behavior-preserving 이전 (INFO #8).
4. **(준수 확인)** `AiTurnExecutor` 내 `memoryManager.injectMemoryContext`/`compactMessagesToTail` 호출 위치가 요약 갱신 이후로 핸들러 원본과 동일 — verbatim 이전 (§12.14 불변식, INFO #11).
5. **(Step 3 chain 종료 후 planner)** §7 각주 `ToolCallTrace` shape 갱신(WARNING #2), §6.1 구현 참조 경로 일괄 갱신, §6 서두 계층 구조 주석 추가를 M-1 전체 완료 spec 동기화 작업으로 일괄 처리.
