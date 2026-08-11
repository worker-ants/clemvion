# 테스트(Testing) Review

## 핵심 판정 — `.github/actions/pnpm-workspace/action.yml` 대 나머지 4곳의 가드 비대칭

**결론: 가드 추가를 권고한다. "매체가 달라 과잉"이라는 항변은 근거가 약하다.**

이번 diff 는 지난 라운드(`15_11_16`)의 CRITICAL — "`--strict-peer-dependencies` 가 install
호출부 한 곳에만 있었다" — 를 다섯 곳 전부에 텍스트로 반영해 닫았다. 직접 읽어 다섯 곳 모두
플래그가 실재함을 확인했다:

- `.github/actions/pnpm-workspace/action.yml:85-87` (기존 gate)
- `.claude/test-stages.sh:20`
- `codebase/backend/Dockerfile:41`
- `codebase/frontend/Dockerfile:38`
- `codebase/frontend/Dockerfile.playwright-e2e:52`

그런데 **회귀 가드(향후 누군가 이 플래그를 실수로 지웠을 때 자동으로 RED 가 나는 장치)는 이
다섯 곳 중 `action.yml` 한 곳에만 있다** — `.claude/tests/test_pnpm_workspace_action.py:107-124`
(`InstallCommandTest.test_pnpm_receives_both_gate_flags_and_the_filter`)가 `run:` 블록을 실제
bash 로 실행해 PATH 상의 `pnpm` 스텁이 받은 argv 를 비교한다. 나머지 4곳은 이번 라운드에서
**사람이 직접 실행해 확인**(requirement/side_effect 리뷰어의 11회 install 실측)했을 뿐, 그
확인을 코드로 고정한 테스트가 없다.

이 비대칭을 "매체가 다르니 과잉"으로 볼 근거를 검토했으나 성립하지 않는다:

1. **추출 난이도가 오히려 더 낮다.** `action.yml` 은 YAML 을 파싱해 `run:` 문자열을 꺼내야
   하는데(`install_run_block()`), Dockerfile 의 `RUN pnpm install ...` 줄은 YAML 파싱조차
   필요 없는 평문 한 줄이다. Docker 의 shell-form `RUN` 은 빌더가 그대로 `/bin/sh -c` 에
   넘기는 문자열이므로, `test_pnpm_workspace_action.py` 가 이미 쓰는 "PATH 에 `pnpm` 스텁을
   놓고 bash 로 실행해 argv 를 센다" 기법을 **docker 데몬 없이** 그대로 옮길 수 있다 —
   `.claude/tests/` 의 "stdlib only" 관례와도 맞는다.
2. **`.claude/test-stages.sh` 는 로컬에서도 대부분 실행되지 않는 줄이다.** 직접 읽어
   확인했다(`.claude/test-stages.sh:18-20`):
   ```
   _ensure_deps() {
     [ -d "$(git rev-parse --show-toplevel)/node_modules" ] || pnpm install --frozen-lockfile --strict-peer-dependencies
   }
   ```
   `node_modules` 가 이미 있으면 `|| pnpm install ...` 자체가 **평가되지 않는다.** 즉 fresh
   worktree 가 아닌 한(이 저장소 관례상 fresh worktree 는 `pnpm install` 1회뿐), 이번에 넣은
   플래그는 로컬 TEST WORKFLOW 실행에서 사실상 실행되지 않는다 — "자동 신호가 없었다"는
   `#1049` 사고의 재발 조건이 이 파일에 한해 더 좁게 다시 성립한다.
