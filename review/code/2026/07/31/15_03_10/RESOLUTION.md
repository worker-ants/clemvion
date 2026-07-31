# RESOLUTION — review/code/2026/07/31/15_03_10

대상: `pnpm audit` 잔여 17건 정리. 결과 **Critical 1 · Warning 3 · INFO 7**.
Critical 1건 + Warning 3건 전부 조치했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| CRITICAL #1 | 보안(수용 근거 오류) | 본 커밋 | "두 경로 모두 dev 전용" 이 **사실이 아니었다**. 재현 확인 후 해당 경로를 실제로 **해소**하고 근거를 전면 재작성 |
| WARNING #1 | 문서(주석 스왑) | 본 커밋 | `EXPECTED_IGNORED_CVES` 의 CVE 주석이 뒤바뀐 것 재현 확인 후 각 CVE 에 맞게 재작성 |
| WARNING #2 | 의존성(경계 초과 override) | 본 커밋 | `sharp`·`@hono/node-server` 를 실측 검증하고 근거를 plan §1.5 에 명시 |
| WARNING #3 | 스코프(문서화) | 본 커밋 | frontend postcss specifier 부수 drift 설명을 plan §2.2 에 추가 |
| INFO #1~#7 | 검증 완료 / 후속 | 조치 불요 | 라이선스·스코프 경계·패키지 중복·config-guard 재실행 등 전부 "조치 불요" 또는 후속 등재 |

---

### CRITICAL #1 — 재현됐다. 내 검증이 틀렸다

리뷰어 주장을 액면 그대로 받지 않고 **양방향으로 재현**했다.

**1단계 — `--prod` 실행**: `pnpm audit --prod` 는 0건이었다. 그러나 이는 `ignoreCves` 가 이미 해당
CVE 를 억제했기 때문이었다. 억제를 임시로 걷고 다시 돌리자 **1건**이 나왔다:

```
codebase__backend>@nestjs-modules/mailer>mjml>mjml-core>js-beautify
  >editorconfig>minimatch>brace-expansion@2.1.4
```

**2단계 — 프로덕션 의존 여부**: `@nestjs-modules/mailer` 는 backend `package.json` 의
`dependencies`(devDependencies 아님). `mjml` 은 그 **optional peerDependency** 인데, pnpm 이 충족
가능해 lockfile 의 `optionalDependencies` 로 해소·설치된다.

**3단계 — 프로덕션 이미지 실물 확인** (가장 결정적):

```
$ docker run --rm --entrypoint sh clemvion-build-check/backend:latest -c 'ls node_modules/.pnpm/...'
node_modules/.pnpm/mjml@5.3.0_svgo@4.0.2_terser@5.48.0_typescript@5.9.3
node_modules/.pnpm/brace-expansion@2.1.4      ← 취약 버전이 프로덕션 이미지에 실재
node_modules/.pnpm/js-beautify@1.15.4
```

**결론: 리뷰어가 맞다.** 내 "프로덕션 이미지에는 jest/eslint 스택이 존재하지 않는다" 는 주석은 그
자체로는 참이지만, **세 번째 경로를 보지 못한 채 쓴 문장**이라 결론("두 경로 모두 dev 전용")이
틀렸다.

**원인 — 내 검증 결함 2가지**:
1. `pnpm audit` 출력을 파싱하며 `f.get('paths', [])[:3]` 로 **잘랐다**. 2.1.4 finding 의 paths 에
   mailer 경로가 더 있었는데 출력에서 사라졌다.
2. `pnpm audit --prod` 를 **돌리지 않았다**. flag 없는 audit 만으로는 dev/prod 구분이 안 된다.

**조치 — 수용이 아니라 해소**: `"brace-expansion@>=2.0.0 <3.0.0": ^5.0.9` 를 추가해 2.x 경로를
5.0.9 로 올렸다. 2.x 에 백포트가 없어 major 를 넘어야 했으므로, 소비처 호환을 실측했다:

- `brace-expansion@5.x` 는 `type: module` 이나 `exports` 에 `require` 조건
  (`dist/commonjs/index.js`)이 있어 CJS 소비처가 그대로 로드된다.
- `minimatch@9.0.9` 를 실제 로드해 `a{b,c}c` ↔ `abc`/`acc` 확장 매칭까지 확인 — 정상.

