---
id: "CLE-NODE-OUTPUT-CONTAINER"
title: "노드 출력 규약 — 컨테이너 출력과 빈 입력"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-OUTPUT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-OUTPUT"]
area: "CLE-NODE"
content_hash: "bdffefd7d094612a170b373130c21e07bcb206cfec31c703d49f7dc75dac6eae"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "15a433bcb1bde940fe69ec5d50383c0fea842ddfbe69366fcebb507367687658"
etag: "sha256-b93f36d89c8849aa8345d086ceeb593833ac5424025dc9f13c93cdd9efef78da"
---
## 개요

이 문서는 [노드 출력 규약](CLE-NODE-OUTPUT.md) 의 하위 문서로 컨테이너(Loop·ForEach·Map)와 Parallel 의 엔진 덮어쓰기 출력(Principle 9), 비었거나 null 인 입력의 대체 값(Principle 10), 컨테이너 · Parallel 완료 출력의 `meta` 와 실행 시간을 정한다. 본문 실행 흐름은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md), 배열이 아닌 입력의 노드별 예외 표는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리)이 정한다.

## Principle 9. 컨테이너와 Parallel 의 출력 덮어쓰기

컨테이너(Loop·ForEach·Map)와 Parallel 은 핸들러가 돌려준 `output` 과, 엔진이 반복·병렬 실행을 마친 뒤 덮어쓰는 `output` 이 다르다. 이 엔진 덮어쓰기(engine override)의 규칙을 정한다.

### 9.1 계약

