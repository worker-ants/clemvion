# 아키텍처(Architecture) Review — 3회차(최종) 델타 (b04654f94..HEAD, 커밋 bf74c5a0e)

대상: 2회차 architecture WARNING("producer 는 지웠는데 `type:"rag"` consumer 가 남아 새 orphan 발생") fix — `conversation-inspector.tsx` 의 `SelectedItemDetail` rag 분기, `SummaryView` 의 `isRag`/`ragSourceCount` 및 파생 className·라벨·본문 렌더 분기, `RagDetail`/`RagBubbleSummary` 컴포넌트 전체 삭제 + CT-S17 fixture/테스트에 tool-call 왕복 및 `kb_search` result-detail 레벨 assertion 추가.

중점 검토: (a) consumer 제거의 완전성(잔여 dangling 참조/타입/주석), (b) 비-rag 분기(user/assistant/tool/presentation/system/system_error) 렌더 동작(className 조합·`hasContent` 판정) 불변, (c) 새 orphan 재발 여부.

## 발견사항

- **[INFO]** `RAG_CONTEXT_MARKER`/`isRagContextContent` 삭제(1회차, `b04654f94`) 당시 남겨진 설명 주석 2줄이 여전히 허공에 떠 있음 — 이번 델타의 범위는 아니지만 (a) 관점의 "잔여 dangling 주석" 체크리스트에 정확히 해당
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:287-288`
    ```
    // AI Agent 의 system role RAG context 메시지를 detect 하는 마커.
    // `RagSearchService.buildContext` (backend) 가 동일 prefix 로 만들어 보낸다.
    ```
  - 상세: 이 두 줄은 원래 바로 아래 있던 `const RAG_CONTEXT_MARKER = "### Relevant Knowledge";` / `function isRagContextContent(...)` 를 설명하던 주석이다. `b04654f94`가 그 두 심볼은 지웠지만 주석은 지우지 않아, 지금은 빈 줄 하나를 사이에 두고 `summarizeToolResult`(무관 함수)로 바로 이어진다. `grep -n "RAG_CONTEXT_MARKER\|isRagContextContent\|buildContext" conversation-inspector.tsx` 결과 이 주석이 유일한 매치 — 참조 대상이 없다.
  - 왜 문제인가: 기능적 영향은 전혀 없다(순수 주석). 다만 다음 유지보수자가 "RAG marker 감지 로직이 이 근처 어딘가에 있(었)다"고 오인할 수 있고, 이번 3회차 정리가 "producer/consumer 양쪽의 rag 잔재를 완전히 제거"를 목표로 했다는 점에서 완결성 체크리스트상 흠이 남는다.
  - 제안: 2줄 삭제(선택적 — 기능/회귀 위험 없는 사소한 후속 정리). 이번 라운드의 필수 수정 대상은 아님.

- **[INFO]** 삭제 지점 2곳에 이중 빈 줄 잔존 — 순수 포맷팅
  - 위치: `conversation-inspector.tsx:558-559`(`PresentationCardBody` 종료 후, `RagDetail` 삭제 자리), `:1227-1228`(`SummaryView` 종료 후, `RagBubbleSummary` 삭제 자리)
  - 상세: 함수 삭제 시 앞뒤 빈 줄이 병합되지 않고 2줄로 남았다. `eslint`/`prettier` 설정에 연속 빈 줄 규칙이 없어(로컬 실행으로 미검출) clean 판정을 통과했지만 코드 스타일상 사소한 잔여물.
  - 제안: 스타일 선호이므로 조치 불필요. 다음 무관한 편집 시 자연스럽게 정리해도 무방.

## 검증 (직접 재확인)

- `type: "rag"` producer/consumer 전수: `grep -rn '"rag"\|isRag\|RagDetail\|RagBubbleSummary\|ragSourceCount'` — 저장소 전체(`codebase/`) 0건.
- `ConversationItem["type"]` 유니온(`execution-store.ts:108-114`)에는 애초 `"rag"`가 없었고, 이를 우회하던 강제 캐스트(`item.type as string) === "rag"`)도 이제 전무 — 계약(§9.11)과 코드가 다시 일치.
- `SelectedItemDetail`의 얼리 리턴 체인(tool → user → presentation → system → system_error → assistant fallback)과 `SummaryView`의 매핑 분기(`isToolCallGroupParent` → `isPresentation` → `isSystem` → `isSystemError` → `isTool` → user/assistant fallback)는 rag 분기 제거로 순서·조건이 전혀 바뀌지 않았다 — `isRag`가 삭제 전에도 이미 상시 `false`(도달 불가)였으므로 남은 분기들의 실행 경로·className 조합·`hasContent` 계산(`isAssistant ? !isAssistantContentBlank(...) : !!item.content`)은 diff 전후 동일 로직.
- `conversation-inspector.test.tsx` + `result-detail.test.tsx` 로컬 재실행: **72/72 pass**. `tsc --noEmit`도 두 파일 관련 에러 0건 — 회귀 없음을 직접 확인.
- References 탭(`turnRefIndex`/`RagSource`/`ReferencesChip`)은 별도 살아있는 기능(`result-detail.tsx:1026` 등에서 실사용)이며 이번 삭제 대상(timeline 인라인 rag 버블/detail)과 무관 — 혼동해서 함께 지워지지 않았음을 확인.

## 요약

2회차가 지적한 "producer 는 지웠는데 consumer 가 남았다"는 아키텍처 결함 — §9.11 계약과 물리적 코드의 불일치, 도달 불가능한 dead 컴포넌트(`RagDetail`/`RagBubbleSummary`) 및 6곳의 죽은 분기 — 은 이번 델타로 완전히 해소됐다. 저장소 전체를 재검색해도 `"rag"` 타입 아이템을 생성하거나 소비하는 코드가 더 이상 존재하지 않으며, 남은 6개 렌더 분기(user/assistant/tool/presentation/system/system_error)의 로직·className·`hasContent` 판정은 diff 전후 동일함을 코드 대조와 테스트 재실행(72/72 pass)으로 직접 확인했다. CT-S17 fixture/테스트 보강도 회귀의 본질(호출자→인스펙터 실배선)을 정확히 겨냥해 프로덕션 경로를 통해 검증하도록 고쳐졌다. 유일하게 남은 흠은 1회차(`b04654f94`)에서 이미 발생했던, 이번 델타 범위 밖의 사소한 dangling 주석 2줄(§287-288)로, 기능 영향이 없어 굳이 이번 라운드에서 코드 변경을 요구하지 않는다.

## 위험도

NONE — 이번 델타는 순수 삭제(dead code 제거) + 테스트 보강이며, 기능적 회귀·구조적 결함·새 orphan 이 발견되지 않았다. 남은 지적은 모두 기능에 영향 없는 사소한 문서/포맷 잔재(INFO)뿐이다.
