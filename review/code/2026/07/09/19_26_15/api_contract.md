# API 계약(API Contract) 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원
> (`plan/complete/webchat-session-controls-history-restore.md`).
> API 표면에 실질적으로 관련된 변경은 백엔드 `interaction.service.ts`(`GET /api/external/executions/:id`
> 응답의 `context.conversationThread` additive 확장) 하나뿐이다. 프런트 `use-widget.ts` 의
> `endConversation()` 은 기존 `POST .../interact` 커맨드(`end_conversation`/`cancel`, `InteractCommand`
> enum·DTO 무변경 확인)를 재사용할 뿐 신규 요청 스키마를 도입하지 않는다. 컨트롤러(`interaction.controller.ts`)·
> 인증 가드·라우팅은 이번 diff 에 포함되지 않아 무변경이다. 나머지(위젯 UI/스타일/타입, spec 문서, 이전 리뷰
> 산출물)는 API 표면 변경이 아니다.

## 발견사항

- **[INFO]** 응답 스키마 additive 확장 — 하위 호환성 양호, breaking change 아님
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`, 대략
    221~260행 — `const conversationThread = execution.conversationThread ?? undefined;` 와 `base` 객체의
    `...(conversationThread ? { conversationThread } : {})`)
  - 상세: `GET /api/external/executions/:id` 의 `context.conversationThread` 는 값이 있을 때만 조건부
    spread 로 추가되는 신규 optional 필드다. 기존 필드(`interactionType`/`waitingNodeId`/`buttonConfig`/
    `nodeOutput`)는 무변경이고, 기존 클라이언트는 신규 키를 몰라도 무시하면 되므로 breaking change 가
    아니다. `ExecutionStatusDto.context`(`dto/responses.dto.ts:102`)는 이미 `Record<string, unknown> | null`
    로 개방형 선언돼 있고, 해당 Swagger 설명(`dto/responses.dto.ts:98`)이 이번 diff 이전부터 이미
    "... + conversationThread snapshot" 을 명시하고 있었다 — 즉 이번 변경은 Swagger 문서가 이미 약속하고
    구현이 뒤늦게 지키던 drift 를 해소하는 방향이며, 컨트롤러/DTO 시그니처 변경이 전혀 없다. 위젯 프런트도
    `threadToMessages(undefined) → []` 로 필드 부재를 graceful 처리해, 프런트/백엔드가 독립 배포되는
    조합(구버전 위젯 + 신버전 백엔드, 또는 그 반대)에서도 안전하다.
  - 제안: 없음(양호, 참고 기록).

- **[INFO]** `conversationThread` 부재 표현 방식 — 키 생략, 형제 필드(`null`) 관례와 비일관하나 spec 에 명문화됨
  - 위치: `interaction.service.ts`(부재 시 키 자체를 생략), `spec/5-system/14-external-interaction-api.md`
    §5.3(`context.conversationThread` 부재 시 "키를 생략" 명시) / §R17 addendum
  - 상세: `currentNode`/`context`/`result`/`error` 는 `T | null` 로 부재를 `null` 로 표현하는 기존 관례인
    반면, `conversationThread` 는 부재 시 키 자체를 생략한다(SSE wire 도 동일한 present-when-available
    방식이라 일관은 맞춤). 위젯은 optional chaining 으로 두 표현을 동일 처리해 실사용 문제는 없다. 다만
    REST 를 직접 소비하는 제3자 클라이언트가 "다른 필드처럼 프로퍼티가 항상 존재하고 값이 null" 이라는
    관례를 기대하면(`=== null` 체크) 실패할 수 있다(`in` 체크 필요). 이번 diff 에서 spec §5.3 에 이미
    "키를 생략(널 값이 아님)" 이 명문화돼 있어 문서-구현 정합은 확보됨.
  - 제안: 필수 조치 아님. 향후 공개 SDK/제3자 문서화 시 이 비대칭을 한 줄 더 강조하면 좋음.

- **[INFO]** 단일 리소스 조회 응답 payload 크기 — 페이지네이션 미적용은 타당, 상한은 기존 turn cap 에 의존
  - 위치: `interaction.service.ts`(`getStatus`), `spec/conventions/conversation-thread.md`
    (`STORAGE_MAX_TURNS`/`MAX_TURN_TEXT_CHARS` 상한)
  - 상세: 이 엔드포인트는 단일 리소스 조회라 페이지네이션 대상이 아니다. 이번 변경으로 매 `getStatus`
    호출마다 durable `conversationThread` 전체가 응답 body 에 실릴 수 있으나, 동일 데이터가 이미 SSE
    `waiting_for_input` 로도 노출되던 것이고 기존 turn 상한이 그대로 유효해 신규 위험은 아니다.
  - 제안: 즉시 조치 불필요. 향후 폴링성 재조회 패턴이 생기면 조건부 조회(ETag 등) backlog 검토 여지만
    남겨둘 것(RESOLUTION 에도 backlog 로 이미 기록됨).

- **[INFO]** 인증/인가 범위 무변경 — 기존 execution-scoped bearer 토큰 그대로
  - 위치: `interaction.service.ts` JSDoc(§5.3 상단), 컨트롤러(`interaction.controller.ts`)는 이번 diff 에
    포함되지 않음
  - 상세: `conversationThread` 노출은 이미 SSE `waiting_for_input` 로 공개되던 데이터를 REST 채널에도
    동일 인가 범위(execution-scoped `iext_*` 토큰) 안에서 노출하는 것뿐이며, 엔드포인트·가드·토큰 검증
    로직 변경이 없다. "노드 핸들러가 민감 중간결과를 남기면 안 된다"는 기존 `outputData` 표면 제약이
    conversation turn 텍스트까지 명시적으로 확장됐으나, 이는 문서적 계약(컨벤션)이지 코드 레벨 강제가
    아니라는 한계는 기존과 동일하며 이번 변경이 새로 만든 문제가 아니다.
  - 제안: 없음(기존 리스크 수준 유지).

- **[INFO]** 요청/커맨드 계약 재사용 확인 — `endConversation` 은 신규 엔드포인트/스키마 도입 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`endConversation`, 약 399~426행),
    `codebase/backend/src/modules/external-interaction/dto/interact.dto.ts`(`INTERACT_COMMANDS`,
    `end_conversation`/`cancel` 기존 값 — 이번 diff 로 미변경 확인)
  - 상세: 헤더 "대화 종료" 액션은 기존 `POST .../interact` 커맨드(`end_conversation`/`cancel`)를 상황별로
    선택해 재사용한다. `InteractCommand` enum·요청 DTO 는 이번 diff 에서 손대지 않았다. `state.pending!.nodeId`
    non-null assertion 은 직전 `graceful` 조건(`!!state.pending?.nodeId`)으로 보장되어 계약 위반이 아니다.
    명령 실패(410/네트워크)와 무관하게 optimistic 하게 로컬 상태를 `ended` 로 전이하는 설계는 서버 실제
    상태와 클라이언트 표시 상태가 일시적으로 괴리될 수 있으나, spec §3.1 에 "명령 실패/거부해도 로컬은
    이미 종료 상태를 유지 — 사용자 의도(종료) 우선" 으로 명시된 트레이드오프이며 계약 위반은 아니다.
  - 제안: 없음(계약 관점 문제 없음).

- **[INFO]** 에러 응답 형식 무변경 확인
  - 위치: `interaction.service.ts`(`getStatus`), spec §5.3/R17
  - 상세: 이번 변경은 성공 응답(`200`)의 `context` 필드 확장에 한정된다. `404 EXECUTION_NOT_FOUND`/
    `410 Gone`(interact 전용)/`409 STATE_MISMATCH` 등 기존 에러 형식·상태 코드 체계는 diff 대상이 아니다.
    unit 테스트(`interaction.service.spec.ts`)도 waiting(ai_conversation/buttons)·COMPLETED(context null 회귀
    가드)·durable thread null(키 미동봉) 4개 시나리오로 응답 형식 회귀를 커버한다.
  - 제안: 없음.

## 요약

이번 변경의 API 계약 표면은 `GET /api/external/executions/:id` 응답의 `context` 에 `conversationThread`
(durable 스냅샷, SSE `waiting_for_input` 과 동일 wire shape)를 조건부(값이 있을 때만) 추가한 것이 전부이며,
순수 additive optional 필드로 기존 클라이언트에 breaking 영향이 없다. 오히려 기존 Swagger DTO 설명이 이미
약속했던 것을 구현이 뒤늦게 충족시켜 문서-구현 drift 를 해소하는 방향이다. 컨트롤러 시그니처·URL·HTTP 상태
코드·에러 응답 형식·인증/인가 범위·페이지네이션은 모두 무변경이며, 프런트의 `endConversation` 도 기존
`interact` 커맨드(`end_conversation`/`cancel`, DTO enum 무변경 확인)를 재사용할 뿐 신규 요청 스키마를 도입하지
않는다. 유일하게 참고할 점은 `conversationThread` 부재 표현이 형제 필드의 `null` 관례 대신 키 생략 방식을
쓴다는 것과 응답 payload 가 대화 이력만큼 커질 수 있다는 것인데, 둘 다 spec 에 이미 명문화돼 있고 차단
사유가 아니다. 백엔드 unit 테스트가 waiting/버튼/COMPLETED-null/durable-thread-null 4개 시나리오로 응답
형식 회귀를 커버해 신뢰도가 높다.

## 위험도
LOW
