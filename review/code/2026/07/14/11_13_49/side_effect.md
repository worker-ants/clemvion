# 부작용(Side Effect) Review

## 리뷰 범위에 대한 전제

`_prompts/side_effect.md` payload 에는 **spec 문서 3건의 diff 만** 포함되어 있다 (`spec/5-system/15-chat-channel.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`). 지시받은 점검 대상인 **F-4 리팩터의 실제 코드**(`sendBestEffortNotice` 로그 포맷, `maybeNotifyIgnored` 의 `conversationKey` 변경) 는 payload 전체를 grep 해도 `F-4`, `sendBestEffortNotice`, `maybeNotifyIgnored` 어떤 토큰도 등장하지 않는다 — 즉 이 payload 만으로는 F-4 항목을 검증할 수 없다. 아래 F-4 관련 발견은 "코드 부재로 인한 검증 불가" 자체를 CRITICAL 로 보고하며, F-6(WS nodeId 검증)·F-5(telegram markdown 등록시점 검증)는 payload 에 실린 spec 서술을 근거로 부작용을 분석했다 (실제 구현 `.ts` diff 는 미제공이므로 spec 서술과 구현 간 괴리 여부는 별도 코드 리뷰가 필요).

## 발견사항

- **[CRITICAL]** F-4(`sendBestEffortNotice`/`maybeNotifyIgnored`) 리팩터 코드가 payload 에 없어 동작 보존 여부 검증 불가
  - 위치: payload 전체 (`_prompts/side_effect.md`) — 해당 함수/변경 토큰 0건
  - 상세: 오케스트레이터 지시는 "F-4 리팩터의 동작 보존(`sendBestEffortNotice` 로그 포맷·`maybeNotifyIgnored` `conversationKey` 변경)" 점검을 명시했으나, 실제로 전달된 payload 는 spec 문서 3건(`15-chat-channel.md`/`4-execution-engine.md`/`6-websocket-protocol.md`)의 diff 뿐이고 `codebase/backend/.../hooks.service.ts` 등 실제 코드 diff 는 포함되지 않는다. 로그 포맷 문자열이 리팩터 전후로 동일한지, `maybeNotifyIgnored` 가 조회/로깅에 쓰는 `conversationKey` 소스가 바뀌어 채널 매핑을 오염시키지 않는지는 코드 없이는 확인 불가능하다.
  - 제안: 오케스트레이터에게 F-4 대상 코드 파일(`hooks.service.ts` 등)의 실제 diff 를 별도 payload 로 재전달 요청. 이 리뷰 산출물은 F-4 에 대해 "미검증(NOT REVIEWED)" 으로 명시하고, 별도 side-effect pass 를 이 부분만 재실행해야 한다.

- **[WARNING]** F-6: WS continuation `nodeId` 사후검증이 기존 정상 흐름에 새 거부 경로를 추가 — core editor multi-turn 영향
  - 위치: `spec/5-system/4-execution-engine.md` 표 (§7.5.1 인접, diff L613-618), `spec/5-system/6-websocket-protocol.md` §4.2/ack 표 (diff L1156-1166, L1174-1175)
  - 상세: 종전엔 `execution.submit_message`/`execution.end_conversation` 명령 body 에 frontend 가 이미 `nodeId` 를 싣고 있었지만 서버는 "설계상 미적용"으로 이를 완전히 무시했다(구 표현: "WS 프로토콜은 설계상 nodeId 를 서버에 전달·사용하지 않는다"). F-6 은 동일 필드를 **적극적으로 대조**해 불일치 시 `INVALID_EXECUTION_STATE` 로 거부하는 새 실패 경로를 만든다. 이는 frontend 코드 변경 없이도(이미 nodeId 를 보내고 있었으므로) 서버 쪽 검증 활성화만으로 기존에 성공하던 요청이 새로 실패할 수 있는 **행동 변경(behavior change)** 이다. 특히 core editor 의 AI Agent Multi Turn 은:
    - `retry_last_turn` 재진입이 **동일 nodeId 의 새 NodeExecution row 를 spawn** 하고(§1.2 비고), 기존 row 는 전이시키지 않는다. 클라이언트가 재시도 전 캐싱한 nodeId 자체는 동일하므로 값 자체는 문제없어 보이나, "대기 노드" lookup 이 row-level 이 아니라 nodeId 로 대조되는지, retry 직후의 race window(재진입 seg 시작 직전)에 정상적으로 waiting 상태가 확립되기 전 명령이 도착하는 경우를 어떻게 처리하는지는 spec 서술만으로 불명확.
    - 중첩 `executeInline`(`resume_call_stack`, frame-by-frame rehydration) 시나리오에서 프론트가 들고 있는 "대기 노드 nodeId" 가 최상위 execution 관점과 중첩 프레임 관점 중 어느 쪽인지, F-6 검증이 이 케이스에서 오탐(false reject)을 일으키지 않는지 spec 에 명시가 없다.
    - 다중 탭/재연결 등으로 클라이언트가 stale nodeId 를 들고 있는 상태에서 서버 waiting 노드가 이미 바뀐 경우, 종전엔 (nodeId 무시) 성공했을 요청이 이제 `INVALID_EXECUTION_STATE` 로 실패한다 — UX 회귀 가능성.
  - 제안: (1) F-6 코드 diff(`websocket.gateway.ts`, publisher `executeNode`/§7.5.1 사전검증부)를 별도로 리뷰해 retry-reentry·nested call-stack·stale-tab 케이스의 회귀 테스트 존재 여부 확인. (2) 필요 시 unmatched nodeId 를 hard-reject 대신 warn-log + fallback lookup 으로 완화하는 옵션 검토. (3) 최소한 관련 e2e/multi-turn 회귀 스위트가 이번 PR 에 포함됐는지 확인.

