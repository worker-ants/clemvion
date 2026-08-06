# Scope Review — CI 백스톱 라운드 12 (15_16_43)

## 방법론 메모

프롬프트에 실린 15개 파일은 모두 "전체 파일 컨텍스트"(diff 아님)로, 여러 라운드에 걸쳐 누적된 최종 상태다. 이번 라운드(12R)에서 실제로 무엇이 바뀌었는지 판정하기 위해, 직전 리뷰 세션(`review/code/2026/08/06/14_38_16`, 커밋 `9a7b28764` 시점)과 현재 HEAD(`9c270100f`) 사이의 실 diff 를 별도로 확인했다:

```
git diff --stat 9a7b28764 9c270100f -- ':!review/**'
```

결과: 코드/문서 변경은 정확히 6개 파일뿐이다.

```
.claude/_shared/git_probe.py                          |  40 ++--
.claude/hooks/_lib/plan_guard.py                      |   2 +-
.claude/tests/test_plan_guard.py                      |   7 +-
.claude/tests/test_review_gate_ci.py                  |  14 +-
.claude/tests/test_review_guard_hardening.py          | 139 ++++++++++
plan/in-progress/harness-review-gate-ci-backstop.md   |  15 +-
```

나머지 9개 파일(`branch_guard.py`, `review_guard.py`, `tests/README.md`, `test_block_integrity.py`, `test_stop_guard_failopen.py`, `test_workflow_yaml_structure.py`, `harness-checks.yml`, `review-gate.yml`, `scripts/check-review-gate.py`)은 이번 라운드에서 **바이트 단위로 무변경**(`git diff` 출력 없음) — 이전 라운드에서 이미 스코프 리뷰된 컨텍스트로만 실렸다. 판정은 이 6개 파일에 집중한다.

이번 라운드가 응답하는 두 사건은 CONTEXT/커밋 메시지로 명시돼 있다: (A) `actions/checkout` 위상에서 백스톱이 무력했던 CRITICAL(11R), (B) 그 CRITICAL 을 재현하려던 테스트 픽스처가 워크트리 공유 `.git/config` 를 실제로 오염시킨 사고(12R 복구+경화).

## 발견사항

- **[INFO]** `plan_guard.py` 주석의 "다섯 개" → "이" 로 개수 표현 삭제는 이번 라운드의 두 목표(A/B) 어느 쪽에도 속하지 않는 부수 정정
  - 위치: `.claude/hooks/_lib/plan_guard.py:102` (`# These git probes now live in ...`)
  - 상세: `_shared/git_probe.py` 로 옮겨진 프로브가 다섯 개가 아니라 실제로는 여섯 개(9R 이 다섯 개, 10R 이 `_current_branch` 를 추가로 발견)라는 사실을 11R SUMMARY 가 `[W6]`로 지적했고, 이번 diff 는 그 지적에 응답해 "five" 라는 부정확한 숫자를 지웠을 뿐이다(숫자를 "six" 로 정정한 것도 아니고 통째로 뺐다). 코드 동작에는 전혀 영향 없는 1줄·1단어 주석 수정이며, 11R 리뷰가 명시적으로 남긴 결함(`[W6]`)에 대한 정직한 응답이므로 "요청 밖의 임의 수정"으로 보기는 어렵다. 다만 이번 라운드의 핵심 커밋 메시지(“actions/checkout 위상 무력화” · “픽스처 config 오염 복구”) 어디에도 이 수정이 언급되지 않아 diff 를 눈으로만 보면 무관해 보일 수 있다는 점만 기록한다.
  - 제안: 조치 불필요. 다음에 유사한 드라이브바이 주석 정정을 할 때는 커밋 메시지에 한 줄이라도 언급해 두면 스코프 추적이 쉬워진다.

