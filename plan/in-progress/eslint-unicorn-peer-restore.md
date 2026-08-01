---
title: eslint-plugin-unicorn 의도된 pin 복원 — dependabot 이 깬 peer 계약 + 재발 차단
worktree: eslint-peer-fix-f41984
started: 2026-08-01
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

## Overview

`#1058` (typescript 롤백) 의 TEST WORKFLOW 에서 관측된 잔재를 닫는다:

```
codebase/backend
└─┬ eslint-plugin-unicorn 72.0.0
  └── ✕ unmet peer eslint@>=10.4: found 9.39.4
```

dependabot `#1049` (`a4bc9fde3`) 가 `^56.0.1` → `^72.0.0` (**16 major**) 로 올린 결과다.
`#1047` (typescript 5→7) 과 **정확히 같은 클래스** — Actions 가 repo 레벨에서 꺼져 있어
아무 검증 없이 머지된 major bump다.

## 이건 단순 bump 가 아니라 명시된 의도를 깬 것이다

`codebase/backend/eslint.config.mjs:16-18` 이 pin 근거를 **주석으로 적어두고 있었다**:

```js
// 03 m-4 — unicorn 플러그인은 preset 전체가 아니라 catch-error-name 단일 룰만
// 사용하기 위해 등록한다 (부수 규칙 유입 차단). 버전: ^56 — v57+ 는 eslint
// peer 를 >=9.20 으로 올려 본 패키지의 선언 floor(^9.18) 를 넘으므로 v56 고정.
```

dependabot 은 이 주석을 볼 수 없다. 그래서 값만 72로 바뀌고 **주석은 "^56" 이라고 말하는 채로
남았다** — 코드와 문서가 어긋난 상태로 머지됐다.

### 주석의 근거를 실측으로 재확인했다 (registry 조회)

전체 registry 실측 표(unicorn 버전별 eslint peer floor)의 SoT 는
`codebase/backend/eslint.config.mjs` 의 `unicorn/catch-error-name` 등록 블록 주석이다 — 여기서는
중복 기재하지 않는다. 결론만: 57.0.0 부터 eslint peer floor 가 `>=9.20.0` 으로 올라 backend 선언
floor `^9.18` 을 넘는다(주석이 지목한 정확히 그 지점), 66.0.0 이상은 `>=10.4` 로 eslint 9 자체를
배제한다.

주석의 주장("v57+ 는 >=9.20")이 **정확했다**. v57 릴리스일(2025-02-17) 이후 지금까지(약 1.5년)
유효한 근거다.

## 왜 65.0.1 이 아니라 56.0.1 인가

eslint 9 를 허용하는 최신 unicorn 은 **65.0.1**(`>=9.38.0`)이다. 설치본이 9.39.4 라
pnpm 의 실제 판정은 통과한다. 그런데도 56 으로 되돌린다:

1. **선언 floor 기준으로는 여전히 불일치**다. `eslint: ^9.18.0` 은 9.18.x 도 허용하므로,
   lockfile 을 다른 조건에서 재생성하면 깨질 수 있는 상태를 남긴다. 원 주석이 채택한 것도
   이 보수적 기준이다.
2. 65 로 가려면 backend 의 eslint 선언을 `^9.38` 로 올려야 하는데, 다른 9개 워크스페이스는
   `^9.18`/`^9` 라 **워크스페이스 간 floor 가 갈린다**. 전부 올리면 이 PR 범위를 넘는다.
3. **얻는 게 없다.** backend 는 unicorn preset 을 쓰지 않고 `unicorn/catch-error-name`
   **단일 룰**만 쓴다(같은 주석이 명시). 9 major 를 더 최신으로 가도 이 룰 하나에 실질 변화는
   기대하기 어렵다.

즉 "최신이 좋다" 가 아니라 **원래 결정이 지금도 옳은가**를 따졌고, 옳았다.

## 조치

- `codebase/backend/package.json`: `^72.0.0` → `^56.0.1` (`#1049` 이전 값)
- `eslint.config.mjs` 주석: 실측 표를 반영해 근거를 최신화 (v57+ 뿐 아니라 v66+ 가 eslint 9
  자체를 배제한다는 사실 추가)
