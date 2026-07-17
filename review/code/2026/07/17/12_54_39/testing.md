# 테스트(Testing) Review — 🔎 `rag` 행 신설

## 발견사항

- **[CRITICAL]** spec §9.10 CT-S18 (e) "양 surface 동시 노출" 회귀 테스트가 `result-timeline.test.tsx` 에 전혀 없음
  - 위치: `spec/conventions/conversation-thread.md:658` (CT-S18 표 "충족 테스트" 열: `conversation-utils.test.ts` + `result-detail.test.tsx` + `result-timeline.test.tsx`) / 실제 diff 파일 목록(1~44)에 `result-timeline.test.tsx` 자체가 없음
  - 상세: 실측(`grep -n "rag" codebase/frontend/.../__tests__/result-timeline.test.tsx`) 결과 매치 0건 — 이번 PR 은 `result-timeline.tsx`(파일 7)에 `mergeRagRetrievalItems` 배선을 추가하고 `conversation-timeline-item.tsx`(파일 4)에 rag 렌더 분기를 추가했지만, 그 두 변경을 보호하는 테스트가 `result-timeline.test.tsx` 쪽엔 하나도 없다. 이는 우연한 누락이 아니다 — `plan/in-progress/rag-tool-row-distinct-ui.md` 의 Phase 3 절 자체가 `CT-S18 / CT-S19 (conversation-utils.test.ts + result-detail.test.tsx)` 로만 적혀 있어 애초에 `result-timeline.test.tsx` 가 목록에서 빠져 있고, 구현은 그 (불완전한) 목록을 그대로 따랐다. 더 심각한 점은 `review/consistency/2026/07/17/12_26_37/SUMMARY.md` ("impl-prep" 라운드)가 정확히 이 누락("Phase 3 테스트 목록에 CT-S18 이 요구하는 `result-timeline.test.tsx` 누락")을 지적하고 **"✅ Phase 3 반영"** 이라 처분 완료로 기록했다는 것이다 — 그런데 현재 plan 파일의 Phase 3 절엔 여전히 `result-timeline.test.tsx` 가 없고, 실제 구현에도 반영되지 않았다. 즉 "해소됐다"고 두 번(plan 상 처분 + 리뷰 기록) 표시된 항목이 실제로는 해소되지 않은 채 통과됐다.
  - 제안: `result-timeline.test.tsx` 에 CT-S18 전용 테스트를 추가한다. 최소 (1) rag 턴이 있는 `NodeResult`/`TimelineRow` 를 렌더해 🔎 행이 실행 트리 timeline 에도 나타나는지, (2) 같은 턴에 tool 행이 있어도 두 행이 각각 독립적으로 공존하는지 확인. `mergeRagRetrievalItems` 가 `result-detail.tsx`/`result-timeline.tsx` 양쪽에서 각자 별도로 호출되는 구조(코드 중복 배선)라 한쪽 배선만 깨져도 지금은 어떤 테스트도 잡지 못한다.

