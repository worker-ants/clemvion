# Form (`form`) — Output 일관성 개선안 (재작성)

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/form.md](../../node-specs/presentation/form.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 1.1 (`config` ↔ `output` 직교성)** — 최우선, **Principle 4 (블로킹/재개 컨트랙트 통일)**, Principle 0, Principle 2

> **요약**: form 은 "사용자 입력 폼 정의 → 제출 수신 → 다음 노드로 전달" 의 전형적 블로킹 노드입니다. 이전 초안은 `output.view.{title, submitLabel, fields}` 로 리터럴 config 값을 **echo** 했는데, 이는 **Principle 1.1 위반**입니다. 재작성된 본 안은 `view` 래퍼와 타입 판별자를 **모두 폐기**하고, waiting 에서는 `output: {}` (빈 객체), resumed 에서는 `output: { interaction }` 만 반환합니다. 렌더링에 필요한 title/fields/submitLabel 은 프런트와 후속 노드가 `config.*` 에서 직접 참조합니다.

---

## 1. 현재 Output 구조 요약

Form 은 입력 폼을 띄우고 제출을 기다리는 blocking 노드입니다. Handler 는 `input` 을 읽지 않고 `config.fields` 정의만으로 폼을 선언합니다. 제출이 들어오면 엔진이 structured output 을 덮어씁니다.

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

### Case B — 제출 후 (resumed, 현 구현)

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

- Waiting 시 `output: null` — 렌더 정보는 `config.fields`/`config.title` 에서 프런트가 직접 읽음.
- Resumed 시 제출 데이터는 `output.submittedData` 라는 form 전용 네이밍.
- `status` 리터럴은 `'submitted'` (노드 고유).
- `meta.interactionType: 'form'` — 런타임 메트릭이 아니라 분류 정보. Principle 2 위반 소지.

---

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Resumed 시 `output.submittedData` | **Principle 4.2** | CONVENTIONS 에 이미 "→ `output.interaction.data` 로 이동" 명시. 나머지 4개 presentation 노드는 이미 `output.interaction` 사용. |
| 2 | `status: 'submitted'` | **Principle 4.1 / 축 9** | 사용자 입력 수신 후 상태는 `resumed` 로 통일. 상호작용 타입은 `output.interaction.type = 'form_submitted'` 로 표현. |
| 3 | Waiting 시 `output: null` | Principle 11 (문서화 일관성) | 일관된 객체 반환이 바람직. 빈 객체 `{}` 로 정규화. |
| 4 | `meta.interactionType` 의 위치 | **Principle 2** | 실행 메트릭(`durationMs`) 외의 분류 정보를 `meta` 에 두는 패턴은 Principle 2 엄밀 해석 시 이탈. 하위호환을 위해 유지하되 `meta.durationMs` 를 추가해 의미를 보강. |

> **과거 초안 대비 차이**: 이전 초안은 `output.view.{title, submitLabel, fields}` 로 config 리터럴을 복제했습니다. **재작성 안에서는 이 전체를 폐기**합니다. Principle 1.1: "사용자가 UI 로 설정한 리터럴 값은 `config` 에만 존재한다".

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
  "config": {
    "title": "User Profile",
    "submitLabel": "Submit",
    "fields": [
      { "name": "email", "type": "email", "label": "Email", "required": true },
      { "name": "age", "type": "number", "label": "Age" }
    ]
  },
  "output": {},
  "status": "waiting_for_input",
  "meta": { "interactionType": "form", "durationMs": 0 }
}
```

핵심:

- `output` 은 **빈 객체**. form 은 waiting 시점에 "런타임에 계산된 값" 이 **존재하지 않습니다**. 폼 렌더 정보(title/fields/submitLabel) 는 전부 리터럴 config 이므로 `config.*` 에서 읽습니다 (Principle 1.1).
- `output.view` 래퍼 없음 (Principle 1.1.4 에 의해 폐기).
- `output.view.type` / `output.type` 판별자 없음 — 노드 타입은 워크플로우 정의에서 이미 식별됨 (Principle 1.1.4).
- 프런트 렌더러는 `$node["F"].config.fields` / `.title` / `.submitLabel` 로 직접 접근.
- `meta.durationMs: 0` — waiting 시점의 handler 실행은 즉시 완료.

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
  "config": {
    "title": "User Profile",
    "submitLabel": "Submit",
    "fields": [
      { "name": "email", "type": "email", "label": "Email", "required": true },
      { "name": "age", "type": "number", "label": "Age" }
    ]
  },
  "output": {
    "interaction": {
      "type": "form_submitted",
      "data": { "email": "a@b.com", "age": 25 },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "status": "resumed",
  "port": "out",
  "meta": { "interactionType": "form", "durationMs": 12340 }
}
```

