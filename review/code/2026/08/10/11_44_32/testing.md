# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `findKeyLine`의 "리스트 항목(`- key: x`)은 선언이 아니다" 분기를 직접 겨냥하는 테스트가 여전히 없음 (이전 라운드 지적 항목의 재확인 + 실측 보강)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:97` (`if (t.startsWith("- ")) continue;`, 함수 `findKeyLine`, 선언은 `:87`)
  - 상세: 이 분기의 JSDoc(`:84`)이 드는 예시("`jobs.*.steps[].name` 같은 흔한 매트릭스에서 엉뚱한 줄을 잡는다")는 추상적 우려가 아니라 이 저장소의 실제 `.github/workflows/packages-checks.yml`에 문자 그대로 존재한다(`packages` job의 `steps: - name: 무관한 변경 — 검사 생략 …`). 그런데 `shared.test.ts`·`internal-package-registration.test.ts`·`typescript-toolchain.test.ts` 어느 fixture 도 "검색 대상 key와 이름이 같은 리스트 항목(`- <key>: …`)"이 탐색 범위 안에 함께 있는 형태를 넣지 않는다. 정적으로 추적한 결과 이 줄을 제거해도 현재 82건 스위트가 green으로 남을 가능성이 높다(실제 뮤테이션 실행으로 확인하지는 않았음 — 공유 워크트리라 소스를 직접 수정하는 실험은 피함). `internal-package-registration.test.ts`가 읽는 실제 `packages-checks.yml`도 이 충돌이 발생하는 위치(`strategy.matrix.pkg` 탐색은 `steps:`보다 앞서 끝나는 범위 안이라) 우연히 걸리지 않아 실측 대조 테스트로도 못 잡는다.
  - 제안: `shared.test.ts`의 `listAtPath — YAML 서브셋 추출` describe에 `- <key>: …` 형태의 리스트 항목이 탐색 대상 key와 이름이 겹치는 fixture(예: `steps:\n  - name: 무관한 변경\n<key>:\n  - a`)를 1건 추가해 이 분기를 직접 뮤테이션으로 겨냥. 이 항목은 직전 라운드(`review/code/2026/08/10/11_22_14/testing.md`)에서 이미 INFO로 지적됐고 RESOLUTION.md가 "커버리지 갭 아님"으로 조치를 보류한 사안이라 — 재차 WARNING으로 올리지 않고 INFO로 재확인만 한다. fix→리뷰 stale 루프를 만들 정도의 항목은 아니라고 판단.

