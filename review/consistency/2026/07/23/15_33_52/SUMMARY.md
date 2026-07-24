# Consistency Check 통합 보고서

**BLOCK: YES** — convention_compliance 가 제기한 CRITICAL 1건(`previousOutput` 폐기 서술 vs 실제 코드/규약 모순)으로 차단.

> **main Claude 판정 주석 (2026-07-23)**: 본 CRITICAL 은 **이번 diff 가 유발한 것이 아니라 target
> 영역의 선재(pre-existing) spec drift** 다. 판정 근거·처분은 같은 디렉터리의
> [`ADJUDICATION.md`](./ADJUDICATION.md) 참조. 본 문서는 checker 산출 원문을 그대로 보존한다.

## 전체 위험도
**HIGH** — target(`spec/4-nodes/6-presentation`) 문서 자체는 이번 diff(`origin/main` 대비)에서 변경되지 않았지만(5개 checker 전원이 `git diff origin/main -- spec/4-nodes/6-presentation/` = 0 라인을 확인), target 문서의 **현재 상태**가 정식 규약(`node-output.md` §4.2)·HEAD 워크트리 코드의 실제 동작과 직접 모순되는 기존 drift(CRITICAL 1건)를 포함하고 있으며, 추가로 execution-engine.md 대비 stale 한 cross-ref(Continuation Bus 메시지 타입 개수)가 3개 checker(cross_spec/convention_compliance 중복 지적)에서 중복 확인됨.

