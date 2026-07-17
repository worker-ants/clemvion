# 아키텍처(Architecture) Review — 🔎 `rag` 행 신설

## 발견사항

- **[INFO]** (a) 타입 레이어 이동(`output-shape.ts` → `lib/conversation/rag-types.ts`) — 판단·실행 모두 타당, re-export 방식도 기존 선례와 정합
  - 위치: `codebase/frontend/src/lib/conversation/rag-types.ts` (신규), `codebase/frontend/src/components/editor/run-results/output-shape.ts:11-21`
  - 상세: 실측 확인 — `mergeRagRetrievalItems` (`lib/conversation/conversation-utils.ts:948`)는 이 PR 에서 **신규로** 생기는 함수이므로 "저장소에 lib→components import 가 0건" 이라는 배경 서술은 "과거에 이미 위반이 있었다"가 아니라 "이 PR 이 그대로 두면 새 위반을 만든다"는 사전 예방적 판단이며, 그 인과는 코드로 확인된다 — 이 PR 이전에는 `lib/**` 아래 어떤 파일도 `@/components/**` 를 import 하지 않음 (`grep -rl "from \"@/components" src/lib` 결과 0건). 타입만 옮기고 `output-shape.ts` 는 `import type` 후 `export type` re-export 로 기존 소비처(`result-detail.tsx:25-26`, `conversation-inspector.tsx:21`)의 로컬 경로 import 를 보존한 점은 이미 존재하는 `components/editor/run-results/conversation-utils.ts` 의 값(함수) re-export 패턴(`@/lib/conversation/` 으로 이전 후 로컬 파일은 `export { ... } from "@/lib/conversation/conversation-utils"`)과 구조적으로 동일해 이 디렉터리의 기존 관례를 그대로 따른 것 — 새 관례를 만들지 않았다.
  - 단, 이 이동은 "절반의 조치"다: `output-shape.ts` 에는 wire(`unknown`) → `RagSource[]`/`TurnRagDelta[]` 로 변환하는 실제 파싱 로직(`extractRagSources`, `extractRagDiagnostics`, `extractTurnDebug`, `extractAiMetadata`, `output-shape.ts:405-475`)이 그대로 `components/` 아래 남아 있다. 결과적으로 `lib/` 의 `mergeRagRetrievalItems` 는 정적 import 로는 `components/` 를 참조하지 않지만, 두 실제 호출부(`result-detail.tsx:1091`, `result-timeline.tsx:161`) 모두 이 함수가 소비하는 `TurnRagDelta[]` 값 자체는 `components/.../output-shape.ts` 의 파싱 함수가 만든 것에 의존한다 — 타입 레이어는 역전을 피했지만 "wire→domain 파싱"이라는 순수 비즈니스 로직 책임은 여전히 프레젠테이션 디렉터리에 남아 있다.
  - 제안: 이번 PR 스코프 밖으로 두더라도, 향후 `output-shape.ts` 의 순수 파싱 함수들(React/JSX 의존 없음)을 `lib/conversation/` 또는 별도 `lib/node-output/` 로 옮겨 "components/ = 렌더링 전용, lib/ = 파싱+변환" 경계를 완전히 정리할 것을 백로그로 남길 만하다.

