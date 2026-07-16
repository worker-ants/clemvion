# 테스트(Testing) 리뷰 — fix 델타 재검토 (aee4f75e9..HEAD)

대상: 직전 리뷰(`review/code/2026/07/17/07_12_33/`)에서 testing reviewer 가 지적한 두 갭(R3 endReason 무테스트, `conversation-inspector.tsx` dead code 삭제로 인한 History 테스트 red)에 대한 fix 커밋(`b04654f94` 계열)의 검증. 실측을 위해 관련 스위트를 직접 실행했다(`vitest run` — `run-results/__tests__` + `websocket/__tests__` + `lib/conversation`: **510/510 passed**, RESOLUTION.md 의 claim 과 일치 확인).

## 핵심 질문 (a): "History 모드" 테스트 갱신이 원래 회귀를 여전히 지키는가

**결론: 부분적으로만 지킨다 — 테스트를 완전히 무력화한 것은 아니지만, 원래 이름·주석이 주장하는 보호 범위와 실제로 지금 지키는 범위 사이에 실질적인 간극이 생겼다.**

- **[WARNING]** 갱신된 "History 모드 (isLive=false) 에서도 tool 메시지가 표시된다" 테스트는 더 이상 `isLive` 값에 의존하는 어떤 동작도 검증하지 않는다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/conversation-inspector.test.tsx:408-452`, `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:868` (`const items = conversationMessages;`)
  - 상세: 이번 라운드에서 `SummaryView` 의 `items` 계산은 `isLive` 분기를 완전히 잃었다 — live/history 상관없이 항상 `conversationMessages` 를 그대로 사용한다(`isLive` 은 이제 turn 카운터 표시(L875)에만 남아있고 `items` 계산과는 무관). 그런데 테스트는 여전히 `isLive={false}` 를 명시하고 제목·인라인 주석 모두 "History 모드"·"Critical fix 회귀 방지"를 주장한다. 실제로 `isLive={true}` 로 바꿔도 정확히 같은 결과가 나온다는 것을 직접 확인했다(코드상 `items` 계산에 `isLive` 참조가 없으므로 자명). 즉 이 테스트가 지금 검증하는 것은 "History 모드에서" 가 아니라 그냥 "`conversationMessages` 로 tool 아이템을 넘기면 렌더된다" 는, `isLive` 와 무관한 명제다.
  - 원래(2026-05-05, 커밋 `01de8e6f3`) 이 테스트가 지키려던 회귀는 **컴포넌트 자신의 History-모드 인라인 재조립 루프가 tool 분기를 빠뜨리는 것**이었다. 그 재조립 루프 자체가 이번 라운드에서 통째로 삭제됐으므로, "컴포넌트가 자체 파싱 중 tool 을 빠뜨린다"는 버그 클래스는 코드 구조상 재발이 불가능해졌다 — 이 점에서는 오히려 근본적으로 더 안전해졌다. 문제는 그 대신 테스트가 지금 검증하는 내용이 **다른 두 기존 테스트와 대부분 중복**된다는 것이다:
    1. `parseHistoryMessages`(`messagesToConversationItems`)가 assistant `toolCalls` + 후속 `role:'tool'` 메시지를 `type:'tool'` 아이템으로 정확히 합성하는지는 `codebase/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts:345-430` 대역에서 이미 훨씬 더 촘촘히(디버그 payload, timestamp, orphan 매칭 등 포함) 커버한다.
    2. `ConversationInspector` 가 `type:'tool'` 아이템을 🔧 아이콘·이름으로 렌더하는지는 같은 파일의 첫 번째 테스트("tool 아이템은 '🤖 AI' 라벨로 표시되지 않는다", L56-81)가 `isLive` 기본값(`true`)으로 이미 검증한다.
  - 왜 문제인가: 테스트 자체는 진짜로 깨질 수 있는(tautology 아닌) assertion 을 갖고 있어 "무력화"는 아니지만, 이름이 약속하는 "History 모드 전용" 보호는 더 이상 성립하지 않는다. 다음에 누군가 이 테스트만 보고 "History 경로가 tool 을 표시한다"는 사실을 신뢰하면 오도된다 — 실제로 그 사실을 보장하는 것은 지금 (b) 항목에서 지적하는 wiring 쪽 커버리지 공백이다.
  - 제안: 테스트 제목/주석을 "`parseHistoryMessages` 출력을 그대로 넘기면 tool 메시지가 렌더된다(패스스루 확인)"처럼 실제로 검증하는 내용에 맞게 정정하거나, `isLive` 를 아예 파라미터화(`it.each([true, false])`)해 "이 값과 무관하게 통과한다"는 것 자체를 명시적으로 드러낼 것. 진짜 "history 전용" 보호가 필요하다면 (b) 의 제안대로 `ResultDetail` 을 통한 wiring 테스트를 추가하는 편이 이름에 부합한다.

- **[WARNING]** (b) 진짜 프로덕션 배선(`result-detail.tsx` 의 소스 선택 로직)을 통과하는 tool-메시지 렌더링 테스트가 어디에도 없다 — 신규 커버리지 공백
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1070-1079` (`hasLiveSystemError` → `historyMessages`/`effectiveConversationMessages` 선택), `codebase/frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx` (CT-S15/16/17 — grep 결과 `🔧`/`kb_search`/`toolCalls` 매치 0건)
  - 상세: 갱신된 `conversation-inspector.test.tsx` 테스트는 `parseHistoryMessages(result.outputData)` 를 **테스트 코드 안에서 직접 호출**해 `ConversationInspector` 에 prop 으로 주입한다 — `ResultDetail` 이 실제로 수행하는 `isConversationHistory` 판정 → `hasLiveSystemError` 게이트 → `historyMessages`/`effectiveConversationMessages` 삼항 선택(L1073-1079)을 전혀 거치지 않는다. `result-detail.test.tsx` 의 CT-S15~17 은 이번 작업의 실제 타깃(오류 종결 시 `system_error` 인라인 마커·기본 탭 선택)만 검증하고 tool 메시지 렌더링은 검증 대상이 아니다(grep 확인, 매치 없음). 결과적으로 "완료된 대화형 노드를 새로고침 후 이력 화면에서 열었을 때 tool 호출이 Preview 에 보인다"는, 이번 버그(Inv-8)와 정확히 같은 클래스(호출자가 계산한 items 가 렌더까지 온전히 전달되는가)의 명제를 **엔드투엔드로 검증하는 테스트가 하나도 없다**. 예컨대 누군가 `result-detail.tsx:1076-1079` 의 삼항을 리팩터링하다 `historyMessages` 대신 실수로 `[]` 를 반환하게 만들어도, `conversation-inspector.test.tsx` (배선을 우회) 와 `result-detail.test.tsx` (tool 비검증) 어느 쪽도 잡지 못한다.
  - 이 공백이 "이번 라운드가 새로 만든 것"은 아니다(이전에도 `ResultDetail` 을 통한 tool 렌더링 테스트는 없었다) — 하지만 이번 라운드는 그 공백을 메우던 컴포넌트-레벨 인라인 재파싱을 삭제해 방어선을 온전히 caller 신뢰에 넘겼는데, caller(`result-detail.tsx`) 쪽에는 그 신뢰를 검증하는 tool-메시지 테스트가 여전히 없다.
  - 제안: `result-detail.test.tsx` 에 "완료(non-error) 대화형 노드, live store 비어있음, `outputData.result.messages` 에 tool 호출 포함 → Preview 탭에 tool 아이템 렌더" 를 겨냥한 CT 케이스 1개 추가(CT-S15/16/17 과 같은 fixture 패턴 재사용 가능). 이것이 이번 delta 가 가장 필요로 하는 "회귀 방지" 다.

