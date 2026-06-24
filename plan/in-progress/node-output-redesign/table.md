# Table output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: 5/16 당시 미해결 4항목 중 3건 해소. (1) `output.rendered` 폐기 — D5(commit `ccadb42f`, 2026-05-17, B안)로 backend HTML snapshot 생성 전면 제거, `renderHtml`/`escapeHtml`/`toDisplayString` helper 삭제, frontend `TableContent` client-side 렌더로 전환 (Carousel/Chart 와 완전 일관). (2) `safeEvaluate` 의 `console.error` → Nest `Logger` 교체 해소 — `table.handler.ts:29` `new Logger('TableHandler')` + `:249-252` `logger.error` (PII 차단으로 키 이름만 로깅). (3) `config.pagination` echo 누락 해소 — D1(commit `c10383fc`) explicit-enumeration 으로 `configEcho` 가 `pagination`(+`dataSource`/`rows`) 무조건 echo (`table.handler.ts:171`), spec §5.1 footnote(line 200) 도 동기화. **잔여 1건**: `resolveColumnLabels` 의 label expression throw 경로(`safeEvaluate` catch → `'null'` 문자열) unit 테스트 미추가 (`table.handler.ts:219-222`). 핸들러는 단일 파일 유지(분할 없음), stale 라인 인용 다수 정정.

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
| ~~`output.rendered` (HTML 문자열)~~ | **해소 (2026-06-25)** | D5(commit `ccadb42f`)로 폐기 — backend HTML snapshot 생성 제거, frontend client-side 렌더로 전환. Carousel/Chart 와 완전 일관. `table.handler.ts` payload 에 더 이상 없음 |
| `output.columns` (label evaluated, dynamic 한정) | 적절 — Principle 1.1 / 7 | label 의 `{{ }}` 를 평가한 결과. `config.columns` (raw label) 와 직교 |
| `output.rowsTruncated?` / `output.rowsTotalCount?` | 적절 | 1MB cap 동봉 신호 — spec 의 cap 신호 일관성 보장 |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `meta.interactionType: 'buttons'` | 적절 (meta) | |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.buttonConfig.buttons` (runtime) | 적절 — Carousel 과 동일 | per-row 버튼 미지원이라 `buttonItemMap` 없음 |
| `config.{mode, columns, pageSize, sortBy, sortOrder, buttons}` (raw echo) | 적절 | Principle 7 |
| `port: <button.id>` / `'continue'` | 적절 | Principle 5 / 6 |

핵심 점검:

1. **`output.rendered` HTML snapshot 의 일관성** — Carousel/Chart 는 백엔드 HTML 생성 폐지 (frontend client-side recharts/직접 렌더). Table 만 백엔드 HTML 유지하면 카테고리 일관성 결여. conventions §4.2 footnote: "프런트 렌더링용 이라면 유지 가능하나, 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토". 권장: Table 도 frontend client-side 렌더로 전환하거나, `meta.rendered` 로 이동. → (2026-06-25) 해소: D5(commit `ccadb42f`)로 frontend client-side 렌더 전환 (B안 채택), `output.rendered` 완전 제거.

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

대상 파일: `codebase/backend/src/nodes/presentation/table/{table.handler.ts, table.schema.ts, table.handler.spec.ts, buttons.spec.ts, table.schema.spec.ts, table.component.ts, index.ts}`. (핸들러 분할 없음 — 단일 `table.handler.ts` 유지.)

1. **spec §5 ↔ handler return 정합성**:
   - 비-블로킹: `table.handler.ts:195` `return Promise.resolve({ config: configEcho, output: payload })`. payload = `{ rows, totalRows, columns, (rowsTruncated, rowsTotalCount)? }` (`:149-162`) — spec §5.1 와 일치. → (2026-06-25) D5(commit `ccadb42f`) 로 `rendered` 필드 제거됨 — payload 에 더 이상 `rendered` 없음.
   - 블로킹 waiting: `:181-192` 가 `status: 'waiting_for_input'` + `meta: { interactionType: 'buttons', durationMs: 0 }` + `config.buttonConfig: { buttons }` 반환. spec §5.4 와 일치. **`buttonItemMap` 없음** — Table 은 per-row 버튼 미지원으로 정합 (`buttonConfig.buttonItemMap` 부재).
   - resumed: 엔진 주입 — handler 미관여.

2. **schema ↔ spec config 정합성**: `tableNodeConfigSchema` (`table.schema.ts:132-244`) 의 `mode`/`dataSource`/`columns`/`rows`/`pagination`/`pageSize`/`sortBy`/`sortOrder`/`buttons` 모두 spec §1 와 일치. default 도 일치 (`dynamic`/`[]`/`true`/`20`/`asc`/`[]`).
   - **gap 해소** → (2026-06-25): `config.pagination` echo 누락 해소 — D1(commit `c10383fc`) explicit-enumeration 으로 `configEcho` (`table.handler.ts:166-177`) 가 `pagination`(+`dataSource`/`rows`) 무조건 echo (`:171`). spec §5.1 footnote(line 200) 도 동기화. Principle 7 "항상 echo" 합치.

3. **validate 일관성**:
   - `table.handler.ts:40-51` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` 를 통해 warningRules (no-columns/invalid-mode) + `validateTableConfig` (columns 타입 / static rows 타입 / sortBy↔columns cross-check / validateButtons) 호출. SSOT 침범 없음 — 핸들러 잔여 검증 0건. (mode 미지정 시 `dynamic` 정규화 후 평가.)
   - `validateTableConfig` (`table.schema.ts:264-290`) 가 spec §6 의 모든 에러 메시지를 담당.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만. per-row expression 평가 실패는 `safeEvaluate` (`table.handler.ts:235-255`) 에서 catch 후 cell `null` 처리 — spec §6 footnote 명시 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0: 5필드 invariant 부합.
   - Principle 1.1: **`output.rendered` 직교성 위배 해소** → (2026-06-25): D5(commit `ccadb42f`) 로 backend HTML snapshot 생성 폐지, `output.rendered` 제거. Carousel/Chart 와 완전 일관 (`table.handler.ts:21-24` 주석, `:146-158` payload). 더 이상 presentation artifact 가 output 에 없음.
   - Principle 4: waiting/resumed 부합. `meta.interactionType: 'buttons'` 부합.
   - Principle 5: `port: 'out'`/`<button.id>`/`'continue'` — `out` 은 단일 출력 시.
   - Principle 6: `__item_` 미사용 (Table 은 per-row 버튼 없음) — 적합.
   - Principle 7: `rawConfig ?? config` (`table.handler.ts:148`) 패턴으로 `mode`/`dataSource`/`columns`/`rows`/`pagination`/`pageSize`/`sortBy`/`sortOrder` 무조건 echo. raw label 보존 (resolved 는 `output.columns`).
   - Principle 10: empty rows 시 `dataRows = []` (`:68-83`) — fallback 적절. `safeEvaluate` catch 후 cell null (Principle 10).