- **[INFO]** (b) `mergeRagRetrievalItems` 양쪽(ResultDetail·ResultTimeline) 개별 호출 — 구조적으로 불가피하며 기존 관례와 정합, drift 방지 장치는 없음
  - 위치: `result-detail.tsx:1089-1092`, `result-timeline.tsx:119(TimelineRow)`, `:149-162`
  - 상세: `ResultTimeline` 은 `results: NodeResult[]` (복수 노드)를 받아 `TimelineRow` 를 트리 순회하며 **노드마다** 호출한다(`result-timeline.tsx:398`, `:507`의 `<TimelineRow .../>` 호출부 확인). 반면 `ResultDetail` 은 `result: NodeResult`(단일 선택 노드) 하나만 다룬다. 두 컴포넌트는 이 PR 이전부터 이미 "베이스 아이템 유도" 로직 자체가 분리·비대칭이었다 — `ResultDetail` 의 `baseConversationMessages` 는 `isWaitingConversation || hasLiveSystemError` 조건인 반면 `ResultTimeline` 의 `baseItems` 는 `isLiveNode`(`isLiveConversation && status==='waiting_for_input' && isMultiTurn`) 조건으로, 완전히 같은 식이 아니다. 즉 "같은 배열을 만들기 위한 단일 소스"가 애초에 없던 아키텍처이므로, `mergeRagRetrievalItems` 를 양쪽에서 각자 호출하는 것은 새로운 결합도 문제를 추가하는 게 아니라 기존 패턴을 그대로 연장한 것 — 타당한 판단이다.
  - 다만 코드베이스에는 "병합 로직을 상위 계층(스토어/훅)에서 1회 수행"하는 실제 선례도 존재한다 — `mergeOrphanToolItems` (`conversation-utils.ts:782`)는 `use-execution-events.ts:430` 단 한 곳, 상태 갱신 계층에서만 호출된다(단, 이건 `prev` 누적 상태가 필요한 라이브 전용 병합이라 컴포넌트 레이어의 history 유도와는 성격이 다르다). `mergeRagRetrievalItems` 는 함수 자체는 이미 공유(로직 복제가 아니라 호출 복제)돼 있어 "같은 계산, 다른 코드" 위험은 없지만, "같은 계산이 두 계약 지점에서 유지돼야 한다"는 사실 자체가 향후 `mergeRagRetrievalItems` 시그니처 변경 시 두 호출부를 동시에 갱신해야 하는 shotgun-surgery 위험을 남긴다.
  - 제안: 필수는 아니나, `useConversationItemsForResult(result, ctx)` 류의 공유 훅으로 "베이스 아이템 유도 + rag 병합"을 한 곳에 캡슐화해 두 컴포넌트가 훅만 호출하게 하면, 함수 호출은 여전히 두 번 일어나되 계약 변경 시 갱신 지점은 하나로 줄어든다.

- **[INFO]** (c) `threadTurnsToConversationItems` 의 `rag` 방어 case — `ConversationTurnSource` 유지가 대안(제거)보다 우월, 기존 `system_error` 선례와 완전히 동형
  - 위치: `conversation-utils.ts:210(switch), :289-297(case "rag"), :329-336(default/_exhaustive: never)`
  - 상세: 실측 결과 이 설계는 새로운 패턴이 아니라 `system_error` 도입 때 이미 확립된 것과 **정확히 동일한 구조**다. `system_error` 도 backend 5-value enum 에는 없고(`interaction-type-registry.md` 자체가 "backend 누적 enum은 system_error·rag 제외 5값" 이라 명시), production 코드에서 `source: "system_error"` 인 `ConversationTurn` 을 만들어 `threadTurnsToConversationItems` 로 흘리는 호출부도 없다(유일한 실사용 호출부는 `use-execution-events.ts:420` 이며 여기 흘러드는 `threadTurns` 는 실제 backend WS payload — 5값만 가능). 즉 `system_error` case(:298-328)도 오늘 프로덕션에서는 `rag` case 처럼 사실상 도달 불가능하고, 유일하게 실행되는 곳은 단위 테스트(`conversation-utils.test.ts:1265`, `:1296`)뿐이다. `rag` 를 여기서 빼고 `ConversationItem['type']` 에만 두는 대안을 택하면 (1) `interaction-type-registry.md §2` 가 이미 문서화한 "AST 가드 대상 — `SOURCE_REGISTRY_SITES` grep 테스트가 모든 등록 source 값의 문자열 리터럴 존재를 강제" 레지스트리 패턴과 어긋나 `system_error`/`rag` 사이에 비대칭 처리 규칙이 생기고 (2) `_exhaustive: never` 컴파일 타임 가드가 `rag` 를 커버하지 못해, `ConversationTurnSource` 를 순회하는 신규 코드가 생겨도 `rag` 누락을 잡아주지 못한다. 즉 현 설계가 대안보다 일관성·안전성 모두 우월하다.
  - 사소한 비대칭 한 가지: `system_error` case 는 (도달 시) 실제 아이템을 구성해 push 하는 반면 `rag` case 는 `break` 로 완전히 no-op 이다. 이론상 `turn.source === "rag"` 인 wire 페이로드가 실수로 들어와도 `default` 의 `console.warn` 조차 안 거치고 조용히 스킵된다 — 실무 영향은 backend enum 계약(5값 고정) 위반 시나리오이므로 극히 낮음.
  - 결론: (c) 는 CRITICAL/WARNING 대상 아님. 설계 타당.

