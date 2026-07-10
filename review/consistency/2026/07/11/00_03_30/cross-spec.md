# Cross-Spec 일관성 검토 — `variables.__*` 예약 prefix 강제 (task_7f283553)

대상: `/private/tmp/claude-501/.../scratchpad/reserved-prefix-draft.md` (draft)
검토 범위: draft 가 변경을 계획하는 `spec/conventions/execution-context.md` 원칙 5, `spec/4-nodes/1-logic/4-variable-declaration.md` §1/§6, `spec/4-nodes/1-logic/5-variable-modification.md` §1.1/§6 이 다른 spec 영역(`spec/5-system/5-expression-language.md`, `spec/conventions/node-output.md`, `spec/conventions/cross-node-warning-rules.md`) 및 실제 코드와 정합하는지.

## 발견사항

### [Critical] 신규 schema-level reject 는 정적 literal 입력만 차단 — `{{ }}` 표현식으로 동적 계산되는 이름은 완전히 우회한다

- target 위치: draft "변경 1"(두 schema 파일의 `else if (name.startsWith('__'))` 신규 검사) + "변경 2"(execution-context.md 원칙 5 를 "강제 (schema-level reject)" 로 갱신하는 계획)
- 충돌 대상: `spec/5-system/5-expression-language.md:501,503` ("그 외 모든 핸들러의 config 문자열 필드는 표현식 해석 대상이다" — 제외 규칙 SoT `expression-exclusions.ts`) / `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts:6-16` (`EXPRESSION_EXCLUSIONS` 에 `variable_declaration`/`variable_modification` 미등재) / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5278`(`handler.validate(node.config)`, 미해석 원본) vs `:5296-5335`(`resolvedConfig = this.expressionResolver.resolveConfig(node.config, exprContext, node.type)`, validate **이후**·execute **이전**에 표현식 재평가) / `expression-resolver.service.ts:210-217`(`resolveConfig`) · `:262-263,286-318`(`resolveString` — 문자열에 `{{`가 있으면 위젯 타입과 무관하게 무조건 평가)
- 상세: `validateVariableDeclarationConfig`/`validateVariableModificationConfig` (신규 검사 포함)는 **`node.config` — 아직 표현식이 해석되지 않은 원본 문자열**에 대해서만 실행된다(`execution-engine.service.ts:5278`이 유일한 pre-flight 호출부, 확인됨). `variables[i].name`/`modifications[i].variable` 필드는 `EXPRESSION_EXCLUSIONS`(코드 SoT) 어디에도 없으므로, `resolveConfig`가 **모든** 문자열 필드를 표현식 대상으로 재귀 평가한다(`5-expression-language.md §8.3.3` 이 이를 "그 외 모든 핸들러의 config 문자열 필드"로 명문화). 즉 사용자가 UI의 plain-text 위젯에 직접 `name: "{{ $input.dynamicName }}"` 을 입력하면:
  1. pre-flight 검증 시점 값은 리터럴 문자열 `"{{ $input.dynamicName }}"` 이므로 `startsWith('__')` 검사를 통과한다(신규 가드가 막지 못함).
  2. 런타임에 `$input.dynamicName` 이 `"__workspaceId"` 또는 임의의 `"__foo"` 로 평가되면, `variable-declaration.handler.ts:61`(`context.variables[variable.name] = coerced`) / `variable-modification.handler.ts:139,150,162,180,196`(`context.variables[mod.variable] = ...`) 가 **평가된 이름 그대로** `context.variables` 에 write 한다.
  - 결과적으로 원칙 5 가 막으려는 두 위험 — (a) 사용자가 `__workspaceId` 등 시스템 키를 덮어씀, (b) `__` 로 시작하는 변수가 park 필터(`filterUserVariables`, `!key.startsWith('__')`)에 silent drop — 이 **바로 이 두 노드에서** 표현식 경로로는 신규 가드 도입 후에도 100% 그대로 재현된다.
  - draft 가 계획하는 execution-context.md 문구("두 노드의 `validateConfig` 가 거부함을 명시")는 이 한계를 언급하지 않으므로, 그대로 커밋되면 "강제 (schema-level reject)" 라는 표현이 `5-expression-language.md §8.3.3`(이미 확립된 SoT)이 기술하는 실제 엔진 동작과 직접 모순된다.
- 제안: execution-context.md 원칙 5 개정 문구를 "강제 (schema-level reject) — **단, config 에 저장된 리터럴 문자열에 한정**되며 `{{ }}` 표현식으로 런타임에 계산되는 이름은 이 가드를 우회한다(`variable_declaration`/`variable_modification` 이 `EXPRESSION_EXCLUSIONS` 대상이 아니므로 — SoT `spec/5-system/5-expression-language.md §8.3.3`)" 로 명시. 두 노드 spec §6 표에도 이 한계를 각주로 추가할 것을 권장. (완전 차단이 필요하다면 handler.execute 내부에서 **평가 후** 이름을 재검증하는 후속 결정이 필요 — 본 PR 범위 밖이므로 사용자 확인 요.)

### [Warning] 잔여 경로 예시 "Merge 노드 object spread" 는 부정확 — Merge 는 `context.variables` 를 전혀 건드리지 않는다

- target 위치: draft "변경 2" — execution-context.md 원칙 5 갱신 계획 중 "남은 잔여(다른 경로로 `__` 키가 유입될 여지: 예 Merge 노드 object spread, Code 노드)"
- 충돌 대상: `codebase/backend/src/nodes/logic/merge/merge.handler.ts:73-152`(`execute`) · `:177`(`blockedKeys`)
- 상세: 백엔드 전수 grep(`context.variables\[.*\] *=|context.variables *=`) 결과 `context.variables` 에 값을 쓰는 곳은 정확히 3곳뿐이다 — `variable-declaration.handler.ts:61`, `variable-modification.handler.ts:139/150/162/180/196`, `code.handler.ts:464,476`. Merge 핸들러는 `NodeHandlerOutput.output`(자기 자신의 노드 출력)만 생성하며 `context.variables` 를 읽지도 쓰지도 않는다. `merge.handler.ts:177` 의 `blockedKeys = new Set(['__proto__','constructor','prototype'])` 는 `merge_object` 모드가 **자신의 output 객체**를 prototype-pollution 으로부터 지키기 위한 방어이며(3개의 정확한 예약어만 차단, 일반 `__` prefix 는 통과), `variables.__*` 예약 네임스페이스(원칙 5)와는 스코프가 다른 별개 메커니즘이다. 다른 `__`-prefix 키(예: `__foo`)가 merge_object 출력에 남더라도, 그 값이 이후 Variable Declaration/Modification 의 `name`/`variable` 필드(신규 가드가 지키는 지점)를 거치지 않는 한 `context.variables` 에 진입하지 않는다 — 즉 Merge 는 이 문맥의 "잔여 경로" 로 적절한 예시가 아니다.
- 제안: 잔여 경로 예시에서 "Merge 노드 object spread" 를 제거하고, 실제로 확인된 두 경로로 교체: (1) Code 노드의 `$vars` 전체 atomic replace (`code.handler.ts:429,464,476`, `_buildIsolateContext`가 `$vars`를 mutable 객체로 노출하고 실행 후 필터링 없이 `context.variables` 전체를 덮어씀 — 사용자 JS 가 `$vars.__anything = ...` 을 직접 쓸 수 있음), (2) 위 Critical 항목의 표현식 기반 동적 이름 우회.

### [Info] 신규 reject 는 canvas 배지로도 노출되지 않는 완전 무경고(silent) 실행 실패 — draft 서술에 보강 권장

- target 위치: draft "영향 없음 선언 — 프론트엔드 변경 0"
- 근거: `codebase/frontend/src/lib/node-definitions/types.ts:170-178`(`NodeMetadata.warningRules` 주석 — "The backend strips `validateConfig` (function, imperative) before serializing, so this list is the only warning surface visible to the frontend.")
- 상세: 새 `__` 체크는 선언적 `warningRules`(canvas 배지 소스)가 아니라 명령형 `validateConfig`(frontend 비노출)에만 추가된다. 따라서 사용자는 캔버스에서 노란/빨간 배지를 전혀 보지 못하고, 저장도 통과하며, 오직 **워크플로우를 실제로 실행**할 때만 `INVALID_NODE_CONFIG` throw 로 발견한다. 이는 기존 "variables[i].name is required..." 등 기존 `validateConfig`-only 체크들과 동일한 패턴이라 아키텍처 자체는 일관되지만(`spec/conventions/cross-node-warning-rules.md:33` "평가 위치: frontend canvas + backend handler.validate" 원칙과도 부합), draft 의 breaking 서술이 "canvas 배지조차 없다"는 사실까지 명시하면 사용자가 실제로 겪을 체감(완전 무경고 실패)을 더 정확히 전달할 수 있다.
- 제안: execution-context.md 원칙 5 Rationale 또는 두 노드 spec §6 각주에 "canvas 미노출 — 실행 시점에만 발견 가능" 을 명시.

### [Info] 확인됨 — 나머지 핵심 검증 항목은 draft 서술과 정합 (문제 없음)

- **breaking 주장 (항목 1)**: `handler.validate(node.config)` 호출부는 `execution-engine.service.ts:5278` 단 한 곳이며(전수 grep 확인), 워크플로우 저장 경로(`workflows.service.ts` `saveCanvas` → `validateManualTrigger`(:586-625, Manual Trigger 파라미터 스키마 전용) + `validateUniqueLabels`(:627-638) + `evaluateGraphWarnings`(:571-584, cross-node `graphWarningRules` 전용))에는 노드별 `handler.validate`/`validateConfig` 를 범용 호출하는 지점이 없다. `save-canvas.dto.ts:69-76` 의 `config` 필드는 `@IsObject()` 만 있어 노드 타입별 shape 검증이 없다. draft 의 "저장 시점 게이트 없음" 주장은 정확.
- **park 필터 주장 (항목 2)**: `filterUserVariables`(`execution-engine.service.ts:7554-7562`)는 `!key.startsWith('__')` 조건으로 무조건 시스템 prefix 를 drop 하며, `stageDurableResumeSnapshot`(:7580-7592)이 park 직전 이를 호출해 `Execution.user_variables` 에 커밋한다. 기존 `__foo` 사용자 변수가 park/resume 시 silent 소실된다는 draft 주장은 정확.
- **시스템 주입 키 목록 (항목 4)**: 실제 주입 지점(`execution-engine.service.ts:1261-1275`, `:4096-4105`) 모두 정확히 `__workspaceId`/`__workspaceName`/`__workspaceTimezone`/`__dryRun` 4개만 주입하며 `node-handler.interface.ts:65-79` JSDoc 과 일치한다. `execution-engine.service.ts:5761` 주석에 남은 `context.variables[__hasDefaultLlmConfig:<wsId>]` 언급은 **stale 주석** — 실제로는 `:5794-5807` 에서 인스턴스 필드 `llmDefaultConfigCache`(Map)로 리팩터링되어 더 이상 `context.variables` 에 쓰이지 않는다(라이브 코드 아님, 5번째 키 아님). 선례 목록 갱신 불필요.
- **CONVENTIONS Principle 3.1 정합 (항목 5)**: `spec/conventions/node-output.md:100-110`("Pre-flight 에러 → throw") 과 두 노드 spec §6("runtime 에러 포트를 갖지 않는다. 모든 검증 실패는 pre-flight throw")은 신규 검사와 완전히 정합 — 신규 검사도 동일한 `validateVariableDeclarationConfig`/`validateVariableModificationConfig` pre-flight throw 경로를 재사용하므로 새 에러 포트나 §6 서술 변경이 필요 없다.
- **에러 메시지 문구 (항목 6)**: carousel 선례(`carousel.schema.ts:349-352`, `button.types.ts:79-82`)는 `.includes('__item_')`(포함 여부, "must not contain reserved separator")이고 draft 는 `.startsWith('__')`(접두 여부, "must not start with reserved prefix")다. 문구가 다른 이유는 실제 predicate 가 다르기 때문 — `__item_` 은 carousel 이 합성 버튼 id 를 만들 때 쓰는 **구분자(separator)** 예약어이고, `variables.__*` 는 시스템 값을 위한 **순수 prefix 네임스페이스**다. 따라서 문구 차이는 의도적이며 실제 비일관은 아니다(오히려 draft 의 "start with"가 실제 동작을 더 정확히 기술).
- 참고(보강 제안, 비차단): `spec/conventions/cross-node-warning-rules.md:33-34,89-100` 은 단일-노드 `warningRules`/`validateConfig`(SSOT: frontend canvas + backend `handler.validate`)와 cross-node `graphWarningRules`(SSOT: workflow save endpoint + frontend + runtime, 3중 가드)의 평가 위치가 애초에 서로 다른 아키텍처임을 명문화한다. 이는 draft 의 "저장 시점 게이트 없음(breaking 감수)" 결정이 기존 컨벤션과 일치하는 설계임을 뒷받침하는 근거이므로, execution-context.md 갱신 시 이 문서를 인용하면 결정의 근거가 더 명확해진다.

## 요약

draft 가 제시한 6개 핵심 검증 항목 중 4개(breaking 저장 경로 부재, park 필터 동작, 시스템 주입 키 4종, Principle 3.1/§6 정합)는 코드로 실증되어 draft 서술과 정확히 일치한다. 다만 새로 추가되는 schema-level reject 는 **`node.config` 원본(표현식 해석 이전) 문자열만 검사**하므로, `variable_declaration`/`variable_modification` 이 `EXPRESSION_EXCLUSIONS` 대상이 아니라는 기존 확립 사실(`5-expression-language.md §8.3.3`)과 결합하면 `{{ }}` 표현식으로 동적 계산되는 변수 이름은 신규 가드를 완전히 우회하고 원칙 5 가 막으려는 두 위험(시스템 키 덮어쓰기·park silent drop)을 그대로 재현한다 — 이는 draft 가 계획하는 spec 문구("강제 (schema-level reject)")가 다른 이미 확립된 spec(`5-expression-language.md`)의 서술과 직접 모순될 소지가 있는 **Critical** 사안이다. 또한 draft 가 잔여 위험의 예시로 든 "Merge 노드 object spread" 는 코드상 사실과 다르다(Merge 는 `context.variables` 를 전혀 다루지 않음) — 실제 잔여 경로는 Code 노드의 `$vars` 전체 치환과 위 표현식 우회 두 가지다. 두 사안 모두 spec 문구를 커밋하기 전 정정이 필요하다.

## 위험도

HIGH
STATUS: DONE
