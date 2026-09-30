---
id: "CLE-WF-EXPR"
title: "표현식 언어"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-EXPR-001", "REQ-EXPR-002", "REQ-EXPR-003", "REQ-EXPR-004", "REQ-EXPR-005", "REQ-EXPR-006", "REQ-EXPR-007", "REQ-EXPR-008", "REQ-EXPR-009", "REQ-EXPR-010", "REQ-EXPR-011", "REQ-EXPR-012", "REQ-EXPR-013", "REQ-EXPR-014", "REQ-EXPR-015", "REQ-EXPR-016", "REQ-EXPR-017", "REQ-EXPR-018", "REQ-EXPR-019", "REQ-EXPR-020", "REQ-EXPR-021", "REQ-EXPR-022", "REQ-EXPR-023", "REQ-EXPR-024", "REQ-EXPR-025", "REQ-EXPR-026", "REQ-EXPR-027", "REQ-EXPR-028", "REQ-EXPR-029", "REQ-EXPR-030", "REQ-EXPR-031", "REQ-EXPR-032", "REQ-EXPR-033", "REQ-EXPR-034", "REQ-EXPR-035", "REQ-EXPR-036", "REQ-EXPR-037", "REQ-EXPR-038", "REQ-EXPR-039", "REQ-EXPR-040", "REQ-EXPR-041", "REQ-EXPR-042", "REQ-EXPR-043", "REQ-EXPR-044", "REQ-EXPR-045"]
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "ebe38d4dab1f072db33b10db49401fbcd1c2683d1e91a3839e51bfe2ab1d6f7c"
read_as: "approved"
task: null
source_paths: ["spec/3-workflow-editor/1-node-common.md", "spec/3-workflow-editor/_product-overview.md", "spec/5-system/5-expression-language.md"]
mirror_sha256: "2c439c7f3b0fa83970e5c70b33cad447dcf98b1e60eae4c982fb77667cc074c9"
etag: "sha256-e74333529ba06626883ea2d7c2356e26adf9e9af64ed730c03c250e3370bcd6f"
---
> 구현 상태: 구현됨 · 원문: `spec/5-system/5-expression-language.md`, `spec/3-workflow-editor/1-node-common.md` (§3 표현식 시스템), `spec/3-workflow-editor/_product-overview.md` (§5 ED-SP-03·04) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

표현식(Expression, `{{ }}`)은 노드 설정 필드 안에서 동적 값을 참조하고 간단한 연산을 하는 **읽기 전용 인라인 언어**다. 앞 노드의 출력, 워크플로우 변수, 실행 정보를 읽는다. 복잡한 데이터 변환은 [Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) 와 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 가 맡고, 표현식은 **참조와 가벼운 연산**에 집중한다. 표현식은 노드를 실행하기 직전에 한 번 평가(evaluate)한다.

이 문서는 표현식 언어(Expression Language)의 문법, 타입, 내장 변수(built-in variables), 내장 함수, 에러, 에디터의 표현식 입력과 자동완성, 실행 엔진이 설정을 평가하는 방식, 보안 제약을 정한다.

범위 밖:

- 표현식이 읽는 노드 출력의 다섯 필드는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이, 엔진이 `$node` 에 노드 출력을 싣는 형태와 평가한 설정을 핸들러에 넘기는 단계는 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 이 정한다.
- 반복 컨텍스트를 채우는 컨테이너 실행은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md), 실행 컨텍스트 필드 분류는 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정한다.
- 조건 노드의 조건 구조와 연산자는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) 이 정한다.
- 스케줄 파라미터의 제한 표현식은 [스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md) 이 정한다.

## 요구사항