- **[WARNING]** (d) `effectiveConversationMessages`/`items` 재계산이 두 호출부 모두 비메모이즈 — "훅 규칙상 불가"라는 코멘트 근거가 `result-timeline.tsx` 쪽에는 적용되지 않음
  - 위치: `result-detail.tsx:1085-1092`, `result-timeline.tsx:119-162`
  - 상세: `result-detail.tsx` 의 코멘트("이 계산부는 `if (!result) return` 이후라 훅을 호출하면 조건부 훅이 되어 깨진다")는 **텍스트 그대로 그 위치에 훅을 넣으면** 맞는 말이다. 하지만 같은 파일의 `aiMetadata`/`turnRefIndex` (:1021-1033)는 정확히 같은 제약(“`result` 가 null 일 수 있다”)을 `useMemo(() => (result ? extractAiMetadata(result.outputData) : null), [result])` 처럼 **null 케이스를 콜백 내부에서 처리**해 early return **이전**에 위치시키는 방식으로 이미 해결해 두었다. `effectiveConversationMessages` 도 동일 패턴(`baseConversationMessages`/`hasLiveSystemError` 계산을 콜백 내부로 이동하고 `[result, isWaitingConversation, conversationMessages, aiMetadata]` 등을 deps 로)으로 early return 이전에 옮겨 메모이즈할 수 있었다 — "훅을 못 쓴다"가 아니라 "지금 위치에 그대로 두면 못 쓴다"가 정확한 진술이며, 코멘트가 이 구분을 흐린다.
  - `result-timeline.tsx` 쪽은 이 제약 자체가 없다. `TimelineRow` 는 early return 이 전혀 없는 순수 함수형 컴포넌트로 JSX(`<TimelineRow .../>` , :398/:507)로 렌더되므로 `items` 계산을 `useMemo(() => mergeRagRetrievalItems(baseItems, extractAiMetadata(result.outputData)?.turnDebug ?? []), [baseItems, result.outputData])` 로 감싸는 데 아무 기술적 장애가 없다. `TimelineRow` 는 타임라인에 보이는 **AI 멀티턴 노드마다 1회씩** 렌더되고, 상위(`ResultTimeline`)는 라이브 실행 중 WS 이벤트마다 재렌더되는 경로이므로, AI Agent 노드가 여러 개인 워크플로에서는 매 WS 이벤트마다 노드 수만큼 `extractAiMetadata`(wrapper 언래핑 + 배열 매핑, `output-shape.ts:420-435`) + `mergeRagRetrievalItems` 가 반복 재계산된다. 이는 이 PR 이전에도 `parseHistoryMessages` 가 비메모이즈였다는 점에서 완전히 새로운 회귀는 아니지만, 이번에 추가된 `extractAiMetadata` 호출은 그 위에 얹히는 순연산 비용이며 하필 기술적 장벽이 없는 지점이라 메모이즈 미적용의 기회비용이 크다.
  - 제안: 최소한 `result-timeline.tsx` 의 `TimelineRow` 에는 `useMemo` 적용을 권장. `result-detail.tsx` 는 `aiMetadata` 패턴을 그대로 `effectiveConversationMessages` 에도 적용해 이른 반환 이전으로 이동시키는 리팩터를 고려.

