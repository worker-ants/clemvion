# 의존성(Dependency) 리뷰 — CI 백스톱 3R (`codebase/packages/*/prepare` 계약 통일)

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — `typescript` 재사용 방식만 변경
  - 위치: `codebase/packages/ai-end-reason/package.json:9`, `codebase/packages/chat-channel-validation/package.json:9`, `codebase/packages/expression-engine/package.json:9`, `codebase/packages/graph-warning-rules/package.json:9`, `codebase/packages/node-summary/package.json:9`, `codebase/packages/sdk/package.json:9`, `codebase/packages/web-chat-sdk/package.json:12`
  - 상세: 7개 내부 패키지의 `scripts.prepare` 가 `[ -d dist ] || tsc` (셸, 존재 여부만 확인) 에서 `node -e "..."` 인라인 스크립트(`require.resolve('typescript/package.json')` 로 가용성 판단 후 `execSync('tsc', …)`)로 통일됐다. 두 형태 모두 각 패키지에 이미 존재하는 `devDependencies.typescript` (`^5.7.3`) 만 사용하며, 새 패키지(npm/pnpm registry 신규 등록)를 추가하지 않는다. `package.json` 의 `dependencies`/`devDependencies` 블록 자체는 이번 diff 에서 변경되지 않았다(오직 `prepare` 문자열만 교체). 순수 빌드 스크립트 로직 변경이라 라이선스·취약점·번들 크기 축은 해당 없음.
  - 제안: 없음 (승인 가능).

- **[INFO]** 빌드 시간 영향 — `prepare` 가 이제 `dist` 존재와 무관하게 매번 `tsc` 를 실행
  - 위치: `codebase/packages/*/package.json` (7개 파일, 각 `prepare` 라인)
  - 상세: pnpm 은 workspace 패키지 설치마다 `prepare` 를 실행한다. 이전 형태는 `dist` 가 이미 있으면 `tsc` 를 스킵했지만, 새 형태는 typescript 가 resolve 되는 한 항상 `tsc` 를 돌린다(의도된 정합성 수정 — stale `dist` 를 방지). `.claude/tests/test_packages_prepare_contract.py` 의 docstring 이 이 트레이드오프를 명시적으로 측정·기록했고(“typescript resolvable → run tsc ALWAYS”), `.github/workflows/harness-checks.yml` 의 `timeout-minutes: 15` 근거 주석도 실측 기반이라 근거가 충분하다. 7개 패키지 × 매 `pnpm install` 마다 `tsc` 컴파일이 추가되므로 로컬/CI 설치 시간이 소폭 늘어날 수 있으나, 정확성(stale dist 회귀 방지)과 맞바꾼 의도된 트레이드오프이며 CI(`frontend-checks`)는 이미 fresh checkout(무 `dist`)이라 실질 영향은 미미하다. 차단 사유 아님, 참고용.
  - 제안: 없음. 추후 설치 시간이 체감되면 그때 실측 후 캐싱(예: 내용 해시 기반 스킵) 도입을 고려.

- **[INFO]** 동일 인라인 스크립트가 7개 파일에 byte-for-byte 복제
  - 위치: `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` 의 `prepare` 라인
  - 상세: 복잡한 JS 로직(문자열 이스케이프 포함)이 7개 `package.json` 에 그대로 복제되어 있다 — 내부 모듈 간 결합(§8) 관점에서 "공유 스크립트 파일(예: `scripts/prepare-package.js`)을 `node ../../scripts/prepare-package.js` 로 호출" 하는 형태보다 drift 위험이 크다. 다만 `.claude/tests/test_packages_prepare_contract.py::test_every_package_that_builds_uses_the_same_prepare` 가 `len(distinct) == 1` 을 단언해 7곳의 byte-identical 여부를 CI에서 강제하므로, 실제 drift 위험은 테스트로 상쇄된다. 이 diff 범위에서는 문제 없음 — 향후 8번째 패키지가 추가되거나 로직이 더 복잡해질 경우 공유 스크립트로의 추출을 고려할 만하다는 참고 사항.
  - 제안: 없음(차단 아님). 장기적으로 패키지 수가 늘면 `scripts/*.js` 공유 파일 추출을 고려.

- **[INFO]** 새 테스트 파일은 harness stdlib-only 컨벤션을 그대로 준수
  - 위치: `.claude/tests/test_packages_prepare_contract.py:40-51` (import 블록)
  - 상세: `json, os, subprocess, tempfile, unittest, pathlib` — 전부 표준 라이브러리, 그리고 프로젝트 내부 harness 모듈 `_harness`(`REPO_ROOT`) 만 사용한다. `.claude/tests/README.md` 가 규정한 "hooks/harness Python 은 표준 라이브러리 + PyYAML 예외만" 컨벤션을 위반하지 않는다. `subprocess.run([..., "sh", "-c", self.prepare], ..., timeout=60)` 로 타임아웃도 명시돼 있어 hang 위험이 낮다.
  - 제안: 없음.

- **[INFO]** CI 워크플로 변경은 새 액션/의존성 도입 없이 `paths:` 트리거만 확장
  - 위치: `.github/workflows/harness-checks.yml:69` (`'codebase/packages/*/package.json'` 추가)
  - 상세: `actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7` 등 기존 액션 버전은 변경되지 않았다. 추가된 glob `codebase/packages/*/package.json` 은 GitHub Actions 의 `paths:` 필터 의미상 `*` 가 `/` 를 넘지 않으므로 정확히 각 패키지 1-depth 의 `package.json` 만 매칭하고, `codebase/packages/**` 하위 소스 변경까지 트리거를 넓히지 않는다는 주석(§ "소스가 아니라 매니페스트만 등재") 과 일치한다. 새 외부 의존성/버전 고정 이슈 없음.
  - 제안: 없음.

## 요약
이번 변경은 새 외부 패키지를 전혀 추가하지 않는다 — 7개 내부 workspace 패키지(`codebase/packages/*`)의 `prepare` 빌드 스크립트를 "`dist` 존재 여부만 확인" 하던 취약한 셸 형태에서 "`typescript` devDependency 의 실제 resolve 가능 여부를 판별해 항상 재컴파일하고, 불가능하면 `dist` 부재 시에만 실패" 하는 형태로 통일했을 뿐이며, 각 패키지에 이미 선언된 `typescript: ^5.7.3` devDependency 를 재사용한다. 새 테스트(`test_packages_prepare_contract.py`)도 표준 라이브러리만 사용해 harness 의 "zero third-party dependency" 컨벤션을 지킨다. 실질적인 의존성 리스크(신규 패키지·라이선스·취약점·버전 충돌)는 발견되지 않았고, 지적 사항은 전부 참고용(빌드 시간 소폭 증가, 인라인 스크립트 7중 복제)이며 이미 테스트/문서로 트레이드오프가 실측·정당화되어 있다.

## 위험도
NONE
