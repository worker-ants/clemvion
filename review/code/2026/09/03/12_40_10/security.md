# 보안(Security) Review

## 리뷰 대상 요약

이번 diff 는 WS `auth.token_expired` 소켓 수명 하드닝(§1.2)의 이월 정리 작업이다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — wire 문구를 리터럴에서
  `MSG_AUTH_TOKEN_EXPIRING` export 상수로 승격 (순수 리팩터, 전송 값 불변)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `clearExpiryTimers` 헬퍼 추출,
  `expiryTimers` 맵 값 타입 non-optional 화, `armExpiryTimers` 진입부 선제 해제, 타이머 `.unref()`
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 변경에 대응하는 회귀
  테스트 4종 추가
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`,
  `review/code/2026/09/03/{11_57_58,12_16_24}/*` — 작업 기록·이전 리뷰 라운드 산출물(문서, 코드 아님)

이미 이 정확한 코드가 직전 두 라운드(`11_57_58`, `12_16_24`)에서 security 관점으로 각각
NONE 판정을 받았고, 이번 라운드에서도 실제 소스(`Read` 로 직접 대조, 프롬프트 diff 와 일치
확인)에 인증/인가/암호화/입력검증 로직의 실질 변경은 없다.

## 발견사항

- **[INFO]** `.unref()` 로 인해 그레이스풀 셧다운 시 사전 통지(`notice`)·강제 종료(`cutoff`)
  콜백이 발화 전에 프로세스와 함께 소멸할 수 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:224-225` (`notice.unref(); cutoff.unref();`)
  - 상세: 정상 종료 시 소켓 자체가 함께 소멸하므로 인가 우회나 공격 표면 확대는 아니다 —
    다만 "이미 만료 임박한 클라이언트가 사전 경고를 못 받는" 가용성 트레이드오프는 실재한다.
    이 변경 자체가 도입한 신규 취약점은 아니며, 같은 diff 의 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:169-180`(게이트 번호)에 이미 별도 런북 추적 항목으로 명시돼
    있어 은폐되지 않았다.
  - 제안: 조치 불요 — plan 항목 유지, 그레이스풀 셧다운 정책과의 상호작용을 배포 런북에서
    계속 추적.

- **[INFO]** `armExpiryTimers` 의 선제 `clearExpiryTimers(client.id)` 는 `client.id` 문자열만으로
  타이머 쌍을 식별한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:183` (`this.clearExpiryTimers(client.id);`)
  - 상세: 현재 Socket.IO 는 연결마다 새 `id` 를 발급하므로 이 경로는 프로덕션에서 도달 불가하다.
    다만 향후 `connectionStateRecovery` 를 켜 같은 `id` 가 재사용되면, 지연된 구 소켓의
    `handleDisconnect`(`:317`, `this.clearExpiryTimers(client.id)`)가 방금 재연결로 새로 무장된
    타이머 쌍을 잘못 지울 수 있다 — 그 경우 재연결된 소켓이 만료 강제종료 타이머 없이
    무기한 살아남는 "토큰 만료 정책 우회" 로 이어질 잠재력이 있다. 이는 이번 라운드의
    concurrency 리뷰(12_16_24, INFO#8)가 이미 식별·기록했고, 도달 불가 상태이므로 지금
    당장의 결함은 아니다.
  - 제안: 조치 불요(현재). `connectionStateRecovery` 를 실제로 도입하는 시점에는 `client.id`
    대신 세대(generation) 토큰이나 소켓 객체 참조 동일성으로 "지금 이 타이머 쌍이 여전히
    이 연결의 것인가"를 확인하는 가드를 추가해야 한다 — 이번 diff 범위 밖이라 차단 사유는
    아니다.

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 상수 승격은 순수 additive — wire 상 전송 값(`'Access token
  expires soon — refresh and reconnect.'`)이 리터럴 시점과 문자 그대로 동일하다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:314-315`
  - 상세: 하드코딩된 시크릿이 아니라 클라이언트 진단·로깅용 안내 문구다. `AuthTokenExpiredPayload`
    JSDoc(`websocket-events.types.ts:283-301` 부근, 이번 diff 밖)이 "클라이언트는 이 값을
    소비하지 않는다"고 명시해 파싱 의존성도 없다.
  - 제안: 없음.

인증(`handleConnection` 의 JWT 검증·거부 시 일반화된 `'Invalid token'`/`'Authentication required'`
메시지), IDOR 방어(`verifyOwnership`/`verifyExecutionOwnership`, NotFound 통일), rate-limit
(`WsRateLimitGuard`/`onAny` 우회 차단), 에러 응답의 내부 메시지 비노출(`buildContinuationErrorAck`)
등 기존 보안 통제는 이번 diff 로 전혀 건드려지지 않았다 — 직접 `Read` 로 `websocket.gateway.ts`
전체를 확인해 diff 밖 로직이 이 diff 로 인해 우회되지 않음을 대조했다.

리뷰 artifact(`review/code/2026/09/03/{11_57_58,12_16_24}/*.md`, `*.json`)는 리뷰 산출 문서일
뿐 실행 코드가 아니며, 시크릿·인증 정보·PII 노출은 없다.

## 뮤테이션/저장소 변경

본 리뷰에서는 저장소 파일을 뮤테이션하지 않았다 — 정적 대조(`Read`)만으로 결론에 도달했다.
`git status --short` 확인 불필요(쓰기 작업 없음).

## 요약

이번 변경은 WS 소켓 만료 타이머 관리의 순수 하드닝/리팩터(단일 SoT 상수화, 타입 non-optional
화, 선제 해제, `unref`)로, 인젝션·하드코딩 시크릿·인증/인가 우회·입력검증 누락·암호화 약화·
민감정보 에러 노출·취약 의존성 어느 카테고리에도 새 결함을 도입하지 않는다. 이미 존재하는
IDOR·rate-limit·에러 메시지 새니타이징 등 보안 통제는 diff 범위 밖에서 그대로 유지된다.
`.unref()` 셧다운 트레이드오프와 `connectionStateRecovery` 미도입 상태의 이론적 재사용-id
경쟁은 실제 위협이 아니라 이미 문서화·추적 중인 저위험 INFO 로, 직전 두 라운드의 security
판정(NONE)과 일치한다.

## 위험도
NONE
