# Consistency Check 통합 보고서

**BLOCK: YES** — Cross-Spec checker 가 CRITICAL 1건 보고 (Phase 1 spec 개정 대상에서 선언된 SoT 문서 누락 → 두 spec 문서가 정면 모순될 예정)

## 전체 위험도
**HIGH** — Cross-Spec CRITICAL 1건 + WARNING 1건. 추가로 rationale_continuity / convention_compliance / plan_coherence 3개 checker 는 manifest 상 `status=success` 로 보고됐으나 세션 디렉터리에 output 파일이 실제로 존재하지 않아 결과 미확보 상태(재시도 필요) — 최종 판정은 이 3건 확보 후 완전해짐.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | Phase 1 spec 개정 대상에서 `spec/3-workflow-editor/3-execution.md §10.6.1`(대화형 노드 기본 탭 정책의 선언된 SoT) 누락 — 그대로 진행 시 §10.6.1 "Error 최우선" 일반 규칙과 conversation-thread.md 의 새 Inv-8 규칙이 같은 컴포넌트(`ResultDetail`)·같은 시나리오(대화형 노드 실패)에 대해 정면 모순 | `## Phase 1 — spec 개정 (spec/conventions/conversation-thread.md)` 항목 3 "기본 탭 정책" | `spec/2-navigation/14-execution-history.md:211`(§10.6.1 을 SoT 로 명문화) + `spec/3-workflow-editor/3-execution.md §10.6.1`(디폴트 탭 우선순위)·§10.8(라이프사이클 표) | Phase 1 개정 대상에 `3-execution.md §10.6.1`(디폴트 탭 우선순위 예외를 `node.failed` 까지 확장) + §10.8(라이프사이클 표 "실행 실패" 행 정합화) + `14-execution-history.md §3.4`("완료된" 한정 문구 갱신) 추가. 탭 선택 규칙의 SoT 는 §10.6.1 에 유지하고 `conversation-thread.md` 의 Inv-8/CT-S15~16 은 이를 참조하는 형태로 정리 (과거 "EH-DETAIL-06 dangling 위임" 재발 방지) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | EH-DETAIL-12(v2) 위임 근거가 `conversation-thread.md §9.3` 에만 추가되고 `14-execution-history.md §3.4` 엔 상호 참조가 없어 양쪽 문서 근거가 비대칭 | `## 스코프` "제외 (별도 과제)" 문단 | `spec/2-navigation/_product-overview.md §3.15` EH-DETAIL-06(✅) / `14-execution-history.md §3.4` | §3.4 "완료된 대화" 문구 옆에 "failed 종결 노드의 새로고침 후 대화 복원은 EH-DETAIL-12(v2) 로드맵" 상호 참조 한 줄 추가 (위 CRITICAL 항목의 §3.4 갱신과 함께 처리 가능) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Naming Collision | §9.3 데이터 소스 선택 표의 신규 행("`node.failed` 종결 대화형 노드")이 기존 첫 행("conversation Preview 탭")과 동일 UI 용도에 대해 서로 다른 1차 소스를 명시 — 식별자 충돌은 아니나 표 설계상 예외/한정 조건으로 명확히 종속시켜야 함 | `spec/conventions/conversation-thread.md §9.3` | 신규 행을 "1행의 예외 조건"으로 명시적으로 서술 |

## 재시도 필요 (결과 파일 미확보)

| Checker | 보고된 status | 실측 결과 |
|---------|---------------|-----------|
| rationale_continuity | success | `rationale_continuity.md` 가 세션 디렉터리(`review/consistency/2026/07/17/00_32_29/`)에 존재하지 않음 (ls 로 확인, cross_spec.md·naming_collision.md 만 실재) |
| convention_compliance | success | 상동 — `convention_compliance.md` 미존재 |
| plan_coherence | success | 상동 — `plan_coherence.md` 미존재 |