6. **handler 테스트 (`table.handler.spec.ts`, `buttons.spec.ts`)**:
   - 정상: dynamic/static 모드 + sort + pageSize + dot-path + per-item expression (`$dataSource`/`$sourceItem`/`$sourceItemIndex`/`$var`) + `output.totalRows` + raw vs resolved columns 분리 (`table.handler.spec.ts:1-802`). → (2026-06-25) D5 로 HTML escape 검증 케이스는 `should expose rows and columns for client-side rendering` (`:469-484`) 로 대체됨 — backend escape 책임 사라짐.
   - 에러: validate 단계 dynamic/static/sortBy mismatch/non-array columns 모두 커버.
   - waiting: `buttons.spec.ts:40-58` 가 `status` / `meta.interactionType` / `output.rows` 검증 + `output.rendered` 가 `undefined` 임 검증 (`:57`, D5 회귀 방지).
   - cap: 1MB 초과 시 `rowsTruncated`/`rowsTotalCount` (`table.handler.spec.ts:804-873`) 검증. → (2026-06-25) D5 로 "`rendered` 가 capped rows 로부터 생성" 회귀 케이스는 폐기 (`:869-872` 주석) — `rows` cap 만으로 충분.
   - **미세 누락 (잔여)**:
     - resumed 단계 handler 테스트 없음 (엔진 책임).
     - `output.columns` 의 evaluated label 가 dynamic 모드에서만 surface 되는데, label expression 이 throw 하는 케이스의 `safeEvaluate` 동작 검증 부재 — `resolveColumnLabels` (`table.handler.ts:198-225`) 의 try/catch 경로 unit 검증 보강 가치. (현 spec 는 literal-label no-op 케이스만 커버: `:772-801`.)

