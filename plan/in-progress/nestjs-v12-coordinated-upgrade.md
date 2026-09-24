---
title: NestJS 12 동반 업그레이드 — 상류 미대응으로 보류
status: in-progress
owner: developer
worktree: (unstarted)
spec_impact: none
started: 2026-09-24
---

# NestJS 12 동반 업그레이드 — **상류 미대응으로 보류** (2026-09-24 실측)

원래 [#1382](https://github.com/worker-ants/clemvion/pull/1382)
(`@nestjs/platform-express`)의 종착점으로 세운 계획이다. **착수했다가 세 벽에 막혀
되돌렸다** — 아래 §0 이 그 실측이고, 이 문서는 상류가 움직일 때까지 **열어 둔다**.

> **[#1339](https://github.com/worker-ants/clemvion/pull/1339)(`@nestjs/typeorm`)은 여기서
> 떨어져 나갔다.** 그 패키지의 peer 는 `^10 || ^11 || ^12` 라 Nest 11 위에서 돈다(실측) —
> 동반 업그레이드가 필요 없었다. `deps-typeorm12` PR 이 처리했다.
> 즉 **부분 범프가 안 된다는 이 문서의 원래 주장은 `platform-express` 에만 참**이고,
> `typeorm` 에는 거짓이었다. peer 범위를 패키지마다 따로 읽지 않고 «Nest 12 는 통짜» 로
> 뭉갠 것이 원인이다.

## 0. 왜 멈췄나 — 세 벽 (전부 실측)

전 패키지를 12 로 올리고 `pnpm install` → `run-test.sh build` 까지 실제로 돌려 본 결과다.

| # | 벽 | 실측 |
| --- | --- | --- |
| 1 | **`@nestjs-modules/mailer` 가 Nest 12 타이핑을 못 받는다** | 최신이 **2.3.7**(그 이상 없음)이고 CJS 다. 그 `d.ts` 가 `@nestjs/common/interfaces` 를 깊게 import 하는데 Nest 12 의 exports 맵은 `"./*": "./*.js"` 뿐이라 `interfaces.js`(존재하지 않음)로 보낸다 → `TS2307 Cannot find module`. 결과적으로 `MailerAsyncOptions` 가 `Pick<any,'imports'>` 가 되어 `imports` 가 **필수**로 바뀌고, `mail.module.ts:9` 가 `TS2345` 로 빌드를 깬다 |
| 2 | **`@nestjs/throttler` 도 같은 형태** | 6.7.0 의 peer 는 `^12.0.0` 을 **명시적으로 포함**하는데, `throttler-module-options.interface.d.ts` 가 역시 `@nestjs/common/interfaces` 를 깊게 import 해 `TS2307`. peer 선언과 타이핑 실태가 어긋난 자리다 |
| 3 | **`@nestjs/cli`·`schematics` 12 가 TypeScript 6 을 요구** | `@nestjs/schematics@12.0.0`~`12.0.5` **전 버전**이 `typescript>=6.0.0` peer 이고, `@nestjs/cli@12.0.0`~`12.0.6` 전부가 그 schematics 를 끌어온다. 저장소는 TS 5.9.3 이고 `PROJECT.md §빌드 툴체인 major 자동 bump 차단` 이 TS major 를 **«사람이 올릴 판단»** 으로 막아 뒀다 |

**1·2 의 범위는 정확히 둘이다** — `skipLibCheck: false` 로 열어 전수 확인했고 실패하는
서드파티 `d.ts` 는 `throttler` 와 `mailer` 뿐이다. Nest 자신의 v12 패키지들도 같은 서브패스를
51회 import 하지만 **ESM 이라 정상 해석**된다. 즉 **CJS 서드파티만 걸린다.**

> **진단 과정에서 이 저장소 고유의 함정을 하나 밟았다 — 기록해 둔다.**
> 로컬 `tsc` 는 **통과**하고 Docker 빌드만 실패했다. `--traceResolution` 으로 갈라 보니
> 로컬은 `@nestjs/common/interfaces` 를 **`/Volumes/project/private/clemvion/node_modules/`**,
> 즉 **부모 체크아웃(main repo)의 `node_modules`** 에서 찾고 있었다. 워크트리가
> `.claude/worktrees/` 로 main repo **아래에 중첩**돼 있어 Node/TS 의 조상 `node_modules`
> 탐색이 거기까지 올라간다. **의존성 해석 문제에서 로컬 초록은 증거가 되지 못한다** —
> 깨끗한 컨테이너(=CI)로 판정할 것.

## 3. 재개 조건

- [ ] `@nestjs-modules/mailer` 가 Nest 12 대응 타이핑을 낸다 (또는 그 모듈을 걷어내고
      `nodemailer` 를 직접 쓴다 — 별도 판단)
- [ ] `@nestjs/throttler` 가 `@nestjs/common/interfaces` 깊은 import 를 걷는다
- [ ] TypeScript 6 상향을 **사람이 결정**한다 (TS 6 은 Go 재작성판인 7 이 아니라 고전 JS
      컴파일러의 마지막 라인임을 실측했다 — `main: ./lib/typescript.js` 유지. 그래도
      `PROJECT.md` 의 major 차단·`typescript-toolchain.test.ts` 의 워크스페이스 lockstep
      때문에 backend 만의 문제가 아니다)

우회로(§0 의 1·2 를 tsconfig `paths` 로 덮기)는 **택하지 않았다** — 타입 shim 이 ESM/CJS
경계를 가려 새 결함을 숨길 수 있고, 사용자가 2026-09-24 에 «#1339 만 풀고 나머지는 기록»
으로 결정했다.

## A. 왜 부분 범프가 안 되나 — 실측 (`platform-express` 한정)

| 실측 | 값 |
| --- | --- |
| `@nestjs/*` v12 존재 | **전부 있다** — `common`·`core`·`platform-express`·`platform-socket.io`·`websockets`·`testing` 12.1.0, `typeorm` 12.0.1, `jwt` 12.0.2, `passport` 12.0.0, `swagger` 12.0.2, `bullmq` 12.0.0, `config` 12.0.1, `cli`·`schematics` 12.0.5 |
| 모듈 형식 | 위 전부 **`type: module`**. `throttler` 만 별도 라인(6.7.0, CJS) |
| `platform-express@12` 단독 범프 | **런타임 사망** — `@nestjs/common/internal` 을 import 하는데 common@11 의 `exports` 에 그 서브패스가 없다(`ERR_MODULE_NOT_FOUND`, e2e backend 컨테이너 exit 1). peer 범위는 `^11` 을 허용한다고 적혀 있지만 **실제로는 common@12 를 요구한다** |

## B. 선행 조건

**충족됨** — [#1387](https://github.com/worker-ants/clemvion/pull/1387) 이 `0b5b226b3` 으로
main 에 들어갔고, 이 워크트리가 그 커밋을 base 로 한다.

`plan/complete/jest-esm-native-load.md` 가 **먼저** 들어가야 했다. 그것 없이는
`@nestjs/typeorm@12`(`import.meta.url`)를 CJS jest 가 로드하지 못한다.

> **그 PR 의 가드는 여기까지 보증하지 않는다.** `esm-native-load.spec.ts` 의 canary 는
> `uuid` 인데, `uuid` 는 **CJS 로 downlevel 이 가능한** ESM 이다. 이 업그레이드의 진짜 벽인
> `import.meta.url`(downlevel 원리적 불가)은 **`@nestjs/typeorm@12` 를 실제로 얹어야** 행사된다.
> 로컬에서 미리 한 번 재 뒀지만(472/9946 통과, `jest-esm-native-load.md` §C) 저장소에 상주하는
> 검증은 아니다 — **착수 시 이 케이스가 실제로 초록인지 직접 확인할 것.**
> (`review/code/2026/09/24/15_26_17` INFO 3)

## C. 착수 시 **반드시** 검증할 것 — reflection 보안 회귀

`--impl-prep` `review/consistency/2026/09/24/12_57_36` `plan_coherence` W3 이 짚은 것이고
**받아들인다**. 이 저장소는 `@nestjs/*` 업그레이드를 **보안 회귀 우선조사 트리거**로 이미
명문화해 뒀다(`spec/5-system/1-auth.md` §«부트 캐너리 — `@WorkspaceId()` reflection 자가검증»,
`plan/in-progress/auth-guard-reflection-hardening.md` §1, `CHANGELOG.md`).

이유: `RolesGuard` 와 `@WorkspaceId()` 가 Nest **비공개 API**(`ROUTE_ARGS_METADATA`)에
의존하고, 그 파손 방향이 **fail-open** 이다 — 깨지면 모든 라우트가 «워크스페이스 무관» 으로
판정돼 멤버십 검증이 **조용히 사라진다.**

- [ ] **부트 캐너리의 «소비 라우트 수» 를 업그레이드 전/후로 비교**한다. spec 이 스스로
      *"캐너리는 전체 파손만 잡고 부분 파손은 못 잡는다"* 고 적었으므로, 0 이 아닌지가 아니라
      **같은 수인지**를 본다. 기준값을 업그레이드 **전에** 먼저 기록할 것.
- [ ] `workspace.decorator` · `roles.guard` 단위 스위트가 **의도한 경로를 그대로 타는지**
      확인한다(통과 여부만이 아니라).
- [ ] **«unit/e2e 숫자가 그대로면 통과» 로 뭉뚱그리지 않는다.** fail-open 이라 숫자는
      그대로인 채 보장만 사라질 수 있다 — 그것이 이 항목이 존재하는 이유다.

> 이 가드는 최근 두 PR([#1384](https://github.com/worker-ants/clemvion/pull/1384) ·
> [#1385](https://github.com/worker-ants/clemvion/pull/1385))이 직접 만진 자리다.
> `#1385` 가 «`handlerConsumesWorkspaceId` 가 false 면 `RolesGuard` 가 단락한다» 는 성질에
> 기대어 결함을 고쳤으므로, 그 성질이 업그레이드로 바뀌면 **그 수정의 전제가 무너진다.**

### 업그레이드 **전** 기준값 — 먼저 재서 박아 둔다

§C 가 «0 이 아닌지가 아니라 **같은 수인지**» 를 보라고 했으므로, 의존성을 한 줄도 바꾸기
전에 두 값을 실측했다. base 는 `0b5b226b3`.

| 기준값 | 전(실측) | 어떻게 쟀나 |
| --- | --- | --- |
| 부트 캐너리 소비 라우트 수 | **142건** | `make e2e-up` 후 backend 컨테이너 로그의 `[WorkspaceIdReflection]` 줄. 캐너리 독스트링이 적어 둔 2026-08-09 실측치(142)와 일치한다 |
| reflection 3스위트 | **48 통과 / 48** | `workspace.decorator.spec` · `workspace-reflection-canary.spec` · `roles.guard.spec` |

**판별자(MB) 도 미리 확보했다** — 「스위트가 통과한다」와 「스위트가 그 경로를 탄다」는
다른 주장이고, 후자는 통과 여부로 증명되지 않는다. `handlerConsumesWorkspaceId` 가 **항상
false** 를 돌려주도록(=reflection 파손 시뮬레이션) 한 줄 뮤턴트를 넣었다:

| | 예측 | 실측 |
| --- | --- | --- |
| MB `handlerConsumesWorkspaceId` → 항상 false | RED | **RED — 3스위트 전부, 9개 테스트** |

RED 가 난 9개는 「비멤버가 헤더로 타 워크스페이스를 지정 + `@Roles()` 없음 → 거부」 처럼
**정확히 `#1103` 이 닫은 cross-tenant 결함 클래스**를 지키는 것들이다. 업그레이드 뒤에도
**같은 뮤턴트가 같은 9개를 RED 로 만들어야** 「경로를 탄다」가 성립한다 — 초록만 보고
넘어가면 fail-open 이라 아무것도 확인하지 못한 것이 된다.

(원복은 `cp` + 절대경로, 원복 후 워킹트리 diff 빈 출력 확인.)

## D. 그 밖에 예상되는 것 (착수 시 실측)

- ~~`throttler` 6.7.0 의 peer 가 Nest 12 를 받는지.~~ **실측 완료 — peer 는 받는다
  (`^12.0.0` 명시 포함). 그런데 타이핑이 안 받는다**(§0 벽 2). peer 선언만 보고 «호환» 으로
  적을 뻔한 자리다.
- `@nestjs/cli` 12 의 `nest build` 산출물이 여전히 CJS 인지 — 이 저장소는 런타임을 CJS 로
  유지할 계획이다(ESM 전환은 **하지 않는다**, `jest-esm-native-load.md` §E 의 결론).
- Swagger·socket.io 어댑터의 v12 API 변경.

## E. 종결 조건

- [ ] §3 재개 조건 셋이 모두 풀린다
- [ ] `@nestjs/*` 전 패키지 12.x, TEST WORKFLOW 전 단계 통과 — **build 는 Docker 단계까지**
      (로컬 `tsc` 만으로는 §0 의 함정에 속는다)
- [ ] §C 검증 셋 기록. **기준값은 이미 재 뒀다**(§C 하위 «업그레이드 전 기준값») — 캐너리
      142건, reflection 3스위트 48통과, 판별자 MB 가 9건 RED. `deps-typeorm12` PR 에서
      업그레이드 후에도 **동일**함을 확인했으므로 그 값들은 여전히 유효한 비교 기준이다
- [ ] `#1382` close (`#1339` 는 `deps-typeorm12` 가 처리했다)
