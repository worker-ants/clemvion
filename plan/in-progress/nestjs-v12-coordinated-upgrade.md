---
title: NestJS 12 동반 업그레이드 — 부분 범프는 성립하지 않는다
status: in-progress
owner: developer
worktree: (unstarted)
spec_impact: none
started: 2026-09-24
---

# 스텁 — `jest-esm-native-load` 가 들어간 **뒤** 착수한다

막힌 dependabot PR 둘([#1339](https://github.com/worker-ants/clemvion/pull/1339)
`@nestjs/typeorm` · [#1382](https://github.com/worker-ants/clemvion/pull/1382)
`@nestjs/platform-express`)의 진짜 종착점. 둘 다 **부분 메이저 범프**라 그 자체로는 유효한
상태가 아니다.

## A. 왜 부분 범프가 안 되나 — 실측

| 실측 | 값 |
| --- | --- |
| `@nestjs/*` v12 존재 | **전부 있다** — `common`·`core`·`platform-express`·`platform-socket.io`·`websockets`·`testing` 12.1.0, `typeorm` 12.0.1, `jwt` 12.0.2, `passport` 12.0.0, `swagger` 12.0.2, `bullmq` 12.0.0, `config` 12.0.1, `cli`·`schematics` 12.0.5 |
| 모듈 형식 | 위 전부 **`type: module`**. `throttler` 만 별도 라인(6.7.0, CJS) |
| `platform-express@12` 단독 범프 | **런타임 사망** — `@nestjs/common/internal` 을 import 하는데 common@11 의 `exports` 에 그 서브패스가 없다(`ERR_MODULE_NOT_FOUND`, e2e backend 컨테이너 exit 1). peer 범위는 `^11` 을 허용한다고 적혀 있지만 **실제로는 common@12 를 요구한다** |

## B. 선행 조건

`plan/in-progress/jest-esm-native-load.md` 가 **먼저** 들어가야 한다. 그것 없이는
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

## D. 그 밖에 예상되는 것 (착수 시 실측)

- `throttler` 6.7.0 의 peer 가 Nest 12 를 받는지.
- `@nestjs/cli` 12 의 `nest build` 산출물이 여전히 CJS 인지 — 이 저장소는 런타임을 CJS 로
  유지할 계획이다(ESM 전환은 **하지 않는다**, `jest-esm-native-load.md` §E 의 결론).
- Swagger·socket.io 어댑터의 v12 API 변경.

## E. 종결 조건

- [ ] `@nestjs/*` 전 패키지 12.x, TEST WORKFLOW 전 단계 통과
- [ ] §C 검증 셋 기록
- [ ] `#1339` · `#1382` close (목표 버전이 충족되면 dependabot 이 스스로 닫을 수도 있다 —
      아니면 수동)
