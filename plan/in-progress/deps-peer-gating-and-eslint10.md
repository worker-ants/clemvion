---
title: 의존성 peer 게이팅 + eslint 10 상향 — 무검증 major 머지의 남은 두 구멍
worktree: eslint10-upgrade-5e3cf9
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
>
> _(2026-08-29)_ §2 이후는 `eslint10-upgrade-5e3cf9` 워크트리에서 진행 중이라 값을 그리로
> 옮겼다. `--impl-done`(`01_30_29`) `plan_coherence` INFO #9 가 이 불일치를 짚었다 — 위
> 문단이 말한 오연결의 반대 방향이다(이번엔 게이트가 더 관대해지는 쪽이라 막히지는
> 않았지만, 그래서 조용하다).

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
> ⚠️ **이 표의 첫 줄은 그대로 읽으면 안 된다** (§3.1 에서 정정). 그때 비-frozen 이 실패한
> 것은 **그 순간 매니페스트가 바뀌어 재해소가 일어났기** 때문이다. 매니페스트 무변경
> 상태에서 같은 명령을 돌리면 **조용히 exit 0** 이다(2026-08-28 실측). 판별 기준은
> "frozen 인가" 가 아니라 **"재해소가 일어나는가"** 다 — 관측 잡이 lockfile 을 치우는 이유.
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

## 3. frozen 게이트의 사각지대 — lockfile 에 이미 박힌 미충족 peer (P3) — **(a) 로 집행 완료**

> **결정 (2026-08-28, 사용자): (a).** 구현은 `scripts/check-unmet-peers.py` +
> `.github/workflows/deps-peer-observe.yml`(주간 스케줄 전용, PR 트리거 없음). 상세는
> 아래 §3.1.

위 정정에서 드러난 잔여. 처분 후보:

- (a) 주간 스케줄 잡 하나가 **비-frozen** `pnpm install --strict-peer-dependencies` 를 돌려
      보고만 한다(PR 차단 아님 — 차단하면 상류 사정으로 main 이 빨개진다).
- (b) 위 2건을 먼저 처분하고 나서 (a) 를 차단형으로 승격.
- (c) 무조치 — `pnpm audit` 이 보안 축은 이미 덮고, peer 축은 실제 사고 이력이 `#1049`
      한 건뿐이며 그건 매니페스트 변경 경로라 지금 게이트가 잡는다.

착수 전 **`typeorm → ioredis` 가 실제 런타임 경로인지 먼저 실측**할 것 — (b)/(c) 의 갈림이
거기서 정해진다. 미측정 전제로 항목을 키우지 않는다.

> ### ✅ 선행 실측 완료 (2026-08-28 후속 턴) — **도달 불가 경로였다. (b) 는 탈락한다.**
>
> | 확인 | 결과 |
> |---|---|
> | `TypeOrmModule.forRootAsync` 의 `cache` 옵션 | **없음** (`app.module.ts` — `type/host/port/entities/synchronize/logging/extra` 뿐) |
> | ⇒ typeorm 이 Redis query cache 를 만드는가 | **아니오** → `ioredis` 를 **로드하지 않는다** |
> | backend 의 `ioredis` 실사용 | **직접 의존 `^6.0.0`** — BullMQ · rate limiter · dedup · seq allocator · continuation bus · health (10+ 모듈) |
>
> 즉 typeorm 의 `ioredis@^5.0.4` peer 는 **우리가 도달하지 않는 코드**를 위한 것이고,
> 우리가 쓰는 ioredis 6 은 **별개 소비자**의 직접 의존이다. 두 축이 겹치지 않는다.
>
> 이 저장소가 peer 억제에 요구하는 근거는 "동작할 것이다" 가 아니라 **"그 코드에 도달하지
> 않는다"** 인데(`pnpm-workspace.yaml` §peer dependency 게이트), 이 건은 정확히 그 기준을
> 충족한다. `nunjucks → chokidar` 는 §1 이 이미 optional peer 로 실측해 뒀다.
>
> **⇒ 두 건 다 무해가 확정됐으므로 (b)"먼저 처분하고 차단형으로 승격" 은 처분할 대상이
> 없어 성립하지 않는다.** 남은 선택은 (a) 관측형 주간 잡과 (c) 무조치뿐이고, 둘의 차이는
> "앞으로 새로 박히는 미충족을 보고만이라도 받을 것인가" 다 — 이 항목의 실제 결정 지점은
> 거기로 좁혀졌다.
>
> ⚠️ 억제 규칙(`peerDependencyRules`)을 **넣지는 않았다.** §1 이 남긴 교훈 그대로다 —
> frozen 게이트에서는 애초에 발화하지 않으므로 막을 대상이 없고, 막을 대상이 없는 억제는
> 죽은 설정이라 나중에 진짜 미충족을 조용히 덮는다(fail-open).

