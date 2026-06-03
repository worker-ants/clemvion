---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# expression-language — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/5-expression-language.md

## 미구현 항목
- [ ] `$trigger` 런타임 주입 — `ExpressionResolverService.buildExpressionContext` 가 `$trigger` 를 컨텍스트에 주입하지 않음. 엔진 타입(`ExpressionContext.$trigger`)·에디터 자동완성(`ROOT_VARIABLES`)에는 노출되어, 사용자가 입력하면 실행 시 undefined/참조 에러로 이어질 수 있음.
- [ ] `$env` 런타임 주입 — 동일하게 `buildExpressionContext` 가 `$env`(셀프 호스팅 환경 변수)를 주입하지 않음. 엔진 타입·에디터 자동완성에만 존재.
- [ ] `$thread` 에디터 자동완성 노출 — 백엔드는 `$thread` 를 주입하나 프론트 `expression-constants.ts` 의 `ROOT_VARIABLES` 에 누락되어 자동완성/variable picker 에서 제안되지 않음.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__5-expression-language.md 참조.
- 재검증 근거:
  - `codebase/backend/.../expression/expression-resolver.service.ts` `buildExpressionContext` 반환 객체에 `$trigger`/`$env` 키 없음.
  - `codebase/packages/expression-engine/src/evaluator.ts` `ExpressionContext` 에는 `$trigger?`/`$env?` 선언 존재 (평가는 지원).
  - `codebase/frontend/src/components/editor/expression/expression-constants.ts` `ROOT_VARIABLES` 에 `$trigger`/`$env` 는 있으나 `$thread` 는 없음.
