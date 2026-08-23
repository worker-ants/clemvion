# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** SSE/webhook fanout `nodeOutput`(및 `buttonConfig.nodeOutput`) 을 fail-open deny-list 에서 fail-closed allowlist 로 전환 — 이미 운영 중인 외부 응답 바디(EIA SSE 스트림·webhook)를 **소급 축소**하는 하위 호환성 변경이다. 직전 라운드(`22_51_46` api_contract WARNING)가 지적한 항목과 동일 코드이며, 이번 diff 에서 그 지적이 **문서로 완결**됐다: `CHANGELOG.md` 가 자기반증형 소정정 관례(취소선+정정)로 "SSE 도 fail-closed 로 닫혔다 · 목록이 9→13키로 넓어졌다 · 외부 수신자에게는 동작 변경이다"를 명시했고, `spec/5-system/14-external-interaction-api.md` §R17 이 SoT 표의 SSE 행을 flip 했다. 알려진 두 소비처(위젯·chat-channel)는 실측으로 무손실이 확인됐으나, **제3자 webhook 구독자 감사는 세션 범위 밖**임을 정직하게 명시(RESOLUTION W4)했을 뿐 실제로 수행되지는 않았다. 이 저장소에 URL 버전 프리픽스나 EIA 전용 버전 협상이 없어(직전 PR #1205 도 같은 패턴), 이번처럼 응답 바디를 좁히는 변경은 사전 공지·유예 기간 없이 전체 트래픽에 즉시 적용된다.
  - 위치: `CHANGELOG.md:24`-`39` (정정 블록), `codebase/backend/src/modules/websocket/websocket.service.ts:182`-`205`(`allowlistFanoutNodeOutput`), `codebase/backend/src/shared/utils/node-output-allowlist.ts:86`-`89`(13번째 키까지 확장), `spec/5-system/14-external-interaction-api.md` §R17 표(diff 상 gate 1750)
  - 상세: `swagger.md` 가 `nodeOutput` 을 이미 "진짜 열린 map"으로 규정해 두어(직접 확인: `spec/conventions/swagger.md:418`) OpenAPI 스키마 선언 자체는 위반하지 않는다 — 열린 map 은 키가 줄어도 스키마상 유효하다. 즉 이 항목은 **문서 결함이 아니라 잔여 운영 리스크**의 기록이며, 코드 변경을 막을 사유는 아니다(보안 목적이 정당하고, 이미 이 저장소의 확립된 선례를 따른다).
  - 제안: 조치 불요(이번 세션 범위에서는 완료). 향후 유사한 fail-closed 축소가 반복되면, EIA changelog/공지 채널에 breaking behavior change 를 표준 태그로 남기는 절차를 정식화하는 편이 좋다.

- **[INFO]** `nodeOutput` 필드명이 waiting-for-input 컨텍스트(form/buttons/ai-turn) 에만 쓰이고 terminal(`completed`/`failed`/`cancelled`)·`NODE_COMPLETED` 이벤트는 별개 필드명(`result`/`output`)을 쓴다는 것을 소스에서 직접 확인했다 — 신규 allowlist 가 작성자 정의 워크플로 출력(terminal `result`, node `output`)을 잘못 잘라낼 교차 오염 위험이 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` `emitTerminalExecution`(`wire.result` 사용, `nodeOutput` 키 없음), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6109`-`6124`(`NODE_COMPLETED` 는 `output` 키), `codebase/backend/src/modules/websocket/websocket.service.ts:187`-`202`(`allowlistFanoutNodeOutput` 는 오직 `envelope.nodeOutput`/`envelope.buttonConfig.nodeOutput` 두 자리만 좁힌다)
  - 상세: `grep` 으로 `nodeOutput:` 키를 싣는 모든 emit 호출부(`button-interaction.service.ts`, `ai-turn-orchestrator.service.ts`, `interaction.service.ts`)를 전수 확인했고, 전부 waiting 컨텍스트다. REST `getStatus` 가 "1곳에만 적용" 이라 못박은 범위 제약이 SSE 쪽에서도 실질적으로 지켜진다(필드명 자체가 다른 이벤트 타입에 나타나지 않으므로).
  - 제안: 없음(양호, 확인용 기재).

- **[INFO]** `toFanoutEnvelope` chokepoint 단일화 주장을 `executionEventSubject.next(...)` 호출부 전수(2곳: `emitExecutionEvent`, `emitNodeEvent`)로 직접 확인 — 둘 다 `allowlistFanoutNodeOutput` 을 거친다. `emitKbEvent`/`emitBackgroundRunEvent`/`emitNotificationEvent` 는 별개 채널(`kb:`/`background:run:`/`notifications:`)이라 이 subject 로 흘러들지 않으므로 우회 경로가 아니다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:319`-`400`(두 emit 함수), `:468`-`476`(`toFanoutEnvelope`)
  - 상세: 없음.
  - 제안: 없음(양호).

- **[INFO]** REST `getStatus` 와 SSE/webhook fanout 이 `NODE_OUTPUT_ALLOWED_KEYS` 단일 소스를 공유하게 되면서, chat-channel 전용으로 추가된 4키(`payload`·`title`·`rendered`·`nodeType`)가 REST 응답에도 통과한다. 표면별로 목록을 가르지 않은 설계 트레이드오프이며, 이번 diff 가 `interaction.service.spec.ts` 캐너리로 그 확장이 **의도**임을 명시적으로 고정했다(직전 라운드 WARNING #1 fix). REST 로 이 4키를 읽는 소비처는 현재 없음(실측).
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` 신규 `it`(`[캐너리] chat-channel wire 4키는 REST getStatus 에서도 통과한다`), `codebase/backend/src/shared/utils/node-output-allowlist.ts:86`-`89`
  - 상세: 없음.
  - 제안: 없음(이미 처리 완료).

- **[INFO]** 요청 검증·URL/경로 설계·페이지네이션·인증/인가·에러 응답 형식 — 이번 변경 범위(SSE/webhook fanout 필터링 유틸 + 테스트 + spec 문서)에는 신규/변경 엔드포인트, 요청 파라미터, 에러 코드, 페이지네이션 로직이 없어 해당 관점은 영향 없음.

## 요약

이번 diff 는 새 엔드포인트나 요청/에러 계약 변경이 아니라, 직전 라운드(`22_51_46`)에서 이미 리뷰·수렴된 SSE/webhook `nodeOutput` allowlist 강화 작업이 RESOLUTION 을 반영해 완결된 상태다. 유일한 API 계약 리스크였던 "외부 응답 바디 소급 축소가 사전 공지·버전 관리 없이 적용된다"는 지적은 CHANGELOG 자기반증형 정정과 spec §R17 표 flip 으로 문서화가 완결됐고, 알려진 소비처(위젯·chat-channel)는 실측으로 무손실이 확인됐다 — 남은 부분(제3자 webhook 구독자 실 트래픽 감사)은 세션 범위 밖임이 정직하게 명시돼 있다. 독립적으로 `nodeOutput` 필드명이 다른 이벤트 타입(terminal/`NODE_COMPLETED`)에 나타나지 않음과 `toFanoutEnvelope` 단일 chokepoint 주장을 소스에서 재검증했고, 둘 다 사실과 일치했다. 신규 Critical/Warning 은 발견되지 않았다.

## 위험도
LOW
