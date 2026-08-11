# 의존성(Dependency) Review

## 리뷰 범위

이 diff 는 새 패키지를 추가하지 않는다. `pnpm install` 호출부 5곳(`.github/actions/pnpm-workspace/action.yml`,
`.claude/test-stages.sh`, `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile`,
`codebase/frontend/Dockerfile.playwright-e2e`) 전부에 기존 `--frozen-lockfile` 옆에
`--strict-peer-dependencies` 를 추가하고, `pnpm-workspace.yaml` 에 그 게이트의 소재지·
`peerDependencyRules` 를 비워 둔 근거를 문서화한 것이 핵심이다. `package.json`·`pnpm-lock.yaml`
자체는 이 diff 에서 변경되지 않는다(작업 트리에서 직접 확인).

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 순수 CI/빌드 게이트 강화
  - 위치: `.github/actions/pnpm-workspace/action.yml:90` / `.claude/test-stages.sh:20` /
    `codebase/backend/Dockerfile:41` / `codebase/frontend/Dockerfile:38` /
    `codebase/frontend/Dockerfile.playwright-e2e:52`
  - 상세: `--strict-peer-dependencies` 는 pnpm 자체의 기존 플래그이고, 이 diff 는 `package.json`
    이나 `pnpm-lock.yaml` 을 건드리지 않는다(작업 트리 확인: 두 파일 모두 이번 diff 대상 파일
    목록에 없음). 라이선스·취약점·번들 크기·표준 라이브러리 대체 가능성 관점에서 평가할 "새
    패키지" 자체가 없다.
  - 제안: 조치 불필요.

- **[INFO]** dependabot PR 흐름 영향 — 미충족 peer 를 가진 major 상향이 **CI install 단계에서
  실패**로 바뀐다(다만 특정 패키지가 아니라 일반화된 방어)
  - 위치: `.github/actions/pnpm-workspace/action.yml` (`backend-checks.yml`·`frontend-checks.yml`·
    `packages-checks.yml`·`web-chat-checks.yml`·`spec-link-checks.yml` 5개 워크플로 9개 잡이
    이 action 을 통해 이 install 줄을 공유 — `grep -rc "uses: ./.github/actions/pnpm-workspace"
    .github/workflows/*.yml` 로 3+1+1+1+3=9 직접 재확인)
  - 상세: dependabot 은 `package.json`+`pnpm-lock.yaml` 을 함께 갱신하므로 `--frozen-lockfile`
    은 그대로 통과하지만, 새로 해소된 트리에서 어떤 패키지의 peer range 가 실제 설치본과
    어긋나면(`#1049` 형태 — `eslint-plugin-unicorn` 이 `eslint>=10.4` 를 요구했지만 설치본은
    9.39.4) 이제 `pnpm install` 자체가 non-zero 로 종료돼 해당 잡이 빨간불을 낸다. 종전에는
    경고만 찍고 종료 코드는 0 이라 사람이 로그를 직접 읽지 않는 한 신호가 없었다.
    다만 **`#1049` 사고의 당사자였던 `eslint-plugin-unicorn` 자체의 major 상향은 이미
    `.github/dependabot.yml` 의 `ignore: update-types: version-update:semver-major` 로
    별도 차단돼 있어** (이 diff 밖의 기존 설정), 그 특정 패키지에 대해서는 이 게이트가
    실제로 발동할 기회 자체가 봉쇄돼 있다. 즉 이번 게이트의 새 가치는 "eslint-plugin-unicorn
    을 다시 잡는 것"이 아니라 **아직 ignore 목록에 없는 다른 임의 패키지**가 같은 클래스의
    사고를 낼 때 일반적으로 잡아 주는 것이다 — 방향은 맞고 유용하지만, 헤드라인 사례
    자체는 이 diff 가 아니라 이미 존재하는 dependabot ignore + `eslint-unicorn-peer.spec.ts`
    (매니페스트 floor 대 설치본 실측)가 이중으로 막고 있다는 점은 정확히 짚어야 한다.
  - 제안: 조치 불필요 — 다만 PR 설명·plan 에 "이 게이트가 막는 것은 #1049 재발이 아니라
    #1049 *클래스*의 다른 패키지" 라고 명확히 하면 향후 오해(이 게이트 하나로 유니콘 문제도
    막혔다고 오인)를 줄일 수 있다.

