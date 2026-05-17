# Spec: Switch

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

입력 값(`switchValue`) 또는 케이스별 조건식을 평가하여 N+1 개 포트 (cases + default) 중 하나로 분기하는 **pass-through 노드**. 입력은 변형 없이 매칭된 케이스 포트로 그대로 전달된다 (Logic 공통 §10 Pass-through 규약). 케이스 포트는 동적이며 `config.cases[].id` 가 그대로 포트 ID 로 사용된다 (Logic 공통 §7 / CONVENTIONS Principle 6).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | `value` / `expression` | | `value` | `value`: `switchValue` 와 `cases[].value` 를 직접 비교 / `expression`: `cases[].condition` 을 input 에 대해 평가 |
| switchValue | Expression | mode=value 시 ✓ | `''` | 비교 기준 값. expression resolver 가 평가 후 핸들러로 전달 (`{{ }}` 표현식은 핸들러 진입 전 primitive 로 해석) |
| cases | CaseDef[] | ✓ | `[]` | 케이스 목록 (1개 이상). 순서대로 평가, 첫 매칭 사용 |
| hasDefault | Boolean | | `false` (schema) / `true` (handler 거동) | `default` 포트 사용 여부 — schema 기본값은 `false` 이지만 핸들러는 `hasDefault !== false` 로 체크하므로 **명시적으로 `false` 를 지정하지 않은 한 default 폴백이 발생** (§4 동작 참조) |
| strictComparison | Boolean | | `false` | 엄격 타입 비교 모드 (`===` / `!==`). [표현식 §3.2.1](../../5-system/5-expression-language.md#321-strict-모드) |

**CaseDef 구조** (`cases[i]`):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | String (slug) | ✓ | 케이스 고유 ID. **포트 ID 로 그대로 사용** — `^[a-zA-Z0-9_-]+$` (최대 64자) 만 허용. 같은 cases 내 중복 불가 |
| label | String | | 케이스 표시 라벨 (캔버스/UI). 포트 라우팅에 사용되지 않음 |
| value | unknown | mode=value 시 권장 | 매칭 값 (mode=value). primitive (string/number/boolean) 또는 expression 결과 |
| valueType | `string` / `number` / `boolean` | | mode=value 시 case `value` 가 문자열일 때 비교 전 타입 강제 변환. `'42'` + `valueType=number` → `42` (NaN 시 원본 유지) |
| condition | ConditionGroup | mode=expression 시 ✓ | 조건식 (mode=expression). 구조는 [공통 §1](./0-common.md#1-conditiongroup-구조) |

> Source of truth: `codebase/backend/src/nodes/logic/switch/switch.schema.ts` (export `switchNodeConfigSchema`, `caseDefSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Mode: [Value ▼]                     │
│                                      │
│  Switch Value                        │
│  {{ $input.user.role }}              │
│                                      │
│  Cases                               │
│  ┌──────────────────────────────────┐│
│  │ Label: Admin                     ││
│  │ Value: "admin"          [×]      ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ Label: Guest                     ││
│  │ Value: "guest"          [×]      ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Case]                        │
│                                      │
│  ☑ Has Default                       │
│  ☐ Strict Comparison                 │
└──────────────────────────────────────┘
```

mode=expression 으로 전환 시 각 case 의 `Value` 입력이 `Condition` (condition-builder 위젯) 으로 교체된다.

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 평가 대상 데이터 (1개 필수). mode=expression 에서 `condition.field` 표현식의 평가 대상이 됨 |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `<case.id>` | `<case.label>` | data | **true** | 각 `config.cases[i]` 마다 1개씩 동적 생성. 매칭 시 input pass-through |
| `default` | Default | data | false | 정적 포트. 매칭 실패 + `hasDefault !== false` 일 때 input pass-through |

### 3.3 동적 포트 ID 규칙

- `config.cases[].id` 가 그대로 출력 포트 ID 로 사용된다 (Logic 공통 §7 / CONVENTIONS Principle 6).
- **slug 형식 강제**: `^[a-zA-Z0-9_-]+$`, 최대 64자 (schema `caseDefSchema.id`). 공백·특수문자·HTML 엔티티 등은 schema 단계에서 차단되므로 라우팅 키 인젝션이 불가능하다.
- 같은 노드 내 case id 중복 금지 (`validateSwitchConfig` 가 reject).
- **시스템 예약어 금지**: `default`, `out`, `error` 등 (CONVENTIONS Principle 6) 은 case id 로 사용할 수 없다 — 프런트엔드 입력 검증에서 거부.
- 케이스 추가/삭제/순서 변경 시에도 기존 case 의 id (= 포트 ID) 는 불변이므로, 연결된 엣지가 보존된다.
- **id 누락 시 fallback** (백엔드 resolver): 빈 문자열·미설정이면 resolver 가 `case_${index}` 형태의 fallback id 를 발행한다 — 다만 이는 hot-fix 경로이며, AI 어시스턴트 / 사용자 입력 모두 명시적인 stable id 를 권장한다 ([AI 어시스턴트 §608](../../3-workflow-editor/4-ai-assistant.md) 참조).

## 4. 실행 로직

1. `mode` 결정 (기본 `value`).
2. **mode=value**: `cases` 를 순회하며 각 case 에 대해
   - `valueType` 으로 `case.value` 를 강제 변환 (`coerceCaseValue` — number 는 `Number()`, boolean 은 `'true'`/`'false'` 매칭, 실패 시 원본 유지).
   - `strictComparison=true` 면 `===`, 아니면 `==` 로 `switchValue` 와 비교.
   - 첫 매칭 case 채택 → §5.1 (`port: <case.id>`).
3. **mode=expression**: `cases` 를 순회하며 `evaluateCondition(input, case.condition, { strict })` 를 평가, 첫 true case 채택 → §5.1 (`port: <case.id>`).
4. 매칭 실패:
   - `hasDefault !== false` (즉 `true` 또는 미설정) → §5.2 (`port: 'default'`).
   - `hasDefault === false` → throw `'No matching case found and no default case configured'` (§6).
5. 어느 분기든 `output = input` (Logic 공통 §10 Pass-through 규약).

> **schema 기본값과 핸들러 거동의 차이**: schema `hasDefault.default = false` 인 반면 핸들러는 `hasDefault !== false` (즉 `undefined` 도 default 사용) 로 체크한다. 결과적으로 사용자가 UI 에서 토글을 끄지 않는 이상 default 폴백이 동작한다. 이 비대칭은 의도된 후방 호환 거동이며 단위 테스트(`falls through to default when hasDefault is omitted`)로 가드된다.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Switch 는 분기만 수행하는 pass-through 노드이므로 §5.1 (case 매칭) / §5.2 (default 폴백) 두 케이스로 구성된다. 매칭 실패 + `hasDefault=false` 는 §6 의 runtime throw — 별도 출력 케이스를 갖지 않는다.

### 5.1 Case: 케이스 매칭 (port `<case.id>`)

```json
{
  "config": {
    "mode": "value",
    "switchValue": "{{ $input.user.role }}",
    "cases": [
      { "id": "case_admin", "label": "Admin", "value": "admin" },
      { "id": "case_guest", "label": "Guest", "value": "guest" }
    ]
  },
  "output": { "user": { "role": "admin", "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "mode": "value",
    "matchedCase": "case_admin",
    "matchedCaseLabel": "Admin",
    "matchedCaseIndex": 0,
    "resolvedValue": "admin"
  },
  "port": "case_admin"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.mode` | `'value'` / `'expression'` | config echo (Principle 7) | 매칭 모드 (기본 `value`) |
| `config.switchValue` | unknown | config echo (Principle 7) | **raw** 형태 — 사용자가 `{{ $input.user.role }}` 로 입력했다면 그대로 보존. 평가된 값은 `meta.resolvedValue` 에 위치 (Principle 1.1) |
| `config.cases` | CaseDef[] | config echo | 사용자가 입력한 raw 케이스 목록. 각 case 의 `value`/`condition` 도 raw 형태 보존 |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 (변형 없음). Principle 1.1.4 — `output.view`/`output.type` 등 판별자 사용 금지 |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms). 엔진이 모든 노드에 공통 주입 |
| `meta.mode` | `'value'` / `'expression'` | handler return | resolved mode (config 기본값 적용 후) |
| `meta.matchedCase` | string | handler return | 매칭된 case 의 id |
| `meta.matchedCaseLabel` | string \| undefined | handler return | 매칭된 case 의 `label` (UI/로그용). label 미설정 시 `undefined` |
| `meta.matchedCaseIndex` | number | handler return | `config.cases` 배열 내 매칭된 인덱스 (0-based). default 폴백 시 `-1` |
| `meta.resolvedValue` | unknown | handler return | mode=value 일 때만 — 평가된 `switchValue` (expression resolver 가 해석한 primitive). mode=expression 에서는 생략 |
| `port` | `<case.id>` | handler return | 매칭된 case 의 동적 포트 ID |

> 옛 `meta.value` deprecated alias 는 D4 (logic-node-followups) 에서 제거되었다. 기존 워크플로 표현식은 `codebase/backend/scripts/migrate-node-output-refs.ts` 의 `RENAMED_META_FIELDS.switch` 마이그레이션으로 `meta.resolvedValue` 로 자동 rewrite 된다.

**Expression 접근 예**:
- `$node["X"].output.user.name` → `"Alice"` (pass-through)
- `$node["X"].port` → `"case_admin"`
- `$node["X"].meta.matchedCase` → `"case_admin"`
- `$node["X"].meta.matchedCaseLabel` → `"Admin"`
- `$node["X"].meta.matchedCaseIndex` → `0`
- `$node["X"].meta.resolvedValue` → `"admin"` (resolved switchValue, mode=value 시)
- `$node["X"].config.switchValue` → `"{{ $input.user.role }}"` (raw template, Principle 7)

### 5.2 Case: 매칭 실패 + default 폴백 (port `default`)

```json
{
  "config": {
    "mode": "value",
    "switchValue": "{{ $input.user.role }}",
    "cases": [
      { "id": "case_admin", "label": "Admin", "value": "admin" },
      { "id": "case_guest", "label": "Guest", "value": "guest" }
    ],
    "hasDefault": true
  },
  "output": { "user": { "role": "viewer", "name": "Charlie" } },
  "meta": {
    "durationMs": 0,
    "mode": "value",
    "matchedCase": "default",
    "matchedCaseIndex": -1,
    "resolvedValue": "viewer"
  },
  "port": "default"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1과 동일 + `hasDefault`) | config echo | `hasDefault: true` 도 echo |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 |
| `meta.matchedCase` | `'default'` | handler return | 매칭 실패 시 고정 문자열 `'default'` |
| `meta.matchedCaseLabel` | `undefined` | handler return | default 폴백 시 항상 `undefined` (전용 label 없음) |
| `meta.matchedCaseIndex` | `-1` | handler return | default 폴백 sentinel |
| `meta.resolvedValue` | unknown | handler return | mode=value 시 평가된 `switchValue` (default 폴백이어도 보존) |
| `port` | `'default'` | handler return | 정적 default 포트 |

**Expression 접근 예**:
- `$node["X"].output.user.name` → `"Charlie"` (pass-through)
- `$node["X"].port` → `"default"`
- `$node["X"].meta.matchedCase` → `"default"`
- `$node["X"].meta.matchedCaseIndex` → `-1`

> **후속 정비안** — [개선안 logic/switch.md](../../../plan/complete/archive/from-user-memo/node-specs-improvement/logic/switch.md) §3 잔여 항목:
> - **(완료)** `meta.value` deprecated alias 제거 — D4 (logic-node-followups). 마이그레이션 스크립트(`codebase/backend/scripts/migrate-node-output-refs.ts` `RENAMED_META_FIELDS.switch`) 가 기존 워크플로 표현식을 `meta.resolvedValue` 로 자동 rewrite.
> - **(완료)** case id reserved word 검증 — D7. `['default', 'out', 'error']` 를 frontend case id 입력에서 reject (warningRule + 단위 테스트). schema regex 는 문법만 검증하고 의미 충돌은 frontend layer 가 차단.
> - **(보류)** `meta.switchPath` 추가 (개선안 §3 #1) — switchValue 가 raw 표현식으로 `config` 에 echo 되므로 별도 필드 가치 낮음 (D6).
> - **유지** `config.strictComparison` — 개선안에서는 dead-field 가능성 검토했으나 현 구현이 실제로 사용 중. 그대로 유지.
> - **P2** 매칭 실패 + `hasDefault=false` 의 throw 동작은 "비즈니스 로직 실패가 아닌 설정 실패" 로 분류되어 throw 유지 (Principle 3.1 Pre-flight 카테고리).

## 6. 에러 코드

Switch 는 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 되며, 매칭 실패 + `hasDefault=false` 1건만 runtime throw 다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `mode='value'` + `switchValue` 미설정 | `Value 모드에서는 Switch Value 를 입력해야 합니다.` | warningRule (캔버스 배지) + handler.validate (`evaluateMetadataBlockingErrors`) |
| `cases` 빈 배열 | `최소 1개 이상의 case 를 추가해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `mode='value'` + `switchValue` 가 whitespace-only string (e.g. `'  '`) | `switchValue is required` | handler.validate (warningRule 가 잡지 못하는 truthy whitespace 케이스 보강) |
| `cases` 가 array 아님 | `cases must be a non-empty array` | handler.validate |
| `cases[i].id` 미설정 / 빈 문자열 / 비-string | `cases[i].id is required and must be a string` | `validateSwitchConfig` |
| `cases[i].id` 가 slug 형식 위반 (`/^[a-zA-Z0-9_-]+$/`) 또는 64자 초과 | zod schema error (`caseDefSchema.id`) | schema parse |
| `cases[i].id` 중복 | `cases[i].id '<id>' is duplicated` | `validateSwitchConfig` |
| `cases[i].valueType` 가 enum 미일치 | `cases[i].valueType must be one of: string, number, boolean` | `validateSwitchConfig` |
| `mode='expression'` 인데 `cases[i].condition` 누락 | `cases[i].condition is required when mode is "expression"` | `validateSwitchConfig` |
| `mode` 가 `value` / `expression` 외 | `mode must be "value" or "expression"` | handler.validate |
| `hasDefault` 가 boolean 아님 | `hasDefault must be a boolean` | handler.validate |
| `strictComparison` 가 boolean 아님 | `strictComparison must be a boolean` | handler.validate |
| **runtime**: 매칭 실패 + `hasDefault === false` | `No matching case found and no default case configured` | handler.execute throw |

> 위 마지막 항목은 runtime throw 지만 별도 `error` 포트가 없다 — 엔진이 실행 실패로 마킹한다. mode=expression 에서도 동일 throw 가 발생한다 (단위 테스트 `throws when no condition matches and hasDefault=false` 가드).

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Switch` 행 인용. 형식: `{switchValue} → {N} cases` (예: `$input.type → 3 cases`). `switchValue` 미설정 시 `summaryTemplate.warnWhen` 으로 배지 표시 ([캔버스 §5.5](../../3-workflow-editor/0-canvas.md) 참조).