알려진 Workflow FS-write flakiness(checker 는 success 를 보고하나 output_file 이 비결정적으로 미생성)와 일치하는 패턴. 본 summary agent 는 Agent tool 이 없어 직접 재실행 불가 — **호출자(main)가 이 3개 checker(특히 Rationale Continuity·Plan Coherence)를 직접 재실행(Agent fan-out)하여 output_file 을 확보한 뒤 본 SUMMARY 를 갱신해야 한다.** 다만 이미 확보된 Cross-Spec 단독 CRITICAL 만으로도 BLOCK 근거는 충분하므로, 이번 판정(BLOCK: YES)은 그대로 유효하다.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | Phase 1 spec 개정 대상에 `3-execution.md §10.6.1`(대화형 노드 기본 탭 정책의 선언된 SoT) 누락 → 두 SoT 정면 모순 예정 |
| Rationale Continuity | 미확인 (output_file 누락, 재시도 필요) | — |
| Convention Compliance | 미확인 (output_file 누락, 재시도 필요) | — |
| Plan Coherence | 미확인 (output_file 누락, 재시도 필요) | — |
| Naming Collision | NONE | 신규 식별자(`Inv-8`, `CT-S15`/`CT-S16`, `isFailedConversation`) 전수 grep 결과 충돌 없음. §9.3 표 서술 이슈는 INFO 로만 표기 |

## 권장 조치사항
1. (BLOCK 해소 우선) plan Phase 1 의 spec 개정 대상 목록에 `spec/3-workflow-editor/3-execution.md §10.6.1`(디폴트 탭 우선순위 예외를 `node.failed` 까지 확장) + §10.8(라이프사이클 표 "실행 실패" 행 정합화) + `spec/2-navigation/14-execution-history.md §3.4`("완료된" 한정 문구 갱신) 추가.
2. `conversation-thread.md` 의 신규 Inv-8/CT-S15~16 은 §10.6.1 을 참조하는 형태로 작성해 탭 선택 규칙의 SoT 를 단일화 (dangling 위임 재발 방지).
3. WARNING 해소: `14-execution-history.md §3.4` 에 EH-DETAIL-12(v2) 상호 참조 한 줄 추가.
4. 호출자는 rationale_continuity / convention_compliance / plan_coherence 3개 checker 를 재실행해 output_file 을 확보한 뒤 본 SUMMARY 를 갱신할 것 — 현재 결과는 부분적(2/5 checker 만 실측 확보).

---

## 재실행 결과 반영 (main, 2026-07-17) — 5/5 checker 확보 완료

호출자가 §권장조치 4 에 따라 3개 checker 를 Agent fan-out 으로 재실행해 output_file 전수 확보 (`rationale_continuity.md`·`convention_compliance.md`·`plan_coherence.md`). **최종 판정은 BLOCK: YES 로 유지** — 재실행분에서 CRITICAL 1건 추가 발견.

### 재실행 checker 결과

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Rationale Continuity | **HIGH** | **CRITICAL** — §10.6.1 의 기존 "retryable error 종결 시 Preview 우선" 예외는 `port:'error'` + `retryable===true` 로 **좁게 scope** 되어 있고 그 근거가 *"`[다시 시도]` 버튼을 대화 흐름 안에서 다룰 수 있기 때문"* 이라 **retry affordance 에 묶여 있다**. 이를 "대화형 노드 실패 전체"로 확장하면서 새 Rationale 을 남기지 않으면 `ED-EX-13`(`_product-overview.md:121`, 필수: Error > Preview) 및 §10.6.1 SoT 와 충돌하는 **무근거 번복**. INFO — §9.3 신규 행이 §8.1/D4 "conversationThread snapshot 단일 1차 소스" 원칙과의 계보 연결을 명시하지 않으면 오독 위험 |
| Convention Compliance | NONE | `spec/conventions/**` 정식 규약 위반 없음. 신규 식별자 넘버링·payload shape·spec 인용 전부 실측 정합. INFO 2건 (문서 상단 "관련 spec" 줄이 정정된 SoT 미반영 / `data-hydration-surfaces.md` §2.1 pre-existing 누락 — target 결함 아님) |
| Plan Coherence | MEDIUM | **WARNING 1** — `node-output-redesign/ai-agent.md` 의 미해소 P0(single-turn error 라우팅)와 target 의 귀속 로직이 상호작용해 cross-node 대화 표시 발생 가능한데 교차 참조 없음. **WARNING 2** — target 진단표의 "CT-S9/S10 이 `node.completed`+`port:'error'` 커버" 서술이 **실측과 불일치** (CT-S9/S10 은 둘 다 `node.failed` 를 테스트). 추가로 backend `handleAiTurnError`→`finalizeAiNode` 가 **예외 없이 FAILED** 로 귀결해 `node.completed`+`port:'error'` 는 production 도달 경로 미발견. **INFO** — `cancelled` 케이스가 Inv-8 "status 무관" 문구와 Phase 2 범위 간 불일치 가능 |

