---
title: pnpm audit 잔여 17건 정리 — 오버라이드 하한 상향·신규 등재 + 해소 불가 1건 수용
worktree: audit-residual
started: 2026-07-31
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

## Overview

`deps-security-checks.yml` 의 `pnpm audit --audit-level=moderate` 게이트가 **17건**으로 실패
상태였다. 전수 분류해 16건을 해소하고 1건을 근거와 함께 수용해 **exit=0** 으로 되돌린다.

### 착수 전 전제가 틀렸다 — 정정

`#1034`/`#1036` 에서 이 잔여를 "대부분 backend 의 **전이 의존**이라 직접 상향이 불가" 하다고 적었다.
**틀렸다.** pnpm overrides 는 전이 의존도 강제할 수 있고, 실제로 이 저장소는 이미 그 방식으로 19건을
관리하고 있었다. 전수 조사 결과 17건 중 **16건이 오버라이드로 해소 가능**했다.

더 나쁜 사실: 17건 중 **4건은 이미 오버라이드가 있는데 하한이 낮아서** 취약 버전이 다시 해소되고
있었다 — `#1036` 의 `next>postcss` 와 **정확히 같은 클래스**다.

| 패키지 | 기존 오버라이드 | 필요 패치 | 판정 |
| --- | --- | --- | --- |
| `liquidjs` | `^10.27.0` | `>=10.27.1` | 바닥이 낮음 |
| `protobufjs` | `^7.6.3` | `>=7.6.5` | 바닥이 낮음 |
| `fast-uri` | `^3.1.2` | `>=3.1.4` | 바닥이 낮음 |
| `hono` | `^4.12.21` | `>=4.12.27` | 바닥이 낮음 |

즉 오버라이드를 넣어 CVE 를 닫아도, 이후 같은 패키지에 새 CVE 가 공시되면 **바닥이 조용히 낮아진
채로 남는다**. 이 재발 패턴 자체가 §4 후속 항목이다.

## 1. 조치

### 1.1 기존 오버라이드 하한 상향 (4건)

`liquidjs ^10.27.1` · `protobufjs ^7.6.5` · `fast-uri ^3.1.4` · `hono ^4.12.27`.
major 는 유지했다 — `protobufjs` latest 는 8.7.1, `fast-uri` 는 4.1.1 이지만 패치 요건이 각각
`>=7.6.5`/`>=3.1.4` 라 major 점프의 호환성 리스크를 질 이유가 없다.

### 1.2 신규 오버라이드 (9건)

```yaml
"@hono/node-server": ^2.0.5
linkify-it: ^5.0.2                    # latest 6.1.0 이나 패치 요건 >=5.0.2 — major 유지
svgo: ^4.0.2
sharp: ^0.35.0
"@opentelemetry/propagator-jaeger": ^2.9.0
"js-yaml@>=4.0.0 <4.3.0": ^4.3.0      # backend  > @eslint/eslintrc 경로
"js-yaml@>=3.0.0 <3.15.0": ^3.15.0    # frontend > gray-matter 경로
"brace-expansion@<2.0.0": ^1.1.16
"brace-expansion@>=3.0.0 <5.0.8": ^5.0.8
```

`js-yaml`·`brace-expansion` 은 두 major 계열이 공존해 **버전-레인지로 스코프**했다
(기존 `undici@>=7.0.0 <7.28.0` 선례와 같은 문법). 스코프 없이 단일 값을 주면 3.x 소비처가
4.x 를 받아 깨진다.

> **`js-yaml` frontend 경로 메모**: `ignoreCves` 의 CVE-2026-53550 주석은 "gray-matter@4.x 가
> `js-yaml@^3.13` 을 고정해 소비처 직접 상향 불가" 라고 적고 있으나, `^3.13` 은 `3.15.0` 을 **허용**
> 한다(같은 major). 작성 시점엔 3.15.0 이 없었을 뿐이다. 이번 스코프 오버라이드로 그 경로도 함께
> 해소된다 — 다만 CVE-2026-53550 자체의 ignore 엔트리는 **건드리지 않았다**(별개 CVE 이고 해당
> 항목 제거 판단은 이 PR 범위 밖).

### 1.3 해소 불가 1건 — 수용 (`ignoreCves`)

`CVE-2026-14257` (GHSA-mh99-v99m-4gvg, brace-expansion 무한 확장 DoS/OOM, high CVSS 7.5).

advisory 의 취약 범위가 `<=5.0.7` 로 **major 를 가리지 않아** 1.x·2.x 계열까지 매칭된다. 그런데
두 경로가 받는 `1.1.18` / `2.1.4` 는 **각 계열의 최신이며 백포트가 없다**(실측: 1.x 는 1.1.18,
2.x 는 2.1.4 가 마지막 릴리스). 해소하려면 5.x 로 major 를 강제해야 하는데, 소비처
`minimatch@3.1.5` 는 그 API 를 기대하지 않아 lint 툴체인이 깨진다.

