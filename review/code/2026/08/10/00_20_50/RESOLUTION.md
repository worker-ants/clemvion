# RESOLUTION — 2026-08-10 00:20:50 (3라운드 타겟)

SUMMARY: Critical 0 · WARNING 2 · risk MEDIUM (reviewer 6/6, forced 전원).

## 두 지적의 공통 근본 — **교훈을 반쪽에만 적용했다**

2라운드에서 링크 검사에 대해 (a) 스캔 소스 단일화 (b) fixture 로 탐지 증명 을 했는데,
**같은 파일의 status 검사는 그대로 뒀다.** 3라운드가 정확히 그 비대칭을 짚었다.

- W1: `collectCompletedPlans` 가 3~4번째 손 walker 이고 Gate C 의 `collectCompletePlans`
  와 `0-`/`_` 처리가 달랐다.
- W2 (MEDIUM): status 판정이 테스트 파일 안 인라인이라 fixture 검증이 **구조적으로
  불가능**했다. 리뷰가 실측했다 — 158 tests 전량 GREEN 인데 `wrong.push` 분기는 한 번도
  실행되지 않았다. "위반 0건" 은 검사가 작동한다는 증거가 아니다.

## 조치 — `plan-scan.ts` 신설

plan 트리 스캔 + 라이프사이클 불변식을 **테스트 밖에서 부를 수 있는 순수 모듈**로 뽑았다.

| 이동한 것 | 비고 |
|---|---|
| `collectLivePlanMarkdown` | `spec-links.ts` 에서 이관 (링크 모듈이 plan 규칙을 갖고 있을 이유가 없다) |
| `collectCompletePlanMarkdown` | 신설 — 재귀 + `archive/` 제외 |
| `TERMINAL_STATUSES` | 테스트 파일에서 이관 |
| `findNonTerminalCompletedPlans` | 신설 — 판정 로직 |

두 수집기가 **한 walker(`walkPlanMarkdown`)에서 파생**되고 `0-`/`_` 면제를 Gate C 와
같게 맞췄다(INFO 1 의 `isFile()` 명시도 함께 반영). `spec-links.ts` 는
`collectLivePlanMarkdown` 을 re-export 해 기존 호출부를 깨지 않는다.

`plan-scan.test.ts` 신설 — 합성 저장소에 위반 3건을 심고 **정확히 그 3건만** 잡히는지까지
단언한다(over-reach 방지). 파싱 실패 skip · 종료 어휘 4종 통과 · `status` 부재 통과 ·
`archive`/인덱스 제외 · 재귀 · plan 디렉터리 부재도 각각 고정.

## 뮤테이션 6/6 RED

위반 수집 제거 · `in-progress` 를 종료 어휘로 등재 · `archive` 순회 포함 · `0-`/`_` 면제
제거 · 재귀 축소 · `status` 부재를 위반으로. **3라운드가 지적한 "한 번도 실행되지 않는
분기" 가 이제 6가지 방향에서 관측된다.**

## INFO — 미조치

`e`/`entry` 네이밍 혼용 · `findBrokenLinksInFiles` 분기 수 · `toBeGreaterThan(20)`
(→ 이번에 `5` 로 낮춰 반영됨) · 테스트명 일반화(→ `non-terminal status` 로 반영됨) ·
경로 경계 검증(신뢰 모델상 무해) · gray-matter 버전 인지. 나머지는 강제 아님.

## 검증

- 문서 가드 **19파일 / 2839 tests PASS** (2828 → 2839, fixture 11건 증가)
- 뮤테이션 6/6 RED
- e2e — 아래 줄
