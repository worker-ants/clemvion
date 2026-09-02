# 문서화(Documentation) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`)

## 검토 범위와 방법

`origin/main` 대비 누적 diff(핵심 코드 파일 1~11 + 이전 3라운드 리뷰/컨시스턴시 산출물 파일
12~81)를 대상으로 했다. 프롬프트가 크기 제한으로 다수 파일의 diff/전체 컨텍스트를 생략했으므로,
핵심 소스는 저장소에서 `Read` 로 직접 열어 실제 줄 번호를 확인했다(뮤테이션 없음 — 읽기 전용):

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (전체 1075줄)
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (260~300행)
- `codebase/frontend/src/lib/websocket/ws-client.ts` (전체 230줄)
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` (전체 405줄)
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (전체)
- `spec/5-system/6-websocket-protocol.md` (관련 절 grep)

이 changeset 은 이미 3라운드 리뷰(`review/code/2026/09/02/{17_38_12,18_18_53,18_45_43}/`)를
거쳤고, 각 라운드의 `documentation.md`가 낸 WARNING(총 4건 — export 완전성 목록·CHANGELOG·
spec 배지 후속 포인터·pending-가드 주석의 트리거 개수 불일치)은 실제 코드 대조로 **전부 해소를
재확인**했다. 예: pending-가드 주석(`ws-client.ts` 22~31행)이 이제 "세 트리거 —
`connect_error`·`auth.token_expired`·`disconnect("io server disconnect")`" 를 명시적으로
나열해, 3R 이 지적한 "connect_error 핸들러" 단독 언급 상태에서 갱신됨을 확인했다.

## 발견사항

- **[WARNING]** `AuthTokenExpiredPayload.expiresAt` 의 JSDoc이 클라이언트 구현에 없는 동작을
  약속한다 — "이 값으로 남은 창을 계산한다"는 서술과 실제 핸들러가 어긋난다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:293-294`
    (`* 이름만 같고 가리키는 대상이 다르다. 클라이언트는 이 값으로 남은 창을 계산해 재발급 +`
    `* **명시적 재연결**을 수행한다(§9.2)`) — 대조:
    `codebase/frontend/src/lib/websocket/ws-client.ts:134-136`
    (`socket.on("auth.token_expired", () => { return refreshAndReconnect("auth.token_expired"); });`)
  - 상세: JSDoc은 클라이언트가 payload의 `expiresAt` **값을 읽어 남은 시간을 계산**한 뒤 그에
    맞춰 재발급·재연결을 수행하는 것처럼 서술한다. 그런데 실제 `auth.token_expired` 핸들러는
    콜백 인자 자체를 받지 않고(`() => {...}`), payload를 전혀 destructure하지 않은 채 즉시
    `refreshAndReconnect`를 호출한다 — "남은 창을 계산"하는 코드는 어디에도 없다.
    `ws-client.test.ts:159-162`도 핸들러에 `{ message, expiresAt }`를 넘기지만 어떤 단언도
    그 값이 읽혔음을 검증하지 않는다(구현이 그 값을 실제로 쓰지 않기 때문). spec
    본문(`6-websocket-protocol.md:1061`)도 "expiresAt까지의 창(60초) 안에 재발급"이라고만
    적어 "값을 계산해 스케줄링한다"는 요구까지는 강제하지 않는다 — 즉 코드는 spec을 어기지
    않지만, **JSDoc은 spec보다도 더 구체적인(그리고 사실이 아닌) 구현 세부를 약속**하고
    있다. 이 항목은 3R 리뷰(`review/code/2026/09/02/18_45_43/RESOLUTION.md` "미조치 #7")에서
    이미 다른 체커가 INFO로 포착했지만, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
    체크리스트에는 등재되지 않았다(스코프 밖 항목인 spec 배지·배포 전환 창·지터와 달리 재개
    신호·근거가 SoT에 남아 있지 않다) — 이번 라운드가 이 기록을 남기지 않으면 리뷰 세션이
    봉인된 뒤 근거가 사라진다.
  - 제안: JSDoc을 실제 구현에 맞춰 좁힌다 — 예: "클라이언트는 통지를 받는 즉시 재발급 +
    명시적 재연결을 수행한다. `expiresAt`은 진단·로깅 목적으로만 제공되며 현재 클라이언트
    구현은 이 값을 스케줄링에 사용하지 않는다." 또는 실제로 이 값을 사용하도록 클라이언트를
    구현할 계획이면 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트에
    후속 항목으로 등재해 추적을 SoT로 옮길 것.

## 검토했으나 이상 없음으로 판단한 항목 (전 라운드 대비 재검증)

- **`AuthEventType`/`AuthTokenExpiredPayload` JSDoc**(`websocket-events.types.ts:274-296`) —
  인용된 spec 절(§4.6)·Rationale ID(`R-ws-socket-lifetime-binds-token`)·명명 충돌 서술
  (`_retryState.expiresAt`·`auth.refreshed.expiresAt`)은 spec 원문과 `grep`으로 대조해 문구
  단위로 일치 확인(`expiresAt` 계산 클레임 1건 제외 — 위 WARNING).
