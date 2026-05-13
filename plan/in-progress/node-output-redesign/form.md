# Form output 개선안

> 대상 spec: `spec/4-nodes/6-presentation/4-form.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/6-presentation/4-form.md:148-164` — §5.4 Waiting (`status: 'waiting_for_input'`):

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

`spec/4-nodes/6-presentation/4-form.md:188-211` — §5.5 Resumed (`status: 'resumed'`):

```json
{
  "config": {...},
  "output": {
    "interaction": {
      "type": "form_submitted",
      "data": { "approval": "approved", "comment": "Looks good" },
      "receivedAt": "2026-03-29T10:30:00.000Z"
    }
  },
  "meta": { "interactionType": "form", "durationMs": 12340 },
  "port": "out", "status": "resumed"
}
```

## 진단

Form 은 **블로킹 노드** — 두 단계 (waiting → resumed) 가 명확. 사용자가 정의한 "단계마다 채워지는 field" 정의의 정확한 예시.

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| Waiting (a 단계 — 사용자 표시 전) | `output: {}` (빈 객체) | 적절 — Principle 1.1 / 4.3. 폼 정의는 모두 `config.*` 에 있고 런타임 계산 값 없음. spec 명시: 금지 필드 (`output.fields`/`output.title`/`output.submitLabel` echo, `output.view` 래퍼, `output.type: 'form'` 판별자) |
| Resumed (b 단계 — 사용자 인터렉션 후) | `output: { interaction: { type, data, receivedAt } }` | 적절 — Principle 4.4 / 4.5. `interaction.data` 가 사용자가 제출한 폼 값 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output: {}` (waiting) | 적절 | 빈 객체로 명시 — `output === null` 분기 금지 (status 비교 사용) |
| `output.interaction.type: 'form_submitted'` (resumed) | 적절 | Principle 4.5 — form 은 항상 form_submitted |
| `output.interaction.data: Record<fieldName, value>` | 적절 | 사용자 제출 값 — 검증 통과 후 정규화된 입력 |
| `output.interaction.receivedAt: ISO8601` | 적절 | Principle 4.4 |
| `meta.interactionType: 'form'` | 적절 (meta) | UI 가 폼 인터랙션임을 식별 (하위호환 유지 필드) |
| `meta.durationMs` (waiting=0, resumed=elapsed) | 적절 | engine 공통 |
| `config.{title, description, submitLabel, fields}` (raw echo) | 적절 | Principle 7. 클라이언트가 직접 참조해 폼 UI 렌더 |
| `port: 'out'` (resumed 시) | 적절 | Principle 5 단일 출력 |
| `status: 'waiting_for_input' / 'resumed'` | 적절 | Principle 4.1 |

부적절 항목 없음. **Form 은 conventions 의 핵심 사례** — spec 이 가장 명확하게 정합.

추가 점검:

1. **금지 필드 명시** — spec §5.4 footnote 가 Principle 1.1.4 / 4.2 의 폐기 대상을 명시:
   - `output.type: 'form'` 판별자 (노드 타입은 워크플로우 정의에서 식별)
   - `output.view` 래퍼
   - `output.submittedData` (→ `output.interaction.data`)
   - `output.previousOutput`
   - `output.fields`/`output.title`/`output.submitLabel` (config 리터럴 echo)

2. **`meta.interactionType: 'form'` 의 위치** — 노드 타입 판별자 (Principle 1.1.4) 는 폐기되었지만, 이 필드는 "interaction 종류" 라벨 (form / buttons / ai_conversation) 로 노드 타입과 다름. UI 가 어떤 인터랙션 컴포넌트를 그릴지 결정. 합리적.

3. **재제출 정책** (spec §1 표): waiting 상태에서는 재제출 가능, cancelled 후는 새 실행. 재제출 시 새 `output` 생성 안 함 (재시도 루프).

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// Waiting (단계 a — 사용자 표시 전)
{
  "config": {
    "title": <string raw>, "description": <string raw>?, "submitLabel": <string raw>,
    "fields": [<FormField raw>, ...]
  },
  "output": {},                                // 빈 객체 — 런타임 계산 값 없음
  "meta": { "interactionType": "form", "durationMs": 0 },
  "status": "waiting_for_input"
}

// Resumed (단계 b — 사용자 인터렉션 후)
{
  "config": {...},                             // immutable snapshot
  "output": {
    "interaction": {
      "type": "form_submitted",
      "data": { [fieldName]: <value>, ... },   // 검증 통과 후 정규화된 입력
      "receivedAt": <ISO8601>
    }
  },
  "meta": { "interactionType": "form", "durationMs": <elapsed> },
  "port": "out",
  "status": "resumed"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음 — spec 이 옛 패턴을 모두 명시 폐기) | — | Principle 1.1 / 4 부합 |

## Rationale

- Form 은 사용자가 제시한 "단계마다 채워지는 field" 정의의 **표준 사례**:
  - 단계 (a) waiting: 사용자에게 표시할 데이터 — 폼 정의는 모두 `config` 에 있어 `output` 은 빈 객체. 런타임 계산값이 없음.
  - 단계 (b) resumed: 사용자 인터렉션 결과 — `output.interaction.data` 가 제출된 값.
- 옛 패턴 (`output.submittedData`, `output.view`, `output.type` 판별자) 은 모두 Principle 1.1 / 4.2 위반으로 폐기. spec 이 명시.
- `config` 의 raw echo 는 클라이언트가 폼 UI 를 직접 렌더링하기 위함 — 백엔드가 HTML snapshot 을 생성하지 않음 (Presentation 카테고리 공통 정책).
- `meta.interactionType` 은 노드 타입 판별자가 아니라 인터랙션 컴포넌트 분류 — UI 라벨 (form / buttons / ai_conversation) 로 동일 노드도 모드에 따라 다름 (예: Carousel 은 `'buttons'`).
