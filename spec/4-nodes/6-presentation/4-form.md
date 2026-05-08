# Spec: Form (Human-in-the-loop)

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

워크플로우 실행 중간에 사용자 입력을 받는 Human-in-the-loop 노드. 실행을 일시 정지하고, 폼 UI를 통해 사용자 입력을 수집한 뒤 실행을 재개한다. ButtonDef 를 사용하지 않으며 `FormField` 자체 구조를 갖는다.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| fields | FormField[] | ✓ | [] | 폼 필드 정의 배열 |
| title | String | ✓ | — | 폼 제목 |
| description | String? | ✗ | — | 폼 설명 (Markdown 지원) |
| submitLabel | String | ✗ | "Submit" | 제출 버튼 텍스트 |

> 폼 submit 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)

**파일 업로드 설정 (FormField.type = `file` 인 경우):**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| allowedMimeTypes | String[] | ✗ | 아래 참조 | 허용 MIME 타입 목록 |
| maxFileSize | Number | ✗ | 10 | 단일 파일 최대 크기 (MB) |
| maxTotalSize | Number | ✗ | 50 | 필드 내 전체 파일 합계 최대 크기 (MB) |
| maxFiles | Number | ✗ | 5 | 필드당 최대 파일 수 |

**allowedMimeTypes 기본값 (문서/이미지만 허용):**

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

> 실행 파일(.exe, .sh 등), 스크립트(.js, .py 등), 아카이브(.zip, .tar.gz 등)는 기본 허용 목록에 포함되지 않는다. 필요 시 `allowedMimeTypes`를 명시적으로 확장한다.

**폼 재제출:**

| 상태 | 재제출 가능 여부 |
|------|-----------------|
| `waiting_for_input` | 가능 — 제출 전까지 폼을 반복 제출/수정할 수 있음 |
| `cancelled` (외부 cancel 후 전이) | 불가 — 실행이 종료되었으므로 새 실행을 시작해야 함 |

**FormField 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | String | ✓ | 필드 식별자 (출력 데이터의 키) |
| type | Enum | ✓ | `text` / `number` / `email` / `textarea` / `select` / `checkbox` / `radio` / `date` / `file` |
| label | String | ✓ | 필드 라벨 |
| required | Boolean? | ✗ | 필수 입력 여부 (기본: false) |
| options | Option[]? | ✗ | select/radio/checkbox용 선택지 (`{ label, value }`) |
| defaultValue | Any? | ✗ | 기본값 |
| validation | ValidationRule? | ✗ | 유효성 검증 규칙 |

**ValidationRule 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| minLength | Number? | 최소 길이 (text, textarea) |
| maxLength | Number? | 최대 길이 (text, textarea) |
| min | Number? | 최솟값 (number) |
| max | Number? | 최댓값 (number) |
| pattern | String? | 정규표현식 패턴 |
| message | String? | 유효성 실패 시 에러 메시지 |

## 2. 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 (폼 기본값 등에 활용 가능) |
| Output | 출력 | `out` | 사용자가 제출한 폼 데이터 |

## 3. 실행 로직

1. Form 노드에 도달하면 실행 일시 정지
   - `NodeExecution.status` = `waiting_for_input`
   - `Execution.status` = `waiting_for_input`
2. 폼 URL 생성 및 WebSocket 이벤트 발행 (`execution.waiting_for_input`)
3. 클라이언트에서 폼 UI 렌더링 (제목, 설명, 필드 목록)
4. 사용자가 폼을 제출하면:
   - 클라이언트 → 서버: `execution.submit_form` 이벤트
   - 서버에서 유효성 검증 수행
   - 검증 실패 시 에러 응답 → 폼 재표시
   - 검증 성공 시 실행 재개
5. 제출된 데이터를 출력 포트로 전달

> 폼 submit 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)

## 4. 출력 형식

