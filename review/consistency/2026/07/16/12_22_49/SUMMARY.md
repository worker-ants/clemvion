# Consistency Check 통합 보고서 (--impl-done, item B) — 확정

**BLOCK: NO (확정)** — 5/5 checker CRITICAL=0. 1차 FS-write flakiness 로 유실됐던 convention_compliance·plan_coherence 를 main 이 직접 재호출해 전수 확보(둘 다 CRITICAL=0). WARNING(§12.16 `LLM_TIMEOUT` 서술) **조치 완료** — §12.16 을 "ai_agent timeout ⇒ LLM_CALL_FAILED, LLM_TIMEOUT 은 어느 경로도 미발행 별개 enum" 으로 정정(부정확한 "Workflow AI Assistant 전용" 제거, error-handling.md §2.2 예시와 모순 해소). INFO(error-handling.md §2.2 placeholder·§1.4 스코프·0-common Rationale·park vs generation phase)는 spec 본문 정정이라 project-planner task(`task_3ac39ebd` AI Agent spec drift) 소관으로 이월.

---

## (1차 workflow 잠정 보고 — 참고)

**BLOCK: NO** — 확보된 checker 결과(cross_spec / rationale_continuity / naming_collision) 중 Critical 없음. 단, `convention_compliance` / `plan_coherence` 는 output_file 미생성으로 **미확인 상태**이며 재시도 필요 (아래 참고).

