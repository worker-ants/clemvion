# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `WorkflowAssistantController` 7개 라우트에 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 신규 부착 — 순수 additive 문서화, breaking change 없음
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — `list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` (각 메서드 직전 데코레이터, `@ApiForbiddenResponse` 바로 앞)
  - 상세: 클래스 레벨에 이미 `@ApiBearerAuth('access-token')`이 걸려 전 라우트가 인증을 요구하는데도 401 OpenAPI 문서가 0건이었다(`swagger.md §2-4` 위반). 실제 파일을 열어 확인한 결과 `@ApiBearerAuth('access-token')`이 클래스 데코레이터로 걸려 있고, 이번 diff 는 데코레이터만 추가했을 뿐 가드·컨트롤러 시그니처·응답 바디·URL·상태 코드·인가 로직 어느 것도 바꾸지 않는다. 설명 문구는 저장소 내 기존 다수 컨트롤러가 쓰는 지배적 문구와 정확히 일치하며, 배치 순서(401 → 403)도 저장소 선례와 부합한다.
  - 신설 회귀 테스트 `workflow-assistant.controller.swagger.spec.ts` 가 `buildSwaggerDocument` 프로브로 라우트 7개 전수(전제 단언 포함, 공허 방지)와 401 description 문구를 고정한다.
  - 제안: 없음 — 조치 불요, 계약 관점 정상 개선.

- **[INFO]** `spec/5-system/14-external-interaction-api.md §8.2` HMAC 알고리즘 화이트리스트 문구 정정 — `hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512` 두 값
  - 위치: `spec/5-system/14-external-interaction-api.md` §8.2 "algorithm whitelist" 항목
  - 상세: 코드 동작 변경이 아니다. `notification-signature.util.ts`/`notification-signature.util.spec.ts`/`notification-webhook.processor.spec.ts` 를 직접 확인한 결과 `hmac-sha256`·`hmac-sha512` 두 알고리즘이 이미 구현·테스트돼 있다 — spec 문구가 뒤늦게 실제 구현을 따라잡은 것이다. `v1=`/`v2=` 서명 스킴 버전 표기(별개 축, secret rotation 컬럼과 무관함을 명시)도 "현재 발행은 v1 뿐"이라고 명확히 해 과다 약속을 만들지 않는다. outbound webhook 서명 검증 표면은 diff 전후로 동일 — 클라이언트(웹훅 수신자) 영향 없음.
  - 제안: 없음.

- **[INFO]** `codebase/backend/src/modules/websocket/{websocket.service.ts, websocket.service.spec.ts, notifications-channel-authorizer.ts, websocket-events.types.ts}` 및 `chat-channel/{chat-channel.dispatcher.ts, chat-channel.dispatcher.spec.ts, types.ts}` 의 변경은 JSDoc/주석/테스트 설명문 안의 SoT 절 번호(`§4.4`→`§4.5`)·하드코딩 줄 번호(`line 536`, `line 89`) 정정뿐이며, 이벤트 이름·채널 키·payload 필드·엔드포인트 경로·인가 로직에는 변경이 없다.
  - 위치: 해당 없음 — 전 파일 주석/JSDoc 전용 변경, 코드 로직 변경 없음
  - 상세: 저장소를 직접 grep 해 확인한 결과 (a) `notification.new` WS 이벤트의 SoT 절 인용은 코드 전역에서 `§4.5` 로 일관되며 잔존 `§4.4` 오인용이 없고, (b) 코드베이스에 남아 있는 다수의 `§4.4` 인용은 전부 이번 재배치로 이동하지 *않은* `execution.waiting_for_input` 절(§4.4 그대로 유지)을 정확히 가리키고 있어 정상이다. `NotificationsChannelAuthorizer` 상단 주석도 "emit 미구현" → "emit 구현·배선 완료, 이 IDOR 가드가 실제 트래픽에서 사용자간 알림 누출을 막고 있음"으로 갱신돼 인가 가드의 실효성 서술이 최신 상태와 일치한다(코드 자체의 JWT `sub == userId` 비교 로직은 무변경).
  - 제안: 없음.

- **[INFO]** harness(`consistency_orchestrator.py`)·`plan/**` 다수 문서·이전 리뷰 라운드 산출물(`review/code/2026/08/31/18_30_55/**`, `18_46_06/**`)은 API 표면(REST/WS 엔드포인트·요청·응답 스키마)과 무관 — 검토 대상 밖.

## 요약

이번 changeset 에서 실제 API 표면 코드에 손을 댄 것은 `WorkflowAssistantController` 의 `@ApiUnauthorizedResponse` 7건 추가뿐이며, 이미 `@ApiBearerAuth`로 인증이 강제되던 라우트의 OpenAPI 문서 누락(`swagger.md §2-4` 위반)을 메우는 순수 additive 변경으로 하위 호환성·응답 스키마·에러 코드·URL 설계·인가 로직 어느 것도 깨지 않는다(신규 회귀 테스트 `workflow-assistant.controller.swagger.spec.ts` 로 라우트 수·문구 고정, 클래스 레벨 `@ApiBearerAuth` 존재를 직접 확인). `14-external-interaction-api.md` 의 HMAC 화이트리스트 정정도 이미 구현된 동작(코드에서 `hmac-sha256`/`hmac-sha512` 둘 다 이미 지원)을 spec 이 뒤늦게 반영한 문서 전용 변경이다. `websocket-protocol.md` 절 재배치(§4.4→§4.5 등)에 따른 코드 주석·JSDoc·테스트 설명문 SoT 인용 정정은 이전 리뷰 라운드(18_30_55, 18_46_06)가 지적한 스윕 누락(예: `websocket.service.ts:583/585`, `websocket.service.spec.ts:1283`, `notifications-channel-authorizer.ts` 상단 주석)이 이번 diff 에서 실제로 전부 해소됐음을 저장소를 직접 열어 확인했다 — 코드베이스 전역 `§4.4` 잔존 인용은 전부 이동하지 않은 `execution.waiting_for_input` 절을 정확히 가리키고 있어 오인용이 없다. 이 변경들은 wire 계약(이벤트명·채널 키·payload 필드) 자체에는 영향이 없는 주석/문서 정정이다. 나머지(harness 코드, plan 트래커, 이전 리뷰 산출물)는 API 계약과 무관하다.

## 위험도

NONE
