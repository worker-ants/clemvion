# Code Review 통합 보고서 — webchat 스트림 소유권 게이트 구조적 강제

- 대상: `claude/webchat-usewidget-extraction` · diff-base `origin/main`
- 변경 — `codebase/channel-web-chat/src/widget/use-widget.ts` + plan 1
- forced 7명 **전원** 리포트 확보.

## BLOCK: NO

Critical 0 · **WARNING 3(전부 반영 완료 — `RESOLUTION.md` 참조)**.

## 전체 위험도

**LOW**.

## Critical / 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | maintainability | **`boolean` 반환이 "열었다" 와 "열 게 없어 통과시켰다" 를 같은 `true` 로 뭉갠다** — 이 파일이 `SeedOutcome` 도입 때 명문화한 바로 그 안티패턴의 재도입 | **반영** — `StreamClaim` 명명 union(`"opened"`/`"already_owned"`/`"no_client"`)으로 승격 |
| 2 | side_effect · documentation | `start()` 의 `useCallback` 의존성 배열에 미사용 `sessionEstablished` 잔재 (이번 diff 가 본문 호출을 제거했는데 배열만 남음) | **반영** — 제거 |
| 3 | testing | 회귀 테스트 주석이 **옛 구조**("호출부 양쪽에 게이트")를 서술한 채 | **반영** — "openStream 내부 단일 게이트" 로 갱신 |

> requirement 도 #2 를 독립적으로 지적했고, 리뷰 중 이미 수정 중임을 관측해 중복 확인을 요청했다 —
> 실제로 같은 라운드에서 해소됐다.

## 참고 (INFO)

| reviewer | 내용 | 판단 |
|---|---|---|
| security | 게이트를 호출부 복제에서 내부 강제로 옮긴 것은 **보안 관점에서 긍정적** | — |
| security | `"no_client"` 가 진행인 엣지 케이스가 문서화된 채 보존됨 | 의도 — **동작 보존**(종전 호출부도 그 경우 `scheduleRefresh()` 를 실행했다) |
| documentation | 새 JSDoc 이 파일의 다른 함수와 달리 `@param`/`@returns` 없이 산문뿐 | **반영** — 태그로 정리 |
| documentation | `openStream` 과 `seedWaitingFromStatus` JSDoc 에 같은 microtask race 서사가 중복 | 조치 불요 — 두 함수가 **각자의 관점**에서 그 race 를 다룬다(한쪽은 표면 게이트, 한쪽은 스트림 게이트). 한 곳으로 합치면 읽는 사람이 나머지 한쪽에서 근거를 잃는다 |
| scope | JSDoc 분량 | 기존 컨벤션과 부합 |
| maintainability | 설명이 JSDoc·인라인·호출부 주석에 반복 | 위와 같은 판단 |
| testing | INFO 4건 | 커버리지 갭 아님 |

## 이 라운드가 잡은 것 — 내가 되돌린 교훈

핵심 WARNING 은 **같은 파일이 이미 배운 것을 내가 되돌렸다**는 지적이었고, 정확했다.

`SeedOutcome` 은 "boolean 이었을 때 '정상 시드'와 'stale 폐기'가 같은 `false` 로 뭉개져 호출부가
구분할 수 없었다" 는 이유로 도입된 union 이다. 나는 같은 클래스의 결정(세 갈래 결과)을 내리면서
다시 `boolean` 을 택했고, 그 대가로 JSDoc 25줄과 인라인 주석으로 의미를 방어해야 했다.
union 으로 바꾸니 그 방어가 **타입 자체**가 됐다.

## 검증

- `pnpm --filter channel-web-chat test` — 23 files / **409 passed** (기능 무변경)
- `pnpm --filter channel-web-chat exec tsc --noEmit` — 0 errors
- 뮤테이션 — 소유권 게이트 제거 **RED**(이중 EventSource 회귀 2건이 양방향으로 잡는다).
  나머지 2종은 생존하나 **동등 뮤턴트**로 실측 확인: `scheduleRefresh` 가 `clearRefreshTimer()`
  로 시작하는 멱등 함수라 두 번 불러도 관측 차이가 없고, no-client 로 `openStream` 에 도달하는
  경로가 실 사용에 없다. 관측 불가한 것에 테스트를 만들면 vacuous 해지므로 만들지 않았다.
