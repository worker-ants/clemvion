---
id: "CLE-NODE-OUTPUT-ECHO"
title: "노드 출력 규약 — 설정 에코"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-OUTPUT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-OUTPUT"]
area: "CLE-NODE"
content_hash: "8caf635d9c33155cab6470002d54e297d8938b5ec48b2a70e932c59809b93981"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "3ab25cdd2ed5a1d15fd3dcbfd02af86ed377ee81f2b2d6808f376aea5170f9ad"
etag: "sha256-482a66acbc079e1e915bedec1c5a65acb89d22717fa44da14c1cc153971f7d7b"
---
## 개요

이 문서는 [노드 출력 규약](CLE-NODE-OUTPUT.md) 의 하위 문서로 설정 에코(`NodeHandlerOutput.config`)에 무엇을 어떤 형태로 싣는지(Principle 7)를 정한다. `config` 와 `output` 을 나누는 기준은 부모 문서의 [Principle 1.1](CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다), 나가는 페이로드의 마스킹 방식은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)이 정한다.

## Principle 7. 설정 에코 원칙

`NodeHandlerOutput.config` 에는 워크플로우 작성자가 설정한 원본 값(표현식 평가 전)을 그대로 싣는다. 표현식(`{{ ... }}`)이 들어간 필드는 평가 전 형태를 싣고, 평가 결과는 `output.*` 에 둔다.

다음 노드는 두 경로를 다르게 쓴다.

- `$node["X"].config.<field>`: 노드를 어떻게 설정했는가(원본 템플릿)
- `$node["X"].output.<field>`: 노드가 실제로 무엇을 만들고 썼는가(평가 결과)

규칙은 다음과 같다.

1. 마스킹은 나가는 곳(egress)에서만 한다. 표현식은 원문을 읽는다. `config` 는 `NodeExecution.outputData` 에 원문으로 저장하고, REST 응답(`redactStoredDataForResponse`)과 WebSocket 전송(`maskWireEnvelope`)에서만 가린다. 두 경로 모두 공용 `deepRedactSecrets*` 를 쓴다. 방식은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)이 정한다.
2. 그래서 핸들러가 `config` 에 시크릿 평문을 싣지 않는 것이 상시 불변식이다. egress 가 가리는 것은 키 이름으로 알아보는 값뿐이고, DB 와 표현식은 원문을 본다.
3. `config` 와 `output` 이 겹치지 않는 것은 [Principle 1.1](CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다)의 핵심 전제다. 핸들러가 `context.rawConfig` 를 다시 싣는 방식으로 이를 지킨다. 엔진 쪽 요구 `ENG-RC-*` 는 [노드 핸들러 계약 §원본 설정 노출 요구](../CLE-EXEC/CLE-EXEC-HANDLER.md#원본-설정-노출-요구)에 있고 인터페이스도 같은 문서에 있다.

### 싣는 값

항상 싣는 값은 사용자가 화면에서 설정한 비민감 값이다. 원본 형태로 싣는다.

- `method`, `url`(자격 증명을 뺀 원본), `queryType`, `mode`, `model`, `systemPrompt`(원본, `{{ }}` 포함 가능), `userPrompt`(원본), `subject`(원본), `body`(원본), `code`(원본 사용자 코드 본문, `code.config.code`), `fields`, `title`, `submitLabel`, `layout`, `items`, `columns`, `chartType`, `conditions`, `categories`, `iterationLimit`, `branchCount`, `maxTurns`, `maxCollectionRetries`, `outputFormat` 등.

`code.config.code` 는 `systemPrompt`·`userPrompt`·`body` 와 같은 부류인 사용자가 쓴 원본 텍스트다. `config.code` 에 그대로 싣는다(디버깅과 다음 노드 참조용, 비민감). 코드가 `expression-exclusions` 에 올라 있는 것은 표현식 평가 대상에서 뺀다는 뜻일 뿐이다. 싣지 않는다는 뜻이 아니다. 기준은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md)다.

크기가 큰 값도 싣는다.

- `form.config.fields` 가 아주 커도 그대로 싣는다. 정의상 구조 정보다.
- `ai_agent.config.systemPrompt` 가 수천 줄이어도 그대로 싣는다. 디버깅에 쓴다.

### 싣지 않는 값

절대 싣지 않는 값은 다음과 같다.

- 자격 증명(password, apiKey, token, secret, OAuth 자격 증명)
- URL 에 박힌 자격 증명. `https://user:pass@host` 는 `https://host` 로 정리한다.
- 파일 업로드 원본 바이너리. 참조만 싣는다.

