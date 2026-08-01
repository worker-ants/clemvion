---
title: TypeScript 7.0.2 → 5.x 롤백 — 젠킨스 main 빌드 차단 복구 + major bump 재발 방지
worktree: jenkins-build-failure-a067df
started: 2026-08-01
owner: developer
status: in-progress
priority: P0
spec_impact: none
---

## Overview

dependabot PR `#1047` (`484ee9509`) 이 `typescript` 를 `5.9.3` → **`7.0.2`** 로 올렸다.
TypeScript 7 은 Go 네이티브 재작성판이고 **JS compiler API 를 제공하지 않는다**. 그 결과
Jenkins `Clemvion/337` (main, `06c2651c9`) 의 backend·frontend 이미지가 **둘 다** 빌드 실패했다.
migrate 만 성공 — flyway 이미지라 TS 무관.

main 이 배포 불가 상태이므로 P0.

## 실측한 원인

### TS7 패키지 구조 (`node_modules/typescript`)

```
lib/  →  getExePath.js   tsc.js   version.cjs        (typescript.js 없음)
package.json exports["."] = "./lib/version.cjs"
optionalDependencies: @typescript/typescript-{linux-x64,darwin-arm64,…}  ← 네이티브 바이너리
```

```
require('typescript')                          → { version, versionMajorMinor }
require('typescript').getParsedCommandLineOfConfigFile → undefined
```

compiler API 는 `typescript/unstable/*` 라는 **새 export 표면**으로만 나온다. 기존
`require('typescript')` 소비자(nest CLI · ts-jest · fork-ts-checker · typescript-eslint)는 전부 비호환.
lockfile 의 typescript-eslint peer 범위도 `>=4.8.4 <6.1.0` 으로 애초에 TS7 을 배제한다.

### 실패 1 — backend (`nest build`)

`@nestjs/cli@11.0.23` 의 `TypeScriptBinaryLoader.load()` (실제 코드):

```js
const tsBinaryPath = require.resolve('typescript', {
  paths: [process.cwd(), ...this.getModulePaths()],   // ← cwd 우선
});
const tsBinary = require(tsBinaryPath);
```

`process.cwd()` = `/app/codebase/backend` → backend 가 직접 선언한 `typescript@7.0.2` 를 집는다.
`@nestjs/cli` 가 자기 `dependencies` 로 `typescript@5.9.3` 을 갖고 있어도 cwd 가 먼저라 무효.
`require.resolve` 도 `require` 도 **성공**하므로 "TypeScript could not be found" 폴백에 걸리지 않고
버전 스텁이 그대로 반환된다:

```
Error  tsBinary.getParsedCommandLineOfConfigFile is not a function
```

### 실패 2 — frontend (`pnpm install` 단계)

`codebase/packages/sdk` 의 `prepare` 훅이 install 도중 `tsc` 를 돌린다. TS7 이 `@types/node`
**자동 포함을 하지 않아** Node 글로벌이 전부 미해결:

```
src/client.ts(39,44)    TS2304  Cannot find name 'NodeRequire'.
src/signature.ts(1,45)  TS2591  Cannot find name 'crypto'.
src/signature.ts(70,23) TS2591  Cannot find name 'Buffer'.
```

심링크는 멀쩡히 존재한다(`sdk/node_modules/@types/node → @types+node@20.19.43`). 자동 탐색만 안 된다 —
`tsc --types node` 로 명시하면 **exit 0**. `prepare` 실패가 install 전체를 죽여 frontend 이미지는
빌드 시작조차 못 했다.

로컬(darwin/node22)에서 동일 재현 — 젠킨스·도커 환경 문제가 아니다.

## 왜 머지 전에 안 걸렸나

- `.github/dependabot.yml` 에 루트 워크스페이스가 `#1043` (2026-07-31) 로 **등록된 다음 날** 이 PR 이 나왔다.
  등록 시 **major ignore 규칙을 두지 않았다** — `plan/in-progress/deps-guard-hardening.md §3` 의
  관심사는 "구 base 되돌림" 이었지 "major 점프" 가 아니었다.