### 3.1 집행 (2026-08-28) — (a) 관측형

- **선행 실측을 한 번 더 정정한다.** 위 표의 "frozen 은 못 잡는다" 결론은 처음엔
  **node_modules 가 있는 상태**로만 재서 나온 것이었다. 그건 약한 조건이다 — CI 는 항상
  fresh 체크아웃이므로 "설치가 새로 일어나면 잡히지 않나" 라는 반론이 성립한다.
  그래서 **node_modules 를 지우고 CI 형태 그대로** 다시 쟀다:

  | 조건 | 결과 |
  |---|---|
  | fresh(node_modules 없음) + `--frozen-lockfile --strict-peer-dependencies` **= CI 형태** | **exit 0, 보고 0건** |
  | node_modules 있음 + `--strict-peer-dependencies` (매니페스트 무변경) | exit 0, 보고 0건 |
  | `--lockfile-only --strict-peer-dependencies` (lockfile 최신) | exit 0, 보고 0건 |
  | **lockfile 제거 후** `--lockfile-only --strict-peer-dependencies` | **exit 1, 2건** |

  결론은 유지되지만 **근거가 바뀌었다** — 원인은 "node_modules 유무" 가 아니라
  **"재해소가 일어나는가"** 다. frozen 은 재해소를 하지 않으므로 fresh 든 아니든 계산 자체를
  안 한다. 마지막 줄이 관측 잡의 트리거다.

- **구현**: `scripts/check-unmet-peers.py` — lockfile 을 임시로 치우고 재해소한 뒤
  `finally` 로 되돌린다(`git checkout` 미사용 — 미커밋 작업을 지운 전례). 결과를
  `ACCEPTED` 등재부와 대조해 **새로 생긴 것에서만** 실패한다.
- **왜 baseline 인가**: 착수 시점에 이미 2건이라 baseline 없이 돌리면 첫 주부터 영구
  빨간불이고, 그건 신호가 아니라 소음이다. `check-pnpm-security-config.py` 의
  `EXPECTED_*` 스냅샷 규약과 같은 형태.
- **양방향 fail-closed**: 등재 항목이 **사라져도** 실패한다 — 해소된 수용을 남겨 두면
  나중에 같은 이름의 진짜 문제를 덮는다(§1 이 `peerDependencyRules` 를 되돌린 이유).
- **차단 아님**: `.github/workflows/deps-peer-observe.yml` 은 `schedule` +
  `workflow_dispatch` 만 트리거다. `deps-security-checks.yml` 안에 넣지 않은 이유는
  그 워크플로가 required check 자리라 스케줄 전용 잡이 PR 마다 `skipped` 로 보고되기
  때문이다 — 그 파일 헤더가 직접 경고하는 모호함을 새로 만들 이유가 없다.
- **뮤테이션 검증** (예측/실측 전부 일치):

  | 뮤턴트 | 예측 | 실측 |
  |---|---|---|
  | `typeorm→ioredis` 등재 제거 | RED "새로 생겼다" | **RED** — "사라졌다" 분기까지 동시 발화 |
  | 파서(`_UNMET_RE`) 무력화 | RED fail-closed | **RED** |

  두 번째가 중요하다 — pnpm 출력 형태가 바뀌면 파서가 조용히 0건을 돌려주고 가드가
  그때부터 무의미해진다. 종료 코드와 파싱 결과가 어긋나면 통과시키지 않는다.
