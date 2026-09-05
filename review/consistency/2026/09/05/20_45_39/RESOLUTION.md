# RESOLUTION — `review/consistency/2026/09/05/20_45_39`

**BLOCK: NO** · Critical **0** · WARNING **1** · INFO **7**. **조치 완료.**

직전 라운드(`19_08_19`)의 Critical(§7.1 이 `notification_secret_v2` 를 "ref 만 보관" 이라
적음)이 **해소 확인**됐다 — planner 턴이 [#1290](https://github.com/worker-ants/clemvion/pull/1290)
으로 정정했고 이 브랜치가 그것을 병합했다. `cross_spec` 이 INFO#1 로 확인 기록을 남겼다.

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | 래칫의 canary fixture 가 어떤 spec `code:` glob 에도 안 걸린다 | **plan 에 planner 후속으로 등재** (checker 가 제시한 두 경로 중 하나) |

### 지적이 맞다 — 게이트에 직접 물어 확인했다

```
✗ repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts
✓ repo-guards/__tests__/swagger-dto-contract-guard.ts
```

**이 fixture 는 래칫의 양성 대조군**이다. 그것이 없으면 술어가 죽어도 테스트가 통과한다 —
실제로 그 상태로 한 라운드를 지났다(`19_08_18` Critical 1). 그런 파일이 게이트 밖에 있는
것은 아이러니다.

**파일을 옮기거나 개명해서는 해결되지 않는다.** `swagger-dto-contract*.ts` 가 못 덮는 이유가
둘이고(glob 의 `*` 가 `/` 를 안 넘음 · 파일명 접두 불일치), 술어 자신이 `/dto/responses/`
경로를 요구하므로 fixture 는 그 아래 있어야 한다. 남는 길은 `code:` 에 fixture 디렉토리를
등재하는 것이고, 그것은 `spec/` 쓰기라 planner 트랙이다 — 그래서 등재했다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | 직전 Critical 해소 확인 | 확인 기록 |
| 2 | `4-integration.md §9.1` 미등재 | **이미 등재** — 이 브랜치 머지 후 반영하도록 순서가 적혀 있다 |
| 3 | `consecutiveNetworkFailures` | **이미 등재** |
| 4 | 신규 DTO 클래스 JSDoc 에 내부 경위 서사 | **조치 불요.** 선행 라운드가 클래스 JSDoc 이 공개 스키마로 승격되지 않음을 실측 확인했다. 다음에 그 파일을 손댈 때 `//` 로 |
| 5 | 메모이제이션 서술이 "미착수" 와 "완료" 로 갈려 읽힘 | **정정.** 이 PR 이 구현했으므로 "끝났다" 로 적고, 남은 것이 **헬퍼 추출뿐**임을 명시. 개수는 갱신하지 않았다 — 지금 적으면 또 낡는다 |
| 6 | 두 drift 목록 근접 명명 | **직전 라운드에 상호 포인터로 해소** — 확인 기록 |
| 7 | 응답 변환 헬퍼 명명이 서비스마다 다름 | 관찰만 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`20:36:54`) |
| unit | **PASS** (`20:37:54`) |
| build | **PASS** (`20:39:15`) |
| e2e | **PASS** — 295 통과 (`20:41:50`) |

`origin/main` 병합 후 전 단계를 다시 돌린 결과다.

## 보류·후속 항목

WARNING 1 을 planner 후속으로 등재했다. 그 외 새로 만든 후속은 없다.
