# 요구사항(Requirement) 리뷰

## 실측 검증 (호출자 지시사항)

호출자가 지시한 대로 plan 의 핵심 서술을 되돌리지 않고 **직접 실행**해 재판정했다.

```
$ pnpm install --strict-peer-dependencies --frozen-lockfile
...
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 4.7s using pnpm v10.23.0
$ echo $?
0
```

stdout/stderr 전체에서 `unmet peer`/`ERR_PNPM_PEER` 류 문자열 0건. `pnpm-workspace.yaml` 에도
`peerDependencyRules` 키가 없음(주석 밖에는 존재하지 않음, `grep -n peerDependencyRules
pnpm-workspace.yaml` → 주석 두 줄만 매치)을 확인했다. **plan 의 "정정(같은 날, 몇 분 뒤)" 서술 —
"규칙 없이도 exit 0, unmet peer 0건이라 억제 자체가 불필요했고 되돌렸다" — 는 실측과 정확히
일치한다.** `.claude/tests/test_pnpm_workspace_action.py` 12/12 통과도 확인(`python3
.claude/tests/test_pnpm_workspace_action.py -v`).

## 발견사항

- **[CRITICAL]** `--strict-peer-dependencies` 게이트가 실제로는 "한 줄이 전부를 덮는다"는 체크리스트의
  주장과 달리 저장소의 모든 `pnpm install` 호출부를 덮지 않는다. `.github/actions/pnpm-workspace/action.yml`
  한 곳에만 추가됐고, 아래 4개 호출부는 그대로 `--strict-peer-dependencies` 없이 남아 있다 — 그중 최소
  3곳은 이 저장소의 실제 CI/TEST WORKFLOW 경로에서 지금도 실행된다.
  - `.claude/test-stages.sh:20` (`_ensure_deps()`) — `cmd_lint`/`cmd_unit`/`cmd_build` 가 공유하는
    로컬·하니스 install 게이트. TEST WORKFLOW 를 도는 모든 세션이 거치는 경로다.
  - `codebase/backend/Dockerfile:41` — `.github/workflows/e2e.yml` 이 `docker compose -f
    docker-compose.e2e.yml build backend-e2e backend-e2e-runner` 로 **실제 CI 에서 빌드**한다
    (같은 워크플로 line 87). `.claude/test-stages.sh` 의 `_cmd_build_docker_images` 도 같은
    Dockerfile 을 로컬/TEST WORKFLOW build 단계에서 빌드한다.
  - `codebase/frontend/Dockerfile:38` — `_cmd_build_docker_images` 가 로컬/TEST WORKFLOW build 단계에서
    빌드. 프로덕션 이미지(외부 Jenkins 배포용)이기도 하다.
  - `codebase/frontend/Dockerfile.playwright-e2e:52` — `docker-compose.e2e.yml` 경유로 `make
    e2e-test-full` 이 빌드하며, `.github/workflows/e2e.yml` 의 `e2e-frontend` 잡이 그 `make` 타겟을
    **실제 CI 에서** 호출한다(line 115).
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:93` (체크리스트 완료 주장 —
    "`.github/actions/pnpm-workspace` 의 install 한 줄에 추가... 한 줄이 전부를 덮는다") /
    `.github/actions/pnpm-workspace/action.yml:82` (실제로 고친 유일한 줄) /
    `.claude/test-stages.sh:20`, `codebase/backend/Dockerfile:41`, `codebase/frontend/Dockerfile:38`,
    `codebase/frontend/Dockerfile.playwright-e2e:52` (놓친 4곳).
  - 상세: `#1049` 사고(eslint-plugin-unicorn 이 요구하는 `eslint>=10.4` 위에 9.39.4 가 설치된 채
    "경고만 내고" 머지)를 다시 못 나게 막는 것이 이 plan §1 의 존재 이유인데, 위 4개 install 호출부
    중 어느 하나로만 도달 가능한 미충족 peer(예: 특정 워크스페이스에서만 재현되는 조합)는 여전히
    "경고만 내고 조용히 통과"한다 — 정확히 원 사고의 재발 형태다. 이 저장소 자체의 오래된 규율
    ("게이트가 조용히 안 도는 실패", `.github/actions/pnpm-workspace/action.yml` 상단 docstring 이
    `--frozen-lockfile` 에 대해 명시적으로 경계하는 바로 그 클래스)과도 정면으로 충돌한다.
    `scripts/check-e2e-playwright-config.py` 는 이 Dockerfile 들의 COPY 목록·버전 정렬만 검사하고
    `RUN pnpm install` 줄의 플래그는 검사하지 않으므로, 이 갭은 어떤 기존 가드로도 잡히지 않는다
    (`grep -n "RUN\|pnpm install" scripts/check-e2e-playwright-config.py` → 0건).
  - 제안: 4개 호출부 각각에 `--strict-peer-dependencies` 를 추가하거나(가장 단순), 의도적으로
    제외한다면 그 이유(예: 이미 다른 잡에서 같은 워크스페이스 서브셋을 검증하므로 중복이라는 논거)를
    plan/주석에 명시. 체크리스트 문구 "한 줄이 전부를 덮는다" 는 실제로 5개 워크플로/9개 잡만
    덮는다는 뜻이므로 과장 표현을 정정. 재발 방지를 원하면 `test_pnpm_workspace_action.py` 류의
    "받는 쪽 인자 확인" 패턴을 각 Dockerfile/`test-stages.sh` 에도 적용하는 가드를 별도 후속으로
    고려.

