# API 계약(API Contract) 리뷰

## 범위 판단

`origin/main...HEAD` 전체 diff(33개 파일)를 확인했다. 실질 변경은 4개뿐이다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` 상수 신규 export
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 타이머(`expiryTimers`) 무장/해제 하드닝(`clearExpiryTimers` 추출, 타입 non-optional 화, 선제 해제, `.unref()`)
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 하드닝을 검증하는 테스트 4종 추가
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 진행 문서 갱신(체크리스트 마감 + 신규 이월 항목)

나머지 29개 파일(`review/code/2026/09/03/{11_57_58,12_16_24}/**`)은 이전 두 리뷰 라운드의 산출물이
이번 브랜치에 커밋되어 diff 에 함께 잡힌 것으로, 리뷰 리포트 자체이지 API 코드가 아니다. 그중
`api_contract.md`(11_57_58, 12_16_24 두 라운드분)를 직접 열어 선행 판정을 확인했고, 둘 다 이번
소스 변경을 NONE 으로 판정했다 — 이번 라운드의 소스 diff 는 그 두 라운드가 이미 본 것과 동일하다
(`git diff --stat origin/main...HEAD` 로 4개 실질 파일이 그때와 같음을 확인). REST 엔드포인트,
컨트롤러, DTO, OpenAPI 문서, HTTP 라우트는 이번 diff 어디에도 없다.

이 기능(`auth.token_expired` WS 통지, spec `R-ws-socket-lifetime-binds-token`)은 이미 `#1266`
으로 머지된 결정의 후속 하드닝이며, 신규 엔드포인트·신규 이벤트·신규 REST 경로는 없다.

## 점검 결과

### 1. 하위 호환성
- `AuthTokenExpiredPayload` 인터페이스(`{ message: string; expiresAt: string }`)는 필드
  추가·삭제·타입 변경 없이 그대로다.
- wire 로 나가는 `message` 값을 직접 대조했다 — 삭제된 리터럴(`websocket.gateway.ts` diff
  `-message: 'Access token expires soon — refresh and reconnect.'`)과 신규 상수 값
  (`websocket-events.types.ts:314-315`, `export const MSG_AUTH_TOKEN_EXPIRING = 'Access token
  expires soon — refresh and reconnect.'`)이 **문자 그대로 동일**하다. 리터럴을 단일 SoT
  상수로 옮겼을 뿐 실제 전송 값은 바뀌지 않았다.
- `MSG_AUTH_TOKEN_EXPIRING` 신규 export 는 이 파일에 기존 심볼과 이름 충돌이 없음을
  `grep` 으로 확인했다(`MSG_NOT_AUTHENTICATED`/`MSG_NOT_AUTHORIZED_EXECUTION` 은
  `websocket.gateway.ts` 로컬 상수로 별개) — 순수 additive.
- breaking change 없음.

### 2. 버전 관리
- WS 프로토콜에 별도 버전 스킴이 없고 이번 변경도 그것을 요구하지 않는다. 해당 없음.

### 3. 응답 형식
- 전송 shape(`{ message, expiresAt }`)·이벤트명(`AuthEventType.AUTH_TOKEN_EXPIRED`) 불변.
  스키마 이탈 없음.

### 4. 에러 응답
- 이번 diff 는 에러 emit 경로(`error`, `WsErrorCode`)를 건드리지 않는다. 해당 없음.

### 5. 요청 검증
- 클라이언트→서버 요청 바디를 다루지 않는다. 핸드셰이크 토큰 검증(`handleConnection`)은
  diff 밖이며 이번 변경은 검증 통과 **이후**의 타이머 하우스키핑만 다룬다. 해당 없음.

### 6. URL/경로 설계
- 이벤트명·네임스페이스 변경 없음. 해당 없음.

### 7. 페이지네이션
- 목록 API 아님. 해당 없음.

### 8. 인증/인가
- `armExpiryTimers` 진입부에 `this.clearExpiryTimers(client.id)` 를 **조기 return 보다 먼저**
  두도록 옮긴 변경은 인가 로직 자체(JWT 검증, `payload.exp` 추출)를 바꾸지 않는다 — 재무장
  시 옛 타이머 쌍이 살아남아 이미 무효화됐어야 할 `disconnect`/`auth.token_expired` 콜백이
  이중으로 걸리는 경로를 막는, 계약 신뢰성 방향의 보강이다. 신규 테스트
  (`websocket.gateway.spec.ts` "같은 client.id 로 재무장하면 옛 타이머를 먼저 해제한다",
  "exp 없는 토큰으로 재무장해도 옛 타이머는 해제된다")가 이 지점을 단언한다.
- `expiryTimers` 값 타입 non-optional 화, `clearExpiryTimers` 추출, `.unref()` 는 모두
  내부 구현 세부이며 인가 판단 로직(누가 어떤 워크스페이스 리소스에 접근 가능한가)에는
  영향이 없다.

## 발견사항

- **[INFO]** `.unref()` 도입으로 그레이스풀 셧다운 중 만료 콜백(사전 통지 emit)이 발화 전에
  프로세스가 먼저 종료될 수 있는 창이 생긴다 — API 계약(스키마·인가) 위반은 아니고 "통지를
  받았어야 할 클라이언트가 특정 창에서 못 받을 수 있다" 는 신뢰성 트레이드오프다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers` 내
    `notice.unref(); cutoff.unref();` (게이트 `224`, `225`)
  - 상세: 이번 diff 의 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 신규 항목
    (게이트 `169-174`, "셧다운 중 만료 콜백 미실행")이 이 트레이드오프를 이미 배포 런북
    후속 항목으로 명시하고 있어 별도 조치가 필요한 결함은 아니다. API 계약 관점에서는
    "정상 종료 시 소켓 자체가 소멸하므로 실질 영향 없음" 이라는 plan 의 서술에 동의한다 —
    소켓이 사라지면 애초에 그 소켓으로는 어떤 통지도 전달할 수 없으므로 계약 위반이라기보다
    운영 관측성 이슈에 가깝다.
  - 제안: 조치 불요 — plan 문서의 "관측되면 unref 를 걷고 셧다운 훅에서 명시적으로 해제" 계획을
    유지.

## 요약

이번 diff 는 이미 결정·구현·머지된 `auth.token_expired` WS 프로토콜 기능의 후속 하드닝
커밋으로, REST API 표면(엔드포인트·버전·응답 스키마·에러 코드·페이지네이션)을 전혀
건드리지 않는다. 유일하게 관련 있는 WS wire 계약(`auth.token_expired` 페이로드)도 이벤트명·
필드 shape·`message` 값이 리터럴 대 상수 비교로 바이트 단위 동일함을 직접 확인했고, 소켓당
"1회 통지 + 1회 강제종료" 라는 불변식을 재무장 경로에서도 지키도록 강화하는 방향으로만
바뀌었다. 새로 export 된 `MSG_AUTH_TOKEN_EXPIRING` 은 이름 충돌 없는 순수 additive 변경이며,
`.unref()` 로 인한 그레이스풀 셧다운 창은 API 계약 위반이 아닌 운영 트레이드오프로 이미 plan
문서에 후속 추적 항목으로 기록돼 있다. 함께 diff 에 잡힌 29개 review 산출물 파일은 API 코드가
아니며 이전 두 라운드의 `api_contract.md` 판정(둘 다 NONE)과도 일치한다. 계약 관점에서
차단 사유가 될 발견사항은 없다.

## 위험도

NONE
