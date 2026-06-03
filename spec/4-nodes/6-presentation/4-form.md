---
id: form
status: partial
pending_plans:
  - plan/in-progress/spec-sync-form-gaps.md
code:
  - codebase/backend/src/nodes/presentation/form/form.handler.ts
  - codebase/backend/src/nodes/presentation/form/form.schema.ts
  - codebase/backend/src/modules/execution-engine/execution-engine.service.ts
  - codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx
---

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
| required | Boolean? | | 폼 **사용자** 입력 강제 여부 (기본 `false`). `config.fields` 자체의 "1개 이상 정의" 필수성(§1·§6)과는 다른 layer — 전자는 폼 제출 검증, 후자는 노드 설정 패널의 asterisk(`config.fields.ui.required`). |
| options | Option[]? | | `select`/`radio`/`checkbox` 용 선택지 (`{ label, value }`). `value` 가 빈 문자열·`null`·`undefined` 인 경우는 LLM tool 모드 (`render_form`) 에 한해 backend 가 결정적 fallback `opt-{fieldIdx}-{optIdx}` (인덱스 단일 형식) 으로 backfill — [공통 §10.5 step 4](./0-common.md#105-schema-위반-처리-및-정규화) SoT. 사용자 직접 config 의 빈 value 는 frontend 입력 시점에 가드되므로 본 단계 영향권 밖. |
| defaultValue | Any? | | 기본값 (`{{ }}` 표현식 사용 가능) |
| validation | ValidationRule? | | 유효성 검증 규칙 |
| allowedMimeTypes | String[]? | | `type: 'file'` 전용. 허용 MIME 타입 목록 (계획상 기본은 아래 참조) |
| maxFileSize | Number? | | `type: 'file'` 전용. 단일 파일 최대 크기 (MB, 계획상 기본 10) |
| maxTotalSize | Number? | | `type: 'file'` 전용. 필드 내 전체 파일 합계 최대 크기 (MB, 계획상 기본 50) |
| maxFiles | Number? | | `type: 'file'` 전용. 필드당 최대 파일 수 (계획상 기본 5) |

> ⚠ 위 4개 file 옵션은 `formFieldSchema` (`form.schema.ts:71-74`) 에서 모두 `optional()` 로만 선언돼 있고 **zod default 가 없다** — 즉 미설정 시 아래 기본값(13종 MIME, 10MB/50MB/5)이 코드에서 자동 주입되지 않으며, frontend `DynamicFormUI` 도 `accept = (allowedMimeTypes ?? []).join(",")` / `multiple = maxFiles > 1` 만 사용한다. 기본값 적용·서버 강제는 **미구현 (Planned)** — `plan/in-progress/spec-sync-form-gaps.md` 추적.

**ValidationRule 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| minLength | Number? | 최소 길이 (`text`, `textarea`) |
| maxLength | Number? | 최대 길이 (`text`, `textarea`) |
| min | Number? | 최솟값 (`number`) |
| max | Number? | 최댓값 (`number`) |
| pattern | String? | 정규표현식 패턴 (custom) |
| preset | ValidationPreset? | **미구현 (Planned)** — 미리 정의된 검증 카탈로그. `pattern` 보다 우선 적용. 외부 어댑터 (Chat Channel 등) 가 UI hint 도출에 활용 |
| message | String? | 유효성 실패 시 에러 메시지 |

> ⚠ `preset` 은 현재 `validationRuleSchema` (`form.schema.ts:20-29`) 에 **존재하지 않는다** — `minLength`/`maxLength`/`min`/`max`/`pattern`/`message` 만 정의돼 있고 ValidationPreset 카탈로그·서버 regex·어댑터 UI hint 도출 코드가 모두 부재하다. 아래 카탈로그는 **계획(Planned)** 으로, 구현 추적은 `plan/in-progress/spec-sync-form-gaps.md` 참조.

**ValidationPreset 카탈로그 (미구현 / Planned):**

`pattern` 직접 작성 대신 self-documenting preset 으로 의도를 표현 — Form 노드 사용자가 정규식을 직접 적지 않아도 되고, 외부 어댑터 (예: [Telegram Chat Channel](../7-trigger/providers/telegram.md#53-form-cch-mp-03)) 가 preset 식별자로 UI hint (share_contact 키보드 등) 를 도출할 수 있다.

| preset | 적용 type | 의도 | 검증 regex (서버) | UI hint (어댑터) |
|---|---|---|---|---|
| `phone` | `text` | 전화번호 — 국제 포맷 허용 (`+`, 숫자, 공백, `-`, `()`) | `^\+?[\d\s\-()]+$` (1자 이상) | Telegram: `request_contact: true` (share_contact 버튼). 미지원 provider: 일반 text 입력 |

(계획상 v1 카탈로그 = 1종. URL / datetime 등 후속 preset 은 사용 사례 발생 시 추가.)

(Planned) `preset` 과 `pattern` 이 동시에 설정되면 `preset` 이 우선 적용된다. `message` 가 없으면 preset 별 default 메시지 사용 (`phone` → "전화번호 형식이 올바르지 않습니다.").

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

### 1.5 File 타입 UI 동작

`type: 'file'` 필드의 frontend 렌더와 제출 payload 형식 SoT.

**UI 렌더 (`DynamicFormUI.renderField` 의 file case)**:

- 입력 element: `<input type="file" accept={(allowedMimeTypes ?? []).join(",") || undefined} multiple={maxFiles > 1}>` (`dynamic-form-ui.tsx:185-202`)
  - `maxFiles` 가 1 이면 단일 파일 선택, >1 이면 multiple 모드.
  - `accept` 는 사용자 명시 `allowedMimeTypes` 값을 그대로 콤마 결합 (미설정 시 `accept` 미부여 — §1 의 기본 MIME 목록은 코드에서 주입되지 않음).
- **실시간 검증 (제출 전 클라이언트 가드) — 미구현 (Planned)**: 현재 `onChange` 는 `FileList` 를 그대로 `Array.from(...).map(toFileMetadata)` 로 변환해 fieldState 에 넣을 뿐, 아래 reject 로직이 전혀 없다 (`dynamic-form-ui.tsx:193-200`). 아래는 계획 사양:
  - (Planned) `allowedMimeTypes` 미일치 시 즉시 reject + `validation.message` (없으면 기본 메시지 "허용되지 않은 파일 형식입니다.").
  - (Planned) 단일 파일 크기 > `maxFileSize` (MB) 시 즉시 reject.
  - (Planned) 합계 크기 > `maxTotalSize` (MB) 시 즉시 reject.
  - (Planned) 선택 개수 > `maxFiles` 시 즉시 reject.
- (Planned) 검증 실패 시 selection 자체를 거부 (선택된 file 이 fieldState 에 들어가지 않음) — 제출 버튼 활성 상태 그대로 유지.

**제출 payload (metadata-only)**:

폼 제출 시 frontend 는 file 필드의 `FileList` 를 **metadata 객체 배열** 로 변환해 `execution.submit_form` body 의 `formData[<fieldName>]` 에 담는다.

```json
{
  "<fieldName>": [
    { "name": "report.pdf", "size": 524288, "type": "application/pdf", "lastModified": 1716470400000 },
    { "name": "image.png", "size": 102400, "type": "image/png", "lastModified": 1716470500000 }
  ]
}
```

각 metadata 객체 필드:

| 필드 | 출처 | 설명 |
|------|------|------|
| `name` | `File.name` | 파일명 (확장자 포함) |
| `size` | `File.size` | 바이트 단위 크기 |
| `type` | `File.type` | MIME 타입 — `allowedMimeTypes` 검증 통과 후 값 |
| `lastModified` | `File.lastModified` | UNIX epoch milliseconds |

> file **내용 자체 (binary)** 는 본 spec 시점에서 LLM 에 전달하지 않는다. multimodal 비지원 모델 호환 + §10.4 1MB cap 보호 + 별도 binary upload 채널이 정해질 때까지 보류 — [공통 §Rationale file 타입 metadata-only](./0-common.md#file-타입-metadata-only) SoT.

`maxFiles == 1` 인 경우도 frontend 는 **단일 metadata 객체** 가 아니라 **길이 1 의 배열** 로 직렬화한다 — backend / LLM 측 단일 진실 (`formData[fieldName]` 은 항상 배열) 유지. 빈 선택 시 `[]` (빈 배열). field 가 `required: true` 인데 빈 배열이면 §6.2 의 "필수 필드 미입력" 검증 실패 흐름.

**`output.interaction.data.<fieldName>` (resumed)**:

위 metadata 객체 배열이 그대로 보존되어 `output.interaction.data.<fieldName>` 에 들어간다 — [node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격) 의 `form_submitted` payload `value` 슬롯 free-form 안에 정합. AI Agent `render_form` 의 tool_result content (`{ok:true, type:'form_submitted', data:{…}, message:'<재호출 금지 안내문>'}`, [AI Agent §12.6](../3-ai/1-ai-agent.md#126-render_form-submit-후-llm-의-동일-form-재호출-회귀-차단)) 에도 동일하게 metadata 배열이 `data` 안에 직렬화되어 LLM 에 회신된다.

**폼 재제출 정책:**

| 상태 | 재제출 가능 여부 |
|------|-----------------|
| `waiting_for_input` | 가능 — 제출 전까지 폼을 반복 제출/수정할 수 있음 |
| `cancelled` (외부 cancel 후 전이) | 불가 — 새 실행을 시작해야 함 |

> Source of truth: `codebase/backend/src/nodes/presentation/form/form.schema.ts` (export `formNodeConfigSchema`)

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
