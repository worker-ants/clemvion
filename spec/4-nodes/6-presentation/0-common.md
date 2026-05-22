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

### 1.1 유효성 검증

| 규칙 | 설명 |
|------|------|
| 버튼 라벨 필수 | 각 ButtonDef의 `label`은 비어있을 수 없음 |
| link URL 필수 | `type: "link"`는 `url`이 필수 |
| port에 URL 불가 | `type: "port"`는 `url` 설정 불가 |
| 최대 버튼 수 | 노드당 최대 **5개** (globalButtons). Carousel `itemButtons` 도 각 아이템당 5개. ([§Rationale](#rationale) 참조 — 단일 아이템 가시 모델 global 5 + item 5 = 10) |
| 버튼 ID 고유 | 노드 내 모든 버튼 ID 유일 |
| 미연결 port 경고 | port 타입 버튼의 동적 포트에 엣지 미연결 시 경고 (에러 아님) |

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
| `render_chart` | [Chart](./3-chart.md) | `chartNodeConfigSchema` (zod) → JSON Schema |
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

본 공통 규약 §4 의 `PRESENTATION_MAX_BYTES = 1024 × 1024` 가 동일하게 적용된다. LLM 이 cap 을 초과하는 페이로드를 emit 하면 §10.5 의 schema 위반 흐름을 따른다 — Carousel/Table 의 tail truncate 정책 (§4) 은 LLM tool 모드에서도 **그대로 적용**되며, 잘린 결과는 `output.{itemsTruncated|rowsTruncated}: true` + `output.{itemsTotalCount|rowsTotalCount}` 와 동등한 메타가 ConversationTurn `data.presentations[i].truncation` 에 surface 한다.

### 10.5 Schema 위반 처리

1. LLM 페이로드를 해당 노드의 zod schema 로 validate.
2. 위반 (필수 필드 누락, 타입 불일치, 정합성 위배) 또는 1MB cap 초과 (Carousel/Table 의 tail truncate 후에도 element 자체가 1개도 안 들어가는 경우 등 cap 적용 불가 케이스) 시 tool_result 에 `{error: 'INVALID_PAYLOAD', issues: [...]}` 회신.
3. LLM 이 같은 turn 안에서 재시도 가능. 재시도 1회 후에도 실패하면 silent drop + `meta.presentationSchemaViolations[]` 에 누적 ([AI Agent §4.1·§10](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_)).
4. AI Agent 의 `error` 포트는 발화하지 않는다 — 표현 surface 확장이라 텍스트 응답으로 fallback 한다.

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

---

## 9. CHANGELOG

| 일자 | 변경 |
|------|------|
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
