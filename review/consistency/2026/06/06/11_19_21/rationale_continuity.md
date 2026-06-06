# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
실제 변경 파일: spec/5-system/7-llm-client.md, spec/5-system/8-embedding-pipeline.md, spec/5-system/17-agent-memory.md, spec/5-system/14-external-interaction-api.md, spec/2-navigation/5-knowledge-base.md, spec/7-channel-web-chat/3-auth-session.md, spec/7-channel-web-chat/0-architecture.md

---

## 발견사항

- **[CRITICAL]** `{ data }` 봉투 언랩 Rationale 제거 + 구현 역행
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` — `## Rationale` 에서 `### R5. REST 응답 { data } 봉투 언랩 + 폴백` 전체 삭제. `codebase/channel-web-chat/src/lib/eia-client.ts` 에서 `unwrapEnvelope` 함수 및 호출부 제거.
  - 과거 결정 출처: `spec/7-channel-web-chat/3-auth-session.md ## Rationale ### R5` (origin/main) — "백엔드 전 REST 성공 응답은 전역 `TransformInterceptor` 가 `{ data }` 로 래핑한다(webhook §3.1 SoT, 본 영역이 바꿀 수 없는 횡단 규약). 따라서 위젯 `eia-client` 는 webhook 시작·상태 조회·토큰 갱신 응답에서 `res.data` 를 언랩해 읽는다"
  - 상세: R5 는 `TransformInterceptor` 가 모든 REST 응답을 `{ data: ... }` 로 래핑한다는 시스템 invariant(횡단 규약)를 명시하고, 위젯이 언랩해야 하는 이유를 설명하고 있었다. 본 변경에서 (1) R5 Rationale 전체 삭제, (2) `unwrapEnvelope` 헬퍼 및 호출부 제거, (3) `startConversation` / `getStatus` / `refreshToken` 이 `(await res.json()) as T`로 직접 캐스팅(언랩 없음)으로 교체, (4) 테스트 fixture 를 봉투 없는 형태로 변경. 그러나 `codebase/backend/src/common/interceptors/transform.interceptor.ts` 는 변경되지 않아 백엔드는 여전히 `{ data: { executionId, interaction } }` 를 반환한다. 즉 실운영에서 위젯은 `res.interaction` 를 읽어야 하는데 `res.data.interaction` 을 언랩 없이 읽게 되어 SSE 가 열리지 않는 회귀가 재발한다. 이전에 이 동일 버그를 수정한 이력(`plan/complete/fix-webchat-envelope-unwrap.md`)이 있고 R5 는 그 수정의 Rationale 이었는데, 새 Rationale 없이 R5 가 삭제되고 동일 패턴이 다시 제거됐다.
  - 제안: (a) `TransformInterceptor` 가 실제로 응답을 래핑하지 않는 경로(예: hooks controller 가 바이패스)로 변경됐다면 그 결정을 새 Rationale 로 기술하고 spec/5-system/12-webhook.md §3.1 및 spec/5-system/2-api-convention.md §5 의 봉투 정책도 함께 갱신해야 한다. (b) TransformInterceptor 가 그대로라면 `unwrapEnvelope` 제거는 명백한 회귀이므로 복구해야 한다. 어느 쪽이든 R5 의 내용("바꿀 수 없는 횡단 규약")을 뒤집는 결정이므로 새 Rationale 이 선행되어야 한다.

