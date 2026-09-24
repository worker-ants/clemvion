---
title: "@nestjs/typeorm 12 — 동반 업그레이드 없이 풀린다"
status: complete
owner: developer
worktree: nestjs12-upgrade
spec_impact: none
started: 2026-09-24
---

# `@nestjs/typeorm` 12 — 동반 업그레이드 없이 풀린다

막힌 dependabot PR 둘을 조사하던 흐름의 세 번째 PR이다
([#1386](https://github.com/worker-ants/clemvion/pull/1386) planner 정정 →
[#1387](https://github.com/worker-ants/clemvion/pull/1387) jest ESM 네이티브 로드 → **여기**).

## A. 전제가 하나 틀렸다

`nestjs-v12-coordinated-upgrade.md` 는 **두 dependabot PR 이 같은 벽에 막혀 있고 동반
업그레이드가 유일한 출구**라고 적었다. `platform-express` 에는 참이지만
**`typeorm` 에는 거짓**이었다 — peer 를 패키지마다 읽지 않고 «Nest 12 는 통짜» 로 뭉갰다.

| 패키지 | peer (`@nestjs/common`) | 결론 |
| --- | --- | --- |
| `@nestjs/typeorm@12.0.1` | `^10.0.0 \|\| ^11.0.0 \|\| ^12.0.0` | **Nest 11 위에서 돈다** |
| `@nestjs/platform-express@12.1.0` | `^12.0.0` | common@12 필수 — 별건 |

`typeorm@12` 를 막고 있던 유일한 것은 **jest 가 `import.meta.url` 을 못 읽는 것**이었고,
`#1387` 이 그것을 치웠다. 그래서 이 PR 은 한 줄이다.

## B. 변경

`codebase/backend/package.json` 의 `@nestjs/typeorm`: `^11.0.3` → `^12.0.1`.
그 외 `@nestjs/*` 는 **11 유지**. lockfile 상 `@nestjs/typeorm@12.0.1` 이
`@nestjs/common@11.1.27` 위에 붙는다.

### lockfile 은 손으로 좁혔다 — 기존 진동에 끼지 않으려고

`pnpm install` 이 쓴 lockfile 은 typeorm 외에 **무관한 67줄**을 더 바꿨다(리뷰 1라운드
W1): optional 네이티브 패키지 63곳의 `libc: [glibc|musl]` 삭제, `eslint-plugin-*` 두
importer 의 peer 해석 문자열 맞교환.

원인을 재 봤다. **플랫폼 차이가 아니다** — 고정 pnpm(10.23.0)을 Linux 컨테이너에서 main 의
lockfile 로부터 돌려도 **같은 63줄이 빠진다**. `git log -S` 로 보니 `libc:` 필드는
**dependabot 이 넣고 사람 커밋(고정 pnpm)이 빼기를 반복**해 왔고, 가장 최근 `65df1974f`
(dependabot, 09-10)가 다시 넣었다. 즉 dependabot 이 쓰는 pnpm 과 저장소가 고정한 pnpm 이
어긋나 생기는 **기존 진동**이다.

그래서 main 의 lockfile 에서 출발해 **typeorm 변경분만** 얹었다 — 고정 pnpm 이 Linux 에서
낸 결과와 opcode 단위로 비교해 typeorm 에 속한 것만 채택했다. diff 는 **15줄, 전부
typeorm**. 검증: `pnpm install --frozen-lockfile --strict-peer-dependencies` 통과(그리고
lockfile 을 다시 쓰지 않음), `run-test.sh build` 의 Docker 단계(컨테이너 안 Linux frozen
설치) 통과.

진동 자체는 이 PR 의 스코프가 아니라 트래커에 등재했다.

## C. 검증 — reflection 보안 회귀 (`coordinated-upgrade` §C 의 조건 셋)

이 저장소는 `@nestjs/*` 업그레이드를 **보안 회귀 우선조사 트리거**로 명문화해 뒀다.
`typeorm` 은 reflection 경로와 무관해 보이지만, 조건이 «무관해 보이면 건너뛴다» 가 아니라
«전/후를 비교한다» 이므로 그대로 이행했다.

| 조건 | 전 | 후 |
| --- | --- | --- |
| 부트 캐너리 «소비 라우트 수» | **142건** | **142건 — 동일** |
| reflection 3스위트 | 48 통과 / 48 | 48 통과 / 48 |
| **판별자 MB** — `handlerConsumesWorkspaceId` 를 항상 false 로 | 3스위트 **9건 RED** | 3스위트 **9건 RED — 동일** |

MB 가 이 표의 핵심이다. §C 가 «통과 여부만이 아니라 **의도한 경로를 그대로 타는지**» 를
요구하는데, 이 가드는 파손 방향이 **fail-open** 이라 초록은 아무것도 증명하지 못한다.
RED 가 나는 9건은 「비멤버가 헤더로 타 워크스페이스를 지정 + `@Roles()` 없음 → 거부」 처럼
**`#1103` 이 닫은 cross-tenant 결함 클래스**를 지키는 것들이고, 업그레이드 후에도 같은
뮤턴트가 같은 9건을 RED 로 만든다 = 경로가 살아 있다.

(캐너리 수는 `make e2e-up` 후 backend 컨테이너 로그의 `[WorkspaceIdReflection]` 줄.
원복은 `cp` + 절대경로, 원복 후 `codebase/` diff 가 의도한 한 줄뿐임을 확인.)

## D. 하지 않는 것 — 그리고 왜

`@nestjs/*` 전면 12 업그레이드를 **착수했다가 되돌렸다.** 세 벽의 실측은
`plan/in-progress/nestjs-v12-coordinated-upgrade.md` §0 에 옮겨 적었다. 요약:

1. `@nestjs-modules/mailer` 최신(2.3.7)이 Nest 12 타이핑을 못 받는다 — CJS `d.ts` 가
   `@nestjs/common/interfaces` 를 깊게 import 하는데 v12 의 exports 가 그 경로를 안 연다.
2. `@nestjs/throttler@6.7.0` 도 같은 형태 — **peer 는 `^12.0.0` 을 명시 포함하는데 타이핑이
   안 받는다.**
3. `@nestjs/cli`·`schematics` 12 **전 버전**이 `typescript>=6` 을 요구 —
   `PROJECT.md` 가 TS major 를 «사람이 올릴 판단» 으로 막아 둔 자리다.

우회로(tsconfig `paths` shim + TS 6 상향)는 사용자가 2026-09-24 에 **«#1339 만 풀고
나머지는 기록»** 으로 결정해 택하지 않았다.

### 진단에서 밟은 함정 — 로컬 초록이 거짓이었다

전면 업그레이드 시도에서 **로컬 `tsc` 는 통과하고 Docker 빌드만 실패**했다.
`--traceResolution` 으로 갈라 보니 로컬은 `@nestjs/common/interfaces` 를
**`/Volumes/project/private/clemvion/node_modules/`** — 즉 **부모 체크아웃(main repo)** 에서
찾고 있었다. 워크트리가 `.claude/worktrees/` 로 main repo **아래에 중첩**돼 있어 조상
`node_modules` 탐색이 거기까지 올라간다.

**의존성 해석 문제에서 이 저장소의 로컬 초록은 증거가 되지 못한다** — 깨끗한 컨테이너
(= `run-test.sh build` 의 Docker 단계, = CI)로 판정할 것. 이 PR 의 build 가 Docker 단계까지
통과한 것이 그래서 의미가 있다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system` → **BLOCK: NO · Critical 0 · Warning 3**
      (`review/consistency/2026/09/24/17_31_27`). W3 은 후속으로 등재 — 아래 §후속
- [x] 업그레이드 **전** 기준값 실측 (캐너리 142 · 3스위트 48 · 판별자 MB 9건 RED)
- [x] 전면 12 업그레이드 시도 → 세 벽 실측 → 되돌림, 트래커에 기록
- [x] `@nestjs/typeorm` 만 12 로 + `--strict-peer-dependencies --frozen-lockfile` 깨끗
- [x] TEST WORKFLOW — lint PASS · backend unit **473스위트/9950**(불변) · **build PASS
      (Docker 포함)** · **e2e 380 PASS**
- [x] §C 검증 셋 — 전/후 동일 확인
- [x] `/ai-review` → **2라운드에 수렴** (forced 전원, 14/14)
      - 1R `18_22_23` Critical 0 · Warning 3 → 전부 조치(lockfile 15줄로 최소화 · 트래커
        `worktree` 사유 명시 · `require(esm)` 결속을 `PROJECT.md` floor 줄에)
      - 2R `18_48_20` Critical 0 · Warning 1 → 조치(트래커 §E 에 `1-auth.md` 정정 체크박스).
        이 라운드의 `codebase/**` 수정 0건, fix 는 plan 한 파일이라 3라운드 불요 — 판단 근거는
        그 RESOLUTION 에
- [x] ~~`/consistency-check --impl-done`~~ — **해당 없음(실측)**. 이 PR 의 `codebase/**` 변경은
      `package.json` 한 파일이고 어떤 spec 의 frontmatter `code:` 글로브에도 매칭되지 않는다
      (`review_guard._spec_linked_changes()` 가 빈 목록). `jest-esm-native-load` 에서 공허성까지
      확인한 같은 판정이다
- [x] plan `complete/` 로 — 후속은 트래커 `nestjs-v12-coordinated-upgrade.md`(보류, §3·§E) 와
      `spec-draft-nullable-notation-followups.md`(lockfile `libc:` 진동) 에 등재

## 후속

- **`spec/5-system/1-auth.md` §Rationale 의 `^11.0.1` 인용** — impl-prep W3.
  이 PR 은 `@nestjs/common` 을 건드리지 않으므로 **그 문장은 여전히 참**이다. 동반
  업그레이드가 실제로 들어갈 때 정정이 필요하고, 그건 `spec/` 쓰기라 **planner 턴**이다.
  **`nestjs-v12-coordinated-upgrade.md` §E 종결 조건에 체크박스로 등재했다.**

  > 초판은 «§3 재개 조건과 함께 처리한다» 고만 적고 **그 항목을 트래커에 만들지 않았다** —
  > 가리킨 대상이 존재하지 않는 문장이었다(`/ai-review` `18_48_20` W1). 이 plan 은 머지 후
  > `complete/` 로 가서 재개 시점엔 아무도 안 열어 보므로, 할 일은 **열려 있는 문서에
  > 체크박스로** 있어야 한다.
- **`#1382` close** — 위 세 벽이 풀릴 때까지 머지 불가. 트래커 §E 에 등재돼 있다.