- **[WARNING]** 문서명 중복 제거+표시 로직이 3곳에 복제되어 있고, 그중 1곳(`ReferencesChip`)만 개수 상한(cap)을 적용해 서면(surface)별 표시 정책이 이미 갈라짐
  - 위치: `conversation-inspector.tsx:80-81`(`ReferencesChip`, `MAX_VISIBLE_DOC_NAMES=2` 적용), `conversation-inspector.tsx:191`(`RagRetrievalRow` 의 `onJumpToReferences` 미제공 폴백 — 무제한), `conversation-timeline-item.tsx:287-289`(타임라인 인라인 행 — 무제한)
  - 상세: 세 곳 모두 `Array.from(new Set(sources.map(s => s.documentName)))` 를 각자 재구현한다. `RagRetrievalRow` 의 주석(§9.2/Inv-9)은 "세 표면이 같은 `sources[]` 를 보여야 하므로 중복 정의 회피"를 근거로 `ReferencesChip` **컴포넌트**를 재사용(가능한 경우)한다고 설명하지만, 실제로는 `onJumpToReferences` 가 없는 호출 경로(주석상 detail 뷰 등)와 `conversation-timeline-item.tsx` 의 좌측 컴팩트 행은 `ReferencesChip` 을 쓰지 않고 자체 인라인 로직을 새로 작성했다. 그 결과 `ReferencesChip` 은 2개 초과 시 "+N" 배지로 자르는 반면 새 두 곳은 무제한 join 이다(다만 두 곳 모두 `className="truncate"` CSS 로 시각적 오버플로는 방지되므로 레이아웃 붕괴는 없음). 데이터(Inv-9 의 대상)는 동일하지만 **렌더 정책**은 이미 3중 분기로 나뉘어 있어, 향후 한쪽만 정책을 바꾸면(예: cap 값 조정) 나머지 두 곳은 자동으로 따라가지 않는다.
  - 제안: `uniqueDocumentNames(sources: RagSource[]): string[]` 같은 순수 헬퍼를 `lib/conversation/` 에 두고 세 렌더 지점이 이를 호출하게 하면, cap 정책 변경 시 단일 지점만 수정하면 된다. 최소한 cap 적용 여부(2개+배지 vs 무제한)를 의도적 정책으로 스펙에 명문화할 필요는 있다.

- **[INFO]** `lib/` → `components/` 계층 경계가 코드 주석에만 의존 — 자동 가드(ESLint) 부재
  - 위치: `eslint.config.mjs` (전체), `rag-types.ts:4-9`, `output-shape.ts:11-14`
  - 상세: 이번 PR 이 명시한 "lib → components 역전 금지" 규칙은 두 파일의 주석으로만 존재하고, `eslint.config.mjs` 에는 이를 강제하는 `no-restricted-imports`/`import/no-restricted-paths`/`eslint-plugin-boundaries` 류 규칙이 없다(grep 결과 0건). `ConversationTurnSource` 값 누락은 이미 grep 기반 AST-lite 테스트(`interaction-type-exhaustiveness.test.ts`)로 자동 가드되는 것과 대조적으로, 이 계층 규칙은 순수 컨벤션이라 향후 PR 이 무심코 `components/` 에서 타입/함수를 다시 lib/ 로 끌어오는 import 를 추가해도 빌드는 통과한다.
  - 제안: 필수는 아니나, `lib/**` 에서 `@/components/**` import 를 금지하는 ESLint 규칙 1줄 추가를 백로그로 남길 만하다 — 이번 PR 이 스스로 세운 규칙을 기계적으로 보장.

