# Form (`form`) — Output 일관성 개선안

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/form.md](../../node-specs/presentation/form.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 4 (블로킹/재개 컨트랙트 통일)** — 최우선 / Principle 0, Principle 1

> **요약**: `form` 은 presentation 카테고리 5개 노드(form/carousel/table/chart/template) 중 **재개(resumed) 경로가 가장 크게 벗어난** 노드입니다. 나머지 4개는 이미 `output.interaction` / `output.previousOutput` 구조를 사용하지만, form 만 `output.submittedData` 라는 독자 구조를 유지합니다. 또한 waiting 상태에서 `output: null` 을 반환하여 **유일하게 `view` 가 없는 블로킹 노드**이기도 합니다.

---

## 1. 현재 Output 구조 요약

Form 은 사용자에게 입력 폼을 띄우고 제출을 기다리는 blocking 노드입니다. Handler 는 `input` 을 읽지 않고 `config.fields` 정의만으로 폼을 선언한 뒤, 제출이 들어오면 엔진이 structured output 을 덮어씁니다.

### Case A — 초기 실행 (waiting)

```json
{
  "config": {
    "title": "User Profile",
    "submitLabel": "Submit",
    "fields": [
      { "name": "email", "type": "email", "label": "Email", "required": true },
      { "name": "age", "type": "number", "label": "Age" }
    ]
  },
  "output": null,
  "status": "waiting_for_input",
  "meta": { "interactionType": "form" }
}
```

### Case B — 제출 후 (resumed)

```json
{
  "config": { "title": "User Profile", "fields": [ /* … */ ] },
  "output": {
    "submittedData": { "email": "a@b.com", "age": 25 }
  },
  "status": "submitted",
  "meta": { "interactionType": "form" }
}
```

특징 요약:

- Waiting 상태에서 `output: null` — 렌더링에 필요한 뷰 정보는 `config.fields`/`config.title` 에서 프런트엔드가 직접 긁어감.
- Resumed 상태의 제출 데이터는 `output.submittedData` 아래에 네스팅 (단일 노드 고유 네이밍).
- `status` 는 `'submitted'` 라는 노드-특정 리터럴 사용.
- `meta.interactionType: 'form'` 은 유지되지만 presentation 카테고리 공통의 의미론이 없음 (carousel 은 `'buttons'`, template 도 `'buttons'`).
- waiting 시점의 "뷰 스냅샷" 이 존재하지 않으므로 resumed 시점에 과거 필드 상태와 제출 결과를 함께 참조하기 어렵다.

---

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output: null` | **Principle 4.3 (Waiting 상태의 기본 view)** | 모든 presentation/multi-turn 블로킹 노드는 `output.view.type` 으로 종류 식별이 가능해야 함. form 만 `output` 자체가 null. |
| 2 | Resumed 시 `output.submittedData` | **Principle 4.2 (폐기할 필드)** | "`form.output.submittedData` → `output.interaction.data` 로 이동" 규약이 CONVENTIONS 에 이미 명시됨. 4개 나머지 presentation 노드는 이미 `output.interaction` 을 사용. |
| 3 | `status: 'submitted'` | **Principle 4.1 (상태 전이) / 축 9 status 사전** | 사용자 입력 수신 후 상태는 `resumed` 로 통일. `submitted` 는 `output.interaction.type = 'form_submitted'` 로 표현. |
| 4 | Resumed 시 뷰 스냅샷 부재 | **Principle 4.1** | 다른 4개 노드는 `previousOutput` 으로 뷰를 보존. form 은 제출 후 어떤 필드 구조였는지 `output` 에서 확인 불가 (`config.fields` 로만 가능). |
| 5 | `meta.interactionType: 'form'` 의 의미 과적재 | Principle 2 (형식적 위반) | carousel/table/chart/template 은 `'buttons'` 로 사실상 "어떤 상호작용 UI 였나" 를 마킹. form 은 별개 리터럴. 통일 or 제거 필요. |

---

## 3. 제안된 Output 구조

### 3.1. Waiting (`status: "waiting_for_input"`)

**Before**

```json
{
  "config": { "title": "User Profile", "fields": [ /* … */ ], "submitLabel": "Submit" },
  "output": null,
  "status": "waiting_for_input",
  "meta": { "interactionType": "form" }
}
```

**After**

```json
{
  "config": { "title": "User Profile", "fields": [ /* … */ ], "submitLabel": "Submit" },
  "output": {
    "view": {
      "type": "form",
      "title": "User Profile",
      "submitLabel": "Submit",
      "fields": [
        { "name": "email", "type": "email", "label": "Email", "required": true },
        { "name": "age", "type": "number", "label": "Age" }
      ]
    }
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "form", "durationMs": 0 }
}
```

- `output.view.type: 'form'` — Principle 4.3 에 명시된 판별자.
- `fields`/`title`/`submitLabel` 은 "렌더링에 필요한 최소 선언" 을 view 아래에 복제. (config 의 echo 와 중복되지만 의도적 — `output.view` 로만 뷰 정보를 가져오면 된다는 계약을 만든다.)
- `meta.interactionType` 은 하위호환을 위해 유지하되 Principle 2 에 따라 **`meta.durationMs`** 추가.

### 3.2. Resumed (`status: "resumed"`)

**Before**

```json
{
  "config": { "title": "User Profile", "fields": [ /* … */ ] },
  "output": { "submittedData": { "email": "a@b.com", "age": 25 } },
  "status": "submitted",
  "meta": { "interactionType": "form" }
}
```

**After**

```json
{
  "config": { "title": "User Profile", "fields": [ /* … */ ] },
  "output": {
    "view": {
      "type": "form",
      "title": "User Profile",
      "submitLabel": "Submit",
      "fields": [ /* waiting 시점 스냅샷 그대로 */ ]
    },
    "interaction": {
      "type": "form_submitted",
      "data": { "email": "a@b.com", "age": 25 },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "status": "resumed",
  "meta": { "interactionType": "form", "durationMs": 12340 }
}
```

핵심 변경점:

- `output.view` 는 waiting 시점의 스냅샷을 **그대로** 보존 (immutable). 엔진이 resume 시 waiting 당시 structured output 의 `view` 를 그대로 옮긴다.
- `output.interaction.type: 'form_submitted'` 리터럴 고정. presentation 카테고리 전체 enum 은 `'form_submitted' | 'button_click' | 'button_continue'`.
- `output.interaction.data` 에 제출 필드 객체 그대로. `{ [fieldName]: value }` 형태는 기존 `submittedData` 와 동일.
- `output.interaction.receivedAt` — ISO 8601 문자열. carousel/table/chart/template 의 `clickedAt` 와 의미론 통일을 위해 **`receivedAt` 으로 명칭 통일** (또는 `submittedAt` 유지 검토 — 본 제안은 Principle 4.1 의 예시에 따라 `receivedAt` 사용).
- `status: 'resumed'` — `'submitted'` 제거.

### 3.3. 포트(port)

form 은 동적 포트 스펙이 없으므로 `port` 는 기본 `'out'` (또는 생략). 이 부분은 변경 없음.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["F"].output` (waiting 시 `null`) | `$node["F"].output.view` (waiting 시 객체) | **Yes** | `output === null` 체크로 분기하던 코드가 깨짐. |
| `$node["F"].output.submittedData` | `$node["F"].output.interaction.data` | **Yes (high impact)** | 모든 후속 노드에서 사용되는 가장 일반적 경로. |
| `$node["F"].output.submittedData.email` | `$node["F"].output.interaction.data.email` | **Yes** | 개별 필드 접근. |
| `$node["F"].output.submittedData.age` | `$node["F"].output.interaction.data.age` | **Yes** | 동상. |
| `$node["F"].status === "submitted"` | `$node["F"].status === "resumed"` | **Yes** | 흐름 제어 로직에 영향. |
| (없음) | `$node["F"].output.view.type` | No (추가) | presentation 카테고리 식별자. |
| (없음) | `$node["F"].output.view.fields` | No (추가) | waiting 시점 필드 스냅샷. |
| (없음) | `$node["F"].output.interaction.type` | No (추가) | 항상 `"form_submitted"`. |
| (없음) | `$node["F"].output.interaction.receivedAt` | No (추가) | 제출 시각. |
| `$node["F"].meta.interactionType` | 유지 | No | `'form'` 그대로. |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 (DB 저장된 expression) | **HIGH** | `submittedData` 경로를 쓰는 모든 워크플로우가 에러로 전환 — 일괄 migration script 필수. |
| 기존 실행 이력 (execution history) | **MEDIUM** | 과거 기록의 structured output 은 구 포맷 유지. UI 뷰어가 both-format 호환으로 읽어야 함. |
| 프런트엔드 폼 렌더러 | **LOW** | `config.fields` 를 읽던 경로를 `output.view.fields` 로 전환할 수도 있지만, 기존 `config.fields` 읽기 방식도 유지 가능 (Principle 7 echo). |
| Execution engine resume 경로 | **HIGH** | `waitForFormSubmission()` 가 덮어쓰는 structured output 을 신규 포맷으로 변경해야 함. |
| 테스트 | **HIGH** | form handler 유닛 테스트 + execution engine e2e 테스트 전량 수정. |

### 4.3. 마이그레이션 전략 (단계)

1. **P0 — Handler 변경**: `FormHandler.execute()` 가 waiting 시 `output.view` 를 반환하도록 수정 (`output: null` 폐기). `meta.durationMs: 0` 주입.
2. **P0 — Engine resume 경로**: `waitForFormSubmission()` 가 structured output 의 `output.view` 는 보존하고, 신규로 `output.interaction` 을 채우도록 변경. `status` 를 `'resumed'` 로 설정.
3. **P1 — Expression migration script**: DB 의 workflow definitions 를 스캔해 `\$node\[".*?"\]\.output\.submittedData` 정규식 매치를 `.output.interaction.data` 로 치환. 마이그레이션 전후 diff 를 사용자에게 보여주는 notice 배포.
4. **P1 — Status 리터럴 참조 검색**: DB 및 코드에서 `status === 'submitted'` 를 사용하는 곳을 전부 `status === 'resumed' && output.interaction?.type === 'form_submitted'` 로 전환.
5. **P2 — Execution history 호환 어댑터**: UI 뷰어/디버거는 과거 이력의 `output.submittedData` 가 존재하면 가상으로 `output.interaction.data` 에 매핑해 렌더 (읽기 전용).
6. **P2 — 문서 업데이트**: `frontend/docs/` 의 form 사용자 설명서, node-spec 문서, OpenAPI 등 모든 예제를 신규 포맷으로 교체.

---

## 5. 근거

### 5.1. Principle 4 전체 정합성

Principle 4.1 의 상태 전이 다이어그램은 **모든** 블로킹 노드가 동일한 전이를 따르도록 규정합니다:

```
waiting_for_input → (user input) → resumed
output: { view } → output: { view, interaction }
```

form 은 현재 이 전이를 3가지 축에서 모두 벗어납니다: ① waiting 시 view 없음, ② resumed 시 interaction 래퍼 없음, ③ status 리터럴이 `submitted`. 개선안은 이 3가지를 한 번의 breaking change 로 통일합니다.

### 5.2. Principle 4.2 명시 인용

> 현재 form의 `output.submittedData` → `output.interaction.data` 로 이동.

CONVENTIONS.md 4.2 의 "폐기할 필드" 목록에 form 의 `submittedData` 는 이미 명시되어 있으므로, 본 제안은 해당 조항의 구체화/확정일 뿐입니다.

### 5.3. Principle 4.3 에서의 view 계약

> `form.view`: `{ type: 'form', fields, title, submitLabel }`

Principle 4.3 의 예시와 정확히 일치하도록 개선안의 waiting view 구조를 맞췄습니다. 다른 4개 노드도 동일 규약을 따릅니다.

### 5.4. 왜 `view` 와 `config` 가 일부 중복되는가

`view` 는 "사용자에게 보여지는 최종 렌더링 선언" 이고, `config` 는 "워크플로우 작성자가 넣은 원본 설정" 입니다. form 에서는 대부분 1:1 이지만:

- dynamic field (향후 확장 — 예: 이전 노드 결과에 따라 fields 를 생성) 가 도입되면 `config.fields` 와 `view.fields` 가 다를 수 있음.
- view 스냅샷이 resumed 상태에서 보존되어야 하므로 별도 키가 필요 (`config` 는 노드 정의의 latest 값을 가리킬 수 있음).

따라서 최소한의 중복 비용으로 미래 확장성과 상태 불변성을 확보합니다.

### 5.5. 5개 노드 공통 구조 정렬

본 개선으로 form/carousel/table/chart/template 은 다음 공통 구조로 수렴합니다:

```
waiting:  { status: 'waiting_for_input', output: { view: { type, ...viewData } } }
resumed:  { status: 'resumed', output: { view, interaction: { type, data, receivedAt } } }
```

이 구조는 "노드 종류를 몰라도 `$node["X"].output.view.type` / `$node["X"].output.interaction.type` 으로 식별 가능" 이라는 설계 목표를 달성합니다.

### 5.6. `receivedAt` vs `clickedAt` 통일

carousel/table/chart/template 은 현재 `clickedAt` 을 사용합니다. Principle 4.1 예시는 `receivedAt` 을 씁니다. 본 제안은 form 에 **`receivedAt`** 을 도입하고, 동시에 4개 presentation 노드에서도 `clickedAt → receivedAt` 통일을 제안합니다 (각 노드 개선안에서 별도로 기술). carousel/table/chart/template 에서는 `data.clickedAt` 내부 필드로는 유지 가능 (의미 구체화: "버튼 클릭 순간").

---

## 6. 참조

- [CONVENTIONS.md — Principle 4](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/form/form.handler.ts`
- 엔진 resume: `backend/src/modules/execution-engine/execution-engine.service.ts` → `waitForFormSubmission()`
