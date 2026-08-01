---
title: typescript 툴체인 가드 후속 4건 — 공유 프리미티브 분리 · fail-closed 커버 · catalog 마이그레이션 검토
worktree: (미착수)
started: 2026-08-01
owner: developer
status: in-progress
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

## 4. 값싼 정리 2건 (INFO 12 · 16)

- `loadTypescriptFrom` 의 반환 타입 `unknown | null` 은 TS 상 `unknown` 과 동치라 의미 없는
  유니온이다. 같은 파일의 다른 함수가 "구체 타입 | null" 로 실제 좁히는 것과 나란히 보면 혼동 여지.
- `missingCompilerApi` JSDoc 의 "이 경로" 지시어가 바로 앞 non-object 분기를 가리키는 것처럼
  읽히지만, TS7 스텁은 **객체**라 실제로는 filter 경로를 탄다. 코드·테스트는 정확하고 서술만 모호하다.

## 체크리스트

- [ ] §1 공유 프리미티브 `_shared.ts` 분리 (양쪽 가드 재검증)
- [ ] §2 `validateWorkspacePatterns` 순수 함수 분리 + synthetic 테스트
- [ ] §3 `catalog:` 마이그레이션 — 착수 전 위 3개 검토 항목 판단
- [ ] §4 타입·JSDoc 정리
- [ ] TEST WORKFLOW + `/ai-review`

## Rationale

**왜 묶었나**: 넷 다 `typescript-toolchain-guard.ts` 한 파일을 건드린다. 낱개로 처리하면 같은
파일에 대해 리뷰 라운드를 네 번 도는 셈이라, 이 저장소가 반복해 겪은 "fix→리뷰 stale 루프" 를
그대로 재현한다.

**왜 P3 인가**: 원 리뷰가 넷 다 INFO 로 판정했고 risk LOW 였다. 빌드는 이미 복구됐고 가드는
mutation 4종으로 실제로 문다는 것이 증명된 상태다 — 이 항목들은 그 가드의 **구조 개선**이지
동작 결함이 아니다.
