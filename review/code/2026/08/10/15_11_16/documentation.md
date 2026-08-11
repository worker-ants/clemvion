# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 저장소 전체 검색 결과: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` 의 주석이 이번 diff 로 인해 사실과 어긋나게 됐다 (diff 밖 파일이지만 지시에 따라 전수 확인 중 발견)
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:199-200` (함수: `it('설치된 eslint 실측 버전이 unicorn peer 요구를 실제로 만족한다 …')` 내부 주석)
  - 상세: 해당 주석은 "`#1049` 사고에서 실제로 깨진 지점 — `pnpm install` 이 unmet peer 를 경고로만 흘려서 (**`--strict-peer-dependencies` 미도입**, plan §후속 검토) 사람이 로그를 직접 읽어야만 발견됐다" 라고 적혀 있다. 그런데 바로 이 리뷰 대상 diff(`.github/actions/pnpm-workspace/action.yml`)가 `--strict-peer-dependencies` 를 **도입**했다. 즉 "미도입" 이라는 서술이 이번 변경으로 거짓이 됐다 — 정확히 이 리뷰 지시가 찾으라고 한 "여러 곳에 흩어진 `--frozen-lockfile`/관련 플래그 서술이 저장소 전체에서 갱신됐는가" 케이스다. 이 테스트 자체는 여전히 유효한 회귀 방지(설치된 eslint 버전을 직접 실측)이지만, 왜 그것이 필요한지를 설명하는 배경 서술이 stale 하다.
  - 제안: 주석을 "`--strict-peer-dependencies` 가 `#1058` 이후 `.github/actions/pnpm-workspace/action.yml` 에 도입됐다(2026-08-10) — 다만 이 unit 테스트는 CI 게이트와 무관하게 (로컬·CI 어느 실행 경로에서도) eslint 실측 버전을 직접 검증해 같은 사고 클래스를 이중으로 막는다" 정도로 갱신. `plan §후속 검토` 참조도 그 항목이 `plan/in-progress/deps-peer-gating-and-eslint10.md` 로 분리·완료(§1 체크됨)된 사실을 반영해야 한다.

- **[WARNING]** `pnpm-workspace.yaml` 신설 주석이 `--strict-peer-dependencies` CI 게이트의 실제 소재지를 잘못 지목
  - 위치: `pnpm-workspace.yaml:126-127`
  - 상세: "`pnpm install --strict-peer-dependencies` 를 CI 게이트로 둔다 (`.github/workflows/deps-security-checks.yml`)" 라고 적혀 있다. 그러나 `deps-security-checks.yml` 을 직접 열어 보면 `config-guard`/`audit`/`override-floors` 세 잡 어디에도 `pnpm install` 스텝이 없다(`pnpm audit`·정적 YAML 검사·override 검사뿐). `--strict-peer-dependencies` 는 실제로는 `.github/actions/pnpm-workspace/action.yml` 의 `run:` 한 줄에 있고, 이 액션은 `backend-checks.yml`·`frontend-checks.yml`·`packages-checks.yml`·`web-chat-checks.yml`·`spec-link-checks.yml` 5개 워크플로가 소비한다(`grep -rl "uses: ./.github/actions/pnpm-workspace" .github/workflows/` 로 확인). 즉 이 신설 주석은 게이트가 실제로 도는 위치를 완전히 다른 파일로 잘못 지목하고 있어, 이 주석만 읽고 게이트를 찾거나 디버깅하려는 사람을 엉뚱한 파일로 보낸다.
  - 제안: `.github/workflows/deps-security-checks.yml` 참조를 `.github/actions/pnpm-workspace/action.yml`(소비처: backend/frontend/packages/web-chat/spec-link-checks.yml)로 정정.

