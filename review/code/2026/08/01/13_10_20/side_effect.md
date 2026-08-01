# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 신규 jest spec 이 실제 자식 프로세스(로컬 `eslint` CLI 바이너리)를 스폰한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` 함수 `lintFixtureText` (게이트 73~97행)
  - 상세: `execFileSync(ESLINT_BIN, ['--stdin', '--stdin-filename', FIXTURE_RELATIVE_PATH, '--format', 'json'], { cwd: BACKEND_ROOT, input: text, encoding: 'utf8' })` 로 `node_modules/.bin/eslint` 를 서브프로세스로 실행한다. 네트워크 호출은 아니며(로컬 바이너리), `--fix`/`--cache` 플래그가 없어 디스크 쓰기도 없다(`--stdin` 모드는 stdout 만 반환). `cwd`/`env` 를 명시적으로 좁히지 않아 현재 프로세스의 전체 `env` 를 상속하지만, 이는 `execFileSync` 의 기본 동작이고 이 파일이 새로 도입한 위험은 아니다. 코드 주석(61~66행)이 CLI 서브프로세스를 택한 이유(Jest VM 이 flat config 의 동적 `import()` 를 막음)를 실측 근거와 함께 명시해 의도된 설계임이 분명하다. 부작용 관점에서 문제 삼을 요소는 없으나, "테스트가 외부 프로세스를 기동한다"는 점은 이 리뷰 관점(7. 네트워크/외부 호출)의 인접 사례로 기록해 둔다.
  - 제안: 조치 불요. 향후 `.bin/eslint` 부재(예: `--prod` 전용 설치) 환경에서 이 테스트가 도는지만 확인해두면 충분.

- **[INFO]** 새 순수 함수 모듈은 상태·부작용 없음 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts` 전체 (게이트 14~45행)
  - 상세: `parseGteFloor`/`parseCaretFloor`/`parseVersion`/`compareTriple`/`satisfiesFloor` 전부 인자만 소비하는 순수 함수다. 모듈 스코프의 가변 상태·전역 변수·I/O 가 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 fixture 파일은 파일시스템 부작용이 아니라 앵커 용도의 정적 파일
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-fixture.ts` (게이트 1~8행)
  - 상세: `export {}` 뿐인 빈 모듈. 헤더 주석이 밝히듯 실제 린트 대상 텍스트는 이 파일의 디스크 내용이 아니라 `lintFixtureText` 의 `text` 인자다 — `--stdin-filename` 이 typescript-eslint `projectService` 를 만족시키기 위한 존재 앵커일 뿐 런타임에 이 파일을 읽지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/eslint.config.mjs` 는 주석만 확장, 실행 경로 무변경
  - 위치: `codebase/backend/eslint.config.mjs` 함수형 설정 블록 (게이트 16~35행)
  - 상세: 실제 파일을 열어 확인한 결과 `plugins: { unicorn: eslintPluginUnicorn }` (35행) 과 룰 등록부는 diff 밖 컨텍스트로 무변경이다 — lint 동작에 실질 영향 없음. 이전 라운드(`review/code/2026/08/01/12_27_15/`) 리뷰의 결론과 동일.
  - 제안: 조치 불요.

- **[INFO]** `.github/dependabot.yml` ignore 항목 추가 — 의도된 이벤트 억제(재확인)
  - 위치: `.github/dependabot.yml` `eslint-plugin-unicorn` ignore 블록 (게이트 75~94행)
  - 상세: dependabot 의 향후 `eslint-plugin-unicorn` major 자동 PR 생성을 억제한다. 이전 라운드에서 이미 동일 항목으로 조치 불요 판정됐고, 이번 diff 는 그 항목의 근거 주석을 보강(registry 실측 표 위치 결속·caret range 문구 정정)한 것뿐 — 억제 대상·범위는 불변.
  - 제안: 조치 불요.

- **[INFO]** `pnpm-lock.yaml` 재계산은 이전 라운드에서 이미 `eslint-plugin-unicorn` 서브트리 격리로 검증됨
  - 위치: `pnpm-lock.yaml` snapshots 섹션(`eslint-plugin-unicorn@56.0.1(eslint@9.39.4(...))` 블록 및 그 transitive 항목들)
  - 상세: 이번 diff 는 직전 라운드(`review/code/2026/08/01/12_27_15/side_effect.md`)가 이미 실측 검토한 lockfile 변경과 동일 — 구식 transitive devDependency(`hosted-git-info@2.8.9`, `semver@5.7.2` 등) 재유입은 unicorn 서브트리 전용이며 다른 워크스페이스/production 의존성과 공유되지 않는다. 이번 라운드에서 추가된 diff는 없다(파일 크기·해시가 라운드 간 안정).
  - 제안: 조치 불요.

- 시그니처/공개 API/전역 상태/환경 변수 관점에서 실질 변경 없음
  - `eslint-unicorn-peer-guard.ts` 의 신규 export 들은 기존 함수를 변경하는 게 아니라 순수 신규 추가이므로 기존 호출자에 영향 없음.
  - `PROJECT.md`/plan 문서 편집은 문서일 뿐 런타임 동작과 무관.
  - `review/code/2026/08/01/12_27_15/*` 신규 파일들은 이전 리뷰 라운드의 산출물을 그대로 커밋한 것으로, 프로젝트 규약(`review/` 는 gitignore 대상 아님)에 부합하는 예상된 파일시스템 변경이다.

## 요약

이번 diff 는 직전 리뷰 라운드(`12_27_15`)의 Warning 3건(Documentation/Testing/Maintainability)에 대한 조치분이다. 핵심 변경은 (1) `PROJECT.md`·`dependabot.yml`·`eslint.config.mjs` 의 문서/주석 보강, (2) `unicorn/catch-error-name` 실발화 + peer eslint range 정합을 검증하는 신규 backend jest 스펙(`eslint-unicorn-peer.spec.ts` + 순수 로직 `eslint-unicorn-peer-guard.ts` + 앵커 fixture) 추가다. 새로 도입된 유일한 실행-시점 부작용은 테스트가 로컬 `eslint` CLI 를 서브프로세스로 스폰하는 것인데, 디스크 쓰기·네트워크 호출이 없고 코드 주석에 의도가 명시돼 있어 문제 삼을 부작용이 아니다. 순수 파서 모듈은 전역 상태·I/O 가 전혀 없다. `eslint.config.mjs` 의 실질 등록부·룰은 무변경이며, `pnpm-lock.yaml`·`dependabot.yml` 의 부작용은 이전 라운드에서 이미 NONE 으로 검토된 항목과 동일하다. 기존 함수/API 시그니처 변경, 전역 변수 도입, 예상치 못한 환경 변수 읽기/쓰기, 의도치 않은 외부 네트워크 호출은 발견되지 않았다.

## 위험도

NONE
