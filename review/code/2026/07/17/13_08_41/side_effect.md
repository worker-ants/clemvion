# Side Effect Review — 최종 라운드 (델타: b1698d538)

대상: 1회차(`review/code/2026/07/17/12_54_39/`) CRITICAL 지적("live 분기가 `mergeRagRetrievalItems` 를 건너뛰어 🔎 행이 안 나오고 인덱스 공간이 갈린다") 반영 커밋.

## 점검 내역

### (a) `effectiveConversationMessages` 교체가 모든 경로에서 인덱스 공간을 실제로 통일했는지

`result-detail.tsx` 를 직접 추적함 (`codebase/frontend/src/components/editor/run-results/result-detail.tsx`):

- live(`isWaitingConversation`) 분기(L1094-1115), history(`isConversationHistory`) 분기(L1122-1136), `selectedMessage` 계산(L1139-1142), `NodeDetailTabs` 호출(L1236) — **네 지점 모두** 이제 `effectiveConversationMessages` 하나만 참조한다. 이전에는 live 분기만 raw `conversationMessages` 를 썼고 나머지 세 곳은 이미 병합 배열을 썼던 자기 모순(같은 컴포넌트 내부 index 불일치)이 이번 교체로 해소됨.
- `ConversationInspector` 내부(`conversation-inspector.tsx` L146-225, L914)를 확인: `selectedItemIndex` 조회와 `SummaryView` 의 `items = conversationMessages` 렌더링·클릭 인덱스(`onSelectItem(i)`)가 **모두 prop 으로 받은 배열 하나**를 기준으로 동작한다. 즉 `ResultDetail` 이 넘기는 배열이 곧 클릭 → `handleSelectMessage` → `onSelectConversationItem` 왕복의 인덱스 공간이다. 이제 live/history 어느 쪽이든 이 배열이 `effectiveConversationMessages` 이므로 왕복 경로도 병합 공간과 일치.
- `ResultTimeline`(`result-timeline.tsx` L148-163)은 독립적으로 `mergeRagRetrievalItems(baseItems, extractAiMetadata(result.outputData)?.turnDebug ?? [])` 를 노드별로 계산한다. `baseItems` 는 live 시 `ctx.conversationMessages`(store 원본, `run-results-drawer.tsx` 에서 `ResultDetail`/`ResultTimeline` 양쪽에 **동일 참조**로 전달됨, L422/L448)로 `ResultDetail` 이 병합 전에 쓰는 값과 소스가 같고, 병합 함수·`turnDebug` 소스(`result.outputData`)도 동일하다. 두 컴포넌트가 별도 계산이지만 **입력·함수가 같아 출력이 구조적으로 동일**함을 코드로 확인(참조 재사용이 아니라 각자 재계산이라는 점은 architecture 관점 후속 항목으로 이미 별도 처리 결정됨 — 이번 라운드 side-effect 관점에서는 문제 없음).
- 실행 상세 페이지(`executions/[executionId]/page.tsx`)는 `ResultTimeline` 없이 `ResultDetail` 단독 재사용(주석 "V-05" 확인). 이 페이지는 애초에 두 컴포넌트 간 인덱스 분리 문제는 없었지만, `ResultDetail` **내부** 자기모순(라이브 Preview 렌더 vs `selectedMessage`/`NodeDetailTabs` lookup 불일치)에는 노출돼 있었다 — 이번 수정이 `result-detail.tsx` 단일 파일에 있으므로 드로어·실행 상세 페이지 양쪽에 동일하게 적용됨을 확인.
- `mergeRagRetrievalItems`(`lib/conversation/conversation-utils.ts`)는 `turnDebug` 가 비어 있으면(`byTurn.size === 0`) 입력 배열 **참조를 그대로 반환**한다 — RAG 데이터가 없는 기존 대화(CT-S19 케이스)에서는 `effectiveConversationMessages === baseConversationMessages` 이므로 이번 교체가 무자료 케이스의 기존 동작을 바꾸지 않음을 확인.
- 실제로 `result-detail.test.tsx` + `result-timeline.test.tsx` 를 재실행 → **49/49 passed**, CT-S18(e)/(f)·CT-S19 포함.