[공통 §4 출력 포맷](./0-common.md#4-출력-포맷-principle-11--43--45) 참조.

Waiting 상태 — `output` 은 **빈 객체**. title/fields/submitLabel 등 리터럴 config 값은 `output` 에 echo 하지 않으며, 후속 노드와 프런트 렌더러는 `$node["F"].config.*` 를 직접 참조한다.

```json
{
  "config": {
    "title": "Approval Request",
    "submitLabel": "Submit",
    "fields": [
      { "name": "approval", "type": "select", "label": "승인 여부", "required": true },
      { "name": "comment", "type": "textarea", "label": "코멘트" }
    ]
  },
  "output": {},
  "status": "waiting_for_input",
  "meta": { "interactionType": "form", "durationMs": 0 }
}
```

Resumed 상태 — 제출 데이터는 `output.interaction.{type, data, receivedAt}` 에 담긴다.

```json
{
  "config": { "title": "Approval Request", "submitLabel": "Submit", "fields": [/* … */] },
  "output": {
    "interaction": {
      "type": "form_submitted",
      "data": { "approval": "approved", "comment": "Looks good" },
      "receivedAt": "2026-03-29T10:30:00Z"
    }
  },
  "status": "resumed",
  "port": "out",
  "meta": { "interactionType": "form", "durationMs": 12340 }
}
```

> 이전 초안의 `output.type: 'form'`, `output.submittedData` 필드는 **폐기**. Principle 1.1.4 (판별자 금지) 와 §4.5 (interaction payload) 를 따른다.

## 5. 실행 엔진 연동

Form 노드는 기존 브레이크포인트 메커니즘과 유사하게 실행을 일시 정지한다. 차이점은 다음과 같다:

| 항목 | 브레이크포인트 | Form 노드 |
|------|---------------|-----------|
| 트리거 | 개발자 설정 | 노드 자체의 동작 |
| 상태 | `Execution.status` 변경 없음 (디버그 용도) | `Execution.status` = `waiting_for_input` |
| 재개 조건 | Continue/Step Over 버튼 | 폼 제출 |
| 데이터 주입 | 없음 | 폼 데이터가 노드 출력으로 전달 |
| 프로덕션 | 브레이크포인트 무시 | 정상 동작 |

> **실행 엔진 상태 머신 변경**: [Spec 실행 엔진](../../5-system/4-execution-engine.md) 참조. `waiting_for_input` 상태가 Execution 및 NodeExecution 상태 머신에 추가된다.

## 6. 설정 UI

```
┌──────────────────────────────┐
│  Form Settings                       │
│  ────────────────────────────── │
│  Title:       [Approval Request__]   │
│  Description: [Please review...__]   │
│  Submit Label:[Submit__]             │
│                                      │
│  ─── Fields ────────────────────── │
│  1. [text ▼]                         │
│     Name:  [approval_____]           │
│     Label: [승인 여부_____]          │
│     ☑ Required          [✕] [↕]     │
│  ────────────────────────────── │
│  2. [textarea ▼]                     │
│     Name:  [comment______]           │
│     Label: [코멘트_______]           │
│     ☐ Required          [✕] [↕]     │
│  ────────────────────────────── │
│  [+ Add Field]                       │
│                                      │
│  ─── Form Preview ─────────────── │
│  ┌────────────────────────────────┐  │
│  │ Approval Request               │  │
│  │ Please review...               │  │
│  │                                │  │
│  │ 승인 여부 *                    │  │
│  │ [________________]             │  │
│  │                                │  │
│  │ 코멘트                         │  │
│  │ [________________]             │  │
│  │               [Submit]         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────┘
```

- 필드를 카드 형태로 표시, 드래그로 순서 변경 (`[↕]`), 삭제 (`[✕]`)
- 필드 type 변경 시 해당 타입 전용 옵션 표시 (select/radio → 선택지 편집기)
- 하단 Form Preview: 설정한 필드 구성으로 실제 폼 미리보기