- `packages-checks.yml` matrix 는 backend-공유 패키지만 대상이라 `@workflow/sdk` 가 빠져 있다.
- backend 전용 CI 워크플로가 없어 `nest build` 는 Jenkins Docker 빌드에서만 돈다.
- `packages-checks.yml` 헤더가 적고 있듯 **repo 레벨에서 Actions 가 꺼져 있다**(런 수 0).
  즉 dependabot PR 은 어떤 CI 검증도 없이 머지된다.
- 로컬에서도 `prepare` 가 `[ -d dist ] || tsc` 라 `dist` 가 남아 있으면 건너뛴다.

## 조치

- 10개 워크스페이스 매니페스트의 `typescript` 를 `#1047` 이전 값으로 복원 (`^5.7.3` / `^5`)
- lockfile 재생성
- `dependabot.yml` 에 `typescript` major ignore + 사고 경위 주석
- 회귀 가드 신설 — 버전 숫자가 아니라 **능력**을 검사한다 (§가드 설계)

### 가드 설계

`codebase/frontend/src/lib/repo-guards/` 의 기존 패턴(순수 로직 모듈 + `.test.ts`)을 따른다.
두 축을 함께 둔다:

1. **능력 검사 (primary)** — 실제로 resolve 되는 `typescript` 가 `getParsedCommandLineOfConfigFile`
   등 JS compiler API 를 노출하는가. 버전 문자열이 아니라 이번 사고의 **직접 원인**을 재현한다.
   TS8 이 API 를 되살리면 통과하고, 어떤 버전이든 API 가 없으면 실패한다.
2. **lockstep (secondary)** — 전 워크스페이스의 `typescript` range major 가 하나로 일치하는가.
   일부만 올라가 컴파일러가 갈리는 드리프트를 막는다.

## 체크리스트

- [x] 매니페스트 10건 복원 + lockfile 재생성 — `git apply -R` 로 `#1047` 이전 값 정확 복원
      (`^5.7.3` ×8 · `^5` ×2). `pnpm install` 재생성 후 lockfile 에 `typescript@7.0.2` 소멸,
      `5.9.3` 단일. `sdk prepare: Done` 으로 실패 2 해소 확인.
- [x] dependabot major ignore — `update-types: ["version-update:semver-major"]` 로 major 만 차단
      (minor/patch·security 는 계속 수신). 되살릴 조건을 주석에 명시.
- [ ] 회귀 가드 (능력 + lockstep) — 작성·20건 통과. mutation 검증 미완
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review` + Critical/Warning 조치
- [ ] push + PR

## 미수행 단계와 근거

- **`/consistency-check --impl-prep` 생략** — 본 변경은 의존성 버전 복원·CI 설정·저장소 가드로
  `spec/` 어느 영역도 대상이 아니다(`spec_impact: none`). checker 5종에 넘길 `<spec/영역>` 인자가
  성립하지 않는다. 같은 성격의 `deps-guard-hardening` 도 동일하게 생략했다.
  `/ai-review` 는 규약대로 수행한다.

## 남은 위험 (본 PR 범위 밖)

같은 dependabot 배치의 나머지 major 머지는 **아직 검증되지 않았다** — TS 에서 먼저 죽어
빌드가 그 지점까지 가지 못했다:

| PR | 변경 | 성격 |
| --- | --- | --- |
| `#1044` | jest-axe 10 → 11 | dev, 테스트 |
| `#1049` | eslint-plugin-unicorn 56 → 72 | dev, lint (16 major) |
| `#1050` | uuid 13 → 14 | **런타임** |

본 PR 로 빌드가 복구되면 그 지점부터 드러난다. TEST WORKFLOW 에서 관측되는 것은 여기에 기록한다.
