# Changelog

## Unreleased — AI Agent 도구 정의 payload 예산 가드레일 (4-nodes/3-ai/1-ai-agent §4.2·§10·§12.15)

1. **AI Agent 노드가 LLM 에 노출하는 도구 정의(스키마) 전체의 직렬화 크기에 런타임 예산을 강제한다.** 배경: Cafe24 MCP 383도구 전량이 매 요청에 실려 ~118k토큰 프롬프트가 되고, 이게 provider 무관 LLM 타임아웃으로 번져 "응답 없음 / 무한 SDK 재시도"(6분 hang)로 나타난 회귀(#828 field-set 스키마 팽창 — 도구 **개수**는 불변이었고 **스키마**만 팽창해 개수 cap 만으론 못 잡음). 신규 `tool-payload-budget.ts` 의 `estimateAgentToolPayload`(직렬화 bytes 1차 지표 + approxTokens + provider 그룹별 "범인 지목")를 `buildTools` 직후 single-turn·multi-turn 공통 choke point 에서 강제한다.
2. **Behavior change (breaking): 예산 초과 시 LLM 호출 전 error 포트로 fast-fail 한다** — 신규 에러코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(`output.error.details.retryable: false`, `totalBytes`/`budgetBytes`/`toolCount`/`culpritProvider` 포함). 이 변경은 **이미 예산을 초과하는 대형 도구셋을 구성한 워크스페이스에만** 영향 — 그런 설정은 이전엔 (제거된) provider timeout 까지 조용히 hang 하다 실패했고, 이제는 즉시 명확한 에러로 종결된다. 정상 규모 도구셋은 영향 없음.
3. **신규 env 3종** (기본값은 위 회귀 재현 임계 대비 여유 있게 설정): `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`(기본 98304 — 초과 시 warn 로깅만), `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`(기본 262144 — 초과 시 fail-fast), `AI_AGENT_TOOL_COUNT_MAX`(기본 128 — 2차 sanity, byte 예산 이내라도 초과 시 hard 와 동일 취급). `.env.example` 에 `MCP_MAX_RESPONSE_BYTES` 선례 형식으로 등재.
4. **후속(본 PR 범위 밖)**: config-time 저장 경고(backend-only graph warning, `getGraphWarnings`/`saveCanvas` strict surface)와 resume 턴의 timeout/signal 배선은 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 로 분리했다 — 본 PR 은 런타임 fail-fast 가드레일에 스코프를 한정한다. SoT: `spec/4-nodes/3-ai/1-ai-agent.md §4.2·§10·§12.15`.
## Unreleased — EIA/WS 대기 표면 가드 후속 정리 (F-4/F-5/F-6)

### 변경 사항

1. **control-plane 안내 발송 구조 정리 (F-4)** — languageHints 3-level lookup resolver 3중 복제
   (`resolveFormOpenLabel`/`resolveSessionExpiredMessage`/`resolveSurfaceMismatchMessage`)를
   `makeLocaleResolver` factory 로 통합하고, `HooksService` 의 안내 발송 3종
   (`sendExecutionStillRunningNotice`/`sendSurfaceMismatchNotice`/`maybeNotifyIgnored`)의
   try/catch/warn 골격을 `sendBestEffortNotice` 로 추출했다. 순수 리팩터(동작 보존).
   `ChatChannelInboundService` 분리는 중장기 백로그로 유지.
2. **telegram control-plane raw-send 키 MarkdownV2 등록 검증 (F-5)** — `HooksService` 가 렌더러
   escape 없이 직접 발송하는 키(`help`/`groupChatRefusal`/`unsupportedMessageKind`/
   `executionStillRunning`/`surfaceMismatch`/`formValidationFailed`/`formNextField`)는 telegram 이
   `parse_mode: MarkdownV2` 로 보내므로, operator override 에 unescaped 특수문자가 들어가면 send
   400 → 안내 유실됐다. `provider === 'telegram'` 한정으로 등록 시점에 검증(`LanguageHintsRawSend
   Validator`)해 unescaped 특수문자 발견 시 `400 VALIDATION_ERROR`(`UNSAFE_TELEGRAM_MARKDOWN`)로
   거부한다. escaped(`\.`)·slack/discord·비-raw-send 키는 제외. defaults 의 telegram escape
   baked-in(`\\.`)이 slack/discord 에서 literal 로 노출되는 잔여 갭(발송 경로 per-provider escape 이관)은
   별도 백로그.
3. **WS continuation nodeId 검증 확장 (F-6)** — `execution.submit_message`/`end_conversation` 은
   frontend 가 대기 노드 `nodeId` 를 이미 싣는데 서버가 무시했다. F-1 과 대칭으로, WS gateway 가
   `data.nodeId` 를 publisher 로 forward 해 제공 시 대기 노드와 대조한다(불일치 → `INVALID_EXECUTION_STATE`
   ack). `click_button` 은 nodeId optional 을 받도록 확장했으나 frontend 미전송이라 실질 no-op,
   `execution.submit_form`·REST `/continue` 는 nodeId 파라미터 부재로 미적용. frontend 는 대기 노드의
   정확한 nodeId 를 싣으므로 정상 흐름은 무변경(stale/오지정 제출만 거부). §6-websocket-protocol §4.2 +
   실행 엔진 §7.5.1 커버리지 표 갱신. `expectedNodeId` 는 positional 유지(모든 실 caller 가 명시 전달 —
   options 객체화는 비차단 백로그). `plan/in-progress/eia-command-waiting-surface-guard.md` F-4/F-5/F-6.

## Unreleased — EIA `/interact` 명령의 nodeId 를 실제 대기 노드와 대조 (5-system/4-execution-engine §7.5.1)

### 변경 사항

1. **외부 EIA `/interact` 명령의 `nodeId` 가 실제 대기 노드와 다르면 409 `STATE_MISMATCH` 로 거부한다** (종전 202 → 409, behavior 변경) — spec §7.5.1 은 publisher lookup 키를 `execution_id + node_id + status='waiting_for_input'` 로 규정하고 "nodeId 미일치 → INVALID" 를 약속하지만, `assertNodeId` 는 `dto.nodeId` 의 **존재만** 검사하고 `resolveWaitingNodeExecutionId` 는 `exec+status` 로만 조회해 nodeId 를 무시했다. 그 결과 stale/오지정 nodeId 제출(예: UI 가 다음 노드로 넘어갔는데 이전 노드 대상 제출)이 **현재 대기 노드로 조용히 오적용**됐다(표면만 맞으면 통과). 이제 `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)` 가 caller 지정 nodeId 를 대기 `row.nodeId` 와 대조해 불일치 시 `InvalidExecutionStateError`(→ EIA 409 `STATE_MISMATCH`)로 거부한다. 이는 이미 EIA §5.1(`STATE_MISMATCH` "다른 nodeId")·`InteractDto.nodeId` JSDoc("대기 NodeExecution 의 graph node id 와 일치해야 한다")이 약속하던 계약의 구현이다. **커버리지**: 외부 EIA `/interact` 만 nodeId 를 지정해 검사받는다. chat-channel(`scope: 'in_process_trusted'`)은 **scope 단위**로 면제한다(고정 매핑 forwarding 은 nodeId 미상, form 제출은 nodeId 를 알더라도 동일 policy). 종전에 존재 검사만 만족시키던 `nodeId: 'chat-channel'` placeholder 는 제거했다. WS continuation·REST `/continue` 는 프로토콜/요청 설계상 nodeId 를 서버에 전달하지 않아 미적용(§7.5.1 커버리지 표, plan F-6 후속). 표면(interactionType) 매트릭스 검증은 모든 진입점에 그대로 적용된다. `plan/in-progress/eia-command-waiting-surface-guard.md` 후속 항목 F-1. SoT: `spec/5-system/4-execution-engine.md §7.5.1`.

## Unreleased — 채팅 채널 표면 불일치 명령에 graceful 안내 (5-system/15-chat-channel §4.1.1 surfaceMismatch)

### 변경 사항

1. **채팅 채널에서 대기 노드 표면과 맞지 않는 입력이 도착하면 사용자에게 안내를 발송한다** — 직전 표면-가드 작업(continuation 명령 ↔ 대기 노드 표면 검증)으로, Form/버튼 대기 중 자유 텍스트 등 표면 불일치 명령은 publisher 가 `STATE_MISMATCH` 로 거부하고 `HooksService.forwardToInteractionService` 가 warn 로그와 함께 삼킨다(그대로 throw 하면 webhook 5xx → provider 무한 재시도). 그러나 종전엔 사용자에게 **아무 피드백이 없었다** — 봇이 조용히 무응답. 이제 `languageHints.surfaceMismatch` best-effort 안내를 발송한다(chat-channel CCH-ERR-04 "silently swallow 금지" 관례 대칭). 신규 키 `surfaceMismatch`(KO/EN)를 `language-hint-defaults.ts` `SURFACE_MISMATCH_DEFAULTS` + `resolveSurfaceMismatchMessage`(`sessionExpired` resolver 패턴)로 추가하고, spec §4.1 예제·§4.1.1 표 + telegram 유저 가이드(KO/EN §7.4)에 등재했다. 이 안내는 EIA event 렌더러(provider 별 escape)를 거치지 않고 `adapter.sendMessage` 로 직접 발송되는 control-plane 메시지라(R4 의 "어댑터가 escape" 는 `renderNode` 경로 한정), telegram MarkdownV2 특수문자를 포함하면 raw 전송이 거부된다 — 따라서 default 는 세 provider(telegram/slack/discord) 모두에서 안전하도록 특수문자를 배제했고(단위 테스트가 canonical `escapeMarkdownV2` 로 불변식 강제), providers/telegram.md §5.8 에 이 non-escape 특성을 명시했다. 발송 실패는 swallow(warn) — 안내가 재시도 루프를 유발하지 않도록. `plan/in-progress/eia-command-waiting-surface-guard.md` 후속 항목 F-2. SoT: `spec/5-system/15-chat-channel.md §4.1.1`.

## Unreleased — 워크플로 편집기 엣지 분할(중간 노드 삽입) (3-workflow-editor/2-edge §4.1)

1. **팔레트에서 노드를 기존 엣지 위에 드롭하면 그 엣지를 분할(split)하고 중간에 노드를 삽입한다** (spec §4 "미구현 · Planned" → §4.1 구현). 원본 엣지(source→target)를 제거하고 `source→새 노드`·`새 노드→target` 두 엣지를 만든다. `workflow-canvas.tsx` `onDrop` 이 드롭 지점의 엣지를 순수 헬퍼 `findEdgeIdAtPoint`(DOM `.react-flow__edge[data-id]` hit-test, 뷰포트/RF 의존이라 store 밖 canvas seam, 주입 가능 doc 로 단위 테스트)로 찾고, 순수 헬퍼 `edge-utils.ts` `buildEdgeSplitPlan(edge, newId, def)` 이 두 신규 Connection 을 조립한다 — 새 노드의 첫 입력(`firstInputHandleId`, 예약 `emit` 제외)·첫 출력(`firstOutputHandleId`)을 쓰고 원본 `sourceHandle`/`targetHandle` 은 보존(다중 출력 If/Else·Switch, 다중 입력 노드여도 위상 불변). 두 엣지는 표준 `onConnect`(→`evaluateConnection`)를 재사용해 포트색·유효성이 그대로 적용된다. store `removeEdge` 에 `{skipUndo}` 옵션 추가(`onConnect` 대칭) → 노드 추가 `pushUndo` 1회 + 엣지 수술 skipUndo 로 **Ctrl+Z 1회에 삽입 전체(노드+엣지 2개 제거, 원본 엣지 복원)가 취소**된다(§1.2/§1.3 관행). **스코프(R-3)**: 입력·출력 포트를 모두 가진 **비-컨테이너** 노드 + plain 엣지만 분할한다 — (1) 무입출력 노드(트리거·순수 sink), (2) **새 노드 자체가 컨테이너**(Loop/ForEach/Map — 첫 출력이 `body` 라 target 을 새 컨테이너 본문 자식으로 재편입시킴), (3) 컨테이너 경계 엣지(`sourceHandle` `body` / `targetHandle` `emit`)는 `buildEdgeSplitPlan`→null 로 분할 없이 노드만 추가(§6·containerId 불변식 회피). `done` 은 Parallel Branch 도 일반 데이터 출력으로 써 경계에서 제외(핸들명 오배제 방지). 이 제외들 덕에 두 신규 Connection 이 `detectContainerConflict` 거부 분기(body/emit)에 절대 안 걸려 **onConnect 2회가 항상 성공**(removeEdge 후 반쪽 갱신 원자성 문제 구성적 해소). 착수 전 `consistency-check --impl-prep`(BLOCK:NO) WARNING 5건 + ai-review 1회차 CRITICAL(컨테이너 새 노드 body 재편입, side_effect·testing 발견)을 반영해 spec §4.1 신설 + `## Rationale` R-3 기록, 유저 가이드(connecting-nodes·canvas-basics ko/en) 동반 갱신. 테스트: `firstOutputHandleId`(2)·`isContainerBoundaryEdge`(body/emit/done-data/generic 4)·`buildEdgeSplitPlan`(핸들 보존·emit 제외·트리거·sink·컨테이너 경계·**컨테이너 새 노드**·**다중 출력** 8)·`findEdgeIdAtPoint`(주입 doc 4) + `removeEdge` skipUndo 1 + **store 분할 시퀀스 통합 3**(plain 분할 원자성=최종 엣지 2개·Loop body 내부 분할 시 새 노드 containerId 상속·undo 1회 완전 취소+undoStack=0). **부수 수정(ai-review 3회차)**: `buildAndAddNode` 가 자체 `pushUndo` + 내부 `addNode` 의 `pushUndo` 로 삽입 1회에 phantom 스냅샷 2개를 쌓던 잠재 결함(§1.2 도 공유)을 발견해 중복 `pushUndo` 제거(단일 체크포인트 정정). 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). 이로써 `spec-sync-edge-gaps` 5개 surface 전부 완료. SoT: `spec/3-workflow-editor/2-edge.md §4.1`.

