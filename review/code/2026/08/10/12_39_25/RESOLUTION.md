# RESOLUTION — `12_39_25` 라운드

forced 7명 전원 리포트 확보. **Critical 0**, WARNING 3건 전부 같은 턴에 조치했다(커밋 `2d9da4f26`).

## 1. `boolean` 이 두 상황을 뭉갠다 (maintainability WARNING)

**지적**: `openStream` 이 세 상황에서 리턴하는데 (a) client 미확립 → `true`, (b) 이미 소유됨 →
`false`, (c) 실제로 염 → `true` 로, **(a)와 (c)가 같은 `true`** 다. 이 파일이 `SeedOutcome`
도입 때 명문화한 안티패턴("정상 시드"와 "stale 폐기"가 같은 `false` 로 뭉개짐)과 동형이다.

**판정: 유효.** 선례가 같은 파일 안에 있고, 나는 그 선례를 안 따랐다. 그 대가로 JSDoc 25줄과
인라인 주석으로 의미를 방어하고 있었다 — 방어 문서가 길어지는 것 자체가 신호였다.

**조치**: `StreamClaim` 명명 union 도입(`"opened"` / `"already_owned"` / `"no_client"`).
호출부는 `if (openStream(...) === "already_owned") return;`. `"no_client"` 가 중단이 아닌 것이
**주석이 아니라 타입으로** 드러나고, 세 번째 요구가 생기면 컴파일러가 미처리 케이스를 잡는다.

## 2. `start()` 의존성 배열의 `sessionEstablished` 잔재 (side_effect · documentation · requirement WARNING)

**지적**: 이번 diff 가 `start()` 본문에서 `if (sessionEstablished()) return;` 를 제거했는데
`useCallback` 의존성 배열에는 남아 있다. 세 reviewer 가 독립적으로 지적했다.

**판정: 유효.** grep 으로 확인 — 본문에는 주석 언급만 남았고 호출은 없다.

**조치**: 배열에서 제거. 기능 영향은 없으나(불필요 의존성) 다음 사람이 "여기서 쓰이는구나" 로
오독할 자리다.

## 3. 회귀 테스트 주석이 옛 구조를 서술 (testing WARNING)

**지적**: `raceStartVsResendSingleStream` 위 주석이 "`openStream` **직전**에도 재확인 —
게이트가 `start()` 와 `applyConfig` **양쪽**에 있다" 고 적었는데, 이번 diff 로 그 재확인은
`openStream` **내부** 단일 지점으로 옮겨졌다.

**판정: 유효.** 단언(esCount) 자체는 구현 불변이라 테스트는 유효하지만, 이 파일이 스스로
"JSDoc 인접성 취약성 2회 재발" 을 적고 있듯 이 코드베이스는 주석 drift 로 반복 결함을 냈다.
다음에 이 테스트가 깨졌을 때 조사자가 **있지도 않은 "호출부 게이트"** 를 찾게 두면 안 된다.

**조치**: 주석을 현행 구조로 갱신하고, 옛 구조는 "종전엔 ~였다" 로 이력만 남겼다.

## 조치하지 않은 것 (근거)

| reviewer | INFO | 사유 |
|---|---|---|
| security | `"no_client"` 진행 엣지 케이스 | **의도**. 종전 호출부도 그 경우 `scheduleRefresh()` 를 실행했다 — 이 티켓은 "기능 변경 없음" 이다 |
| documentation · maintainability | microtask race 서사가 `openStream`·`seedWaitingFromStatus` JSDoc 에 중복 | 두 함수가 **각자의 관점**에서 그 race 를 다룬다(표면 게이트 vs 스트림 게이트). 한 곳으로 합치면 나머지 한쪽을 읽는 사람이 근거를 잃는다 |
| scope · maintainability | JSDoc 분량 | 기존 컨벤션 부합 |
| testing | INFO 4건 | 커버리지 갭 아님 |

## 검증 (조치 후)

- `pnpm --filter channel-web-chat test` — 23 files / **409 passed**
- `pnpm --filter channel-web-chat exec tsc --noEmit` — 0 errors
- 뮤테이션 재실행 — 소유권 게이트 제거 **RED**. 나머지 2종은 동등 뮤턴트(실측 근거는 SUMMARY).
