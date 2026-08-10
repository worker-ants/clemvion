# Requirement Review — `--strict-peer-dependencies` 5-site 게이트 (3라운드, `15_41_41`)

## 재판정 지시 사항: 직전 WARNING("5곳 중 4곳 무가드")이 `test_install_gate_flags.py` 로 실제로 닫혔는가

**결론: 닫혔다.** 직접 실행 + 저장소 전수 재검색으로 아래를 독립 검증했다.

- `python3 -m pytest .claude/tests/test_install_gate_flags.py -q` → `4 passed, 5 subtests passed`.
- `python3 -m pytest .claude/tests/test_pnpm_workspace_action.py -q` → `12 passed, 15 subtests passed` (`ConsumerBindingTest` 만 골라 돌려도 `9 subtests` — plan/주석이 주장하는 "9개 잡" 과 일치, `git grep -n "uses: ./.github/actions/pnpm-workspace" .github/workflows/*.yml` 로 9회/5파일 직접 셈).
- `SITES` 5곳(`action.yml`, `test-stages.sh`, backend/frontend/`playwright-e2e` Dockerfile ×3) 각각을 `Read` 로 열어 `pnpm install --frozen-lockfile --strict-peer-dependencies …` 형태로 실제 존재함을 확인.
- **등재 목록이 실제 호출부와 일치하는지**를 가드 자신의 pathspec(`.github .claude codebase Makefile scripts`)보다 **넓게** — 전체 저장소(`git grep -l "pnpm install"`, 경로 제한 없음)로 재검색해 대조했다. `k8s/`, `docker-compose*.yml`, `.githooks/`, `README.md`, `PROJECT.md`, `plan/**`, `scripts/*.py` 등 가드가 안 보는 영역에서 `pnpm install` 을 언급하는 파일들을 전부 열어봤지만, 실제 실행 줄은 하나도 없었다(`README.md:149`/`PROJECT.md`= 사람이 읽는 설치 안내 문장, `scripts/check-*.py` = 사용자 메시지 문자열, `codebase/backend/migrations/Dockerfile` = flyway 베이스라 pnpm 자체가 없음). 즉 5곳 목록이 **완전**하다.
- 가드가 실행 줄만 잡고 주석은 거르는지도 별도 확인: `.github/dependabot.yml`, `.github/workflows/backend-checks.yml:136`, `pnpm-workspace.yaml` 자신의 새 주석 모두 `pnpm install` 을 언급하지만 전부 `#` 주석이라 `install_lines()` 가 걸러낸다(테스트가 초록인 것으로 실측 확인 — 이 세 파일이 `found` 집합에 들어갔다면 `test_the_search_actually_finds_the_known_sites` 가 즉시 RED 를 냈을 것).
- 비-vacuity 가드(`test_the_search_actually_finds_the_known_sites`)가 별도로 존재해 "grep 이 아무것도 못 찾아 항상 초록" 형태의 실패 모드를 스스로 차단한다 — 이 저장소가 과거 여러 번 겪은 vacuous-guard 클래스에 대한 선제 방어.
- 뮤테이션 논리를 코드 경로로 직접 추적(반복 실행으로 저장소를 건드리지 않기 위해 실제 뮤테이션은 재실행하지 않고 assert 문 자체를 읽어 확정): `KnownSitesCarryBothFlagsTest` 는 `assertIn(flag, line)` 이라 5곳 중 아무 곳에서나 플래그 하나가 빠지면 그 자리에서 RED, `TheSiteListHasNotGoneStaleTest` 는 `assertEqual(found - known, set())` / `assertEqual(found, known)` 이라 목록에서 항목을 빼거나(실 사이트가 남아 있으면) 새 실행 지점이 생기면 대칭적으로 RED. 직전 라운드 RESOLUTION 이 보고한 "뮤테이션 3/3 RED" 주장과 코드 자체의 assert 형태가 정합한다.

즉 "5곳 중 4곳 무가드" WARNING 은 실질적으로 닫혔고, 새로 5곳을 정적으로 대조하는 가드가 실제로 5곳 전부를 겨냥하며, 등재 목록도 실제 호출부와 일치한다.

## 발견사항

- **[INFO]** spec 누락 — 이 변경 영역(`--strict-peer-dependencies` 게이트, install 호출부 5곳)은 `spec/` 어디에도 정의돼 있지 않다(`grep -rl "strict-peer-dependencies\|frozen-lockfile\|pnpm install" spec/` = 0건).
  - 위치: 해당 없음 (spec 문서 부재)
  - 상세: 이 변경은 제품 spec 이 아니라 CI/dev 하네스 인프라(`.claude/`, `.github/`, `Dockerfile`, `pnpm-workspace.yaml`)이므로 spec 미보유가 정상이다. spec-fidelity 관점의 결함은 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `_is_execution_site` 의 `.py` 전체 배제는 "파이썬이 실제로 `pnpm install` 을 실행한다면 `subprocess.run(["pnpm","install",…])` 형태라 문자열 매치 자체가 안 맞는다"는 근거를 코드 docstring에 명시하고 있고, 저장소 전수 검색(`shell=True`/`os.system`/`subprocess.call` 조합)으로 반례가 없음을 확인했다. 현재는 사각지대가 아니지만, 향후 파이썬 스크립트가 `shell=True` 로 `"pnpm install …"` 문자열을 직접 실행하는 형태가 생기면 이 가드의 사각지대가 된다.
  - 위치: `.claude/tests/test_install_gate_flags.py` `_is_execution_site` (라인 100-107)
  - 상세: 현재 시점에는 실측으로 반증된 리스크이므로 결함이 아니다. 다만 설계 한계로서 문서화는 이미 잘 돼 있다(코드 docstring 자체가 근거를 남김).
  - 제안: 조치 불필요 — 참고 사항으로만 기록.

- **[INFO]** `pnpm-workspace.yaml` 의 `peerDependencyRules` 예외 목록이 "비어 있는 것이 정상"이라는 주석이 실제 파일 상태(키 자체 부재)와 일치함을 확인했다. plan(`deps-peer-gating-and-eslint10.md`) §1 체크리스트도 동일 내용으로 갱신돼 있어 문서 간 정합이 유지된다.
  - 위치: `pnpm-workspace.yaml:134-145`
  - 상세: 검증만, 결함 없음.

CRITICAL/WARNING 급 발견사항 없음.

## 요약

직전 라운드(`15_23_40`)의 requirement WARNING("5곳 중 4곳 무가드")은 이번 라운드에서 `test_install_gate_flags.py` 신설로 실질적으로 닫혔다. 직접 테스트를 실행하고, 가드 자신의 검색 범위보다 넓은 저장소 전수 재검색으로 대조한 결과 (1) 가드가 실제로 5곳 전부를 겨냥하고, (2) 등재된 `SITES` 목록이 현재 저장소의 실제 `pnpm install` 실행 지점과 정확히 일치하며(6번째 지점 없음), (3) 주석-전용 언급을 실행 줄로 오인하는 오탐도 없고, (4) 비-vacuity 자가검증까지 갖춰 "grep 이 아무것도 못 찾아 조용히 통과" 하는 실패 모드도 차단돼 있음을 확인했다. 새로운 CRITICAL/WARNING 은 없다.

## 위험도

NONE