- `test_workflow_yaml_structure.py` 의 `_PERMISSIONS` 등재부도 함께 갱신했다(2-place 규약).

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
> (`eslint-plugin-react-hooks@7.1.1` 만 `^10.0.0` 을 넣었다 — ⚠️ **그러나 우리 트리는
> 7.0.1 에 핀돼 있어 그것도 차단자다. 아래 §정정 참조 — 차단자는 셋이 아니라 넷**).
> 실제로 11개를 전부 올려
> `pnpm install --strict-peer-dependencies` 를 돌려 이 4건의 unmet peer 를 **관측하고**
> 되돌렸다 — "peer 를 읽어 추정" 이 아니라 실행 결과다.
>
> `peerDependencyRules` 억제는 쓰지 않았다. 이 저장소가 억제에 요구하는 근거는 "그 코드에
> 도달하지 않는다" 인데(`pnpm-workspace.yaml` §peer dependency 게이트), 여기서는 그 플러그인들이
> eslint 10 위에서 **실제로 돌아야 하는** 대상이라 미검증 억제가 곧 fail-open 이다.
> 해제 조건과 실측 표의 SoT: `codebase/frontend/eslint.config.mjs` 헤더.
>
> ### ⚠️ 정정 (2026-08-28 후속 턴) — **우리 트리의 차단자는 셋이 아니라 넷이다**
>
> 위 서술은 `eslint-plugin-react-hooks` 를 "이미 `^10.0.0` 을 넣었으니 차단자가 아니다" 로
> 뺐다. 그건 **registry latest(7.1.1)** 를 잰 것이고, **우리 트리는 다르다** —
> `pnpm-workspace.yaml` 의 `eslint-plugin-react-hooks: 7.0.1` **exact 핀** 때문에 lockfile 이
> 7.0.1 을 고정하고 있고 그 버전의 peer 상한은 `^9.0.0` 이다(lockfile 실측).
>
> 결론(“frontend 는 아직 못 올린다”)은 그대로지만 **해제 조건이 하나 늘었다**. 그리고 그
> 하나는 성격이 다르다 — 앞의 셋은 상류를 기다려야 하지만 이건 **우리 override 값**이라
> 우리가 올리면 된다. 다만 그 핀에는 근거 주석이 없어(`ef3617a79` pnpm 마이그레이션 유입)
> 왜 exact 였는지부터 확인해야 한다.
>
> **이 갭은 감시 가드의 뮤테이션 검증 중 드러났다.** react-hooks 를 차단자 목록에 넣어
> RED 를 기대했는데 GREEN 이 나왔고(무효 뮤턴트), 그 이유를 파다가 우리 트리의 핀을 봤다.
> 원래 설계대로 셋만 봤다면 나머지 셋이 풀린 순간 가드가 **"해제됐다" 고 거짓 통지**했을
> 것이다 — registry 를 재고 우리 트리를 재지 않은 대가다.
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
- [x] **(무관, 이 티켓 밖 — 유실 방지 등재)** CLAUDE.md skill 권한표와 실제 관례의 불일치:
      `developer` 의 `review/**` 쓰기가 **`RESOLUTION.md` 로만** 한정돼 있는데, 실제로는 매
      라운드 산출물 전체(`<role>.md`·`SUMMARY.md`·`meta.json`…)를 커밋하는 것이 이 저장소의
      확립된 관례다(`git log -- review/code/` 로 확인). **어느 쪽이 옳은지가 결정 사항**이라
      임의로 정하지 않는다 — 감사 기록을 남기는 쪽(관례)이 맞다면 권한표를 넓히고, 권한을
      좁게 두는 쪽이 맞다면 누가 그 산출물을 커밋할지 정해야 한다.
      > 출처: `review/code/2026/08/10/15_41_41` scope INFO.

      **결정 (2026-08-29, 사용자): 관례에 맞춰 넓힌다.** CLAUDE.md 권한표를
      `review/**/RESOLUTION.md` → `review/**` 로. 라운드 산출물 전체가 저장소에 남는 감사
      기록이 맞다고 봤다.

      착수하며 실측한 것 — **불일치가 두 군데 더 있었다.** 이 항목은 "권한표 vs 관례" 만
      적고 있었는데:

      | 출처 | `developer` 의 `review/` 권한 |
      |---|---|
      | `CLAUDE.md` 권한표 | `review/**/RESOLUTION.md` 만 |
      | `.claude/skills/developer/SKILL.md` 권한 행 | `review/` **Read/Write** — 두 문서가 이미 서로 어긋나 있었다 |
      | 실제 관례 | `review/code/` 를 건드린 커밋 **595건**(2026-08-29 실측), 라운드 산출물 전체 |

      그리고 `developer/SKILL.md` 의 "plan 체크박스 = 실제 상태" 규칙이 그 **근거**로
      "review 산출물(`review/code/**`)은 gitignored 라 PR 에 없고" 를 적고 있었다 —
      **거짓이다.** `.gitignore` 가 무시하는 것은 `review/**/_prompts/` **한 줄뿐**이고
      (`19a1ed8c9`), `SUMMARY.md`·`<role>.md`·`meta.json`·`RESOLUTION.md` 는 전부 커밋된다.
      규칙 자체는 유효하므로 근거만 "체크박스는 상태 주장이다" 로 갈아 끼웠다. 결정과
      무관하게 틀린 문장이라 어느 쪽을 택했어도 고칠 대상이었다.

