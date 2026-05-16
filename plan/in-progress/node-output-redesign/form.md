# Form output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. Form 은 conventions Principle 1.1 / 4 의 표준 사례 — 단계 (a) waiting `output: {}` + 단계 (b) resumed `output.interaction.{type, data, receivedAt}` 패턴. 옛 `output.submittedData`/`output.view`/`output.type:'form'` 판별자 모두 폐기 마킹 완료. 잔여 권고 없음.

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

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/presentation/form/{form.handler.ts, form.schema.ts, form.handler.spec.ts, form.schema.spec.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - waiting: `form.handler.ts:42-48` 가 `{ config: { ...rawConfig }, output: {}, status: 'waiting_for_input', meta: { interactionType: 'form', durationMs: 0 } }` 반환. spec §5.4 와 정확 일치.
   - **`config: { ...rawConfig }`** (`:44`) — spread 로 raw config 전체 echo. spec §5.4 JSON 예시의 `title`/`submitLabel`/`description`/`fields` 모두 포함됨. Carousel/Table/Chart/Template 의 selective echo 와 다른 패턴이나 Form 은 config 가 단순 (Principle 7 부합).
   - resumed: `form.handler.ts:33-34` 주석이 명시 — `execution-engine.waitForFormSubmission()` 이 `output.interaction.{type,data,receivedAt}` + `status: 'resumed'` 채움. spec §5.5 와 일치.

2. **schema ↔ spec config 정합성**: `formNodeConfigSchema` (`form.schema.ts:125-150`) 의 `title`/`description`/`submitLabel`/`fields` 모두 spec §1 와 일치. `formFieldSchema` (`:31-76`) 의 9종 type (text/number/email/textarea/select/checkbox/radio/date/file) + ValidationRule + file 관련 4종 옵션 (`allowedMimeTypes`/`maxFileSize`/`maxTotalSize`/`maxFiles`) — spec §1 와 일치.
   - 단, spec §1 의 `allowedMimeTypes` 기본 목록 (이미지/문서) 은 `form.schema.ts` 에 명시되지 않음 — 검증 시점에 default 적용 위치 확인 필요 (engine `waitForFormSubmission` 에 있을 가능성). spec §1 가 `_shared` 또는 engine 의 default 를 인용하는지 cross-check 필요.

3. **validate 일관성**:
   - `form.handler.ts:13-23` 의 `validate()` 는 warningRule (`form:no-fields`) + handler-only residual `fields must be an array` 만. 단순 — SSOT 위반 없음.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw + form 입력 검증 실패는 재제출 루프 (새 output 생성 X) — spec §6 명시 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0: 5필드 invariant 부합.
   - Principle 1.1: `output: {}` — runtime 계산값 없음. spec §1 의 `defaultValue` 가 `{{ }}` 표현식을 포함하면 engine 이 resolve 하여 `rawConfig.fields[i].defaultValue` 에 보존 (raw echo). 일관됨.
   - Principle 4: waiting/resumed 부합. `meta.interactionType: 'form'` 부합 (Form 만 `'form'`).
   - Principle 5: `port: 'out'` 단일 — Principle 5 부합.
   - Principle 7: `{ ...rawConfig }` (`:44`) 으로 모든 raw config echo — 가장 충실한 raw echo 구현. `formNodeConfigSchema.passthrough()` (`:150`) 가 user-extra fields 도 보존.
   - Principle 11: spec §5.4/§5.5 양 케이스 모두 JSON 예시 + 출처 표 명시.

6. **handler 테스트 (`form.handler.spec.ts`)**:
   - validate: fields 존재 / 빈 array / non-array / null — 4 케이스 커버 (`:23-56`).
   - execute: `status === 'waiting_for_input'`, `meta: { interactionType: 'form', durationMs: 0 }`, `config === baseConfig` (full echo), `output: {}`, input 무관 — 5 케이스 커버 (`:58-124`).
   - **resumed 단계 handler 테스트 없음** — handler 가 직접 관여하지 않으므로 정상. engine `waitForFormSubmission` 통합 테스트에서 검증.
   - **미세 누락**:
     - `defaultValue` 에 `{{ }}` 표현식이 있을 때 engine resolve 후 handler return 의 raw vs resolved 분리 검증 부재 — `rawConfig` ↔ `config` 분리 컨트랙트 unit 검증 보강 가치 (Principle 7).
     - file 타입 필드의 `allowedMimeTypes`/`maxFileSize` etc. handler validate 단계 직접 검증 부재 — engine 책임이라면 spec §1 에 명시 권장.

7. **횡단 일관성 (Presentation 5종)**:
   - 유일하게 `meta.interactionType: 'form'` (Carousel/Table/Chart/Template 는 `'buttons'`).
   - `output: {}` (빈 객체) — Carousel static + Form 만. dynamic/Chart/Template 는 runtime 값 surface.
   - `_shared` 의 ButtonDef 미사용 (Form 은 자체 FormField + submitLabel).
   - `validateButtons` 호출 없음 — schema 가 `validateConfig` 없이 warningRules 만.

8. **구현 품질**:
   - XSS: handler 는 HTML 생성 안 함 — frontend 가 폼 UI 직접 렌더. `defaultValue` 는 engine resolve.
   - 재개 토큰: engine 책임 — `executionId` ↔ `submit_form` WS 명령 매칭.
   - 큰 dataset: form 은 입력 dataset 무관 (사용자 제출 데이터만). 단, `allowedMimeTypes`/`maxFileSize`/`maxTotalSize`/`maxFiles` 의 enforce 위치 (engine vs handler) 가 spec 에 명시 안 됨 — cross-check 필요.
   - dead code 없음. 가장 simple 한 handler (50 줄).

## 종합 개선안 (2026-05-16)

- [ ] (spec) §1 의 `allowedMimeTypes` 기본 목록의 적용 시점 명시 — `form.schema.ts` 에 없으므로 engine `waitForFormSubmission()` 가 가장 가능성 높음. spec §4 step 5 에 "검증 시 적용" 만 명시되어 있어 정확 위치 모호. 근거: `form.schema.ts:31-76` 에 default 부재.
- [ ] (impl) `rawConfig` ↔ `config` 분리 검증 unit 테스트 추가 — `defaultValue` 에 `{{ $input.name }}` 같은 표현식이 있을 때 handler return `config.fields[i].defaultValue` 가 raw 보존되는지 (Principle 7). 근거: `form.handler.ts:42-48`.
- [ ] (impl) file 타입 필드의 size/mime/count 검증 시점 (engine vs handler) 의 책임 경계 명시 + cross-track 테스트 — handler `validate()` 가 schema 외 검증을 더 하지 않으므로 위반 시점은 engine submit 처리 단계. spec §6.2 의 "동상" 처리가 명확하나 책임 경계 cross-spec 명시 권장. 근거: `form.handler.ts:13-23`.
