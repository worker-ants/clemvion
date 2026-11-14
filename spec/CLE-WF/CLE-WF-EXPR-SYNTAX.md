---
id: "CLE-WF-EXPR-SYNTAX"
title: "표현식 언어 — 문법 · 타입 · 함수"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-EXPR"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-EXPR"]
area: "CLE-WF"
content_hash: "1f22aa5b694a52d304c60cc962232d5a829a64a67df3c9fa0e0b3410cc38ffc9"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "72970214ad1d304225492f5fcd4d00f41f32fa8b39da788297f9985ba7bedba5"
etag: "sha256-4ef734fb62d7e2eb12027842f3bcc9a81e275d15bc2fe62a1e98acda31c55f10"
---
## 개요

이 문서는 [표현식 언어](CLE-WF-EXPR.md) 의 하위 문서로 표현식의 문법 · 타입 시스템 · 내장 함수 · 에러 코드와 평가 제한을 정한다. 요구사항과 미결 사항은 부모 문서에 있다.

## 문법

### 기본 구조

표현식은 이중 중괄호로 감싼다. 문자열 필드 안에서 텍스트와 섞어 쓸 수 있다.

```
정적 텍스트 {{ expression }} 후속 텍스트
```

- 필드 값 전체가 표현식인 경우: `{{ $input.count + 1 }}`
- 문자열 보간: `Hello, {{ $input.name }}!`
- 중괄호 이스케이프: `\{\{` 는 리터럴 `{{` 가 된다.

### BNF

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

### 연산자 우선순위

높은 순서다.

| 순위 | 연산자 | 결합 방향 | 설명 |
| --- | --- | --- | --- |
| 1 | `.` `[]` `()` | 왼쪽 | 멤버 접근, 인덱스, 함수 호출 |
| 2 | `!` `-`(단항) | 오른쪽 | 논리 부정, 음수 |
| 3 | `*` `/` `%` | 왼쪽 | 곱셈, 나눗셈, 나머지 |
| 4 | `+` `-` | 왼쪽 | 덧셈, 뺄셈, 문자열 연결 |
| 5 | `<` `>` `<=` `>=` | 왼쪽 | 비교 |
| 6 | `==` `!=` | 왼쪽 | 동등 비교(느슨하지 않은 strict) |
| 7 | `&&` | 왼쪽 | 논리 AND(단축 평가) |
| 8 | `\|\|` | 왼쪽 | 논리 OR(단축 평가) |
| 9 | `? :` | 오른쪽 | 삼항 조건 |

## 타입 시스템

### 지원 타입

| 타입 | 설명 | 리터럴 예 |
| --- | --- | --- |
| String | 문자열 | `"hello"`, `'world'` |
| Number | 64비트 부동소수점 | `42`, `3.14`, `-1` |
| Boolean | 참·거짓 | `true`, `false` |
| Null | 값 없음 | `null` |
| Array | 순서 있는 배열 | `[1, 2, 3]` |
| Object | 키-값 맵 | `{ "a": 1, "b": 2 }` |

### 타입 변환 규칙(기본 모드)

기본 모드는 느슨한(loose) 변환 규칙을 쓴다. Strict 모드는 [Strict 모드](#strict-모드) 참조.

| 연산 | 규칙 |
| --- | --- |
| `+`(String 포함) | 다른 피연산자를 String 으로 바꿔 잇는다. |
| `+`(Number + Number) | 산술 덧셈 |
| `-` `*` `/` `%` | 양쪽을 Number 로 바꾼다. 바꿀 수 없으면 에러다. |
| `==` `!=` | 아래 세부 규칙 |
| `<` `>` `<=` `>=` | 아래 세부 규칙 |
| `&&` `\|\|` | falsy 판정(`false`, `null`, `0`, `""`, `[]` 은 falsy) |
| `!` | Boolean 으로 바꾼 뒤 부정 |

| 대상 | 규칙 |
| --- | --- |
| 문자열과 숫자 | 숫자 형식 문자열(예: `"42"`, `"3.14"`)은 숫자로 바꿔 비교한다. 바꿀 수 없으면 문자열 사전순으로 비교한다. |
| null·undefined | `eq`·`neq` 에서만 비교할 수 있다. `null == undefined` 는 `true`, `null == 0` 은 `false` 다. `gt`·`lt`·`gte`·`lte` 에서는 항상 `false` 다. |
| Boolean | `true` 는 `1`(Number)·`"true"`(String), `false` 는 `0`·`"false"` 다. 비교할 때는 숫자 변환을 먼저 한다. |
| 배열·객체 | `eq`·`neq` 는 깊은 동등 비교다. `gt`·`lt`·`gte`·`lte` 는 할 수 없고 `EXPR_TYPE_ERROR` 다. |
| is_empty 판정 | `null`, `undefined`, `""`(빈 문자열), `[]`(빈 배열), `{}`(빈 객체)는 모두 비어 있다. `0` 과 `false` 는 비어 있지 않다. |

### Strict 모드

조건 노드(If/Else, Switch) 설정에 `strictComparison: true` 를 두면 strict 모드를 쓴다(기본 `false`).

| 항목 | 설명 |
| --- | --- |
| 동작 | 타입 자동 변환을 하지 않는다. 피연산자 타입이 다르면 `eq` 는 `false`, `neq` 는 `true`, 나머지 비교는 `false` 다. |
| 예 | `"42" == 42` 는 strict 모드에서 `false`, 기본 모드에서 `true` 다. |
| 적용 범위 | `strictComparison` 을 둔 노드의 조건 평가에만 쓴다. 다른 노드의 표현식 평가에는 영향이 없다. |

조건 구조는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md), [If/Else 노드](../CLE-NODE-LOGIC/CLE-NODE-IFELSE.md), [Switch 노드](../CLE-NODE-LOGIC/CLE-NODE-SWITCH.md) 를 참고한다.

