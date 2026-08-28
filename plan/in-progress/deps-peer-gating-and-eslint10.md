---
title: 의존성 peer 게이팅 + eslint 10 상향 — 무검증 major 머지의 남은 두 구멍
worktree: spec-small-followups
started: 2026-08-01
owner: developer
status: in-progress
priority: P2
spec_impact: none
---

> _(2026-08-10)_ `worktree:` 를 `(unstarted)` → `spec-small-followups` 로 갱신했다. §1 을
> 그 워크트리에서 착수했고, 이 필드는 "이 작업이 **어느 워크트리에서** 진행되는가" 다.
> `(unstarted)` 로 두면 plan 게이트가 이 브랜치를 **다른 plan**(같은 워크트리를 선언 중인
> `typescript-toolchain-followups`)에 연결한다 — 실제로 그렇게 막혔다. 게이트는 한
> 워크트리의 여러 plan 중 **하나만 처리돼도** 통과하도록 설계돼 있다.

## Overview

`#1058`(typescript 5→7 롤백) 과 `#1074`(eslint-plugin-unicorn ^72→^56 복원) 두 사고를 처리하며
드러난 **구조적 잔여 2건**이다. 둘 다 개별 PR 의 범위를 넘어 별도로 뺐다.

두 사고의 공통 원인은 하나다: **Actions 가 repo 레벨에서 꺼져 있어 dependabot PR 이 아무 검증
없이 머지된다.** 그건 저장소 설정 소관이라 파일로 못 고치므로 여기서 다루지 않는다(사용자 확인
대기). 아래 둘은 파일로 고칠 수 있는 부분이다.

## 1. 미충족 peer 가 CI 실패로 취급되지 않는다 (P2)

`#1049` 가 `eslint-plugin-unicorn` 을 `eslint>=10.4` 요구 버전으로 올렸는데 설치본은 9.39.4 였다.
`pnpm install` 은 **경고만 내고 지나갔고**, 그 상태로 머지됐다. 발견은 `#1058` 의 TEST WORKFLOW
로그를 사람이 읽다가였다 — 즉 **자동 신호가 없었다**.

### 조치 후보

`pnpm install --strict-peer-dependencies` 를 CI/로컬 게이트에 도입.

**선결 조건**: 지금 켜면 기존 미충족에 즉시 걸린다.

```
codebase/backend
└─┬ nunjucks 3.2.4
  └── ✕ unmet peer chokidar@^3.3.0: found 4.0.3
```

먼저 이 건을 처분해야 한다 — 판단 필요: (a) nunjucks 가 실제로 chokidar 4 에서 동작하는지
실측(watch 기능을 우리가 쓰는지부터 확인), (b) `pnpm-workspace.yaml` 의 `peerDependencyRules`
로 명시 억제 + 근거 주석, (c) nunjucks 대체.

> **실측 (2026-08-10) — (a) 의 답이 나왔고, 그 답이 처분을 (b) 로 좁힌다.**
>
> | 확인 | 결과 |
> |---|---|
> | `codebase/backend/src` 의 nunjucks 참조 | **0건** |
> | `codebase/backend/package.json` 의 nunjucks | **없음** (직접 의존 아님) |
> | `codebase/**` 전체 참조 | **0건** |
> | 유입 경로 | transitive — `bullmq`/`ejs`/`handlebars`/`liquidjs`/`mjml`/`pug` 와 함께 묶여 오는 email-template 스택 |
> | lockfile `nunjucks@3.2.4` peer 선언 | `chokidar: ^3.3.0` + **`peerDependenciesMeta.chokidar.optional: true`** |
>
> 즉 **우리는 nunjucks 를 부르지 않고**, nunjucks 자신도 chokidar 를 **optional** 로 둔다
> (템플릿 `watch` 옵션 전용). 그래서 (c) 대체는 과잉이고 — 우리 코드가 그 패키지를 쓰지
> 않으므로 바꿀 호출부가 없다 — (a) 의 "동작하는지 실측" 도 실행 경로가 없어 무의미하다.
> 남는 처분은 **(b) 명시 억제 + 근거 주석**이다.
>
> **주의 — 이 전제는 정확히 반만 맞았다.** 원 서술은 "지금 켜면 기존 미충족에 즉시 걸린다"
> 였는데, optional peer 라는 사실이 빠져 있었다. 억제 근거를 "쓰지 않는 optional peer" 로
> 적어야 하고, "동작 검증했다" 로 적으면 **하지 않은 검증을 주장**하는 것이 된다.
>
> **정정 (같은 날, 몇 분 뒤) — 위 결론 "(b) 로 좁혀졌다" 도 틀렸다.**
> 억제를 실제로 넣고 `--strict-peer-dependencies` 를 돌렸더니 초록이었는데, **규칙을 빼도
> 초록이었다**(exit 0, unmet peer 0건). 즉 처분 대상 자체가 이미 없었고, (b) 조차 필요
> 없었다. 위 표는 lockfile 의 *선언* 을 읽은 것이고 이 정정은 *실행* 을 잰 것이다 —
> **선언을 읽는 것과 돌려 보는 것은 다른 측정**이라는 게 이 항목의 진짜 교훈이다.
> 넣었던 억제는 되돌렸다: 막을 대상이 없는 억제는 죽은 설정이고 나중에 진짜 미충족을
> 조용히 덮는다(fail-open).

**주의**: `#1043` 의 `ignoreCves` 선례처럼, 억제는 **근거를 남기고 baseline 으로 고정**해야
새 억제가 조용히 늘어나지 않는다.

## 2. eslint 9 → 10 상향 (P3)

