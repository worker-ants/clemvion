# Plan 정합성 검토 결과

## 검토 대상

- **target**: `plan/in-progress/spec-update-engine-split.md`
- **검토 모드**: spec draft (--spec)
- **관련 plan**: `plan/in-progress/refactor/c1-engine-split.md`

---

## 발견사항

### 발견사항 없음

target(`spec-update-engine-split.md`)은 `c1-engine-split.md` 가 명시한 "체인 종료 spec-sync" 위임의 정확한 이행 문서다. 세 관점을 순서대로 점검한 결과:

**1. 미해결 결정과의 충돌**

`c1-engine-split.md` 에 남아있는 미해결 항목은 다음과 같다:

- `C-2` (02-architecture.md): 클러스터별 forwardRef 순환 — target 은 이 결정에 일절 개입하지 않는다. `EngineDriver` 의 `useExisting` 방식·in-process 전제 명시는 PR2~4 에서 이미 결정·구현된 사항을 Rationale 에 소급 기록하는 것이며, 아직 결정 전인 C-2 클러스터(llm↔llm-config, chat-channel↔triggers 등)를 건드리지 않는다.
- `execution-engine-residual-gaps.md` G1(WS execution.start 핸들러 선결)·G2(errorPolicy continue 분기): target 은 이 미결 항목들과 관련된 spec 영역(§11 등)을 변경하지 않는다.
- `ai-agent-tool-connection-rewrite.md` §1 결정 사항(도구 등록 모델·시그니처·라우팅 등 전부 TBD): target 은 `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 구현 포인터(`classifyLlmError` → `AiTurnOrchestrator.extractAiTurnErrorPayload`)와 frontmatter `code:` 만 수정한다. 도구 연결 설계 TBD 항목과는 다른 섹션이며 충돌하지 않는다.

**2. 선행 plan 미해소**

target 의 전제 조건은 "4 PR 모두 impl-done BLOCK:NO 완료" 이며, `c1-engine-split.md` 진행 로그가 PR1~4 전부 완료·검증 완료를 명시하고 있다. target 상단에도 "구현은 4 PR 모두 정확·검증됨(TEST·ai-review·impl-done BLOCK:NO)" 이라 명시돼 있다. 선행 조건이 충족된 상태에서 planner 의 spec 반영 위임이 이행되는 구조다.

**3. 후속 항목 누락**

`c1-engine-split.md §spec 갱신 phase` 와 target 의 항목 대조:

| c1-engine-split.md 식별 항목 | target 반영 여부 |
|---|---|
| `4-nodes/0-overview.md §1.0` bootstrap 주어 명확화 | 반영 (`NodeBootstrapService.onModuleInit` 명시) |
| `5-system/4-execution-engine.md §Rationale` god-class 분리 항 신설 | 반영 (EngineDriver·각 서비스·기각 결정 포함) |
| `§1.3·§7.5` 메서드 소속 포인터 갱신 (PR2·3·4 누적) | 반영 (AiTurnOrchestrator·Form/Button·Retry 전부) |
| `1-ai-agent.md §10` classifyLlmError 포인터 + frontmatter code: | 반영 |
| `interaction-type-registry.md §1.2` emit 위치 열 + frontmatter code: | 반영 |
| `6-presentation/0-common.md L426` 포인터 정정 | 반영 |
| `node-output.md §4.5` button_continue selectedItem?·url? | 반영 |
| `node-output.md §4.2` previousOutput Phase 3 유예 예외 | 반영 |
| `data-flow/3-execution.md` 시퀀스 actor 갱신 | 반영 (선택, 비차단으로 명시) |

target 이 반영하지 않은 c1-engine-split.md §후속 고려 항목들(assertSameWorkspace fail-closed, LlmCallRecord 타입 통합, 엔진↔서비스 주입 방향 제거 등)은 모두 별도 후속으로 명시된 codebase 변경 사항이며, spec-sync 범위 밖이다. 이것이 target 에서 누락돼야 할 이유가 없다 — 오히려 포함하면 범위 초과다. 누락이 아니라 정당한 범위 경계다.

---

## 요약

`spec-update-engine-split.md`(target)는 `c1-engine-split.md` 가 4-PR 체인 종료 조건으로 위임한 spec-sync 항목을 빠짐없이 이행한다. 미해결 결정(C-2 forwardRef 클러스터, G1/G2 엔진 미구현, ai-agent-tool TBD)과 충돌하는 내용이 없으며, 선행 조건(4 PR impl-done BLOCK:NO)은 이미 충족됐고, target 이 다른 plan 의 후속을 무효화하거나 새로 생성해야 하는 누락도 발견되지 않는다. Plan 정합성 관점에서 이 spec draft 는 즉시 planner 가 spec 에 반영하고 `/consistency-check --spec` 을 진행해도 무방한 상태다.

---

## 위험도

NONE
