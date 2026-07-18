# 의존성(Dependency) 리뷰

대상: `.claude/tools/bootstrap-session.sh`, `.claude/hooks/lint_mermaid_posttooluse.py`,
`.claude/hooks/_lib/mermaid_lint_ready.py`(신규), `.githooks/pre-commit`,
`.github/workflows/harness-checks.yml`, `.claude/tests/test_bootstrap_mermaid_install.py`(신규),
`.claude/tests/test_mermaid_lint_ready.py`(신규)

## 조사 방법

`git diff origin/main...HEAD` 로 실제 변경 범위를 파일별로 재확인하고(전체 파일 컨텍스트 ≠ diff),
`ast`로 모든 신규/변경 Python 파일의 import 를 정적 추출했으며, `.github/workflows/*.yml` 전체를
grep 하여 액션 버전·Node 버전 일관성을 교차 검증했다. 두 신규 테스트 파일(`test_mermaid_lint_ready.py`
12건, `test_bootstrap_mermaid_install.py` 16건)을 로컬(macOS/darwin)에서 실제 실행해 전부 통과 확인.

## 발견사항

- **[INFO]** 이번 diff 는 새 외부 의존성을 추가하지 않는다
  - 위치: 전체 7개 파일
  - 상세: `bootstrap-session.sh`(락/마커/스로틀 로직 118줄 추가), 신규 `mermaid_lint_ready.py`,
    `lint_mermaid_posttooluse.py`, `.githooks/pre-commit` 변경분 모두 `ast` 로 import 를 추출한 결과
    Python 표준 라이브러리(`os`, `sys`, `json`, `re`, `subprocess`, `traceback`)와 내부 모듈
    (`mermaid_lint_ready`, `_harness`) 외에는 아무것도 import 하지 않는다. 셸 스크립트도 `mkdir`,
    `stat -f`/`stat -c` 폴백 쌍, `date`, `find`, `kill -0`, `cat`, `rm`, `git` 등 이미 전제된 POSIX
    유틸/기존 도구만 사용한다. `npm`/`node` 자체는 mermaid-lint 툴링이 이 PR 이전부터 요구하던 것으로
    새 요구사항이 아니다. `pip install`/`npm install <new-pkg>` 류 신규 추가 지점 0건.
  - 제안: 없음 — 현행 유지로 충분.

- **[INFO]** 새 내부 공유 모듈이 잘 설계된 cross-language 의존 관계를 형성
  - 위치: `.claude/hooks/_lib/mermaid_lint_ready.py` (신규), 소비자 3곳
  - 상세: `mermaid_lint_ready.is_ready()`가 "설치 완료" 판정의 단일 진실원이 되어 `bootstrap-session.sh`
    (writer, bash라 import 불가 → 마커 이름을 하드코딩), `.githooks/pre-commit`(reader, CLI subprocess
    호출), `lint_mermaid_posttooluse.py`(reader, 직접 import) 세 소비자가 공유한다. bash 쪽 하드코딩은
    원칙적으로 drift 위험이 있지만 `test_mermaid_lint_ready.py::ConsumerBindingTest.
    test_bootstrap_writes_the_shared_marker_name`이 그 하드코딩 문자열이 `MARKER_NAME`과 일치하는지
    직접 단언해 조용한 drift를 테스트 실패로 전환한다. bash/python 언어 경계를 넘는 상수 공유를 문서화된
    컨벤션(테스트로 결속)으로 처리한 좋은 사례.
  - 제안: 없음 — 참고용 긍정 기록.

