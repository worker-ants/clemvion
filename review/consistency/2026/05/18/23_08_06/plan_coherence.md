### 발견사항

- **[WARNING]** `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표를 동시 수정하는 두 worktree
  - target 위치: target plan §2.3 — `1-ai-agent.md §1 config 표에 두 행 추가 (includeSystemContext / systemContextSections)`
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 — `spec/4-nodes/3-ai/1-ai-agent.md §1` 의 "재작성 예정" 박스 제거 + 새 도구 연결 모델의 config 스키마 필드 신설 예정. 동시에 동 파일 §1 의 `conversation-thread-e509c5` worktree 에서 먼저 5 신규 필드(`contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread`) 와 DEPRECATED 마커를 추가하는 선행 작업이 명시됨.
  - 상세: target plan(`ai-timezone-context-9c8e2f`) 은 `1-ai-agent.md §1` 에 `includeSystemContext` / `systemContextSections` 두 행을 추가한다. `conversation-thread-e509c5` 는 동일 §1 표에 5개 필드를 추가하는 작업이 이미 "선행 조건"으로 명시되어 있다. 두 worktree 가 같은 표를 동시에 손대면 merge 시 config 표 행 위치 충돌이 발생할 수 있다. `conversation-thread-e509c5` 가 현재 진행 중인지 아직 merge 전인지에 따라 위험도가 달라진다.
  - 제안: target plan 에 "conversation-thread-e509c5 merge 이후 착수 권장" 조건을 명시하거나, `1-ai-agent.md §1` 수정 범위를 실제 행 번호로 명확히 분리해 conflict 최소화. 또는 두 변경이 동시 진행 중이라면 직렬화(한 쪽 merge 후 rebase).

- **[WARNING]** `spec/4-nodes/3-ai/1-ai-agent.md §6.1/§6.2` 빌드 로직과 `node-output-redesign/ai-agent.md` 잔여 권고 간 후속 누락 가능성
  - target 위치: target plan §2.3 — §6.1(Single Turn) 직전에 "0.5 System Context Prefix 빌드" 단계 신설, §6.2(Multi Turn) 동일
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` — `config` echo 가 single-turn / waiting / 종결 세 경로에서 필드 집합 불일치. spec §1 의 비민감 필드 전체 echo 로 통일 필요 (미해결).
  - 상세: target plan 은 §7 의 `output.config` echo 대상에 `includeSystemContext?` / `systemContextSections?` 를 추가한다고 명시(§2.3 끝). node-output-redesign plan 은 AI Agent 의 `config` echo 를 세 경로에서 통일하는 작업이 아직 미완료다. target plan 이 `output.config` 에 새 필드 2개를 추가하면, echo 통일 작업 시 이 필드도 함께 포함해야 하는데 node-output-redesign plan 에는 이 두 필드가 반영되어 있지 않다.
  - 제안: node-output-redesign/ai-agent.md 의 config echo 통일 항목에 `includeSystemContext?`/`systemContextSections?` 를 명시적으로 언급하도록 해당 plan 을 갱신. 또는 target plan 에 "node-output-redesign config echo 통일 작업과 조율 필요" 주석 추가.

- **[WARNING]** `spec/4-nodes/3-ai/2-text-classifier.md` / `3-information-extractor.md` 를 동시에 손대는 `node-output-redesign` plan
  - target 위치: target plan §2.4 — `2-text-classifier.md` / `3-information-extractor.md` §1 config 표 + 실행 로직 + CHANGELOG 변경
  - 관련 plan: `plan/in-progress/node-output-redesign/text-classifier.md` / `information-extractor.md` — 두 파일 모두 output 재설계 작업으로 `spec/4-nodes/3-ai/2-text-classifier.md` / `3-information-extractor.md` 를 직접 수정 대상으로 한다. 특히 information-extractor.md 노트에는 "ConversationThread v2 연동 도입 시 output 재설계와 충돌하지 않도록" 경고가 명시되어 있다.
  - 상세: target plan 은 두 spec 파일의 §1 config 표에 새 필드를 추가하고 실행 로직을 수정한다. node-output-redesign plan 도 같은 파일의 출력 구조를 재설계한다. 두 worktree 가 동시에 진행되면 동일 파일 경합 위험이 있다. 현재 node-output-redesign 의 worktree 는 별도 명시가 없어 active worktree 인지 불명확하다.
  - 제안: node-output-redesign 의 text-classifier / information-extractor 재설계가 활성 상태인지 확인. 활성 상태라면 target plan 의 해당 spec 파일 수정 착수 전에 직렬화 조건을 plan 에 명시. 비활성(dormant) 이라면 target plan 완료 이후 node-output-redesign 이 rebase 하도록 해당 plan 에 주석 추가.

