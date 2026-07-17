# 신규 식별자 충돌 검토 — 2회차

대상: `plan/in-progress/rag-tool-row-distinct-ui.md` (1회차 WARNING 2 + INFO 1 반영 후)

## 검증한 변경분 (재확인 결과: 충돌 없음)

- `injectRagItems` → `mergeRagInjectionItems` : 저장소 전체(`codebase/`, `spec/`) grep 0건. backend `injectConversationContext()`([`conversation-context-injection.ts`](../../codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts))와 이름 겹침 회피 목적대로 완전히 다른 식별자.
- `RagRow`/`RagDetail` → `RagInjectionRow`/`RagInjectionDetail` : 저장소 전체 grep 0건. `conversation-inspector.tsx` 의 기존 `XxxRow`/`XxxDetail` 명명 패턴(`SystemErrorRow`/`SystemErrorDetail`, `PresentationDetail`, `SystemDetail`, `UserDetail`, `ToolDetail` — [`conversation-inspector.tsx:433,593,613,643,694,755`](../../codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx))을 정확히 따름.
- `Inv-9` : `spec/` 전체에서 `Inv-1`~`Inv-8` 만 존재(§9.9). `Inv-8` 은 실측대로 커밋 `12ceee587`(PR #959, "AI 대화 노드 오류 종결 시 대화 이력 도달성 복구")이 신설한 것을 `git show` 로 확인. `Inv-9` 는 정확히 다음 번호를 선점 — 연속성 문제 없음.
- `CT-S20` : `spec/` 전체에서 `CT-S1`~`CT-S17` 만 존재(§9.10). `CT-S18`/`CT-S19`/`CT-S20` 세 개가 순서대로 다음 번호를 선점 — 연속성 문제 없음. (`CT-S15`~`CT-S17` 도 같은 PR #959 이 신설.)

## 발견사항

- **[WARNING]** `mergeRagInjectionItems(items, turnDebug)` 의 2번째 인자명 `turnDebug` 가 같은 파일의 기존 비-export 타입 `TurnDebugEntry` 와 이름이 겹쳐, "그 자리에 어떤 타입을 꽂아야 하는가"를 오인시킬 수 있음
  - target 신규 식별자: `mergeRagInjectionItems(items, turnDebug)` — target 문서 Phase 1 §9.11 항목(plan §128행) + Phase 2 항목 1(§158행)이 `conversation-utils.ts` 에 신설을 지시하나, 두 번째 파라미터의 타입을 명시하지 않는다.
  - 기존 사용처: [`conversation-utils.ts:360-370`](../../codebase/frontend/src/lib/conversation/conversation-utils.ts) — 바로 이 파일 안에 이미 `interface TurnDebugEntry { turnIndex: number; llmCalls?: LlmCallEntry[]; toolCalls?: TurnToolCallEntry[]; totalDurationMs?: number; requestPayload?: unknown; responsePayload?: unknown; durationMs?: number; }` 가 있다 (`ConvertOptions.debugByTurn?: Map<number, TurnDebugEntry>` 에서 소비, §399행). 이 타입에는 `ragSources` 필드가 **없다**. 실제로 필요한 타입은 `output-shape.ts` 의 `AiMetadata.turnDebug: TurnRagDelta[]` (§313-321행, `{turnIndex, ragSources, ragDiagnostics}` shape) 인데, target 문서 Phase 2 항목 4(§164행)가 "`aiMetadata.turnDebug` → `mergeRagInjectionItems` 배선"이라 명시하므로 실제 입력은 `TurnRagDelta[]` 다.
  - 상세: `output-shape.ts:326-328` 주석이 이 정확한 충돌의 전례를 기록하고 있다 — *"(formerly `TurnDebugEntry` — `conversation-utils.ts` 의 canonical-shaped `TurnDebugEntry`(llmCalls/toolCalls/totalDurationMs)와의 동명 충돌 해소를 위해 `TurnRagDelta` 로 rename. dev 1b.)"*. 즉 이 저장소는 정확히 같은 종류의 이름 충돌(같은 wire 필드 `meta.turnDebug` 를 서로 다른 shape 로 소비하는 두 타입이 같은 이름을 다투는 것)을 한 번 겪어 rename 으로 해소한 이력이 있다. target 이 새 함수의 파라미터명을 wire 필드명 그대로 `turnDebug` 로 붙이면서 타입을 명시하지 않으면, 구현자가 "이 파일에 이미 있는 `TurnDebugEntry`"를 재사용하려다 `ragSources` 부재로 막히거나(컴파일 에러로 방지되긴 하나 원인 파악에 시간 소요), 혹은 새 로컬 타입을 또 정의해 3번째 "turnDebug 계열 타입"이 생길 위험이 있다.
  - 제안: §9.11 contract 표와 Phase 2 항목 1에 시그니처를 `mergeRagInjectionItems(items: ConversationItem[], turnDebug: TurnRagDelta[])` 로 명시하고, `TurnRagDelta` 를 `output-shape.ts` 에서 import 함을 주석으로 남긴다(또는 `conversation-utils.ts` 로 재정의할 경우 로컬 `TurnDebugEntry` 와 이름이 겹치지 않는 별칭 사용). "동일 소스"(§164행 비고)라는 서술을 "동일 **타입**(`TurnRagDelta[]`)"까지 명시하면 재발을 막는다.

- **[WARNING]** `RagInjection*` 명명의 "Injection" 이 `ConversationItem.isInjected` / `meta.contextInjection` 과 어휘가 겹쳐 의미 혼동 소지
  - target 신규 식별자: `RagInjectionRow`, `RagInjectionDetail`, `mergeRagInjectionItems`, 그리고 §9.11 contract 표에 등재될 "RAG injection" 개념 자체.
  - 기존 사용처: (1) [`execution-store.ts:174`](../../codebase/frontend/src/lib/stores/execution-store.ts) — `ConversationItem.isInjected?: boolean` — "이 항목이 **ConversationThread injection**(다른 노드의 turn 이 messages 에 prepend됨, WS `messages[].source === 'injected'`)으로 만들어졌는가"를 뜻하는 **이미 존재하는 필드**, target 이 확장하려는 바로 그 `ConversationItem` 인터페이스 위에 있다. (2) [`conversation-thread.md:271`](../../spec/conventions/conversation-thread.md) — `meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` — contextScope 적용 결과의 디버그 echo. (3) backend `RAG_INJECT_TOKEN_BUDGET`/`RAG_MAX_INJECT_COUNT` ([`dynamic-cut.util.ts:14,16`](../../codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts)) — KB 검색 결과를 LLM 컨텍스트에 주입할 때의 예산 상수.
  - 상세: target 은 1회차에서 이미 `injectRagItems` 의 "inject" 동사가 backend `injectConversationContext()` 와 겹친다는 지적을 받아 `mergeRagInjectionItems` 로 개명했다. 그러나 명사형 "Injection" 은 컴포넌트명(`RagInjectionRow`/`RagInjectionDetail`)에 그대로 남아, 정정 후에도 여전히 **다른 의미의 "injection" 3종**(cross-node thread injection = `isInjected`/`contextInjection`, RAG KB injection = 신규 `RagInjection*`, provider tool 실행과 무관한 상수형 injection budget)이 같은 도메인 어휘를 공유한다. 특히 `isInjected` 는 정확히 같은 `ConversationItem` 객체 위에 공존하는 필드라 "이 `rag` 아이템에 `isInjected` 를 true 로 세팅해야 하나?"(정답은 no — `rag` 아이템은 `messages[]` 파생이 아니라 `turnDebug[].ragSources` 파생이라 `source: 'injected'` 마커와 무관) 같은 실제 구현 오판을 유발할 수 있다. 다만 이는 직접적인 식별자 재사용(같은 이름, 다른 의미)은 아니고 어휘 근접에 의한 혼동이라 WARNING 등급이 맞다 — "RAG 주입"이라는 용어 자체는 배경 섹션(§배경)에서도 이미 쓰이고 있어 도메인적으로는 정확한 단어 선택이다.
  - 제안: `RagInjectionRow`/`RagInjectionDetail` 정의부(또는 §1.1.2/§9.1)에 "본 `Injection` 은 KB chunk → LLM 컨텍스트 주입(§5-system/9-rag-search.md)을 가리키며, `ConversationItem.isInjected`(cross-node ConversationThread injection, §5 contextScope)와는 **다른 축**"이라는 1줄 cross-ref 를 남긴다. WARNING 2(코드 주석 의무)의 범위를 이 구분까지 확장하면 별도 조치 없이 흡수 가능.

## 요약

`mergeRagInjectionItems`/`RagInjectionRow`/`RagInjectionDetail`/`Inv-9`/`CT-S20` 등 2회차에서 변경·추가된 식별자는 저장소 전체 grep 대조 결과 **직접 충돌(동일 이름·다른 의미의 즉시 재사용)은 없다** — 1회차 WARNING 2건이 정확히 해소됐고, `Inv-9`/`CT-S18~20` 은 각각 `Inv-1~8`/`CT-S1~17` 바로 다음 번호를 정직하게 선점해 연속성도 유지된다. 다만 실측 코드 대조에서 두 가지 새로운 혼동 소지를 추가로 발견했다: (1) 신설 함수 `mergeRagInjectionItems(items, turnDebug)` 의 파라미터명이 같은 파일 내 기존 비-export 타입 `TurnDebugEntry`(다른 shape)와 이름이 겹쳐 타입 오선택 위험이 있고, 이 저장소는 정확히 이 종류의 충돌을 이미 한 번 rename(`TurnRagDelta`)으로 해소한 전례가 있다. (2) `RagInjection*` 명명의 "Injection" 이 같은 `ConversationItem` 위에 이미 존재하는 `isInjected` 필드 및 `meta.contextInjection` 과 어휘가 겹쳐, "inject" 어휘 충돌을 이미 한 번 정정한 target 의 의도가 명사형에서는 완전히 관철되지 않았다. 둘 다 컴파일 타임에 잡히거나 즉시 장애로 이어지진 않지만, 구현·유지보수 단계의 오판 비용을 줄이려면 spec 문구에 타입·범위를 명시하는 편이 안전하다.

## 위험도

MEDIUM
