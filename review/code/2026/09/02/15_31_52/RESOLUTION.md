# RESOLUTION — frontend 타입체크 ratchet 리뷰 3라운드

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **2** · INFO 7

**WARNING 2건 조치.** 둘 다 **이 PR 이 겨냥하는 실패 클래스가 이 PR 안에서 다시 난 것**이다 —
2R 과 같은 패턴이고, 그 사실 자체가 이 게이트가 필요한 이유이기도 하다.

## W1 (maintainability) — 가드를 만들면서 그 가드가 막는 실수를 했다

`test_workflow_run_inputs_covered.py` 가 자매 모듈에서 `filter_covers_file` 은 **import 해
놓고** `_tracked_files` 는 **다시 썼다.** 그리고 이미 갈려 있었다 — 자매는
`out.split("\n")` + 빈 줄 필터, 내 사본은 `splitlines()` 였다.

지금은 결과가 같지만, 이 파일의 docstring 이 스스로 *"같은 목적의 독립 사본이 조용히
갈린다"* 를 막겠다고 적고 있다. **한 줄 위에서 import 한 것과 같은 성격의 헬퍼를 그 아래에서
복제했다.**

자매의 `_tracked_files` 를 import 하도록 바꿨다.

## W2 (documentation) — 같은 누락이 세 곳에서 났다

frontend exclude 목록을 서술하는 산문 두 곳이 여전히 **3항목**(`src/test/**`·`*.test.ts(x)`·
`**/__tests__/**`)만 나열했다 — 실제는 5항목이다. 특히 README 는 **같은 문단 안에서** 뒷문장
(*"the test-file predicate omitted `.spec.ts(x)`"*)과 정면으로 모순됐다.

2R 에서 코드와 `PROJECT.md` 는 고쳤는데 **이 둘을 안 봤다.** 같은 누락의 세 번째다.

**숫자를 맞추는 것으로 끝내지 않았다** — 두 산문 모두 정본(`FRONTEND_EXCLUDE_SAMPLES` +
`FrontendExcludeCoverageTest`)을 가리키게 했다. *"세는 일은 코드에 맡긴다"* 고 적어, 다음
사람이 산문을 보고 개수를 세지 않게 했다.

그리고 **전수로 확인했다** — 저장소에서 이 목록을 나열하는 자리를 전부 훑어(`__tests__/**` 가
나오는 모든 산문) 남은 누락이 없음을 셌다. 한 곳씩 고치다 세 번을 낸 뒤라, 이번엔 열거로 0 을
만들었다.

## 미조치 (INFO 7건)

- **#1** `harness-checks.yml` 의 `tsconfig.typecheck.json` 등재가 과다 트리거 — 리뷰어도
  *fail-safe 방향, 차단 사유 아님*. 근거 주석은 정확하므로 둔다.
- **#2** 다른 `test_*.py` 를 import 하는 첫 사례 — W1 조치로 **의도적으로 늘렸다.** 결합점이
  생기는 대신 사본이 사라진다. 이 저장소의 이력상 후자가 더 비쌌다.
- **#3** `tsconfig.typecheck.json` 의 `"//"` 가 배열 형태 — 그 파일은 근거가 길어 배열이
  읽힌다. 기능 무영향.
- **#4** 4단 중첩 루프 — 확장 시 분리. 지금은 한 화면에 들어온다.
- **#5** `tempfile` 정리 — 1R·2R·3R 연속 "우선순위 낮음" 판정. OS temp 라 기능 위험 없음.
- **#6** `_PATH_TOKEN` 고립 단위 테스트 — 통합 테스트가 실제 워크플로로 이미 태우고,
  가드 자신의 자기 검사(`test_the_guard_would_catch_a_missing_entry`)가 매처를 양방향으로
  건다. **미조치이며 우선순위 판단**이다.
- **#7** 액션 태그 핀·`sys.path` 중복·리터럴 중복·backend 리팩터 — 세 리뷰어가 각각 근거를
  갖춰 조치 불요로 판정.

## 검증

lint **PASS** · harness **1121 passed / 1254 subtests** · frontend ratchet **52/15 일치**.