- REQ-EXPR-001 WHEN 사용자가 노드 설정 입력 필드에 `{{ }}` 표현식을 쓰면 THE SYSTEM SHALL 앞 노드 출력 등 참조한 값으로 평가해 노드에 넘긴다. (원본: ED-SP-03)
- REQ-EXPR-002 WHEN 사용자가 표현식을 입력하면 THE SYSTEM SHALL 자동완성을 제안하고 문법을 실시간으로 검사한다. (원본: ED-SP-04)
- REQ-EXPR-003 WHEN 표현식을 평가하면 THE SYSTEM SHALL 외부 상태를 바꾸지 않는다.
- REQ-EXPR-004 WHEN 같은 입력으로 표현식을 평가하면 THE SYSTEM SHALL 같은 결과를 낸다.
- REQ-EXPR-005 WHEN 난수·시간 함수를 평가하면 THE SYSTEM SHALL 실행 시점 값으로 고정한다(고정 단위는 미결 사항 참조).
- REQ-EXPR-006 WHEN 필드 값 전체가 표현식 하나이면 THE SYSTEM SHALL 평가 결과의 원래 타입(number, object, array 등)을 유지한다.
- REQ-EXPR-007 WHEN 필드 값이 텍스트와 표현식을 섞어 쓰면 THE SYSTEM SHALL 결과를 항상 문자열로 만든다.
- REQ-EXPR-008 WHEN 필드에 `\{\{` 를 쓰면 THE SYSTEM SHALL 표현식이 아닌 리터럴 `{{` 로 다룬다.
- REQ-EXPR-009 WHEN `==`·`!=` 로 비교하면 THE SYSTEM SHALL 느슨한 동등 연산자가 아닌 엄격한 연산자로 다룬다.
- REQ-EXPR-010 WHEN `&&`·`||` 를 평가하면 THE SYSTEM SHALL 단축 평가를 한다.
- REQ-EXPR-011 IF 조건 노드 설정에 `strictComparison: true` 가 있으면 THE SYSTEM SHALL 그 노드의 조건 평가에서 타입 자동 변환을 하지 않는다.
- REQ-EXPR-012 IF 중간 값이 `null` 인 경로를 `.` 로 접근하면 THE SYSTEM SHALL 에러를 낸다.
- REQ-EXPR-013 WHEN 표현식이 `?.` 로 접근하다 중간 값이 `null`·`undefined` 이면 THE SYSTEM SHALL 체인 전체를 `null` 로 끝낸다.
- REQ-EXPR-014 WHEN 웹훅 트리거로 시작한 실행이면 THE SYSTEM SHALL `$trigger` 에 요청의 `body`·`headers`·`query`·`method` 를 담는다.
- REQ-EXPR-015 IF 실행이 웹훅이 아닌 경로(수동·스케줄 등)로 시작했으면 THE SYSTEM SHALL `$trigger` 를 빈 객체 `{}` 로 둔다.
- REQ-EXPR-016 WHILE `$trigger.headers` 를 노출하는 동안 THE SYSTEM SHALL 민감 헤더 값을 `[REDACTED]` 로 가린다.
- REQ-EXPR-017 WHEN 실행이 재구동돼 컨텍스트를 다시 만들면 THE SYSTEM SHALL `$trigger` 를 `Execution.inputData` 에서 같은 값으로 복원한다.
- REQ-EXPR-018 WHILE Background 본문을 실행하는 동안 THE SYSTEM SHALL `$trigger` 를 빈 객체로 둔다(1차 범위).
- REQ-EXPR-019 WHEN 운영자가 `EXPRESSION_ENV_ALLOWLIST` 에 환경 변수 키를 적으면 THE SYSTEM SHALL 그 키만 `$env` 로 노출한다.
- REQ-EXPR-020 IF `EXPRESSION_ENV_ALLOWLIST` 가 비어 있으면 THE SYSTEM SHALL `$env` 를 빈 객체 `{}` 로 둔다.
- REQ-EXPR-021 IF 노드 설정 필드의 표현식 평가가 실패하면 THE SYSTEM SHALL 그 노드 실행을 실패로 처리하고 노드의 에러 처리 정책을 적용한다.
- REQ-EXPR-022 IF 에디터 미리보기에서 표현식 에러가 나면 THE SYSTEM SHALL 빨간 밑줄과 인라인 에러 메시지를 보여 주고 실행은 막지 않는다.
- REQ-EXPR-023 IF If/Else 조건 평가에서 에러가 나면 THE SYSTEM SHALL `false` 로 보지 않고 노드 실행을 실패로 처리한다.
- REQ-EXPR-024 IF 평가가 100ms 를 넘으면 THE SYSTEM SHALL `EXPR_TIMEOUT` 으로 멈춘다.
- REQ-EXPR-025 IF 중첩 깊이가 100 을 넘으면 THE SYSTEM SHALL `EXPR_DEPTH_EXCEEDED` 로 멈춘다.
- REQ-EXPR-026 WHILE 표현식을 평가하는 동안 THE SYSTEM SHALL 표현식 길이를 10,000자, 문자열 결과 크기를 1MB 이하로 제한한다.
- REQ-EXPR-027 WHEN 사용자가 `{{` 를 입력하면 THE SYSTEM SHALL 최상위 내장 변수 목록을 제안한다.
- REQ-EXPR-028 WHEN 사용자가 `$input.` 을 입력하면 THE SYSTEM SHALL 직전 노드의 출력 스키마에 있는 필드를 제안한다.
- REQ-EXPR-029 WHEN 사용자가 `$node["` 를 입력하면 THE SYSTEM SHALL 참조할 수 있는 노드 레이블 목록을 제안한다(범위는 미결 사항 참조).
- REQ-EXPR-030 WHILE Loop·ForEach 본문 안의 노드를 편집하는 동안 THE SYSTEM SHALL `$loop`·`$item`·`$itemIndex`·`$itemIsFirst`·`$itemIsLast` 를 제안한다.
- REQ-EXPR-031 WHILE Table 노드 열 표현식을 편집하는 동안 THE SYSTEM SHALL `$sourceItem`·`$sourceItemIndex`·`$dataSource` 를 추가로 제안한다.
- REQ-EXPR-032 IF 워크플로우를 한 번도 실행하지 않았으면 THE SYSTEM SHALL 함수 이름과 `$` 변수만 제안하고 필드 제안 자리에 "(워크플로우를 먼저 실행하세요)" 힌트를 보여 준다.
- REQ-EXPR-033 WHEN 노드가 기본 출력 스키마를 쓰면 THE SYSTEM SHALL 설정에 선언한 사용자 필드를 스키마에 넣어 자동완성을 돕는다.
- REQ-EXPR-034 IF 표현식이 접근할 수 없는 노드나 스코프 밖 변수를 참조하면 THE SYSTEM SHALL 주황색 경고를 표시한다.
- REQ-EXPR-035 WHEN 사용자가 필드의 모드 토글을 누르면 THE SYSTEM SHALL 그 필드를 정적 값과 표현식 모드 사이에서 바꾼다.
- REQ-EXPR-036 WHEN 실행 엔진이 노드를 실행하기 전이면 THE SYSTEM SHALL 설정 객체를 재귀로 돌며 문자열 값의 `{{ }}` 를 평가한다.
- REQ-EXPR-037 WHEN 설정 값이 number·boolean·null 이면 THE SYSTEM SHALL 평가하지 않고 그대로 넘긴다.
- REQ-EXPR-038 WHEN 평가 결과에 `{{ }}` 가 들어 있어도 THE SYSTEM SHALL 다시 평가하지 않는다.
- REQ-EXPR-039 WHILE 설정 객체를 평가하는 동안 THE SYSTEM SHALL 설정 구조 깊이를 10단계로 제한한다.
- REQ-EXPR-040 IF 노드를 만들거나 이름을 바꾸거나 캔버스를 저장할 때 같은 노드 레이블이 있으면 THE SYSTEM SHALL 막는다.
- REQ-EXPR-041 IF 노드 레이블에 `#` 문자가 있으면 THE SYSTEM SHALL 노드 생성·수정 요청을 거부한다.
- REQ-EXPR-042 IF 실행 시 같은 레이블의 노드가 둘 이상이면 THE SYSTEM SHALL 실행 순서대로 두 번째부터 `Label#2`, `Label#3` 처럼 구분한다.
- REQ-EXPR-043 WHEN 표현식이 `$node["<nodeId>"]` 를 쓰면 THE SYSTEM SHALL 레이블과 상관없이 그 UUID 의 노드를 참조한다.
- REQ-EXPR-044 WHEN 엔진이 `code`·`table`·`filter`·`loop` 노드의 설정을 평가하면 THE SYSTEM SHALL 표현식 제외 키를 미리 평가하지 않는다.
- REQ-EXPR-045 WHILE 표현식을 평가하는 동안 THE SYSTEM SHALL `eval` 을 쓰지 않고 자체 파서·평가기만 쓴다.