- **[INFO]** dependabot PR 이 실제로 이 게이트에 막히려면 Actions required check 배선이
  전제(이 diff 범위 밖, plan 이 이미 명시적으로 스코프 제외)
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:16-18` ("Actions 가 repo 레벨에서
    꺼져 있어 dependabot PR 이 아무 검증 없이 머지된다... 저장소 설정 소관이라 파일로 못
    고치므로 여기서 다루지 않는다")
  - 상세: 이 diff 는 `pnpm install` 종료 코드를 바꿀 뿐, 그 실패가 실제로 머지를 막으려면
    (a) 해당 CI 워크플로가 GitHub Actions 에서 실행되고 있어야 하고 (b) 그 잡이 branch
    protection 의 required check 로 등록돼 있어야 한다. plan 이 이 두 전제를 저장소 설정
    소관으로 명시적으로 스코프 밖에 두었으므로 이 diff 의 결함은 아니다 — 다만 "미충족
    peer 를 가진 major 상향이 이제 실패로 잡히는가" 라는 질문에 대한 정확한 답은 "install
    잡 자체는 실패하도록 바뀌었다. 그 실패가 머지를 막는지는 이 diff 가 통제하지 않는
    별도 인프라(Actions 활성화 + required check 등록)에 달려 있다" 이다.
  - 제안: 조치 불필요(plan 이 이미 별건으로 추적 중) — 다만 이 caveat 를 plan §1 결론
    문장에 한 줄 남겨 두면 "게이트를 도입했다 = dependabot PR 이 이제 막힌다" 로 과잉
    일반화되는 것을 방지할 수 있다.

- **[INFO]** `peerDependencyRules` 를 비워 둔 선택은 실측에 근거해 타당
  - 위치: `pnpm-workspace.yaml:134-145`
  - 상세: 착수 근거였던 `nunjucks@3.2.4 → chokidar` 미충족은 (1) `chokidar` 가
    `peerDependenciesMeta.chokidar.optional: true` 로 선언돼 있어 pnpm 이 strict 모드에서도
    optional 미충족을 오류로 취급하지 않고, (2) 억제 규칙을 넣은 채로도, 뺀 채로도 동일하게
    `--strict-peer-dependencies --frozen-lockfile` → exit 0 / unmet peer 0건임을 plan 이
    실측으로 확인했다(작업 트리 실측으로도 `peerDependencyRules` 키 자체가 파일에
    부재함을 확인 — `grep -n "peerDependencyRules" pnpm-workspace.yaml` 은 주석 인용 2건뿐).
    막을 대상이 없는 억제 규칙을 넣는 것은 이 저장소의 `ignoreCves` 규약("근거를 남기고
    baseline 으로 고정")과 같은 원리로 죽은 설정이 되고, 나중에 진짜 미충족이 그 자리에
    생기면 fail-open 으로 조용히 덮는다. 넣었다가 되돌린 이력까지 plan/주석에 남겨 둔 것도
    적절하다 — "선언을 읽는 것(lockfile 의 peer 선언)"과 "돌려 보는 것(실제 install 실행)"이
    다른 측정이라는 교훈이 근거로 명시돼 있다.
  - 제안: 조치 불필요 — 결정에 동의.

- **[INFO]** 향후 `peerDependencyRules` 최초 도입 시의 근거-검증 절차가 스크립트 가드로
  강제되지 않음(2-place 규약의 비대칭)
  - 위치: `pnpm-workspace.yaml:142-145` (신규 억제 시 "실측 근거로 적을 것" 문구),
    `scripts/check-pnpm-security-config.py`(존재하지만 `peerDependencyRules` 를 대조하지 않음),
    `review/code/2026/08/10/15_11_16/RESOLUTION.md:51`("예외를 처음 넣는 시점에 함께 다룰 것
    — plan 에 등재" 라고 적었으나 `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트
    에는 해당 항목이 실제로 등재돼 있지 않음 — 전문을 읽어 확인)
  - 상세: 같은 파일의 `auditConfig.ignoreCves` 는 "값이 바뀌면 `check-pnpm-security-config.py`
    의 `EXPECTED_IGNORED_CVES` 와 **함께** 고친다(2-place 규약)" 는 스크립트 레벨 강제가 있다.
    반면 `peerDependencyRules` 는 지금 키 자체가 없어 대조할 대상이 없다는 이유로 그런 강제가
    없고, 근거만 주석 문구("왜 안전한가 를 실측 근거로 적을 것")로 남아 있다. 이 diff 시점에는
    억제 대상이 없으므로 결함은 아니지만, 다음에 억제가 실제로 필요해질 때 사람이 주석
    문구를 기억해 지키는 데에만 의존한다 — 이 저장소가 반복적으로 겪은 "손으로 지키는 규약"
    drift 클래스와 같은 모양이다.
  - 제안: 낮은 우선순위. `peerDependencyRules` 를 처음 도입하는 PR 에서
    `check-pnpm-security-config.py` (또는 신규 스크립트)에 "각 규칙에 실측 근거 주석이
    바로 위에 있는가" 정도의 최소 대조를 추가하는 것을 그 PR 범위에 포함하도록
    plan 체크리스트에 한 줄 등재 권장.

