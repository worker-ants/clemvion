# 정식 규약 준수 검토 — RAG 행/도구 행 시각 구분 (Slice A+B, --impl-prep)

> **범위 정정**: `prompt_file`(`convention_compliance.md`)의 "Target 문서" 블록은 `spec/conventions/cafe24-api-catalog/**` 전량 덤프(오케스트레이터 프롬프트 생성 오류로 추정 — 본 작업과 무관)였다. 호출 메시지에 명시된 실제 검토 대상 — `plan/in-progress/rag-tool-row-distinct-ui.md` Phase 2 (구현 예정 1~6) vs 커밋 `e9c1b1122`로 개정된 `spec/conventions/conversation-thread.md` 및 관련 `spec/conventions/interaction-type-registry.md` — 을 기준으로 검토했다.

## 발견사항

- **[CRITICAL] `spec/conventions/interaction-type-registry.md` §2 매트릭스가 `rag` 미등록**
  - target 위치: `plan/in-progress/rag-tool-row-distinct-ui.md` Phase 1 항목 1~19 (spec 개정 목록) — `interaction-type-registry.md` 갱신이 목록에 아예 없음. 커밋 `e9c1b1122`의 변경 파일 목록(`conversation-thread.md` · `6-websocket-protocol.md` · `9-rag-search.md` · `1-ai-agent.md`)에도 `interaction-type-registry.md`는 없다.
  - 위반 규약: `spec/conventions/interaction-type-registry.md` 자신의 §2 서두 규칙 — "신규 enum 값은 본 문서 매트릭스에 반드시 등록한다 — 등록되지 않은 값을 코드에 추가하면 단위 테스트 `interaction-type-exhaustiveness.test.ts` 가 hard fail." 및 §2 prose "frontend union **6개**"(이제 오류), §2.1 매트릭스(현재 `system_error`까지만 등재, `rag` 행 없음).
  - 상세: `interaction-type-registry.md`는 "cross-cutting enum 값의 단일 진실 + 처리 분기 위치 매트릭스"를 자임하는 별도 `spec/conventions/**` 문서다. `system_error` 도입 시(§8.3) 이 문서 §2/§2.1이 실제로 갱신되어 6번째 값·매트릭스 행·AST 가드 대상 서술이 모두 반영된 선례가 있다(§2.1 `system_error` 행 참고). `rag`는 그 동일 패턴을 따라야 하는 7번째 값인데, Phase 1 spec 개정(이미 커밋됨)과 Phase 2 구현 계획 어디에도 이 문서 갱신이 없다. `interaction-type-exhaustiveness.test.ts`의 `SOURCE_ENUM_VALUES`(하드코딩 배열)는 Phase 2 항목 6("AST exhaustiveness guard 에 `rag` 등록")으로 갱신될 예정이라 테스트 자체는 통과할 수 있지만, 그 SoT 문서(§2/§2.1)는 갱신 대상에서 빠져 있어 "코드는 7값, 등록문서는 6값" 이라는 즉시 drift가 발생한다 — 이 PR이 §8.6에서 정확히 같은 클래스의 drift(문서 간 상호참조 부재)를 근본원인으로 지목·시정한 것과 대비된다.
  - 제안: Phase 1(또는 Phase 2 착수 전)에 `interaction-type-registry.md` §2 prose를 "frontend union 7개"로, §2.1 매트릭스에 `rag` 행(예: AST 가드 대상 파일·렌더 분기 위치·spec cross-ref)을 `system_error` 행과 동일 밀도로 추가한다. `spec/`은 개발자 read-only이므로 project-planner에게 이 갭을 전달하거나, 이번 --impl-prep 검토 결과로 Phase 1을 재오픈해야 한다.

