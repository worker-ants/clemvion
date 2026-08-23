# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** SSE/webhook fanout 의 `nodeOutput`(및 `buttonConfig.nodeOutput`)을 fail-open deny-list 에서 fail-closed allowlist 로 전환 — 이미 운영 중인 외부 API(EIA SSE 스트림·webhook)의 응답 바디를 **소급 축소**하는 하위 호환성 변경이다. `spec/conventions/swagger.md:418` 이 `nodeOutput` 을 "진짜 열린 map"으로 규정해 두어 OpenAPI 스키마 선언 자체는 위반하지 않지만(열린 map 은 키가 줄어도 유효), **행위 계약**은 좁아진다. 이 저장소에 URL 버전 프리픽스나 EIA 전용 버전 협상 메커니즘이 없어(직전 PR #1205 도 동일 패턴), 이런 응답 바디 narrowing 이 사전 공지·유예 기간 없이 전체 트래픽에 즉시 적용된다. 알려진 두 소비처(위젯 `channel-web-chat`, chat-channel Discord/Telegram/Slack 렌더러)는 실측으로 무손실이 확인됐고 CHANGELOG·spec 양쪽에 "외부 수신자에게는 동작 변경"이라고 정직하게 명시됐지만, **제3자 webhook 구독자에 대한 실 트래픽 감사는 수행되지 않았다**(세션 범위 밖으로 명시적으로 기록됨). 코드 변경을 막을 사유는 아니나(보안 목적이 정당하고 문서화가 충실함), API 계약 관점의 잔여 리스크로 남는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182`-`205` (`allowlistFanoutNodeOutput`), `:468`-`476` (`toFanoutEnvelope` 배선), `codebase/backend/src/shared/utils/node-output-allowlist.ts:66`-`90` (`NODE_OUTPUT_ALLOWED_KEYS`), `CHANGELOG.md:24`-`43` (정정 블록)
  - 상세: 이 항목은 직전 두 리뷰 라운드(`22_51_46`, `23_16_40`)에서도 지적됐고 이번 diff 시점엔 CHANGELOG 자기반증형 정정(취소선+정정 블록)·spec `§R17` 표 flip 으로 문서화가 완결된 상태다. 새로 발견된 결함이 아니라 이 최종 라운드에서도 **여전히 유효한 잔여 리스크**임을 확인하는 차원의 재기록.
  - 제안: 조치 불요(이번 세션 범위에서는 완료로 판단). 배포 전/후로 webhook payload 로그에서 `nodeOutput` 최상위 키 분포를 표본 감사하는 절차를 향후 정식화할 것을 권장(비차단, 정보성).

