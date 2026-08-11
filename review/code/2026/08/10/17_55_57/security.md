# Security Review — 웹채팅 위젯: 재로드 REST 오류 분기 + 주기 토큰 갱신 무기한 재시도

대상 라운드: `17_55_57`. 핵심 델타 — `useTokenRefresh` 지수 백오프 무기한 재시도(상한 5분),
`onRefreshed` 콜백 신설, `origin/main` 머지 후 `openStream(session)`/`openStream(saved)` 의
토큰 사용처 재검증.

## 발견사항

- **[INFO]** 세 가지 핵심 우려 지점 모두 코드·테스트로 직접 확인, 결함 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:132-174` (재시도 루프),
    `codebase/channel-web-chat/src/widget/use-widget.ts:826-827`·`1192-1193` (`openStream` 호출 시 토큰 소스)
  - 상세(1) **종료 세션의 무기한 백그라운드 재시도 우려** — `catch` 블록(`use-token-refresh.ts:158-172`)이
    재시도를 재예약하기 **전에** `if (worldGenRef.current !== gen) return;`(161행)로 세대를 먼저 재검사한다.
    `worldGenRef` 는 `teardownSession()`(`use-widget.ts:338`)이 SSE terminal·404·복구불가 401/410·명령
    410·사용자 종료·새 대화·언마운트 등 **모든 종료·교체 경로**에서 증가시키는 단일 world 세대이므로,
    세션이 종료된 뒤 이미 in-flight 였던 요청의 응답만 한 번 더 도착할 수 있을 뿐 그 이후 재귀 재예약은
    일어나지 않는다. 이중 방어로 `teardownSession()` 자신도 `clearRefreshTimer()`(340행)를 호출해 아직
    발화 전인 타이머(최초 예약이든 백오프 재시도든 동일 `timerRef`)를 즉시 취소한다 — 타이머 취소(발화
    전)와 세대 검사(발화 후 응답 도착 시)가 서로 다른 시점을 커버해 두 경로 모두 막는다. 단위 테스트
    `use-token-refresh.test.ts:245-259`(`"실패 응답 도착 시 세대가 바뀌어 있으면 재시도하지 않는다"`)가
    이 정확한 시나리오(세대 변경 후 실패 응답 도착 → 이후 `TOKEN_REFRESH_RETRY_MAX_DELAY_MS*2` 를
    흘려도 `refreshToken` 재호출 없음)를 회귀로 고정한다. `401`/`410` 종료 케이스도
    `use-token-refresh.test.ts:234-242`, 위젯 통합 레벨은 `use-widget-eager-start.test.ts:386-416`
    (`refreshCalls` 정확히 1회, "무한 재시도로 번지지 않는다" 명시 단언)로 이중 확인된다.
  - 상세(2) **`onRefreshed` 가 옛 세계(종료된 세션)로 새는지** — `use-token-refresh.ts:142-156` 의
    성공 분기에서 `onRefreshedRef.current?.(updated)` 호출(155행)은 145행의 세대 재검사
    (`if (worldGenRef.current !== gen) return;`) **뒤**에 위치해, 세대가 바뀌었으면(=세션이 그 사이
    종료·교체됨) `sessionRef.current` 갱신·storage 영속화·`onRefreshed` 통지 셋 다 함께 스킵된다.
    콜백에 전달되는 `session` 인자도 `applyRefreshedToken()` 의 반환값을 그대로 넘기는 동기 호출이라
    (`onRefreshed: (session) => resumeDeferredStreamRef.current?.(session)`, `use-widget.ts:276`)
    중간에 다른 값으로 대체될 여지가 없다. 수신측(`resumeDeferredStreamRef.current`, `use-widget.ts:741-750`)
    도 `deferredStreamRef.current` 가 `teardownSession()`(349행)에서 이미 `false` 로 리셋됐는지를 다시
    보고, `openStream` 자체도 진입 시 소유권 게이트(`streamRef.current !== null` → `"already_owned"`,
    `use-widget.ts:457`)를 갖는 3중 방어다. 단위 테스트 `use-token-refresh.test.ts:265-281`(성공 시
    갱신된 세션으로만 호출, 실패 시 미호출)과 통합 테스트 `use-widget-eager-start.test.ts:557-599`
    (미뤄 둔 스트림이 **되살아난 토큰**(`iext_revived`)으로만 열림을 URL 캡처로 직접 단언)이 이를
    회귀로 고정한다.
  - 상세(3) **머지 후 `openStream(session)`/`openStream(saved)` 옛 토큰 재발 여부** — `start()`
    경로(`use-widget.ts:812-839`)는 `seedWaitingFromStatus` 가 반환한 `outcome` 으로만 진행 여부를
    판정하고, 실제 `openStream` 인자는 **캡처해 둔 지역 변수 `session` 이 아니라** 826행에서
    `const live = sessionRef.current;` 로 다시 읽은 값이다(주석 821-825행이 그 이유를 명시).
    `applyConfig` 복원 경로(`use-widget.ts:1157-1202`)도 동일하게 1193행 `const live = sessionRef.current ?? saved;`
    로 ref 우선 읽기이며, `saved` 로의 폴백은 `sessionRef.current` 가 아직 null 인 정상 경로(401
    refresh 가 아예 없었거나 그 세션에 닿지 않은 경우)에 한정된다. 즉 이전 라운드(`16_09_40`)에서
    잡힌 CRITICAL(캡처된 지역 변수로 `openStream` 호출)의 수정 형태가 두 호출부 모두에서 **머지 이후
    현재 코드에도 그대로 유지**되어 있음을 직접 소스로 확인했다. 대응 회귀도 살아 있다 —
    `use-widget-eager-start.test.ts:294-341`(§R4 401 refresh 성공 시 복원)이 SSE URL 을 캡처해
    검증하는 패턴을 쓴다(다른 인접 테스트들이 `getUrl()`/`toContain` 으로 실제 전송 토큰을 검증).
  - 제안: 조치 불요. 세 지점 모두 코드·유닛·통합 테스트 삼중으로 방어되어 있다. 참고용 기록.

- **[INFO]** `retryDelayMs` 백오프 상한이 방어적으로 클램프됨 — DoS/서버 폭주 우려 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:23-29`
  - 상세: 연속 실패 횟수가 무한정 누적되어도(`failuresRef.current` 는 리셋 없이 계속 증가할 수 있는
    설계) `Math.min(TOKEN_REFRESH_RETRY_MAX_DELAY_MS, ...)` 로 매 호출 반환값이 5분 상한에 클램프된다
    — `2 ** exponent` 자체가 매우 커져도(JS 부동소수점이 `Infinity` 까지 안전하게 처리) `Math.min`
    비교는 정상 동작해 실제 재시도 간격이 5분 아래로 내려가는 일은 없다. 서버 대상 무기한 폴링이
    5분 간격으로 유계화되어 있어 정상 트래픽 대비 폭주 우려가 없다. 상한 클램프 자체도
    `use-token-refresh.test.ts:57-63` 로 고정돼 있다.
  - 제안: 조치 불요.

