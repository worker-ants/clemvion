# Chart output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. SVG 백엔드 렌더링 폐지 + frontend client-side recharts 직접 렌더 + `output.data` (런타임 집계) 만 surface 하는 정책 유지. 잔여 권고 없음 (`chartType` schema/handler 불일치는 별도 caveat 트랙).

> 대상 spec: `spec/4-nodes/6-presentation/3-chart.md` (§5 출력 구조)

## 현재 output (spec 인용)

§5.1 비-블로킹:

```json
{
  "config": { "chartType": "bar", "title": "Monthly Revenue", "xAxis": { "field": "month", "label": "월" }, "yAxis": { "field": "revenue", "label": "매출", "aggregation": "sum" } },
  "output": {
    "data": [
      { "x": "Jan", "y": 1200 },
      { "x": "Feb", "y": 1500 },
      { "x": "Mar", "y": 1800 }
    ]
  },
  "meta": { "durationMs": 12 }
}
```

§5.4 Waiting (블로킹): `output: { data: [...] }` immutable + `status: 'waiting_for_input'`, `meta.interactionType: 'buttons'`.
§5.5.1 Resumed (port 클릭): waiting `output.data` immutable + `output.interaction.{type, data, receivedAt}`.

## 진단

Chart 는 입력 데이터 → `xAxis` 버킷팅 + `yAxis.aggregation` 집계 → `{x, y}` 포인트 배열. 런타임 변형 결과가 `output.data` 로 명확.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.data: { x, y? }[]` | 적절 (output) | input 을 xAxis 기준으로 버킷팅 + aggregation 적용한 **런타임 집계 결과**. `chartType`/`title` 등 리터럴 config 는 echo 안 함 (Principle 1.1) |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `meta.interactionType: 'buttons'` (블로킹 시) | 적절 (meta) | |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.{chartType, title, xAxis, yAxis, groupBy?, colors?, dataField?, buttons?}` (raw echo) | 적절 | Principle 7. SVG 차트는 frontend client-side recharts 로 직접 렌더 |
| `config.buttonConfig.buttons` (runtime) | 적절 — Carousel/Table 과 동일 패턴 | per-row 버튼 미지원이라 `buttonItemMap` 없음 |
| `port: <button.id>` / `'continue'` | 적절 | Principle 5 / 6 |

부적절 항목 없음. **Chart 는 conventions 와 매우 잘 정합** — spec 명시:

- 옛 `output.type: 'chart'` / `output.chartType` / `output.title` / `output.rendered` (SVG snapshot) / `output.previousOutput` 모두 폐기 (§5.4 footnote)
- `output.data` 만 런타임 집계 결과로 유지

추가 점검:

1. **SVG 백엔드 렌더링 폐지** — Chart 는 spec §4 step 5 / §5 head footnote 가 명시: "backend 는 SVG snapshot 을 채우지 않음 — 프런트엔드가 client-side recharts 로 직접 그린다". Carousel/Chart 가 같은 정책 — Table 의 `output.rendered` 와 일관성 차이 (Table plan 에서도 지적).

2. **caveat: `chartType` schema/handler 불일치** (spec §6 footnote): schema 5종 (`bar | line | pie | donut | area`), handler `validate()` 3종 (`bar | line | pie`) 만 허용. 출력 구조에는 영향 없으나 별도 트랙 추적.

3. **`yAxis.aggregation` fallback** — `Number(y) → NaN → 0` 처리. spec footnote 명시: "건너뜀 의미가 필요한 경우 사전 필터링 노드 권장". 합리적이나 후속 노드가 0 ↔ 실제 0 값 구분이 어려울 수 있음 — 별도 검토 필요 시 `meta.skippedRows` 같은 진단 추가 가능.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// 비-블로킹
{
  "config": { "chartType": ..., "title"?, "xAxis": {...}, "yAxis": {...}, "groupBy"?, "colors"?, "dataField"? },
  "output": { "data": [{ "x": ..., "y"? }, ...] },
  "meta": { "durationMs": <number> }
}

// Waiting (블로킹)
{
  "config": { ..., "buttons": [<raw>], "buttonConfig": { "buttons": [<runtime>] } },
  "output": { "data": [...] },                  // immutable snapshot
  "meta": { "interactionType": "buttons", "durationMs": <number> },
  "status": "waiting_for_input"
}

