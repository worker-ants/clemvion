# 요구사항(Requirement) 리뷰 — node-config-required-defaults-sweep

## 발견사항

### WARNING 1: `send_email:no-recipient` warningRule 조건과 `ui.required` 의 의미 범위 불일치
- **위치**: `send-email.schema.ts` — `to` 필드 / `send-email.schema.spec.ts` `ui.required` 테스트
- **상세**: `to` 필드는 스키마에서 `z.array(z.string()).default([])` 로 선언되어 있고 `ui.required: true` 가 추가되었다. 그런데 `validateSendEmailConfig` 의 `isRecipientsLike` 함수는 `to` 를 `string | string[]` 두 형태 모두 허용한다 — 즉 런타임에서는 단일 문자열 "a@example.com" 도 유효하다. 반면 스키마의 `to` 는 배열 전용(`z.array(z.string())`)이므로 단일 문자열을 파싱하면 실패한다. `ui.required` 테스트(`send-email.schema.spec.ts:954-961`)는 `properties?.['to']?.ui?.required` 만 확인하고, 비어있는 배열이 `to = []` 로 파싱된 뒤 warningRule `length(to) == 0` 로 걸리는 정상 흐름은 기존 테스트로 커버되지만, `validateSendEmailConfig` 가 단일 문자열도 수용하는 반면 zod 스키마가 배열만 수용하는 비대칭이 방치되어 있다. 프론트엔드에서 `to` 를 단일 문자열로 저장한 기존 데이터는 zod 파싱 실패를 일으킬 수 있다.
- **제안**: `to` 필드를 `z.union([z.string(), z.array(z.string())]).default([])` 로 확장하거나, `validateSendEmailConfig` 의 문자열 허용 경로를 제거해 스키마와 일치시킨다. 단, 이는 breaking change 이므로 방침('zod schema 자체는 건드리지 않는다')과 충돌할 수 있어 팀 합의가 필요하다.

### WARNING 2: `loop.count` 의 `ui.required: true` 와 기본값 `'1'` 의 충돌 — warningRule 이 절대 발화되지 않음
- **위치**: `loop.schema.ts` — `count` 필드 / `logic-ui-required.spec.ts`
- **상세**: `count` 는 `.string().default('1')` 로 선언되어 있다. warningRule `loop:no-count` 조건은 `when: '!count'` 인데, `count` 기본값이 `'1'` 이므로 신규 생성 노드에서 `count` 는 절대 빈 값이 되지 않는다. 즉 `loop:no-count` 경고는 실질적으로 발화 불가한 dead rule 이다. 동시에 `ui.required: true` 로 UI 필수 표시는 노출되지만, 기본값 `'1'` 이 항상 채워져 있어 실제로 사용자가 이 필드를 비울 방법이 없다. 다른 `inputField`, `arrayField` 등 `default('')` 로 선언된 필드들은 빈 문자열 상태에서 warningRule 이 올바르게 발화하지만, `count` 만 유효한 초기값이 있어 동작이 다르다.
- **제안**: `count.default('1')` 을 유지할 거라면 `loop:no-count` warningRule 및 `ui.required` 가 실제 필요한지 재검토가 필요하다. 또는 `count.default('')` 로 변경해 다른 필드와 일관성을 맞추고 초기 상태에서 경고가 발화되도록 한다(방침 'zod schema 자체는 건드리지 않는다' 위반 여부 팀 판단 필요).

### WARNING 3: `switch.switchValue` 의 `requiredWhen` 조건이 warningRule 과 정확히 일치하지 않음
- **위치**: `switch.schema.ts` `switchValue` 필드 / `logic-ui-required.spec.ts` `requiredWhen` 테스트
- **상세**: warningRule 조건은 `when: 'mode != expression && !switchValue'` 이다. 즉 mode 가 `'value'`(기본값) 이거나 `undefined` 일 때 `switchValue` 가 비어있으면 경고가 발화된다. `ui.requiredWhen` 은 `{ field: 'mode', notEquals: 'expression' }` 으로 동일한 조건을 표현한다. 그런데 `switchValue` 는 `.string().default('')` 로 선언되어 있고, `warningRule` 은 `!switchValue` — 빈 문자열이면 경고를 낸다. `requiredWhen` 은 mode 조건만 보고 switchValue 값 자체는 보지 않는다. 이 두 조건은 같은 시점에 동기화되어 있어 구조적으로는 문제가 없다. 단, `visibleWhen: { field: 'mode', equals: 'value' }` 로 인해 `mode = 'expression'` 일 때는 `switchValue` 필드 자체가 UI 에서 숨겨지는데, `requiredWhen` 은 `mode != expression` 이면 필수로 표시한다. 필드가 hidden 상태인데 requiredWhen 조건이 참이면 asterisk 렌더 충돌이 발생할 수 있다. frontend `visibility.ts` 가 hidden 상태에서 required 표시를 억제하는지 확인이 필요하다.
- **제안**: frontend `visibility.ts` 에서 `visibleWhen` 이 false 일 때 `requiredWhen` 결과를 무시하는지 확인. 무시하지 않는다면 `ui.requiredWhen` 조건에 `visibleWhen` 과 동일한 가드를 추가하거나, frontend 의 `isFieldRequired` 함수에서 hidden 필드는 required 체크에서 제외하는 로직을 보강한다.

