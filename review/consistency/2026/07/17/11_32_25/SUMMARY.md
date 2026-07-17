# Consistency Check 통합 보고서 — `rag` 행 신설 draft (1회차)

**BLOCK: YES** — Cross-Spec CRITICAL 1건. spec 개정(Phase 1) 착수 차단.

5/5 checker 전수 확보 (Agent fan-out — Workflow FS-write flakiness 회피).

## 전체 위험도

**CRITICAL** — Cross-Spec 1건. 나머지는 MEDIUM 3 / LOW 1.

| Checker | 위험도 | 핵심 |
|---|---|---|
| **Cross-Spec** | **CRITICAL** | `meta.turnDebug` 를 conversation Preview 1차 소스로 승격하는 것이 §8.1 D4·§9.3·`6-websocket-protocol.md` §4.4 의 "Preview 1차 소스 = conversationThread" 경계와 정면 충돌 |
| Rationale Continuity | MEDIUM | D4 서술 미갱신 / #959 "References 탭 = 단일 진실" 병존 미검증 / cross-node 결측 시나리오 미포함 |
| Convention Compliance | MEDIUM | §9.2 3중신호 열거 갱신 누락 / §9.11 서수·등가성 / §9.3 기존 행과 관계 미정의 / `result-timeline` 동시적용 의무 |
| Naming Collision | MEDIUM | `rag.turnIndex` 가 top-level `turnIndex` 와 중복 / `RagDetail` 이 #959 삭제 이름 재사용 |
| Plan Coherence | LOW | Slice B "동일 파일" 근거가 #1 에는 부정확. **설계 전제(live/history turnDebug 대칭)는 독립 실측으로 사실 확인** |

## Critical (BLOCK 사유)

**Cross-Spec**: `turnDebug`(및 `ragSources`)는 spec 전체에서 **디버그류 탭(References / LLM Usage / Request / Response) 전용**으로 일관 정의돼 있고, conversation Preview 의 1차 소스는 §8.1 D4·§9.3·`6-websocket-protocol.md` §4.4 **세 곳**에서 반복적으로 `conversationThread` snapshot 으로 명문화돼 있다. draft 는 그 두 도메인을 Preview 타임라인 안에서 다시 섞는다.

**`system_error` 유비 논파 (타당)**: `system_error` 는 `output.error` 에서 합성되며 §9.3 이 store/이력을 "**동일 thread 의 서로 다른 매체**" 로 규정해 D4 원칙을 유지한 채의 예외다. `turnDebug` 는 conversationThread 와 무관한 별도 구조(`output_data.meta`)로 **완전히 다른 도메인**이다.

**`Inv-5 정신` 인용 오용 지적 (타당)**: Inv-5 는 `groupToolCallItems` 가 양 surface 에 동일 결과를 낸다는 불변량이지 live/history 소스 대칭 일반론이 아니다.

### main 의 실측 반증 — CRITICAL 의 전제를 부분 반박

호출자가 cross_spec 의 "경계" 주장을 코드로 검증한 결과, **그 경계는 이미 출하된 코드가 넘고 있다**:

| 실측 | 위치 |
|---|---|
| `turnRefIndex` 가 `aiMetadata.turnDebug` 에서 생성 | `result-detail.tsx:1026-1032` |
| 그것이 `ConversationInspector` 로 전달 (live·history 양 분기) | `:1093`, `:1116` |
| **`SummaryView`(= conversation Preview 타임라인) 의 assistant 버블 안에서 `ReferencesChip`(📚) 으로 렌더** | `conversation-inspector.tsx:1206` (+ SelectedItemDetail `:417`) |

→ **`meta.turnDebug` 는 오늘 이미 conversation Preview 의 데이터 소스다.** 따라서 CRITICAL 의 결론("두 도메인을 다시 섞는 시도")은 **신규 위반이 아니라 기존 관행의 확장**이며, 실제 문제는 **§9.3·D4 가 현실을 서술하지 못하는 spec-코드 drift**(본 draft 이전부터 존재)다.

**다만 CRITICAL 자체는 유효하다** — 어느 쪽이든 §8.1 D4·§9.3·`6-websocket-protocol.md` §4.4 개정과 별도 Rationale 이 필요하다는 요구는 그대로다. draft 의 Phase 1 에 그 항목이 없었다.

## Warning 요약 (fix 대상)

| Checker | 발견 | 처분 |
|---|---|---|
| Cross-Spec | `nodeOutput.meta.turnDebug` 가 `6-websocket-protocol.md` §4.4 wire 필드로 미문서화 | Phase 1 에 §4.4 개정 추가 |
| Cross-Spec | References 탭과 신규 🔎 행이 **같은 소스의 두 독립 렌더 경로** — turnIndex 매칭 동등성 미보장 | `Inv-9` 또는 CT-S18 확장으로 동등성 불변량 명시 |
| Rationale | §8.1 D4 서술 미갱신 / #959 "References 탭 = 단일 진실" 병존 미검증 / cross-node 결측 CT 미포함 | ✅ plan 반영 (D4 범위 명확화) |
| Convention | §9.2 3중신호 열거에 🔎 미추가 / §9.11 서수·등가성 / §9.3 기존 행 관계 / `result-timeline` 동시적용 | ✅ plan 반영 |
| Naming | `rag.turnIndex` 중복 → payload 에서 제거, top-level 사용 | ✅ plan 반영 |
| Naming | `RagDetail` 이 #959 삭제 이름 재사용 → `RagInjectionRow`/`RagInjectionDetail` | ✅ plan 반영 |
| Naming | `injectRagItems` 의 "inject" 가 backend `injectConversationContext` 와 의미 충돌 | ✅ `mergeRagInjectionItems` 로 변경 (기존 `mergeOrphanToolItems` 패턴) |
| Plan Coherence | Slice B "동일 파일" 근거가 #1 에는 부정확 | 문구 정정 필요 |
| Cross-Spec (INFO) | §9.12(요소별 시각 표시, "강제") 표에 `rag` 행 누락 — `RagSource` 에 timestamp 없음 | Phase 1 에 §9.12 행 추가 (부모 assistant `llmCalls[0].startedAt` 대리) |
| Rationale (INFO) | `spec/5-system/9-rag-search.md` §4.1 이 "Preview UI = chip-only" 로 서술 — 갱신 누락 | Phase 1 추가 |
| Rationale (INFO) | §8.3 선례의 AST exhaustiveness guard 계승 미언급 | Phase 2 반영 |
| Plan Coherence (INFO) | **`plan/in-progress/ai-node-failed-conversation-preview.md` 가 #959 머지 후에도 미이동** | `plan/complete/` 이동 (별도 위생) |

## 판정

**BLOCK: YES** — CRITICAL 의 데이터 소스 결정은 **사용자 승인이 필요한 설계 결정**이다 (사용자 결정 1 "출처 = turnDebug" 이 이 충돌을 모른 채 내려졌으므로). 재검토 후 2회차 필요.
