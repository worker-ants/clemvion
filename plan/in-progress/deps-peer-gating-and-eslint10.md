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

> ### ⚠️ 이 게이트의 보장 범위 정정 (2026-08-28 실측) — §3 신설 사유
>
> §1 은 "`--strict-peer-dependencies` 를 5곳에 넣었으니 미충족 peer 가 CI 실패가 된다" 로
> 읽힌다. **그 보장은 실제보다 넓다.** 5개 호출부가 **전부 `--frozen-lockfile` 과 함께** 쓰므로
> pnpm 이 해소를 다시 하지 않고, 그래서 **이미 lockfile 에 박혀 있는 미충족 peer 는 잡히지
> 않는다.** 잡히는 것은 "매니페스트가 바뀌어 새로 해소되는" 경우뿐이다.
>
> 실측:
>
> | 명령 | 결과 |
> |---|---|
> | `pnpm install --strict-peer-dependencies` (비-frozen) | **실패** — backend 2건 보고 |
> | `pnpm install --frozen-lockfile --strict-peer-dependencies` (= CI 가 도는 형태) | **exit 0** |
>
> 그 2건은 이 브랜치가 만든 것이 **아니다** — `origin/main` 의 lockfile 과 대조해 typeorm 의
> peer 해소가 **바이트 동일**(`typeorm@0.3.31(ioredis@6.0.0)…`)임을 확인했다:
>
> ```
> codebase/backend
> ├─┬ typeorm 0.3.31   └── ✕ unmet peer ioredis@^5.0.4: found 6.0.0
> └─┬ nunjucks 3.2.4   └── ✕ unmet peer chokidar@^3.3.0: found 4.0.3
> ```
>
> 즉 §1 이 "처분 대상 자체가 없었다" 고 적은 2026-08-10 결론은 **그때는 맞았지만 지금은
> 아니다** — 그 사이 상류가 다시 벌어졌고, 게이트가 frozen 이라 아무도 몰랐다.
> (`nunjucks → chokidar` 는 §1 이 optional peer 임을 이미 실측했으니 무해하다. `typeorm →
> ioredis` 는 **미판정** — backend 가 ioredis 6 을 실제로 쓰는 경로가 typeorm 캐시인지
> BullMQ 인지 확인이 필요하다.)
>
> 이 항목은 §1 의 체크박스를 되돌리지 **않는다**. 5곳 배치는 실제로 됐고, 새로 들어오는
> 미충족을 막는다는 좁은 보장은 참이다. 넓게 읽히는 서술만 여기서 좁히고, 남은 갭은 §3 으로 뺀다.

## 3. frozen 게이트의 사각지대 — lockfile 에 이미 박힌 미충족 peer (P3)

위 정정에서 드러난 잔여. 처분 후보:

- (a) 주간 스케줄 잡 하나가 **비-frozen** `pnpm install --strict-peer-dependencies` 를 돌려
      보고만 한다(PR 차단 아님 — 차단하면 상류 사정으로 main 이 빨개진다).
- (b) 위 2건을 먼저 처분하고 나서 (a) 를 차단형으로 승격.
- (c) 무조치 — `pnpm audit` 이 보안 축은 이미 덮고, peer 축은 실제 사고 이력이 `#1049`
      한 건뿐이며 그건 매니페스트 변경 경로라 지금 게이트가 잡는다.

착수 전 **`typeorm → ioredis` 가 실제 런타임 경로인지 먼저 실측**할 것 — (b)/(c) 의 갈림이
거기서 정해진다. 미측정 전제로 항목을 키우지 않는다.

## 2. eslint 9 → 10 상향 (P3)

eslint 9 는 이미 `maintenance` dist-tag 다(2026-08-01 실측: latest = 10.8.0). `#1074` 가 unicorn 을
`^56` 으로 고정한 것은 **eslint 9 를 유지하는 한** 옳은 결정이지만, 영구적이지 않다.

### 알려진 사실 (실측)

- unicorn **66+** 는 peer 가 `>=10.4` — eslint 9 자체를 배제한다. 즉 unicorn 최신화의 전제가 eslint 10.
- `typescript-eslint` peer 는 이미 `^8.57.0 || ^9.0.0 || ^10.0.0` 으로 **eslint 10 을 지원**한다.
- 전 워크스페이스가 이미 **flat config**(`eslint.config.mjs`)다 — 상향의 큰 장벽 하나가 이미 없다.
- eslint 선언이 갈려 있다: backend·packages = `^9.18.0`, frontend·channel-web-chat = `^9`.

