# RESOLUTION — 2026-08-10 00:39:31 (4라운드 타겟)

SUMMARY: Critical 0 · WARNING 3 · risk LOW (reviewer 6/6, forced 전원).

## 수렴 판정 — 발견의 성격이 바뀌었다

| 라운드 | 발견 | 성격 |
|---|---|---|
| 1 | 링크 스캐너가 공유 구현 미사용 | **동작** (교체 즉시 stale 앵커 1건 발각) |
| 2 | 스캔 소스 이중화 · 픽스처 부재 | 구조 (링크 쪽) |
| 3 | 같은 둘이 status 쪽에 그대로 | 구조 (반쪽만 적용한 교훈) |
| 4 | 무관측 분기 1 + **인접 코드 리팩터 2** | 경계 |

4라운드의 셋 중 **하나만 이 티켓의 것**이다. 나머지 둘은 "이 PR 이 건드리지 않는 파일도
리팩터하라" 이고, 그건 수렴이 아니라 범위 확대다.

## W1 — 조치 (마지막 무관측 분기)

`typeof status !== "string"` skip 분기가 어떤 fixture 로도 실행되지 않았다. **이 PR 이
다섯 곳에서 없앤 것과 정확히 같은 형태**를 새로 만든 셈이라 그대로 둘 수 없다.

fixture 3종(`status:` → null · `123` → number · `[complete]` → array)을 심고 제외됨을
단언했다. 뮤테이션 확인: 그 분기를 위반 보고로 뒤집으면 RED.

> **가정 하나가 실측에 반증됐다.** `status: no` 를 "YAML 불리언 → 비-문자열" 이라 보고
> skip 대상에 넣었는데, **js-yaml 은 YAML 1.1 불리언을 뺐어서 문자열 `"no"` 로 파싱**된다.
> 즉 미등재 어휘 위반이 맞다. 테스트를 그 사실 쪽으로 뒤집고 **파서 세대에 대한 계약**으로
> 고정했다 — gray-matter/js-yaml 상향이 해석을 되돌리면 값 하나가 조용히 검사에서 빠지는데,
> 이제 그 순간 RED 가 난다.

## INFO 4 — 조치 (내 주석이 실제보다 넓었다)

`0-`/`_` 면제를 "예전부터 있던 규칙" 이라고 썼는데, **완료-plan status 검사는 이번에 처음
그 면제를 갖는다**(검사 자체가 신설이다). 주석을 정정했다. 문서가 구현보다 넓게 말하는
클래스라 크기와 무관하게 고친다.

## W2 · W3 — 이관 (이 티켓 밖)

| 지적 | 판단 |
|---|---|
| walker 골격 3벌 중복 | 이 PR 은 **plan** walker 를 4→1 로 줄였다. 나머지 둘은 spec/codebase 용이고 필터가 서로 다르다 — 합치려면 그 차이가 의도인지 사고인지부터 갈라야 한다. 그 PR 이 건드릴 이유가 없는 파일이다 |
| `SpecMdFile` 타입명 오용 | **선재 상태**. `collectCodebaseSources(): SpecMdFile[]` 는 이 PR 이 만들지 않았고, `plan-scan.ts` 는 이미 `PlanMdFile` 로 이 혼동에서 빠져 있다 |

둘 다 `harness-env-value-subpattern-dedup.md` 에 등재했다(Gate C 의 `collectCompletePlans`
재사용 = INFO 1 도 같은 자리). **완료 문서가 아니라 살아있는 plan 에 적는다** — 이 저장소가
"미룬 항목을 review/ 에만 두면 사라진다" 를 이미 배웠다.

착수 전 조건도 함께 적었다: **각 walker 의 필터 차이를 표로 실측할 것.** 차이를 가르지 않고
합치면 조용한 스코프 변경이 된다.

## 나머지 INFO

`TERMINAL_STATUSES` freeze · `{absPath,relPath}` 3중 정의 · 매직넘버 `5` · `bucket` 리터럴
유니온 · `decodeAnchor` 위치 · import 그룹 순서 · 정렬 계약 미검증 · 빈 문자열 status ·
보안 4건(전부 "문제 없음" 확인). 강제 아님, 실질 위험 0.

## 검증

- 문서 가드 **19파일 / 2841 tests PASS**
- 뮤테이션 — non-string skip 분기 제거 시 RED 확인
- **e2e 통과** (260s, tests=264) — 마지막 코드 commit(`d1b622084`) 다음
- harness **995 tests OK**