### null 안전 접근

- `$input.user.name` 에서 `$input.user` 가 `null` 이면 **에러가 난다**.
- **Optional chaining `?.` 을 지원한다.** 중간 값이 `null`·`undefined` 면 체인 전체가 `null` 로 끝난다.
    - 멤버: `{{ $input.user?.name }}`. `user` 가 `null` 이면 결과는 `null`.
    - 인덱스: `{{ $input.items?.[0] }}`. `items` 가 `null` 이면 결과는 `null`.
    - 체인 전체 단락: `{{ $input.user?.profile.age }}`. `user` 가 `null` 이면 `.profile.age` 에서 에러를 던지지 않고 결과는 `null` 이다(JS 의미와 같다).
- 삼항 연산도 쓸 수 있다: `{{ $input.user ? $input.user.name : "unknown" }}`
- `??`(nullish coalescing)는 지원하지 않는다. `||` 로 대신한다.

## 내장 함수

### 문자열 함수

| 함수 | 시그니처 | 설명 | 예 |
| --- | --- | --- | --- |
| `length` | `length(str) → Number` | 문자열 길이 | `{{ length($input.name) }}` |
| `uppercase` | `uppercase(str) → String` | 대문자로 | `{{ uppercase("hello") }}` → `"HELLO"` |
| `lowercase` | `lowercase(str) → String` | 소문자로 | `{{ lowercase("Hello") }}` → `"hello"` |
| `trim` | `trim(str) → String` | 앞뒤 공백 제거 | `{{ trim("  hi  ") }}` → `"hi"` |
| `contains` | `contains(str, sub) → Boolean` | 부분 문자열 포함 여부 | `{{ contains($input.email, "@") }}` |
| `startsWith` | `startsWith(str, prefix) → Boolean` | 접두사 일치 | `{{ startsWith($input.url, "https") }}` |
| `endsWith` | `endsWith(str, suffix) → Boolean` | 접미사 일치 | `{{ endsWith($input.file, ".pdf") }}` |
| `replace` | `replace(str, search, replacement) → String` | 첫 번째 일치 치환 | `{{ replace($input.text, "old", "new") }}` |
| `replaceAll` | `replaceAll(str, search, replacement) → String` | 모든 일치 치환 | `{{ replaceAll($input.csv, ",", ";") }}` |
| `split` | `split(str, separator) → Array` | 문자열 나누기 | `{{ split("a,b,c", ",") }}` → `["a","b","c"]` |
| `join` | `join(arr, separator) → String` | 배열 잇기 | `{{ join(["a","b"], "-") }}` → `"a-b"` |
| `substring` | `substring(str, start, end?) → String` | 부분 문자열 | `{{ substring($input.code, 0, 3) }}` |
| `padStart` | `padStart(str, length, char?) → String` | 왼쪽 채우기 | `{{ padStart("5", 3, "0") }}` → `"005"` |
| `padEnd` | `padEnd(str, length, char?) → String` | 오른쪽 채우기 | 없음 |

### 숫자 함수

| 함수 | 시그니처 | 설명 |
| --- | --- | --- |
| `round` | `round(num, decimals?) → Number` | 반올림 |
| `ceil` | `ceil(num) → Number` | 올림 |
| `floor` | `floor(num) → Number` | 내림 |
| `abs` | `abs(num) → Number` | 절댓값 |
| `min` | `min(a, b, ...) → Number` | 최솟값 |
| `max` | `max(a, b, ...) → Number` | 최댓값 |
| `parseInt` | `parseInt(str) → Number` | 정수로 |
| `parseFloat` | `parseFloat(str) → Number` | 실수로 |
| `toFixed` | `toFixed(num, digits) → String` | 소수점 자릿수 고정 |
| `random` | `random() → Number` | 0~1 난수(실행 시점 고정) |

### 날짜·시간 함수

| 함수 | 시그니처 | 설명 |
| --- | --- | --- |
| `formatDate` | `formatDate(dateStr, pattern) → String` | 날짜 형식 맞추기 |
| `parseDate` | `parseDate(str, pattern?) → String` | 문자열을 ISO 8601 로 파싱 |
| `addTime` | `addTime(dateStr, amount, unit) → String` | 시간 더하기 |
| `subtractTime` | `subtractTime(dateStr, amount, unit) → String` | 시간 빼기 |
| `diffTime` | `diffTime(date1, date2, unit) → Number` | 두 날짜 차이 |
| `now` | `now() → String` | 현재 시각(ISO 8601) |
| `today` | `today() → String` | 오늘 날짜(YYYY-MM-DD) |