### 범위

11개 워크스페이스 매니페스트 + 각 `eslint.config.mjs` 호환성 + 룰 시그니처 변경 대응.
`#1074` 가 넣은 `dependabot.yml` 의 unicorn major ignore 도 **이 작업에서 함께 풀어야 한다**
(그 항목 주석이 그렇게 결속해 뒀다).

> **실행 결과 (2026-08-28) — 11개 중 9개만 올라갔다. 나머지 2개는 상류가 막는다.**
>
> | 워크스페이스 | eslint | 근거 |
> |---|---|---|
> | `backend` + `packages/*` 8개 (총 9) | **`^10.9.1`** | 상향 완료. `@eslint/js` 도 `^10.0.1` |
> | `frontend` · `channel-web-chat` | `^9` 유지 | **상류 차단** — 아래 |
>
> `eslint-config-next@16.3.3`(latest) 자신의 peer 는 `eslint: >=9.0.0` 이라 열려 **보이지만**,
> 그 의존성 셋이 eslint 9 를 상한으로 못 박는다(2026-08-28 registry 실측, 각 latest):
> `eslint-plugin-react@7.37.5`=`^…|| ^9.7` · `eslint-plugin-jsx-a11y@6.10.2`=`^…|| ^9` ·
> `eslint-plugin-import@2.32.0`=`^…|| ^9`. **eslint 10 을 지원하는 버전이 아직 없다**
> (`eslint-plugin-react-hooks@7.1.1` 만 `^10.0.0` 을 넣었다). 실제로 11개를 전부 올려
> `pnpm install --strict-peer-dependencies` 를 돌려 이 4건의 unmet peer 를 **관측하고**
> 되돌렸다 — "peer 를 읽어 추정" 이 아니라 실행 결과다.
>
> `peerDependencyRules` 억제는 쓰지 않았다. 이 저장소가 억제에 요구하는 근거는 "그 코드에
> 도달하지 않는다" 인데(`pnpm-workspace.yaml` §peer dependency 게이트), 여기서는 그 플러그인들이
> eslint 10 위에서 **실제로 돌아야 하는** 대상이라 미검증 억제가 곧 fail-open 이다.
> 해제 조건과 실측 표의 SoT: `codebase/frontend/eslint.config.mjs` 헤더.
>
> 부수 실측: `@eslint/js` 는 더 이상 eslint 와 lockstep 이 아니다 — eslint latest `10.9.1`
> 대비 `@eslint/js` latest 는 **`10.0.1`**(10.x 전체가 alpha/rc 포함 5개뿐). peer 는
> `eslint: ^10.0.0` 이라 정합.

### 상향이 깨뜨린 것 (전부 이 PR 에서 처리)

