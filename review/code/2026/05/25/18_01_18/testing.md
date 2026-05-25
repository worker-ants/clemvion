# 테스트(Testing) 리뷰 — chat-channel-template-render-outbound

검토 일시: 2026-05-25

---

## 발견사항

### [CRITICAL] Discord/Slack renderer 신규 코드 경로에 테스트 전무

- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` (신규 함수 `renderAiMessage`, `renderNodeCompleted`, `renderPresentationPayload`, `renderPresentationByType`), `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts` (동일 4종 함수)
- 상세: 두 renderer 파일에 각각 약 80줄 규모의 신규 로직이 추가됐다. `discord-message.renderer.spec.ts`(184줄)와 `slack-message.renderer.spec.ts`(363줄) 모두 이번 변경으로 추가된 `execution.node.completed` 분기, `renderAiMessage` 내 `presentations[]` 처리, `renderPresentationByType` 의 template/carousel/table/chart 4-way 분기, `renderPresentationPayload` 의 form-skip 경로에 대해 테스트가 단 한 건도 없다. Telegram renderer 는 185줄짜리 신규 테스트 블록이 추가된 것과 대조된다.
- 제안: Discord/Slack 각각에 대해 다음 케이스를 추가한다:
  1. `execution.node.completed` + `nodeType: 'template'` + `output.rendered` → text 1건 반환
  2. `execution.node.completed` + `nodeType: 'carousel'` + `output.payload.items` → 카드 텍스트 반환
  3. `execution.node.completed` + `nodeType: 'table'` / `'chart'` → 텍스트 반환
  4. `execution.ai_message` + `presentations[]` 복수 항목 → text 뒤 sequential 발송
  5. `execution.ai_message` + `presentations` 비어 있음 → text 1건만
  6. `presentations[*].type === 'form'` → skip (form 제외 확인)

---

### [WARNING] `renderPresentationByType` 의 template 이중 경로 테스트 미흡 (Discord/Slack)

- 위치: `discord-message.renderer.ts` 118~124행, `slack-message.renderer.ts` 동일 로직
- 상세: `renderPresentationByType` 내 template 분기는 두 가지 진입 경로가 있다. (1) `execution.node.completed` 진입 시 `nodeOutput = { rendered: '...' }` 직접 참조, (2) `ai_message.presentations[i]` 진입 시 `nodeOutput = { payload: { rendered: '...' } }` 로 wrap 된 구조. 두 번째 경로(`nodeOutput.payload.rendered`)에 대한 테스트가 Discord/Slack 양쪽 모두에 없다. Telegram 쪽도 `execution.ai_message` 의 template type presentations 테스트는 있으나, `nodeOutput.payload.rendered` 추출 경로를 명시적으로 확인하지 않는다(telegramspec 649행 참조).
- 제안: `{ payload: { rendered: 'X' } }` shape 입력 시 `rendered: 'X'` 가 올바르게 추출되는 케이스를 명시적으로 테스트한다.

---

### [WARNING] `renderPresentationByType` 엣지 케이스: `rendered === null` / 빈 문자열 경로 미검증 (Discord/Slack)

- 위치: `discord-message.renderer.ts` 124행 `if (rendered === null || rendered.length === 0) return []`, `slack-message.renderer.ts` 동일
- 상세: `rendered` 가 null 이거나 빈 문자열일 때 `[]` 반환하는 guard 경로가 Discord/Slack 테스트에서 검증되지 않는다. Telegram spec 에도 이 케이스가 없다.
- 제안: `output: { rendered: '' }` 및 `output: {}` (rendered 키 없음) 입력 시 빈 배열이 반환되는 회귀 테스트를 추가한다.

---

### [WARNING] dispatcher `toEiaEvent` — `workflowId` 누락 케이스 미검증

- 위치: `chat-channel.dispatcher.spec.ts` 신규 블록, 144~159행 (triggerId 누락만 검증)
- 상세: base guard 는 `triggerId`와 `workflowId` 양쪽을 모두 검증한다. 추가된 테스트는 `triggerId` 누락만 커버하고, `workflowId` 누락 케이스가 없다. 비대칭 커버리지이다.
- 제안: `triggerId` 가 있고 `workflowId` 가 없는 이벤트도 `null` 반환하는 테스트를 추가한다.

---

### [WARNING] dispatcher `toEiaEvent` — `nodeId`/`nodeType` 누락 케이스 미검증

- 위치: `chat-channel.dispatcher.spec.ts` 신규 블록, `case 'execution.node.completed'` 내 239행 `if (!nodeId || !nodeType) return null`
- 상세: 구현 코드에는 `nodeId` 또는 `nodeType` 이 string이 아닐 경우 `null` 반환하는 guard가 있다. 추가된 테스트에는 이 경로 검증이 없다.
- 제안: `payload: { ...baseRouting, nodeType: 'template' }` (`nodeId` 누락) 와 `payload: { ...baseRouting, nodeId: 'x' }` (`nodeType` 누락) 케이스를 각각 `null` 기대로 추가한다.

---

### [WARNING] Telegram `renderPresentationByType` — chart payload `series` 가 객체 배열일 때 분기 미검증

- 위치: `telegram-message.renderer.ts` 858~860행 `case 'chart': return renderChartFallback(nodeOutput, config)`
- 상세: Telegram spec의 chart 테스트 (`payload.series = [{ name: 's1', data: [1,2,3] }]`)는 series 가 객체 배열인 구조를 사용한다. 그러나 Discord/Slack의 `renderVisualFallback`에서 chart payload 를 처리할 때는 series 를 숫자 배열(`number[]`)로 가정한다 (`const series = Array.isArray(p.series) ? p.series : []`). Telegram은 별도 `renderChartFallback` 을 사용하므로 이 문제는 Discord/Slack에 국한된다. Discord/Slack에 chart 테스트가 없어 런타임 동작이 확인되지 않는다.
- 제안: Discord/Slack chart 테스트 추가 시 `series: [1, 2, 3]` (숫자 직렬) 로 진행하고, spec 문서의 chart payload 스키마와 `renderVisualFallback` 구현의 series 타입 가정이 일치하는지 확인한다.

---

### [INFO] Telegram spec `renderPresentationByType` switch에 `default` 케이스 없음 — TypeScript exhaustive check 의존

- 위치: `telegram-message.renderer.ts` 840~861행 `switch (type)`
- 상세: switch 문에 `default` 분기가 없다. TypeScript 컴파일러가 union type 완전성을 보장하므로 런타임 위험은 낮다. 그러나 Discord/Slack의 `renderVisualFallback` 은 같은 타입을 string 으로 처리하므로 마지막 `return ''`에 의존한다. 패턴 불일치.
- 제안: 조치 우선순위 낮음. 단 추후 새 presentation 타입 추가 시 컴파일 오류 발생 지점이 달라질 수 있음을 인지한다.

---

### [INFO] 테스트 격리 — `it.each` 내 for-loop 방식 혼재

- 위치: `chat-channel.dispatcher.spec.ts` 105~119행 (비-presentation 노드 null 검증)
- 상세: 비-presentation 노드 4종 (`ai_agent`, `code`, `http_request`, `form`) 을 단일 `it` 블록 내 `for` loop 로 검증한다. 실패 시 어느 nodeType 에서 실패했는지 테스트 리포트에서 즉시 식별이 어렵다. 인접 테스트들은 `it.each` 를 사용하고 있어 스타일 불일치이다.
- 제안: `it.each(['ai_agent', 'code', 'http_request', 'form'] as const)(...)` 로 변경해 실패 케이스를 개별 리포트한다.

---

### [INFO] `renderPresentationPayload` `form` skip 경로 — Telegram만 테스트 존재

- 위치: `telegram-message.renderer.spec.ts` 692~712행
- 상세: `presentations[*].type === 'form'` 을 skip 하는 경로는 Telegram spec에만 커버된다. Discord/Slack 쪽에는 이 경로 테스트가 없다. 구현 코드는 세 renderer 모두 동일한 `if (presentation.type === 'form') return []` 를 갖는다.
- 제안: CRITICAL 항목의 Discord/Slack 테스트 추가 시 form skip 케이스를 함께 포함한다.

---

## 요약

이번 변경의 테스트 상태는 **Telegram은 양호, Discord/Slack은 심각하게 부족**하다. Telegram renderer 에는 `execution.node.completed` 4종 + `presentations[]` sequential 발송 + form skip + 회귀 방지까지 포괄적인 신규 테스트 블록이 추가됐다. 반면 Discord/Slack renderer 는 두 파일 합계 약 160줄의 신규 로직(4개 함수 × 2 renderer)이 추가됐음에도 테스트가 전혀 추가되지 않았다. `dispatcher.spec.ts` 의 `toEiaEvent` 신규 블록은 주요 필터 경로(blocking 제외, presentation 외 nodeType 제외, triggerId 누락)를 잘 커버하지만 `workflowId 누락`, `nodeId/nodeType 누락` 등 세부 guard 경로가 빠져 있다. 세 renderer에 공통된 `renderPresentationByType` 의 이중 진입 경로(직접 rendered vs payload.rendered wrapping) 와 빈 문자열 guard 경로도 검증이 필요하다.

## 위험도

HIGH

(Discord/Slack의 신규 presentation 렌더링 경로가 테스트 없이 운영에 노출된다. 회귀 발생 시 탐지 불가.)
