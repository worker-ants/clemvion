# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `push` 트리거에서 `paths:` 필터가 통째로 제거되면서, `push` 이벤트는 항상 "관련 있음(`relevant=true`)"으로 fail-safe 처리된다 — 관련 경로 필터링이 사실상 사라짐
  - 위치: `.github/workflows/deps-security-checks.yml:29-30` (`on.push`), `.github/workflows/frontend-checks.yml:19-20` (`on.push`), `scripts/ci-paths-changed.sh:47-52` (`GITHUB_EVENT_NAME != "pull_request"` 분기)
  - 상세: `scripts/ci-paths-changed.sh` 는 `PR_BASE_SHA`/`PR_HEAD_SHA` 를 `pull_request` 이벤트에서만 워크플로 `env:` 로 주입받는다. `push` 이벤트에서는 이 값이 없으므로 스크립트는 `GITHUB_EVENT_NAME != "pull_request"` 분기(47-52행)로 빠져 **무조건 `relevant=true`** 를 낸다. 그런데 개편 전에는 `push.paths` 에 별도 경로 목록이 있어 `main` 에 머지된 커밋이 실제로 관련 파일을 건드렸을 때만 잡이 돌았다. 이번 diff 는 그 `push.paths` 를 그대로 삭제했을 뿐 push 전용 diff 비교(`github.event.before`/`github.event.after` 등)로 대체하지 않았다. 결과적으로 이제는 **`main` 으로 가는 모든 push**(예: `spec/**`·`plan/**` 만 건드리는 머지)에서도 `pnpm audit`(외부 레지스트리 질의), `pnpm install --frozen-lockfile`, `pnpm --filter frontend build` 등이 무조건 실행된다. required-check 데드락은 PR 을 막는 **pull_request** 트리거에서만 발생하는 문제이므로(이미 머지된 `push` 는 아무것도 막지 않는다), 이 광역화는 이 변경의 목적(required check 데드락 해소) 범위를 넘어서는 부수효과이고, 이를 검증하는 테스트도 없다(`test_required_check_skip_jobs.py`/`test_workflow_yaml_structure.py` 모두 `on.pull_request` 만 검사).
  - 제안: `push` 이벤트에도 `github.event.before`/`github.event.after` 를 `env` 로 넘겨 `ci-paths-changed.sh` 가 실제 diff 를 계산하게 하거나, 최소한 이 광역화가 의도적임을 워크플로 주석에 명시하고 회귀 가드(예: `push.paths` 부재가 실수인지 검증하는 테스트)를 추가한다.

- **[WARNING]** `changes` 잡이 실패(단순히 "무관"이 아니라 checkout/스크립트 자체가 에러로 실패)하면 `needs: changes` 로 묶인 다운스트림 잡은 GitHub Actions 기본 동작상 `skipped` 로 보고된다 — 이 설계가 명시적으로 피하려 한 "skip 이 required check 를 만족시키는지 모호하다"는 바로 그 상태를 재현한다
  - 위치: `scripts/ci-paths-changed.sh:16-18` (skip-잡 대신 skip-스텝을 택한 근거 서술), `.claude/tests/test_required_check_skip_jobs.py:13-16` (동일 근거), `.github/workflows/deps-security-checks.yml:71,94,118` (`needs: changes`), `.github/workflows/frontend-checks.yml:52` (`needs: changes`)
  - 상세: 이 변경 전체의 핵심 근거는 "잡을 skip 하면 conclusion 이 `skipped` 인데 그것이 required check 를 만족하는지 문서상 모호하니, 잡은 항상 success 로 끝내고 스텝만 게이팅한다"는 것이다(`ci-paths-changed.sh` 16-18행, `test_required_check_skip_jobs.py` 13-16행). 그런데 그 전제 조건은 `changes` 잡 자신이 **항상 성공**한다는 것에 의존한다 — `changes` 잡은 `ci-paths-changed.sh` 가 다루지 못하는 이유(예: `actions/checkout@v7` 자체의 네트워크 타임아웃/일시적 GitHub 장애, `emit()` 이 `$GITHUB_OUTPUT` 에 쓰다 실패하는 경우 등, 이는 `set -euo pipefail` 아래에서 스크립트를 즉시 종료시킨다)로 실패할 수 있고, 그 경우 `needs: changes` 를 가진 `config-guard`/`audit`/`override-floors`/`test-and-build` 는 기본 조건(`success()`)에 의해 **skip** 된다. 즉 이 설계가 "잡 skip 은 위험하니 쓰지 않는다"고 선언해 놓고도, `changes` 잡의 실패라는 한 가지 경로를 통해 바로 그 skip 상태가 다운스트림 잡에 그대로 전파될 수 있다 — required check 가 다시 모호한 `skipped` 상태로 남을 수 있는 잔여 경로이며, 이를 검증하는 테스트도 없다.
  - 제안: 다운스트림 잡에 `if: always() && needs.changes.result != 'cancelled'` 류의 조건을 추가해 `changes` 잡이 실패해도 잡 자체는 (실패로) 명시 보고되도록 하거나, 최소한 이 잔여 리스크를 워크플로/스크립트 주석에 알려진 한계로 기록한다.