eslint 9 는 이미 `maintenance` dist-tag 다(2026-08-01 실측: latest = 10.8.0). `#1074` 가 unicorn 을
`^56` 으로 고정한 것은 **eslint 9 를 유지하는 한** 옳은 결정이지만, 영구적이지 않다.

### 알려진 사실 (실측)

- unicorn **66+** 는 peer 가 `>=10.4` — eslint 9 자체를 배제한다. 즉 unicorn 최신화의 전제가 eslint 10.
- `typescript-eslint` peer 는 이미 `^8.57.0 || ^9.0.0 || ^10.0.0` 으로 **eslint 10 을 지원**한다.
- 전 워크스페이스가 이미 **flat config**(`eslint.config.mjs`)다 — 상향의 큰 장벽 하나가 이미 없다.
- eslint 선언이 갈려 있다: backend·packages = `^9.18.0`, frontend·channel-web-chat = `^9`.

### 범위

10개 워크스페이스 매니페스트 + 각 `eslint.config.mjs` 호환성 + 룰 시그니처 변경 대응.
`#1074` 가 넣은 `dependabot.yml` 의 unicorn major ignore 도 **이 작업에서 함께 풀어야 한다**
(그 항목 주석이 그렇게 결속해 뒀다).

## 체크리스트

- [x] §1 `nunjucks → chokidar` 미충족 처분 — **전제가 반증돼 처분 대상 자체가 없었다** (2026-08-10). 규칙 없이 `--strict-peer-dependencies --frozen-lockfile` → **exit 0, unmet peer 0건**. 2026-08-01 기준 서술이었고 그 사이 상류가 정리됐다. 억제를 넣었다가 **되돌렸다** — 막을 대상이 없는 억제는 죽은 설정이고 나중에 진짜 미충족을 조용히 덮는다(fail-open). 근거는 `pnpm-workspace.yaml` 주석에 남겼다.
- [x] §1 `--strict-peer-dependencies` 게이트 도입 — **`pnpm install` 호출부 5곳 전부**에 추가 — `.github/actions/pnpm-workspace`(9개 잡 / 5개 워크플로 파일이 거친다) + `.claude/test-stages.sh`(로컬/TEST WORKFLOW) + `codebase/backend/Dockerfile` · `codebase/frontend/Dockerfile` · `Dockerfile.playwright-e2e`(e2e 이미지 빌드). **처음엔 action 한 곳만 고치고 "한 줄이 전부를 덮는다" 고 적었는데 과장이었다** — 리뷰가 나머지 4곳을 짚었고 그중 3곳은 지금도 CI 에서 돈다. plan 자신이 "CI/**로컬** 게이트" 라고 적어 둔 범위였다. 기존 가드 `test_pnpm_workspace_action.py` 가 정확히 그 줄을 고정하고 있어 **함께 갱신** — 계약이 바뀌면 그 계약을 고정한 테스트도 바뀌어야 한다(가드가 제 일을 했다).
- [ ] **(무관, 이 티켓 밖 — 유실 방지 등재)** CLAUDE.md skill 권한표와 실제 관례의 불일치:
      `developer` 의 `review/**` 쓰기가 **`RESOLUTION.md` 로만** 한정돼 있는데, 실제로는 매
      라운드 산출물 전체(`<role>.md`·`SUMMARY.md`·`meta.json`…)를 커밋하는 것이 이 저장소의
      확립된 관례다(`git log -- review/code/` 로 확인). **어느 쪽이 옳은지가 결정 사항**이라
      임의로 정하지 않는다 — 감사 기록을 남기는 쪽(관례)이 맞다면 권한표를 넓히고, 권한을
      좁게 두는 쪽이 맞다면 누가 그 산출물을 커밋할지 정해야 한다.
      > 출처: `review/code/2026/08/10/15_41_41` scope INFO.

- [ ] §2 eslint 10 상향 — 10개 워크스페이스 + config 검증
      > ⚠️ **서술 정정 필요 (2026-08-28 `plan-audit`)** — 항목 자체는 **유효**하다.
      > **무엇이 낡았나**: "10개 워크스페이스" → **11개** 로 정정. 같은 수치가 3곳에 미러돼 있어 동시 갱신 필요: 본문 §범위(L92)·체크박스(L108)·`.github/dependabot.yml:91`·`codebase/backend/eslint.config.mjs:28`. 신규 워크스페이스는 `codebase/packages/masked-markers`(eslint `^9.18.0`).
      > **실측**: `grep -rln '"eslint":' --include=package.json` = **11개**(root 없음). `find -name eslint.config.mjs` 도 11개. #1190(3f8543eae, 08-21)이 `packages/masked-markers` 를 추가하면서 10→11 이 됐다.
- [ ] §2 상향 후 `dependabot.yml` 의 `eslint-plugin-unicorn` ignore 해제 + `eslint.config.mjs`
      주석의 실측 표 갱신
- [ ] TEST WORKFLOW + `/ai-review`

## Rationale

**왜 묶었나**: §1 이 §2 의 안전망이다. peer 게이트 없이 eslint 10 으로 올리면 이번과 같은
불일치가 또 조용히 통과한다. 순서는 §1 → §2 가 맞다.

**왜 P2/P3 인가**: 지금 깨진 것은 없다 — `#1074` 로 unmet peer 는 0이 됐고 lint 도 PASS 다.
다만 §1 이 없으면 다음 major 가 같은 방식으로 들어오고, §2 를 미루면 unicorn 이 계속 `^56` 에
묶인다. 둘 다 "지금 급하지 않지만 방치하면 같은 사고가 반복" 되는 클래스다.