- **[INFO]** `lint_mermaid_posttooluse.py`의 신규 import 는 fail-open 폴백을 갖지만 조용히 죽을 수 있다
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:265-277`
  - 상세: `sys.path.insert` 후 `from mermaid_lint_ready import is_ready`를 `try/except Exception`으로
    감싸고 실패 시 `is_ready = None`으로 폴백한다. `_lib/mermaid_lint_ready.py`에 구문 오류 등이 생기면
    linter 전체가 조용히 비활성화되고 stderr traceback 만 남는데, 이는 "세션을 절대 막지 않는다"는 훅의
    명시적 계약과 정합하는 의도된 트레이드오프이며 주석에도 그렇게 문서화되어 있다. 결함이 아니라 설계
    선택으로 판단.
  - 제안: 없음(현행 트레이드오프 수용). 필요하면 이 폴백 경로 자체에 대한 회귀 테스트만 후속 고려.

- **[WARNING]** (이번 diff 도입 아님, 사전 존재) `harness-checks.yml`의 액션/Node 버전이 리포 나머지와 불일치
  - 위치: `.github/workflows/harness-checks.yml:602,612-614` (`actions/setup-python@v6`,
    `actions/setup-node@v4`, `node-version: '22'`)
  - 상세: 리포의 다른 모든 워크플로(`spec-link-checks.yml`, `web-chat-checks.yml`×3,
    `deps-security-checks.yml`, `frontend-checks.yml`, `packages-checks.yml`)는 전부
    `actions/setup-node@v6` + `node-version: '24'`를 쓰는데 이 파일만 `@v4` + `'22'`다. `git blame`
    으로 확인한 결과 이 줄은 `f562c04f6`(이미 origin/main 조상, 이번 PR 범위 밖)에서 도입됐고 이번
    diff 는 이 파일에서 `paths:` 트리거 한 줄만 추가했다(`.githooks/**`) — 즉 이번 변경이 만든 문제는
    아니다. 다만 `PROJECT.md:49`가 "Node 지원 floor: 내부 앱·내부 packages = engines.node >=24 (운영
    node:24·CI 와 정렬 — 실제 빌드·테스트되는 환경만 약속)"이라고 명시하므로, `.claude/` 하네스가 이
    floor 의 적용 범위 밖이라 해도 CI 전체에서 유일하게 낮은 버전 조합을 쓰는 것은 실제 리스크(하네스
    테스트가 backend/frontend 와 다른 Node 런타임에서만 검증됨)다. 이번 리뷰 대상 파일 세트에 포함돼
    있어 기록한다.
  - 제안: 별도 후속(이번 PR 스코프 아님)으로 `actions/setup-node@v6` + `node-version: '24'`로 정렬해
    리포 전체 CI 의 버전 일관성을 맞출 것을 권장.

- **[WARNING]** (이번 diff 도입 아님, 사전 존재) mermaid-lint 의 의존성이 버전 미고정 + 보안 감사 사각지대
  - 위치: `.claude/tools/mermaid-lint/package.json` (`"jsdom": "*"`, `"mermaid": "*"`),
    `.claude/tools/bootstrap-session.sh:167`(`npm install --no-fund --no-audit --silent` — 이번 diff
    는 이 줄을 새 락/재시도 로직으로 감쌌을 뿐 줄 자체는 origin/main 에 이미 존재)
  - 상세: 두 가지가 겹친다. (1) `package.json`의 선언 범위가 완전 와일드카드(`*`)라 `npm install`이
    lockfile 과 어긋나는 상황(수동 lockfile 재생성 등)이 오면 임의 버전이 설치될 수 있다 — 다행히
    `package-lock.json`이 커밋돼 있어 정상 경로에서는 사실상 고정되지만, 선언 자체는 무의미하다.
    (2) `.github/workflows/deps-security-checks.yml`의 `pnpm audit --audit-level=moderate` 게이트는
    루트 `pnpm-lock.yaml`(pnpm workspace)만 스캔한다 — `paths:` 필터에도 `.claude/tools/mermaid-lint/**`
    가 없고, `pnpm audit` 자체도 이 독립 npm 프로젝트(별도 `package-lock.json`, npm 사용)를 볼 수
    없다. 게다가 설치 커맨드 자체가 `--no-audit`으로 npm 자체 감사도 끈다. 결과적으로 `mermaid`/`jsdom`
    (jsdom 은 특히 의존 트리가 큼) 은 CI 어디에서도 취약점 스캔이 되지 않는다. 이번 PR 이 만든 문제는
    아니지만, 이번 PR 이 바로 이 설치 파이프라인을 더 견고하게(락·마커·재시도로 무인 설치 성공률을
    높임) 만드는 변경이라 관련성이 높아 기록한다.
  - 제안: 후속 과제로 (a) `deps-security-checks.yml`의 `paths:`에 `.claude/tools/mermaid-lint/package.json`
    (또는 `package-lock.json`) 추가하고 별도 `npm audit` 스텝 신설, 또는 (b) 최소한 `package.json`의
    `"*"`를 실제 사용 중인 메이저 버전(`^11`, `^29` 등, lockfile 실측값 기준)으로 명시해 선언과 실제
    설치본을 정렬. 둘 다 이번 PR 범위 밖이므로 별도 plan 항목으로 제안.

- **[INFO]** `npm install` vs `npm ci` 선택은 이번 스크립트의 목표에 부합
  - 위치: `.claude/tools/bootstrap-session.sh:167`
  - 상세: lockfile 이 커밋돼 있음에도 `npm ci`가 아닌 `npm install`을 쓴다. `npm ci`는 매번
    `node_modules`를 삭제하고 lockfile-package.json 불일치 시 하드 실패하는데, 이 스크립트는 "세션을
    절대 막지 않는" fail-open 설계(마커/락/스로틀)가 핵심이므로 `npm install`이 더 적합한 선택이다.
    결함이 아니라 설계 목표와 일치하는 선택으로 판단.
  - 제안: 없음.

- **[INFO]** CI 빌드 시간/번들 크기에 미치는 영향은 사실상 0
  - 위치: `.github/workflows/harness-checks.yml`
  - 상세: 이번 diff 가 `harness-checks.yml`에서 실제로 바꾸는 것은 `paths:` 트리거 배열에 한 줄
    (`.githooks/**`) 추가뿐이다. 기존 `setup-node@v4` + `node --test .claude/tests/test_agent_return.mjs`
    스텝은 `test_agent_return.mjs`의 import(`node:test`, `node:assert/strict`, 상대경로 로컬 모듈
    `../workflows/_lib/agent-return.mjs`)를 직접 확인한 결과 외부 npm 패키지가 전혀 필요 없어 해당
    job 에 `npm install`/`npm ci` 스텝 자체가 없다(정상). 새 설치 스텝·새 빌드 의존성 없음.
  - 제안: 없음.

## 요약

이번 diff 는 순수하게 기존 도구(POSIX 셸 유틸, git, npm/node, Python stdlib)만으로 mermaid-lint
설치의 동시성·부분설치·재시도 문제를 해결하며, 신규 외부 패키지·라이선스·번들 크기 이슈를 전혀
발생시키지 않는다. 신규 내부 공유 모듈(`mermaid_lint_ready.py`)은 bash/python 언어 경계를 넘는
"단일 진실원" 관계를 테스트로 결속한 좋은 내부 의존성 설계 사례다. 다만 조사 과정에서 이번 PR 이
직접 건드리는 정확한 하위 시스템(mermaid-lint 설치 파이프라인) 주변에 사전 존재하는 두 가지 실질적
갭을 발견했다 — ① `harness-checks.yml`만 리포의 다른 워크플로와 다른 액션/Node 버전을 쓰고 있고,
② mermaid-lint 의 `package.json`이 버전 와일드카드(`*`)이며 그 의존성(`mermaid`, `jsdom`)이
`deps-security-checks.yml`의 `pnpm audit` 게이트 사각지대에 있어(별도 npm 프로젝트라 스캔 대상 밖)
CI 어디서도 감사되지 않는다. 둘 다 이번 diff 가 도입한 문제는 아니므로 이번 PR 을 막을 사유는 아니지만,
후속 plan 항목으로 남길 가치가 있다.

## 위험도

LOW
