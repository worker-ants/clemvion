# Security Review

## 대상 요약

`websocket.gateway.ts` / `websocket-events.types.ts` / `websocket.gateway.spec.ts` — 이전 리뷰 라운드
(`review/code/2026/09/03/11_57_58/`)의 WARNING 3건(JSDoc 오귀속 2건 + `armExpiryTimers` 조기 `return`
누수 엣지케이스)을 해소하는 후속 커밋. 추가로 `MSG_AUTH_TOKEN_EXPIRING` 상수 승격, 타이머 쌍 non-optional화,
`setTimeout(...).unref()` 도입. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 는 체크리스트
갱신, `review/code/2026/09/03/11_57_58/*`(RESOLUTION.md·SUMMARY.md·각 reviewer 산출물·`_retry_state.json`
등)는 이전 리뷰 라운드의 산출물이 신규 파일로 커밋에 포함된 것 — 애플리케이션 코드가 아닌 리뷰 아티팩트다.

인증/인가 로직 자체(`handleConnection` 의 `jwtService.verify`, `verifyExecutionOwnership`,
`channelAuthorizers` 기반 채널 인가, IDOR 방지용 `verifyOwnership` 선행 검증, `buildContinuationErrorAck`
의 내부 에러 메시지 비노출)는 이번 diff 로 **건드리지 않았다** — 전부 기존 로직 그대로다.

## 발견사항

없음 — Critical / Warning 급 보안 결함을 발견하지 못했다.

### 점검한 항목별 근거

- **인젝션**: 이번 diff 는 문자열 리터럴을 상수(`MSG_AUTH_TOKEN_EXPIRING`)로 승격하고 타이머
  Map 을 정리하는 리팩터로, 사용자 입력이 새로 흘러드는 경로가 없다. `expiryTimers` 의 키는
  `client.id`(Socket.IO 가 서버 측에서 발급하는 값, 사용자 제어 불가)이므로 injection/prototype
  pollution 표면 없음.
- **하드코딩된 시크릿**: `MSG_AUTH_TOKEN_EXPIRING` 은 클라이언트에 그대로 노출되는 안내 문구일
  뿐 시크릿·토큰·자격증명이 아니다. 다른 diff 라인에도 시크릿 패턴 없음.
- **인증/인가**: `armExpiryTimers` 진입부에 추가된 `this.clearExpiryTimers(client.id)` 는 순수
  타이머 청소이며 인증/인가 판정 로직에 개입하지 않는다. JWT 검증(`handleConnection`)·채널 인가
  (`handleSubscribe`)·실행 소유권 검증(`verifyExecutionOwnership`)은 diff 밖이라 변경 없음.
  `expiryTimers` non-optional 화도 타입 레벨 정리로 런타임 인가 판단에 영향 없음.
- **입력 검증**: `armExpiryTimers(client, expSeconds)` 의 `expSeconds`는 서버가 `jwtService.verify()`
  로 이미 검증한 JWT 의 `exp` 클레임에서만 오며, `typeof expSeconds !== 'number' || !Number.isFinite`
  가드가 그대로 유지된다(변경 없음). 사용자가 임의로 `expSeconds` 값을 주입할 경로 없음.
- **OWASP Top 10**: 해당 없음. A05(Security Misconfiguration)/A07(인증 오류) 관련 소켓 수명 로직은
  이번 diff 이전 커밋(`d73eff860`)에서 이미 구현·검토됐고, 이번 diff 는 그 리팩터·하드닝(타이머
  누수 방지, unref)일 뿐이다.
- **암호화**: 해시/암호화 알고리즘 변경 없음, 평문 전송 신규 없음.
- **에러 처리**: `armExpiryTimers`/`clearExpiryTimers`/`handleConnection` catch 블록의 에러 메시지
  노출 정책 변경 없음. `buildContinuationErrorAck` (내부 메시지 비노출 게이트)도 diff 밖.
- **의존성 보안**: 신규 의존성 추가 없음.

### 참고 (INFO, 비차단)

- **INFO**: `setTimeout(...).unref()` 도입(`websocket.gateway.ts` `armExpiryTimers`, notice/cutoff
  양쪽)으로 프로세스가 다른 활성 핸들 없이 종료 직전 상태가 되면 이 두 타이머는 이벤트 루프를
  붙잡지 못해 발화 전에 프로세스가 먼저 죽을 수 있다. 결과적으로 그 시점 직전 소켓은 사전 통지·
  강제 disconnect 없이 프로세스와 함께 종료된다(공격 표면 확대는 아니다 — 소켓 자체가 사라지므로
  만료된 토큰으로 계속 통신할 방법은 없다). 이미 직전 리뷰 라운드에서 INFO#2/#3 으로 식별되어
  "의도된 개선, 배포 런북에서 별도 추적"으로 처분됐고 `RESOLUTION.md` 도 동일하게 재확인했다 —
  신규 리스크 상승 아님, 추가 조치 불요.
- **INFO**: `review/code/2026/09/03/11_57_58/` 하위에 커밋된 이전 리뷰 라운드 산출물(`security.md`
  포함)에는 시크릿·자격증명으로 보이는 문자열이 없다. 절대경로(`/Volumes/project/private/...`)가
  다수 노출돼 있으나 로컬 개발 워크트리 경로일 뿐이라 민감정보 등급은 아니다.

## 요약

이번 diff 는 WS 소켓 만료 타이머의 자원 관리(누수 방지·unref·상수화·non-optional 타입)를 다듬는
순수 리팩터/하드닝이며, 인증(JWT 검증)·인가(채널·실행 소유권 검증)·에러 메시지 비노출 게이트 등
보안에 직결된 기존 로직은 변경하지 않았다. 새로 발견된 인젝션·시크릿·인가 우회·암호화 약화·정보
노출 결함은 없다. 유일한 참고 사항(unref 와 그레이스풀 셧다운 상호작용)은 이전 라운드에서 이미
식별·처분된 의도적 트레이드오프의 재확인일 뿐이다.

## 위험도

NONE