- **[WARNING]** F-5: telegram control-plane 키 등록시점 검증이 기존 저장된 트리거 설정에 소급 영향 가능
  - 위치: `spec/5-system/15-chat-channel.md` diff L35, §4.1.1 (L307)
  - 상세: `LanguageHintsRawSendValidator` 가 `provider === 'telegram'` 일 때 `help`/`groupChatRefusal`/`unsupportedMessageKind`/`executionStillRunning`/`surfaceMismatch`/`formValidationFailed`/`formNextField` 7개 키의 override 에 unescaped MarkdownV2 특수문자가 있으면 **등록 시점**(트리거 생성/설정 갱신)에 `400 VALIDATION_ERROR` 로 거부하도록 신설됐다. 이는 기존에 아무 검증 없이 저장 가능했던 필드에 새 제약을 추가하는 것으로, 이미 unescaped 특수문자를 포함해 저장된 기존 트리거가 향후 **어떤 필드든** PATCH 하려 할 때(예: `isActive` 토글만 원해도 DTO 전체 재검증이 걸리는 구조라면) 기존엔 문제없던 요청이 새로 거부될 위험이 있다. spec 은 "등록 시점 검증"이라고만 하고 partial-update(PATCH) 시 전체 config 재검증 여부·기존 오염 데이터 마이그레이션/backfill 계획을 언급하지 않는다.
  - 제안: 코드 리뷰 시 DTO 검증이 PATCH 의 changed-field 에만 적용되는지, 아니면 전체 `chatChannel` 객체 재검증인지 확인. 후자라면 기존 저장 데이터에 대한 1회성 backfill/경고 마이그레이션이 필요.

- **[INFO]** F-6: `execution.click_button` payload 확장은 additive/backward-compatible
  - 위치: `spec/5-system/6-websocket-protocol.md` diff L1156-1157, L1389
  - 상세: `{ executionId, buttonId }` → `{ executionId, nodeId?, buttonId }` 로 optional 필드만 추가됐고, 현재 frontend 는 이 필드를 보내지 않아 "실질 no-op" 이라고 spec 이 명시한다. 인터페이스 관점에서 하위호환 확장이라 위험도 낮음. 다만 향후 frontend 가 이 필드를 채우기 시작하면 F-6 검증 경로가 활성화되므로, 위 WARNING 항목과 동일한 리스크가 뒤늦게 발현될 수 있음을 인지해 둘 것.

- **[INFO]** F-6: 내부 publisher 호출 체인에 `expectedNodeId` 매개변수가 추가되는 signature 확장
  - 위치: `spec/5-system/4-execution-engine.md` diff L614 ("WS gateway 4개 handler 가 `data.nodeId` 를 `expectedNodeId` 로 forward")
  - 상세: 이 publisher(§7.5.1 "publisher 측 사전 검증")는 외부 EIA REST `/interact`, chat-channel in-process caller, WS gateway 가 공유하는 진입점으로 보인다. spec 은 chat-channel 의 `scope: 'in_process_trusted'` 면제가 "진입점 판정이 아니라 scope 단위"라고 명시해 이번 WS 쪽 nodeId 강제 추가가 chat-channel 경로에 실수로 전파되지 않도록 설계 의도를 밝히고 있다. 다만 이는 spec 서술이며, 실제 publisher 함수 시그니처 변경(신규 파라미터 추가/기본값 처리)이 기존 3개 호출자(REST/chat-channel/WS) 전부에서 올바르게 컴파일·동작하는지는 코드 diff 로 확인이 필요하다 — 특히 REST `/interact` 경로가 `expectedNodeId` 를 무조건 채우도록 강제되어 버그로 항상 검증이 켜지는 회귀가 없는지 확인 권장.

## 요약

이번 payload 는 spec 문서 변경만 담고 있어, 지시된 F-4(`sendBestEffortNotice`/`maybeNotifyIgnored`) 코드 동작 보존은 검증할 수 없었다(코드 부재 — CRITICAL 로 별도 보고). F-5(telegram markdown 등록시점 검증)와 F-6(WS `nodeId` 사후검증)은 spec 서술을 근거로 분석한 결과, 둘 다 **기존에 아무 제약 없이 통과하던 입력·명령을 새로 거부할 수 있는 side-effect** 를 도입한다 — F-5 는 기존 저장된 트리거 config PATCH 시 소급 검증 위험, F-6 은 core editor AI Agent Multi Turn 의 `submit_message`/`end_conversation` 명령에서 이미 전송 중이던(그러나 무시되던) `nodeId` 가 갑자기 유효성 검사 대상이 되어 retry-reentry·중첩 call-stack·stale-tab 시나리오에서 새로운 실패 경로를 만들 가능성이 있다. 두 항목 모두 실제 구현 diff 없이는 확정 판단이 어려우므로, F-4/F-5/F-6 코드(`hooks.service.ts`, `chat-channel-config.dto.ts`, `websocket.gateway.ts`, publisher 사전검증부)에 대한 후속 code-level side-effect 리뷰가 필요하다.

## 위험도

MEDIUM (payload 범위 내에서는 spec 서술 기반 잠재 회귀 2건(F-5/F-6) 발견 + 핵심 검토대상 F-4 코드 부재로 인한 커버리지 갭 — 실제 코드 확보 후 재평가 필요)