- **[WARNING]** SSE wire 필드명 매핑 Rationale 제거 + 타입 형태 번복
  - target 위치: `spec/7-channel-web-chat/0-architecture.md` §3 표 아래 SSE wire 필드명 주의사항 단락 삭제. `codebase/channel-web-chat/src/lib/eia-events.ts` 전체 파일 삭제. `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `WaitingForInputEvent` / `AiMessageEvent` 인터페이스가 WS wire 형태(`waitingNodeId`, `interactionType` top-level, `nodeOutput`, `buttonConfig`, `message`)에서 EIA notification 형태(`node.id`, `context.conversationConfig`, `text`)로 교체.
  - 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md` §3 (origin/main) — "SSE wire 필드명 (notification §6.2 추상 표기와 다름): SSE 스트림은 내부 fanout envelope 를 그대로 전송한다(프론트엔드 WS store 와 동일 SoT). 따라서 … `waitingNodeId`(= submit_message 의 nodeId 로 그대로 사용)·top-level `interactionType`·`nodeOutput.conversationConfig`…·top-level `conversationThread`로 도착하고, ai_message 의 어시스턴트 텍스트 필드는 `message`(not `text`)다. 위젯 파서 SoT: eia-events.ts"
  - 상세: 이전 스펙은 SSE 스트림이 WS fanout envelope 를 그대로 전송해 EIA §6.2 notification 형태와 다르다는 점을 invariant 로 기록했고, eia-events.ts 의 `parseWaitingForInput`/`parseAiMessage` 는 그 wire-to-domain 매핑의 SoT 였다. 본 변경은 WaitingForInputEvent 를 `node.interactionType`, `context.conversationConfig` 형태로 교체해 실질적으로 wire 형태가 바뀌었다고 주장한다. 그러나 백엔드 SSE 어댑터(`codebase/backend/src/modules/external-interaction/`)의 변경이 diff 에 포함되지 않아 실제 wire 가 바뀌었는지 확인되지 않으며, 이전 Rationale("wire 와 drift")에서 "별도 backlog"로 처리한다고 명시했으나 해결 여부가 기록되지 않고 삭제됐다. wire 가 바뀌지 않은 채 타입만 바뀐다면 런타임 오류가 발생한다.
  - 제안: 백엔드 SSE 어댑터가 실제로 `node.id` / `context.*` 형태로 변경됐다면 그 변경과 함께 spec/5-system/14-external-interaction-api.md §6.2 / spec/5-system/6-websocket-protocol.md §4.4 의 wire 표기도 동기화하고 Rationale 을 기술해야 한다. 변경되지 않았다면 이전 wire 형태(`waitingNodeId`, `message` 필드)를 유지해야 한다.

- **[WARNING]** `spec/5-system/14-external-interaction-api.md` — 전송 봉투 설명 삭제
  - target 위치: §4.1 확장 응답 설명에서 "아래는 논리 payload = 전송 시 data 객체의 내용물" 주석 + 전송 봉투 NOTE(`TransformInterceptor` 가 `{ data }` 로 래핑한다는 설명) 삭제. §5 인바운드 API 공통 봉투 NOTE 삭제. §6.2 SSE wire 필드 주의사항 NOTE 삭제. §6.5 `ai_message` SSE wire 필드(`message` not `text`) 주의사항 NOTE 삭제.
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` 본문 (origin/main) — "전송 봉투 (전 REST 엔드포인트 공통): 아래 §5.1~§5.5 의 성공 응답 JSON 블록은 논리 payload(= data 객체의 내용물)다. 실제 wire format 은 전역 TransformInterceptor 가 { data: ... } 로 래핑한다".
  - 상세: 본문에서 봉투 언급이 삭제됐으나 Rationale 섹션(R1~R5)은 그대로다. 삭제된 본문 설명이 "이미 해소된 오류 회귀를 방지하는 invariant 문서화"로서 R5(auth-session)와 함께 작동했는데, 그 근거(R5)가 auth-session spec 에서 삭제됐고 본문에서도 삭제됐다. TransformInterceptor 가 변경되지 않은 상태에서 본문의 봉투 설명만 삭제하면 EIA spec 이 실제 wire format 과 불일치해 외부 클라이언트 구현 오류를 유발한다.
  - 제안: TransformInterceptor 봉투가 여전히 적용된다면 삭제된 봉투 설명을 복구해야 한다. 봉투가 제거된다면 그 결정의 Rationale 을 spec/5-system/2-api-convention.md 및 spec/5-system/12-webhook.md 에 기록하고 모든 연관 spec 에서 일관되게 갱신해야 한다.

- **[WARNING]** `spec/5-system/7-llm-client.md` §8.3 — `LlmService.embed` 시그니처 신설 시 Rationale 부재
  - target 위치: `spec/5-system/7-llm-client.md` §8.3 서비스 레이어에 `embed(config, texts, model?, opts?, inputType?)` 시그니처 신설.
  - 과거 결정 출처: `spec/5-system/7-llm-client.md` §3.3 (origin/main) — "임베딩은 파라미터/응답 객체를 쓰지 않고 평탄한 시그니처를 사용한다".
  - 상세: origin/main 의 §8.3 은 `LlmService.embed` 를 "기존 유지"로만 처리해 별도 시그니처를 선언하지 않았다. HEAD 에서는 `opts?: Pick<LlmCallOptions, 'timeoutMs'|'disableInnerRetry'>` 가 추가된 풀 시그니처가 등장했다. `inputType?` 추가에 대한 결정 근거는 `spec/5-system/8-embedding-pipeline.md ## Rationale "결정: 비대칭 입력 배선"` 에 있으나, `opts` 인자(서비스 래퍼 전용 batch/retry 옵션)의 추가 근거가 7-llm-client.md 의 ## Rationale 에는 작성되지 않았다. §3.3 "평탄한 시그니처" 원칙과 어긋나는 확장이라 새 Rationale 이 필요하다.
  - 제안: 7-llm-client.md ## Rationale 에 `opts` 인자(LLMClient 인터페이스가 아닌 서비스 래퍼 전용임을 구분)와 `inputType` 위치 인자 선택(EmbedResponse 객체화 대신)의 결정 근거를 추가한다. HEAD 의 §3.3 참고 주석("응답 객체화 대신 위치 인자 확장")이 있으나 공식 ## Rationale 항목이 아니다.