## 설계 원칙

| 원칙 | 설명 |
| --- | --- |
| 읽기 전용 | 외부 상태를 바꿀 수 없다. 부수 효과가 없다. |
| 결정적 | 같은 입력이면 같은 출력이다. 난수·시간 함수는 실행 시점 값으로 고정한다(고정 단위는 [미결 사항](#미결-사항) 참조). |
| 안전 | 무한 루프와 재귀가 없다. 최대 평가 깊이를 제한한다. |
| 가벼움 | 100ms 안에 평가를 끝내는 것이 목표다. |

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

## 내장 참조 변수

### 변수 목록

| 참조 | 타입 | 설명 | 예 |
| --- | --- | --- | --- |
| `$input` | Object | 직전 연결 노드의 출력 데이터 | `{{ $input.email }}` |
| `$params` | Object | 트리거 파라미터 참조. `$input.parameters`(입력의 `parameters` 객체)의 줄임이다. 수동 트리거 노드가 검증한 입력 파라미터를 읽는다. | `{{ $params.userId }}` |
| `$node["이름"]` | Object | 노드 참조. 특정 노드의 실행 결과다. `.output`(출력 데이터) 말고도 `.config`·`.meta`·`.port`·`.status` 를 읽을 수 있다. UUID 로도 접근한다. | `{{ $node["Fetch User"].output.id }}` |
| `$var` | Object | 워크플로우 변수(workflow variables). [변수 선언 노드](../CLE-NODE-LOGIC/CLE-NODE-VARDECL.md) 로 선언한 값 | `{{ $var.counter }}` |
| `$execution` | Object | 현재 실행 컨텍스트 | `{{ $execution.id }}` |
| `$now` | String | 현재 시각(ISO 8601, UTC) | `{{ $now }}` |
| `$env` | Object | 환경 변수 참조. 운영자가 `EXPRESSION_ENV_ALLOWLIST` 에 적은 키만 노출한다. SaaS 는 설정하지 않으므로 `{}` 다. [웹훅 요청 뷰와 환경 변수 주입](#웹훅-요청-뷰와-환경-변수-주입) 참조 | `{{ $env.API_URL }}` |
| `$loop` | Object | 반복 컨텍스트. Loop 본문 안에서 쓴다. | `{{ $loop.index }}` |
| `$item` | Object·Any | 항목 컨텍스트. ForEach 의 현재 항목 | `{{ $item.name }}` |
| `$itemIndex` | Number | ForEach 의 현재 인덱스 | `{{ $itemIndex }}` |
| `$itemIsFirst` | Boolean | ForEach 첫 항목 여부 | `{{ $itemIsFirst }}` |
| `$itemIsLast` | Boolean | ForEach 마지막 항목 여부 | `{{ $itemIsLast }}` |
| `$trigger` | Object | 웹훅 요청 뷰. 웹훅 요청의 `{ body, headers, query, method }` 평평한 형태이고 민감 헤더 값은 가린다. 수동·스케줄 실행은 `{}` 다. [웹훅 요청 뷰와 환경 변수 주입](#웹훅-요청-뷰와-환경-변수-주입) 참조 | `{{ $trigger.body.event }}` |
| `$thread` | Object | 대화 스레드 변수. 사용자 인터랙션과 AI 대화 턴을 쌓는다. [`$thread` 속성](#thread-속성) 참조 | `{{ $thread.length }}` |

**Table 노드 한정 컨텍스트**: Table 노드 열 셀(`field`) 표현식을 평가할 때 `$sourceItem`(현재 행 항목), `$sourceItemIndex`(행 인덱스), `$dataSource`(원본 데이터 배열)를 넣는다. 라벨(`label`) 표현식(dynamic 모드에서 한 번 평가)에는 행 단위가 아니므로 `$dataSource` 만 넣는다. 자세한 내용은 [Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md) 에 있다.

**Code 노드 런타임과의 차이**: Code 노드는 표현식과 별개인 자체 런타임에서 코드를 실행한다. 그 런타임의 `$execution`(`{executionId, workflowId}`), `$node`(현재 노드 메타 `{id, label}`), `$vars` 는 표현식의 `$execution`(`id` 필드), `$node`(다른 노드 결과), `$var` 와 이름은 비슷하지만 모양과 뜻이 다르다. 기준은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 다.

### `$execution` 속성

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `id` | String | 실행 UUID |
| `startedAt` | String | 실행 시작 시각(ISO 8601) |
| `mode` | String | 실행 모드(`manual`, `webhook`, `schedule`). 실제 값은 [미결 사항](#미결-사항) 참조 |
| `workflowId` | String | 워크플로우 UUID |

### `$loop` 속성

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `index` | Number | 현재 반복 인덱스(0부터) |
| `iteration` | Number | 현재 반복 횟수(1부터) |
| `isFirst` | Boolean | 첫 번째 반복인지 |
| `isLast` | Boolean | 마지막 반복인지 |

`$loop` 는 이 네 속성만 노출한다. `$loop.count` 와 바깥 컨테이너를 가리키는 `$parent` 는 표현식에 없다. 반복 변수의 표현식 표면은 이 문서가 정한다. 엔진 원문은 두 변수를 적었지만 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#반복-변수-표면은-표현식-언어를-따른다) 은 이 문서를 따라 옮기지 않았다. 총 반복 횟수를 읽는 방법은 [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) 에 있다.

### `$thread` 속성

대화 스레드(ConversationThread)의 읽기 전용 뷰다. AI 에이전트 노드의 `contextScope` 자동 주입과 별개로 사용자가 직접 참조할 수 있다. 자료구조는 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 정한다.

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `turns` | Array | 대화 기록 항목(`ConversationTurn[]`)의 읽기 전용 스냅샷 |
| `length` | Number | 턴 개수 |
| `text` | String | `system_text` 렌더 결과(모든 턴의 머리와 본문) |

- 1차 범위는 단순 인덱싱만 연다. `$thread.last(n)`·`$thread.byNode(name)` 같은 메서드 호출은 후속 범위에서 검토한다.
- 백엔드 실행 엔진이 `$thread` 를 넣고, 에디터 자동완성의 최상위 변수 목록(`ROOT_VARIABLES`)에도 `$thread` 가 있다.

예:

- `{{ $thread.length }}`: 쌓인 턴 개수
- `{{ $thread.text }}`: 스레드 전체를 텍스트로 붙인다(예: Transform 노드에서 가공).
- `{{ $thread.turns[0].data.email }}`: 첫 턴 폼 데이터의 필드. `turn.source` 가 `presentation_user` 일 때 유효하다.

### 웹훅 요청 뷰와 환경 변수 주입

실행 엔진의 컨텍스트 빌더(`ExpressionResolverService.buildExpressionContext`)가 `$trigger` 와 `$env` 를 넣는다(구현됨, 2026-07-07). 새 실행(`runExecution`)과 재구동 뒤 컨텍스트 복원(`rehydrateContext`) 두 경로가 똑같이 넣는다.

#### `$trigger`: 웹훅 요청 뷰

웹훅 트리거로 시작한 실행에서 HTTP 요청 구성 요소를 **평평한 형태**로 보여 준다. 데이터 출처는 `Execution.inputData` 에 저장한 `TriggerExecutionInput`([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md))의 **웹훅 전용 요청 필드**다.

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `$trigger.body` | Any | 요청 본문(JSON 파싱한 payload) |
| `$trigger.headers` | Object | 요청 헤더(소문자 키). **민감 헤더 값은 가린다**(아래). |
| `$trigger.query` | Object | 쿼리스트링 파라미터 |
| `$trigger.method` | String | HTTP 메서드(`POST` 등) |

- **`parameters` 는 `$trigger` 에 없다**: 트리거 스키마로 정규화한 `TriggerExecutionInput.parameters` 는 `$input.parameters`·`$params` 로 노출한다. `$trigger` 는 원본 HTTP 요청(`body`·`headers`·`query`·`method`)만 담는다. [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md) 의 `output.request.{method,headers,query,body}` 와 **필드 이름 집합**이 같고, **헤더 가림도 양쪽에 똑같이 적용**한다. 민감 헤더 값은 웹훅을 받는 시점에 `[REDACTED]` 로 가리므로 `Execution.inputData`, `output.request.headers`, `$trigger.headers` 모두 가려져 있다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)).
- **데이터 출처와 재구동**: 웹훅 어댑터(`HooksService`)가 `execute()` 에 `{ parameters, body, headers, query, method }` 와 `{ __triggerSource: 'webhook' }` 을 넘겨 `Execution.inputData` 에 저장한다. 컨텍스트를 만들 때 이 payload 의 요청 필드로 `$trigger` 를 구성한다. 대기 뒤 재개나 장애 뒤 재구동([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) 때도 durable 한 `Execution.inputData` 에서 똑같이 복원한다. `$trigger` 는 메모리 컨텍스트가 아니라 `inputData` 에서 파생한 값이라 복원 뒤에도 `{}` 로 비지 않는다.
- **민감 헤더 가림**: `$trigger.headers` 는 `Authorization`·`Cookie`·`X-Api-Key`·`X-Auth-Token` 같은 인증·비밀 헤더의 **값을 `[REDACTED]` 로 가려** 보여 준다. 키는 남긴다. 통합 노드의 `sanitizeResponseHeaders` 차단 목록을 다시 쓴다(정확히 일치하는 이름과 `auth`·`token`·`secret`·`cookie`·`credential`·`password`·`api-key`·`signature` 부분 일치). **첫 가림은 웹훅을 받는 시점**(`Execution.inputData` 저장 전)이고, `buildTriggerView` 가 다시 가리는 것은 여러 번 해도 같은 결과인 이중 방어다. 웹훅이 아닌 경로가 원본 헤더를 넣더라도 표현식으로 새지 않게 한다.
- **빈 payload 대체**: 수동 실행, 스케줄 실행, 웹훅이 아닌 진입 경로에는 요청 payload 가 없으므로 **`$trigger = {}`** 를 넣는다. 그러면 `{{ $trigger.body.event }}` 는 `EXPR_REFERENCE_ERROR` 대신 `undefined` 로 조용히 떨어진다(optional chaining 과 잘 맞는다).
- **1차 범위**: Background 본문(별도 작업 컨텍스트)은 부모 실행의 payload 를 물려받지 않고 `$trigger = {}` 로 둔다. 물려받는 것은 후속 과제다.

#### `$env`: 환경 변수(셀프 호스팅 전용, 허용 목록)

`process.env` 에는 `DATABASE_URL`, JWT 비밀, API 키 같은 비밀이 많다. 그래서 `$env` 는 **운영자가 명시적으로 허용한 키만** 노출한다.

- **허용 목록**: 환경 변수 `EXPRESSION_ENV_ALLOWLIST`(쉼표로 구분한 키 목록, 예: `API_URL,REGION`)에 적은 키만 `$env` 로 노출한다(`$env = { API_URL: process.env.API_URL, ... }`). 목록에 없는 키는 절대 노출하지 않는다.
- **셀프 호스팅 게이트는 운영자 허용**: `EXPRESSION_ENV_ALLOWLIST` 는 **배포 운영자만** 설정할 수 있다. 테넌트나 워크플로우 작성자는 설정할 수 없다. 그래서 SaaS 멀티테넌트 배포는 이 값을 비워 `$env = {}` 로 두고(비밀 노출 없음), 셀프 호스팅 운영자는 필요한 **비밀이 아닌** 키만 적는다. [Clemvion 제품 개요](../CLE-VISION.md) 의 "SaaS 와 셀프 호스팅을 설정만으로 전환" 을 별도 전역 모드 축 없이 허용 목록으로 이룬다([Rationale](#rationale)).
- **대체값**: `EXPRESSION_ENV_ALLOWLIST` 가 없거나 비어 있으면 `$env = {}` 다. 그때 `{{ $env.API_URL }}` 은 `undefined` 로 조용히 떨어진다.
- **보안 불변식**: 허용하지 않은 키(특히 비밀)는 `$env` 로 샐 수 없다. 허용 목록은 운영자가 배포 단계에서 고른 것이다.

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

## 에디터 지원

### 표현식 입력

노드 설정 패널의 텍스트 입력은 표현식을 아는 입력(`ExpressionInput`)으로 그린다. auto-form 에서는 `expression`·`kv-expression` 위젯이다([노드 포트와 설정 패널](CLE-WF-NODEPANEL.md)).

| 기능 | 설명 |
| --- | --- |
| 구문 강조 | `{{ }}` 블록 뒤에 배경 오버레이를 깐다. |
| 실시간 검증 | `validate()` 로 문법을 바로 검사한다. 문법 에러는 빨간 밑줄과 에러 메시지로, 접근할 수 없는 노드나 스코프 밖 변수 참조는 주황색 경고로 표시한다. |
| 노드 출력 스키마 | 앞 노드의 출력 구조를 트리로 보고 골라 넣는다. |
| 미리보기 | 마지막 실행 데이터로 표현식 결과를 미리 본다. |
| 모드 전환 | 필드마다 정적 값과 표현식 모드를 토글한다. |

### 자동완성

`{{` 를 입력하면 자동완성 팝업이 뜬다. 화살표 키로 옮기고 Enter·Tab 으로 고르고 Escape 로 닫는다.

| 계기 | 제안 내용 | 데이터 출처 |
| --- | --- | --- |
| `{{` 입력, 표현식 시작 | 최상위 내장 변수(`$input`, `$node`, `$var`, `$execution`, ...). Table 노드 맥락에서는 `$sourceItem`·`$sourceItemIndex`·`$dataSource` 를 더한다. | 내장 참조 변수 목록 |
| `$input.` 입력 | 직전 노드의 출력 필드 | 마지막 실행 결과의 출력 데이터 키 |
| `$params.` 입력 | 트리거 파라미터 이름. 트리거 바로 다음 노드에서만 제안한다. | `$input.parameters` |
| `$node["` 입력 | 노드 레이블 목록(노드 선택 드롭다운). 범위는 [미결 사항](#미결-사항) 참조 | 에디터 store 의 노드 |
| `$node["Label"].output.` 입력 | 그 노드의 출력 필드 | 그 노드의 마지막 실행 결과 |
| `$var.` 입력 | 선언한 워크플로우 변수 | 변수 선언 노드의 설정 |
| `$sourceItem.` 입력 | **(Table 노드 한정)** 현재 행 항목 필드 | 실행 결과 행 샘플(`sourceItemSample`) |
| `$dataSource.` 입력 | **(Table 노드 한정)** 원본 배열 요소 필드 | 실행 결과 행 샘플(같음) |
| 함수 이름 일부 입력 | 맞는 내장 함수와 시그니처 | 함수 레지스트리(정적) |

- **컨테이너 스코프**: Loop·ForEach 본문 안에서만 `$loop`·`$item`·`$itemIndex`·`$itemIsFirst`·`$itemIsLast` 를 제안한다. Parallel 노드 안에서는 바깥 스코프를 차단한다.
- **Table 노드 한정 변수**: Table 노드 열 표현식을 편집할 때만 최상위 목록에 `$sourceItem`·`$sourceItemIndex`·`$dataSource` 를 보인다. 이것은 **에디터 자동완성 노출**이고, 실제 평가에서 쓸 수 있는 범위(`field` 와 `label` 의 차이 포함)는 [Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md) 를 따른다.
- **실행한 적 없는 워크플로우**: 함수 이름과 `$` 변수 종류만 제안하고, 필드 제안 자리에는 "(워크플로우를 먼저 실행하세요)" 힌트를 보여 준다.

**자동완성 데이터 출처**

| 출처 | 만드는 시점 |
| --- | --- |
| 노드 출력 스키마 | 마지막 실행 결과에서 추론한다. 실행하지 않았으면 노드 유형의 기본 스키마를 쓴다. |
| 설정 기반 스키마 보강(enricher) | 기본 스키마를 쓸 때 노드 인스턴스 설정에 선언한 사용자 필드를 정적 스키마에 넣는다(아래). |
| 변수 목록 | 워크플로우 안 변수 선언 노드에서 뽑는다. |
| 노드 목록 | 에디터 store 의 노드 레이블 |
| 함수 목록 | 내장 함수 레지스트리(정적) |

**자동완성 스키마 보강(enricher)**: 실행하지 않은 상태에서도 사용자가 설정으로 선언한 출력 필드를 힌트로 보여 주려고, 다섯 노드 유형은 노드 인스턴스 설정을 노드 유형의 정적 기본 스키마에 넣는다(`node-output-schema-enrichers.ts`). `$input` 스키마와 `$node["Label"].output` 드릴다운 양쪽에 적용한다(`use-expression-context.ts`).

| 노드 유형 | 넣는 규칙 |
| --- | --- |
| `information_extractor` | `config.outputSchema[].name` → `.output.result.extracted.<name>` |
| `form` | `config.fields[].name` → `.output.interaction.data.<field>` |
| `table` | `config.columns[].field` → `.output.rows[i].<field>` |
| `transform` | `set_field` 의 `field`, `rename_field` 의 `to` → `.output.<name>` |
| `manual_trigger` | `config.parameters[].name` → `.output.parameters.<name>`(파라미터 `type` 으로 매핑) |

안전장치: 위험한 키(`__proto__`, `constructor`, `prototype`, 식별자가 아닌 키)는 거부한다. 값에 표현식(`{{ }}`)이 든 키는 실행 전에는 키가 정해지지 않으므로 건너뛴다. 중첩 경로(`user.name`)도 건너뛴다. 기본 스키마 모양이 보강을 허용하지 않으면 조용히 기본 스키마로 돌아간다. 모두 UX 힌트일 뿐 실행 동작에는 영향이 없다.

## 구현 구조

### 파서와 평가기

```mermaid
flowchart LR
  A[소스 문자열] --> B[Tokenizer]
  B --> C[Token 배열]
  C --> D[Parser]
  D --> E[AST]
  E --> F[Evaluator]
  F --> G[결과 값]
```

| 단계 | 설명 |
| --- | --- |
| Tokenizer | 문자열을 토큰(숫자, 문자열, 연산자, 식별자 등)으로 나눈다. |
| Parser | 토큰 배열을 AST 로 바꾼다. 재귀 하강 파서다. |
| Evaluator | AST 를 돌며 컨텍스트에 바인딩한 값으로 결과를 계산한다. |

파서와 평가기는 JavaScript/TypeScript 로 구현해 프론트엔드(에디터 미리보기)와 백엔드(실행 엔진) 양쪽에서 쓴다. npm 패키지 `@workflow/expression-engine` 으로 분리해 공유한다.

### 실행 엔진 통합

백엔드 실행 엔진의 `ExpressionResolverService` 가 노드를 실행하기 전에 설정 객체의 표현식을 평가한다.

```
buildExpressionContext(input, executionContext, nodeMap) → resolveConfig(config, exprContext, nodeType) → (노드 핸들러 execute 로 전달)
```

- 문법 검사용 `validate()` 는 이 서비스가 아니라 공유 엔진 패키지(`@workflow/expression-engine`)가 제공한다.
- `resolveConfig` 의 세 번째 인자는 `nodeType`(문자열)이다. 이 값을 키로 `EXPRESSION_EXCLUSIONS` 에서 제외 키 집합을 찾는다.
- 설정 객체를 재귀로 돌며 문자열 값의 `{{ }}` 를 `evaluate()` 로 평가한다.
- 값 전체가 `{{ expr }}` 이면 평가 결과의 원래 타입(number, object, array 등)을 유지한다.
- 텍스트와 표현식이 섞이면(`"Hello {{ $input.name }}!"`) 결과는 항상 문자열이다.
- number, boolean, null 값은 평가 대상이 아니어서 그대로 넘긴다.
- 한 번만 평가한다. 평가 결과에 `{{ }}` 가 있어도 다시 평가하지 않는다.
- 설정 구조 깊이는 10단계로 제한한다.

평가한 설정을 핸들러에 넘기는 단계와 원본 설정(`rawConfig`)과의 관계는 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 이 정한다.

### `$node` 레이블 매핑

`$node["Label"].output` 참조를 지원하려고 실행 시점에 노드 id → 노드 엔티티 맵(`nodeMap`)과 노드 id → 출력 캐시를 합쳐 레이블 키 맵을 만든다. 레이블이 겹치면 구분한 키를 쓰고(`buildDisambiguatedKeys`) 노드 UUID 로도 같은 항목을 등록한다. 각 항목에 싣는 노드 출력의 형태는 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 이 정한다. 항목은 `{ output }` 한 필드짜리 객체가 아니라 노드 출력(`NodeHandlerOutput`)의 `config`·`output`·`meta`·`port`·`status` 를 싣는다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)). 현재 구현(`expression-resolver.service.ts`)은 구조화한 출력 캐시(`structuredOutputCache`)에서 이 다섯 필드를 가져온다. 구조화한 항목이 없고 평평한 출력 캐시(`nodeOutputCache`)만 있을 때만 `{ output: 출력 }` 형태로 대신 싣는다. 코드 주석은 이 경로를 테스트 fixture 용으로 적는다.

- 위상 정렬 순서로 실행하므로 현재 노드가 참조하는 노드는 늘 이미 실행을 마친 상태다.
- **노드 레이블 유일 정책**: 워크플로우 안의 노드 레이블은 겹치면 안 된다. 노드를 만들거나 이름을 바꾸거나 캔버스를 저장할 때 중복을 막는다.
- **레이블 `#` 금지**: 레이블에 `#` 문자를 쓸 수 없다. 아래 `#N` 자동 구분 키와 부딪히지 않게 하려는 것이다. 노드 생성·수정 DTO 검사에서 거부한다(`@Matches(/^[^#]*$/)`, `create-node.dto.ts`, `update-node.dto.ts`).
- **중복 레이블 안전장치**: 같은 레이블이 있으면 실행 순서대로 `#N` 접미사로 자동 구분한다. 첫 노드는 원래 레이블, 다음 노드부터 `Label#2`, `Label#3` 이다.
- **UUID 대체 접근**: 모든 노드는 `$node["<nodeId>"]` 로도 읽을 수 있다. UUID 참조는 레이블이 바뀌어도 흔들리지 않는 안정된 참조 방식이다.

### 표현식 제외 키

엔진이 미리 평가하지 않는 노드별 설정 키(표현식 제외 키, `EXPRESSION_EXCLUSIONS`)다.

| 노드 | 제외 키 | 이유 |
| --- | --- | --- |
| `code` | `code` | 원시 JavaScript 코드다. 자체 런타임(`$input`, `$vars`, `$execution`)에서 실행한다. |
| `table` | `columns` | 셀(`field`)은 행(item)마다 따로 평가하고(`$sourceItem`, `$sourceItemIndex`, `$dataSource`), 라벨(`label`)은 dynamic 모드에서 `$dataSource` 컨텍스트로 한 번 평가한다. `TableHandler` 안에서 처리한다([Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md)). |
| `filter` | `conditions` | 조건은 표현식이 아니라 배열 항목마다 쓰는 필드 경로다. |
| `loop` | `breakCondition` | 반복마다 다시 평가해야 한다(`$loop`·`$var`·`$node[...]` 참조). 노드를 시작할 때 미리 평가하면 i=0 값으로 굳고, 첫 반복 전에는 `$loop` 가 `undefined` 라 에러가 난다. |

그 밖의 모든 노드의 설정 문자열 필드는 평가 대상이다. `template` 노드의 `template` 필드도 따로 제외하지 않는다. 제외 규칙의 기준은 `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts` 의 `EXPRESSION_EXCLUSIONS` 다.

## 보안

| 위협 | 대응 |
| --- | --- |
| 코드 주입 | `eval` 을 쓰지 않는다. 자체 파서와 평가기만 쓴다. |
| 서비스 거부(복잡한 표현식) | 평가 시간 제한(100ms)과 중첩 깊이 제한(100) |
| 데이터 유출(`$env`) | `$env` 는 배포 운영자가 `EXPRESSION_ENV_ALLOWLIST` 로 **명시 허용한 키만** 노출한다. 설정하지 않은 SaaS 기본은 `{}` 다. 비밀(DB URL, JWT, API 키)은 허용하지 않으면 절대 노출하지 않는다. |
| 데이터 유출(`$trigger`) | `$trigger.headers` 는 `Authorization`·`Cookie`·`X-Api-Key` 같은 민감 헤더를 가린다. 첫 가림은 웹훅을 받는 시점이고 `buildTriggerView` 가 다시 가린다(통합 노드 `sanitizeResponseHeaders` 차단 목록 재사용). |
| 재귀 평가 공격 | 한 번만 평가한다. 평가 결과에 `{{ }}` 가 있어도 다시 평가하지 않는다. |

## 미결 사항

- **자동완성의 노드 목록 범위**: 이 문서의 원문(자동완성 계기와 데이터 출처)은 `$node["` 에서 현재 워크플로우의 **모든** 노드 레이블을 제안한다고 적는다. 노드 공통 원문(표현식 에디터)은 현재 노드에서 접근할 수 있는 **조상 노드**와 변수만 토폴로지 기준으로 보여 준다고 적는다. 현재 구현(`use-expression-context.ts`)은 `getAncestorsInScope` 로 조상 노드만 제안한다. 어느 쪽을 규칙으로 할지 결정이 필요하다.
- **`$execution.mode` 값**: 이 문서는 `mode` 가 `manual`·`webhook`·`schedule` 가운데 하나라고 적는다. 현재 구현의 실행 엔진은 `dispatchMeta` 에 `mode: 'manual'` 을 고정해 넘기고 resolver 기본값도 `'manual'` 이라 웹훅·스케줄 실행에서도 `'manual'` 이 나온다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 의 원문은 모양(`{ id, workflowId, startedAt, mode }`)만 같고 값 집합을 정하지 않는다. 실행 출처 분류는 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 에 있다. `mode` 를 실제 출처로 채울지, 뜻을 바꿔 적을지 결정이 필요하다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 은 이 결정을 이 문서에 맡긴다.
- **`$now` 를 고정하는 단위**: 이 문서는 시간 함수를 "실행 시점 고정" 이라고만 적고 `$now` 를 "현재 시각" 이라 적는다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 의 원문은 같은 실행 안에서 같은 값으로 고정한다고 적는다. 현재 구현은 `buildExpressionContext` 를 부를 때마다 새 시각을 만들어 노드마다 값이 다르다. 고정 단위가 실행 전체인지 노드 평가마다인지 결정이 필요하다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 은 이 결정을 이 문서에 맡긴다.
- **`triggerData` 필드와 실행 컨텍스트 규약**: [Rationale](#rationale) 은 `ExecutionContext.triggerData` 를 어떤 노드 핸들러도 읽지 않는 resolver 전용 파생 필드라고 설명한다. [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 규약은 핸들러가 읽지 않는 필드를 `_` 접두 엔진 내부 필드로 두고 새 필드의 분류 근거를 규약에 적으라고 한다. 코드 필드 이름은 접두 없는 `triggerData` 이고 규약에 기록이 없다. 규약의 예외로 올릴지, `_triggerData` 로 바꿀지 결정이 필요하다.

## 구현 위치

- `codebase/packages/expression-engine/src/**/*.ts` (토크나이저·파서·평가기·함수)
- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`
- `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts`
- `codebase/backend/src/modules/execution-engine/expression/trigger-data.util.ts`
- `codebase/frontend/src/components/editor/expression/*.ts`, `*.tsx` (`expression-input.tsx`, `use-expression-context.ts`, `node-output-schema-enrichers.ts` 등)

## Rationale

### `$trigger`·`$env` 를 실행 시 넣는다 (2026-07-07)

평가기, 에디터 자동완성, 변수 목록은 이미 `$trigger`·`$env` 를 노출했는데 실행 엔진 컨텍스트 빌더(`ExpressionResolverService.buildExpressionContext`)가 넣지 않았다. 사용자가 입력하면 실행 때 `EXPR_REFERENCE_ERROR` 로 깨지는, "광고했지만 실패하는" 함정이었다(`spec-sync-expression-language-gaps` 감사). 두 변수를 넣는 계층을 구현해 없앴다.

- **`$trigger` 는 실행 컨텍스트에서 파생한 평평한 형태다**: 트리거 payload 는 이미 durable 한 `Execution.inputData`(`TriggerExecutionInput`)에 저장돼 있다. 그래서 `$trigger` 는 그 웹훅 요청 필드(`body`·`headers`·`query`·`method`)의 파생 뷰다. `ExecutionContext.triggerData` 필드를 두어 새 실행(`runExecution`)과 재구동 뒤 복원(`rehydrateContext`) 두 경로가 각각 `inputData` 에서 뽑아 넣는다. 모든 노드는 트리거 노드를 이름으로 참조하지 않고 `$trigger` 로 읽는다. `ExecutionContext` 필드 추가는 실행 컨텍스트 규약의 경계(핸들러가 읽는 표면을 최소로)와 부딪히지 않는다고 판단했다. `triggerData` 는 어떤 노드 핸들러도 직접 읽지 않고 **`execution-context.service`(넣기)와 `expression-resolver.service`(쓰기)만 접근하는 resolver 전용 파생 출처**이기 때문이다. resolver 가 채우고 일부 핸들러가 골라 쓰는 `ExecutionContext.expressionContext` 와 같은 계열의 최소 표면 필드이고, `$loop`·`$item` 처럼 실행 범위 데이터를 표현식에 노출하는 목적과도 맞는다(다만 `$loop`·`$item` 은 컨테이너 핸들러가 직접 쓴다). `parameters` 는 `$params`·`$input.parameters` 로 이미 노출하므로 `$trigger` 에 중복해 넣지 않는다. 이 필드가 규약의 `_` 접두 규칙을 따르는지는 [미결 사항](#미결-사항) 에서 다룬다.
- **헤더 가림은 기존 목록을 다시 쓴다**: `$trigger.headers` 의 민감 헤더 가림은 통합 노드가 이미 쓰는 `sanitizeResponseHeaders`(정확 일치와 부분 일치 차단 목록)를 다시 쓴다. 새 가림 목록을 만들지 않아 목록이 서로 어긋나는 것을 막는다.
- **빈 payload 는 `{}` 로 대신한다**: 수동·스케줄·Background 는 웹훅 요청이 없으므로 `$trigger = {}` 다. `undefined` 자체를 넣으면 평가기가 `EXPR_REFERENCE_ERROR` 를 던지므로 빈 객체를 넣어 `$trigger.body` 가 `undefined` 로 조용히 떨어지게 한다(optional chaining 과 잘 맞는다).
- **`$env` 는 허용 목록으로 연다(별도 모드 축을 만들지 않음)**: 결정 4A 는 "셀프 호스팅에서만 열기" 를 요구했다. 전역 `DEPLOYMENT_MODE` 축을 새로 만드는 대신 `EXPRESSION_ENV_ALLOWLIST`(배포 운영자만 설정하는 환경 변수)로 이룬다. SaaS 멀티테넌트는 이 값을 비워 `$env={}` 를 유지하고(비밀 노출 없음), 셀프 호스팅 운영자는 비밀이 아닌 키만 적는다. 운영자 단계의 허용이 곧 셀프 호스팅 게이트다(테넌트나 작성자는 환경 변수를 설정할 수 없다). "설정만으로 배포 방식 전환" 을 가장 작은 표면으로 만족한다. 허용 목록이라 비밀이 자동으로 노출될 위험이 없어 모드 축을 새로 만들어 얻을 이득이 적다.
