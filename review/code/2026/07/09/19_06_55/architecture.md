# 아키텍처(Architecture) 코드 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 노출 (EIA §R17 재조정) — fresh review.
> 이전 라운드(`review/code/2026/07/09/18_44_10/architecture.md`)의 WARNING 1건(phase 파생 로직 위치)을 포함해
> 8건의 WARNING 이 이번 diff 에 반영된 것으로 보이는 상태를 diff 기준으로 재검증.

## 발견사항

- **[INFO, 긍정 관찰]** 이전 라운드 WARNING(phase 파생 로직 위치)이 구조적으로 올바르게 해소됨
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` (`isActiveConversationPhase`, 신규 export), `codebase/channel-web-chat/src/widget/components/panel.tsx` (`showSessionControls = isActiveConversationPhase(phase)`)
  - 상세: 이전 라운드에서 지적된 "진행-중-phase 판정이 프레젠테이션 컴포넌트(`panel.tsx`)에 하드코딩되어 이 프로젝트가 이미 확립한 `isTextInputSurface` 선례(phase 파생 로직은 `widget-state.ts` 상태/도메인 레이어에 단일화)를 어긴다"는 지적이, 단순 코드 이동이 아니라 `widget-state.ts` 에 `isTextInputSurface` 와 동일한 형태·위치·JSDoc 관례(파생 로직 SoT 단일화 근거 명시)로 재구현됐다. `panel.tsx` 는 결과만 소비 — 레이어 경계가 정확히 복원됐다.
  - 제안: 없음(양호).

- **[INFO, 긍정 관찰]** 백엔드 `getStatus()` 분기 중복이 공통 필드 선조립(`base`)으로 정리되어 OCP 개선
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`const base = { interactionType, waitingNodeId, ...(conversationThread ? {...} : {}) }` → `{ ...base, buttonConfig }` / `{ ...base, nodeOutput }`)
  - 상세: 이전 라운드에서 지적된 "buttons/form·ai 두 분기가 `conversationThread` 조건부 스프레드를 그대로 복제"가, 공통 필드를 먼저 조립하고 분기별로 `buttonConfig`/`nodeOutput` 만 확장하는 형태로 리팩터링됐다. 향후 세 번째 `interactionType` 이 추가돼도 공통 필드 갱신 지점이 1곳으로 유지된다.
  - 제안: 없음(양호).

- **[INFO, 긍정 관찰]** 헤더 confirm UI 가 3항 분기 반복에서 데이터 기반 레지스트리(`CONFIRM_COPY`)로 전환 — OCP 준수
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (`type ConfirmKind = "new" | "end"; const CONFIRM_COPY: Record<ConfirmKind, {...}>`)
  - 상세: 메시지·확정 라벨·실행 액션이 한 테이블에 모여 있어, 세 번째 확인-필요 액션이 추가돼도 렌더 JSX 를 건드리지 않고 테이블에 항목만 추가하면 된다(Strategy/lookup-table 패턴). 이전 라운드가 지적한 "3항 분기 반복" 구조적 문제를 정확히 해소.
  - 제안: 없음(양호).

- **[INFO]** `useWidget()` 훅이 ref 기반 ad-hoc 동시성 가드를 계속 축적 — 향후 확장 시 상태기계 통합 검토 여지
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`startedRef`, `sessionRef`, 그리고 이번 diff 로 추가된 `startGenRef`)
  - 상세: 이번 diff 는 booting/초기 streaming 중 종료·새 대화가 in-flight `start()` 를 무효화하지 못해 옛 execution 을 되살리는 race 를 막기 위해 `startGenRef`(세대 카운터) 를 도입했다. 패턴 자체(epoch/generation token 으로 stale async 콜백 무효화)는 잘 알려진 정석적 해법이고 이 훅 스코프 안에서는 적절하다. 다만 이 훅은 이미 `startedRef`/`sessionRef`/`teardownSession`/`resetSessionRefs`/`useTokenRefresh` 등 세션 생명주기 관련 상태·부작용을 다수 보유하고 있고, 그 목록에 `startGenRef` 가 하나 더 얹히는 형태로 성장하고 있다. `useTokenRefresh` 를 별도 훅으로 캡슐화한 선례가 이미 있으므로, 향후 세대 가드가 필요한 진입점이 하나 더 늘어나면(예: `submitMessage`/`clickButton` 에도 유사 race 가 발견되는 경우) `startGenRef` 류의 개별 ref 를 추가하기보다 세션 생명주기 전체를 하나의 명시적 상태기계(또는 최소한 `useSessionLifecycle` 같은 캡슐화 훅)로 묶는 것을 검토할 가치가 있다.
  - 제안: 즉시 조치 불필요. 현재 범위(단일 race, 단일 ref)에서는 과도한 추상화가 오히려 손해이므로 as-is 가 적절하다. 세 번째 유사 race 가 발견되는 시점을 리팩터링 트리거로 삼을 것을 권장(YAGNI 준수 관찰).

- **[INFO]** `endConversation` 의 커맨드 라우팅(graceful vs cancel) 판정이 훅 내부에 인라인 — 기존 "파생 로직은 `widget-state.ts` 로 단일화" 컨벤션과 국소적으로 어긋남
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`endConversation` 내부 `const graceful = state.phase === "awaiting_user_message" && state.pending?.type === "ai_conversation" && !!state.pending?.nodeId;`)
  - 상세: `isActiveConversationPhase`/`isTextInputSurface` 는 "이 phase/pending 조합에서 무엇을 할지"를 순수 함수로 `widget-state.ts` 에 노출해 여러 소비처가 공유하도록 하는 이 프로젝트의 명시적 관례다. `graceful` 판정도 성격상 동일한 종류(phase+pending 조합 → 분기 결정)이지만 `use-widget.ts` 의 `endConversation` 콜백 안에 인라인돼 있어, 이 판정 로직만 별도로 단위 테스트하려면 훅 전체를 렌더해야 한다(실제로 `use-widget-eager-start.test.ts` 의 graceful/cancel 테스트들이 그렇게 하고 있다). 현재는 소비처가 1곳뿐이라 즉각적 중복 위험은 없다.
  - 제안: 선택적 리팩터 — `resolveEndCommand(phase, pending): InteractCommand` 같은 순수 함수로 `widget-state.ts` 에 추출하면 (a) 커맨드 라우팅 규칙을 훅 렌더 없이 단위 테스트 가능해지고, (b) 향후 `panel.tsx` 등 다른 소비처가 "지금 종료하면 graceful 인지" 를 UI 힌트로 미리 보여줘야 할 때 동일 로직을 재사용할 수 있다. 우선순위 낮음(현재 스코프에서 필수 아님).

- **[INFO]** `TurnSource` 유니온이 백엔드 wire 프로토콜 값과 프런트 로컬 전용 마커를 여전히 단일 타입으로 병합 — 전 라운드에서 이미 지적, 이번 diff 에서도 미해소(의도적 defer)
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` (`export type TurnSource = "live" | "injected" | "presentation_user" | "ai_user" | "ai_assistant" | "ai_tool" | "system"`)
  - 상세: JSDoc 이 두 출처(백엔드 `ConversationTurnSource` 5값 vs 위젯 로컬 `live`/`injected` 2값)를 명확히 구분해 설명하므로 오독 위험은 낮지만, 타입 레벨에서는 두 계층의 값이 구분되지 않는다. 이는 이전 라운드 RESOLUTION 에서 "#16 TurnSource Backend/Local 타입 분리: JSDoc 로 구분 중, 값 증가 시 분리 검토(타입 nicety)"로 이미 의도적으로 defer 된 항목이며, 이번 diff 도 그 상태를 유지한다. 새로운 문제는 아니고, defer 결정이 여전히 합리적이라는 점을 재확인.
  - 제안: 추가 조치 불필요(이미 합의된 defer). 값이 더 늘어나거나 두 그룹을 각기 다른 코드 경로가 소비하기 시작하면 `BackendTurnSource`/`LocalTurnSource` 분리를 재검토.