> **이 트래커는 아직 `complete/` 로 옮기지 않는다.** 이 브랜치(`#1232`)만 놓고 보면 미체크
> 항목이 0 이지만, 병렬로 열린 **`#1231`(§6.3.1 주석 정리)이 §2 에 후속 3건을 새로 등재**한다
> — C2 를 단언으로 잠그는 캐너리 · `cause` 비노출 불변식의 계측 지점 · `secret-resolver`
> 주석 한 문장. 두 PR 이 다 머지된 뒤의 상태가 판정 기준이고, 그때 열린 항목이 3건이다.
> (먼저 머지되는 쪽만 보고 봉인하면 그 3건이 봉인된 `complete/` 안으로 들어간다 — 이 문서가
> §2 에서 이미 한 번 당한 형태다.)

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
- [x] TEST WORKFLOW + `/ai-review`
      - [x] lint — PASS (backend `--max-warnings 0` 포함)
      - [x] unit — PASS (backend 434 suite / 9,031 tests + 내부 패키지 8개 전부)
      - [x] build — PASS
      - [x] e2e — PASS (285/285)
      - [x] `/ai-review` (`review/code/2026/08/28/11_45_02`) — RISK=HIGH, Critical 1 + Warning 2.
            **전부 조치 완료** (`0f3b3e0c3`·`9bcbb7fa5`·`3a540aa81`, RESOLUTION.md §조치 항목).
            - Critical: `PROJECT.md` 가 **자기가 명문화한 2-place 편집 계약을 스스로 어겼다** —
              dependabot ignore 를 2건→1건으로 줄이면서 "현재 2건" 서술을 안 고쳤다. 이 PR 이
              재발 방지 근거로 인용하는 `#1049`(값-주석 drift) 를 최상위 문서에 새로 만든 셈.
              카운트는 추정 대신 `.github/dependabot.yml` 을 파싱해 세어 정정했다.
            - Warning 2: 내가 손댄 두 자리에 **테스트가 없었다** — `chunkText` force-split 분기
              (죽은 대입을 지운 바로 그 분기)와 `SecretResolver` 복호화 실패 분기(disable 주석으로만
              보안 불변식을 적은 자리). 둘 다 회귀 테스트로 잠갔고, 후자는 `err.cause === undefined`
              를 단언해 disable 이 실수로 지워지면 RED 가 나게 했다.
            - 별도: `beed5143e` 가 `dependabot.yml` 에 심은 **매달린 참조**("아래 참조" 뒤에 아무것도
              없음)를 RESOLUTION 검토 중 직접 발견해 정정했다(`214af6d0e`). 리뷰가 잡은 것이 아니다.
      - [x] `/consistency-check --impl-done spec/5-system/ --diff-base origin/main`
            (`review/consistency/2026/08/28/12_20_11`) — **BLOCK: NO**, Critical 0 · Warning 0,
            5개 checker 전원 NONE. `spec/**` diff 0 을 각 checker 가 독립 확인했다.