두 경로 모두 **dev 전용 전이 의존**이다:

```
codebase/backend > @eslint/eslintrc > minimatch@3.1.5 > brace-expansion@1.1.18
codebase/backend > jest > @jest/core > @jest/reporters > glob > minimatch@9.0.9 > 2.1.4
```

프로덕션 이미지에 jest/eslint 스택이 없음은 build 단계의 이미지 위생 스모크가 이미 강제하고, 입력도
개발자가 작성한 glob 패턴이라 신뢰 경계 안이다. `minimatch` 가 10.x(brace-expansion 5.x)로 올라가면
자동 해소되므로 그때 엔트리를 제거한다.

### 1.4 baseline 3-place 동기화

`scripts/check-pnpm-security-config.py` 는 overrides **와** ignoreCves 를 모두 스냅샷 대조한다.
`EXPECTED_OVERRIDES` 13건 추가/수정 + `EXPECTED_IGNORED_CVES` 1건 추가를 동시에 반영했다 —
한쪽만 고치면 config-guard 가 실패한다(PROJECT.md 규약).

## 실측 검증

- `pnpm audit --audit-level=moderate` → **17건 → 0건, exit=0** (게이트 통과)
- `python3 scripts/check-pnpm-security-config.py` → `OK: overrides 28건(값 포함) ·
  onlyBuiltDependencies 5건 · ignoreCves 2건 baseline 일치`
- `pnpm install --frozen-lockfile` → 통과

## 체크리스트

- [x] 잔여 17건 전수 분류 (경로·취약범위·패치버전·백포트 유무)
- [x] 기존 오버라이드 4건 하한 상향
- [x] 신규 오버라이드 9건 (major 계열 공존 2건은 버전-레인지 스코프)
- [x] 해소 불가 1건 `ignoreCves` 수용 + 근거 주석
- [x] config-guard baseline 3-place 동기화 + 통과 확인
- [x] TEST WORKFLOW — lint PASS(51s) · unit PASS(backend 412 suites) · build PASS(213s, docker
      이미지 + 프로덕션 위생 스모크 포함) · e2e PASS(260/260, 297s)
- [ ] `/ai-review` + Critical/Warning 조치
- [ ] push + PR

## 2. 머지 순서 주의

`#1036`(의존성 위생)이 같은 두 파일(`pnpm-workspace.yaml`, `check-pnpm-security-config.py`)의
`next>postcss` 줄을 `^8.5.18` 로 바꾼다. 본 브랜치는 `origin/main` 기준이라 그 줄이 아직 `^8.5.14` 다.
→ **`#1036` 을 먼저 머지하고 본 PR 을 rebase** 하는 편이 충돌이 작다.

## 3. 후속

- [ ] **오버라이드 바닥이 조용히 낮아지는 재발 패턴** — 이번에 4건, `#1036` 에서 1건이 같은 방식으로
      드러났다. 오버라이드 값이 그 패키지의 **현재 알려진 최소 안전 버전 이상인지** 주기적으로
      확인하는 장치가 없다. audit 이 사후에 잡아주긴 하나, 그때는 이미 취약 버전이 해소된 뒤다.
      `check-pnpm-security-config.py` 에 "오버라이드 하한 < 알려진 패치 하한" 검출을 얹는 방안 검토.
- [ ] **dependabot 재발 방지** (`#1034` 에서 이관) — 구 base 에서 만들어진 PR 이 최신 보안 bump 를
      되돌리는 패턴. 순차 머지 시 rebase 강제 또는 `frozen-lockfile` 검증을 required check 로.

## Rationale

`spec_impact: none` — 의존성 버전 정합·audit 정책 수정으로 제품 명세 변경이 없다.

**왜 major 점프를 피했나**: `protobufjs`(7→8)·`fast-uri`(3→4)·`linkify-it`(5→6) 은 최신이 major 상위에
있지만, 패치 요건은 모두 현재 major 안에서 충족된다. 전이 의존을 major 로 강제하면 소비처의 API 기대가
깨질 수 있고, 그 위험을 audit 통과라는 이득과 바꿀 이유가 없다.

**왜 `brace-expansion` 만 수용했나**: 유일하게 **현재 major 안에 패치가 존재하지 않는** 건이다.
나머지 16건은 전부 major 유지로 해소 가능했다. 수용 판단의 근거(dev 전용 경로 + 신뢰 입력)를
주석으로 남겨 다음 사람이 재조사하지 않게 했다.
