# 부작용(Side Effect) Review — harness-review-gate-ci-backstop

대상 커밋: `f2896147b` (`.claude/tests/README.md`, `.claude/tests/test_review_gate_ci.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`).
`git diff origin/main...HEAD`로 6개 파일 전부를 프롬프트 번들과 바이트 단위로 대조 확인했다
(번들에 잘린 파일 없음 — 전부 "전체 파일 컨텍스트"로 제공됨).

## 발견사항

- **[INFO]** 신규 외부 네트워크 호출 — CI 백스톱을 위해 `git fetch`가 새로 추가됨
  - 위치: `.github/workflows/review-gate.yml:48-50` (`actions/checkout` `fetch-depth: 0`), `:57-58` (`git fetch --no-tags origin "${{ github.base_ref }}"`)
  - 상세: 이 PR 은 새 워크플로를 도입하므로 이전에 없던 네트워크 호출(전체 히스토리 checkout + base ref fetch)이 관련 PR마다 발생한다. `_default_branch()`/merge-base 계산에 실제로 필요한 것이라 "의도치 않은" 호출은 아니지만, 체크리스트 7번(네트워크 호출) 항목이라 명시한다. 트리거가 `pull_request`(≠ `pull_request_target`)이고 스크립트가 `gh`/API 호출 없이 로컬 git 명령만 쓰므로, 포크 PR에 대한 시크릿 노출 위험은 없음을 확인했다.
  - 제안: 조치 불필요(설계상 필요한 호출). 문서화만으로 충분.

- **[INFO]** `_load_gate()`의 `sys.path`/`sys.modules` 캐싱 — 프로세스 재사용 시 전역 상태 오염 소지
  - 위치: `scripts/check-review-gate.py:61-74` (`_load_gate`, 특히 69행 `import review_guard`)
  - 상세: `_load_gate(root)`는 `sys.path`에 `root`의 `.claude/hooks/_lib` 등을 얹은 뒤 `import review_guard`한다. 현재는 CLI(`if __name__ == "__main__"`, 119-120행)와 테스트(`test_review_gate_ci.py`)가 **항상 새 서브프로세스**로만 이 스크립트를 구동하므로 실질적 영향은 없다(실측: 13개 테스트 전부 subprocess 경유, in-process import 없음). 다만 `review_guard`는 `sys.modules`에 이름으로 캐싱되므로, 이 함수가 **한 프로세스 안에서 서로 다른 `root`로 두 번 호출**되는 사용처가 미래에 생기면 두 번째 호출은 새 경로가 아니라 첫 호출 때 캐싱된 모듈을 그대로 반환한다 — 정확히 이 저장소가 `_lib` 네임스페이스 충돌·`_harness.load_module_by_path` 도입으로 반복해서 겪은 것과 같은 부류의 함정이다. 오늘 자체는 결함이 아니라 잠재 위험.
  - 제안: 재사용 금지를 docstring에 한 줄 명시하거나(예: "always invoked as a fresh process; do not import `_load_gate` twice in-process with different roots"), 향후 in-process 재사용이 생기면 `sys.modules.pop("review_guard", None)`로 캐시를 비우는 방어를 추가.

- **[INFO]** 신규 워크플로에 `permissions:` 블록 미명시
  - 위치: `.github/workflows/review-gate.yml:37-45` (`jobs.gate`, 파일 전체에 `permissions:` 없음)
  - 상세: 이 job 은 `gh`/`actions/github-script` 등 `GITHUB_TOKEN`을 실제로 쓰는 단계가 없어(체크아웃 + 로컬 스크립트 실행뿐) 리포지토리 기본 토큰 권한으로도 무해하다. 다만 최소권한을 코드로 못박는 관례(`permissions: contents: read`) 대비 이 파일만 비어 있어, 조직 기본값이 나중에 넓어지면 이 워크플로가 그 확대를 그대로 상속한다.
  - 제안: `permissions: { contents: read }`를 명시해 조직 기본값 변경과 무관하게 고정.

- **[INFO]** 봇 예외가 `dependabot[bot]` 리터럴 1건만 커버
  - 위치: `.github/workflows/review-gate.yml:44` (`if: github.actor != 'dependabot[bot]'`)
  - 상세: 실측 — 최근 200개 커밋의 author 를 집계하면 `worker-ants`(사람) 185건, `dependabot[bot]` 15건뿐이고 그 외 봇 계정은 없다(`git log --format='%an <%ae>' -200 | sort | uniq -c`). 즉 현재는 이 하드코딩이 실질적 gap 이 아님을 측정으로 확인했다. 다만 관측 모드가 끝나고 `--enforce`로 전환된 뒤 새 자동화 계정(예: 다른 봇/서비스 계정)이 codebase PR을 열면, plan 문서가 dependabot에 대해 이미 기술한 것과 동일한 실패 클래스(면제 없는 워크플로 = 그 계정 전용 알람)가 재발할 수 있다.
  - 제안: 현재는 조치 불필요. `--enforce` 전환 결정 시점에 이 가정(봇 계정 목록)을 재측정 항목으로 plan에 남겨두면 좋음.

