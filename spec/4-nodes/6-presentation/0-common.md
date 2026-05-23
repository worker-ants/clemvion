---
id: common
status: spec-only
code: []
---

# Spec: Presentation 노드 공통 규약

> 관련 문서: [PRD Presentation 노드](../_product-overview.md#9-presentation-노드-6종) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [Spec 실행/디버깅 §10 Run Results Drawer](../../3-workflow-editor/3-execution.md#10-run-results-drawer)

본 문서는 Presentation 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [Carousel](./1-carousel.md)
- [Table](./2-table.md)
- [Chart](./3-chart.md)
- [Form](./4-form.md)
- [Template](./5-template.md)

---

## 1. ButtonDef 구조

Carousel / Table / Chart / Template 노드가 공통으로 사용하는 버튼 정의 (Form 노드는 자체 FormField 구조를 사용).

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | String (UUID v4) | 자동 생성 | 불변 버튼 식별자. `port` 타입일 경우 동적 출력 포트 ID로 사용 |
| label | String | ✓ | 버튼 텍스트 (`{{ }}` 표현식 지원) |
| type | Enum | ✓ | `link` (외부 URL) / `port` (노드 포트 연결) |
| url | String | type=link 시 ✓ | 외부 URL (`{{ }}` 표현식 지원) |
| style | Enum | ✗ | `primary` / `secondary` / `outline` / `danger` (기본: `secondary`) |
| userMessage | String | ✗ | (선택) `type: "port"` 버튼 클릭 시 chat 에 발화될 user message 텍스트. AI Agent `render_*` tool 모드에서 LLM 이 명시 가능. 미지정 시 클라이언트가 fallback 합성 — per-item 버튼은 `"{item.title} → {label}"`, global 버튼은 `"{label}"` ([§10.8](#108-render_-클릭-user-message-합성) SoT). presentation 노드 본체 (graph-port 분기) 에서는 무시되며 `type: "link"` 에서도 무시 (외부 URL 이동 시맨틱이 우선) |

### 1.1 유효성 검증

| 규칙 | 설명 |
|------|------|
| 버튼 라벨 필수 | 각 ButtonDef의 `label`은 비어있을 수 없음 |
| link URL 필수 | `type: "link"`는 `url`이 필수 |
| port에 URL 불가 | `type: "port"`는 `url` 설정 불가 |
| 최대 버튼 수 | 노드당 최대 **5개** (globalButtons). Carousel `itemButtons` 도 각 아이템당 5개. ([§Rationale](#rationale) 참조 — 단일 아이템 가시 모델 global 5 + item 5 = 10) |
| 버튼 ID 고유 | 노드 내 모든 버튼 ID 유일 |
| 미연결 port 경고 | port 타입 버튼의 동적 포트에 엣지 미연결 시 경고 (에러 아님) |
| `userMessage` 는 `type: "port"` 한정 | `type: "link"` 에 `userMessage` 설정 시 무시 (warning 아님 — 외부 URL 이동이 우선 시맨틱이라 동작 변화 없음). presentation 노드 본체 (graph-port 분기) 에서도 무시 — 본 필드는 AI Agent `render_*` tool 모드의 user-message 발화에만 효과 ([§10.8](#108-render_-클릭-user-message-합성)) |

## 2. 포트 토폴로지 (Non-blocking vs Blocking)

ButtonDef 사용 노드(Carousel / Table / Chart / Template)는 `buttons` 배열의 유무로 포트 구성이 달라진다.

**버튼 미설정 시 (기본):**

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | 노드 결과 출력 |

**버튼 설정 시:**

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Global Button Port | 출력 | `{button.id}` | 글로벌 port 타입 버튼마다 동적 생성 |
| Item Button Port (Static) | 출력 | `{button.id}` | (Carousel) Static 모드: 각 아이템의 port 타입 버튼마다 개별 포트 생성. 포트 라벨: `"아이템 제목 › 버튼 라벨"` |
| Item Button Port (Dynamic) | 출력 | `{itemButton.id}` | (Carousel) Dynamic 모드: `itemButtons` 정의의 port 타입 버튼마다 포트 생성. 런타임에 아이템별 고유 ID(`{id}__item_{idx}`)가 생성되나, 포트 라우팅은 원래 정의 ID로 수행 |
| Continue | 출력 | `continue` | **link 타입 버튼만 존재**할 경우 자동 생성 |

> `out` 포트는 버튼 설정 시 **제거**된다. port 타입 버튼의 동적 포트가 출력을 대체한다. link 타입 버튼만 존재할 경우 `continue` 포트가 `out`을 대체한다.

## 3. Blocking Mode 실행 흐름

ButtonDef 사용 노드는 `buttons`(또는 Carousel 의 아이템 버튼)이 하나라도 있으면 **Blocking Mode** 로 진입한다.

1. 글로벌 버튼 + 모든 아이템 버튼을 합쳐서 `buttonConfig.buttons`에 포함
2. (Carousel 의 동적 모드) 아이템 버튼 ID → 아이템 인덱스 매핑을 `buttonConfig.buttonItemMap`에 저장
3. 렌더링 출력을 `NodeExecution.output_data`에 저장
4. `NodeExecution.status` = `waiting_for_input`, `Execution.status` = `waiting_for_input`
5. WS 이벤트 `execution.waiting_for_input` 발행 (`interactionType: "buttons"`, `buttonConfig` 포함)
6. 사용자 인터랙션 대기 (외부 cancel/종료 전까지 무제한 대기):
   - **글로벌 port 버튼 클릭** → 해당 버튼의 동적 포트(`{button.id}`)로 데이터 전달
   - **아이템 port 버튼 클릭** → 해당 포트로 데이터 전달 + `selectedItem` 필드에 아이템 데이터 포함. Dynamic 모드의 경우 런타임 ID(`{id}__item_{idx}`)에서 원래 정의 ID를 추출하여 포트 라우팅에 사용
   - **Continue 클릭** (link 전용 시) → `continue` 포트로 렌더링 출력 전달
7. `NodeExecution.interaction_data`에 클릭 정보 기록
8. `buttonConfig`는 실행 결과에 보존하여 실행 내역 페이지에서 모든 버튼을 표시 가능

> **포트 라우팅 메타데이터**: 버튼 클릭 시 output에 `_selectedPort`가 설정되어 엣지 기반 라우팅에 사용된다. 이 메타데이터는 다운스트림 노드의 input으로 전달될 때 자동으로 제거되어, pass-through 노드(Variable 등)를 거쳐도 이후 노드가 잘못 skip되지 않는다.

## 4. 출력 포맷 (Principle 1.1 / 4.3 / 4.5)

Presentation 노드 출력은 다음 원칙을 따른다:

- `output` 에는 **런타임 생성값** (items / rows / data / rendered 등) 만 담는다. layout / mode / titleField / pageSize / chartType 등 **리터럴 config 값은 echo 하지 않는다**. 후속 노드/UI 는 `$node["X"].config.*` 에서 읽는다.
- 노드 판별용 `type: 'carousel' | 'table' | 'chart' | 'form' | 'template'` 래퍼는 사용하지 않는다 (Principle 1.1.4).
- **Output size cap (1MB — `PRESENTATION_MAX_BYTES = 1024 × 1024`)**:
  - Carousel `output.items` / Table `output.rows` 는 각각 직렬화 후 1MB 를 넘으면 **tail 부터 element 단위로 잘라낸다**.
  - 초과 시 `output.{itemsTruncated|rowsTruncated}: true` 와 `output.{itemsTotalCount|rowsTotalCount}` (잘리기 전 element 개수) 가 함께 surface.
  - 잘린 결과도 **array 형태가 유지** — 다운스트림 ForEach / Map / `output.items[i]` 접근은 그대로 동작하며 `length` 만 짧아진다.
  - `rendered` HTML 은 cap 적용 후의 items/rows 로부터 다시 생성된다 — 잘린 element 의 HTML 이 leak 되지 않는다.
  - integration 노드의 256KB cap (`truncateBodyForOutput`) 보다 4× 큰 한계 — Presentation 은 사용자 가시 surface 라 정상 사용 시 거대해질 수 있는 반면 1MB 초과는 runaway 데이터 신호로 간주한다.

### 4.1 Waiting (Blocking 모드 진입)

`status:'waiting_for_input'` + 위 `output` 유지. Form 노드는 `output: {}` (빈 객체).

### 4.2 Resumed (버튼 클릭 / 폼 제출 후)

CONVENTIONS §4.5 의 `interaction` 규격:

```json
{
  "output": {
    /* 직전 스냅샷 유지 */
    "interaction": {
      "type": "button_click | button_continue | form_submitted",
      "data": { /* 노드별 클릭/제출 데이터 */ },
      "receivedAt": "2026-04-06T10:30:00Z"
    }
  },
  "status": "resumed",
  "port": "<port-id>"
}
```

| `interaction.type` | 트리거 | `data` 예시 |
|---------------------|--------|-------------|
| `button_click` | port 타입 버튼 클릭 | `{ buttonId, buttonLabel, selectedItem? }` |
| `button_continue` | link 전용 시 Continue 클릭 | `{ buttonId, buttonLabel, url }` |
| `form_submitted` | Form 제출 | `{ <field>: <value>, ... }` |

> `selectedItem` 은 per-item 버튼(동적 item 버튼) 클릭 시에만 `data` 에 포함된다. 엔진은 per-item 버튼 ID 를 `${buttonId}__item_${index}` 형태로 생성하고, 라우팅 시 접미사를 제거해 원본 포트(`buttonId`) 로 연결한다.

> 이전 초안의 `output.type: 'form'`, `output.submittedData`, `output.format`, `output.content`, `previousOutput` 등의 필드는 **폐기**. Principle 1.1.4 (판별자 금지) 와 §4.5 (interaction payload) 를 따른다.

---

## 4.6 Conversation Thread opt-out (공통)

Presentation 5 노드 (Carousel / Table / Chart / Form / Template) 모두 공통으로
다음 boolean config 필드를 가진다 — `output.interaction` 이 발화될 때
[ConversationThread](../../conventions/conversation-thread.md) 에 자동 push
되는 동작을 노드 단위로 끄기 위함.

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| excludeFromConversationThread | Boolean | `false` | `true` 면 본 노드의 user interaction (form 제출 / 버튼 클릭 / continue) 이 thread 에 push 되지 않는다. 디버그용 form, telemetry-only button 등 thread noise 가 되는 인터랙션을 명시 제외할 때 사용. UI 그룹: `Advanced > Conversation`. |

> 본 필드는 schema 정의에 명시되지 않은 경우 default `false` 로 동작 — 기존
> 워크플로우 영향 없음. AI 카테고리 노드의 동명 필드는 [공통 §10](../3-ai/0-common.md#10-conversation-context-자동-컨텍스트-주입) 참조.

---

## 5. 캔버스 요약

각 Presentation 노드가 캔버스에 표시하는 설정 요약 텍스트 포맷. ([캔버스 §5.3](../../3-workflow-editor/0-canvas.md#53-노드-설정-요약-configuration-summary) 참조)

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Carousel (버튼 없음) | `{layout} · {titleField}` | `card · name` |
| Carousel (버튼 있음) | `{layout} · {N} buttons` | `card · 3 buttons` |
| Table (버튼 없음) | `{N} columns`. pagination 활성화 시 `· pagination` 추가 | `3 columns · pagination` |
| Table (버튼 있음) | `{N} columns · {N} buttons` | `3 columns · 2 buttons` |
| Chart (버튼 없음) | `{chartType} · {xAxis.field} / {yAxis.field}` | `bar · month / revenue` |
| Chart (버튼 있음) | `{chartType} · {N} buttons` | `bar · 2 buttons` |
| Form | `{N} fields · "{title}"` (필드 수 + 폼 제목) | `3 fields · "Approval"` |
| Template (버튼 없음) | `{outputFormat} · {N} lines` (템플릿 줄 수) | `html · 9 lines` |
| Template (버튼 있음) | `{outputFormat} · {N} buttons` | `html · 2 buttons` |

---

## 6. Run Results Drawer 렌더링

각 Presentation 노드가 실행 완료 후 Run Results Drawer의 **채팅형 히스토리 항목**으로 렌더링되는 방식. 히스토리는 실행 순서대로 누적되며, 각 항목은 접기/펼치기 가능하다. ([실행/디버깅 §10 Run Results Drawer](../../3-workflow-editor/3-execution.md#10-run-results-drawer) 참조)

### 6.1 Carousel

| 항목 | 설명 |
|------|------|
| 렌더링 | `output.items` 배열을 `layout` 설정에 따라 카드/이미지/미니멀 형태로 표시 |
| 인터랙션 | 좌/우 화살표로 슬라이드 탐색. 현재 슬라이드 인디케이터 (예: 3/10) |
| 이미지 | `imageField` 지정 시 이미지 렌더링. 로드 실패 시 placeholder |
| 빈 데이터 | "No items to display" 메시지 |
| **버튼 대기 중** (`waiting_for_input`) | 카드 리스트 아래 **버튼 바** 표시. port 버튼 클릭 시 `execution.click_button` WS 명령 전송 → 해당 포트로 실행 재개. link 버튼 클릭 시 새 탭에서 URL 열기 (실행 상태 변경 없음). link 전용 시 `[Continue →]` 암시적 버튼 표시 → `__continue__` ID로 WS 명령. 버튼 클릭 시까지 무제한 대기 (외부 cancel/종료 외에는 타임아웃 없음) |
| **버튼 클릭 후** | "Button clicked: {label}" + 클릭 시각, 클릭자 정보 표시 |

### 6.2 Table

| 항목 | 설명 |
|------|------|
| 렌더링 | `output.columns`와 `output.rows`를 테이블로 표시 |
| 인터랙션 | `sortable` 컬럼 헤더 클릭 시 정렬 토글 (asc/desc). 페이지네이션 컨트롤 |
| 포맷팅 | `format` 지정된 컬럼은 날짜/숫자 포맷 적용 |
| 빈 데이터 | 컬럼 헤더만 표시 + "No data" 행 |
| 대량 데이터 | 페이지네이션 강제 (최대 200행/페이지) |
| **버튼 대기 중** (`waiting_for_input`) | 테이블 아래 **버튼 바** 표시. Carousel §6.1 버튼 대기와 동일한 인터랙션 |
| **버튼 클릭 후** | Carousel §6.1 버튼 클릭 후와 동일 |

### 6.3 Chart

| 항목 | 설명 |
|------|------|
| 렌더링 | `output.rendered` SVG를 인터랙티브 차트로 표시 |
| 인터랙션 | 데이터 포인트 호버 시 값 툴팁. 범례 표시. 축 라벨 |
| 차트 타입 | bar/line/area: X-Y 축 차트. pie/donut: 라벨-값 차트 |
| 빈 데이터 | 축만 표시된 빈 차트 + "No data" 메시지 |
| 리사이즈 | 드로어 크기 변경 시 차트 반응형 리사이즈 |
| **버튼 대기 중** (`waiting_for_input`) | 차트 아래 **버튼 바** 표시. Carousel §6.1 버튼 대기와 동일한 인터랙션 |
| **버튼 클릭 후** | Carousel §6.1 버튼 클릭 후와 동일 |

### 6.4 Form

| 항목 | 설명 |
|------|------|
| 대기 중 (`waiting_for_input`) | 실제 폼 UI 렌더링 — 제목, 설명(Markdown), 필드 목록, 제출 버튼. 필드 유효성 검증 실시간 적용 |
| 파일 업로드 | `type: file` 필드는 드래그앤드롭 + 파일 선택 UI. MIME/크기 제한 실시간 검증 |
| 제출 | 제출 버튼 클릭 → `execution.submit_form` WebSocket 명령 전송 → 검증 실패 시 에러 표시, 성공 시 실행 재개 |
| 제출 후 | 제출된 데이터를 키-값 테이블로 표시. 제출 시각, 제출자 정보 포함 |
| 대기 정책 | 폼 submit 시까지 무제한 대기 (외부 cancel/종료 외에는 타임아웃이 발생하지 않음) |

### 6.5 Template

| 항목 | 설명 |
|------|------|
| HTML 출력 | 샌드박스 iframe 내에서 렌더링. 외부 스크립트 실행 차단 |
| Markdown 출력 | Markdown → HTML 변환 후 렌더링 |
| Text 출력 | 코드 블록(`<pre>`) 형태로 표시 |
| 빈 결과 | "Empty output" 메시지 |
| **버튼 대기 중** (`waiting_for_input`) | 렌더링된 콘텐츠 아래 **버튼 바** 표시. Carousel §6.1 버튼 대기와 동일한 인터랙션 |
| **버튼 클릭 후** | Carousel §6.1 버튼 클릭 후와 동일 |

---

## 7. 5필드 공통 규약 (Presentation 카테고리)

Presentation 노드는 모두 [CONVENTIONS Principle 0](../../conventions/node-output.md) 의 5필드 invariant `{ config, output, meta?, port?, status? }` 를 따른다. 카테고리 특이 사용 패턴 (§4 의 출력 포맷과 정합):

| 필드 | Presentation 카테고리에서의 사용 패턴 |
|------|----------------------------------------|
| `config` | 사용자 입력 raw echo (Principle 7). 리터럴 설정값(`title`, `layout`, `chartType`, `columns[*].field`, `format` 등)은 모두 `config` 만 — `output` 에 echo 금지 (Principle 1.1) |
| `output` | **런타임 생성값만** (§4): Carousel `items` (dynamic), Table `rows`, Chart `data`, Template `rendered`, Form `{}` (빈 객체). 1MB cap 적용 (§4) |
| `meta` | 실행 메트릭만 (Principle 2). `meta.durationMs` (공통). Carousel/Table 의 `itemsTruncated`/`rowsTruncated` 같은 cap 정보는 `output` 에 두는 것이 다운스트림 가시성 측면에서 적절 — §4 정책 |
| `port` | 비-블로킹: `undefined` 또는 `'out'`. 블로킹(버튼 설정 시): `<button.id>` (글로벌) / `<button.id>__item_<idx>` (per-item, Carousel) / `'continue'` (link 전용 시) |
| `status` | 비-블로킹: `undefined`. 블로킹: `'waiting_for_input'` (대기) / `'resumed'` (재개) — §4.1, §4.2 |

### 7.1 동적 포트 명명 규칙 (Principle 6)

| 노드 | 포트 ID 형태 | 매핑 |
|------|--------------|------|
| Carousel/Table/Chart/Template (글로벌 버튼) | `<button.id>` (UUID v4) | `config.buttons[i].id` 그대로 |
| Carousel (per-item 버튼) | `<itemButton.id>__item_<idx>` (런타임) | 라우팅 시 접미사 제거 → 원본 `itemButton.id` 포트로 매핑 |
| link 전용 시 | `'continue'` | 자동 생성 |

## 8. 출력 구조 색인

| 노드 | Waiting | Resumed | 비고 |
|------|---------|---------|------|
| [carousel](./1-carousel.md#5-출력-구조) | §5.4 | §5.5 | static `output: {}` / dynamic `output: { items }` |
| [table](./2-table.md#5-출력-구조) | §5.4 | §5.5 | `output: { rows, totalRows, rendered }` |
| [chart](./3-chart.md#5-출력-구조) | §5.4 | §5.5 | `output: { data, rendered }` |
| [form](./4-form.md#5-출력-구조) | §5.4 | §5.5 | `output: {}` (빈 객체 + waiting 시) → `output: { interaction }` |
| [template](./5-template.md#5-출력-구조) | §5.4 | §5.5 | `output: { rendered }` |

> 모든 Presentation 노드는 비-블로킹 모드 (버튼·필드 미설정) 시 §5.1 (`out` 포트로 단일 출력) 만 가질 수 있다. 노드별 문서에서 비-블로킹 케이스 보유 여부 명시.

## 10. AI Tool 모드 (`render_*`)

[AI Agent](../3-ai/1-ai-agent.md) 노드의 `presentationTools[]` 설정을 통해 LLM 이 본 카테고리 5 노드의 렌더링 페이로드를 **tool calling 으로 직접 만들 수 있다**. 워크플로 그래프의 다른 노드로 연결하는 방식이 아니라 AI 세션 내부 가상 도구로 동작 — 5 노드의 input schema (zod) 가 LLM tool parameters JSON Schema 의 단일 진실로 재사용된다.

본 절은 5 노드의 schema·렌더 정책·1MB cap 의 단일 진실을 그대로 AI tool 모드에 적용한다는 규약을 명문화한다. AI Agent 의 dispatcher / 종료 시멘틱 / blocking 흐름은 [AI Agent §4.1·§6.1.d·§7.10](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_) 단일 진실.

### 10.1 Schema 단일 진실

| 도구 이름 | 대상 노드 | parameters JSON Schema 출처 |
|---|---|---|
| `render_table` | [Table](./2-table.md) | `tableNodeConfigSchema` (zod) → JSON Schema |
| `render_chart` | [Chart](./3-chart.md) | `chartConfigSchema` (zod) → JSON Schema |
| `render_carousel` | [Carousel](./1-carousel.md) | `carouselNodeConfigSchema` (zod) → JSON Schema (dynamic 모드 schema 우선) |
| `render_template` | [Template](./5-template.md) | `templateNodeConfigSchema` (zod) → JSON Schema |
| `render_form` | [Form](./4-form.md) | `formNodeConfigSchema` (zod) → JSON Schema |

zod → JSON Schema 변환은 단일 유틸 (`zodToToolParams`) 을 통해 수행한다 — 5 노드 각각의 schema 갱신이 자동으로 LLM tool 정의에 반영되어 drift 가 구조적으로 차단된다. backend `_shared/button.types.ts` 의 `MAX_BUTTONS_PER_NODE` 등 본 공통 규약의 상수도 동일 변환에 자동 반영.

### 10.2 도구 카탈로그

| 도구 이름 | 모드 | 기본 description (override 가능) |
|---|---|---|
| `render_table` | display-only | "표 형태로 정형 데이터를 표시. rows/columns 정의 필요. 비교·집계 결과 공유에 적합." |
| `render_chart` | display-only | "차트 (bar/line/area/pie/donut) 로 데이터를 시각화. 시계열·분포·비율 표현에 적합." |
| `render_carousel` | display-only | "카드·이미지·미니멀 레이아웃의 슬라이드 모음. 추천 항목 목록·상품 카드 등 시각 카탈로그에 적합." |
| `render_template` | display-only | "사용자 정의 HTML/Markdown/Text 템플릿 렌더링. 정형화된 안내문·요약 카드 작성에 적합." |
| `render_form` | **interactive** (blocking) | "사용자에게 입력 폼을 표시하고 제출을 대기. 추가 정보 수집·승인 요청 등 사용자 응답이 필요한 경우." |

사용자가 `PresentationToolDef.description` 으로 직접 description 을 박으면 위 기본 카피 대신 그 값을 LLM 에 노출한다 — 워크플로 도메인 (예: "전자상거래 상품 카드 표시") 에 맞춘 가이드를 제공할 수 있다.

### 10.3 Defaults Overlay 규칙

`PresentationToolDef.defaults?: Partial<Config>` 는 해당 presentation 노드의 config 일부를 미리 박는 brand/style 고정값이다. LLM 페이로드와 deep-merge 시 **defaults 가 LLM 입력을 override** (defaults 가 후순위 merge) — 사용자가 정한 brand 톤·버튼 라벨·layout 이 LLM 의 임의 변경에 흔들리지 않는다.

| Merge rule | 동작 |
|---|---|
| Object | deep merge. 같은 key 면 defaults 가 우선 |
| Array | defaults 가 비어 있지 않으면 defaults 로 **교체** (concat 아님 — LLM 이 임의로 brand 외 버튼을 추가하지 못하도록) |
| Primitive | defaults 가 set 되어 있으면 defaults 가 우선 |

예) `presentationTools: [{ type: 'table', defaults: { columns: [...brand columns], pagination: { enabled: true, pageSize: 20 } } }]` 로 두면 LLM 은 `rows` 만 채우면 되고, columns 와 pagination 은 항상 사용자 정의가 적용된다.

### 10.4 1MB cap

본 공통 규약 §4 의 `PRESENTATION_MAX_BYTES = 1024 × 1024` 가 동일하게 적용된다. LLM 이 cap 을 초과하는 페이로드를 emit 하면 §10.5 의 schema 위반 처리 및 정규화 흐름을 따른다 — Carousel/Table 의 tail truncate 정책 (§4) 은 LLM tool 모드에서도 **그대로 적용**되며, 잘린 결과는 `output.{itemsTruncated|rowsTruncated}: true` + `output.{itemsTotalCount|rowsTotalCount}` 와 동등한 메타가 ConversationTurn 의 top-level `presentations[i].truncation` (`data?` 와 별개) 에 surface 한다.

### 10.5 Schema 위반 처리 및 정규화

1. LLM 페이로드를 해당 노드의 zod schema 로 validate.
2. 위반 (필수 필드 누락, 타입 불일치, 정합성 위배) 또는 1MB cap 초과 (Carousel/Table 의 tail truncate 후에도 element 자체가 1개도 안 들어가는 경우 등 cap 적용 불가 케이스) 시 tool_result 에 `{error: 'INVALID_PAYLOAD', issues: [...]}` 회신.
3. **`button.id` UUID v4 backfill** — §10.3 defaults overlay 및 §10.4 1MB cap 적용 후 남아 있는 button (carousel `buttons` / `itemButtons` / `items[].buttons`, table / chart / template 의 `buttons`) 중 `id` 가 설정된 것은 그대로 보존하고, `id` 가 없는 것에만 UUID v4 를 채운다. §1 의 "id: 자동 생성, 불변" 원칙을 LLM tool 모드에 일관 적용 — 워크플로 에디터 UI 가 `crypto.randomUUID()` 로 id 를 박는 것과 동일 의미를 backend `render-tool-provider` 가 보장한다. cap 이후에 적용되므로 tail-truncate 된 element 안의 버튼은 frontend 에 도달하지 않아 처리하지 않는다 (의도된 최적화). 본 단계의 함수명은 `normalizeNodeButtonIds` (label → slug 변환, 그래프 노드 본체용) 와 구분되도록 `backfillButtonUuids` 류의 식별 가능 명명을 사용한다.
4. **form `option.value` 결정적 backfill** — `render_form` 한정. §10.3 defaults overlay 및 §10.4 1MB cap 적용 후 `fields[].options[]` 중 `value` 가 빈 문자열 `""` · `null` · `undefined` 인 항목에 **결정적** fallback 값을 채운다. fallback 형식은 `opt-{fieldIdx}-{optIdx}` — 결정적 인덱스 단일 형식. slug 기반 variant 는 다국어 label (한글 등) 에서 빈 slug 로 귀결되어 충돌이 재발하므로 채택하지 않는다. LLM 이 옵션 emit 시 `value` 를 누락하면 zod default 가 모든 옵션의 value 를 동일한 `""` 로 통일해 frontend `<select>` 에서 placeholder (`value=""`) 와 모든 옵션이 DOM 상 동일 → 클릭 후에도 시각적으로 placeholder 가 유지되는 silent collision 이 발생하므로, step 3 (`button.id` UUID backfill) 과 동형 문제를 동일 layer 에서 해소한다. **UUID 가 아닌 결정적 값인 이유**: 사용자가 폼 제출 후 LLM 은 후속 turn 에서 `output.interaction.data.<fieldName>` 의 submitted value 를 의미적으로 인식해야 한다. UUID 는 의미 부재라 LLM 입장에서 "Approve" 인지 "Reject" 인지 식별 불가 — `opt-0-1` 같은 결정적 인덱스 값이 후속 reasoning 의 minimal context 를 보존한다 (label 자체는 이미 LLM payload 에 보존되므로 `value` 는 키만 회복하면 됨). cap 이후에 적용되므로 tail-truncate 된 옵션은 처리하지 않는다 (의도된 최적화 — Carousel/Table 의 element 단위 truncate 라인과 정합). 본 단계의 함수명은 step 3 의 `backfillButtonUuids` 와 평행 명명으로 `backfillFormOptionValues` 류의 식별 가능 명명을 사용한다.
5. LLM 이 같은 turn 안에서 재시도 가능. 재시도 1회 후에도 실패하면 silent drop + `meta.presentationSchemaViolations[]` 에 누적 ([AI Agent §4.1·§10](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_)).
6. AI Agent 의 `error` 포트는 발화하지 않는다 — 표현 surface 확장이라 텍스트 응답으로 fallback 한다.

### 10.6 Blocking vs Display-only

| 도구 | blocking 여부 | 흐름 |
|---|---|---|
| `render_table` / `render_chart` / `render_carousel` / `render_template` | display-only (non-blocking) | tool_result 스텁 `{ok:true}` 즉시 회신. LLM 이 같은 turn 안에서 텍스트 / 다른 도구 호출 / 종료 결정. ConversationTurn 의 **top-level `presentations[]`** 에 페이로드 push |
| `render_form` | **interactive (blocking)** | AI Agent multi-turn 의 `waiting_for_input` 흐름으로 진입 + `meta.interactionType: 'ai_form_render'` (※ `'ai_conversation'` 과 별개 — 클라이언트가 `execution.submit_form` 명령 분기 근거로 사용, [WS §4.4](../../5-system/6-websocket-protocol.md#44-실행-진행-이벤트)). `_resumeState.pendingFormToolCall.toolCallId` set. 사용자 form 제출 (`execution.submit_form`) 시 thread 에 `presentation_user` source push (`data.via: 'ai_render'` sentinel 박힘 — [node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격)) + tool_result content 에 제출 데이터 직렬화 후 LLM 재호출 |

`render_form` 은 AI Agent 가 `mode = single_turn` 인 경우 의미가 없으며 (single turn 은 사용자 인터랙션 무대기) schema 위반과 동일하게 silent drop 된다 — [AI Agent §6.1.d.ii](../3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn).

본 공통 §3 (Blocking Mode 실행 흐름) 의 버튼 기반 blocking 흐름과 본 §10.6 의 AI tool 모드 blocking 흐름은 별개 layer — 전자는 그래프 상 노드로서 실행될 때, 후자는 AI Agent 의 가상 도구로 호출될 때. 두 layer 가 동시에 동작하는 경우 (사용자가 명시 연결한 Form 노드 + AI Agent 의 `render_form` 도구) 는 그래프 실행 순서대로 처리되므로 충돌하지 않는다.

### 10.7 ConversationThread 운반

`render_*` 호출이 성공한 turn 의 페이로드는 `source: 'ai_assistant'` ConversationTurn 의 **top-level `presentations[]`** 단일 위치에 저장된다 ([Spec Conversation Thread §1.2](../../conventions/conversation-thread.md#12-conversationturn)) — `data?` 내부가 아닌 별도 독립 필드 (`data?` 는 `output.interaction.data` 스냅샷 단일 진실이라 다른 의미 데이터를 박지 않는다). 본 카테고리의 `output.interaction` (§4.2) 와는 구분 — `output.interaction` 은 그래프 상의 presentation 노드가 사용자 클릭/제출을 받았을 때 발화하고, `turn.presentations[]` 는 AI Agent 가 LLM tool call 결과로 채우는 페이로드.

`render_form` 의 사용자 제출 시점에는 `source: 'presentation_user'` turn 이 본 카테고리의 §4.2 `interaction.type='form_submitted'` 와 동일 shape 으로 push 되되, **`data.via: 'ai_render'` sentinel** 이 추가로 박힌다 — 그래프 form 노드 출처의 turn 은 `data.via` 미설정이므로 UI 와 LLM payload builder 가 두 출처를 구분 가능. UI 는 두 케이스를 다른 카드 헤더로 렌더:
- 그래프 form 노드 출처: `<form 노드 라벨> · form submitted`
- AI render_form 출처: `<AI Agent 라벨> · form via AI render`

본 sentinel 의 단일 정의는 [Spec AI Agent §6.1.d.ii](../3-ai/1-ai-agent.md#61-single-turn-모드-mode--single_turn) / [node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격).

### 10.8 `render_*` 클릭 user-message 합성

AI Agent `render_*` tool 모드의 표·차트·캐러셀·템플릿 페이로드 안 버튼은 graph port 라우팅이 없다 — [AI Agent §4.1](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_) "버튼 클릭은 다음 LLM turn 의 user 메시지로 흡수" 가 SoT. 본 절은 그 user 메시지가 어떻게 합성되는지의 단일 진실이다 (presentation 노드 본체의 graph 분기와는 완전히 별개 layer — 본체는 §3 의 buttonConfig + WS resume 흐름이 SoT).

**합성 우선순위** (`type: "port"` 한정 — link 는 외부 URL 이동으로 user-message 발화 없음):

| 우선순위 | 출처 | 합성 결과 |
|---|---|---|
| 1 | `button.userMessage` (LLM 이 §1 ButtonDef 의 옵션 필드로 명시) | 그 문자열 그대로 user message 발화 |
| 2 | per-item 버튼 (carousel `items[].buttons` 또는 dynamic `itemButtons` 의 런타임 ID `{btn.id}__item_{idx}`) + `userMessage` 미설정 | `"{item.title} → {button.label}"` (구분자 ` → ` literal U+2192 화살표, locale-agnostic) |
| 3 | global 버튼 (carousel `buttons` / table / chart / template `buttons`) + `userMessage` 미설정 | `"{button.label}"` |
| 4 | 매칭 실패 (id 못 찾음 — 회귀 방어 fallback) | `buttonId` 그대로 |

**경로**: 프론트엔드 `AssistantPresentationsBlock.handlePortButtonClick` 이 본 우선순위로 user message 를 만들어 chat input 의 `onSendMessage` 로 전달 — backend `ai-agent.handler.processMultiTurnMessage(userMessage)` 의 `userMessage` 인자에 도달해 그대로 ai_user 메시지로 다음 LLM turn 에 흡수된다. 이 경로는 [Conversation Thread §1.6](../../conventions/conversation-thread.md#16-llm-facing-보안-마커) 의 `[user-input]…[/user-input]` 마커 wrap **대상이 아니다** — 마커는 `presentation_user` source (graph 노드 본체) 한정이며, `render_*` 클릭은 `ai_user` source 로 chat input 과 동일 경로 (§1.4 표 비고 "ai_user 는 marker wrap 적용 안 함").

**라우팅 안 함**: `render_*` 의 버튼 클릭은 AI Agent 의 출력 포트 분기에 영향 주지 않는다 ([AI Agent §4.1](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_) "역할 분리" — 그래프 분기는 `cond_*` 가 담당). 본 합성 규칙은 presentation 노드 본체에는 적용되지 않으며 (본체는 graph port 라우팅이 SoT — §3), 본 SoT 는 AI Agent 의 §4.1 / §7.10 에서 cross-ref 한다.

**4-layer SSOT 정렬**:

- spec §1 ButtonDef.userMessage 필드 정의 (본 문서)
- spec §10.8 합성 우선순위 (본 절 — SoT)
- backend `render-tool-provider.ts` zod schema 의 `userMessage: z.string().optional()` (LLM emit 검증 + 그대로 보존)
- frontend `AssistantPresentationsBlock.handlePortButtonClick` (위 우선순위 구현)

### 10.9 Form submission wire format (internal bus sentinel)

`render_form` 및 그래프 Form 노드의 사용자 제출은 다음 4 layer 를 거친다. 본 절은 **engine-internal continuation bus layer** 의 wire format SoT 다. 외부 surface (WS wire / NodeOutput interaction / LLM tool_result content / DB enum) 는 본 layer 와 독립이며 기존 SoT 가 유지된다.

**4 layer 분리** (모두 문자열 `'form_submitted'` 가 등장하지만 의미 독립):

| Layer | 위치 | shape | SoT |
|---|---|---|---|
| (1) 외부 WS wire | client → server | `execution.submit_form` payload `{ executionId, nodeId, formData, toolCallId? }` | [WS §4.2](../../5-system/6-websocket-protocol.md#42-실행-제어-명령-client--server) — 변경 없음 |
| (2) **internal continuation bus payload (본 절 SoT)** | server-internal Redis pub/sub `execution:continuation` 채널의 `'continue'` 메시지 안 payload | `{ type: 'form_submitted', formData }` sentinel wrap | 본 §10.9 |
| (3) NodeOutput interaction surface | 노드 output 의 `output.interaction.type` | `'form_submitted'` enum 값 (`button_click` / `button_continue` / `form_submitted` 4값 중 하나) | [node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격) / §4.2 |
| (4) LLM tool_result content | AI Agent `render_form` 의 tool_result content (`render_form` 만 해당) | `{ type: 'form_submitted', data: { …formData } }` JSON | [AI Agent §6.2 step 2.c](../3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn) |

**(2) internal bus payload 의 명시 sentinel 화**:

`continueExecution(executionId, formData)` 는 raw `formData` 를 그대로 publish 하지 않고 `{ type: 'form_submitted', formData }` 로 wrap 한 뒤 [Continuation Bus](../../5-system/4-execution-engine.md#74-분산-실행-multi-instance) (`bus.publish({ type: 'continue', executionId, payload: { type: 'form_submitted', formData } })`) 에 publish 한다. `'continue'` listener 는 wrap 된 payload 를 그대로 `resolvePending(executionId, payload)` 로 forward 한다 (unwrap 하지 않음 — dispatcher 가 sentinel 로 분기).

[execution-engine §7.4](../../5-system/4-execution-engine.md#74-분산-실행-multi-instance) 의 Continuation Bus 메시지 타입 5종 (`continue / cancel / button_click / ai_message / ai_end_conversation`) 표는 **변경 없음** — 본 작업이 도입하는 것은 `'continue'` 메시지의 **payload 안의 action.type sentinel** 한 종류일 뿐, bus 메시지 타입 자체에 `'form_submitted'` 가 추가되지 않는다 (메시지 타입과 payload action.type 은 별개 layer).

**`waitForAiConversation` dispatch 4 케이스 명시 매칭**:

AI Agent multi-turn 의 사용자 입력 대기 루프 (`status: 'waiting_for_input'` 상태에서 resume 신호를 기다리는 단일 위치) 는 resume payload (= bus listener 가 forward 한 action) 의 `action.type` 으로 명시 매칭한다:

| `action.type` | dispatch | 처리 |
|---|---|---|
| `'ai_end_conversation'` | 종료 | `user_ended` 포트로 라우팅 (§7.7) |
| `'ai_message'` | AI message turn | `handleAiMessageTurn(executionId, node, action.message, ...)` |
| `'form_submitted'` | form submit turn | `handleAiMessageTurn(executionId, node, JSON.stringify(action.formData), ...)` — handler `processMultiTurnMessage` 의 form 분기에서 [AI Agent §6.2 step 2.c](../3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn) 의 tool_result content `{type:'form_submitted', data:{…}}` JSON 채워 LLM 재호출 |
| `'button_click'` | 버튼 클릭 | 별도 경로 ([§3](#3-blocking-mode-실행-흐름) Blocking Mode). **AI conversation 대기 중 미도달 invariant** (아래) |
| 그 외 (`!type` / 미매칭) | **warn log + loop 재진입** | silent skip 금지 — `console.warn('[waitForAiConversation] unknown action.type', { executionId, action })` 후 다음 resume 대기로 돌아간다. 무한 루프 방어는 `maxTurns` cap 이 별도 layer 에서 담당 |

`!('type' in action)` 의 휴리스틱 매칭 (form 필드명이 `type` 인 경우 silent drop 의 root cause) 은 **폐기**한다.

**`'form_submitted'` 케이스의 `action.formData ?? {}` fallback**: dispatch handler 는 `handleAiMessageTurn(executionId, node, JSON.stringify(action.formData ?? {}), ...)` 로 호출한다 — `action.formData` 가 `null` / `undefined` 인 경우 (예: `continueExecution(executionId, undefined)` 호출로 빈 form 제출) 빈 객체 `{}` 로 fallback 하여 `handleAiMessageTurn` 이 `JSON.stringify({})` 를 인자로 받아 정상 처리되도록 한다. 외부 wire `execution.submit_form` payload 의 `formData` 가 항상 set 되어 들어오는 normal path 와 무관하게 internal API 호출 경로의 robustness 보호.

**`'button_click'` AI conversation 내 미도달 invariant**: `waitForAiConversation` loop 는 위 표의 4 케이스 중 실제로는 `ai_end_conversation` / `ai_message` / `form_submitted` 3 케이스만 수신하도록 설계됐다. `button_click` 이벤트는 `continueButtonClick → bus.publish({type:'button_click'})` 경로로 [Continuation Bus](../../5-system/4-execution-engine.md#74-분산-실행-multi-instance) 의 별도 메시지 타입으로 전달되며 (`'continue'` 메시지의 payload sentinel 이 아님), `waitForAiConversation` 이 실행 중인 경우에도 `pendingContinuations` 에 이미 등록된 resolve 가 `button_click` payload 로 호출될 수 있으나 — 현재 UI 는 AI conversation 대기 중 (`interactionType: 'ai_conversation' | 'ai_form_render'` 상태) presentation 노드 본체 버튼을 표시·라우팅하지 않으므로 본 경로로 `'button_click'` action 이 도달하지 않는 자연 invariant 가 성립한다. 위 표에 `'button_click'` 케이스가 명시된 것은 enum 의 완전성을 위함이며, 만약 향후 UI 변경으로 도달하게 되면 `else` 분기 (warn log + loop 재진입) 가 graceful degradation 으로 동작한다.

**외부 wire (1) 호환 유지**:

WS wire `execution.submit_form` 의 payload shape `{ executionId, nodeId, formData, toolCallId? }` 는 변경 없음. 본 §10.9 의 sentinel wrap 은 backend internal 경계 (`continueExecution` → `continuationBus.publish` → `resolvePending`) 안에서만 적용. frontend / external API consumer 에 영향 없다 — [§10.7](#107-conversationthread-운반) 의 "외부 surface 와 internal layer 분리" 원칙과 동형.

**4-layer SSOT 정렬**:

- spec §10.9 (본 절 — internal bus payload sentinel SoT)
- spec [WS §4.2](../../5-system/6-websocket-protocol.md#42-실행-제어-명령-client--server) — 외부 wire 호환 유지 (변경 없음)
- spec [execution-engine §7.4](../../5-system/4-execution-engine.md#74-분산-실행-multi-instance) — bus 메시지 타입 5종 (변경 없음 — sentinel 은 payload layer)
- backend `execution-engine.service.ts` `continueExecution` (wrap) · `registerContinuationHandlers` 의 `'continue'` listener (forward) · `waitForAiConversation` (4 케이스 명시 매칭)
- backend `ai-agent.handler.processMultiTurnMessage` ([§7.4 invariant](../3-ai/1-ai-agent.md#74-multi-turn-모드--사용자-입력-대기-status-waiting_for_input) `pendingFormToolCall` 매칭 + 누락 시 fallback — [AI Agent §6.2 step 2.c](../3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn))

---

## 9. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-23 | §10.9 본문 정합화 (ai-review W1/W2/W15 후속) — (W1) `'button_click'` AI conversation 내 미도달 invariant 명시 (UI 가 AI conversation 대기 중 presentation 노드 본체 버튼을 라우팅하지 않으므로 enum 4 케이스 중 `button_click` 만 자연 미도달, 위 표에 명시 + 본문 invariant 노트). (W2) `'form_submitted'` 케이스의 `action.formData ?? {}` fallback 명시 (`continueExecution(executionId, undefined)` 빈 form 제출에서도 `JSON.stringify({})` 가 정상 처리되도록 robustness 보호). (W15) §Rationale "form submission wire format wrap" 의 4-layer SSOT 목록을 §10.9 본문 cross-ref 로 대체 — 본문이 SoT, Rationale 은 결정 근거 한정. 결정 근거: [§Rationale form submission wire format wrap (2026-05-23)](#form-submission-wire-format-wrap-2026-05-23) |
| 2026-05-23 | §10.9 신설 — Form submission wire format (internal bus sentinel). `continueExecution` 가 raw `formData` 를 그대로 publish 하던 휴리스틱 dispatch (`!('type' in action)`) 가 form 필드명이 `type` 인 페이로드를 silent drop 시키던 회귀의 root cause. `{ type: 'form_submitted', formData }` sentinel wrap 으로 명시화. 외부 WS wire (`execution.submit_form` payload shape) 와 execution-engine §7.4 bus 메시지 타입 5종 표는 변경 없음 — internal bus payload layer 한정. `waitForAiConversation` dispatch 4 케이스 명시 매칭 (`ai_end_conversation` / `ai_message` / `form_submitted` / `button_click`) + 그 외는 warn log + loop 재진입 (silent skip 금지). 결정 근거: [§Rationale form submission wire format wrap (2026-05-23)](#form-submission-wire-format-wrap-2026-05-23) |
| 2026-05-23 | §10.5 step 4 본문 + §Rationale "form option value backfill" + [Form 4-form.md §1](./4-form.md#1-설정-config) `options[].value` 비고에서 slug variant (`opt-{fieldIdx}-{slug(label)}`) 언급 제거 — 결정적 인덱스 단일 형식 `opt-{fieldIdx}-{optIdx}` 로 정합화. ai-review (`review/code/2026/05/23/15_27_41/`) W#1 documentation drift 정정. 구현 (`backfillFormOptionValues`) 은 PR #279 부터 인덱스 단일 형식만 사용 — 다국어 label 에서 slug 가 빈 문자열로 귀결되는 결정성 문제를 회피하기 위한 의도된 단일 경로. |
| 2026-05-23 | §10.5 에 step 4 신설 — `render_form` 한정 form `option.value` 결정적 backfill (`opt-{fieldIdx}-{optIdx}`). 기존 step 4·5 → 5·6 재번호. 함수명 `backfillFormOptionValues` 는 step 3 의 `backfillButtonUuids` 와 평행 명명. [Form 4-form.md §1](./4-form.md#1-설정-config) `options[].value` 비고에서 본 step cross-ref. 결정 근거: [§Rationale form option value backfill (2026-05-23)](#form-option-value-backfill-2026-05-23) |
| 2026-05-23 | [Form 4-form.md §1.5](./4-form.md#15-file-타입-ui-동작) 신설 (file 필드 UI 렌더 + metadata-only 제출 payload). 본 공통 규약에는 변경 없음 — file 메타데이터 객체 배열 (`{name, size, type, lastModified}`) 은 [node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격) 의 `form_submitted` payload `{ [fieldName]: value }` value 슬롯 free-form 안에 들어감. 결정 근거: [§Rationale file 타입 metadata-only (2026-05-23)](#file-타입-metadata-only-2026-05-23) |
| 2026-05-23 | §1 ButtonDef 표에 `userMessage` 옵션 필드 신설 + §1.1 유효성 1행 (`type: "link"` 무시) 추가. §10.8 신설 — AI Agent `render_*` tool 모드의 클릭 user-message 합성 우선순위 (LLM emit → per-item fallback `"{item.title} → {label}"` → global fallback `"{label}"` → buttonId) 를 단일 진실로 명문화. presentation 노드 본체의 graph 분기와 직교. 결정 근거: [§Rationale `render_*` 클릭 user-message 하이브리드 합성 (2026-05-23)](#render_-클릭-user-message-하이브리드-합성-2026-05-23) |
| 2026-05-23 | §10.5 섹션 제목 "Schema 위반 처리" → "Schema 위반 처리 및 정규화". step 3 으로 `button.id` UUID v4 backfill 단계 신설 (기존 step 3·4 → 4·5 재번호). §10.4 의 cross-ref 문구를 신규 제목에 맞춰 갱신. 결정 근거: [§Rationale `button.id` backfill 도입](#buttonid-backfill-도입-2026-05-23) |
| 2026-05-22 | §10 AI Tool 모드 (`render_*`) 신설. 5 노드 input schema 가 LLM tool parameters JSON Schema 의 단일 진실로 재사용된다는 규약 명문화. defaults overlay 규칙·1MB cap 동일 적용·schema 위반 silent fallback·display-only / interactive 구분. 결정 근거: [AI Agent §12.4](../3-ai/1-ai-agent.md#124-presentation-tool-family-render_-도입-2026-05-22) |
| 2026-05-19 | §1.1 "최대 버튼 수: 노드당 10개 → **5개**". Carousel `itemButtons` 도 4 → 5 통일. backend `_shared/button.types.ts` 의 `MAX_BUTTONS_PER_NODE = 5` 가 SSOT. spec §Rationale 신설 |
| 2026-05-10 | §7 5필드 공통 규약 / §8 출력 구조 색인 신설. 노드 문서 §5 출력 구조 5필드 모델로 정합화 (Principle 0~11 적용). 기존 §1~§6 anchor 보존 |
| 2026-04-19 | §4 출력 포맷에서 `output.type` 판별자, `output.submittedData`, `output.previousOutput`, `output.format/content` 폐기. CONVENTIONS Principle 1.1.4 적용 |

## Rationale

### 버튼 cap 정책 (2026-05-19)

**노드당 5개 + carousel item당 5개** 로 통일.

종전: 노드당 10개 (`spec §1.1`, `frontend ButtonListEditor maxButtons=10`), carousel itemButtons 만 4개 (`backend validateCarouselItemButtons`). 두 cap 이 다르고, frontend 의 10 vs backend 의 4 불일치로 인해 사용자가 5개 이상 itemButton 을 설정 시도 → schema reject → 일부만 저장되거나 silent drop 되는 증상 보고 (`plan/in-progress/presentation-button-render-investigation.md` 후보 2).

**사용자 가시 모델** (2026-05-19 결정): "한 단위 (노드 또는 carousel 아이템) 가 5개 버튼" 으로 단순화. carousel 의 단일 아이템 가시 영역에서는 globalButtons 5 + itemButtons 5 = **최대 10개** 가 보인다. 이는 사용자가 의도한 "노드 5 + 아이템 5" 가산 모델과 일치.

**4-layer SSOT 정렬**:
- spec §1.1 "5개" (본 문서)
- backend `_shared/button.types.ts` `MAX_BUTTONS_PER_NODE = 5` (정준 상수)
- backend `validateButtons` (글로벌) + carousel `validateCarouselItemButtons` (per-item) 모두 5 reject
- frontend `ButtonListEditor` default `maxButtons = 5`

**선택지 비교**:

| 안 | 효과 | 채택 여부 |
|---|---|---|
| ① 종전 frontend 10 / backend itemButtons 4 유지 + 일관성 정리 미실시 | 보고된 증상 재발 | 기각 |
| ② frontend 10 / backend 10 통일 (cap 상향) | 사용자 의도 "5개" 와 어긋남, UX 복잡도 증가 | 기각 |
| ③ **frontend 5 / backend 5 통일 (cap 정렬, itemButtons 4 → 5 상향)** | 사용자 가시 모델 명확, SSOT 단일, carousel 가시 10 유지 | **채택** |

### `button.id` backfill 도입 (2026-05-23)

§10.5 step 3 으로 `button.id` UUID v4 backfill 단계를 신설한다.

**배경**: 사용자 보고 — AI Agent 의 `render_carousel` 페이로드 안 "주문하기"/"문의하기" 버튼이 클릭되지 않음. 진단 결과 frontend `presentation-renderers.tsx` 의 `selectedButtonId === btn.id` 비교에서 양쪽 모두 `undefined` 일 때 `isSelected = true` 가 되어 `if (isSelected) return;` 으로 onClick 이 즉시 단락. zod schema 의 `buttonDefSchema.id` 가 optional 이라 LLM 이 거의 항상 id 없이 emit 하던 것이 회귀의 근원.

**결정**: §1 ButtonDef 의 "id: 자동 생성, 불변" 원칙이 워크플로 에디터 UI 에서만 보장되던 것을 LLM tool 모드까지 일관 적용. backend `render-tool-provider.execute()` 가 zod validate → defaults overlay → 1MB cap 이후 단계에서 누락 id 를 UUID v4 로 채운다.

**선택지 비교**:

| 안 | 효과 | 채택 여부 |
|---|---|---|
| (A) frontend 가드만 (`selectedButtonId != null` 비교) | 즉시 회귀 해소되나 LLM emit payload 의 id 가 비어 있어 다른 surface (예: future thread query) 에서 동일 패턴 재발 가능 | 부분 채택 — defense-in-depth |
| (B) zod schema 의 id 를 required + default 로 변경 | schema 위반 → 재시도 1회 → silent drop 흐름이 LLM 의 자연스러운 emit 을 막아 UX 회귀 | 기각 |
| (C) **backend backfill 단계 + frontend 가드 동시 적용** | LLM 자유 보존 + SoT 일관 + 회귀 즉시 차단 (defense-in-depth) | **채택** |

**`normalize` 적용 시점이 cap 이후인 이유**: cap 이전 적용은 truncate 된 element 안 버튼에 무의미한 work. cap 이후 적용은 frontend 에 도달하는 버튼만 처리하는 최적해. overlay 이전 적용은 사용자 `defaults.buttons[].id` 의도를 흐림. → **validate → overlay → cap → backfill** 순서가 유일 정합.

**함수명 구분 (SSOT)**: 본 단계 helper 는 `backfillButtonUuids` 류로 명명한다. 그래프 노드 본체용 `normalizeNodeButtonIds()` (label → slug 변환) 와 의미가 다르므로 구현자가 잘못된 함수를 재사용하지 않도록 식별 가능한 명명을 사용한다.

**4-layer SSOT 정렬**:
- spec §1 "id: UUID v4 자동 생성, 불변" (본 문서)
- spec §10.5 step 3 (본 단계 명문화)
- backend `render-tool-provider.ts` `backfillButtonUuids` (실행 보장)
- frontend `presentation-renderers.tsx` `isSelected = selectedButtonId != null && selectedButtonId === btn.id` (defense-in-depth)

### `render_*` 클릭 user-message 하이브리드 합성 (2026-05-23)

§1 ButtonDef 에 `userMessage` 옵션 필드를 신설하고, §10.8 에 AI Agent `render_*` tool 모드 클릭의 user-message 합성 우선순위를 SoT 로 명문화한다.

**배경**: `button.id` backfill (직전 결정) 로 클릭 자체는 정상화되었으나, 사용자 추가 보고 — `render_carousel` 안 per-item 버튼 ("샘플상품 1 / 문의하기") 클릭 시 chat 으로 발화되는 user message 가 `btn.label` ("문의하기") 만 들어가 LLM 입장에서 어떤 아이템에 대한 클릭인지 식별 불가. 사용자가 "1번 상품에 대해 문의한 것" 을 의도해도 LLM 은 아이템 컨텍스트 없이 일반 응답 — UX 회귀.

**사용자 결정 (2026-05-23)**:

> "하이브리드로 진행. fallback 은 `"{item.title} → {button.label}"`."

- 하이브리드: LLM 이 emit 한 `button.userMessage` 가 있으면 그것을 그대로 user message 로 발화. 없으면 frontend 가 합성.
- Fallback 규칙:
  - per-item 버튼 (carousel `items[].buttons` / dynamic `itemButtons` 의 런타임 ID `{btn.id}__item_{idx}`): `"{item.title} → {button.label}"`
  - global 버튼 (carousel `buttons` / table / chart / template `buttons`): `"{button.label}"` (PR #279 이전 동작 유지)

**선택지 비교**:

| 안 | 효과 | 채택 여부 |
|---|---|---|
| (A) frontend-only fallback (`button.userMessage` 신설 없이 frontend 가 `"{item.title} → {label}"` 합성) | 즉시 해소되나 LLM 이 자연어 ergonomic 을 결정할 권한 없음 — 도메인 별 톤 (예: "전자상거래 상품 문의" vs "예약 변경 요청") 을 LLM 이 직접 가다듬을 수 없음 | 부분 채택 — fallback 경로 |
| (B) zod 의 `userMessage` 를 required (LLM 이 항상 emit) | LLM emit 비용 + schema 위반 → 재시도 1회 → silent drop (§10.5 step 4) 흐름이 자연스러운 응답을 막아 UX 회귀 — §12.4 (AI Agent) "Schema 위반 silent fallback" 결정과 정합 안 됨 | 기각 |
| (C) **하이브리드 — LLM emit 우선 + frontend fallback** | LLM 자율 보존 + 아이템 컨텍스트 누락 방지 + 회귀 즉시 차단 (defense-in-depth) | **채택** |

(C) 의 채택 근거는 직전 결정 (`button.id` backfill) 의 (C) "backend backfill + frontend 가드 동시 적용" 라인과 동일 — LLM 의 자유로운 emit 을 schema-level 에서 보존하면서 frontend 가 SSOT 가드로 회귀를 차단한다.

**왜 ` → ` (U+2192)**:

- locale-agnostic — `:`, ` - `, ` › ` 등은 영문/한국어 사이 인지 흐름이 일관되지 않음. U+2192 화살표는 "item → 행위" 인과 흐름이 시각적으로 명확.
- frontend → backend chat input → ai_user 메시지 본문에 plain string 으로 들어가므로 i18n 처리 대상 아님 (UI 라벨 아님).

**왜 `type: "port"` 한정**:

- `type: "link"` 는 외부 URL 이동이 우선 시맨틱 — `LinkButtonClick` 흐름이 `window.open` 으로 새 탭을 열 뿐 chat 으로 발화하지 않음. `userMessage` 설정해도 발화 자체가 없으므로 무시 (warning 아님 — 동작 변화 없음).
- presentation 노드 본체 (graph-port 분기) 에서도 무시 — 본체는 `output.interaction.{type, data}` 가 SoT 이고 user 메시지 발화는 backend `renderInteractionText` 의 `clicked: <buttonLabel>` 텍스트 합성이 별도 경로 ([conversation-thread §1.4 / §1.6](../../conventions/conversation-thread.md#14-text-변환-규칙)). 본 `userMessage` 필드는 AI Agent `render_*` tool 모드 한정 효과.

**왜 옵션 필드 (`✗ 필수`) — §10.5 backfill 대상 아님**:

- `userMessage` 가 미설정인 것이 **정상 케이스** (frontend fallback 이 합리적 default). `id` 와 달리 backfill 로 임의 값을 채우면 LLM 의 의도 (예: 명시적으로 빈 문자열 emit 하고 싶을 때) 를 흐림. → §10.5 step 3 (`backfillButtonUuids`) 의 처리 대상 아님 — schema validate 단계에서 optional 그대로 통과.

**4-layer SSOT 정렬**:

- spec §1 ButtonDef.userMessage 옵션 필드 정의 (본 문서)
- spec §10.8 합성 우선순위 (본 문서, 단일 진실 — AI Agent §4.1 / §7.10 에서 cross-ref)
- backend `render-tool-provider.ts` zod schema 의 `userMessage: z.string().optional()` (carousel `buttons` / `itemButtons` / `items[].buttons`, table / chart / template `buttons` 모두)
- frontend `AssistantPresentationsBlock.handlePortButtonClick` — `findButtonContext` 로 `{button, item?}` 검색 후 `userMessage ?? per-item fallback ?? global fallback ?? buttonId` 우선순위 발화

### form option value backfill (2026-05-23)

§10.5 step 4 로 `render_form` 한정 form `option.value` 결정적 backfill 단계를 신설한다.

**배경**: 사용자 보고 — AI Agent 의 `render_form` 으로 그려진 폼에서 "select 항목을 선택할 수 없고, 선택 후에도 초기값으로 돌아간다". 진단 결과 backend `presentation/form/form.schema.ts` 의 `optionSchema.value: z.unknown().default('')`. LLM 이 옵션 emit 시 `value` 를 누락하면 zod default 가 **모든 옵션의 value 를 동일한 빈 문자열 `""` 로 통일** → frontend `<option value="">Select...</option>` placeholder 와 모든 옵션이 DOM 상 동일 value → 클릭해도 시각적으로 placeholder 가 유지됨. PR #279 의 `button.id` UUID backfill 결정과 **동형 문제** — LLM tool 모드의 zod default 가 silent collision 을 만드는 패턴이 form options 에도 잠재.

**결정**: §10.5 step 3 (`backfillButtonUuids`) 과 동일 layer 에서, `render_form` 분기에 평행 helper `backfillFormOptionValues` 를 신설. backend `render-tool-provider.execute()` 가 zod validate → defaults overlay → 1MB cap → backfillButtonUuids → (form 분기) backfillFormOptionValues 순서로 호출.

**선택지 비교**:

| 안 | 효과 | 채택 여부 |
|---|---|---|
| (A) frontend 가드만 (`String(v) === String(opt.value)` coerce + placeholder 와 옵션 구분) | 즉시 회귀 해소되나 LLM emit payload 의 value 가 빈 채로 유지 → LLM 이 후속 turn 에서 submitted value 의 의미를 인식 못함 ("Approve" 인지 "Reject" 인지 식별 불가) | 부분 채택 — defense-in-depth |
| (B) zod schema 의 `optionSchema.value` 를 required (LLM 이 항상 emit) | LLM emit 비용 + schema 위반 → 재시도 1회 → silent drop (§10.5) 흐름이 자연스러운 응답을 막아 UX 회귀 | 기각 |
| (C) **backend backfill + frontend defense-in-depth 동시 적용** | LLM 자유 보존 + SoT 일관 + 회귀 즉시 차단 (defense-in-depth) + 후속 turn 에서 LLM 의 submitted value 의미 인식 가능 | **채택** |

(C) 안은 PR #279 의 `button.id` backfill 결정 (C) "backend backfill + frontend 가드 동시 적용" 라인과 동일 — LLM 의 자유로운 emit 을 schema-level 에서 보존하면서 backend SSOT 가드로 회귀를 차단한다.

**왜 UUID v4 가 아닌 결정적 값**:

- `button.id` 는 워크플로 에디터 UI 가 `crypto.randomUUID()` 로 박는 SoT — UUID 가 정합.
- `option.value` 는 사용자 폼 제출 후 LLM 이 후속 turn 에서 `output.interaction.data.<fieldName>` 의 submitted value 를 의미적으로 인식해야 함. UUID (`550e8400-e29b-...`) 는 의미 부재 — LLM 입장에서 "Approve" 인지 "Reject" 인지 식별 불가.
- 결정적 인덱스 단일 형식 `opt-{fieldIdx}-{optIdx}` → submitted value 가 LLM payload 안에서 옵션 label 과 함께 회신되므로 minimal context 보존 가능. label 자체는 LLM tool payload 의 `options[].label` 에 이미 포함 — `value` 는 키만 회복하면 됨.
- **slug 기반 variant (`opt-{fieldIdx}-{slug(label)}`) 를 채택하지 않는 이유**: 다국어 label (한글 등 ASCII 외 문자) 에서 `slug(label)` 이 빈 문자열로 귀결돼 인덱스 fallback 과 동일 결과로 떨어진다. 두 코드 경로 (slug 가능 분기 + slug 비면 분기) 를 유지할 의미 없이 결정성·테스트·유지보수 부담만 커지므로 인덱스 단일 경로로 일원화.

**왜 cap 이후 적용**:

- cap 이전 적용은 tail-truncate 된 옵션에 무의미한 work. 단 form 의 options 배열은 Carousel/Table 의 element-level truncate 대상이 아님 (옵션이 1MB 를 넘기는 극단 케이스는 §10.5 step 2 의 cap 초과 INVALID_PAYLOAD 흐름에서 차단). 따라서 form 의 경우 사실상 항상 모든 옵션이 backfill 대상.
- overlay 이전 적용은 사용자 `defaults.fields[].options[].value` 의도를 흐림.
- → **validate → overlay → cap → backfill** 순서는 button backfill 과 동일 정합.

**함수명 구분 (SSOT)**: 본 단계 helper 는 `backfillFormOptionValues` 류로 명명한다. step 3 의 `backfillButtonUuids` 와 평행 명명. 그래프 form 본체에는 원래 backfill 단계가 없으므로 별 충돌 없음.

**4-layer SSOT 정렬**:

- spec [Form 4-form.md §1](./4-form.md#1-설정-config) `options[].value` 비고 (본 단계 cross-ref)
- spec §10.5 step 4 (본 단계 명문화)
- backend `render-tool-provider.ts` `backfillFormOptionValues` (실행 보장)
- frontend `dynamic-form-ui.tsx` — placeholder `<option value="">…</option>` 과 backfill 된 옵션 value 의 비교를 `String(value) === String(opt.value)` 로 정규화 (defense-in-depth — value 가 string 외 타입으로 emit 되어도 DOM 비교 안전)

### file 타입 metadata-only (2026-05-23)

[Form 4-form.md §1.5](./4-form.md#15-file-타입-ui-동작) 에 `type: 'file'` 의 UI 렌더 동작과 제출 payload 형식을 명문화한다.

**배경**: spec `formFieldSchema.type` enum 에 `'file'` 이 등록돼 있고 §1 의 file 관련 4필드 (`allowedMimeTypes`/`maxFileSize`/`maxTotalSize`/`maxFiles`) 도 명시되어 있으나, frontend `DynamicFormUI.renderField` switch 에 file case 없음 → text input 으로 fallback. UI 렌더 동작 명문화가 누락된 상태로 백엔드 4필드만 spec 에 박혀 SSOT drift.

**제출 payload 형식 결정 (3안 비교)**:

| 안 | LLM 가시 정보 | 멀티모달 비지원 모델 호환 | 별도 binary upload 채널 의존 | 채택 여부 |
|---|---|---|---|---|
| (A) **metadata-only** (`{name, size, type, lastModified}` 객체 배열) | filename / MIME / 크기 — 메타정보 한정 | 호환 (텍스트 JSON 만 emit) | 비의존 — file content 는 향후 별도 채널 정해질 때 추가 | **채택** |
| (B) base64 인코딩해 LLM 에 직접 포함 | file 내용 전체 | 비호환 — 멀티모달 비지원 모델은 무용지물 + base64 가 §10.4 1MB cap 의 압도적 비중 점유 | 비의존 | 기각 |
| (C) file 타입 클라이언트 차단 (본 작업 보류) | — | — | — | 기각 (spec 에 enum 으로 박혀 있는 것을 UI 만 차단하는 건 SSOT drift 확대) |

**채택 근거 (A)**:

- 멀티모달 비지원 모델 (예: text-only LLM 또는 image-only multimodal) 에서도 file 필드 자체는 UI 상 표시되고 사용자가 제출 가능. LLM 은 metadata 만 받아 "사용자가 X.pdf 를 첨부했다" 정도의 인식 후 텍스트 응답 작성 가능.
- file 본문 자체를 LLM 에 전달해야 하는 경우 (예: PDF 추출 텍스트 활용) 는 별도 업로드 경로 / file extraction 노드를 통해 별 turn 의 input 으로 주입하는 워크플로 패턴으로 처리 — 본 spec 의 metadata-only 결정과 직교.
- §10.4 1MB cap 정책의 "LLM 페이로드는 작게 유지" 라인과 정합 — file 본문은 cap 단독으로 압도적 비중 점유 위험이 있음.

**4-layer SSOT 정렬**:

- spec [Form 4-form.md §1](./4-form.md#1-설정-config) file 4필드 (`allowedMimeTypes`/`maxFileSize`/`maxTotalSize`/`maxFiles`)
- spec [Form 4-form.md §1.5](./4-form.md#15-file-타입-ui-동작) UI 렌더 + 제출 payload metadata-only (본 단계 명문화)
- backend `formNodeConfigSchema` 의 `formFieldSchema.type` enum + file 4필드 (이미 존재)
- frontend `dynamic-form-ui.tsx` — `<input type="file" multiple={maxFiles > 1} accept={allowedMimeTypes.join(",")}>` + 제출 시 `FileList` → metadata 객체 배열 (`{name, size, type, lastModified}`) 변환

**`node-output §4.5` 정합**: `form_submitted` payload `{ [fieldName]: value }` 의 value 슬롯은 free-form 임의 타입 — file 필드의 metadata 객체 배열도 동등 허용. 별도 schema 변경 불요.

### form submission wire format wrap (2026-05-23)

§10.9 신설 — `continueExecution` 의 internal continuation bus payload 를 `{ type: 'form_submitted', formData }` sentinel wrap 형식으로 직렬화.

**배경**: 사용자 보고 (2026-05-23) — "form submit 을 하면 정상 동작을 하지 않는다". 진단 결과 backend `execution-engine.service.ts` 의 `continueExecution(executionId, formData)` 가 raw `formData` 를 그대로 `continuationBus.publish({type:'continue', payload: formData})` 로 publish, `'continue'` listener 가 `resolvePending(executionId, msg.payload)` 로 payload (= raw formData) 를 그대로 action 으로 forward. 결과적으로 `waitForAiConversation` 의 dispatch 가 `!('type' in action)` 휴리스틱으로 "type 키 없으면 form submit 으로 가정" 분기를 적용 — 그러나 사용자가 정의한 form 필드명이 우연히 `type` 인 경우 (예: `{type: '주문 문의', contact: '...'}`) `'type' in action === true` 이면서 위 분기의 `'ai_end_conversation'` / `'ai_message'` 어느 elif 에도 매칭 안 됨 → **silent drop**.

**결정**: 휴리스틱을 제거하고 sentinel `{type:'form_submitted', formData}` 로 wrap. dispatch 4 케이스 (`ai_end_conversation` / `ai_message` / `form_submitted` / `button_click`) 명시 매칭 + 매칭 실패 케이스는 warn log + loop 재진입 (silent skip 금지).

**선택지 비교**:

| 안 | 효과 | 채택 여부 |
|---|---|---|
| (A) 휴리스틱 (`!('type' in action)`) 유지 + form 필드명 `type` 사용 시 사용자 경고 | 사용자 form schema 자유 박탈, 회귀 보고 재발 가능 | 기각 |
| (B) `continueExecution` 가 raw `formData` publish 유지 + dispatch elif 순서 조정 | 본질적으로 휴리스틱이라 다른 collision (예: form 필드명이 `message`) 발생 시 재발 | 기각 |
| (C) **sentinel wrap `{type:'form_submitted', formData}` + dispatch 4 케이스 명시 매칭 + 미매칭 warn log** | dispatch 가 명시적, 검사 비용 동일, 외부 wire 호환 유지, 동형 패턴 (`ai_message` / `button_click` / `ai_end_conversation`) 과 일관 | **채택** |

**PR #285 (`option.value` 결정적 backfill) 및 PR #279 (`button.id` UUID backfill) 와의 평행 reasoning**:

세 결정 모두 동형 root cause — LLM 또는 사용자가 emit 하는 free-form 데이터에서 dispatch / 비교 / 매칭 휴리스틱이 silent failure 의 root cause. 해결 라인도 동형 — sentinel/backfill 로 명시화하고, defense-in-depth 로 backend SoT 가드 + frontend defense 동시 적용. 본 작업의 §10.9 sentinel wrap 도 동일 라인.

**왜 internal bus layer 한정**:

- 외부 WS wire (`execution.submit_form` payload `{executionId, nodeId, formData, toolCallId?}`) 는 frontend / external API consumer 와의 호환 surface. 변경하면 client SDK·user-guide·external integration 모두 동시 흔들림. → 외부 wire 유지.
- DB `interaction_data.interactionType` enum (data-model §2.14) 와 NodeOutput `output.interaction.type` enum (node-output §4.5) 도 외부 가시 surface. 변경 불요 — 본 작업 sentinel 은 engine 내부 dispatch layer 한정.
- LLM tool_result content (`{type:'form_submitted', data:{…}}`, ai-agent §6.2 step 2.c) 는 LLM-facing layer. 변경 불요 — 이미 동형 shape 으로 명시되어 있다.
- §10.7 ConversationThread 운반의 "외부 surface 와 internal layer 분리" 원칙과 동형.

**`waitForAiConversation` dispatch 의 graceful degradation**:

미매칭 케이스 (`action.type` 이 4 enum 중 어느 것도 아니거나 `'type'` 키 자체 없음) 의 처리는 silent skip 이 아닌 **warn log + loop 재진입**. ai-agent §12.4 의 "KB/MCP 의 graceful degradation" (한 서버·KB 실패가 격리되어 진단 메타로 surface 하되 LLM 대화는 계속) 패턴과 동형 — 사용자 surface 가 끊기지 않되 운영자가 logs 에서 dispatch 회귀를 즉시 탐지 가능.

**`pendingFormToolCall` 누락 fallback (ai-agent §6.2 step 2.c)**:

본 §10.9 의 dispatch 가 `'form_submitted'` 케이스로 `handleAiMessageTurn` 을 호출하면, handler 의 `processMultiTurnMessage` 가 `state.pendingFormToolCall` 매칭을 검증한다. `pendingFormToolCall` 가 누락된 경우 (예: 사용자가 `render_form` 호출 없는 turn 에 `execution.submit_form` 을 직접 보냄, 또는 race condition) 의 fallback 규약은 [AI Agent §6.2 step 2.c](../3-ai/1-ai-agent.md#62-multi-turn-모드-mode--multi_turn) 가 SoT — form JSON 을 plain user 메시지로 thread 에 push + warn log 의무. ai-agent §7.4 invariant ("`interactionType: 'ai_form_render'` ↔ `pendingFormToolCall` set 은 1:1") 의 예외 처리.

**4-layer SSOT 정렬**: [§10.9 Form submission wire format](#109-form-submission-wire-format-internal-bus-sentinel) 본문의 "4-layer SSOT 정렬" 단일 진실 참조 — 본 절은 결정 근거 (왜 sentinel wrap) 만 담고 정렬 자체는 §10.9 본문이 SoT.
