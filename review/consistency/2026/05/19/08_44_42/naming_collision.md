# 신규 식별자 충돌 검토 — button-cap-spec-validator

## 발견사항

- **[INFO]** `MAX_BUTTONS_PER_NODE` — 신규 exported 상수, 충돌 없음
  - target 신규 식별자: `export const MAX_BUTTONS_PER_NODE = 5` (`backend/src/nodes/presentation/_shared/button.types.ts`)
  - 기존 사용처: 없음. 기존 코드베이스(`/codebase/backend/`, `/codebase/frontend/`) 전체에서 동일 이름 사용 없음 (`grep MAX_BUTTONS` 결과 0건)
  - 상세: 완전히 새로운 이름으로, 기존 `PRESENTATION_MAX_BYTES` 등 인접 상수와도 충돌하지 않는다. 네이밍 패턴(`MAX_*_PER_NODE`)도 codebase 내 선례가 없으므로 관례 충돌도 없다.
  - 제안: 변경 없음. 이름이 의도를 명확히 전달하고 SSOT 역할에 적합하다.

- **[INFO]** `maxButtons` prop — 기존 prop 명 유지, 값(default)만 변경
  - target 신규 식별자: `maxButtons = 5` (default 변경, `frontend/button-list-editor.tsx` L29)
  - 기존 사용처: `frontend/button-list-editor.tsx:21` 에 이미 `maxButtons = 10` 으로 선언. `button-list-widget.tsx`, `presentation-configs.tsx` 등 consumers 가 존재하나 prop 명 자체는 동일.
  - 상세: prop 이름 자체는 변경 없이 default 값만 10 → 5로 수정하는 것이므로 naming collision 이 아니다. consumers 중 `maxButtons` 를 명시적으로 `10` 으로 전달하는 곳이 있다면 런타임 동작은 유지되지만 의도한 하향 cap 적용을 우회하게 된다.
  - 제안: consumer 파일들에서 `maxButtons={10}` 을 명시적으로 전달하는 곳이 있는지 확인 후, 있으면 제거하거나 `MAX_BUTTONS_PER_NODE` 와 연동하도록 갱신.

- **[INFO]** `buttonDefSchema` — 모듈 내 로컬 const, 4개 schema 파일이 동일 이름으로 독립 선언 (기존 현황)
  - target 신규 식별자: 없음. target 이 이 이름을 새로 도입하지는 않는다.
  - 기존 사용처: `carousel.schema.ts:8`, `table.schema.ts:8`, `template.schema.ts:8`, `chart.schema.ts:8` 에 각각 module-scoped `const buttonDefSchema` 가 동일 정의로 이미 존재.
  - 상세: 각 파일 내부로만 scoped 되어 있고 export 되지 않으므로 실제 충돌은 아니다. 단, target 계획(§작업 항목)이 `_shared/button.types.ts` 에 이미 `ButtonDef` 인터페이스와 `validateButtons` 를 두고 있음에도 `buttonDefSchema` 를 _shared 로 통합하지 않아 4벌 중복 정의가 유지된다. 본 PR scope 외이므로 INFO 로만 기록.
  - 제안: 후속 PR 에서 `buttonDefSchema` 를 `_shared/button.types.ts` 로 통합해 DRY 원칙 적용.

- **[INFO]** `shadow-workflow.spec.ts` 의 `maxButtonsValidator` 인라인 테스트 헬퍼 — 숫자 리터럴 10 잔류
  - target 신규 식별자: 없음 (이름 변경 없음).
  - 기존 사용처: `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts:1234` 의 `maxButtonsValidator` 클로저가 `buttons.length > 10` 과 `'Maximum 10 buttons allowed per node'` 를 하드코딩. worktree 에서도 동일하게 미갱신 상태 확인됨.
  - 상세: naming collision 은 아니나, 본 PR 이 cap 을 5로 통일함에 따라 이 테스트 헬퍼가 old cap(10) 을 기준으로 작성되어 있어 "validator warning 동작 검증" 시나리오가 실제 production 로직과 불일치한다. `validateButtons` 를 직접 import 해 사용하도록 교체하면 불일치가 해소된다.
  - 제안: `maxButtonsValidator` 헬퍼를 제거하고 `_shared/button.types.ts` 의 `validateButtons` 를 직접 import 해 사용. plan 의 tests 체크리스트에 포함되어 있지 않으므로 추가 필요.

## 요약

target `button-cap-spec-validator` plan 이 도입하는 신규 식별자는 `MAX_BUTTONS_PER_NODE` 하나이며, codebase 전체에서 동일 이름의 선행 정의가 없어 명명 충돌은 발생하지 않는다. `maxButtons` prop 은 이름 변경 없이 default 값만 수정하는 것이라 충돌 범주에 해당하지 않는다. `buttonDefSchema` 는 target 이 새로 도입하는 이름이 아니고 기존 4벌 중복 현황이 그대로이다. `shadow-workflow.spec.ts` 의 인라인 테스트 헬퍼에 구 cap 리터럴(10)이 잔류해 있어 logic 불일치 위험이 있으나, 이는 naming collision 이 아닌 테스트 갱신 누락이다. 전체적으로 신규 식별자 충돌 관점에서 CRITICAL 또는 WARNING 등급 문제는 없다.

## 위험도

LOW
