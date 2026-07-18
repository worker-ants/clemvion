# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 파서 유틸리티와 테스트 단언이 한 파일(`__tests__/*.test.ts`)에 혼재
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 전체 (특히 `repoRoot`/`discoverPackages`/`backendWorkflowDeps`/`fnBody`/`explicitFilterCalls`/`blockRange`/`findKeyLine`/`listAtPath`/`packageDirsInPaths`/`missingFromStage`, L362-555)
  - 상세: bash/YAML 을 규정하는 순수 파서 함수 10개가 실제 단언(`describe`/`it`)과 같은 489줄 파일에 공존한다. 파일 자체 주석(L826-835)이 "vitest 가 `src/**/*.test.ts` 를 glob 자동 발견하므로 별도 호출부(=손 유지 목록)가 안 생긴다"는 이유로 이 파일 안에 둔 것을 설명하고 있어 의도적 설계지만, 이 유틸들은 이 가드 외에 다른 repo-guard 가 생길 경우 재사용하기 어렵고(테스트 파일에서 import), 순수 로직과 단언이 뒤섞여 파일이 길어 스캔 비용이 있다(파서 로직만 약 190줄).
  - 제안: `internal-package-registration.helpers.ts`(비-`__tests__` 위치) 로 파서 함수만 분리하고 `*.test.ts` 는 이를 import 해 단언만 담당하도록 하면, vitest 자동 발견 특성(테스트 파일 자체는 그대로 유지)을 잃지 않으면서 재사용성·가독성을 개선할 수 있다. 다만 이번 변경의 목적(단일 파일로 drift 를 즉시 확인 가능)을 고려하면 현행 유지도 수용 가능한 선택.

- **[INFO]** `fnBody` 의 라인 기반 휴리스틱이 구조적으로 취약해 향후 `test-stages.sh` 리팩터 시 유지보수 비용을 유발
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` L426-452 (`fnBody`)
  - 상세: "여는 줄 vs 첫 라인 시작 `}`" 규칙은 `cmd_*` 함수 안에 중첩 `{ }` 블록·heredoc 이 들어오면 깨진다. 함수 자체가 이를 인지해 fail-loud(throw)로 방어하고 있어 안전성은 확보되어 있으나, 향후 `test-stages.sh` 작성자가 별 생각 없이 `{ ... ; }` 그룹 명령이나 heredoc 을 `cmd_lint`/`cmd_unit`/`cmd_build` 본문에 추가하면 무관한 테스트(이 가드)가 즉시 throw 로 깨지고, 그 이유(라인 시작 브레이스 감지)를 이해하려면 이 테스트 파일의 주석까지 읽어야 한다 — 두 파일 간 암묵적 결합.
  - 제안: 현행 fail-loud 방어와 상세 주석으로 리스크는 이미 완화되어 있음. 추가 조치가 필요하면 `test-stages.sh` 상단 주석(이미 추가된 drift 안내)에 "cmd_* 본문에 중첩 `{ }`/heredoc 추가 금지" 한 줄을 덧붙이는 정도로 충분.

- **[INFO]** 동일 목적의 `it.each` 블록과 단일 `it` 블록이 병존 (경미한 구조적 비일관)
  - 위치: L1142-1163 (`packages-checks.yml` 섹션) — `on.pull_request.paths`/`on.push.paths` 는 `it.each` 로 묶였으나 `strategy.matrix.pkg` 검증은 별도 단일 `it` 로 분리
  - 상세: 세 목록 모두 "backend-공유 패키지 집합과 일치해야 한다"는 동일 불변식을 검사하지만 `matrix.pkg` 는 `packageDirsInPaths` 변환이 필요 없어 케이스 형태(파일 dir vs 패키지 name)가 달라 완전한 통합은 불가능하다. 구조상 자연스러운 분리라 실제 결함은 아님.
  - 제안: 현행 유지로 충분. 통합하려면 케이스별 변환 함수를 인자로 받는 형태가 필요한데, 그 정도로 얻는 이득이 적다.

## 요약

세 변경 파일 중 `.claude/test-stages.sh`·`.github/workflows/packages-checks.yml` 는 drift 가드를 안내하는 주석만 추가된 것으로 유지보수성 이슈가 없다. 핵심 변경인 `internal-package-registration.test.ts`(신규 489줄)는 규모에 비해 예외적으로 잘 관리된 코드다 — 함수는 각각 단일 책임으로 짧게 분리되어 있고(`repoRoot`/`discoverPackages`/`fnBody`/`listAtPath` 등), 네이밍이 목적을 정확히 드러내며, 중첩 깊이도 얕다. 정규식 기반 bash/YAML 파싱이라는 태생적 복잡도는 각 함수 상단의 상세한 근거 주석과 실패 시 throw(fail-loud) 설계, 그리고 합성 fixture 를 통한 회귀 고정(mutation 방어) 테스트로 충분히 상쇄되어 있어, "동작은 하지만 왜 그런지 모르는" 유형의 유지보수 부채가 아니라 "왜 그런지 명시적으로 설명된" 유형이다. 유일하게 지적할 만한 점은 파서 유틸리티와 테스트 단언이 한 파일에 혼재해 있다는 구조적 선택인데, 이는 파일 자체가 명시적으로 정당화하고 있어 결함이라기보다 트레이드오프에 가깝다. 매직넘버(`MAX_DEPTH=12`)도 이미 근거가 주석으로 남아 있다. 전반적으로 CRITICAL/WARNING 급 유지보수성 결함은 발견되지 않았다.

## 위험도

LOW
