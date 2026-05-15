# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음. 구현 착수 가능하나 WARNING 해소 후 착수 강력 권장.

---

## 전체 위험도
**MEDIUM** — Critical 없음. WARNING 8건 중 4건(W1·W2·W4·W5)이 구현 후 핸들러/LLM Client 레이어 역행 수정으로 이어질 수 있음.

---

## Critical 위배 (BLOCK 사유)
없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W1 | cross_spec + plan_coherence | `text_classifier` / `information_extractor` — turn push text 변환 규칙 미정의 + plan 태스크 누락 | `conversation-thread.md §1.4`, `plan/in-progress/conversation-thread.md` Phase 4 | `node-output.md` Principle 8.2 (노드별 output 경로) | §1.4 표에 `ai_assistant final (text_classifier)` → `category 직렬화`, `ai_assistant final (information_extractor)` → `중간 assistant 응답 본문` 행 추가; Plan Phase 4에 두 핸들러의 turn push 태스크 및 단위 테스트 항목 추가 |
| W2 | cross_spec + naming_collision + rationale_continuity | `source='system'` turn → `role: 'system'` Anthropic API 비호환 처리 정책 미결 | `conversation-thread.md §5.1` messages 모드 매핑 표 | Anthropic API 메시지 구조 (`spec/5-system/7-llm-client.md`) | §5.1 매핑 표의 `system` 행에 인라인 주석 추가: "Anthropic provider는 `system` turn을 `system_text`에 append, messages 배열 제외 — provider 분기 구현 필수". 현재 각주는 표 외부라 놓치기 쉬움 |
| W3 | cross_spec | `meta.contextInjection` 이 `node-output.md` Principle 2 LLM 계열 meta 목록에 미등록 | `conversation-thread.md §5.3` | `node-output.md` Principle 2 | `node-output.md` Principle 2의 LLM 계열 행에 `meta.contextInjection?` 항목 추가 |
| W4 | convention_compliance | Presentation 노드 push 트리거 — 컨벤션(`resumed`)과 실행 엔진(레거시 `submitted` / `button_click` / `button_continue`) 불일치 | `conversation-thread.md §2.1` | `spec/5-system/4-execution-engine.md` 레거시 status 주석 | 둘 중 하나 선택: (A) `§2.1`에 "현재 구현: legacy status 시점, Stage 3 완료 후 `resumed`로 변경" 주석 명시 / (B) 실행 엔진을 `resumed` 기준으로 선제 마이그레이션 |
| W5 | convention_compliance | Single-turn AI Agent의 thread turn push step이 `1-ai-agent.md §6.1` 실행 흐름에 누락 | `spec/4-nodes/3-ai/1-ai-agent.md §6.1` | `conversation-thread.md §2.2` (v1 push 계약) | `§6.1` step 4 전후에 "`ai_user` turn push (userPrompt resolved) + LLM 응답 후 `ai_assistant` turn push — conversation-thread.md §2.2 참조" step 추가 |
| W6 | rationale_continuity | `output.view` 래퍼가 Principle 8.2 테이블에 잔존 — Principle 4.2에서 이미 폐기 | `node-output.md` Principle 8.2 "프레젠테이션 뷰" 행 | 동일 문서 Principle 4.2 ("output.view 래퍼 폐기") | Principle 8.2 해당 행을 `output.view` 대신 Principle 4.3의 실제 필드(`items` / `rows` / `totalRows` / `data` / `rendered`)로 대체 |
| W7 | naming_collision + rationale_continuity | `ConversationThread.id = 'default'` — 포트 예약어 `'default'`와 동일 문자열, namespace 분리가 상수 권고에 그침 | `conversation-thread.md §1.3` | `node-output.md` Principle 6 포트 예약어 목록 | `DEFAULT_THREAD_ID = 'default'` 상수 추출을 "권장"에서 **필수**로 승격. 대안: Thread ID를 `"primary"` 등 예약어 비충돌 값으로 변경(근본 해소) |
| W8 | naming_collision | `ConversationTurnSource.ai_tool` — `ai-agent-tool-connection-rewrite` plan이 AI Tool 노드 타입 신설 시 동일 식별자 충돌 가능 | `conversation-thread.md §1.1` | `plan/in-progress/ai-agent-tool-connection-rewrite.md` 결정 옵션 (c) | `ai-agent-tool-connection-rewrite.md` plan 의존성 섹션에 "결정 (c) 채택 시 `ConversationTurnSource.ai_tool` 명칭 재검토 필요 — 후보: `tool_result`, `agent_tool`" 명기 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | cross_spec | `excludeFromConversationThread`가 Principle 7 always-echo 목록에 미등재 | `node-output.md` Principle 7 | Principle 7 예시 목록에 `excludeFromConversationThread` 추가 |
| I2 | cross_spec | `$thread.text`가 `contextInjectionMode`와 무관하게 thread-renderer를 사용함을 expression-language spec에서 미명시 | `spec/5-system/5-expression-language.md §4.4` | §4.4에 한 줄 추가: "`$thread.text`는 AI Agent의 `contextInjectionMode` 설정과 무관하게 thread-renderer(§5.2)를 사용한다" |
| I3 | cross_spec | Presentation 노드 spec 파일들에 `excludeFromConversationThread` 필드 반영 여부 미확인 | `spec/4-nodes/5-presentation/` 하위 각 노드 spec | 구현 착수 전 각 파일의 config 필드 목록에 `excludeFromConversationThread: Boolean (default false)` 추가 확인 |
| I4 | convention_compliance | `ai_tool` source에 condition tool 포함 — LLM tool_result 반환 없이 포트 라우팅하는 condition tool의 push 동작 모호 | `conversation-thread.md §1.1` | `ai_tool` 설명을 "KB / MCP tool 결과 + condition tool 호출 시 `reason` argument. `includeToolTurns: true` 시에만 push"로 명확화 |
| I5 | convention_compliance + rationale_continuity | `conversation-thread.md §8 Rationale`이 `1-ai-agent.md §12`로 전임 위임 — 단독 가독성 부재 | `conversation-thread.md §8` | §8에 설계 동기 핵심 결정 한 줄 + "선택지 비교·deprecated 배경은 [Spec AI Agent §12] 참조" 링크 추가 |
| I6 | plan_coherence | `background-monitoring-api` plan의 spec 개정 선행 조건 해소됨 (Phase 1 완료) | `plan/in-progress/background-monitoring-api.md §4` | §4 spec 갱신 착수 시 `execution-engine.md §3.3`의 conversationThread snapshot 항목 덮어쓰지 않도록 주의 |
| I7 | plan_coherence | `ai-agent-tool-connection-rewrite` — `ai_tool` source 확장 시점 v2로 미정 (현재 충돌 없음) | `plan/in-progress/ai-agent-tool-connection-rewrite.md` | W8 조치와 연동. 현재 별도 액션 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **MEDIUM** | meta.contextInjection 미등록(W3), text_classifier/information_extractor text 변환 규칙 공백(W1 일부), system turn Anthropic 정책 미결(W2 일부) |
| Rationale Continuity | **LOW** | node-output.md 내 output.view 내부 모순(W6), system/default 네임스페이스 주의(W2·W7 일부) |
| Convention Compliance | **MEDIUM** | Presentation push 트리거 불일치(W4), single-turn push step 누락(W5) |
| Plan Coherence | **MEDIUM** | Phase 4 text_classifier/information_extractor 태스크 누락(W1 일부) |
| Naming Collision | **LOW** | 'default'·'system'·'ai_tool' 식별자 중복 — spec 인지, 상수화 강제 필요(W7·W2·W8) |