- **`TOKEN_EXPIRY_LEAD_MS`/`armExpiryTimers`/`expiryTimers` JSDoc**(`websocket.gateway.ts:138-169`) —
  60초·900초·"약 6.7%"(=60/900) 수치가 실제 상수·spec 서술과 일치. `Math.max(0, …)` 의
  "의도적 중복 방어" 근거 주석(182-186행)도 실측 근거(뮤테이션 M3 생존)를 명시.
- **`cutoff` 타이머 클램프**(`websocket.gateway.ts:201-207`, `Math.max(0, untilCutoff)`)에는
  여전히 `untilNotice`(182-186행)처럼 개별 근거 주석이 없다 — 2R·3R documentation 리뷰가 이미
  INFO로 지적하고 "차단 사유 아님"으로 3회 연속 보류된 항목과 동일 상태다. 동작 영향 없고
  같은 함수 8줄 이내라 혼동 가능성이 낮다는 이전 판단에 동의해 재차 INFO로 올리지 않는다.
- **`EXPECTED_EXPORTS` 완전성 목록**(`websocket-events.types.spec.ts:62-66`) — `#1174` 회귀·
  부분집합 검사 한계를 설명하는 주석과 함께 `AuthEventType`·`AuthTokenExpiredPayload` 추가
  확인.
- **CHANGELOG.md** — `Unreleased` 섹션이 문제(무기한 인가)·해결(사전 통지+재핸드셰이크)·함정
  (`connect()` no-op)·카브아웃(자연 만료만)을 서술형으로 모두 담고 있고, 이후 라운드에서
  추가된 in-flight 가드·세대 비교 같은 내부 견고성 수정은 사용자 비가시적 변경이라 CHANGELOG
  누락으로 보지 않는다(기존 항목들의 CHANGELOG 관례도 이런 내부 수정까지 매번 기록하지는
  않음).
- **유저 가이드**(`password-and-sessions.{mdx,en.mdx}`) — ko/en 양쪽에 병렬 구조로 Callout이
  추가됐고, "최대 15분"이라는 수치는 access token TTL 900초(=15분)와 정확히 일치. 이 PR이
  revoke 카브아웃의 체감 창을 "무한"에서 "15분"으로 유계화했다는 서술도 코드
  (`armExpiryTimers`가 자연 `exp`까지만 소켓을 산다)와 부합.
- **테스트 설명 vs 실제 단언** — `websocket.gateway.spec.ts`("해제 누락은 소켓당 누수다" 등)와
  `ws-client.test.ts`("겹친 트리거는 한 번만 재연결한다 — in-flight 가드",
  "옛 세대의 재발급은 새 소켓을 건드리지 않는다" 등)의 `describe`/`it` 문구가 실제 단언
  (호출 순서·호출 횟수·세대 비교)과 정확히 대응한다.
- **spec `_(계획·미구현)_` 배지**(`spec/5-system/6-websocket-protocol.md:876,1100`)가 여전히
  구현 완료 상태와 어긋나 있으나, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:84-86`에
  "머지 후 planner 턴" 으로 이미 등재돼 있고 developer가 그 문구의 원저자가 아니므로
  자기-반증형 소정정 예외 대상이 아니다 — 은닉된 누락이 아니라 추적된 후속 조치.
- **README/설정 문서** — 신규 환경변수·설정 옵션·REST 엔드포인트 없음(WS emit-only 이벤트
  1종 추가, 기존 JWT `exp` 클레임 재사용). `websocket/` 모듈에는 원래 파일별 README 관례가
  없어 README 갱신 대상 아님.
- **예제 코드** — 신규 공개 API(REST)가 아니라 기존 WS 이벤트 패턴을 확장한 것이라 별도
  사용 예제 신설이 필요하지 않다. 유저 가이드 Callout이 사용자 관점 설명 역할을 겸한다.
- **`--impl-prep` 컨시스턴시 산출물**(파일 59~81) — 문서화 관점에서 관련 없는 프로세스
  아티팩트이며, 빈 재시도 세션 6개는 이미 scope 리뷰어가 반복 지적한 항목이라 중복 기재하지
  않는다.

## 요약

이전 3라운드가 문서화 관점에서 지적한 WARNING 4건(export 완전성 목록·CHANGELOG·spec 배지
후속 포인터·pending-가드 주석의 트리거 개수 불일치)은 모두 실제 코드 대조로 해소가
재확인됐다. 신규로 발견한 것은 하나로, `AuthTokenExpiredPayload.expiresAt`의 JSDoc이
"클라이언트가 이 값으로 남은 창을 계산한다"고 서술하지만 실제 `auth.token_expired` 핸들러는
payload를 전혀 읽지 않고 즉시 재발급·재연결한다 — spec 계약 위반은 아니지만 문서가 구현보다
넓게 약속하는 사례다. 다른 체커가 이미 INFO로 포착했으나 plan 체크리스트에 등재되지 않아
SoT에서 추적이 끊길 위험이 있어 WARNING으로 재확인·명시한다. `cutoff` 타이머 클램프의 개별
주석 부재(INFO, 3라운드째 보류)와 spec `Planned` 배지 미반영(INFO, 이미 등재된 planner 턴)은
기존 판단을 유지해 재차 격상하지 않는다. 그 외 JSDoc·인라인 주석·테스트명·CHANGELOG·유저
가이드는 spec 절번호·수치·설계 근거와 정확히 일치했다.

## 위험도

LOW