- **[INFO]** lockfile·매니페스트 정합성에 새 위험 없음
  - 위치: 5개 install 호출부 전체
  - 상세: 이 diff 는 `package.json`/`pnpm-lock.yaml` 어느 것도 수정하지 않는다. 5곳 전부
    이미 `--frozen-lockfile` 을 갖고 있었고(diff 전 상태), 이번 변경은 그 옆에
    `--strict-peer-dependencies` 를 추가하는 것뿐이라 `--frozen-lockfile` 이 보장하던
    매니페스트-lockfile 일치 계약 자체는 변경되지 않는다. 5곳을 동시에 strict 모드로
    전환하는 것 자체가 기존에 숨어 있던 미충족 peer 를 한꺼번에 CI/Docker 빌드 전체에서
    노출시킬 위험은 있었으나, 같은 라운드의 side_effect 리뷰가 10개 `--filter` 스코프 +
    전체 workspace 를 격리 사본에서 총 11회 실행해 전부 `exit 0, unmet peer 0건` 임을
    직접 검증했다(가정이 아니라 실측). 즉 "5곳 동시 전환" 이라는 배포 방식 자체의 리스크는
    이미 다른 리뷰 축에서 실증적으로 닫혔다.
  - 제안: 조치 불필요.

- **[INFO]** 5개 호출부의 pnpm 버전이 단일 SoT(`packageManager`)로 고정돼 플래그 의미
  불일치 위험이 없음
  - 위치: `package.json:6`(`"packageManager": "pnpm@10.23.0"`), 5개 install 호출부 전체
  - 상세: `.github/actions/pnpm-workspace/action.yml` 은 `pnpm/action-setup@v6.0.9`(버전
    명시 없이 corepack 이 루트 `packageManager` 를 따름)를 쓰고, 3개 Dockerfile 의 주석도
    "pnpm 버전은 root package.json 의 `packageManager` 필드를 corepack 이 따른다" 고
    명시한다. `.claude/test-stages.sh` 도 같은 corepack 경로다. 즉 `--strict-peer-dependencies`
    의 실제 판정 로직(어떤 경우를 "불충족"으로 볼지)이 pnpm 버전에 따라 사이트마다 달라질
    여지가 없다 — 5곳이 물리적으로 분리된 매체(composite action / bash / Dockerfile)라는
    점을 감안하면 이 단일 버전 SoT 는 게이트 신뢰성의 전제 조건이다.
  - 제안: 조치 불필요 — 확인 사항으로 기록.

