---
title: 의존성 위생 2건 — tailwind lockstep 스큐 + next>postcss 오버라이드 하한 동기화
worktree: dep-hygiene
started: 2026-07-31
owner: developer
status: in-progress
priority: P3
spec_impact: none
---

## Overview

`#1034`(postcss 드리프트 수정) 리뷰가 "급하지 않음" 으로 남긴 위생 2건을 닫는다. 둘 다 **실질 위험은
없으나 표현이 어긋나 있어** 다음 사람이 같은 의심을 반복하게 만드는 종류다.

## 1. tailwind lockstep 스큐

`@tailwindcss/postcss` 는 `#1034` 에서 CVE 해소를 위해 `^4.3.3` 으로 올렸는데, 짝인 `tailwindcss`
직접 의존은 `^4.2.2`(해소 `4.3.1`) 로 남았다. Tailwind 팀은 두 패키지를 lockstep 으로 배포한다.

- **실질 영향 없음** (실측): `postcss.config.mjs` 가 `@tailwindcss/postcss` 플러그인만 등록하고,
  `codebase/frontend/src` 전체에 bare `tailwindcss` import/require 가 **0건**이다 — 실제 CSS 컴파일은
  `@tailwindcss/postcss` 엔진이 전담한다.
- **그래도 맞추는 이유**: IDE·툴링이 참조하는 버전과 실제 컴파일 엔진 버전이 갈리면 디버깅 시
  혼선을 준다. 한 줄이고 lockstep 이 상류 관례다.

조치: `codebase/frontend/package.json` 의 `tailwindcss` `^4.2.2` → `^4.3.3`.

## 2. `next>postcss` 오버라이드 하한 동기화

`pnpm-workspace.yaml:40` 의 `next>postcss` 오버라이드 하한이 `^8.5.14` 로, `#1034` 가 올린 직접 의존
하한(`^8.5.18`)보다 낮게 남아 있었다.

- **실질 위험 없음**: 워크스페이스 전체 postcss 가 이미 `8.5.25` 로 단일 해소되고, `^8.5.14` 도 상한
  없이 `<9.0.0` 을 허용하므로 실제 설치 버전은 같다.
- **그래도 맞추는 이유**: 오버라이드는 "이 하한 아래로 내려가지 말라" 는 **보안 바닥**을 선언하는
  자리다. 바닥이 `^8.5.14` 로 남아 있으면 GHSA-r28c-9q8g-f849(패치 `>=8.5.18`) 취약 버전이 다시
  해소돼도 오버라이드가 막지 못한다 — 지금 안전한 것은 우연이지 보장이 아니다.

조치 — **2-place 동시 갱신 필수** (`PROJECT.md` 규약, 한쪽만 고치면 config-guard 가 실패한다):

1. `pnpm-workspace.yaml:40` — `next>postcss: ^8.5.14` → `^8.5.18`
2. `scripts/check-pnpm-security-config.py:52` — `EXPECTED_OVERRIDES["next>postcss"]` 동일 갱신

## 실측 검증

- `python3 scripts/check-pnpm-security-config.py` → `OK: overrides 19건(값 포함) ... baseline 일치`
  (2-place 동기화 확인 — 한쪽만 고쳤다면 여기서 실패한다)
- `pnpm install --frozen-lockfile` → 통과
- lockfile `specifier:` 변경은 **의도한 2건뿐** — `next>postcss` 오버라이드, `tailwindcss`
  (`^4.2.2`/`4.3.1` → `^4.3.3`/`4.3.3`). 그 외 변경은 pnpm 재계산 부산물.

## 체크리스트

- [x] tailwindcss `^4.3.3` 상향
- [x] `next>postcss` 오버라이드 2-place 동시 갱신 + config-guard 통과 확인
- [x] TEST WORKFLOW — lint PASS(56s) · unit PASS(backend 412 suites) · build PASS(313s, docker
      이미지 포함) · e2e PASS(260/260, 345s)
- [x] `/ai-review` (dependency·scope) — **Critical 0 · Warning 0 · INFO 5**, 위험도 LOW.
      INFO 전부 "이미 올바르게 처리됨/조치 불요". Critical·Warning 0 이라 RESOLUTION 불요.
      (`review/code/2026/07/31/14_36_42/SUMMARY.md`)
- [x] push + PR — `#1036` 머지.

## 2-1. 범위 밖 — 명시

`pnpm audit` 게이트는 본 PR 로도 통과하지 않는다. 잔여 **17건**(`brace-expansion`·`js-yaml`·
`sharp`·`liquidjs`·`hono`·`fast-uri`·`svgo`·`typeorm`·`protobufjs`·`linkify-it`·
`@opentelemetry/propagator-jaeger`·`@hono/node-server`)은 대부분 backend 의 **전이 의존**이라 직접
상향이 불가하고 건별 판단(상류 상향 대기 / `ignoreCves` 등재)이 필요하다. 별도 PR 로 다룬다.

## Rationale

`spec_impact: none` — 의존성 버전 정합 수정으로 제품 명세 변경이 없다.

**왜 지금 하는가**: 둘 다 `#1034` 리뷰가 "급하지 않음" 으로 분류한 항목이다. 다만 (2) 는 보안 바닥
선언이라 방치하면 다음 CVE 때 조용히 무력화된다 — "지금 안전한 것은 우연" 이라는 성질 때문에
우선순위를 P3 로 두되 미루지 않았다.
