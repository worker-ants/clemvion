# 아키텍처(Architecture) 코드 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/종료) + `getStatus` durable `conversationThread` 노출 (EIA §R17 재조정).
> backend `interaction.service.ts`(+spec), channel-web-chat `conversation.ts`/`eia-types.ts`/`use-widget.ts`/`panel.tsx`/`styles.ts`(+tests), plan/spec 문서.

## 발견사항

- **[WARNING]** 진행-중-phase 판정 로직이 상태 레이어가 아닌 프레젠테이션 컴포넌트에 위치 — 기존 프로젝트 관례(단일 소스 파생 헬퍼)와 불일치
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:16-20`(`ACTIVE_PHASES` 상수)·`panel.tsx:49`(`showSessionControls = ACTIVE_PHASES.includes(phase)`)
  - 상세: 같은 코드베이스의 `codebase/channel-web-chat/src/lib/widget-state.ts`에는 이미 `isTextInputSurface(pending)`라는 phase/pending 파생 boolean 헬퍼가 있고, 그 JSDoc 이 명시적으로 "use-widget(전송/큐 flush 게이팅)과 panel(Composer 활성)이 같은 판정을 공유하도록 단일화한다(텍스트표면 판정 **3중 중복 제거**)"라고 밝혀 이 프로젝트는 phase 파생 로직을 `widget-state.ts`(상태/도메인 레이어)에 모으고 컴포넌트(프레젠테이션 레이어)는 그 결과만 소비하는 레이어링 컨벤션을 이미 확립해 두었다. 이번 PR 의 `ACTIVE_PHASES`/`showSessionControls` 는 정확히 같은 성격(“이 phase 집합에서만 어떤 UI 를 보여줄지”)의 파생 로직임에도 `widget-state.ts` 가 아니라 `panel.tsx` 안에 하드코딩됐다. 현재는 소비처가 `panel.tsx` 하나뿐이라 즉각적인 중복은 없지만, `isTextInputSurface` 가 애초에 방지하려던 것과 동일한 패턴(향후 `widget-app.tsx`나 다른 컴포넌트가 "진행 중 대화인가"를 다시 판정해야 할 때 각자 다른 phase 배열을 만들 위험)이 재발할 토대를 만든다.
  - 제안: `ACTIVE_PHASES`/`showSessionControls` 파생 로직을 `widget-state.ts` 로 옮겨 `isActiveConversationPhase(phase)` 같은 이름의 export 함수로 만들고, `panel.tsx` 는 그 결과만 소비하도록 정리. `WidgetPhase` 유니온이 바뀔 때 한 곳만 갱신하면 되게 한다.

- **[INFO]** REST `getStatus` 두 분기(buttons / form·ai)에서 `conversationThread` 조건부 spread가 동일하게 2회 반복
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:296`, `:305` (`...(conversationThread ? { conversationThread } : {})`)
  - 상세: `buttonConfig` 분기와 `nodeOutput` 분기가 각각 독립적으로 `context` 객체를 조립하면서 `conversationThread` 동봉 스프레드를 그대로 복제했다. 로직 자체는 옳지만, 분기가 하나 더 늘어나면(예: 향후 새 interactionType) 이 스프레드를 다시 복붙할 개연성이 있다.
  - 제안: `const base = { interactionType, waitingNodeId: nodeExec.nodeId, ...(conversationThread ? { conversationThread } : {}) }` 로 공통부를 먼저 만들고 각 분기가 `{ ...base, buttonConfig }` / `{ ...base, nodeOutput: out }` 로 확장하는 형태로 리팩터링하면 동일 필드 추가 시 단일 지점만 수정하면 된다. 우선순위는 낮음(현재 중복은 1줄, 실질적 유지보수 부담 작음).