- **[WARNING]** `.claude/tests/README.md` 의 `test_pnpm_workspace_action.py` 카탈로그 엔트리가 새 플래그를 반영하지 못해 pinned argv 서술이 stale
  - 위치: `.claude/tests/README.md:52`
  - 상세: 이 엔트리는 "So it is pinned as **actual argv** … `pnpm install --frozen-lockfile --filter <scope>` used to be one line per workflow, and is now **the only copy in the repository**" 라고, 실제로 고정된 인자를 `--frozen-lockfile --filter <scope>` 로 인용한다. 그런데 이번 diff 로 `test_pnpm_workspace_action.py::test_pnpm_receives_frozen_lockfile_and_the_filter` 가 고정하는 실제 argv 는 `["install", "--frozen-lockfile", "--strict-peer-dependencies", "--filter", "frontend..."]` 이고 `ARGC` 도 4→5 로 바뀌었다. README 카탈로그는 이 테스트가 무엇을 고정하는지 요약해 알려주는 "손으로 동기화하는" 문서인데(이 저장소가 반복적으로 겪은 hand-synced-pair drift 클래스, 예: `test_e2e_exemption_paths_sync.py` 가 존재하는 이유와 동일 클래스), 지금은 실제 코드가 고정하는 것의 부분집합만 서술한다.
  - 제안: 인용 argv 를 `--frozen-lockfile --strict-peer-dependencies --filter <scope>` 로 갱신하고, `--strict-peer-dependencies` 가 고정된 이유(#1049/#1058, unmet peer 가 경고로만 흐르던 사고)를 한 문장 추가.

- **[INFO]** `.github/actions/pnpm-workspace/action.yml` 의 YAML `description:` 메타데이터가 여전히 `--frozen-lockfile` 만 언급
  - 위치: `.github/actions/pnpm-workspace/action.yml` — `description:` 필드 (파일 상단, `name: pnpm 워크스페이스 설치` 바로 아래 블록. 이번 diff 밖의 기존 줄)
  - 상세: `description: >- pnpm + Node 24(+ pnpm 캐시)를 셋업하고 지정한 워크스페이스 스코프를 \`--frozen-lockfile\` 로 설치한다.` 는 이 액션의 공개 메타데이터인데, 실제 `run:` 은 이제 `--strict-peer-dependencies` 도 강제한다. 액션을 처음 보는 사람이 이 설명만 읽으면 peer-dependency 게이팅이 있다는 사실을 놓친다.
  - 제안: `--strict-peer-dependencies` 로 peer 의존성도 strict 검증한다는 문구를 description 에 추가(우선순위는 낮음 — GH Actions UI 노출용 메타데이터라 실질 계약 문서는 아님).

- **[INFO]** `.claude/tests/test_pnpm_workspace_action.py` 모듈 상단 docstring(파일 존재 이유 설명)이 `--strict-peer-dependencies` 를 언급하지 않음
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:1-32` (모듈 docstring, 특히 12-15줄 "특히 `--frozen-lockfile` 은 … 그래서 문자열 존재가 아니라 **실제 인자**로 고정한다.")
  - 상세: "실제 인자로 고정하는" 근거를 `--frozen-lockfile` 하나만 예시로 설명한다. 개별 테스트 메서드의 docstring(변경된 부분, 107-114줄)은 `--strict-peer-dependencies` 도입 배경을 잘 설명하지만, 파일을 처음 열어 "왜 이 파일이 있는가" 절만 읽는 독자는 두 번째 플래그의 존재를 모듈 수준에서는 알 수 없다.
  - 제안: 필수는 아니나, "특히 `--frozen-lockfile` 은 …" 문단 뒤에 "2026-08-10 부터 `--strict-peer-dependencies` 도 같은 이유로 이 줄에 고정된다(아래 `test_pnpm_receives_frozen_lockfile_and_the_filter` 참조)." 한 줄을 추가하면 상단 요약만으로도 전체 그림이 보인다.

## 요약

리뷰 대상 4개 파일(테스트·액션·plan·`pnpm-workspace.yaml`) 자체는 서로 잘 동기화돼 있고, plan 문서는 실측 정정 과정(반증→재정정)까지 투명하게 남겨 모범적이다. 다만 지시받은 대로 "`--frozen-lockfile` 이 저장소의 유일한 소재지" 류 서술을 저장소 전체에서 추적한 결과, diff 밖에서 하나(`eslint-unicorn-peer.spec.ts` 의 "미도입" 주석 — 이번 변경으로 명백히 거짓이 됨)와 diff 안에서 하나(`pnpm-workspace.yaml` 이 게이트 위치를 `deps-security-checks.yml` 로 잘못 지목)의 실질적 stale/부정확 서술을 확인했다. 추가로 `.claude/tests/README.md` 카탈로그 엔트리가 새 플래그를 반영 못해 hand-synced 문서 drift 의 익숙한 패턴을 재현하고 있다. 세 건 모두 기능에는 영향 없지만 향후 디버깅·온보딩 시 잘못된 파일로 유도하거나 이미 닫힌 갭을 열려 있다고 오해시킬 수 있어 정정을 권한다.

## 위험도
MEDIUM
