---
id: "CLE-NODE-MERGE"
title: "Merge 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-MERGE-001", "REQ-MERGE-002", "REQ-MERGE-003", "REQ-MERGE-004", "REQ-MERGE-005", "REQ-MERGE-006", "REQ-MERGE-007", "REQ-MERGE-008", "REQ-MERGE-009", "REQ-MERGE-010", "REQ-MERGE-011", "REQ-MERGE-012", "REQ-MERGE-013", "REQ-MERGE-014", "REQ-MERGE-015", "REQ-MERGE-016", "REQ-MERGE-017"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "c9689c40ca1a93c22cbce4c54952b98597664714e6355e14813d6b98aab0e856"
read_as: "task_basis"
task: "CLE-T-HSHW71"
source_paths: ["spec/4-nodes/1-logic/11-merge.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "04146ee9ce40c5cef3ebaea076235682b391bfba52f2d2fe431b7916fd104d4b"
etag: "sha256-792cdae867ae471669733ea2239b4a19e2de8aa8f5d26621d10f452bb36d0ab6"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/11-merge.md`, `spec/4-nodes/_product-overview.md` (§4.11) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Merge 노드(Merge, `merge`)는 여러 입력 경로의 데이터를 하나로 합치는 데이터 노드다. 병합 전략(`strategy`)과 출력 형식(`outputFormat`)의 조합으로 결과 형태가 정해진다. 현재 엔진은 모든 선행 노드가 이미 끝난 뒤 Merge 를 실행하므로 따로 fan-in barrier(입력이 모두 도착할 때까지 기다리는 장치)를 두지 않는다.

지금 동작의 한계는 두 가지다.

1. `timeout` / `partialOnTimeout` 은 스키마에 있지만 barrier 가 동작하지 않는(dormant) 필드다. 0이 아닌 값(`timeout > 0`, `partialOnTimeout === true`)을 설정하면 핸들러가 warn 로그를 남긴다. 같은 조건의 노드 경고 규칙은 검증을 막는다([에러](#에러)). barrier 활성화는 엔진이 노드 단위 비동기 dispatch 를 도입할 때 다시 검토하는 과제로 미뤘다([Rationale](#rationale)).
2. `strategy: 'first'` 는 "먼저 도착한 입력" 이 아니라 선행 노드 키를 정렬한 뒤 첫 값을 반환한다.

이 문서는 Merge 노드의 설정, 포트, 입력 정규화, 출력 형식, 출력 구조, 에러를 정한다. 엔진의 dispatch 모델은 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 와 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 이 정하고 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 요구사항

- REQ-MERGE-001 WHEN Merge 노드가 실행되면 THE SYSTEM SHALL 여러 입력 경로의 데이터를 하나의 결과로 합친다. (원본: ND-MG-01)
- REQ-MERGE-002 WHEN 여러 선행 노드를 Merge 에 연결하면 THE SYSTEM SHALL 단일 `in` 포트로 여러 연결선을 받고 선행 노드별 결과를 모아 넘긴다. (원본: ND-MG-02)
- REQ-MERGE-003 WHEN 사용자가 병합 전략을 고르면 THE SYSTEM SHALL `wait_all`, `first`, `append` 세 전략을 제공한다. (원본: ND-MG-03) (부분 구현)
- REQ-MERGE-004 WHEN 사용자가 출력 형식을 고르면 THE SYSTEM SHALL `array`, `merge_object`, `indexed` 세 형식으로 결과 구조를 정한다. (원본: ND-MG-04)
- REQ-MERGE-005 WHEN 입력을 정규화하면 THE SYSTEM SHALL 배열은 그대로 쓰고 `null` 이 아닌 객체는 키를 정렬한 순서로 값 배열로 바꾼다.
- REQ-MERGE-006 IF 입력이 `null` / `undefined` / 원시값이면 THE SYSTEM SHALL 에러를 던지지 않고 `[input]` 으로 감싼다.
- REQ-MERGE-007 WHEN `strategy` 가 `first` 면 THE SYSTEM SHALL 정규화한 배열의 첫 항목만 남긴다.
- REQ-MERGE-008 WHEN `outputFormat` 이 `merge_object` 면 THE SYSTEM SHALL 객체 입력만 `Object.create(null)` 위에 얕게 합치고 뒤 입력의 키가 앞 입력의 키를 덮어쓰게 한다.
- REQ-MERGE-009 WHEN `merge_object` 로 합치면 THE SYSTEM SHALL `__proto__` / `constructor` / `prototype` 키를 버리고 버린 키를 정렬·중복 제거해 `meta.skippedKeys` 에 싣는다.
- REQ-MERGE-010 WHEN `outputFormat` 이 `indexed` 면 THE SYSTEM SHALL 결과를 `{ in_0, in_1, ... }` 형태로 인덱스 키를 붙여 만든다.
- REQ-MERGE-011 IF `timeout > 0` 이거나 `partialOnTimeout === true` 면 THE SYSTEM SHALL 실행 결과를 바꾸지 않고 warn 로그를 남기고 그 필드를 `meta.dormantFields` 에 싣는다.
- REQ-MERGE-012 WHEN 노드 출력을 만들면 THE SYSTEM SHALL 스키마 4필드를 모두 설정 에코로 싣고 `strategy` / `outputFormat` 에만 기본값 대체를 적용한다.
- REQ-MERGE-013 WHEN 결과를 내보내면 THE SYSTEM SHALL `meta.inputCount`, `meta.strategy`, `meta.outputFormat`, `meta.skippedKeys`, `meta.dormantFields` 를 싣고 `skippedKeys` / `dormantFields` 는 해당이 없어도 `[]` 로 싣는다.
- REQ-MERGE-014 IF `strategy` 가 비어 있으면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-MERGE-015 IF `strategy` · `outputFormat` 이 enum 값이 아니거나 `timeout` 이 음수·숫자 아님이거나 `partialOnTimeout` 이 불리언이 아니면 THE SYSTEM SHALL `handler.validate` 에서 거부한다.
- REQ-MERGE-016 IF `timeout > 0` 이거나 `partialOnTimeout` 이 참이면 THE SYSTEM SHALL 노드 경고 규칙을 `blocking` 으로 평가해 캔버스 배지를 표시하고 `handler.validate` 를 막는다.
- REQ-MERGE-017 WHEN Merge 노드를 정의하면 THE SYSTEM SHALL 동적 포트·경로 선택 포트·에러 포트를 두지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| strategy | `wait_all` / `first` / `append` | ✓ | `wait_all` | 병합 전략. [병합 전략](#병합-전략) 표 참조 |
| outputFormat | `array` / `merge_object` / `indexed` | ✓ | `array` | 출력 형식. [출력 형식](#출력-형식) 표 참조 |
| timeout | Integer (≥ 0) | | `300` | 입력 대기 시간 제한(초). `0` 은 제한 없음. **동작하지 않음(dormant)** |
| partialOnTimeout | Boolean | | `false` | 시간 제한에 걸리면 부분 병합할지. **동작하지 않음(dormant)** |

코드 기준: `codebase/backend/src/nodes/logic/merge/merge.schema.ts` (export `mergeNodeConfigSchema`)

`timeout` 기본값 `300` 과 dormant 경고 규칙이 함께 있으면 새 Merge 노드가 기본 설정 그대로 검증에서 막힐 수 있다. [미결 사항](#미결-사항) 참조.

### 병합 전략

| 값 | 설명 |
|----|------|
| `wait_all` | 모든 입력이 도착한 뒤 전체를 합친다(기본) |
| `first` | 첫 입력만 통과시킨다. 현재 동작은 입력 객체의 키를 정렬한 뒤 첫 항목을 쓴다(실제 도착 순서 아님) |
| `append` | 도착 순서대로 쌓는다. 현재 동작은 `wait_all` 과 같이 모든 입력을 그대로 쌓는다 |

### 출력 형식

| 값 | 출력 모양 |
|----|--------------|
| `array` | `unknown[]`. 입력마다 배열 요소 하나 |
| `merge_object` | `Record<string, unknown>`. 객체 입력을 얕게 합친다. 객체가 아닌 입력은 무시한다. `__proto__` / `constructor` / `prototype` 키는 prototype pollution 을 막으려고 버린다 |
| `indexed` | `Record<string, unknown>`. `{ in_0, in_1, ... }` 형태로 인덱스 키를 붙인다 |

출력 모양이 `outputFormat` 에 따라 달라지는 것은 Merge 의 본래 기능이다. 뒤 노드는 `$node["X"].config.outputFormat` 으로 모양을 알아낸다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 병합 전략 | 맨 위 | `Strategy` 드롭다운(기본 `wait_all`) | `strategy` 를 바꾼다 |
| 출력 형식 | 둘째 줄 | `Output Format` 드롭다운(기본 `array`) | `outputFormat` 을 바꾼다 |
| 시간 제한 | 셋째 줄 | `Timeout (s)` 입력(기본 `300`) | `timeout` 을 편집한다(dormant) |
| 부분 병합 | 맨 아래 | `Partial on Timeout` 체크박스 | `partialOnTimeout` 을 켜고 끈다(dormant) |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 여러 연결선을 받을 수 있다. 엔진은 선행 노드별 결과를 객체(`{ <nodeId>: value }`)나 배열로 모아 넘긴다 |
| 출력 | `out` | Output | data | false | 병합 결과 단일 출력(`port` 설정 안 함) |

Merge 는 동적 포트가 없다. 경로 선택 포트와 에러 포트도 없다.

## 실행 로직

1. 입력을 `unknown[]` 으로 정규화한다([입력 정규화](#입력-정규화)).
2. `strategy === 'first'` 면 정규화한 배열의 첫 항목만 남긴다(`[inputs[0]]`). 그 밖(`wait_all` / `append`)은 배열 전체를 쓴다.
3. `outputFormat` 에 따라 결과를 만든다([형식별 결과](#형식별-결과)). `merge_object` 에서 prototype pollution 때문에 버린 키는 따로 모아 정렬·중복 제거한 뒤 `meta.skippedKeys` 에 싣는다.
4. `timeout > 0` 이거나 `partialOnTimeout === true` 면 warn 로그를 남긴다. 실행 결과에는 영향이 없다(barrier 가 동작하지 않는다). 해당 필드는 `meta.dormantFields` 에 쌓인다. 같은 조건의 노드 경고 규칙은 `blocking` 으로 평가돼 `handler.validate` 를 막는다([에러](#에러)).
5. `config` 에는 dormant 여부와 상관없이 스키마 4필드를 모두 싣는다(설정 에코. 핸들러의 "Echo every non-sensitive schema field" 기준). `strategy` / `outputFormat` 은 `context.rawConfig` 값에 기본값 대체(`?? 'wait_all'` / `?? 'array'`)를 적용한다. `timeout` / `partialOnTimeout` 은 `rawConfig` 값을 대체 없이 그대로 싣는다(설정하지 않았으면 `undefined` 라서 JSON 에서 빠진다).
6. `meta` 에 `inputCount` / `strategy` / `outputFormat` / `skippedKeys` / `dormantFields` 를 채워 반환한다. `durationMs` 는 엔진이 주입한다.

### 입력 정규화

| 입력 형태 | 정규화 결과 |
|-----------|--------------|
| `Array` | 그대로 쓴다 |
| `Object` (`null` 아님) | `Object.keys(input).sort()` 순서로 값 배열을 만든다(결정적 순서) |
| `null` / `undefined` / 원시값 | `[input]` 으로 감싼다(에러를 던지지 않는다) |
| `{}` (빈 객체) | `[]` |
| `[]` (빈 배열) | `[]` |

원문은 이 정규화에 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 빈 입력 절을 인용했지만 `null` 처리가 그 절과 다르다. [미결 사항](#미결-사항) 참조.

### 형식별 결과

| outputFormat | 동작 |
|--------------|------|
| `array` | 정규화한 배열을 그대로 반환한다 |
| `merge_object` | `Object.create(null)` 위에 객체 입력만 얕게 합친다. 뒤 키가 앞 키를 덮어쓴다. `__proto__` / `constructor` / `prototype` 키는 버린다. 객체가 아닌 항목은 건너뛴다 |
| `indexed` | `{ in_0: inputs[0], in_1: inputs[1], ... }` 로 바꾼다 |

## 출력 구조

Merge 는 단일 출력 데이터 노드라서 정상 케이스 하나뿐이다. 에러 포트가 있는 노드가 아니고 검증 실패는 모두 설정 검증 단계의 사전 검증 에러다. JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 정상 (단일 출력 `out`)

```json
{
  "config": {
    "strategy": "wait_all",
    "outputFormat": "array"
  },
  "output": [{ "a": 1 }, { "b": 2 }],
  "meta": {
    "durationMs": 0,
    "inputCount": 2,
    "strategy": "wait_all",
    "outputFormat": "array",
    "skippedKeys": [],
    "dormantFields": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.strategy` | `'wait_all'` / `'first'` / `'append'` | 설정 에코 | 사용자가 설정한 전략. `rawConfig.strategy ?? 'wait_all'` (기본값 대체) |
| `config.outputFormat` | `'array'` / `'merge_object'` / `'indexed'` | 설정 에코 | 출력 형식. `rawConfig.outputFormat ?? 'array'` (기본값 대체) |
| `config.timeout` | number | 설정 에코 | `rawConfig.timeout` 을 대체 없이 그대로 싣는다(설정하지 않았으면 `undefined` 라서 JSON 에서 빠진다). 위 예시는 설정하지 않아 빠졌다 |
| `config.partialOnTimeout` | boolean | 설정 에코 | `rawConfig.partialOnTimeout` 을 대체 없이 그대로 싣는다 |
| `output` | `unknown[]` / `Record<string, unknown>` | 런타임, `outputFormat` 별 | 병합 결과. 모양은 [형식별 결과](#형식별-결과) |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms) |
| `meta.inputCount` | number | 런타임 | 실제로 합친 입력 수. `strategy: 'first'` 면 1(정규화 후 잘라 낸 길이) |
| `meta.strategy` | `'wait_all'` / `'first'` / `'append'` | 런타임, 기본값 적용 | 적용한 전략. 설정 에코와 뜻은 같지만 `meta` 쪽에서도 분기 키로 쓸 수 있다 |
| `meta.outputFormat` | `'array'` / `'merge_object'` / `'indexed'` | 런타임, 기본값 적용 | 적용한 출력 형식 |
| `meta.skippedKeys` | `string[]` | 런타임, `merge_object` 한정 | prototype pollution 방지로 버린 키(정렬·중복 제거). 다른 출력 형식에서는 항상 `[]` |
| `meta.dormantFields` | `string[]` | 런타임 | 동작하지 않아 무시한 설정 필드. `timeout > 0` 이면 `'timeout'`, `partialOnTimeout === true` 면 `'partialOnTimeout'` 이 들어간다. 해당이 없으면 `[]` |

`output` 의 타입 자체가 `outputFormat` 에 따라 달라진다(`array` 는 배열, `merge_object` · `indexed` 는 객체). 뒤 노드가 안전하게 나누려면 `$node["X"].config.outputFormat` 을 키로 쓴다.

`meta.durationMs` 는 엔진이 모든 노드에 주입한다. 나머지 `meta` 필드는 핸들러가 채운다. `meta.skippedKeys` / `meta.dormantFields` 는 해당이 없어도 항상 `[]` 로 실어 뒤 노드의 선택적 확인을 단순하게 한다.

#### 출력 형식별 예시

**`array`**: 정규화한 배열을 그대로 싣는다.

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }]
}
```

**`merge_object`**: 객체 입력을 얕게 합치고 뒤 입력이 앞 입력을 덮어쓴다.

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "merge_object" },
  "output": { "a": 1, "b": 3, "c": 4 },
  "meta": {
    "inputCount": 2,
    "strategy": "wait_all",
    "outputFormat": "merge_object",
    "skippedKeys": [],
    "dormantFields": []
  }
}
```

입력은 `{ nodeA: { a: 1, b: 2 }, nodeB: { b: 3, c: 4 } }` 이다. `__proto__` / `constructor` / `prototype` 키는 버리고 버린 키는 정렬·중복 제거해 `meta.skippedKeys` 로 드러낸다(조용한 실패를 없앤다).

**`indexed`**: `in_<i>` 키로 인덱스를 붙인다.

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "indexed" },
  "output": { "in_0": "first", "in_1": "second" }
}
```

현재 코드는 `in_<i>` 키 형태를 유지한다. 뒤 노드는 `$node["X"].output.in_0` 처럼 읽는다. `{ items: [{ index, value }], count }` 형태로 바꾸는 호환성 깨짐 전환은 검토 대상이고 아직 정하지 않았다.

**`strategy: 'first'`**: 정규화한 배열의 첫 항목만 남기고 출력 형식을 적용한다.

```json
{
  "config": { "strategy": "first", "outputFormat": "array" },
  "output": ["first"]
}
```

표현식 접근 예:

- `$node["X"].output[0]` → 첫 입력(`outputFormat: array`)
- `$node["X"].output.a` → 합친 키 값(`outputFormat: merge_object`)
- `$node["X"].output.in_0` → 첫 입력(`outputFormat: indexed`)
- `$node["X"].config.outputFormat` → 모양 판별용(설정 에코)
- `$node["X"].meta.outputFormat` → 모양 판별용(`meta`, 같은 값)
- `$node["X"].meta.inputCount` → 실제로 합친 입력 수
- `$node["X"].meta.skippedKeys` → `merge_object` 에서 버린 키 목록
- `$node["X"].meta.dormantFields` → 동작하지 않아 무시한 설정 필드(`timeout` / `partialOnTimeout`)

## 에러

Merge 는 런타임 에러 포트가 없다. 검증 실패는 모두 설정 검증 단계의 사전 검증 에러다. 메시지 기준은 영문 원문(`merge.schema.ts` 노드 경고 규칙과 핸들러 검증 문자열)이고 프론트엔드는 `WARNING_KO` 로 한국어를 렌더링한다.

| 발생 조건 | 메시지(영문 원문) | 시점 |
|-----------|--------|------|
| `strategy` 없음 / 빈 값(`!strategy`) | `Merge strategy must be selected.` | 노드 경고 규칙 `merge:no-strategy` (캔버스 배지) + `handler.validate` (`evaluateMetadataBlockingErrors`) |
| `strategy` 가 enum 값이 아님 | `strategy must be one of: wait_all, first, append` | `handler.validate` |
| `outputFormat` 이 enum 값이 아님 | `outputFormat must be one of: array, merge_object, indexed` | `handler.validate` |
| `timeout` 이 음수이거나 숫자 아님 | `timeout must be a non-negative number (0 = no timeout)` | `handler.validate` |
| `partialOnTimeout` 이 불리언 아님 | `partialOnTimeout must be a boolean` | `handler.validate` |
| `timeout > 0` (dormant) | `Merge timeout is dormant in Phase P1 — value is logged but no barrier is enforced. The Phase P2 barrier will honor it.` | 노드 경고 규칙 `merge:timeout-dormant`. `severity` 가 없어 evaluator 기본값 `blocking` 으로 평가 → 캔버스 배지 + `handler.validate` 차단 |
| `partialOnTimeout` 참(dormant) | `Merge partialOnTimeout is dormant in Phase P1 — only takes effect alongside the Phase P2 barrier.` | 노드 경고 규칙 `merge:partial-on-timeout-dormant`. `severity` 가 없어 기본값 `blocking` → `handler.validate` 차단 |

1. **dormant 필드의 두 얼굴**: `timeout` / `partialOnTimeout` 은 실행(execute)에서는 결과에 영향이 없다. 하지만 검증(validate)에서는 위 두 규칙이 `blocking` 으로 평가돼 차단 에러로 집계된다(`packages/node-summary/src/evaluator.ts` `evaluateWarnings` 의 기본 severity 가 `blocking`). dormant 는 "런타임 무영향" 이지 "검증 무영향" 이 아니다.
2. 위 두 메시지는 코드의 영문 원문 그대로다. barrier 활성화가 다음 단계가 아니라 재검토 과제로 미뤄진 뒤에도 "다음 단계 barrier 가 반영한다" 고 안내한다. [미결 사항](#미결-사항) 참조.
3. `timeout` 이 동작하게 되면 `MERGE_TIMEOUT` 코드와 함께 `error` 포트나 `output.error` 가 추가될 수 있다. 그러나 활성화 자체를 미뤘으므로 지금은 구현하지 않았고 엔진이 노드 단위 비동기 dispatch 를 도입하지 않는 한 도입 예정이 없다.

## 설정 요약

- 형식: `{N} inputs · {strategy}`
- 예: `3 inputs · wait_all`
- 현재 구현은 `merge.schema.ts` 에 `summaryTemplate` 이 없어 캔버스에 이 요약을 표시하지 않는다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조.

## 미결 사항

- **`timeout` 기본값 300 이 차단 경고를 곧바로 일으킨다** (critical): [설정](#설정) 은 `timeout` 기본값을 `300` 으로, [에러](#에러) 는 `timeout > 0` 이면 `severity` 없는 노드 경고 규칙이 `blocking` 으로 평가돼 `handler.validate` 를 막는다고 적는다. 둘을 합치면 새로 추가한 Merge 노드가 기본 설정 그대로 검증에서 막힌다. 현재 구현은 `merge.schema.ts` 가 `timeout` 에 `z.default(300)` 을 두고 `node-component.registry.ts` 의 `resolveDefaultConfig` 가 `safeParse({})` 로 기본 설정을 채우며 두 경고 규칙에 `severity` 가 없다. 실제 실행이 막히는지는 확인하지 않았다. 기본값을 `0` 으로 바꿀지 두 규칙을 `advisory` 로 낮출지 필드를 없앨지 결정 필요. 원문도 "영구 dormant 필드를 노출한 채 설정 시 막는 것이 맞는가" 를 제품 결정으로 넘겼다([Rationale](#rationale)).
- **dormant 경고 문구가 옛 일정을 안내한다** (warning): 두 노드 경고 규칙 메시지(코드 `merge.schema.ts` 도 같음)는 "다음 단계(Phase P2) barrier 가 값을 반영한다" 고 안내한다. [Rationale](#rationale) 은 barrier 활성화를 재검토 과제로 미뤘고 무기한 dormant 라고 정했다. 문구를 "현재 엔진에서 동작하지 않음" 으로 바꾸는 코드 수정이 필요하고 위 제품 결정과 함께 처리해야 한다.
- **`null` 입력 처리가 노드 출력 규약과 다르다** (info): 원문은 [입력 정규화](#입력-정규화) 절에 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 빈 입력 절을 인용했지만 `null` 을 `[null]` 로 감싸 `inputCount` 1 을 만든다. 규약은 `null` 을 `[]` 로 대체하라고 정한다. Merge 입력은 설정 필드가 아니라 규약의 적용 대상인지도 애매하다. 적용할지 정하고 인용을 고쳐야 한다. 노드별 비교는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에 있다.

## 구현 위치

- `codebase/backend/src/nodes/logic/merge/merge.*.ts`
- `codebase/packages/node-summary/src/evaluator.ts` (`evaluateWarnings` 기본 severity)

## Rationale

### 비동기 fan-in barrier 활성화를 재검토 과제로 미룬다 (2026-07-17)

**결정**: Merge 의 비동기 fan-in barrier(`timeout` / `partialOnTimeout` 활성화)를 "다음 단계 예정" 에서 "엔진이 노드 단위 비동기 dispatch 를 도입할 경우 재검토" 로 낮춘다. `timeout` / `partialOnTimeout` 은 무기한 dormant 로 둔다.

**근거는 선결 조건이 엔진 차원에서 기각됐다는 것이다**. 2026-05-11 조사는 "순차 엔진에서는 뜻 있는 barrier 를 구현할 수 없다" 고 결론지었다. 모든 선행 노드가 동시에 풀려 "기다릴 시간" 자체가 0 이기 때문이다. 그래서 활성화의 선결 조건으로 엔진 비동기 dispatch 모델 도입을 들었다. 그 사이 실행 엔진은 반대 방향을 확정했다. [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 은 노드 단위 작업 큐(워커 1개 = 노드 실행 1건)를 채택하지 않는다고 정했고 한 세그먼트 안의 노드 dispatch 는 여전히 프로세스 안 while 루프라고 명시했다. 엔진은 노드 단위가 아니라 실행 단위 intake 큐(워커 1개 = active 세그먼트 1개)를 골랐다. 컨테이너·중첩 스코프·되돌아가는 연결선·Parallel 의미를 바꾸지 않으려는 의도된 결정이다.

그래서 barrier 가 요구하는 "시차를 두고 도착하는 입력 기다리기" 는 세그먼트 안 dispatch 가 프로세스 안에서 차례로 도는 한 성립하지 않는다. 그 전제를 바꾸는 것은 Merge 노드 하나를 위해 엔진의 확정된 설계 결정을 뒤집는 일이다. 원래 작업 계획의 수용 기준에는 "PoC 결과가 비현실적이면 ADR 로 마감하고 dormant 표기를 재검토 과제로 바꾼다" 는 분기가 있었다. 이 분기는 PoC 없이 충족됐다. PoC 가 답하려던 질문(엔진을 비동기 dispatch 로 다시 설계할 수 있는가)에 엔진 문서가 이미 "하지 않는다" 고 답했기 때문이다.

**기각한 대안**:

- Merge 전용 부분 비동기 처리: 두 dispatch 모델을 함께 두는 부담과 Background 노드 호환 처리가 따른다. 노드 하나를 위해 엔진에 이질적인 경로를 새로 두는 비용이 얻는 값을 넘는다.
- Background 노드에 동기 완료 대기 옵션 두기: Background 의 사용자 의미(fire-and-forget)를 바꾸므로 기각했다.

**재검토 조건**: 엔진이 노드 단위 비동기 dispatch 를 도입하기로 결정을 뒤집을 때만 이 결정을 다시 연다. 그 결정은 Merge 가 아니라 실행 엔진 차원의 사안이다.

**남은 UX 이슈(이 결정의 범위 밖)**: `timeout` / `partialOnTimeout` 이 무기한 dormant 로 확정됐는데도 스키마와 화면에 계속 보이고 값을 설정하면 노드 경고 규칙이 `blocking` 으로 평가돼 캔버스 배지와 `handler.validate` 차단 에러를 낸다. 영구 dormant 필드를 보이면서 설정하면 막는 것이 맞는지(필드 제거, severity 완화, 현행 유지)는 제품 결정이라 여기서 정하지 않았다. 원래 작업 계획이 끝나도 소유자가 사라지지 않도록 노드 출력 재설계 작업 계획의 제품 결정 항목으로 넘겼다.