- **[INFO]** 이번 개편으로 이전에는 무관한 PR 에서 아예 트리거되지 않던 워크플로가, 이제는 관련성 판정을 위해 **모든** PR·push 에서 `fetch-depth: 0` 전체 히스토리 checkout 을 최소 1회 수행한다
  - 위치: `.github/workflows/deps-security-checks.yml:50-53`(`changes` 잡의 `actions/checkout@v7` + `fetch-depth: 0`), `.github/workflows/frontend-checks.yml` 동일 패턴(`changes` 잡)
  - 상세: 개편 전에는 `on.pull_request.paths`/`on.push.paths` 필터로 인해 무관한 변경이면 워크플로 자체가 실행되지 않아 GitHub Actions 리소스·네트워크 비용이 0이었다. 개편 후에는 관련성 판정 자체를 위해 모든 PR·push 마다 `changes` 잡이 전체 히스토리를 클론한다. 이는 required-check 데드락을 없애기 위한 의도된 트레이드오프로 코드 주석(`scripts/ci-paths-changed.sh` 파일 상단)에 이미 서술돼 있어 "의도치 않은" 부작용은 아니지만, CI 리소스·시간 사용량이 실질적으로 늘어나는 변화이므로 인지 목적으로 기록한다.
  - 제안: 조치 불필요(문서화된 트레이드오프). 다만 리소스 사용량이 우려되면 `changes` 잡에 캐시 가능한 얕은 diff 전략(예: `git fetch --deepen`)을 검토할 수 있다.

## 요약

핵심 변경(스텝 단위 게이팅 + `changes` 잡으로 required-check 데드락을 해소하는 패턴)은 `pull_request` 경로에 한해 테스트(`test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`)로 잘 고정되어 있다. 다만 부작용 관점에서 두 가지 실질적 갭이 있다: (1) `push.paths` 삭제가 push 전용 diff 로 대체되지 않아 `main` 으로 가는 모든 push 가 이제 무조건 `pnpm audit`(외부 레지스트리 호출 포함) 등을 실행하게 됐고 이는 이번 변경의 목적(PR required-check 데드락 해소) 범위를 넘어서는 광역화이며 가드도 없다. (2) `changes` 잡 자체의 실패는 다운스트림 잡을 `skipped` 로 만들어, 이 설계가 명시적으로 피하려던 "skip 이 required check 를 만족하는지 모호하다"는 상태를 잔여 경로로 재현할 수 있다. 둘 다 기능을 즉시 깨뜨리진 않지만 문서화된 설계 의도와 실제 동작 사이의 간극이며, 테스트 커버리지가 없다.

## 위험도
MEDIUM