1. 다음 노드가 보는 최종 출력 값에 입력을 그대로 복사하는 pass-through 는 혼란을 주므로 금지한다.
2. 엔진은 모든 반복 회차나 병렬 분기가 끝나면 핸들러 반환값과 상관없이 `output` 을 [9.2](#92-노드별-최종-출력-값) 의 형태로 덮어쓴다. 핸들러를 다시 부르지 않는다. Parallel 의 `PARALLEL_ENGINE=off` 되돌림 경로는 예외다. 이 경로에서는 덮어쓰기가 없고 시작 시점 출력이 남는다([Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md#off-되돌림-경로는-완료-출력을-만들지-않는다-2026-11-02)).
3. 핸들러의 시작 시점 반환값은 노드마다 다르다. Loop·Parallel 은 `output: null` 을, ForEach·Map 은 본문에 나눠 줄 배열을 돌려준다. 이 배열은 엔진 안에서만 쓰는 중간 표현이라 1번의 pass-through 에 해당하지 않는다([Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#엔진-덮어쓰기-계약)). 다음 노드 표현식이 이 값을 보지 않는 범위는 5번에 적었다.
4. 덮어쓰기는 `output` 을 바꾼다. Parallel 은 `port` 도 `'done'` 으로 바꾼다. Loop · ForEach · Map 의 완료 출력에는 `port` 가 없다. `meta` 는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#엔진-덮어쓰기-계약) 규칙 6 대로 합친다. `config` 는 핸들러가 돌려준 그대로 남는다.
5. 덮어쓴 `output` 과 완료 `meta` 는 park · 재구동 없이 이어진 실행에서 다음 노드 표현식(`$node["X"].output` · `$node["X"].meta`)이 읽는다. 노드 실행 기록(`node_execution.output_data`)과 `execution.node.completed` 이벤트에는 아직 시작 시점 반환값이 남는다. 재개 · 재구동 때는 이 저장값으로 실행 컨텍스트를 rehydration 하므로 그 뒤 노드 표현식도 시작 시점 반환값을 읽는다(미구현, [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#미결-사항)). 이 동작은 모든 재개를 손실 없이 되살린다는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md#park-즉시-해제와-rehydration-단일-경로-phase-b) 의 전제를 지금 어기는 결함이다.

### 9.2 노드별 최종 출력 값

| 노드 | 엔진이 덮어쓰는 최종 `output` |
| --- | --- |
| `loop` | `{ iterations: [...], count: N }`. 반복 회차마다 본문 결과를 담는다. |
| `foreach` | `{ items: [...], count: N, skipped? }`. 항목마다 처리 결과를 담는다. 실패한 항목 자리는 `null` 이다. 실패 항목이 있을 때만 `skipped` 를 싣는다. |
| `map` | `{ mapped: [...], count: N }`. 변환 결과 배열이다. |
| `parallel` | `{ branches: [branch_0_result, branch_1_result, ...], count: N, skipped? }`. 병렬 분기마다 결과 노드 출력을 담는다. 실패한 병렬 분기 자리는 `null` 이다. `errorPolicy='continue'` 에서 실패한 병렬 분기가 있을 때만 `skipped` 를 싣는다. |

배열 키(컬렉션 키)는 노드마다 다르다. 다음 노드는 `$node["X"].output.<컬렉션 키>[i]` 와 `$node["X"].output.count` 로 읽는다.

`skipped` 는 ForEach 와 Parallel 만 싣는 선택 필드다. 항목은 `{ index, error: { code, message } }` 이고 `index` 는 컬렉션 배열의 인덱스다. Map 은 `skipped` 를 싣지 않고 실패를 `mapped[i]` 자리에 적는다([Map 노드](../CLE-NODE-LOGIC/CLE-NODE-MAP.md)). `skipped[].error.code` 는 백엔드가 직접 싣는 카탈로그 코드이거나 `AbortError`(취소로 끝난 항목 · 병렬 분기)이거나 `UNKNOWN_ERROR` 다. ForEach · Map · Parallel 이 한 규칙으로 고르고 그 규칙은 [Logic 노드 공통 「반복 결과 출력 구조」](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 4번이 정한다. `AbortError` 는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#3-예외-등록-코드) §3 의 예외 등록 코드다. `UNKNOWN_ERROR` 는 같은 문서 §6.6 에 있다.

### 9.3 반복 중 접근

1. 본문 안에서 `$loop.index`, `$loop.iteration`, `$loop.isFirst`, `$loop.isLast` 는 그대로 쓴다.
2. `$item`, `$itemIndex` 도 그대로 쓴다. [Principle 4](CLE-NODE-OUTPUT-FLOW.md#principle-4-블로킹과-재개-계약)와 관계없다.

변수 표면의 기준은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)다.

### 컨테이너와 Parallel 의 완료 `meta`

Loop·ForEach·Map·Parallel 의 완료 출력에는 `meta.durationMs` 를 싣지 않는다(잠정). 완료 `meta` 에 싣는 필드는 [Principle 2](CLE-NODE-OUTPUT.md#principle-2-실행-메트릭에는-관측-값만-둔다) 의 「컨테이너 · Parallel」 행이 정한다. 네 노드의 `node_execution.duration_ms` 에는 지금 핸들러 실행 시간만 있고 반복 회차 · 병렬 분기 시간은 없다. 노드 전체 실행 시간을 어디에 둘지는 아직 정하지 않았고 이 제외도 그때까지 잠정이다([Rationale](#컨테이너와-parallel-의-완료-출력에-durationms-를-싣지-않는다-잠정-2026-10-24), [미결 사항](#미결-사항)).

## Principle 10. 비었거나 null 인 입력의 대체 값

| 입력 상태 | 기대 동작 |
| --- | --- |
| 배열을 기대한 필드가 `undefined` 또는 `null` | `[]` 로 대체한다. throw 하지 않는다. |
| 객체를 기대한 필드가 `undefined` 또는 `null` | `{}` 로 대체한다. throw 하지 않는다. |
| 배열을 기대한 필드가 배열이 아닌 값(숫자·문자열·객체) | throw 한다(타입 불일치). 예외 노드와 처리는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 표가 정한다. 예외 노드는 `[]` 로 대체한다. `meta.fellBackToEmpty` 로 알릴지도 그 표가 노드마다 정한다. |
| 필수 설정 필드가 없음 | throw(사전 검증 에러, [3.1](CLE-NODE-OUTPUT-FLOW.md#31-분류)) |

예외 표에는 입력 배열을 도는 반복·분리 노드(Split·ForEach·Map)를 올린다. Chart 는 반복·분리 노드가 아니지만 승인본 요구사항이 이미 빈 배열 처리를 정해 표에 함께 올렸다. Filter 노드는 기본 규칙대로 배열이 아닌 입력에 throw 한다. 명백한 사용자 실수이기 때문이다. `null`·`undefined` 는 `[]` 로 처리한다. 예외를 둔 이유는 [Rationale](#예외-표에서-정한-노드만-배열이-아닌-입력을-빈-배열로-바꾼다-2026-10-24) 에 있다.

이 원칙은 노드가 배열을 돌거나 나누려고 설정 경로(`arrayField`·`inputField`·`fieldPath`·`dataField` 등)로 꺼낸 값이 배열이 아닐 때 그 값을 `[]` 로 대체할지 throw 할지를 정한다. 값을 감싸 배열로 만들거나 다른 입력을 쓰거나 연산을 건너뛰는 처리는 이 원칙의 대상이 아니다. 그런 처리의 목록은 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 「배열이 아닌 입력 처리」 규칙 2 에 있다. Merge 는 설정 경로로 값을 꺼내지 않고 입력 전체를 정규화하므로 대상이 아니다. Merge 가 배열이 아닌 입력을 `[input]` 으로 감싸는 동작은 [Merge 노드](../CLE-NODE-LOGIC/CLE-NODE-MERGE.md) 가 정한다.

## 미결 사항

- **컨테이너 완료 출력의 `port`(Principle 5)**: `port: undefined` 는 출력이 하나인 노드용이다. Loop·ForEach·Map 은 출력 포트가 `body`·`done` 둘인데 완료 출력에 `port` 를 싣지 않고 엔진이 `done` 연결선을 직접 활성화한다. Parallel 은 완료 출력에 `port: 'done'` 을 싣는다([Principle 5](CLE-NODE-OUTPUT-FLOW.md#principle-5-출력-포트-선택-모델)). 결정은 [Logic 노드 공통 미결 사항](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#미결-사항) 의 같은 항목에서 한다.
- **컨테이너 · Parallel 노드의 실행 시간(Principle 2)**: Loop · ForEach · Map · Parallel 은 핸들러가 시작 시점 값을 돌려주면 엔진이 바로 노드 실행 기록을 완료로 저장한다. 그래서 기록의 `node_execution.finished_at` · `node_execution.duration_ms` 와 `execution.node.completed` 이벤트의 `duration` 은 핸들러 실행 시간이고 반복 회차 · 병렬 분기 시간은 들어 있지 않다. 성공한 실행에서는 이 기록을 다시 갱신하지 않는다. 그래서 네 노드의 기록 행에는 노드 전체 실행 시간이 없고 본문 노드 행(Parallel 은 병렬 분기 행)의 시각으로 따로 계산해야 한다. `node_execution.duration_ms` 를 노드 실행 시간으로 쓰는 [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 의 `clemvion.node.duration` 메트릭과 [통계](../CLE-OBS/CLE-OBS-STATS.md) 의 노드별 평균 실행 시간과 병목 강조에서도 네 노드가 실제보다 짧게 잡힌다. 결정 필요: 완료 시점에 실행 기록의 끝 시각과 실행 시간을 갱신할지, 완료 `meta` 에 `meta.durationMs` 를 더할지. 실행 기록의 완료 출력 갱신과 함께 NERV Task `CLE-T-JXD0W5` 가 다룬다.

## Rationale

### 엔진 덮어쓰기 형태를 하나로 맞춘 이유

예전에는 Loop·ForEach·Parallel 이 단순 배열을 각자 다른 뜻으로 썼다. 다음 노드가 노드마다 다른 형태를 다루지 않도록 [9.2](#92-노드별-최종-출력-값)의 `{ <컬렉션 키>, count }` 구조로 맞췄다.

### 엔진 덮어쓰기 대상 노드는 핸들러 반환값과 상관없이 덮어쓴다 (2026-10-24)

옛 9.1 은 "핸들러가 null 을 돌려주면 엔진이 반드시 덮어쓰고 null 이 아닌 값을 돌려주면 덮어쓰지 않는다" 고 적었다. ForEach·Map 핸들러는 시작 시점에 본문에 나눠 줄 배열을 돌려준다. 노드 출력 다섯 필드를 깨지 않고 분배용 데이터를 엔진에 넘기려고 정한 형태다([Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#시작-시점-배열을-엔진-내부-표현으로-둔다) 의 Rationale). 엔진은 완료 시점에 이 배열을 `{ <컬렉션 키>, count }` 로 덮어쓴다. [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#완료-시점-덮어쓰기를-엔진이-한다) 과 현재 구현(`execution-engine.service.ts` 의 컨테이너 완료 처리)도 그렇다. 그래서 9.1 을 그 결정과 구현에 맞췄다(NERV Task `CLE-T-3HJ8MM`). 다만 현재 구현은 다음 노드 표현식이 읽는 실행 컨텍스트만 덮어쓴다. 노드 실행 기록 · 이벤트와 재개 · 재구동 때의 rehydration 에는 아직 반영하지 않는다([Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#미결-사항)).

기각한 대안은 옛 서술대로 `null` 일 때만 덮어쓰는 안이다. 그렇게 구현하면 ForEach·Map 의 최종 `output` 이 원래 배열로 남아 다음 노드가 [9.2](#92-노드별-최종-출력-값) 의 형태를 볼 수 없다.

### 예외 표에서 정한 노드만 배열이 아닌 입력을 빈 배열로 바꾼다 (2026-10-24)

옛 Principle 10 은 배열을 기대한 필드에 숫자·문자열이 들어오면 throw 하라고 적었다. Filter 는 그렇게 했지만 Split·ForEach·Map 과 Chart 는 배열이 아닌 값을 모두 `[]` 로 바꿔 왔다. 규약대로 바꾸면 지금 0회 실행이나 빈 결과로 지나가는 워크플로우가 실패로 바뀐다.

사용자가 2026-10-10 에 다음 규칙을 승인했다(리뷰 발견 `finding 01a0e5a1-114b-7604-9136-9788ccc9829c`, NERV Task `CLE-T-3HJ8MM`). 입력 배열을 도는 반복·분리 노드는 배열이 아닌 값을 `[]` 로 처리하고 `meta.fellBackToEmpty` 로 알린다. 다른 노드는 throw 한다. 이 규칙이면 기존 워크플로우의 동작이 바뀌지 않는다. 조용히 지나가던 0회 실행은 `meta.fellBackToEmpty` 로 드러난다.

2026-10-10 결정은 입력 배열을 도는 반복 · 분리 노드만 다뤘다. Chart 는 승인본 요구사항이 이미 빈 배열 처리를 정한 노드라 예외 표에 함께 올렸다. 데이터가 비면 빈 차트가 화면에 바로 보여 사용자가 알아챈다. 그래서 `meta.fellBackToEmpty` 도 싣지 않는다. Chart 쪽 근거는 [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md#datafield-가-배열이-아니면-빈-배열로-그린다-2026-10-24) 에 있다.

2026-10-10 결정의 "다른 노드는 throw 한다" 를 글자 그대로 따르면 Merge · Carousel · Table · Transform 도 throw 로 바꿔야 한다. 이 노드들은 배열이 아닌 값을 `[]` 로 대체하지 않고 감싸거나 다른 입력을 쓰거나 연산을 건너뛴다. 2026-10-10 결정은 이런 처리를 따로 다루지 않았다. 이 개정은 이 처리들을 Principle 10 의 대상에서 빼고 지금 동작을 그대로 두었다([Principle 10](#principle-10-비었거나-null-인-입력의-대체-값) 마지막 문단). 처리 목록과 기각한 대안은 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-예외-노드를-이-문서에-모은다-2026-10-24) 에 있다.

기각한 대안은 네 가지다.

- 모든 노드를 throw 로 맞추는 안. Split·ForEach·Map 을 쓰는 기존 워크플로우의 동작이 바뀐다.
- Chart 만 throw 로 바꾸고 2026-10-10 기준을 그대로 두는 안. 승인된 Chart 동작과 기존 워크플로우를 깬다. 데이터가 아직 없을 때 빈 차트를 보여 주던 워크플로우가 실패로 바뀐다.
- Chart 에도 `meta.fellBackToEmpty` 를 싣는 안. Chart 는 표시 노드라 다음 노드가 이 신호로 분기할 일이 드물다. 지금 이 값을 요구하는 곳도 없다.
- 예외를 각 노드 문서에만 적는 안. 새 노드를 만드는 쪽이 기준을 찾을 곳이 없어 같은 불일치가 다시 생긴다. 그래서 예외 목록을 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 한 곳에 둔다.

### 컨테이너와 Parallel 의 완료 출력에 `durationMs` 를 싣지 않는다 (잠정, 2026-10-24)

옛 Principle 2 는 `meta.durationMs` 를 모든 노드의 공통 필드로 두었다. 그런데 Loop·ForEach·Map 의 완료 `meta` 는 핸들러가 돌려준 `meta` 에 엔진이 잰 반복 메트릭(`iterations`·`skippedCount` 등)을 합친 값이다. Parallel 의 완료 `meta` 에는 `clampedConcurrency` 만 있다. 엔진은 여기에 `meta.durationMs` 를 더하지 않는다. 그래서 지금 동작을 계약으로 정했다(NERV Task `CLE-T-3HJ8MM`). 노드 전체 실행 시간은 완료 `meta` 보다 노드 실행 기록에 두는 방향을 먼저 검토했다. 그런데 2026-10-24 에 확인한 코드에서 이 네 노드의 `node_execution.duration_ms` 는 핸들러 실행 시간뿐이다. 그래서 이 제외는 실행 시간을 둘 곳이 정해질 때까지 잠정이다.

옛 Principle 2 와 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) 은 엔진이 모든 노드에 `meta.durationMs` 를 넣는다고 적었다. 그런데 2026-10-24 에 확인한 코드에서 엔진이 이 값을 확정해 넣는 곳은 폼 재개 경로뿐이다. 그래서 이 개정은 "엔진이 모든 노드에 넣는다" 는 옛 서술을 걷고 일반 노드의 주입 주체를 노드 문서에 맡긴다. 노드 문서의 "엔진 주입" 표기는 고치지 않는다. 코드를 옛 서술에 맞출지 문서를 코드에 맞출지 아직 정하지 않았기 때문이다. 그 결정은 [부모 문서의 미결 사항](CLE-NODE-OUTPUT.md#미결-사항) 과 NERV Task `CLE-T-1GJKB2` 가 맡는다.

이 개정에서 기각한 대안은 없다. 엔진이 컨테이너와 Parallel 의 완료 `meta` 에 `meta.durationMs` 를 더하는 안과 완료 시점에 노드 실행 기록을 갱신하는 안은 둘 다 엔진 코드를 바꿔야 한다. 지금은 어느 쪽도 정하지 않았고 NERV Task `CLE-T-JXD0W5` 가 정한다. 엔진이 일반 노드에도 모두 넣도록 구현을 옛 서술에 맞추는 안도 미결로 남겼다. 노드마다 측정 지점을 확인해야 해서 이 개정의 범위를 넘는다.

### 완료 출력 표에 `skipped` 와 Parallel 의 `port: 'done'` 을 올린다 (2026-11-02)

[Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md#완료-출력은-병렬-분기-결과를-그대로-두고-실패를-따로-모은다-2026-11-01) 는 2026-11-01 에 완료 출력을 `{ branches, count, skipped? }` 로, 완료 `port` 를 `'done'` 문자열로 정했다(구현 NERV Task `CLE-T-2HD471`). ForEach 는 그 전부터 실패 항목이 있으면 `skipped` 를 실어 왔다. 이 규약의 9.2 표와 Principle 5 표만 이 내용과 Parallel 의 실패 자리 `null` 을 빠뜨려 노드 문서 · [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#엔진-덮어쓰기) 과 갈렸다. 그래서 두 표를 노드 문서와 구현에 맞췄다. 출력 형태는 노드 문서가 정했으므로 기각한 대안이 없다. `port` 를 배열이 아닌 문자열로 둔 이유는 [Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md#완료-출력-port-는-done-문자열이다-2026-11-01) 에 있다.

### `skipped[].error.code` 의 임시 예외를 닫는다 (2026-11-05)

2026-11-02 에는 `skipped[].error.code` 가 `UPPER_SNAKE_CASE` 규칙([3.2](CLE-NODE-OUTPUT-FLOW.md#32-outputerror-표준-형태))을 따르지 않아 9.2 에 임시 예외로 적었다. Parallel 만 고치면 ForEach 와 값이 갈려서 함께 정리하도록 미뤘다. 당시 예외의 정본 서술은 [Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md#errorcode-의-값-2026-11-01) 에 있다. NERV Task `CLE-T-REC4X3` 이 ForEach · Map · Parallel 의 실패 회차 `error.code` 를 한 규칙으로 정리했다. 값은 이제 백엔드가 직접 싣는 카탈로그 코드, [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#3-예외-등록-코드) §3 의 예외 `AbortError`, 대체값 `UNKNOWN_ERROR` 중 하나다. 그래서 9.2 의 임시 예외 문장을 지우고 그 규칙을 가리키게 했다. 규칙과 근거, 기각한 대안은 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#실패한-회차와-병렬-분기의-errorcode-2026-11-05) 에 있다. 이 개정은 규약 문장을 그 결정에 맞추기만 하므로 따로 기각한 대안이 없다.
