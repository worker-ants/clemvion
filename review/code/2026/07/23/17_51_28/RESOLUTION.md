# RESOLUTION — review/code/2026/07/23/17_51_28

대상: branch `claude/push-guard-worktree-scope-20044c`, 커밋 `4a516b03a`.
판정: **RISK=MEDIUM / CRITICAL=0 / WARNING=2 / INFO=16**. forced 7/7 확보(누락 0).
`summary_written=false` 라 main 이 `SUMMARY.md` 직접 기록.

## WARNING 2건 — 둘 다 반영, 둘 다 내가 직접 재현했다

### 1. `_run_gate` per-target fail-open 불변식 무검증 (testing, MEDIUM 근거)

리뷰어가 mutation(`continue` → `return False`)을 직접 돌려 **38/38 green** 을 확인했다.
main 재현 결과 **동일**. 즉 "첫 target 평가에서 예외가 나면 나머지 target 을 검사하지 않고 게이트
전체를 통과" 시키는 회귀를 잡는 테스트가 **없었다**.

이건 단순 커버리지 구멍이 아니라 **이 PR 이 닫으려는 것과 같은 클래스의 false-ALLOW** 다 —
cwd(첫 target)의 우연한 내부 오류만으로 실제 push 대상이 미검사 통과된다.

**조치**: `_REVIEW_STUB` 에 `STUB_RAISE_PATHS` 를 추가하고
`test_per_target_fail_open_still_checks_remaining_targets` 신설 — cwd 는 raise, 명령이 언급한
branch 의 worktree 는 dirty. 훅이 두 번째 target 까지 도달해 block 해야 한다.

재실측: 같은 mutation 이 이제 **그 테스트 1건만** red (이전 38/38 green).

### 2. `_run_gate(base_cwd)` 죽은 파라미터 (maintainability·documentation, 3인 독립 지적)

`base_cwd` 를 넘기지만 본문에서 쓰지 않는다(legacy fallback 을 `os.getcwd()` 로 바꾸면서 남은
잔재). 인접 주석이 `base_cwd` 를 언급해 scoped 분기가 그걸 쓰는 듯한 인상까지 줬다.

**조치**: 파라미터 제거. 남은 두 인자는 **키워드 전용**(`is_blocked=` / `render=`)으로 바꿔
호출부에서 역할이 드러나게 했다(INFO 11 동반 해소). 주석도 "legacy fallback 은 인자 없이 호출하므로
**프로세스 cwd** 를 평가한다" 로 정정. `base_cwd` 는 이제 `main()` 안에서만 쓰인다.

## INFO 16건 — 미조치 (근거)

- **해소 확인형 4건**(INFO 1~4): 1차 WARNING 반영이 코드 레벨로 확인됨. 특히 INFO 3 은 리뷰어가
  `_lib/` 를 직접 열어 **`cwd` 인자가 git 서브프로세스 체인 전체로 전파됨**을 확인 — 1차의
  "diff 범위 밖이라 미확인" 우려가 해소됐다.
- **선택적 테스트 3건**(INFO 5·6·7): 다중-branch dedup, detached HEAD porcelain, `_harness`
  헬퍼 통일. 전부 리뷰어가 "선택" 분류. 현재 mutation 매트릭스가 실질 표면을 덮는다.
- **문서 2건**(INFO 8·9): 모듈 상단 docstring 요약, `guard_review_before_stop.py` 제외 근거.
  1차에서도 보류했고 근거는 plan 에 있다.
- **나머지**(INFO 10~16): 테스트 헬퍼 중복, 인라인 주석, import 위치 영향, spec 부재(정상),
  scope 확인 — 전부 비차단.

## 검증

- 신규 테스트 **18 → 19건**. harness 전체 **486 passed / 253 subtests**.
- mutation 재실측: `continue` → `return False` 가 **1건만** red (수정 전 0건).
- 원복 후 잔재 0.

## 수렴 판정

CRITICAL 0 이고 WARNING 2건을 리뷰어 권고대로 반영했다. 다음 라운드는 코드가 실질 변경됐으므로
fresh 리뷰 1회를 돌리고, Critical 0 + 코드 Warning 0 이면 관례대로 수렴한다.

## 교훈

**리뷰어가 mutation 을 돌려 "생존" 을 보고하면 그건 커버리지 의견이 아니라 실측 결함이다.**
이번 두 라운드 모두, 내가 "mutation 으로 검증했다" 고 적은 뒤에도 리뷰어가 **내가 안 건드린
불변식**(1차: PLAN 게이트 스코핑, 2차: per-target fail-open)에서 생존 뮤턴트를 찾아냈다.
내 mutation 집합이 "내가 의도한 분기" 에 편향돼 있었다 — 추출한 헬퍼의 **불변식마다** 뮤턴트를
하나씩 두는 편이 낫다.