결과: **`pnpm audit --prod` 0건**. 전체 audit 에 남는 유일 경로는
`@eslint/eslintrc > minimatch@3.1.5 > brace-expansion@1.1.18` 로, 이번엔 **진짜 dev 전용**이다
(프로덕션 이미지 조사에서도 1.1.18 부재 확인). 1.x 는 1.1.18 이 마지막 릴리스라 백포트가 없고 5.x
강제는 `minimatch@3.1.5` 를 깨므로 이 한 건만 근거와 함께 수용한다.

### WARNING #1 — 재현 확인 후 정정

`EXPECTED_IGNORED_CVES` 에 엔트리를 추가할 때 앵커 뒤에 삽입해, 기존 js-yaml 주석이 새 CVE 에
붙어버렸다. 재현 확인 후 각 CVE 에 맞는 주석으로 재작성했다. (Python `set` 비교라 가드 판정에는
영향 없었으나, 근거가 가장 중요한 항목의 근거가 틀려 있던 상태였다.)

### WARNING #2 — 경계 초과 override 2건 실측

| override | 소비처 선언 | 검증 결과 |
| --- | --- | --- |
| `sharp: ^0.35.0` | `next@16.2.11` `^0.34.5` (0.x caret 경계 초과) | **프로덕션 frontend 이미지 안에서** `require` 성공 · `version 0.35.3` · webp 인코딩 성공. playwright e2e **51/51** 통과 |
| `"@hono/node-server": ^2.0.5` | `@modelcontextprotocol/sdk` `^1.19.9` (1→2 major) | backend 소스 직접 참조 **0건** — SDK 의 client 측만 사용, 서버 측 v2 API 경로 미도달 |

두 건 모두 취약 범위를 벗어나려면 그 경계를 넘는 것 외에 방법이 없다(각 계열 백포트 없음).

> **부수 정정**: 첫 `sharp` 검증에서 버전을 `0.34.5` 로 잘못 읽었다. `require.resolve` 가 워크트리를
> 벗어나 **main 체크아웃의 stale `node_modules`** 를 잡은 것이었다. lockfile·설치 트리·프로덕션
> 이미지는 모두 `0.35.3` 단일이다.

### WARNING #3 — frontend postcss drift 설명 추가

이 PR 은 `codebase/frontend/package.json` 을 건드리지 않았으나, merge-base 시점부터 있던
manifest↔lockfile specifier drift 를 `pnpm install` 이 부수 정정했다. `next>postcss` 오버라이드와는
**별개 필드**임을 plan §2.2 에 명시했다.

## TEST 결과

리뷰 조치(brace-expansion 2.x→5.x)가 실질 변경이라 전 단계를 **재수행**했다.

- lint  : 통과 — 60s (`_test_logs/lint-20260731-153359.log`)
- unit  : 통과 — backend **412 suites** + frontend/web-chat/channel-web-chat/internal packages.
  80s (`_test_logs/unit-20260731-153459.log`)
- build : 통과 — 450s, docker 이미지 + backend 프로덕션 이미지 위생 스모크 포함
  (`_test_logs/build-20260731-153630.log`)
- e2e   : 통과 — backend Jest e2e **260/260** + **playwright 51/51**, 368s, 재시도 없음
  (`_test_logs/e2e-20260731-154409.log`)

게이트: `pnpm audit` **exit=0** (전체) · **exit=0** (`--prod`) ·
`check-pnpm-security-config.py` `OK: overrides 29건 · ignoreCves 2건 baseline 일치`.

## 보류·후속 항목

- **오버라이드 바닥이 조용히 낮아지는 재발 패턴** — 이번 4건, `#1036` 1건이 같은 방식이었다.
  `check-pnpm-security-config.py` 에 "오버라이드 하한 < 알려진 패치 하한" 검출을 얹는 방안. plan §3.
- **audit 검증 절차에 `--prod` 표준화** — 이번 CRITICAL 의 직접 원인. 잔여 취약점을 수용하려면
  `--prod` 와 프로덕션 이미지 실물 확인을 근거로 요구하도록 규약화. plan §3.
- **dependabot 재발 방지** (`#1034` 이관) — plan §3.
- **INFO #6** — `CVE-2026-53550`(js-yaml) ignore 엔트리가 이번 스코프 오버라이드로 사실상 무효화됐다.
  제거 판단은 이 PR 범위 밖으로 명시했다(별개 CVE).

민감 변경: 의존성 상향 다수(보안 목적). spec 변경·SPEC-DRIFT 0건.