### INFO 1: `send-email.schema.spec.ts` ui.required 테스트에서 `warningRule ID` 를 테스트 레이블로만 사용하고 실제 연동은 미검증
- **위치**: `send-email.schema.spec.ts` 라인 954–961 (`it.each`)
- **상세**: `it.each` 의 두 번째 인자 `'send_email:no-integration'` 등 warningRule id 는 테스트 이름(`%s` 포맷)으로만 사용되고, 실제로 warningRule 이 해당 필드의 빈 상태에서 발화되는지를 `ui.required` 테스트 내부에서 연결 검증하지 않는다. warningRule-발화 테스트와 ui.required 테스트는 별도 describe 블록에서 독립적으로 존재하므로, warningRule id 가 변경되어도 ui.required 테스트는 자동으로 깨지지 않는다. 이는 SSOT 보장의 약한 고리다.
- **제안**: `it.each` 의 세 번째 인자로 실제 `warningRuleId` 를 전달하고, 해당 rule 이 해당 key 가 비었을 때 발화하는지를 같은 테스트 내에서 같이 검증하면 SSOT 연결이 더 강하게 잠긴다. 단, 현재 구조도 기능상 동작하므로 INFO 수준이다.

### INFO 2: `logic-ui-required.spec.ts` 에서 `ZodObject` 타입 파라미터가 any-cast 로 동작
- **위치**: `logic-ui-required.spec.ts` 라인 2262 — `uiMeta(schema as ZodObject, key)`
- **상세**: `uiMeta` 함수 시그니처는 `schema: ZodObject` 를 받지만, `ZodObject` 는 `ZodObject<ZodRawShape, UnknownKeysParam, ZodTypeAny>` 의 제네릭이므로 `as ZodObject` cast 는 타입 안전성을 포기한 것이다. 이 패턴은 런타임 오류를 발생시키지 않지만 TypeScript 컴파일러가 schema 의 실제 형태를 검사하지 못하게 한다. zod 의 `z.toJSONSchema` 자체가 any-safe 이므로 실제 실패 위험은 낮다.
- **제안**: `uiMeta` 함수를 `ZodTypeAny` 또는 `z.ZodTypeAny` 로 받도록 확장하거나, 함수 자체를 제네릭으로 선언해 cast 없이 사용 가능하게 한다. 현재 기능에는 영향 없음.

### INFO 3: `presentation-button-render-investigation.md` — plan 항목이 모두 미완료 상태로 `node-config-required-defaults-sweep` PR 에 포함
- **위치**: `plan/in-progress/presentation-button-render-investigation.md`
- **상세**: 본 plan 은 조사 단계 (A~E) 가 모두 `[ ]` 미완료 상태다. plan frontmatter 의 `worktree: node-config-required-defaults-sweep` 로 인해 이 PR 에 묶여 있으나, 본 PR 의 sweep 목적과는 별개 작업임을 문서 자체도 명시하고 있다. 문서가 PR 에 포함되는 것 자체는 의도된 '분석 기록' 목적이나, 체크리스트 항목이 하나도 체크되지 않아 `consistency-checker` 의 `plan_coherence` 검사에서 미완 plan 으로 계속 검출될 수 있다.
- **제안**: 별도 worktree/PR 로 분리하거나, 또는 이 plan 의 `worktree` frontmatter 를 별도 이름으로 지정해 sweep PR 의 plan 통합 추적과 분리한다.

---

## 요약

이번 변경의 핵심 목적 — 각 노드의 `warningRules` 가 선언한 "사실상 필수" 필드에 `ui.required` / `ui.requiredWhen` 메타를 일관 추가해 frontend 필수 표시(asterisk)와 SSOT 를 정합화하는 것 — 은 전반적으로 달성되었다. 18개 파일 전체에 걸쳐 warningRule ID 와 ui.required/requiredWhen 의 대응이 주석으로 명시되어 있고, 각 노드별 lock 테스트(`z.toJSONSchema` 활용)도 추가되어 회귀 방지 구조가 갖춰졌다. 다만 세 가지 기능 요구사항 관련 주의사항이 존재한다: (1) `send-email` 의 `to` 필드가 zod 스키마(배열 전용)와 `validateSendEmailConfig`(문자열도 허용) 간 비대칭으로 기존 단일 문자열 데이터가 파싱 실패할 수 있다. (2) `loop.count` 의 기본값 `'1'` 로 인해 `loop:no-count` warningRule 이 실질적으로 발화 불가하며 `ui.required: true` 와 의미가 충돌한다. (3) `switch.switchValue` 의 `requiredWhen` 이 `visibleWhen: false` 상태에서도 적용될 수 있어 frontend 에서 hidden 필드에 asterisk 가 노출되는 엣지 케이스가 존재할 수 있다.

## 위험도

MEDIUM
