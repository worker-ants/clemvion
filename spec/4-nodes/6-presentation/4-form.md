# Spec: Form (Human-in-the-loop)

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [CONVENTIONS](../../conventions/node-output.md)

워크플로우 실행 중간에 사용자 입력을 받는 **Human-in-the-loop blocking 노드**. 실행을 일시 정지하고, 폼 UI 를 통해 사용자 입력을 수집한 뒤 실행을 재개한다. ButtonDef 를 사용하지 않으며 자체 `FormField` 구조를 갖는다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| fields | FormField[] | ✓ | `[]` | 폼 필드 정의 배열. 1개 이상이어야 한다 (§6 warningRule) |
| title | String | ✓ | `''` | 폼 제목 |
| description | String? | | — | 폼 설명 (Markdown 지원) |
| submitLabel | String | | `'Submit'` | 제출 버튼 텍스트 |

> 폼 submit 시까지 무제한 대기한다 (외부 cancel/종료 외에는 타임아웃이 발생하지 않음).

**FormField 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | String | ✓ | 필드 식별자 — 제출 데이터(`output.interaction.data`)의 키 |
| type | Enum | ✓ | `text` / `number` / `email` / `textarea` / `select` / `checkbox` / `radio` / `date` / `file` |
| label | String | ✓ | 필드 라벨 |
| required | Boolean? | | 필수 입력 여부 (기본 `false`) |
| options | Option[]? | | `select`/`radio`/`checkbox` 용 선택지 (`{ label, value }`) |
| defaultValue | Any? | | 기본값 (`{{ }}` 표현식 사용 가능) |
| validation | ValidationRule? | | 유효성 검증 규칙 |
| allowedMimeTypes | String[]? | | `type: 'file'` 전용. 허용 MIME 타입 목록 (기본은 아래 참조) |
| maxFileSize | Number? | | `type: 'file'` 전용. 단일 파일 최대 크기 (MB, 기본 10) |
| maxTotalSize | Number? | | `type: 'file'` 전용. 필드 내 전체 파일 합계 최대 크기 (MB, 기본 50) |
| maxFiles | Number? | | `type: 'file'` 전용. 필드당 최대 파일 수 (기본 5) |

**ValidationRule 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| minLength | Number? | 최소 길이 (`text`, `textarea`) |
| maxLength | Number? | 최대 길이 (`text`, `textarea`) |
| min | Number? | 최솟값 (`number`) |
| max | Number? | 최댓값 (`number`) |
| pattern | String? | 정규표현식 패턴 |
| message | String? | 유효성 실패 시 에러 메시지 |

**`type: 'file'` 의 `allowedMimeTypes` 기본값** (문서/이미지만 허용):

```json
[
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv"
]
```

> 실행 파일(`.exe`, `.sh`), 스크립트(`.js`, `.py`), 아카이브(`.zip`, `.tar.gz`) 는 기본 허용 목록에 포함되지 않는다. 필요 시 `allowedMimeTypes` 를 명시적으로 확장한다.

**폼 재제출 정책:**

| 상태 | 재제출 가능 여부 |
|------|-----------------|
| `waiting_for_input` | 가능 — 제출 전까지 폼을 반복 제출/수정할 수 있음 |
| `cancelled` (외부 cancel 후 전이) | 불가 — 새 실행을 시작해야 함 |

