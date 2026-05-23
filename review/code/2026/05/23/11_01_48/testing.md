# Testing Review — render_* 버튼 무반응 회귀 fix

## 발견사항

### [INFO] backfillButtonUuids — 유닛 테스트 커버리지 충분, 엣지 케이스 대부분 처리됨

- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts` lines 58–195
- 상세: 7개 `it()` 블록이 TDD 체크리스트의 모든 항목(carousel items[].buttons, 글로벌 buttons, itemButtons, table/chart/template buttons, id 보존, form no-op, 빈 배열, non-array buttons 필드)을 커버한다. UUID_V4_RE 정규식을 모듈 수준에서 상수로 추출해 테스트 의도가 명확하다. 각 it()는 독립적으로 실행 가능해 테스트 격리에 문제 없다.
- 제안: 현재 수준 유지.

### [WARNING] `backfillButtonUuids` — `chart` 타입에 대한 글로벌 `buttons` 처리를 `table`/`template`과 묶어 단일 `it()`에서 검증함

- 위치: `render-tool-provider.spec.ts` lines 105–136 ("fills missing id on table / chart / template global buttons")
- 상세: 하나의 `it()` 블록이 세 타입(table, template, chart)을 순차 assert한다. 이 중 하나라도 실패하면 오류 메시지가 어느 타입에서 실패했는지 특정하기 어렵다. 또한 `chart` 타입은 `backfillButtonUuids` 내부 로직에서 `carousel`이 아닌 나머지 경로(`!== 'form'`)를 공유하기 때문에 타입별 독립 `it()` 분리가 진단 용이성에 유리하다.
- 제안: 세 타입을 각각 독립 `it()`로 분리하거나, 최소한 실패 시 타입을 식별할 수 있도록 Jest/Vitest 의 `describe.each` / `it.each` 패턴을 사용한다.

### [WARNING] `PresentationContent` (template surface) 전역 버튼에 대한 `undefined id` 가드 테스트 누락

- 위치: `codebase/frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx`
- 상세: 신규 `CarouselContent` describe 블록은 `selectedButtonId` + `btn.id` 모두 undefined인 케이스를 정확히 검증한다. 그러나 `PresentationContent` 내부의 `buttons.map` 경로(line 598–629 in `presentation-renderers.tsx`)에도 동일한 `selectedButtonId != null` 가드가 추가됐지만, 이 경로에 대한 대응 테스트(`selectedButtonId=undefined` + `btn.id=undefined` → 클릭이 동작함)가 존재하지 않는다. `CarouselContent`와 동일한 버그가 `PresentationContent` 경로에서도 발생할 수 있었으므로 회귀 위험이 남는다.
- 제안: 기존 `describe("PresentationContent")` 블록 또는 별도 describe에 다음 케이스를 추가한다.
  - `buttonConfig.buttons` 안에 `id` 없는 버튼 + `selectedButtonId` 미전달 시 `onPortButtonClick` 호출됨
  - `selectedButtonId` 일치 id 있는 버튼은 클릭 무효 (기존 동작 보존, `CarouselContent` 케이스와 대칭)

### [WARNING] backfill 이후 `form` 타입에서 `normalisedPayload`가 `formConfig`에 전달되는 통합 경로 미검증

- 위치: `render-tool-provider.ts` lines 349–368 (backfill 호출 위치), `render-tool-provider.spec.ts`
- 상세: `backfillButtonUuids`는 `form` 타입에서 즉시 `return payload`로 early-return하므로 실질적으로 no-op이지만, `execute()` 내부에서 `normalisedPayload`가 form 경로의 `blockingFormRender.formConfig`에 그대로 대입된다(line 358–360). 현재 form 통합 테스트들은 `formConfig` 자체의 버튼 id 비교를 하지 않는다. form payload에 `buttons` 필드가 있을 경우 (spec §1 ButtonDef form surface 미사용이지만 LLM이 실수로 넣을 수 있음) early-return으로 처리되지 않음을 통합 레벨에서 문서화하는 테스트가 없다.
- 제안: 낮은 우선순위이지만, form 경로가 buttons 필드를 보존하되 uuid 주입 없이 passthrough 됨을 명시적으로 서술하는 단위 테스트 1건 추가 권고.

### [INFO] 통합 테스트 (`RenderToolProvider.execute — backfill integration`) — 범위와 설계 적절

- 위치: `render-tool-provider.spec.ts` lines 197–241
- 상세: 실제 `provider.execute()` 경유로 e2e 스타일 검증을 수행한다. 4개 버튼에 대한 uniqueness 및 UUID v4 형식을 동시에 assert한다. provider 인스턴스를 모듈 최상위에서 단일 공유(`const provider = new RenderToolProvider()`)하지만 각 `it()`가 독립된 `call.id`를 사용하므로 per-executionId 카운터 상태 오염 위험이 낮다.
- 제안: 현재 수준 유지. 다만 `workspaceId: 'ws'` 처럼 단축 값을 쓰는 부분은 일관성을 위해 기존 테스트의 `buildCtx` 헬퍼를 재활용하는 방향을 검토한다(현재 이 블록만 ctx 객체를 직접 인라인으로 구성).

### [INFO] CarouselContent `isSelected` 가드 테스트 — `link` 타입 버튼 케이스 누락

- 위치: `presentation-renderers.test.tsx` lines 409–469
- 상세: 신규 `CarouselContent — isSelected guard` describe 블록은 `type: "port"` 버튼만 사용한다. `link` 타입 버튼의 경우 `onClick` 내부에서 `onLinkButtonClick` 경로를 타지만, `isSelected` 가드는 동일하게 적용된다. 결합된 버그 재발(`selectedButtonId=undefined` + `btn.id=undefined` + `type: "link"` → 클릭 단락)을 방지하는 테스트가 없다.
- 제안: `type: "link"` 버튼을 포함하는 케이스를 선택적으로 추가. 핵심 버그(isSelected 단락)는 type에 무관하므로 중간 우선순위.

### [INFO] `UUID_V4_RE` 정규식 — 테스트 내 정의, 구현과의 커플링 없음

- 위치: `render-tool-provider.spec.ts` lines 39–43
- 상세: 정규식이 구현의 `randomUUID()` 세부 동작에 결합되지 않고 RFC 4122 v4 형식만을 검증한다. 주석도 의도를 명확히 설명한다. 적절하다.

### [INFO] 테스트 격리 — 모듈 레벨 `provider` 공유

- 위치: `render-tool-provider.spec.ts` line 14 (`const provider = new RenderToolProvider()`)
- 상세: 기존 패턴 그대로 유지되며 신규 테스트 블록도 동일 인스턴스를 사용한다. `RenderToolProvider`의 내부 상태(callsByExec Map, jsonSchemaCache)가 describe 간 공유되지만 각 테스트가 서로 다른 `executionId`를 사용하거나 anonexec(`__no_exec__`)에 의존하지 않는 한 충돌 위험은 낮다. 현 상태 허용.

### [INFO] `backfillButtonUuids` — `'image'` 등 미래 presentation 타입 추가 시 자동 커버 여부

- 위치: `render-tool-provider.ts` `backfillButtonUuids` 함수
- 상세: `type === 'form'` early-return + carousel 분기 + 나머지(table/chart/template)의 전역 buttons만 처리하는 구조다. 향후 새 타입이 추가될 때 자동으로 전역 buttons만 처리하는 fallback 경로에 포함된다. 이를 명시하는 테스트는 없으나 현 spec scope 내에서는 허용 가능.

## 요약

`backfillButtonUuids` 유닛 테스트는 TDD 체크리스트 항목을 충실히 커버하며 엣지 케이스(빈 배열, undefined buttons 필드, id 보존)까지 처리해 품질이 높다. 프론트엔드 `CarouselContent`의 `isSelected` 가드 테스트도 핵심 회귀 시나리오(양쪽 undefined)와 정상 동작 보존을 모두 검증한다. 주요 갭은 두 곳이다. 첫째, `PresentationContent`의 전역 buttons 경로에 동일 가드가 추가됐으나 해당 경로에 대한 `undefined id` 클릭 테스트가 없어 회귀 위험이 잠재한다. 둘째, table/chart/template 세 타입을 단일 `it()`에서 검증해 실패 시 원인 특정이 어렵다. 이 두 갭을 보완하면 테스트 커버리지와 진단 용이성이 유의미하게 향상된다.

## 위험도

LOW
