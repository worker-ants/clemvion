# Table output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `output.rows` + `output.totalRows` (cap 전 크기) + `output.columns` (evaluated label, dynamic 한정) + 1MB cap 신호 (`rowsTruncated`/`rowsTotalCount`) 유지.
> 잔여 권고 항목:
> - `output.rendered` HTML snapshot 의 위치 — Carousel/Chart 는 백엔드 HTML 생성 폐지 (frontend client-side 렌더) 인데 Table 만 유지로 카테고리 일관성 결여. `meta.rendered` 로 이동하거나 frontend client-side 렌더 전환 검토. conventions §4.2 footnote 명시.

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

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/presentation/table/{table.handler.ts, table.schema.ts, table.handler.spec.ts, buttons.spec.ts, table.schema.spec.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - 비-블로킹: `table.handler.ts:196` `return { config: configEcho, output: payload }`. payload = `{ rows, totalRows, rendered, columns, (rowsTruncated, rowsTotalCount)? }` (`:150-164`) — spec §5.1 와 일치.
   - 블로킹 waiting: `:181-194` 가 `status: 'waiting_for_input'` + `meta: { interactionType: 'buttons', durationMs: 0 }` + `config.buttonConfig: { buttons }` 반환. spec §5.4 와 일치. **`buttonItemMap` 없음** — Table 은 per-row 버튼 미지원으로 정합 (`buttonConfig.buttonItemMap` 부재).
   - resumed: 엔진 주입 — handler 미관여.

2. **schema ↔ spec config 정합성**: `tableNodeConfigSchema` (`table.schema.ts:116-228`) 의 `mode`/`dataSource`/`columns`/`rows`/`pagination`/`pageSize`/`sortBy`/`sortOrder`/`buttons` 모두 spec §1 와 일치. default 도 일치 (`dynamic`/`[]`/`true`/`20`/`asc`/`[]`).
   - **gap (경미)**: `config.pagination` echo 누락 — `table.handler.ts:165-178` 의 `configEcho` 에 `pagination` 부재. spec §5.1 JSON 예시도 echo 안 함 — 의도된 누락이지만 Principle 7 "항상 echo" 와 미세 불일치.

3. **validate 일관성**:
   - `table.handler.ts:33-44` 의 `handler.validate()` 는 warningRules (no-columns/invalid-mode) + `validateTableConfig` (columns 타입 / static rows 타입 / sortBy↔columns cross-check / validateButtons) 만 호출. SSOT 침범 없음 — 핸들러 잔여 검증 0건.
   - `validateTableConfig` (`table.schema.ts:248-274`) 가 spec §6 의 모든 에러 메시지를 담당.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만. per-row expression 평가 실패는 `safeEvaluate` (`table.handler.ts:260-272`) 에서 catch 후 cell `null` 처리 — spec §6 footnote 명시 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0: 5필드 invariant 부합.
   - Principle 1.1: **`output.rendered` 는 직교성 미세 위배** — HTML snapshot 은 `resolvedColumns` + `cappedRows.value` 로부터 runtime 생성되어 사실상 비즈니스 데이터가 아닌 presentation artifact. Carousel/Chart 가 frontend client-side 렌더로 전환한 것과 비대칭. README plan §"가장 빈번한 부적절 패턴" 2번.
   - Principle 4: waiting/resumed 부합. `meta.interactionType: 'buttons'` 부합.
   - Principle 5: `port: 'out'`/`<button.id>`/`'continue'` — `out` 은 단일 출력 시.
   - Principle 6: `__item_` 미사용 (Table 은 per-row 버튼 없음) — 적합.
   - Principle 7: `rawConfig ?? config` (`table.handler.ts:149`) 패턴으로 `mode`/`columns`/`pageSize`/`sortBy`/`sortOrder` echo. raw label 보존 (resolved 는 `output.columns`).
   - Principle 10: empty rows 시 `dataRows = []` (`:69`) — fallback 적절. `safeEvaluate` catch 후 cell null (Principle 10).

6. **handler 테스트 (`table.handler.spec.ts`, `buttons.spec.ts`)**:
   - 정상: dynamic/static 모드 + sort + pageSize + dot-path + per-item expression (`$dataSource`/`$sourceItem`/`$sourceItemIndex`/`$var`) + HTML escape + `output.totalRows` + raw vs resolved columns 분리 (`:1-753`).
   - 에러: validate 단계 dynamic/static/sortBy mismatch/non-array columns 모두 커버.
   - waiting: `buttons.spec.ts:40-69` 가 `status` / `meta.interactionType` / `output.rows` / `output.rendered` 검증.
   - cap: 1MB 초과 시 `rowsTruncated`/`rowsTotalCount` (`:780-845`) + **`rendered` 가 capped rows 로부터 생성** 검증 (`:814-845`) — cap leak 회귀 방지.
   - **미세 누락**:
     - resumed 단계 handler 테스트 없음 (엔진 책임).
     - `output.columns` 의 evaluated label 가 dynamic 모드에서만 surface 되는데, label expression 이 throw 하는 케이스의 `safeEvaluate` 동작 검증 부재 — `resolveColumnLabels` (`table.handler.ts:199-226`) 의 try/catch 경로 unit 검증 보강 가치.

7. **횡단 일관성 (Presentation 5종)**:
   - `output.rendered` 유지 — Carousel/Chart 와 비대칭. plan README 의 잔여 권고 표 진입 항목.
   - `validateButtons` (`_shared/button.types.ts`) 동일 호출 — Carousel/Chart/Template 와 일관.
   - `truncateArrayForOutput` (`PRESENTATION_MAX_BYTES`) 사용 — Carousel 과 일관 (Chart 는 cap 부재 — Chart `output.data` 는 aggregation 결과로 통상 작음).
   - `meta.interactionType` 부합. `_shared` 공통 ButtonDef 일관.

8. **구현 품질**:
   - XSS: `escapeHtml` (`table.handler.ts:283-290`) 이 `&<>"'` 5종 모두 escape. cell value 와 column label 양쪽 모두 적용 (`:233-247`). `<script>` 테스트 (`table.handler.spec.ts:434-443`) 회귀 방지.
   - 재개 토큰: 엔진 책임.
   - 큰 dataset: 1MB cap + `rendered` 가 capped rows 로부터 재생성 (`:139-143`) — leak 방지. `:814-845` 회귀 테스트.
   - dead code: `safeEvaluate` 내 `console.error` (`:264-269`) — debug 잔재 가능. 정식 logger 로 교체 검토 가치 (운영 환경 noise).

## 종합 개선안 (2026-05-16)

- [ ] (spec) §5.1 의 `output.rendered` 위치 결정 — Carousel/Chart 와 일관성 위해 두 옵션 중 하나 선택:
  - 옵션 A: spec 에서 `output.rendered` 제거하고 `meta.rendered` 로 이동, 또는
  - 옵션 B: spec footnote 에 "Table 은 backend HTML snapshot 을 유지 — frontend 가 evaluated label 을 매번 재계산하지 않도록 한다" 명시.
  근거: `table.handler.ts:139-143, :156`.
- [ ] (impl) 위 spec 결정에 따라 `output.rendered` → `meta.rendered` 이동, 또는 frontend client-side recharts 패턴으로 전환 (HTML 생성 제거). 근거: `table.handler.ts:228-250` `renderHtml`.
- [ ] (impl) `safeEvaluate` (`table.handler.ts:260-272`) 의 `console.error` 를 정식 logger (Nest `Logger`) 로 교체 — 운영 환경 noise 감소. 근거: `table.handler.ts:264-269`.
- [ ] (impl) `resolveColumnLabels` 의 expression-throw 경로 unit 테스트 추가 — `safeEvaluate` catch 후 label 이 `'null'` 문자열로 표면화되는 동작 검증. 근거: `table.handler.ts:220-225`.
- [ ] (spec) §1 의 `config.pagination` echo 여부 명시 — 현 handler `configEcho` (`:165-178`) 누락. Principle 7 ↔ spec 명시 합치 필요.
