# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** SSE/webhook fanout 의 `nodeOutput`(및 `buttonConfig.nodeOutput`) 을 fail-open deny-list 에서 fail-closed allowlist 로 전환 — 이는 이미 운영 중인 외부 API(EIA SSE 스트림·webhook)의 응답 바디를 **소급 축소**하는 하위 호환성 변경이다. 검증된 소비처(위젯 `channel-web-chat`, chat-channel 렌더러 Discord/Telegram/Slack)에 대해서는 실측으로 무손실을 확인했지만, 이 두 소비처 밖의 **제3자 webhook 구독자**가 지금까지 fail-open 으로 새어 나가던 다른 `nodeOutput` 키(예: 특정 노드 타입이 얹는 커스텀 키)를 참조하고 있었다면 이번 배포로 조용히 사라진다. `spec/conventions/swagger.md` 가 `nodeOutput` 을 "진짜 열린 map"으로 문서화해 두었으므로 스키마 선언 자체는 위반하지 않지만(열린 map 은 키가 줄어도 유효), **행위 계약**은 좁아진다. 버전 관리(API 버전 분리·Deprecation 공지)나 실 트래픽 기반의 "현재 사용 중인 nodeOutput 키" 감사 없이 서버 사이드에서 즉시 강제한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182` (`allowlistFanoutNodeOutput`), `codebase/backend/src/shared/utils/node-output-allowlist.ts:65` (`NODE_OUTPUT_ALLOWED_KEYS`), `spec/5-system/14-external-interaction-api.md:1760`
  - 상세: 이 저장소에 URL 버전 프리픽스(`/v1` 등) 나 EIA 전용 버전 협상 메커니즘이 보이지 않아, 이번처럼 응답 바디를 좁히는 변경은 기존 API 버전 안에서 즉시 전체 트래픽에 적용된다. 보안 관점에서는 내부 필드(`_retryState`) 유출 차단이 정당한 목적이지만, API 계약 관점에서는 "지금까지 노출되던 필드가 사전 공지 없이 사라질 수 있다"는 선례가 된다.
  - 제안: 배포 전/후로 최근 N일 webhook payload 로그(또는 access log)에서 `nodeOutput` 최상위 키 분포를 표본 추출해 allowlist 밖 키의 실사용 여부를 한 번 더 확인하고, 만약 EIA 에 changelog/공지 채널이 있다면 이번 narrowing 을 breaking behavior change 로 기록해 둘 것을 권장한다(코드 변경 자체를 막을 사유는 아님 — 정보성 권고).

- **[INFO]** REST `getStatus` (#1205) 와 SSE/fanout 의 `nodeOutput` allowlist 를 동일 소스(`NODE_OUTPUT_ALLOWED_KEYS`)로 통합해 두 표면의 응답 스키마·방어 강도가 일치하게 됐다. 과거 이 저장소가 반복 겪은 "출구 넷 중 하나만 닫힌다" 클래스의 API 불일치를 구조적으로 제거하는 긍정적 변경이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:468` (`toFanoutEnvelope`), `codebase/backend/src/shared/utils/node-output-allowlist.ts:120` (`allowlistNodeOutputKeys`)
  - 상세: `emitExecutionEvent`/`emitNodeEvent` 가 공유하는 단일 chokepoint(`toFanoutEnvelope`)에 걸려 SSE·webhook(`NotificationFanout`)·chat-channel(`ChatChannelDispatcher`) 세 내부 구독자가 모두 동일 필터를 통과함을 실제 구독 관계(`executionEvents$`)로 직접 확인했다. `buttonConfig.nodeOutput` 도 같은 함수에서 별도 분기로 처리돼 "한 자리만 닫힌다" 회귀를 막는 캐너리(뮤테이션 M3)도 갖춰져 있다.
  - 제안: 없음(양호).

- **[INFO]** 신규 allowlist 키 `nodeOutput.nodeType`(카드 렌더 서브타입)과 `nodeOutput.payload`(레거시 카드 payload)가 각각 같은 문서 내 `waitingNodeType`(WS 내부 식별자, 외부 비노출)·webhook 봉투 최상위 `payload` 와 동명이라 클라이언트 파싱 오독 위험이 있었으나, 이번 diff 자체(`spec/5-system/14-external-interaction-api.md:1776`)가 disambiguation 각주 두 건을 이미 추가해 해소했다.
  - 위치: `spec/5-system/14-external-interaction-api.md:1776`
  - 상세: consistency-check(`22_26_33`, naming_collision W1·W2)가 지적한 항목이 같은 커밋 세트 안에서 반영되어 열린 이슈가 아님.
  - 제안: 없음(양호, 확인용 기재).

- **[INFO]** 요청 검증·URL/경로 설계·페이지네이션·인증/인가·에러 응답 형식 — 이번 변경 범위(WS 내부 fanout 필터링 유틸 + 테스트 + spec 문서)에는 신규/변경 엔드포인트, 요청 파라미터, 에러 코드, 페이지네이션 로직이 없어 해당 관점은 영향 없음.

## 요약

이번 변경은 새 엔드포인트나 요청/에러 계약 변경이 아니라, 기존 EIA SSE/webhook fanout 이 REST `getStatus` 와 동일한 fail-closed `nodeOutput` allowlist 를 갖도록 응답 바디 필터링을 강화한 보안 하드닝이다. 코드·테스트·spec 문서가 삼위일체로 갱신됐고, chokepoint 단일화·뮤테이션 검증·캐너리 테스트로 "일부만 닫힌다" 류의 회귀를 구조적으로 차단했으며, 알려진 두 소비처(위젯·chat-channel)에 대한 실측 기반 무손실 검증도 갖췄다. API 계약 관점의 유일한 잔여 리스크는 이 narrowing 이 이미 운영 중인 외부 응답 바디를 축소하는 하위 호환성 변경이라는 점인데, 이는 보안 목적상 의도된 것이며 문서화된 스키마(`nodeOutput` = 열린 map)를 형식적으로 위반하지는 않는다. 다만 제3자 webhook 소비자에 대한 실 트래픽 감사나 사전 공지는 이번 변경 범위 밖으로 남아 있어 정보성 WARNING 으로 기록한다.

## 위험도
LOW
