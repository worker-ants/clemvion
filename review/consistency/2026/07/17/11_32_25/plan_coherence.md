# Plan 정합성 검토 — `rag-tool-row-distinct-ui.md`

## 검증 방법

target 문서의 핵심 기술 주장 4건을 실제 코드로 직접 대조했고, `plan/in-progress/**` 전체(23개 파일 + `node-output-redesign/` 하위 27개)를 스캔해 RAG/conversation-thread/AI Agent 영역과 겹치는 파일을 정독했다. 특히 orchestrator 가 지목한 `rag-quality-improvement.md`, `node-output-redesign/ai-agent.md`, `eia-context-schema-followups.md` 를 전문 확인했다. `rag-dynamic-cut.md` 는 **이미 `plan/complete/`로 이동**돼 있어 (`plan/in-progress/`에 없음) 진행 중 작업 충돌 대상이 아니다.

## 발견사항

### [INFO] "live/history 대칭 실측" 주장 — 코드 대조 결과 정확함

- target 위치: `## live/history 대칭 실측 (2026-07-17)` 절 (L62-69)
- 상세: 다음 3개 claim 을 코드로 직접 확인했다.
  1. `ai-turn-orchestrator.service.ts:485`(초기 waiting)·`:827`(후속 waiting) 두 곳 모두 `nodeOutput.meta: buildConversationMetaFromResumeState(resumeState)` 를 emit — 주석("run-results UI 의 References / LLM Usage 탭이 진행 중에도 동작하도록") 그대로.
  2. `ai-conversation-helpers.ts:82-97` `buildConversationMetaFromResumeState` 가 `turnDebug: (state.turnDebugHistory as unknown[]) ?? []` 를 반환 — target 인용과 일치.
  3. frontend `use-execution-events.ts:271-335` `handleWaitingForInput` 가 `payload.nodeOutput` 을 그대로 `addNodeResult({ outputData: resolvedOutput })` 에 실어 store 에 넣는다 — 즉 live 상태의 `result.outputData.meta.turnDebug` 가 실제로 채워진다. history 경로는 DB 영속 `outputData` 그대로(REST 스냅샷)이므로 동일 필드.
  - 게다가 target 이 배선하려는 소스(`aiMetadata.turnDebug`, `result-detail.tsx:1020-1032`)는 **이미 References 탭(`turnRefIndex`)이 쓰고 있는 기존 검증된 경로** — 신규 가정이 아니라 기존에 작동 중인 메커니즘을 재사용한다.
- 결론: 설계 전제가 무너지지 않는다. 근거 자료용 INFO.

### [WARNING] Slice B "동일 파일" 정당화가 항목 #1 에는 성립하지 않음

