# 보안(Security) 코드 리뷰

## 스코프

이번 diff 의 실질 코드 변경은 다음 세 파일이다(나머지는 테스트·plan·spec·이전 리뷰 라운드
산출물의 재커밋):

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — `NODE_OUTPUT_ALLOWED_KEYS`
  에 chat-channel 전용 4키(`payload`·`title`·`rendered`·`nodeType`) 추가
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `allowlistFanoutNodeOutput`
  신설, `toFanoutEnvelope`(SSE/webhook/chat-channel fanout 의 단일 chokepoint)에 배선
- 대응 `.spec.ts` 3건 — 캐너리·리터럴·뮤테이션 검증

목적은 SSE/webhook/chat-channel fanout 의 `nodeOutput`(및 `buttonConfig.nodeOutput`)을 REST
`getStatus`(#1205)와 동일한 fail-closed allowlist 로 좁혀, 엔진 내부 필드(`_retryState` 등)의
정보노출(info-disclosure)을 막는 보안 하드닝이다.

## 독립 검증 (코드 직접 대조)

- `node-output-allowlist.ts:121-137` (`allowlistNodeOutputKeys`) — `delete out[k]` 로 own
  속성만 제거하고 `{...obj}` 스프레드로 사본을 만든 뒤 지운다. 대입이 아니라 삭제라
  `__proto__` setter 를 타지 않는다 — 프로토타입 오염 벡터 없음.
- `websocket.service.ts:182-205` (`allowlistFanoutNodeOutput`) — `envelope.nodeOutput` 과
  `envelope.buttonConfig.nodeOutput` 두 자리를 각각 독립적으로 좁힌다. 실제 wire shape 을
  `ai-turn-orchestrator.service.spec.ts:1739-1744`·`spec/5-system/6-websocket-protocol.md`
  대조로 확인: form/ai_conversation 이벤트는 `nodeOutput`(top-level)에, buttons 이벤트는
  `buttonConfig.nodeOutput`(중첩)에만 실린다 — 즉 두 자리는 "같은 값을 두 번 필터링"이 아니라
  "이벤트 종류별로 다른 위치에 실리는 값을 각각 필터링"이며, 제3의 위치(예: `conversationConfig`
  자체가 별도 nodeOutput 을 갖는 경우)는 실측상 없다.
- 단일 chokepoint 주장 실측 — `websocket.service.ts` 전체를 grep. `nodeOutput`/`buttonConfig`
  를 실을 수 있는 emit 은 `emitExecutionEvent`(`:300`)·`emitNodeEvent`(`:373`) 뿐이고 둘 다
  `toFanoutEnvelope`(`:468`)를 거친다. `emitBackgroundRunEvent`(`:508`)·
  `emitNotificationEvent`(`:537`)는 `nodeOutput` 을 나르지 않고 `executionEventSubject` 에도
  올리지 않는다(내부 wire 만). 외부 소비처 3곳 —
  `sse-adapter.service.ts:64`(`websocketService.executionEvents$.subscribe`),
  `notification-fanout.service.ts:57`, `chat-channel.dispatcher.ts:69` — 전부 같은
  `executionEvents$` 를 구독함을 직접 확인. allowlist 를 우회해 `nodeOutput` 이 외부로
  나가는 별도 경로는 발견되지 않았다.
- REST 측(`interaction.service.ts:392-435`, 이번 diff 는 REST 코드 자체를 건드리지 않고
  테스트만 추가)도 확인 — `allowlistNodeOutputKeys` 로 이미 필터링된 `out` 을 buttons 분기
  (`:429`)와 form/ai 분기(`:435`) 양쪽에 **동일 참조**로 재사용한다. 즉 REST 는 필터링을
  한 번만 하고 그 결과를 두 shape 에 공유하므로, SSE 쪽처럼 두 자리를 각각 걸 필요가 원래
  없다 — 두 표면이 서로 다른 구현이지만 결과적으로 대칭이다(SSE 도 사실상 "이벤트당 한 자리만
  채워진다"는 wire 특성 때문에 두 자리를 각각 걸 뿐, 같은 값이 이중 필터링되지는 않는다).
- 순서(`toFanoutEnvelope:472-474`): `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` →
  `attachRoutingContext`. 값 마스킹(`maskWireEnvelope`/`deepRedactSecretsPreserving`)은 이미
  wire 단계에서 끝나 있어 `chatChannel` 의 `[REDACTED]` 마커를 이 순서가 다시 덮지 않는다.
- 내부 WS(에디터 콘솔)는 영향 없음 — `broadcastToChannel` 호출(`:319`/`:391`)이
  `toFanoutEnvelope` 호출보다 먼저 끝나고, `allowlistFanoutNodeOutput` 은 그 뒤 만들어지는
  새 clone 에만 적용된다. 이 채널의 인가는 `ExecutionChannelAuthorizer.verifyOwnership`
  (워크스페이스 멤버 전원, REST `getStatus` 와 동일 인구)이라는 것도 JSDoc·기존 결정
  (WS §4.4 strip-only)과 일치하며 이번 PR 이 새로 만든 노출이 아니다.

## 발견사항

- **[INFO]** allowlist 는 **이름 기반**이라, 타입에 결속되지 않은 wire 전용 8키
  (`formConfig`·`conversationConfig`·`buttonConfig`·`interactionType`·`payload`·`title`·
  `rendered`·`nodeType`) 중 하나와 우연히 같은 이름의 **내부 전용** 필드가 향후 다른 경로로
  `nodeOutput` 최상위에 붙으면 그대로 통과한다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:66-92`
    (`NODE_OUTPUT_ALLOWED_KEYS` 배열, 특히 86-89행의 신규 4키)
  - 상세: `config`·`output`·`meta`·`port`·`status` 5키는 `assertAllowlistCoversHandlerContract`
    (`:107`)가 `NodeHandlerOutput` 타입에 결속시켜 새 공개 필드 추가 시 빌드가 깨진다. 반면
    wire 전용 8키는 타입 밖의 값이라 `node-output-allowlist.spec.ts` 의 리터럴 대조 테스트가
    유일한 방어다(코드 주석도 이 한계를 명시). 이번 PR 이 그 표면을 4→8키로 넓히면서 구조적
    한계의 영향 범위(우연히 겹칠 수 있는 이름의 개수)도 함께 넓어졌다 — 특히 `payload`·`title`
    은 범용적인 이름이다. 이는 이번 PR 이 새로 만든 취약점이 아니라 기존 설계의 트레이드오프
    연장선이며, 리터럴 테스트로 최대한 보강돼 있다.
  - 제안: 조치 불요(설계상 트레이드오프, 이미 문서화·테스트됨). 향후 `nodeOutput` 에 새
    top-level 필드를 얹는 코드 리뷰 시 "이 필드명이 allowlist 8키 중 하나와 우연히 겹치지
    않는지"를 체크리스트에 추가하면 충분.

- **[INFO]** `nodeOutput.nodeType`(외부 노출, 카드 렌더 서브타입)과 wire top-level
  `waitingNodeType`(내부 전용, §6.2 가 "외부 소비 매핑 없음"으로 명시)이 동일 원본값
  (`node.type`)을 담는 동명 필드다.
  - 위치: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:404`
    (`waitingNodeType: node.type`) vs `:579`(`nodeType: node.type`) — 서로 다른 객체(top-level
    vs `nodeOutput` 내부)라 런타임 충돌·누출은 없음. `spec/5-system/14-external-interaction-api.md`
    §R17(이번 diff, 2145-2225행 부근)에 disambiguation 각주가 이미 추가되어 해소된 상태.
  - 제안: 조치 불요(문서 정정 완료 확인).

- **[INFO]** `nodeOutput.payload`(핸들러가 만든 legacy 카드 렌더 데이터)가 같은 spec 이 정의하는
  webhook 봉투 최상위 `payload` 래퍼와 동명이라 3중 중첩(`<봉투>.payload…nodeOutput.payload`)
  오독 소지가 있었으나, 이번 diff(`spec/5-system/14-external-interaction-api.md` §R17)가
  disambiguation 각주로 이미 해소했다. 조치 불요.

## 긍정적으로 확인된 방어 요소

- fail-closed 설계 — 목록에 없는 키는 전부 제거, 실패 방향이 "렌더 파손"이지 "정보 노출"이
  아니다.
- 프로토타입 오염 방어 — `delete` 사용(대입 아님), `__proto__` 캐너리로 고정.
- 런타임 불변 — `Object.freeze(NODE_OUTPUT_ALLOWED_KEYS)`.
- 컴파일타임 결속 — `NodeHandlerOutput` 공개 키 전량이 allowlist 에 있는지 타입 레벨 강제.
- 단일 chokepoint(`toFanoutEnvelope`) — SSE·webhook·chat-channel 세 외부 구독자 전원이
  같은 필터를 지나며, 우회 경로가 없음을 코드 추적으로 확인.
- copy-on-change — 무변경 이벤트에 새 객체를 만들지 않아 hot path 성능을 해치지 않으면서도
  안전.
- 캐너리·리터럴·뮤테이션(M1~M5) 테스트가 "두 자리 중 한쪽만 닫힌다"류의 이 저장소 반복 결함
  클래스를 구조적으로 차단.

하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘, 민감정보
에러 노출 패턴은 이번 diff 범위(순수 필드 필터링 로직 + 문서)에서 발견되지 않았다.

## 요약

이번 변경은 SSE/webhook/chat-channel fanout 경로의 `nodeOutput` 필드를 REST `getStatus`
와 동일한 fail-closed allowlist 로 좁혀, 엔진 내부 전용 필드(`_retryState` 등 이름을 모르는
신규 내부 필드 포함)가 외부로 새는 정보노출 취약점을 닫는 보안 강화(hardening) 커밋이다.
독립적으로 재검증한 결과 단일 chokepoint 주장·두 필터 위치(top-level `nodeOutput` /
`buttonConfig.nodeOutput`)의 실제 wire shape 대응·REST 측과의 필터링 일관성·프로토타입 오염
방어·copy-on-change·컴파일타임 타입 결속이 모두 코드와 정확히 일치했다. CRITICAL/WARNING 급
신규 보안 결함은 발견되지 않았고, 잔여 사항은 전부 기존에 이미 문서화·테스트된 "이름 기반
allowlist 의 구조적 한계"(INFO)와 이미 해소된 동명 필드 disambiguation(INFO, 확인용)뿐이다.

## 위험도

NONE
