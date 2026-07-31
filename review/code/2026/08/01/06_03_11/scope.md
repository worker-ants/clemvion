# 변경 범위(Scope) 리뷰 — deps-guard-hardening (10차 라운드, `06_03_11`)

## 검토 방법

이번 라운드 페이로드는 2개 파일(`review/code/2026/08/01/05_36_28/testing.md`,
`scripts/check-override-floors.py`)뿐이다. `git diff origin/main...HEAD --stat` 로 대조한
결과 이 브랜치의 `origin/main` 대비 누적 diff는 `review/code/**` 를 제외해도 12개 파일
(`.claude/tests/*` 3개, `.github/dependabot.yml`, `.github/workflows/*.yml` 2개,
`PROJECT.md`, `plan/in-progress/deps-guard-hardening.md`, `pnpm-workspace.yaml`,
`scripts/check-override-floors.py`)이라, 이번 라운드 페이로드는 그 부분집합이다. `plan/
in-progress/deps-guard-hardening.md` 를 열어 이 브랜치의 승인된 스코프(§1 오버라이드 바닥
침식 검출)를 확인하고, `git log`·`git show e18fc7227 -- scripts/check-override-floors.py`
로 이번 라운드가 검토해야 할 **실제 신규 델타**(최신 커밋, "9차 리뷰 조치")를 직접 대조했다.

## 발견사항

- **[INFO]** 이번 라운드 페이로드는 브랜치 누적 diff의 부분집합이라 CI/설정 파일
  (`.github/workflows/deps-security-checks.yml`, `.github/dependabot.yml`,
  `pnpm-workspace.yaml`, `PROJECT.md`)과 짝이 되는 테스트 파일(`.claude/tests/
  test_override_floors.py`)은 이번 스코프 판정 대상에서 빠져 있다.
  - 위치: 프롬프트 "## 리뷰 대상 파일" 목록 자체(파일 1·2, 2개뿐)
  - 상세: `.claude/**` 제외는 5~9차 testing/scope 리포트가 이미 밝힌 라우터 정책과 일치하지만,
    `.github/workflows/*.yml`·`.github/dependabot.yml`·`pnpm-workspace.yaml`·`PROJECT.md`
    는 그 정책으로 설명되지 않는 누락이다(프롬프트 크기 제한에 의한 것으로 추정 — 이전
    라운드들의 "산출물 42개 중 41개 생략" 패턴과 같은 계열). 이 4개 파일에 대한 스코프
    판정은 이번 리포트 범위 밖이며, 별도로 확인이 필요하면 그 파일들을 포함한 재요청이
    필요하다.
  - 제안: 조치 불요(기록 목적) — 다만 최종 push 전 스코프 판정은 이 4개 파일도 포함해
    한 번은 확인할 것을 권장.

- **[INFO]**(긍정 관측) `scripts/check-override-floors.py` — 프롬프트의 diff 는 `origin/main`
  기준 누적 diff라 파일 전체(1~386줄)가 "신규"로 표시되지만, 이번 라운드가 실제로 새로
  검토해야 할 델타는 최신 커밋(`e18fc7227`, "9차 리뷰 조치")뿐이다. `git show e18fc7227 --
  scripts/check-override-floors.py` 로 직접 대조한 결과 그 커밋의 실제 변경은 정확히 3곳
  — (1) `override_target()` 에 공백-유령-대상 검출 추가, (2) `load_override_targets()` 의
  `except` 절 위에 `OSError` 근거 주석 추가, (3) `run_audit()` 에 `except OSError` 분기
  추가 + 주석 재배치 — 이고, 이는 커밋 메시지가 밝힌 범위(W1 pnpm 부재 fail-closed · W2
  공백 유령 대상 · INFO4/5 주석 위치)와 정확히 일치한다.
  - 위치: `scripts/check-override-floors.py:119-129`(`override_target()` 의
    `_INNER_SPACE.search(name)` 분기), `:144`(`OSError` 근거 주석),
    `:189-193`·`:207-212`(`run_audit()` 의 재배치된 주석과 신규 `except OSError` 분기)
  - 상세: 이 3곳 외에는 `classify_vulnerable()`/`main()`/`_report_widened()`/
    `_report_eroded()`/모듈 docstring/`EXPECTED_SUPPRESSED_PATHS` 등 나머지 전부 이전
    라운드(1~8차)에서 이미 스코프 검증이 끝난 상태 그대로다. 새 임포트 없음, 포맷팅만의
    변경 없음, `codebase/**` 등 무관 영역 접촉 없음. `EXPECTED_SUPPRESSED_PATHS`/`widened`
    축은 plan 문서의 "개발 중 실측으로 드러난 것" 절이 밝히듯 §1 구현 도중 가드 자신의
    조용한 통과 실패 모드로 발견돼 같은 스코프(§1) 안에서 고친 것이지, 별도 기능 확장이
    아니다 — 5~9차 scope 리뷰 5회가 이미 이 축을 문제삼지 않았다.
  - 제안: 조치 불요. 검증 기록 목적.