- **[INFO]** 직전 라운드의 cross-spec CRITICAL(`23_29_27`)이 지적한 "REST 와 SSE 는 이제 같은 강도다"는 과잉 보장은 **구현이 아니라 spec 서술의 문제**였고, `execution.node.completed`/`.failed` 의 `envelope.output` (같은 `NodeExecution.outputData` 를 `output` 이라는 다른 키로 싣는 표면)은 여전히 deny-list 인 채로 정확히 문서화됐다 — 이번 코드 자체가 이 표면을 좁히려 시도한 흔적은 없다(`allowlistFanoutNodeOutput` 은 `envelope.nodeOutput`/`envelope.buttonConfig.nodeOutput` 두 자리만 다룬다). 버튼 재개 record(`{type, buttonId, ..., nodeOutput, _selectedPort}`)에 `NODE_OUTPUT_ALLOWED_KEYS` 를 그대로 적용하면 `{}` 가 되어 carousel/buttons 외부 발송이 통째로 빈다는 실측(RESOLUTION `23_29_27`)에 따라 **의도적으로 미적용** 상태로 남겼고, `websocket.service.spec.ts` 의 `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다` 캐너리가 그 현재 상태(즉 `_retryState` 가 이 경로로는 여전히 나간다는 것)를 고정한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:907`-`952` (`[잔여]` 캐너리), `spec/5-system/14-external-interaction-api.md` §R17 정정 블록 (`execution.node.completed`/`.failed` 행)
  - 상세: 실제 코드 변경(`allowlistFanoutNodeOutput`)이 처음부터 `envelope.output` 을 건드리지 않았으므로 이는 이번 diff 가 만든 회귀가 아니라 문서 보장의 범위를 실측에 맞춰 좁힌 정정이다. 다만 `execution.node.*` 이벤트를 구독하는 외부 클라이언트(SSE/webhook) 입장에서는 이 표면의 `nodeOutput` 계열 필드가 REST `getStatus` 와 여전히 다른 방어 강도를 갖는다는 사실 자체는 남아 있다.
  - 제안: 조치 불요(정본 트래커에 신규 항목으로 등재돼 있고 캐너리가 회귀를 막는다). 향후 이 표면을 닫는 작업을 할 때는 "키 목록이 아니라 shape 판별이 먼저"라는 이번 실측 교훈(이종 payload 문제)을 전제로 착수할 것.

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 를 REST `getStatus` 와 SSE/fanout `toFanoutEnvelope` 이 단일 소스로 공유하게 되면서, chat-channel 전용으로 추가된 4키(`payload`·`title`·`rendered`·`nodeType`)가 REST 응답에도 함께 통과한다 — 표면별로 목록을 가르지 않은 설계 트레이드오프다. `interaction.service.spec.ts` 에 이 확장이 REST 에서도 통과함을 명시적으로 고정하는 캐너리가 추가돼 "의도치 않게 조용히 넓어진 것"이 아니라 "테스트가 말하는 의도"로 전환됐고, 실측상 REST 로 이 4키를 읽는 소비처는 현재 없다(위젯은 `output.rendered` 처럼 한 겹 아래로 읽는다).
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:733`-`763` (신규 캐너리), `codebase/backend/src/shared/utils/node-output-allowlist.ts:86`-`89`
  - 상세: 없음(양호, 확인용 기재).
  - 제안: 없음(이미 처리 완료).

- **[INFO]** 요청 검증·버전 관리·URL/경로 설계·페이지네이션·인증/인가·에러 응답 형식 — 이번 변경 범위(WS 내부 fanout 필터링 유틸 + 테스트 + spec/plan/changelog 문서 + 이전 리뷰/consistency-check 산출물)에는 신규/변경 엔드포인트, 요청 파라미터, 에러 코드, 페이지네이션 로직, 인증/인가 로직이 없어 해당 관점은 영향 없음.

## 요약

이번 최종 diff 는 새 엔드포인트나 요청/에러 계약 변경이 아니라, 여러 라운드(`22_51_46` → `23_16_40` → consistency-check `23_29_27`)에 걸쳐 리뷰·수렴된 SSE/webhook `nodeOutput` allowlist 강화 작업의 완결 상태다. API 계약 관점의 핵심 리스크는 처음부터 일관됐다 — **이미 운영 중인 외부 응답 바디(SSE·webhook)를 버전 관리·사전 공지 없이 소급 축소**한다는 점이며, 이는 스키마(`nodeOutput` = 열린 map) 자체는 위반하지 않지만 행위 계약을 좁힌다. 알려진 두 소비처는 실측으로 무손실이 확인됐고 CHANGELOG·spec 양쪽에 자기반증형 정정으로 정확히 기록돼 있어 정보성 WARNING 으로 유지한다(차단 사유 아님). 직전 라운드에서 발견된 cross-spec CRITICAL("REST와 SSE가 이제 완전히 같은 강도"라는 과잉 보장)은 코드가 아니라 문서 서술의 문제였고, `execution.node.*` 의 `envelope.output` 잔여 gap 을 명시적으로 좁혀 정정했으며 캐너리 테스트가 그 현재 상태(미적용)를 고정해 향후 "닫혔다고 착각"하는 재발을 구조적으로 막는다. REST 응답 표면이 공유 allowlist 로 인해 함께 넓어진 부분도 캐너리로 의도가 고정돼 있다. 신규 Critical 은 없다.

## 위험도
LOW
