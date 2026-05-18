# 신규 식별자 충돌 검토 — node-config-required-defaults-sweep

검토 대상: `plan/in-progress/node-config-required-defaults-sweep.md`
검토 모드: plan draft (--plan)

---

### 발견사항

- **[WARNING]** `form.fields[i].required` 와 `form.fields` 의 `ui.required` 동명 혼동
  - target 신규 식별자: Commit 3 에서 `form.fields` 필드 자체에 `.meta({ ui: { required: true } })` 추가
  - 기존 사용처: `codebase/backend/src/nodes/presentation/form/form.schema.ts:55-58` 의 `formFieldSchema.required` (Boolean? — 폼 사용자가 해당 폼 필드 입력을 강제할지 여부), `spec/4-nodes/6-presentation/4-form.md:27` (`required | Boolean? | 필수 입력 여부`)
  - 상세: `formNodeConfigSchema.fields`(배열 필드) 에 추가될 `ui.required: true` 는 "노드 설정 패널에서 `fields` 배열이 비어 있으면 필수 표시를 띄운다" 는 의미다. 반면 `formFieldSchema.required`(boolean) 는 "폼 사용자(런타임 응답자)에게 해당 항목 입력을 강제한다" 는 전혀 다른 layer 의 의미다. 두 `required` 키가 같은 노드의 동일 JSON 경로 상에 공존(`.fields[i].required` vs `.fields.ui.required`)하여 코드 리뷰나 문서 탐색 시 혼동을 유발한다. plan 자체도 §후속 follow-up 에서 "form.fields.ui.required vs formFieldSchema.required 동명 혼동" 을 명시적으로 인지하고 있다.
  - 제안: 코드 주석 또는 `formNodeConfigSchema.fields` `.meta()` 의 `label` 에 "Fields (node config — at least one required)" 등으로 의미를 명기해 두 `required` 의 layer 차이를 inline 으로 문서화한다. spec `4-nodes/6-presentation/4-form.md §1` 에도 두 `required` 의 layer 구분 설명을 짧게 추가할 것을 권장한다. 명명 자체를 변경할 필요는 없으며, 주석과 spec 표의 표현만 보완하면 충분하다.

- **[INFO]** `logic-ui-required.spec.ts` 파일 이름 — 기존 spec 파일 패턴과 상이
  - target 신규 식별자: follow-up 항목에서 언급된 공유 테스트 파일 `logic-ui-required.spec.ts`
  - 기존 사용처: `codebase/backend/src/nodes/logic/` 하위 기존 패턴은 `<node-type>/<node-type>.schema.spec.ts` (예: `if-else/if-else.schema.spec.ts`, `filter/filter.schema.spec.ts`). 카테고리 단위 shared spec 파일은 현재 존재하지 않는다.
  - 상세: follow-up 항목이므로 현재 PR 범위 밖이지만, 만약 도입될 경우 기존 파일 배치 규약(`<node>/<node>.schema.spec.ts`)과 다른 구조가 된다. 위치가 불명확하다 — `nodes/logic/` 직하? `nodes/logic/_shared/`? 이름의 `-ui-required` 는 테스트 대상 기능을 한정하는 naming 이라 다른 `ui.required` 관련 테스트 추가 시 범위 확장이 어렵다.
  - 제안: 파일명을 `nodes/logic/_shared/ui-meta.schema.spec.ts` 또는 `nodes/logic/logic-nodes.schema.spec.ts` 처럼 기능-한정적이지 않은 이름으로 설계하거나, 기존 패턴을 따라 각 노드 폴더에 분산 유지(현재 PR 처럼)하고 별도 공유 파일 도입은 재검토한다. 단 이 항목은 follow-up 으로 분류된 것이므로 현 PR 에서 즉각 해결은 불필요하다.

- **[INFO]** `getUiMeta` 헬퍼 — 기존 동명 유틸리티 없음, 신규 도입 시 네이밍 점검 권장
  - target 신규 식별자: follow-up 에서 제안된 `getUiMeta` 공유 헬퍼 함수명
  - 기존 사용처: 현재 `codebase/backend/src/` 전체에서 `getUiMeta` 라는 함수/변수 이름은 존재하지 않는다. `uiMeta` 라는 이름도 현재 코드에 없다.
  - 상세: 충돌은 없으나, `UiHint` (`node-component.interface.ts:171`) 가 이미 UI 메타데이터의 공식 타입명으로 사용 중이다. `getUiMeta` 라는 이름은 `UiHint` 를 추출하는 함수임을 암시하지만 `Meta` 와 `Hint` 용어가 혼재될 수 있다.
  - 제안: follow-up 헬퍼 도입 시 `getUiHint` 또는 기존 `UiHint` 타입과 일관되는 이름을 선택한다. 현재 PR 범위 밖이므로 즉각 조치 불필요.

- **[INFO]** `VALID_OPS` / `VALID_OPERATIONS` — 로컬 상수, spec 과 충돌 없음
  - target 신규 식별자: follow-up 항목의 `filter.VALID_OPS`, `variable-modification.VALID_OPERATIONS` 공유 파생화 제안
  - 기존 사용처: 각각 `filter/filter.schema.ts:98`(`VALID_OPS`, 로컬 const), `variable-modification/variable-modification.schema.ts:113`(`VALID_OPERATIONS`, 로컬 const). 두 상수는 서로 다른 파일에 같은 목적(enum 유효성 검증 set)으로 선언되어 있으며 이름이 다르다.
  - 상세: 두 이름이 같은 의미(`유효 연산자 집합`)임에도 다른 이름(`VALID_OPS` vs `VALID_OPERATIONS`)을 쓰고 있어 공유화 시 하나의 이름으로 통일해야 한다. spec 과의 충돌은 없다. 현재 PR 범위 밖 follow-up 이다.
  - 제안: 공유화 시 `VALID_OPERATORS` (또는 `VALID_OPERATIONS` 통일)로 단일화하고, export 경로(`nodes/logic/_shared/`)를 정의한다. 현 PR 에서 조치 불필요.

---

### 요약

target plan 이 도입하는 식별자(`ui.required`, `requiredWhen`, `ui.requiredWhen`)는 `node-component.interface.ts` 에 이미 정의된 기존 UiHint 타입의 기존 필드명을 그대로 사용하는 것이므로 새로운 이름을 도입하지 않는다. 따라서 요구사항 ID, 엔티티명, API endpoint, 이벤트명, 환경변수, 파일 경로 차원의 CRITICAL 충돌은 발견되지 않았다. 유일한 실질적 위험은 `form.fields` 노드 설정 필드에 `ui.required: true` 를 추가할 때, `formFieldSchema.required`(폼 응답자 강제 여부)와 동일 컨텍스트 안에 두 개의 `required` 이름이 공존하여 개발자·문서 독자에게 혼동을 줄 수 있다는 점이다. 이는 plan 자체가 인지하고 있으며 follow-up 으로 분류하였다. 현 PR 범위에서 주석 또는 spec 단문 추가로 완화 가능하다.

---

### 위험도

LOW
