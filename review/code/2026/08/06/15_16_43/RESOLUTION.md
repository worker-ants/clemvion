# RESOLUTION — 12R (harness-review-ci-backstop)

리뷰어 14/14 성공. **CRITICAL 0 / WARNING 7.** RISK=MEDIUM.

**열두 라운드 만에 CRITICAL 0 이다.** 판정 로직(`git_probe`·`review_guard`·`plan_guard`·
`branch_guard`·워크플로 YAML)에 이번 라운드가 새로 도입한 결함이 없다는 데 전 리뷰어가 일치했다.

WARNING 7건 중 둘은 **내 주장이 틀렸다는 지적**이라 먼저 실측했다.

## W1 — 내 경화 감사가 불완전했다 (5명 독립 수렴)

직전 라운드에서 픽스처 오염 사고를 처리하며 "전수 조사 후 이 브랜치가 손댄 3개를 경화했다" 고
적었다. 실측하니 **미경화가 7곳이었고, 그중 3곳이 내가 "경화했다" 고 말한 바로 그 파일**
(`test_review_guard_hardening.py`)에 있었다. 하나(`UnstagedModificationKeepsItsPathTest`)는
**이 브랜치가 7R 에 직접 추가한 것**이다 — 리뷰어가 `git show origin/main:` 으로 대조해 확인했다.

같은 파일을 편집하면서 그 파일의 다른 사본을 못 본 것이고, plan §13 에 적은 "pre-existing 4곳"
목록에는 그 4곳이 애초에 없었다.

**처분: 내 파일의 3곳 전부 경화.** 남은 4곳은 이 티켓이 건드린 적 없는 pre-existing 이라
plan 에 정확한 이름과 **재집계된 수**로 등재했다.

## W2 — 11R 의 "그 경로에 도달할 일이 없어졌다" 가 CI 에서 거짓이었다

11R RESOLUTION 에 네트워크 폴백(`git remote show origin`)이 "C1 수정으로 도달할 일이 없어졌다"
고 적었다. **틀렸다.** 그 호출은 로컬 추측보다 **먼저** 있었고, `actions/checkout` 위상에서는
Method 1 이 항상 실패하므로 매번 실행돼 자기 2초 상한에 걸린 뒤에야 로컬 폴백이 정답을 냈다.
리뷰어 실측 2.58s — **모든 PR 마다 확정 2초**, 그리고 `evaluate_review` 는 "변경 없음" 조기
반환보다 앞에서 이걸 부르므로 리뷰할 게 없는 턴에도 같은 비용을 냈다.

**처분: 네트워크 호출을 최후로 이동** (`_origin_default_branch_over_network` 로 분리).
Method 1(`refs/remotes/origin/HEAD`, 로컬·권위)은 그대로 최우선이고, 그 뒤로 밀린 것은 로컬
**추측**뿐이라 정확성 손실이 없다 — 그 호출이 성공하면 추측과 일치하고, 실패하면 아무것도
주지 않는다.

실측: `actions/checkout` 위상 + 도달 불가 origin 에서 **0.03초**(이전 2초대).

## 나머지 WARNING

| # | 내용 | 처분 |
|---|---|---|
| W5 | plan 라운드 표가 10R 에서 멈춰 11R CRITICAL 이 표에 없다 | 11R·12R 행 추가 |
| W6 | README 가 `ActionsCheckoutTopologyTest` 를 언급 안 함 | 그 위상이 **무엇을 결여하는가**가 요점임을 포함해 갱신 |
| W7 | README 의 `GitProbesAreNotReDuplicatedTest` 서술이 9R 시점(열거)에 멈춤 | 10R 도출 전환과 그 계기(여섯 번째 프로브 누락) 추가 |
| W3 | Method 1 의 **성공** 경로를 실 저장소로 구동하는 테스트가 없다(유일한 실 저장소 픽스처가 정의상 그 ref 가 없는 위상) | 미처분 — `git clone` 픽스처가 필요하고 별도 범위. plan 등재 |
| W4 | `_run_git` 타임아웃 경로 미검증 | 미처분(동상) |

## 검증

- harness 스위트 **854 tests OK**.
- `origin` URL 정상(직전 라운드 오염 복구 후 유지).
- 실측 2건: 네트워크 미경유 0.03초 · 미경화 지점 7 → 4(전부 티켓 밖).

## 라운드 성격 — 열두 라운드의 궤적

| | 1R~6R | 7R | 8R | 9R | 10R | 11R | **12R** |
|---|---|---|---|---|---|---|---|
| CRITICAL | 3~7 | 5 | 2 | 3 | 1 | 1 | **0** |
| 가드 우회 | 매번 | 4 | 0 | 0 | 0 | 0 | **0** |

우회는 **여섯 라운드 연속 0건**이고, 12R 은 CRITICAL 자체가 0 이다. 7R 이후의 CRITICAL 은 전부
가드가 아니라 **판정 코드의 실제 결함**이었고 — `.strip()` 이 porcelain 선행 공백을 먹은 것,
같은 프로브가 세 모듈에 복제된 것, 헛매치 한 줄이 위험도 스캔을 끝낸 것, 그리고 이 층이
`actions/checkout` 위상에서 통째로 무력이었던 것 — 전부 처분됐다.