- **[WARNING]** `pnpm-workspace.yaml` 의 새 주석이 peer 게이트의 시행 위치를 실제와 다른 워크플로로
  지목한다.
  - 위치: `pnpm-workspace.yaml:126-127`
    (`# pnpm install --strict-peer-dependencies 를 CI 게이트로 둔다` / `# (.github/workflows/deps-security-checks.yml)...`)
  - 상세: `deps-security-checks.yml` 을 열어 보면 잡은 `changes`/`config-guard`/`audit`/`override-floors`
    넷뿐이고, 그중 어느 것도 `pnpm install` 을 실행하지 않는다 — `audit` 잡은 `pnpm audit`(주석 자체가
    "node_modules 설치 불요" 라 명시)만 돌고, `config-guard`/`override-floors` 는 python 스크립트만
    돈다(`grep -n "pnpm-workspace$\|actions/pnpm-workspace" .github/workflows/deps-security-checks.yml`
    → 0건). 실제로 `--strict-peer-dependencies` 가 실행되는 곳은 `.github/actions/pnpm-workspace/action.yml`
    을 `uses:` 로 부르는 5개 워크플로(`frontend-checks.yml`·`backend-checks.yml`·`packages-checks.yml`·
    `web-chat-checks.yml`·`spec-link-checks.yml`)다. 같은 PR 안에서 `plan/in-progress/
    deps-peer-gating-and-eslint10.md:93` 체크리스트와 `.github/actions/pnpm-workspace/action.yml` 자체
    주석은 정확히 composite action 을 지목하는데, `pnpm-workspace.yaml` 만 다른 파일을 인용해 정보가
    갈라졌다.
  - 제안: `pnpm-workspace.yaml:127` 의 인용을
    `` `.github/actions/pnpm-workspace/action.yml`(frontend/backend/packages/web-chat/spec-link 5개
    워크플로가 공유) `` 로 정정.

- **[INFO]** `spec/` 전역에서 `strict-peer-dependencies`·`peerDependencyRules`·`pnpm-workspace`·
  `deps-guard-hardening`·`frozen-lockfile` 를 검색해도 매치가 없다(`grep -rl ... spec/` → 0건). 이
  변경은 CI/의존성 하니스 영역이라 `spec/` 관할 밖으로 판단되며, 이는 CLAUDE.md 의 "spec/ = 제품
  정의·기술 명세" 범위와 일관된다. spec fidelity 관점에서 별도 조치 불필요.

- **[INFO]** `.claude/tests/test_pnpm_workspace_action.py` 의 클래스 docstring(변경 없이 유지된 부분)이
  "저장소에서 `--frozen-lockfile` [+ `--strict-peer-dependencies`] 의 **유일한** 소재지"라고 주장하는데,
  `--frozen-lockfile` 단독으로는 이미 `codebase/backend/Dockerfile`·`codebase/frontend/Dockerfile`·
  `codebase/frontend/Dockerfile.playwright-e2e`·`.claude/test-stages.sh` 에도 존재해 문언 그대로는
  부정확하다. 다만 이 문구는 이번 diff 이전부터 있던 서술을 그대로 확장한 것이라(`--frozen-lockfile` 단독
  주장은 이 PR 이전부터), 신규 결함이라기보다 기존 관용구의 연장으로 보인다 — 위 CRITICAL 항목과 같은
  근본 원인이므로 별도 fix 는 불필요하고 CRITICAL 항목 해소 시 자연히 문구도 재검토될 것.

## 요약

이 PR 이 닫으려는 두 체크리스트 항목 중 "§1 nunjucks→chokidar 미충족 처분" 은 호출자 지시대로
`pnpm install --strict-peer-dependencies --frozen-lockfile` 을 직접 실행해 exit 0·unmet peer 0건을
확인했고, plan 의 "정정" 서술(선결 조건이 실측으로 반증돼 억제를 넣었다가 되돌렸다)은 정확하다 —
이 부분은 신뢰할 수 있다. 그러나 두 번째 항목 "§1 `--strict-peer-dependencies` 게이트 도입" 은
체크리스트가 완료로 표시하고 "한 줄이 전부를 덮는다" 고 주장하는 것과 달리, 같은 클래스의 사고
(`#1049`)를 재발시킬 수 있는 4개의 다른 `pnpm install` 호출부(로컬 하니스 `_ensure_deps`, backend/
frontend 프로덕션 Dockerfile, playwright e2e Dockerfile — 이 중 3곳은 이 저장소의 실제 CI 에서
지금도 실행됨)가 게이트 없이 남아 있어 기능 완전성 요구를 충족하지 못한다. 부차적으로
`pnpm-workspace.yaml` 의 새 주석이 게이트 시행 위치를 실제와 다른 워크플로 파일로 잘못 인용해
문서 신뢰도를 떨어뜨린다. 테스트(12/12) 자체는 diff 가 건드린 범위(composite action 한 줄) 안에서는
정확하고 통과한다.

## 위험도

HIGH
