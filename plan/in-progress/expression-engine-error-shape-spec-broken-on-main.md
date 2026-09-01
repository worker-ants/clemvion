---
title: "`expression-engine/error-shape.spec.ts` 가 main 에서 컴파일 실패 — unit 스테이지 상시 FAIL"
worktree: .claude/worktrees/audit-record-factory
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

## 선재임을 어떻게 확정했나

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

- [ ] `error-shape.spec.ts` 의 열거 대상을 에러 클래스로 좁히고 전수성 단언을 분리
- [ ] `run-test.sh unit` 이 이 잡을 통과하는지 확인 (수정 전 RED → 수정 후 GREEN 실측 기록)
- [ ] main 에서 이 스테이지가 언제부터 깨졌는지 CI 이력과 대조 —
      [`.claude/docs`](../../.claude/docs) 의 "워크플로가 착지한 것 ≠ 도는 것" 사례와 같은지
