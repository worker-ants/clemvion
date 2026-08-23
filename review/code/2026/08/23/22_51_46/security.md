# 보안(Security) 코드 리뷰

## 스코프

`codebase/backend/src/modules/websocket/websocket.service.ts` 및
`codebase/backend/src/shared/utils/node-output-allowlist.ts`(+ 각 `.spec.ts`)에 대한
변경 — SSE/webhook/chat-channel fanout 의 `nodeOutput` 필드를 fail-open deny-list 에서
fail-closed allowlist 로 전환하는 정보노출(info-disclosure) 방어 강화. REST `getStatus`
(#1205)와 방어 강도를 맞추는 작업. `plan/**`, `review/consistency/**`, `spec/**` 변경분은
코드가 아닌 추적/문서 산출물이라 보안 관점에서는 서술 정합성만 확인했다(코드 결함 없음).

## 발견사항

- **[INFO]** allowlist 확장(`payload`/`title`/`rendered`/`nodeType`)은 컴파일타임 결속 밖의
  "이름 기반" 예외라 향후 핸들러가 우연히 같은 이름의 **내부 전용** 필드를 도입하면 그대로
  통과한다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:85` (`'payload'` 등
    wire 전용(chat-channel) 4키 배열, 함수 `NODE_OUTPUT_ALLOWED_KEYS`)
  - 상세: `NODE_OUTPUT_ALLOWED_KEYS` 중 `config`·`output`·`meta`·`port`·`status` 는
    `NodeHandlerOutput` 타입에 결속돼 있어(`assertAllowlistCoversHandlerContract`) 새 공개
    필드가 생기면 빌드가 깨진다. 반면 이번에 추가된 chat-channel 전용 4키(`payload`·`title`·
    `rendered`·`nodeType`)와 기존 위젯 전용 4키는 타입 밖의 "wire 조립 레이어가 붙이는" 값이라
    리터럴 테스트로만 지켜진다(주석에도 명시됨). 즉 이 8개 이름 중 하나와 우연히 같은 이름의
    내부 전용 필드가 (핸들러 계약이 아닌 다른 경로로) `nodeOutput` 에 붙는 신규 코드가 생기면,
    fail-closed 설계의 의도와 달리 그 필드는 걸러지지 않고 외부로 나간다. 이는 이번 PR 이
    만든 새 취약점이 아니라 이름-기반 allowlist 의 구조적 한계이며, PR 은 이를 리터럴 테스트
    (`node-output-allowlist.spec.ts` `[리터럴] wire 전용 키가 목록에서 사라지면...`)로 최대한
    보강했다.
  - 제안: 조치 불요(설계상 트레이드오프, 문서화·테스트 이미 존재). 향후 `nodeOutput` 에 새
    top-level 필드를 얹는 코드를 리뷰할 때 "이 필드명이 우연히 allowlist 8키 중 하나와
    겹치지 않는지" 를 체크리스트에 추가하는 정도면 충분.

- **[INFO]** `nodeOutput.nodeType`(외부 노출) 과 wire top-level `waitingNodeType`(내부 전용,
  §6.2 가 "외부 소비 매핑 없음"으로 못박음) 이 동일 값(`node.type`)을 담는 동명 필드라 결함으로
  오인되기 쉽다
  - 위치: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:404`
    (`waitingNodeType: node.type`) vs `:579` (`nodeType: node.type`); 자매 쌍은
    `codebase/backend/src/modules/execution-engine/form-interaction.service.ts:121`/`:342`
  - 상세: 실측 결과 두 필드는 **같은 원본 값**(`node.type`)을 담는 서로 다른 객체(top-level
    vs `nodeOutput` 내부)라 런타임 충돌·누출은 없다. consistency-checker(`22_26_33`
    naming_collision W1)가 이미 지적했고 spec 에 disambiguation 각주가 추가됐다
    (`spec/5-system/14-external-interaction-api.md` §R17). 보안 결함이 아니라 가독성 이슈이므로
    INFO 로 하향한다.
  - 제안: 조치 완료 상태 확인만(각주 반영됨). 추가 조치 불요.

## 긍정적으로 확인된 방어 요소 (참고)

- **fail-closed 설계**: `allowlistNodeOutputKeys`(`node-output-allowlist.ts:120`)는 목록에
  없는 키를 전부 제거 — 목록이 좁아져도 안전한 방향(렌더 파손)으로만 실패한다.
- **프로토타입 오염 방어**: `delete out[k]`(대입이 아니라 삭제)를 명시적으로 선택했고,
  `JSON.parse('{"output":{},"__proto__":{"polluted":true}}')` 케이스로 오염되지 않음을
  테스트로 고정(`node-output-allowlist.spec.ts` `[캐너리] __proto__로 프로토타입을...`).
- **런타임 불변**: `Object.freeze(NODE_OUTPUT_ALLOWED_KEYS)` + `Object.isFrozen` 단언으로
  `as const` 만으로는 못 막는 `.push`/`.splice` 변조를 차단.
- **컴파일타임 결속**: `assertAllowlistCoversHandlerContract` 가 `NodeHandlerOutput` 의
  공개 키(`_resumeState`/`_retryState` 제외) 전량이 allowlist 에 있는지 타입 레벨에서
  강제 — 새 공개 필드 추가 시 빌드 실패로 드러난다.
- **단일 chokepoint 검증**: `toFanoutEnvelope`(`websocket.service.ts:468`)가
  `emitExecutionEvent`/`emitNodeEvent` 두 곳에서만 호출되고, 이 값이
  `executionEventSubject`→`executionEvents$` 를 통해 `sse-adapter.service.ts`·
  `notification-fanout.service.ts`(webhook)·`chat-channel.dispatcher.ts` 세 외부 소비처
  전원에게 전달됨을 직접 grep 으로 확인했다 — allowlist 를 우회해 `nodeOutput` 을 외부로
  내보내는 별도 경로는 발견되지 않았다.
- **순서**: `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` → `attachRoutingContext`
  순서가 지켜져, 가면 마스킹 마커(`[REDACTED]`)를 이후 단계가 덮어쓰는 재마스킹 버그도 없다.
- **내부 WS 비침습 확인**: `broadcastToChannel` 호출은 `toFanoutEnvelope` 이전에 이미
  끝나 있고 fanout 은 새 clone 에만 적용됨을 코드·캐너리 테스트(`gateway.broadcastToChannel`
  mock 호출 인자와 fanout payload 비교) 양쪽으로 확인했다.
- **뮤테이션 검증**: plan(`sse-nodeoutput-allowlist.md`)에 기록된 M1~M4 뮤턴트가 각각
  독립적으로 실패하는 테스트를 갖고 있어(특히 M3 — `buttonConfig` 블록만 제거해도 top-level
  은 GREEN 유지) "두 배선 지점 중 하나만 걸었다"는 이 저장소 반복 결함 클래스가 재발하지
  않음을 실측으로 뒷받침한다.
- 하드코딩 시크릿·SQL/커맨드 인젝션·인증 우회·안전하지 않은 암호화 관련 패턴은 발견되지
  않음(이 변경분은 순수 필드 필터링 로직).

## 요약

이번 변경은 SSE/webhook/chat-channel fanout 경로의 `nodeOutput` 필드를 REST 와 동일한
fail-closed allowlist 로 좁혀, 엔진 내부 전용 필드(`_retryState` 등 이름을 모르는 신규
내부 필드 포함)가 외부로 새는 정보노출 취약점을 닫는 **보안 강화(hardening)** 커밋이다.
allowlist 로직은 프로토타입 오염 방어·런타임 불변·컴파일타임 타입 결속을 갖췄고, 캐너리·
리터럴·뮤테이션 테스트로 "일부만 걸었다" 류의 재발 형태를 촘촘히 막았다. chat-channel
렌더 보존을 위해 목록에 4키(`payload`·`title`·`rendered`·`nodeType`)를 추가로 열어 둔
것은 문서화·테스트된 의도적 트레이드오프이며, 이름 기반 allowlist 의 구조적 한계(위 INFO
2건)를 제외하면 CRITICAL/WARNING 급 신규 보안 결함은 발견되지 않았다. 내부 WS(에디터)
채널은 이 변경의 영향을 받지 않음을 코드와 테스트 양쪽으로 확인했다.

## 위험도

NONE
