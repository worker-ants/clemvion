# API 계약(API Contract) 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원
> (`plan/in-progress/webchat-session-controls-history-restore.md`). 본 라운드는 직전 코드 리뷰
> (`review/code/2026/07/09/18_44_10/`) 의 WARNING 8건·INFO 다수 반영 후의 fresh 재검토다.
> API 계약에 실질적으로 관련된 파일은 백엔드 `interaction.service.ts`(`GET /api/external/executions/:id`
> 응답 스키마 확장)와 그 응답을 소비하는 위젯 `use-widget.ts`(기존 `POST .../interact` 커맨드 재사용)
> 뿐이다. `panel.tsx`/`widget-state.ts`/`styles.ts`/spec 문서 등 나머지는 API 표면 변경이 아니다.

## 발견사항

- **[INFO]** 응답 스키마 additive 확장 — 하위 호환성 양호, breaking change 아님
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`, `base`
    조립부의 `...(conversationThread ? { conversationThread } : {})`, 약 268~296행)
  - 상세: `GET /api/external/executions/:id` 의 `context.conversationThread` 는 값이 있을 때만 조건부
    스프레드로 추가되는 신규 optional 필드다. 기존 필드(`interactionType`/`waitingNodeId`/`buttonConfig`/
    `nodeOutput`)는 무변경이며, 기존 클라이언트는 신규 키를 무시하면 되므로 breaking change 가 아니다.
    `ExecutionStatusDto.context`(`dto/responses.dto.ts`)는 이미 `Record<string, unknown> | null`
    (`additionalProperties: true`) 로 개방형 선언돼 있고, 그 Swagger 설명도 이미 "... + conversationThread
    snapshot" 을 명시하고 있었다(이번 diff 로 변경되지 않은 pre-existing 문구) — 즉 이번 변경은 기존에
    문서만 약속하고 구현이 지키지 않던 drift 를 해소하는 방향이다. 위젯도 `threadToMessages(undefined) → []`
    로 필드 부재를 graceful 처리해, 프런트/백엔드 독립 배포(CDN 캐시 구버전 위젯 vs 신버전 백엔드, 혹은
    반대) 조합에서도 안전하다.
  - 제안: 없음(양호, 참고로 기록).

- **[INFO]** `conversationThread` 부재 표현 방식(키 생략) — 이번 라운드에서 spec 문서화로 해소됨
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3 콜아웃 + §R17 addendum(신규 문단
    "durable thread 가 없는 경우... `context.conversationThread` 키를 생략한다(형제 필드의 `null` 관례와
    달리 키 부재)")
  - 상세: 직전 라운드(`18_44_10/api_contract.md`)에서 `currentNode`/`context`/`result`/`error` 는
    `T | null` 로 부재를 `null` 표현하는 관례인데 `conversationThread` 만 키 생략 방식이라 컨벤션 불일치
    가능성을 INFO 로 남겼다. 이번 diff 는 그 제안대로 spec §5.3/§R17 에 "키 자체 생략(널 값이 아님)" 을
    명문화해 문서-구현 정합을 맞췄다(`RESOLUTION.md` INFO#13). 구현(`?? undefined` + 조건부 spread)과
    spec 서술이 이제 정확히 일치한다.
  - 제안: 없음(해소 확인).

- **[INFO]** 단일 리소스 조회 응답 payload 크기 — 페이지네이션 미적용은 타당, 상한은 기존 cap 에 의존
  - 위치: `interaction.service.ts` (`getStatus`), `spec/conventions/conversation-thread.md`
    (`STORAGE_MAX_TURNS`/`MAX_TURN_TEXT_CHARS` 상한)
  - 상세: 이 엔드포인트는 목록이 아닌 단일 리소스 조회라 페이지네이션 대상이 아니다. 매 `getStatus`
    호출마다 durable `conversationThread` 전체가 응답 body 에 실릴 수 있으나, 동일 데이터가 이미 SSE
    `waiting_for_input` 로도 노출되던 것이라 신규 상한 초과 위험은 아니다. 즉시 조치 불필요 — 향후 폴링성
    재조회 패턴이 생기면 조건부 조회(ETag) 를 backlog 로 검토할 여지만 남겨둔다(직전 라운드 INFO#14, defer
    확정).
  - 제안: 없음.

- **[INFO]** 요청/커맨드 계약 재사용 — `endConversation` 은 기존 `InteractCommand` 재사용, 신규
  엔드포인트/스키마 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`endConversation`), `eia-types.ts`
    (`InteractCommand` — `end_conversation`/`cancel` variant 는 이번 diff 이전부터 이미 존재)
  - 상세: 헤더 "대화 종료" 액션은 기존 `POST .../interact` 커맨드를 상황별(graceful `end_conversation`
    vs 범용 `cancel`)로 선택해 재사용할 뿐 신규 REST 엔드포인트나 요청 바디 스키마 변경이 없다. 백엔드
    `end_conversation` 은 `nodeId` 를 필수로 검증(`assertNodeId`, pre-existing)하며, 프런트는
    `!!state.pending?.nodeId` 가드 후에만 graceful 커맨드를 구성해 요청 검증 계약이 정확히 맞물린다.
    `cancel` 은 `nodeId` 불필요 — 비-graceful 분기도 `nodeId` 를 싣지 않아 일치. 이번 라운드에서
    `resetSessionRefs()` 추출·순서 재배치(SSE 선차단) 는 프런트 부작용 정리이며 요청/응답 스키마에는
    영향이 없다.
  - 제안: 없음(계약 관점 문제 없음).

- **[INFO]** 인증/인가 범위 — 신규 이슈 없음, 기존 execution-scoped 토큰 신뢰 경계 유지
  - 위치: `interaction.service.ts` `getStatus()`(execution 조회는 변경 전과 동일하게 `InteractionGuard`
    가 검증한 `ctx.executionId` 로만 스코프), `use-widget.ts` `endConversation`(`session.token` 재사용,
    신규 토큰 발급/스코프 변경 없음)
  - 상세: `conversationThread` 신규 노출은 이미 같은 `iext_*` 토큰으로 SSE 를 통해 공개되던 데이터를 REST
    채널에도 노출하는 것이며, 인가 범위 자체는 변경되지 않았다. 교차 테넌트/교차 세션 노출 경로 없음.
  - 제안: 없음.

## 요약

이번 변경의 API 계약 표면은 `GET /api/external/executions/:id` 응답의 `context` 에 `conversationThread`
(durable 스냅샷, SSE `waiting_for_input` 과 동일 wire shape)를 조건부 필드로 추가한 것이 핵심이며, 순수
additive 확장으로 기존 클라이언트에 breaking 영향이 없다. 오히려 기존 Swagger DTO 설명이 이미 약속했던
것을 구현이 뒤늦게 충족시키는 방향이라 문서-구현 drift 를 해소한다. 직전 라운드에서 지적된 유일한 API
계약 관련 INFO(`conversationThread` 부재 시 키 생략 vs 형제 필드 `null` 관례 불일치)는 이번 diff 에서
spec §5.3/§R17 문서화로 해소됐다. 인증/인가 범위, URL/경로, 에러 응답, 페이지네이션은 모두 무변경이며,
프런트 `endConversation` 도 기존 `interact` 커맨드(`end_conversation`/`cancel`)를 재사용할 뿐 신규 요청
스키마를 도입하지 않는다. 백엔드 단위테스트가 waiting/버튼/스레드-null/COMPLETED 4개 시나리오를 커버해
응답 형식 회귀 위험도 낮다. CRITICAL/WARNING 급 API 계약 이슈는 발견되지 않았다.

## 위험도
LOW
