# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. spec 작성을 차단할 사유가 존재하지 않음.

---

## 전체 위험도
**LOW** — 5개 Checker 모두 Critical 없음. WARNING 9건은 spec 작성 시 함께 수정하면 해소되는 표현·문서 정합성 문제이며 기능적 모순이 아님.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W1 | Convention Compliance | `result.content` 필드 표기가 규약 명칭과 불일치 | `conversation-thread.md` §2.2, §1.4 `ai_assistant final` 행 | `spec/conventions/node-output.md` §8.2 — LLM 응답 텍스트는 `output.result.response` | `result.content` → `output.result.response` 로 일괄 수정 |
| W2 | Convention Compliance | `output.result.messages` 는 규약 미정의 경로 | `conversation-thread.md` §4 영속화 표 | `node-output.md` §4.3 (`output.messages`), §8.2 (`output.result.response`) — 두 경로만 정의됨 | 영속화 표를 `output.messages` (멀티턴 waiting 누적) / `output.result.response` (최종 응답) 으로 명확화 |
| W3 | Rationale Continuity | "shallow copy" 표현이 Background 격리 불변량(ND-BG-05)을 보장하지 못함 | `conversation-thread.md` §3.2, `execution-engine.md` §3.3 | ND-BG-05 ("배경 실패가 메인 상태에 영향 없음") — target 자체가 이를 근거로 인용 | `shallow copy` → `turns 배열까지 복사하는 snapshot (최소 \`{ ...thread, turns: [...thread.turns] }\`)` 으로 정정, 또는 immutable append 설계임을 Rationale 에 명시 |
| W4 | Cross-Spec | `$thread` 가 ExpressionContext 권위 표에서 누락 | Draft §6 — `expression-language.md §4.1` 에 `$thread` 추가 | `execution-engine.md §5.5` ExpressionContext 구성 표 (모든 변수의 SoT) | `execution-engine.md §5.5` 에 `\| $thread \| context.conversationThread \| ConversationThread readonly view \|` 행 추가를 Draft 변경 목록에 포함 |
| W5 | Cross-Spec | 영속화 `"in-memory"` 표기가 기존 Redis 저장 전략과 혼동 유발 | `conversation-thread.md` §4 영속화 표 — "실행 중 \| in-memory ExecutionContext" | `execution-engine.md §6.2` — "실행 중 ExecutionContext 를 Redis 에 저장 (TTL 실행 타임아웃 × 2)" | `in-memory` → `ExecutionContext (실행 엔진 §6.2 에 의해 Redis 포함 직렬화)` 로 명확화 |
| W6 | Plan Coherence | `spec/4-nodes/3-ai/1-ai-agent.md §1` 이중 수정 — 순서 의존성 미명시 | target Draft §3.1 (`conversationHistory`/`historyCount` DEPRECATED + 5필드 추가) | `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 — 동일 §1 표에 `toolNodeIds`/`toolOverrides` 추가 예정 | `ai-agent-tool-connection-rewrite.md` 의존성 섹션에 2개 메모 추가: (1) "conversation-thread spec 이 §1 표를 먼저 개정 — 해당 merge 이후 착수" (2) "일반 `tool_*` 누적 정책은 conversation-thread v2 에서 결정" |
| W7 | Plan Coherence | `execution-engine.md §3.3` 이중 수정 — 순서 의존성 미명시 | target Draft §4.3 — §3.3 에 `conversationThread shallow copy` 삽입 | `plan/in-progress/background-monitoring-api.md` §4 — 동일 §3.3 에 모니터링 API 포인터 추가 예정 | `background-monitoring-api.md` §4 에 주석 추가: "execution-engine §3.3 은 conversation-thread spec(worktree: conversation-thread-e509c5) 에서 먼저 수정됨 — 기존 내용 기반으로 편집" |
| W8 | Plan Coherence | `node-output.md §4.5` 앵커 안정성 — node-output-redesign 개정 시 cross-link 파손 위험 | target Draft §5 — `node-output.md §4.5` 하단에 cross-link 1줄 추가 | `plan/in-progress/node-output-redesign/` — 후속 phase 에서 §4.5 재편 가능성 | node-output-redesign 이 `node-output.md` 개정 phase 진입 시 §4.5 cross-link 재검증을 체크리스트에 추가 |
| W9 | Naming Collision | `DEFAULT_THREAD_ID = 'default'` 값이 포트 예약어와 동일 문자열 | 신규 상수 `DEFAULT_THREAD_ID` (값: `"default"`) | `node-output.md` Principle 6 — 시스템 포트 예약어 목록에 `"default"` 포함 | spec 의 namespace 분리 주의 문구는 충분. 구현 시 상수에 단일 줄 주석 추가: `// thread ID, distinct from the 'default' port reserved word` |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec / Naming | `form_submit` → `form_submitted` 정정 — 기존 불일치 해소 (신규 충돌 아님) | `spec/1-data-model.md §2.14` | 구현 시 `NodeExecution.interaction_data.interactionType` 저장 코드에서 `"form_submit"` → `"form_submitted"` 일괄 정정 필수. DB 기존 row 마이그레이션 필요 여부 사전 확인 |
| I2 | Cross-Spec | `$thread` 가 expression-language.md §7.1 자동완성 트리거·§8.4.2 데이터 소스 표에 미기술 | `expression-language.md §4.1` 추가와 동반 필요 | §7.1 에 `\| $thread. \| ConversationThread 속성 목록 표시 \| context.conversationThread \|` 행 추가 권장 |
| I3 | Cross-Spec | `conversationHistory`/`historyCount` DEPRECATED 처리 시 schema 검증도 동시 조정 필요 | `spec/4-nodes/3-ai/1-ai-agent.md §1` — `✓` (required) 마크 strikethrough | 구현 단계에서 `ai-agent.schema.ts` schema validation 에서 두 필드 required 제거 — spec 만 변경하고 schema 가 required 유지 시 v1 호환 실패 가능 |
| I4 | Rationale Continuity | `system` source → `role: 'system'` 매핑 시 Anthropic API 제약 미기술 | `conversation-thread.md §5.1` messages 모드 매핑 표 | §5.1 하단에 한 줄 추가: "Anthropic API 는 messages 배열 내 `role: 'system'` 미지원 — `system_text` 모드 또는 provider 별 분기 필요. v1 자동 push 없으므로 현재 실질 문제 없음" |
| I5 | Rationale Continuity | `conversationHistory`/`historyCount` "deadweight" 주장에 대한 선행 도입 Rationale 부재 | `spec/4-nodes/3-ai/1-ai-agent.md` 신설 §12.2 | 기존 spec 도입 Rationale 확인 후, 존재하면 §12.2 에 "기존 설계 의도 X → 핸들러 미채택 → contextScope 로 대체" 형태로 역사 이어 서술 |
| I6 | Convention Compliance | §10/§11 섹션 번호 편집 지시 문구 모호 | `spec/4-nodes/3-ai/0-common.md` 편집 지시 | "기존 §10 CHANGELOG 를 §11 로 변경하고, 새 §10 Conversation Context 를 그 앞에 삽입" 으로 명확화 |
| I7 | Convention Compliance | `sanitizeLlmProvidedString` 을 "규약" 으로 지칭하나 `spec/conventions/` 미등재 | `conversation-thread.md §5.2` | `"sanitizeLlmProvidedString 규약"` → `"LlmService 의 user content sanitizer 와 동일한 방식으로 sanitize"` 로 표현 격하, 또는 향후 `spec/conventions/security-sanitization.md` 으로 정식 등재 |
| I8 | Plan Coherence | `interactionType` DB 마이그레이션 필요 여부 미명시 | Draft §9 `form_submit` → `form_submitted` 정정 | 개발자 plan 에 확인 항목 추가: "코드가 이미 `form_submitted` 생성 중이면 spec-only 정정; 기존 row 에 `form_submit` 잔존 시 one-off 마이그레이션 스크립트 필요" (I1 과 연계) |
| I9 | Plan Coherence | node-output-redesign 초안이 DEPRECATED 필드를 활성 필드로 오분류할 가능성 | `spec/4-nodes/3-ai/1-ai-agent.md §1` DEPRECATED 표기 | `plan/in-progress/node-output-redesign/ai-agent.md` 초안에 메모 추가: "`conversationHistory`/`historyCount` 는 conversation-thread spec(worktree: conversation-thread-e509c5) 에서 DEPRECATED 처리됨" |
| I10 | Naming Collision | `ConversationTurnSource: 'system'` ↔ `AssistantMessage.role: 'system'` 동일 문자열, 완전히 다른 타입 | `ConversationTurnSource` enum 신규 값 `'system'` | 현재 spec 의 "AssistantMessage role: 'system' 과 무관" 주의 문구로 충분. 추가 조치 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `$thread` 가 execution-engine §5.5 표에서 누락(W4), 영속화 용어 `in-memory` 혼동(W5). Critical 없음 |
| Rationale Continuity | LOW | Background shallow copy 가 격리 불변량 ND-BG-05 를 실제로 보장하는지 불명확(W3). 구현 단계 버그 전환 가능성 있으므로 사전 정정 권장 |
| Convention Compliance | LOW | `result.content`(W1) · `output.result.messages`(W2) 필드명이 규약과 불일치 — 구현 시 존재하지 않는 필드 참조로 이어질 수 있음 |
| Plan Coherence | LOW | 동일 spec 파일을 후속 plan 들이 수정할 때 현 변경을 베이스로 삼아야 한다는 순서 의존성이 plan 문서에 미명시(W6, W7) |
| Naming Collision | LOW | 13개 신규 식별자 모두 충돌 없음. `DEFAULT_THREAD_ID = 'default'` 는 값 문자열이 포트 예약어와 동일하나 namespace 분리로 기술적 위험 없음(W9) |