## 전체 위험도
**LOW** — target(`spec/4-nodes/3-ai/1-ai-agent.md` §11/§12.16 신규 + `node-cancellation.md`/`cross-node-warning-rules.md` 연계 갱신)은 코드와 정합하고 Rationale·명명 위생 모두 양호. 유일한 WARNING 은 신규 §12.16 의 `LLM_TIMEOUT` 귀속 서술이 `spec/5-system/3-error-handling.md` §2.2 기존 예시와 모순되는 사전 존재 drift 가 이번 diff 로 더 뚜렷해진 것. `convention_compliance`/`plan_coherence` 2개 checker 는 output 미확보로 이 위험도 산정에서 제외됨(재시도 후 재확정 필요).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 신규 §12.16 이 "`ai_agent` 노드는 `LLM_TIMEOUT` 을 절대 발행하지 않는다 (Workflow AI Assistant 전용)"라고 단언하나, 실제로는 `Workflow AI Assistant` 측도 `LLM_TIMEOUT` 을 throw 하는 코드 경로가 없음(양쪽 모두 미사용/미구현 enum) | `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 (라인 1359) | `spec/5-system/3-error-handling.md` §2.2 실행 에러 예시(라인 233-248, `nodeType:"ai_agent"`+`code:"LLM_TIMEOUT"` 조합) 및 §1.4(라인 108-115) `LLM_TIMEOUT` 스코프 미제한 등재 | `error-handling.md` §2.2 예시를 실제 발행 가능한 코드(`LLM_CALL_FAILED` 등)로 교체하거나 placeholder 임을 각주 처리. §1.4 "LLM" 카테고리 표에 `LLM_TIMEOUT` 이 어느 기능(Workflow AI Assistant, 현재 미구현)에 스코프되는지 명시해 `1-ai-agent.md §12.16`·`§10`·`3-workflow-editor/4-ai-assistant.md §7` 와 정합 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `LLM_TIMEOUT` 이 `Workflow AI Assistant` 스펙(§7, "120초 타임아웃")에도 실제로는 미구현 — §12.16 문구만 보면 이미 그쪽에서 쓰이는 것으로 오인 가능 | `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 / `spec/3-workflow-editor/4-ai-assistant.md` §7 (라인 618-629) | §12.16 에 "(Workflow AI Assistant 측도 현재 미구현·Planned)" 주석 추가 또는 양쪽 구현 현황 표기 동기화 |
| 2 | rationale_continuity | LLM chat 호출 app-level 타임아웃을 `ai_agent` 전용(`AI_AGENT_LLM_CALL_TIMEOUT_MS`)으로 스코프 — `0-common.md` 의 "3 노드 동일 컨텍스트, drift 방지" 선례와 다른 축(의도적 비대칭)이나 `0-common.md` §Rationale 에는 이 예외가 기록되지 않음 | `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 / `spec/4-nodes/3-ai/0-common.md` §Rationale "시스템 컨텍스트 자동 주입 (§11)" | 후속으로 text_classifier/information_extractor 확대 또는 영구 ai_agent 한정 시, `0-common.md` §11 Rationale 인근에 "drift-방지 원칙은 systemPrompt prefix 한정, LLM 호출 레벨 defense-in-depth 는 노드별 독립 스코프" 한 줄 명시 |
| 3 | rationale_continuity | "Multi Turn 무제한 대기"(사용자 응답 대기, park phase) invariant 와 신규 §12.16 LLM 호출 타임아웃(응답 생성 phase)이 문면상 인접 배치되어 상충으로 오독될 여지 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 표 하단 비고 / §12.16 | §12.16 서두 또는 §1 비고에 "무제한 대기는 사용자 다음 메시지 도착까지의 park 시간 한정, LLM 자체 응답 생성 시간은 §12.16 대상" 상호 참조 1줄 추가 |
| 4 | naming_collision | 신규 식별자(env var 1개, 함수 4개, 파일 2개, 인터페이스 필드 1개) 전수 grep 대조 결과 충돌 없음. 과거 라운드에서 지적된 잠재 충돌(`tool-payload-save-warning.ts` vs `tool-payload-budget.ts` 분리, `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 개명 근거, `LLM_TIMEOUT` disambiguation)도 이미 spec Rationale 에 명시적으로 해소돼 있음 | `spec/4-nodes/3-ai/` 전역 | 조치 불요 (양호 사례로 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 데이터모델·API계약·RBAC·계층책임 축 전부 코드와 정합. 단, 신규 §12.16 `LLM_TIMEOUT` 귀속 서술이 `error-handling.md` §2.2 기존 예시와 모순(WARNING, 사전 drift 노출) + Workflow AI Assistant 미구현 상태 불일치(INFO) |
| rationale_continuity | LOW | Critical/Warning 없음. `LLM_CALL_FAILED`/`LLM_TIMEOUT` taxonomy 재사용, return-vs-throw 비대칭 패턴 연장, plan 문서(`ai-agent-tool-payload-budget-followups.md`)와의 대응 모두 모범적. INFO 2건은 문서 명확화 제안(즉시 조치 불요) |
| convention_compliance | **재시도 필요** | status=success 로 보고됐으나 `review/consistency/2026/07/16/12_22_49/convention_compliance.md` output 파일이 실제로 생성되지 않음 (알려진 Workflow FS-write flakiness — `_prompts/convention_compliance.md` 는 입력 프롬프트일 뿐 출력 아님) |
| plan_coherence | **재시도 필요** | status=success 로 보고됐으나 `review/consistency/2026/07/16/12_22_49/plan_coherence.md` output 파일이 실제로 생성되지 않음 (동일 사유) |
| naming_collision | NONE | 신규 식별자 전수 충돌 없음. 과거 지적 잠재 충돌 모두 이미 해소 확인 |

## 권장 조치사항
1. `convention_compliance`·`plan_coherence` 2개 checker 를 동일 target(`spec/4-nodes/3-ai/`, diff-base `origin/main`)으로 재실행하고 이 SUMMARY 를 갱신 — 전수 확보 전에는 BLOCK 최종 확정 불가(현재는 확보분 기준 NO)
2. `spec/5-system/3-error-handling.md` §2.2 실행 에러 예시(`LLM_TIMEOUT`/`ai_agent` 조합)를 실제 발행 가능한 코드로 교체하거나 placeholder 각주 추가 — §1.4 "LLM" 카테고리 표에도 스코프 명시 (WARNING 해소)
3. (선택) `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 에 Workflow AI Assistant 측 미구현 상태 주석 추가
4. (선택) `spec/4-nodes/3-ai/0-common.md` §Rationale 에 LLM 호출 레벨 defense-in-depth 스코프 경계 한 줄 명시
5. (선택) §12.16/§1 "무제한 대기" 문구에 park-phase vs 응답생성-phase 상호 참조 추가