## (b) endReason 화이트리스트 테스트 갱신 충분성

- **[INFO, 확인용 — 문제 아님]** `output-shape.test.ts` 의 "accepts every unified endReason" 갱신은 정확하고 직접적이다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:579-602`, `codebase/frontend/src/components/editor/run-results/output-shape.ts:307-338` (`CONVERSATION_END_REASONS`)
  - 상세: 배열에 `"condition"`, `"error"` 를 추가한 것은 소스의 `CONVERSATION_END_REASONS` Set 과 1:1 대응하며, for-loop 로 6개 값 전부에 대해 `isConversationOutput(raw)` === true 를 직접 단언한다. 직접 실행해 pass 확인. 직전 라운드 testing reviewer 의 지적("거짓 exhaustive 테스트")을 정확히 해소했다.
  - 제안: 없음.

- **[INFO]** 이 테스트는 accept 방향만 검증하고 reject 방향(알 수 없는 `endReason` 값은 여전히 conversation-terminal 로 오인되지 않아야 한다)은 검증하지 않는다
  - 위치: 동일 테스트, `output-shape.ts:329-338`
  - 상세: `CONVERSATION_END_REASONS.has(endReason)` 으로의 리팩터링은 Set 기반이라 "화이트리스트에 없는 값은 false" 를 테스트로 고정해두면 향후 "일단 `typeof === 'string'` 이면 다 통과시키자" 류의 실수를 막는 값싼 안전장치가 된다. 이번 diff 가 새로 만든 gap 은 아니고(이전에도 negative case 테스트는 없었다), 이번 리팩터링으로 Set 하나만 관리하면 되므로 추가 비용이 거의 없다.
  - 제안: `it("rejects unknown endReason values")` 로 `endReason: "bogus"` 케이스 1건 추가(선택 사항, LOW 우선순위).

## (c) 삭제된 코드 경로에 대응하던 다른 테스트가 무의미해졌는지

- **[INFO, 확인용 — 문제 없음]** 삭제된 RAG 인라인 합성(`RAG_CONTEXT_MARKER`/`isRagContextContent`)을 겨냥한 테스트는 애초에 없었다
  - 확인 방법: `grep -rn "RAG_CONTEXT_MARKER\|isRagContextContent\|type: \"rag\""`(테스트 디렉터리 전체) → 매치 0건.
  - 상세: SUMMARY.md 의 side_effect #9 판단("`rag` 행 소실은 의도된 변경")과 일치 — 애초에 이 항목을 단언하는 테스트가 없었으므로 "죽은 테스트가 남아 무의미해진" 케이스는 아니다.
  - 제안: 없음.

- **[INFO, 확인용 — 문제 없음]** `use-execution-events.test.ts`(파일 6)·`conversation-scenarios.ts`(파일 2) 변경은 순수 주석/spec cross-ref 정정으로 assertion 변경이 없다 — 회귀 위험 없음.

## Mock 적절성 / 테스트 격리 / 가독성

- **[정보]** Mock 사용: `vi.fn()` 콜백 외 별도 mock/stub 없음, 실제 `parseHistoryMessages`/`messagesToConversationItems` 순수 함수를 그대로 호출 — 실제 동작과의 괴리 없음. 적절.
- **[정보]** 격리: `beforeEach` 에서 `baseProps = makeBaseProps()` 로 매 테스트 재생성, 모듈 레벨 공유 mutable 상태 없음. 독립 실행 가능.
- **[정보]** 가독성: 인라인 주석이 spec 조항(§9.9 Inv-8, §9.11)과 변경 이유를 상세히 남겨 의도 파악은 쉽다. 다만 위 (a) 에서 지적한 대로 주석·제목이 "History 모드 전용" 임을 강하게 주장하는 반면 실제 코드 경로는 `isLive` 무관이라, 다음 유지보수자가 이 테스트의 "보호 범위"를 오독할 위험이 있다.

## 요약

R3(endReason 화이트리스트) 테스트 갱신은 정확하고 소스와 1:1 대응하는 좋은 fix다 — 직전 라운드 지적을 완전히 해소했다. 반면 핵심 질문(a)에 대해서는, `conversation-inspector.test.tsx` 의 "History 모드" 테스트가 red 를 green 으로 되돌리는 데는 성공했지만 그 갱신은 **원래 회귀(컴포넌트 자체 재조립 로직의 tool 누락)를 지키는 방식이 아니라, 그 재조립 로직이 삭제되어 애초에 재발 불가능해진 상태에서 다른 두 기존 테스트(`conversation-utils.test.ts` 의 tool 파싱 테스트, 같은 파일의 첫 번째 렌더 테스트)와 대부분 겹치는 내용을 다시 검증**하는 형태로 축소됐다. `isLive` 값이 더 이상 `items` 계산에 관여하지 않으므로 이 테스트는 사실상 "History 모드 전용"이 아니며, 테스트 제목·주석이 여전히 그렇게 주장하는 것은 향후 오독 소지가 있다(무력화라기보다 보호 범위 축소 + 명명 불일치). 더 중요한 것은, 이번 delta 가 제거한 컴포넌트-레벨 방어선을 대체할 **caller(`result-detail.tsx`) wiring 자체를 검증하는 엔드투엔드 테스트가 여전히 없다**는 점 — `result-detail.test.tsx` 의 CT-S15~17 은 tool 메시지를 전혀 단언하지 않는다. 실측 결과 관련 스위트 510/510 통과는 확인했으나(RESOLUTION.md claim 과 일치), 통과 자체가 이 wiring 이 안전하다는 것을 보장하지 않는다 — 그 wiring 을 직접 겨냥한 테스트가 없기 때문이다. (c) 삭제된 RAG 인라인 합성·구 재파싱 경로에 대응해 남아 무의미해진 테스트는 발견되지 않았다.

## 위험도

MEDIUM — Critical 은 없다(현재 코드는 정상 동작하며 510/510 통과 실측 확인). 다만 "History 모드에서 tool 표시" 라는 이름의 회귀 테스트가 실질적으로 `isLive` 와 무관해지고 기존 테스트와 중복되는 방향으로 축소됐고, 그 결과 이번 버그(Inv-8)와 동일 클래스의 caller-wiring 실패를 잡아낼 전용 테스트가 여전히 부재한 상태로 남았다 — 다음 리팩터링에서 조용히 재발할 수 있는 실질적 커버리지 공백이다.