## 검증 방법 (실측)

- **판정자 단일성**: `scripts/check-review-gate.py`가 `re`/`glob`/`subprocess`/`open`/`os.walk`를 금지하는 `OneJudgeTest`가 실제로 **작동하는지** 별도 스크래치 백업 후 원본에 `import re as _re; _PUSH_RE = _re.compile(...)`를 주입하는 뮤테이션을 가하고 재실행 → `test_the_script_performs_no_judgement_operations_of_its_own`이 실제로 RED 로 전환됨을 확인(`AssertionError: 're' unexpectedly found in {...}`). 이후 원본으로 복원, `git diff`가 다시 빈 상태임을 재확인했다. 이는 이 PR의 핵심 불변식("두 번째 판정 로직을 들이지 않는다")이 말뿐이 아니라 실제로 집행됨을 뜻한다.
- **테스트 격리성(부작용 없음)**: `test_review_gate_ci.py`의 13개 테스트를 `python3 -m unittest discover`로 실행 전/후 `$TMPDIR` 목록을 diff하여 임시 디렉터리가 남지 않음을 확인했고, 실행 전후 `git status --porcelain`이 이 리뷰 산출물 디렉터리 외에는 비어 있음을 확인했다(즉 이 스위트는 실제 저장소 상태를 건드리지 않는다).
- **시그니처/인터페이스 무변경**: `git diff origin/main...HEAD --stat`로 변경 파일 6개를 한정하고, `review_guard.py`(공유 판정 함수의 실제 정의)가 그 목록에 없음을 확인했다. `check-review-gate.py`가 호출하는 `evaluate_review(root)`는 기존 push 훅과 동일하게 `in_flight_ok` 를 생략(`False` 기본)해 hard-gate 의미를 그대로 쓰고 있음을 `review_guard.py:942-958`에서 직접 대조했다.
- **환경 변수**: `scripts/check-review-gate.py`에 `os.environ`/`getenv` 호출이 전혀 없음을 grep으로 확인. 테스트 파일의 `os.environ` 사용 3곳은 전부 서브프로세스에 넘기는 **복사본**(`dict(os.environ)`, `{**os.environ, ...}`)이라 테스트 프로세스 자신의 환경을 변경하지 않는다.
- **harness-checks.yml 자기 정합성**: 새로 등록한 `scripts/check-review-gate.py` 경로가 `test_harness_checks_paths_coverage.py`(26개 테스트) 기준을 통과함을 재실행으로 확인 — 이 PR이 스스로 만든 "단독 수정 시 CI 미기동" 클래스에 해당하지 않는다.
- 전체 harness 스위트(825개)를 1회 완주해 이 diff 로 인한 회귀가 없음을 확인했다(위 뮤테이션 관련 1건 제외 — 뮤테이션은 내가 주입하고 복원한 것으로, 최종 diff는 비어 있다).
- 참고(부작용 아님, 방법론 투명성 메모): 뮤테이션 검증 도중 이 워크트리의 파일 상태가 두 차례 예상과 다르게 관측됐다(직접 수정하지 않은 `.github/workflows/review-gate.yml`의 `run:` 줄에 일시적으로 `--enforce`가 붙어 있는 것을 한 번 목격했고, 별도 시점에 내가 넣은 뮤테이션이 사라져 있는 것도 목격했다) — 이 워크트리에 대한 동시 접근(다른 세션/IDE 등)으로 보이며, 매번 `git status`는 다시 clean 으로 자연 복귀했고 최종 `git diff`도 비어 있다. 이 리뷰의 결론은 `git diff origin/main...HEAD`로 고정한 커밋 내용에 근거했으며 위 일시적 요동의 영향을 받지 않았다.

## 요약

이번 변경은 로컬 push 훅과 **동일한** `review_guard.evaluate_review()`를 재사용하는 순수 부가(additive) CI 백스톱으로, 기존 공유 함수(`review_guard.py`)의 시그니처·인터페이스를 전혀 건드리지 않고 새 스크립트/워크플로 2개만 추가한다. 8개 점검 관점을 모두 확인한 결과: 의도치 않은 상태 변경·전역 변수 신설·파일시스템 부작용·시그니처 변경·기존 인터페이스 파손·환경 변수 오독/오기·이벤트-콜백 변경은 발견되지 않았고(테스트 스위트의 hermetic 격리는 실측으로 검증), 유일하게 존재하는 신규 네트워크 호출(`git fetch`)은 설계상 필요한 것이며 안전한 트리거(`pull_request`)를 쓴다. 남은 항목은 전부 INFO 등급 — 오늘 재현되지 않는 잠재 위험(`_load_gate`의 `sys.modules` 캐싱), 방어심화 제안(`permissions:` 명시), 그리고 측정으로 이미 무해함이 확인된 가정(봇 예외 목록) 하나뿐이다. "판정자는 하나"라는 이 PR의 핵심 주장은 AST 기반 가드가 실제로 집행하고 있음을 뮤테이션으로 직접 확인했다.

## 위험도

LOW
