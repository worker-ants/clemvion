# 테스트(Testing) 리뷰 — 3회차(최종) — 델타 bf74c5a0e

대상: 2회차 testing WARNING("갱신된 history tool 테스트가 `parseHistoryMessages` 를 테스트에서 직접 호출해
result-detail 의 실제 배선을 우회하고, CT-S15~17 에 tool assertion 0건이라 호출자 배선 실패를 잡는 e2e 가
없다")에 대한 조치 검증. `ctS17HistoryFailedConversation` fixture 에 tool-call 왕복 추가 +
`result-detail.test.tsx` CT-S17 에 `getByText("kb_search")` assertion 추가 + rag consumer 제거
(`conversation-inspector.tsx`).

## (a) 신규 e2e assertion 이 실제로 갭을 메우는가 — 실측 검증

**결론: 메운다. 직접 배선을 깨뜨려 실측으로 확인했다.**

- **[정보, 실측 확인 — 문제 없음]** `result-detail.tsx` 의 caller-wiring 을 인위적으로 손상시켜 회귀 재현 실험을 했다
  - 방법: `result-detail.tsx:1073-1075` 의 `historyMessages` 계산에 `.filter((m) => m.type !== "tool")` 를 임시 삽입해 "호출자가 tool 아이템을 인스펙터에 전달하지 않는" 배선 실패를 재현(Inv-8 계열 회귀와 동일한 증상 — 호출자가 넘긴 items 가 컴포넌트에 온전히 도달하지 못함). 이후 원복.
  - 결과: `vitest run result-detail.test.tsx -t "CT-S17"` 실행 시 정확히 신규 추가된 `expect(screen.getByText("kb_search")).toBeDefined()` (L942) 에서 `TestingLibraryElementError: Unable to find an element with the text: kb_search` 로 **red**. 그 직전의 기존 텍스트 assertion(`"주문 상태 확인"`, `"ORD-12345"`, L936-937)은 tool 아이템만 걸러낸 이 배선 실패에서는 **영향받지 않아 계속 green** — 즉 기존 3개 assertion 은 이 클래스의 회귀를 잡지 못하고, 신규 `kb_search` assertion 만 이를 잡는다는 것을 직접 증명했다. 배선 원복 후 재실행 시 정상 green 복귀도 확인.
  - 데이터 경로 추적으로 assertion 의 실배선 의존성도 확인: `ResultDetail` 의 `historyMessages = parseHistoryMessages(result.outputData)` (L1073-1075) → `hasLiveSystemError` 가 false(storeMessages=[] 이므로) → `effectiveConversationMessages = historyMessages` (L1076-1079) → `ConversationInspector` 의 `conversationMessages` prop → `SummaryView` 의 `items = conversationMessages` (dead code 삭제로 인한 단순 pass-through, `conversation-inspector.tsx:839`) → tool-call-group-parent 렌더링에서 `child.content`(= `parseHistoryMessages` 가 설정한 `info?.name` = `"kb_search"`, `conversation-utils.ts:542`)가 텍스트로 노출. 이 체인 전체가 실제 프로덕션 코드 경로이며 테스트 내부에서 임의로 우회되는 지점이 없다.
  - 2회차 WARNING 이 지적한 정확한 결함 클래스("caller 가 items 를 빈 배열/불완전한 배열로 넘겨도 아무도 잡지 못함")가 지금은 `result-detail.test.tsx` CT-S17 하나로 실측 방어됨을 확인했다.

## (b) rag consumer 제거로 무의미해지거나 깨지는 테스트가 없는가

- **[정보, 확인용 — 문제 없음]** `RagDetail`/`RagBubbleSummary`/`isRagContextContent`/`RAG_CONTEXT_MARKER`/`type "rag"` 전부 grep 0건(테스트 포함 `src/` 전체) — 제거 전에도 이 심볼들을 직접 겨냥한 단위 테스트가 없었으므로(2회차에서도 동일 확인, RESOLUTION.md 의 사전 확인과 일치) "테스트가 무의미해짐" 케이스는 발생하지 않는다.
  - 검증: `run-results/__tests__` + `lib/conversation` 전체 18 파일 328 테스트 재실행 — **328/328 passed**, 회귀 없음.

## (c) 잔여 커버리지 갭 — 이번에 반드시 메워야 할 것이 있는가

**없음.** 2회차에서 지적한 핵심 갭(caller-wiring e2e 부재)은 (a)에서 실측 검증한 대로 해소됐다. 아래는 참고용 INFO 이며 이번 라운드에서 코드/테스트 변경을 요구하지 않는다.

- **[INFO, 선호 — 조치 불필요]** `conversation-inspector.test.tsx` 의 "History 모드 (isLive=false) 에서도 tool 메시지가 표시된다" 테스트 제목·주석은 여전히 `isLive` 값이 렌더 결과를 가른다는 인상을 준다 (2회차 WARNING (a) 잔존, 이번 delta 의 조치 대상이 아니었음). 실제로는 `SummaryView` 의 `items` 계산이 `isLive` 와 무관해졌으므로(§9.11 dead code 삭제로 `items = conversationMessages` 단순화) 이 테스트는 사실상 "`parseHistoryMessages` 출력을 그대로 넘기면 렌더된다"는 `isLive` 무관 명제를 검증한다. 다만 이번 delta 로 "진짜 history-모드 전용" 방어는 `result-detail.test.tsx` CT-S17 에 올바른 이름으로 존재하게 됐으므로((a) 참고), 이 잔존 이슈는 기능적 위험이 아니라 순수 네이밍 정합성 문제로 격하된다. 제목을 "parseHistoryMessages 출력 pass-through 확인"류로 정정하면 좋겠으나 필수는 아니다.
- **[INFO, 선호 — 조치 불필요]** `ctS17HistoryFailedConversation` 이 `makeErroredConversationOutput` 헬퍼를 재사용하지 않고 `config`/`meta`/`port`/`status` 봉투 구조를 직접 인라인 복제한다. 의도(메시지 배열이 달라 헬퍼 시그니처로 못 담음)는 이해되나, 헬퍼가 `messages` 파라미터를 받도록 확장하면 CT-S15/16/17 세 fixture 가 봉투 shape 변경 시 동시에 갱신되는 것을 보장할 수 있다. 현재도 셋 다 통과하고 drift 위험은 낮으므로(엔진 envelope 은 자주 바뀌지 않음) 필수 조치는 아니다.
- **[INFO, 확인용 — 문제 없음]** CT-S15(live, retryable)·CT-S16(non-retryable) 은 이번 delta 로 tool-call 검증이 추가되지 않았다. 하지만 이 두 케이스의 목적은 각각 "재시도 활성/비활성"과 "탭 기본 선택"이지 tool 렌더링 검증이 아니며, live 경로(`conversationMessages` 를 store 사본 그대로 pass-through)는 애초에 인라인 재파싱 dead code 의 영향권 밖이었다(재파싱은 `isConversationHistory` 경로 전용이 아니라 `SummaryView` 공통이었으나, guard 추가 이전부터 store 사본은 이미 신뢰되는 구조). 2회차 WARNING 이 명시적으로 겨냥한 것은 history 경로였고 그 갭은 메워졌으므로 추가 조치 불필요.

## Mock 적절성 / 격리 / 가독성

- Mock: 신규 fixture·assertion 모두 실제 `parseHistoryMessages`/`messagesToConversationItems` 순수 함수와 실제 `ConversationInspector` 렌더를 그대로 통과한다. 별도 mock/stub 없음 — 실제 동작과의 괴리 없음.
- 격리: `ctS17HistoryFailedConversation` 은 `as const` 최상위 상수이며 컴포넌트가 이를 mutate 하지 않으므로(렌더 전용) 테스트 간 공유 상태 오염 없음. 다른 CT 케이스와 독립 실행 가능(개별 `-t` 필터 실행으로 확인).
- 가독성: fixture·테스트 양쪽의 신규 주석이 "왜 tool-call 왕복을 넣었는지"(배선 실패 재발 방지 취지)를 명확히 설명해 의도 파악이 쉽다. `bf74c5a0e` 델타 자체는 목적이 분명하고 간결하다.

## 회귀 테스트 유효성

- 기존 CT-S15/S16 은 fixture·assertion 변경 없이 그대로 유효 (재실행 확인, green).
- `result-detail.test.tsx` 전체 35개 중 이번 델타로 변경된 것은 CT-S17 1건뿐이며 나머지 34건은 무변경.
- `conversation-inspector.tsx` 의 rag 관련 코드 제거는 `SummaryView`/`SelectedItemDetail` 의 분기 축소일 뿐 tool/assistant/user/system 분기 로직에는 손대지 않아, 해당 분기를 검증하는 기존 테스트(예: 2회차에 갱신된 "History 모드... tool 메시지" 테스트, `conversation-utils.test.ts` 의 tool 합성 테스트)에 영향 없음 — 재실행으로 확인.

## 요약

2회차에서 지적한 "호출자 배선 실패를 잡는 e2e 가 없다"는 갭은 이번 delta 로 실질적으로 해소됐다. 단순히 assertion 을 추가한 것이 아니라, `result-detail.tsx` 의 실제 caller-wiring 코드를 임시로 손상시켜 신규 `expect(screen.getByText("kb_search"))` 가 정확히 그 지점에서 red 로 전환되고 기존 텍스트 assertion 들은 이 클래스의 결함에서 green 을 유지한다는 것을 실측으로 증명했다 — 즉 신규 assertion 은 기존 assertion 들의 커버리지와 겹치지 않는 새로운 방어선이다. rag consumer 제거는 사전에 확인된 대로(producer·테스트 0건) 무의미해지거나 깨지는 테스트를 남기지 않았고, 관련 스위트(18 파일 328 테스트) 재실행으로도 회귀가 없음을 확인했다. 잔여 갭(테스트 제목의 `isLive` 네이밍 잔존 staleness, fixture 헬퍼 미재사용으로 인한 경미한 중복)은 기능적 위험이 없는 선호 수준이라 이번 최종 라운드에서 조치를 요구하지 않는다.

## 위험도

NONE — Critical/Warning 없음. 2회차 갭은 실측 검증으로 해소 확인, rag 제거로 인한 회귀 없음, 잔여 사항은 전부 INFO(선호) 수준.
