# RESOLUTION — 11R (harness-review-ci-backstop)

리뷰어 14/14 (`database` 는 1차 누락 → 재실행, 발견 없음). **CRITICAL 1 / WARNING 10.**

## C1 — 이 층이 정작 CI 에서 아무것도 하지 않고 있었다

열한 라운드 중 이 **기능**에 대한 가장 중요한 발견이다. 지금까지의 CRITICAL 은 전부 가드가
뚫리거나 판정 코드에 결함이 있다는 것이었는데, 이번엔 **백스톱 자체가 목표 환경에서 무력**이었다.

`actions/checkout` 은 `clone` 이 아니라 `init` + `remote add` + `fetch` 로 워크트리를 만들고
`git remote set-head` 를 부르지 않는다. 그 결과:

- `refs/remotes/origin/HEAD` 없음 → `_origin_default_branch` 의 로컬 경로 실패
- 로컬 `refs/heads/main` 도 없음(PR ref 만 fetch) → 기존 폴백도 빗나감
- 남는 것은 **네트워크 호출**(`git remote show origin`) 뿐 — 실측 2.6~3.7초로 선언된 2초
  타임아웃을 상시 초과

그게 실패하면 `_default_branch()` → None → base 없음 → 커밋 변경 목록 빈 리스트 →
**"codebase 변경 없음 — 허용"**.

**직접 재현** (격리 저장소를 `actions/checkout` 절차 그대로 만들고 origin 을 도달 불가로):

```
수정 전: review-gate: 통과 — no codebase/ changes on this branch — allowed   exit=0
수정 후: review-gate: 미커버 — 1 codebase/ file(s) changed … no resolved review  exit=1
```

`codebase/` 파일을 고쳤고 리뷰는 전혀 없는 상태였다. **관측 모드로 켜 뒀다면 판정 데이터가
전부 거짓 통과로 쌓였을 것이고, 그 데이터로 `--enforce` 전환을 결정할 참이었다.**

**처분: `_default_branch` 가 `refs/remotes/origin/<name>` 도 본다.** 네트워크가 필요 없고
checkout 위상에 실제로 존재하는 ref 다. `refs/heads/<name>` 보다 **먼저** 보는데, 같은 이름의
로컬 브랜치는 "무엇이 DEFAULT 인가" 에 대한 더 약한 주장이기 때문이다.

회귀 테스트는 `actions/checkout` 위상을 실제로 만든다 — 그리고 **위상 자체를 먼저 단언**한다
(두 로컬 ref 가 없고 `origin/main` 만 있음). 그게 틀리면 나머지가 아무것도 증명하지 못한다.

> **순서 주장은 처음에 미검증이었다.** "origin 쪽이 더 강한 주장" 이라고 주석에 적었는데
> 순서를 뒤바꾼 뮤턴트가 GREEN 이었다. 로컬 `main` 과 origin 기본 `master` 가 갈리는 저장소
> (포크에서 흔하다)를 만들어 고정한 뒤에야 RED. **주장했으면 검증한다.**

## WARNING 처분

| # | 내용 | 처분 |
|---|---|---|
| W1 | 게이트 코드 자체가 PR HEAD 에서 로드된다 — 같은 PR 에서 `_lib`/`_shared` 를 조작하면 조작된 판정자가 자신을 통과시킨다 | plan 의 `--enforce` 선행 조건에 branch-protection 항목 추가 |
| W4 | 네트워크 폴백이 선언 타임아웃(2s)보다 오래 걸림(2.6~3.7s) | C1 수정으로 **그 경로에 도달할 일이 없어졌다** — 폴백은 남기되 상시 경로가 아니다 |
| W6 | `plan_guard` 주석이 "five probes" 인데 실제 여섯 | 개수를 프로즈에 박지 않는 서술로 |
| W7 | 티켓과 무관한 resolution 마커 수정이 10R 에 동봉됐는데 plan 이력에 없음 | plan 에 한 줄 기록 |
| W2·W8 | 중복 가드가 **이름이 같은** 함수만 비교 · 스캔 대상 모듈 목록이 여전히 두 곳에 하드코딩 | 미처분 — "열거를 도출로" 를 한 단계 더 밀어야 하고, 이번 라운드가 이미 큰 수정을 담았다. plan 등재 |
| W3·W5·W9 | 세션 전수 스캔 성장 · 기본 브랜치 해석 4곳 · 테스트 부트스트랩 중복 | 기등재 후속 |

## 검증

- harness 스위트 **854 tests OK**.
- mutation 2종 RED: `origin/<name>` 폴백 제거(C1 재현) · 폴백 순서 뒤바꿈.

## 라운드 성격

| | 8R | 9R | 10R | 11R |
|---|---|---|---|---|
| CRITICAL | 2 | 3 | 1 | **1** |
| 가드 우회 | 0 | 0 | 0 | **0** |

우회는 다섯 라운드 연속 0건이다. 11R 의 CRITICAL 은 가드가 아니라 **기능이 목표 환경에서
동작하지 않는다**는 것이었고, 이 티켓의 본질에 가장 가까운 발견이다. 그것을 고치기 전까지
이 층은 "켜져 있지만 아무것도 보지 않는" 상태였다.