- **[CRITICAL]** CT-S18 (f) `Inv-9` (References 탭·🔎 행·📚 chip 의 `sources[]` 동일성) 전용 회귀 테스트 부재
  - 위치: `spec/conventions/conversation-thread.md:633` (Inv-9 정의), `:658` (CT-S18 (f)) / `codebase/frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx:788-808` ("filters References to selected assistant message's turn only")
  - 상세: 저장소 전체에서 `"Inv-9"` 문자열이 테스트 코드 어디에도 등장하지 않는다(`grep -rn "Inv-9" codebase/frontend/src --include="*.test.ts*"` → 0건). `RagRetrievalRow` 를 실제로 렌더해 문서명을 검증하는 테스트도 없다(`grep -rn "RagRetrievalRow" --include="*.test.ts*"` → 0건). 기존에 정정도 없이 남아 있는 `"filters References to selected assistant message's turn only"` 테스트는 References 탭 콘텐츠(`요금.md`)만 확인할 뿐, **같은 화면의 🔎 행에도 동일 `요금.md` 가 표시되는지 교차 비교하는 assertion 이 없다.** `mergeRagRetrievalItems`(🔎 행 소스, `result-detail.tsx` 내 `effectiveConversationMessages` 계산부)와 `turnRefIndex`(References 탭 소스, 같은 파일의 별도 계산부)는 둘 다 `aiMetadata.turnDebug` 를 읽지만 **서로 다른 코드 경로**이므로, 한쪽만 깨지는 회귀(즉 "References 탭엔 청크가 있는데 미리보기 행엔 없다")를 잡을 테스트가 spec 이 명시적으로 요구했음에도 없다.
  - 제안: `result-detail.test.tsx` 의 기존 References 필터링 테스트에 "🔎 행도 같은 문서명(`요금.md`)을 보여준다" assertion 을 추가하거나, CT-S18(f)/Inv-9 를 명시적으로 라벨링한 별도 테스트를 신설.

