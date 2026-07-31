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

### 1.2 신규 오버라이드 (10건)

```yaml
"@hono/node-server": ^2.0.5
linkify-it: ^5.0.2                    # latest 6.1.0 이나 패치 요건 >=5.0.2 — major 유지
svgo: ^4.0.2
sharp: ^0.35.0
"@opentelemetry/propagator-jaeger": ^2.9.0
"js-yaml@>=4.0.0 <4.3.0": ^4.3.0      # backend  > @eslint/eslintrc 경로
"js-yaml@>=3.0.0 <3.15.0": ^3.15.0    # frontend > gray-matter 경로
"brace-expansion@<2.0.0": ^1.1.16
"brace-expansion@>=2.0.0 <3.0.0": ^5.0.9    # §1.3 — 리뷰 CRITICAL 조치로 추가
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

### 1.3 `brace-expansion` — 2.x 경로 해소 + 1.x 경로만 수용

`CVE-2026-14257` (GHSA-mh99-v99m-4gvg, brace-expansion 무한 확장 DoS/OOM, high CVSS 7.5).
advisory 의 취약 범위 `<=5.0.7` 이 **major 를 가리지 않아** 1.x·2.x 계열까지 매칭된다.

> **초안의 근거가 틀렸다 — 리뷰 CRITICAL #1 로 정정.** 초안은 "두 경로 모두 dev 전용" 이라 적고
> `ignoreCves` 로 수용했다. 실측 결과 **2.x 경로는 프로덕션이었다.** 원인은 내 검증 결함이다 —
> `pnpm audit` 출력의 `paths` 를 `[:3]` 로 잘라 세 번째 경로를 보지 못했고, `--prod` 를 돌리지
> 않았다.

**2.x 경로 — 프로덕션이었고, 해소했다.**

```
codebase/backend > @nestjs-modules/mailer > mjml > mjml-core > js-beautify
  > editorconfig > minimatch@9.0.9 > brace-expansion@2.1.4
