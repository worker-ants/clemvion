---
title: jest 가 ESM 의존성을 네이티브로 로드하게 한다 — 허용목록 대신 vm-modules
status: in-progress
owner: developer
worktree: deps-nestjs12-ci-4a7b2e
spec_impact: none
started: 2026-09-24
---

# 막힌 dependabot PR 둘을 조사하다 더 나은 레버를 찾았다

사용자 요청: 「CI 실패로 병합이 불가능한 PR 들을 해결」. 열린 PR 은 둘이고 **같은 벽**에
막혀 있었다 — 둘 다 NestJS v12 부분 메이저 범프이고, v12 가 **ESM-only** 다.

| PR | 패키지 | 막는 것 |
| --- | --- | --- |
| [#1339](https://github.com/worker-ants/clemvion/pull/1339) | `@nestjs/typeorm` 12.0.1 | `dist/common/typeorm-compat.js` 가 **`import.meta.url`** 사용 → CJS jest 가 로드 불가 |
| [#1382](https://github.com/worker-ants/clemvion/pull/1382) | `@nestjs/platform-express` 12.0.3 | 런타임에 `@nestjs/common/internal` 을 import 하는데 **common@11 의 `exports` 에 없다** |

**이 PR 은 앞의 하나만 푼다.** 뒤의 것은 `@nestjs/common` 12 가 있어야 하므로 동반
업그레이드(별 PR)다.

## A. 착수 전 실측 — 네 번 재본 끝에 레버를 찾았다

| # | 시도 | 결과 |
| --- | --- | --- |
| 1 | 저장소 기존 처방(`transformIgnorePatterns` 허용목록)에 `@nestjs/typeorm` 추가 | 에러가 `dist/index.js` → `dist/common/typeorm-compat.js` 로 **이동**. 진입점은 변환되는데 더 깊은 파일이 안 된다 |
| 2 | 허용목록을 `@nestjs` **스코프 전체**로 확대 | 같은 파일에서 그대로 막힘 |
| 3 | 막는 파일을 직접 열람 | **`import.meta.url`** — CJS 로 downlevel 이 원리적으로 불가. `tsconfig` 가 `module: nodenext` 라 `type: module` 패키지의 `.js` 는 ESM 으로 취급된다. **transform 레버로는 못 고친다** |
| 4 | jest 가 스스로 말한 힌트(«Node 24.9+ 면 `require(esm)` 지원»)를 추적 | 게이트는 Node 버전이 아니라 **`--experimental-vm-modules`** 였다 |

**게이트의 정체** (`jest-runtime` 소스 실측):

```js
supportsSyncEvaluate = typeof vm.SourceTextModule?.prototype.hasAsyncGraph === 'function'
```

`vm.SourceTextModule` 은 **`--experimental-vm-modules` 로만 노출된다.** 로컬 실측
(Node v24.17.0): 플래그 없으면 `undefined`, 있으면 `function`. 즉 CI 가 Node 24.20 이었는데도
막힌 이유는 버전이 아니라 플래그 부재였다 — **에러 메시지의 힌트가 우리를 잘못 인도했다.**

## B. 처방 — 두 줄

1. jest 를 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 부른다
   (`NODE_OPTIONS=` 접두어 대신 이 형태를 쓰는 이유: 셸 문법에 의존하지 않는다. 저장소의
   다른 script 에 env 접두어 선례가 없다).
2. `transformIgnorePatterns` 를 **기본값(`['/node_modules/']`)으로 되돌린다.**

**2번이 없으면 1번이 오히려 깨진다 — 실측했다.** 허용목록의 `uuid@13` 은 `type: module` 인데
ts-jest 가 CJS 로 변환하고, vm-modules 모드의 jest 는 그 파일을 **ESM 으로 평가**한다 →
`ReferenceError: exports is not defined`. 두 변경은 **한 쌍**이다.

## C. 실측 — 무엇이 좋아지고 무엇은 안 좋아지나

**현재 의존성(NestJS 11) 그대로**, 의존성 변경 0:

| | 전 | 후 |
| --- | --- | --- |
| backend unit 결과 | 472 스위트 / 9946 | **472 / 9946** (동일) |
| backend 단독 jest | **32.5s**(1회) | **23.5 · 26.5s**(2회) |
| `run-test.sh unit`(전 패키지) | 76–103s | **87s** — 유의한 차이 없음 |

그리고 `@nestjs/typeorm@12.0.1` 을 얹으면 **472 / 9946 통과**(29.5s) — #1339 가 풀린다.

> **초판의 «3배 빠름» 은 거짓 비교였다.** backend **단독** jest(23.5s)를 `run-test.sh unit`
> **전 패키지**(76–103s)와 견줬다. 공정하게 재니 backend 단독 기준 32.5s → 23.5~26.5s 로
> **20~28%** 이고, 래퍼 기준으로는 backend 가 전체의 일부라 차이가 묻힌다. 래퍼 요약 숫자에
> 또 속은 것이고, 이 저장소에서 같은 함정을 이미 여러 번 밟았다.

**속도는 곁다리다 — 이 변경의 값은 둘이다:**

1. **ESM-only 의존성을 받을 수 있게 된다.** `@nestjs/typeorm@12` 의 `import.meta.url` 처럼
   **CJS 로 downlevel 이 원리적으로 불가능한** 것도 로드된다. 허용목록으로는 못 하는 일이다.
2. **손으로 유지하던 목록이 사라진다.** 지금 주석이 *"uuid >=12, p-limit >=4, yocto-queue;
   otplib >=13 … @scure, @noble"* 로 여섯을 열거하고, 패키지가 ESM 으로 갈 때마다 사람이
   추가해야 한다. e2e 설정에도 같은 목록이 **따로** 있었다(`uuid|p-limit|yocto-queue`) —
   두 곳이 이미 어긋나 있었다는 뜻이다.

**비용**: `ExperimentalWarning: VM Modules …` 가 **jest 워커 프로세스마다 1줄** 찍힌다 —
이 머신(11코어) 실측 **9줄**이고 워커 수에 따라 달라진다. `--disable-warning` 으로 지울 수 있지만 **지우지 않는다** — 실험 플래그 위에 서 있다는
사실은 보이는 편이 낫고, 그 플래그가 Node 에서 안정화되면 배너가 사라지는 것이 신호다.

## D. 확인한 것

- [x] **e2e 도 같은 전환이 필요하다** — `test/jest-e2e.json` 에 **별도 허용목록**이 있었고
      (`uuid|p-limit|yocto-queue`) 단위 쪽 목록과 **이미 어긋나 있었다**. 둘 다 기본값으로.
      e2e **380 PASS**.
- [x] **경고 출력**: `ExperimentalWarning: VM Modules …` 가 **jest 워커 프로세스마다 1줄**
      (11코어 머신 실측 **9줄** — 워커 수에 따라 달라진다).
      지울 수 있지만 지우지 않는다(§C).
- [x] **속도 주장 정정** — §C. 초판의 «3배» 는 거짓 비교였다.

### 판별 실험 — 두 변경이 정말 한 쌍인가

「플래그가 떠받친다」는 검증 가능한 주장이다. 설정은 그대로 두고 **플래그만** 빼고 돌렸다.

| | 예측 | 실측 |
| --- | --- | --- |
| 플래그 없이 + 기본 `transformIgnorePatterns` | RED | **RED** — `Must use import to load ES Module: …/uuid@13.0.2/…` |

플래그가 장식이 아니라 **로드를 떠받치고 있고**, 허용목록을 걷은 것과 짝이라는 뜻이다.
(반대 방향은 §C 에 이미 있다 — 플래그만 켜고 허용목록을 남기면 `exports is not defined`.)

## E. 하지 않는 것

- **`@nestjs/*` 12 동반 업그레이드** — 별 PR. #1382 은 `common@12` 없이는 런타임에서
  `ERR_MODULE_NOT_FOUND` 로 죽는다(실측: e2e backend 컨테이너 exit 1).
- **#1339 자체의 머지** — 이 PR 이 main 에 들어간 뒤 그 PR 을 rebase 하면 초록이 될 것이다.
  그 확인은 이 PR 의 스코프가 아니다(다만 로컬에서 미리 재 뒀다 — §C).
- **backend 를 ESM 패키지로 전환** — 필요 없다는 것이 이 조사의 결론이다. 런타임은 그대로
  CJS 이고, 바뀌는 것은 **테스트 러너의 모듈 로딩 방식**뿐이다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system` → **BLOCK: NO · Critical 0 · Warning 3** (`review/consistency/2026/09/24/13_55_20`). W2(후속 plan 스텁 미등재)는 `nestjs-v12-coordinated-upgrade.md` 로 등재했다 — reflection 보안 회귀 검증 조건 포함
- [x] 구현 — script 5곳 + `jest.config.ts` + `test/jest-e2e.json`
- [x] §D 세 항목 실측 + 판별 실험(플래그만 빼면 RED)
- [x] TEST WORKFLOW — lint PASS(`lint-20260924-141217.log`) · unit **472스위트/9946**(`unit-20260924-140803.log`) · build PASS(`build-20260924-141312.log`) · **e2e 380 PASS**(`e2e-20260924-141636.log`)
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/5-system` → BLOCK: NO
- [ ] plan `complete/` 로 + 후속(동반 업그레이드) 등재