- `.github/dependabot.yml`: `eslint-plugin-unicorn` major ignore — 없으면 다음 주에 또 온다
- lint 검증 + **룰이 실제로 무는지 mutation** (버전만 되돌리고 룰이 조용히 죽으면 무의미)

## 체크리스트

- [x] 매니페스트 복원 + lockfile 재생성 — `^72.0.0` → `^56.0.1`(`#1049` 이전 값).
      lockfile `eslint-plugin-unicorn@56.0.1(eslint@9.39.4)`, **unmet peer 경고 소멸**
      (남은 `nunjucks → chokidar` 는 기존 건 — §후속 검토).
- [x] config 주석 근거 최신화 — registry 실측 표 반영 + "66+ 는 eslint 9 자체를 배제" 추가.
      pin 을 풀려면 dependabot ignore 도 함께 지워야 한다는 결속을 명시.
- [x] dependabot major ignore — `eslint-plugin-unicorn`. 푸는 전제가 eslint 10 상향임을 주석에 기록.
- [x] `unicorn/catch-error-name` mutation 검증 — 버전만 되돌리고 룰이 조용히 죽으면 무의미하므로
      실제로 무는지 확인했다:
      | 상태 | 결과 |
      | --- | --- |
      | baseline | `catch-error-name` 위반 0 |
      | `catch (err)` → `catch (error)` (instrumentation.ts) | **error 발화** ✅ |
      | 원복 | diff 0 |
- [x] TEST WORKFLOW — lint PASS(62s) · unit PASS(92s) · build PASS(177s) ·
      e2e PASS(324s: backend jest 46 suites/260 + playwright 51).
      실 인프라 기동 확인: postgres · redis · minio · backend-e2e 전부 `Healthy`.
      로그의 `failed` 매칭 1건은 파일명(`execution-failed-notification.e2e-spec.ts`)에 의한
      오탐으로 실물은 `PASS` 다 — 요약 숫자만 보지 않고 마커를 직접 열어 확인했다.
- [x] `/ai-review` + Critical/Warning 조치 — Critical 0 · Warning 3(전부 조치, `resolution-applier`):
      PROJECT.md 카운트 갱신 + 2-place 결속 문구(W1), backend jest 상시 회귀 가드
      `eslint-unicorn-peer.spec.ts` 신설(W2, `unicorn/catch-error-name` 실발화 + peer range 정합,
      mutation 3종으로 non-vacuous 확인), registry 실측 표 SoT 를 `eslint.config.mjs` 로 단일화(W3).
      부수로 INFO#5(plan "3년" 표현 정정)·INFO#12(caret pin 문구 보강)도 반영.
      TEST WORKFLOW 재수행 — lint PASS(51s) · unit PASS(73s, backend jest 413 suites/8389) ·
      build PASS(146s) · e2e PASS(307s: backend jest 260 + playwright 51, 실 인프라 `Healthy`).
      상세: `review/code/2026/08/01/12_27_15/RESOLUTION.md`.
- [ ] push + PR

## 미수행 단계와 근거

- **`/consistency-check --impl-prep` 생략** — 의존성 버전 복원 + CI 설정으로 `spec/` 어느 영역도
  대상이 아니다(`spec_impact: none`). checker 에 넘길 `<spec/영역>` 인자가 성립하지 않는다.
  `#1058` 과 동일한 판단이다.

## 후속 검토 (이 PR 범위 밖)

- **미충족 peer 가 CI 에서 실패로 취급되지 않는다.** `pnpm install` 이 경고만 내고 지나가서
  `#1049` 가 머지된 뒤 `#1058` 의 TEST WORKFLOW 로그를 사람이 읽고서야 발견됐다.
  `--strict-peer-dependencies` 가 정답에 가깝지만, 지금 켜면 기존 미충족
  (`nunjucks → chokidar@^3.3.0` vs 설치 4.0.3)에 즉시 걸린다. 그 건을 먼저 처분해야 한다.
- **eslint 9 는 `maintenance` dist-tag** 다(latest = 10.8.0). unicorn 66+ 를 쓰려면 eslint 10
  상향이 전제고, 그건 10개 워크스페이스 + 전 config 검증이 필요한 독립 작업이다.
  `typescript-eslint` peer 는 이미 `^8.57.0 || ^9.0.0 || ^10.0.0` 으로 10을 지원한다.