핵심 변경점:

- `output.interaction.type: 'form_submitted'` — presentation enum `'form_submitted' | 'button_click' | 'button_continue' | 'message_received'` 중 하나 (CONVENTIONS 4.5).
- `output.interaction.data` — 제출 필드를 `{ [fieldName]: value }` 형태로 담은 **런타임 사용자 입력**. 기존 `submittedData` 와 내용은 동일.
- `output.interaction.receivedAt` — ISO 8601 문자열 (CONVENTIONS 4.4).
- `status: 'resumed'` — `'submitted'` 제거 (Principle 4.1 / 축 9).
- `config` 는 waiting 시점과 동일하게 유지 (handler 가 재진입 시 동일 config 를 echo).
- 과거 초안의 `output.view` 는 **없음**. 제출된 필드 구조가 무엇이었는지는 `config.fields` 로 조회 가능하므로 별도 스냅샷 불필요.

### 3.3. 포트(port)

form 은 동적 포트 스펙이 없으므로 `port: 'out'` (또는 생략). 변경 없음.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["F"].output` (waiting 시 `null`) | `$node["F"].output` (waiting 시 `{}`) | **Yes** | `output === null` 체크로 분기하던 코드가 깨짐. `Object.keys(output).length === 0` 로 전환 권장, 혹은 `status === 'waiting_for_input'` 로 판별. |
| `$node["F"].output.submittedData` | `$node["F"].output.interaction.data` | **Yes (high impact)** | 가장 광범위하게 쓰이는 경로. |
| `$node["F"].output.submittedData.email` | `$node["F"].output.interaction.data.email` | **Yes** | 개별 필드 접근. |
| `$node["F"].output.submittedData.age` | `$node["F"].output.interaction.data.age` | **Yes** | 동상. |
| `$node["F"].status === "submitted"` | `$node["F"].status === "resumed"` | **Yes** | 흐름 제어 조건. |
| (없음) | `$node["F"].output.interaction.type` | No (추가) | 항상 `"form_submitted"`. |
| (없음) | `$node["F"].output.interaction.receivedAt` | No (추가) | 제출 시각 ISO 8601. |
| `$node["F"].config.title` | 유지 | No | config 는 그대로. 프런트/후속 노드는 여기서 직접 참조. |
| `$node["F"].config.fields` | 유지 | No | 동상. |
| `$node["F"].config.submitLabel` | 유지 | No | 동상. |
| `$node["F"].meta.interactionType` | 유지 | No | `'form'` 그대로. |
| (없음) | `$node["F"].meta.durationMs` | No (추가) | Principle 2. |

> **이전 초안 대비 차이**: 이전에는 `$node["F"].output.view.title` / `.output.view.fields` 등을 추가 접근 경로로 제시했으나, 재작성 안에서는 **추가하지 않습니다**. 소비자는 `config.*` 를 직접 참조합니다.

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression | **HIGH** | `submittedData` 경로를 쓰는 모든 워크플로우가 깨짐 — 일괄 migration script 필수. |
| 기존 실행 이력 (execution history) | **MEDIUM** | 과거 structured output 은 구 포맷 그대로. UI 뷰어가 both-format 호환. |
| 프런트엔드 폼 렌더러 | **NONE** | 이미 `config.fields`/`config.title` 참조. view echo 가 없어진 것은 오히려 간단해짐. |
| Execution engine resume 경로 | **HIGH** | `waitForFormSubmission()` 의 structured output 재조립 로직 수정. |
| 테스트 | **HIGH** | form handler unit + execution engine e2e 전수 갱신. |

### 4.3. 마이그레이션 전략 (단계)

1. **P0 — Handler 변경**: `FormHandler.execute()` 가 waiting 시 `output: {}` 를 반환하도록 수정 (`output: null` 폐기). `meta.durationMs: 0` 주입. `config` echo 는 기존 로직 유지.
2. **P0 — Engine resume 경로**: `waitForFormSubmission()` 가 structured output 의 `output.interaction` 을 채우고 `status: 'resumed'` 를 세팅. `submittedData` 제거.
3. **P1 — Expression migration script**: DB 의 workflow definitions 를 스캔해 아래 정규식 치환.
   - `\.output\.submittedData\b` → `.output.interaction.data`
   - `\.status\s*===\s*['"]submitted['"]` → `.status === 'resumed' && $&.output.interaction?.type === 'form_submitted'` (자동 변환 가능)
4. **P1 — Status 리터럴 검색**: 코드/DB 에서 `'submitted'` 문자열 리터럴을 검색해 전량 확인.
5. **P2 — 과거 이력 호환 어댑터**: UI 뷰어/디버거가 `output.submittedData` 존재 시 가상으로 `output.interaction.data` 로 매핑 렌더 (읽기 전용).
6. **P2 — 문서 업데이트**: `frontend/docs/` 의 form 설명서, node-spec, OpenAPI 예제 전부 신규 포맷으로 교체.

---

## 5. 근거

### 5.1. Principle 1.1 — config echo 금지의 핵심

Principle 1.1.1 표의 원문:

> 사용자가 UI/schema 로 설정한 리터럴 값 (title, submitLabel, layout, chartType, format, columns 정의, **fields 정의**, …) → `config` **만**.

따라서 form 의 `fields` / `title` / `submitLabel` 은 **절대** `output` 에 복사하지 않습니다. 이전 초안의 `output.view.fields` 는 명백한 위반이었습니다.

### 5.2. Principle 1.1.2 — 식별 기준 적용

> "이 값을 알기 위해 노드를 실제 실행해야 하는가?"

- `config.fields` 의 name/type/label — schema 만 봐도 알 수 있음 → `config` 만.
- 사용자가 실제로 입력한 값 (`interaction.data.email`) — 실행 후에만 알 수 있음 → `output`.

두 축이 명확히 갈립니다. waiting 시점에는 "런타임에 계산된 값" 이 존재하지 않으므로 `output: {}`.

### 5.3. Principle 1.1.4 — `view` 래퍼 / `type` 판별자 폐기

> 초안의 `output.view` 래퍼 / `output.view.type` 판별자는 폐기. 노드 타입은 워크플로우 정의에서 이미 파악됨.

form 은 특히 "렌더링에 필요한 런타임 값이 전혀 없는" 순수 config-driven 노드이므로 view 래퍼 자체가 무용합니다.

### 5.4. Principle 4.3 — form 의 waiting output 공식 정의

> | `form` | `{}` (빈 객체) | 폼 렌더링에 계산할 값 없음. fields/title/submitLabel 등은 모두 `config` 참조. |

CONVENTIONS 4.3 표에 form 의 waiting output 이 `{}` 로 명시되어 있습니다. 본 제안은 이 조항의 구체화입니다.

### 5.5. Principle 4.2 명시 인용

> 현재 form의 `output.submittedData` → `output.interaction.data` 로 이동.

CONVENTIONS 4.2 의 "폐기할 필드" 목록에 form 의 `submittedData` 가 명시되어 있으므로, 본 제안은 해당 조항의 확정안입니다.

### 5.6. Principle 4.5 — interaction payload 규격

| `interaction.type` | `data` shape | 적용 노드 |
| --- | --- | --- |
| `form_submitted` | `{ [fieldName]: value }` | `form` |

form 의 제출 데이터는 `{ email: "a@b.com", age: 25 }` 형태로 플랫한 필드 맵입니다 (기존 `submittedData` 와 동일). 이 맵이 그대로 `interaction.data` 에 들어갑니다.

### 5.7. 5개 presentation 노드 공통 컨트랙트 수렴

본 개선으로 form/carousel/table/chart/template 은 다음 공통 구조에 수렴합니다:

```
waiting  : { status: 'waiting_for_input', output: <runtime-only fields or {}> }
resumed  : { status: 'resumed', output: { ...runtime fields, interaction: { type, data, receivedAt } } }
```

공통 원칙:

- **config 리터럴은 `output` 에 echo 금지** (Principle 1.1).
- **노드 타입 판별자는 `output` 에 포함되지 않음** (Principle 1.1.4).
- **상호작용은 `output.interaction.{type, data, receivedAt}`** 로 표현 (Principle 4.4, 4.5).
- **status** ∈ `{undefined, 'waiting_for_input', 'resumed'}` — 그 외 값 금지.

form 의 경우 waiting 시점에 runtime 필드가 없으므로 `output: {}` 이며, 이는 5개 노드 중 가장 "가벼운" 출력입니다.

---

## 6. 참조

- [CONVENTIONS.md — Principle 1.1, Principle 4](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 7.5 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/form/form.handler.ts`
- 엔진 resume: `backend/src/modules/execution-engine/execution-engine.service.ts` → `waitForFormSubmission()`
