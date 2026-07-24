# Consistency Check 통합 보고서

**BLOCK: YES** — Convention Compliance checker 가 CRITICAL 1건 발견 (target `0-common.md §4.6` 이 미구현 기능을 `status: implemented` 로 명문화하며, 필드의 실제 단일 진실 문서와 정면 모순)

## 전체 위험도
**HIGH** — `spec/4-nodes/6-presentation` 은 이번 세션 diff 대상이 아니지만(전 checker 공통 확인: origin/main 대비 0줄), standing 준수 감사 관점에서 CRITICAL 1건 + WARNING 1건이 확인됐다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `0-common.md §4.6` 이 "Presentation 5노드(Carousel/Table/Chart/Form/Template) 모두 공통으로 `excludeFromConversationThread` 필드를 가진다"고 명문화(frontmatter `status: implemented`)하나, `codebase/backend/src/nodes/presentation/{carousel,table,chart,form,template}.schema.ts` 어디에도 해당 필드 선언이 없다(전수 grep 0건). 그런데 필드의 실제 단일 진실 문서는 이를 **AI 3노드(AI Agent/Text Classifier/Information Extractor) 전용**으로 명시한다 | `spec/4-nodes/6-presentation/0-common.md §4.6` (라인 197-209) | `spec/conventions/conversation-thread.md §2.4`, `spec/4-nodes/3-ai/0-common.md §10`, `codebase/backend/.../conversation-context-schema.ts` docstring | (a) presentation 5노드에 실제로 `excludeFromConversationThread` 구현(schema 필드 + UI 노출) 후 §4.6 유지 + frontmatter `code:`에 스키마 파일 추가, 또는 (b) §4.6 삭제/`Planned`로 격하 + frontmatter를 `status: partial`+`pending_plans:`로 낮춤. 어느 쪽이든 conversation-thread.md §2.4 / AI 0-common.md §10 과 "몇 개 노드가 이 필드를 갖는가" 서술을 한 곳으로 통일 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `form.handler.ts` 의 config echo 가 `{ ...rawConfig }` 전체 spread 패턴을 사용 — node-output.md §7 D1 이 명시 금지하는 패턴. 형제 4개 핸들러(carousel/table/chart/template)는 모두 명시 키 열거(`configEcho`)를 사용하며 carousel 은 "future credential-shaped fields can't slip in via spread" 주석까지 달아 D1 위반을 의도적으로 회피 중. Form 만 예외로 남음. 현재 즉시 credential leak 은 없으나 회귀 감지용 가드 테스트도 form 에만 부재 | `spec/4-nodes/6-presentation/4-form.md §5` (근거: `codebase/backend/src/nodes/presentation/form/form.handler.ts:42-44`) | `spec/conventions/node-output.md §7 D1` | `form.handler.ts` 를 나머지 4개와 동일하게 `configEcho = { title, description, submitLabel, fields }` 명시 열거로 교체 + `form.handler.spec.ts` 에 credential-leak 가드 테스트 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity / Plan Coherence / Naming Collision (3건 수렴) | target 문서(`0-common`/`1-carousel`/`2-table`)가 이번 세션 diff 에서 전혀 변경되지 않음(`git diff origin/main -- spec/4-nodes/6-presentation` = 0줄). 실제 diff 는 `output-shape.ts`(`isConversationOutput`/`endReason` fallback) 프런트엔드 리팩터로 presentation spec 과 무관. orchestrator 가 frontmatter `code:` glob 매치만으로 영역 전체를 target 삼은 것으로 추정 | `spec/4-nodes/6-presentation/*` 전체 | 조치 불요(정보 제공). orchestrator 의 `--impl-done` scope 산정 로직 점검 권고 — 동일 세션 앞선 배치(15_33_52)와 동일 증상 반복 관찰 |
| 2 | Plan Coherence | 선행 drift-fix plan 이 이미 merge(PR #997, commit `3d0bcd69b`, "docs(spec): presentation previousOutput 폐기 서술 정정")됐고 target 문서에 반영 확인됐으나 `plan/in-progress/` 에 잔존(체크리스트 전항 `[x]`) — 자매 plan(`output-shape-comment-followups.md`)은 정상 `plan/complete/` 이관됨과 대비 | `plan/in-progress/presentation-previousoutput-spec-drift.md` | `plan/complete/` 로 이관(라이프사이클 정리). 정합성 자체는 문제 없음 |
| 3 | Convention Compliance | §10.9 `action.type` 4값 sentinel(`processAiResumeTurn` 단일 함수 내 4-case 명시 매칭)이 `interaction-type-registry.md` 매트릭스에 등재돼 있지 않음. 다만 "N개 분기 위치에 흩어지는 enum" 문제와는 성격이 달라 즉시 등재 의무는 낮음 | `spec/4-nodes/6-presentation/0-common.md §10.9` | 즉시 조치 불요. 향후 `action.type` 소비처가 2곳 이상으로 늘어나면 등재 검토 |
| 4 | Naming Collision | `interactionType` 동명이의(NodeExecution.interaction_data 의 사용자 액션 기록 enum vs `WaitingInteractionType` 노드 대기상태 분류 enum) — target 이 새로 만든 충돌 아니며 `data-model.md §2.14` 가 이미 "이름만 같고 별개 enum" 이라고 명시 구분 | `spec/1-data-model.md §2.14` | 조치 불요(기존 해소 상태 확인) |
| 5 | Naming Collision | `render_*`(구현된 presentation 도구 가족) 와 향후 재설계 검토 중인 `tool_*` 접두사가 같은 AI Agent tool-calling 네임스페이스를 공유 — `ai-agent-tool-connection-rewrite.md` 가 이미 직교(prefix 다름)로 명시 인지·기록 | `plan/in-progress/ai-agent-tool-connection-rewrite.md §1` | 조치 불요. 해당 plan §1 결정 시 dispatcher 순서 표와 함께 재검증 예정(이미 액션 아이템 존재) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | WS 프로토콜·execution-engine(Continuation Bus/§7.5.1)·AI Agent·node-output·conversation-thread·interaction-type-registry 등 인용 앵커 전수 대조, 직접 모순 없음. §10.9 sentinel 은 4개 spec+코드가 상호 cross-ref 하는 닫힌 루프로 정합 |
| Rationale Continuity | LOW | target diff 0(INFO). 자체 Rationale 이 교차참조하는 execution-engine/ai-agent/node-output/conversation-thread Rationale 과 전부 정합, 기각된 대안 재도입·무근거 번복 없음 |
| Convention Compliance | HIGH | CRITICAL 1건(§4.6 excludeFromConversationThread 미구현 vs conversation-thread.md §2.4/AI 0-common §10 모순) + WARNING 1건(form.handler.ts D1 spread 패턴 위반). 그 외 node-output/conversation-thread/interaction-type-registry 정합 확인 |
| Plan Coherence | NONE | target diff 0, `plan/in-progress/**`(29개+node-output-redesign 27개) 전수 확인 결과 충돌 미해결 결정·미해소 선행 plan 없음. 라이프사이클 hygiene INFO 1건만 |
| Naming Collision | NONE | target diff 0(신규 식별자 없음, vacuous pass). 문서 내 동명이의 2건 모두 corpus 가 이미 명시 해소 |

## 권장 조치사항
1. (BLOCK 해소 우선) `spec/4-nodes/6-presentation/0-common.md §4.6` 을 정정 — presentation 5노드에 `excludeFromConversationThread` 실제 구현 후 유지하거나, 미구현이면 삭제/`Planned` 격하 + frontmatter `status` 하향. `conversation-thread.md §2.4` / `spec/4-nodes/3-ai/0-common.md §10` 과 "몇 노드가 이 필드를 갖는가" 서술을 단일화.
2. `form.handler.ts` config echo 를 나머지 4개 presentation 핸들러와 동일한 명시 열거(`configEcho`) 패턴으로 교체하고, credential-leak 가드 테스트를 `form.handler.spec.ts` 에 추가.
3. `plan/in-progress/presentation-previousoutput-spec-drift.md` 를 `plan/complete/` 로 이관(이미 merge 완료, 정합성 문제 아님 — 라이프사이클 위생).
4. (선택) orchestrator 의 `--impl-done` target 산정 로직이 diff 없는 spec 영역 전체를 반복적으로 끌어오는 패턴을 점검 — 이번 세션 실제 diff(`output-shape.ts`)와 target(`presentation` spec) 간 괴리가 앞선 15:33:52 배치와 동일하게 재관찰됨.

---