- **[WARNING]** `RagRetrievalRow`(conversation-inspector.tsx)·`rag` 분기(conversation-timeline-item.tsx)에 대한 컴포넌트 렌더 테스트 전무
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:377-386`(SelectedItemDetail `rag` 분기), `:752-816`(RagRetrievalRow 구현부), `:1152-1165`(SummaryView `rag` 분기) / `conversation-timeline-item.tsx:70-91`(rag 분기)
  - 상세: 이번 diff 는 conversation-inspector.tsx 에 신규 렌더 함수(`RagRetrievalRow`, ~70줄)와 두 개의 분기(SelectedItemDetail·SummaryView)를, conversation-timeline-item.tsx 에 신규 rag 분기를 추가했지만, 두 파일 어느 쪽 테스트에도 `type: "rag"` 인 `ConversationItem` 을 실제로 렌더해 DOM 을 검증하는 테스트가 없다(`conversation-inspector.test.tsx` diff 는 순수 rename 뿐). 테스트가 존재하는 곳은 순수함수 `mergeRagRetrievalItems`(`conversation-utils.test.ts`, lib 레벨)뿐이며, 이는 "rag 아이템이 배열의 올바른 위치에 삽입되는지"만 검증할 뿐 "그 아이템이 화면에서 🔎 아이콘·점선 컨테이너·`KB · N chunk(s)` chip·클릭 시 `onJumpToReferences` 호출 등으로 올바르게 렌더되는지"는 검증하지 않는다. 특히 CT-S18 (b) "3중 신호 모두 다름"과 (c) "`groupToolCallItems` 가 claim 하지 않음"은 렌더/조합 레벨의 사실인데 이를 확인하는 자동 테스트가 없어 사람 눈 리뷰에만 의존하는 상태다.
  - 제안: `conversation-inspector.test.tsx` 에 최소 (1) rag 아이템 렌더 시 점선 컨테이너·🔎 아이콘·`ragChunks` i18n 텍스트 노출, (2) 같은 턴에 tool 아이템이 섞여도 `groupToolCallItems` 에 흡수되지 않고 독립 row 로 남는지(claimedToolIndices 미포함), (3) `onJumpToReferences` 클릭 시 콜백이 해당 `turnIndex` 로 호출되는지 검증하는 테스트를 추가.

- **[WARNING]** CT-S18/19/20 fixture 가 spec §9.10 의 "단일 export" 규약(`conversation-scenarios.ts`)을 위반
  - 위치: `spec/conventions/conversation-thread.md:661` ("본 시나리오들의 입력 fixture 는 ... `fixtures/conversation-scenarios.ts` 에 단일 export 로 둔다. 새 시나리오 발견 시 본 표 추가 + fixture 추가 + 해당 테스트 작성을 PR review 의 의무로 한다.") vs `codebase/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts:519-604`(신규 `describe` 블록, 로컬 `src()` 헬퍼 + 인라인 `items`/`ragDeltas` 리터럴)
  - 상세: CT-S1~S17 은 실제로 `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts` 에 `ctS1WhitespaceContentWithToolCalls` ~ `ctS17HistoryFailedConversation` 이름으로 export 되어 있고, 파일 하단의 `conversationScenarios` 레지스트리 객체(컴파일 타임 완결성 체크 의도)에도 집계된다. `result-detail.test.tsx` 는 `ctS15/16/17` 을 실제로 그 파일에서 import 해 재사용한다(`import { ctS15..., ctS16..., ctS17... } from "./fixtures/conversation-scenarios"`). 반면 CT-S18/19/20 은 이 규약을 따르지 않고 `conversation-utils.test.ts` 내부 지역 헬퍼/리터럴로만 존재하며, `conversation-scenarios.ts` 자체는 이번 diff 에서 전혀 수정되지 않았다(변경 파일 목록에 없음). `plan/in-progress/rag-tool-row-distinct-ui.md` Phase 3 절도 "fixture `conversation-scenarios.ts` 추가" 를 명시적으로 계획했으나 실행되지 않았다.
  - 이는 스타일 문제만이 아니다: fixture 가 단일 export 로 없으므로 `result-detail.test.tsx`/`result-timeline.test.tsx` 가 같은 rag+tool 동시발생 시나리오 데이터를 재사용할 손쉬운 경로가 없다 — 위 두 CRITICAL 커버리지 갭(result-timeline 무테스트, Inv-9 교차검증 부재)을 조장한 근본 원인 중 하나로 보인다.
  - 제안: `src()` 헬퍼와 CT-S18/19/20 입력을 `conversation-scenarios.ts` 로 이동해 `ctS18RagAndToolSameTurn` 등 named export + `conversationScenarios` 레지스트리 등록, `conversation-utils.test.ts`/`result-detail.test.tsx`/(신설될) `result-timeline.test.tsx` 모두 동일 fixture 를 import.

- **[INFO]** 인덱스 시프트(3→5, 1→2)는 실측상 정당한 정정 — 원래 의도(두 번째/첫 번째 assistant 선택) 유지 확인
  - 위치: `result-detail.test.tsx:788-808`, `:822-845`
  - 상세: `makeAiResultBothTurnsWithRag` fixture 의 메시지 배열(`[user, assistant, user, assistant]`)에 대해 `messagesToConversationItems`(`lib/conversation/conversation-utils.ts:428-`)가 turnIndex 를 `1,1,2,2` 로 부여함을 실측 확인했고, `mergeRagRetrievalItems` 는 두 턴 모두 `ragSources` 가 비어있지 않으므로(turn1: 환불.md, turn2: 요금.md) 각 턴의 첫 assistant 앞에 rag 행을 삽입한다. 병합 결과 `[user1, rag1, assistant1, user2, rag2, assistant2]` (인덱스 0~5)로, diff 가 주장하는 3→5(두 번째 assistant), 1→2(첫 assistant) 매핑과 정확히 일치한다. 또한 `selectedConversationItemIndex` 는 `result-detail.tsx:1137` 에서 일관되게 병합된 `effectiveConversationMessages` 를 인덱싱하므로, 이 수정은 프로덕션 배선과 정합된 정당한 정정이지 "테스트를 구현에 맞춰 무력화"한 사례가 아니다. 조치 불필요.

- **[INFO]** Slice B 두 테스트는 의미 있는 검증
  - `conversation-inspector.test.tsx` 명칭 정정(#7): 테스트 로직·assert 는 그대로이며, 인스펙터가 재파싱 없이 호출자 items 를 그대로 렌더한다는 "pass-through" 사실과 이름이 이제 정확히 일치한다(§9.11 4번째 변환 제거 이후 `isLive` 는 이 계산에 관여하지 않음이 코드상 사실). 기존 "History 모드 전용" 이름이 오히려 오해를 유발했었다.
  - `use-execution-events.test.ts` 비AI 실패 노드 테스트(#1): `handleNodeFailed` 의 `outputData: payload.output ?? null`(`use-execution-events.ts:778,871`)이 `nodeType` 무관 범용 경로이고 `isMultiTurnAiContext` 가 `system_error` append 여부만 게이팅함을 실측 확인했다. 기존 커버리지가 "output 필드 자체가 없는 http_request"와 "ai_agent 전용 CT-S15"뿐이었다는 공백 분석도 코드로 뒷받침되며, 신규 테스트는 실제 output 페이로드가 있는 비AI 실패 노드에서 `system_error` 오염이 없는지 검증하는 유효한 회귀 테스트다. mock 은 기존 확립된 패턴(`mockClient.on` 트랜스포트 mock, 비즈니스 로직은 실제 훅 실행)을 그대로 재사용해 적절하다.

- **[INFO]** `conversation-utils.test.ts` 신규 `describe` 블록 자체의 격리·가독성은 양호하나 spec 표 미등재 케이스 존재
  - 위치: `conversation-utils.test.ts:592-603` ("같은 턴에 assistant 가 여러 개여도 행은 첫 assistant 앞 1개만")
  - 상세: 4개 테스트 모두 순수 함수 입력→출력만 검증하며 mock 없음, 매 `it` 마다 독립 배열을 생성해 테스트 간 의존성이 없다. CT-S18/19/20 세 개는 spec 시나리오 ID 를 테스트명에 명시해 추적이 쉽지만, 마지막 테스트("같은 턴에 assistant 여러 개")는 대응하는 CT-S 번호가 없다 — §9.10 관례("새 시나리오 발견 시 표 추가 + fixture 추가 + 테스트 작성을 PR review 의무로 한다")상 신규 CT-S 번호를 부여하거나, 최소한 spec 미등재 방어적 케이스임을 주석으로 명시하는 편이 일관적이다.
  - 제안: 경미하므로 위 fixture 규약 위반(WARNING) 수정 시 함께 정리 권장.

## 요약

`mergeRagRetrievalItems` 순수 함수 자체는 CT-S18/19/20 세 시나리오에 대해 명확하고 격리도 좋은 단위 테스트로 충실히 커버되지만, spec §9.10 이 CT-S18 에 "의무화"한 (e) 양 surface(Preview + 실행 트리 timeline) 동시 노출 검증과 (f) Inv-9(References 탭·🔎 행 sources[] 동일성) 검증이 실제로는 **테스트로 존재하지 않는다** — 특히 (e)는 `result-timeline.test.tsx` 자체가 이번 diff 에서 전혀 건드려지지 않았고, 이 정확한 누락이 impl-prep 단계 consistency-check 에서 이미 한 번 지적되어 "해소" 로 기록됐음에도 최종 구현에는 반영되지 않은 채 통과됐다. 신규 UI 렌더 로직(`RagRetrievalRow`, 두 컴포넌트의 rag 분기)도 컴포넌트 레벨 테스트가 전무해 렌더 시각 계약(3중 신호 구분·그룹 claim 제외)이 자동 검증되지 않는다. 이 두 갭의 배경에는 spec 이 강제하는 fixture 단일 export 규약(`conversation-scenarios.ts`)을 CT-S18~20 이 따르지 않고 인라인 리터럴로 대체한 점이 있어, 다른 테스트 파일이 같은 시나리오를 재사용하기 어려운 구조가 됐다. 반면 인덱스 시프트(3→5, 1→2) 정정은 실측 검증 결과 프로덕션 배선과 정합된 정당한 수정이며, Slice B 의 두 테스트(명칭 정정·비AI 실패 노드)도 실질적 가치가 있는 회귀 방지책이다.

## 위험도

HIGH