> Source of truth: `backend/src/nodes/presentation/form/form.schema.ts` (export `formNodeConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Form Settings                       │
│  ─────────────────────────────────── │
│  Title:       [Approval Request___]  │
│  Description: [Please review...___]  │
│  Submit Label:[Submit____________]   │
│                                      │
│  ─── Fields ──────────────────────── │
│  1. [select ▼]                       │
│     Name:  [approval__________]      │
│     Label: [승인 여부__________]     │
│     ☑ Required          [✕] [↕]      │
│  ─────────────────────────────────── │
│  2. [textarea ▼]                     │
│     Name:  [comment___________]      │
│     Label: [코멘트____________]      │
│     ☐ Required          [✕] [↕]      │
│  ─────────────────────────────────── │
│  [+ Add Field]                       │
│                                      │
│  ─── Form Preview ────────────────── │
│  ┌────────────────────────────────┐  │
│  │ Approval Request               │  │
│  │ Please review...               │  │
│  │ 승인 여부 *                    │  │
│  │ [________________]             │  │
│  │ 코멘트                         │  │
│  │ [________________]             │  │
│  │               [Submit]         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- 필드를 카드 형태로 표시. 드래그로 순서 변경 (`[↕]`), 삭제 (`[✕]`).
- 필드 `type` 변경 시 해당 타입 전용 옵션 표시 (select/radio → 선택지 편집기, file → MIME/크기 제한 편집기).
- 하단 Form Preview: 설정한 필드 구성으로 실제 폼 미리보기.

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (폼 기본값 `defaultValue` 의 `{{ }}` 표현식에 활용 가능) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | 사용자가 제출한 폼 데이터 (resumed 후) |

> Form 은 동적 포트가 없는 **단일 출력 blocking 노드**다. 비-블로킹 모드는 존재하지 않는다 (필드가 1개 이상 있어야 하므로 항상 폼 입력을 대기한다 — [공통 §8 색인](./0-common.md#8-출력-구조-색인) 참조).

## 4. 실행 로직

1. Form 노드에 도달하면 핸들러가 `output: {}` (빈 객체) + `status: 'waiting_for_input'` + `meta: { interactionType: 'form', durationMs: 0 }` 를 반환 → 엔진이 실행을 일시 정지 (§5.4).
2. WebSocket 이벤트 `execution.waiting_for_input` 발행 (`interactionType: 'form'`).
3. 클라이언트가 `config.title` / `config.description` / `config.fields` / `config.submitLabel` 를 직접 참조해 폼 UI 렌더링 (Principle 1.1 — `output` 에 echo 없음).
4. 사용자가 폼 제출 → `execution.submit_form` WebSocket 명령 송신.
5. 서버가 [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) Blocking Mode 흐름의 form 변형으로 유효성 검증 (필수 / type / validation / file MIME·size·count).
   - 검증 실패 → 에러 응답 → 폼 재표시 (`waiting_for_input` 유지, 재제출 가능).
   - 검증 성공 → 실행 엔진의 `waitForFormSubmission()` 가 structured output 을 §5.5 형태로 재조립 → `status: 'resumed'`, `port: 'out'`.
6. 후속 노드는 `$node["F"].output.interaction.data.<fieldName>` 으로 제출 값을 참조 (Principle 4.5).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Form 은 필드 정의가 필수인 blocking 노드이므로 §5.4 (waiting) / §5.5 (resumed) **두 페어 케이스만** 존재한다. 비-블로킹 단일 정상 케이스(`out` 포트 단독)는 form 에 해당하지 않으며, 별도 runtime 에러 케이스도 없다 (config 검증 실패는 §6 pre-flight throw, 폼 입력 검증 실패는 폼 재표시 — 양쪽 모두 새 출력을 생성하지 않음).

### 5.4 Case: Waiting (`status: 'waiting_for_input'`)

```json
{
  "config": {
    "title": "Approval Request",
    "submitLabel": "Submit",
    "description": "Please review the proposal and respond.",
    "fields": [
      { "name": "approval", "type": "select", "label": "승인 여부", "required": true,
        "options": [{ "label": "Approve", "value": "approved" }, { "label": "Reject", "value": "rejected" }] },
      { "name": "comment", "type": "textarea", "label": "코멘트" }
    ]
  },
  "output": {},
  "meta": { "interactionType": "form", "durationMs": 0 },
  "status": "waiting_for_input"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.title` | String | config echo (Principle 7) | 폼 제목 raw — 프런트가 직접 참조 |
| `config.description` | String? | config echo | Markdown 설명 raw |
| `config.submitLabel` | String | config echo | 제출 버튼 라벨 raw |
| `config.fields` | FormField[] | config echo | 필드 정의 raw — 표현식 `{{ }}` 가 `defaultValue` 등에 포함될 수 있음 |
| `output` | `{}` | handler return | **빈 객체** — waiting 시점에 런타임 계산 값이 없음 (Principle 1.1 / 4.3 / 공통 §4) |
| `meta.interactionType` | `'form'` | handler return | UI 가 폼 인터랙션임을 식별 (하위호환 유지 필드, [공통 §7](./0-common.md#7-5필드-공통-규약-presentation-카테고리) 표 참조) |
| `meta.durationMs` | number | handler return | 항상 `0` — waiting 핸들러는 즉시 완료 |
| `status` | `'waiting_for_input'` | handler return | 엔진이 실행 일시 정지 (Principle 4) |

> ⚠ **금지 필드** (Principle 1.1.4 / 4.2): `output.type: 'form'` 판별자, `output.view`, `output.submittedData`, `output.previousOutput`, `output.fields`/`output.title`/`output.submitLabel` 같은 config 리터럴 echo. 노드 타입은 워크플로우 정의에서 식별되며, 폼 정의는 모두 `config.*` 에서 읽는다.

**Expression 접근 예** (waiting 시점):
- `$node["F"].config.title` → `"Approval Request"`
- `$node["F"].config.fields` → 필드 정의 배열 (raw)
- `$node["F"].status` → `"waiting_for_input"`
- `$node["F"].output` → `{}` (빈 객체) — `output === null` 분기 금지, 필요 시 `status` 비교

### 5.5 Case: Resumed (`status: 'resumed'`)

```json
{
  "config": {
    "title": "Approval Request",
    "submitLabel": "Submit",
    "description": "Please review the proposal and respond.",
    "fields": [
      { "name": "approval", "type": "select", "label": "승인 여부", "required": true,
        "options": [{ "label": "Approve", "value": "approved" }, { "label": "Reject", "value": "rejected" }] },
      { "name": "comment", "type": "textarea", "label": "코멘트" }
    ]
  },
  "output": {
    "interaction": {
      "type": "form_submitted",
      "data": { "approval": "approved", "comment": "Looks good" },
      "receivedAt": "2026-03-29T10:30:00.000Z"
    }
  },
  "meta": { "interactionType": "form", "durationMs": 12340 },
  "port": "out",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.4 와 동일) | config echo | waiting 시점과 동일하게 유지 (immutable snapshot) |
| `output.interaction.type` | `'form_submitted'` | engine inject | 인터랙션 종류 — form 은 항상 `'form_submitted'` (Principle 4.5) |
| `output.interaction.data` | Record<fieldName, value> | engine inject | 사용자가 제출한 필드 값 맵. 키는 `config.fields[i].name`, 값은 검증 통과 후의 정규화된 입력 |
| `output.interaction.receivedAt` | String (ISO 8601) | engine inject | 제출 수신 시각 |
| `meta.interactionType` | `'form'` | engine | waiting 시점과 동일 |
| `meta.durationMs` | number | engine inject | waiting 시작 ~ resumed 까지의 경과 시간 (ms) |
| `port` | `'out'` | engine | 단일 출력 포트 |
| `status` | `'resumed'` | engine | 사용자 입력 수신 후 통일 상태 (Principle 4.1) |

> **금지 필드 / 이전 포맷 폐기**: `status: 'submitted'` (→ `'resumed'`), `output.submittedData` (→ `output.interaction.data`), `output.type: 'form'` (판별자 폐기), `output.view` (래퍼 폐기). [공통 §4](./0-common.md#4-출력-포맷-principle-11--43--45) / [Principle 4.2](../../conventions/node-output.md) 와 일치.

**Expression 접근 예** (resumed 시점):
- `$node["F"].output.interaction.data.approval` → `"approved"`
- `$node["F"].output.interaction.data.comment` → `"Looks good"`
- `$node["F"].output.interaction.type` → `"form_submitted"`
- `$node["F"].output.interaction.receivedAt` → `"2026-03-29T10:30:00.000Z"`
- `$node["F"].port` → `"out"`
- `$node["F"].status` → `"resumed"`

## 6. 에러 코드

Form 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 다음 두 단계 중 하나로 처리된다 (CONVENTIONS Principle 3.1):

**6.1 Pre-flight (config 검증, throw — 새 실행 자체가 실패):**

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `fields` 가 빈 배열 | `최소 1개 이상의 필드를 정의해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `fields` 가 배열이 아님 | `fields must be an array` | handler.validate (zod 우회 호출자 방어) |

**6.2 Form 입력 검증 실패 (재제출 가능, 새 출력 생성 없음):**

| 발생 조건 | 처리 |
|-----------|------|
| 필수 필드 미입력 | 클라이언트 에러 응답 → 폼 재표시 (`status` 유지) |
| `type` 별 형식 불일치 (예: `email` 형식 위반) | 동상 |
| `validation.minLength`/`maxLength`/`min`/`max`/`pattern` 위반 | 동상 (`validation.message` 가 있으면 그것을, 없으면 기본 메시지) |
| `type: 'file'` MIME / 크기 / 개수 초과 | 동상 |

> Form 입력 검증은 `output.error` 를 생성하지 않는다 — 사용자가 같은 폼을 재제출하면 §5.5 의 정상 출력만 발생한다 (Principle 3.1 의 "예상 가능한 비즈니스 실패" 와 별도, 재제출 루프이므로 새 NodeExecution 결과가 만들어지지 않음).

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Form` 행 인용. 포맷: `{N} fields · "{title}"` (예: `3 fields · "Approval"`).