- **[INFO, 긍정 관찰]** SSE·REST wire-shape 정합이 코드 재사용이 아닌 공유 durable 컬럼으로 구조적으로 보장됨(모듈 경계 양호)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`execution.conversationThread ?? undefined`)와 park 시 `Execution.conversation_thread` 에 commit 되는 `cloneThread` 스냅샷(비-diff, execution-engine 도메인)
  - 상세: `getStatus()`(REST) 는 SSE emit 코드를 직접 호출·재사용하지 않고, park 시점에 이미 SSE 와 동일 형식으로 저장된 durable 컬럼을 그대로 읽기만 한다. 두 표면(SSE/REST)의 wire-shape 일치가 "동일 함수 호출"이 아니라 "동일 저장소를 읽는다"는 데이터 계층 계약으로 보장되어, `external-interaction` 모듈과 `execution-engine` 모듈 사이의 런타임 결합도를 낮게 유지하면서도 정합성을 확보한다.
  - 제안: 없음(양호, 참고 기록).

- **[INFO]** `channel-web-chat` 와 `backend` 사이의 계약이 코드 임포트가 아닌 spec 문서 cross-reference 로만 연결됨 — 모듈 경계는 깨끗하나 타입 드리프트 감시는 여전히 수동
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` (`ConversationTurnSource` 5값을 프런트가 별도로 리터럴 유니온에 손으로 복제) vs 백엔드 `conversation-thread.types.ts`(비-diff)
  - 상세: 두 앱(별도 배포 단위)이 공유 코드/패키지 없이 spec 문서만을 SoT 로 값 목록을 동기화하는 구조 자체는 이 모노레포의 기존 관례(marketplace/`packages/` 미사용 영역)와 일치하고, 임베드형 위젯이 백엔드와 별도 배포 주기를 갖는다는 설계 의도(`api_contract.md` 리뷰가 이미 확인한 "프런트/백엔드 독립 배포 조합에서도 안전"과 동일 전제)에 부합해 부적절한 결합은 아니다. 다만 백엔드가 6번째 source 값을 추가하면 프런트 타입이 컴파일 타임에는 조용히 stale 해지고(문서 diff 를 사람이 놓치면) 런타임에는 `roleOf` fallback(`assistant`)으로만 감지된다.
  - 제안: 필수 아님. 이미 spec cross-reference(§SoT 표기)로 추적되고 있어 즉시 조치 불필요 — 값 목록이 자주 바뀌는 편이 아니므로 공유 타입 패키지 도입 등 구조 변경은 과잉.

## 요약

이번 diff 는 이전 리뷰 라운드(`18_44_10`)가 지적한 아키텍처 WARNING(진행-중-phase 판정 로직의 레이어 오배치)을 포함해 유지보수성 WARNING 다수(세션정리 중복, 3항 분기 반복, 백엔드 스프레드 중복)를 정확히 그 라운드가 제안한 형태(`isActiveConversationPhase` 를 `widget-state.ts` 로 이관, `CONFIRM_COPY`/`base` 조회·조립 테이블 도입, `resetSessionRefs` 헬퍼 추출)로 구조적으로 해소한 것을 diff 기준으로 확인했다. SOLID 원칙 위반, 순환 의존성, 레이어 오염에 해당하는 CRITICAL/WARNING 급 이슈는 발견되지 않았다. 백엔드는 SSE/REST wire-shape 정합을 공유 durable 컬럼이라는 데이터 계층 계약으로 보장해 모듈 결합도를 낮게 유지했고, 프런트는 phase 파생 로직을 상태 레이어에 단일화하는 기존 관례를 재확립했다. 신규로 추가된 `startGenRef` 세대 토큰 가드는 이 스코프에서는 적절한 해법이지만 `useWidget` 훅이 세션 생명주기 관련 ref 를 계속 축적하고 있어 향후 유사 race 가 하나 더 발견되면 훅 분해(전용 세션-생명주기 훅 또는 명시적 상태기계)를 검토할 시점이 될 것이다. `endConversation` 의 graceful/cancel 커맨드 라우팅 판정을 `widget-state.ts` 의 다른 파생 헬퍼처럼 순수 함수로 추출하면 일관성·테스트 용이성이 소폭 개선되나 필수는 아니다. `TurnSource` 유니온의 계층 혼합은 전 라운드에서 이미 의도적으로 defer 된 사안으로 이번 diff 에서도 그 판단이 유효하다.

## 위험도
LOW
