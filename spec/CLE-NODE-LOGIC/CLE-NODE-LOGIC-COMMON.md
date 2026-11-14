---
id: "CLE-NODE-LOGIC-COMMON"
title: "Logic 노드 공통"
type: "convention"
version: 11
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "6516361d6e9ebd56b0813553d943c0ab19f47b7a05e0db1cf1294276b24ee477"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/1-logic/0-common.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "425b3a1940ced7e0636f8fe3ba03d81563a7bb4b142dd53ebd744fd0e841f4df"
etag: "sha256-6cf7d912fe26114a7da62162f893b99352d5c2bb9833b1c7ede9721e0c3ba0ee"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/_product-overview.md` (§4 머리말) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Logic 노드는 경로 선택·반복·변수 관리 같은 프로그래밍식 제어를 맡는다. 이 문서는 Logic 카테고리 12종이 함께 따르는 규약을 정한다. 다루는 것은 조건 구조와 비교 연산자, 컨테이너 패턴, 리소스 제한, 동적 포트 ID, 설정 요약, 배열이 아닌 입력 처리, 패스스루 규약, 출력 구조 색인이다. 항목 에러 정책 · 반복 결과 출력 구조 · 노드 출력 사용 패턴 · 엔진 덮어쓰기 계약은 [하위 문서](#하위-문서) 가 정한다. [배열이 아닌 입력 처리](#배열이-아닌-입력-처리) 절은 Presentation 노드인 Chart 행도 담는다. 예외 표를 한 곳에 두기로 했기 때문이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#예외-표에서-정한-노드만-배열이-아닌-입력을-빈-배열로-바꾼다-2026-10-24)).

노드마다의 설정과 동작은 각 노드 문서가 정한다.

| 묶음 | 노드 |
|------|------|
| 조건 노드 | [If/Else 노드](CLE-NODE-IFELSE.md) · [Switch 노드](CLE-NODE-SWITCH.md) · [Filter 노드](CLE-NODE-FILTER.md) |
| 컨테이너 | [Loop 노드](CLE-NODE-LOOP.md) · [ForEach 노드](CLE-NODE-FOREACH.md) · [Map 노드](CLE-NODE-MAP.md) |
| 변수 노드 | [변수 선언 노드](CLE-NODE-VARDECL.md) · [변수 수정 노드](CLE-NODE-VARSET.md) |
| 데이터 노드 | [Split 노드](CLE-NODE-SPLIT.md) · [Merge 노드](CLE-NODE-MERGE.md) |
| 병렬·비동기 | [Parallel 노드](CLE-NODE-PARALLEL.md) · [Background 노드](CLE-NODE-BACKGROUND.md) |

범위 밖은 다음 문서가 정한다. 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다. 엔진이 컨테이너 본문을 도는 방식과 중첩 컨테이너 스코프는 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다. 캔버스의 컨테이너 표시·멤버십·삭제는 [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 가, 노드 공통 에러 처리 정책은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이, 표현식 문법과 엄격 비교의 타입 변환은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 가 정한다.

## 하위 문서

| 문서 | 다루는 것 | 맡는 요구사항 |
|------|-----------|---------------|
| [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md) | ForEach · Map · Parallel 의 항목 에러 정책, 반복 결과 출력 구조와 실패한 회차의 `error.code`, Logic 노드의 노드 출력 사용 패턴, 엔진 덮어쓰기 계약과 그 Rationale(Parallel `stop` 설명 정정 포함) | 없음 |

## 규칙

### 조건 구조

조건 노드는 단일 조건(Condition) 구조를 함께 쓴다. 코드 기준은 `conditionGroupSchema` (`if-else.schema.ts`) 와 평가 로직 `condition-evaluator.util.ts` 다.

| 필드 | 타입 | 설명 |
|------|------|------|
| field | Expression | 비교할 값(표현식). Filter 처럼 배열을 다루는 노드에서는 비우거나 `$item` 으로 현재 항목을 가리킨다 |
| operator | Enum | 비교 연산자. [비교 연산자](#비교-연산자) 표 참조 |
| value | Expression | 비교 대상 값. `is_empty`·`is_null` 같은 단항 연산자에서는 생략한다 |

1. 조건은 단일 평면 배열 `conditions: Condition[]` 에 저장한다.
2. 조건 여러 개는 노드 설정 최상위의 `combineMode` (`and` / `or`, 기본 `and`) 로 묶는다. 별도 `logicalOperator` 필드를 둔 2계층 그룹 구조는 없다. 문서에서 `ConditionGroup` 이라는 타입 이름을 쓰지 않는다.
3. If/Else 와 Filter 는 `conditions: Condition[]` · `combineMode` · `strictComparison` 을 직접 쓴다 (`if-else.schema.ts`, `filter.schema.ts`).
4. Switch 는 `conditions[]` 대신 `cases[]` 구조를 쓴다. expression 모드의 케이스마다 단일 `condition` 필드(위 조건 구조)가 있다 (`switch.schema.ts` `caseDefSchema`).
5. ForEach 는 조건 노드가 아니다. `arrayField` 와 `errorPolicy` 만 있다 (`foreach.schema.ts`).

### 비교 연산자

| 연산자 | 설명 |
|--------|------|
| `eq` | 같음 (==) |
| `neq` | 다름 (!=) |
| `gt` | 초과 (>) |
| `gte` | 이상 (>=) |
| `lt` | 미만 (<) |
| `lte` | 이하 (<=) |
| `contains` | 포함 (문자열) |
| `not_contains` | 미포함 (문자열) |
| `starts_with` | ~로 시작 |
| `ends_with` | ~로 끝남 |
| `is_empty` | 비어 있음 |
| `is_not_empty` | 비어 있지 않음 |
| `regex` | 정규식 매칭 |
| `is_null` | null 여부 |
| `is_type` | 타입 확인. 값은 `string` / `number` / `boolean` / `object` / `array` / `null` / `undefined` 가운데 하나 |

1. 비교 연산자는 If/Else, Switch expression 모드, Filter, Transform 노드의 `array_filter` 연산에서 똑같이 동작한다.
2. `is_type` 의 비교 값이 위 7개 타입 이름이 아니면 조건은 `false` 다.
3. 엄격 비교(`strictComparison`, 기본 `false`)를 켜면 타입 변환 없이 비교한다. 타입 변환 규칙과 엄격 모드 동작은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 의 strict 모드 절이 정한다.
4. `regex` 연산자는 사용자 패턴을 단일 헬퍼 `compileUserRegex` 로 컴파일한다. 이 헬퍼는 세 가지를 검사한다. 패턴 길이는 200자 이하여야 한다(기준 상수 `MAX_REGEX_LENGTH`, `condition-evaluator.util.ts`). `safe-regex` 가 위험하다고 본 패턴(지수 백트래킹, 예 `(a+)+$`)은 거부한다. 문법이 틀린 패턴도 거부한다.
5. 컴파일하지 못한 패턴(길이 초과·위험 패턴·문법 에러)은 에러를 던지지 않고 그 조건을 `false` 로 평가한다.
6. If/Else 와 Switch expression 모드는 `compileRegexCache` 로 조건(케이스)마다 정규식을 미리 컴파일해 평가기(`evaluateCondition(input, cond, { strict, regex })`)에 넘긴다. Filter 와 Transform `array_filter` 도 같은 경로를 쓴다.
7. Filter 는 거부한 패턴을 `meta.invalidRegexPatterns` 로 드러낸다. 자세한 형태는 [Filter 노드](CLE-NODE-FILTER.md) 가 정한다.

### 컨테이너 패턴

컨테이너(container)는 Loop · ForEach · Map 세 노드다. 셋 모두 컨테이너 본문(container body)을 반복 실행하고 `emit` 포트로 결과를 모으는 같은 실행 모델을 쓴다.

| 포트 | 방향 | 설명 |
|------|------|------|
| `in` | 입력 | 외부 데이터 진입 |
| `emit` | 입력 | 컨테이너 본문에서 결과를 모으는 지점. 본문 노드가 정확히 1개 연결돼야 한다 |
| `body` | 출력 | 컨테이너 본문 진입점. 반복 회차마다 첫 노드로 데이터를 넘긴다 |
| `done` | 출력 | 반복이 끝난 뒤 모은 결과를 다음 노드로 넘긴다 |

1. `emit` 포트에는 본문 노드가 정확히 1개 연결돼야 한다. 연결된 본문 노드가 없으면 에러 메시지가 `CONTAINER_MISSING_EMIT:` 으로 시작하는 에러로 실행이 실패한다. 본문 밖 노드만 `emit` 에 연결된 경우도 같다. 본문 노드가 2개 이상 연결되면 에러 메시지가 `CONTAINER_MULTIPLE_EMIT:` 으로 시작하는 에러로 실행이 실패한다. 두 이름은 `ErrorCode` enum 값이 아니고 에러 메시지의 접두사다(`execution-engine.service.ts`).
2. 컨테이너 본문 안에는 되돌아가는 연결선(순환)과 블로킹 노드(form / buttons / ai_conversation)를 둘 수 없다.
3. 캔버스는 이 세 노드를 컨테이너로 렌더링한다. 렌더링 형태와 멤버십(`containerId`) 규칙은 [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 가 정한다.
4. 실행 중에는 컨테이너 헤더에 현재 진행 인덱스를 표시한다(예: "Iteration 3/10", "Item 2/5"). 이 표시의 구현 여부는 [미결 사항](#미결-사항) 에 적었다.
5. 컨테이너가 중첩될 때의 스코프 규칙은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다.
6. Parallel 노드는 컨테이너가 아니다. 다만 엔진 덮어쓰기를 받는 노드(엔진 덮어쓰기 대상 노드)라서 [엔진 덮어쓰기 계약](CLE-NODE-LOGIC-COMMON-OUTPUT.md#엔진-덮어쓰기-계약) 을 함께 따른다.
7. Background 노드는 컨테이너가 아니다. `containerId` 멤버십을 쓰지 않고 `background` 출력 포트의 연결선으로 이어진 노드를 본문 진입점으로 본다. 그 진입점에서 앞으로 도달할 수 있는 노드 전체가 Background 본문이다. Background 본문은 fire-and-forget 으로 실행하고 결과가 메인 흐름으로 돌아오지 않는다. 자세한 동작은 [Background 노드](CLE-NODE-BACKGROUND.md) 가 정한다. 단서가 하나 있다. 컨테이너 본문 안 Background 의 본문 노드에도 에디터의 연결선 체인 규칙에 따라 그 컨테이너의 `containerId` 가 붙는다. 이 값은 위치 속성일 뿐이고 본문 범위는 여전히 `background` 포트 연결선으로 정한다. 워커는 그 컨테이너 단계 그래프로 본문을 실행한다([컨테이너 실행 §컨테이너 본문 안 Background](../CLE-EXEC/CLE-EXEC-CONTAINER.md#컨테이너-본문-안-background)).

### 항목 에러 정책

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#항목-에러-정책)

### 반복 결과 출력 구조

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#반복-결과-출력-구조)

### 리소스 제한

| 필드 | 노드 | 설명 |
|------|------|------|
| `maxIterations` | Loop | 최대 반복 횟수 제한. 기본 1000. 넘으면 `MAX_ITERATIONS_EXCEEDED` 에러를 던진다([Loop 노드](CLE-NODE-LOOP.md#에러)) |
| `maxConcurrency` | Parallel | 동시 실행 수 제한. `0` 은 `branchCount` 와 같다(모든 병렬 분기 동시 실행). `1`~`16` 은 그 수만큼 동시 실행. 기본 `0` (`parallel.schema.ts` 화면 힌트: "0 = same as branchCount, unlimited") |

### 동적 포트 ID 불변성

1. 정적 포트는 노드 정의의 고정 문자열이다(`in`, `out`, `true`, `false`, `body`, `done` 등).
2. 동적 포트(dynamic ports)는 설정 항목이 보유한 stable id 를 포트 ID 로 쓴다. id 는 slug 정규식 `^[a-zA-Z0-9_-]{1,64}$` 에 맞아야 한다. Switch 케이스처럼 Logic 노드는 사용자가 입력한 의미 있는 slug 를 쓴다.
3. 포트 이름 변경, 재정렬, 다른 포트 삭제 같은 편집을 해도 기존 포트 ID 는 바뀌지 않는다. 그래서 편집 뒤에도 포트에 연결된 연결선이 유지된다.
4. Logic 카테고리에서 동적 포트가 있는 노드는 Switch(케이스 ID)와 Parallel(`branch_<index>`)이다. If/Else 와 Filter 는 동적 포트가 없다.
5. 노드별 생성 방식(예: UUID v4 자동 발급)과 검증 기준은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 와 `port-id.util.ts` 가 정한다.

### 설정 요약

1. 노드마다의 설정 요약(configuration summary, `summaryTemplate`) 형식은 각 노드 문서의 `설정 요약` 절이 정한다. 그 절은 노드 스키마의 `summaryTemplate` 과 짝을 이룬다.
2. 캔버스에서 요약을 어디에 어떤 길이로 보여 주는지는 [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 가 정한다.
3. 현재 구현은 Logic 12종 가운데 Switch · Split · Map · Parallel 스키마에만 `summaryTemplate` 이 있다. 나머지 8종의 요약 표시 여부는 [미결 사항](#미결-사항) 에 적었다.
4. Map 과 Background 의 요약 형식은 Logic 공통 원문과 캔버스 원문이 서로 다르게 적는다. 정의가 갈린다. [미결 사항](#미결-사항) 참조.

### 노드 출력 사용 패턴

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#노드-출력-사용-패턴)

### 엔진 덮어쓰기 계약

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#엔진-덮어쓰기-계약)

### 배열이 아닌 입력 처리

[노드 출력 규약 Principle 10](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-10-비었거나-null-인-입력의-대체-값) 은 배열을 기대한 설정 필드에 배열이 아닌 값이 오면 throw 하라고 정한다. 예외 노드는 그 값을 `[]` 로 대체한다. 예외 노드와 노드별 처리 · 알림 방식은 다음 표가 정본이다.

| 노드 | 설정 필드 | `null` · `undefined` | 그 밖의 배열이 아닌 값(숫자 · 문자열 · 객체) | `meta.fellBackToEmpty` |
|------|-----------|----------------------|-----------------------------------------------|------------------------|
| [Split](CLE-NODE-SPLIT.md) | `fieldPath` | `[]` | `[]` | 대체하면 `true`, 아니면 `false` |
| [ForEach](CLE-NODE-FOREACH.md) | `arrayField` | `[]`. 본문 0회 실행 | `[]`. 본문 0회 실행 | 대체하면 `true`, 아니면 `false` |
| [Map](CLE-NODE-MAP.md) | `inputField` | `[]`. 본문 0회 실행 | `[]`. 본문 0회 실행 | 대체하면 `true`, 아니면 `false` |
| [Filter](CLE-NODE-FILTER.md) | `inputField` | `[]` | throw (`Filter inputField does not resolve to an array`) | `null` · `undefined` 를 대체할 때만 `true` |
| [Chart](../CLE-NODE-PRES/CLE-NODE-CHART.md) | `dataField` | `[]` | `[]` | 싣지 않는다 |

`meta.fellBackToEmpty` 가 `true` 가 되는 조건은 노드마다 다르다(표의 `meta.fellBackToEmpty` 열).

1. 예외 노드는 Split · ForEach · Map 과 Chart 다. Chart 를 예외로 둔 이유는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#예외-표에서-정한-노드만-배열이-아닌-입력을-빈-배열로-바꾼다-2026-10-24) 의 Rationale 「예외 표에서 정한 노드만 배열이 아닌 입력을 빈 배열로 바꾼다」 에 있다.
2. 이 표와 Principle 10 은 노드가 배열을 돌거나 나누려고 설정 경로로 꺼낸 값이 배열이 아닐 때 `[]` 로 대체할지 throw 할지를 다룬다. 값을 대체하지 않는 다음 처리는 Principle 10 의 대상이 아니다.
   - 입력 전체를 정규화하는 처리. Merge 가 배열이 아닌 입력을 `[input]` 으로 감싸는 동작은 [Merge 노드](CLE-NODE-MERGE.md) 가 정한다. Chart 가 `dataField` 없이 입력 자체를 배열로 쓰는 동작은 [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md) 가 정한다.
   - 단일 값을 한 항목 배열로 감싸는 정규화. [Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md) 의 `source` 와 [Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md) 의 `dataSource` 가 그렇다.
   - 대상이 배열이 아니면 연산을 건너뛰는 처리. [Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) 의 `array_filter` · `array_sort` 가 그렇다.
3. 규칙 2 의 범위에 드는 새 노드는 기본 규칙(throw)을 따른다. 예외로 두려면 이 표에 행을 더하고 그 노드 문서의 Rationale 에 이유를 적는다.

### 패스스루 규약

다음 5종 Logic 노드는 `output = input` (변형 없음) 패스스루(pass-through) 계약을 따른다.

| 노드 | 경로 선택 방식 | 부가 정보 위치 |
|------|----------------|---------------|
| `if_else` | `port: 'true' \| 'false'` | `meta.conditionResult`, `meta.matchedConditions` |
| `switch` | `port: <케이스 ID> \| 'default'` | `meta.matchedCase`, `meta.matchedCaseLabel`, `meta.matchedCaseIndex`, `meta.resolvedValue` |
| `variable_declaration` | 단일 출력 | `meta.declared[]`, `meta.skipped[]`, `meta.coercionWarnings[]` |
| `variable_modification` | 단일 출력 | `meta.modifications[]`, `meta.coercionWarnings[]`, `meta.createdVariables[]` |
| `background` (`main` 포트) | `main` (즉시). `background` 포트는 엔진이 Background 본문 진입 때 따로 활성화한다 | `meta.backgroundRunId` |

1. 패스스루 노드는 입력을 바꾸지 않고 경로 선택과 부가 정보를 `port` 와 `meta` 에만 싣는다.
2. Filter 는 패스스루 노드가 아니다. `output.match` / `output.unmatched` 는 입력 배열의 부분집합이지 입력 자체가 아니다.

### 출력 구조 색인

| 노드 | 정상·경로 선택 케이스 | 엔진 덮어쓰기 | 비고 |
|------|----------------------|---------------|------|
| [if_else](CLE-NODE-IFELSE.md#출력-구조) | `true` / `false` | 없음 | 패스스루 |
| [switch](CLE-NODE-SWITCH.md#출력-구조) | 케이스 ID / `default` | 없음 | 패스스루, 동적 포트 |
| [loop](CLE-NODE-LOOP.md#출력-구조) | 시작 / `done` | `{ iterations, count }` | 컨테이너 |
| [variable_declaration](CLE-NODE-VARDECL.md#출력-구조) | 단일 | 없음 | 패스스루 |
| [variable_modification](CLE-NODE-VARSET.md#출력-구조) | 단일 | 없음 | 패스스루 |
| [split](CLE-NODE-SPLIT.md#출력-구조) | 단일 | 없음 | 데이터 노드 |
| [map](CLE-NODE-MAP.md#출력-구조) | 시작 / `done` | `{ mapped, count }` | 컨테이너 |
| [filter](CLE-NODE-FILTER.md#출력-구조) | `match` 와 `unmatched` 동시 활성화 | 없음 | 데이터 변형 |
| [foreach](CLE-NODE-FOREACH.md#출력-구조) | 시작 / `done` | `{ items, count, skipped? }` | 컨테이너 |
| [parallel](CLE-NODE-PARALLEL.md#출력-구조) | 시작(병렬 분기 N개) / `done` | `{ branches, count, skipped? }` | 엔진 덮어쓰기 대상 노드 |
| [merge](CLE-NODE-MERGE.md#출력-구조) | 단일 | 없음 | 데이터 노드 |
| [background](CLE-NODE-BACKGROUND.md#출력-구조) | `main` / `background` | 없음 | fire-and-forget, 컨테이너 아님 |

## 미결 사항

- **설정 요약이 8종에서 표시되지 않는다** (warning): 노드 문서의 `설정 요약` 절은 12종 모두의 형식을 정하지만 프론트엔드는 `summaryTemplate` 이 없으면 요약을 그리지 않는다([설정 요약](#설정-요약) 3번). If/Else · Loop · 변수 선언 · 변수 수정 · Filter · ForEach · Merge · Background 의 요약은 지금 보이지 않는다. 옛 캔버스 문서의 노드별 요약 표는 `summaryTemplate` 이 없는 AI 에이전트 · 정보 추출기 행에 "미구현(Planned)" 을 붙였지만 이 8종에는 붙이지 않았다. 형식을 구현할지 노드 문서에서 미구현으로 표시할지 결정 필요. (관련: [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md#설정-요약))
- **Map · Background 의 설정 요약 형식이 원문끼리 갈린다** (warning): Logic 공통 원문의 요약 표와 옛 캔버스 문서의 노드별 요약 표가 두 노드에서 다른 형식을 적는다. [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md#설정-요약) 에는 이 표가 없고 카테고리 공통 형식을 이 문서에 맡긴다. [Map 노드](CLE-NODE-MAP.md) 는 캔버스 원문 형식을, [Background 노드](CLE-NODE-BACKGROUND.md) 는 Logic 공통 원문 형식을 옮겨 적었다. 두 노드의 형식을 무엇으로 할지 결정 필요.

  | 노드 | Logic 공통 원문 | 옛 캔버스 문서 | 현재 구현 |
  |------|----------------|---------------|-----------|
  | Map | `{N} mappings` (예 `3 mappings`) | `{inputField}` (예 `$input.items`) | `map.schema.ts` 의 `summaryTemplate` 은 `{{inputField}}` 다. Map 설정에는 매핑 개수를 담는 필드가 없다 |
  | Background | `notifyOnFailure` · `maxDurationMs` 요약. 알림이 꺼져 있으면 시간만 (예 `notify on fail · 5m`) | 알림 채널 (예 `notify: in_app, email`) | `summaryTemplate` 이 없다. 설정은 불리언 `notifyOnFailure` 하나이고 알림은 인앱으로만 보낸다. 이메일 채널은 없다([컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#background-본문-실행)) |

  나머지 Logic 노드는 두 표의 형식이 같다. 다만 옛 캔버스 표에는 Filter 행이 없고 If/Else 는 첫 조건만 적고 `combineMode` 표시를 적지 않는다.
- **실행 중 컨테이너 헤더의 진행 인덱스** (info): 이 문서와 Loop · Map 문서는 실행 중 헤더에 "Iteration 3/10" 같은 진행 인덱스를 보인다고 적는다. [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 의 컨테이너 절에는 이 요소가 없고 프론트엔드 캔버스 코드에서도 찾지 못했다. 캔버스 문서에 정의할지 미구현으로 표시할지 결정 필요.
- **`skip` 과 `continue` 의 차이** (info): 노드 PRD 는 두 값을 다른 정책으로 보여 주지만 결과 형태는 같고 `continue` 가 노드 실행 기록에도 에러를 남긴다는 차이만 있다. 관측할 수 있는 차이를 더 적을지 하나로 합칠지 결정 필요.
- **완료 출력의 `port` 가 노드 출력 규약 Principle 5 와 맞지 않는다** (info): [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 5 는 `port: undefined` 를 노드 정의상 출력이 1개인 노드에, `port: string[]` 을 Parallel 핸들러와 텍스트 분류기에 둔다. Loop · ForEach · Map 은 출력 포트가 `body` 와 `done` 둘인데 완료 출력에 `port` 가 없다. 이 사실은 `execution-engine.service.ts` 의 컨테이너 완료 처리에서 확인했다. 규약과 이 문서 가운데 어느 쪽을 고칠지 결정 필요. Parallel 의 완료 `port` 는 [노드 출력 사용 패턴](CLE-NODE-LOGIC-COMMON-OUTPUT.md#노드-출력-사용-패턴) 표대로 `'done'` 문자열로 정했다(2026-11-01, [Parallel 노드](CLE-NODE-PARALLEL.md#완료-출력-port-는-done-문자열이다-2026-11-01)). 구현도 `'done'` 문자열을 싣는다.
- **완료 덮어쓰기가 노드 실행 기록에 남지 않는다** (warning): [엔진 덮어쓰기 계약](CLE-NODE-LOGIC-COMMON-OUTPUT.md#엔진-덮어쓰기-계약) 규칙 3 은 실행 기록 · 이벤트와 재개 · 재구동 때의 rehydration 에서 시작 시점 배열을 감추는 부분을 미구현으로 적는다. 현재 구현은 Loop · ForEach · Map · Parallel 모두 완료 때 실행 컨텍스트의 출력만 바꾸고 노드 실행 기록(`node_execution.output_data`)은 갱신하지 않는다. 그래서 Map · ForEach 의 실행 기록에는 시작 시점의 `output: items[]` 와 핸들러 `meta` 만 남고 완료 출력과 엔진이 합친 `meta.iterations` · `meta.skippedCount` 는 없다. park 뒤 재개와 크래시 뒤 재구동의 rehydration 경로도 이 저장값을 복원한다. 이전 실행의 직속 상류 출력을 복원하는 단일 노드 실행과 캔버스 · 실행 트리의 실행 시간 표시도 이 저장값을 읽는다([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md)). 그래서 다음 노드 표현식은 rehydration 뒤에 시작 시점 값을 본다(2026-10-24 e2e 실행으로 확인). 이 갭은 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md#park-즉시-해제와-rehydration-단일-경로-phase-b) 의 rehydration 단일 경로 · 무손실 전제를 어기므로 설계 변경이 아니라 결함으로 둔다. ForEach · Map 의 `done` 포트 뒤에 Form · Carousel 같은 입력 대기 노드가 오면 재개 뒤의 노드부터 이 경로에 닿는다. 실행 기록을 완료 출력으로 갱신할지 규칙 3 을 실제에 맞게 고칠지 결정 필요. 규칙 3 을 고치는 쪽이면 그 전제와 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 의 rehydration 기준 문장도 함께 고친다. 후속 작업은 NERV Task `CLE-T-JXD0W5` 가 맡는다.

## 구현 위치

- `codebase/backend/src/nodes/logic/_shared/*.ts`
- `codebase/backend/src/nodes/logic/*/*.handler.ts`
- `codebase/backend/src/nodes/logic/*/*.schema.ts`
- `codebase/backend/src/nodes/core/condition-evaluator.util.ts` (조건 평가, `compileUserRegex`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (엔진 덮어쓰기)

## Rationale

### 패스스루로 두는 이유

패스스루 5종의 "비즈니스 결과물"은 입력 자체가 아니라 경로가 나뉜 데이터 흐름이다. 입력을 바꾸지 않고 흘려보내고 경로와 부가 정보만 `port` · `meta` 에 담으면 Map · Transform 처럼 데이터를 바꾸는 노드의 계약과 뚜렷하게 구분된다.

### 정규식을 한 헬퍼에서 안전하게 컴파일한다

길이 200자 제한만으로는 ReDoS 를 막지 못한다. 200자 안에서도 `(a+)+$` 같은 지수 백트래킹 패턴을 만들 수 있고 이런 패턴은 워커를 무기한 붙잡을 수 있다. 그래서 `safe-regex` 검사를 1차 방어로 두고 길이 제한은 분석 비용과 남은 위험을 줄이는 2차 방어로 둔다. 같은 정책을 If/Else · Switch · Filter 가 따로 적던 것을 이 문서 한 곳으로 모으고 구현도 단일 헬퍼 `compileUserRegex` 로 모았다.

### 시작 시점 배열을 엔진 내부 표현으로 둔다

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#시작-시점-배열을-엔진-내부-표현으로-둔다)

### ForEach 와 Map 의 실패 표현을 다르게 둔다

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#foreach-와-map-의-실패-표현을-다르게-둔다)

### 컨테이너의 범위

[용어 사전 — 워크플로우 작성](../CLE-GLOSSARY-WF.md) 의 「컨테이너」 행은 컨테이너를 Loop · ForEach · Map 세 노드로 정했다(구분 표기는 [용어 사전 — 다의어 구분](../CLE-GLOSSARY-POLY.md), 결정은 [용어 사전 — 결정이 필요한 표기](../CLE-GLOSSARY-OPEN.md) 의 「컨테이너의 범위」 항목(D17)). 원문은 Parallel 과 Background 도 컨테이너로 불렀다. Parallel 은 캔버스 멤버십(`containerId`)이 없고 엔진 덮어쓰기만 함께 받으므로 "엔진 덮어쓰기 대상 노드" 로 부른다. Background 는 멤버십도 덮어쓰기도 없으므로 컨테이너로 부르지 않는다.

### Logic 노드의 에러 처리 정책 선택지를 막지 않는다 (2026-10-24)

옛 노드 문서 12종은 런타임 에러 포트가 없다고 적었고 [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md) 은 어떤 노드든 "에러 포트로 라우팅" 을 고르면 에러 포트가 생긴다고 적었다. 현재 설정 패널과 엔진은 노드 카테고리를 가리지 않고 다섯 정책을 모두 받는다. 그래서 현행대로 Logic 노드도 다섯 정책을 모두 고를 수 있게 둔다. 동적 에러 포트가 구현되기 전까지 "에러 포트로 라우팅" 은 연결선이 없을 때 규칙대로 워크플로우 중단으로 대신 처리한다.

기각한 대안은 두 가지다.

- Logic 노드에서 에러 처리 정책을 막는 안. 설정 패널과 엔진에 카테고리 검사를 새로 넣어야 하고, 이미 정책을 저장한 워크플로우를 어떻게 다룰지도 정해야 한다.
- "에러 포트로 라우팅" 만 막는 안. 동적 에러 포트가 구현되면 다시 열어야 하고, 그 전에도 연결선이 없을 때 규칙으로 동작이 정해져 있다.

### 배열이 아닌 입력 예외 노드를 이 문서에 모은다 (2026-10-24)

예외 목록을 이 문서 한 곳에 두는 이유와 기각한 대안은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#예외-표에서-정한-노드만-배열이-아닌-입력을-빈-배열로-바꾼다-2026-10-24) 에 있다. Chart 를 예외에 넣은 이유도 거기에 있다. 이 문서는 노드별 처리를 표로 정한다. Merge 는 설정 경로로 값을 꺼내지 않고 입력 전체를 정규화하므로 표에 넣지 않았다.

표는 설정 경로로 꺼낸 값을 `[]` 로 대체하는 노드만 담는다. 아래 노드는 값을 감싸거나 다른 입력을 쓰거나 연산을 건너뛴다. 2026-10-10 결정의 "다른 노드는 throw 한다" 를 글자 그대로 따르면 이 노드들도 throw 로 바꿔야 하지만 이 개정은 지금 동작을 그대로 두었다. 그 근거는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#예외-표에서-정한-노드만-배열이-아닌-입력을-빈-배열로-바꾼다-2026-10-24) 에 있다.

- Carousel 의 `source`: 값이 배열이 아니면 `source` 대신 입력을 쓴다. 입력도 배열이 아니면 `null` · `undefined` 가 아닌 값은 `[입력]` 으로 감싸고 `null` · `undefined` 는 `[]` 로 둔다.
- Table 의 `dataSource`: 값이 `null` · `undefined` 면 입력을 쓴다. 쓰는 값이 배열이 아니면 `[값]` 으로 감싼다.
- Transform 의 `array_filter` · `array_sort` 연산: 대상 필드가 배열이 아니면 그 연산을 적용하지 않고 `meta.operationsSkipped` 에 센다. 이 처리의 근거는 [Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md#런타임-무결성-실패를-no-op-으로-처리) 의 Rationale 「런타임 무결성 실패를 no-op 으로 처리」 에 있다.

기각한 대안은 두 가지다.

- 이 노드들도 예외 표에 올리는 안. 처리 방식이 표와 맞지 않는다. 표에 올려 달라는 요구도 없다.
- 이 노드들도 throw 하게 바꾸는 안. 지금 성공하는 워크플로우가 실패하게 되고 동작을 바꿔 달라는 요구도 없다.

### 실패한 회차와 병렬 분기의 `error.code` (2026-11-05)

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#실패한-회차와-병렬-분기의-errorcode-2026-11-05)

### Parallel `stop` 설명을 실행기 동작에 맞춘다 (2026-11-06)

→ [Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기](CLE-NODE-LOGIC-COMMON-OUTPUT.md#parallel-stop-설명을-실행기-동작에-맞춘다-2026-11-06)