- **[INFO]** `spec/5-system/17-agent-memory.md` — `inputType` 배선 설명 추가는 정합
  - target 위치: `spec/5-system/17-agent-memory.md` 본문에 회수/저장 경로의 `inputType` 구분 설명 1단락 추가.
  - 과거 결정 출처: `spec/5-system/17-agent-memory.md ## Rationale "pgvector 재사용 vs 별도 벡터DB 기각"` — 임베딩 인프라를 KB/RAG 와 공유한다는 결정.
  - 상세: agent-memory 는 pgvector 재사용 결정의 자연 연장으로 `LlmService.embed` 의 `inputType` 인자를 수용하는 방식을 설명한다. 이전 Rationale 을 번복하지 않으며 기존 결정의 적용 사례를 문서화하는 형태다. KB 와 달리 일괄 재임베딩 경로가 없다는 제약(기존 메모리의 비대칭 깨짐 가능성)도 본문에서 명시되고 있어 충돌이 없다.
  - 제안: 변경 없음. 단, agent-memory ## Rationale 에 "이전 저장 메모리의 inputType 불일치에 대한 대응 정책(dedup UPDATE + TTL 자연 만료)"을 별도 항목으로 추가하면 AGM-09/AGM-10 결정과의 연결이 명시적으로 기록된다.

- **[INFO]** `spec/2-navigation/5-knowledge-base.md` — 한국어 추천 배지는 select-only 원칙 준수
  - target 위치: 임베딩 모델 폼 행에 "한국어 추천 모델은 option 라벨에 배지를 덧붙여 표시 — 비강제(select-only 원칙 유지)" 추가.
  - 과거 결정 출처: `spec/2-navigation/5-knowledge-base.md ## Rationale R-1` — "임베딩 모델은 모델별 차원이 달라 잘못된 ID 가 저장되면 KB 임베딩이 통째로 손상되므로 select 강제의 보호 효과가 크다".
  - 상세: 추가 설명이 "비강제"·"select-only 원칙 유지"·"자유 입력 경로를 추가하지 않는다"를 명시해 R-1 의 select-only 결정을 위반하지 않는다. R-1 Rationale 은 origin/main 그대로 보존됐다.
  - 제안: 변경 없음.

---

## 요약

이번 변경에서 Rationale 연속성 관점의 가장 심각한 문제는 채널 웹 채팅 위젯의 `{ data }` 봉투 처리다. `spec/7-channel-web-chat/3-auth-session.md ## Rationale R5` 는 백엔드 `TransformInterceptor` 의 봉투 래핑이 바꿀 수 없는 횡단 규약이라는 invariant 를 기록하고 있었고, 이 규약을 지키기 위한 `unwrapEnvelope` 헬퍼가 이전 회귀(`fix-webchat-envelope-unwrap.md`)의 수정물이었다. 본 변경은 TransformInterceptor 를 수정하지 않은 채 R5 와 `unwrapEnvelope` 를 제거하고 테스트 fixture 도 봉투 없는 형태로 교체해, 동일한 회귀가 재발할 가능성이 매우 높다. SSE wire 필드명 매핑(`waitingNodeId`·`message` vs `node.id`·`text`) 역시 기존 invariant 가 새 Rationale 없이 교체됐는데, 백엔드 SSE 어댑터가 실제로 바뀌지 않았다면 런타임 파싱 오류를 유발한다. 임베딩 `inputType` 배선 관련 변경(7-llm-client.md, 8-embedding-pipeline.md, 17-agent-memory.md)은 새 Rationale 을 동반하고 있어 연속성이 유지되나, `LlmService.embed` 의 `opts` 인자에 대한 공식 Rationale 은 누락돼 있다.

---

## 위험도

CRITICAL
