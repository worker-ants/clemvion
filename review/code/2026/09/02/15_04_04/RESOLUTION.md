# RESOLUTION — frontend 타입체크 ratchet 리뷰 2라운드

대상 SUMMARY: 위험도 **MEDIUM** · Critical **0** · Warning **3** · INFO 8

**WARNING 3건 전부 조치 + INFO 1건.** 두 testing WARNING 은 성격이 다르다 — 하나는 **내
코드의 미검증 분기**, 다른 하나는 **1R 을 인스턴스로만 고친 것**이다. 후자가 더 무겁다.

## W1 (testing) — 가장 흔한 실전 경로가 무증거였다

`run_tsc()` 의 세 fail-closed 분기는 테스트했는데, 정작 **진단이 있는 정상 실패**(tsc 가
비-0 + stdout 에 진단)는 어떤 테스트도 태우지 않았다.

리뷰어가 뮤테이션으로 실증했고 **직접 재현했다**: `:112` 에서 `and not out.strip()` 을 떼도
**35/35 GREEN**.

그 회귀가 들어오면 baseline 이 비어 있지 않은 한 게이트는 타입 오류 유무와 무관하게 **CI 에서
영구 exit 2** 가 된다. 판단 불가가 상시화되면 아무도 그 게이트를 신뢰하지 않고, 결국 꺼진다 —
이 저장소가 정확히 그렇게 3개월간 lint 게이트를 잃은 적이 있다.

대조군 테스트를 넣었다(`returncode=2` + 실제 진단 → stdout 을 **그대로** 반환). 같은 뮤턴트를
다시 걸어 **RED 1** 확인.

## W2 (testing) — 1R 의 CRITICAL 을 손으로만 고쳤다

1R CRITICAL #2("게이트가 자기 자신을 트리거하지 못한다")는 pathspecs 를 손으로 등재해 고쳤고
**재발 방지 가드는 만들지 않았다.** `harness-checks.yml` 은
`test_harness_checks_paths_coverage.py` 가 지키는데, 정작 **실제 검증을 수행하는** 패키지
워크플로들에는 대응 가드가 없었다.

**인스턴스가 아니라 클래스를 닫았다** — `test_workflow_run_inputs_covered.py` 신설.
워크플로의 `run:` 이 이름으로 부르는 저장소 파일이 그 워크플로 자신의 `changes.pathspecs` 에
덮이는지 전수 확인한다.

설계에서 세 가지를 의도했다:

- **워크플로 목록을 손으로 들지 않는다** — `changes` 잡의 존재를 판별 기준으로 삼는다.
  이름을 나열하면 다음 워크플로가 조용히 빠진다.
- **`filter_covers_file` 을 자매 모듈에서 재사용** — GitHub 의 segment-bounded `*` 를 두 가드가
  똑같이 모델링해야 한다. 사본을 만들면 이 PR 이 고친 바로 그 drift 다.
- **전제 테스트 + 자기 검사** — 추출기가 통째로 깨지면 실패하고, 매처가 실재하지 않는 경로를
  덮은 것으로 판정하면 실패한다. "위반 0건" 은 검사가 도는 증거가 아니다.

**가드가 실제로 무는지 확인했다**: 1R CRITICAL 상태를 복원(pathspecs 에서
`check-frontend-typecheck-ratchet.py` 제거)하니 그 파일을 정확히 지목해 **RED**.

> 부수 발견 — 신규 테스트가 실 저장소로 `git ls-files` 를 부르자 하네스가 **"왜 임시 저장소가
> 아닌가" 를 등재하라**고 막았다. 정당한 요구라 사유와 함께 등재했다. 이 저장소는 자기 가드에
> 대해서도 같은 규율을 요구한다.

## W3 (documentation) — README 가 이 PR 이 겪은 회귀를 서술하지 않았다

옆 행들은 "어떤 사고를 재발 방지하는가" 를 구체적 클래스명으로 적는데 내 행만 일반론이었다.
세 회귀(route group 파싱 · 모듈 이중 적재 · exclude 규칙 비대칭)와 대응 테스트 클래스를 각각
서술했고, 신규 `test_workflow_run_inputs_covered.py` 행도 등재했다.

## INFO #6 — PROJECT.md 서술 보강

frontend 게이트 행이 `tsconfig.json` 의 exclude 중 `*.spec.ts(x)` 를 빠뜨렸다. 동작엔 영향이
없지만 **W1(2R)에서 고친 것과 같은 누락**이라 함께 맞췄다.

## 미조치

- **INFO #1**(`TEST_FILE_RULES` 를 `RatchetConfig` 필드로) — 1R 에서 판단한 트레이드오프.
  리뷰어도 *"현행 유지 가능, 세 번째 패키지 추가 시 재검토"*.
- **INFO #2·#4·#8**(`sys.path` 중복 · 리터럴 중복 · 전역 patch 스코프) — 리뷰어 전부 조치 불요.
- **INFO #3**(CI YAML 미통합) — 리뷰어 스스로 *"job 2개로는 이득 작음"*.
- **INFO #5**(`load_baseline` 의 non-dict 최상위 케이스) — **미조치이며 우선순위 판단**이다.
  두 분기가 같은 `undecidable()` 로 수렴해 fail-closed 방향이고, 위 W1 처럼 "통과로 흘러가는"
  성격이 아니다.
- **INFO #7**(backend 리팩터 확장) — 1R·2R 모두 근거 충분으로 조치 불요 판정.

## 검증

lint **PASS** · harness **1121 passed / 1254 subtests** ·
frontend ratchet **52/15 일치** · backend ratchet **199/38 일치** ·
뮤테이션 **2축**(정상 실패 경로 RED 1 · pathspec 누락 복원 RED 1, 둘 다 조치 전 GREEN).
