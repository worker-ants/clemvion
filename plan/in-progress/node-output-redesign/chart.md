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
