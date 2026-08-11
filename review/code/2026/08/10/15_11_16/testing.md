# 테스트(Testing) 리뷰

## 핵심 판정 — 갱신된 가드가 `--strict-peer-dependencies` 누락을 실제로 잡는가

**잡는다. 단순 기대값 맞추기가 아니다.** 뮤테이션 검증으로 실측했다.

검증 방법: `.claude/tests/test_pnpm_workspace_action.py::install_run_block()` 이 `action.yml` 의
`run:` 블록 문자열을 **실제로 파싱해 추출**하고, `run_install()` 이 그 문자열을 bash 로 실행해
PATH 상의 `pnpm` 스텁이 받은 `argv` 를 되돌려준다. 즉 이 테스트는 "기대값 vs 기대값"이 아니라
"YAML 에 적힌 진짜 셸 명령 vs 그 명령이 실제로 내보내는 인자" 를 비교하는 실행 검증이다.
그래서 다음과 같이 뮤테이션(회귀 시뮬레이션)을 실행해 판정했다:

```
REAL BLOCK:    pnpm install --frozen-lockfile --strict-peer-dependencies --filter "$FILTER"
MUTATED BLOCK: pnpm install --frozen-lockfile --filter "$FILTER"   (← --strict-peer-dependencies 제거, 회귀 이전 상태)

REAL argv:    [...,'--strict-peer-dependencies', ...] == expected? True
MUTATED argv: [...] (플래그 없음)                        == expected? False
```

`install_run_block()` 로 얻은 실제 문자열에서 `--strict-peer-dependencies ` 를 제거해
"회귀 이전" 상태를 재현하고 동일한 bash+스텁 파이프라인에 태운 결과, mutated 케이스에서
`argv` 가 기대 리스트와 어긋나 **`assertEqual` 이 실패**하는 것을 확인했다(실제 저장소 파일은
건드리지 않고 추출된 문자열만 메모리에서 치환 — `.claude/tests/test_pnpm_workspace_action.py`
의 헬퍼를 그대로 재사용). 따라서 이 가드는 `--strict-peer-dependencies` 가 install 줄에서
빠지는 순간(예: 향후 누군가 `action.yml` 을 손으로 고치다 실수로 지우는 경우) 실제로 RED 가
된다 — 계약 갱신이 "테스트가 통과하도록 기대값만 맞춘" 것이 아니라 회귀를 잡는 실효성 있는
가드로 유지됐다.

부가로 `test_the_filter_arrives_as_one_argument` 의 `ARGC=4→5` 갱신도 검산했다: 새 인자 리스트
`install, --frozen-lockfile, --strict-peer-dependencies, --filter, <scope>` 는 정확히 5개이므로
수치 갱신이 맞다. 또한 전체 스위트(12개 테스트, `InstallCommandTest`+`WiringTest`+
`ConsumerBindingTest`) 를 현재 저장소 상태로 실행해 전부 `OK` 임을 확인했다 — 회귀 테스트로서
유효하다.

## 발견사항