**스코프 노트**: cross_spec/rationale_continuity/convention_compliance 는 target 전문(0-common.md/1-carousel.md/2-table.md)을 직접 분석해 실질 발견을 냈다. plan_coherence·naming_collision 은 "이번 세션 diff 에 presentation spec 변경이 없다"는 점 자체를 1차 발견으로 보고했다(실제 코드 diff 는 `output-shape.ts` JSDoc/테스트 전용). 두 관측은 모순이 아니다 — diff 는 없지만 target 문서의 **기존 상태**에 대한 검토는 유효하며, 그 결과 CRITICAL 이 나왔다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `previousOutput` "폐기/사용 금지" 단정 서술이 실제 코드·규약과 모순 | `0-common.md` §4.2("폐기"), `3-chart.md` §5.5("사용 금지"), `1-carousel.md`/`2-table.md`/`5-template.md` §5.5 JSON 예시(필드 누락) | `spec/conventions/node-output.md` §4.2 과도기 예외 조항("Phase 3 완료 전까지 presentation resume 경로는 `previousOutput` 을 legacy 필드로 보존") + HEAD 워크트리 `button-interaction.service.ts` `buildResumedStructuredOutput()`(line 291-295, 무조건 `previousOutput` 주입, 회귀 테스트로 고정) | `0-common.md`/`3-chart.md` 에 node-output.md §4.2 와 동일한 과도기 예외 각주 추가("신규 소비 금지" 로 정정), 세 노드 문서 §5.5 예시에도 각주/필드 반영. 근본 해소는 Phase 3(`ButtonInteractionService` 필드 제거) 완료 후 양쪽 동시 갱신 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Continuation Bus 메시지 타입 "5종·변경 없음" 단언이 실제 6종(`retry_last_turn` 누락)과 불일치 (3곳 반복: §10.9 본문·Rationale·"4-layer SSOT 정렬") | `0-common.md` §10.9, Rationale | `spec/5-system/4-execution-engine.md` §7.4(line 893)·§9.3(line 1162) | "5종" → "6종" 정정 + "`retry_last_turn` 은 본 절 dispatch 범위 밖(별도 `RetryTurnService` 경로)" 명시 |
| 2 | cross_spec | Rationale 절이 재개 dispatch 함수를 본문(`processAiResumeTurn`)과 다르게 `waitForAiConversation` 으로 오기, "loop 재진입" 표현이 full B3(park=세그먼트 종료, 루프 완전 제거) 아키텍처와 불일치 | `0-common.md` Rationale "form submission wire format wrap" 절 소제목·본문 | `0-common.md` §10.9 본문 자신("재개 모델(full B3)... no-op park") + `spec/5-system/4-execution-engine.md` full B3 서술 | Rationale 소제목·본문의 `waitForAiConversation`→`processAiResumeTurn`, "loop 재진입"→"no-op park(재파킹)" 로 통일 |
| 3 | plan_coherence | 검토 스코프-diff 불일치 — target 이 이번 세션에서 실제 변경된 파일이 아님(orchestrator 측 target 산정 재확인 권고) | 검토 방법론 자체 | 실제 diff: `codebase/frontend/.../output-shape.ts`(JSDoc/테스트 전용, `isConversationOutput`/`endReason`) | orchestrator 의 diff-scoped target 목록 산정 로직 점검(코드 사안 아님, 차단 근거 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `output.interaction.type` "4값 중" 표현에 실제로는 3값(presentation 관련)만 나열, 4번째 `message_received`(AI Agent 전용) 생략 | `0-common.md` §10.9 layer 표 (3) | 스코프 명시 각주 추가 또는 "4값 중" 표현 제거 |
| 2 | convention_compliance | Continuation Bus 5종→6종 cross-ref 오차 (WARNING #1 과 동일 사안, convention 관점에서 중복 확인) | `0-common.md` §10.9 | WARNING #1 제안과 동일(중복 처리 불요) |
| 3 | convention_compliance | swagger/DTO 규약 해당 없음 확인(위반 아님, 완전성 기록) | 전체 | 조치 불요 |
| 4 | plan_coherence | `processAiResumeTurn`/`handleAiMessageTurn` 이 AI 대화 turn 에서 `resumed` status 를 emit 하지 않는 기존 갭(info-extractor plan 추적 중)에 대해 target §10.9 가 cross-ref 없음 — render_form 도 동일 경로라 영향 범위 포함 가능성 | `0-common.md` §10.9 dispatch 표 | info-extractor.md 잔여 항목에 render_form 케이스 언급 추가 검토(우선순위 낮음) |
| 5 | plan_coherence | `tool_*` 재설계 plan 과 `render_*` family 는 이미 직교 판정되어 충돌 없음 | `0-common.md` §10 | 조치 불요 |
| 6 | plan_coherence | G2(errorPolicy continue SIGTERM) defer 결정과 full B3 재개 모델은 레이어가 달라 충돌 없음 | `0-common.md` §10.9 | 조치 불요 |
| 7 | naming_collision | target 문서가 이번 diff 로 신규 도입한 식별자 없음(vacuous pass) | 전체 | 조치 불요 |
| 8 | naming_collision | `interactionType` 동명이의(NodeExecution 기록 enum vs `WaitingInteractionType`)는 이미 `spec/1-data-model.md` §2.14 가 명시적으로 구분·해소 | §10.6 | 조치 불요, 향후 3번째 의미 재사용 주의 |
| 9 | naming_collision | `render_*` vs `tool_*` prefix 공존은 이미 plan 문서가 직교로 명문화 | §10.1~10.2 | 조치 불요 |
| 10 | rationale_continuity | diff 스코프 내 Rationale 연속성 위반 없음 — 완료 plan 2건(`is-conversation-output-restructure.md`, `output-shape-comment-followups.md`)이 독립적으로 동일 결론(OR-체인 유지, discriminated union NO-GO)에 도달, 번복 아님 | `output-shape.ts` 관련 완료 plan | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | Continuation Bus 5종/6종 불일치(WARNING), Rationale 함수명·아키텍처 모델 오기(WARNING), interaction.type 4값 표현 혼란(INFO) |
| rationale_continuity | NONE | diff 스코프 내 위반 없음 — 두 완료 plan 이 과거 결정을 정합적으로 재확인 |
| convention_compliance | HIGH | `previousOutput` 폐기 서술이 node-output.md §4.2 예외 조항 및 실제 코드(무조건 주입 + 회귀 테스트)와 정면 모순 — CRITICAL |
| plan_coherence | LOW | target 이 실제로는 diff 없는 기존 spec(스코프 불일치, WARNING), 인접 plan 과 직접 충돌 없음(INFO 3건) |
| naming_collision | NONE | 신규 식별자 도입 없음(vacuous), 기존 동명 패턴은 corpus 가 이미 해소 |

## 권장 조치사항
1. **(BLOCK 해소 필수)** `0-common.md` §4.2 및 `3-chart.md` §5.5 의 `previousOutput` "폐기/사용 금지" 서술을 node-output.md §4.2 의 과도기 예외 조항과 정합하도록 정정 — "신규 소비 금지(레거시 보존 필드)" 로 완화하고 SoT 링크 추가. `1-carousel.md`/`2-table.md`/`5-template.md` §5.5 JSON 예시에도 해당 필드 존재를 각주로 반영.
2. Continuation Bus 메시지 타입 "5종" 표현 3곳(§10.9 본문·Rationale·SSOT 정렬 목록) 모두 "6종(`retry_last_turn` 포함, 본 절 dispatch 범위 밖)" 으로 정정 — execution-engine.md §7.4/§9.3 과 일치시킴.
3. Rationale "form submission wire format wrap" 절의 `waitForAiConversation` → `processAiResumeTurn`, "loop 재진입" → "no-op park(재파킹)" 으로 표현 통일 — 같은 문서 §10.9 본문·execution-engine.md full B3 서술과 정합.
4. (경미) orchestrator 측에 이번 배치의 target(`spec/4-nodes/6-presentation`)이 실제 세션 diff(`output-shape.ts`)와 스코프가 어긋난다는 점 전달 — 다음 배치의 diff-scoped target 산정 로직 점검 권고(코드 결함 아님).
5. (낮은 우선순위) `0-common.md` §10.6 근처에 `output.interaction.type` 4값 중 3값만 열거하는 표현 명확화, §10.9 dispatch 표에 `resumed` status 미emit 기존 갭(info-extractor plan 추적)의 render_form 영향 가능성 각주 검토.
