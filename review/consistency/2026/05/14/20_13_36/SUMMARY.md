# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 구현 착수 가능.

---

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 0건. WARNING 4건·INFO 11건으로 문서 완결성 개선 사항만 존재.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W1 | convention_compliance | `§2.5 nextSeq 원자성` 블록이 §3 뒤에 삽입되어 섹션 트리 파손 | `spec/conventions/conversation-thread.md` — `### 2.5` 위치 | CLAUDE.md §프로젝트 스펙 문서 (latest 정합성) | `### 2.5`를 `### 2.4 opt-out` 직후(§3 이전)로 이동 |
| W2 | cross_spec + convention_compliance | `excludeFromConversationThread` 범위 정의 불일치 — §2.4 "모든 노드 공통"이나 §5에서 "ai-agent.md 5 신규 필드"에 포함 | `spec/conventions/conversation-thread.md §2.4, §5` | 동일 문서 내부 | §2.4에 "v1 적용 노드는 ai_agent 한정, v2 확대 시 node-common으로 이동 예정" 단서 추가. §5 헤더의 "5 신규 필드"는 `excludeFromConversationThread` 포함 여부가 확정될 때까지 카운트 없는 표현으로 변경 |
| W3 | convention_compliance + cross_spec + rationale_continuity | `system` source → `role: 'system'` Anthropic 비호환에 대한 v1 우회 정책 미확정 — 수동 push 도입 시 모호한 해석 유발 | `spec/conventions/conversation-thread.md §5.1` messages 모드 매핑 표 `system` 행 | node-output.md Principle 3.1 (에러 처리 명확성); ai-assistant Rationale (provider quirk mitigation 패턴) | 해당 행에 v1 정책 한 줄 명시: "provider가 anthropic이면 `system_text` 모드 자동 강제 또는 silent drop" 중 하나를 택해 기재. 또는 `⚠ Anthropic 미지원 — 수동 push 구현 전 LLM Client 협의 필수` 블로커 레이블 추가 |
| W4 | plan_coherence | `ai_tool` ConversationTurnSource 명칭이 tool-rewrite 결정 (c) 채택 시 `tool_result`/`agent_tool`로 변경 필요 — W8 follow-up이 아직 미결 | `spec/conventions/conversation-thread.md §1.1` | `plan/in-progress/ai-agent-tool-connection-rewrite.md §1` (결정 TBD) | tool-rewrite plan §1 "도구 등록 모델" 결정 직후 W8에 따라 `ai_tool` 명칭 고정 여부를 spec에 반영. 본 impl-prep 차단 사유는 아니나 rewrite plan 착수 전 우선 해소 권장 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | plan_coherence | `conversation-thread.md` plan — 전 Phase ✅ 완료이나 `in-progress/` 잔류 | `plan/in-progress/conversation-thread.md` | PR merge 시 `git mv plan/in-progress/conversation-thread.md plan/complete/conversation-thread.md` |
| I2 | plan_coherence | `background-monitoring-api.md` — "conversation-thread-e509c5 merge 이후 착수" 순서 의존성은 plan 에 이미 명시됨 | `plan/in-progress/background-monitoring-api.md §4` | 별도 조치 불필요. 본 워크트리 merge 후 자동 해소 |
| I3 | cross_spec | Presentation 노드 legacy status(`submitted`/`button_click`/`button_continue`) — node-output Principle 4.1 `resumed` 통일 목표와의 migration gap 이 plan 에 미추적 | `spec/conventions/conversation-thread.md §2.1` 주석 | `plan/in-progress/`에 presentation node migration 항목 존재 여부 확인 후 없으면 추가 |
| I4 | naming_collision | `Cafe24McpBridge`(spec) vs `Cafe24McpToolProvider`(코드) 명칭 불일치 — 의미 충돌은 아니나 독자 혼란 가능 | `spec/conventions/cafe24-api-metadata.md §5` | spec §5 클래스명을 `Cafe24McpToolProvider`로 정정하거나 각주 추가 |
| I5 | rationale_continuity | `DEFAULT_THREAD_ID = 'default'`와 포트 예약어 `'default'` namespace 분리 근거 미기재 | `spec/conventions/conversation-thread.md §1.3` | "thread id는 `ExecutionContext.thread.id`로, 포트 예약어는 `NodeHandlerOutput.port`로만 접근되어 코드 상 교차점 없음" 1행 추가 |
| I6 | rationale_continuity | v2 text transform 규칙(`text_classifier`, `information_extractor`)이 v1 컨벤션 본문에 박제 — 해당 노드 핸들러 spec 변경 시 자동 노후화 위험 | `spec/conventions/conversation-thread.md §1.4` | v2 행을 §7 v2 로드맵으로 이동하거나, §1.4 상단에 "v2 행은 해당 노드 spec과 동기화 의무" 주의문 추가 |
| I7 | rationale_continuity | `cafe24-api-metadata.md §5` — 노드 핸들러·MCP Bridge 호출 경로 공유 설계 결정에 Rationale 부재 | `spec/conventions/cafe24-api-metadata.md §5` | §5 말미에 "노드 핸들러가 단일 진실로 유효성·인증·rate limit을 처리하므로 경로 복제 시 행동 불일치 발생 — 공유 경로로 중복 방지" 1줄 추가 |
| I8 | convention_compliance | `cafe24-api-metadata.md`, `node-output.md`, `swagger.md` — `## Rationale` 섹션 부재 | 각 파일 말미 | 각 파일에 `## Rationale` 섹션 2~3줄 추가. 또는 CLAUDE.md에 "conventions 파일은 Rationale 선택" 면제 명시 |
| I9 | convention_compliance | `migrations.md §7` Rationale 섹션명 비표준 (`## 7. 폐기 대안 (Rationale)`) | `spec/conventions/migrations.md` | `## 7. Rationale`로 변경 |
| I10 | convention_compliance | `node-output.md`, `swagger.md` — CHANGELOG 섹션 없음 (다른 3개 파일과 관행 불일치) | 각 파일 말미 | `## CHANGELOG` 섹션 추가. 또는 conventions 파일 전체에서 CHANGELOG 필수/선택 통일 |
| I11 | plan_coherence | `node-output.md` W3·W6 이미 Phase 9 commit에 반영 완료 | `spec/conventions/node-output.md` Principle 2, 8.2 | 추가 조치 불필요. 확인 완료 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `excludeFromConversationThread` §2.4↔§5 범위 불일치 (W2); `system` source 정책 미확정 (W3에 합산) |
| Rationale Continuity | LOW | `system` source mitigation 구체화 미흡 (W3에 합산); v2 규칙 선제 박제 위험 (I6) |
| Convention Compliance | LOW | `§2.5` 섹션 순서 파손 (W1); `system` source 정책 미확정 (W3에 합산); Rationale/CHANGELOG 부재 (I8–I10) |
| Plan Coherence | LOW | `ai_tool` 명칭 잠재 충돌 (W4); plan 이동 리마인더 (I1) |
| Naming Collision | NONE | 21개 식별자 모두 충돌 없음; `Cafe24McpBridge` vs `Cafe24McpToolProvider` 표기 불일치만 (I4) |

---

## 권장 조치사항

1. **(착수 전 권장)** `spec/conventions/conversation-thread.md` — W1: `### 2.5 nextSeq 원자성` 블록을 §3 앞으로 이동
2. **(착수 전 권장)** `spec/conventions/conversation-thread.md §2.4 + §5` — W2: `excludeFromConversationThread` v1 적용 범위 단서 추가 및 "5 신규 필드" 카운트 표현 수정
3. **(착수 전 권장)** `spec/conventions/conversation-thread.md §5.1` — W3: `system` source Anthropic 비호환 v1 처리 정책 한 줄 명시
4. **(tool-rewrite 착수 전)** W4 해소: tool-rewrite plan §1 결정 후 `ai_tool` 명칭 고정 여부 반영
5. **(PR merge 시)** `git mv plan/in-progress/conversation-thread.md plan/complete/conversation-thread.md` (I1)
6. **(후속)** I4–I10: Rationale/CHANGELOG 보완, 명칭 정정 등 문서 완결성 개선 (구현 차단 아님)