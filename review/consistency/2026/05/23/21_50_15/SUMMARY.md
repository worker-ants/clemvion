# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 1건 (cross-spec C-1) 은 검토 시작 시점 기준으로 표시됐으나 사실은 spec 갱신 과정에서 이미 해소된 상태였음. WARNING 5건은 본 보고서 작성 후 모두 spec/plan patch 로 해소.

검토 대상: `plan/in-progress/ai-presentation-form-inline.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-23 21:50

---

## Critical 검토 — C-1 false-positive 확정

| # | Checker | 표시된 위배 | 실제 상태 |
|---|---------|------|-------|
| C-1 | Cross-Spec | WS §4.4 `formConfig` 위치 모순 — 현행 spec 이 `ai_form_render` 도 top-level `formConfig` 로 명시 | **이미 해소됨** — spec 갱신 (project-planner §2 단계 6) 에서 `spec/5-system/6-websocket-protocol.md §4.4` 표 line 334 / 338 을 patch 함. `formConfig` 행: "`interactionType = form` 한정 top-level", `conversationConfig.pendingFormToolCall` 행 신설 shape `{ toolCallId, formConfig }`. cross-spec checker 가 검토 시작 시점 spec 을 본 결과를 그대로 옮긴 false-positive. |

검증: `grep "formConfig\|pendingFormToolCall" spec/5-system/6-websocket-protocol.md` 출력에서 line 334 `**interactionType = form 한정** top-level 필드`, line 338 `**interactionType = ai_form_render 한정**. shape { toolCallId, formConfig }` 확인.

---

## Warning 처리 결과

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W-1 | Cross-Spec | AI Agent §7.4 vs WS §4.4 `pendingFormToolCall` shape 비일관 | ✅ 해소 — `spec/4-nodes/3-ai/1-ai-agent.md §7.4` `_resumeState.pendingFormToolCall` 비고에 WS emit cross-ref 추가 (`engine waiting emit 이 본 객체를 그대로 conversationConfig.pendingFormToolCall 로 동봉`) |
| W-2 | Cross-Spec + Plan Coherence | CT §9.7 / §9.7.1 `resumeFromAiRenderForm` 행 누락 | ✅ 해소 — `spec/conventions/conversation-thread.md §9.7` 표에 `waiting_for_input (interactionType=ai_form_render)` 행 + `§9.7.1` 표에 `resumeFromAiRenderForm` 행 신설. plan §4.1 의 해당 항목도 §9.7.1 명시로 보강 |
| W-3 | Cross-Spec | Form bypass 처리 경로가 WS spec 명령 표 / AI Agent §6.2 에 미기술 | ✅ 해소 — `spec/5-system/6-websocket-protocol.md §4.2` `execution.submit_message` 행에 form bypass cross-ref 추가, `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass` 본문 신설 |
| W-4 | Convention | `spec/conventions/interaction-type-registry.md §1.2` `ai_form_render` 행 갱신 누락 | ✅ 해소 — `§1.2` 행을 (a)~(g) 세부 분기로 확장 + SoT cross-ref `AI Agent §12.5`. plan §4.1 영향 spec 목록 + §5 영향파일 표에 추가 |
| W-5 | Convention | `interaction-type-registry.md §3.2` `form` Presentation type 행 갱신 누락 | ✅ 해소 — `§3.2` `form` 행 렌더 설명을 "`AssistantPresentationsBlock` case form active 분기 (DynamicFormUI / FormSubmittedContent)" 로 갱신 |

---

## Info 처리 결과

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| I-1 | Cross-Spec | `FormSubmittedContent` active/비활성 분기 CT §9.1 미기재 | ✅ 해소 — §9.1 `ai_assistant` 행 비고에 inline 렌더 + active/submitted 분기 추가 |
| I-2 | Cross-Spec + Naming | CT-S12/S13/S14 번호 충돌 | 확인 — 기존 §9.10 마지막이 CT-S11 이라 연번 충돌 없음 |
| I-3 | Rationale | §12.5 의 `resumeFromAiRenderForm` 분리 이유 누락 | ✅ 해소 — §12.5 의 선택지 비교 (A 안 기각: "단일 action 두 의미") 와 D 안 채택 항목에 `resumeFromAiRenderForm` 도입 이유 명시 |
| I-4 | Rationale | plan §3 기각 이유 서술 보강 | ✅ 해소 — plan §3 "payload echo 에 active state 박기" 행 보강 (WS emit 정상 운반값 vs payload echo 의미 차이 명시) |
| I-5 | Convention | frontmatter `owner` 값 | ✅ 해소 — `owner: project-planner` |
| I-6 | Plan Coherence | `ai-presentation-tools.md` stale (PR #269 merged) | 본 작업 scope 외 — 다른 plan 의 lifecycle 이슈. 별도 plan 으로 분리 |
| I-7 | Plan Coherence | `multiturn-error-preserve.md` stale (PR #289 merged) | 본 작업 scope 외 — 동일 |
| I-8 | Plan Coherence | plan §4.1 WS spec 갱신 항목 cross-ref | ✅ 해소 — `ai-presentation-tools.md §2` 결정 #12/#13 cross-ref 추가 |
| I-9 | Naming | `isActiveFormCall` 명명 | 확인 — codebase 미존재, 충돌 없음. 본 plan 의 §4.4 에서 inline predicate 로 표현했고 별도 export 필수 아님 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 (해소 후) |
|---------|--------|-----------|
| Cross-Spec | LOW (C-1 false-positive, W-1~W-3 해소) | 검토 시작 시점 spec 기준 표시였으나 모두 patch 완료 |
| Rationale Continuity | LOW (해소) | §12.5 / plan §3 보강 완료 |
| Convention Compliance | LOW (W-4/W-5 해소) | `interaction-type-registry.md §1.2 / §3.2` 갱신 완료 |
| Plan Coherence | LOW | stale plan 처리는 별 plan, 본 작업과 분리 |
| Naming Collision | NONE | 충돌 없음 |

---

## 결론

**BLOCK: NO** — Critical 의 실체가 spec 갱신에서 이미 해소된 false-positive 였고, WARNING/INFO 5건은 본 보고서 작성 후 spec/plan 양쪽에 patch 적용. 구현 단계 진입 가능.

다음 단계: `git add` + commit (`docs(spec): render_form 활성 form timeline 인라인 통합`) 후 main Claude 가 developer skill 호출.