- **[INFO]** `internal-package-registration.test.ts`가 "listAtPath 합성 회귀는 shared.test.ts로 옮겼다"고 적은 주석과, 같은 파일에 남아 있는 "5단계 중첩 경로" 테스트가 서로 어긋남
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:325`~`329`(주석), `:340`("5단계 중첩 경로(jobs.packages.strategy.matrix.pkg)도 추출한다 (실 yml 형태)" 테스트)
  - 상세: 주석은 "`listAtPath` 자체의 합성 회귀(중첩 경로·형제 키·null·인라인 주석)는 소유 모듈 스위트 `shared.test.ts`로 옮겼다 … 여기 남는 것은 이 가드의 소비 방식(`packageDirsInPaths`로 거르는 것)뿐"이라고 명시하는데, 바로 아래 남아 있는 "5단계 중첩 경로" 테스트는 `listAtPath`를 직접 호출해 원시 반환값을 단언할 뿐 `packageDirsInPaths`를 거치지 않는다 — 이관 스스로 세운 경계 원칙을 그 파일 자신이 지키지 않는 형태다. 기능적 결함이나 커버리지 손실은 아니다(오히려 중복 커버리지). 다만 다음에 이 파일을 "소비 방식만 남기기" 원칙에 따라 정리하는 사람이 이 주석만 믿고 해당 테스트를 지우면 실 `packages-checks.yml`의 5-레벨 중첩 형태(`jobs.packages.strategy.matrix.pkg`)를 겨냥하는 유일한 합성 테스트가 조용히 사라질 수 있다.
  - 제안: 이 테스트도 `shared.test.ts`로 옮기거나(권장 — 헤더 원칙과 일치), 옮기지 않을 거라면 주석에 "단, 실 yml 5-레벨 중첩 형태 확인용 테스트 1건은 예외로 남긴다"고 정정.

- **[INFO]** `repo-guards/__tests__/**`(신규 `_shared.ts` 포함)는 `tsc --noEmit`·`next build`·type-aware eslint 어느 것으로도 타입 검사되지 않음 — 이번 diff의 검증 근거 문구가 시사하는 범위보다 좁을 수 있음
  - 위치: `codebase/frontend/tsconfig.json`의 `exclude: ["src/**/__tests__/**", …]` (repo-guards 폴더 전체가 여기 해당); `codebase/frontend/package.json`의 `"test": "vitest run"`(타입체크 플래그 없음); `codebase/frontend/eslint.config.mjs`(`parserOptions.project` 미설정으로 type-aware 규칙 비활성)
  - 상세: 이 구조는 이번 diff가 새로 만든 것이 아니라 각 파일 헤더가 반복 설명하는 기존 저장소 관례다(`_shared.ts:13`, `internal-package-registration-guard.ts:11` 등). 다만 `RESOLUTION.md`/`SUMMARY.md`의 검증 절이 "`pnpm --filter frontend exec tsc --noEmit` — 0 errors"를 근거로 드는데, 이 폴더는 애초에 그 컴파일 단위 밖이라 `_shared.ts`에 새로 만들어진 함수 시그니처(`repoRoot(startDir, exists)` 등)의 타입 정합성은 이 검증으로 확인되지 않는다(vitest는 esbuild로 타입을 strip하고 실행만 한다). 실질 위험은 낮다 — 함수가 소수이고 타입이 단순해 IDE에서 즉시 드러날 형태이지만, "검증했다"는 문구가 실제로 검증한 범위보다 넓게 읽힐 여지가 있다.
  - 제안: 필수 아님. 다음 검증 로그에 "이 폴더는 tsc 컴파일 단위 밖(타입 검증은 IDE·리뷰 의존)"이라는 단서를 한 줄 추가하면 오독을 막을 수 있다.

## 요약

이번 diff는 신규 기능이 아니라 repo-guard 테스트 인프라의 리팩터(공유 프리미티브를 중립 모듈 `_shared.ts`로 이관 + `repoRoot`/`discoverWorkspaceDirs`의 의존성 주입 대칭화 + `validateWorkspacePatterns` fail-closed 분리)이며, 실측으로 `pnpm exec vitest run src/lib/repo-guards/__tests__/` → 3 files / **82 passed**를 직접 재현 확인했다. `exists`/`readLines`/`readDir` 형태의 순수 함수 주입만 쓰고 프레임워크 mock을 전혀 쓰지 않아 실제 동작과의 괴리 위험이 낮고, `repoRoot`의 fail-closed throw·최근접 marker 우선·filesystem-root 조기 종료·`MAX_ROOT_SEARCH_DEPTH` 정확한 소진 횟수 등 경계값이 촘촘히 고정돼 있으며, `validateWorkspacePatterns`는 `null`/`[]` 두 실패를 분리하고 "헬퍼만이 아니라 호출부(`discoverWorkspaceDirs`)가 실제로 그 검증을 태우는가"까지 별도로 단언해 이 저장소가 반복 지적해 온 "헬퍼 테스트 ≠ 호출부 테스트" 함정을 정확히 막는다. `listAtPath`의 이관도 소비자 파일(`internal-package-registration.test.ts`)의 재export 계약을 유지한 채 테스트만 소유 모듈로 옮겨 커버리지 손실 없이 완료됐다. 이 세션의 diff는 이미 4라운드(R1~R4) 리뷰를 거쳐 Critical 0·Warning 0으로 수렴한 상태이고, 이번 회차에서 새로 발견한 것은 모두 INFO 수준이며 그중 하나(`findKeyLine`의 리스트 항목 분기 미겨냥)는 직전 testing 라운드가 이미 지적하고 "조치 불요"로 판정한 항목의 재확인이다. 남은 두 건(테스트 이관 원칙과 실제 잔존 테스트의 불일치, tsc 컴파일 단위 밖 폴더의 검증 문구 범위)도 기능적 결함이 아니라 문서·조직 정합성 수준의 선택적 보강이다.

## 위험도

LOW
