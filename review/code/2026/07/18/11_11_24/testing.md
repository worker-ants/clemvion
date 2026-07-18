# 테스트(Testing) 리뷰 — internal-package-registration drift 가드

## 검증 수행
- `pnpm vitest run src/lib/repo-guards/__tests__/internal-package-registration.test.ts` → 30/30 pass 확인 (실행 가능·green 확인됨).
- `codebase/backend/package.json` 실측: `@workflow/*` 는 전부 `dependencies` 에만 존재, `devDependencies` 에는 0개.
- `codebase/packages/*` 실측: 7개 디렉터리 중 `.gitignore`(파일) 1개 — `discoverPackages()` 의 `isDirectory()` 필터가 실제로 exercise 됨(우연이지만 실질 커버리지 있음). 모든 디렉터리가 `package.json` 보유 — "package.json 부재 → null 필터" 분기는 현재 실전·합성 양쪽 모두 미검증.
- `vitest.config.ts`: `include: ["src/**/*.{test,spec}.{ts,tsx}"]` — 파일 주석의 "glob 자동 발견" 주장과 일치, 실측 확인.
- `tsconfig.json` exclude 는 `src/**/*.test.ts` 패턴(주석은 `src/**/__tests__/**` 라고 서술) — 결과(컴파일 제외)는 동일하지만 근거로 든 패턴명이 실제와 다름. 코드 결함 아님, 주석 정확도 이슈.

## 발견사항

- **[WARNING]** `discoverPackages()` / `backendWorkflowDeps()` — 이 파일의 나머지 파서(`internalPackages`/`fnBody`/`explicitFilterCalls`/`listAtPath`/`packageDirsInPaths`/`missingFromStage`)는 전부 "합성 fixture" 단위 테스트로 순수 로직의 true-positive/negative 를 박제했는데(파일 자체 주석이 이를 "WARNING#2 반영"이라 명시), 이 두 함수만 그 처리에서 빠져 있다. 실제 저장소 상태로만 간접 검증된다.
  - 위치: `internal-package-registration.test.ts:891-899`(`backendWorkflowDeps`), `:877-889`(`discoverPackages`)
  - 상세: (1) `backendWorkflowDeps()` 의 `{...pkg.dependencies, ...pkg.devDependencies}` 병합 분기 중 `devDependencies` 쪽은 현재 저장소에 `@workflow/*` 가 0개라 실측으로도 전혀 exercise 되지 않는다 — devDependencies 전용 내부 패키지가 향후 추가되면 이 병합 경로에 잠복한 버그(예: 오타로 `devDependencies` 를 안 읽는 회귀)가 있어도 어떤 테스트도 못 잡는다. (2) `discoverPackages()` 의 "`package.json` 없는 디렉터리 → null 필터" 분기는 현재 `codebase/packages/*` 전부가 `package.json` 을 갖고 있어 실측으로도 미검증이며, 합성 fixture 도 없다. 두 함수 모두 `PACKAGES_DIR`/`ROOT` 를 하드코딩 참조해 인자를 안 받는다 — 나머지 함수들이 문자열 인자를 받아 테스트하기 쉽게 리팩터된 것과 비대칭적이다(테스트 용이성 관점 gap).
  - 제안: `discoverPackages`/`backendWorkflowDeps` 의 순수 부분(디렉터리 엔트리 배열 → `{dir,name}[]`, dependency map → `string[]`)을 인자 주입 가능한 헬퍼로 분리하고, "package.json 없는 항목 skip", "devDependencies 전용 항목도 병합" 두 케이스를 합성 fixture 로 고정. 최소한 각각 1개 테스트 추가 권장.

- **[INFO]** heredoc 조기-닫힘 가드의 합성 테스트가 `<<EOF` 변형만 커버하고 `<<-EOF`(tab-strip 변형, 정규식상 이미 허용됨: `<<-?`) 는 별도 fixture 가 없다.
  - 위치: `internal-package-registration.test.ts:1208-1211` (`fnBody` describe)
  - 상세: `fnBody` 의 정규식 `/(?<!<)<<-?(?!<)/` 은 `<<-EOF` 도 이미 올바르게 매치하지만, 이를 직접 증명하는 합성 케이스가 없어 향후 이 정규식을 리팩터할 때 `-` 옵션 처리가 조용히 깨져도 회귀가 안 잡힐 수 있다.
  - 제안: `cmd_x() {\n  cat <<-EOF\n}\n\tEOF\n  ...\n}\n` 형태의 fixture 1건 추가.

- **[INFO]** `discoverPackages`·`backendWorkflowDeps` 실측 기반 검증 자체는 의도된 설계(레포 실제 상태를 SoT 로 삼는 drift 가드이므로 mock 을 쓰지 않는 것이 오히려 옳다)이며, 위 WARNING 은 "이 두 함수의 파서 로직 자체" 에 대한 합성 커버리지 공백을 말하는 것이지 설계 방향 자체의 문제는 아니다. Mock 사용 없음은 이 테스트 유형에서 적절하다 — 리뷰 관점 4(Mock 적절성)는 문제 없음.

- **[INFO]** 주석 부정확: 파일 헤더 주석(`internal-package-registration.test.ts:47`, "주의: tsconfig 가 `src/**/__tests__/**` 를 exclude")은 실제 `tsconfig.json` 의 exclude 패턴(`src/**/*.test.ts`)과 표현이 다르다. 결과(컴파일 제외)는 동일하므로 테스트 동작에는 영향 없음 — 문서 정확도 수준의 사소한 지적.

## 요약

새로 추가/보강된 `internal-package-registration.test.ts` 는 이미 한 차례 ai-review WARNING 2건(순수 함수 분리 + heredoc fail-loud)을 반영해 상당히 성숙한 상태다. 실제 리포 상태(test-stages.sh·packages-checks.yml·codebase/packages·backend package.json)를 SoT 로 삼아 drift 를 잡는 메타 가드 특성상 mock 없이 실 파일을 읽는 설계는 타당하고, 파싱/비교 핵심 로직(`internalPackages`/`fnBody`/`explicitFilterCalls`/`listAtPath`/`packageDirsInPaths`/`missingFromStage`)은 통제된 합성 fixture 로 true-positive/negative 가 잘 고정되어 있으며 vacuity 방지 테스트까지 갖춰 회귀 방지력이 높다(30/30 실행 확인). 다만 이 파일 안에서 유일하게 남은 비대칭 지점은 `discoverPackages()`/`backendWorkflowDeps()` 두 함수로, 인자 주입이 안 돼 있어 실 저장소 상태에만 의존하고 "package.json 부재 디렉터리", "devDependencies 전용 내부 패키지" 같은 현재 저장소에 존재하지 않는 분기가 합성 테스트로도 실측으로도 커버되지 않는다 — 코드 변경이 시급한 CRITICAL 은 아니지만, 이 가드가 스스로에게 요구하는 기준(파서 자신의 회귀도 fixture 로 고정)에는 아직 못 미치는 지점이라 WARNING 으로 남긴다.

## 위험도
LOW