- **[INFO]** spec(`interaction-type-registry.md`)이 언급하는 `RagRetrievalDetail` 컴포넌트가 실제 구현에는 없음(`RagRetrievalRow` 재사용으로 대체) — 같은 PR 내 문서·코드 drift
  - 위치: `spec/conventions/interaction-type-registry.md` diff (파일 44, "우측 인스펙터는 ... `SelectedItemDetail` 의 `RagRetrievalDetail`" 서술) vs `conversation-inspector.tsx:374-380`(`SelectedItemDetail` 의 `item.type === "rag"` 분기가 별도 컴포넌트 없이 `<div className="p-3"><RagRetrievalRow item={item} /></div>` 로 직접 재사용)
  - 상세: 코드 쪽 설계(별도 detail 컴포넌트를 만들지 않고 행 컴포넌트를 그대로 재사용)는 그 자체로 합리적 단순화이고 주석으로 근거(§9.1, Inv-9)도 남겼다 — 아키텍처적으로 문제 삼을 지점은 아니다. 다만 같은 PR 에 포함된 spec 문서(`interaction-type-registry.md`)가 여전히 존재하지 않는 `RagRetrievalDetail` 이라는 컴포넌트명을 "AST 가드 비대상"이라며 언급하고 있어, 이 문서를 근거로 향후 코드를 찾는 사람이 혼란을 겪을 수 있다.
  - 제안: `interaction-type-registry.md` 의 해당 문구를 실제 구현(`RagRetrievalRow` 재사용)에 맞게 정정 — architecture 리뷰 스코프상 blocking 은 아니며 spec-coverage/consistency 트랙에서 처리해도 무방.

## 정합성 확인 (문제 아님 — 대조 결과 기록)

- `RagRetrievalRow` 의 props 설계(`onJumpToReferences?`, `isClickable?`, `onClick?`, `onKeyDown?` 모두 optional)는 "클릭 가능한 목록 행" 모드와 "정적 detail 뷰" 모드 양쪽에서 불필요한 props 강제 없이 재사용되므로 인터페이스 분리 원칙에 부합.
- `mergeRagRetrievalItems` 는 `mergeOrphanToolItems` 와 동일하게 `conversation-utils.ts` 안의 "후처리 병합" 함수군에 속하며, 순수 함수·단일 책임(턴별 rag 소스 → 독립 행 삽입)으로 단위 테스트(CT-S18/19/20, `conversation-utils.test.ts:519-604`)와 함께 응집도 높게 구현됨.
- `threadTurnsToConversationItems`(`ConversationTurn.source` 판별)를 exhaustive switch 로 닫아 두는 설계는 개방-폐쇄 원칙 위반이 아니라, 고정된 discriminated union 을 다루는 데 의도적으로 적합한 패턴(신규 source 누락을 컴파일 타임에 강제 검출).
- `RagSource`/`TurnRagDelta` 등 이동된 타입에 대해 실제 순환 의존은 발견되지 않음 (`lib/conversation/rag-types.ts` 는 다른 `lib/` 파일도, `components/` 도 import 하지 않는 leaf 모듈).

## 요약

이번 변경의 핵심 아키텍처 판단 4가지(타입 레이어 이동, 주입 지점 이중화, exhaustive switch 방어 case, useMemo 미사용) 중 (a)와 (c)는 실측 검증 결과 근거가 정확하고 기존 코드베이스 선례(`components/editor/run-results/conversation-utils.ts` 의 re-export 패턴, `system_error` 의 방어 case 패턴)와 완전히 정합해 견고한 판단이다. (b)는 `ResultTimeline` 이 노드별로 items 를 자체 유도하는 구조적 특성상 상위 1회 주입이 오히려 복잡도를 늘릴 뿐이라 현 구조가 타당하며, 두 컴포넌트의 "베이스 아이템 유도" 로직 자체가 이미 이 PR 이전부터 비대칭이었다는 점에서 새 결합도 문제를 추가하지 않는다. (d)는 정확도가 떨어지는 코멘트 근거(같은 파일의 `aiMetadata` 가 이미 반례)와, 특히 `result-timeline.tsx` 쪽에는 훅 규칙 제약이 아예 없는데도 메모이즈를 적용하지 않은 점이 실질적 개선 여지로 남는다. 추가로 문서명 dedup/truncation 로직의 3중 복제(정책 불일치 포함)와 lib/components 경계가 자동 가드 없이 컨벤션에만 의존한다는 점은 향후 drift 위험으로 기록해 둘 만하다. 전체적으로 CRITICAL 급 구조 결함은 없으며, 발견된 사항은 모두 저비용 개선 또는 백로그성 제안 수준이다.

## 위험도

LOW
