---
title: TypeScript 7.0.2 → 5.x 롤백 — 젠킨스 main 빌드 차단 복구 + major bump 재발 방지
worktree: jenkins-build-failure-a067df
started: 2026-08-01
owner: developer
status: complete
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
- [x] 회귀 가드 (능력 + lockstep) — 20건. `vitest list` 로 자동 수집 확인(전체 5781 → 5801),
      mutation 4종으로 non-vacuous 증명:
      | 뮤턴트 | 결과 |
      | --- | --- |
      | sdk 매니페스트만 `^7.0.2` (lockstep 위반 재현) | 1 failed ✅ |
      | `loadTypescriptFrom` → TS7 스텁 반환 (능력 위반 재현) | 1 failed ✅ |
      | `discoverWorkspaceDirs` → `[]` (발견 vacuity) | 4 failed ✅ |
      | `loadTypescriptFrom` → 항상 `null` (능력 검사 vacuity) | 1 failed ✅ |

      첫 시도의 `return [] && expand…` 는 **무효 뮤턴트**였다 — `[]` 가 truthy 라 `[] && x` 는
      `x` 를 그대로 돌려준다. GREEN 을 "가드가 안 문다" 로 오판할 뻔했고, 치환이 의도한 자리에
      실제로 걸렸는지를 돌리기 **전에** 확인해야 한다는 기존 교훈의 재현이다.
- [x] TEST WORKFLOW — lint PASS(66s) · unit PASS(102s) · build PASS(196s) · e2e PASS(260/260, 346s).
      build 로그에서 `nest build` → `✓ Compiled successfully` 확인 — 젠킨스 실패 1의 정확한 지점이다.
- [x] `/ai-review` (`review/code/2026/08/01/10_55_44`) — **Critical 0 · Warning 0 · INFO 20, risk LOW**.
      reviewer 9명 전원 success(`has_report: true`)이고 디스크 산출물 9개 + SUMMARY.md 와 정확히
      일치, `unfinished` 비어 있음 — 반환값만 믿지 않고 대조했다. router 가 5명(performance ·
      database · concurrency · api_contract · user_guide_sync)을 skip 했는데, 매니페스트 버전
      복원 + 테스트 전용 가드라는 변경 성격에 부합한다. Critical/Warning 0 이라
      `resolution-applier` 호출 조건 미해당, RESOLUTION.md 불요.
- [x] `/consistency-check --impl-done spec/7-channel-web-chat` (`review/consistency/2026/08/01/11_18_16`)
      — **BLOCK: NO**, 5 checker 전원 위험도 NONE, `unfinished` 0.

      push 게이트가 spec-linked 파일 4건(`channel-web-chat` · `web-chat-sdk` ·
      `graph-warning-rules` · `node-summary` 의 `package.json`)을 잡아 요구한 단계다. 네 파일은
      각각 `spec/7-channel-web-chat` · `spec/4-nodes` · `spec/conventions` 세 영역의 `code:` glob 에
      걸리는데, `--impl-done` 은 **단일 scope 만** 받는다.

      **세 번 돌리지 않고 한 번으로 좁힌 근거**: (a) 게이트 구현(`review_guard.py` Gate 2)은
      `_newest_resolved_impl_done_mtime` 의 존재·신선도만 보고 scope 를 대조하지 않는다 —
      실측으로 확인했다. (b) 네 파일의 변경 실체가 **완전히 동일**하다(`"typescript"` devDep 한 줄).
      한 영역에서 "spec 표면과 무관" 이 확인되면 나머지도 같은 논리다. (c) spec-linked 4건 중
      2건이 이 영역 소속으로 가장 많다.

      checker 들도 독립적으로 같은 결론을 냈다 — "target 영역과 실제 diff 간 실질적 연관 없음,
      `code:` glob 매칭에 의한 라우팅 우연" (INFO 1). 우회가 아니라 범위 축소이며 근거를 남긴다.
- [x] push + PR — https://github.com/worker-ants/clemvion/pull/1058

## INFO 20건 처분

**조치함**

- **INFO 1 (security)** — "TS 다운그레이드가 상위에서 패치된 CVE 를 재도입하는가" 는 리뷰가
  실측하지 않은 항목이라 직접 돌렸다: `pnpm audit` → `{info:0, low:0, moderate:0, high:0,
  critical:0}`, typescript 관련 advisory 0건. 재도입 없음.
