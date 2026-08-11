# 테스트(Testing) Review

## 대상

- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts`
- `plan/in-progress/typescript-toolchain-followups.md`

## 발견사항

- **[WARNING]** `repoRoot()` 마커 상향 탐색 로직에 대한 합성(synthetic) 회귀 테스트가 없다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:25-38`(`repoRoot` 함수 정의, 전체 파일 컨텍스트 게이트 기준)
  - 상세: `plan/in-progress/typescript-toolchain-followups.md:118-121`(체크리스트 TEST WORKFLOW 항목)은 "뮤테이션 8종 전부 RED"에 `repoRoot marker`를 포함한다고 명시하지만, `internal-package-registration.test.ts`·`typescript-toolchain.test.ts` 어느 쪽에도 `repoRoot()`를 직접 호출해 그 반환값·throw 조건을 단언하는 테스트가 없다. `ROOT = repoRoot()`는 모듈 로드 시 1회 평가되어 실제 저장소 경로를 우연히 통과할 뿐, (a) 상향 탐색이 정확한 디렉터리에서 멈추는지, (b) `MAX_DEPTH`(12) 초과 시 실제로 throw 하는지, (c) 파일시스템 루트(`parent === dir`)에서 멈추는지는 아무 assertion 도 겨냥하지 않는다. 같은 PR 안에서 `listAtPath`의 "인라인 주석 제거" 축은 정확히 같은 패턴("수동 뮤테이션 실측 → 이 축만 커버리지가 비어 있었다 → 영구 회귀 테스트로 고정", `internal-package-registration.test.ts:338-351` 참고)을 따라 새 테스트로 남겼는데, `repoRoot`만 이 관례에서 빠졌다. 게다가 이번 변경으로 `repoRoot`가 두 가드(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`)가 공유하는 단일 지점(`_shared.ts`)이 되어, 이 로직이 깨지면 blast radius 가 커진다 — 정확히 이 PR 자신의 동기("형제가 리팩터되면 무관한 가드가 덩달아 깨진다")와 같은 급의 위험을 반대 방향(공유 프리미티브 자체의 무결성)에서 놓치고 있다.
  - 제안: 같은 파일의 다른 함수들(`expandWorkspaceGlobs(readDir)`, `discoverWorkspaceDirs(readLines)`)과 동일한 DI 관례로 시작 `dir`·`fs.existsSync`를 주입 가능하게 만들어, 합성 입력으로 (1) 정상 상향 후 마커 발견, (2) `MAX_DEPTH` 초과 시 throw, (3) 파일시스템 루트 도달 시 중단 세 갈래를 각각 고정할 것.

- **[INFO]** `listAtPath` 인라인 주석 제거가 "공백 없이 붙은 `#`" 경계를 커버하지 않음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:98`(`m[1].replace(/\s+#.*$/, "")`) / 신규 테스트 `internal-package-registration.test.ts:338-351`
  - 상세: 정규식이 `#` 앞에 공백 1개 이상(`\s+`)을 요구하므로 `codebase/packages/a/**#comment`처럼 공백 없이 붙은 `#`는 주석으로 인식되지 않고 값에 그대로 남는다(YAML 관례상 의도된 동작으로 보임). 새로 추가된 테스트는 두 라인 모두 "공백 + `#`" 형태만 다루어 이 경계(공백 없는 `#`가 값의 일부로 남는지)를 명시적으로 확인하지 않는다.
  - 제안: 이 경계를 확인하는 케이스 하나를 추가해 의도된 동작임을 테스트로 문서화.

- **[INFO]** `validateWorkspacePatterns`의 실패 메시지가 옛 호출부 이름(`discoverWorkspaceDirs`)을 하드코딩
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:123-126`
  - 상세: 이번 변경으로 `validateWorkspacePatterns`를 독립적으로 직접 호출·단언하는 테스트(`typescript-toolchain.test.ts:195-203`)가 새로 생겼는데, throw 메시지는 여전히 `"discoverWorkspaceDirs: pnpm-workspace.yaml 의 packages: 목록을 읽지 못했다"`로 옛 호출부 이름을 접두어로 남긴다. 함수 자신의 이름이 아니라서, 이 순수 함수의 테스트가 실패했을 때 vitest 출력만 보면 원인 함수를 오인하기 쉽다.
  - 제안: 메시지 접두어를 함수 중립적으로 바꾸거나(`"packages: 목록을 읽지 못했다"`만 남기기), 유지한다면 왜 옛 이름을 남겼는지 주석으로 남길 것.

## 긍정적으로 확인된 점 (회귀 위험 없음)

- **재export 경로 검증**: `internal-package-registration.test.ts`는 여전히 `./internal-package-registration-guard`에서 `listAtPath` 등을 import하고(직접 `_shared`를 import하지 않음), 그 경로가 그대로 통과한다 — `_shared.ts` 추출이 기존 소비처 계약을 깨지 않았음을 실제로 검증한다.
- **호출부 테스트(헬퍼 ≠ 호출부)**: `validateWorkspacePatterns`를 순수 함수로 분리한 뒤, 헬퍼 단독 테스트에 그치지 않고 `discoverWorkspaceDirs(() => [...])`를 통해 "호출부가 실제로 그 검증을 태우는가"까지 겨냥했다(`typescript-toolchain.test.ts:210-219`). `null`/`[]` 두 실패 모드를 갈라 각각 고정한 것도 정확하다 — 두 케이스의 트레이스를 직접 따라가 봐도(코멘트 라인이 "packages:" 문자열을 포함하지만 스킵되는 경우, `packages:` 키는 있지만 자식이 전부 스킵되어 빈 배열이 되는 경우) 의도한 분기를 정확히 가른다.
- **DI 기반 테스트 용이성**: 전통적 mock/stub(`vi.mock` 등) 없이 `readLines`/`readDir`/`resolveName` 주입만으로 fs 접근을 분리했다 — 실제 동작과의 괴리가 생길 mocking 계층이 없고, 실측 테스트(실제 저장소 상태)와 합성 fixture 테스트가 같은 함수를 서로 다른 입력으로 검증하는 구조가 일관적이다.
- **테스트 격리**: 각 `describe` 블록의 top-level `fs.readFileSync`/`discoverPackages()` 호출은 파일별로 독립적이며 테스트 간 공유 mutable 상태가 없다.
- **가독성**: 신규 테스트 설명·주석이 "왜 이 케이스가 필요한가"(뮤테이션 실측 근거, #968/#1047 사고 이력)를 각 `it` 옆에 남겨 의도가 명확하다.

## 요약

이번 변경은 두 repo-guard 모듈 간 공유 프리미티브(`_shared.ts`) 추출과 `validateWorkspacePatterns` fail-closed 검증의 순수 함수 분리를 다루며, 분리된 각 축에 대해 대체로 성실한 synthetic fixture·call-site 테스트를 동반한다. 특히 "헬퍼만 테스트하면 호출부의 검증 우회 뮤턴트가 살아남는다"는 이 저장소의 기존 교훈을 이번에도 실측(뮤테이션)으로 재확인하고 즉시 테스트로 고정한 점은 모범적이다. 다만 이번 리팩터로 두 가드의 단일 SoT가 된 `repoRoot()`의 마커 상향 탐색 로직 자체는 — plan 체크리스트가 뮤테이션 검증을 주장함에도 — 스위트 안에 영구 고정된 회귀 테스트가 없어, 같은 PR이 다른 축(`listAtPath` 인라인 주석)에는 적용한 "수동 실측 → 영구 fixture" 관례에서 이 함수만 빠져 있다. 그 외에는 CRITICAL 급 결함이나 회귀 위험이 발견되지 않았다.

## 위험도

LOW