- target 위치: `## 스코프` — "포함 (Slice B — 동일 파일·동일 회귀 계열, 각 수십 줄)" (L75)
- 관련 코드: `conversation-inspector.test.tsx:408`(#7) vs `use-execution-events.ts:817-905`/`use-execution-events.test.ts`(#1)
- 상세: #7("History 모드…" 테스트 명칭 정정)은 실제로 Slice A 가 편집하는 `conversation-inspector.tsx`/`.test.tsx` 와 **같은 파일**이라 "동일 파일" 근거가 성립한다(직접 확인: L408-451 의 테스트가 실제로 `isLive` 를 items 계산에 쓰지 않고 `parseHistoryMessages` pass-through 를 검증하고 있어 target 의 진단이 정확함).
  그러나 #1("비AI 실패 노드의 outputData 전달 테스트")은 `use-execution-events.ts` / `use-execution-events.test.ts` 대상이며, 이 파일은 target 의 Phase 2(1~5)가 편집하는 5개 파일(`conversation-utils.ts`, `execution-store.ts`, `conversation-inspector.tsx`, `result-detail.tsx`, `result-timeline.tsx`) 어디에도 없다. #1 자체 진단은 정확하다 — `handleNodeFailed`(L817-905)의 `outputData: payload.output ?? null`(L871)은 nodeType 무관 범용 경로이고, 기존 커버리지(`use-execution-events.test.ts:431` `http_request` 케이스는 `output` 필드 자체가 없고, `CT-S15`(L1998)는 `ai_agent` 전용)라 "비AI 실패+실제 output" 조합이 실제로 무테스트다. 다만 "동일 파일" 이라는 근거 문구가 #1 에는 부정확하다.
- 제안: target 의 스코프 문구를 "#7 은 동일 파일, #1 은 PR #959(직전 병합)가 남긴 별개 파일의 회귀 갭 — 같은 조사 세션에서 발견된 저비용 부수 수정으로 편입" 등으로 정정해 "동일 파일" 오버클레임을 없앨 것. (작업 자체를 반대하는 것은 아님 — 크기·근거 모두 타당. 문서 정확성만의 문제.)

### [INFO] `plan/in-progress/ai-node-failed-conversation-preview.md` 가 이미 완료됐는데 아직 `plan/complete/` 로 이동되지 않음

- target 위치: 없음(target 은 참조하지 않고 PR #959 커밋 해시로 직접 인용)
- 관련 plan: `plan/in-progress/ai-node-failed-conversation-preview.md`
- 상세: 현재 HEAD(`12ceee587`, "fix(run-results): AI 대화 노드 오류 종결 시 대화 이력 도달성 복구 (Inv-8) (#959)")가 정확히 이 plan 문서의 R1/R2/Phase 1-4 전체를 구현·머지한 커밋이다(커밋 메시지의 R1~R4 서술이 plan 문서 서술과 문장 단위로 일치). 코드도 이를 뒷받침한다 — `result-detail.tsx:1051`(`isConversationHistory` 개명 완료), `use-execution-events.ts:871`(`outputData: payload.output ?? null`), `conversation-thread.md` §9.9 Inv-8·§9.10 CT-S15~17 모두 이미 spec 에 반영돼 있다. 그런데 plan 파일 자체는 여전히 `plan/in-progress/`에 남아 있어 다음 plan_coherence 실행 시 "아직 미해결"로 오인될 위험이 있다.
- target 에는 영향 없음(target 은 완료 사실을 정확히 알고 있다) — plan lifecycle 위생 문제이므로 별도로 `plan/complete/`로 이동 권장.

## 검토 결과 요약 (점검 관점별)

**(a) plan/in-progress 충돌** — 없음. `rag-quality-improvement.md`(P0~P6, 백엔드 검색 품질)는 `ragSources`/`ragDiagnostics` 재활용을 언급할 뿐 스키마 변경 계획이 없고, 현재 미착수(`worktree: (unstarted)`) 상태라 실 충돌 없음. `node-output-redesign/ai-agent.md`(single-turn P0 CRITICAL — `executeSingleTurn` 의 `llmService.chat` try/catch 미적용)는 target 의 Phase 2 어느 항목도 backend AI Agent 핸들러를 건드리지 않아 무관 — 이미 `ai-node-failed-conversation-preview.md`(→ #959)가 양방향 교차 참조를 걸어뒀고 target 은 그 위에서 순수 frontend 렌더만 추가한다. `eia-context-schema-followups.md`는 대부분 완료([x])된 EIA DTO/타입 정밀화 작업으로 RAG 행과 무관. `ai-agent-tool-connection-rewrite.md`(도구 연결 재설계, 다수 TBD 결정)는 target 이 명시적으로 "RAG 주입은 LLM 이 호출한 도구가 아니다"로 `ai_tool` 재사용을 기각하므로 그 plan 의 미해결 결정(도구 등록 모델 등)과 접점이 없다. `rag-dynamic-cut.md`는 이미 `plan/complete/`.

**(b) Slice B 흡수 타당성** — #7 은 실제로 동일 파일·직접 인과(같은 #959 가 만든 drift)라 타당. #1 은 코드 확인상 진단은 정확하나 "동일 파일" 근거가 부정확 — 위 WARNING 참조. 두 항목 모두 "각 수십 줄" 규모 주장과 실측 규모(테스트 추가 20~30줄 내외)가 부합한다.

**(c) 백로그 E(`isConversationOutput` 구조 개선) 후순위 배치** — 코드 확인 결과 target 의 Phase 2(1~5) 어떤 항목도 `output-shape.ts:130` `isConversationOutput`(OR-체인 8갈래 판정 함수)을 수정하지 않는다. `RagRow`/`RagDetail`/`injectRagItems` 는 이 게이트를 통과한 **이후** 단계(`aiMetadata`/`turnRefIndex` 와 동일 위치, L1020-1032 부근)에서 소비만 하므로 순서상 문제 없다. 후속 PR 로 미루는 것이 타당.

**(d) 데이터 출처 실측** — 위 INFO 항목에서 상세 검증. target 의 핵심 설계 전제는 코드와 정확히 일치한다.

## 요약

target 문서(`rag-tool-row-distinct-ui.md`)는 `plan/in-progress/**` 의 다른 진행 중 작업(RAG 품질 개선, AI Agent 도구 재설계, EIA 스키마 후속)과 실질적 충돌이 없고, 선행 조건(PR #959 merge)도 코드로 확인된다. 핵심 설계 전제("live/history 가 `turnDebug` 를 통해 동일 소스를 공유한다")는 3개 파일(`ai-turn-orchestrator.service.ts`, `ai-conversation-helpers.ts`, `use-execution-events.ts`)을 직접 대조해 사실로 확인했다. 유일한 실질적 지적은 Slice B 스코프 정당화 문구에서 항목 #1 이 "동일 파일" 근거를 충족하지 못한다는 점(작업 자체의 타당성과는 무관, 서술 정확성 문제)과, 이미 완료된 `ai-node-failed-conversation-preview.md` plan 파일이 아직 `plan/complete/`로 이동되지 않은 위생 문제(target 과 무관하나 향후 검토자 혼선 방지 차 기록)다. 둘 다 CRITICAL 급 결정 충돌이 아니다.

## 위험도

LOW