7. **횡단 일관성 (Presentation 5종)**:
   - `output.rendered` 폐기 → (2026-06-25) 해소: D5(commit `ccadb42f`) 로 Carousel/Chart 와 완전 일관 (backend 는 config + data 만, frontend client-side 렌더). plan README 잔여 권고 표에서 제거됨.
   - `validateButtons` (`_shared/button.types.ts`) 동일 호출 — Carousel/Chart/Template 와 일관 (`table.schema.ts:288`).
   - `truncateArrayForOutput` (`PRESENTATION_MAX_BYTES`) 사용 (`table.handler.ts:133`) — Carousel 과 일관 (Chart 는 cap 부재 — Chart `output.data` 는 aggregation 결과로 통상 작음).
   - `meta.interactionType` 부합. `_shared` 공통 ButtonDef 일관.

8. **구현 품질**:
   - XSS → (2026-06-25): D5 로 backend HTML 생성(`escapeHtml`/`renderHtml`) 전면 제거 — escape 책임이 표시 계층(React JSX 자동 escape)으로 이동. backend 는 raw `rows`/`columns` 만 surface.
   - 재개 토큰: 엔진 책임.
   - 큰 dataset: 1MB cap (`table.handler.ts:133`) — leak 방지. `table.handler.spec.ts:832-867` 회귀 테스트.
   - dead code 해소 → (2026-06-25): `safeEvaluate` 내 `console.error` 가 Nest `Logger` 로 교체됨 — `table.handler.ts:29` `new Logger('TableHandler')` + `:249-252` `logger.error` (PII 차단으로 `$sourceItem`/`$var` 키 이름만 로깅).

## 종합 개선안 (2026-05-16)

- [x] (spec) §5.1 의 `output.rendered` 위치 결정 — Carousel/Chart 와 일관성 위해 두 옵션 중 하나 선택:
  - 옵션 A: spec 에서 `output.rendered` 제거하고 `meta.rendered` 로 이동, 또는
  - 옵션 B(채택): spec 에서 `output.rendered` 제거 + frontend client-side 렌더 전환.
  — ✅ (2026-06-25) D5 결정(B안) — spec §5.1 footnote `2-table.md:198` 가 폐기 명시, JSON 예시·필드 표에서 `rendered` 제거. commit `ccadb42f`.
- [x] (impl) 위 spec 결정에 따라 `output.rendered` → frontend client-side 렌더로 전환 (HTML 생성 제거). — ✅ (2026-06-25) `renderHtml`/`escapeHtml`/`toDisplayString` helper 삭제, payload 에서 `rendered` 제거 — `table.handler.ts:146-158` payload + `:21-24` D5 주석. commit `ccadb42f`.
- [x] (impl) `safeEvaluate` 의 `console.error` 를 정식 logger (Nest `Logger`) 로 교체 — 운영 환경 noise 감소. — ✅ (2026-06-25) `table.handler.ts:29` `new Logger('TableHandler')` + `:249-252` `logger.error` (PII 차단으로 `$sourceItem`/`$var` 키 이름만 로깅).
- [ ] (impl) `resolveColumnLabels` 의 expression-throw 경로 unit 테스트 추가 — `safeEvaluate` catch 후 label 이 `'null'` 문자열로 표면화되는 동작 검증. 근거: `table.handler.ts:219-222`. (현재 spec 는 literal-label no-op 케이스만 커버: `table.handler.spec.ts:772-801`.)
- [x] (spec) §1 의 `config.pagination` echo 여부 명시 — 현 handler `configEcho` 누락. Principle 7 ↔ spec 명시 합치 필요. — ✅ (2026-06-25) D1 explicit-enumeration 으로 `configEcho` 가 `pagination` 무조건 echo — `table.handler.ts:171`. spec §5.1 footnote `2-table.md:200` + 필드 표 `:208` 동기화. commit `c10383fc`.