- **INFO 17 (documentation)** — `PROJECT.md §버전·도구 정책` 에 "빌드 툴체인 major 자동 bump
  차단" 축을 등재했다. 지적대로 `dependabot.yml` 주석에만 있으면 거버넌스 SoT 에서 안 보인다.

**후속 분리** (코드 변경이라 이번 P0 스코프 밖 — `typescript-toolchain-followups.md`)

- **INFO 3 (architecture)** — 신규 가드가 `ROOT`/`listAtPath` 두 심볼 때문에 형제 모듈
  `internal-package-registration-guard.ts` 전체 export 표면에 의존(ISP 위반). 중립 모듈
  `_shared.ts` 로 분리. **타당한 지적**이다 — 다만 형제 가드도 함께 고쳐야 해 양쪽 재검증이 붙는다.
- **INFO 14 (testing)** — `discoverWorkspaceDirs` 의 fail-closed throw 가 실제 I/O 와 결합돼
  synthetic 커버 불가. `validateWorkspacePatterns(patterns)` 순수 함수로 분리하면 직접 겨냥 가능.
- **INFO 5 (architecture)** — 사고의 구조적 원인(typescript 선언이 10개 매니페스트에 중복)은
  가드로 탐지만 하고 제거하진 않았다. pnpm 10.23 의 `catalog:` 프로토콜로 단일 선언화 가능.
- **INFO 12 · 16** — `unknown | null` 타입 단순화, `missingCompilerApi` JSDoc 의 "이 경로" 지시어
  모호. 둘 다 값싸지만 `codebase/**` 를 건드리면 리뷰가 stale 돼 push 가 막힌다. 다음 코드 터치
  때 위 항목들과 **모아서** 처리한다(같은 클래스 fix 를 낱개로 흘리면 리뷰 라운드만 늘어난다).

**조치 불요 — 근거**

- **INFO 2** — dependabot `ignore` 와 security-update 토글의 상호작용 gap. 주석에 이미 인지·완화
  조건이 적혀 있고, major 로만 나오는 보안 패치는 실제로 드물다.
- **INFO 4 · 10 · 11 · 13** — monorepo 전역 가드의 frontend 귀속, `describe()` 본문 I/O,
  매니페스트 판독 3줄 중복, 인시던트 서사 3곳 중복. 전부 **기존 형제 가드가 이미 쓰는 패턴**이라
  이번 PR 이 만든 문제가 아니다. INFO 4 는 "세 번째 유사 가드" 시점의 승격 검토로 남긴다.
- **INFO 6 · 15 · 19** — `dependencies.typescript` 동시 선언, prerelease/복합 range, `^5.7.3` vs
  `^5` 표기 차이. 셋 다 현재 도달 불가하거나(10개 워크스페이스 전부 devDeps 단일 caret) 사고
  원인과 무관하다. `^5`/`^5.7.3` 혼재는 `#1047` **이전 값의 정확한 복원**이라 이 PR 이 만든
  드리프트가 아니다.
- **INFO 7 · 8** — lockfile 의 `eslint-plugin-import` peer 키 표기 변화는 `pnpm install` 전체
  재계산의 알려진 부작용이고, 가드 신설(+393줄)은 plan Overview 에서 착수 전 선언한 스코프다.
  둘 다 "오판 방지 기록" 목적의 INFO 로 리뷰어 자신이 액션 불요로 판정했다.
- **INFO 9 · 20** — `loadTypescriptFrom` 의 광범위 catch, `path.join` 의 `..` 이탈 이론값.
  전자는 하류 vacuity 가드가 완전 무력화를 막고, 후자는 `pnpm-workspace.yaml` 이 이미 저장소
  신뢰 경계 안이다(조작 가능하면 빌드 스크립트를 직접 고치는 게 빠르다).
- **INFO 18** — `#1049` 의 eslint peer 미충족. 본 PR 이 안 건드렸고 plan 에 이미 이연 기재.

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

**관측 결과** — 셋 다 lint · unit · build · e2e 전 단계를 통과했다. 다만 하나가 남는다:

```
codebase/backend
└─┬ eslint-plugin-unicorn 72.0.0
  └── ✕ unmet peer eslint@>=10.4: found 9.39.4
```

`#1049` 가 남긴 **미충족 peer** 다. lint 는 PASS 하므로 지금 깨진 상태는 아니지만, 플러그인이
선언한 지원 범위 밖에서 돌고 있다. 본 PR 은 빌드 복구가 스코프라 건드리지 않는다 — eslint 9 →
10 상향은 flat config·룰 시그니처 변경을 동반하므로 별도 PR 이 맞다. 후속으로 분리한다.
