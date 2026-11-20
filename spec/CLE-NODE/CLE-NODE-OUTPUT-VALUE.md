---
id: "CLE-NODE-OUTPUT-VALUE"
title: "노드 출력 규약 — 다음 노드가 받는 값"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-OUTPUT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-OUTPUT"]
area: "CLE-NODE"
content_hash: "f3f8cce37e2cbf50ebdd5aae0ca66a7e253e0d96c30d87adedc62b11f8847eb5"
read_as: "approved_fallback"
task: "CLE-T-0ZHAC4"
source_paths: []
mirror_sha256: "bc932f133981975bacf776f15a03928226ca1dece16ab49e5804a691ff0fe7a1"
etag: "sha256-52b7501cf9370667b262123c4a1f5954cb1130087aaf006f6f316df29315f744"
---
## 개요

이 문서는 [노드 출력 규약](CLE-NODE-OUTPUT.md)의 하위 문서로 다음 노드와 실행 결과가 받는 값을 정한다. [Principle 0](CLE-NODE-OUTPUT.md#principle-0-노드-출력의-다섯-필드) 7번의 상세다. 엔진이 라우팅을 위해 값을 들고 다니는 방식은 [노드 핸들러 계약 §포트 선택](../CLE-EXEC/CLE-EXEC-HANDLER.md#포트-선택), 들어오는 연결선 수에 따른 입력 모양은 [실행 엔진 §다중 입력 조립](../CLE-EXEC/CLE-EXEC-ENGINE.md#다중-입력-조립)에 있다.

## 다음 노드가 받는 값

- 다음 노드의 `$input`, `$node["X"].output`, 실행 결과(`Execution.outputData`), 동기 서브워크플로 결과, Background 본문 스냅샷, 컨테이너 본문의 `emit` 결과, Parallel 분기 결과는 모두 핸들러가 `output` 에 둔 값이다.
- 엔진은 이 값을 구조화 출력 캐시(`structuredOutputCache[X].output`)에서 읽는다. 포트 라우팅과 대기 판정에 쓰는 flat 캐시의 값은 읽지 않는다.
- 배열 · 원시값 · `null` 도 감싸지 않고 그대로 넘긴다. 엔진 안의 `{ data }` 객체와 `_selectedPort` 는 이 값에 섞이지 않는다.
- 객체 출력 안의 `data` 키는 사용자 값이다. 엔진은 풀지도 덧붙이지도 않는다.
- 실행 결과는 마지막 노드가 출력 없이 끝나면 `{}` 이고 동기 서브워크플로 결과는 `undefined` 다.

### 배포 전환 동안의 대체 값

구조화 출력 캐시가 생기기 전에 만든 실행 컨텍스트와 Background 큐 작업에는 구조화 항목이 없다. 이 노드만 flat 값에서 제어 필드(`_selectedPort` · `port` · `status` · `_resumeState` · `_resumeCheckpoint`)를 뗀 값을 받는다(`toDownstreamValue`). 이 경로는 배열 · 원시값을 실은 엔진의 `{ data }` 객체를 풀지 않으므로 다음 노드가 그 객체를 받을 수 있다. 배포 직후 이미 진행 중이던 실행에만 생긴다.

## 미결 사항

- 없음.

## Rationale

### 배열 · 원시값 출력을 감싸지 않는다

결정일: 2026-11-05

이 결정 전에는 엔진이 배열 · 원시값 출력에 `port` · `status` · `meta` 가운데 하나라도 있으면 `{ data: <값> }` 으로 감쌌다. 그래서 Code 의 `return [...]` 도 다음 노드가 `$input.data` 로 읽어야 했다. 값 위치를 예측한다는 목표와 [Principle 8.2](CLE-NODE-OUTPUT.md#82-통일된-1차-이름)에 맞지 않았다. 2026-11-05 에 이 감싸기를 없앴다(NERV Task `CLE-T-T30D5S`). 감싼 값을 `$input.data` · `$node["X"].output.data` 로 읽던 워크플로우는 이 결정 뒤 `undefined` 를 읽는다. 호환이 깨지는 변경이다. 엔진 쪽 구현 결정은 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md#다음-노드-값은-구조화-캐시에서-읽는다)에 있다. 같은 날 Code 가 `null` 을 돌려주거나 값을 돌려주지 않는 경우도 맞췄다(NERV Task `CLE-T-X3AH4F`). 전에는 다음 노드가 설정 에코를 받고 success · error 포트가 함께 열렸으나 이제 success 포트만 열리고 다음 노드는 `null` 을 받는다.

기각한 대안은 둘이다. 첫째, `$input.data` 도 같은 값을 주는 별칭은 원시값에 속성을 붙일 수 없고 배열에 `data` 속성을 붙이면 사용자 값의 모양이 바뀐다. 둘째, Code 만 감싸지 않는 노드별 적용은 노드 종류를 알아야 값 위치를 알 수 있어 규약의 목표와 맞지 않는다. 저장된 워크플로우의 `$input.data` 를 자동으로 고치는 마이그레이션도 두지 않았다. 앞 노드의 출력이 배열 · 원시값인지는 실행해 봐야 알 수 있어 표현식만 보고 고칠 곳을 가를 수 없다.

### 실행 결과와 서브워크플로 결과도 핸들러 output 을 싣는다

결정일: 2026-11-19

[앞 결정](#배열--원시값-출력을-감싸지-않는다) 뒤에도 실행 결과와 동기 서브워크플로 결과에는 마지막 노드의 엔진 내부 값이 실렸다. 배열 · 원시값에 `port` 가 있으면 `{ data, _selectedPort }` 였고 객체에는 `_selectedPort` 키가 붙었다. `$node["X"].output` 의 `port` 있는 객체 출력, Background 본문, 재개 뒤의 값도 같았다.

사람이 두 가지를 정했다(NERV Task `CLE-T-JDYHCF`). 첫째, 두 결과에 마지막 노드의 핸들러 `output` 을 그대로 싣는다(NERV 질문 `01a1f1cf-c0f1-7445-bd83-6a823030cb73`, 답 a). 마지막 노드가 출력 없이 끝나면 실행 결과는 `{}` 이고 서브워크플로 결과는 `undefined` 다. 둘째, 이 값은 구조화 출력 캐시(`structuredOutputCache[X].output`)에서 읽고 봉투 표지는 JSON 에 싣지 않는다(NERV 질문 `01a1f1cf-c250-748c-a58a-ef45e2d530c6`, 답 A). 재개 때 DB 에서 되살리는 경로는 정상 실행과 같은 경로로 두 캐시를 채우고 Background 큐 작업은 이 캐시의 스냅샷을 싣는다([Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#실행-로직)).

기각한 대안은 둘이다. 실행 결과에 노드 출력 다섯 필드 전체를 싣는 안은 서브워크플로 결과를 읽는 표현식이 모두 `.result.output.…` 으로 바뀌어 호환 영향이 크다. 값 안 전용 필드(`__engineEnvelope`)로 표지를 남기는 안은 DB 노드 실행 `outputData` 와 WS 이벤트에 그 필드가 보이고 저장 값의 모양이 바뀐다.

호환이 깨지는 변경이다. 실행 결과, [EIA 상태 조회](../CLE-IX/CLE-EIA-INBOUND-STATUS.md#단발-상태-조회)의 `result`, [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md#최종-노드-출력)의 `output.result` 가 배열 · 원시값을 그대로 담고 `_selectedPort` 키가 사라진다. `$node["Workflow"].output.result._selectedPort` 나 `.result.data` 로 봉투를 읽던 표현식은 고쳐야 한다. 이때 다음 노드 `$input` 은 바꾸지 않았고 [다음 결정](#다음-노드-입력도-핸들러-output-을-받는다)에서 맞췄다.

### 다음 노드 입력도 핸들러 output 을 받는다

결정일: 2026-11-19

[앞 결정](#실행-결과와-서브워크플로-결과도-핸들러-output-을-싣는다) 뒤에도 다음 노드 `$input` · 컨테이너 `emit` · Parallel 분기 결과는 flat 캐시 값에서 제어 필드를 떼고 엔진 객체만 풀어 만들었다. 노드마다 이 값을 만드는 경로가 달라 핸들러 `output` 과 어긋나는 경우가 남았다. 사람이 이 셋도 구조화 출력 캐시에서 읽게 정했다(NERV 질문 `01a1f2ca-eb78-7284-a4e8-130f943a9a0f`, 답 A, NERV Task `CLE-T-ZJR3AF`). 엔진 객체를 가르던 `WeakSet` 표지도 지웠다.

호환이 깨지는 변경이다. 바뀐 값은 다섯 가지다.

1. 버튼 재개(Carousel · Chart · Table · Template) 뒤 `$input` 은 대기 시점 출력에 `interaction` · `previousOutput` 을 더한 값이다. 예전에는 `{ type, buttonId, buttonLabel, clickedAt, selectedItem?, nodeOutput }` 이었다.
2. Form 재개 뒤 `$input` 은 `{ interaction }` 이다. 예전에는 `{ interaction, data: { interaction } }` 이었다.
3. 포트와 객체 `data` 를 함께 낸 출력(예: HTTP 요청의 `{ status, data: {…} }`)은 `data` 를 펼치지 않고 그대로 넘어간다.
4. 컨테이너 본문의 객체 `emit` 결과에 `_selectedPort` 키가 없다.
5. `PARALLEL_ENGINE=off` 경로에서 Parallel 뒤 노드의 `$input` 은 `null` 이다. 예전에는 설정 에코였다.

[배포 전환 동안의 대체 값](#배포-전환-동안의-대체-값)은 허용한 열화다(발견 `01a1f310-e874-72aa-b261-0bd45432ffe5`). 표지가 없어 엔진 객체와 사용자가 돌려준 `{ data: … }` 객체를 가를 수 없다. 모양으로 풀면 사용자 객체를 잘못 풀게 되어 풀지 않는 쪽을 골랐다. 구조화 항목이 없는 실행은 배포 전에 시작한 것뿐이라 영향이 짧다.