```

`@nestjs-modules/mailer` 는 backend 의 **dependencies** 이고 `mjml` 은 그 optional peer 인데 pnpm 이
충족 가능해 실제로 설치된다. 프로덕션 이미지를 직접 열어 `mjml@5.3.0` · `brace-expansion@2.1.4` ·
`js-beautify@1.15.4` 존재를 확인했다.

조치: `"brace-expansion@>=2.0.0 <3.0.0": ^5.0.9`. 2.x 에 백포트가 없어 5.x 로 올려야 하는데, 소비처
`minimatch@9.0.9` 가 5.x 와 **정상 동작함을 실측**했다 — `brace-expansion@5.x` 는 `type: module` 이나
`exports` 에 `require` 조건(`dist/commonjs/index.js`)이 있어 CJS 소비처가 그대로 로드된다. 로드 +
`a{b,c}c` ↔ `abc`/`acc` 확장 매칭까지 확인. → **`pnpm audit --prod` 0건**.

**1.x 경로 — 진짜 dev 전용, 수용.**

```
codebase/backend > @eslint/eslintrc > minimatch@3.1.5 > brace-expansion@1.1.18
```

1.x 는 `1.1.18` 이 마지막 릴리스라 백포트가 없고, 5.x 강제는 `minimatch@3.1.5` 의 API 기대를 깨
lint 툴체인이 죽는다. 프로덕션 이미지에 eslint 스택이 없음은 build 단계 위생 스모크가 강제하고
(위 이미지 조사에서도 `brace-expansion@1.1.18` 부재 확인), 입력도 개발자가 작성한 glob 패턴이라
신뢰 경계 안이다 → 수용. `@eslint/eslintrc` 가 minimatch 9.x 이상으로 올라가면 자동 해소된다.

### 1.4 baseline 3-place 동기화

`scripts/check-pnpm-security-config.py` 는 overrides **와** ignoreCves 를 모두 스냅샷 대조한다.
`EXPECTED_OVERRIDES` 13건 추가/수정 + `EXPECTED_IGNORED_CVES` 1건 추가를 동시에 반영했다 —
한쪽만 고치면 config-guard 가 실패한다(PROJECT.md 규약).

### 1.5 경계를 넘는 override 2건 — 실측으로 안전 확인 (리뷰 WARNING #2)

소비처가 선언한 호환 범위를 넘는 강제가 둘 있다. 리뷰 지적을 받아 각각 실측했다.

| override | 소비처 선언 | 강제값 | 검증 |
| --- | --- | --- | --- |
| `sharp: ^0.35.0` | `next@16.2.11` optionalDeps `^0.34.5` (0.x caret 경계 초과) | `0.35.3` | **프로덕션 frontend 이미지 안에서 직접 로드·동작 확인** — `require` 성공, `version 0.35.3`, webp 인코딩 성공. playwright e2e 51/51 통과(브라우저 경로 커버) |
| `"@hono/node-server": ^2.0.5` | `@modelcontextprotocol/sdk@1.29.0` `^1.19.9` (1→2 major) | `2.0.12` | backend 소스에 `@hono/node-server` 직접 참조 **0건**. mcp-client 는 SDK 의 client 측만 쓰고 서버 측(v2 API) 경로에 도달하지 않는다 |

두 건 모두 취약 범위(`sharp <0.35.0`, `@hono/node-server <2.0.5`)를 벗어나려면 그 경계를 넘는 것
외에 방법이 없다 — 각 계열에 백포트가 없다.

> 초기 검증에서 `sharp` 버전을 `0.34.5` 로 잘못 읽었다. `require.resolve` 가 워크트리를 벗어나
> **main 체크아웃의 stale `node_modules`** 를 잡은 것이었다. lockfile·설치 트리·프로덕션 이미지는
> 모두 `0.35.3` 단일이다.

## 실측 검증

- `pnpm audit --audit-level=moderate` → **17건 → 0건, exit=0** (게이트 통과)
- `pnpm audit --prod --audit-level=moderate` → **0건** (프로덕션 트리 깨끗)
- `python3 scripts/check-pnpm-security-config.py` → `OK: overrides 29건(값 포함) ·
  onlyBuiltDependencies 5건 · ignoreCves 2건 baseline 일치`
- `pnpm install --frozen-lockfile` → 통과

## 체크리스트

- [x] 잔여 17건 전수 분류 (경로·취약범위·패치버전·백포트 유무)
- [x] 기존 오버라이드 4건 하한 상향
- [x] 신규 오버라이드 9건 (major 계열 공존 2건은 버전-레인지 스코프)
- [x] 해소 불가 1건 `ignoreCves` 수용 + 근거 주석
- [x] config-guard baseline 3-place 동기화 + 통과 확인
- [x] TEST WORKFLOW (1차, 리뷰 전) — lint · unit · build · e2e 전부 PASS
- [x] `/ai-review` (dependency·security·scope) — **Critical 1 · Warning 3**, 전부 조치.
      Critical: "dev 전용" 근거 오류 → 2.x 프로덕션 경로 실제 해소 + 근거 재작성.
      W1 CVE 주석 스왑 정정 · W2 경계초과 override 2건 실측 검증(§1.5) · W3 postcss drift 설명(§2.2).
      상세: `review/code/2026/07/31/15_03_10/RESOLUTION.md`
- [x] TEST WORKFLOW 재수행 — lint PASS(60s) · unit PASS(backend 412 suites) · build PASS(450s) ·
      e2e PASS(backend 260/260 + **playwright 51/51**)
- [x] push + PR — `#1038` 머지.

## 2.2 `codebase/frontend` postcss specifier 부수 정정 (리뷰 WARNING #3)