egress 값 마스킹이 이 금지를 한 번 더 막는다. 위 금지는 핸들러의 의무지만 핸들러가 놓치거나 자유 텍스트 필드(`code`, `systemPrompt`, `body` 등) 안에 자격 증명 리터럴이 들어 있으면 잡지 못한다. 그래서 `outputData` 가 응답이나 이벤트로 나갈 때 자격 증명 값 패턴(`Bearer …`, 자격 증명이 든 URI 등)을 `***` 로 바꾼다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md), [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 이는 "그대로 싣는다" 원칙의 예외가 아니다. 금지 목록이 이미 자격 증명을 에코 대상에서 뺐고, 마스킹은 그 규칙을 나가는 곳에서 한 번 더 지키는 방어층이다. 자격 증명이 아닌 설정(코드 로직, 프롬프트 본문, 필드 정의)은 바뀌지 않고 실린다. DB 는 원문을 그대로 둔다. 마스커와 스캐너의 깊이 상한, 경계 연산자, 표시 좌표계는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)이 정한다.

### 원본 설정과 평가 결과

원본 설정과 평가 결과의 관계는 다음과 같다([Principle 1.1](CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다) 재확인).

- 원본 설정 필드는 `output` 에 복사하지 않는다.
- 표현식 평가 결과는 `output.*` 에 한 번만 둔다. 이름은 [8.2](CLE-NODE-OUTPUT.md#82-통일된-1차-이름)의 카테고리별 원칙을 따른다.
- 표현식을 쓰지 않는 필드(예: `mode`, `chartType`)는 원본과 평가 결과가 같다.

`context.rawConfig` 의 변경을 막는 규칙은 다음과 같다.

1. 엔진은 `Object.freeze` 를 적용한 얕은 스냅샷을 넘긴다. 최상위 필드를 바꾸면 strict 모드에서 TypeError 가 난다.
2. 얕은 동결이다. `rawConfig.headers.foo = '...'` 같은 중첩 객체 변경은 막지 못한다. 핸들러는 rawConfig 를 읽기 전용으로 다루고, 바꿔야 하면 `structuredClone` 으로 복제한다.

### 명시 나열

설정 에코는 키를 하나씩 나열해서 만든다.

1. 권장 방식은 비민감 필드를 하나씩 적는 것이다. 아래 핸들러 구현 예를 따른다.
2. spread 로 싣지 않는다. `{ ...context.rawConfig }` 나 `{ ...rawConfig, ...overrides }` 형태를 금지한다. 이유는 [Rationale](#설정-에코를-명시-나열로-만드는-이유)에 있다.
3. 기준 구현은 `background.handler.ts` 의 명시 나열 블록(`notes`, `notifyOnFailure`, `maxDurationMs` 만 나열)이다. `background.handler.spec.ts` 의 자격 증명 누출 방지 테스트가 이를 강제한다. 이 테스트는 rawConfig 에 가상의 `apiKey` 를 넣어도 에코에 새지 않는지 확인한다.
4. 모든 노드 핸들러는 스키마의 비민감 필드를 항상 싣는다. 값이 `undefined` 여도 키를 둔다. 이런 키는 출력을 JSON 으로 저장하거나 내보낼 때 빠지므로 저장된 출력과 API 응답에는 보이지 않는다. 표현식으로 읽으면 `undefined` 다. 설정하지 않은 필드에 핸들러가 기본값을 채우는지, 채우지 않으면 동작이 어떤 값일 때와 같은지는 노드 문서의 출력 필드 표에 필드마다 적는다. 이런 필드는 선택 필드라 표에 `?` 를 붙인다([Principle 11](CLE-NODE-OUTPUT.md#principle-11-출력-예시-작성-규칙) 규칙 2). 이 규칙과 다르게 적은 노드 문서가 있다. [미결 사항](#미결-사항) 참조.

핸들러 구현 예는 다음과 같다. 핸들러는 `context.rawConfig` 를 싣고, 평가한 값으로 동작한다.

```ts
async execute(input, config /* 평가된 설정 */, context /* { rawConfig, ... } */) {
  const evaluatedSubject = config.subject as string;          // "Hello Alice"
  const evaluatedBody = config.body as string;
  await sendMail({ subject: evaluatedSubject, body: evaluatedBody, ... });

  return {
    config: {
      // 원본을 싣는다. 사용자가 표현식으로 썼다면 "{{ name }}" 그대로.
      // 비민감 필드를 하나씩 적는다.
      integrationId: context.rawConfig?.integrationId,
      to: context.rawConfig?.to,
      subject: context.rawConfig?.subject,                    // "Hello {{ name }}"
      body: context.rawConfig?.body,
      bodyType: context.rawConfig?.bodyType,
    },
    output: {
      messageId: info.messageId,
      // 평가한 값. 다음 노드가 실제로 보낸 내용을 읽는다.
      subject: evaluatedSubject,
      body: evaluatedBody,
      bodyType: config.bodyType,
    },
  };
}
```

## 미결 사항

- **정보 추출기의 설정 에코 키 이름(Principle 7)**: 이 규약은 비민감 스키마 필드를 모두 항상 싣는다고 정한다. [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md)는 `outputSchema` 를 `schema` 키로 싣고 이를 미뤄 둔 알려진 결함으로 적는다. 결정 필요: 이 이름을 예외로 인정할지, 노드를 규약에 맞출지. Loop `breakCondition` 은 2026-11-12 에 싣기로 정했다(결정 NERV Task `CLE-T-QV1NFT`, 구현 `CLE-T-CYCGST`). ForEach `errorPolicy` 는 핸들러가 이미 싣고 [ForEach 노드](../CLE-NODE-LOGIC/CLE-NODE-FOREACH.md) 출력 표 정리는 NERV Task `CLE-T-W0377J` 가 맡는다.

## Rationale

### 설정을 원문으로 저장하고 나가는 곳에서만 가린다 (2026-08-24)

예전에는 `config` 를 "해석된 설정값(자격 증명 제거)" 으로 정의했다. 이 서술은 엔진 경계(`handler-output.adapter.ts`)가 저장 전에 마스킹한다는 전제에 기대고 있었다. 그 경계는 제거됐다. 저장 전에 가리면 `$node["X"].config.<field>` 가 리터럴 `****abcd` 를 읽는다. 이는 보이는 정보가 줄어드는 정도가 아니라 기능이 오염되는 문제였다. 그래서 `config` 는 원문으로 저장하고 REST·WebSocket 으로 나갈 때만 가리기로 했다. [응답 자격 증명 마스킹 §1.1](../CLE-API/CLE-API-EGRESS.md#11-egress-only)의 egress 전용 원칙과 같은 방향이다. 근거와 경위는 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)의 R-5 에 있다. 같은 날 정리한 `_resumeState`·`_retryState` 의 자격 증명 제외 방식은 [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#_resumestate--_retrystate-의-자격-증명-제외-방식-2026-08-24)에 있다.

### egress 값 마스킹을 방어층으로 둔 이유 (2026-08-17)

"절대 싣지 않는다" 목록은 핸들러의 의무다. 하지만 핸들러가 놓치거나 자유 텍스트 필드 안에 자격 증명 리터럴이 박혀 있으면 이 의무만으로는 막지 못한다. 그래서 나가는 경로에서 값 패턴을 한 번 더 가린다. 새 예외를 만든 것이 아니라 같은 금지를 다른 층에서 한 번 더 지키는 것이다.

### 설정 에코를 명시 나열로 만드는 이유

spread 로 싣지 않는 이유는 세 가지다.

1. 자격 증명 누출 위험. 스키마에 새 민감 필드가 생기면 자동으로 노출된다.
2. 회귀를 알아채기 어렵다. 어떤 필드가 실리는지 단위 테스트로 명시해 검증할 수 없다.
3. 죽은 필드가 계속 실린다. 폐기 예정 필드가 자동으로 계속 나온다.

규칙 4 에 처음 적어 둔 보강 대상 필드(`switch.hasDefault`, `if-else.strictComparison`, `map.errorPolicy`, `foreach.errorPolicy`, `carousel.maxItems`, `chart.dataField` · `groupBy` · `colors`, `template.helpers`, `table.pagination`, `variable-modification.recordValues`)는 2026-11-07 에 코드와 대조하니 핸들러가 모두 싣고 있어서 목록을 지웠다(NERV Task `CLE-T-ETAZAT`). If/Else · Switch · 변수 수정 문서의 출력 예시와 필드 표는 같은 날 맞췄다(NERV Task `CLE-T-FZ6N7A`). 미설정 필드가 JSON 에서 빠진다는 점도 같은 날 규칙 4 와 Principle 11 규칙 2 에 적었다. Map · ForEach · Table · Carousel · Template 문서의 출력 필드 표를 이 형식에 맞추는 일은 NERV Task `CLE-T-W0377J` 가 맡는다.

2026-11-12 에 규칙 4 에 예외 목록(노드 · 필드 · 이유)을 두는 안을 검토하고 기각했다. [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) 는 엔진이 `breakCondition` 을 직접 평가한다는 이유로 이 필드를 싣지 않는다고 적어 두었다. 표현식 평가에서 빼는 것과 에코에서 빼는 것은 다른 일이라서 Code `code` 처럼 싣기로 했다. 예외를 두면 다음 노드가 노드마다 어떤 필드가 빠지는지 따로 알아야 한다. 결정은 NERV Task `CLE-T-QV1NFT`, 구현은 `CLE-T-CYCGST` 가 맡는다.

2026-11-13 에 Principle 7 의 작업 레이블 표기를 지웠다. 한 작업 안에서 쓰던 레이블이라 다른 문서에서는 뜻을 알 수 없다. 동작은 바뀌지 않는다.
