---
id: "CLE-NODE-MERGE"
title: "Merge 노드"
type: "feature"
version: 5
status: "approved"
requirements: ["REQ-MERGE-001", "REQ-MERGE-002", "REQ-MERGE-003", "REQ-MERGE-004", "REQ-MERGE-005", "REQ-MERGE-006", "REQ-MERGE-007", "REQ-MERGE-008", "REQ-MERGE-009", "REQ-MERGE-010", "REQ-MERGE-011", "REQ-MERGE-012", "REQ-MERGE-013", "REQ-MERGE-014", "REQ-MERGE-015", "REQ-MERGE-016", "REQ-MERGE-017", "REQ-MERGE-018"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "c3670b124366d02598f9ca09d30fc157f55eec6f8d33f499975c3bfbd85bec61"
read_as: "approved_fallback"
task: "CLE-T-5BCDMM"
source_paths: ["spec/4-nodes/1-logic/11-merge.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "758c1082a9a87396d3f487afa6ad0d674ac8653af7378ffa036f16761ac08d1d"
etag: "sha256-55eea8e0ef98cc3fcf1111cb3506b28d8827fbdca8be0eff49186a649db324ef"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/11-merge.md`, `spec/4-nodes/_product-overview.md` (§4.11) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Merge 노드(Merge, `merge`)는 여러 입력 경로의 데이터를 하나로 합치는 데이터 노드다. 병합 전략(`strategy`)과 출력 형식(`outputFormat`)의 조합으로 결과 형태가 정해진다. 현재 엔진은 모든 선행 노드가 이미 끝난 뒤 Merge 를 실행하므로 따로 fan-in barrier(입력이 모두 도착할 때까지 기다리는 장치)를 두지 않는다.

지금 동작의 한계는 두 가지다.

1. `timeout` / `partialOnTimeout` 은 스키마에 있지만 barrier 가 동작하지 않는(dormant) 필드다. 0이 아닌 값(`timeout > 0`, `partialOnTimeout === true`)을 설정하면 노드 경고 규칙이 검증을 막는다([에러](#에러)). 검증을 거치지 않고 실행되면 핸들러는 결과를 바꾸지 않고 warn 로그만 남긴다. 기본값은 `timeout` `0` · `partialOnTimeout` `false` 라서 기본 설정에서는 이 경고가 켜지지 않는다. barrier 활성화는 엔진이 노드 단위 비동기 dispatch 를 도입할 때 다시 검토하는 과제로 미뤘다([Rationale](#rationale)).
2. `strategy` 의 `first` · `append` 는 이름과 달리 도착 순서를 보지 않는다. `first` 는 선행 노드 ID 를 정렬한 순서의 첫 입력 하나만 남기고 `append` 는 `wait_all` 과 결과가 같다. 이 의미를 정식 동작으로 정했고 두 값을 고르면 캔버스에 실행을 막지 않는 경고를 띄운다([병합 전략](#병합-전략)).

이 문서는 Merge 노드의 설정, 포트, 입력 정규화, 출력 형식, 출력 구조, 에러를 정한다. 엔진의 dispatch 모델은 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 와 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 이 정하고 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 요구사항

- REQ-MERGE-001 WHEN Merge 노드가 실행되면 THE SYSTEM SHALL 여러 입력 경로의 데이터를 하나의 결과로 합친다. (원본: ND-MG-01)
- REQ-MERGE-002 WHEN 여러 선행 노드를 Merge 에 연결하면 THE SYSTEM SHALL 단일 `in` 포트로 여러 연결선을 받고 선행 노드별 결과를 모아 넘긴다. (원본: ND-MG-02)
- REQ-MERGE-003 WHEN 사용자가 병합 전략을 고르면 THE SYSTEM SHALL `wait_all`, `first`, `append` 세 전략을 제공한다. 각 전략의 의미는 [병합 전략](#병합-전략) 표가 정한다. (원본: ND-MG-03)
- REQ-MERGE-004 WHEN 사용자가 출력 형식을 고르면 THE SYSTEM SHALL `array`, `merge_object`, `indexed` 세 형식으로 결과 구조를 정한다. (원본: ND-MG-04)
- REQ-MERGE-005 WHEN 입력을 정규화하면 THE SYSTEM SHALL 배열은 그대로 쓰고 `null` 이 아닌 객체는 키를 정렬한 순서로 값 배열로 바꾼다.
- REQ-MERGE-006 IF 입력이 `null` / `undefined` / 원시값이면 THE SYSTEM SHALL 에러를 던지지 않고 `[input]` 으로 감싼다.
- REQ-MERGE-007 WHEN `strategy` 가 `first` 면 THE SYSTEM SHALL 정규화한 배열의 첫 항목만 남긴다.
- REQ-MERGE-008 WHEN `outputFormat` 이 `merge_object` 면 THE SYSTEM SHALL 객체 입력만 `Object.create(null)` 위에 얕게 합치고 뒤 입력의 키가 앞 입력의 키를 덮어쓰게 한다.
- REQ-MERGE-009 WHEN `merge_object` 로 합치면 THE SYSTEM SHALL `__proto__` / `constructor` / `prototype` 키를 버리고 버린 키를 정렬·중복 제거해 `meta.skippedKeys` 에 싣는다.
- REQ-MERGE-010 WHEN `outputFormat` 이 `indexed` 면 THE SYSTEM SHALL 결과를 `{ in_0, in_1, ... }` 형태로 인덱스 키를 붙여 만든다.
- REQ-MERGE-011 IF `handler.validate` 를 거치지 않고 `timeout > 0` 이거나 `partialOnTimeout === true` 인 설정으로 실행되면 THE SYSTEM SHALL 실행 결과를 바꾸지 않고 warn 로그를 남기고 그 필드를 `meta.dormantFields` 에 싣는다.
- REQ-MERGE-012 WHEN 노드 출력을 만들면 THE SYSTEM SHALL 스키마 4필드를 모두 설정 에코로 싣고 `strategy` / `outputFormat` 에만 기본값 대체를 적용한다.
- REQ-MERGE-013 WHEN 결과를 내보내면 THE SYSTEM SHALL `meta.inputCount`, `meta.strategy`, `meta.outputFormat`, `meta.skippedKeys`, `meta.dormantFields` 를 싣고 `skippedKeys` / `dormantFields` 는 해당이 없어도 `[]` 로 싣는다.
- REQ-MERGE-014 IF `strategy` 가 비어 있으면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-MERGE-015 IF `strategy` · `outputFormat` 이 enum 값이 아니거나 `timeout` 이 음수·숫자 아님이거나 `partialOnTimeout` 이 불리언이 아니면 THE SYSTEM SHALL `handler.validate` 에서 거부한다.
- REQ-MERGE-016 IF `timeout > 0` 이거나 `partialOnTimeout` 이 참이면 THE SYSTEM SHALL 노드 경고 규칙을 `blocking` 으로 평가해 캔버스 배지를 표시하고 `handler.validate` 를 막는다.
- REQ-MERGE-017 WHEN Merge 노드를 정의하면 THE SYSTEM SHALL 노드 정의에 동적 포트·경로 선택 포트·에러 포트를 두지 않는다. 에러 처리 정책으로 생기는 동적 에러 포트는 [포트](#포트) 절이 정한다.
- REQ-MERGE-018 IF `strategy` 가 `first` 나 `append` 면 THE SYSTEM SHALL `advisory` 노드 경고 규칙으로 캔버스에 경고 배지를 표시하고 `handler.validate` 와 실행은 막지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| strategy | `wait_all` / `first` / `append` | ✓ | `wait_all` | 병합 전략. [병합 전략](#병합-전략) 표 참조 |
| outputFormat | `array` / `merge_object` / `indexed` | ✓ | `array` | 출력 형식. [출력 형식](#출력-형식) 표 참조 |
| timeout | Integer (≥ 0) | | `0` | 선행 입력이 모두 도착하기를 기다리는 시간 제한(초). `0` 은 제한 없음. **동작하지 않음(dormant)**. 0 보다 크면 검증에서 막힌다 |
| partialOnTimeout | Boolean | | `false` | 시간 제한에 걸리면 부분 병합할지. **동작하지 않음(dormant)** |

코드 기준: `codebase/backend/src/nodes/logic/merge/merge.schema.ts` (export `mergeNodeConfigSchema`)

`timeout` 기본값은 `0` 이다. 새 노드의 기본 설정(`defaultConfig`)은 레지스트리의 `resolveDefaultConfig` 가 스키마 기본값으로 채운다. `defaultConfig` 는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md#노드-정의-속성) 의 노드 정의 속성이다. 가져오기(`applyConfigDefaults`)도 빈 필드를 스키마 기본값으로 채운다. 기본값이 경고를 켜지 않아야 새 노드와 가져온 노드가 기본 설정 그대로 실행된다. 결정과 근거는 [Rationale](#timeout-기본값을-0-으로-두고-필드와-차단-경고는-유지한다-2026-10-10) 에 있다.

### 병합 전략

| 값 | 설명 |
|----|------|
| `wait_all` | 모든 입력이 도착한 뒤 전체를 합친다(기본) |
| `first` | 입력 객체의 키(선행 노드 ID)를 문자열로 정렬한 순서에서 첫 입력 하나만 남긴다. 도착 순서가 아니다. 노드 ID 는 무작위 UUID 라서 어느 선행 노드가 골라질지 사용자가 정할 수 없고 노드를 복사해 붙여 넣으면 바뀔 수 있다. 선행 노드가 하나면 엔진이 그 출력을 그대로 넘기므로 그 출력을 정규화한 첫 항목이 남는다([입력 정규화](#입력-정규화)) |
| `append` | 결과가 `wait_all` 과 같다. 모든 입력을 [입력 정규화](#입력-정규화) 순서대로 쌓는다. 도착 순서가 아니다 |

`first` · `append` 를 고르면 캔버스에 `advisory` 경고 배지를 띄운다. 실행과 `handler.validate` 는 막지 않는다(REQ-MERGE-018, [에러](#에러)). 배지는 노드 헤더의 경고 아이콘이고 툴팁에 문구가 나온다. 요약 줄은 가리지 않는다. `blocking` 노드 경고가 함께 있으면 `blocking` 경고만 보인다. 이 의미로 정한 이유는 [Rationale](#first-와-append-를-지금-의미로-정하고-advisory-경고로-알린다-2026-11-12) 에 있다.

### 출력 형식

| 값 | 출력 모양 |
|----|--------------|
| `array` | `unknown[]`. 입력마다 배열 요소 하나 |
| `merge_object` | `Record<string, unknown>`. 객체 입력을 얕게 합친다. 객체가 아닌 입력은 무시한다. `__proto__` / `constructor` / `prototype` 키는 prototype pollution 을 막으려고 버린다 |
| `indexed` | `Record<string, unknown>`. `{ in_0, in_1, ... }` 형태로 인덱스 키를 붙인다 |

출력 모양이 `outputFormat` 에 따라 달라지는 것은 Merge 의 본래 기능이다. 뒤 노드는 `$node["X"].config.outputFormat` 으로 모양을 알아낸다.

## 설정 화면

설정 화면은 auto-form 이 `merge.schema.ts` 의 `ui` 메타로 그린다. Merge 는 전용 설정 컴포넌트를 쓰지 않는다. 아래 표의 라벨은 한국어 화면 문구다. 영문 원문(`Strategy` · `Output Format` · `Timeout (seconds)` · `Partial on Timeout`)은 `ui.label` 에 있다. 한국어 문구는 `backend-labels.ts` 의 `LABEL_KO` 에 있다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 병합 전략 | 맨 위 | `전략` 드롭다운(기본 `wait_all`) | `strategy` 를 바꾼다 |
| 출력 형식 | 둘째 줄 | `출력 형식` 드롭다운(기본 `array`) | `outputFormat` 을 바꾼다 |
| 시간 제한 | 셋째 줄 | `타임아웃(초)` 숫자 입력(기본 `0`) | `timeout` 을 편집한다(dormant) |
| 부분 병합 | 맨 아래 | `타임아웃 시 부분 병합` 체크박스 | `partialOnTimeout` 을 켜고 끈다(dormant) |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 여러 연결선을 받을 수 있다. 엔진은 선행 노드별 결과를 객체(`{ <nodeId>: value }`)나 배열로 모아 넘긴다 |
| 출력 | `out` | Output | data | false | 병합 결과 단일 출력(`port` 설정 안 함) |

Merge 는 동적 포트가 없다. 경로 선택 포트와 에러 포트도 없다. 이 말과 REQ-MERGE-017 은 노드 정의에 둔 고정 포트와 데이터 동적 포트만 가리킨다. 에러 처리 정책을 "에러 포트로 라우팅" 으로 고를 때 생기는 동적 에러 포트는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#항목-에러-정책) 규칙 5 와 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 을 따른다. 이 동적 에러 포트는 아직 구현되지 않았고 그동안의 처리도 그 규칙 5 가 정한다.

## 실행 로직

1. 입력을 `unknown[]` 으로 정규화한다([입력 정규화](#입력-정규화)).
2. `strategy === 'first'` 면 정규화한 배열의 첫 항목만 남긴다(`[inputs[0]]`). 그 밖(`wait_all` / `append`)은 배열 전체를 쓴다.
3. `outputFormat` 에 따라 결과를 만든다([형식별 결과](#형식별-결과)). `merge_object` 에서 prototype pollution 때문에 버린 키는 따로 모아 정렬·중복 제거한 뒤 `meta.skippedKeys` 에 싣는다.
4. `timeout > 0` 이거나 `partialOnTimeout === true` 면 warn 로그를 남긴다. 실행 결과에는 영향이 없다(barrier 가 동작하지 않는다). 해당 필드는 `meta.dormantFields` 에 쌓인다. 같은 조건의 노드 경고 규칙은 `blocking` 으로 평가돼 `handler.validate` 를 막는다([에러](#에러)). 엔진은 노드를 실행하기 직전에 `handler.validate` 를 부른다. 검증이 실패하면 에러 메시지가 `INVALID_NODE_CONFIG:` 로 시작하는 에러로 실행이 실패한다([노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md#노드-실행-흐름)). 그래서 엔진 경로에서는 dormant 값이 이 단계까지 오지 않는다. warn 로그와 `meta.dormantFields` 의 항목은 `handler.validate` 를 거치지 않고 실행한 경우에만 생긴다.
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
| `merge_object` | `Object.create(null)` 위에 객체 입력만 얕게 합친다. 뒤 키가 앞 키를 덮어쓴다. `__proto__` / `constructor` / `prototype` 키는 버린다. 객체가 아닌 항목은 건너뛴다 |
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

## 에러

Merge 는 런타임 에러 포트가 없다(에러 처리 정책의 동적 에러 포트는 [포트](#포트) 참조). 검증 실패는 모두 설정 검증 단계의 사전 검증 에러다. 메시지 기준은 영문 원문(`merge.schema.ts` 노드 경고 규칙과 핸들러 검증 문자열)이다. 프론트엔드는 노드 경고 규칙 메시지 다섯 개(`merge:no-strategy` · `merge:timeout-dormant` · `merge:partial-on-timeout-dormant` · `merge:strategy-first-not-arrival-order` · `merge:strategy-append-same-as-wait-all`)만 `backend-labels.ts` 의 `WARNING_KO` 로 한국어를 렌더링한다. `handler.validate` 의 검증 문자열 네 개(`strategy` · `outputFormat` enum, `timeout` 음수, `partialOnTimeout` 불리언)는 `WARNING_KO` 에 항목이 없어서 영문 그대로 보인다.

| 발생 조건 | 메시지(영문 원문) | 시점 |
|-----------|--------|------|
| `strategy` 없음 / 빈 값(`!strategy`) | `Merge strategy must be selected.` | 노드 경고 규칙 `merge:no-strategy` (캔버스 배지) + `handler.validate` (`evaluateMetadataBlockingErrors`) |
| `strategy` 가 enum 값이 아님 | `strategy must be one of: wait_all, first, append` | `handler.validate` |
| `outputFormat` 이 enum 값이 아님 | `outputFormat must be one of: array, merge_object, indexed` | `handler.validate` |
| `timeout` 이 음수이거나 숫자 아님 | `timeout must be a non-negative number (0 = no timeout)` | `handler.validate`. 스키마도 음수를 거부한다(`.nonnegative()`, 노드 정의 JSON Schema `minimum: 0`) |
| `partialOnTimeout` 이 불리언 아님 | `partialOnTimeout must be a boolean` | `handler.validate` |
| `timeout > 0` (dormant) | `Merge timeout has no effect — Merge runs only after every connected input has finished, so there is nothing to wait for. Set it to 0.` | 노드 경고 규칙 `merge:timeout-dormant`. `severity` 가 없어 evaluator 기본값 `blocking` 으로 평가 → 캔버스 배지 + `handler.validate` 차단 |
| `partialOnTimeout` 참(dormant) | `Merge partialOnTimeout has no effect — Merge never times out, so there are no partial inputs to merge. Turn it off.` | 노드 경고 규칙 `merge:partial-on-timeout-dormant`. `severity` 가 없어 기본값 `blocking` → `handler.validate` 차단 |
| `strategy` 가 `first` | `Merge strategy 'first' does not pick the first input to arrive. It keeps the input from the connected node whose ID sorts first, which can change when nodes are copied.` | 노드 경고 규칙 `merge:strategy-first-not-arrival-order`. `severity: 'advisory'` 라서 캔버스 배지만 띄우고 `handler.validate` 를 막지 않는다. |
| `strategy` 가 `append` | `Merge strategy 'append' works the same as 'wait_all': it keeps every input.` | 노드 경고 규칙 `merge:strategy-append-same-as-wait-all`. `severity: 'advisory'`. |

1. **dormant 필드의 두 얼굴**: `timeout` / `partialOnTimeout` 은 실행(execute)에서는 결과에 영향이 없다. 하지만 검증(validate)에서는 위 두 규칙이 `blocking` 으로 평가돼 차단 에러로 집계된다(`packages/node-summary/src/evaluator.ts` `evaluateWarnings` 의 기본 severity 가 `blocking`). dormant 는 "런타임 무영향" 이지 "검증 무영향" 이 아니다.
2. 위 두 dormant 메시지는 코드의 영문 원문 그대로다. 메시지에는 그 필드가 동작하지 않는다는 사실과 할 일이 들어 있다. 할 일은 `timeout` 을 0 으로 두기와 `partialOnTimeout` 끄기다. 나중 단계에서 값이 반영된다는 약속은 넣지 않는다. `WARNING_KO` 는 영문 원문을 키로 쓴다. 그래서 문구를 바꾸면 `backend-labels.ts` 의 `WARNING_KO` 영문 키도 같은 변경에서 바꾼다.
3. `timeout` 이 동작하게 되면 가칭 `MERGE_TIMEOUT`([에러 코드 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 없다) 코드와 함께 `error` 포트나 `output.error` 가 추가될 수 있다. 그러나 활성화 자체를 미뤘으므로 지금은 구현하지 않았고 엔진이 노드 단위 비동기 dispatch 를 도입하지 않는 한 도입 예정이 없다.

## 설정 요약

- 형식: `{N} inputs · {strategy}`
- 예: `3 inputs · wait_all`
- 현재 구현은 `merge.schema.ts` 에 `summaryTemplate` 이 없어 캔버스에 이 요약을 표시하지 않는다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/nodes/logic/merge/merge.*.ts`
- `codebase/backend/src/nodes/logic/merge/merge.schema.ts` (`ui` 메타. 설정 화면의 필드와 라벨을 정한다)
- `codebase/packages/node-summary/src/evaluator.ts` (`evaluateWarnings` 기본 severity)
- `codebase/backend/migrations/V148__merge_node_timeout_default_zero.sql` (저장된 `timeout` 300 → 0)
- `codebase/frontend/src/lib/i18n/backend-labels.ts` (`LABEL_KO` 설정 화면 라벨 · `WARNING_KO` 경고 문구 한국어)
- `codebase/frontend/src/lib/utils/node-config-summary.ts` (`getAdvisoryWarnings`. 발화한 `advisory` 노드 경고 문구)
- `codebase/frontend/src/components/editor/canvas/custom-node.tsx` (헤더 `advisory` 경고 아이콘과 툴팁)

## Rationale

### 비동기 fan-in barrier 활성화를 재검토 과제로 미룬다 (2026-07-17)

**결정**: Merge 의 비동기 fan-in barrier(`timeout` / `partialOnTimeout` 활성화)를 "다음 단계 예정" 에서 "엔진이 노드 단위 비동기 dispatch 를 도입할 경우 재검토" 로 낮춘다. `timeout` / `partialOnTimeout` 은 무기한 dormant 로 둔다.

**근거는 선결 조건이 엔진 차원에서 기각됐다는 것이다**. 2026-05-11 조사는 "순차 엔진에서는 뜻 있는 barrier 를 구현할 수 없다" 고 결론지었다. 모든 선행 노드가 동시에 풀려 "기다릴 시간" 자체가 0 이기 때문이다. 그래서 활성화의 선결 조건으로 엔진 비동기 dispatch 모델 도입을 들었다. 그 사이 실행 엔진은 반대 방향을 확정했다. [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 은 노드 단위 작업 큐(워커 1개 = 노드 실행 1건)를 채택하지 않는다고 정했고 한 세그먼트 안의 노드 dispatch 는 여전히 프로세스 안 while 루프라고 명시했다. 엔진은 노드 단위가 아니라 실행 단위 시작 큐(워커 1개 = 세그먼트 1개)를 골랐다. 컨테이너·중첩 스코프·되돌아가는 연결선·Parallel 의미를 바꾸지 않으려는 의도된 결정이다.

그래서 barrier 가 요구하는 "시차를 두고 도착하는 입력 기다리기" 는 세그먼트 안 dispatch 가 프로세스 안에서 차례로 도는 한 성립하지 않는다. 그 전제를 바꾸는 것은 Merge 노드 하나를 위해 엔진의 확정된 설계 결정을 뒤집는 일이다. 원래 작업 계획의 수용 기준에는 "PoC 결과가 비현실적이면 ADR 로 마감하고 dormant 표기를 재검토 과제로 바꾼다" 는 분기가 있었다. 이 분기는 PoC 없이 충족됐다. PoC 가 답하려던 질문(엔진을 비동기 dispatch 로 다시 설계할 수 있는가)에 엔진 문서가 이미 "하지 않는다" 고 답했기 때문이다.

**기각한 대안**:

- Merge 전용 부분 비동기 처리: 두 dispatch 모델을 함께 두는 부담과 Background 노드 호환 처리가 따른다. 노드 하나를 위해 엔진에 이질적인 경로를 새로 두는 비용이 얻는 값을 넘는다.
- Background 노드에 동기 완료 대기 옵션 두기: Background 의 사용자 의미(fire-and-forget)를 바꾸므로 기각했다.

**재검토 조건**: 엔진이 노드 단위 비동기 dispatch 를 도입하기로 결정을 뒤집을 때만 이 결정을 다시 연다. 그 결정은 Merge 가 아니라 실행 엔진 차원의 사안이다.

**남은 UX 이슈(이 결정의 범위 밖)**: `timeout` / `partialOnTimeout` 이 무기한 dormant 로 확정됐는데도 스키마와 화면에 계속 보이고 값을 설정하면 노드 경고 규칙이 `blocking` 으로 평가돼 캔버스 배지와 `handler.validate` 차단 에러를 낸다. 영구 dormant 필드를 보이면서 설정하면 막는 것이 맞는지(필드 제거, severity 완화, 현행 유지)는 제품 결정이라 여기서 정하지 않았다. 원래 작업 계획이 끝나도 소유자가 사라지지 않도록 노드 출력 재설계 작업 계획의 제품 결정 항목으로 넘겼다. 이후 NERV Task `CLE-T-AGDM92` 가 맡았고 2026-10-10 결정으로 닫혔다([timeout 기본값을 0 으로 두고 필드와 차단 경고는 유지한다](#timeout-기본값을-0-으로-두고-필드와-차단-경고는-유지한다-2026-10-10)).

### timeout 기본값을 0 으로 두고 필드와 차단 경고는 유지한다 (2026-10-10)

**결정**: `timeout` 기본값을 `300` 에서 `0` 으로 바꾼다. `timeout` · `partialOnTimeout` 필드는 지우지 않는다. 두 dormant 경고 규칙의 severity 는 `blocking` 그대로 둔다. 스키마는 음수 `timeout` 을 거부한다(`.nonnegative()`). 경고 문구와 핸들러 warn 로그에서 "Phase P2 barrier 가 값을 반영한다" 는 안내를 뺐다. 이 안내는 barrier 를 만들지 않기로 한 [2026-07-17 결정](#비동기-fan-in-barrier-활성화를-재검토-과제로-미룬다-2026-07-17) 과 맞지 않았다. 새 문구는 [에러](#에러) 표에 있다.

**근거**: 기본값 `300` 이 기본 설정에서 dormant 경고 `merge:timeout-dormant` 를 켰다. 이 규칙은 `severity` 가 없어 `blocking` 으로 평가된다. 레지스트리의 `resolveDefaultConfig` 는 `safeParse({})` 결과(`timeout: 300`)를 새 노드의 기본 설정으로 내보냈다. 가져오기도 `applyConfigDefaults` 로 같은 값을 채웠다. 엔진은 노드를 실행하기 직전에 `handler.validate` 를 부른다. 검증이 실패하면 에러 메시지가 `INVALID_NODE_CONFIG:` 로 시작하는 에러로 실행이 실패한다([노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md#노드-실행-흐름)). 2026-10-10 에 기본 설정을 `evaluateMetadataBlockingErrors` 로 평가하니 차단 에러가 1건 나왔다. 따라서 설정을 건드리지 않은 Merge 노드는 실행 전 검증에서 막혔다. 저장(`saveCanvas`)은 경고 규칙을 보지 않아서 막히지 않았다.

**기각한 대안**:

- 두 규칙을 `advisory` 로 낮춘다(severity 완화): 값을 둔 사용자가 barrier 가 동작한다고 오인하는 것을 실행 전에 막는 장치가 사라진다. 노드 경고 규칙을 `blocking` 으로 평가해 막는다는 [요구사항](#요구사항) 절의 약속도 뒤집힌다.
- 필드를 없앤다(필드 제거): 저장된 노드 config 와 가져오기 JSON 의 호환을 따로 다뤄야 한다. 세 안 가운데 변경 범위가 가장 크다.
- 기본값 `300` 을 그대로 둔다(현행 유지): 설정을 건드리지 않은 Merge 노드가 실행 전 검증에서 계속 막힌다.

세 안은 [2026-07-17 결정](#비동기-fan-in-barrier-활성화를-재검토-과제로-미룬다-2026-07-17) 의 남은 UX 이슈에 적은 필드 제거 · severity 완화 · 현행 유지다. 기본값 `0` 은 현행 유지안을 고친 안이다. 필드와 차단 경고는 그대로 두고 기본값만 바꾼다. 사용자는 변경이 가장 작은 이 안을 골랐다.

**저장된 데이터**: Flyway `V148__merge_node_timeout_default_zero.sql` 이 `node` 테이블에서 `type='merge' AND config @> '{"timeout":300}'` 인 행만 `timeout` 을 `0` 으로 바꾼다. 어느 행을 바꿀지는 옛 기본값과 구분되는 값인지로 정했다. 300 이 아닌 값은 사용자가 의도해 넣었을 가능성이 높아서 건드리지 않는다. 300 은 옛 기본값과 구분할 수 없다. 그래서 사용자가 일부러 넣은 300 도 0 으로 바뀐다. 이 비용은 받아들인다. 바꾼 행은 `timeout` 이 `0` 이라서 다시 돌려도 바뀌는 행이 없다. 롤백 SQL 은 두지 않고 `-- DOWN:` 주석에 사유만 남긴다. 바꾼 뒤에는 원래 300 이던 행과 원래 0 이던 행을 구분할 수 없다. 바꾼 값은 실행 결과에도 영향이 없다(dormant 필드). 가져오기(`applyConfigDefaults`)는 적힌 값을 바꾸지 않는다. 그래서 옛 기본값 시절에 내보낸 워크플로우 JSON 에 `"timeout": 300` 이 적혀 있으면 가져온 노드에도 300 이 남고 캔버스 경고로 드러난다.

**저장된 데이터에서 기각한 대안** (2026-10-10 사용자 선택):

- 0 보다 큰 값을 모두 0 으로 바꾼다: 300 이 아닌 값은 옛 기본값이 아니라서 사용자가 의도해 넣었을 가능성이 높다. 이 안은 그런 값까지 조용히 지운다. 300 이 아닌 값은 그대로 두고 캔버스 경고로 보이게 한다.
- 버전 스냅샷(`workflow_version.snapshot`)까지 바꾼다: 스냅샷은 과거 기록이라 바꾸지 않는다. 옛 버전을 복원하면 캔버스 경고로 드러난다.
- 이전하지 않는다: 이미 저장된 노드가 계속 실행에 실패한다.

**소유**: 결정은 NERV Task `CLE-T-AGDM92` 가 맡았다. 구현은 `CLE-T-HSHW71` 이 맡았다. 관련 리뷰 발견은 `finding 01a0e5a1-114d-7256-9024-f3899651dea4` 다. 그 지적의 요지는 영구 dormant 필드를 화면에 보이면서 값을 넣으면 실행을 막아도 되는가였다.

### 입력 정규화는 노드 출력 규약 Principle 10 의 대상이 아니다 (2026-10-24)

원문은 입력 정규화에 Principle 10 을 인용했지만 `null` 을 `[null]` 로 감쌌다. Principle 10 대로면 `[]` 다. Merge 는 설정 경로로 값을 꺼내지 않고 입력 전체를 정규화하므로 Principle 10 의 대상이 아니다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 규칙 2). 그래서 Merge 의 지금 동작을 유지했다(NERV Task `CLE-T-3HJ8MM`).

기각한 대안은 `null` 입력을 `[]` 로 바꾸는 안이다. 위쪽 노드가 `null` 을 낸 경우 `inputCount` 가 1 에서 0 으로 바뀌어 기존 워크플로우의 결과가 달라진다.

### `first` 와 `append` 를 지금 의미로 정하고 advisory 경고로 알린다 (2026-11-12)

**결정**: `strategy` 의 `first` · `append` 를 지금 동작 그대로 정식 의미로 정한다. `first` 는 선행 노드 ID 를 정렬한 순서의 첫 입력 하나를 남기고 `append` 는 `wait_all` 과 결과가 같다. 두 값을 고르면 캔버스에 `advisory` 노드 경고를 띄우고 실행은 막지 않는다(REQ-MERGE-018). 경고 규칙은 NERV Task `CLE-T-1J0F6R` 에서 구현했다. REQ-MERGE-003 의 「부분 구현」 표기는 이름이 뜻하는 동작(먼저 도착한 입력, 도착 순서대로 쌓기)을 기준으로 붙어 있었다. 그 동작을 만들지 않기로 했으므로 지웠다(NERV Task `CLE-T-3XGCYA`). 머리 줄의 「부분 구현」 은 경고 규칙(REQ-MERGE-018)이 없던 동안 붙어 있었고 `CLE-T-1J0F6R` 에서 지웠다.

**근거**: 엔진은 모든 선행 노드가 끝난 뒤 Merge 를 실행한다. 노드 단위 비동기 dispatch 를 두지 않는 [2026-07-17 결정](#비동기-fan-in-barrier-활성화를-재검토-과제로-미룬다-2026-07-17) 이 유지되는 한 Merge 는 도착 순서를 알 수 없다. 그래서 이름대로의 동작은 만들 수 없다. 두 값은 같은 입력이면 같은 결과를 낸다. 다만 `first` 가 고르는 선행 노드는 무작위 노드 ID 의 정렬 순서로 정해져 사용자가 고를 수 없고 노드를 복사해 붙여 넣으면 바뀔 수 있다. 이름과 다르게 도는 값이라 사용자가 알 수 있게 경고를 띄운다.

**`timeout` 과 달리 막지 않는 이유**: `timeout > 0` · `partialOnTimeout` 은 값이 결과에 아무 영향이 없는데 사용자는 무언가를 기다린다고 믿는다. 그래서 `blocking` 으로 막는다([2026-10-10 결정](#timeout-기본값을-0-으로-두고-필드와-차단-경고는-유지한다-2026-10-10)). `first` 는 결과를 바꾸는 값이고 `append` 는 기본값 `wait_all` 과 같은 결과를 낸다. 막으면 이 값으로 저장된 노드가 실행 전 검증에서 실패한다. 2026-10-10 에 기각한 「severity 완화」 는 `timeout` · `partialOnTimeout` 두 규칙에 대한 것이고 이 결정의 두 경고 규칙은 새 규칙이다.

**Parallel 결정 K 와 다른 점**: [Parallel 노드](CLE-NODE-PARALLEL.md#waitallfalse-를-지원하지-않는다-2026-05-30-결정-k) 는 `waitAll=false` 를 검증에서 거부한다. 그 값이 기대한 동작(병렬 분기가 끝나는 대로 다음 노드 시작)과 실제 동작의 차이는 실행 시점에만 생겨 출력만 봐서는 알 수 없다. 대신 쓸 Background 노드가 있어서 거부 메시지로 안내할 수도 있다. `first` 는 결과에 입력 하나만 남아서 다른 입력이 빠졌다는 것이 출력에 바로 드러난다. 도착 순서를 지키는 다른 노드가 없어서 거부해도 안내할 대안이 없다. 그래서 막지 않고 경고로 알린다. 경고 규칙을 구현하기 전(`CLE-T-1J0F6R`)에는 이 문서와 머리 줄 구현 상태로만 이 차이를 알 수 있었다.

**캔버스 표시 (2026-11-12, 구현 `CLE-T-1J0F6R`)**: 그때까지 캔버스에는 `advisory` 노드 경고가 표시되지 않았다. 설정 요약 배지에는 `blocking` 경고만 나왔고 `advisory` 는 어시스턴트 검토에만 나왔다. Merge 의 두 규칙이 `advisory` 를 쓰는 첫 노드 경고 규칙이다. 그래서 요약 줄은 그대로 두고 노드 헤더에 경고 아이콘을 띄워 툴팁으로 문구를 보이게 했다. `blocking` 경고가 함께 있으면 `blocking` 만 보인다. 사람이 정했다(NERV 질문 `01a1cefa-8407-76b4-b8d0-4c1511579abf`). 기각한 안은 둘이다. `blocking` 과 똑같이 보이면 요약 줄이 사라진다. 캔버스 표시를 미루면 REQ-MERGE-018 이 부분 구현으로 남는다. [워크플로우 에디터](../CLE-WF/CLE-WF-EDITOR.md#미설정-경고와-경고-배지) 에는 배지 조건이 아직 「필수 설정이 비었을 때」 로만 적혀 있다. 그 표에 `advisory` 행을 더하는 일은 NERV Task `CLE-T-D6C9HJ` 가 맡는다.

**기각한 대안** (2026-11-12 사용자 선택):

- 문서만 맞춘다(경고 없음): 이름과 동작이 다르다는 것을 사용자가 알 길이 문서뿐이다.
- `blocking` 으로 거부한다([Parallel 노드](CLE-NODE-PARALLEL.md#waitallfalse-를-지원하지-않는다-2026-05-30-결정-k) 의 `waitAll=false` 선례): 이 값으로 저장된 노드가 실행 전 검증에서 실패하고 사용자가 에디터에서 하나씩 고쳐야 한다. 결과가 정해진 값을 막을 만큼의 위험은 아니라고 봤다.
- `append` 를 없애고 `first` 를 의미에 맞는 이름으로 바꾼다: 저장된 노드 config 와 가져오기 JSON 을 이전해야 한다. 세 안 가운데 변경 범위가 가장 크다.

### meta 에 전략과 출력 형식을 설정 에코와 함께 둔다 (2026-11-12)

**결정**: `meta.strategy` · `meta.outputFormat` 을 지우지 않는다. 두 값은 `config.strategy` · `config.outputFormat` 과 같다. [노드 출력 규약 Principle 2](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-2-실행-메트릭에는-관측-값만-둔다) 는 `meta` 에 관측 값만 둔다고 정한다. Merge 는 그 예외로 남기고 규약의 Principle 2 표에 Merge 행을 두었다. `meta.dormantFields` 는 설정 값을 옮긴 것이 아니라 핸들러가 무시한 필드를 모은 값이라 그대로 둔다(NERV Task `CLE-T-3XGCYA`).

**근거**: `$node["X"].meta.outputFormat` 으로 출력 모양을 나누는 워크플로우가 이미 있을 수 있다. 지우면 그 표현식이 `undefined` 를 받아 분기가 조용히 바뀐다. 같은 정보를 두 곳에 두던 `output.view` 판별자는 중복이라 폐기했다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#outputview-판별자를-폐기한-이유)). 그 판별자는 초안 단계에서 폐기했고 Merge 의 두 `meta` 필드는 이미 출력에 실려 있다는 점이 다르다.

**기각한 대안** (2026-11-12 사용자 선택):

- `meta.strategy` · `meta.outputFormat` 을 지운다: 위 호환이 깨진다.
- `meta.dormantFields` 까지 셋 다 지운다: 같은 이유로 호환이 깨진다. `dormantFields` 는 설정 에코와 겹치는 값도 아니다.
