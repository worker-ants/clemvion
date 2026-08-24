# 보안(Security) 코드 리뷰 — `node-output-envelope-458f05`

## 리뷰 방법

프롬프트 번들(파일 1~32) 전체를 검토했고, 실질 보안 로직이 있는 두 코드 파일은 저장소에서
직접 `Read` 로 전문을 대조했다:

- `codebase/backend/src/modules/websocket/websocket.service.ts` (전체)
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` (전체, 이번 diff 미포함이지만
  `allowlistFanoutNodeOutput`/`narrowTopLevelNodeOutput` 이 호출하는 정본 정책)

나머지 30개 파일(CHANGELOG·plan·spec·`review/code/2026/08/24/11_05_39/**`·
`review/consistency/2026/08/24/10_44_28/**`)은 이 PR 이 만든 문서/이전 리뷰 산출물이며
실행 경로에 영향이 없다.

## 배경 — 이 PR의 성격

이번 diff 의 유일한 실질 코드 변경은 기존 fail-closed egress allowlist
(`allowlistFanoutNodeOutput`, `#1208` 이 도입)를 `execution.node.completed`/`.failed` 가
싣는 `envelope.output`(=`NodeExecution.outputData`, `NodeHandlerOutput` 래퍼)까지
확장한 것이다. 이전에는 이 표면이 deny-list(사실상 무제한 통과) 상태라 엔진 내부 필드
(`_retryState` 등)가 SSE/webhook/chat-channel 로 나가는 fanout envelope 에 그대로
노출될 수 있었다 — 이번 변경은 그 노출면을 **닫는** 방향의 순수 하드닝이다.

## 발견사항

- **[INFO]** egress 노출 축소(하드닝) — 새 인젝션/인가/암호화 취약점 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (`narrowTopLevelNodeOutput`,
    `allowlistFanoutNodeOutput` — 게이트 171~236)
  - 상세: `narrowTopLevelNodeOutput(envelope, 'output')` 호출이 추가돼(게이트 216)
    `allowlistFanoutNodeOutput` 이 이제 최상위 두 키(`nodeOutput`, `output`)와 중첩 한 자리
    (`buttonConfig.nodeOutput`) 총 세 곳에 같은 `allowlistNodeOutputKeys`
    (`node-output-allowlist.ts`)를 건다. `allowlistNodeOutputKeys` 는 컴파일타임에
    `NodeHandlerOutput` 공개 키를 전부 덮도록 타입 결속돼 있고(`assertAllowlistCoversHandlerContract`),
    목록에 없는 키는 무조건 fail-closed 로 떨어진다(`delete out[k]`) — "새 핸들러 필드가
    조용히 새는" 회귀를 컴파일타임+런타임 양쪽에서 막는 설계다. 값이 `null`/객체가 아니면
    원본을 그대로 반환하므로(게이트 187) 배열·원시값 payload 를 강제로 `{}` 로 뭉개는 사고도 없다.
  - 값 레벨 credential 마스킹(`CREDENTIAL_KEY_PATTERN`/`sanitizePayloadForWs`,
    `deepRedactSecretsPreserving`)은 이 allowlist 필터와 **별도 방어선**이며 `maskWireEnvelope`
    쪽에서 이미 적용된다 — 두 방어가 서로 대체가 아니라 계층을 이룬다(allowlist=키 축,
    redact=값 축). 이번 diff 는 그 순서·경계를 바꾸지 않는다.
  - 내부 WS(에디터 콘솔, `gateway.broadcastToChannel`)는 `toFanoutEnvelope` 호출 이전에
    이미 나가므로 이번 필터 대상이 아니다 — `websocket.service.spec.ts` 신규 캐너리가
    `wire`(내부)와 `fanout`(외부) 객체를 직접 대조해 이 불변식을 실증한다(게이트 984~991).
  - 결론: 취약점 도입이 아니라 정보 노출 축소.

- **[INFO]** 하드코딩 시크릿 / SQL·커맨드·경로 인젝션 표면 없음
  - 상세: 이번 diff 는 in-memory 객체 필드 필터링(WS/SSE fanout envelope 조립)만 다루며
    외부 입력을 SQL/셸/파일 경로에 결합하지 않는다. `plan/in-progress/node-output-envelope.md`
    에 실린 `SELECT k, count(*) FROM node_execution …` 쿼리(게이트 57~62)는 작업자가 e2e
    postgres 를 수동으로 진단 조회한 것으로, 애플리케이션 코드 경로가 아니고 사용자 입력을
    바인딩하지 않는 고정 텍스트라 인젝션 표면이 아니다.
  - `websocket.service.spec.ts` 의 `someUnknownInternalField: 'INTERNAL DETAIL'`(게이트 179)은
    "목록 밖 임의 필드가 떨어지는지" 를 확인하는 테스트 픽스처 문자열이고 실제 시크릿이 아니다.

- **[INFO]** breaking-change 고지가 이번 diff 안에서 함께 갱신됨(WARNING 아님 — 이미 반영 확인)
  - 위치: `CHANGELOG.md` 게이트 40~46, `spec/5-system/14-external-interaction-api.md` 게이트
    1803~1807(EIA §R17 재정정 블록)
  - 상세: 새로 닫히는 `envelope.output` 표면에 대해 "외부 수신자에게는 동작 변경이다 —
    과거 응답에 `_retryState` 등 엔진 내부 필드가 이미 노출됐을 수 있고, 이번 변경이 그것을
    닫는다. 알려진 소비처(위젯·chat-channel)는 실측 무영향이나 **제3자 webhook 구독자는
    확인 범위 밖**이다" 라는 문장이 CHANGELOG·spec 양쪽에 명시적으로 들어가 있다. 이는
    `review/code/2026/08/24/11_05_39/RESOLUTION.md` W2 로 이미 처분된 항목이 이번 diff 에
    반영된 것으로, 별도 조치 불요.

- **[INFO]** 잔여 위험(`finalAdapted ?? nodeOutputCache` flat 폴백)도 egress 관점에서는 여전히
  fail-closed 로 걸러짐 — 조치 불요, 추적만
  - 위치: `plan/in-progress/node-output-envelope.md` 게이트 77~87(문서),
    `websocket.service.spec.ts` `[잔여 고정]` 캐너리(게이트 1007~1029, "flat 폴백 shape 이
    오면 목록 밖 키는 떨어진다")
  - 상세: `ai-turn-orchestrator.service.ts` 의 폴백이 flat view 를 `outputData` 에 쓸 경우
    (285건 e2e + 실 DB 조회에서 미발현), 그 shape 도 같은 allowlist 를 통과하므로 목록 밖 키는
    떨어진다 — egress 마스킹 우회가 아니라 오히려 fail-closed 원칙이 그대로 적용된다. 남는 것은
    "그 flat view 가 `outputData` 컬럼에 영속되는 것이 데이터 계약상 옳은가" 라는 별건 무결성
    문제이고, 트래커(`spec-sync-external-interaction-api-gaps.md`)에 별도 항목으로 등재돼
    있어 은닉되지 않았다.

## 관점별 점검 결과 (해당 없음 포함)

1. **인젝션**: 해당 코드 경로 없음(순수 객체 키 필터링).
2. **하드코딩 시크릿**: 없음.
3. **인증/인가**: 이번 diff 는 인증/인가 로직을 변경하지 않는다. 다만 이미 인증된 채널에
   노출되는 데이터 *범위*를 좁히는 방어 강화로, 인가 경계에 인접한 개선이다.
4. **입력 검증**: 해당 없음(응답 fanout 필터링, 요청 파라미터 미개입).
5. **OWASP Top 10**: A01(취약한 접근 제어)/A05(보안 설정 오류) 관점에서 "과도한 데이터 노출"
   유형 결함을 닫는 방향 — 신규 취약점 없음.
6. **암호화**: 관련 없음(전송 암호화·해시 로직 변경 없음).
7. **에러 처리**: 관련 없음(에러 payload 경로는 이번 diff 범위 밖 — `getStatus`/`error` 필드는
   의도적으로 allowlist 대상이 아님을 spec/코드 양쪽이 명시).
8. **의존성 보안**: 신규/변경 의존성 없음.

## 요약

이 PR 은 `#1208` 이 닫은 SSE/fanout `waiting_for_input` 표면의 fail-closed allowlist를
`execution.node.completed`/`.failed` 의 `envelope.output`(같은 `NodeExecution.outputData`
를 다른 키로 싣는 표면)까지 확장해, 이전까지 deny-list(무제한 통과) 상태로 남아 있던 정보
노출면(엔진 내부 `_retryState` 등이 SSE/webhook/chat-channel 로 나갈 수 있었던 경로)을
닫는 순수 방어 강화(hardening) 변경이다. 값 레벨 credential 마스킹은 이 allowlist 필터와
별도 계층에서 여전히 앞서 적용되고, 내부 WS(에디터 콘솔) 경로는 캐너리 테스트로 불변임이
명시적으로 고정돼 있다. 새로운 인젝션·인증/인가 우회·하드코딩 시크릿·안전하지 않은 암호화·
민감정보 에러 노출 표면은 발견되지 않았다. breaking-change 고지(CHANGELOG/spec)는 이미
같은 diff 안에서 갱신돼 있고, 유일한 잔여 위험(flat 폴백)도 egress 관점에서는 fail-closed
로 걸러지며 별건(영속 계약) 문제로 트래커에 명시적으로 분리·추적된다. 나머지 변경 파일은
전부 plan/spec/CHANGELOG/이전 리뷰 산출물(문서)로 실행 경로 보안에 영향이 없다.

## 위험도

NONE
