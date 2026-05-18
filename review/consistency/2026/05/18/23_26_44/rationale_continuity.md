### 발견사항

- **[INFO]** `loop.count` 에 `ui.required: true` 추가 — warningRule dead 상태와의 불일치 인지 후 follow-up 분리
  - target 위치: plan §Commit 2 — Logic 표의 `loop | count | ui.required: true` 행 + §후속 follow-up "loop.count default 합의"
  - 과거 결정 출처: `spec/4-nodes/1-logic/3-loop.md` 본문 §설정 표 (`count | ✓ | '1'`) 및 §에러·경고 표 (`count 미설정 (빈 문자열 / undefined) → warningRule`)
  - 상세: `loop.count` 는 spec 에서 필수(✓)로 정의되어 있으나 기본값이 `'1'`이다. 이 때문에 `warningRule('loop:no-count')`은 count 가 빈 문자열/undefined 일 때만 발화하는데, default `'1'` 이 있으면 실제로 발화하지 않는 dead rule 상태다. plan 은 이를 인지하고 follow-up 으로 분리했으나, `ui.required: true` 를 추가해 패널에 asterisk 는 표시하면서 실제 warningRule 이 발화하지 않는 불일치가 존재한다. 기존 결정("`.optional()` / `.default(...)` 는 의도된 디자인")을 유지하면서 `ui.required` 추가는 기술적으로 가능하지만, spec 의 "warningRules 가 '이 필드는 비어 있으면 안 된다'라고 선언한 필드"라는 plan 자체 기준을 loop.count 가 충족하는지 불명확하다.
  - 제안: follow-up plan 에서 `default('1')` → `default('')` 변경 검토를 완료하기 전까지는 `loop.count` 를 sweep 대상에서 잠정 제외하거나, loop.count spec 표의 기본값 표기와 warningRule 의 현실적 동작을 함께 명문화하는 Rationale 를 추가할 것.

- **[INFO]** 제공된 Rationale 발췌문의 범위 — 노드 스키마 설계 원칙 부재
  - target 위치: plan §방침 "zod schema 자체는 건드리지 않는다 — `.optional()` / `.default(...)` 는 마이그레이션·LLM 도구 호출·부분 저장 등의 이유로 의도된 디자인"
  - 과거 결정 출처: 제공된 Rationale 발췌에는 `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/10-auth-flow.md` 의 내용만 포함되어 있음. 노드 스키마의 `.optional()` / `.default()` 설계 원칙에 대한 직접적인 Rationale 항목은 발췌에 없음.
  - 상세: plan 이 선언한 "저장 관용성을 위해 `.optional()` / `.default(...)` 는 유지"라는 원칙은 현재 코드(`if-else.schema.ts:77`, `form.schema.ts:148` 의 인라인 주석)에서 동일한 표현이 확인되어 설계 방향은 일관된다. 그러나 이 원칙이 어느 spec 의 Rationale 에서 공식화되었는지 발췌에서 추적되지 않는다. 발췌된 Rationale 어느 항목과도 직접 충돌하지는 않는다.
  - 제안: `spec/4-nodes/0-overview.md` 또는 관련 노드 spec 의 `## Rationale` 에 "노드 설정 schema 의 `.optional()` / `.default()` 는 저장 관용성·마이그레이션·LLM 도구 호출을 위한 의도된 설계이며, 필수 표시(asterisk)는 `ui.required` / `ui.requiredWhen` 메타로 분리 관리한다"는 원칙을 공식화하는 것을 권장.

### 요약

제공된 Rationale 발췌문은 주로 Integration 화면의 OAuth 흐름, 상태 관리, HMAC 알고리즘 등에 관한 것으로, target plan(노드 설정 패널의 `ui.required` / `ui.requiredWhen` 메타데이터 sweep)과 직접 충돌하는 기각된 대안이나 합의된 invariant 위반은 발견되지 않는다. plan 의 핵심 방침("zod schema 건드리지 않음, `ui.required` 메타 추가")은 기존 코드의 carousel, http-request 등 선례와 일치하며, 제공된 Rationale 항목을 번복하거나 위배하지 않는다. 다만 `loop.count` 의 경우 plan 자체 기준("warningRules 가 필수 선언한 필드")과 실제 spec 의 default `'1'` 설정이 충돌해 warningRule dead 상태를 인지하면서도 `ui.required: true` 를 추가하는 일관성 문제가 있으며, 노드 스키마 `.optional()` / `.default()` 원칙을 공식 Rationale 로 문서화하지 않은 점이 보완 대상으로 식별된다.

### 위험도

LOW