---

## 권장 조치사항

1. **[착수 전 필수 — W1]** `conversation-thread.md §1.4`에 text_classifier / information_extractor의 `ai_assistant` turn text 변환 규칙 추가 + `plan/in-progress/conversation-thread.md` Phase 4에 두 핸들러 turn push 태스크 및 단위 테스트 추가
2. **[착수 전 필수 — W5]** `spec/4-nodes/3-ai/1-ai-agent.md §6.1`에 single-turn의 `ai_user` / `ai_assistant` turn push step 추가
3. **[착수 전 필수 — W4]** `conversation-thread.md §2.1`에 Presentation 노드 현재 구현 상태(legacy status) 주석 명시, 또는 실행 엔진 마이그레이션 선택
4. **[착수 전 권장 — W6]** `node-output.md` Principle 8.2 "프레젠테이션 뷰" 행을 Principle 4.3 실제 필드로 대체 (output.view 래퍼 잔존 제거)
5. **[착수 전 권장 — W3]** `node-output.md` Principle 2 LLM 계열 meta 목록에 `meta.contextInjection?` 추가
6. **[착수 전 권장 — W2]** `conversation-thread.md §5.1` system turn 매핑 행에 인라인 Anthropic API 비지원 + provider 분기 주의 추가
7. **[착수 후 — W7]** `DEFAULT_THREAD_ID = 'default'` 상수 추출을 구현 코드 필수 사항으로 강제 (또는 Thread ID를 `"primary"`로 변경)
8. **[차기 plan 활성화 시 — W8]** `ai-agent-tool-connection-rewrite.md` plan 결정 (c) 채택 시 `ConversationTurnSource.ai_tool` 명칭 재검토 플래그 명기