- **[WARNING]** 신규 주석의 "8개 워크플로가 이 action 하나를 거치므로" 수치가 같은 PR 의 테스트가
  계산하는 실제 값과 다르다 — 실측(같은 파일의 `ConsumerBindingTest.consumers()` 를 직접 호출)
  결과 이 액션의 실제 소비자는 **9개 잡 / 5개 워크플로 파일**(`backend-checks.yml`
  ×3잡, `frontend-checks.yml`, `packages-checks.yml`, `spec-link-checks.yml`,
  `web-chat-checks.yml` ×3잡)이다. `8` 이라는 숫자는 파일 상단 모듈 docstring(비변경 영역)의
  "`#1114` 시점 저장소 전체 워크플로 8개/잡 14개" 문구에서 온 것으로 보이는데, 그건 저장소
  전체 워크플로 파일 수이지 **이 액션의 소비자 수가 아니다**. 같은 PR 의 테스트
  (`test_there_are_consumers`, `>=9` 로 잡 수를 고정)가 이미 정답을 계산하고 있음에도, 새로
  추가된 산문 주석 2곳이 그와 다른 숫자를 반복해 박아 넣었다 — 테스트가 SoT 로 검증하는 수치와
  주석의 서술이 어긋나면, 다음에 소비자가 늘거나 줄 때 사람이 주석만 보고 오판할 위험이 있다.
  - 위치: `.github/actions/pnpm-workspace/action.yml:72` (`8개 워크플로가 이 action 하나를 거치므로 한 줄이 전부를 덮는다.`)
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:93` (`... 8개 워크플로가 이 action 을 거치므로 한 줄이 전부를 덮는다`)
  - 제안: `9개 잡 / 5개 워크플로`(또는 그냥 `9개 잡`, 이미 파일 상단 docstring·모듈 상단에서 쓰는
    표현과 통일)로 정정. 이런 수치는 `test_there_are_consumers` 의 `len(self.consumers())` 결과를
    유일한 근거로 삼도록 통일하면 향후 드리프트를 막을 수 있다.

- **[WARNING]** `pnpm-workspace.yaml` 새 주석이 `--strict-peer-dependencies` 게이트의 실제
  소재지를 `.github/workflows/deps-security-checks.yml` 로 지목하는데, 실측 결과 그 워크플로는
  `pnpm install` 자체를 전혀 실행하지 않는다(`pnpm audit --audit-level=moderate`,
  `check-pnpm-security-config.py`, `check-override-floors.py` 세 잡뿐이며 어느 것도 install 을
  하지 않음). 실제로 이 플래그가 실행되는 유일한 지점은 `.github/actions/pnpm-workspace/action.yml`
  이고, 그것을 쓰는 워크플로 목록은 위 항목과 같다(`deps-security-checks.yml` 은 그 목록에 없음
  — `grep -l "uses: ./.github/actions/pnpm-workspace" .github/workflows/*` 로 직접 확인). 이
  서술을 SoT 로 믿으면 향후 이 게이트의 커버리지를 확인하려는 사람이 엉뚱한 파일을 본다.
  - 위치: `pnpm-workspace.yaml:126-127`
  - 제안: `(.github/actions/pnpm-workspace/action.yml — backend-checks.yml·frontend-checks.yml·
    packages-checks.yml·spec-link-checks.yml·web-chat-checks.yml 5개 워크플로/9개 잡이 소비)` 로
    정정.

- **[INFO]** `scripts/check-pnpm-security-config.py` 는 `overrides`/`onlyBuiltDependencies`/
  `auditConfig.ignoreCves` 세 설정만 baseline 대조하고, 이번에 `pnpm-workspace.yaml` 에 문서화된
  `peerDependencyRules`(현재는 키 자체가 없어 대조 대상도 없음)는 범위 밖이다. 이 스크립트의
  존재 이유가 정확히 "설정 파일에서 억제/예외 목록이 조용히 추가·완화되는 것을 막는다"인데,
  지금 상태는 `peerDependencyRules` 가 생기기 전까지는 문제 없지만, 새로 도입될 때
  `EXPECTED_IGNORED_CVES` 처럼 함께 갱신해야 한다는 강제(2-place 규약)가 아직 코드로 걸려 있지
  않다. `ignoreCves` 에 대해서는 이미 이 규율이 있으므로 대칭을 맞추는 것이 좋다.
  - 위치: `scripts/check-pnpm-security-config.py` (해당 클래스 없음 — 파일 전체가 대상), 관련
    문서화는 `pnpm-workspace.yaml:135-138`
  - 제안: `peerDependencyRules` 를 실제로 도입하는 시점에 `check-pnpm-security-config.py` 에
    `EXPECTED_PEER_RULES` 류의 baseline 대조를 함께 추가하도록 해당 plan 항목이나 주석에
    명시적으로 남겨 둘 것(지금 당장 코드 변경을 요구하는 것은 아님 — 키가 없는 지금은 대조할
    대상도 없다).

## 요약

핵심 판정: 갱신된 가드(`test_pnpm_receives_frozen_lockfile_and_the_filter`)는 `action.yml` 의
`run:` 블록을 실제 bash 로 실행하고 스텁이 받은 `argv` 를 비교하는 실행 검증이라, `--strict-peer-dependencies`
를 문자열 치환으로 제거하는 뮤테이션에 대해 실측으로 RED 가 남을 확인했다 — 단순 기대값 맞추기가
아니라 실효성 있는 회귀 가드다. `ARGC=4→5` 보조 단언도 수치가 정확하고, 전체 12개 테스트가 현재
상태에서 전부 통과해 회귀 테스트로서 유효하다. 다만 이번 diff 가 함께 추가한 산문 주석 2곳(수치
"8개 워크플로", 게이트 소재지 "deps-security-checks.yml")은 같은 PR 의 테스트가 실측하는 값과
어긋난다 — 테스트 자체의 결함은 아니지만, 주석을 SoT 로 믿을 향후 독자(테스트 작성자 포함)를
오도할 수 있어 정정을 권한다. `peerDependencyRules` 의 미래 baseline 가드 부재는 지금은 대조
대상이 없어 급하지 않은 INFO 로 남긴다.

## 위험도
LOW
