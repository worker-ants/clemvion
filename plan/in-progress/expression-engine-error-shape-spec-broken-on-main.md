---
title: "`expression-engine/error-shape.spec.ts` 가 main 에서 컴파일 실패 — unit 스테이지 상시 FAIL"
worktree: close-two-residuals-e5f7a9
# ↑ 2026-09-01 갱신 — 최초 값(audit-record-factory)은 #1259 로 머지됐다.
started: 2026-09-01
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

## Overview

`.claude/tools/run-test.sh unit` 의 **`codebase/packages/expression-engine`** 잡이
`src/__tests__/error-shape.spec.ts` 의 **TS 컴파일 에러**로 "Test suite failed to run" 한다.
`origin/main` 자체가 깨져 있으며, 발견 브랜치(`claude/audit-record-factory`)의 변경과 무관하다.

```
TS2677: A type predicate's type must be assignable to its parameter's type.
  Type '[string, new (message: string) => ExpressionError]' is not assignable to
  '[string, typeof ErrorCode | typeof ExpressionError | … ]'
    'new (message: string) => ExpressionError' is missing: captureStackTrace,
    prepareStackTrace, stackTraceLimit
TS2351: This expression is not constructable.
  Type 'typeof ErrorCode' has no construct signatures.
```

> ## ⚠ 정정 (2026-09-01) — "선재 확정" 의 근거가 틀렸다
>
> 아래 §"선재임을 어떻게 확정했나" 는 **파일 동일성**으로 "결과가 갈릴 여지가 없다" 고
> 결론지었다. 그 추론은 **툴체인이 같다는 전제를 몰래 깔고 있었고**, 그 전제가 거짓이다.
>
> | 실측 | 결과 |
> |---|---|
> | CI `packages-checks` @ `4afab7ca1`(도입 커밋) — `Test (jest)` 스텝 | **실제로 실행됐고 success** |
> | 로컬 (Node 22.14, 전체 워크스페이스 설치) | **fail** |
> | 로컬 (Node 24.17 — 워크스페이스 요구 버전) | **fail (동일)** |
> | `pnpm-lock.yaml` 도입 커밋 이후 변경 | **없음** |
>
> Node 버전 가설도 반증됐다. 남는 차이는 **설치 방식**이다 — CI 는
> `pnpm install --filter '<pkg>...'` 로 그 패키지 서브트리만 설치하고, 로컬은 전체
> 워크스페이스를 설치한다. hoisting 이 달라져 `ts-jest` 가 보는 TS·eslint 해석이 갈리는
> 것으로 보인다.
>
> **두 번째 독립 신호**: 같은 로컬에서 `pnpm --filter @workflow/expression-engine lint` 가
> **내가 건드리지 않은** `parser.ts:317`(`no-case-declarations`)에서 실패한다. CI 는 같은
> 커밋에서 lint 도 통과했다. 로컬에서만 나는 실패가 둘이면 원인은 대상이 아니라 환경이다.
>
> **그래서 제목의 "broken on main" 은 과하다.** main 의 CI 는 이 잡을 통과한다 — 단
> **돌 때만** 그렇다(아래 §CI 관측 참조).

## CI 관측 — green 이 "테스트가 통과했다" 를 뜻하지 않았다

`packages-checks.yml` 은 skip-job 패턴이다: `codebase/packages/**` 변경이 없으면
`relevant=false` 로 **모든 스텝을 skip 하고 잡을 success 로 보고**한다.

