# 테스트(Testing) 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원
> (`plan/complete/webchat-session-controls-history-restore.md`, commits `256bba3f0`+`792eedb28`+`160840462`, `origin/main` 대비)
> 본 라운드(19_26_15)는 이전 두 라운드(18_44_10, 19_06_55)의 WARNING/INFO 반영 이후의 fresh 검토.

## 발견사항

- **[WARNING]** `isActiveConversationPhase` — 명시적으로 인용한 "선례" 패턴(`isTextInputSurface`)과 달리 직접 단위 테스트 없음
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:43` (`export function isActiveConversationPhase`), 대응 테스트 파일 `codebase/channel-web-chat/src/lib/widget-state.test.ts`
  - 상세: 이 함수의 JSDoc 은 "phase 파생 로직은 본 모듈에 단일화(`isTextInputSurface` **선례**)"라고 명시하는데, 실제로 `isTextInputSurface` 는 `widget-state.test.ts` 에 `describe("isTextInputSurface — 자유 텍스트 표면 판정(§R6)")` 로 4가지 입력에 대한 직접 단위 테스트를 갖고 있다. 반면 `isActiveConversationPhase` 는 `widget-state.test.ts` 에 단 하나의 테스트도 없고, `panel.test.tsx` 를 통해 `streaming`/`awaiting_user_message`(true)와 `booting`/`ended`/`panel`(false) 5개 phase 만 **컴포넌트 렌더링을 경유해 간접** 검증된다. `WidgetPhase` 전체 값(`collapsed`/`blocked` 포함)에 대한 진리표가 함수 자체 레벨에서 고정돼 있지 않아, 이 함수를 향후 다른 소비처(예: 새 UI 표면)에서 재사용할 때 `Panel` 렌더링 세부사항에 의존하지 않고는 회귀를 잡을 수 없다. round 3 (`160840462`)에서 `booting` 을 제외하도록 이 함수의 반환값이 실제로 바뀐 만큼(부작용/동시성 버그 수정의 핵심 로직), 이 함수 자체를 대상으로 한 직접 테스트의 부재가 더 두드러진다.
  - 제안: `widget-state.test.ts` 에 `describe("isActiveConversationPhase")` 를 추가해 `WidgetPhase` 7개 값(`collapsed`/`panel`/`booting`/`streaming`/`awaiting_user_message`/`ended`/`blocked`) 전체에 대한 진리표를 단언. `it.each` 로 짧게 작성 가능.

- **[INFO]** `endConversation` 의 재진입 가드(`phase === "ended" → no-op`)가 직접 회귀 테스트로 고정돼 있지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:414`(`if (state.phase === "ended") return;`), 대응 테스트 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (`describe("useWidget — 대화 종료(endConversation, §3.1)")`)
  - 상세: 이 가드는 round 1 WARNING #1("`conversationEnded` 콜백 2회 발사 가능성")의 핵심 방어선인데, 신규 6개 테스트 모두 `endConversation()` 을 **1회씩만** 호출해 `phase`/`interactCalls` 최종 상태만 확인한다. `endConversation()` 을 연속 2회 호출(또는 첫 호출 후 phase 가 이미 `ended` 인 상태에서 재호출)했을 때 `interact` 가 중복 발사되지 않고 `bridgeRef.current?.sendEvent("conversationEnded", ...)` 가 정확히 1회만 호출되는지를 직접 단언하는 테스트가 없다. 또한 어느 테스트도 `sendEvent`/`postMessage` 자체를 spy 해 호출 횟수를 확인하지 않는다(이는 `host-bridge.test.ts` 를 포함해 이 코드베이스 전반의 기존 테스트 관례이므로 이번 PR 만의 신규 결함은 아니다). 향후 리팩터링으로 이 가드가 실수로 제거되거나 조건이 느슨해져도 현재 테스트 스위트로는 감지되지 않는다.
  - 제안: `endConversation()` 을 두 번 연속(`await` 순차) 호출해 두 번째 호출이 `interact`/`sendEvent` 를 추가로 트리거하지 않음을 단언하는 회귀 테스트 1건 추가. 여력이 되면 `bridgeRef` 대상 `postMessage` spy 로 `conversationEnded` 이벤트 발사 횟수를 최소 1건에서 직접 검증.