## Unreleased — 워크플로 편집기 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (3-workflow-editor/2-edge §4/§5)

1. **실행 후 엣지에 마우스를 올리면 그 엣지로 흐른 데이터(연결원 노드의 출력)를 축약해 보여주는 Data Flow Preview 툴팁이 뜨고, "전체 데이터 보기" 클릭 시 전체 JSON 모달이 열린다** (spec §4 hover·§5 "미구현 · Planned" → 구현). 신규 `edge-data-preview.tsx`(`EdgeDataPreviewTooltip`/`EdgeDataModal`) + `use-edge-hover-preview.ts` 훅. `workflow-canvas.tsx` `onEdgeMouseEnter` 가 커서 위치에 툴팁을 예약하고, 툴팁은 엣지 source 노드의 최근 실행 출력(`findLatestResultByNodeId` → `unwrapNodeOutput().output`)을 축약해 보여준다(실행 데이터 없으면 렌더 안 함). 축약·바이트 계산은 순수 함수 `lib/utils/edge-data-preview.ts` `summarizeDataForPreview`(중첩 배열 `[N items]`·중첩 객체 `{N fields}`·긴 문자열·최상위 배열 앞 5개로 축약 + 원본 JSON 바이트) / `formatBytes`. 엣지 진입 시 짧게 지연(`SHOW_DELAY_MS=90`) 후 표시해 촘촘한 캔버스에서 커서가 여러 엣지를 스쳐 지날 때 정착하지 못한 엣지의 툴팁/직렬화를 건너뛰고(sweep 방어), 벗어나도 200ms 지연 후 숨겨 커서를 툴팁으로 옮겨 클릭할 수 있다. 모달은 hover 생명주기와 독립적으로(`dataModalEdgeId`) 열려 툴팁이 사라져도 유지되며, 전체 JSON 은 run-results 공용 `JsonContent` 를 재사용한다. UI 문자열은 `dict/{ko,en}/editor.ts` + `useT()` 로 localize(i18n ratchet 준수). 데이터 조회는 store 공유 selector `findLatestResultByNodeId`(O(1) `lastIndexByNodeId`). 바이트 크기는 직렬화 문자열이 100KB 이하면 정확 인코딩, 초과 시 `TextEncoder` 할당을 생략하고 char 수 하한 근사(`bytesApprox` → 툴팁에 `~` 표기)로 대용량 출력 hover 비용에 상한. 테스트: 순수 util 16(경계값·근사·빈 컬렉션) + `useEdgeHoverPreview` renderHook 6(sweep 취소) + `EdgeDataPreviewTooltip`/`EdgeDataModal` RTL 10(running/failed status 포함) + `findLatestResultByNodeId` store 4. 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §4·§5`.

## Unreleased — 워크플로 편집기 엣지 실행 상태 스타일 (3-workflow-editor/2-edge §3.2)

1. **실행 중·완료·비활성 상태를 엣지에 시각적으로 반영한다** (spec §3.2 "미구현 · Planned" → 구현). 신규 `use-edge-execution-state.ts` `useEdgeExecutionState` 훅이 실행 스토어(`status`/`nodeStatuses`)와 노드 `isDisabled` 를 읽어 각 엣지에 상태 스타일을 입힌다(판정 순수 함수 `edge-utils.ts` `resolveEdgeExecutionState`, 상호배타 우선순위 inactive > flowing/completed). **데이터 흐름**(실행 중 source `completed`+target `running`) → `className='edge-flowing'` → globals.css 가 데이터 방향 마칭 점선(`edge-flow` keyframe 재사용) 렌더. **실행 완료**(source·target 둘 다 `completed`) → `className='edge-completed'` → `edge-complete-flash` 1회성 keyframe 이 초록(#22c55e)으로 잠시 표시 후 원래 포트색으로 복귀. **비활성 노드 연결**(source/target `isDisabled`) → `edge.data.edgeInactive` → `custom-edge.tsx` 가 반투명(opacity 0.4) 점선 렌더(정적, 실행 무관). 실행 상태는 `useEdgeHighlighting`(§3.3 hover/선택) **앞단**에서 합성돼 className Set 병합으로 하이라이트와 공존한다. 성능을 위해 sibling 훅과 동일한 per-edge bail-out(상태 불변 엣지는 원본 참조 유지)+안정 disabled 키로 실행 tick·노드 드래그 시 전체 엣지 재생성을 피한다. 엣지 style 조립은 순수 함수 `buildEdgeStyle` 로 분리. 테스트: `resolveEdgeExecutionState` 9 + `buildEdgeStyle` 5 + `useEdgeExecutionState` renderHook 9. 실행 시각화는 `05-run-and-debug/running-a-workflow`(ko/en) "실행 상태 확인" 절에도 반영. 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §3.2`.

## Unreleased — 워크플로 편집기 엣지 역방향 연결 · 기존 엣지 재연결/분리 (3-workflow-editor/2-edge §1.3)

1. **기존 엣지의 끝점을 잡아 다른 포트로 끌면 재연결되고, 빈 영역에 놓으면 그 엣지가 삭제(분리)된다** (spec §1.3 "미구현 · Planned" → 구현). `workflow-canvas.tsx` 가 `onReconnect`/`onReconnectEnd` 두 콜백을 배선하고(로직은 신규 `use-edge-reconnect.ts` `useEdgeReconnect` 훅 — detach 결정을 renderHook 단위 테스트), React Flow 가 reconnectable 엣지의 앵커를 자동 렌더한다. store `onReconnect`(`editor-store.ts`)은 `reconnectEdge`(`shouldReplaceId:false` — 엣지 id 보존)로 갱신하고 `onConnect` 과 동일한 유효성(자기연결/중복/컨테이너 충돌 — 중복 검사는 재연결 중인 엣지 자신 제외; 공용 `evaluateConnection` 헬퍼로 두 경로 단일화)을 적용한 뒤 포트색 data·컨테이너 소속을 재도출한다. detach(빈 캔버스 드롭)는 store `removeEdge`(undo 가능) — `onReconnectEnd` 의 `connectionState.toNode` 가 null(=pane)일 때만 삭제하므로 무효 핸들 위 드롭(예: 자기연결)은 원상 유지된다. 재연결·삭제 각각 단일 undo 체크포인트.
2. **역방향 연결(입력 포트에서 드래그 시작 → 출력 포트에 드롭)은 React Flow strict `connectionMode` 기본 동작으로 이미 지원됨을 확인**했다 — 핸들에 `isConnectableStart`/`isConnectableEnd` 제약이 없고 React Flow 가 Connection 을 핸들 타입 기준으로 정규화(source=출력, target=입력)하며 `onConnect`/`isValidConnection` 이 direction-agnostic 이라, 드래그 방향과 무관하게 올바른 엣지가 생성된다. 커스텀 코드 불요(spec "미구현" 오기재 정정).
3. **부수 강화**: `edge-utils.ts` `firstInputHandleId`(§1.2 자동 연결 target)가 예약 입력 포트(컨테이너 `emit`, `RESERVED_INPUT_HANDLE_IDS`)를 건너뛰도록 했다 — 컨테이너 노드의 첫 입력이 `emit` 인 경우 자동 연결이 `detectContainerConflict` 에 거부돼 orphan 노드가 남던 latent 위험 해소(현행 노드 정의상 미발생이나 신규 컨테이너 대비). 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §1.3`.

## Unreleased — 워크플로 편집기 출력 포트 드래그→빈 영역 드롭 노드 추가 팝업 + 자동 엣지 연결 (3-workflow-editor/2-edge §1.2)

1. **출력 포트에서 드래그를 시작해 유효 target 없이 빈 캔버스 영역에 드롭하면, 드롭 위치에 노드 추가 검색 팝업을 열고 선택한 노드를 연결원의 출력 포트 → 새 노드의 첫 입력 포트로 자동 연결한다** (spec §1.2 "미구현 · Planned" → 구현). 종전엔 노드 추가 검색 팝업이 빈 캔버스 더블클릭·우클릭 메뉴(`add-node`)로만 열렸다. `workflow-canvas.tsx` `onConnectEnd`(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle` 기반) 배선 + `NodeSearchPopupState.dragSource` 로 연결원 기록 → `handleAddNodeFromSearch` 가 노드 생성(`buildAndAddNode` 신규 id 반환) 후 `onConnect` 자동 연결. **"노드 생성+연결"을 Ctrl+Z 1회로 함께 취소** — `onConnect` 에 `skipUndo` 옵션을 추가해 엣지 추가가 "노드-only" 중간 상태를 별도 undo 스냅샷으로 남기지 않게 했다(skipUndo 없이는 Ctrl+Z 가 엣지만 되돌려 고아 노드가 남음). 대상 노드에 입력 포트가 없으면(예: 트리거) 노드만 생성하고 연결은 생략. 판정·조립 로직은 순수 헬퍼(`edge-utils.ts` `connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId` + `isConnectionDroppedOnPane`)로 분리해 단위 테스트했다. 입력 포트 시작 역방향 드래그(§1.3)는 `fromHandle.type !== 'source'` 로 배제. 순수 프런트엔드 편집기 변경(백엔드·wire 무변경). SoT: `spec/3-workflow-editor/2-edge.md §1.2`.

## Unreleased — 웹채팅 위젯 carousel 잘림 배너 + 총 개수 노출 (7-channel-web-chat/1-widget-app §2/R8)

