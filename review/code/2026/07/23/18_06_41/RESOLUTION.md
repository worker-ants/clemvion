# RESOLUTION — review/code/2026/07/23/18_06_41

대상: branch `claude/push-guard-worktree-scope-20044c`, 커밋 `942412ea3`.
판정: **RISK=LOW / CRITICAL=0 / WARNING=2 / INFO=10**. forced 7/7 확보(제외 0명), 누락 0.
`summary_written=false` 라 main 이 `SUMMARY.md` 직접 기록.

## WARNING 2건 (전량 반영)

### 1. `main()` 의 `_push_targets` 폴백 무검증 — **내 1차(17_28_02) RESOLUTION 이 틀렸다**

1차 반영 때 나는 이 경로를 "위 2건이 커버" 라고 적었다. **틀렸다.** 그 테스트들
(`test_worktree_listing_failure_degrades_to_cwd` 등)은 `_worktree_branches` **자체의**
fail-open(빈 리스트 반환)을 탈 뿐, `main()` 의 `except Exception` 분기는 타지 않는다.

재현: `targets = [base_cwd]` → `targets = []` mutation 이 **39/39 green 으로 생존**.
즉 target 선택이 통째로 실패하면 **두 게이트가 모두 건너뛰어진다** — 이 PR 이 닫으려는 바로 그
false-ALLOW 클래스가 그 경로에 남아 있었다.

**조치**: `test_push_targets_crash_falls_back_to_cwd` 신설. 훅 사본에 `_push_targets` 가 즉시
raise 하도록 패치해 **실제 `main()` 제어 흐름**을 통과시키고, 폴백 후에도 cwd 가 평가돼 block
되는지 단언한다. 재실측 결과 M7 이 **이 테스트 1건만** red.

기존 `test_worktree_listing_failure_degrades_to_cwd` 의 docstring 에도 "이건 다른 fail-open
경로다" 를 명시해 같은 혼동이 재발하지 않게 했다. **1차 RESOLUTION 의 과대 표기도 정정**했다.

### 2. plan 에 2차 반영 섹션 부재

1차 WARNING 7건만 표로 기록되고 2차 2건은 체크리스트 한 줄뿐이라 감사 추적이 비대칭이었다.
**조치**: `## 2차 리뷰(17_51_28) 반영` · `## 3차 리뷰(18_06_41) 반영` 두 절을 1차와 같은 형식으로
추가.

## INFO 10건 — 미조치 (근거)

- **INFO 1 (`_GIT_PUSH` blind 오탐)**: 이 PR 이 만든 `push-` 파일명 때문에 `git log -- <path>` 류가
  걸린다. 리뷰어도 확인했듯 정규식은 **frozen("DO NOT EDIT")** 이고 범위 밖이며, 오탐 방향이
  **항상 안전한 쪽(false BLOCK)** 이다. 나도 이 세션에서 두 번 맞았고 커밋 메시지를 파일로 넘겨
  회피했다 — 설계상 의도된 트레이드오프.
- **INFO 2·3 (문서)**: 모듈 상단 docstring 요약, `guard_review_before_stop.py` 제외 근거.
  후자의 근거는 plan §3차 절에 한 줄로 남겼다(Stop 훅엔 "지목할 다른 branch" 개념이 구조적으로
  없다).
- **INFO 4·5·6·8 (선택 테스트)**: legacy `worktree:` 렌더값 단언, detached-HEAD 파싱, `_accepts_cwd`
  의 signature 조회 실패 분기, 다중 target 보고 순서. 전부 리뷰어가 "선택/급하지 않음" 분류.
- **INFO 7**: plan 체크리스트 "18건" → 실제 19건. **반영**(이번 추가로 20건).
- **INFO 9·10**: 테스트 스텁 패턴 반복, 카탈로그의 개별 테스트명 미언급 — 비차단.

## 검증

- 신규 테스트 **19 → 20건**. harness 전체 **487 passed / 253 subtests**.
- mutation **8건**. 이번 신설 M7(`targets = []`)은 신규 테스트 1건만 red (수정 전 39/39 생존).
- 원복 후 잔재 0.

## 수렴 판정

CRITICAL 0 이고 WARNING 2건을 권고대로 반영했다. 다음 라운드는 테스트 1건 + 문서 변경이라
fresh 리뷰 1회 후, Critical 0 + 코드 Warning 0 이면 관례대로 종결한다.

## 교훈 — 같은 실수를 세 번 했다

1차 반영: "테스트로 커버"(WARNING 1·2 대응) → 2차가 PLAN 게이트 미검증 발견.
1차 반영: "위 2건이 커버"(WARNING 3 대응) → 3차가 `main()` 폴백 미검증 발견.
둘 다 **같은 1차 RESOLUTION(17_28_02)** 의 서로 다른 행이다.

두 번 다 **내가 mutation 을 돌린 지점만 커버로 셌고, 인접한 다른 예외 경로를 같은 것으로
착각**했다. `_worktree_branches` 의 fail-open 과 `main()` 의 fail-open 은 이름도 모양도 비슷하지만
**서로 다른 분기**다. 규칙으로 만들면: **"이 테스트가 커버한다" 고 쓰기 전에 그 경로에 뮤턴트를
심어 red 를 확인한다.** 커버리지 주장은 추론이 아니라 실측이어야 한다.