- **[INFO]** 내부 의존성(5개 호출부 간 암묵적 계약)이 구조적 가드로 고정됨
  - 위치: `.claude/tests/test_install_gate_flags.py`(`KnownSitesCarryBothFlagsTest`,
    `TheSiteListHasNotGoneStaleTest`), `.claude/tests/test_pnpm_workspace_action.py`
    (`InstallCommandTest`)
  - 상세: 직전 라운드(CRITICAL)의 근본 원인은 "5개 install 호출부가 같은 두 플래그를
    달아야 한다"는 프로젝트 내부 의존 관계가 어느 한 곳(`test_pnpm_workspace_action.py`)
    에만 코드로 고정돼 있고 나머지 4곳은 무가드였던 것이다. 이번 diff 가 추가한
    `test_install_gate_flags.py` 는 그 관계를 (a) 알려진 5곳이 두 플래그를 다 다는지,
    (b) 등재되지 않은 새 install 지점이 생겼는지 두 축으로 정적 대조한다. 같은 라운드의
    requirement 리뷰가 `pytest` 직접 실행 + 저장소 전수 `git grep` 재검색으로 이 목록이
    실제 호출부와 정확히 일치함(6번째 지점 없음)을 독립 검증했다. 의존성 리뷰 관점에서도
    이 구조가 적절 — 5곳을 "런타임 공통 헬퍼로 합치지 않고 정적 대조로만 고정"한 선택은
    (매체가 셋으로 다르다는) 근거가 명확하고, 대안(런타임 추출)보다 결합도가 낮다.
  - 제안: 조치 불필요. (참고: 같은 라운드 documentation 리뷰가 `test_pnpm_workspace_action.py`
    모듈 최상단 docstring 이 "이 한 줄이 저장소 전체에서 유일하다" 는 낡은 문구를 diff 밖에
    여전히 갖고 있어 방금 언급한 5곳 관계와 파일 내부에서 자기모순을 이룬다고 WARNING 으로
    지적했다 — 의존성 리뷰 관점에서는 별도 결함으로 세지 않지만, "5곳 모두를 겨냥한다"는
    이번 게이트의 정확한 서술 범위와 관련되므로 documentation 리뷰의 조치를 지지한다.)

## 요약

이 diff 는 새 외부 의존성을 추가하지 않는 순수 CI/빌드 게이트 강화다. `pnpm install` 5개
호출부 전부에 `--strict-peer-dependencies` 를 일관 적용해, 종전 `#1049`(미충족 peer 가
경고로만 흘러 사람이 로그를 읽어야만 발견됨) 클래스의 사고를 일반적으로 CI 실패로 전환한다.
다만 헤드라인 사례였던 `eslint-plugin-unicorn` major 자체는 이미 별도의 dependabot ignore
규칙으로 봉쇄돼 있어, 이 게이트의 새 가치는 "그 특정 패키지의 재발 방지"가 아니라 "아직
ignore 목록에 없는 다른 패키지가 같은 클래스의 사고를 낼 때의 일반 방어"임을 명확히 해야
과잉 주장을 피할 수 있다. 또한 이 게이트가 실제로 dependabot PR 을 막으려면 Actions 활성화
+ required check 등록이라는, 이 diff 가 통제하지 않는 별도 인프라 전제가 있다(plan 이 이미
명시적으로 스코프 밖에 둠). `peerDependencyRules` 를 비워 둔 결정은 "규칙 유무와 무관하게
unmet peer 0건" 이라는 실측에 근거해 타당하고, 죽은 억제 설정을 남기지 않은 것도
`ignoreCves` 규약과 결이 같다. lockfile·매니페스트 정합성에는 새 위험이 없다 — 이 diff 는
그 둘을 건드리지 않고, 5곳 동시 strict 전환이라는 배포 리스크는 side_effect 리뷰의 11회
격리 실행으로 실증적으로 닫혔다. 유일한 forward-looking 갭은, `ignoreCves` 의 2-place
규약과 달리 `peerDependencyRules` 를 향후 처음 도입할 때 "실측 근거를 남길 것"이라는 절차가
스크립트로 강제되지 않고 주석 문구에만 의존한다는 점이다 — 지금은 억제 대상이 없어 결함은
아니지만, 다음 도입 PR 의 plan 체크리스트에 등재해 두는 것을 권한다.

## 위험도

LOW
