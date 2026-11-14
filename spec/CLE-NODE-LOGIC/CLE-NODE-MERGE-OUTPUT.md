---
id: "CLE-NODE-MERGE-OUTPUT"
title: "Merge 노드 — 실행 로직과 출력 구조"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-MERGE"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC", "CLE-NODE-MERGE"]
area: "CLE-NODE-LOGIC"
content_hash: "4d4e56f0b4d6b12aadc4f5031d0dc37df08d8916e46137bf8b1c42a99cc09760"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "0e59cce1c1dd1ddf9b867adaf087dc47adaa698eb4ac814cee42ac0c50460704"
etag: "sha256-6815fa7b4332ec148913ffa8b228a2fc3ba26d243a81151ac79657a7c9ca9297"
---
> 구현 상태: 구현됨 · 상위: [Merge 노드](CLE-NODE-MERGE.md)

## 개요

이 문서는 [Merge 노드](CLE-NODE-MERGE.md) 의 하위 문서로 Merge 의 실행 로직(입력 정규화 · 형식별 결과)과 출력 구조를 정한다. 설정 · 포트 · 에러는 부모 문서가 정하고 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 실행 로직

1. 입력을 `unknown[]` 으로 정규화한다([입력 정규화](#입력-정규화)).
2. `strategy === 'first'` 면 정규화한 배열의 첫 항목만 남긴다(`[inputs[0]]`). 그 밖(`wait_all` / `append`)은 배열 전체를 쓴다.
3. `outputFormat` 에 따라 결과를 만든다([형식별 결과](#형식별-결과)). `merge_object` 에서 prototype pollution 때문에 버린 키는 따로 모아 정렬·중복 제거한 뒤 `meta.skippedKeys` 에 싣는다.
4. `timeout > 0` 이거나 `partialOnTimeout === true` 면 warn 로그를 남긴다. 실행 결과에는 영향이 없다(barrier 가 동작하지 않는다). 해당 필드는 `meta.dormantFields` 에 쌓인다. 같은 조건의 노드 경고 규칙은 `blocking` 으로 평가돼 `handler.validate` 를 막는다([에러](CLE-NODE-MERGE.md#에러)). 엔진은 노드를 실행하기 직전에 `handler.validate` 를 부른다. 검증이 실패하면 에러 메시지가 `INVALID_NODE_CONFIG:` 로 시작하는 에러로 실행이 실패한다([노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md#노드-실행-흐름)). 그래서 엔진 경로에서는 dormant 값이 이 단계까지 오지 않는다. warn 로그와 `meta.dormantFields` 의 항목은 `handler.validate` 를 거치지 않고 실행한 경우에만 생긴다.
5. `config` 에는 dormant 여부와 상관없이 스키마 4필드를 모두 싣는다(설정 에코. [노드 출력 규약 Principle 7](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-7-설정-에코-원칙) 규칙 4). `strategy` / `outputFormat` 은 `context.rawConfig` 값에 기본값 대체(`?? 'wait_all'` / `?? 'array'`)를 적용한다. `timeout` / `partialOnTimeout` 은 `rawConfig` 값을 대체 없이 그대로 싣는다(저장된 설정에 키가 없으면 `undefined` 라서 JSON 에서 빠진다).
6. `meta` 에 `inputCount` / `strategy` / `outputFormat` / `skippedKeys` / `dormantFields` 를 채워 반환한다. `durationMs` 는 엔진이 주입한다.

### 입력 정규화

| 입력 형태 | 정규화 결과 |
|-----------|--------------|
| `Array` | 그대로 쓴다 |
| `Object` (`null` 아님) | `Object.keys(input).sort()` 순서로 값 배열을 만든다(결정적 순서) |
| `null` / `undefined` / 원시값 | `[input]` 으로 감싼다(에러를 던지지 않는다) |
| `{}` (빈 객체) | `[]` |
| `[]` (빈 배열) | `[]` |

Merge 는 설정 경로로 값을 꺼내지 않고 입력 전체를 정규화하므로 [노드 출력 규약 Principle 10](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-10-비었거나-null-인-입력의-대체-값) 의 대상이 아니다. 대상의 범위는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 규칙 2 가 정한다. 그래서 `null` 을 `[null]` 로 감싸 `inputCount` 1 을 만드는 지금 동작을 유지한다.

### 형식별 결과

| outputFormat | 동작 |
|--------------|------|
| `array` | 정규화한 배열을 그대로 반환한다 |
| `merge_object` | 부모 문서 [출력 형식](CLE-NODE-MERGE.md#출력-형식) 표의 `merge_object` 행과 같은 규칙이다. 한쪽을 고치면 다른 쪽도 같은 변경에서 고친다. `Object.create(null)` 위에 객체 입력만 얕게 합친다. 뒤 키가 앞 키를 덮어쓴다. `__proto__` / `constructor` / `prototype` 키는 버린다. 객체가 아닌 항목은 건너뛴다 |
| `indexed` | `{ in_0: inputs[0], in_1: inputs[1], ... }` 로 바꾼다 |

## 출력 구조

Merge 는 단일 출력 데이터 노드라서 정상 케이스 하나뿐이다. [노드 출력 규약 3.3](../CLE-NODE/CLE-NODE-OUTPUT.md#33-에러-포트가-있는-노드) 의 에러 포트가 있는 노드가 아니고 검증 실패는 모두 설정 검증 단계의 사전 검증 에러다. JSON 예시는 `undefined` 필드를 생략했고 [다섯 필드](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-0-노드-출력의-다섯-필드) 밖의 최상위 키는 쓰지 않는다.

### 정상 (단일 출력 `out`)

```json
{
  "config": {
    "strategy": "wait_all",
    "outputFormat": "array",
    "timeout": 0,
    "partialOnTimeout": false
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
| `config.timeout?` | number | 설정 에코 | `rawConfig.timeout` 을 대체 없이 그대로 싣는다. 위 예시는 기본 설정(`timeout: 0`)으로 만든 노드다. 저장된 설정에 키가 없으면 `undefined` 라서 JSON 에서 빠진다 |
| `config.partialOnTimeout?` | boolean | 설정 에코 | `rawConfig.partialOnTimeout` 을 대체 없이 그대로 싣는다. 저장된 설정에 키가 없으면 `undefined` 라서 JSON 에서 빠진다 |
| `output` | `unknown[]` / `Record<string, unknown>` | 런타임, `outputFormat` 별 | 병합 결과. 모양은 [형식별 결과](#형식별-결과) |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms) |
| `meta.inputCount` | number | 런타임 | 실제로 합친 입력 수. `strategy: 'first'` 면 1(정규화 후 잘라 낸 길이) |
| `meta.strategy` | `'wait_all'` / `'first'` / `'append'` | 런타임, 기본값 적용 | 적용한 전략. `meta` 는 평가한 설정에서, `config.strategy` 는 원문에서 기본값을 채운다. enum 이라 표현식을 쓰지 않으므로 두 값은 같다. [노드 출력 규약 Principle 2](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-2-실행-메트릭에는-관측-값만-둔다) 의 예외로 둔다([Rationale](#meta-에-전략과-출력-형식을-설정-에코와-함께-둔다-2026-11-12)) |
| `meta.outputFormat` | `'array'` / `'merge_object'` / `'indexed'` | 런타임, 기본값 적용 | 적용한 출력 형식. `config.outputFormat` 과 같은 값이고 `meta.strategy` 와 같은 예외다 |
| `meta.skippedKeys` | `string[]` | 런타임, `merge_object` 한정 | prototype pollution 방지로 버린 키(정렬·중복 제거). 다른 출력 형식에서는 항상 `[]` |
| `meta.dormantFields` | `string[]` | 런타임 | 동작하지 않아 무시한 설정 필드. `handler.validate` 를 거치지 않은 실행에서 `timeout > 0` 이면 `'timeout'`, `partialOnTimeout === true` 면 `'partialOnTimeout'` 이 들어간다. 해당이 없으면 `[]`. 엔진 경로에서는 dormant 값이 검증에서 먼저 막힌다([실행 로직](#실행-로직) 4번) |

`output` 의 타입 자체가 `outputFormat` 에 따라 달라진다(`array` 는 배열, `merge_object` · `indexed` 는 객체). 뒤 노드가 안전하게 나누려면 `$node["X"].config.outputFormat` 을 키로 쓴다.

`meta.durationMs` 는 엔진이 모든 노드에 주입한다. 나머지 `meta` 필드는 핸들러가 채운다. `meta.skippedKeys` / `meta.dormantFields` 는 해당이 없어도 항상 `[]` 로 실어 뒤 노드의 선택적 확인을 단순하게 한다.

#### 출력 형식별 예시

아래 예시는 형식별 차이만 보이려고 `config` 의 `timeout` · `partialOnTimeout` 과 일부 `meta` 를 줄였다.

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

## Rationale

### 입력 정규화는 노드 출력 규약 Principle 10 의 대상이 아니다 (2026-10-24)

원문은 입력 정규화에 Principle 10 을 인용했지만 `null` 을 `[null]` 로 감쌌다. Principle 10 대로면 `[]` 다. [입력 정규화](#입력-정규화) 에 적은 이유로 Merge 는 그 대상이 아니므로 지금 동작을 유지했다(NERV Task `CLE-T-3HJ8MM`).

기각한 대안은 `null` 입력을 `[]` 로 바꾸는 안이다. 위쪽 노드가 `null` 을 낸 경우 `inputCount` 가 1 에서 0 으로 바뀌어 기존 워크플로우의 결과가 달라진다.

### meta 에 전략과 출력 형식을 설정 에코와 함께 둔다 (2026-11-12)

**결정**: `meta.strategy` · `meta.outputFormat` 을 지우지 않는다. 두 값은 `config.strategy` · `config.outputFormat` 과 같다. [노드 출력 규약 Principle 2](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-2-실행-메트릭에는-관측-값만-둔다) 는 `meta` 에 관측 값만 둔다고 정한다. Merge 는 그 예외로 남기고 규약의 Principle 2 표에 Merge 행을 두었다. `meta.dormantFields` 는 설정 값을 옮긴 것이 아니라 핸들러가 무시한 필드를 모은 값이라 그대로 둔다(NERV Task `CLE-T-3XGCYA`).

**근거**: `$node["X"].meta.outputFormat` 으로 출력 모양을 나누는 워크플로우가 이미 있을 수 있다. 지우면 그 표현식이 `undefined` 를 받아 분기가 조용히 바뀐다. 같은 정보를 두 곳에 두던 `output.view` 판별자는 중복이라 폐기했다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#outputview-판별자를-폐기한-이유)). 그 판별자는 초안 단계에서 폐기했고 Merge 의 두 `meta` 필드는 이미 출력에 실려 있다는 점이 다르다.

**기각한 대안** (2026-11-12 사용자 선택):

- `meta.strategy` · `meta.outputFormat` 을 지운다: 위 호환이 깨진다.
- `meta.dormantFields` 까지 셋 다 지운다: 같은 이유로 호환이 깨진다. `dormantFields` 는 설정 에코와 겹치는 값도 아니다.
