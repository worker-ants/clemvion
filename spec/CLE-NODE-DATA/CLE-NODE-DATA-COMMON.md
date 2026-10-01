---
id: "CLE-NODE-DATA-COMMON"
title: "Data 노드 공통"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE-DATA"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-DATA"]
area: "CLE-NODE-DATA"
content_hash: "7f52ce7aa7f8ad023aac77f1546352f724f4bcdf40cc98286648ba415774ad1a"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/5-data/0-common.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "1c7e67180daf9ba6ec18c5d0d1805796046bc853c2d29180b5cc061d7458c719"
etag: "sha256-1f939d3f1428389fa495465f8c34e8eee22c01ea9d774a7eb578092fc492e164"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/_product-overview.md` (§8 머리말) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Data 노드는 데이터를 바꾸고 코드를 실행하는 노드다. [Transform 노드](CLE-NODE-TRANSFORM.md)와 [Code 노드](CLE-NODE-CODE.md) 두 종류가 있다. 표현식은 값을 참조만 할 수 있으므로 데이터 변환은 모두 이 카테고리의 노드가 맡는다.

이 문서는 두 노드가 함께 따르는 규약을 정한다. 표현식을 평가하는 위치, 노드 샌드박스 적용 범위, 캔버스 요약, 노드 출력 다섯 필드의 카테고리별 사용 방식, 에러 계약이 여기에 속한다. 노드별 설정과 동작은 각 노드 문서가 정한다. 표현식 문법은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md), 노드 출력 일반 규약은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md), 노드 에러 처리 정책은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)이 정한다.

## 규칙

1. 표현식 문법은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)의 정의 하나를 따른다. 평가 위치는 노드마다 다르다(아래 "표현식 평가 위치").
2. Code 노드는 노드 샌드박스에서 실행한다. Transform 노드는 별도 격리 없이 핸들러 프로세스 안에서 변환 연산을 실행하며 외부 네트워크·파일시스템에 접근하지 않는다.
3. 캔버스 요약은 노드 메타데이터의 `summaryTemplate` 으로 렌더한다.
4. 두 노드 모두 블로킹 노드가 아니다. 흐름 지시 상태(`status`)는 비워 둔다.
5. `meta` 에는 실행 메트릭만 둔다. 런타임 에러를 `meta.error`·`meta.errorCode`·`exitReason` 별칭으로 싣지 않는다.
6. 설정 에코는 원본을 싣는다. Code 노드의 `code` 본문도 길이 제한 없이 에코한다.
7. Transform 노드는 런타임 에러 포트가 없다. 설정·표현식 문법 오류만 사전 검증 에러로 던지고, 실행 중 무결성 실패는 에러 없이 건너뛴다(no-op).
8. Code 노드는 사용자 코드의 throw·타임아웃·메모리 초과를 런타임 에러 포트로 보낸다. 컴파일 실패만 사전 검증 에러로 던진다.

## 표현식 평가 위치

| 노드 | 평가 위치 |
|------|-----------|
| Transform | 각 변환 연산이 표현식을 허용하는 파라미터. `set_field` 의 `value`, `math_op` 의 `operand` 등 |
| Code | 코드 본문(`code`)은 평가하지 않는다. 입력은 코드 안에서 `$input`·`$vars` 같은 일반 JS 변수로 읽는다 |

## 노드 샌드박스 적용 범위

Code 노드는 노드 실행 샌드박스 정책([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md))을 따른다. 타임아웃·메모리·허용·차단 API 같은 세부 규칙은 [Code 노드](CLE-NODE-CODE.md) 샌드박스 절이 정한다. Transform 노드는 자체 격리 컨텍스트를 쓰지 않는다.

## 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Transform | `{N} operations` (`operations` 배열 길이) | `3 operations` |
| Code | `{{language\|upper}}` (언어를 대문자로) | `JAVASCRIPT` |

캔버스 요약은 노드 메타데이터의 `summaryTemplate` 을 `getConfigSummary` → `renderSummaryTemplate` 으로 렌더한 결과다. `codeNodeMetadata.summaryTemplate` 은 `{{language|upper}}` 다. 코드 줄 수(`N lines`)는 `summaryTemplate` DSL 이 줄 수 세기를 지원하지 않아 넣지 않는다([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 템플릿 문법).

## 노드 출력

Data 노드는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 0 의 다섯 필드 `{ config, output, meta?, port?, status? }` 를 따른다.

| 필드 | Data 노드에서의 사용 방식 |
|------|---------------------------|
| `config` | 사용자 입력 원본을 에코한다(Principle 7). Code 노드의 `code` 필드는 길이 제한 없이 에코한다(사용자 본인이 쓴 코드). Transform 노드의 `operations[]` 는 표현식 템플릿을 보존한다 |
| `output` | 계산 결과. Transform 은 변환 결과(단일 객체 또는 배열), Code 는 사용자 코드의 `return` 값 |
| `meta` | 실행 메트릭만(Principle 2). 공통은 `meta.durationMs`. Transform 은 `meta.{operationsApplied, operationsSkipped}`, Code 는 `meta.{success, logs}` |
| `port` | Transform 은 비워 둔다(단일 출력). Code 는 `'success'` 또는 `'error'` |
| `status` | 비워 둔다(두 노드 모두 비블로킹) |

## 에러 계약

에러 분류는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3 을 따른다.

| 노드 | 사전 검증 에러 (throw) | 런타임 에러 (`port: 'error'`) |
|------|------------------------|-------------------------------|
| Transform | 설정 검증 실패(연산 형식 오류), 표현식 문법 오류 | 없음. 실행 중 무결성 실패(필드 없음·타입 불일치·파싱 실패 등)는 해당 연산을 건너뛰고(no-op) 다음 연산으로 진행한다 |
| Code | 코드 컴파일 실패(구문 에러) | 런타임 throw, 타임아웃, 메모리 초과 → `output.error.{code, message, details?}` + `port: 'error'` |

- Transform 은 표현식 평가 실패도 사전 검증 에러로 처리한다. 사용자가 캔버스에서 바로 알 수 있어야 하는 설정 오류만 실행 전에 던진다.
- Code 는 사용자가 쓴 임의 코드의 throw 가 정상 시나리오의 일부이므로 런타임 에러 포트로 보낸다.

## 출력 구조 색인

| 노드 | 정상 케이스 | 에러 케이스 | 사전 검증 에러 |
|------|-------------|-------------|----------------|
| [Transform](CLE-NODE-TRANSFORM.md) | 정상 실행(단일 출력) | 없음 | 설정·표현식 오류 |
| [Code](CLE-NODE-CODE.md) | 정상 종료(`success`) | 런타임 에러(`error`) | 코드 컴파일 실패 |

## 구현 위치

- `codebase/backend/src/nodes/data/transform/transform.handler.ts`
- `codebase/backend/src/nodes/data/transform/transform.schema.ts`
- `codebase/backend/src/nodes/data/code/code.handler.ts`
- `codebase/backend/src/nodes/data/code/code.schema.ts`

## Rationale

### 런타임 에러 처리를 두 노드가 다르게 하는 이유

Transform 은 사용자가 캔버스에서 바로 알아야 하는 설정 오류(표현식 평가 실패 포함)만 사전 검증 에러로 던진다. 실행 중 무결성 실패(필드 없음, 타입 불일치 등)는 에러가 아니라 no-op 으로 처리한다. Code 는 사용자가 임의 코드를 쓰므로 throw·타임아웃이 정상 시나리오에 들어간다. 그래서 런타임 에러 포트로 보내 워크플로우가 분기할 수 있게 한다.

### `meta` 에러 별칭 폐기

예전에는 런타임 에러를 `meta.error`·`meta.errorCode`·`exitReason` 별칭으로도 실었다. 노드 출력 규약 개편(Phase 1 (D))에서 별칭을 없애고 `output.error` + `port: 'error'` 하나로 모았다. `meta` 에는 실행 메트릭만 둔다는 Principle 2 와 맞추기 위해서다.
