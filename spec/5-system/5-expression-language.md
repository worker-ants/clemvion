---
id: expression-language
status: partial
pending_plans:
  - plan/in-progress/spec-sync-expression-language-gaps.md
code:
  - codebase/packages/expression-engine/src/**/*.ts
  - codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts
  - codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts
  - codebase/frontend/src/components/editor/expression/*.{ts,tsx}
---

# Spec: 표현식 언어 (Expression Language)

> 관련 문서: [Spec 노드 공통 §3](../3-workflow-editor/1-node-common.md#3-표현식-시스템) · [PRD 워크플로우 에디터](../3-workflow-editor/_product-overview.md#5-노드-설정-패널) · [Spec 실행 엔진](./4-execution-engine.md)

---

## 1. 개요

표현식(Expression)은 노드 설정 필드에서 동적 값을 참조하고 간단한 연산을 수행하기 위한 **읽기 전용 인라인 언어**이다. 복잡한 데이터 변환은 Transform/Code 노드에서 처리하며, 표현식은 **참조 + 경량 연산**에 집중한다.

### 1.1 설계 원칙

| 원칙 | 설명 |
|------|------|
| 읽기 전용 | 외부 상태 변경 불가. 부수 효과(side-effect) 없음 |
| 결정적 | 동일 입력 → 동일 출력 (난수/시간 함수는 실행 시점 고정) |
| 안전 | 무한 루프/재귀 불가. 최대 평가 깊이 제한 |
| 경량 | 100ms 이내 평가 완료 목표 |

---

## 2. 문법 (Grammar)

### 2.1 기본 구조

표현식은 이중 중괄호로 감싼다. 문자열 필드 내에서 텍스트와 혼용 가능하다.

```
정적 텍스트 {{ expression }} 후속 텍스트
```

- 필드 값 전체가 표현식인 경우: `{{ $input.count + 1 }}`
- 문자열 보간(interpolation): `Hello, {{ $input.name }}!`
- 중첩 중괄호 이스케이프: `\{\{` → 리터럴 `{{`

### 2.2 BNF 문법

```bnf
<template>       ::= (<text> | <interpolation>)*
<interpolation>  ::= "{{" <ws> <expression> <ws> "}}"
<text>           ::= (<any-char> - "{{" - "}}")+

<expression>     ::= <ternary>
<ternary>        ::= <or> ("?" <expression> ":" <expression>)?
<or>             ::= <and> ("||" <and>)*
<and>            ::= <equality> ("&&" <equality>)*
<equality>       ::= <comparison> (("==" | "!=") <comparison>)*
<comparison>     ::= <addition> (("<" | ">" | "<=" | ">=") <addition>)*
<addition>       ::= <multiplication> (("+" | "-") <multiplication>)*
<multiplication> ::= <unary> (("*" | "/" | "%") <unary>)*
<unary>          ::= ("!" | "-") <unary> | <postfix>
<postfix>        ::= <primary> (<member-access> | <call> | <index>)*

<member-access>  ::= "." <identifier>
<call>           ::= "(" <arg-list>? ")"
<index>          ::= "[" <expression> "]"
<arg-list>       ::= <expression> ("," <expression>)*

<primary>        ::= <number> | <string> | <boolean> | <null>
                   | <identifier> | <array-literal> | <object-literal>
                   | "(" <expression> ")"

<array-literal>  ::= "[" (<expression> ("," <expression>)*)? "]"
<object-literal> ::= "{" (<key-value> ("," <key-value>)*)? "}"
<key-value>      ::= (<string> | <identifier>) ":" <expression>

<identifier>     ::= "$" <name> | <name>
<name>           ::= [a-zA-Z_] [a-zA-Z0-9_]*
<number>         ::= [0-9]+ ("." [0-9]+)?
<string>         ::= '"' <string-char>* '"' | "'" <string-char>* "'"
<boolean>        ::= "true" | "false"
<null>           ::= "null"
<ws>             ::= [ \t\n\r]*
```

### 2.3 연산자 우선순위 (높은 순)

| 순위 | 연산자 | 결합 방향 | 설명 |
|------|--------|-----------|------|
| 1 | `.` `[]` `()` | 좌 | 멤버 접근, 인덱스, 함수 호출 |
| 2 | `!` `-` (단항) | 우 | 논리 부정, 음수 |
| 3 | `*` `/` `%` | 좌 | 곱셈, 나눗셈, 나머지 |
| 4 | `+` `-` | 좌 | 덧셈, 뺄셈, 문자열 연결 |
| 5 | `<` `>` `<=` `>=` | 좌 | 비교 |
| 6 | `==` `!=` | 좌 | 동등 비교 (느슨하지 않음, strict) |
| 7 | `&&` | 좌 | 논리 AND (단축 평가) |
| 8 | `\|\|` | 좌 | 논리 OR (단축 평가) |
| 9 | `? :` | 우 | 삼항 조건 |

---

## 3. 타입 시스템

### 3.1 지원 타입

| 타입 | 설명 | 리터럴 예시 |
|------|------|-------------|
| String | 문자열 | `"hello"`, `'world'` |
| Number | 64비트 부동소수점 | `42`, `3.14`, `-1` |
| Boolean | 참/거짓 | `true`, `false` |
| Null | 없는 값 | `null` |
| Array | 순서 배열 | `[1, 2, 3]` |
| Object | 키-값 맵 | `{ "a": 1, "b": 2 }` |

### 3.2 타입 강제 변환 규칙 (기본 모드 — 느슨한 변환)

기본적으로 표현식 평가 시 아래 느슨한(loose) 변환 규칙을 적용한다. Strict 모드에 대해서는 §3.2.1을 참조한다.

| 연산 | 규칙 |
|------|------|
| `+` (String 포함) | 다른 피연산자를 String으로 변환 후 연결 |
| `+` (Number + Number) | 산술 덧셈 |
| `-` `*` `/` `%` | 양쪽을 Number로 변환. 변환 불가 시 에러 |
| `==` `!=` | 아래 세부 규칙 참조 |
| `<` `>` `<=` `>=` | 아래 세부 규칙 참조 |
| `&&` `\|\|` | Falsy 평가 (`false`, `null`, `0`, `""`, `[]` → falsy) |
| `!` | Boolean 변환 후 부정 |

**타입별 세부 변환 규칙:**

| 변환 대상 | 규칙 |
|-----------|------|
| 문자열 ↔ 숫자 | 숫자 형식 문자열(예: `"42"`, `"3.14"`)은 숫자로 변환 후 비교. 변환 불가 시 문자열 비교(사전순) |
| null / undefined | `eq`/`neq`에서만 비교 가능. `null == undefined` → `true`, `null == 0` → `false`. `gt`/`lt`/`gte`/`lte` 연산에서는 항상 `false` |
| Boolean | `true` → `1` (Number) / `"true"` (String), `false` → `0` (Number) / `"false"` (String). 비교 시 숫자 변환 우선 |
| 배열 / 객체 | `eq`/`neq`는 deep equality 비교. `gt`/`lt`/`gte`/`lte` 연산은 불가 → `EXPR_TYPE_ERROR` 에러 |
| is_empty 판정 | `null`, `undefined`, `""` (빈 문자열), `[]` (빈 배열), `{}` (빈 객체) → 모두 empty. `0`, `false`는 empty가 아님 |

#### 3.2.1 Strict 모드

조건 노드(If/Else, Switch)의 config에서 `strictComparison: true`로 설정하면 strict 모드가 적용된다 (기본: `false`).

| 항목 | 설명 |
|------|------|
| 동작 | 타입 자동 변환을 수행하지 않음. 피연산자 타입이 다르면 `eq` → `false`, `neq` → `true`, 그 외 비교 연산 → `false` |
| 예시 | `"42" == 42` → strict 모드에서는 `false` (기본 모드에서는 `true`) |
| 적용 범위 | `strictComparison`이 설정된 노드의 조건 평가에만 적용. 다른 노드의 표현식 평가에는 영향 없음 |

> 참조: [Logic 공통 §1 ConditionGroup](../4-nodes/1-logic/0-common.md#1-conditiongroup-구조), [If/Else](../4-nodes/1-logic/1-if-else.md), [Switch](../4-nodes/1-logic/2-switch.md)

### 3.3 Null 안전 접근

- `$input.user.name`: `$input.user`가 null이면 → **에러 발생**
- **Optional chaining `?.` 지원** — 중간 값이 `null`/`undefined`면 체인 전체가 `null`로 short-circuit 된다.
    - 멤버: `{{ $input.user?.name }}` — `user`가 null이면 결과 `null`
    - 인덱스: `{{ $input.items?.[0] }}` — `items`가 null이면 결과 `null`
    - 체인 전체 단락: `{{ $input.user?.profile.age }}` — `user`가 null이면 `.profile.age`는 throw하지 않고 결과 `null` (JS 의미론과 동일)
- 삼항 연산도 여전히 사용 가능: `{{ $input.user ? $input.user.name : "unknown" }}`
- `??` (nullish coalescing)은 현재 지원하지 않으며 `||`로 대체 가능

---

## 4. 내장 참조 변수

### 4.1 변수 목록

| 참조 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `$input` | Object | 직전 연결 노드의 출력 데이터 | `{{ $input.email }}` |
| `$params` | Object | `$input.parameters` 단축 참조 (input 의 `parameters` 객체) | `{{ $params.userId }}` |
| `$node["이름"]` | Object | 특정 노드의 실행 결과. `.output`(출력 데이터) 외에 `.config`·`.meta`·`.port`·`.status` 접근 가능. UUID로도 접근 가능 | `{{ $node["Fetch User"].output.id }}` |
| `$var` | Object | 워크플로우 선언 변수 | `{{ $var.counter }}` |
| `$execution` | Object | 현재 실행 컨텍스트 | `{{ $execution.id }}` |
| `$now` | String | 현재 타임스탬프 (ISO 8601, UTC) | `{{ $now }}` |
| `$env` | Object | 환경 변수 (셀프 호스팅) — **미구현 (Planned)**. 엔진 타입·에디터 자동완성에는 노출되나 실행 엔진의 컨텍스트 빌더가 아직 주입하지 않음 | `{{ $env.API_URL }}` |
| `$loop` | Object | Loop 노드 내부 컨텍스트 | `{{ $loop.index }}` |
| `$item` | Object/Any | ForEach 현재 항목 | `{{ $item.name }}` |
| `$itemIndex` | Number | ForEach 현재 인덱스 | `{{ $itemIndex }}` |
| `$trigger` | Object | 트리거 데이터 (webhook payload 등) — **미구현 (Planned)**. 엔진 타입·에디터 자동완성에는 노출되나 실행 엔진의 컨텍스트 빌더가 아직 주입하지 않음 | `{{ $trigger.body.event }}` |
| `$thread` | Object | Conversation Thread 변수 — 사용자 인터랙션 + AI 대화 turn 누적. [§4.4](#44-thread-속성) | `{{ $thread.length }}` |

> **Table 노드 한정 컨텍스트**: Table 노드의 컬럼 표현식 평가 시 추가로 `$sourceItem`(현재 행 항목), `$sourceItemIndex`(행 인덱스), `$dataSource`(원본 데이터 배열)가 주입된다.

### 4.2 `$execution` 속성

| 속성 | 타입 | 설명 |
|------|------|------|
| `id` | String | 실행 UUID |
| `startedAt` | String | 실행 시작 시각 (ISO 8601) |
| `mode` | String | 실행 모드 (`manual`, `webhook`, `schedule`) |
| `workflowId` | String | 워크플로우 UUID |

### 4.3 `$loop` 속성

| 속성 | 타입 | 설명 |
|------|------|------|
| `index` | Number | 현재 반복 인덱스 (0-based) |
| `iteration` | Number | 현재 반복 횟수 (1-based) |
| `isFirst` | Boolean | 첫 번째 반복 여부 |
| `isLast` | Boolean | 마지막 반복 여부 |

### 4.4 `$thread` 속성

ConversationThread 의 readonly 뷰. AI Agent 노드의 `contextScope` 자동 주입과는 독립적으로 사용자가 명시 참조 가능 ([Spec Conversation Thread](../conventions/conversation-thread.md)).

| 속성 | 타입 | 설명 |
|------|------|------|
| `turns` | Array | ConversationTurn[] readonly snapshot |
| `length` | Number | turn 개수 |
| `text` | String | system_text 렌더 결과 (모든 turn 헤더 + 본문) |

> v1 은 단순 indexing 만 노출. `$thread.last(n)` / `$thread.byNode(name)` 같은 메서드 callable 은 v2 에서 추가 검토.
> 백엔드 실행 엔진은 `$thread` 를 주입하지만, 에디터 자동완성 루트 변수 목록(`ROOT_VARIABLES`)에는 아직 `$thread` 가 포함되지 않는다 (자동완성 노출은 Planned).

예시:
- `{{ $thread.length }}` — 누적 turn 개수
- `{{ $thread.text }}` — 전체 thread 를 텍스트로 첨부 (예: `transform` 노드에서 가공)
- `{{ $thread.turns[0].data.email }}` — 첫 turn 의 form 데이터 필드 (turn.source 가 `presentation_user` 일 때 유효)

---

## 5. 내장 함수

### 5.1 문자열 함수

| 함수 | 시그니처 | 설명 | 예시 |
|------|----------|------|------|
| `length` | `length(str) → Number` | 문자열 길이 | `{{ length($input.name) }}` |
| `uppercase` | `uppercase(str) → String` | 대문자 변환 | `{{ uppercase("hello") }}` → `"HELLO"` |
| `lowercase` | `lowercase(str) → String` | 소문자 변환 | `{{ lowercase("Hello") }}` → `"hello"` |
| `trim` | `trim(str) → String` | 앞뒤 공백 제거 | `{{ trim("  hi  ") }}` → `"hi"` |
| `contains` | `contains(str, sub) → Boolean` | 부분 문자열 포함 여부 | `{{ contains($input.email, "@") }}` |
| `startsWith` | `startsWith(str, prefix) → Boolean` | 접두사 일치 | `{{ startsWith($input.url, "https") }}` |
| `endsWith` | `endsWith(str, suffix) → Boolean` | 접미사 일치 | `{{ endsWith($input.file, ".pdf") }}` |
| `replace` | `replace(str, search, replacement) → String` | 첫 번째 일치 치환 | `{{ replace($input.text, "old", "new") }}` |
| `replaceAll` | `replaceAll(str, search, replacement) → String` | 전체 일치 치환 | `{{ replaceAll($input.csv, ",", ";") }}` |
| `split` | `split(str, separator) → Array` | 문자열 분할 | `{{ split("a,b,c", ",") }}` → `["a","b","c"]` |
| `join` | `join(arr, separator) → String` | 배열 결합 | `{{ join(["a","b"], "-") }}` → `"a-b"` |
| `substring` | `substring(str, start, end?) → String` | 부분 문자열 | `{{ substring($input.code, 0, 3) }}` |
| `padStart` | `padStart(str, length, char?) → String` | 좌측 패딩 | `{{ padStart("5", 3, "0") }}` → `"005"` |
| `padEnd` | `padEnd(str, length, char?) → String` | 우측 패딩 | — |

### 5.2 숫자 함수

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `round` | `round(num, decimals?) → Number` | 반올림 |
| `ceil` | `ceil(num) → Number` | 올림 |
| `floor` | `floor(num) → Number` | 내림 |
| `abs` | `abs(num) → Number` | 절대값 |
| `min` | `min(a, b, ...) → Number` | 최솟값 |
| `max` | `max(a, b, ...) → Number` | 최댓값 |
| `parseInt` | `parseInt(str) → Number` | 정수 변환 |
| `parseFloat` | `parseFloat(str) → Number` | 실수 변환 |
| `toFixed` | `toFixed(num, digits) → String` | 소수점 자릿수 고정 |
| `random` | `random() → Number` | 0~1 난수 (실행 시점 고정) |

### 5.3 날짜/시간 함수

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `formatDate` | `formatDate(dateStr, pattern) → String` | 날짜 포매팅 |
| `parseDate` | `parseDate(str, pattern?) → String` | 문자열→ISO 8601 파싱 |
| `addTime` | `addTime(dateStr, amount, unit) → String` | 시간 더하기 |
| `subtractTime` | `subtractTime(dateStr, amount, unit) → String` | 시간 빼기 |
| `diffTime` | `diffTime(date1, date2, unit) → Number` | 두 날짜 차이 |
| `now` | `now() → String` | 현재 시각 (ISO 8601) |
| `today` | `today() → String` | 오늘 날짜 (YYYY-MM-DD) |

**날짜 포맷 패턴 (dayjs 호환):**

| 토큰 | 설명 | 예시 |
|------|------|------|
| `YYYY` | 4자리 연도 | 2026 |
| `MM` | 2자리 월 | 03 |
| `DD` | 2자리 일 | 29 |
| `HH` | 24시간 시 | 14 |
| `mm` | 분 | 30 |
| `ss` | 초 | 05 |
| `ddd` | 요일 약어 | Mon |

**시간 단위:** `years`, `months`, `days`, `hours`, `minutes`, `seconds`

### 5.4 배열 함수

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `length` | `length(arr) → Number` | 배열 길이 (문자열과 오버로드) |
| `first` | `first(arr) → Any` | 첫 번째 요소 |
| `last` | `last(arr) → Any` | 마지막 요소 |
| `includes` | `includes(arr, value) → Boolean` | 요소 포함 여부 |
| `reverse` | `reverse(arr) → Array` | 역순 배열 (원본 불변) |
| `flatten` | `flatten(arr) → Array` | 1단계 평탄화 |
| `unique` | `unique(arr) → Array` | 중복 제거 |
| `compact` | `compact(arr) → Array` | null/undefined 제거 |
| `slice` | `slice(arr, start, end?) → Array` | 부분 배열 |
| `concat` | `concat(arr1, arr2) → Array` | 배열 합치기 |

### 5.5 객체 함수

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `keys` | `keys(obj) → Array` | 키 목록 |
| `values` | `values(obj) → Array` | 값 목록 |
| `entries` | `entries(obj) → Array` | [key, value] 쌍 배열 |
| `hasKey` | `hasKey(obj, key) → Boolean` | 키 존재 여부 |
| `merge` | `merge(obj1, obj2) → Object` | 객체 병합 (obj2 우선) |
| `pick` | `pick(obj, keys) → Object` | 지정 키만 추출 |
| `omit` | `omit(obj, keys) → Object` | 지정 키 제외 |

### 5.6 타입 변환 함수

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `toString` | `toString(value) → String` | 문자열 변환 |
| `toNumber` | `toNumber(value) → Number` | 숫자 변환 (실패 시 에러) |
| `toBoolean` | `toBoolean(value) → Boolean` | 불리언 변환 |
| `toJSON` | `toJSON(value) → String` | JSON 문자열화 |
| `fromJSON` | `fromJSON(str) → Any` | JSON 파싱 |
| `typeOf` | `typeOf(value) → String` | 타입 이름 반환 |
| `isEmpty` | `isEmpty(value) → Boolean` | 빈 값 판정 (null, "", [], {}) |
| `isNull` | `isNull(value) → Boolean` | null 여부 |

---

## 6. 에러 처리

### 6.1 표현식 에러 유형

| 에러 코드 | 설명 | 예시 |
|-----------|------|------|
| `EXPR_SYNTAX_ERROR` | 문법 오류 | `{{ $input. }}` (불완전한 멤버 접근) |
| `EXPR_REFERENCE_ERROR` | 존재하지 않는 참조 | `{{ $input.nonExistent.field }}` (null 접근) |
| `EXPR_TYPE_ERROR` | 타입 불일치 연산 | `{{ "hello" - 1 }}` |
| `EXPR_FUNCTION_ERROR` | 함수 호출 오류 | `{{ unknownFn() }}` |
| `EXPR_TIMEOUT` | 평가 시간 초과 | 복잡한 중첩 표현식 |
| `EXPR_DEPTH_EXCEEDED` | 중첩 깊이 초과 | 100단계 이상 중첩 |

### 6.2 에러 동작

| 맥락 | 동작 |
|------|------|
| **노드 설정 필드** | 표현식 에러 → 해당 노드 실행 실패 → 노드 에러 처리 정책 적용 |
| **에디터 미리보기** | 빨간 밑줄 + 인라인 에러 메시지 (실행 차단 안 함) |
| **If/Else 조건** | 조건 평가 에러 → 노드 실행 실패 (false가 아님) |

### 6.3 평가 제한

| 항목 | 제한 |
|------|------|
| 최대 평가 시간 | 100ms |
| 최대 중첩 깊이 | 100 |
| 최대 표현식 길이 | 10,000 자 |
| 최대 문자열 결과 크기 | 1MB |

---

## 7. 자동완성 (에디터 지원)

### 7.1 트리거 조건

| 트리거 | 동작 |
|--------|------|
| `{{` 입력 | 최상위 참조 변수 목록 표시 (`$input`, `$var`, `$node`, ...) |
| `$input.` 입력 | 직전 노드 출력 스키마 기반 필드 목록 |
| `$node["` 입력 | 현재 워크플로우의 노드 이름 목록 |
| `$var.` 입력 | 워크플로우에서 선언된 변수 목록 |
| 함수 이름 일부 입력 | 매칭되는 내장 함수 목록 + 시그니처 |

### 7.2 자동완성 데이터 소스

| 소스 | 생성 시점 |
|------|-----------|
| 노드 출력 스키마 | 마지막 실행 결과에서 추론. 미실행 시 노드 유형의 기본 스키마 사용 |
| 변수 목록 | 워크플로우 내 Variable Declaration 노드에서 추출 |
| 노드 목록 | 현재 워크플로우의 모든 노드 라벨 |
| 함수 목록 | 내장 함수 레지스트리 (정적) |

---

## 8. 구현 전략

### 8.1 파서/평가기 구조

```
소스 문자열 → Tokenizer → Token[] → Parser → AST → Evaluator → 결과 값
```

| 단계 | 설명 |
|------|------|
| Tokenizer | 문자열을 토큰(숫자, 문자열, 연산자, 식별자 등)으로 분해 |
| Parser | 토큰 배열을 AST(Abstract Syntax Tree)로 변환. 재귀 하강 파서 |
| Evaluator | AST를 순회하며 컨텍스트 바인딩으로 값을 계산 |

### 8.2 프론트엔드/백엔드 공유

- 파서/평가기는 **JavaScript/TypeScript**로 구현하여 프론트엔드(에디터 미리보기)와 백엔드(실행 엔진) 양쪽에서 사용
- npm 패키지로 분리하여 공유 (`@workflow/expression-engine`)

### 8.3 실행 엔진 통합

#### 8.3.1 ExpressionResolverService

백엔드 실행 엔진의 `ExpressionResolverService`가 노드 실행 전 config 객체의 표현식을 해석한다.

```
buildExpressionContext(input, executionContext, nodeMap) → resolveConfig(config, exprContext, nodeType) → (노드 핸들러 execute 로 전달)
```

- 구문 검증용 `validate()`는 이 서비스가 아니라 공유 엔진 패키지(`@workflow/expression-engine`)가 제공한다.
- `resolveConfig`의 세 번째 인자는 `nodeType`(문자열)이며, 이를 키로 `EXPRESSION_EXCLUSIONS`에서 제외 키 집합을 조회한다 (§8.3.3).
- config 객체를 재귀 순회하며 문자열 값의 `{{ }}` 패턴을 `evaluate()`로 평가
- 전체가 `{{ expr }}`인 경우: 평가 결과의 원래 타입 유지 (number, object, array 등)
- 혼합 텍스트 + 표현식 (`"Hello {{ $input.name }}!"`): 결과는 항상 string
- number, boolean, null 값: 패스스루 (해석 대상 아님)
- 1회 패스만 수행 — 평가 결과에 `{{ }}`가 있어도 재평가하지 않음
- config 구조 깊이 제한: 10단계

#### 8.3.2 $node 라벨-출력 매핑

`$node["Label"].output` 참조를 지원하기 위해, 실행 시점에 `nodeMap` (노드 ID → 노드 엔티티)과 `nodeOutputCache` (노드 ID → 출력)를 조합하여 라벨 키 맵을 생성한다:

```typescript
// 라벨 중복 구분 + UUID 폴백 등록
const disambiguatedKeys = buildDisambiguatedKeys(nodesWithOutput);
for (const { id, label } of nodesWithOutput) {
  const resolvedKey = disambiguatedKeys.get(id);
  $node[resolvedKey] = { output: nodeOutputCache[id] };
  $node[id] = { output: nodeOutputCache[id] }; // UUID 폴백
}
```

- 위상 정렬 순서로 실행되므로, 현재 노드에서 참조하는 노드는 항상 이미 실행 완료된 상태
- **노드 라벨 유니크 정책**: 워크플로우 내 노드 라벨은 고유해야 한다. 노드 생성/이름변경/캔버스 저장 시 중복이 차단된다.
- **중복 라벨 안전장치**: 만약 동일 라벨이 존재하는 경우, 실행 순서에 따라 `#N` 접미사로 자동 구분된다. 첫 번째 노드는 원본 라벨, 이후 노드는 `Label#2`, `Label#3` 형식.
- **UUID 폴백**: 모든 노드는 `$node["<nodeId>"]` 형식으로도 접근 가능하다. UUID 기반 참조는 라벨 변경에 영향받지 않는 안정적 참조 방식이다.

#### 8.3.3 핸들러별 제외 규칙

| 핸들러 | 제외 키 | 사유 |
|--------|---------|------|
| `code` | `code` | 원시 JavaScript 코드. 자체 런타임(`$input`, `$vars`, `$execution`)으로 실행 |
| `table` | `columns` | 컬럼 표현식은 행(item)마다 `TableHandler` 내부에서 개별 평가된다 (`$sourceItem` 등 행 컨텍스트 사용) |
| `filter` | `conditions` | 조건은 표현식이 아니라 각 배열 항목 기준의 필드 경로다 |
| `loop` | `breakCondition` | 반복마다 재평가되어야 한다 (현재 `$loop`/`$var`/`$node[...]` 참조). dispatch 시점에 미리 해석하면 i=0 에 고정되고 첫 반복 전엔 `$loop` 가 undefined 라 에러가 난다 |

그 외 모든 핸들러의 config 문자열 필드는 표현식 해석 대상이다 (`template` 핸들러의 `template` 필드 포함 — 별도 제외 규칙 없음).

> 제외 규칙의 단일 진실원은 `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts` 의 `EXPRESSION_EXCLUSIONS` 다.

### 8.4 에디터 표현식 입력

#### 8.4.1 ExpressionInput 컴포넌트

노드 설정 패널의 텍스트 입력 필드를 Expression-aware 입력으로 교체한다:

- `{{ }}` 블록 구문 하이라이트 (배경 오버레이)
- `validate()` 함수로 실시간 구문 검증 (빨간 밑줄 + 에러 메시지)

#### 8.4.2 자동완성

`{{` 입력 시 자동완성 팝업이 표시된다:

| 트리거 | 제안 내용 | 데이터 소스 |
|--------|-----------|-------------|
| `$input.` | 직전 노드 출력 필드 목록 | 마지막 실행 결과의 outputData 키 |
| `$node["` | 워크플로우 내 노드 라벨 목록 (노드 선택 드롭다운) | editor store의 nodes |
| `$node["Label"].output.` | 해당 노드의 출력 필드 목록 | 해당 노드의 마지막 실행 결과 |
| `$var.` | 선언된 변수 목록 | Variable Declaration 노드의 config |
| 함수명 입력 | 매칭 내장 함수 + 시그니처 | 함수 레지스트리 (정적) |
| 표현식 시작 | `$input`, `$node`, `$var`, `$execution`, ... | 내장 참조 변수 목록 |

- 미실행 워크플로우: 함수명과 `$` 변수 카테고리만 제안, 필드 제안은 "(워크플로우를 먼저 실행하세요)" 힌트 표시
- 화살표 키 네비게이션, Enter/Tab 선택, Escape 닫기

### 8.5 보안 고려사항

| 위협 | 대응 |
|------|------|
| 코드 인젝션 | `eval` 사용 금지. 자체 파서/평가기만 사용 |
| DoS (복잡한 표현식) | 평가 시간 제한 (100ms) + 중첩 깊이 제한 (100) |
| 데이터 유출 | `$env`는 셀프 호스팅에서만 허용 목록 기반 노출 |
| 재귀 해석 공격 | 1회 패스만 수행. 평가 결과에 `{{ }}`가 있어도 재평가 안 함 |