- **[INFO]**(긍정 관측) `review/code/2026/08/01/05_36_28/testing.md` — 코드 리뷰 산출물의
  정규 저장 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 있고, 같은 세션
  (`05_36_28`)의 나머지 산출물(`SUMMARY.md`/`meta.json`/`documentation.md` 등 9개)과 함께
  같은 커밋(`e18fc7227`)에 번들돼 있다. 직전 9차 스코프 리뷰가 지적한 문제(커밋
  `f46c560e9` 가 8차 세션의 **미완료** 산출물 6개를 엉뚱한 커밋에 쓸어담은 것)와 달리, 이
  번 커밋은 `05_36_28` 세션 파일만 담아 다른 라운드 파일이 섞이지 않았다 — 재발이 없다.
  - 위치: `review/code/2026/08/01/05_36_28/testing.md` 전체(신규 파일, 게이트 1-139)
  - 상세: `git show --stat e18fc7227` 로 대조 — 이 커밋에 포함된 `review/code/**` 10개
    파일 전부 `05_36_28/` 하위이며 다른 타임스탬프 디렉터리 파일은 없다.
  - 제안: 조치 불요.

## 요약

이번 10차 라운드 페이로드(2개 파일)에서 의도 이상의 변경·불필요한 리팩토링·요청하지 않은
기능 확장·무관한 파일 수정·의미 없는 포맷팅·불필요한 주석/임포트/설정 변경은 발견되지
않았다. `scripts/check-override-floors.py` 는 `origin/main` 대비 누적 diff라 전체가
"신규"로 표시되지만, 이번 라운드가 실제로 새로 검토할 델타(최신 커밋 `e18fc7227`)는 `git
show` 로 직접 대조한 결과 커밋 메시지가 밝힌 범위(공백 유령 대상 fail-closed · pnpm 부재
`OSError` 포섭 · 주석 재배치)에 정확히 국한된다. `review/.../05_36_28/testing.md` 는 리뷰
산출물의 정규 위치·관례에 맞게 같은 세션 파일들과만 번들돼 있어 직전 라운드가 지적한
"타 라운드 산출물 혼입" 패턴의 재발도 없다. 다만 이번 페이로드가 브랜치 전체 누적 diff의
부분집합(CI 워크플로·dependabot·`pnpm-workspace.yaml`·`PROJECT.md`·테스트 파일 미포함)
이라는 점은 투명성을 위해 INFO 로 기록한다 — 최종 push 전 한 번은 그 파일들을 포함한
스코프 확인이 필요하다.

## 위험도

NONE — Critical·Warning 없음. 검토된 2개 파일의 실질 변경은 plan 문서(`plan/in-progress/
deps-guard-hardening.md` §1)와 직전 라운드 리뷰가 요구한 조치 범위에 정확히 국한되며,
리뷰 산출물 번들링도 정규 관례를 따른다. 유일한 기록 사항(페이로드가 브랜치 전체 diff의
부분집합)은 코드 변경 자체의 문제가 아니라 이번 리뷰 인스턴스의 커버리지 한계다.