- **[INFO]** `interaction.service.ts` — "waiting_for_input + durable thread 존재 + 대기 NodeExecution 없음/노드 관계 없음" 조합 미검증 (round 2 지적 재확인, 미해소)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:260-296` (`conversationThread` 는 `if (execution.status === WAITING_FOR_INPUT)` 블록 최상단에서 계산되지만, `context` 조립은 중첩된 `if (nodeExec?.node)` 안에서만 발생)
  - 상세: 기존 회귀 테스트(`interaction.service.spec.ts:527`, `'waiting_for_input — 대기 NodeExecution 없으면 currentNode/context null'`)는 `makeExecution({ status: WAITING_FOR_INPUT })` 만 지정하고 `conversationThread` 를 전혀 설정하지 않은 채 `nodeRepo.findOne` 을 `null` 로 스텁한다. `conversationThread` 가 존재하면서 동시에 대기 `NodeExecution` 이 없는(혹은 `node` relation 이 비어 있는) 조합은 여전히 어떤 테스트로도 고정돼 있지 않다 — 현재 구현은 이 경우 `context` 전체가 `null` 로 남아 durable thread 가 조용히 드롭되는데(설계상 안전한 방향), 이 동작이 코드에 명시적으로 문서화(주석)돼 있음에도 테스트로 잠겨 있지 않다. round 2 testing 리뷰(`review/code/2026/07/09/19_06_55/testing.md` INFO #2)에서 이미 지적됐고 우선순위 낮음으로 defer 됐으나 이번 라운드까지 미반영 상태다.
  - 제안: 우선순위 낮음(도달 가능성 낮은 데이터 정합성 극단 케이스) — `nodeRepo.findOne.mockResolvedValue(null)` + `conversationThread: DURABLE_THREAD` 조합으로 `context` 가 여전히 `null` 임을 단언하는 테스트 1건을 추가하면 향후 필드 조립 순서 리팩터 시 안전망이 된다. 차단 사유 아님.

- **[INFO]** `Panel` — `confirming` 상태와 `isEnded` 상태의 동시 조합(phase 가 확인바 표시 중 `ended` 로 전이)이 테스트되지 않음
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:99`(`{confirming && (<div className="wc-confirm" ...>)}`)와 `:173`(`{isEnded && (<div className="wc-ended">...)}`) — 둘 다 `!isEnded`/`confirming` 각각의 독립 조건일 뿐, 서로 배타적으로 렌더되도록 강제되지 않는다.
  - 상세: 사용자가 "새 대화" 또는 "대화 종료" 확인바를 연 상태에서 SSE `execution.completed`/`failed` 등 terminal 이벤트가 도착해 `phase` 가 `ended` 로 바뀌면(`confirming` state 는 로컬이라 그대로 유지), `wc-confirm` 확인바와 `wc-ended`("대화가 종료되었어요" + "새 대화 시작" 버튼)가 동시에 렌더될 수 있다. `showSessionControls` 는 `isActiveConversationPhase(phase)` 로 재계산되어 헤더 버튼은 사라지지만, 이미 열려 있던 확인바(`confirming` state)는 자동으로 닫히지 않는다. 이 조합에 대한 렌더 테스트가 없어, 실제 UX 상 이중 CTA 노출이 의도인지 결함인지 코드만으로는 검증되지 않는다.
  - 제안: `makeState({ phase: "ended" })` 에 `confirming` 을 강제로 활성화한 렌더(또는 `awaiting_user_message` → 확인바 오픈 → 상태를 `ended` 로 리렌더)로 실제 동시 노출 여부를 스냅샷/단언하는 테스트 1건 추가해 의도적 동작인지 명문화. 우선순위 낮음(희귀 레이스).

