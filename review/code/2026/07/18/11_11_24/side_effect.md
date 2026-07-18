# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 테스트 파일은 순수 read-only 파일시스템 접근만 수행
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 전체 (`discoverPackages`, `backendWorkflowDeps`, `fnBody`, `internalPackages`, `listAtPath` 등)
  - 상세: 사용되는 fs API 는 `readFileSync` / `readdirSync` / `existsSync` 뿐이며 `writeFileSync`/`unlink`/`mkdir` 등 쓰기 계열 호출이 없다. 대상 파일(`test-stages.sh`, `packages-checks.yml`, `codebase/packages/*/package.json`, `codebase/backend/package.json`)을 읽기만 하고 수정하지 않는다. 네트워크 호출, 환경 변수 읽기/쓰기, 전역 변수 도입도 없다.
  - 제안: 없음 (안전).

- **[INFO]** 모듈 스코프에서 즉시 실행되는 `repoRoot()` 가 파일 검색 실패 시 throw
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:377` (`const ROOT = repoRoot();`) 및 `discoverPackages()`/`backendWorkflowDeps()` 가 `describe()` 콜백 최상단(테스트 수집 단계)에서 즉시 호출됨(1060~1064행)
  - 상세: `pnpm-workspace.yaml` 을 못 찾거나 대상 파일이 없으면 vitest 의 describe 콜백 실행(수집 단계) 자체가 throw 로 실패한다. 이는 해당 테스트 파일 스코프에 격리된 부작용이며, 다른 테스트 파일이나 애플리케이션 런타임에는 영향이 없다. 의도된 fail-loud 설계(주석에 명시: "조용히 틀리느니 깨지게 만든다").
  - 제안: 없음 — 의도된 동작.

- **[INFO]** `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml` 변경은 주석 추가만
  - 위치: 두 diff 모두 헤더 주석 블록만 추가, 실행 로직(`INTERNAL_PACKAGES` 배열, `cmd_lint`/`cmd_unit`/`cmd_build`, workflow `on.paths`/`matrix.pkg`) 은 무변경
  - 상세: 함수 시그니처·워크플로 트리거 조건·job 목록에 실질 변경 없음. 기존 호출자(런처, CI)에 영향 없음.
  - 제안: 없음.

- **[INFO]** 신규 테스트가 `cmd_unit` 게이트의 실효 통과 조건을 확장(의도된 인터페이스 변경)
  - 위치: 신규 테스트 파일이 `pnpm --filter frontend test` 스위트에 편입되어 `.claude/test-stages.sh` 의 `cmd_unit` 체인 일부가 됨
  - 상세: 이 테스트가 실패하면 `run-test.sh unit` 단계 전체가 비제로 종료로 바뀐다. 이는 부작용이 아니라 PR 의도된 목적(등록 목록 drift 를 실패로 표면화)이지만, 향후 `codebase/packages/*` 추가나 `test-stages.sh`/`packages-checks.yml` 구조 변경 시 이 가드가 (의도대로) 새로 실패할 수 있음을 호출자(다른 개발자)가 인지해야 한다.
  - 제안: 없음 — PR 설명과 일치하는 의도된 게이트 강화.

## 요약

이번 변경은 순수 read-only 정적 분석 테스트 1개 신규 추가와 두 설정 파일의 주석 보강으로 구성되며, 전역 상태 변경·파일시스템 쓰기·시그니처/공개 API 변경·환경 변수 접근·네트워크 호출·이벤트/콜백 변경 등 부작용 관점의 위험 요소는 발견되지 않았다. 유일하게 주목할 점은 신규 테스트가 `cmd_unit` 게이트의 통과 조건을 확장한다는 것인데, 이는 PR 의 명시적 목적(#968 재발 방지)과 정확히 일치하는 의도된 변경이다.

## 위험도
NONE