### main 의 실측 재검증 (checker 주장 검증)

호출자가 checker 의 주요 주장을 코드로 직접 반증 시도 → **전부 사실 확인**:

- `use-execution-events.test.ts:1909-1935` — CT-S9/S10 이 `execution.node.failed` 핸들러를 호출함을 확인. target 진단표 오기술 **확정**.
- `ai-turn-orchestrator.service.ts:986·1035·1218-1226` — `handleAiTurnError` 가 `finalStatus:'FAILED'` 만 반환, `finalizeAiNode` 가 `isFailed=true` 로 FAILED 저장. `node.completed`+`port:'error'` 미도달 **확정**.
- `use-execution-events.ts:143-146` — `isMultiTurnAiContext` 가 `nodeType === 'ai_agent' && conversationMessages.length > 0` 로만 게이트. cross-node 시나리오 실재 **확정**.
- `_product-overview.md:121` — `ED-EX-13` 이 예외 없이 "Error > Preview | 필수" 로 규정. §10.6.1 기존 예외조차 요구사항 문구 미반영 **확정** (pre-existing 긴장).

### target plan 정정 내역 (2026-07-17)

| 발견 | 처분 |
|---|---|
| Cross-Spec CRITICAL (이중 SoT) | ✅ 정정 — §9.13 신설 **폐기**, 탭 정책 SoT 를 §10.6.1 에 유지하고 `conversation-thread.md` 는 참조만. Phase 1 개정 대상에 `3-execution.md §10.6.1·§10.8`·`14-execution-history.md §3.4·L213` 추가 |
| Rationale Continuity CRITICAL (무근거 번복) | ✅ 정정 — Phase 1 에 **D. `_product-overview.md` ED-EX-13** 추가 + non-retryable 확장의 **신설 근거**를 §8.5 에 명시하기로 확정 ("대화 시간축 보존 가치는 재시도 가능성과 독립") |
| Cross-Spec WARNING (EH-DETAIL-12 비대칭) | ✅ 정정 — Phase 1 항목 8 로 `14-execution-history.md §3.4` 상호 참조 추가 |
| Plan Coherence WARNING 1 (cross-node) | ✅ 처분 — **필터링 안 함**으로 결정. cross-node thread 표시는 §3 스코프 규칙·§9.3·기존 `isWaitingConversation` 분기·사용자 제보 스크린샷(캐러셀 turn 이 AI 미리보기에 표시됨) 상 **설계 의도**. 대신 양방향 교차 참조 추가 (`node-output-redesign/ai-agent.md` ↔ target) + Phase 3 에 의도 pin 테스트 |
| Plan Coherence WARNING 2 (진단표 오기술) | ✅ 정정 — 진단표를 "오류 경로는 실질적으로 `node.failed` 하나" 로 전면 재작성. `result-detail.tsx:1080` 주석이 **사문**임이 드러나 Phase 2 에 주석 정정 추가 |
| Plan Coherence INFO (`cancelled`) | ✅ 처분 — 구현이 `status==='failed'` 하드코딩 대신 소유권 술어 사용. `showTabs` 에 `'cancelled'` 추가(§10.6.1 이 이미 규정하는 기존 drift). Phase 3 에서 APPEND 여부 실측 |
| Rationale Continuity INFO (D4 계보) | ✅ 정정 — Phase 1 항목 4 에 §8.1/D4 계보 연결 서술 추가 |
| Convention Compliance INFO (관련 spec 줄) | ✅ 정정 — plan 상단 "관련 spec" 을 SoT 책임 경계별로 재작성 |

→ **정정된 plan 으로 `--spec` 재검토 필요** (2회차).
