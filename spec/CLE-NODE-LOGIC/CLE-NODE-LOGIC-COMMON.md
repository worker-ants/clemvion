---
id: "CLE-NODE-LOGIC-COMMON"
title: "Logic 노드 공통"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "070bf42e213d0f11bafbdffeef9810cf6cb8001bd9ae172bc5b9c33e50ff628f"
read_as: "approved_fallback"
task: "CLE-T-V0JAG1"
source_paths: ["spec/4-nodes/1-logic/0-common.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "ee27d4bcbc60f8b3227cdb0bc1c079d686f2f1294fed7aec82810d59c72bde57"
etag: "sha256-e276e59e22075167b27b9df88c24412a197f95ba317688649393a180c6b47719"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/_product-overview.md` (§4 머리말) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Logic 노드(Logic nodes)는 데이터 흐름의 경로 선택·반복·변수 관리 같은 프로그래밍식 제어를 맡는다. 이 문서는 Logic 카테고리 12종이 함께 따르는 규약을 정한다. 다루는 것은 조건 구조와 비교 연산자, 컨테이너 패턴, 항목 에러 정책, 반복 결과 출력 구조, 리소스 제한, 동적 포트 ID, 노드 출력 사용 패턴과 엔진 덮어쓰기 계약, 패스스루 규약이다.

노드마다의 설정과 동작은 각 노드 문서가 정한다.

| 묶음 | 노드 |
|------|------|
| 조건 노드 | [If/Else 노드](CLE-NODE-IFELSE.md) · [Switch 노드](CLE-NODE-SWITCH.md) · [Filter 노드](CLE-NODE-FILTER.md) |
| 컨테이너 | [Loop 노드](CLE-NODE-LOOP.md) · [ForEach 노드](CLE-NODE-FOREACH.md) · [Map 노드](CLE-NODE-MAP.md) |
| 변수 노드 | [변수 선언 노드](CLE-NODE-VARDECL.md) · [변수 수정 노드](CLE-NODE-VARSET.md) |
| 데이터 노드 | [Split 노드](CLE-NODE-SPLIT.md) · [Merge 노드](CLE-NODE-MERGE.md) |
| 병렬·비동기 | [Parallel 노드](CLE-NODE-PARALLEL.md) · [Background 노드](CLE-NODE-BACKGROUND.md) |

범위 밖은 다음 문서가 정한다. 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다. 엔진이 컨테이너 본문을 도는 방식과 중첩 컨테이너 스코프는 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다. 캔버스의 컨테이너 표시·멤버십·삭제는 [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 가, 노드 공통 에러 처리 정책은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이, 표현식 문법과 엄격 비교의 타입 변환은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 가 정한다.

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
4. `regex` 연산자는 사용자 패턴을 단일 헬퍼 `compileUserRegex` 로 컴파일한다. 이 헬퍼는 세 가지를 검사한다. 패턴 길이는 200자 이하여야 한다. `safe-regex` 가 위험하다고 본 패턴(지수 백트래킹, 예 `(a+)+$`)은 거부한다. 문법이 틀린 패턴도 거부한다.
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
6. Parallel 노드는 컨테이너가 아니다. 다만 엔진 덮어쓰기를 받는 노드(엔진 덮어쓰기 대상 노드)라서 [엔진 덮어쓰기 계약](#엔진-덮어쓰기-계약) 을 함께 따른다.
7. Background 노드는 컨테이너가 아니다. `containerId` 멤버십을 쓰지 않고 `background` 출력 포트의 연결선으로 이어진 노드를 본문 진입점으로 본다. 그 진입점에서 앞으로 도달할 수 있는 노드 전체가 Background 본문이다. Background 본문은 fire-and-forget 으로 실행하고 결과가 메인 흐름으로 돌아오지 않는다. 자세한 동작은 [Background 노드](CLE-NODE-BACKGROUND.md) 가 정한다.

### 항목 에러 정책

항목 에러 정책(item error policy, `config.errorPolicy`)은 반복 항목이나 병렬 분기 하나가 실패할 때의 동작이다. enum 값은 노드마다 다르다.

1. `config.errorPolicy` 는 ForEach · Map · Parallel 전용이다. Loop 에는 이 필드가 없다.
2. 일반 노드의 에러 처리 정책은 별개 설정인 `config.errorHandling.{policy, retryConfig, defaultOutput}` (5값 enum)이다. 자세한 규칙은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이 정한다.
3. 한 노드에서 `config.errorPolicy` 와 `config.errorHandling` 을 같은 뜻으로 섞어 쓰지 않는다. ForEach · Map · Parallel 에는 두 키가 함께 있을 수 있다. 현재 구현은 이 세 노드의 `config.errorHandling` 을 그 노드의 핸들러 호출이 실패할 때만 적용한다. 반복 회차나 병렬 분기를 실행하는 단계에서 그 노드 자신이 실패하면 `config.errorHandling` 을 적용하지 않는다. 다만 Parallel 은 `config.errorPolicy` 가 비었을 때만 `config.errorHandling.policy` 를 읽어 항목 에러 정책 값으로 바꿔 쓴다([Parallel 노드](CLE-NODE-PARALLEL.md)). 자세한 동작은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이 정한다. Logic 노드에 에러 처리 정책을 허용할지는 [미결 사항](#미결-사항) 에 있다.
4. 설정 패널은 ForEach · Map · Parallel 의 `config.errorPolicy` 를 에러 처리 정책으로 옮기지 않는다. 저장할 때 지우지도 않는다. 다른 노드에서 이 키를 옛 키로 보고 옮기는 규칙과 결정 근거는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유) 에 있다.

**Map / ForEach** — `stop` / `skip` / `continue` (`map.schema.ts`, `foreach.schema.ts`):

| 값 | 동작 |
|------|------|
| `stop` (기본) | 즉시 실행 실패 |
| `skip` | 실패한 인덱스에 자리를 지키는 값을 두고 실패 정보는 노드별 위치로 보낸다. ForEach 는 `output.items[i] = null` 과 `output.skipped[]`, Map 은 `output.mapped[i] = { _skipped: true, error }` 인라인 표시다 |
| `continue` | 에러가 난 항목도 결과에 포함하고 `skip` 과 같은 위치로 정보를 보낸다. 노드 실행 기록에도 에러를 남긴다 |

**Parallel** — `stop` / `continue` / `cancel-others-on-fail` (`parallel.schema.ts`, `skip` 없음):

| 값 | 동작 |
|------|------|
| `stop` (기본) | 첫 병렬 분기가 실패하면 에러를 던진다(Parallel 노드 실패) |
| `continue` | 모든 병렬 분기가 끝나기를 기다리고 실패한 분기는 `output.branches[i].error` 로 모은다 |
| `cancel-others-on-fail` | 첫 실패에서 진행 중인 다른 병렬 분기를 `AbortSignal` 로 중단한다. signal 을 받는 노드만 일찍 정리하는 best-effort 동작이다 |

ForEach 의 결과 분리 형태는 [ForEach 노드](CLE-NODE-FOREACH.md), Map 의 인라인 표시 형태는 [Map 노드](CLE-NODE-MAP.md) 가 정한다. 두 노드가 다른 형태를 쓰는 이유는 [Rationale](#rationale) 에 있다. 결과 배열이 원본 인덱스를 지키는 규칙은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다.

### 반복 결과 출력 구조

엔진 덮어쓰기 대상 노드는 `{ <컬렉션 키>, count }` 형태로 결과를 내보낸다 ([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 컨테이너 출력 절).

| 노드 | 컬렉션 키 |
|------|-----------|
| Loop | `iterations` |
| Map | `mapped` |
| ForEach | `items` |
| Parallel | `branches` |

1. 다음 노드는 `$node["X"].output.<컬렉션 키>[i]` 로 개별 결과를, `$node["X"].output.count` 로 실행된 개수를 읽는다.
2. 컬렉션 키는 네 노드가 모두 다르다. 같은 키를 두 노드가 함께 쓰지 않는다.

### 리소스 제한

| 필드 | 노드 | 설명 |
|------|------|------|
| `maxIterations` | Loop | 최대 반복 횟수 제한. 기본 1000. 넘으면 에러 |
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

Logic 노드는 모두 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 노드 출력(`NodeHandlerOutput`) 5필드 `{ config, output, meta?, port?, status? }` 를 따른다. Logic 카테고리에서 각 필드를 쓰는 방식은 다음과 같다.

| 필드 | Logic 카테고리에서의 사용 |
|------|---------------------------|
| `config` | 설정 에코(config echo). `conditions[]` 같은 표현식 `{{ }}` 은 평가 전 형태로 남긴다. Logic 카테고리에는 자격 증명·민감 필드가 없다 |
| `output` | If/Else · Switch · 변수 선언 · 변수 수정 · Background(`main` 포트)는 입력을 그대로 넘긴다([패스스루 규약](#패스스루-규약)). Filter 는 입력 배열을 두 부분집합으로 나눈 결과다. 엔진 덮어쓰기 대상 노드(loop, foreach, map, parallel)는 [엔진 덮어쓰기 계약](#엔진-덮어쓰기-계약) 을 따른다. Split · Merge 는 계산 결과다 |
| `meta` | 실행 메트릭만 싣는다. 반복 계열은 `meta.iterations?` / `branches?` / `matchedCount?`, 조건 노드는 `meta.conditionResult?` / `matchedConditions?`. 엔진은 모든 노드에 `meta.durationMs` 를 주입한다 |
| `port` | If/Else 는 `'true'` / `'false'`, Switch 는 케이스 ID 또는 `'default'`, Background 는 `'main'`. Parallel 은 시작할 때 `string[]`(병렬 분기 전부), 끝날 때 `'done'`. Loop · ForEach · Map 은 노드 출력에 `port` 를 싣지 않고 엔진이 `done` 연결선을 활성화한다. Filter 는 `port` 없이 두 포트를 모두 활성화한다. 출력이 하나인 노드는 `undefined` |
| `status` | Logic 노드는 모두 블로킹하지 않으므로 `undefined` 다 |

### 엔진 덮어쓰기 계약

엔진 덮어쓰기(engine override)를 받는 노드는 Loop · ForEach · Map · Parallel 이다. 이 노드들의 노드 출력은 시점마다 `output` 이 다르다.

1. **시작 시점**(본문 진입 직전): 핸들러가 한 번 실행된다. ForEach 와 Map 은 `output: items[]` 를 반환하고 엔진은 이 배열을 본문 반복 회차 입력으로 나눠 준다. Loop 와 Parallel 은 `output: null` 을 반환한다.
2. **완료 시점**(모든 반복 회차가 끝난 뒤): 엔진이 핸들러를 다시 부르지 않고 `output` 을 `{ <컬렉션 키>: [...], count: N }` 으로 직접 덮어쓴다. 핸들러는 두 번째로 호출되지 않는다.
3. 시작 시점의 `output: items[]` 는 엔진 안에서만 쓰는 중간 표현이다. 본문에 나눠 준 직후 덮어쓰기로 교체되므로, 다음 노드 표현식(`$node["X"].output.*`)과 외부 관찰자(실행 내역 API, 웹훅 페이로드 등) 어디에도 이 배열이 드러나지 않는다.
4. 다음 노드는 `done` 포트 뒤에서 항상 `{ <컬렉션 키>, count }` 형태를 본다.
5. 덮어쓰기는 `output` 만 바꾼다. `config` 는 핸들러가 반환한 그대로 남는다.

| 노드 | 컬렉션 키 | 시작 시점 `output` (핸들러 반환) | 완료 시점 `output` (엔진 덮어쓰기) |
|------|-----------|--------------------|----------------------------------------|
| `loop` | `iterations` | `null` (Loop 는 입력을 나눠 주지 않는다) | `{ iterations: [...], count }` |
| `foreach` | `items` | `items[]` (본문 입력 분배) | `{ items: [...], count }` |
| `map` | `mapped` | `items[]` (본문 입력 분배) | `{ mapped: [...], count }` |
| `parallel` | `branches` | `null` (병렬 분기마다 같은 입력) | `{ branches: [...], count }` |

```mermaid
flowchart LR
  A[핸들러 한 번 호출] --> B[시작 시점 output]
  B --> C[엔진이 반복 회차나 병렬 분기 실행]
  C --> D[엔진이 output 덮어쓰기]
  D --> E[done 연결선 활성화]
  E --> F[다음 노드가 컬렉션 키와 count 를 읽음]
```

ForEach 와 Map 은 `null` 이 아닌 배열을 반환하는데도 엔진이 덮어쓴다. 이 점이 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 덮어쓰기 규칙과 정의가 갈린다. [미결 사항](#미결-사항) 참조.

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
| [foreach](CLE-NODE-FOREACH.md#출력-구조) | 시작 / `done` | `{ items, count }` | 컨테이너 |
| [parallel](CLE-NODE-PARALLEL.md#출력-구조) | 시작(병렬 분기 N개) / `done` | `{ branches, count }` | 엔진 덮어쓰기 대상 노드 |
| [merge](CLE-NODE-MERGE.md#출력-구조) | 단일 | 없음 | 데이터 노드 |
| [background](CLE-NODE-BACKGROUND.md#출력-구조) | `main` / `background` | 없음 | fire-and-forget, 컨테이너 아님 |

## 미결 사항

- **엔진 덮어쓰기 규칙이 노드 출력 규약과 갈린다** (critical): [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 컨테이너 절은 "핸들러가 `output: null` 을 반환하면 엔진이 반드시 덮어쓰고 `null` 이 아닌 값을 반환하면 덮어쓰지 않는다" 고 적는다. 이 문서와 [ForEach 노드](CLE-NODE-FOREACH.md) · [Map 노드](CLE-NODE-MAP.md) 는 핸들러가 `items[]` 를 반환해도 엔진이 완료 시점에 덮어쓴다고 적는다. 현재 구현(`execution-engine.service.ts` 의 컨테이너 완료 처리)은 ForEach · Map 도 덮어쓴다. 규약 쪽을 "엔진 덮어쓰기 대상 노드는 반환값과 무관하게 덮어쓴다" 로 고칠지 결정 필요.
- **비배열·원시값 입력 처리가 노드 출력 규약과 갈린다** (critical): [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 빈 입력 절은 배열이 와야 할 자리가 `null`/`undefined` 면 `[]` 로 대체하고 숫자·문자열이면 에러를 던지라고 정한다. 노드별 현행 서술은 다음과 같고 대부분 그 절을 근거로 인용한다. 문자열이 들어오면 규약대로는 실패하고 노드 문서대로는 조용히 0회 실행된다. 규약에 노드별 예외를 적을지 노드 문서와 구현을 규약에 맞출지 결정 필요.

  | 노드 | 비배열·원시값 입력 처리 |
  |------|----------------------|
  | [Split](CLE-NODE-SPLIT.md) | 배열이 아니면 모두 `[]` 로 대체하고 `meta.fellBackToEmpty: true` |
  | [Map](CLE-NODE-MAP.md) | 배열이 아니면 모두 `[]` 로 대체. 본문 0회 실행 |
  | [ForEach](CLE-NODE-FOREACH.md) | 배열이 아니면 모두 `[]` 로 대체 |
  | [Filter](CLE-NODE-FILTER.md) | `null`/`undefined` 만 `[]` 로 대체. 문자열·숫자·객체는 에러 (규약과 같음) |
  | [Merge](CLE-NODE-MERGE.md) | `null`/`undefined`/원시값을 `[input]` 으로 감싼다 |

- **Logic 노드에 에러 처리 정책이 적용되는가** (warning): Logic 노드 문서 12종은 모두 런타임 에러 포트가 없다고 적는다. [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md) 의 포트 표는 Loop · Map · ForEach · Background 에 "(+error)" 를 붙이고 에러 처리 정책이 "에러 포트로 라우팅" 이면 어떤 노드에든 에러 포트가 생긴다고 적는다. Logic 노드에서 `config.errorHandling` (특히 에러 포트로 라우팅)을 허용하는지 결정 필요. [노드 포트와 설정 패널 미결 사항](../CLE-WF/CLE-WF-NODEPANEL.md#미결-사항) 은 이 결정을 이 문서에 맡겼다.
- **설정 요약이 8종에서 표시되지 않는다** (warning): 노드 문서의 `설정 요약` 절은 12종 모두의 형식을 정한다. 현재 구현은 Switch · Split · Map · Parallel 스키마에만 `summaryTemplate` 이 있고 프론트엔드는 `summaryTemplate` 이 없으면 요약을 그리지 않는다. If/Else · Loop · 변수 선언 · 변수 수정 · Filter · ForEach · Merge · Background 의 요약은 지금 보이지 않는다. 옛 캔버스 문서의 노드별 요약 표는 `summaryTemplate` 이 없는 AI 에이전트 · 정보 추출기 행에 "미구현(Planned)" 을 붙였지만 이 8종에는 붙이지 않았다. 형식을 구현할지 노드 문서에서 미구현으로 표시할지 결정 필요. (관련: [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md#설정-요약))
- **Map · Background 의 설정 요약 형식이 원문끼리 갈린다** (warning): Logic 공통 원문의 요약 표와 옛 캔버스 문서의 노드별 요약 표가 두 노드에서 다른 형식을 적는다. [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md#설정-요약) 에는 이 표가 없고 카테고리 공통 형식을 이 문서에 맡긴다. [Map 노드](CLE-NODE-MAP.md) 는 캔버스 원문 형식을, [Background 노드](CLE-NODE-BACKGROUND.md) 는 Logic 공통 원문 형식을 옮겨 적었다. 두 노드의 형식을 무엇으로 할지 결정 필요.

  | 노드 | Logic 공통 원문 | 옛 캔버스 문서 | 현재 구현 |
  |------|----------------|---------------|-----------|
  | Map | `{N} mappings` (예 `3 mappings`) | `{inputField}` (예 `$input.items`) | `map.schema.ts` 의 `summaryTemplate` 은 `{{inputField}}` 다. Map 설정에는 매핑 개수를 담는 필드가 없다 |
  | Background | `notifyOnFailure` · `maxDurationMs` 요약. 알림이 꺼져 있으면 시간만 (예 `notify on fail · 5m`) | 알림 채널 (예 `notify: in_app, email`) | `summaryTemplate` 이 없다. 설정은 불리언 `notifyOnFailure` 하나이고 알림은 인앱으로만 보낸다. 이메일 채널은 없다([컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#background-본문-실행)) |

  나머지 Logic 노드는 두 표의 형식이 같다. 다만 옛 캔버스 표에는 Filter 행이 없고 If/Else 는 첫 조건만 적고 `combineMode` 표시를 적지 않는다.
- **실행 중 컨테이너 헤더의 진행 인덱스** (info): 이 문서와 Loop · Map 문서는 실행 중 헤더에 "Iteration 3/10" 같은 진행 인덱스를 보인다고 적는다. [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 의 컨테이너 절에는 이 요소가 없고 프론트엔드 캔버스 코드에서도 찾지 못했다. 캔버스 문서에 정의할지 미구현으로 표시할지 결정 필요.
- **컨테이너 완료 출력의 `meta.durationMs`** (info): [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 `meta.durationMs` 를 모든 노드 공통으로 둔다. [ForEach 노드](CLE-NODE-FOREACH.md) 는 완료 출력 `meta` 에 `durationMs` 가 없다고 적고 [Map 노드](CLE-NODE-MAP.md) · [Loop 노드](CLE-NODE-LOOP.md) 는 있다고 적는다. 같은 실행 코드를 쓰는 ForEach 와 Map 이 다르게 적혀 있다. 컨테이너 예외를 규약에 적을지 결정 필요.
- **`skip` 과 `continue` 의 차이** (info): 노드 PRD 는 건너뛰기와 계속을 다른 정책으로 보여 준다. ForEach · Map 문서에서 두 값의 결과 형태는 같고 이 문서는 `continue` 가 노드 실행 기록에도 에러를 남긴다는 차이만 적는다. 관측할 수 있는 차이를 더 적을지 하나로 합칠지 결정 필요.
- **완료 출력의 `port` 가 노드 출력 규약 Principle 5 와 맞지 않는다** (info): [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 5 는 `port: undefined` 를 노드 정의상 출력이 1개인 노드에, `port: string[]` 을 Parallel 핸들러와 텍스트 분류기에 둔다. Loop · ForEach · Map 은 출력 포트가 `body` 와 `done` 둘인데 완료 출력에 `port` 가 없다. 이 문서의 [노드 출력 사용 패턴](#노드-출력-사용-패턴) 표는 Parallel 이 끝날 때 `'done'` 을 싣는다고 적지만 구현은 배열 `['done']` 을 싣는다. 두 사실 모두 `execution-engine.service.ts` 의 컨테이너 완료 처리와 Parallel 완료 처리에서 확인했다. 규약과 이 문서 가운데 어느 쪽을 고칠지 결정 필요.
- **노드 출력 규약을 가리키는 인용이 낡았다** (info): [반복 결과 출력 구조](#반복-결과-출력-구조) 는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 "컨테이너 출력 절" 을 가리킨다. 그 문서에는 이 이름의 절이 없고 해당 내용은 [Principle 9](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-9-컨테이너와-parallel-의-출력-덮어쓰기) 에 있다. 첫 미결 사항이 옮긴 규약 문장("`null` 이 아닌 값을 반환하면 덮어쓰지 않는다")도 지금 Principle 9 의 9.1 과 다르다. 지금 9.1 은 핸들러가 `null` 이 아닌 값을 돌려줄 때 엔진이 덮어쓰는지를 정의가 갈리는 사항으로 둔다. 두 인용을 지금 규약 기준으로 고칠지 결정 필요.

## 구현 위치

- `codebase/backend/src/nodes/logic/_shared/*.ts`
- `codebase/backend/src/nodes/logic/*/*.handler.ts`
- `codebase/backend/src/nodes/logic/*/*.schema.ts`
- `codebase/backend/src/nodes/core/condition-evaluator.util.ts` (조건 평가, `compileUserRegex`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (엔진 덮어쓰기)
- `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` (`ITEM_ERROR_POLICY_NODE_TYPES`: 레거시 평면 키 이전에서 뺄 노드 유형)

## Rationale

### 패스스루로 두는 이유

패스스루 5종의 "비즈니스 결과물"은 입력 자체가 아니라 경로가 나뉜 데이터 흐름이다. 입력을 바꾸지 않고 흘려보내고 경로와 부가 정보만 `port` · `meta` 에 담으면 Map · Transform 처럼 데이터를 바꾸는 노드의 계약과 뚜렷하게 구분된다.

### 정규식을 한 헬퍼에서 안전하게 컴파일한다

길이 200자 제한만으로는 ReDoS 를 막지 못한다. 200자 안에서도 `(a+)+$` 같은 지수 백트래킹 패턴을 만들 수 있고 이런 패턴은 워커를 무기한 붙잡을 수 있다. 그래서 `safe-regex` 검사를 1차 방어로 두고 길이 제한은 분석 비용과 남은 위험을 줄이는 2차 방어로 둔다. 같은 정책을 If/Else · Switch · Filter 가 따로 적던 것을 이 문서 한 곳으로 모으고 구현도 단일 헬퍼 `compileUserRegex` 로 모았다.

### 시작 시점 배열을 엔진 내부 표현으로 둔다

ForEach · Map 핸들러는 시작 시점에 `output: items[]` 를 반환하고 밖으로 드러나는 형태는 `{ <컬렉션 키>, count }` 다. 핸들러 시그니처와 외부 노출 형태가 다른 것은 의도한 설계다. 노드 출력 5필드를 깨지 않고 나눠 줄 데이터를 엔진에 넘기는 방법이 이것이기 때문이다. [ForEach 노드](CLE-NODE-FOREACH.md) · [Map 노드](CLE-NODE-MAP.md) · [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 은 이 결정을 "D2 결정" 으로 가리킨다.

기각한 대안은 핸들러가 `null` 을 반환하고 별도 엔진 내부 채널로 배열을 넘기는 방식이다. 동작은 같은데 5필드 계약을 바꾸는 비용이 더 커서 채택하지 않았다.

### ForEach 와 Map 의 실패 표현을 다르게 둔다

항목 에러 정책이 `skip` / `continue` 일 때 ForEach 는 `output.items[i] = null` 자리와 별도 `output.skipped[]` 배열로 실패를 나누고 Map 은 `output.mapped[i] = { _skipped: true, error }` 로 같은 배열 안에 표시한다. 두 노드의 의미가 다르기 때문이다. [ForEach 노드](CLE-NODE-FOREACH.md) · [Map 노드](CLE-NODE-MAP.md) 는 이 결정을 "D3 결정" 으로 가리킨다.

- **Map** 은 "같은 타입으로 바꾼 배열" 계약이다. 다음 노드가 `mapped.map(...)` 처럼 배열 전체를 한 번에 다루므로 실패 항목도 같은 배열에 두는 편이 자연스럽다. `_skipped` 표시로 정상과 실패를 가른다.
- **ForEach** 는 "독립 항목 반복" 계약이다. 반복 회차가 서로 독립이므로 성공과 실패가 한 배열에 섞이지 않는 편이 뜻이 분명하다. `items[]` 에는 성공과 `null` 만, `skipped[]` 에는 실패만 둔다.

그래서 두 형태를 하나로 합치지 않고 현재 정책을 유지한다.

### 컨테이너의 범위

[용어 사전 — 워크플로우 작성](../CLE-GLOSSARY-WF.md) 의 「컨테이너」 행은 컨테이너를 Loop · ForEach · Map 세 노드로 정했다(구분 표기는 [용어 사전 — 다의어 구분](../CLE-GLOSSARY-POLY.md), 결정은 [용어 사전 — 결정이 필요한 표기](../CLE-GLOSSARY-OPEN.md) 의 「컨테이너의 범위」 항목(D17)). 원문은 Parallel 과 Background 도 컨테이너로 불렀다. Parallel 은 캔버스 멤버십(`containerId`)이 없고 엔진 덮어쓰기만 함께 받으므로 "엔진 덮어쓰기 대상 노드" 로 부른다. Background 는 멤버십도 덮어쓰기도 없으므로 컨테이너로 부르지 않는다.
