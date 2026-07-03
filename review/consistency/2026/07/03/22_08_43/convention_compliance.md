# 정식 규약 준수 검토 — `spec/5-system/6-websocket-protocol.md`

## 검토 범위 요약

본 배치(diff `origin/main...HEAD`)는 `spec/5-system/6-websocket-protocol.md` **문서 자체는 변경하지 않았고**, 그 spec 이 `code:` frontmatter 로 소유를 선언한 구현 파일들만 변경했다 (`websocket.gateway.ts`, `use-execution-events.ts`, `ws-client.ts` 및 대응 테스트). 커밋 메시지(`13dfe96ba`) 및 `plan/in-progress/refactor/06-concurrency.md` (M-3·M-6·m-3·m-5 항목)에 "spec 무변경" 근거가 명시적으로 기록되어 있다 — 구독/연결 견고화(join 실패 롤백, leave best-effort, connect churn 가드, 리스너 이중등록 방어, dismiss hysteresis)는 wire 프로토콜 계약(이벤트명·payload shape)을 바꾸지 않는 내부 구현 강건화로 판단됐다.

## 발견사항

- **[INFO]** join 실패 ack 의 에러 메시지가 spec 의 "평문 error 문자열" 패턴과 정확히 일치
  - target 위치: (코드) `websocket.gateway.ts` `handleSubscribe` catch 분기
  - 관련 규약: `spec/5-system/6-websocket-protocol.md §3.3` (spec 본문, 이번 diff 로 변경 없음) — "권한 없으면 별도 `error` 메시지가 아니라 동일한 `subscribed` ack 에 `success: false` 와 평문 `error` 문자열로 응답"
  - 상세: 신규 코드가 반환하는 `{ event: 'subscribed', data: { success: false, error: 'Subscription failed — please retry' } }` 는 §3.3 이 이미 문서화한 "평문 `error` 문자열, 전용 에러 코드 필드 없음" 규약과 형태가 정확히 일치한다. `error-codes.md` 의 UPPER_SNAKE_CASE 코드 신설도 하지 않아 §1 명명 규약과 충돌하지 않는다.
  - 제안: 조치 불요. join 실패도 §3.3 표에 사유 하나로 추가해 두면(예: "join 실패(어댑터 장애)" 행) 독자가 실패 사유 enumeration 을 한 곳에서 볼 수 있어 문서 완결성이 약간 향상되나, 필수는 아니다.

- **[INFO]** frontend `bind()`/`active` 가드 등 신규 클라이언트 내부 동작이 spec 표기 대상 밖(전송 계층 세부)
  - target 위치: (코드) `use-execution-events.ts` bind 헬퍼, `ws-client.ts` `connect()` active 가드
  - 관련 규약: `spec/5-system/6-websocket-protocol.md §1` 도입부 — "본 문서의 `{ type, id, payload }` JSON 프레임 표기는 논리적 메시지 형태를 보이기 위한 추상화" 원칙과 정합
  - 상세: 리스너 이중등록 방어·connect 진행 중 재호출 가드는 wire 이벤트 이름·payload shape 를 바꾸지 않는 클라이언트 내부 구현 세부라, spec 이 이미 선언한 "구현 현실 vs 논리 추상화" 분리 원칙에 부합한다. `error-codes.md`/`node-output.md` 등 출력 포맷 규약에 저촉되는 신규 필드·코드도 도입되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `code:` frontmatter 커버리지 정합
  - target 위치: target 문서 frontmatter (라인 6-13)
  - 관련 규약: `spec/conventions/spec-impl-evidence.md §2.1/§3` — `status: partial` 인 spec 은 `code:` ≥1 매치 의무, `pending_plans:` 의무
  - 상세: 변경된 4개 코드 파일(`websocket.gateway.ts`, `ws-client.ts`, `use-execution-events.ts` 및 대응 spec 테스트) 중 `websocket.gateway.ts`·`ws-client.ts`·`use-execution-events.ts`(직접 아님, `use-execution-interaction-commands.ts` 만 등재)는 frontmatter `code:` 글로브 범위와 정확 일치 또는 인접한다. `use-execution-events.ts` 자체는 `code:` 목록에 명시적으로는 없으나 같은 `codebase/frontend/src/lib/websocket/` 디렉토리 내 파일이고 §R-1(글로브 stale 검출은 spec-coverage 몫)의 알려진 약점 범위 내다 — CRITICAL 아님.
  - 제안: 조치 불요. 정밀화가 필요하면 `code:` 에 `codebase/frontend/src/lib/websocket/**` 글로브로 넓히는 안을 고려할 수 있으나 이는 스타일 선택이다.

## 요약

이번 배치는 `spec/5-system/6-websocket-protocol.md` 문서 자체를 수정하지 않고, 그 spec 이 소유권을 선언한 WebSocket gateway/클라이언트 코드에 구독 실패 롤백·재개 가드·리스너 이중등록 방어·dismiss hysteresis 4건의 견고화를 추가했다. 신규 코드가 반환하는 ack 실패 payload 형태(`{ event: 'subscribed', data: { success: false, error } }`)는 정식 규약 문서(`6-websocket-protocol.md §3.3`)가 이미 선언한 평문-에러 패턴과 정확히 일치하며, `error-codes.md` 의 UPPER_SNAKE_CASE 명명 규약을 위반하는 신규 코드 문자열도 도입하지 않았다. `spec-impl-evidence.md` 의 frontmatter 의무(`code:`/`pending_plans:`)도 target 문서에서 이미 충족되어 있다. 명명·출력 포맷·문서 구조·API 문서 규약 어느 관점에서도 CRITICAL/WARNING 급 위반은 발견되지 않았다.

## 위험도

NONE
