---
title: main 의 postcss package.json↔lockfile 드리프트 수정 — frozen-lockfile 빌드 차단 해소
worktree: postcss-lockfile-drift
started: 2026-07-31
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

## Overview

`origin/main` 이 깨져 있다. `pnpm install --frozen-lockfile` 이
`ERR_PNPM_OUTDATED_LOCKFILE` 로 실패해 **docker 이미지 빌드가 막힌다** — 즉 main 을 base 로 하는
모든 브랜치의 build 단계가 같은 지점에서 죽는다.

### 경위 (실측)

dependabot PR 두 건이 순차 머지되며 어긋났다:

| 커밋 | PR | 내용 | CI |
| --- | --- | --- | --- |
| `5898ae13f` | #1029 (**npm_and_yarn 보안 그룹**) | `codebase/frontend/package.json` 의 postcss `^8.5.14` → `^8.5.18` + lockfile 갱신 | success |
| `395dedc8b` | #1030 (next bump) | #1029 **이전 base** 에서 만들어져 postcss 를 `^8.5.14` 로 **되돌림**. lockfile 은 `^8.5.18` 인 채 잔존 | **failure** |

```text
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with <ROOT>/codebase/frontend/package.json
  - postcss (lockfile: ^8.5.18, manifest: ^8.5.14)
```

즉 **보안 bump 가 실수로 되돌려졌고** lockfile 과의 정합도 함께 깨졌다.

### 왜 별도 PR 인가

이 결함은 `#1033`(워크플로우 복제 결함 수정) 작업 중 push 직전에 발견됐다. 그 PR 에 포함해 한 번
고쳤으나(사용자 확인), duplicate 수정과 무관한 dependency 변경이라 리뷰 scope 를 흐린다. main 복구가
급하므로 `origin/main` 기준 독립 브랜치로 분리해 먼저 머지 가능하게 한다.

`#1033` 에서는 해당 커밋을 제거하지 않는다 — 본 PR 이 먼저 머지되면 동일 내용이라 중복 없이 흡수되고,
반대 순서여도 결과는 같다. 그쪽 PR 본문에 분리 사실을 명시했다.

## 1. 조치

- [x] **`66e574209` (cherry-pick `8b2d378e3`)** — `codebase/frontend/package.json` 의 postcss 를
      `^8.5.18` 로 복원. lockfile 은 이미 그 값이라 **무변경**, 한 줄로 정합 회복.
      되돌린 쪽(#1030)이 회귀이므로 복원 방향이 맞다.
- [x] **`df860ce58` (cherry-pick `2713834e1`)** — 위 복원이 **부분적**이었다.
      `@tailwindcss/postcss@4.3.1` 이 하위 postcss 를 caret 없이 고정해 동일 CVE
      (**GHSA-r28c-9q8g-f849**, HIGH — sourceMappingURL 경로순회로 임의 `.map` 파일 노출) 취약
      인스턴스가 남아 있었다. 4.3.2 부터 `^8.5.16` 으로 바뀌어 해소 가능
      (`npm view @tailwindcss/postcss@latest dependencies.postcss`).
      `pnpm update @tailwindcss/postcss --filter frontend` 로 lockfile 갱신 + 하한 `^4.3.3` 명시.

### 실측 검증

- `pnpm install --frozen-lockfile` → 통과 (드리프트 해소)
- `pnpm audit --audit-level=moderate` → **postcss 항목 1건 → 0건**
  (`codebase__frontend>@tailwindcss/postcss>postcss` 경로 소멸). 총 21 → 20건.

### lockfile diff 의 blast radius (리뷰 WARNING #1)

`pnpm update` 는 **lockfile 을 전역 재계산**하므로, diff 가 `--filter frontend` 라는 명시 범위를
넘어선다. 오해를 막기 위해 실측 수치를 남긴다:

| 변경 종류 | 건수 | 성격 |
| --- | --- | --- |
| `specifier:` 변경 | **1건** (`@tailwindcss/postcss` `^4.2.2` → `^4.3.3`) | **의도한 변경. 이것뿐이다** |
| `libc:` 필드 정리 | 57건 | 네이티브 바이너리 패키지(`@img/sharp-*`·`@napi-rs/canvas-*`·`@next/swc-*` 등)의 메타 필드. pnpm 재계산 부산물 |
| `jest`/`ts-jest` peer-key 표기 확장 | backend + `packages/*` 6~7곳 | 해소 버전은 그대로이고 peer 경로 표기에 `ts-node` 정보가 붙는 형태 변화 |

즉 **버전 다운그레이드·신규 취약점·워크스페이스 그래프 변경은 없다**(dependency reviewer 교차 확인).
기능 영향이 없음은 TEST WORKFLOW 전 단계 통과(backend 412 suites · e2e 260/260)로 확인했다.

## 2. 범위 밖 — 명시

**audit 게이트는 본 PR 로 통과하지 않는다.** `pnpm audit --audit-level=moderate` 는 총 **21건**을
보고하고 postcss 는 그중 **1건**이다. 나머지 20건(`brace-expansion`·`js-yaml`·`sharp`·`liquidjs`·
`hono`·`typeorm`·`svgo` 등 backend·channel-web-chat 계열)은 본 PR 이전부터의 선재 상태이며 저장소
차원 대응이 필요하다. 본 PR 의 목적은 **(1) main 의 빌드 차단 해소 + (2) 되돌려진 보안 bump 복원의
완결**이지 게이트 통과가 아니다.

## 체크리스트

- [x] cherry-pick 2건 + `frozen-lockfile` 통과 확인
- [x] TEST WORKFLOW — lint PASS(58s) · unit PASS(backend 412 suites) · build PASS(279s, docker
      이미지 빌드 포함 = 원래 깨졌던 지점 통과) · e2e PASS(260/260, 316s)
- [x] `/ai-review` (dependency·scope) — Critical 0 · Warning 1(문서화 갭, 조치 완료).
- [x] push + PR — `#1034` 머지.

## 3. 후속 (본 PR 범위 밖)

- [x] **`pnpm audit` 잔여 20건** — `#1038` 로 완료 (게이트 exit 0).
- [x] **의존성 위생 2건** — `#1036` 로 완료.
      엔진(`4.3.3`) lockstep 스큐. `postcss.config.mjs` 가 플러그인만 등록하고 bare `tailwindcss`
      import 가 없어 빌드 영향 없음. (b) `pnpm-workspace.yaml:40` 의 `next>postcss` 오버라이드
      하한(`^8.5.14`)이 직접 의존 하한보다 낮다 — 상향 시
      `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` **2-place 동시 갱신** 필수.
- [x] **dependabot 재발 방지** — `plan/in-progress/deps-guard-hardening.md` §3 으로 분기.
      bump 를 되돌리는" 패턴이다. 같은 group 의 PR 이 순차 머지될 때 rebase 를 강제하거나,
      머지 전 `frozen-lockfile` 검증을 required check 로 두는 방안 검토.

## Rationale

`spec_impact: none` — 의존성 버전 정합 수정으로 제품 명세 변경이 없다.

**왜 lockfile 을 되돌리지 않고 package.json 을 올렸나**: 두 방향 모두 정합을 회복시키지만,
`^8.5.18` 은 #1029 가 **보안 그룹**으로 올린 값이다. lockfile 을 `^8.5.14` 로 내리면 정합은 맞아도
보안 픽스를 잃는다. 되돌린 쪽(#1030)이 회귀이므로 복원이 옳다.