`4afab7ca1`(#1237)이 `codebase/packages/` 를 건드린 **마지막** 커밋이다. 그 뒤 #1258·#1259·
#1260 은 전부 no-op 이었다 — `gh run view 33495942981` 로 `Test (jest)` 스텝이
**`skipped`** 임을 확인했다.

즉 **이 경로가 실제로 깨지면 아무도 그 경로를 건드리지 않는 한 초록으로 남는다.** 이번 PR 은
`codebase/packages/` 를 건드리므로 그 잡이 **실제로 돈다** — CI 가 로컬-CI 차이에 대한 답을
직접 준다.

## 선재임을 어떻게 확정했나 (아래는 정정 대상 — 원문 보존)

"내 diff 와 무관해 보인다" 가 아니라, **그 컴파일에 들어가는 입력 전부가 `origin/main` 과
바이트 동일**함을 확인했다:

```
git diff --name-only origin/main -- pnpm-lock.yaml package.json \
    codebase/packages tsconfig.json '**/tsconfig*.json'   →  0 파일
```

패키지 소스·테스트·의존성 잠금·tsconfig 어느 것도 다르지 않으므로 결과가 갈릴 여지가 없다.
도입 커밋은 `4afab7ca1` (#1237) — 이 spec 파일을 신설한 커밋이다.

## 왜 지금 고치지 않나

`backend-lint-gate-broken-on-main.md` 의 **선례를 따른다** — 2026-08-08 사용자 결정으로,
main 선재 breakage 는 **별 PR 로 분리**해 기능 PR 의 diff 를 덮지 않게 한다. 이 건도 발견
브랜치가 `codebase/packages/` 를 전혀 건드리지 않으므로 같은 처분이 맞다.

## 진단 메모 — 이 결함의 성격

`error-shape.spec.ts` 는 `deps-peer-gating-and-eslint10.md` 가 설계한 **"클래스 전수 열거"**
테스트다(export 된 하위 클래스를 열거해 전부 검사, 개수가 바뀌면 전수성 단언이 먼저 RED).
그 전수 열거가 `Object.entries(errorsModule)` 류로 모듈 export 를 훑는데, **에러 클래스가
아닌 export(`ErrorCode` — 값 enum/const)가 같은 모듈에 섞여** 있어 타입 술어가 성립하지 않는다.

즉 "전수성" 을 모듈 export 전체로 잡은 것이 원인이므로, 수정 방향은 **에러 클래스 집합을
명시 배열로 좁히고 그 배열의 전수성을 따로 단언**하는 쪽이다 — 타입 술어를 느슨하게 캐스팅해
통과시키면 이 테스트의 존재 이유(개수가 바뀌면 RED)가 사라진다.

## 체크리스트

- [x] **타입 유도로 해소 (2026-09-01).** ~~열거 대상을 **명시 배열로 좁히고**~~ —
      **이 처방은 틀렸다.** 명시 배열로 가면 런타임 자동 발견이 사라져 "새 하위 클래스가
      추가되면 전수성 단언이 먼저 RED" 라는 **이 테스트의 존재 이유**가 없어진다.

      대신 **발견은 런타임(`Object.entries`)이 하고 타입은 모듈에서 유도**한다 —
      `typeof errors` 에서 `ExpressionError` 하위 생성자인 키만 매핑 타입으로 뽑아
      `entry is [SubclassName, ErrorsModule[SubclassName]]` 로 좁힌다. 캐스트 없음.

      원인은 술어 타입이 `Object.entries` 원소 타입(모듈 export union — 값 enum `ErrorCode`
      포함)의 **부분타입이 아니라서**(TS2677)였다.

      뮤테이션 검증: `errors.ts` 에 7번째 하위 클래스를 추가 → **RED 3**, 그중 하나가
      `ProbeError 의 enumerable own key…` 다. **새 클래스가 실제로 발견돼 순회됐다**는 뜻이고,
      명시 배열이었으면 아예 나타나지 않았을 자리다.
- [x] **`run-test.sh unit` 통과 확인 (2026-09-01).** 수정 전 `1 failed, 2 passed / 123`
      → 수정 후 `3 passed / 133`. 스테이지 전체 `status=PASS`.
      단 **이 실패는 로컬에서만 난다** — 위 §정정 참조.
- [x] **CI 이력 대조 완료 (2026-09-01).** 답: **"깨진 적이 없다 — 돌지 않았을 뿐이다."**
      `packages-checks` 는 `codebase/packages/**` 변경이 없으면 no-op 후 success 로 보고하고,
      도입 커밋 `4afab7ca1` 이 그 경로를 건드린 마지막 커밋이다. 자세한 것은 §CI 관측.

- [ ] **로컬-CI 툴체인 차이 규명** (신규, 2026-09-01). 같은 커밋·같은 lockfile 인데 CI 는
      test·lint 둘 다 통과하고 로컬은 둘 다 실패한다(Node 22·24 무관). 유력 가설은 설치
      방식 — CI 는 `--filter '<pkg>...'` 서브트리 설치, 로컬은 전체 워크스페이스.
      **이 PR 이 `codebase/packages/` 를 건드리므로 CI 가 그 잡을 실제로 돌린다** — 그 결과가
      가설의 1차 판정이다. 재개 신호: 이 PR 의 `packages-checks` 결과.

- [ ] **`parser.ts:317` `no-case-declarations`** (신규, 2026-09-01). 로컬 eslint 10.9.1 이
      **내가 건드리지 않은** 파일에서 낸다. CI 는 같은 커밋에서 lint 통과 — 위 항목과 같은
      원인일 가능성이 높아 **묶어서** 본다. 이 PR 에서 고치지 않는다: 원인이 환경이면
      고칠 대상이 아니고, 무관한 파일을 이 changeset 에 끌어들이게 된다.
      [`.claude/docs`](../../.claude/docs) 의 "워크플로가 착지한 것 ≠ 도는 것" 사례와 같은지
