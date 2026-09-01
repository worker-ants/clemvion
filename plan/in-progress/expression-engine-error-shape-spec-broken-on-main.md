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
> | CI `packages-checks` @ `8ff827ef6`(도입 커밋) — `Test (jest)` 스텝 | **실제로 실행됐고 success** |
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
> **도입 커밋 귀속도 틀렸었다** (리뷰 1R W4). 나는 `8ff827ef6` 대신 그 다음 커밋을 적었는데,
> 그 커밋이 이 파일에 한 일은 **주석 7줄 추가**가 전부다(`git show --stat` 실측) — 타입 에러를
> 만들 수 없다. 파일 신설은 `git log --diff-filter=A` 로 `8ff827ef6`(#1233) 임을 확인했다.
> **"실측으로 정정한다" 는 이 배너 안에서 인접한 미검증 사실을 그대로 재인용해 강화한 것**이라
> 더 나쁘다. 두 커밋 모두 CI 에서 `Test (jest)` 가 **실행되고 통과**했으므로 로컬-CI 차이라는
> 결론 자체는 바뀌지 않는다.
>
> **그래서 제목의 "broken on main" 은 과하다.** main 의 CI 는 이 잡을 통과한다 — 단
> **돌 때만** 그렇다(아래 §CI 관측 참조).

## CI 관측 — green 이 "테스트가 통과했다" 를 뜻하지 않았다

`packages-checks.yml` 은 skip-job 패턴이다: `codebase/packages/**` 변경이 없으면
`relevant=false` 로 **모든 스텝을 skip 하고 잡을 success 로 보고**한다.

`8ff827ef6`(#1233)이 `codebase/packages/` 를 건드린 **마지막** 커밋이다. 그 뒤 #1258·#1259·
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
도입 커밋은 `8ff827ef6` (#1233) — 이 spec 파일을 신설한 커밋이다.

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
      도입 커밋 `8ff827ef6` 이 그 경로를 건드린 마지막 커밋이다. 자세한 것은 §CI 관측.

- [ ] **`plan/complete/**` 가 상대링크 가드 범위 밖이다** (리뷰 1R W3 파생). plan 을
      `complete/` 로 옮길 때 **그 문서 자신의 outgoing 링크**가 재계산되지 않고, 가드도 그
      디렉터리를 안 본다 — 이번에 실제로 죽은 링크를 하나 만들었고 docs 가드 3119 는 초록이었다.
      `plan-lifecycle.md` 이동 절차에 "이동 문서의 outgoing 링크 재계산" 을 넣거나 가드 범위를
      넓히는 것이 처방이다. **미조치이며 우선순위 판단** — harness 규약 변경이라 이 changeset
      (패키지 lint·타입)과 성격이 다르다.

- [ ] **로컬-CI 차이 — 신호는 하나뿐이었다 (2026-09-01 정정).**
      ~~CI 는 test·lint 둘 다 통과하고 로컬은 둘 다 실패한다~~ — **lint 쪽은 툴체인 차이가
      아니었다.** 원인은 패키지 스크립트의 **따옴표 없는 글롭**(`eslint src/**/*.ts`)이고,
      `sh` 가 `**` 를 재귀 확장하지 않아 최상위 `src/*.ts` 가 통째로 빠지고 있었다. 내가 수동으로
      친 `npx eslint .` 이 우연히 재귀 확장을 해서 드러난 것이다. **이 PR 에서 6개 패키지를
      고쳤다**(사각지대 18파일, 대조군으로 실증).

      **남는 미해결은 test 하나뿐이다.** 같은 커밋·같은 lockfile 에서 CI 는 `Test (jest)` 를
      실행해 통과(`8ff827ef6`·`4afab7ca1` 양쪽 확인)하는데 로컬은 Node 22·24 모두 실패한다.
      유력 가설은 설치 방식 — CI 는 `--filter '<pkg>...'` 서브트리 설치, 로컬은 전체
      워크스페이스.

      **1차 판정 결과 (2026-09-01, PR #1261 · run 33504009526): 판별되지 않았다.**
      CI 는 실제로 돌았고(`Lint`·`Test (jest)`·`Build` 전부 success — skip 스텝이 `skipped`)
      **고쳐진 코드를 통과시켰다.** 원본이 CI 에서 실패했을지는 여전히 모른다.

      **내 검증 설계의 결함이다.** "CI 가 답을 준다" 고 적어 놓고 **수정과 프로브를 같은
      커밋에 넣었다** — 판별할 입력(원본 술어)을 내가 제거한 뒤 CI 를 돌린 것이라, 이 실행은
      "고친 코드가 CI 를 통과한다" 만 말한다. 가르려면 **원본 술어를 유지한 실행**이 있어야
      했다.

      다음에 판별하려면: 원본 술어만 담은 브랜치를 따로 push 해 `packages-checks` 를 돌리거나,
      로컬에서 CI 와 같은 방식(`pnpm install --filter '@workflow/expression-engine...'`)으로
      설치한 트리에서 원본을 돌린다. 후자가 PR 을 만들지 않아 싸다.
      재개 신호: 같은 클래스(로컬만 실패)가 다른 패키지에서 또 나올 때.

- [x] **`parser.ts:317` `no-case-declarations` — 이 PR 에서 해소 (2026-09-01).**
      ~~이 PR 에서 고치지 않는다: 원인이 환경이면 고칠 대상이 아니다.~~ **판단의 전제가
      틀렸다.** 원인은 환경이 아니라 **lint 글롭 버그**였다 — 아래 항목 참조. 위반은 실재하고
      아무 데서도 검사되지 않고 있었으므로 고치는 것이 맞다. `case` 에 `const` 를 중괄호 없이
      둔 것을 블록으로 감쌌다(`case` 는 스코프를 만들지 않아 형제 `case` 에서도 보이고 TDZ 에
      걸린다). lint 0 에러 확인.
      [`.claude/docs`](../../.claude/docs) 의 "워크플로가 착지한 것 ≠ 도는 것" 사례와 같은지