결론: 코드 변경이 필요한 side-effect 없음.

### (b) `uniqueDocumentNames` 통합이 기존 표시 차이(cap vs no-cap)를 보존하는지

`conversation-inspector.tsx` 를 직접 확인:

- `ReferencesChip`(L70-102): `const docNames = uniqueDocumentNames(sources); const shown = docNames.slice(0, MAX_VISIBLE_DOC_NAMES); ...` — dedup 은 헬퍼로, **cap(slice)은 여전히 호출부에 남아** 있다. 헬퍼는 순수 dedup 만 담당하고 truncation 로직을 흡수하지 않았으므로 cap 적용 지점은 이전과 동일.
- `RagRetrievalRow`(L704-757): `onJumpToReferences` 유무로 `<ReferencesChip>`(cap 적용) 또는 `uniqueDocumentNames(sources).join(" · ")`(cap 미적용) 로 분기하는 기존 로직 그대로. dedup 호출만 헬퍼로 치환.
- `conversation-timeline-item.tsx` L462: `uniqueDocumentNames(item.rag?.sources ?? []).join(" · ")` — 이전 `Array.from(new Set(...)).join(" · ")` 과 동일하게 cap 없음.
- 헬퍼 구현(`lib/conversation/rag-types.ts` L54-56) 자체가 `Array.from(new Set(sources.map(s => s.documentName)))` 로 기존 인라인 로직과 1:1 동일 — 순서·중복 제거 규칙 변경 없음.

결론: 세 호출부의 cap 적용 차이가 의도대로 보존됨. 코드 변경 불필요.

### (c) 새 파급 확인

- `uniqueDocumentNames` export 이름 충돌 없음(`grep` 전수 확인, 3개 소비처만 존재).
- `rag-types.ts` 에 새 import 추가 없음 — 순환 의존 리스크 없음. `lib/` → `components/` 레이어 역전도 발생하지 않음(헬퍼가 `components/` 를 import 하지 않음).
- `documentName` 잔여 사용처(`result-detail.tsx:630`, `output-shape.ts`, `knowledge-base/*`)는 이번 dedup 통합과 무관한 별개 렌더/파싱 지점 — 헬퍼 미적용 누락이 아님(References 탭 전체 목록은 애초에 dedup 대상이 아니었음).
- fixture(`conversation-scenarios.ts`) 신설은 순수 데이터 상수 추가이며 파일시스템·전역 상태·네트워크 부작용 없음. 테스트 파일 변경도 동일.
- `spec/conventions/interaction-type-registry.md`, `plan/in-progress/rag-tool-row-distinct-ui.md` 변경은 문서 정정으로 런타임 부작용 없음.
- `review/code/2026/07/17/12_54_39/*`(RESOLUTION.md, SUMMARY.md, `_retry_state.json` 등)는 이전 라운드 산출물 스냅샷 — 코드가 아니며 부작용 대상 아님.

## 발견사항

없음 — 코드 변경이 필요한 side-effect 지적 없음.

## 요약

1회차 CRITICAL(라이브 분기의 raw store prop 사용으로 인한 🔎 행 누락 + 인덱스 공간 분리)은 `result-detail.tsx` 의 `effectiveConversationMessages` 단일 참조 교체로 근본 해결됐음을 `ConversationInspector`·`ResultTimeline`·실행 상세 페이지 세 소비 경로 모두에서 직접 코드 추적으로 확인했다. `mergeRagRetrievalItems` 가 `turnDebug` 부재 시 입력 참조를 그대로 반환하므로 무자료 케이스의 기존 동작도 보존된다. `uniqueDocumentNames` 헬퍼 통합은 dedup 규칙만 추출했을 뿐 `ReferencesChip` 의 cap 적용과 나머지 두 호출부의 무cap 동작 차이를 그대로 유지하며, 새로운 순환 의존·레이어 역전·네이밍 충돌도 없다. 신설 fixture·테스트·spec 정정은 순수 추가/문서 변경으로 부작용이 없다.

## 위험도

NONE