- **[CRITICAL] Phase 2 파일 목록에 `conversation-timeline-item.tsx` 누락 — 실행 트리 timeline 표면에서 `rag` 시각이 실제로 깨질 위험**
  - target 위치: 구현 예정 항목 5 (`result-timeline.tsx` — 🔎 행을 한 줄 컴팩트로 렌더). `conversation-timeline-item.tsx`는 Phase 2 목록에 없음.
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.6 "적용 surface"(SummaryView·ResultTimeline 동시 적용 의무) · §9.1(source별 시각 매핑 강제) · §9.9 Inv-5 · §9.10 CT-S18(e). 또한 `conversation-thread.md` 자신의 frontmatter `code:` 블록이 `conversation-timeline-item.tsx`를 이 컨벤션의 피지배 코드로 이미 명시하고 있다.
  - 상세: 실측 결과 `result-timeline.tsx`는 `groupToolCallItems`로 그룹핑만 계산하고 실제 아이템별 시각 렌더는 `<ConversationTimelineItem>`에 전량 위임한다(`spec/conventions/interaction-type-registry.md` §2.1이 `system_error`에 대해 이미 "좌측 timeline chip 은 `ConversationTimelineItem` … `result-timeline.tsx` 는 이 컴포넌트에 위임만, 자체 source 분기 없음"이라고 명문화한 것과 정확히 같은 구조). `conversation-timeline-item.tsx`의 아이템 분기는 `switch`+`never` 가 아니라 `item.type === "..."` 단순 if/else 체인이라(예: `item.type === "system_error" ? … : …`) `rag` 분기를 빠뜨려도 컴파일 에러 없이 마지막 `else`(일반 user/assistant 버블 취급, `item.type === "user" ? "👤" : "🤖"`)로 조용히 폴백한다. Phase 2가 `result-timeline.tsx`만 건드리고 이 컴포넌트를 빠뜨리면 실행 트리 timeline에서 🔎 행이 §9.1이 강제하는 점선 라인이 아니라 잘못된 채팅 버블로 렌더될 수 있다 — §9.6 "동시 적용 의무"·Inv-5·CT-S18(e)를 모두 위반하는 실제 기능 결함이며, 이는 컴파일러가 잡아주지 않는다.
  - 제안: Phase 2 파일 목록에 `components/editor/run-results/conversation-timeline-item.tsx`를 명시적으로 추가하고, `item.type === "rag"` 분기(점선 라인 + `KB · N chunk(s)` chip)를 여기 구현한다. `result-timeline.tsx`는 (이미 자동으로 되는) 그룹 제외 확인 정도만 필요.