- **[INFO]** `Panel`↔`useWidget` 실배선(`widget-app.tsx`)에 대한 헤더 버튼 클릭 → 실제 훅 액션 실행까지의 엔드투엔드 통합 테스트 부재 (round 2 지적 재확인, 미해소— 기존 관례와 일관)
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.tsx:52`(`<Panel ... actions={actions} />`, `useWidget()` 의 `actions` 객체 그대로 전체 spread), `widget-app.test.tsx` (신규 세션 컨트롤 관련 케이스 없음)
  - 상세: `panel.test.tsx` 는 mock `actions`(`vi.fn()`)로 `Panel` 만 격리 테스트하고, `use-widget-eager-start.test.ts` 는 `useWidget()` 훅의 `endConversation` 을 직접(`result.current.actions.endConversation()`) 호출해 테스트한다. "헤더 '대화 종료' 버튼 클릭 → 실제 `useWidget` 훅의 `endConversation` 실행 → SSE 종료 + optimistic `ended`" 를 검증하는 `widget-app.test.tsx` 수준 통합 테스트는 없다. 다만 `widget-app.test.tsx` 는 `submitMessage`/`clickButton` 등 기존 액션에 대해서도 동일하게 이런 엔드투엔드 클릭 테스트를 두지 않는 기존 관례이므로, 이번 PR 만의 신규 결함이 아니라 기존 테스트 아키텍처의 연장이다.
  - 제안: 낮은 우선순위(기존 패턴과 일관). 필요 시 헤더 버튼 클릭 → 확인 → `bridgeRef` `conversationEnded` 이벤트 발사까지 확인하는 스모크 테스트 1건을 `widget-app.test.tsx` 에 고려.

## 우수 사항 (참고)

- 백엔드 신규 테스트 4건(`interaction.service.spec.ts`)은 핵심 경로(ai_conversation 동봉·buttons 동봉·COMPLETED 시 미노출+`nodeRepo.findOne` 미호출 검증·null thread 시 키 생략)를 정확히 분리해 커버하며, `toMatchObject`+`not.toHaveProperty`/`not.toHaveBeenCalled()` 조합으로 "부재"까지 적극 단언한다. 각 테스트가 `makeMocks()` 로 독립 mock 을 새로 생성해 테스트 간 격리가 양호하다.
- `conversation.test.ts` 신규 4건은 실제 wire 계약(5-source, `role` 없는 durable turn)을 정확히 재현해 이전 라운드에서 지적된 "실제로 보내지 않는 `role` 필드를 먹여 통과하던" 결함을 근본적으로 교정했고, `role` override 우선순위·`ai_tool`/`system` 축약 경계까지 챙겼다.
- `panel.test.tsx` 는 `it.each` 로 활성 phase(`streaming`/`awaiting_user_message`) 를 동시 커버하고 `booting`(round 3 신규)/`ended`/`panel` 을 별도 음성 테스트로 분리했으며, 확인바 확정/취소 두 경로 모두 `aria-label` 분리로 CSS 클래스 결합 없이 `getByRole` 로 명확하게 검증한다(round 1 WARNING #4 반영).
- `use-widget-eager-start.test.ts` 의 신규 7건은 graceful/cancel 라우팅 경계(ai_conversation+nodeId 확정/미확정 vs buttons vs streaming), 명령 실패(410) 시 optimistic 유지, booting 중 세대 토큰(gen guard) 레이스까지 `fetchMock`/`EventSource` 스텁으로 정밀 재현한다. round 2 testing INFO #1("nodeId 미확정 ai_conversation → cancel 폴백")이 정확히 신규 테스트로 반영돼 있다.
- e2e 스킵 판단은 plan 문서("additive read-only, 실행엔진 상태전이 무변경")에 명시적으로 근거가 남아 있고, 변경 범위(`getStatus` 신규 optional 필드 + 프런트 CSR 전용)와 부합해 타당하다.

## 요약

3라운드에 걸친 반복 리뷰(18_44_10 → 19_06_55 → 19_26_15)를 거치며 테스트 커버리지가 점진적으로 촘촘해졌다 — 이전 두 라운드의 테스트 관련 WARNING/INFO 대부분(특히 nodeId 미확정 경계, booting 컨트롤 미노출, CSS selector 결합 제거)이 신규 커밋에서 실제 테스트로 반영된 흔적이 뚜렷하다. Mock 은 fetch/EventSource/TypeORM repository 모두 손으로 구성한 얇은 stub 으로 실제 동작과 크게 괴리되지 않고, 두 테스트 파일 모두 독립적인 mock/stub 생성으로 격리가 양호하다. 이번 라운드에서 새로 발견한 갭은 (1) round 3 에서 동작이 실제로 바뀐 `isActiveConversationPhase` 가 스스로 인용한 선례(`isTextInputSurface`)와 달리 직접 단위 테스트가 없다는 점(WARNING) 하나와, (2) 나머지는 모두 이전 라운드에서 이미 낮은 우선순위로 지적·defer 된 항목의 재확인(INFO, 미해소)이다. Critical 수준 결함은 없으며, 전반적으로 테스트 스위트가 실제 wire 계약과 회귀 시나리오를 성실히 반영하고 있다.

## 위험도
LOW
