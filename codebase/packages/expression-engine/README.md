# @workflow/expression-engine

워크플로우 표현식 언어(`{{ ... }}`) 의 tokenizer / parser / AST evaluator. 백엔드와 프론트엔드가 같은 평가 의미를 공유하기 위한 SSOT 패키지다.

스펙: [`spec/5-system/5-expression-language.md`](../../../spec/5-system/5-expression-language.md)

## 빌드

```bash
npm run build           # tsc 로 dist/ 생성
npm run watch           # 변경 감시
npm test                # jest 단위 테스트
```

`codebase/backend` 와 `codebase/frontend` 가 workspace dep 로 참조하므로 두 앱을 실행하기 전에 본 패키지가 한 번 build 되어 있어야 한다. 모노레포 루트에서 `make build` 또는 `npm -w @workflow/expression-engine run build` 로 일괄 처리한다.

## 사용

```ts
import { evaluate } from '@workflow/expression-engine';

const result = evaluate('{{ $input.name }}', {
  $input: { name: 'world' },
});
```

`evaluate` 는 부분 표현식(`Hello {{ name }}`) 과 단독 표현식(`{{ $now.iso }}`) 모두 처리한다.

## 주요 export

| Symbol | 설명 |
|--------|------|
| `evaluate(template, context, options?)` | 진입점. 문자열 템플릿 → 평가 결과 |
| `ExpressionContext` | `$input` · `$node` · `$var` · `$now` · `$item` · `$loop` · `$user` 등 표준 컨텍스트 타입 |
| `ExpressionError` / `ErrorCode` | 평가 실패 시 throw 되는 에러와 분류 코드 |
| `ASTNode` | 외부에서 AST 를 다루는 도구가 참조 |

## 의존성·boundary

- **Node-only**: 빌드 아티팩트는 ESM/CJS 양쪽으로 emit 하지만, 외부 의존 코드는 plain TS 만 사용. `liquidjs` 등 외부 평가 엔진은 사용하지 않는다 (샌드박스 invariant 보존).
- **Single direction**: `@workflow/node-summary` · `codebase/backend` · `codebase/frontend` 가 본 패키지를 참조한다. 본 패키지는 다른 `codebase/packages/*` 를 참조하지 않는다.