이 PR 은 `codebase/frontend/package.json` 을 **건드리지 않았다**. 다만 merge-base 시점부터 그 파일의
`postcss: ^8.5.18` 선언과 `pnpm-lock.yaml` importer specifier(`^8.5.14`)가 이미 어긋나 있었고,
override 작업에 필요했던 `pnpm install` 이 이 잔존 drift 를 `^8.5.18` 로 부수 정정했다. 해소 버전
자체는 `8.5.25` 로 동일해 기능 영향은 없다.

**§2 의 `next>postcss` 오버라이드와는 별개 필드다** — 이름이 겹쳐 혼동하기 쉬우나, 전자는 frontend
importer 의 직접 의존 specifier 이고 후자는 workspace-global override 다. 후자는 이 PR 이 의도적으로
`^8.5.14` 로 두었다(`#1036` 이 `^8.5.18` 로 올린다).

## 2. 머지 순서 주의

`#1036`(의존성 위생)이 같은 두 파일(`pnpm-workspace.yaml`, `check-pnpm-security-config.py`)의
`next>postcss` 줄을 `^8.5.18` 로 바꾼다. 본 브랜치는 `origin/main` 기준이라 그 줄이 아직 `^8.5.14` 다.
→ **`#1036` 을 먼저 머지하고 본 PR 을 rebase** 하는 편이 충돌이 작다.

## 3. 후속

- [x] **오버라이드 바닥이 조용히 낮아지는 재발 패턴** — `plan/in-progress/deps-guard-hardening.md`
      §1 로 분기(실측 5건 표 포함).
      드러났다. 오버라이드 값이 그 패키지의 **현재 알려진 최소 안전 버전 이상인지** 주기적으로
      확인하는 장치가 없다. audit 이 사후에 잡아주긴 하나, 그때는 이미 취약 버전이 해소된 뒤다.
      `check-pnpm-security-config.py` 에 "오버라이드 하한 < 알려진 패치 하한" 검출을 얹는 방안 검토.
- [x] **audit 검증 절차에 `--prod` 표준화** — `deps-guard-hardening.md` §2 로 분기.
      dev/prod 구분이 안 되고, 출력 `paths` 를 자르면 경로를 놓친다. 잔여 취약점을 수용(`ignoreCves`)
      하려면 **`pnpm audit --prod` 와 프로덕션 이미지 실물 확인**을 근거로 요구하도록 규약화.
- [x] **dependabot 재발 방지** — `deps-guard-hardening.md` §3 으로 분기.
      되돌리는 패턴. 순차 머지 시 rebase 강제 또는 `frozen-lockfile` 검증을 required check 로.

## Rationale

`spec_impact: none` — 의존성 버전 정합·audit 정책 수정으로 제품 명세 변경이 없다.

**왜 major 점프를 피했나**: `protobufjs`(7→8)·`fast-uri`(3→4)·`linkify-it`(5→6) 은 최신이 major 상위에
있지만, 패치 요건은 모두 현재 major 안에서 충족된다. 전이 의존을 major 로 강제하면 소비처의 API 기대가
깨질 수 있고, 그 위험을 audit 통과라는 이득과 바꿀 이유가 없다.

**왜 `brace-expansion` 1.x 경로만 수용했나**: 이 패키지는 유일하게 **현재 major 안에 패치가
존재하지 않는** 건이라 계열별로 갈렸다. 2.x 는 5.x 강제가 소비처(`minimatch@9.0.9`)와 호환됨을
실측해 **해소**했고, 1.x 는 소비처(`minimatch@3.1.5`)가 5.x API 를 기대하지 않아 수용했다.
나머지 16건은 전부 major 유지로 해소 가능했다.

**초안이 이 건을 통째로 수용한 것은 오판이었다** — 근거로 삼은 "두 경로 모두 dev 전용" 이
사실과 달랐고(2.x 는 프로덕션 mailer 경로), 그 오판의 원인은 `pnpm audit` 출력을 자른 내 검증
결함이었다. 리뷰 CRITICAL 이 이를 잡았다.