날짜 형식 패턴은 dayjs 와 호환된다.

| 토큰 | 설명 | 예 |
| --- | --- | --- |
| `YYYY` | 4자리 연도 | 2026 |
| `MM` | 2자리 월 | 03 |
| `DD` | 2자리 일 | 29 |
| `HH` | 24시간제 시 | 14 |
| `mm` | 분 | 30 |
| `ss` | 초 | 05 |
| `ddd` | 요일 약어 | Mon |

시간 단위는 `years`, `months`, `days`, `hours`, `minutes`, `seconds` 다.

### 배열 함수

| 함수 | 시그니처 | 설명 |
| --- | --- | --- |
| `length` | `length(arr) → Number` | 배열 길이(문자열 버전과 이름이 같다) |
| `first` | `first(arr) → Any` | 첫 번째 요소 |
| `last` | `last(arr) → Any` | 마지막 요소 |
| `includes` | `includes(arr, value) → Boolean` | 요소 포함 여부 |
| `reverse` | `reverse(arr) → Array` | 역순 배열(원본은 그대로) |
| `flatten` | `flatten(arr) → Array` | 한 단계 평탄화 |
| `unique` | `unique(arr) → Array` | 중복 제거 |
| `compact` | `compact(arr) → Array` | null·undefined 제거 |
| `slice` | `slice(arr, start, end?) → Array` | 부분 배열 |
| `concat` | `concat(arr1, arr2) → Array` | 배열 합치기 |

### 객체 함수

| 함수 | 시그니처 | 설명 |
| --- | --- | --- |
| `keys` | `keys(obj) → Array` | 키 목록 |
| `values` | `values(obj) → Array` | 값 목록 |
| `entries` | `entries(obj) → Array` | [key, value] 쌍 배열 |
| `hasKey` | `hasKey(obj, key) → Boolean` | 키 존재 여부 |
| `merge` | `merge(obj1, obj2) → Object` | 객체 병합(obj2 우선) |
| `pick` | `pick(obj, keys) → Object` | 지정 키만 뽑기 |
| `omit` | `omit(obj, keys) → Object` | 지정 키 빼기 |

### 타입 변환 함수

| 함수 | 시그니처 | 설명 |
| --- | --- | --- |
| `toString` | `toString(value) → String` | 문자열로 |
| `toNumber` | `toNumber(value) → Number` | 숫자로(실패하면 에러) |
| `toBoolean` | `toBoolean(value) → Boolean` | 불리언으로 |
| `toJSON` | `toJSON(value) → String` | JSON 문자열로 |
| `fromJSON` | `fromJSON(str) → Any` | JSON 파싱 |
| `typeOf` | `typeOf(value) → String` | 타입 이름 |
| `isEmpty` | `isEmpty(value) → Boolean` | 비어 있는지(null, "", [], {}) |
| `isNull` | `isNull(value) → Boolean` | null 인지 |

## 에러 처리

### 에러 코드

표현식 에러 코드(`EXPR_*`)는 여섯 가지다.

| 에러 코드 | 설명 | 예 |
| --- | --- | --- |
| `EXPR_SYNTAX_ERROR` | 문법 에러 | `{{ $input. }}`(끝나지 않은 멤버 접근) |
| `EXPR_REFERENCE_ERROR` | 없는 참조 | `{{ $input.nonExistent.field }}`(null 접근) |
| `EXPR_TYPE_ERROR` | 타입이 맞지 않는 연산 | `{{ "hello" - 1 }}` |
| `EXPR_FUNCTION_ERROR` | 함수 호출 에러 | `{{ unknownFn() }}` |
| `EXPR_TIMEOUT` | 평가 시간 초과 | 복잡한 중첩 표현식 |
| `EXPR_DEPTH_EXCEEDED` | 중첩 깊이 초과 | 100단계 넘는 중첩 |

### 맥락별 동작

| 맥락 | 동작 |
| --- | --- |
| 노드 설정 필드 | 표현식 에러가 나면 그 노드 실행이 실패하고 노드의 에러 처리 정책을 적용한다([노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)). |
| 에디터 미리보기 | 빨간 밑줄과 인라인 에러 메시지를 보여 준다. 실행은 막지 않는다. |
| If/Else 조건 | 조건 평가 에러가 나면 노드 실행이 실패한다. `false` 로 보지 않는다. |

### 평가 제한

| 항목 | 제한 |
| --- | --- |
| 최대 평가 시간 | 100ms |
| 최대 중첩 깊이 | 100 |
| 최대 표현식 길이 | 10,000자 |
| 최대 문자열 결과 크기 | 1MB |

## 구현 위치

- `codebase/packages/expression-engine/src/**/*.ts` (토크나이저·파서·평가기·함수)