- **[WARNING] `ConversationTurnSource` 7값 확장이 기존 exhaustive switch의 컴파일 계약과 충돌 — spec §9.5 "switch 에 6 case" 서술과 모순 가능**
  - target 위치: 구현 예정 항목 1 (`conversation-utils.ts`의 `ConversationTurnSource`에 `rag` 추가). 코드 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts:208-330` (`threadTurnsToConversationItems`의 `switch (turn.source)`, `default` 분기의 `const _exhaustive: never = turn.source;`, L322).
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.5 — "`threadTurnsToConversationItems` — `conversationThread.turns` frontend 6 source 전부(`system_error` 포함 — §1.1.1; **switch 에 6 case**)" (L506, 이번 개정에서도 그대로 유지된 문구).
  - 상세: `ConversationTurn.source`의 타입이 바로 `ConversationTurnSource`이고(L56), 그 스위치는 `default` 분기에서 `never` 대입으로 컴파일 타임 exhaustiveness를 강제한다(`system_error` 도입 시에도 실제로 `case "system_error":`가 추가된 이유, L287). `ConversationTurnSource`를 7값(`rag` 추가)으로 넓히면서 이 switch에 대응 `case`를 추가하지 않으면 `tsc`가 `"rag"`를 `never`에 대입하는 지점에서 즉시 fail한다. 그런데 `rag`는 스펙상 진짜 wire `ConversationTurn.source` 값이 아니라(§1.1.2 — thread에 누적되지 않는 frontend 합성) `mergeRagRetrievalItems`가 별도로 items에 끼워 넣는 존재라서, §9.5는 "switch 에 6 case"를 그대로 유지했다 — 즉 spec은 7번째 case가 생기지 않는다고 서술하는데, 기존 `never`-exhaustiveness 관행을 그대로 따르면 7번째 case가 강제된다는 모순이다.
  - 제안: 구현 시 (a) `case "rag": break;`류의 방어적 no-op case를 추가하고 §9.5 "6 case"를 "7 case"로 동반 정정하거나, (b) `ConversationTurn.source`(wire 필드) 타입은 종전 6값으로 유지하고 `rag`는 `ConversationTurnSource`의 상위 개념/별도 alias로 분리해 이 switch의 exhaustiveness 범위 밖에 두는 설계를 명시적으로 택한다. 어느 쪽이든 Phase 1의 "카운트 drift" 정정 목록(§9.9 8→9, §9.1 6행→7행과 동급)에 §9.5 "6 case"를 포함시켜야 한다 — 현재 누락.

- **[WARNING] `spec/conventions/conversation-thread.md` §9.11 "세 변환 path" 헤더가 이미 4행 표와 불일치 (개정 spec 자체의 잔여 카운트 drift)**
  - target 위치: `spec/conventions/conversation-thread.md` L690 "세 변환 path 의 책임:" 직후 L692-697 표 (4 행: `messagesToConversationItems` · `threadTurnsToConversationItems` · `mergeOrphanToolItems` · `mergeRagRetrievalItems`).
  - 위반 규약: 문서 내부 자기정합성 — 같은 문서가 스스로 "카운트 drift"를 §9.9(8→9)·§9.1(6행→7행)에 대해서는 정정했으나(plan Phase 1 항목 17·18), §9.11 헤더 숫자는 놓쳤다.
  - 상세: plan 항목 19는 "`mergeRagRetrievalItems`는 1차 변환이 아니므로 '두 1차 변환 함수'는 그대로 두고 '세 변환 path' 표만 확장한다"고 결정했는데, 실제 커밋된 결과는 표에는 행을 추가했지만 "세 변환 path"라는 헤더 숫자는 그대로 남아 지금 3이라는 텍스트 바로 아래 4행 표가 있다. 사소하지만 이 PR 자체가 "카운트 drift가 재발한다"는 것을 §8.6에서 핵심 교훈으로 삼고 있어 동일 클래스의 잔여 결함이다.
  - 제안: "세 변환 path" → "네 변환 path"(또는 "변환 path" + 표로 개수 자연 노출, 숫자 형용사 제거)로 후속 정정. 개발자는 spec read-only이므로 project-planner에게 전달하거나 별도 spec 패치로 처리.

- **[WARNING] `TurnRagDelta` / `RagSource` 타입이 이미 `components/` 계층(`output-shape.ts`)에만 존재 — `lib/` 계층 배치·중복 여부 미결정**
  - target 위치: 구현 예정 항목 1 (`lib/conversation/conversation-utils.ts`에 `mergeRagRetrievalItems(items, ragDeltas: TurnRagDelta[])` 신설), 항목 2 (`lib/stores/execution-store.ts`의 `rag?: { sources: RagSource[] }`).
  - 위반 규약: 명시적 `spec/conventions/**` 규칙은 아니지만, `codebase/frontend/src/components/editor/run-results/conversation-utils.ts`(re-export shim) 자신의 헤더 주석이 확립한 계층 규율 — "conversation utility 는 `@/lib/conversation/`에 있어야 `@/lib/websocket/`이 계층을 역전시키지 않고 소비할 수 있다"와, `output-shape.ts`가 이미 한 번 겪은 "`TurnDebugEntry` 동명 충돌 해소를 위해 `TurnRagDelta`로 rename"라는 자체 선례.
  - 상세: 실측 결과 `TurnRagDelta`·`RagSource`는 현재 `codebase/frontend/src/components/editor/run-results/output-shape.ts`(컴포넌트 계층)에만 정의돼 있다. `lib/stores/execution-store.ts`는 기존에도 `PresentationPayload`·`SystemErrorTurnData` 타입을 `lib/conversation/conversation-utils.ts`에서 import하는 패턴을 쓰고 있어(L84-86), `RagSource`도 같은 패턴을 따르려면 `lib/conversation/conversation-utils.ts`에 자체 정의가 필요하다. 그런데 `mergeRagRetrievalItems`가 그 파일에 `ragDeltas: TurnRagDelta[]` 파라미터를 받게 되면, 이름이 완전히 같은 `TurnRagDelta`/`RagSource`가 컴포넌트 계층과 lib 계층에 각각(구조적으로만 호환되는) 별도 정의로 존재하게 될 위험이 있다 — `output-shape.ts`가 과거 정확히 이 문제(같은 파일 안 `TurnDebugEntry`와의 동명 충돌)를 겪고 개명으로 해소한 전례가 있는 만큼, 이번엔 파일 간 동명 이중정의로 재발할 소지가 있다.
  - 제안: Phase 2 착수 전에 (a) `lib/conversation/conversation-utils.ts`에 `RagSource`/`TurnRagDelta`(또는 구조적으로 동등한 다른 이름)를 신규 export하고 `output-shape.ts` 쪽은 그 타입을 import해 재사용하도록 통합하거나, (b) 의도적 이중 정의임을 명시하는 주석을 양쪽에 남긴다(`output-shape.ts`가 이미 `TurnDebugEntry`/`TurnRagDelta` 분리에 대해 남긴 것과 동일한 관례). 어느 쪽이든 계획 문서에 명문화가 없어 구현자가 임의 선택하면 향후 drift 위험이 있다.

- **[INFO] 명명 규약 준수 확인 — `RagRetrievalRow`/`RagRetrievalDetail`**
  - target 위치: 구현 예정 항목 3 (`conversation-inspector.tsx`).
  - 상세: 기존 `SystemErrorRow`/`SystemErrorDetail`, `PresentationDetail`, `ToolDetail`과 동일한 `<Kind>Row`(SummaryView)/`<Kind>Detail`(SelectedItemDetail) 명명 패턴을 정확히 따른다. 또한 PR #959에서 삭제된 `RagDetail`/`RagBubbleSummary`와 이름이 겹치지 않아 git 이력상 "되돌림"으로 오인될 소지도 없다. 위반 없음 — 우수 사례로 기록.

- **[INFO] `ragSources` 한정 스코프 — 구현이 이미 구조적으로 보장됨 (검토 관점 a 충족)**
  - target 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:324-334, 430-453` (`TurnRagDelta`, `extractTurnDebug`).
  - 상세: `AiMetadata.turnDebug`는 이미 `TurnRagDelta[]`(= `{ turnIndex, ragSources, ragDiagnostics }`)로 정규화돼 있고, `extractTurnDebug`의 주석이 명시적으로 "drops llmCalls / totalDurationMs (handled elsewhere)"라고 밝힌다. `mergeRagRetrievalItems(items, ragDeltas: TurnRagDelta[])`가 이 이미 축소된 타입을 파라미터로 받으므로, 사용자 배경 설명의 우려("`llmCalls`를 건드리지 않는지")는 코드 구조상 원천적으로 충족된다 — `llmCalls`는 애초에 이 타입에 존재하지 않는다. 위반 없음.

- **[INFO] Inv-9 "동일 소스 함수 재사용" — 설계 수준에서는 충족, 구현 시 공유 헬퍼 추출 권장**
  - target 위치: 구현 예정 항목 4 (`result-detail.tsx`).
  - 상세: 계획대로 `mergeRagRetrievalItems`의 `ragDeltas` 인자와 기존 `turnRefIndex`(`Map<number, RagSource[]>`, L1026-1032)가 동일한 `aiMetadata.turnDebug` 배열에서 파생되므로 데이터 동일성은 보장된다. 다만 Inv-9 원문은 "**동일 소스 함수 재사용**"이라고 못박고 있어(단순 동일 원본 배열이 아니라 파생 함수 자체의 재사용), `turnRefIndex`를 만드는 `.map((t) => [t.turnIndex, t.ragSources])`와 `mergeRagRetrievalItems` 내부의 매칭 로직이 각각 독립적으로 구현되면 문구상 완전한 준수는 아니다. CT-S18(f)이 이를 테스트로 잡아주므로 기능적 위험은 낮지만, 작은 공유 헬퍼(`turnIndex → RagSource[]` 맵 빌더) 추출을 권장.

## 요약

Phase 2 구현 계획은 spec 본문(§1.1.2·§1.2.2·§9.1·§9.2·§9.3·§9.6·§9.11·§9.12·Inv-9·CT-S18~20·§8.6)의 핵심 설계 — `ragSources` 한정 스코프, `system_error`와 평행한 명명·구조 패턴, `RagRetrievalRow`/`Detail` 명명 — 를 대체로 정확히 반영하고 있으며 특히 "llmCalls 미접근" 요구는 기존 `TurnRagDelta` 타입 설계로 이미 구조적으로 충족된다. 그러나 두 개의 CRITICAL 갭이 있다: (1) 별도 정식 규약 `spec/conventions/interaction-type-registry.md`가 자임한 "신규 enum 값 반드시 등록" 의무가 Phase 1·Phase 2 어디에도 반영되지 않아 이 문서가 구현 완료 즉시 stale해지고, (2) `result-timeline.tsx`만 계획에 포함되고 실제 아이템별 시각 분기를 담당하는 `conversation-timeline-item.tsx`가 빠져 있어 §9.6 "양 surface 동시 적용" 의무와 이 계획 자체가 요구하는 CT-S18(e)/Inv-5 검증을 구조적으로 만족시키지 못할 위험이 있다. 추가로 TypeScript exhaustive-switch 컴파일 계약과 spec §9.5 "switch 에 6 case" 서술 사이의 잠재적 모순, 그리고 이미 커밋된 spec 자체의 §9.11 카운트 잔여 drift(3 vs 4행), `RagSource`/`TurnRagDelta` 타입의 lib/component 계층 배치 미결정이라는 WARNING급 이슈들이 있다. 이들은 모두 구현 착수 전에 계획을 보정하면 저비용으로 해소 가능하다.

## 위험도

HIGH
