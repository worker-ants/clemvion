# Form (`form`)

> 사용자에게 입력 폼을 표시하고 제출을 기다리는 blocking 노드. 제출 후 입력 데이터가 output에 채워집니다.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: **yes** (`status: "waiting_for_input"`)
- **동적 포트**: no (form은 `dynamicPorts` 스펙이 없음 — 정적 `out` 포트만 사용)

## Config 파라메터

출처: `backend/src/nodes/presentation/form/form.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | `''` | 폼 제목 | yes |
| `description` | string | no | (없음) | 폼 설명 (textarea) | yes |
| `submitLabel` | string | no | `'Submit'` | 제출 버튼 라벨 | yes |
| `fields` | `FormField[]` | yes (1개 이상) | `[]` | 폼 필드 정의 목록. 비어있으면 validation 실패 | — |

`FormField`:

| 필드 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `name` | string | `''` | 필드 키 (제출 데이터 객체의 키) |
| `type` | `'text' \| 'number' \| 'email' \| 'textarea' \| 'select' \| 'checkbox' \| 'radio' \| 'date' \| 'file'` | `'text'` | 입력 타입 |
| `label` | string | `''` | UI 라벨 |
| `required` | boolean | — | 필수 여부 |
| `options` | `{ label: string, value?: unknown }[]` | — | select/radio용 선택지 (passthrough) |
| `defaultValue` | unknown | — | 기본값 |
| `validation` | `{ minLength?, maxLength?, min?, max?, pattern?, message? }` | — | 검증 규칙 (passthrough) |
| `allowedMimeTypes` | string[] | — | file용 허용 MIME 타입 |
| `maxFileSize` | number | — | file용 단일 파일 최대 바이트 |
| `maxTotalSize` | number | — | file용 전체 합계 최대 바이트 |
| `maxFiles` | number | — | file용 최대 개수 |

> Schema는 `.passthrough()` 이므로 스키마에 없는 추가 필드도 UI/핸들러에 전달됩니다.

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 직전 노드의 출력 (핸들러는 사용하지 않음) |
| Output | `out` | Output | data | 폼 제출 후 흐름 진행 |

Form 노드는 동적 포트 스펙이 없습니다. 버튼 필드도 존재하지 않습니다.

## Input

핸들러는 `input`을 무시합니다 (`form.handler.ts` → `execute(...[, config])`). 폼은 전적으로 `config.fields` 정의만으로 렌더링되며 실제 데이터는 사용자 제출로부터 옵니다.

## Output

### Case 1: 초기 실행 — 사용자 입력 대기

`FormHandler.execute()`의 반환값:

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

엔진은 이 반환을 감지하여 실행을 `WAITING_FOR_INPUT`으로 전환하고, 프론트엔드가 `config` 안의 폼 선언을 읽어 폼을 렌더링합니다.

### Case 2: 사용자 제출 후 (엔진이 structured output 덮어씀)

출처: `execution-engine.service.ts` → `waitForFormSubmission()`

```json
{
  "config": { "title": "...", "fields": [...] },
  "output": { "submittedData": { "email": "a@b.com", "age": 25 } },
  "status": "submitted",
  "meta": { "interactionType": "form" }
}
```

| 필드 | 설명 |
| --- | --- |
| `config` | 초기 실행 시의 config 그대로 유지 (`prevStructured?.config ?? node.config`) |
| `output.submittedData` | 사용자가 입력한 값 객체 (각 `field.name`을 키로 하는 레코드) |
| `status` | `"waiting_for_input"` → `"submitted"` |
| `meta` | 초기 `{ interactionType: 'form' }` 유지 (엔진이 prev meta를 보존) |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `User Form`이라고 가정.

### 제출 후 (후속 노드에서):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["User Form"].output.submittedData }}` | `{ email: "a@b.com", age: 25 }` | 제출 데이터 전체 |
| `{{ $node["User Form"].output.submittedData.email }}` | `"a@b.com"` | 특정 필드 값 |
| `{{ $node["User Form"].status }}` | `"submitted"` | 상태 |
| `{{ $node["User Form"].config.title }}` | `"User Profile"` | 폼 제목 |
| `{{ $node["User Form"].config.fields }}` | `[{name:"email",...}]` | 폼 필드 정의 |
| `{{ $node["User Form"].meta.interactionType }}` | `"form"` | UI 렌더러 마커 |

### 대기 중 (같은 실행 안에서 다른 분기로부터 참조되는 일은 일반적이지 않음):

| 표현식 | 값 | 설명 |
| --- | --- | --- |
| `{{ $node["User Form"].status }}` | `"waiting_for_input"` | 대기 상태 |
| `{{ $node["User Form"].output }}` | `null` | 아직 제출 전 |

## 주의사항

- `fields`가 비어있거나 배열이 아니면 validation 실패 (`'fields is required and must be a non-empty array'`).
- **Blocking 노드**: Loop/ForEach/Map/Background/Parallel 등 컨테이너 본문 안에 둘 수 없습니다 (엔진이 waiting_for_input을 허용하지 않는 컨텍스트에서 에러).
- 제출 데이터는 항상 `output.submittedData` 아래에 네스팅됩니다. 직접 `output.email`이 아님에 주의.
- Form 노드에는 **버튼 기능이 없습니다** (다른 presentation 노드와 달리 `buttons` 필드 없음). 제출은 단일 submit 버튼만 존재.
- `validation` 규칙, `file` 타입 업로드 한도 등은 schema에 정의되어 있으며 실제 적용은 프론트엔드 폼 컴포넌트가 담당합니다.
- `options`는 `select`/`radio` 타입에서만 의미 있음.
- 같은 워크플로우에 여러 form을 배치할 수 있고 각각 독립적으로 사용자 입력을 받습니다 (라벨이 동일하면 `#2`, `#3` disambiguation 자동 적용).