1. **위젯 carousel 잘림 배너를 신설하고 잘리기 전 총 아이템 개수를 함께 노출한다** — table 잘림 배너(#921)와 대칭. 종전 `CarouselData` 에는 `truncated`/`totalCount` 필드가 없어 `asEnvelope` 가 흡수하던 `itemsTruncated`/`itemsTotalCount` 가 **소비처 없는 dead field** 였다(#901 이 4개 cap 키를 흡수하나 carousel 은 미소비). 이를 소비만 확장 — 백엔드·SSE wire·Presentation 공통 §10.4 무변경. `CarouselData.truncated`/`totalCount?`(유한 비음수 정수만 채택, table 과 공유하는 `asTotalCount` 헬퍼) 추가 + `toCarousel` 이 `output.itemsTruncated`/`itemsTotalCount` 투영 + `CarouselView` 배너(`wc-carousel-truncated`, `.wc-table-truncated` 와 CSS 공유). 배너 문구(위젯 로컬 i18n catalog ko/en): `총 N개 중 일부만 표시돼요.`(총 개수 있음) / `일부 항목만 표시돼요.`(폴백). 동일 정합으로 `asTotalCount` 는 `Number.isInteger` 를 포함해 `toTable` 의 총 개수 판정도 spec §R8("비음수 정수")에 맞춰 tighten 했다. **배포-시점 영향(코드 변경만, 서버 데이터 무변경)**: 배포 시점에 이미 잘린 기존 AI carousel 응답이 있으면 코드 배포 즉시 배너가 소급 노출된다. SoT: `spec/7-channel-web-chat/1-widget-app.md §2·R8·§4`.

## Unreleased — 웹채팅 위젯 chrome 문자열 EN 다국어화 (`locale` 활성, 7-channel-web-chat/1-widget-app §4)

### 변경 사항

1. **위젯 chrome 문자열(위젯 소유 UI 프레임 문자열)을 ko/en 다국어화하고 `BootConfig.locale` 을 활성화했다** — v1 비목표(Korean-only, `locale` reserved/inert)에서 목표로 승격(#922 가 "코드 변경 없음" 스코프상 defer 하고 `2-sdk §R6` 이 예약한 활성화 경로 실행). 위젯은 별도 정적 export 번들이라 메인 앱 `frontend/src/lib/i18n/dict` 를 import 할 수 없어 **위젯 로컬 경량 catalog**(`src/lib/i18n/` — `catalog.ts` ko/en 32키·`resolveLocale`·`I18nProvider`/`useTranslation`, `{{}}` 보간, ko/en parity hard-fail 테스트)를 신설했다. 언어 해석: **명시 `locale` → 브라우저 `navigator.language`(auto-detect) → `ko` fallback**, boot 시 1회 해석해 고정(변경은 iframe 재마운트로만). 번역 범위 = 위젯 소유 chrome 한정(세션 컨트롤·확인·입력창·상태/에러·잘림 배너·차트 aria-label·헤더 기본값) — 운영자 제공 콘텐츠(`headerTitle`·`welcome`·`disclaimer`)·backend payload·AI 본문은 비대상. **배포-시점 영향(코드 변경만, 서버 데이터 무변경)**: 운영 콘솔에서 이미 `locale='en'` 으로 저장된 위젯 인스턴스는 이번 배포부터 실제 EN chrome 을 렌더한다(종전엔 저장돼도 한국어 렌더). SoT: `spec/7-channel-web-chat/1-widget-app.md §4`.

## Unreleased — 웹채팅 위젯 table 잘림 배너 총 개수 노출 (7-channel-web-chat/1-widget-app §2/R8)

### 변경 사항

1. **위젯 table 잘림 배너가 잘리기 전 총 행 개수를 함께 노출한다** — 메인 편집기 run-results(`assistant-presentations-block`, `truncated · total N`)와 parity. 종전엔 `truncated: boolean` 만 소비해 `일부 행만 표시됩니다.` 고정 문구뿐이었다. 총 개수(`rowsTotalCount`)는 이미 `truncationMeta` 가 `output` 으로 흡수하던 **dead field** 였고(직전 truncation 수정 PR #901 이 4개 cap 키를 흡수하나 `rowsTruncated` 만 소비), 이를 소비만 확장한다 — 백엔드·SSE wire·Presentation 공통 §10.4 무변경. `TableData.totalCount?`(유한 비음수만 채택 — NaN/Infinity/음수/이형은 `undefined`→폴백) 추가 + `toTable` 이 `output.rowsTotalCount` 투영. **배너 문구가 바뀐다(고객사 임베드 영향 가능)**: `총 N개 중 일부만 표시돼요.`(총 개수 있음) / `일부 행만 표시돼요.`(폴백) — 같은 배너 라인의 기존 합쇼체 `…표시됩니다.` 를 위젯 관례(해요체)로 함께 교정. **범위**: table 배너 한정 — carousel 은 잘림 배너 자체가 미구현이라 별도 후속. SoT: `spec/7-channel-web-chat/1-widget-app.md §2·R8`.

## Unreleased — 공개 웹채팅 위젯 idle-wait execution 회수 reaper (EIA-RL-07, 5-system/14 §3.4·§R19)

### 변경 사항

1. **eager-start 후 이탈로 서버에 무기한 잔존하던 공개 위젯 `waiting_for_input` execution 을 회수하는 백엔드 backstop 을 추가했다** (§R9 결정의 PR-2, PR-1 위젯 coalesce/cancel 의 서버측 짝). 신규 `WebchatIdleReaperService`(BullMQ repeatable 분 단위, EIA-RL-06 `terminal-revoke-reconciler` 형제 패턴 — 전역 1회)가 `auth_config_id IS NULL`(익명 공개 위젯) + `per_execution` 토큰으로만 접근되는 `waiting_for_input` execution 중 **발급된 모든 토큰이 영구 만료**(`execution_token.exp_at` 전부 `< now − grace`)된 것을 회수한다. 판정 = provably un-continuable(익명 위젯은 만료 후 refresh 불가라 입력 도착 경로 소멸, §R19). 회수는 engine 신규 `markWebchatIdleTimeout`(멱등 조건부 UPDATE `WHERE status='waiting_for_input'` → `cancelled` + `cancelledBy='timeout'` + `error.code='WEBCHAT_IDLE_TIMEOUT'`, 동반 WAITING NodeExecution cancel, 후행 `execution.cancelled` emit) + `revokeAllForExecution`(EIA-RL-06 재사용). grace 는 `WEBCHAT_IDLE_REAP_GRACE_MS`(기본 1h) env. **soft-terminal** — hard-delete 아님, 이력·`GET /:id` 보존. §1.1 이 예약한 `waiting_for_input → cancelled` "타임아웃" 사유의 구현이라 §7.4 무기한 보존 불변식과 정합(엔진 recovery scanner 아닌 EIA token-lifecycle sweep). 범위=공개 위젯 한정 — 인증 트리거·per_trigger·`formConfig.timeout` 은 대상 아님. SoT: `spec/5-system/14-external-interaction-api.md §3.4 EIA-RL-07 / §R19`.

## Unreleased — 웹채팅 위젯 "새 대화" single-flight coalesce + 확립세션 best-effort cancel (7-channel-web-chat/1-widget-app §R9)

### 변경 사항

1. **위젯 "새 대화"/host `resetSession` 의 서버측 execution 잔존 2건을 클라이언트 측에서 해소했다** (결정 PR #916 §R9 구현, PR-1). **(A) single-flight coalesce** — `newChat()` 이 `booting`(webhook POST in-flight·세션 미확립) 중 호출되면(주로 UI 게이트 밖의 host `resetSession`) in-flight `start()` 에 **흡수**한다: 조기 return 이 `resetSessionRefs()`(=start 가드 재개방)를 건너뛰어 **2번째 `POST /api/hooks/:path` 를 발사하지 않는다** — 종전엔 booting 중 reset 이 중복 webhook·첫 노드 부작용 2회를 유발할 수 있었다(§3.1 "Planned" 제약 해소). 단 "새 대화" 의도상 이전 대기 큐만은 비워(흡수 세션으로의 텍스트 누수 차단). **(B-1) 확립세션 cancel** — 확립된(`streaming`/`awaiting_user_message`) 세션발 "새 대화"는 새 start 전에 이전 execution 을 **best-effort 범용 `cancel`**(폐기이므로 graceful `end_conversation` 아님, optimistic — 실패해도 로컬 재시작 유지)로 종료해 서버 orphan 을 근원 제거한다. 서버측 idle-wait backstop(EIA-RL-07, cancel 유실 경로 회수)은 후속 PR. 순수 CSR 위젯 변경(백엔드 무변경). SoT: `spec/7-channel-web-chat/1-widget-app.md §R9·§3.1`.

## Unreleased — `variables.__*` 예약 네임스페이스 3계층 강제 (conventions/execution-context 원칙 5)

### Breaking changes

1. **Variable Declaration / Variable Modification 노드의 변수 이름에 `__`(double-underscore) prefix 를 금지한다.** `variables.__*` 는 엔진이 실행 시작 시 `__workspaceId`·`__dryRun` 등 시스템 값을 주입하는 예약 네임스페이스인데(execution-context 원칙 5), 지금까지 규약일 뿐 강제가 없어 사용자가 시스템 키를 덮어쓰거나, `__` 사용자 변수가 park/resume 시 `filterUserVariables` 에 **관찰 불가능하게 drop** 되어 조용히 소실됐다. 이제 신규 코드 `RESERVED_VARIABLE_NAME` 으로 3계층 강제한다 — **L0** 저장 시점(`WorkflowsService.saveCanvas`/`importWorkflow` → 400, `details.offenders[]`; `restoreVersion` 은 legacy-data escape 로 면제), **L1** pre-flight `validateConfig`(→ `INVALID_NODE_CONFIG`), **L2** `handler.execute` 런타임 throw. **어느 계층도 단독으로 충분하지 않다**: 변수 이름 필드는 `{{ }}` 표현식 대상이라(두 노드는 `EXPRESSION_EXCLUSIONS` 에 없다) L0/L1 은 해석 전 리터럴만 보고, `name: "{{ $input.x }}"` 가 런타임에 `__workspaceId` 로 평가되는 경우는 오직 L2(해석 후)만 잡는다 — L2 가 예약의 실질 강제 지점이다.
2. **영향받는 워크플로**: 기존에 `__foo` 변수를 선언·수정하던 워크플로는 재저장 시 400, 또는 다음 실행 시 노드 throw 로 실패한다. 그러나 그런 변수는 이미 재개 시 조용히 소실되던 반쯤 깨진 상태였다 — 조용한 데이터 손실을 명시적 실패로 바꾼다. Variable Declaration §6 이 의도적으로 채택한 "관찰 가능한" silent skip/fallback(`meta.skipped`/`meta.coercionWarnings` 로 가시화)과는 다른 종류의 침묵(park drop)만 대상이다.

### 범위 밖 (잔여 리스크)

3. **Code 노드**(`$vars` 전체 atomic replace, `nodes/data/code/code.handler.ts`)는 사용자 코드가 `$vars.__workspaceId` 를 쓰면 필터 없이 덮어쓴다. 임의 코드 실행 노드에 변수-이름 화이트리스트를 강제하는 것은 별개 결정이라 본 강제 범위 밖으로 두고, 원칙 5 "강제 범위 밖" 절에 정직하게 등재했다.

SoT: `spec/conventions/execution-context.md` 원칙 5 · `spec/5-system/3-error-handling.md` §1.3 · `spec/4-nodes/1-logic/{4,5}-*.md` §6.

## Unreleased — 웹채팅 위젯 presentation `truncation` 유실 수정 + 복원 렌더 회귀 가드 (7-channel-web-chat/1-widget-app §2)

### 변경 사항

1. **AI `render_table` 이 1MB cap 으로 행을 잘라도 위젯에 "일부 행만 표시됩니다" 배너가 뜨지 않던 버그를 고쳤다** — `PresentationPayload.truncation` 은 `payload` **바깥** top-level 필드인데(AI Agent §7.10), 위젯 `asEnvelope` 가 `payload` 만 펼쳐 구조적으로 이 필드를 볼 수 없었다. 그 결과 `toTable` 의 `output.rowsTruncated` 판정이 항상 `false` 였다. 복원 경로만이 아니라 라이브 `ai_message` 경로에도 있던 기존 버그다. standalone table 노드는 `output.rowsTruncated` 를 output 안에 직접 실어 정상 동작했고 메인 프런트엔드(`assistant-presentations-block`)는 `truncation` 을 이미 소비하고 있어, 위젯만 outlier 였다. Presentation 공통 §10.4 가 두 위치를 "동등한 메타" 로 규정하므로 코드를 spec 에 맞춘다(spec 변경 없음). 병합은 알려진 4개 cap 키(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`) 화이트리스트로 한정해, 장래 shape 확장이 payload 의 동명 렌더 필드를 조용히 덮지 않게 봉인했다.
2. **`1-widget-app.md` §2 의 "알려진 제약(Planned)" 서술을 정정했다(문서)** — "새로고침 복원 thread 의 presentation 은 위젯 렌더러가 graceful 하게 무시(빈 렌더)한다" 는 서술은 실측과 달랐다. 렌더러는 `asEnvelope`/`classifyPresentation` 으로 `{config,output}` 과 `PresentationPayload` 두 shape 을 이미 모두 수용하고 있었고, 복원 thread 의 carousel/table/chart/template 4종이 무수정 상태에서 정상 렌더됨을 실증했다. **진짜 남은 제약은 원인이 다르다** — durable thread 의 `turn.presentations[]` 는 `source: 'ai_assistant'` 한정이라 AI `render_*` 표시물만 영속되고, 표시-전용 presentation *노드*의 표시물은 SSE `execution.message` 로만 오므로 새로고침 복원 대상이 아니다. 이 경계를 SoT(`conversation-thread.md` §2.1)·소비 문서(`1-widget-app.md` §2·§3.1·R8)·영역 백로그(`_product-overview.md` §2 비목표) 3곳에 등재했다. `0-architecture.md` §3 EIA 매핑 표에 누락돼 있던 `execution.message` 행도 함께 보강. 런타임 동작 무변경(문서). SoT: `spec/7-channel-web-chat/1-widget-app.md` §2·R8.
3. **회귀 가드 3계층 추가** — 복원 thread turn 의 `PresentationPayload` 4종 passthrough·분류·정규화(`conversation.test.ts`), DOM 렌더·port 버튼·truncation 배너(`presentations.test.tsx`), truncation 흡수·병합 우선순위·malformed 입력 no-op·미등록 키 미흡수(`presentation.test.ts`).

## Unreleased — continuation 명령 ↔ 대기 노드 표면 검증 (5-system/4-execution-engine §7.5.1)

### 변경 사항

1. **인터랙션 명령이 현재 대기 노드의 표면과 맞지 않으면 publish 전에 거부된다** — 종전엔 `execution.status === 'waiting_for_input'` 만 검사해, 이종 명령이 continuation bus 로 흘러갔다. resume 처리기는 도착 payload 의 `type` 이 아니라 **대기 노드의 표면**으로 선택되므로(`dispatchResumeTurn`), 이 조합은 에러 없이 **조용히 오처리**됐다: Form 대기 중 `end_conversation`/`submit_message`/`click_button` 은 sentinel 불일치 폴백을 타 **빈 폼이 제출된 것처럼** 노드를 완료시켰고(ConversationThread 에 가짜 `form_submitted` 까지 append), Buttons 대기 중 비-`click_button` 은 `resolveButtonInteraction` 의 fallback 을 타 **엉뚱한 `continue` 포트로 그래프를 분기**시켰다. 이제 4종 명령이 공유하는 publisher chokepoint(`resolveWaitingNodeExecutionId`)가 표면 매트릭스를 강제한다 — `form` 대기는 `submit_form` 만, `buttons` 대기는 `click_button` 만 받고, `ai_conversation`/`ai_form_render` 는 4종을 모두 받는다(AI 핸들러의 기존 관용 보존: Presentation §10.9 의 stale `button_click` graceful re-park, AI Agent §6.2 step 2.c 의 `render_form` 응답). 표면 판정은 `dispatchResumeTurn`/`dispatchParkEntry` 의 selects 술어를 미러링하며, 판정 불가 행은 fail-closed 거부한다(그 행은 worker 에서 `RESUME_CHECKPOINT_MISSING` 로 실행이 죽으므로 동기 거부가 `waiting_for_input` 을 보존해 낫다). 신규 에러 코드는 없다 — 기존 `InvalidExecutionStateError` 를 재사용해 진입점별 매핑이 자동 파생된다(EIA REST `409 STATE_MISMATCH` / WS ack `INVALID_EXECUTION_STATE` / REST `/continue` `422 INVALID_STATE`). 이미 `EIA-IN-13`(필수)과 EIA §5.1 에러 표가 약속하던 동작의 구현이다. chat-channel in-process forwarding 은 대기 표면을 모른 채 명령을 고정 매핑하므로 `STATE_MISMATCH` 를 warn 로그와 함께 삼킨다(그대로 throw 하면 webhook 5xx → provider 무한 재시도). 표면 판정에 필요한 `interactionType` 문자열만 JSONB path 로 투영해 hot path 가 `output_data` 전체(AI 멀티턴의 누적 `_resumeCheckpoint.messages`)를 읽지 않는다. SoT: `spec/5-system/4-execution-engine.md §7.5.1` · `spec/5-system/14-external-interaction-api.md §5.1`.

## Unreleased — KB WebSocket 이벤트 count drift 정정 (5-system/6-websocket-protocol §4.3)

### 변경 사항

1. **frontend `useKbEvents` 가 backend `KbEventType` union 권위(11종)에 정렬된다** — frontend `KB_EVENT_NAMES` 가 union 에 없는 `document:graph_error` 를 구독해 count drift(frontend 12 vs union 11)가 있었다. graph `_error` 는 emit 경로가 없어 #443 에서 union 에서 제거됐고(`data-flow/6-knowledge-base.md §2.5` 권위 기록), graph 오류는 `_retry`/`_failed` 로만 신호한다. 죽은 `graph_error` 구독을 제거하고(→11종, backend emit 무변경이라 no-op), closure-local `KB_EVENT_NAMES` 를 module-scope `export` 로 승격해 union↔구독 parity 회귀 테스트(`use-kb-events.test.ts`)를 추가했다. 백엔드 union 자체는 이미 11종이라 무변경(JSDoc 만 "12개"→"11종" 정정). spec 정합: `6-websocket-protocol §4.3`, `8-embedding-pipeline §8.1/§8.2`, `10-graph-rag §6/KB-GR-OB-02`, `2-navigation/5-knowledge-base`. `document:embedding_error` 는 union 선언분(미emit·forward-compat)이라 유지. 런타임 동작 무변경. SoT: `spec/5-system/6-websocket-protocol.md §4.3`.

## Unreleased — 통합 상세 활동 탭 "연결 안 됨" 안내 배너 (2-navigation/4-integration §4.6)

### 변경 사항

1. **통합이 연결되어 있지 않으면(`error`/`expired`/`pending_install`) 활동 탭에 "연결 안 됨" 경고 배너를 노출한다** — 이 상태에서는 AI Agent 가 MCP bridge 로 미연결 통합의 tool 을 노출하지 않아 호출 자체가 없고(직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패), 새 활동이 기록되지 않는다. 종전엔 활동 탭이 단순 "활동 없음" 빈 상태만 보여줘 사용자가 "기록이 없는 것" 과 "통합이 끊겨 기록이 안 되는 것" 을 구분하지 못했다. 이제 활동 목록·빈 상태 위에 [Inline Alert](spec/0-overview.md §3.4)를 얹어 원인을 알리고, "상태 확인" 버튼으로 개요 탭(상태·재연결)으로 유도한다. 톤은 §3.4 status→tone escalation 에 맞춰 `error`=red, `expired`/`pending_install`=warning(amber) 으로 헤더 `StatusBadge` 신호와 일치시킨다. `connected`(곧 만료 expires-soon 포함)는 여전히 기록되므로 미노출. 프론트 전용(백엔드·API 무변경). SoT: `spec/2-navigation/4-integration.md §4.6` · `spec/0-overview.md §3.4`.

## Unreleased — AI Agent 자동 메모리 롤링 요약 압축 chat 의 llm_usage_log attribution 배선 (data-flow/7-llm-usage §1.3)

### 변경 사항

1. **AI Agent 자동 메모리(`summary_buffer`/`persistent`) 롤링 요약 압축 LLM 호출이 `llm_usage_log` 의 `workflow_id`/`execution_id`/`node_execution_id` 를 채우도록 배선했다** — 노드 내부에서 실행되는데도 이 요약 압축 chat 만 attribution 이 전부 NULL 로 남던 잔여 갭(#879 후속)을 해소한다. `AiMemoryManager.injectMemoryContext` 가 요약 압축(`buildSummaryBufferUpdate`) chat 에 `LlmCallContext` 를 전달하도록 하고, 세 필드를 caller 가 명시 전달한다 — **single-turn** 경로는 `context.workflowId`/`context.nodeExecutionId`(엔진이 노드 실행 직전 주입), **multi-turn resume** 경로는 재구성 `state.*`(엔진 `buildRetryReentryState` 주입분). 과거 `config` 파생 방식은 single-turn 의 `config` 가 사용자 노드 config 라 해당 키가 없어 항상 NULL 이 되던 문제가 있었다. 이로써 워크플로우별 LLM 비용 집계(Statistics `workflowId` 필터·Alerts)에 메모리 압축 사용량도 반영된다. SoT: `spec/data-flow/7-llm-usage.md §1.3`.

## Unreleased — `$params.<name>` 표현식 자동완성 (5-system/5-expression §7.1)

### 변경 사항

1. **에디터 표현식 자동완성이 `$params` 를 최상위 변수로 노출하고 `$params.<name>` 하위키를 힌트한다** — `trigger-param-output-enricher`(§7.2 enricher) 후속. spec 은 이미 `$params`(= `$input.parameters` 단축, §5:171·manual-trigger §5:150)를 규정했으나 프론트 자동완성엔 미등록이라 `$params` 가 후보로도 안 떴다. `ROOT_VARIABLES` 에 `$params`(expandable) 를 추가하고 `$params.` drill 핸들러를 추가해, `$params ≡ $input.parameters` 소스(트리거 직속 successor 는 enricher 로 enrich 된 `inputSchema.parameters`)에서 파라미터 이름을 자동완성한다. 값 없는 노드에선 하위키가 비어(오도 없음) `$input` 과 동일 정책. 프론트 전용 UX 힌트로 런타임·엔진·백엔드 무변경, spec 변경 없음(구현 catch-up). §7.1 트리거 조건 표에 `$params.` 행 동기화. SoT: `spec/5-system/5-expression-language.md §7.1`.

## Unreleased — 멀티턴 resume 턴 llm_usage_log attribution (IE node_execution_id 오적재 + ai_agent 메인 chat) (data-flow/7-llm-usage §1.3)

### 변경 사항

1. **멀티턴 AI 노드(Information Extractor·AI Agent)의 resume 턴 LLM 호출이 `llm_usage_log` 의 workflow/execution/node_execution attribution 을 올바르게 채우도록 고쳤다** — #877 이 공유 재구성기 `buildRetryReentryState` 에 `workflowId`·`nodeExecutionId`(현재 turn 의 NodeExecution row PK)를 재주입하도록 고쳐 통합 usage-log(§4.6) 갭을 해소했는데, **LLM usage-log(`llm_usage_log`) 쪽 소비 사이트 2곳이 아직 미교정**이었다. (a) **Information Extractor resume 턴**은 `node_execution_id` 자리에 `state.nodeId`(Node **정의** id — NodeExecution row PK 아님)를 넣어 attribution FK 에 잘못된 참조를 적재하고 `workflow_id` 를 누락했다(첫 턴은 `context.*` 로 정상). 이제 재구성 `state.nodeExecutionId`/`state.workflowId` 를 소비한다(첫 턴 사이트와 대칭). (b) **AI Agent resume 턴 메인 chat 호출 2곳**(`ai-turn-executor.ts` `processMultiTurnMessage`)은 `LlmCallContext` 를 전혀 전달하지 않아 세 컬럼이 NULL 이었다 — 이제 `state.workflowId`/`executionId`/`nodeExecutionId` 를 전달한다(tool-batch 는 이미 소비 중). 이로써 노드 핸들러 3종(AI Agent·Text Classifier·Information Extractor)의 attribution 이 모두 채워진다 — 멀티턴(AI Agent·Information Extractor)은 첫 턴·resume 턴 모두, Text Classifier 는 단발 호출(resume 없음). `spec/data-flow/7-llm-usage.md` §1.3 표·Rationale·§4 표와 `spec/5-system/4-execution-engine.md` §6.1 소비처 표를 실제 채움 현황으로 정정. SoT: `spec/data-flow/7-llm-usage.md §1.3`.

## Unreleased — Manual Trigger 파라미터 표현식 자동완성 힌트 (5-system/5-expression §7.2)

### 변경 사항

1. **에디터 표현식 자동완성이 Manual Trigger 의 `output.parameters.<name>` 를 실행 전에도 힌트한다** — 한 사용자 워크플로에서 AI Agent userPrompt 가 `{{$node["Manual Trigger"].config.parameters.region}}` 로 작성돼 값이 빈값으로 전달됐다. `config.parameters` 는 정의 **배열**(이름 접근 불가)이고 해석된 값은 name-keyed `output.parameters` 에 있는데, 에디터가 그 경로를 힌트하지 못해 혼동을 유발했다. 기존 Form/Table/Transform/InfoExtractor 4개 enricher 와 동일 패턴으로 `enrichManualTriggerOutputSchema` 를 추가해, 노드 `config.parameters[].name` 을 정적 outputSchema 의 `output.parameters.<name>`(param `type` 매핑)로 투영한다 — `$node["Manual Trigger"].output.parameters.<name>`(및 직속 successor 의 `$input.parameters.<name>`)이 실행 전에도 자동완성된다. 프론트 전용 UX 힌트로 런타임 검증·엔진·백엔드 output shape 은 무변경. `spec/5-system/5-expression-language.md §7.2` enricher 표에 `manual_trigger` 행 동기화(4→5개 노드 타입). SoT: `spec/5-system/5-expression-language.md §7.2`.

## Unreleased — 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원 (7-channel-web-chat §1·§3)

### 변경 사항

1. **임베드 웹채팅 위젯에 "새 대화"·"대화 종료" 헤더 컨트롤이 추가되고, 새로고침 후 대화 히스토리가 복원된다** — 두 사용자 리포트("세션 종료/신규 세션 수단 없음", "새로고침하면 히스토리가 사라짐")를 해소했다. **① 세션 컨트롤**: 대화가 확립된(`streaming`/`awaiting_user_message`) 뒤에만 패널 헤더에 두 컨트롤을 노출하고(대화 없음·`booting`(webhook in-flight, 세션 미확립)·`[ended]` 는 미노출 — booting 노출 시 종료가 서버 취소를 못 보내거나 중복 webhook 을 발사할 수 있어 세션 확립 후로 게이트), 둘 다 인라인 2단계 **가벼운 확인** 후 실행한다(`spec/7-channel-web-chat/1-widget-app.md §2·§3.1`). "대화 종료"는 대기 중 AI 대화(`awaiting_user_message`+`ai_conversation`, waiting nodeId 확정 시)면 graceful `end_conversation`, 그 외 phase 면 범용 `cancel` 을 발사하고 위젯은 SSE 를 먼저 닫은 뒤 optimistic 하게 `[ended]` 로 전이한다(종료 명령이 유발하는 terminal SSE 이벤트와 경합해 `conversationEnded` 콜백이 2회 발사되지 않도록 스트림 선차단 + 이미-종료 가드). "새 대화"는 저장 세션/스트림을 정리하고 새 execution 을 시작한다(이전 execution 은 명시 종료 없이 서버에서 `waiting_for_input` 잔존, 토큰만 TTL/idle 만료 — **이후 §R9 에서 확립세션 best-effort `cancel` + booting coalesce 로 정정됨**). booting/초기 streaming 중 종료·새 대화가 in-flight `start()` 를 무효화하도록 세대 토큰(gen guard)을 도입해 옛 execution 이 되살아나는 race 를 차단했다. **② 히스토리 복원(2겹 수정)**: (a) **백엔드** — `InteractionService.getStatus()` 가 `waiting_for_input` 시 durable `Execution.conversation_thread`(V084)를 `context.conversationThread` 로 SSE 와 동일 wire shape 으로 동봉한다 → 5분 SSE buffer·서버 재시작·인스턴스 스위치와 무관하게 전체 히스토리를 복원한다(`spec/5-system/14-external-interaction-api.md §5.3·§R17` 재조정 — 종전엔 conversationThread 를 SSE 전용 권위로 두어 getStatus 에서 생략했으나, 웹채팅 §3.1 의 "buffer 만료 시 getStatus snapshot 폴백" 계약과 모순이라 durable 컬럼 read-only 노출로 정합화). (b) **프런트** — 위젯 `conversation.roleOf` 가 wire 의 백엔드 5-source(`presentation_user`·`ai_user`→user, `ai_assistant`·`ai_tool`·`system`→assistant)를 말풍선 role 로 축약한다 — 종전엔 `turn.role` 만 봐서 복원 thread 가 전부 assistant 로 뒤집혔다(위젯 테스트가 실제 wire 가 보내지 않는 `role` 형태를 먹여 통과 중이던 잘못된 계약도 정정). backend 는 additive read-only 확장(신규 저장·계산·마이그레이션 없음), FE 는 CSR 위젯 전용. SoT: `spec/7-channel-web-chat/1-widget-app.md`·`3-auth-session.md`·`spec/5-system/14-external-interaction-api.md`.

## Unreleased — 멀티턴 AI 에이전트 resume 턴에서 통합 사용 로그가 누락되던 버그 수정 (2-navigation/4-integration §4.6)

### 변경 사항

1. **멀티턴(대화형) AI 에이전트의 2번째 이후(resume) 턴에서 cafe24·makeshop·MCP 툴 호출이 성공·응답해도 통합 상세 §4.6 "활동" 탭에 기록되지 않던 버그를 고쳤다** — 원인은 AI resume ↔ retry-last-turn 이 공유하는 resume-state 재구성기 `buildRetryReentryState` 가 `executionId`/`nodeId`/`workspaceId` 는 재주입하면서 `workflowId`·`nodeExecutionId` 는 빠뜨린 것. 두 필드는 `_resumeCheckpoint`/`_retryState`(DB 영속)의 allow-list 로 persist 에서 제거되고 재개 시 재유도 대상인데, 재유도가 누락돼 resume 턴 provider-tool 의 `IntegrationsService.logUsage` 게이트 `if (ctx.nodeExecutionId && ctx.workflowId)` 가 false 로 평가돼 기록이 조용히 skip 됐다(외부 호출은 정상이라 응답은 옴). 첫 턴은 full `ExecutionContext` 로 정상 기록되므로 대화형 사용(2턴+)만 누락됐고, 과거 기록이 `getActivity` 의 7일 롤링 창 밖으로 밀리며 탭이 완전히 비어 보였다. `buildRetryReentryState` 가 `workflowId`(`execution.workflowId`)·`nodeExecutionId`(호출측 대기/재시도 NodeExecution row PK)를 재주입하도록 수정(AI resume + retry-last-turn 양 경로 공유). 회귀 도입: #501(in-memory 대화 루프 제거로 checkpoint 재구성이 유일 resume 경로가 되면서 노출). SoT: `spec/2-navigation/4-integration.md §4.6` · `spec/5-system/4-execution-engine.md §1.3`.

## Unreleased — 워크스페이스 슬러그 URL 라우팅 phase 2 — 에디터 slug화 (2-navigation/9-user-profile §3)

### 변경 사항

1. **워크플로 에디터 캔버스가 활성 워크스페이스 slug URL(`/w/<slug>/workflows/<id>`)로 렌더된다** — phase 1(#865)에서 slug 밖으로 남긴 에디터를 `/w/<slug>/workflows/<id>` 로 편입했다(FE-only, backend 무변경). `(editor)/workflows/[id]` 라우트를 `(editor)/w/[slug]/workflows/[id]` 로 옮기고, phase 1 의 slug 해소·**reconcile(URL 우선)**·무효-slug redirect·정합 전 gate 로직을 공용 `<WorkspaceSlugGate>`(`lib/workspace/workspace-slug-gate.tsx`)로 추출해 `(main)/w/[slug]` 와 에디터 layout 이 공유한다(에디터는 `EditorContent` 풀스크린 chrome 유지). 두 route group 이 `/w/[slug]` prefix 를 공유하되 leaf page 가 달라 충돌하지 않는다. 에디터 딥링크(목록/대시보드 create-then-push·행 클릭·트리거/스케줄/통합 카드·실행 목록 "Open in Editor")는 신규 `buildEditorHref(slug, workflowId)` 헬퍼로 slug 화하고, raw `/workflows/<id>` 리터럴은 `no-raw-editor-href` guard 로 CI 차단한다(알림 딥링크·REST API 경로는 예외). 구 bare `/workflows/<id>`(북마크·실패류 알림)는 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수한다. **URL slug = FE 라우팅 SoT ≠ backend 인가 SoT** 불변(header-first→토큰 클레임·`X-Workspace-Id` 헤더 유지). spec 동기화: `9-user-profile §3`·`_layout §2.2/§3.1`·`0-dashboard`·`1-workflow-list`·`14-execution-history`·`3-workflow-editor/2-edge` frontmatter·`data-flow/12-workspace` Rationale(reconcile 방향). SoT: `spec/2-navigation/9-user-profile.md §3`.

## Unreleased — 워크스페이스 슬러그 URL 라우팅 phase 1 (`/w/[slug]/...`) (2-navigation/9-user-profile §3)

### 변경 사항

1. **활성 워크스페이스가 URL 경로(`/w/<slug>/...`)로 반영된다** — `spec/2-navigation/9-user-profile.md §3` 이 "미구현(Planned)" 으로 두었던 슬러그 라우팅을 구현했다(FE-only, backend 무변경). `(main)/*` 26 페이지를 `(main)/w/[slug]/*` 로 이동하고, 신규 `(main)/w/[slug]/layout.tsx` 가 slug→워크스페이스를 해소해 **reconcile(URL 우선)** 한다 — resolved-id ≠ 활성 id 면 기존 `switchWorkspace`(→ `X-Workspace-Id` 헤더 + `/switch` 토큰 재발급) 로 재조정하고, 정합될 때까지 페이지 렌더를 gate 한다. **URL slug = FE 라우팅 SoT 이며 backend 인가 SoT 가 아니다** — header-first→토큰 클레임 인가 모델(#859)·`X-Workspace-Id` 헤더 첨부는 불변. 무효/비멤버 slug 는 default 워크스페이스로 조용히 redirect(UX 편의, 인가 경계는 `RolesGuard` 403). `(main)/[...rest]` catch-all 이 구 무-slug 경로·알림 딥링크·`/`·로그인후 `/dashboard` 를 활성 slug 로 흡수한다(query/hash 보존). 내부 링크는 `buildWorkspaceHref(slug, path)`(open-redirect 방어 포함) 헬퍼로 slug 화하고, 활성/폴백 워크스페이스 해소는 `resolveFallbackWorkspace` 단일 규칙을 공유한다. **에디터(`/workflows/[id]`)·유저 가이드(`/docs`)·인증(`(auth)`)은 phase 1 에서 slug 밖**(에디터 slug화는 phase 2). spec 동기화: `9-user-profile §3` flip·`data-flow/12-workspace` Rationale(슬러그 라우팅 불변식)·`10-auth-flow §7.2`·`_layout §2.2/§3.1`. SoT: `spec/2-navigation/9-user-profile.md §3`.

## Unreleased — Manual Trigger `defaultValue` 파라미터가 실행에서 무시되던 버그 수정 (4-nodes/7-trigger §4/§5.1/§6)

### 변경 사항

1. **Manual Trigger 에 `defaultValue` 를 지정해도 `output.parameters` 가 비고 다운스트림 `$node["…"].output.parameters.*`/`$params.*` 표현식이 전부 빈값이던 버그를 고쳤다** — 실측(save→execute→engine e2e) 결과 세 결함이 겹쳐 있었다. (a) **엔진 재진입 input 소실**: `runNodeDispatchLoop` 의 3개 재진입/redrive 호출부(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`)가 `input: {}` 를 전달 — "재기동 후 input 소멸" 이라는 주석과 달리 `Execution.inputData` 는 durable 컬럼이라, 아직 미완료인 진입 노드(Manual Trigger)가 빈 입력을 받아 `output.parameters:{}` 를 산출했다. 이제 `savedExecution.inputData ?? {}` 를 넘긴다(완료 노드는 skip 되므로 미완료 진입 노드에만 영향; AI multi-turn retry 경로는 spec 문서화된 `$input` 미해소 동작이라 의도적으로 제외). (b) **트리거 조회**: `loadTriggerParameterSchema` 가 `category=TRIGGER` 로 조회해 category 누락/불일치 manual_trigger 노드(프론트 `is-trigger.ts` 가 방어하는 실존 케이스)를 놓쳤다 — `type='manual_trigger'` 조회로 교체. (c) **저장 검증**: `saveCanvas` 가 파라미터 스키마를 검증하지 않아 빈 이름 슬롯 등 malformed 정의가 조용히 영속됐다 — `validateManualTrigger` 가 저장 시점에 `400 INVALID_TRIGGER_PARAMETERS` 로 차단(spec §6, 버전 복원은 예외). 프론트 `ManualTriggerConfig` 는 빈/식별자위반/중복 이름을 inline 표시. SoT: `spec/4-nodes/7-trigger/1-manual-trigger.md §4/§5.1/§6`.

## Unreleased — 삭제된 Integration 참조 캔버스 경고 배지 `⚠ Missing integration` (4-integration §5)

### 변경 사항

1. **Integration 노드가 참조하던 통합이 삭제되면 캔버스 노드 헤더에 `⚠ Missing integration`(앰버) 배지가 표시된다** — `spec/4-nodes/4-integration/0-common.md §5` 가 "계획(미구현)" 으로 두었던 배지를 구현하고 5개 통합 노드 spec(§7 캔버스 요약)·`spec/3-workflow-editor/0-canvas.md §5.3.5` 를 동기화했다. 이 판정은 schema `warningRules` 로 표현할 수 없다 — `when` DSL 평가기(`evaluateWhen(expr, config)`)가 노드 자신의 config 만 봐서 "그 `integrationId` 가 실재하는가" 라는 cross-entity 검증에 닿지 못하기 때문이다(plan `spec-sync-integration-common-gaps` 옵션 A 채택). 따라서 **렌더러 전용 cross-entity 판정**으로 구현했다: 캔버스(`workflow-canvas.tsx`)가 워크스페이스 integration 목록을 무필터 키 `["integrations","list"]` 로 **한 번** 조회해 실재 id 집합을 Context(`integration-list-context.ts`)로 내려주고, 각 노드 렌더러(`custom-node.tsx` `MissingIntegrationBadge`)가 자기 `config.integrationId` 를 그 집합과 대조한다(per-node `useQuery` 구독을 피하는 `hasDefaultLlmConfig` 패턴과 동일). 정상 삭제 경로는 사용 중 통합 삭제를 백엔드가 차단(`INTEGRATION_IN_USE`)하므로 본 배지는 버전 복원·레거시 등 **잔존 참조 방어 표식**이다. 위양성 방지 가드: 목록 로딩 중·페이지네이션 미완전(전체 미확보) 시 억제, `http_request` 는 `authentication==='integration'` 조건부 필드라 그 외 인증 모드의 잔존값 제외. graph-warning 배지(`AlertTriangle`)와 구분되는 `Unplug`(연결 끊김) 아이콘. i18n `integrations.missingIntegration` KO/EN 동시 추가. 신규 서버 API 없음(기존 `GET /integrations` 재사용). SoT: `spec/4-nodes/4-integration/0-common.md §5`.

## Unreleased — 캔버스 키보드 단축키 · 클립보드 복붙 · 컨테이너 삭제 확인 다이얼로그 (canvas UX spec-sync §10·§3.3·§11.3)

### 변경 사항

1. **워크플로 에디터에 키보드 단축키·클립보드 복붙·컨테이너 삭제 확인 다이얼로그가 추가된다** — `spec/3-workflow-editor/0-canvas.md §10/§3.3/§11.3` 이 "미구현 (Planned)" 로 두었던 세 묶음을 구현하고 spec 본문을 동기화했다. (a) **§10 단축키** — Ctrl+C/V/D/A(복사·붙여넣기·복제·전체선택)·Escape(선택 해제, 단 Run Results 드로어 포커스 시 §10.12 캔버스 복귀가 우선)·Space 패닝(`panActivationKeyCode`)·Ctrl++/-/0/1(줌). 입력 필드 포커스 중에는 가로채지 않는다(`isEditableTarget` 가드). 키→액션 매핑은 순수 함수(`resolveEditorShortcut`/`resolveZoomShortcut`)로 분리해 단위 테스트한다. 줌은 ReactFlow 인스턴스가 필요해 캔버스 컴포넌트에서 처리한다. (b) **§3.3 클립보드** — 앱 내부 상태 `editorClipboard`(OS 텍스트 클립보드와 별개)로 `copySelection`/`pasteClipboard`/`duplicateSelection`. 붙여넣기는 신규 id·오프셋(+40)·유니크 라벨·엣지 신규 id 재연결·`containerId` 엣지 기반 재도출. 캔버스 우클릭 메뉴에 "붙여넣기"(클릭 위치 기준) 추가. (c) **§11.3 컨테이너 삭제** — 자식이 있는 컨테이너 삭제 시 "컨테이너+자식 전체 삭제" vs "그룹 해제(자식 유지)" 확인 다이얼로그(`container-delete-dialog.tsx`, Ungroup 기본). ✕ 버튼·우클릭 메뉴(`requestNodeDelete`)·Delete 키(ReactFlow `onBeforeDelete`) 세 경로 모두 경유하며, 다중 선택 시 확인 대상 컨테이너만 부분 취소하고 나머지는 정상 삭제한다. 빈 컨테이너·일반 노드는 즉시 삭제. 신규 서버 API 없음(클라이언트 사이드 전용). i18n `editor.pasteMenu`·`editor.containerDelete.*` KO/EN 동시 추가. SoT: `spec/3-workflow-editor/0-canvas.md §10/§3.2/§3.3/§3.5/§11.3`.

## Unreleased — edge 자기연결/중복 하드차단 + 탈출불가 순환 warn-not-block · outbound 알림 폭주 degraded (spec-sync edge §2.2/§2.3 · EIA §8.4)

### 변경 사항

1. **워크플로 에디터가 자기연결·중복 연결은 막고, 사이클은 막지 않되 위험한 순환만 경고한다** — `spec/3-workflow-editor/2-edge.md §2.2/§2.3` 이 "대부분 미구현 (Planned)" 로 두었던 연결 유효성 규칙을 구현·동기화했다. (a) **§2.2 하드 차단** — 자기연결(`source===target`)은 `isValidConnection`(React Flow prop) 이 드래그 중 커서 🚫 로, 동일 연결 중복(같은 source·sourceHandle·target·targetHandle)은 `onConnect` 이 토스트로 차단(순수 헬퍼 `edge-utils.ts` `isSelfConnection`/`isDuplicateConnection`). (b) **§2.3 warn-not-block** — 실행 엔진이 분기 노드(Switch/If-Else) back-edge 순환을 정식 지원하므로 캔버스는 사이클을 막지 않고, 분기 노드 없이 탈출 불가한 순환만 `graph:unescapable-cycle`(severity `warning`) 배지로 경고한다. 그래프 전역 DFS back-edge 탐지를 `@workflow/graph-warning-rules` 신규 graph-level 규칙 `evaluateGraphCycleWarnings`(`rules/cycle.ts`) 로 구현하고, 컨테이너 loopback(`targetHandle==='emit'`)·진입(`sourceHandle==='body'`) 엣지는 예외 처리(SoT `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS={'emit'}`). frontend `editor-store.ts` `evaluateGraphWarningsLocal` 과 backend `getGraphWarnings` 가 per-type 결과에 cycle 결과를 병합해 두 surface 가 일치한다. 편집기는 warn, workflow-assistant 도구(`shadow-workflow.ts`)는 여전히 hard-block — surface 별 요구 차이(`2-edge.md §Rationale R-2`). i18n `GRAPH_WARNING_KO['graph:unescapable-cycle']` KO 템플릿 + P3-C-1 가드 확장. 신규 서버 API 없음(기존 `GET /workflows/:id/graph-warnings` 재사용). SoT: `spec/3-workflow-editor/2-edge.md §2.2/§2.3`, `spec/conventions/cross-node-warning-rules.md §3/§8/§9`.

2. **outbound 알림이 trigger 당 분당 60건을 넘으면 폐기 없이 계속 발송하되 `notificationHealth=degraded` 로 표시한다** — `spec/5-system/14-external-interaction-api.md §8.4 row4 / §3.1 EIA-NX-11` 이 권장한 outbound 폭주 감지를 구현했다. `OutboundNotificationRateLimiterService`(Redis fixed-window `INCR`+`EXPIRE NX` 단일 pipeline, fail-open) 가 발송 성공마다 카운트하고, `NotificationWebhookProcessor` 성공 분기가 한도 초과 시 `markHealthy` 대신 `markDegraded` + 폭주 전용 `notification_last_error`(발송 실패 degraded 와 원인 구분) 로 표시한다. **throttle(폐기) 아님** — 초과분도 발송하며 수신 endpoint 부하만 알린다. SoT: `spec/5-system/14-external-interaction-api.md §8.4/§3.1`, `§Rationale R-outbound-flood`.

## Unreleased — 캔버스 미니맵·줌 슬라이더/퍼센트·노드 삭제 버튼 (canvas UX spec-sync §5.4·§6·§7)

### 변경 사항

1. **워크플로우 에디터 캔버스에 미니맵·줌 슬라이더·노드 ✕ 삭제 버튼이 추가된다** — `spec/3-workflow-editor/0-canvas.md §3.1/§5.4/§6/§7` 이 "미구현 (Planned)" 로 두었던 세 어포던스를 구현하고 spec 본문을 구현 상태로 동기화했다. (a) **§7 미니맵** — @xyflow `MiniMap` 을 우하단에 렌더(`pannable`/`zoomable` 로 미니맵 내 드래그·스크롤 뷰포트 이동/줌) + 토글 버튼으로 표시/숨김(`canvas-minimap.tsx`). (b) **§6/§3.1 줌** — 좌하단 오버레이에 줌 레벨 슬라이더(25%~200%) + 실시간 퍼센트 표시를 추가(기존 inline `ZoomControls` 를 `zoom-controls.tsx` 로 분리), ReactFlow `minZoom`/`maxZoom` 을 슬라이더 범위와 동일하게 정합(`MIN_ZOOM`/`MAX_ZOOM` 단일 출처). (c) **§5.4 노드 삭제 버튼** — 노드 우상단 ✕ 원형 버튼(hover fade-in·선택 시 상시 표시), 클릭 시 연결 엣지까지 함께 삭제. Manual Trigger(진입점, 삭제 불가) 와 워크플로우 실행 중에는 숨김. 삭제 가능 판정은 `isNodeDeletable()` 단일 헬퍼로 통합해 ✕ 버튼·Delete 키·우클릭 메뉴가 같은 규칙을 참조한다. 신규 서버 API 없음(클라이언트 사이드 전용). i18n `common.aria` 키(zoomLevel·minimap·toggleMinimap) KO/EN 동시 추가, UI 투어 문서 동반 갱신. SoT: `spec/3-workflow-editor/0-canvas.md §3.1/§5.4/§6/§7`.

## Unreleased — 알림 신규 발사 소스 execution_failed·schedule_failed·team_invite (알림 파이프라인 PR3)

### 변경 사항

1. **워크플로우 실행 실패·스케줄 시작 실패·팀 초대 시 알림이 발사된다** — 종전 `notification.type` 의 `execution_failed`/`schedule_failed`/`team_invite` 는 DB CHECK 에 허용값으로만 존재하고 이를 발사하는 코드가 없었다(`spec/data-flow/8-notifications.md §1.1` 이 to-be 로 명시). 이제 세 소스가 발사한다. 모두 **best-effort**(발사 실패가 원 흐름을 되돌리지 않음): (a) `execution_failed` — 실행이 FAILED 로 종료될 때 워크플로우 owner + 실행자에게. **top-level 실행에만** 발사(`!parentExecutionId`)해 background 본문/sub-workflow 하위 실행은 제외 — background 본문 실패는 기존 `background_failed` 가 담당하므로 중복을 피한다. (b) `schedule_failed` — 스케줄이 execution 을 **시작하지 못했을 때**(파라미터 해석·enqueue 실패) 워크플로우 owner 에게. 시작된 execution 의 이후 실패는 `execution_failed` 가 커버한다. (c) `team_invite` — 초대 대상 이메일이 **이미 가입자(비멤버)** 일 때 그 사용자에게. `execution_failed`/`schedule_failed` 는 **인앱 + 이메일**(`channel: 'both'`); `team_invite` 는 **인앱**(`channel: 'in_app'`) — 이메일은 이미 발송되는 초대 링크 이메일(수락 토큰 포함)이 담당하고 알림 record 의 이메일 발송을 켜면 토큰 없는 범용 알림 이메일이 중복되기 때문이다(planner 결정 (c), `spec/data-flow/8-notifications.md §Rationale "team_invite 채널 — 이메일 중복 회피"`). `spec/2-navigation/9-user-profile.md §5.1` 은 세 유형의 기본 채널을 인앱+이메일로 규정하며(채널 토글 미구현이라 기본값 고정 발송), 팀 초대의 "이메일"은 초대 링크 이메일로 충족된다(§5.1 각주). 신규 마이그레이션 없음(V070 CHECK 에 세 타입 선재). SoT: `spec/data-flow/8-notifications.md §1.1`.

## Unreleased — 알림 이메일 발송 경로 + email_sent_at 라이프사이클 (알림 파이프라인 PR2)

### 변경 사항

1. **`channel ∈ {email, both}` 알림이 실제 이메일로 발송되고 발송 시각(`email_sent_at`)이 기록된다** — 종전 `MailService` 는 verification/invitation/password-reset 3종만 발송하고 알림 이메일 경로·`email_sent_at` setter 가 없어, `notification.channel` 이 email/both 여도 in-app 적재만 되고 메일은 나가지 않았다(`spec/data-flow/8-notifications.md` §1·§2.2·§3 이 to-be 로 명시). 이제 `MailService.sendNotificationEmail(email, {title,message,type})` 이 **단일 범용 템플릿**(subject=알림 title, 본문=message + `/dashboard` CTA — 전용 알림 페이지가 없어 인증 랜딩의 벨 팝오버로 안내)으로 발송하고, `NotificationsService` 가 `notify()`/`createMany()` 적재 후 `channel∈{email,both}` row 에 대해 User email 을 `In(userIds)` 배치로 조회해 발송한 뒤 성공 시 `email_sent_at` 을 채운다. 전 과정 **완전 best-effort** — SMTP·해석·UPDATE 실패는 warn 로그만 남기고 재시도하지 않으며 적재(source of truth)를 되돌리지 않고, 실패한 row 의 `email_sent_at` 은 NULL 로 남는다(`spec/data-flow/8-notifications.md §3` Rationale). `type` 별 시각 템플릿은 단일 범용 템플릿으로 downscope(type별 내용은 호출자가 설정한 title/message 에 이미 인코딩) — spec 배지 flip·Rationale 정정은 별도 planner 트랙. SoT: `spec/data-flow/8-notifications.md §1/§2.2/§3`.

## Unreleased — Switch switchValue 필수 표시(asterisk) (V-12)

### 변경 사항

1. **Switch 노드 설정의 `switchValue` 가 mode=value 일 때 required asterisk 를 노출** — `spec/4-nodes/1-logic/2-switch.md §8.1` 은 `switchValue` 가 mode=value 시 필수이며 UI 가 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트로 asterisk 를 표시한다고 명시하나, bespoke `SwitchConfig`(override-track)의 `switchValue` `ExpressionInput` 이 asterisk 를 렌더하지 않아 필수 표시가 누락됐다(requiredWhen 은 auto-form 만 소비). `ExpressionInput` 의 기존 `required` prop 에 `mode === "value"` 를 전달해 backend `switch.schema.ts` 의 `requiredWhen: {equals:['value']}` whitelist 를 override-track 에서 재현한다. 순수 시각 표시이며 런타임 검증은 `NodeHandler.validate()` 가 그대로 담당. spec 변경 불요(§8.1 이미 명시). SoT: `spec/4-nodes/1-logic/2-switch.md §8.1`.

## Unreleased — Re-run 모달 원본 ID 링크 + typed 입력 폼 (V-14)

### 변경 사항

1. **Re-run 모달의 입력 폼이 Manual Trigger 스키마 기반 typed 동적 폼으로 전환 + 원본 ID 링크** — 종전 `rerun-modal.tsx` 는 원본 실행 ID 를 plain text 로, 입력 폼을 원본 `inputData.parameters` 키 전부를 텍스트 Input 으로만 렌더해 boolean 을 텍스트로 입력하는 등 타입 부정합 여지가 있었다(`spec/5-system/13-replay-rerun.md §10.2` 은 (a) 원본 ID 클릭 시 새 탭 상세 (b) manual_trigger 노드 config 스키마 기반 typed 폼을 명시). 이제 워크플로 manual_trigger 노드 `config.parameters` 스키마(`{name,type}`)에서 필드를 도출해 **string→text·number→number·boolean→checkbox·object/array→JSON** 위젯으로 렌더하고, 편집값을 타입에 맞게 coerce 해 전송한다(backend `resolveTriggerParameters` 가 native-typed 값 수용). 원본 ID 는 `/workflows/:wid/executions/:id` 새 탭 링크. 스키마 부재(노드 삭제 등) 시 원본 키 text fallback 으로 데이터 은닉을 피한다. spec 변경 불요(§10.2 이미 명시). SoT: `spec/5-system/13-replay-rerun.md §10.2`.

## Unreleased — 트리거 목록에 Schedule cron·다음 실행 시각 표시 (V-10)

### 변경 사항

1. **`GET /api/triggers` 목록이 Schedule 트리거의 cron 식·다음 실행 시각을 포함** — 종전 `TriggersService.findAll()` 은 schedule join 없이 반환해 목록 행에 `[Schedule]` 태그의 Cron·다음 실행 시각이 비어 있었다(enrichment 는 단건 `findOneDetail` 에만 존재). `spec/2-navigation/2-trigger-list.md §2.1` 은 목록 행에 이를 명시(목업 `0 9 * * * Next: 09:00`)하고 프런트(`triggers/page.tsx`)도 이미 렌더를 기대하고 있어, 본문·응답 DTO 주석·FE 3자가 어긋난 상태였다. `findAll` 이 이 페이지의 schedule 트리거 id 를 모아 `scheduleRepository.find({ triggerId In(...) })` **배치 1회**로 `cronExpression`/`timezone`/`nextRunAt` 를 붙인다(행마다 조회하는 N+1 회피, `workflow-list §2.4`·`schedules.findAll` 의 list-level enrichment 선례와 동일). 이 조회가 목록 로드마다 실행되는 hot-path 가 되므로 `schedule (trigger_id)` 인덱스(V106, FK 자동 인덱스 없던 선존 갭)를 함께 추가한다. `TriggerDto` 응답 필드 3개는 이미 존재했고 JSDoc "단건 조회 시에만" → "목록·단건 모두" 로 정정. spec 변경 불요. SoT: `spec/2-navigation/2-trigger-list.md §2.1`.

## Unreleased — 실행 내역 상세 노드 서브탭 통일 (V-05)

### 변경 사항

1. **전용 실행 내역 상세 페이지의 노드 상세가 에디터와 동일한 서브탭 UI 제공** — 종전 실행 내역 상세(`/workflows/:id/executions/:executionId`)의 노드 상세는 Preview/Input/Output/Error 4탭뿐이었고, `spec/2-navigation/14-execution-history.md` EH-DETAIL-03·§3.3/§3.4 가 ✅구현으로 명시한 Config·LLM Usage·메시지 레벨(Response/Request/LLM Usage)·References 탭은 에디터 Run Results 드로어에만 있었다(ConversationInspector 안내문이 없는 탭을 가리키는 dangling 상태). 실행 상세 페이지가 에디터 `ResultDetail` 컴포넌트를 그대로 재사용하도록 통일해 두 surface 가 완전히 동일한 서브탭·완결 대화 인스펙터·live waiting 상호작용을 제공한다. `nodeExecution.outputData`·`inputData`·`startedAt` 가 에디터 run 결과와 동일 shape 라 데이터가 그대로 흐른다. dry-run 배지는 execution-level 플래그를 함께 반영해 비-effect 노드에서도 유지. spec 변경 불요. SoT: `spec/2-navigation/14-execution-history.md §3.3/§3.4`.

## Unreleased — 초대 수락 확인 UI + 기가입자 진입 경로 (§1.5.3, V-09)

### 변경 사항

1. **이미 가입한 사용자의 다른-워크스페이스 초대 흐름이 자동수락 → 수락 확인 UI 로 전환** — `/invitations/accept` 페이지가 마운트 즉시 무조건 `acceptInvitation` 을 호출하던 것을, 토큰 메타(`GET /api/invitations/:token`)를 먼저 조회해 (a) 로그인 이메일 == 토큰 이메일이면 **[수락] 버튼**을, (b) 불일치(또는 미로그인)면 "해당 계정으로 로그인" 안내 + **로그아웃 후 전환** 버튼을 노출하도록 `§1.5.3` 대로 재작성. 사용자의 명시적 클릭 없이는 워크스페이스에 합류하지 않는다. 클라이언트 이메일 일치 검사는 UX 게이팅일 뿐이며 실제 인가는 서버(`POST /api/workspaces/invitations/accept`)가 재검증한다.
2. **초대 메일 링크의 기가입자 진입 경로 보강** — 초대 메일은 `/auth/register?invitationToken=` 로 링크하는데, 이미 로그인한 사용자가 새 탭에서 클릭하면 미가입자용 가입 폼이 떠 혼란스러웠다. register 폼이 `has_session` 힌트 쿠키(`proxy.ts` 와 동일 신호)로 기존 세션을 감지해 `/invitations/accept?token=` 로 즉시 리다이렉트한다. `(auth)` 라우트 그룹엔 세션 하이드레이션(AuthProvider)이 없어 클라이언트 store 대신 쿠키로 판정한다. SoT: `spec/5-system/1-auth.md §1.5.3` + `spec/2-navigation/10-auth-flow.md §2.6`.

## Unreleased — workflow import settings validated DTO (patch 대칭)

### 변경 사항

1. **`POST /api/workflows/import` 의 `settings` 가 검증되는 nested DTO 로 강화** — `ImportWorkflowDto.settings` 를 opaque `@IsObject() Record<string, unknown>` 에서 strict `WorkflowSettingsDto`(`@ValidateNested @Type`)로 전환했다. `UpdateWorkflowDto.settings`(PATCH, PR #805)와 동일 strict 정책으로 같은 `Workflow.settings` jsonb 의 import·patch 검증 강도 비대칭을 해소한다. 전역 `whitelist+forbidNonWhitelisted` pipe 로 **미지 `settings` 키·비양수·비정수 `maxConcurrentExecutions` 는 이제 `400 VALIDATION_ERROR`**. export→import round-trip 은 안전(export 는 post-#805 settings 를 as-is emit, 소비 키는 `maxConcurrentExecutions` 뿐). 노드 `config` permissive 정책(soft, 사용자 hand-edit 복구)과 달리 workflow-level 실행 파라미터는 admission-gate 정합을 위해 hard-fail. SoT: `spec/2-navigation/1-workflow-list.md §3.2` + `spec/1-data-model.md §2.4`.

## Unreleased — orphan pending backstop (§8 recoverStuckExecutions)

### 변경 사항

1. **부팅 backstop 이 orphan `pending` 을 회수** — admission 재큐 job 이 소실(Redis 비영속·eviction)된 `pending` Execution 은 다시 pick up 될 job 이 없어, 큐 대기 5분 timeout(consumer pick-up 시점에만 검사)을 못 받고 영구 잔류하던 갭을 닫는다. `recoverStuckExecutions`(부팅 `onApplicationBootstrap` + test-hook) 이 stale RUNNING 재구동에 더해, `status='pending' AND queued_at < now − EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 인 orphan 을 기존 `markQueueWaitTimeout`(멱등 조건부 UPDATE)으로 §8 wait-timeout `cancelled`(`EXECUTION_QUEUE_WAIT_TIMEOUT`·`cancelledBy='timeout'`)로 마감한다. RUNNING 은 진행 흔적이 있어 re-drive, PENDING 은 없어 cancel. 신규 migration·env·에러코드 없음(기존 `queued_at` V104 컬럼·`markQueueWaitTimeout` 재사용). boot-only best-effort(낮은 확률 엣지). SoT: `spec/5-system/4-execution-engine.md §8/§7.4`.

## Unreleased — workflow 동시 실행 cap validated write DTO (§8, workspace 대칭)

### 변경 사항

1. **`PATCH /api/workflows/:id` 의 `settings` 가 검증되는 nested DTO 로 강화** — 종전 opaque `Record<string, unknown>`(`@IsObject()`) 이던 `settings` 를 `WorkflowSettingsDto`(`maxConcurrentExecutions`: `@IsInt @Min(1)`)로 전환했다. workspace 의 `UpdateWorkspaceSettingsDto`(§8 admission gate) 와 대칭이며, `spec/1-data-model.md §2.4`·`spec/5-system/4-execution-engine.md §8` 이 이미 `Workflow.settings` 를 `maxConcurrentExecutions` 로 스코프한다. 전역 `whitelist+forbidNonWhitelisted` pipe 로 **미지 `settings` 키·비양수·비정수 cap 은 이제 `400`** 을 받는다(종전 무검증 통과 후 런타임 `resolveConcurrencyCap` backstop 이 defaultCap 으로 무시). **스펙 준수 클라이언트에는 영향이 없다** — backend 는 `maxConcurrentExecutions` 외 workflow settings 키를 소비하지 않으며, 프런트 `workflowsApi.update` 유일 호출부는 `{ isActive }` 만 전송한다. 서비스 `update` 는 `settings` 를 전체 교체 대신 spread-merge 해 DB 잔여 키를 보존한다(workspace 대칭). `ImportWorkflowDto.settings` 는 opaque 유지(별도 후속). SoT: `spec/5-system/4-execution-engine.md §8`.

## Unreleased — 인증 webhook 1MB body 게이트 (옵션 C) + 공개 webhook 보호 우회 fix

### 보안 수정 (Security)

1. **공개 webhook 남용 보호가 전량 우회되던 버그 수정** — `PublicWebhookThrottleGuard` 가 트리거를 `findOne({ select: { authConfigId: true } })` 로 조회했는데, 이 partial projection 이 `authConfigId` 를 (`null` 대신) 비-`null` 값으로 잘못 반환해, **모든 공개(`auth_config_id IS NULL`) webhook 이 인증 webhook 으로 오판**되었다. 결과적으로 공개 webhook 의 **32KB body 크기 제한·IP 단위 분당/시간당 rate-limit 이 전혀 적용되지 않았다**(Guard 가 본문 검사 전 early-return). full entity 로드로 교정. 회귀 가드 e2e 추가(`webhook-trigger` L: 공개 64KB → `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`).

### 변경 사항

1. **인증 webhook 본문 1MB 수용 (WH-NF-02 옵션 C)** — `/api/hooks/*` 라우트 스코프 body-parser(`createHooksBodyParsers`, 기본 1MB·`HOOKS_MAX_BODY_BYTES` env)가 인증 webhook 본문을 1MB 까지 수용하고, 초과 시 표준 봉투 `413 PAYLOAD_TOO_LARGE`. 종전 인증 webhook 은 express 기본 100KB 에서 비표준 에러로 끊겼다. 공개 webhook 의 32KB(`PublicWebhookThrottleGuard`)는 그 위에서 유지. 전역 100KB 기본은 non-webhook 라우트에 보존(라우트 스코프 분리). `main.ts` 는 `bodyParser: false` 로 Nest 기본 파서를 끄고 hooks·전역 파서를 직접 등록(Nest 가 수동 파서 감지 시 자기 전역 파서를 skip 해 본문 미파싱되는 함정 회피), rawBody 보존(HMAC 호환). SoT: `spec/5-system/12-webhook.md WH-NF-02`.
2. **`413 → PAYLOAD_TOO_LARGE` 표준 매핑** — `GlobalExceptionFilter` 가 body-parser 등 http-errors 의 413(및 4xx) 을 표준 에러 봉투로 매핑(종전 413 → `INTERNAL_ERROR`/500 오매핑 교정). `api-convention §5.3·§6`·`error-handling §1.3` 에 `PAYLOAD_TOO_LARGE` 등재.

## Unreleased — webhook/manual 400 검증 실패 필드별 사유 `error.details[]` surface

### 변경 사항

1. **webhook/manual-trigger 400 검증 실패 응답이 필드별 사유를 `error.details[]` 로 노출** — required 파라미터 누락·타입 강제 변환 실패 시(`POST /api/hooks/:endpointPath` 의 `INVALID_WEBHOOK_PAYLOAD`, 수동 실행 `POST /api/workflows/:id/execute` 의 `INVALID_TRIGGER_PARAMETERS`), 응답이 공식 에러 봉투의 `error.details[]` 에 `{ field, code, message }` 를 담는다. `code` 는 `UPPER_SNAKE_CASE` field code(`MISSING_REQUIRED_FIELD`·`TYPE_COERCION_FAILED`). 종전에는 필드별 사유가 내부적으로 산출되나 `GlobalExceptionFilter` 가 `errors` 키를 버려(클라이언트는 `{ error: { code, message, requestId } }` 만 수신) **노출되지 않았다** — 본 변경은 누락된 필드 목록을 surface 하는 **additive** 변경이며, 종전 미노출 `errors[]` 를 소비하던 클라이언트는 없다. SoT: `spec/5-system/12-webhook.md §5.2`. 코드 변경은 `hooks.service`·`workflows.controller` 의 throw payload(`errors`→`details`)와 공용 헬퍼 `toTriggerParameterErrorDetails` 한정.

## Unreleased — model-config 부속 엔드포인트 hardening (listModels type 검증)

### 변경 사항

1. **`GET /api/model-configs/:id/models` — `type` 쿼리 런타임 검증** — `type` 파라미터에 `ParseEnumPipe` 를 적용해 허용값(`chat`·`embedding`) 외 값은 이제 `400 Bad Request` 로 거부한다. 종전에는 런타임 검증 없이 서비스 레이어로 전달됐다. Swagger `@ApiQuery` 가 이미 `enum: [chat, embedding]` 을 선언하고 있어 **스펙 준수 클라이언트에는 영향이 없으며**(`@ApiBadRequestResponse` 동반 문서화), 문서 외 값을 보내던 직접 호출 클라이언트만 400 을 받는다. 코드 변경은 컨트롤러 한정(`@Throttle` 상수화·`type` enum 단일 소스 파생 동반).

## Unreleased — 웹채팅 로더 arguments-replay 버그 수정

### 변경 사항

1. **웹채팅 로더 `arguments`-replay 버그 수정** — 스니펫 스텁의 `push(arguments)` 산출물(array-like 객체)이 `Array.isArray` 가드에 걸려 통째로 버려지면서 `boot` 를 포함한 모든 사전 큐 호출이 무증상 누락되던 문제를 해소했다(#709 원인). `Array.isArray` 가드를 `length` 기반 array-like 수용 + `Array.from` 정규화로 교체. 회귀 테스트 추가.

## Unreleased — model-config `:id/test` 인가 강화 (Viewer 차단, Editor+ 강제)

### Breaking changes

1. **`POST /api/model-configs/:id/test` — Viewer 호출 차단(Editor+ 강제)** — 종전 `@Roles` 부재로 워크스페이스 멤버 전원(Viewer 포함)이 호출 가능했으나, 이 엔드포인트는 과금 provider 호출(+embedding 차원 자동저장 PATCH 부수효과)을 일으키는 action-POST 이므로 이제 `@Roles('editor')` 로 게이트한다. Viewer 자격증명의 직접 API 호출은 이제 `403 FORBIDDEN` 을 받는다. UI 상 연결 테스트 버튼은 Editor+ 전용 모델 추가/수정 폼 안에 있어 도달 경로가 없고, 실질은 직접 API 인가 갭 차단이다. `GET /api/model-configs/:id/models`(조회)는 Viewer+ 를 유지한다. 권한 계약 SoT: `spec/2-navigation/6-config.md §3` + Rationale R-7, `spec/5-system/7-llm-client.md §8.3`.

### 변경 사항

소스 변경은 `LlmModelConfigController.testConnection` 에 `@Roles('editor')` + `@ApiForbiddenResponse` 추가뿐이다(behavior change = Viewer 직접 호출 403화). lint·unit·build·e2e 전부 통과.

## Unreleased — npm audit 취약점 해소 의존성 상향

### 변경 사항

1. **보안 취약점 의존성 업그레이드** — `npm audit` 의 모든 high/critical 제거 (backend 63→0 high·crit / frontend 9→0 / channel-web-chat 2→0). 직접 의존성은 상위 패키지를 올리고, 전이 의존성은 부모가 좁게 핀해 forward 가 불가능한 경우 `overrides` 로 안전 버전을 강제했다.

   - **backend**: `nodemailer` ^8.0.4 → ^9.0.1(메이저, raw 옵션 파일읽기/SSRF `<=9.0.0` 해소) · `@nestjs-modules/mailer` ^2.3.4 → ^2.3.7(부모 상향 — 취약 `preview-email`/`mailparser` 를 optional 로 분리) · `@opentelemetry/*` 0.218→0.219·core 2.7→2.8(`@opentelemetry/core` 메모리 누수 해소) · overrides 추가/상향: `ws` ^8.21.0(DoS) · `@grpc/grpc-js` ^1.14.4 · `multer` ^2.2.0(DoS) · `form-data` ^4.0.6(CRLF) · `protobufjs` ^7.5.6→^7.6.3 · `nodemailer` ^9.0.1(중첩 사본 강제).
   - **frontend**: `dompurify` ^3.4.2 → ^3.4.11(XSS) · overrides 추가: `ws` ^8.21.0 · `form-data` ^4.0.6 · `undici` ^7.28.0(TLS 검증 우회) · `vite` ^8.0.16 · `@babel/core` ^7.29.7.
   - **channel-web-chat**: `dompurify` 3.4.7 → 3.4.11(exact pin 유지).

   **잔여(accept)**: `js-yaml`(moderate, merge-key DoS) — gray-matter@4 가 3.x `safeLoad` API 에 묶여 forward 불가하며 빌드타임 신뢰 입력(자체 docs frontmatter)만 파싱하므로 실위험 없음. backend `@babel/core`(low) — 동일하게 빌드타임 신뢰 입력.

   소스 코드 변경 없음. build·unit·e2e 전부 통과.

## Unreleased — EIA submit_form 서버 측 field 검증

### 변경 사항

1. **`submit_form` 서버 측 field 검증 추가** — EIA `POST /external/executions/:id/interact` 의
   `submit_form` 커맨드가 이제 서버 측에서 form node field 정의(필수 여부 / 이메일·숫자 형식 /
   minLength·maxLength / 선택지)를 검증한다 (spec form §4·§6.2 / EIA §5.1).

   **검증 실패 시 응답 shape** (400 Bad Request):
   ```json
   { "error": { "code": "VALIDATION_ERROR", "message": "<검증 메시지>",
                "details": [{ "field": "<필드명>", "message": "<검증 메시지>", "code": "INVALID_FIELD" }] } }
   ```

   - 현재 단계 FIRST 오류만 surface (`details` 배열 길이 항상 1).
   - 검증 실패해도 `execution.status` 는 `waiting_for_input` 유지(재제출 가능).
   - WS ack 경로는 `errorCode='VALIDATION_ERROR'` 로 매핑됨 (`ExecutionError` 계층 자동 처리).

2. **`VALIDATION_ERROR` 에러코드 — `ErrorCode` enum 에 추가** (`codebase/backend/src/nodes/core/error-codes.ts`).
   기존 `MessageTooLongError` 등과 동일한 패턴으로 단일 SoT 로 관리.

## Unreleased — Code 노드 isolated-vm 전환 후속 (base64 TypeError + 메모리 한도 env)

### Breaking changes

1. **`$helpers.base64.encode/decode` — 비문자열 입력이 이제 `error` 포트로 분기**

   이전 동작: 비문자열(예: 숫자, 객체)을 전달하면 `String(data)` 로 암묵적 변환 후 정상 처리.
   신규 동작: 비문자열 입력 시 `TypeError`(`$helpers.base64.encode: data must be a string, got <type>`)
   를 throw → 코드 노드 `error` 포트로 분기.

   **영향받는 워크플로우**: `$helpers.base64.encode(42)` 처럼 비문자열을 명시 전달하던 코드.
   **조치**: 입력값을 `String(...)` 으로 명시 변환 후 전달하거나 `error` 포트 처리 추가.

   배경: `$helpers.crypto.hash` 와의 타입 계약 일관화. 자세한 Rationale 은
   `spec/4-nodes/5-data/2-code.md §Rationale "$helpers 입력 타입 계약"` 참조.

## Unreleased — KB 임베딩 legacy 컬럼 은퇴 + ModelConfig 에러코드 통일 (PR4b)

> **자사 클라이언트 무영향**: 아래 변경의 소비자는 자사 프론트엔드뿐이며, 프론트가 이미 신 에러코드를 처리하고 KB 요청에 `embeddingModelConfigId` 를 전송하도록 대응 완료된 상태에서 적용됐다. 외부 API 소비자가 없으므로 deprecation 윈도우·구코드 이중발행 없이 교체했다.

### Breaking changes

1. **에러코드 rename (ModelConfig 경로)** — 응답 `error.code` 슬롯:
   - `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` (400). 접두어를 `MODEL_CONFIG_*` 로 통일. 의미·status 변경 없음.
   - `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` (400). id 미지정 시 워크스페이스 default config 부재 경로. id 부재(404)는 `MODEL_CONFIG_NOT_FOUND` 로 별도 분리(동일 코드의 404/400 이중 status 모호성 제거). rename 이력은 `spec/conventions/error-codes.md §4`.

2. **KB create/update DTO 에서 `embeddingModel`·`embeddingLlmConfigId` 필드 제거** — `POST`/`PATCH /api/knowledge-bases` 요청 body 에 이 두 필드를 보내도 **무시된다**(silent breaking). 임베딩 모델 선택은 `embeddingModelConfigId`(1급 `kind=embedding` ModelConfig 참조)로만 수행한다.

3. **KB 응답에서 `embeddingLlmConfigId` 제거, `embeddingModel` 은 read-only(derived) 로 변경** — `GET /api/knowledge-bases`, `GET /api/knowledge-bases/:id` 응답 shape 에서 `embeddingLlmConfigId` 필드가 제거됐다. `embeddingModel` 은 더 이상 저장 컬럼이 아니라 참조 ModelConfig 의 `defaultModel` 에서 파생되는 읽기 전용 값이다(워크스페이스에 embedding ModelConfig 가 없으면 빈 문자열). 변경은 `embeddingModelConfigId` 로만 가능하다.

### Migrations

- **V093** (`knowledge_base` 임베딩 repoint): `embedding_model_config_id IS NULL` 인 모든 KB 를 1급 `kind=embedding` ModelConfig 로 repoint(원래 provider·model·dimension 보존). repoint 불가 KB 가 1건이라도 있으면 fail-loud RAISE 로 전체 롤백(V094 미실행).
- **V094** (legacy 컬럼 DROP, **비가역**): `knowledge_base.embedding_llm_config_id`·`embedding_model` 컬럼과 FK 제약 DROP. `AccessExclusiveLock` 획득하므로 low-traffic 윈도우 배포 권장(`lock_timeout=3s`).

## Unreleased — AI 노드 설정 폼 auto-form 전환 (text_classifier · information_extractor)

- **`text_classifier` · `information_extractor` 설정 폼을 schema-driven auto-form 으로 전환** (cross-audit V-02). 기존 bespoke override 폼이 누락하던 필드 — Conversation Context 5필드, System Context 2필드, few-shot `examples`, `outputSchema[].enumValues`, `maxCollectionRetries`, (information_extractor) memory 전략 7필드 — 가 설정 패널에 정상 노출된다. 이전에는 Code 탭 JSON 으로만 설정 가능했다.

  **참고**: `text_classifier` 의 `includeConfidence` 신규 노드 기본값은 zod 스키마 정의(`false`, spec §1)를 따른다 — 구 bespoke 폼이 `true` 로 표시하던 것은 spec 과 어긋난 동작이었고 본 전환으로 교정됐다. 기존 저장된 설정값에는 영향이 없다.

## Unreleased — Health Probe Liveness/Readiness 분리

### Breaking changes

1. **`GET /api/health` — unhealthy 시 HTTP 200 → 503 반환** (이전: 항상 200)

   k8s readinessProbe 가 이 경로를 사용하며, 의존성(DB/Redis) 중 하나 이상이 비정상일 때 503 을 반환한다. 응답 body(`{ status, version, uptime, checks }`)는 200 과 동일하게 유지된다.

   **영향받는 소비자**: 외부 모니터링·알람 시스템이 `/api/health` 응답 코드 200 을 "정상" 기준으로 사용 중이라면 503 도 수용하도록 규칙을 갱신해야 한다.

2. **신규 `GET /api/health/live` 엔드포인트 추가** (liveness probe 전용)

   DB/Redis 를 점검하지 않고 프로세스 생존만 확인해 항상 200 을 반환한다 — `{ status: "ok" }`. k8s livenessProbe 를 이 경로로 변경해 DB 장애 시 Pod 크래시루프를 방지한다.

3. **`HEALTH_CHECK_LOG` 환경변수 추가** (기본 `false`)

   `false`(기본값)이면 `/api/health`, `/api/health/live` 프로브 성공 요청의 로그를 억제한다. 기존 배포에서 이 변수가 미설정인 경우 성공 로그가 묵시적으로 억제된다 — 운영 모니터링 로그 기반 알림 규칙을 확인하라. k8s `ConfigMap/backend-config` 에 `HEALTH_CHECK_LOG: "false"` 가 명시 반영되었다.

## Unreleased — execution-engine: _resumeCheckpoint schemaVersion 견고화 (PR-A2a)

- **execution-engine**: `_resumeCheckpoint` 에 `schemaVersion`(=1) 추가 — 롤링 배포 중 구 인스턴스가 신 포맷 checkpoint 를 pickup 할 경우 graceful `RESUME_INCOMPATIBLE_STATE` 로 종결. 버전 부재(기존 row) = legacy 허용(backward-compatible), 미래 버전(코드 미지원) = 재구성 포기 + 안전 재시작 유도.

## Unreleased — Node Output Contract Unification

Implements the CONVENTIONS rulebook in `spec/conventions/node-output.md` across all 26+ node handlers. Split over staged refactors (Stage 1–7 + follow-ups) all landing in this release.

### Breaking changes

Workflow authors referencing node output in `{{ … }}` expressions need to migrate or run the provided script. A dry-run is non-destructive:

```
npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
  --workspace-id <uuid> --user-id <uuid>
```

1. **`NodeHandlerOutput` contract** — every handler now returns `{ config, output, meta?, port?, status?, _resumeState? }`. Legacy `{ port, data }` and bare-object shapes are no longer produced by core handlers (the engine adapter still accepts bare returns for test doubles).
2. **Information Extractor** — `output.output.extracted.*` double-nesting removed. New path: `output.result.extracted.*`. `output.output.{messages, endReason, turnCount}` → `output.result.{messages, endReason, turnCount}`. `output.output.collectionRetryCount` → `meta.collectionRetryCount`. `output.output._turnDebugHistory` → `meta.turnDebug`.
3. **AI Agent** — single-turn, multi-turn terminal, and condition-triggered outputs unified under `output.result.{response, messages, turnCount, endReason, condition?}`. Tokens and tool-call counts migrated from `output.metadata.*` to top-level `meta.*`. Condition trigger no longer uses the legacy `{ port, data }` envelope.
4. **Text Classifier** — single-label: `output.category` → `output.result.category` (+ `output.result.confidence`). Multi-label: `output.categories` → `output.result.categories`. Tokens stay on `meta.*`.
5. **Presentation nodes (form / carousel / chart / table / template)** — removed the `output.type` discriminator and the literal-config echo fields (`layout`, `chartType`, `columns`, `items` (static), `format`, `title`, `fields`, `submitLabel`). Those literal values are now read via `$node["X"].config.*` (CONVENTIONS §1.1). Template renames `output.content` → `output.rendered`.
6. **Form resume** — `status: 'submitted'` removed; the engine now emits `status: 'resumed'` + `output.interaction.{type:'form_submitted', data, receivedAt}`. Legacy `output.submittedData` is migrated to `output.interaction.data`.
7. **Button-based presentation resume** — `status: 'button_click' | 'button_continue'` collapsed into `status: 'resumed'` with the original value preserved in `output.interaction.type`. Migration script auto-substitutes `status === '<old>'` comparisons but operators should verify the matching `output.interaction.type` branch exists.
8. **Container nodes (loop / foreach / map / parallel)** — the engine no longer overwrites container output with a flat array. It now emits `{ iterations | items | mapped | branches, count }` on the `done` port (CONVENTIONS §9.2). `$node["Loop"].output[0]` style access is no longer valid — use `$node["Loop"].output.iterations[0]`.
9. **Runtime error envelope** — all nodes that can fail at runtime (http_request, database_query, send_email, code, ai_agent, text_classifier, information_extractor, workflow) now route to `port: 'error'` with `output.error: { code, message, details? }`. Pre-flight errors continue to throw as before.
10. **Error code rename** — in the `output.error.code` slot:
    - `QUERY_FAILED` → `DB_QUERY_FAILED`
    - `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` (with the original `IntegrationError` code preserved in `details.integrationCode`)
    - `CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` → `CODE_EXECUTION_FAILED`
    - `EXECUTION_TIMEOUT` (code node only) → `CODE_TIMEOUT`
    - `HTTP_5XX` / `HTTP_4XX` added (non-2xx responses now carry both `output.response` and `output.error`)
    - `SUB_WORKFLOW_FAILED` added
    - New interaction-level codes reserved: `USER_CANCELLED`, `INTERACTION_TIMEOUT`
11. **`workflow` and `send_email` schemas** — added `error` port. Sub-workflow runtime failures are now routed rather than thrown; un-connected `error` ports fall back to the Stop Workflow policy documented in `spec/5-system/3-error-handling.md §3.2`.
12. **`send_email.subject`, `send_email.to`, `send_email.cc`, `send_email.bodyType`** — moved from top-level handler output to `config`.
13. **HTTP request** — `output.statusCode` / `output.duration` / `output.headers` moved from `output` to `meta`. URL-level credentials (`https://user:pass@…`) are stripped in `config.url` AND `output.error.details.url`.
14. **`NodeHandlerOutput.config` echoes raw template** (PRD `ENG-RC-*`, CONVENTIONS Principle 7). Handlers now receive both `context.rawConfig` (pre-evaluation, frozen snapshot of `node.config`) and the evaluated `config` argument. The echoed `config.*` is the **raw** value the workflow author entered (`{{ ... }}` preserved); the evaluation result lives on `output.*`. Workflows that referenced `$node["X"].config.<expression-field>` for the evaluated value must switch to `$node["X"].output.<field>`. The migration script handles common field renames (Send Email subject/body/bodyType, HTTP Request url and similar). Expression-free fields (`mode`, `chartType`, etc.) are unaffected — raw and evaluated coincide.
15. **Send Email — new `output` fields** (additive): `output.subject`, `output.body`, `output.bodyType` (evaluated values that actually went on the wire); `output.bodyTruncated: true` when `output.body` exceeded the 256KB cap (`Buffer.byteLength` UTF-8). The standardized `output.error` envelope still carries the failed body for debugging.
16. **HTTP Request — new `output` fields** (additive): `output.requestBody`, `output.requestBodyType` (evaluated request body that hit the wire, capped at 256KB with `bodyTruncated`); `output.responseHeaders` (sanitized response headers — credential-shaped values redacted with hybrid blacklist + pattern match). Transport errors omit `responseHeaders` (no `Response` available).

### Replay / View Policy (new)

The execution-history UI displays `NodeExecution.outputData` as-is — the engine does **not** re-evaluate stored config or re-trigger external side effects when you open an execution row. This is **View** mode: zero side effects, zero expression evaluation.

**Re-run** (new Execution that re-evaluates the current workflow definition's raw config — re-triggers emails, HTTP calls, DB writes) is **not implemented** in this release. When introduced (future PRD), it will be a distinct user action with explicit safeguards (confirmation, dry-run option, idempotency keys).

**Multi-turn resume** (`POST /executions/:id/continue`) is not replay — it is the same Execution proceeding to its next turn, using the `state.rawConfig` frozen snapshot so workflow edits made during the wait do not affect the in-flight session.

Pre-release `NodeExecution` rows have `outputData.config` in evaluated form (no rawConfig exposure yet) and lack the new `output.{subject, body, requestBody, responseHeaders, bodyTruncated}` fields on Send Email / HTTP Request. These rows are **not backfilled** — they remain as historical records. Live execution behaviour is unaffected (each Execution uses its own `nodeOutputCache`; there is no cross-execution expression reference).

See [Spec 실행 엔진 §6.3](spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy) for the canonical policy.

### Internal / Infrastructure

- Handler-output adapter (`backend/src/modules/execution-engine/handler-output.adapter.ts`) simplified to a strict new-shape pass-through plus a narrow legacy-bare wrapper for tests. The legacy `{ port, data }` branch is removed. In `NODE_ENV==='production'` the adapter throws on any non-canonical return (production handlers are type-checked, so this catches bugs early); test/dev keeps lenient coercion via the exported `wrapBareAsNodeHandlerOutput()` helper.
- Expression resolver always reads from the structured cache; the `{ output: flat }` shim branch is retained only for pre-seeded test fixtures that skip the structured cache.
- `_multiTurnState` → `_resumeState` rename. Engine reads `_resumeState ?? _multiTurnState` to protect in-flight multi-turn sessions across deploys. The dual-read will be retired one release after all handlers emit `_resumeState` (currently: ai_agent, information_extractor).
- Migration script `backend/scripts/migrate-node-output-refs.ts` now runs the entire `--apply` phase inside a single DB transaction, requires `--workspace-id <uuid> --user-id <uuid>` for the audit row, and emits audit-only hits for legacy fields that cannot be safely rewritten (`output.error.nodeId` / `nodeType` / `timestamp` / `originalInput`, `output.type` discriminator).

### Migration steps for workflow authors

1. **Dry-run the migration** to see every change that will be applied to stored workflow expressions:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
   ```
2. **Review audit-only hits** in the dry-run output (marked "manual review needed"). These cannot be auto-rewritten — edit affected nodes in the editor.
3. **Confirm no live multi-turn AI sessions are in flight** (pending `waiting_for_input`). The `_multiTurnState`→`_resumeState` dual-read protects most sessions, but a belt-and-suspenders check before deploy is recommended.
4. **Apply** with the new CLI flags:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
     --workspace-id <uuid> --user-id <uuid>
   ```
5. **Verify** by running representative workflows. The migration is idempotent — re-running is safe.

### Test infrastructure

- **`make e2e-*` 가 매 실행마다 backend 이미지를 자동 rebuild** — `Makefile` 의 `e2e-up` / `e2e-test` / `e2e-test-full` 가 `docker compose ... --build` 를 명시. 누락 시 Docker layer cache 에 박힌 stale 이미지가 재사용되어 새로 추가한 컨트롤러 (예: `BackgroundRunsController`, `ThirdPartyOAuthController`) 가 컨테이너에 반영되지 않고 e2e 가 사일런트 404 로 실패하는 회귀가 발생함 (2026-05-15 background-monitoring 사례). BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 부담은 작음.
