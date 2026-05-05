# Stage 5: Expression Engine - COMPLETED

## 완료 항목

### 패키지: `@workflow/expression-engine`

**Core Pipeline:**
- `tokenizer.ts`: `{{ }}` 구분, 문자열/숫자/연산자/식별자($접두사) 토큰화
- `parser.ts`: 재귀 하강 파서, 9단계 연산자 우선순위
- `evaluator.ts`: AST 트리워크, 깊이 추적, 타임아웃, loose/strict 타입 변환
- `ast.ts`: 14개 AST 노드 타입
- `tokens.ts`: 토큰 타입 enum

**Built-in Functions (55 unique / 56 spec):**
- String (14): length, uppercase, lowercase, trim, contains, startsWith, endsWith, replace, replaceAll, split, join, substring, padStart, padEnd
- Number (10): round, ceil, floor, abs, min, max, parseInt, parseFloat, toFixed, random
- Date (7): formatDate, parseDate, addTime, subtractTime, diffTime, now, today
- Array (9+length): first, last, includes, reverse, flatten, unique, compact, slice, concat
- Object (7): keys, values, entries, hasKey, merge, pick, omit
- Type (8): toString, toNumber, toBoolean, toJSON, fromJSON, typeOf, isEmpty, isNull

**Error Handling:**
- 6 에러 클래스: SYNTAX, REFERENCE, TYPE, FUNCTION, TIMEOUT, DEPTH_EXCEEDED

**Public API:**
- `evaluate(template, context, options?)` → unknown
- `validate(template)` → { valid, errors }

### 검증
- Build: SUCCESS (tsc)
- Tests: 106 passed (22 describe blocks)
- 커버리지: 변수 접근, 문자열 보간, 산술, 비교, 삼항, 멤버/인덱스 접근, 함수 호출, 리터럴, 중첩 표현식, 타입 변환 (loose/strict), null 안전성, 에러 케이스

## 다음: Stage 6 - Workflow Editor (Canvas)