- **[INFO]** `git_probe.py::_default_branch` 수정에 로직 변경과 무관한 사소한 정리(dead `if True:` 제거, `except Exception:` 뒤 `# noqa: BLE001` 추가)가 같은 hunk 안에 섞여 있음
  - 위치: `.claude/_shared/git_probe.py:139` (`def _default_branch(cwd: str) -> str | None:`)
  - 상세: `if True:` 래핑 제거와 `noqa` 주석 추가는 그 자체로 동작을 바꾸지 않는 순수 정리이지만, 정확히 이 함수의 본체를 고치는 커밋이므로 같은 hunk 안에서 함께 손대는 것이 자연스럽다 — 별도 파일·별도 영역을 건드리는 리팩터링이 아니다. 스코프 이탈로 분류하기엔 너무 지엽적이라 CRITICAL/WARNING 이 아니라 기록만 남긴다.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 픽스처 경화가 "이 브랜치가 손댄 것"으로 정확히 스코프됨 — 확장 없음, 그러나 파일 3개/메서드 4곳이라는 표현 불일치
  - 위치: `.claude/tests/test_plan_guard.py:298`(`_git`), `.claude/tests/test_review_gate_ci.py:65`(`ReviewGateCliTest._git`)·`:704`(`TheRealGateIgnoresTheEnvironmentTest._git`), `.claude/tests/test_review_guard_hardening.py:851`(`ActionsCheckoutTopologyTest._git`)
  - 상세: `GIT_CONFIG_GLOBAL` 패턴을 쓰는 파일은 저장소 전체에서 정확히 이 3개 테스트 파일뿐이다(`grep -rl GIT_CONFIG_GLOBAL .claude/tests/` 로 확인, `README.md` 는 문서라 제외). 커밋 메시지는 "픽스처 3개"라고 부르는데 실제로는 `_git` 헬퍼가 4곳(파일 3개, 클래스 4개)에 정의돼 있다 — 개수 표현이 파일 단위였을 뿐 누락은 없다. 4곳 모두 `-C <root>` + `GIT_CEILING_DIRECTORIES` 로 일관되게 경화됐고, 같은 취약 패턴(`GIT_CONFIG_GLOBAL` 없이 `git init`)을 쓰는 저장소 내 다른 4개 파일(`test_consistency_bundle_priority.py` 등)은 손대지 않고 plan 문서(§후속 13)에 "이 티켓 범위 밖"으로 명시 등재했다 — 이는 스코프를 넓히지 않은 바람직한 판단이며 결함이 아니다.
  - 제안: 조치 불필요. (표현 정정은 선택 사항 — "3개 파일 / 4곳 메서드"로 커밋 메시지를 다음에 쓸 때 구분하면 더 정확하다.)

- **[INFO]** `ActionsCheckoutTopologyTest._git` 새 docstring 안에 공백만 있는 줄(blank-with-trailing-whitespace)
  - 위치: `.claude/tests/test_review_guard_hardening.py:851` 부근 (`_git` 메서드 docstring 두 번째 단락 앞)
  - 상세: 새로 작성된 docstring 문단 사이에 `        ` (스페이스만 있는) 빈 줄이 하나 있다. 신규 코드 내부의 스타일 흠일 뿐 기존 코드에 무관한 포맷팅을 섞은 것은 아니라서 스코프 이슈는 아니다.
  - 제안: 조치 불필요(원하면 linter/formatter 가 다음 커밋에서 정리).

이번 라운드에서 아래 항목은 명시적으로 확인했고 이상 없음:
- `codebase/**` 는 이번 diff 에 전혀 포함되지 않음 — harness 인프라(`.claude/**`)와 plan 문서만 변경. 개발자 권한 범위(`codebase/**`, `plan/**`, `review/**/RESOLUTION.md`) 내.
- import 변경 없음, 설정 파일(`.claude.project.json`, `pnpm-workspace.yaml` 등) 변경 없음.
- 새 기능 추가·API 확장 없음 — 전부 기존 함수의 버그 수정, 회귀 테스트 추가, 문서 갱신.
- `.github/workflows/*.yml` 은 이번 라운드에서 완전 무변경(이전 라운드 검토 완료 상태 그대로).

## 요약

이번 12R diff 는 6개 파일·약 200줄로 매우 좁고, 커밋 메시지가 밝힌 두 목표(actions/checkout 위상에서의 `_default_branch` 무력화 수정 + 그 재현 픽스처가 일으킨 `.git/config` 오염 사고의 복구·경화)에 정확히 대응한다. 발견된 것은 전부 INFO 수준의 지엽적 부수 변경(주석 1단어 정리, dead-code 제거+noqa, docstring 공백 줄)이며, 요청 밖 기능 추가나 무관한 파일·영역 수정, 임포트/설정 드리프트는 없다. 특히 취약한 git 픽스처 패턴을 가진 다른 4개 파일을 이번 PR 에서 고치지 않고 plan 문서에 범위 밖으로 명시 등재한 것은 스코프 규율이 잘 지켜진 사례다.

## 위험도

NONE