- [x] (후속, INFO) `cause` 부착 판단 근거 — **주석 대신 테스트로 잠갔다** (2026-08-28 후속 턴).
      등재 당시 계획은 "`cause: err` 옆에 1줄 주석" 이었는데, 같은 라운드의 리뷰 INFO 가 요구한
      것은 **런타임 단언**이었다. 둘 중 테스트가 강하다 — 주석은 지워져도 아무도 모르지만
      단언은 RED 를 낸다. 그래서 두 spec 에 케이스를 하나씩 넣고 판별 기준(“message 가 이미
      원문을 담고 있으면 cause 안전, `secret-resolver` 는 담지 않으므로 예외”)을 그 케이스의
      주석에 실었다.
      - 뮤테이션 실측(두 곳의 `cause: err` 제거): **신규 2건만 RED, 두 spec 의 기존 케이스는
        전부 GREEN** — 즉 기존 `.message` 단언만으로는 이 계약을 전혀 지키지 못했다.
        (절대 개수는 적지 않는다 — 케이스가 늘면 그 숫자가 조용히 stale 해진다. 측정 시점
        커밋은 `b235a612b` 직전 상태다.)
      - ~~부수 발견: `code.handler` 의 cause 는 `isolated-vm` 이 **자기 realm** 에서 만든
        `SyntaxError` 라 호스트 `Error` 를 상속하지 않는다(`toBeInstanceOf(Error)` 실패 실측).~~
        → **정정 (2026-08-29) — 실측이 반증했다.** 원인은 isolate 경계가 아니라 **Jest 의
        realm** 이다. 같은 컴파일 예외를 평범한 node(= 프로덕션과 같은 host realm)에서 받으면
        `err instanceof Error` 가 **true** 이고, `vm.createContext` 로 만든 별도 realm
        (= Jest 가 테스트 파일을 실행하는 조건) 안에서만 **false** 다. 즉 네이티브 애드온은
        **메인 realm** 의 `Error` 로 만들고 Jest 샌드박스의 `Error` 와만 갈린다. own property
        도 `message`/`stack` 뿐이었다. "형제 케이스와 단언 형태가 다른 이유이고 통일하려다
        지우면 안 된다" 는 결론은 유지되지만 **귀속이 틀렸다** — 그 귀속을 그대로 옮겨 적은
        주석 2곳(`code.handler.ts` · `code.handler.spec.ts`)을 함께 정정했다.
      - ~~`spec/conventions/` 에 판별 기준을 명문화하는 것은 **여전히 planner 턴** 으로 남는다.~~
        → **완료 (2026-08-29, planner 턴).** 정본은 `spec/5-system/3-error-handling.md`
        **§6.3.1** + 그 Rationale. `conventions/` 가 아닌 이유: `secret-store.md` 는 secret
        계약이라 범위가 좁고(부착 사례 둘은 secret 과 무관), `error-codes.md` 는 에러 **코드
        문자열**의 SoT 라 wrapping 정책이 들어갈 자리가 아니다.
        초안·검토 기록: `plan/complete/spec-draft-error-cause-criterion.md`(#1228 에서 이동),
        `review/consistency/2026/08/29/00_13_01`(BLOCK: NO).
        **기준이 초안에서 바뀌었다** — `--spec` 검토가 "`cause` 는 message 가 아니라 `err`
        **객체 전체**를 붙인다" 를 짚어, "message 가 원문을 포함하는가"(C1) 하나였던 것을
        **C1 AND C2**(`err` 가 message·name 밖 민감 속성을 안 들고 있는가)로 고쳤다.

        > **⚠️ 후속 정정 (2026-08-29) — 내가 "등재됐다" 고 한 것이 거짓이었다.**
        >
        > `#1230` PR 본문에 "인라인 주석 3곳이 §6.3.1 을 참조하도록 정리하는 것은 developer
        > 턴이고 **이 §2 에 등재돼 있다**" 고 적었는데, **등재돼 있지 않았다.** 위 `[x]` 항목은
        > *테스트로 잠갔다* 는 다른 작업이고, 그 정리 작업은 `spec-draft-error-cause-criterion.md`
        > 안에만 있었다 — 그 문서는 `#1228` 에서 **`complete/` 로 봉인**됐으므로 열린 항목으로는
        > 어디에도 남지 않았다(`git grep '6\.3\.1' -- plan/` 로 확인).
        >
        > 이 저장소가 이미 배운 형태다 — **조건부 처분을 봉인된 `complete/` 에 두면 유실된다.**
        > 재등재 대신 그 자리에서 처리했다(주석 5곳, 아래).
        >
        > **처리 (2026-08-29)**: `expression-resolver.service.ts` · `code.handler.ts` ·
        > `secret-resolver.service.ts` + 두 spec 파일의 설명 주석이 §6.3.1 을 가리킨다.
        > **주석에 기준을 재서술하지 않고** "이 자리가 C1·C2 를 어떻게 만족하는가" 만 적었다 —
        > 실제로 `expression-resolver.service.spec.ts` 의 주석이 **C1 만 적고 있어** 정본과
        > 갈려 있었다(§6.3.1 이 C2 를 추가하기 전 문구가 남은 것). 요약을 두면 갈린다.
        >
        > **리뷰 라운드 결과** (`review/code/2026/08/29/01_07_51`, forced 7 reviewer 전원 —
        > Critical 0 · Warning 1). 그 Warning 이 **이 PR 의 목적을 그대로 재발시킨 사례**다:
        > `expression-resolver.service.spec.ts` 의 C2 서술이 §6.3.1 원문의 한정어("message·name
        > 밖의 **민감** 정보")를 떨어뜨려 "밖 속성이 없다" 로 과잉 일반화됐는데, `ExpressionError`
        > 는 실제로 `code`(enum)·`position`(정수 오프셋)을 갖는다 — 문자 그대로는 거짓이었다.
        > 리뷰가 지목한 것은 1곳이지만 **자매를 전수로 세어** `code.handler` 2곳도 같은 형태라
        > 3곳을 함께 고쳤다. 조치 기록: 그 세션의 `RESOLUTION.md`.
        >
        > **2라운드 (`review/code/2026/08/29/01_40_43`)**: Critical 0 · **Warning 0** ·
        > 위험도 NONE (router 선별 7명, forced 전원 결과 확보). 1라운드 Warning 의 fix 가
        > 자매 전수까지 반영됐음을 7 reviewer 가 독립 확인했다 — RESOLUTION 불요(clean).
        > 게이트도 이 라운드로 재무장이 풀린다(1라운드 세션 시각 < fix 커밋 시각이었다).
        > `--impl-done`(`01_30_29`)은 그 뒤 spec-linked **코드** 편집이 없으므로 유효하다.
        >
        > 후속으로 남긴 것 (developer SKILL §수렴 예외 (a)(b)(c)(d) — 둘 다 동작 결함이 아니고,
        > 고치면 spec-linked 파일이라 리뷰 2종이 freshness 로 재무장된다):
        >
        > - [ ] **C2 를 단언으로 잠그기** (리뷰 INFO #1) — `cause` 의 own enumerable key 가
        >       `code`/`position`(비민감) 밖으로 늘면 RED 를 내는 캐너리. 지금은 주석이 "민감
        >       속성 없음" 을 말할 뿐 아무도 강제하지 않는다. 위 §6.3.1 항목이 "주석 대신 테스트로
        >       잠갔다" 고 한 것은 **C1 만** 잠근 것이다.
        > - [ ] **`cause` 비노출 불변식의 계측 지점** (리뷰 INFO #2) — `GlobalExceptionFilter`
        >       또는 공용 에러 직렬화 유틸에 "`cause` 를 클라이언트 응답에 노출하지 않는다"
        >       회귀 테스트 1건. 오늘 안전한 근거가 **부재 주장**이라, APM·구조적 로깅 유틸이
        >       하나 생기면 조용히 깨진다.
        >
        >       **근거의 범위를 좁혀 둔다 (2026-08-29 2라운드 INFO #3 · 실측).** "저장소 전체에
        >       `.cause` 소비자가 없다" 는 **거짓**이다 — backend 소스에 정확히 한 곳,
        >       `telegram/telegram-client.ts:92` 의 `describeFetchError()` 가 `err.cause` 를
        >       읽어 로그 문자열을 만든다(`grep -rn --include='*.ts' '\.cause' codebase/backend/src`
        >       가 그 한 줄만 낸다). 다만 그 함수는 **Telegram fetch 에러 전용**이라 위 세
        >       경로(`expression-resolver`/`code.handler`/`secret-resolver`)가 던지는 에러를
        >       받지 않는다. 그러니 참인 명제는 **"이 세 경로의 `cause` 를 읽는 곳이 없다"** 다.
        >       다음에 이 근거를 재사용할 때 넓은 쪽을 쓰지 말 것.
        > - [ ] (작음, 다음에 그 파일을 열 때) `secret-resolver.service.ts` 의 비부착 주석에서
        >       "서버 로그에만 남는 것도 아니다" 옆에 "이는 C1 판정의 **보조 근거**일 뿐
        >       판정축이 아니다" 한 문장 — `--impl-done`(`01_30_29`) `rationale_continuity`
        >       INFO #2. §6.3.1 이 **명시적으로 기각한** "소비처가 직렬화하는가" 기준과
        >       닮아 보여 오인 소지가 있다는 지적이다(실제 판정은 C1 로 정확히 했다).
      > **(등재 당시 기록) 왜 그 턴에 안 고쳤나** — developer SKILL §수렴 예외 (a)+(b)+(c)+(d) 충족.
      > (a) 동작 결함이 아니다: 두 경로 모두 `cause` 부착이 안전함을 `security`·
      > `rationale_continuity` 두 리뷰어가 **독립적으로 실측 확인**했다(다운스트림에서
      > `.cause` 를 직렬화하는 곳이 없음). 남은 것은 근거 주석의 유무뿐이다.
      > (b) fix 가 새 라운드를 강제한다: 두 파일 다 spec frontmatter `code:` 에 걸리는
      > spec-linked 파일이라, 주석 한 줄만 건드려도 방금 통과한 `--impl-done`(12_20_11) 과
      > `/ai-review`(11_45_02) 가 freshness 비교에서 **동시에 무효**가 된다. 2줄 주석의
      > 값이 리뷰 2종 재실행 비용을 넘지 않는다.
      > (c) 근거를 여기 남긴다 — 등재 사유는 "비용" 이 아니라 "수렴" 이다. 발견의 성격이
      > 이미 동작 → 구조 → **문서** 로 이동했다.
      > (d) 그 턴(2026-08-28)에 등재했다.
      >
      > ~~같은 예외로 함께 미룬 것: **frontend·channel-web-chat 의 "eslint 9 잔류" 해제 조건에
      > backend `eslint-unicorn-peer.spec.ts` 와 대칭되는 자동 가드가 없다**(2라운드 INFO #6).~~
      > → **완료 (2026-08-28)**: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts`.
      > 차단자 4개의 peer range 를 **lockfile 에서** 읽어 "아직 eslint 10 을 배제하는가" 를
      > 단언한다 — 배제가 풀리면 RED 로 해제를 통지하는 **캐너리**다(방향이 거꾸로인 가드).
      >
      > 데이터 출처가 lockfile 인 이유(실측): 그 플러그인들은 frontend 의 전이 의존이라
      > `require()` 로 해소되지 않고(`MODULE_NOT_FOUND`), `eslint-config-next` 는 `exports` 맵이
      > `./package.json` 을 막는다(`ERR_PACKAGE_PATH_NOT_EXPORTED` — unicorn 73 과 같은 클래스).
      >
      > **보장 범위를 좁게 적는다**: 이 가드는 registry 를 보지 **않는다**. "상류가 릴리스한
      > 순간" 이 아니라 "그 릴리스가 우리 lockfile 에 들어온 순간" 알린다. 유입은 dependabot
      > 이 담당한다 — 두 축의 분업이다.
- [x] §3 frozen 게이트 사각지대 — **(a) 관측형으로 집행 완료** (2026-08-28 사용자 결정). `scripts/check-unmet-peers.py` + `.github/workflows/deps-peer-observe.yml`(주간 스케줄 전용). 상세·뮤테이션 실측은 §3.1
- [x] (후속) `@eslint/eslintrc` 죽은 선언 제거 — backend devDep 에 `^3.3.6` 이 선언돼 있었으나
      **사용처 0건**(import·`FlatCompat`·`.eslintrc*` 파일 전부 없음, 전수 grep). eslint 10 이
      이 패키지를 더 이상 번들하지 않아(실측: backend `eslint@10.9.1` → 의존 없음 /
      frontend `eslint@9.39.4` → 의존 있음) **§2 상향 직후 그 선언만이 backend 트리에
      붙잡아 두는 유일한 끈**이 됐다. 제거 후 `codebase/backend/node_modules/@eslint/` 에
      `js` 만 남음을 확인했고 backend lint 는 그대로 통과한다.
      - 값: dependabot 이 이 패키지 bump PR 을 계속 만든다(`#1184` 가 정확히 그것). 아무도
        쓰지 않는 패키지의 PR 스트림이 사라진다.
      - **하지 않은 것**: `pnpm-workspace.yaml` 의 brace-expansion 주석이 인용하는 경로
        (`@eslint/eslintrc > minimatch@3.1.5 > brace-expansion@1.1.18`)를 고치려 했으나,
        실측이 그 계획을 반증했다 — 그 경로는 frontend 의 eslint 9 를 통해 **lockfile 에
        그대로 남아 있다**(`@eslint/eslintrc@3.3.6 → minimatch: 3.1.5` snapshot 확인).
        주석은 지금도 정확하므로 건드리지 않았다.

> **2라운드 리뷰(`review/code/2026/08/28/12_28_11`)의 교훈 — 내가 요청한 테스트가 vacuous 했다.**
> 1라운드 Warning 을 닫으려 넣은 force-split 테스트는 **분기 진입만** 고정하고
> `overlapBuffer = ''` 리셋은 관측하지 못했다. fixture 가 force-split 직후 끝나서 그 값을
> **읽는 코드에 도달하지 않았기** 때문이다(그 값은 `pushChunk(…, overlapBuffer, …)` 에서만
> 소비된다). 뮤테이션으로 확정했다 — 리셋 삭제 시 신규 케이스 RED · 기존 케이스 GREEN.
>
> **"분기에 들어갔다" 는 "그 분기가 만든 값이 관측됐다" 와 다른 주장이다.** fixture 의 형태가
> 커버리지의 축이고, 이 경우 축은 "force-split **이후에** 일반 청크가 하나 더 나오는가" 였다.
> 덧붙여, 지워진 원본 dead-store 를 되살리는 뮤턴트는 뒤따르는 무조건 대입 때문에 **무효
> 뮤턴트**라 쓸 수 없었다 — 관측 가능한 축을 따로 골라야 했다.

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
