# Form (`form`)

> 사용자에게 입력 폼을 표시하고 제출을 기다리는 blocking 노드. 제출 후 입력 데이터가 output에 채워집니다.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: **yes** (`status: "waiting_for_input"`)
- **동적 포트**: no (단, presentation-buttons 동적 포트 spec이 적용되어 있다면 다를 수 있음 — 현재 form 메타데이터에는 `dynamicPorts` 미설정)

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | `''` | 폼 제목 | no |
| `description` | string | no | (없음) | 폼 설명 | no |
| `submitLabel` | string | no | `'Submit'` | 제출 버튼 라벨 | no |
| `fields` | `FormField[]` | yes (1개 이상) | `[]` | 폼 필드 정의 목록 | no |

`FormField`:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `name` | string | 필드 키 (제출 데이터의 키 이름) |
| `type` | `'text' \| 'number' \| 'email' \| 'textarea' \| 'select' \| 'checkbox' \| 'radio' \| 'date' \| 'file'` | 입력 타입 |
| `label` | string | UI 라벨 |
| `required` | boolean | 필수 여부 |
| `options` | `{ label, value }[]` | (select/radio용) 선택지 |
| `defaultValue` | unknown | 기본값 |
| `validation` | `{ minLength?, maxLength?, min?, max?, pattern?, message? }` | 검증 규칙 |
| `allowedMimeTypes` | string[] | (file용) 허용 MIME 타입 |
| `maxFileSize` | number | (file용) 파일 1개 최대 크기 (bytes) |
| `maxTotalSize` | number | (file용) 전체 합계 최대 |
| `maxFiles` | number | (file용) 최대 개수 |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 입력 (현재 사용 안 함) |
| Output | `out` | Output | 폼 제출 후 흐름 진행 |

## Input

핸들러는 input을 사용하지 않습니다. 폼은 사용자 입력을 기다립니다.

## Output

### Case 1: 초기 실행 — 사용자 입력 대기 (`waiting_for_input`)

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

엔진은 `status: "waiting_for_input"`을 보고 워크플로우 실행을 일시 중지합니다.

### Case 2: 사용자 제출 후 (엔진이 output 갱신)

엔진의 `waitForFormSubmission()`이 사용자 제출을 받으면 structured output을 다음 모양으로 **덮어씁니다**:

```json
{
  "config": { "title": "...", "fields": [...] },
  "output": { "submittedData": { "email": "a@b.com", "age": 25 } },
  "status": "submitted"
}
```

| 필드 | 설명 |
| --- | --- |
| `config` | 폼 설정 그대로 |
| `output` (대기 중) | `null` |
| `output.submittedData` (제출 후) | 사용자가 입력한 값 객체 (각 필드명을 키로) |
| `status` | `"waiting_for_input"` → `"submitted"` |
| `meta.interactionType` | `"form"` (UI 렌더러용 마커) |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `User Form`이라고 가정.

### 제출 후 (후속 노드에서):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["User Form"].output.submittedData }}` | `{ email: "a@b.com", age: 25 }` | 제출된 데이터 객체 전체 |
| `{{ $node["User Form"].output.submittedData.email }}` | `"a@b.com"` | 특정 필드 값 |
| `{{ $node["User Form"].status }}` | `"submitted"` | 상태 |
| `{{ $node["User Form"].config.fields }}` | `[{name:"email",...}]` | 폼 필드 정의 |

### 대기 중 (다른 워크플로우 분기에서 참조 — 일반적이지 않음):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["User Form"].status }}` | `"waiting_for_input"` | 대기 상태 |
| `{{ $node["User Form"].output }}` | `null` | 아직 제출 전 |
| `{{ $node["User Form"].meta.interactionType }}` | `"form"` | UI 렌더러 마커 |

## 주의사항

- `fields` 배열이 비어있으면 validation 실패. 최소 1개 필드 필수.
- Form은 **blocking 노드** — Loop/ForEach/Map/Background 등 컨테이너 본문 안에 두면 안 됩니다 (엔진이 거부).
- 제출 데이터는 **`output.submittedData`** 안에 nested됩니다 — 직접 `output.<field>`가 아님에 주의.
- `validation` 규칙은 schema에 정의되어 있으나 실제 검증은 프론트엔드 폼 컴포넌트가 수행 (서버 측 재검증은 별도).
- `file` 타입 필드는 별도의 파일 업로드 처리 흐름이 필요 (submittedData에 파일 ref 또는 base64).
- `options`는 select/radio에서만 의미 있음.
- 여러 form을 워크플로우 안에 둘 수 있고, 각각 개별로 사용자 입력을 받습니다.
