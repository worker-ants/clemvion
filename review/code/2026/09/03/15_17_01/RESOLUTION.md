# RESOLUTION — entity nullable 배치 1 리뷰 2R

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **1** · INFO 12

**WARNING 1건 + INFO 1건 조치.** 1R 의 Critical 과 WARNING 4건은 8개 reviewer 가 각각 소스
확인·테스트 실행·뮤테이션 재현으로 **해소 검증**했다.

## W1 — 또 "추적된다" 고 쓰고 추적처를 안 만들었다

1R RESOLUTION 에서 두 항목을 *"plan 이 배치 2 후보로 추적한다"* / *"배치 2 로 넘긴다"* 고
단언했다. **plan 본문에 이름이 없었다** — `lastRunAt` 실측 **0건**.

| 항목 | 실태 |
|---|---|
| (d) `Schedule.lastRunAt` | `nullable: true` 인데 타입은 `Date`. 배치 1 이 같은 파일의 `nextRunAt` 만 넓혀 **한 파일 안에 비대칭**이 남았다 |
| (e) `auth.service.spec.ts:58` 의 `lockedUntil` 캐스트 | 배치 1 이 `User.lockedUntil` 을 넓혔으므로 **이제 불필요**하다(그 fixture 는 `Partial<User>`) |

**이번 세션에서 두 번째다** — WS PR(`12_16_24` W1)에서도 *"배포 런북에서 추적 중"* 이라 적고
추적처를 안 만들었다. 같은 병이다: **유예의 근거가 검증 가능한 주장인데 검증하지 않았다.**

둘을 plan 의 배치 2 후보에 **이름으로** 넣고, 경위를 그 자리에 남겼다 — 다음에 "추적된다" 를
쓰려는 사람(=나)이 grep 먼저 하도록.

## W1 부수 — 박아 둔 숫자가 **같은 PR 안에서** 낡았다

가드 docstring 이 *"spec fixture 캐스트 2026-09-03 실측 **12건**"* 이라 적고 있었다.
지금 세면 **24건**이다 — **이 가드의 spec 자신이 fixture 문자열로 그 패턴을 쓰기 때문**이다.

reviewer 는 "`lockedUntil` 확장으로 1건이 낡았다" 고 봤는데, 실측하니 그보다 크게 틀렸다.
개수를 지우고 **이유만** 남겼다. 세고 싶은 사람을 위해 grep 명령을 적어 뒀다 — 검증되지 않는
숫자는 적지 않는다.

## INFO#6 — 죽은 mock

내가 추가한 `verifyEmail` 테스트가 `usersService.findByEmail` mock 을 설정하는데 그 경로는
호출하지 않는다(인접 테스트에서 복붙한 흔적). 제거했다.

## 미조치 (판단 유지)

- **INFO#2** walker 5번째 사본 — 형제 가드 4개를 함께 건드려야 해 plan 에 이연(1R W5).
- **INFO#3** 신규 함수쌍 인접성 — 형제 술어와 같은 모양으로 붙이려다 그렇게 됐다. 다음에 이
  파일을 만질 때 파일 끝으로.
- **INFO#4** fixture 시간 상수 매직넘버(`3_600_000` vs `86400000`) — 후자는 diff 밖 기존 코드다.
  표기 통일은 그 블록을 만질 때.
- **INFO#5** `findCastOffenders` 다중 offender 미검증 — 실사용 시나리오가 희소하다.
- **INFO#7·#8** 정규식 사각(단일 공백 가정 · 2단 중첩 괄호) — prettier 정규화로 현재 안전하고
  security reviewer 가 ReDoS 형태가 아님을 확인했다. 실제 엔티티에 2단 중첩이 생기면 대응한다.
- **INFO#11** CHANGELOG — wire-facing 변화가 아니다. reviewer 도 "필수 아님" 으로 적었고
  선례(`Execution.error`)도 같은 취급이다.
- **INFO#12** 자기 스캔 오탐 없음이 우연 — 1R 과 같은 판단 유지.

## 검증

lint · unit(backend **9,250**) · build · e2e(**292**) **PASS** · backend ratchet **198/37** ·
`--impl-done` **BLOCK: NO** (WARNING 1건은 `spec/1-data-model.md` 선재 오류 → planner 후속 등재).
