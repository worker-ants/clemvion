---
id: "CLE-NODE-TRIG-COMMON"
title: "트리거 노드 공통"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE-TRIG"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-TRIG"]
area: "CLE-NODE-TRIG"
content_hash: "eac4c135bc60e4330cc4b8e212ecb50c94f0e033f6a62e5ad59db5d8f4c83976"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/7-trigger/0-common.md"]
mirror_sha256: "6c2ba0b919e22d0986660adc402512998e4c86c940ef0faf61e4f53c9ab2f414"
etag: "sha256-6babd50c2888c825e4a387a5bf51e30afa4574bac933d9a178cbb7faa3001d4f"
---
> 구현 상태: 구현됨(설정 요약은 미구현) · 원문: `spec/4-nodes/7-trigger/0-common.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 트리거 카테고리 노드 모두에 공통되는 규약을 정한다. 노드별 동작과 설정은 각 노드 문서가 정한다.

지금 트리거 카테고리 노드는 [수동 트리거 노드](CLE-NODE-MANUAL.md) 하나다. 이름과 달리 수동 실행, 웹훅 실행, 스케줄 실행이 모두 이 노드에서 시작한다. 그래서 이 문서의 중심은 세 진입 경로가 함께 쓰는 트리거 파라미터 계약이다.

이 문서가 다루는 것은 다음과 같다.

- 세 진입 경로가 공유하는 트리거 파라미터(trigger parameters, `config.parameters`) 스키마와 값 수집 방식
- 진입 어댑터(trigger adapter)가 엔진에 넘기는 입력 형태와 진입 경로 표시(`meta.source`)
- 트리거 카테고리 노드의 노드 출력 사용 방식

이 문서가 다루지 않는 것은 다음과 같다.

- 파라미터 검증 규칙, 검증 실패 코드, HTTP 응답: [수동 트리거 노드](CLE-NODE-MANUAL.md#검증과-에러)
- 트리거 엔티티(웹훅·스케줄·수동 트리거)의 생성과 관리: [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)
- 웹훅 요청 수신, 본문 추출, 민감 헤더 마스킹: [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)
- 스케줄 파라미터 값 저장과 제한 표현식: [스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md)
- 엔진이 실행을 만들고 입력을 채우는 방식: [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)
- 채팅 플랫폼 어댑터(Telegram 등). 트리거 카테고리 노드가 아니라 웹훅 트리거의 `config.chatChannel` 갈래로 동작한다: [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)

## 규칙

### 1. 세 진입 경로의 파라미터 계약

1. 수동·웹훅·스케줄 세 진입 경로는 같은 파라미터 스키마 하나를 쓴다. 그 스키마는 수동 트리거 노드의 `config.parameters` 다. 경로마다 다른 것은 값을 모으는 방식과 검증 실패를 처리하는 방식뿐이다.

   | 진입 경로 | 값 수집 방식 | 검증 실패 처리 |
   | --- | --- | --- |
   | 수동 | 실행 대화상자 폼, 또는 `POST /workflows/:id/execute { parameterValues }` | 실행을 만들지 않고 `400 Bad Request`(`INVALID_TRIGGER_PARAMETERS`)로 응답한다. |
   | 웹훅 | HTTP POST `body` 에서 파라미터와 같은 이름의 최상위 키를 뽑는다. | HooksService 가 실행을 만들지 않고 `400 Bad Request`(`INVALID_WEBHOOK_PAYLOAD`)로 거부한다. |
   | 스케줄 | 저장한 `schedule.parameterValues` 를 제한 표현식 컨텍스트(`$now`, `$schedule`)로 해석한다. | 스케줄을 등록·수정할 때 DTO 로 검증한다. 실행 때 값이 빠지면 `warn` 로그를 남기고 스키마 없이 가능한 기본값을 채워 진행한다. |
   | 채팅 채널 웹훅(`config.chatChannel`) | 정책(무시·기본값 적용·거부)이 정해지지 않았다. 현재 구현은 `resolveTriggerParameters` 를 거치지 않고 `parameters: {}` 로 실행한다. | 정해지지 않았다. 현재 구현은 필수 파라미터가 있어도 검증 없이 실행한다. [웹훅 미결 사항](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#미결-사항) 참조. |

   검증 사유 코드와 응답 형태는 [수동 트리거 노드](CLE-NODE-MANUAL.md#검증과-에러)가 정한다.

2. 엔진에는 늘 `{ parameters: Record<string, unknown>, ... }` 형태의 입력이 들어간다.
3. 진입 어댑터는 입력에 `__triggerSource: 'manual' | 'webhook' | 'schedule'` 마커를 함께 넣는다. 핸들러는 이 마커로 `meta.source` 를 결정적으로 채운다. 마커는 엔진 내부용이라 핸들러가 출력 전에 지운다. `$input.__triggerSource` 로 새지 않는다.
4. 진입 경로별 `$input` 형태는 다음과 같다.
   - 웹훅: `$input = { parameters, body, headers, query, method }`. 핸들러는 `output.request: { method, headers, query, body }` 로 묶어 내보낸다.
   - 스케줄·수동: `$input = { parameters }`. 핸들러는 `output.request` 를 만들지 않는다.
   - 축약형: `$params === $input.parameters`. 표현식 변수는 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)가 정한다.
5. 채팅 채널 웹훅 경로가 이 계약을 따르는지는 정의가 갈린다. 위 표의 채팅 채널 행은 결정 전까지 현재 구현만 적는다. [미결 사항](#미결-사항) 과 [웹훅 미결 사항](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#미결-사항) 참조.

### 2. 트리거 파라미터 스키마

```typescript
interface TriggerParameterDefinition {
  name: string;                                         // 고유 식별자(영문·숫자·_)
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;                                   // 기본 false
  defaultValue?: unknown;                               // required=false 일 때만 뜻이 있다
  description?: string;                                 // 화면 힌트
}
```

1. `name` 은 트리거 카테고리 노드 안에서 유일해야 한다. 겹치면 검증에 실패한다.
2. 배열이 비었거나 정의가 없으면 파라미터 기능을 끈다. 파라미터 도입 전 동작과 호환된다.
3. 이름 규칙과 타입 강제 규칙은 [수동 트리거 노드](CLE-NODE-MANUAL.md#검증과-에러)에 있다.

### 3. 노드 출력 사용 방식

트리거 카테고리 노드는 [노드 출력 규약 Principle 0](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-0-노드-출력의-다섯-필드)의 다섯 필드 `{ config, output, meta?, port?, status? }` 를 따른다. 트리거 카테고리에서 쓰는 방식은 다음과 같다.

| 필드 | 트리거 카테고리의 사용 방식 |
| --- | --- |
| `config` | 원본 설정 에코. 수동 트리거 노드는 `config.parameters` 에 `TriggerParameterDefinition[]` 스키마를 그대로 싣는다(값이 아니라 스키마). |
| `output` | 모은 파라미터 값. 수동 트리거 노드는 `output.parameters` 에 `$params`(= `$input.parameters`)를 싣는다. `config.parameters` 는 스키마, `output.parameters` 는 해석된 값이라 서로 겹치지 않는다([Principle 1.1](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다)). |
| `meta` | 실행 메트릭만 둔다. `meta.durationMs` 는 보통 0 이다(외부 호출이 없다). 진입 경로 표시 `meta.source: 'manual' \| 'webhook' \| 'schedule'` 는 필수다. 진입 어댑터가 넣은 `__triggerSource` 마커를 핸들러가 받아 채운다. |
| `port` | 출력이 하나라서 `undefined` 또는 `'out'`(메타데이터에 정의한 정적 포트) |
| `status` | 입력을 기다리지 않고 바로 끝나므로 `undefined` |

#### 3.1 입력 포트가 없다

트리거 카테고리 노드는 워크플로우 진입점이라 입력 포트가 없다(`inputs: []`). `execute(input, config, context)` 의 `input` 은 늘 엔진이 넣는 외부 진입 데이터다.

- 수동: `{ __triggerSource: 'manual', parameters }`
- 웹훅: `{ __triggerSource: 'webhook', parameters, body, headers, query, method }`
- 스케줄: `{ __triggerSource: 'schedule', parameters }`

`__triggerSource` 는 핸들러가 `meta.source` 를 정한 뒤 지우므로 다음 노드의 표현식에는 보이지 않는다.

#### 3.2 진입 경로마다 같은 계약

세 진입 경로는 `config.parameters` 스키마와 `output` 의 해석된 값이 같은 형태다. 다른 것은 값을 모으는 방식과 검증 시점뿐이다. 그래서 다음 노드는 진입 경로와 관계없이 `$node["X"].output.parameters.<paramName>` 이나 `$params.<paramName>` 으로 같은 값을 읽는다. 웹훅 경로에만 있는 `output.request` 는 예외다.

### 4. 설정 요약과 출력 구조

- 트리거 카테고리 노드의 설정 요약은 미구현이다. 계획한 형식은 [수동 트리거 노드](CLE-NODE-MANUAL.md#설정-요약)에 있다.
- 출력 케이스는 [수동 트리거 노드](CLE-NODE-MANUAL.md#출력-구조)에 있다.

## 미결 사항

- **채팅 채널 웹훅 경로의 트리거 파라미터 처리**: 이 문서의 계약은 웹훅 경로가 `body` 에서 파라미터를 뽑아 검증하고, 필수 값이 빠지면 400 으로 거부한다고 정한다. 세 경로 모두 `config.parameters` 스키마와 같은 형태의 값을 낸다고도 정한다. 현재 구현은 `config.chatChannel` 이 있는 웹훅 트리거일 때 `resolveTriggerParameters` 를 거치지 않고 `parameters: {}` 와 `chatChannel` 키를 넣어 실행한다(`hooks.service.ts`). 필수 파라미터가 있는 워크플로우도 채팅 채널 경로에서는 검증 없이 빈 값으로 시작한다. [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 에는 이 사실이 적혀 있지 않다. [웹훅 미결 사항](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#미결-사항) 에 같은 항목이 있다. 1절 표에는 채팅 채널 행을 두고 현재 구현만 적었다. 결정 필요: 채팅 채널 경로의 파라미터 정책(무시, 기본값 적용, 거부)을 정해 그 행을 채울지.

## 구현 위치

- `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts`
- `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.schema.ts`
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`: 파라미터 검증·기본값·타입 강제
- `codebase/backend/src/modules/hooks/hooks.service.ts`: 웹훅 진입 어댑터
- `codebase/backend/src/modules/schedules/schedule-runner.service.ts`: 스케줄 진입 어댑터
- `codebase/backend/src/modules/workflows/workflows.controller.ts`: 수동 실행 진입 어댑터

## Rationale

### 세 진입 경로가 스키마 하나를 쓰는 이유

파라미터 스키마를 수동 트리거 노드 한 곳에만 두면 진입 경로가 늘어도 다음 노드는 경로를 몰라도 된다. `$node["X"].output.parameters.<paramName>` 과 `$params.<paramName>` 이 모든 경로에서 같은 값을 가리킨다.

### 진입 경로 마커를 출력에서 지우는 이유

`__triggerSource` 는 엔진 내부 마커다. 핸들러가 이 마커로 `meta.source` 를 정한 뒤에는 쓸 곳이 없다. 다음 노드의 표현식에 엔진 내부 값이 보이지 않도록 출력 전에 지운다. 어느 경로로 실행됐는지는 `meta.source` 로 판단한다.