1. **새 recommended 룰 위반 15건** — `@eslint/js@10` 의 `configs.recommended` 가
   `no-useless-assignment`(12건) · `preserve-caught-error`(3건) 를 켠다. backend 14 +
   `packages/web-chat-sdk` 1. `preserve-caught-error` 는 두 곳(`expression-resolver` ·
   `code.handler`)에 `cause: err` 를 달고, `secret-resolver` 한 곳만 **근거 있는 disable**
   로 뒀다 — 그 자리는 원본 crypto 에러를 일부러 추상화하는 지점이고(`#814` 에서 "서버
   로그니까 안전" 이 오전제로 반증됐다 — 노드 에러는 Activity API 로 노출된다), `cause` 를
   달면 그 추상화가 무의미해진다.
2. **`eslint-plugin-unicorn@73` 의 `exports` 맵** — `{".": …}` 하나뿐이라
   `require('eslint-plugin-unicorn/package.json')` 이 차단된다(56.x 엔 없던 제약).
   가드가 읽는 **대상**은 그대로이고 **접근 경로**만 막힌 것이므로, 모듈 해소 대신
   `node_modules/<pkg>/package.json` 파일 경로 읽기로 바꿔 계약을 유지했다.
3. **`parseGteFloor` 가 2-component 를 못 읽었다** — unicorn 66+ 의 실제 peer 표기는
   `>=10.4` 인데 파서가 `>=X.Y.Z` 만 받아 `null` → 가드 2건이 **fail-closed 로 멈췄다**.
   설계대로 동작한 것이고(헤더 주석이 예고한 그대로), 그 자리에서 `>=X` / `>=X.Y` 까지
   넓히고 회귀 케이스를 고정했다. **형태(자릿수)가 커버리지의 축**이라는 게 교훈이다 —
   합성 fixture 가 `'>=9.18'` 을 "해석하지 않는 형태" 로 **못 박고 있어서** 그 축이 닫혀 있었다.

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

- [x] §2 eslint 10 상향 — **11개 중 9개 완료**(`backend` + `packages/*` 8개 → `eslint ^10.9.1`,
      `@eslint/js ^10.0.1`). `frontend`·`channel-web-chat` 2개는 **상류 차단으로 eslint 9 유지** —
      `eslint-config-next` 의 react/jsx-a11y/import 플러그인이 latest 조차 eslint 9 상한이다
      (§범위 아래 실측 표). 11개 전부를 올려 `--strict-peer-dependencies` 실패를 **관측한 뒤**
      되돌린 결과다.
      > 종전 "10개 워크스페이스" 서술은 `plan-audit`(2026-08-28) 지적대로 **11개**가 맞았다.
      > 같은 수치의 미러 3곳도 이 PR 에서 함께 정리됐다: 본문 §범위(위) · 이 체크박스 ·
      > `codebase/backend/eslint.config.mjs`. 네 번째 미러였던 `.github/dependabot.yml` 의
      > unicorn ignore 블록은 **제거**되어 미러 자체가 사라졌다.
- [x] §2 상향 후 `dependabot.yml` 의 `eslint-plugin-unicorn` ignore 해제 + `eslint.config.mjs`
      주석의 실측 표 갱신 — unicorn `^56.0.1` → `^73.0.0`. ignore 를 남기면 "막을 대상이 없는
      억제"가 되어 fail-open 이므로 제거하고, 되살릴 조건(가드 + `--strict-peer-dependencies`)을
      그 자리에 적었다. registry 표는 66·70·73 재확인(전부 `>=10.4`).
- [ ] TEST WORKFLOW + `/ai-review`
      - [x] lint — PASS (backend `--max-warnings 0` 포함, 15건 수정 후)
      - [x] unit — PASS (backend 434 suite / 9,030 tests + 내부 패키지 전부)
      - [x] build — PASS
      - [ ] e2e
      - [ ] `/ai-review`
      - [ ] `/consistency-check --impl-done`
- [ ] §3 frozen 게이트 사각지대 — 위 신설 항목. `typeorm → ioredis` 실측이 선행

> **사전 일관성 검토 (`--impl-prep spec/5-system/`, 2026-08-28 `11_15_50`) — BLOCK: NO.**
> Critical 0. WARNING 4건은 전부 **이 브랜치와 무관한 선재 spec drift** 다 —
> `naming_collision` 이 `git diff origin/main -- spec/5-system/` = **빈 결과**임을 실측했고,
> 이 PR 은 spec 을 건드리지 않는다. 그대로 planner 영역으로 남긴다:
> ① `1-auth.md` §2.2 JWT `role` 클레임 각주 · ② §2.3 동시 세션 한도 표면 정리 ·
> ③ `3-error-handling.md` §1.2 `OAUTH_STATE_MISMATCH` 등재 ·
> ④ execution-engine / embedding-pipeline / graph-rag 소급 caveat 3건.
> ③④ 는 각각 `spec-update-node-cancellation-shutdown-classification.md` ·
> `update-returning-tuple-shape.md` 가 이미 위임해 둔 항목이라 **신규 등재 불요**(중복 방지).

## Rationale

**왜 묶었나**: §1 이 §2 의 안전망이다. peer 게이트 없이 eslint 10 으로 올리면 이번과 같은
불일치가 또 조용히 통과한다. 순서는 §1 → §2 가 맞다.

**왜 P2/P3 인가**: 지금 깨진 것은 없다 — `#1074` 로 unmet peer 는 0이 됐고 lint 도 PASS 다.
다만 §1 이 없으면 다음 major 가 같은 방식으로 들어오고, §2 를 미루면 unicorn 이 계속 `^56` 에
묶인다. 둘 다 "지금 급하지 않지만 방치하면 같은 사고가 반복" 되는 클래스다.
