---
title: typescript 툴체인 가드 후속 4건 — 공유 프리미티브 분리 · fail-closed 커버 · catalog 마이그레이션 검토
worktree: spec-small-followups
started: 2026-08-01
owner: developer
status: complete
priority: P3
spec_impact: none
---

## Overview

`typescript-7-rollback` (`#1047` 롤백) 의 `/ai-review` 가 낸 INFO 20건 중, **코드 변경이 필요해
그 P0 PR 스코프 밖으로 뺀 것**들이다. Critical 0 · Warning 0 이라 어느 것도 차단 사유가 아니었고,
`codebase/**` 를 건드리면 리뷰가 stale 돼 push 가 막히므로 낱개로 흘리지 않고 여기 모았다.

원 리뷰: `review/code/2026/08/01/10_55_44/SUMMARY.md`

## 1. 공유 프리미티브를 중립 모듈로 분리 (INFO 3)

`typescript-toolchain-guard.ts` 가 `ROOT` · `listAtPath` 두 심볼만 필요한데, 무관한 책임(내부
패키지 등록 목록 검사)을 가진 `internal-package-registration-guard.ts` 의 **전체 export 표면**에
의존한다. 형제 모듈이 리팩터되면 의미상 무관한 이 가드가 덩달아 깨진다.

조치: `repo-guards/__tests__/_shared.ts` 신설 → `repoRoot`/`ROOT`, `listAtPath` 및 그 헬퍼
(`indentOf`/`isSkippable`/`blockRange`/`findKeyLine`) 이관, 양쪽이 대칭으로 import.

주의: 형제 가드도 함께 고쳐야 하므로 **양쪽 재검증**이 붙는다. `internal-package-registration.test.ts`
의 실측 단언이 그대로 통과하는지 확인할 것.

## 2. fail-closed throw 를 synthetic 으로 겨냥 (INFO 14)

`discoverWorkspaceDirs` 의 "packages: 목록을 읽지 못했다" throw 가 실제 I/O
(`fs.readFileSync(WORKSPACE_YAML)`)와 결합돼 있어 저장소가 정상인 한 자연 발동하지 않는다 —
합성 입력으로 직접 겨냥할 수 없다.

조치: `validateWorkspacePatterns(patterns: string[] | null): string[]` 순수 함수로 분리하고
`null` · `[]` 입력에 대한 테스트 추가. 형제 가드에도 같은 형태의 갭이 있으므로 함께 볼 것.

## 3. 공유 devDependency `catalog:` 마이그레이션 검토 (INFO 5)

`#1047` 사고의 **구조적 원인**은 typescript 버전 선언이 10개 `package.json` 에 중복된 것이다.
현재는 가드로 드리프트를 **탐지**만 하고 중복 자체는 남아 있다. 저장소가 이미 pnpm 10.23 을
쓰므로 `pnpm-workspace.yaml` 의 `catalog:` 프로토콜로 단일 선언화가 가능하다.

검토 사항 — 착수 전 판단할 것:

- 대상 범위: typescript 만인가, 공유 devDeps(`@types/node` · eslint 계열) 전반인가.
  `@types/node` 는 **의도적으로 갈려 있다**(내부 앱 `^24` vs 외부 SDK `^20`, `PROJECT.md
  §Node 지원 floor`) — catalog 로 묶으면 그 의도가 깨진다. 묶을 것과 안 묶을 것을 먼저 가른다.
- `catalog:` 전환 후 `majorSpread` lockstep 검사가 무의미해지는지(선언이 하나면 드리프트 불가).
  가드의 그 축을 걷어낼지, catalog 자체를 검사하는 쪽으로 옮길지.
- dependabot 이 catalog 항목을 인식·갱신하는지 실측 필요.

### 2026-08-10 실측 — 셋 중 둘은 답이 났고, 하나가 착수를 막는다

**(1) 대상 범위 — 갈렸다.** 매니페스트 11개 전수(3곳 이상 선언된 패키지 10개):