// Resumed
{
  "config": {...},
  "output": {
    "data": [...],                              // waiting 시점 그대로
    "interaction": { "type": "button_click" | "button_continue", "data": {...}, "receivedAt": <ISO8601> }
  },
  "meta": { ... },
  "port": "<button.id>" | "continue",
  "status": "resumed"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (옛 패턴은 모두 폐기 마킹됨) | — | Principle 1.1 / 4 부합 |

## Rationale

- Chart 는 conventions 의 모범 사례 — 런타임 집계 (`output.data`) 만 유지, 차트 타입·제목·축 등 리터럴 config 는 모두 `config.*` 참조.
- SVG 렌더링을 frontend client-side 로 옮긴 결정은 (1) 백엔드 메모리 절약, (2) 인터랙션 (zoom, hover) 지원, (3) Principle 1 (output 은 비즈니스 데이터) 부합 — 모두 합리적.
- 옛 `output.rendered` (SVG snapshot) 폐기는 Carousel 과 동일 패턴 — Table 만 미적용 상태로 일관성 미흡 (Table plan 에 지적).
- `yAxis.aggregation` 의 NaN→0 처리는 silent fallback 이지만 spec 이 명시하고 사전 필터링 권장 — Principle 10 fallback 정책과 정합.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/presentation/chart/{chart.handler.ts, chart.schema.ts, chart.handler.spec.ts, buttons.spec.ts, chart.schema.spec.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - 비-블로킹: `chart.handler.ts:103` `return { config: configEcho, output: payload }`. payload = `{ data: chartData }` (`:77`) — spec §5.1 와 일치.
   - 블로킹 waiting: `:88-101` 가 `status: 'waiting_for_input'` + `meta: { interactionType: 'buttons', durationMs: 0 }` + `config.buttons: rawButtons` + `config.buttonConfig: { buttons }` 반환. spec §5.4 부합. **`buttonItemMap` 없음** — Chart 는 per-row 미지원 (정합).
   - resumed: 엔진 주입 — handler 미관여.

2. **schema ↔ spec config 정합성**: `chartConfigSchema` (`chart.schema.ts:66-107`) 의 `chartType`/`dataField`/`xAxis`/`yAxis`/`groupBy`/`title`/`colors`/`buttons` 모두 spec §1 와 일치. default `bar`/`''`/`{field:''}`/`{field:''}`/`[]`.
   - **⚠ 알려진 caveat (spec §6 footnote)**: `chartConfigSchema.chartType` enum 은 5종 (`bar | line | pie | donut | area`) — `:69` 이지만 handler `validate()` 는 `['bar', 'line', 'pie']` 3종만 허용 (`chart.handler.ts:22`). spec 본문 출력 구조에는 영향 없으나 schema 저장 시 `donut`/`area` 가 실행 단계에서 reject 되는 미해소 트랙.
   - **gap**: `output schema` 가 두 개 존재 — `chartOutputSchema` (`chart.schema.ts:113-118`) 는 옛 `{ type, chartType, title, data }` 형태로 Principle 1.1.4 (`output.type` 판별자 폐기) 와 위배. 핸들러 return 과 일관성 없으며 dead schema 의심. handler 가 이 schema 를 import 하지 않음 (`grep chartOutputSchema` 결과: schema 파일에만 export 존재). 검토 필요 — 다른 spec 영역에서 import 하는지 확인 권장.

3. **validate 일관성**:
   - `chart.handler.ts:14-34` 의 `handler.validate()` 는 warningRules (no-chart-type / no-x-axis-field / no-y-axis-field) + handler-only residual: `chartType` enum 3종 guard. spec §6 메시지와 일치.
   - `validateChartConfig` (`chart.schema.ts:130-133`) 는 `validateButtons` 위임만 — 단순.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만 — spec §6 부합. NaN→0 silent fallback (`:117` `isNaN(val) ? 0 : val`) — spec §4.1 footnote 명시.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0: 5필드 invariant 부합.
   - Principle 1.1: `chartType`/`title`/`xAxis`/`yAxis` 모두 `config.*` 에 echo, `output.data` 는 runtime 집계 결과 — 정확 직교 (Principle 1.1.3 의 모범 사례).
   - Principle 4: waiting/resumed 부합.
   - Principle 5/6: 동적 포트 부합. per-item 미지원.
   - Principle 7: `rawConfig ?? config` (`:76`) 패턴으로 `chartType`/`title`/`xAxis`/`yAxis` echo (`:78-83`). `dataField`/`groupBy`/`colors` echo 누락 — schema 정의 있으나 (`:72-95`) handler 에서 surface 안 함. Principle 7 "항상 echo" 와 미세 불일치.
   - Principle 8: 단일 `output.data` — 이중 중첩 없음.

6. **handler 테스트 (`chart.handler.spec.ts`, `buttons.spec.ts`)**:
   - 정상: input array / non-array wrap / dataSource / dataField + nested + non-array fallback / aggregation 5종 + 그룹 평가 / non-numeric y→0 (`:1-444`).
   - 에러: validate 미존 chartType / scatter / xAxis 미존 / non-array buttons / button id 누락 (`:23-122`).
   - waiting: `buttons.spec.ts:44-77` 가 `status` / `meta.interactionType` / `output.data` 검증.
   - output shape: `output.type`/`output.chartType`/`output.title` 모두 undefined 검증 (`:397-417`) — Principle 1.1.4 회귀 방지.
   - **미세 누락**:
     - resumed handler 테스트 없음 (엔진 책임).
     - `chartOutputSchema` (옛 `{ type, chartType, ... }`) dead code 검증 부재 — handler 가 사용 안 한다는 명시적 테스트 없음. import 추적 권장.
     - `groupBy` (다중 시리즈) 기능 자체가 handler 에 미구현 — `chart.handler.ts:59-67` 는 `groupBy` 무시 (config echo 도 안 함). spec §4 step 4 가 "groupBy 지정 시 그룹별 시리즈 생성" 명시하나 코드 부재. **기능 누락** (P2 트랙 후보).

7. **횡단 일관성 (Presentation 5종)**:
   - SVG snapshot 폐기 — Carousel 과 일관, Table 만 비대칭.
   - `validateButtons` 동일 호출.
   - cap 부재 — Chart `output.data` 는 aggregation 후 통상 작아 cap 불필요. Carousel/Table 의 1MB cap 과 의도된 비대칭 (정합).
   - `meta.interactionType: 'buttons'` 일관.

8. **구현 품질**:
   - XSS: handler 는 HTML 생성 안 함 — XSS 표면 없음.
   - 재개 토큰: 엔진 책임.
   - 큰 dataset: aggregation 후 `output.data` 는 X 키 unique count 만큼만 size — Map 기반 grouping (`:110-117`) 이 효율적. 단, 입력 array 자체가 거대하면 메모리 위험. cap 적용 검토 가치 (낮은 우선순위).
   - dead code: `chartOutputSchema` (`chart.schema.ts:113-118`) — 사용처 확인 필요.

## 종합 개선안 (2026-05-16)

- [ ] (impl) **`chartType` schema/handler 불일치 해소** (spec §6 caveat) — 두 옵션 중 결정:
  - 옵션 A: handler `VALID_CHART_TYPES` 를 `['bar', 'line', 'pie', 'donut', 'area']` 로 확장 + frontend recharts 가 5종 모두 렌더 가능한지 확인.
  - 옵션 B: schema enum 에서 `donut`/`area` 제거 + 기존 워크플로우 migration.
  근거: `chart.schema.ts:69` ↔ `chart.handler.ts:22`.
- [ ] (impl) `groupBy` (다중 시리즈) 구현 — spec §4 step 4 가 정의하지만 handler 코드 부재. 또는 spec 에서 미지원 명시. 근거: `chart.handler.ts:59-67`.
- [ ] (impl) `chartOutputSchema` (`chart.schema.ts:113-118`) dead code 확인 후 제거 또는 `chartNodeOutputSchema` (5필드 형태) 로 재정의 — 옛 `output.type` 판별자 Principle 1.1.4 위반. 근거: `chart.schema.ts:113-118`.
- [ ] (impl) `chart.handler.ts:78-83` 의 `configEcho` 에 `dataField`/`groupBy`/`colors` raw echo 추가 — Principle 7 "항상 echo" 부합. 근거: `chart.schema.ts:72-95`.
- [ ] (spec) §5.1 의 yAxis 미지정 시 `output.data[i].y` 가 `undefined` 인 케이스 (`chart.handler.ts:62-66`) 의 JSON 예시 보강 — 현 spec 은 yAxis 있는 케이스만 예시.