3. **간접 안전망(Docker 빌드)은 "플래그 부재"를 못 잡는다.** `_cmd_build_docker_images()`
   (`.claude/test-stages.sh:83-101`)가 backend/frontend Dockerfile 을 로컬에서 실제로 빌드하고,
   `.github/workflows/e2e.yml` 이 CI 에서 세 Dockerfile 을 모두 빌드한다(side_effect 리뷰어가
   확인). 하지만 이 빌드는 **현재 unmet peer 가 0건**인 상태에서는 플래그가 있든 없든 항상
   성공한다 — `--strict-peer-dependencies` 가 통째로 삭제돼도 지금 당장은 아무것도 빨간불이
   되지 않는다. 이는 정확히 이 저장소가 반복해 이름 붙인 실패 클래스("게이트가 조용히 안 도는
   실패", `test_required_check_skip_jobs.py` 카탈로그 항목의 표현)이고, `action.yml` 을 위해
   argv 로 직접 고정한 이유(같은 파일 docstring: "문자열 존재가 아니라 실제 인자로 고정한다")가
   바로 이 실패 클래스를 막기 위해서였다. 그 근거는 나머지 4곳에도 그대로 적용된다 — 데이터
   상태(현재 unmet peer 유무)에 의존하지 않는 유일한 검증은 argv 고정뿐이다.
4. 이 갭은 이미 지난 라운드 requirement 리뷰어가 제안했으나(`plan` §1 CRITICAL 조치 항목 —
   "재발 방지를 원하면 `test_pnpm_workspace_action.py` 류의 패턴을 각 Dockerfile/
   `test-stages.sh` 에도 적용하는 가드를 별도 후속으로 고려") 이번 라운드 RESOLUTION 의
   "채택하지 않은 것" 표에는 오르지 않았고, `plan/in-progress/deps-peer-gating-and-eslint10.md`
   체크리스트(라인 92-97)에도 후속 항목으로 등재되지 않았다 — 제안이 조용히 사라질 위험이 있다.

- 위치: `.claude/test-stages.sh:20`, `codebase/backend/Dockerfile:41`,
  `codebase/frontend/Dockerfile:38`, `codebase/frontend/Dockerfile.playwright-e2e:52`
  (가드 부재) / 대조: `.claude/tests/test_pnpm_workspace_action.py:107-124` (유일하게
  존재하는 argv 고정 가드)
- 상세: 위 본문 참조.
- 제안: (a) `test_pnpm_workspace_action.py` 가 이미 증명한 "run 블록 추출 → PATH 스텁 →
  argv 비교" 기법을 재사용해 3개 Dockerfile 의 `RUN pnpm install` 줄에 대한 argv 고정
  테스트를 추가한다(docker 불필요 — 텍스트 추출 + bash 실행만으로 충분). (b)
  `.claude/test-stages.sh` 는 `_ensure_deps()` 를 그대로 테스트하려 하지 말고,
  `install_run_block()` 패턴처럼 install 커맨드 문자열 자체를 별도 상수/함수로 분리해
  조건 로직(`node_modules` 존재 확인)과 실행 로직을 분리하면 조건을 거치지 않고 인자를
  직접 검증할 수 있다. (c) 지금 당장 코드를 요구하는 게 아니라면 최소한 이 갭을
  `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트에 후속 항목으로 명시
  등재할 것 — 이 세션의 다른 리뷰 라운드가 이미 "review/** 는 SoT 아님, 미룬 항목은 plan
  에 적으라"는 교훈을 반복해서 겪었다.

## 그 외 발견사항

- **[INFO]** `test_pnpm_workspace_action.py` 자체의 갱신은 견고하다 — 뮤테이션 검증됨
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:107-124`, `:126-138`
  - 상세: 메서드명을 `test_pnpm_receives_both_gate_flags_and_the_filter` 로 갱신하고
    구 테스트(`test_pnpm_receives_frozen_lockfile_and_the_filter`)를 정확히 대체했다(잔존
    참조 0건, 직접 grep 확인). `ARGC=4→5` 갱신은 `len(argv(proc))` 로 유도하려다 자기
    자신과 비교하는 vacuous 형태가 될 뻔한 것을 리터럴로 되돌리고 그 이유를 주석으로
    남겼다(RESOLUTION #5) — 이 판단은 정확하다: `argv()` 도 같은 stdout 을 파싱하므로
    유도식으로 바꾸면 인자가 분할되는 실제 회귀도 통과시킨다. 직접 뮤테이션(action.yml
    에서 두 플래그를 문자열 치환으로 제거)으로 재현한 결과 `test_pnpm_receives_both_gate_
    flags_and_the_filter` 와 `test_the_filter_arrives_as_one_argument`(ARGC 불일치) 둘 다
    RED 가 됨을 확인했다 — RESOLUTION 이 주장한 "뮤테이션 RED 2건"과 일치한다.
  - 제안: 없음 — 이 부분은 그대로 유지.

- **[INFO]** `pnpm-workspace.yaml` 의 새 주석(라인 126-129)이 게이트 소재지를 여전히
  `action.yml` 단수로 서술
  - 위치: `pnpm-workspace.yaml:126-129`
  - 상세: "소재지는 **`.github/actions/pnpm-workspace/action.yml` 의 install 한 줄**이다"
    라고 적혀 있는데, 이번 diff 로 실제 소재지는 5곳으로 늘었다. 같은 diff 안에서
    `action.yml` 자신의 주석(라인 76-78)은 "다만 여기가 **전부는 아니다** ... 다섯 곳을
    다 짚어야 `#1049` 경로가 닫힌다"고 정확히 밝히는 반면, `pnpm-workspace.yaml` 은 그
    갱신을 안 받았다. 테스트 관점에서 이 서술은 "이 파일 하나만 보면 커버리지 전체를
    알 수 있다"는 잘못된 인상을 줘, 위 핵심 finding 의 가드 갭을 사람이 알아채기 더
    어렵게 만든다.
  - 제안: `action.yml` 주석과 동일하게 "다섯 곳 중 하나"라는 문구를 반영(문서 영역이라
    documentation 리뷰어와 겹칠 수 있음 — 테스트 커버리지 갭을 은폐하지 않는다는 점에서만
    기록).

## 요약

이번 라운드는 지난 CRITICAL(설치 호출부 4곳 누락)을 텍스트로는 다섯 곳 모두 정확히 닫았고,
`test_pnpm_workspace_action.py` 갱신 자체는 뮤테이션으로 재현 검증까지 마친 견고한 작업이다.
다만 회귀 방지라는 관점에서 보면 다섯 곳 중 한 곳(`action.yml`)만 argv 고정 테스트를 갖고
나머지 네 곳(`test-stages.sh`, Dockerfile ×3)은 "지금은 맞다"는 일회성 실측만 있고 향후
플래그가 실수로 빠져도 자동으로 잡아낼 장치가 없다 — 특히 `test-stages.sh` 의 install 줄은
`node_modules` 가 이미 있으면 로컬에서 실행조차 되지 않는 조건부 코드라 노출 빈도도 낮다.
Dockerfile 3개는 `action.yml` 이 이미 증명한 기법(run 블록 추출 + PATH 스텁 + argv 비교)을
docker 없이 그대로 옮길 수 있어 "매체가 달라 과잉"이라는 항변은 성립하지 않는다고 판단한다.
지난 라운드 requirement 리뷰어가 제안했던 이 후속 가드가 이번 RESOLUTION 에도, plan
체크리스트에도 등재되지 않아 조용히 유실될 위험이 있으므로, 최소한 plan 에 명시적 후속
항목으로 남기기를 권한다.

## 위험도

MEDIUM
