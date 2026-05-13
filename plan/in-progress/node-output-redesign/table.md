# Table output 개선안

> 대상 spec: `spec/4-nodes/6-presentation/2-table.md` (§5 출력 구조)

## 현재 output (spec 인용)

§5.1 비-블로킹:

```json
{
  "config": { "mode": "dynamic", "columns": [{ "field": "name", "label": "Name" }, { "field": "email", "label": "{{ $var.locale === \"ko\" ? \"이메일\" : \"Email\" }}" }], "pageSize": 20, "sortBy": "name", "sortOrder": "asc" },
  "output": {
    "rows": [{ "name": "Alice", "email": "alice@test.com" }, { "name": "Bob", "email": "bob@test.com" }],
    "totalRows": 2,
    "rendered": "<table>...</table>",
    "columns": [{ "field": "name", "label": "Name" }, { "field": "email", "label": "Email" }]
  }
}
```

§5.4 Waiting (블로킹): `output` 동일 + `meta.interactionType: 'buttons'`, `status: 'waiting_for_input'`.
§5.5.1 Resumed (port 클릭): waiting `output` immutable + `output.interaction.{type, data, receivedAt}`.

## 진단

Table 은 Carousel 과 유사한 패턴 (블로킹 분기 + 단계 (waiting / resumed)) 이지만 **per-item 버튼 미지원** (글로벌 buttons 만).

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.rows: Array<Record>` | 적절 (output) | static: `columns[*].field` 기준 필터링 / dynamic: `dataSource` 항목별 평가 — runtime 계산 |
| `output.totalRows` | 적절 (output) | cap 적용 **전** 데이터셋 크기. `rows.length !== totalRows` 만으로 cap 감지 가능 (spec 명시) |
| `output.rendered` (HTML 문자열) | **검토 필요** | `<script>` escape 처리되었지만 HTML snapshot 은 백엔드가 생성. 다른 Presentation 노드 (Carousel/Chart) 는 백엔드 HTML 생성 폐지 (frontend client-side 렌더) — Table 만 유지하는 것이 일관성 검토 가치. spec footnote: `meta.rendered` 로 이동 검토 (conventions §4.2 의 마지막 항목) |
| `output.columns` (label evaluated, dynamic 한정) | 적절 — Principle 1.1 / 7 | label 의 `{{ }}` 를 평가한 결과. `config.columns` (raw label) 와 직교 |
| `output.rowsTruncated?` / `output.rowsTotalCount?` | 적절 | 1MB cap 동봉 신호 — spec 의 cap 신호 일관성 보장 |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `meta.interactionType: 'buttons'` | 적절 (meta) | |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.buttonConfig.buttons` (runtime) | 적절 — Carousel 과 동일 | per-row 버튼 미지원이라 `buttonItemMap` 없음 |
| `config.{mode, columns, pageSize, sortBy, sortOrder, buttons}` (raw echo) | 적절 | Principle 7 |
| `port: <button.id>` / `'continue'` | 적절 | Principle 5 / 6 |

핵심 점검:

1. **`output.rendered` HTML snapshot 의 일관성** — Carousel/Chart 는 백엔드 HTML 생성 폐지 (frontend client-side recharts/직접 렌더). Table 만 백엔드 HTML 유지하면 카테고리 일관성 결여. conventions §4.2 footnote: "프런트 렌더링용 이라면 유지 가능하나, 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토". 권장: Table 도 frontend client-side 렌더로 전환하거나, `meta.rendered` 로 이동.

2. **`output.totalRows` 와 `output.rows.length`** — totalRows 는 cap 전, rows 는 cap 후. 명시적 분리로 다운스트림이 cap 감지 가능. 합리적.

3. **`output.columns` (evaluated label)** — dynamic 모드 한정. config 의 raw label 과 직교 (Principle 7). 다운스트림이 `$node["T"].output.columns[i].label` 로 평가된 라벨 참조 가능. 합리적.

## 개선안 — 정리된 output

```json
// 비-블로킹
{
  "config": { "mode": ..., "columns": [<raw>], "pageSize"?, "sortBy"?, "sortOrder"? },
  "output": {
    "rows": [<Record>, ...],
    "totalRows": <number>,                     // cap 전 크기
    // ⚠ "rendered": <string> — meta.rendered 이동 검토 (Carousel/Chart 와 일관성)
    "columns": [<evaluated label ColumnDef>, ...],
    "rowsTruncated"?: true, "rowsTotalCount"?: <number>
  },
  "meta": { "durationMs": <number>, "rendered"?: <string> /* 이동 시 */ }
}

// Waiting (블로킹)
{
  "config": { ..., "buttons": [<raw>], "buttonConfig": { "buttons": [<runtime>] } },
  "output": { /* §5.1 의 모든 필드 — immutable snapshot */ },
  "meta": { "interactionType": "buttons", "durationMs": <number> },
  "status": "waiting_for_input"
}

// Resumed
{
  "config": {...},
  "output": {
    /* waiting 시점 필드 immutable */,
    "interaction": { "type": "button_click" | "button_continue", "data": {...}, "receivedAt": <ISO8601> }
  },
  "meta": {...},
  "port": "<button.id>" | "continue",
  "status": "resumed"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `output.rendered` (HTML) | `meta.rendered` 또는 백엔드 HTML 생성 폐지 (frontend client-side) | Carousel/Chart 와 일관성. conventions §4.2 footnote 명시. 후속 노드 로직이 참조할 값이 아님 |

## Rationale

- Table 의 핵심 데이터는 `output.rows` + `output.totalRows` + (dynamic) `output.columns` (evaluated label).
- HTML snapshot (`output.rendered`) 은 클라이언트 렌더링 편의용이지 비즈니스 데이터 아님 — Principle 1 위반 가능성. 다른 Presentation 노드와 일관성 위해 frontend client-side 렌더로 전환 권장.
- 1MB cap + `rowsTruncated` / `rowsTotalCount` 신호 분리 정책은 다운스트림이 양방향으로 cap 감지 가능 — 합리적.
- per-row 버튼 미지원은 Table 의 의도된 단순화 (Carousel 의 `__item_` 패턴 미적용).