---

## 권장 조치사항

spec 작성 차단 사유 없음. 아래 순서로 조치 후 진행 권장:

1. **[spec 반영 전 필수]** W1·W2 — `conversation-thread.md` 내 `result.content` → `output.result.response`, `output.result.messages` → 규약 용어로 수정 (Convention Compliance)
2. **[spec 반영 전 필수]** W3 — `conversation-thread.md §3.2` 및 `execution-engine.md §3.3` 의 "shallow copy" → "turns 배열까지 포함하는 snapshot" 으로 정정 (Rationale Continuity)
3. **[spec 반영 시 동반]** W4 — `execution-engine.md §5.5` 표에 `$thread` 행 추가를 Draft 변경 목록에 포함 (Cross-Spec)
4. **[spec 반영 시 동반]** W5 — 영속화 표의 `in-memory` → Redis 포함 직렬화 명확화 (Cross-Spec)
5. **[spec 반영 후 즉시]** W6 — `plan/in-progress/ai-agent-tool-connection-rewrite.md` 에 순서 의존성 메모 추가 (Plan Coherence)
6. **[spec 반영 후 즉시]** W7 — `plan/in-progress/background-monitoring-api.md §4` 에 순서 의존성 주석 추가 (Plan Coherence)
7. **[구현 착수 전]** I1·I8 — `form_submit` → `form_submitted` DB 마이그레이션 필요 여부 확인 후 개발자 plan 에 명시
8. **[낮은 우선순위]** W8·W9·I2~I10 — 문서 완결성 보완 및 후속 phase 체크리스트 추가