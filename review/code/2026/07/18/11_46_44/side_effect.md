# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 모듈 최상위 레벨에서의 즉시 실행(import-time side effect)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:632` (`export const ROOT = repoRoot();`)
  - 상세: `repoRoot()`는 `__dirname`에서 최대 12단계까지 상위 디렉터리를 순회하며 `pnpm-workspace.yaml`을 탐색하고, 못 찾으면 `throw`한다. 이 호출이 함수 몸체가 아니라 모듈 top-level `export const`로 즉시 실행되므로, 이 모듈을 import 하는 순간(테스트 실행 여부와 무관) 부작용(디스크 접근 + 예외 가능)이 발생한다. 현재는 형제 테스트 파일 하나만 이 모듈을 import 하므로 blast radius 는 작지만, 향후 다른 코드가 이 모듈을 재사용(import)하면 그 도입 지점에서도 동일한 즉시-실행/throw 부작용을 상속받는다.
  - 제안: 현재 설계(“fail-loud”)는 의도된 것으로 보이며 문제로 볼 필요는 없으나, 재사용 확산 시 이 top-level 부작용을 주석으로 명시하거나 지연평가(lazy getter)로 바꾸는 것을 고려할 수 있다. 지금 diff 자체에는 조치 불요.

- **[INFO]** 프런트엔드 테스트가 리포지토리 루트 밖(`.claude/`, `.github/`) 파일을 읽는 교차 패키지 결합
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` (`TEST_STAGES`, `PACKAGES_CHECKS` 읽기), `internal-package-registration-guard.ts`의 `discoverPackages`/`backendWorkflowDeps`
  - 상세: `codebase/frontend`의 vitest 스위트가 `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `codebase/backend/package.json`, `codebase/packages/*`를 실측으로 읽는다. 모두 **읽기 전용**(`fs.readFileSync`/`readdirSync`만 사용, `writeFileSync`·`process.env`·네트워크 호출 전무 — grep 으로 확인)이라 부작용 자체는 없지만, 이 구조는 “frontend 테스트 실패 = harness 스크립트/워크플로 구조 변경” 이라는 암묵적 결합을 만든다. 즉, 이 diff 이후로는 `.claude/test-stages.sh`의 `cmd_lint/cmd_unit/cmd_build` 함수 시그니처(정확히는 텍스트 구조: 여는 줄 형태·중첩 `{`·heredoc 유무)나 `packages-checks.yml`의 `on.pull_request.paths`/`on.push.paths`/`strategy.matrix.pkg` 키 경로를 바꾸면, 관련자가 인지하지 못한 채 frontend 유닛 테스트가 깨질 수 있다.
  - 제안: 이는 가드의 존재 목적 그 자체(#968 재발 방지)이므로 결함이 아니라 의도된 설계다. 다만 코드 내 주석(이미 상세히 존재)만으로는 발견이 늦어질 수 있으니, `.claude/test-stages.sh`·`packages-checks.yml` 수정자가 이 커플링을 인지하도록 해당 파일 헤더 주석(이번 diff 에 이미 포함됨)을 유지·참조하면 충분하다. 추가 조치 불요.

- **[NONE]** 파일시스템 쓰기 부작용 없음
  - 위치: `internal-package-registration-guard.ts`, `internal-package-registration.test.ts` 전체
  - 상세: `writeFileSync`, `child_process`/`execSync`, `process.env`, `fetch`/`axios`/`http.request` 등을 grep 했으나 매치 0건. 모든 fs 접근은 `readFileSync`/`readdirSync`/`existsSync`로 읽기 전용이다.

- **[NONE]** 기존 함수 시그니처·공개 API 변경 없음
  - 위치: `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`
  - 상세: 두 파일 모두 diff 는 **주석 추가뿐**이며 `INTERNAL_PACKAGES` 배열 값, `cmd_lint`/`cmd_unit`/`cmd_build`/`_run_internal` 함수 본문, workflow 의 `on.paths`/`matrix.pkg`/`jobs` 정의는 전혀 바뀌지 않았다. 실행 동작(런타임 시맨틱)은 완전히 동일 — CI/로컬 게이트의 pass/fail 판정에 영향 없음.

- **[NONE]** 환경 변수·네트워크 호출 없음
  - 상세: 신규 코드 어디에서도 `process.env` 읽기/쓰기, 외부 서비스 호출이 없다. `packages-checks.yml`은 comment-only 변경이라 워크플로 자체의 트리거/실행 조건도 불변.

## 요약

이번 변경은 (1) `.claude/test-stages.sh`·`.github/workflows/packages-checks.yml`에 대한 주석 전용 추가(실행 동작 무변경), (2) `codebase/frontend/src/lib/repo-guards/__tests__/` 아래 신규 순수 파서/비교 모듈 + vitest 스위트 추가로 구성된다. 신규 모듈은 리포지토리 내 여러 정적 파일(.sh, .yml, package.json, 디렉터리 목록)을 읽기 전용으로 검사할 뿐 파일 생성·수정·삭제, 전역 변수 변경, 환경 변수 조작, 네트워크 호출, 콜백/이벤트 변경이 전혀 없다. 유일하게 주목할 점은 (a) `ROOT` 상수가 모듈 import 시점에 즉시 평가되며 실패 시 throw 하는 top-level 부작용이라는 점과 (b) frontend 테스트가 harness 스크립트·워크플로 파일 구조에 암묵적으로 결합된다는 점인데, 둘 다 이 가드의 설계 의도(#968 drift 재발 차단)에 부합하는 의도된 트레이드오프이며 현재 diff 범위에서 추가 조치가 필요한 결함은 없다.

## 위험도

NONE