- **[INFO]** 헤더 "새 대화"/"대화 종료" 인라인 confirm UI가 3항 연산자로 두 액션을 하드코딩 — 향후 확인 대상 액션 추가 시 확장 지점 불명확
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx:79-99` (`confirming === "new" ? "..." : "..."` 가 메시지 텍스트·버튼 라벨 두 곳에서 반복)
  - 상세: `confirming: null | "new" | "end"` 라는 2값 유니온과 그에 종속된 3항 분기가 JSX 내부에 인라인돼 있다. 현재 액션이 2개뿐이라 당장 문제는 없으나, 세 번째 확인-필요 액션(예: "설정 초기화")이 추가되면 `confirming` 유니온 확장 + 동일 패턴의 3항 분기 반복이 필요해 OCP 관점에서 매끄럽지 않다.
  - 제안: `confirming` 을 `{ action: "new" | "end"; message: string; confirmLabel: string } | null` 형태의 설정 객체로 바꾸거나, 별도 `ConfirmBar` 서브컴포넌트(`{ message, confirmLabel, onConfirm, onCancel }` props)로 추출해 두 버튼 핸들러가 설정만 주입하도록 하면 신규 액션 추가가 데이터 추가만으로 끝난다. 현재 스코프(액션 2개)에서는 필수는 아님.

- **[INFO]** `TurnSource` 유니온이 백엔드 wire 프로토콜 값과 프런트 로컬 전용 마커를 하나의 타입에 병합
  - 위치: `codebase/channel-web-chat/src/lib/eia-types.ts:29-46` (`"live" | "injected" | "presentation_user" | "ai_user" | "ai_assistant" | "ai_tool" | "system"`)
  - 상세: JSDoc 이 두 그룹(백엔드 `ConversationTurnSource` 5값 vs 위젯 로컬 `live`/`injected` 2값)을 명확히 구분해 설명하고 있어 당장 혼란은 크지 않다. 다만 타입 레벨에서는 두 출처가 구분되지 않아, 이 필드를 소비하는 새 코드가 "이 값이 서버에서 온 것인지 로컬 합성인지"를 타입만으로 판별할 수 없다(현재는 `roleOf`의 `USER_TURN_SOURCES` 매핑이 문서·주석에만 의존해 정합성을 유지).
  - 제안: 필수 리팩터는 아니지만, 값이 더 늘어나면 `type BackendTurnSource = "presentation_user" | ...` / `type LocalTurnSource = "live" | "injected"` / `type TurnSource = BackendTurnSource | LocalTurnSource` 로 분리해 두 출처의 경계를 타입 레벨에 남기는 것을 고려.

- **[INFO, 긍정 관찰]** 보안 표면 경계 문서화가 데이터 모델 확장과 함께 정확히 갱신됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:224-232` (getStatus JSDoc "보안 제약" 단락)
  - 상세: `conversationThread`를 공개 REST 표면에 추가하면서, "공개 EIA 표면"이라는 기존 트러스트 바운더리 계약을 `outputData`뿐 아니라 conversation turn 텍스트까지 명시적으로 확장했다. 데이터 노출 범위가 넓어질 때 그 경계를 코드 근처 문서에 동시 갱신한 점은 모듈 경계(보안 관점) 관리가 양호함을 보여준다. 조치 불필요, 참고로 기록.

- **[INFO, 긍정 관찰]** SSE·REST 간 wire-shape 일관성이 "공유 함수 재사용"이 아니라 "공유 durable 컬럼"으로 구조적으로 보장됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:260`(`execution.conversationThread ?? undefined`) vs `codebase/backend/src/modules/execution-engine/{ai-turn-orchestrator,button-interaction,form-interaction}.service.ts` 의 park 시 `cloneThread(context.conversationThread)` → `Execution.conversationThread` 커밋
  - 상세: getStatus 의 `conversationThread` 는 SSE emit 코드를 직접 호출/재사용하는 게 아니라, park 시점에 이미 SSE 와 동일한 `cloneThread` 스냅샷이 `Execution.conversation_thread` jsonb 컬럼에 durable 하게 저장되고 REST 는 그 컬럼을 그대로 읽기만 한다. 즉 두 표면(SSE/REST)의 wire-shape 일치는 주석상의 "동일 형식" 약속에만 의존하는 게 아니라 "같은 저장소를 읽는다"는 구조적 보장을 갖는다 — 이는 결합도를 낮추면서도 정합성을 데이터 계층에서 확보한 합리적 설계다. 조치 불필요.

## 요약

이번 변경은 두 개의 독립적인 관심사(① EIA `getStatus` 의 durable `conversationThread` 노출, ② 웹채팅 위젯 헤더 세션 컨트롤)를 백엔드/프런트 각각의 기존 파사드·훅 패턴 안에 무리 없이 편입시켰다. 백엔드는 SSE 와 REST 간 wire-shape 정합을 "같은 durable 컬럼을 읽는다"는 구조로 보장하고 보안 표면 경계 문서도 데이터 확장에 맞춰 정확히 갱신해 모듈 경계·추상화 수준이 양호하다. 순환 의존성이나 레이어 오염, SOLID 위반에 해당할 CRITICAL 급 이슈는 발견되지 않았다. 다만 프런트에서는 새로 추가된 "진행 중 phase" 판정 로직(`ACTIVE_PHASES`)이 이 프로젝트가 이미 확립한 "phase 파생 로직은 `widget-state.ts` 에 단일화한다"는 컨벤션(`isTextInputSurface` 선례)을 따르지 않고 프레젠테이션 컴포넌트(`panel.tsx`)에 직접 정의돼 있어, 향후 재사용 시 그 선례가 막으려던 중복이 재발할 토대가 된다 — 유일한 WARNING이다. 그 외 REST 분기 내 소소한 스프레드 중복, confirm UI 의 향후 확장성, `TurnSource` 유니온의 출처 혼합은 모두 INFO 수준의 유지보수성 참고 사항이다.

## 위험도
LOW
