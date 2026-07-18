# 아키텍처 리뷰 — 내부 패키지 등록 목록 drift 가드 (PR 관련 3파일)

## 발견사항

- **[WARNING]** 가드의 자기방어(self-defense)가 "조기 열림(nested `{`)"만 잡고 "조기 닫힘"은 못 잡는 비대칭 구조
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:423-437` (`fnBody`)
  - 상세: `fnBody`는 `cmd_*` 함수 본문을 "여는 줄 다음 ~ 라인 시작 `}` 이전"으로 잘라내는 순수 정규식 휴리스틱이다. 파일 자신의 docstring이 "본문에 라인 시작 `{`가 있으면 휴리스틱이 안전하지 않다"는 것을 감지해 명시적으로 throw하도록 방어해 두었는데, 이는 "중첩 열림 브레이스로 인한 조기 절단(누락 오탐)"만 커버한다. 그러나 함수 본문에 heredoc(`<<EOF ... EOF`)이나 문자열 리터럴로 라인 시작에 `}`만 있는 줄(예: JSON 예시를 echo하는 줄)이 들어오면, 정규식 `^\}$`가 그 줄을 "함수의 닫는 브레이스"로 오인해 본문을 조기 절단할 수 있다. 이 경우는 nested-`{` 자기점검으로 걸리지 않으므로 "거짓 통과"(실제로는 패키지가 안 돌아가는데 가드가 green)로 이어질 수 있다 — 이 파일 자신이 막으려는 결함(#968) 그 자체가 재발할 잠재 경로다.
  - 제안: 대칭적으로 "본문 안에 라인 시작 `}`가 nested-`{` 없이 등장할 수 있는 상황(heredoc, 문자열 리터럴)"도 탐지해 throw하거나, 최소 주석에 "이 자기점검은 조기-열림만 커버하며 조기-닫힘은 커버하지 않는다"는 한계를 명시. 현재 `cmd_lint/unit/build` 3개 함수 본문이 단순하므로 즉시 위험은 없으나, 향후 스텝 추가 시 트립와이어가 없다는 점은 문서화가 필요.

- **[INFO]** 프레젠테이션(frontend) 레이어 테스트가 harness(`.claude/`)·CI(`.github/`) 설정의 SoT를 겸함 — 의도된 경계 넘기
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 전체, `.claude/test-stages.sh:35-39`, `.github/workflows/packages-checks.yml:3-7`
  - 상세: 이 가드는 frontend 앱의 관심사가 아닌 두 개의 이질적 도메인(bash 스크립트 `INTERNAL_PACKAGES`, GitHub Actions YAML의 3개 리스트)을 검증한다. 배치 근거(Actions가 repo 레벨에서 꺼져 있어 CI job으로 만들면 자기모순이 된다는 점)는 타당하고 주석으로 충분히 설명돼 있으나, 결과적으로 "frontend 테스트 스위트"가 harness/CI 설정의 구조적 정합성을 지키는 유일한 실행 게이트가 된다. 향후 frontend 워크스페이스가 분리되거나 vitest 설정이 바뀌면 이 cross-cutting 가드가 조용히 실행되지 않게 될 위험 표면이 생긴다.
  - 제안: 이미 파일 헤더에 배치 근거가 명시돼 있어 즉각 조치는 불필요. 다만 `.claude/test-stages.sh`나 `.claude/docs/` 쪽에서도 "이 가드가 frontend vitest에 있다"는 역참조(현재도 `.claude/test-stages.sh:37-38`, `packages-checks.yml:5-7`에 있음 — 이미 양방향 링크됨, 문제 없음)를 유지할 것.

- **[INFO]** 재사용 가능한 파서 유틸리티가 `__tests__/` 파일 내부에 비공개로 존재 — 응집도는 높으나 재사용성 저하
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:362-505` (`repoRoot`, `discoverPackages`, `backendWorkflowDeps`, `internalPackages`, `fnBody`, `explicitFilterCalls`, `listAtPath`, `blockRange`, `findKeyLine`, `packageDirsInPaths`)
  - 상세: bash 함수 본문 추출기·경량 YAML 경로 추출기 등 10개 가까운 순수 함수가 테스트 파일에 직접 정의돼 export되지 않는다. 이 자체는 지금 이 가드의 단일 목적에는 응집돼 있어 문제가 되지 않지만, 향후 다섯 번째 등록 목록이나 다른 설정 파일에 대해 유사한 YAML 부분 추출이 또 필요해지면(파일 자체 주석이 이미 "필요한 3개 목록이 전부 알려진 위치"라고 범위를 좁혀 둔 것으로 보아 확장 가능성을 인지하고 있음) 코드가 복제되거나 `__tests__` 파일에서 production 성격의 유틸을 import하는 안티패턴으로 이어질 수 있다.
  - 제안: 지금 당장 리팩터링이 필요한 수준은 아님(YAGNI). 다만 두 번째 소비처가 생기는 시점에는 `listAtPath`/`blockRange`/`findKeyLine` 계열을 `lib/repo-guards/yaml-path.ts` 같은 sibling 모듈로 승격해 테스트와 파서 로직을 분리할 것.

- **[INFO]** 두 가드(`test-stages.sh` 대상 vs `packages-checks.yml` 대상)가 서로 다른 "모집단 SoT 전략"을 병존 — 의도적이나 암묵적
  - 위치: 테스트 파일 350-360행 주석 및 `internalPackages()` (수동 배열 파싱) vs `backendWorkflowDeps()` (파생값)
  - 상세: `INTERNAL_PACKAGES`는 여전히 손으로 유지하는 배열이고(가드는 그 배열 자체가 아니라 "모든 패키지가 3단계에 커버되는가"라는 상위 불변식만 검증), `packages-checks.yml`의 3개 리스트는 `backend/package.json`에서 파생한 값과 정확히 일치해야 한다. 두 정책이 다른 이유는 파일 헤더 주석에 설명돼 있어 오독 위험은 낮지만, "왜 한쪽은 파생이고 한쪽은 자유 등록인가"는 상위 설계 문서(`spec/conventions/` 등) 없이 테스트 파일 주석에만 존재한다.
  - 제안: 즉각 조치 불요. 다만 이 drift-guard 패턴(이미 `scripts/check-e2e-playwright-config.py`에도 존재)이 반복되는 만큼, "손 유지 목록 vs 파생 목록" 판단 기준을 `spec/conventions/` 하나에 모아두면 향후 유사 가드 작성 시 판단 비용이 줄어든다.

## 요약
이번 변경은 순수하게 거버넌스/드리프트 방지 목적의 테스트 인프라 추가(+ 주석 보강)로, 운영 코드 경로에는 영향이 없다. 설계 자체는 이 저장소의 기존 가드 패턴(`scripts/check-e2e-playwright-config.py`)과 일관되며, vacuity 방지·fail-closed·파생값 우선(하드코딩 사본 지양) 등 견고한 원칙을 잘 따른다. 다만 (1) bash 함수 본문 추출 휴리스틱의 자기방어가 "조기 열림"만 커버하고 "조기 닫힘"(heredoc 등)은 커버하지 않는 비대칭이 있고, (2) frontend 테스트가 harness/CI 설정의 유일한 집행 지점이 되는 의도된 경계 넘기, (3) 재사용 가능한 파서가 테스트 파일에 비공개로 갇혀 있는 점은 향후 확장 시 유의할 아키텍처 부채로 남는다. 모두 즉시 차단 사유는 아니며 현재 스코프에서는 안전하다.

## 위험도
LOW