- **[INFO]** `conversation-thread.md` worktree(`conversation-thread-e509c5`) 진행 상태 확인 필요
  - target 위치: target plan §2.5 — `spec/conventions/conversation-thread.md §5` 에 systemPrompt build ordering 한 줄 추가
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — `conversation-thread.md` (worktree: `conversation-thread-e509c5`) 가 `spec/4-nodes/3-ai/1-ai-agent.md §1` 표를 먼저 개정하는 것이 선행 조건으로 명시됨. 해당 worktree 가 `spec/conventions/conversation-thread.md` 도 수정하는지 여부가 불명확.
  - 상세: target plan 은 `spec/conventions/conversation-thread.md §5` 에 systemPrompt build ordering 한 줄을 추가한다. `conversation-thread-e509c5` worktree 가 동일 파일을 대규모로 개정 중이라면 경합 가능성이 있다. 단, target plan 의 변경은 §5 내 한 줄 추가로 매우 좁아 실질적 conflict 가능성은 낮다.
  - 제안: `conversation-thread-e509c5` worktree 의 `conversation-thread.md` 수정 범위를 확인. 경합 가능성이 있다면 해당 plan 이 merge 된 이후 착수 또는 target plan 에 의존 조건 명시.

- **[INFO]** `spec/conventions/cafe24-api-metadata.md` 수정 — 다른 plan 과의 연계 확인
  - target 위치: target plan §1.2 — `cafe24-api-metadata.md` 에 §5 Timezone Semantics 신설 + 기존 §5/§6/§7/§8 → §6/§7/§8/§9 번호 shift
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` F-2 항목 — `spec/2-navigation/4-integration.md §6` mermaid 에 `install_token` 보존 정책 명시. `cafe24-restricted-scopes-followups.md` §3 — `spec/conventions/cafe24-api-catalog/store.md` 변경 예정 (단, 본 파일과 직접 경합은 아님).
  - 상세: `cafe24-api-metadata.md` 는 target plan 만 손대는 파일이다. `cafe24-backlog-residual.md` F-2 는 `4-integration.md` 를 손대며, `cafe24-restricted-scopes-followups.md` §3 은 catalog 파일을 손댄다. 직접 경합은 없으나, metadata 파일의 섹션 번호가 §5→§6 으로 shift 되면 이를 참조하는 다른 spec 파일의 cross-link 를 갱신해야 한다. target plan 은 이 cross-link 갱신 목록을 `4-cafe24.md §8.1` 과 `11-mcp-client.md §2.3` 에 한정해 명시하고 있어 누락 가능성이 낮다.
  - 제안: 변경 적용 시 `cafe24-api-metadata.md` 를 인용하는 다른 spec 파일(특히 cafe24 카탈로그 문서 등)이 번호 변경을 인지하지 못하도록 `§5` 이후 앵커 링크가 없는지 grep 으로 확인.

- **[INFO]** Phase B 구현 plan 의 후속 항목이 현 `in-progress` 에 없음
  - target 위치: target plan §5 Phase B — developer 위임 구현 항목 (B-1. Cafe24 도구 description prefix / B-2. AI 노드 시스템 컨텍스트 prefix / B-3. plan 이동)
  - 관련 plan: `plan/in-progress/0-unimplemented-overview.md` — AI Agent 관련 미구현 항목 인덱스. Phase B 구현 항목들은 현재 어떤 in-progress plan 에도 등록되어 있지 않다.
  - 상세: target plan 은 Phase A (spec 개정) 가 현재 worktree 에서 진행 중이고 Phase B (구현) 는 "spec 개정 PR 이 merge 되면" 별 PR 로 위임된다고 명시한다. 그러나 Phase B 의 구현 내용(Cafe24McpBridge 수정, AI Agent/TextClassifier/InformationExtractor handler 수정, frontend UI 변경, unit/e2e 테스트)은 아직 어떤 별도 plan 에도 등록되어 있지 않다. Phase A merge 후 Phase B 착수 시 plan 이 없으면 추적이 누락될 수 있다.
  - 제안: Phase A merge 시점에 Phase B 내용을 담은 새 `plan/in-progress/impl-ai-timezone-context.md` 를 생성하거나, target plan 자체를 `complete/` 로 이동하지 않고 Phase B 체크박스가 추가된 상태로 유지. `0-unimplemented-overview.md` 에도 신규 항목으로 등록 권장.

---

### 요약

target plan(`spec-draft-ai-timezone-context.md`, worktree `ai-timezone-context-9c8e2f`) 은 두 갈래의 spec 개정을 담고 있으며, 진행 중인 다른 plan 과의 CRITICAL 수준 충돌(미해결 결정 우회)은 발견되지 않았다. 다만 `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표를 `conversation-thread-e509c5` worktree 가 이미 선행 수정 예정인데, target plan 도 동일 표를 수정하므로 직렬화 조건이 plan 에 명시되어 있지 않아 merge 시 경합 위험이 있다. 또한 `node-output-redesign` plan 이 text-classifier / information-extractor 의 동일 spec 파일을 재설계 대상으로 삼고 있어 중복 작업 가능성이 존재한다. Phase B 구현 내용이 현재 어떤 in-progress plan 에도 등록되어 있지 않아 Phase A merge 이후 구현 착수 추적이 누락될 수 있다. CRITICAL 건은 없으나, WARNING 3건의 직렬화 조건 명시와 Phase B plan 등록을 선행 정리하고 착수하는 것이 권장된다.

### 위험도

MEDIUM
