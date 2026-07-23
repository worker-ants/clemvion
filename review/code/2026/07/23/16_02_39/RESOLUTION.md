# RESOLUTION — §F 잔여 (I3 e2e paths + W5 dependabot 등록 가드)

리뷰: `review/code/2026/07/23/16_02_39/SUMMARY.md` — RISK=LOW, Critical 0, **Warning 4**.
forced 7명 전원 확보(`forced_missing: []`).

## Warning (4) — 전부 반영

### W1 (Testing) — 가드가 자기가 막으려는 사각지대를 재현했다

`_independent_trees()` 가 `fnmatch` 로 워크스페이스 glob 을 매칭했다. pnpm(micromatch)의 단일
`*` 는 `/` 를 넘지 않는데 **`fnmatch` 의 `*` 는 `.*` 로 변환돼 경로 구분자를 넘는다**.

**재현**: `fnmatch("codebase/packages/foo/bar", "codebase/packages/*")` → `True`.
즉 `codebase/packages/<pkg>/<sub>/package.json` 같은 2단계 중첩 독립 트리가 생기면 실제로는
워크스페이스 밖인데 "covered" 로 오분류돼 **dependabot 미등록이 영구 무신호**로 남는다 —
이 가드가 막으려는 사고 그 자체다.

**수정**: `_glob_to_regex()` 로 pnpm 의미론 구현(`*`→`[^/]*`, `**`→`.*`, `?`→`[^/]`, 나머지 escape).

**테스트 설계 주의**: 처음엔 `_glob_to_regex` 만 겨냥하는 테스트를 넣었는데, 그러면
`_independent_trees` 가 `fnmatch` 로 되돌아가고 헬퍼가 미사용으로 남아도 통과한다(저장소에
중첩 트리가 없으므로 다른 어떤 테스트도 눈치채지 못한다). → **합성 중첩 트리를 주입해 분류기
자체를 겨냥**하는 `test_classifier_actually_uses_these_semantics` 추가. fnmatch 되돌림 뮤턴트로
포착 확인.

### W2 (Testing/Requirement) — 파서가 텍스트 주입 불가 + 인라인 주석에서 항목 유실

`directory:` 정규식이 `$` 앵커라 `directory: "/foo" # note` 형태에서 **매칭 실패 → 항목 조용히
손실**(재현 확인). fail-loud 이긴 하나 "미등록" 으로 보여 원인 추적에 혼선.

**수정**: 두 파서를 `_parse_*(text)` 로 분리해 **합성 문자열 주입 가능**하게 하고(파일 읽기는 얇은
래퍼), 값 파싱을 따옴표 3종(`"`/`'`/무인용) + `_TRAILING_COMMENT` 허용으로 교체.
`ParserEdgeCaseTest` 3건(인용·주석 혼합 / 인라인 주석 / 비-npm ecosystem 무시) 추가.

### W3 (Testing) — I3 에 상응하는 회귀 가드 부재 → **의도적으로 별건 분리**

W5 는 전용 가드를 만들었는데 I3(e2e paths)는 값만 고쳤다. 리뷰어는 "추가하거나 최소한 backlog
화" 를 제안했고 **backlog 를 택했다**: 이 PR 이 이미 손수 짠 YAML 파서 2개로 지적(W1·W2)을 받은
상태라, 세 번째 파서(PROJECT.md 목록 파싱)를 같은 diff 에 얹는 건 **같은 실패 클래스를 늘리는**
선택이다. `harness-guard-followups.md` §F 에 사유·접근법(파서를 텍스트 주입 가능하게 짜고
fixture 로 경계 먼저 고정)까지 적어 등재했다.

### W4 (Documentation) — README "What's covered" 미등재

`.claude/tests/README.md` 표에 `test_dependabot_npm_coverage.py` 행 추가(무엇을 지키는지 +
왜 `fnmatch` 가 아닌지).

> 표 자체의 drift(현재 8개 파일 미등재)는 이 PR 밖 **선재** 문제다. 카탈로그 무결성 가드는
> 백로그 B2 로 따로 잡혀 있고, 신규 테스트 파일들이 머지된 뒤 한 번에 등재하는 편이 맞다.

## INFO 중 반영한 것

- #6 `e2e.yml` 주석이 "GitHub 은 paths-ignore 에서 특정 경로만 예외 처리하는 문법을 제공하지
  않는다" 고 단정했으나 `!` 부정 패턴이 존재한다 → "부정 패턴으로도 가능하나 순서 규칙이
  미묘해 명시적 수동 트리거를 택했다" 로 완화. **틀린 근거를 남기면 다음 재판단자를 오도한다.**

## INFO 중 미반영(사유)

- #1 pnpm negation glob(`!pattern`) 미지원: 현재 `pnpm-workspace.yaml` 에 negation 이 없다.
  방어적 assertion 은 없는 문법에 대한 추측 방어라 지금은 과설계 — 도입되면 그때 대응.
- #2 `.github/**` ignore 로 required status check 가 트리거되지 않는 GitHub 동작: 브랜치 보호
  규칙은 저장소 설정이라 코드로 확인 불가. 트레이드오프는 이미 diff·plan 에 명시.
- #3 `workflow_dispatch` 가 원 요청보다 넓다: 리뷰어 스스로 "정당화된 최소 확장" 판정.
- #4 두 파서의 따옴표 벗기기 중복: 이번 수정으로 인용 처리가 정규식 alternation 안으로 들어가
  형태가 달라졌다. 무리한 공통화보다 각자 명시가 낫다.
- #5 `harness-checks.yml` 트리거 확대로 무관 PR 도 job 을 태움: 가드가 두 파일을 대조하므로
  **필요한** 트레이드오프. 리뷰어도 "조치 불요".

## 검증

- `test_dependabot_npm_coverage.py` **12건**, 전체 하네스 스위트 **388건 OK**
  (#991 line-anchor 코드 포함 — rebase 후 실행).
- 뮤턴트: 분류기를 `fnmatch` 로 되돌림 → `test_classifier_actually_uses_these_semantics` 포착 ✓.
- `e2e.yml`·`harness-checks.yml`·`dependabot.yml` YAML 파싱 확인.

## 부수 — reverse-diff 오염 처리

리뷰 준비 직전 `git fetch` 로 로컬 `origin/main` 이 #991(line-anchor 게이트)까지 진행돼,
`origin/main..HEAD` 가 **내가 건드리지도 않은 30여 파일의 되돌림**을 포함했다. 그 상태로
준비된 세션(`15_59_49`)은 폐기하고 브랜치를 rebase 한 뒤 재준비했다(`16_02_39`).
fork-point == origin/main 확인, 실제 변경 4파일.
