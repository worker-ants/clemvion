# API 계약(API Contract) 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/종료) + 새로고침 히스토리 복원 (`plan/in-progress/webchat-session-controls-history-restore.md`).
> API 계약에 실질적으로 관련된 파일은 백엔드 `interaction.service.ts`(`GET /api/external/executions/:id` 응답 스키마 확장)와,
> 그 응답을 소비하는 위젯 `use-widget.ts`(기존 `POST .../interact` 커맨드 재사용) 뿐이다. 나머지(위젯 UI/스타일/타입,
> spec 문서, consistency-check 산출물)는 API 표면 변경이 아니다.

## 발견사항

- **[INFO]** 응답 스키마 additive 확장 — 하위 호환성 양호
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()`, `conversationThread` 조건부 spread, 대략 181~211행 부근)
  - 상세: `GET /api/external/executions/:id` 의 `context.conversationThread` 는 값이 있을 때만
    `...(conversationThread ? { conversationThread } : {})` 로 추가되는 신규 optional 필드다. 기존 필드
    (`interactionType`/`waitingNodeId`/`buttonConfig`/`nodeOutput`)는 무변경이고, 기존 클라이언트는 신규 키를 무시하면
    되므로 breaking change 가 아니다. `ExecutionStatusDto.context`(Swagger)는 이미 `Record<string, unknown>`
    (`additionalProperties: true`)로 개방형 선언돼 있고, 심지어 기존(이번 diff 로 변경되지 않은) JSDoc 설명이 이미
    "... + conversationThread snapshot" 을 명시하고 있었다 — 즉 이번 변경은 오히려 기존에 Swagger 문서만 약속하고
    구현이 지키지 않던 drift 를 해소하는 방향이다. 위젯 프런트도 `threadToMessages(undefined) → []` 로 필드 부재를
    graceful 처리해, 프런트/백엔드가 독립 배포(CDN 캐시 구버전 위젯 vs 신버전 백엔드, 혹은 반대)되는 조합에서도 안전하다.
  - 제안: 없음(양호, 참고로 기록).

- **[INFO]** `conversationThread` 부재 표현 방식 — 키 생략 vs 형제 필드의 `null` 컨벤션과 비일관
  - 위치: `interaction.service.ts` (`currentNode`/`context`/`result`/`error` 는 `T | null` 로 부재를 `null` 로 표현하는 기존 관례, `conversationThread` 는 부재 시 키 자체를 생략)
  - 상세: 기능적으로는 위젯이 optional chaining(`thread?.turns?.length`)으로 `undefined`/`null` 모두 동일하게
    처리해 실사용 문제는 없다. 다만 향후 SDK 밖에서 REST 를 직접 소비하는 제3자 EIA 클라이언트가 "이 서비스의 다른
    필드처럼 프로퍼티는 항상 존재하고 값이 null" 이라는 관례를 `conversationThread` 에도 기대하면(`=== null` 체크)
    실패할 수 있다(`in` 체크가 필요).
  - 제안: EIA §5.3/§R17 문서에 "부재 시 키 자체 생략(널 값이 아님)" 을 한 줄 명시하거나, 다른 필드처럼
    `conversationThread: null` 로 통일해 관례를 맞추면 제3자 클라이언트 예측 가능성이 높아진다. 필수 조치는 아님.

- **[INFO]** 단일 리소스 조회 응답 payload 크기 — 페이지네이션 미적용은 타당하나 상한 인지 필요
  - 위치: `interaction.service.ts` (`getStatus`), `spec/conventions/conversation-thread.md` (`STORAGE_MAX_TURNS=500`, `MAX_TURN_TEXT_CHARS=4000`)
  - 상세: 이 엔드포인트는 목록이 아닌 단일 리소스 조회라 페이지네이션 대상이 아니다. 다만 이번 변경으로 매
    `getStatus` 호출마다 durable `conversationThread` 전체(최대 500 turns × turn 당 최대 4000자 근사 상한)가 응답
    body 에 실릴 수 있다. 동일 데이터가 이미 SSE `waiting_for_input` 로도 노출되던 것이라 신규 상한 초과 위험은
    아니지만, 새로고침/폴링성 재조회가 잦아지면 REST 응답 크기가 SSE 증분 대비 상대적으로 커진다.
  - 제안: 즉시 조치 불필요(기존 cap 이 이미 존재). 향후 클라이언트가 `getStatus` 를 주기적으로 폴링하는 패턴이
    생긴다면 조건부 조회(ETag 등)를 backlog 로 검토할 여지만 남겨둘 것.

- **[INFO]** 보안 표면 확장은 기존 정책의 연장선 — 신규 인가 이슈 아님
  - 위치: `interaction.service.ts` JSDoc(§5.3 상단), spec `14-external-interaction-api.md` §R17 addendum
  - 상세: `conversationThread` 노출은 이미 SSE `waiting_for_input` 로 공개되던 데이터를 REST 채널에도 노출하는
    것이며, 인가 범위(execution-scoped bearer `iext_*` 토큰)는 변경되지 않았다. "노드 핸들러가 민감 중간결과를
    남기면 안 된다"는 기존 `outputData` 표면 제약이 conversation turn 텍스트까지 명시적으로 확장됐고 JSDoc 에도
    반영됐으나, 코드 레벨 강제(sanitizer)가 아니라 문서적 계약이라는 한계는 기존과 동일하다.
  - 제안: 없음(기존 리스크 수준 유지, 신규 취약점 아님).

- **[INFO]** 요청/커맨드 계약 재사용 — `endConversation` 은 기존 `InteractCommand` 재사용, 신규 엔드포인트/스키마 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`endConversation`, 대략 1669~1696행 부근)
  - 상세: 헤더 "대화 종료" 액션은 기존에 이미 존재하던 `POST .../interact` 커맨드(`end_conversation`/`cancel`)를
    상황별로 선택해 재사용한다. 신규 REST 엔드포인트나 요청 바디 스키마 변경이 없다. `state.pending!.nodeId`
    non-null assertion 은 직전 `graceful` 조건(`!!state.pending?.nodeId`)으로 보장돼 런타임 위험이 낮다. 명령
    실패(410/네트워크)와 무관하게 optimistic 하게 로컬 상태를 `ended` 로 전이하는 설계는 서버 측 실제 execution
    상태와 클라이언트 표시 상태가 일시적으로 괴리될 수 있으나, 이는 spec §3.1 에 이미 명시된 트레이드오프이고
    API 계약 위반은 아니다.
  - 제안: 없음(계약 관점 문제 없음).

## 요약

이번 변경의 API 계약 표면은 `GET /api/external/executions/:id` 응답의 `context` 에 `conversationThread`
(durable 스냅샷, SSE `waiting_for_input` 과 동일 wire shape) 를 조건부로 추가한 것이 핵심이며, 순수 additive
필드로 기존 클라이언트에 breaking 영향이 없다. 오히려 기존 Swagger DTO 설명("... + conversationThread
snapshot")이 이미 약속했던 것을 구현이 뒤늦게 충족시키는 방향이라 문서-구현 drift 를 해소한다. 인증/인가 범위,
URL/경로, 에러 응답, 페이지네이션은 모두 무변경이며, 프런트의 `endConversation` 도 기존 `interact` 커맨드
(`end_conversation`/`cancel`)를 재사용할 뿐 신규 요청 스키마를 도입하지 않는다. 유일하게 참고할 만한 점은
`conversationThread` 부재 표현이 형제 필드들의 `null` 관례 대신 키 생략 방식을 쓴다는 점과, 응답 payload 가
대화 이력만큼 커질 수 있다는 점인데 둘 다 차단 사유는 아니다. 백엔드 단위테스트가 waiting/버튼/스레드-null
3개 시나리오를 커버해 응답 형식 회귀 위험도 낮다.

## 위험도
LOW
