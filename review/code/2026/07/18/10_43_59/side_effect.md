# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 모듈 로드(수집) 시점의 동기 파일시스템 읽기 + throw
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:374(ROOT = repoRoot())`, `677-717(discoverPackages/backendWorkflowDeps)`, `831-835(describe 콜백 최상단 fs.readFileSync 3건)`
  - 상세: `repoRoot()`·`discoverPackages()`·`backendWorkflowDeps()`·`fs.readFileSync(TEST_STAGES/PACKAGES_CHECKS)` 가 `it()` 내부가 아니라 모듈 최상단/`describe()` 콜백 본문에서 즉시(eager) 실행된다. vitest 는 파일 discover(collection) 단계에서 이 코드를 실행하므로, 실행 환경이 예상과 다르면(예: 12단계 이내에 `pnpm-workspace.yaml` 미존재, `codebase/packages` 디렉터리 부재) `describe` 블록 진입 자체가 throw 로 실패하고 해당 테스트 파일 전체가 collection error 로 보고된다.
  - 이는 파일 헤더 주석(`throw new Error(...)`, "조용히 틀리느니 깨지게 만든다")에 명시된 **의도된 fail-closed 설계**이며, 다른 테스트 파일이나 전역 vitest 실행에 영향을 주지 않는다(파일 단위 격리). 부작용이라기보다 설계 의도이므로 CRITICAL/WARNING 이 아닌 INFO 로 기록.
  - 제안: 현행 유지 가능. 다만 "정상 워크스페이스 checkout 이 아닌 상황(예: 단일 파일만 복사해 vitest 실행)에서 이 가드 파일이 다른 정상 테스트까지 collection error 로 끌고 가지 않는지"는 CI 러너 구성이 항상 repo 루트 checkout 이라는 전제에 의존한다 — 문서화된 전제이므로 별도 조치 불필요.

- **[INFO]** 파일시스템 접근은 전부 read-only, 네트워크·환경변수·전역변수 부작용 없음
  - 위치: 신규 테스트 파일 전체 (`fs.readFileSync`, `fs.readdirSync`, `fs.existsSync` 만 사용)
  - 상세: grep 결과 `writeFile`/`mkdir`/`unlink`/`rmSync`/`child_process`/`exec`/`spawn`/`process.env`/`fetch`/`http.`/`https.`/`axios` 매칭 0건. 테스트가 리포지토리 파일을 수정·생성·삭제하거나 외부 네트워크를 호출하거나 프로세스 환경변수를 읽고 쓰는 코드가 없음을 확인. 새 전역 변수 도입도 없음(모듈 스코프 `const` 는 이 파일 내부로 격리되며 다른 모듈에 노출되지 않음).

- **[INFO]** `.claude/test-stages.sh` / `.github/workflows/packages-checks.yml` 변경은 주석 전용
  - 위치: 두 파일의 diff (`test-stages.sh:22-39`, `packages-checks.yml:2-8` 부근)
  - 상세: 두 파일 모두 실행 로직(`INTERNAL_PACKAGES` 배열 값, `cmd_lint/cmd_unit/cmd_build` 본문, `on.pull_request.paths`/`on.push.paths`/`matrix.pkg` 값)에는 변경이 없고 설명 주석만 추가됐다. 함수 시그니처·CI 트리거 조건·잡 매트릭스 등 실제 동작에 영향을 주는 부분은 그대로다. 따라서 CI 실행 결과·로컬 wrapper 동작에 어떠한 회귀도 유발하지 않는다.

- **[INFO]** 정규식 기반 shell/YAML "파서"의 조기 실패(throw)가 신규 코드 형태에 취약할 수 있음(부작용은 아니나 연쇄 실패 가능성 메모)
  - 위치: `fnBody()` (`:110-125`), `internalPackages()` (`:93-96`)
  - 상세: 이는 파일 자체 주석에서 이미 명시적으로 인지·경고하고 있는 알려진 한계(브레이스 카운팅이 아닌 라인 시작 `}` 휴리스틱)이며, 조건 위반 시 조용히 틀리지 않고 `throw` 하도록 설계되어 있다(자체 self-check). 향후 `test-stages.sh`(shell) 구조가 바뀌면(중첩 `{}` 블록 도입 등) 이 가드 테스트가 throw 하여 무관한 PR 의 `pnpm --filter frontend test` 를 실패시킬 수 있다 — 다만 이는 "부작용" 이라기보다 가드의 의도된 기능(조기 경보)이다. Side-effect 리뷰 관점에서는 문제 없음으로 판정.

## 요약

세 변경 중 두 개(`test-stages.sh`, `packages-checks.yml`)는 순수 주석 추가로 런타임 동작에 아무런 영향이 없다. 신규 파일(`internal-package-registration.test.ts`)은 리포지토리 내 3개 파일(`codebase/packages/*/package.json`, `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `codebase/backend/package.json`)을 **읽기만** 하며 파일 생성·수정·삭제, 네트워크 호출, 환경변수 접근, 전역 상태 변경, 기존 함수 시그니처/공개 API 변경이 전혀 없다. 모듈 스코프에서 즉시 실행되는 read + throw 패턴은 vitest collection 단계에서 발생하지만 파일 단위로 격리되어 다른 테스트나 외부 상태에 부작용을 전파하지 않으며, 이는 파일 헤더에 명시된 fail-closed 설계 의도와 일치한다. 부작용 관점에서 이 변경 세트는 위험 요소가 없다.

## 위험도
NONE