| 패키지 | 선언 수 | range | 판정 |
|---|---|---|---|
| `eslint` | 10 | `^9` · `^9.18.0` | catalog 대상 (드리프트 중) |
| `typescript` | 10 | `^5` · `^5.7.3` | catalog 대상 (드리프트 중, #1047 의 그 축) |
| `ts-jest` | 8 | `^29.2.5` · `^29.4.10` | catalog 대상 (드리프트 중) |
| `@eslint/js` · `@types/jest` · `globals` · `jest` · `typescript-eslint` | 8 | 각 1종 | catalog 대상 (순수 중복 제거) |
| `dayjs` | 3 | 1종 | catalog 대상 |
| `@types/node` | 4 | `^20.0.0` · `^24` | **제외** — 의도된 분기(위 §Node 지원 floor) |

즉 "typescript 만" 이 아니라 **9개 묶고 `@types/node` 만 뺀다** 가 답이다. 명명 catalog
(`catalog:node20` 등)로 `@types/node` 까지 묶는 변형은 의도를 문서가 아니라 이름에 싣게 되어
더 낫지만, 그건 이 항목의 범위를 넘는다.

**(2) lockstep 축 — 무의미해지는 게 아니라 가드가 깨진다.** 실측:
`parseMajor("catalog:")` → `null`, `parseMajor("catalog:default")` → `null`.
`null` 은 `majorSpread` 의 `unparsable` 로 들어가고 그건 **위반 판정**이다. 즉 마이그레이션
직후 `typescript-toolchain.test.ts` 의 lockstep 축이 **전 워크스페이스에서 빨간불**이 된다.
가드가 `catalog:` 를 만나면 `pnpm-workspace.yaml` 의 catalog 항목으로 해소하도록 먼저
가르쳐야 한다 — 마이그레이션과 **같은 PR 안에서**. 이 선행 조건은 원 항목에 없었다.

**(3) dependabot — 저장소 안에서 답할 수 없다.** `.github/dependabot.yml` 의 npm 등록은
`/`(워크스페이스 루트)와 `/.claude/tools/mermaid-lint` 둘이다. catalog 항목은 `package.json`
이 아니라 `pnpm-workspace.yaml` 에 있으므로, npm updater 가 그 파일을 갱신 대상으로 보는지는
**외부 사실**이다. 확인 없이 옮기면 typescript 가 dependabot 시야에서 사라질 수 있고, 그건
#1047 을 만든 것과 같은 클래스의 사각지대다(그때는 버전 드리프트, 이번엔 업데이트 부재).

⇒ ~~**미착수 유지.** (1)·(2)는 해소됐고 (3) 하나가 남았다. 다음 사람은 dependabot 의 pnpm
catalog 지원 여부만 확인하면 되고, 지원한다면 (2)의 가드 선행 수정을 같은 PR 에 넣는다.~~

### 결론 — **won't-do (지금은).** (3) 조사 완료 (2026-08-11)

**"지원 여부" 가 틀린 질문이었다.** 지원은 한다 — [GA 2025-02-04](https://github.blog/changelog/2025-02-04-dependabot-now-supports-pnpm-workspace-catalogs-ga/).
원래 우려했던 "catalog 를 아예 안 갱신한다"([#11953](https://github.com/dependabot/dependabot-core/issues/11953))도
**닫혔다**. 그런데 그 위에 더 나쁜 것이 **열려 있다**:

[**dependabot-core#14339**](https://github.com/dependabot/dependabot-core/issues/14339) — 열림
(2026-03-03 기준 확인, 메인테이너 응답·담당자·마일스톤 **없음**). 실패 형태:

> dependabot 이 `pnpm-workspace.yaml` 은 **올바로** 갱신하는데, 함께 커밋하는
> `pnpm-lock.yaml` 이 **catalog 패키지 하나를 통째로 누락**한다. 리포터의 재현에서 누락된
> 것은 **`typescript`** 이고 `eslint`·`typescript-eslint` 는 보존됐다. frozen lockfile CI 가 깨진다.

**우리 저장소에 그대로 꽂힌다** (실측):

| 사실 | 확인 |
|---|---|
| 공용 설치 액션이 `--frozen-lockfile` 을 쓴다 | `.github/actions/pnpm-workspace/action.yml:90` |
| 그 액션을 타는 잡 | **9개 잡 / 5개 워크플로** (그 파일 주석의 실측) |
| 누락 대상으로 리포트된 패키지 | **`typescript`** — 이 plan 이 존재하는 이유(`#1047`) 그 축 |

즉 마이그레이션하면 **`#1047` 과 같은 클래스의 사고를 자초한다.** 그때는 버전 드리프트였고
이번엔 lockfile 유실인데, 드러나는 자리는 똑같이 "CI 가 어느 날 갑자기 전부 빨간불" 이다.
차이는 하나 — **이번엔 착수 전에 알았다.**

**(2)의 가드 선행 수정도 지금 하지 않는다.** `parseMajor("catalog:")` → `null` 문제는 실재하지만,
그 수정만 먼저 넣으면 **아무도 안 쓰는 경로**가 생긴다. 이 저장소가 바로 직전 PR(`#1146`)에서
`walkTree` 의 미사용 `path.isAbsolute` 분기로 리뷰어 셋에게 지적받은 형태다 — 원 plan 이
"마이그레이션과 **같은 PR 안에서**" 라고 적은 것이 맞다.

**재개 조건 (트리거)**: `dependabot-core#14339` 가 닫히면. 그때 (2)의 가드 수정 + 9개
devDep 마이그레이션(`@types/node` 제외)을 한 PR 로 한다. 그 전까지는 현행 유지 —
드리프트는 `typescript-toolchain.test.ts` 의 lockstep 축이 이미 **탐지**하고 있고,
중복 선언 10곳은 탐지되는 한 사고가 아니라 비용이다.

## 4. 값싼 정리 2건 (INFO 12 · 16)

- `loadTypescriptFrom` 의 반환 타입 `unknown | null` 은 TS 상 `unknown` 과 동치라 의미 없는
  유니온이다. 같은 파일의 다른 함수가 "구체 타입 | null" 로 실제 좁히는 것과 나란히 보면 혼동 여지.
- `missingCompilerApi` JSDoc 의 "이 경로" 지시어가 바로 앞 non-object 분기를 가리키는 것처럼
  읽히지만, TS7 스텁은 **객체**라 실제로는 filter 경로를 탄다. 코드·테스트는 정확하고 서술만 모호하다.

## 체크리스트

- [x] **§1 공유 프리미티브 `_shared.ts` 분리 + DI 대칭화** — `repoRoot`/`ROOT`/`PackageManifest`
      + YAML 서브셋 추출기(`blockRange`/`findKeyLine`/`listAtPath`)를 중립 모듈로 이관.
      등록 가드는 **재export** 로 기존 소비처 계약을 유지한다(소유권만 옮김). 툴체인 가드는
      이제 형제의 전체 export 표면이 아니라 `_shared` 만 본다.
      **여기 두는 기준을 파일에 못박았다** — "두 가드가 실제로 공유하는 것만". 한쪽 전용
      (`PACKAGES_DIR`·`TEST_STAGES`·`WORKSPACE_YAML`)은 그대로 뒀다. 아니면 이 모듈이
      두 번째 잡동사니가 된다.
      **제목에 "DI 대칭화" 를 더한 이유**: 원 항목은 "이관" 만 적었는데 실제 작업은
      `repoRoot` 의 주입점 개방까지 갔다(scope 리뷰 INFO — 문구가 작업보다 좁았다).
      확장 근거는 §2 와 같다 — 그 함수의 fail-closed 가 `__dirname` 하드코딩 탓에
      테스트 불가능했고, 같은 PR 이 `discoverWorkspaceDirs` 에만 주입을 넣어 비대칭이
      생겼다. 다음에 diff 와 plan 을 대조할 사람이 "이관" 이라는 좁은 단어에 걸리지
      않도록 제목을 실제 작업에 맞춘다.
      양쪽 가드 + `shared.test.ts` 82건 통과.
- [x] **§2 `validateWorkspacePatterns` 순수 함수 분리 + synthetic 테스트** — `null`(키 부재)·
      `[]`(항목 부재) 두 실패를 **갈라서** 고정했다. 한쪽만 막으면 나머지로 vacuity 가 그대로
      들어온다. 통과 경로가 값을 바꾸지 않는 것도 단언.
      **호출부까지 갔다**: 헬퍼만 뽑아 두니 `discoverWorkspaceDirs` 가 검증을 건너뛰는 뮤턴트
      (`?? []`)가 살아남았다 — 이 저장소가 반복해 겪는 "헬퍼 테스트 ≠ 호출부 테스트". 같은
      파일의 `expandWorkspaceGlobs(readDir)` 규약대로 `readLines` 를 주입 가능하게 만들어
      합성 입력으로 그 축을 겨냥한다.
- [x] §3 `catalog:` 마이그레이션 — **won't-do (지금은). 2026-08-11 조사로 (3) 해소.**
      질문은 "dependabot 이 pnpm catalog 를 지원하는가" 였는데, **지원 여부를 물은 것이
      틀린 질문이었다** — 지원은 하고(GA 2025-02-04) 그 상태로 **깨진다**. 아래 §결론 참조.
- [x] **§4 타입·JSDoc 정리** — `loadTypescriptFrom` 반환 타입 `unknown | null` → `unknown`
      (전자는 TS 상 동치라 "여기도 null 을 좁혀 준다" 로 오독된다). `missingCompilerApi`
      JSDoc 의 "이 경로" 를 실제 경로(TS7 스텁은 **객체**라 filter 를 탄다)로 명시.
- [x] **TEST WORKFLOW** — frontend **284 files / 5920 passed** (1 skipped),
      repo-guard 3파일 **82건**, `tsc --noEmit` 0 errors, lint 0 errors.
      뮤테이션 누적 **14종 전부 RED** (fail-closed 3축 · 통과 경로 · 호출부 · 공유 파서
      인라인 주석 · `repoRoot` marker/상한/루트-종료/기본인자 · `readLines` 기본값).
      > lint 경고는 저장소 전체 16건인데 **내 디렉터리는 1건(기존 `_drop`)** 이다.
      > 13→16 증가분은 main 이 `#1123` 을 흡수하며 들어온 `plan-scan.test.ts` 쪽으로
      > 실측 확인했다 — 이 브랜치 신규 0.
- [x] **`/ai-review`** — 5라운드. Critical 0 유지, WARNING 은 3→3→1→1→**0** 으로 수렴.
      지적의 성격이 동작 → 구조 → 문서 순으로 내려왔다(이 저장소의 수렴 기준).
      최종 라운드 `review/code/2026/08/10/11_44_32` — forced 7명 전원 Critical 0 · WARNING 0.
      각 라운드에서 고친 것은 그 세션의 `SUMMARY.md`/`RESOLUTION.md` 에 있다.

## Rationale

**왜 묶었나**: 넷 다 `typescript-toolchain-guard.ts` 한 파일을 건드린다. 낱개로 처리하면 같은
파일에 대해 리뷰 라운드를 네 번 도는 셈이라, 이 저장소가 반복해 겪은 "fix→리뷰 stale 루프" 를
그대로 재현한다.

**왜 P3 인가**: 원 리뷰가 넷 다 INFO 로 판정했고 risk LOW 였다. 빌드는 이미 복구됐고 가드는
mutation 4종으로 실제로 문다는 것이 증명된 상태다 — 이 항목들은 그 가드의 **구조 개선**이지
동작 결함이 아니다.