- **[INFO]** SSE 토큰이 URL 쿼리 파라미터로 전송됨(`eia-client.ts` `openStream`) — 본 라운드 변경분 아님
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:130-133`(`url.searchParams.set("token", token)`)
  - 상세: `EventSource` 가 커스텀 헤더를 지원하지 않아 단명 per-execution 토큰을 쿼리 파라미터로 보내는
    기존 설계다(EIA §8.3 명시, 이번 diff 의 변경 대상 아님 — `git diff origin/main...HEAD` 확인 결과
    `openStream` 본문은 이번 브랜치에서 수정되지 않았다). 참조 헤더·브라우저 히스토리·서버 액세스
    로그를 통한 토큰 유출 가능성은 일반적으로 알려진 트레이드오프이며, 토큰이 execution 범위로
    단명(short-lived)하고 서버 측에서 종료 시 즉시 jti blacklist 되는 완화책(EIA-AU-04)이 이미
    문서화돼 있다. 본 라운드가 만든 위험이 아니므로 별도 조치 요구 없이 참고만 기록한다.
  - 제안: 조치 불요(이번 스코프 밖). 기존 결정 유지 권장.

- **[INFO]** 에러 로깅에 토큰·시크릿 노출 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:162`,
    `codebase/channel-web-chat/src/widget/use-widget.ts:529-532`
  - 상세: 실패 시 `console.warn` 은 `err.message`(또는 `String(err)`)만 남기고 토큰·요청 바디·헤더를
    로그에 포함하지 않는다. 사용자에게는 `GENERIC_ERROR_MESSAGE`(카탈로그 일반화 문구)만 노출된다
    (`use-widget.ts:1284-1287`, 이번 diff 밖). 정보 노출 우려 없음.
  - 제안: 조치 불요.

## 요약

이번 라운드는 (1) 주기 토큰 갱신 실패 시 지수 백오프 무기한 재시도(5분 상한), (2) 갱신 성공을
호출부에 알리는 `onRefreshed` 콜백, (3) `origin/main` 머지를 함께 담았다. 셋 다 프롬프트가 지목한
정확한 위험 축을 코드로 직접 확인했다 — 종료된 세션은 world 세대 검사(응답 도착 시)와 타이머 취소
(발화 전)의 이중 방어로 재시도 루프에서 배제되고, `onRefreshed` 는 같은 세대 검사 뒤에서만 발화해
갱신된 토큰이 옛 세계로 새지 않으며, 머지 후에도 두 `openStream` 호출부(`start()`·`applyConfig`)는
캡처된 지역 변수가 아니라 `sessionRef.current` 를 읽어 이전 CRITICAL(거부된 토큰으로 SSE 오픈)의
재발이 없다. 세 지점 모두 유닛(`use-token-refresh.test.ts`)·통합(`use-widget-eager-start.test.ts`)
테스트가 해당 시나리오를 명시적으로 커버한다. 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은
암호화·민감정보 로그 노출 등 다른 OWASP 축에서도 이번 diff 범위 내 새로운 이슈는 발견하지 못했다.
SSE 토큰의 쿼리 파라미터 전송은 기존 설계이며 이번 변경 대상이 아니다.

## 위험도

NONE
