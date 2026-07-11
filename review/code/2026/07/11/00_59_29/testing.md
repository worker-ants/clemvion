# 테스트(Testing) 리뷰 — `variables.__*` 예약 prefix 3계층(L0/L1/L2) 강제

대상 PR: reserved-var-prefix-enforce (L0 `WorkflowsService`/L1 두 노드 schema/L2 두 노드 handler + 공유 util)

## 검증 요약 (요청받은 3항목 + 독립 mutation 재현)

### (a) L2 handler 테스트가 "RESOLVED 이름에서 가드 발동 + 기존 시스템 변수 보존"을 증명하는가 — **확인됨**

- `variable-declaration.handler.spec.ts:354-368` (`throws when a resolved name starts with "__" and leaves the system var intact`): `context.variables['__workspaceId'] = 'ws-original'` 선-세팅 후 `execute()`에 이미 해석된 것으로 가정한 `name: '__workspaceId'`를 주입 → reject 확인 + `context.variables['__workspaceId']`가 `'ws-original'` 그대로임을 별도 단언. handler 쪽 시스템 변수 보존 요건을 정확히 커버.
- `variable-modification.handler.spec.ts:1300-1316`(`throws before any of the six write branches can clobber a system var`)도 동일 패턴(`__workspaceId` 선-세팅 → set 연산 시도 → reject + 값 불변 단언)이고, 이어지는 `it.each(['set','increment','decrement','append','push','pop'])`(6개 연산 전부)가 "가드가 6개 쓰기 분기 전부에 적용됨"을 개별로 고정한다. 두 노드 모두 요건 (a)를 만족.

### (b) `{{ }}` 표현식 이름이 저장 시점(L0)에서 거부되지 않음을 증명하는 테스트 — **확인됨, 존재**

- `workflows.service.spec.ts:155-163` (`should not reject an expression-valued variable name at save time`): `name: '{{ $input.dynamicName }}'`로 `saveCanvas`를 호출해 `resolves.toBeDefined()`를 단언. `isReservedVariableName`는 `startsWith('__')`만 검사하므로 이 표현식 리터럴은 자연히 통과하지만, 이 테스트가 있음으로써 "L0은 리터럴만 본다"는 설계 불변식이 회귀에 대해 고정된다(예: 누군가 L0에 표현식 파싱을 잘못 추가해 이 케이스를 실수로 막아버리는 변경이 있으면 이 테스트가 실패로 잡아낸다). 의도한 방향과 정확히 일치.

### (c) `restoreVersion` legacy-escape 테스트가 예약 변수명 케이스를 커버하는가 (트리거 파라미터 케이스뿐 아니라) — **확인됨**

- 기존(pre-existing) 테스트: `workflows.service.spec.ts:1505-1541` (`restores a snapshot with a malformed trigger parameter without a 400`) — 트리거 파라미터 전용.
- 신규 테스트: `workflows.service.spec.ts:1546-1589` (`restores a snapshot with a reserved "__" variable name without a 400`) — `variable_declaration` 노드에 `config: { variables: [{ name: '__legacy', type: 'string' }] }`를 심은 legacy snapshot을 `restoreVersion`으로 복원, `resolves.toBeDefined()`. `skipLegacyDataGates=true` 경로가 트리거 게이트뿐 아니라 신규 예약-이름 게이트도 함께 스킵함을 독립적으로 고정 — 요청받은 항목 정확히 충족.

### Mutation 재현 — **독립적으로 재현·확인됨**

두 handler(`variable-declaration.handler.ts`, `variable-modification.handler.ts`)의 L2 throw 블록만 제거하고 관련 6개 스펙 파일(`reserved-variable-name.util.spec`, 두 handler.spec, 두 schema.spec, `workflows.service.spec`)을 재실행했다.

- Baseline(원본): 6 suites / 186 tests 전부 통과.
- L2 제거 후: **정확히 11개 테스트만 실패**, 전부 두 handler.spec.ts의 `reserved "__" prefix — runtime (resolved) guard` describe 블록 내부(variable-declaration 3건 + variable-modification 8건 = 11건). 나머지 175개(스키마 L1 테스트, `workflows.service.spec`의 L0 테스트, `reserved-variable-name.util.spec`)는 전부 그대로 통과 — collateral failure 0건.
- 원본 파일로 원복 후 재실행 → 6/6 suites, 186/186 tests 통과, `git status`로 diff 없음 확인.

이 결과는 "L2 제거 시 오직 reserved 관련 테스트만 실패한다"는 주장을 정확히 뒷받침한다. 3계층(L0/L1/L2)이 서로 다른 코드 경로를 검증하고 있고, 어느 한 계층을 죽여도 다른 계층의 테스트가 거짓 통과(false green)로 이를 가리지 않는다는 점에서 **계층 간 테스트 독립성이 잘 확보되어 있다.**

---

## 발견사항

- **[WARNING]** `importWorkflow`의 L0 게이트(`validateReservedVariableNames(dto.nodes)`)에 대한 테스트가 전무하다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:261`(`importWorkflow` 안의 호출) 및 `:331`(`const nodeRef = node.id ?? node.label ?? ''`) / `workflows.service.spec.ts` 전체(`describe('importWorkflow', …)` 블록, `:969-`)
  - 상세: CHANGELOG(`Unreleased`)와 코드 주석은 "L0 — 저장 시점(`saveCanvas`/`importWorkflow`) → 400"이라고 명시하고, `validateReservedVariableNames`의 파라미터 JSDoc은 "Shared by `saveCanvas`(nodes carry `id`)와 `importWorkflow`(ids are regenerated after this gate, so fall back to the label)"이라고 **명시적으로 다른 분기(`label` fallback)**를 예고한다. 그러나 `saveCanvas` 경로는 5개 테스트로 두텁게 커버된 반면(`workflows.service.spec.ts:99-163`), `importWorkflow` 경로는 이 가드에 대한 테스트가 하나도 없다. 특히 `importWorkflow`가 넘기는 노드에는 `id`가 없다(같은 파일의 기존 `importWorkflow` 테스트들, 예: `:993-1017` `remaps containerIndex to the new node UUID`도 `id` 없이 `label`만 준다)는 사실이 이미 확인되므로, `node.id ?? node.label ?? ''`의 `label` fallback 분기는 **실제로 항상 실행될 경로인데도 어떤 테스트도 이를 지나가지 않는다.** 만약 이 fallback이 깨지면(예: 실수로 `node.id`만 참조하도록 리팩터링) `offenders[].node`가 `undefined`가 되어도 아무 테스트도 감지하지 못한다.
  - 제안: `describe('importWorkflow', …)` 안에 최소 1개 — `variables: [{ name: '__x', ... }]`를 가진 노드로 `importWorkflow()`를 호출해 `RESERVED_VARIABLE_NAME` 400을 단언하고, `details.offenders[0].node`가 (id 부재 상황이므로) `label` 값과 같음을 확인하는 테스트를 추가할 것. `saveCanvas`용 `varNodeDto` 헬퍼를 `importWorkflow` DTO 모양(단일 노드 배열, `id` 생략)으로 살짝 변형해 재사용 가능.

- **[INFO]** 여러 노드에 걸친 offender 집계(cross-node aggregation)가 명시적으로 테스트되지 않음
  - 위치: `workflows.service.ts:328-361`(`validateReservedVariableNames`의 `for (const node of nodes)` 루프, 공유 `offenders` 배열)
  - 상세: 기존 테스트(`should report the offending node and field in the error details`, `workflows.service.spec.ts:123-142`)는 **같은 노드 내부**에서 `variables[0]`(정상)·`variables[1]`(예약)처럼 인덱스 집계만 검증한다. `variable_declaration` 노드 하나와 `variable_modification` 노드 하나가 **같은 그래프**에서 동시에 위반하는 케이스(서로 다른 `field` prefix — `variables[i].name` vs `modifications[i].variable`가 하나의 `offenders[]`에 함께 모이는지)는 어떤 테스트도 exercise하지 않는다. 로직이 단순한 루프라 실패 위험은 낮지만, 실제 사용자 워크플로는 두 종류의 로직 노드를 함께 배치하는 경우가 흔하므로 회귀 시 발견이 늦을 수 있다.
  - 제안: `varNodeDto` 헬퍼를 확장해 `variable_declaration` + `variable_modification` 노드를 동시에 포함하는 DTO로 "두 노드 모두 위반 → `offenders`에 두 항목 모두 존재" 테스트 1개 추가 권장(선택 사항, 낮은 우선순위).

- **[INFO]** L1 가드가 `evaluateMetadataBlockingErrors`/`handler.validate()` 경계(레지스트리·프론트 노출 경로)를 통해서도 발동함을 별도로 고정하는 테스트는 없음
  - 위치: `codebase/backend/src/nodes/core/metadata-validation.ts:46`(`imperative = metadata.validateConfig?.(config)`) — `variableDeclarationNodeMetadata.validateConfig = validateVariableDeclarationConfig`로 연결(`variable-declaration.schema.ts:1274`)
  - 상세: 신규 테스트는 순수함수 `validateVariableDeclarationConfig`/`validateVariableModificationConfig`를 직접 호출하는 형태로만 작성되어 있고(`*.schema.spec.ts`), `handler.validate(config)` 자체를 통해 예약-이름 케이스를 재확인하는 테스트는 없다(`*.handler.spec.ts`의 `describe('validate', …)` 블록에는 reserved 케이스가 없음 — L2 `execute()` 쪽에만 있음). 배선(`validateConfig: validateVariableDeclarationConfig`)은 같은 파일의 기존(비-reserved) `validate` 테스트들이 이미 간접적으로 exercise하고 있어 위험은 낮지만, `handler.validate()`를 통한 end-to-end 확인이 없다는 점은 사실이다.
  - 제안: 우선순위 낮음(중복 커버리지에 가까움) — 시간이 되면 `handler.spec.ts`의 `validate` describe 블록에 `handler.validate({ variables: [{ name: '__x', type: 'string' }] })`가 reserved 관련 에러 문자열을 포함하는지 1줄 단언 추가.

- **[INFO]** partial-write(부분 적용) 동작을 명시적으로 pin한 테스트는 우수한 관행으로 확인 — 결함 아님
  - 위치: `variable-declaration.handler.spec.ts:385-402` (`throws before writing the reserved variable (partial application is explicit)`)
  - 상세: 예약 변수보다 앞선 정상 변수(`safe`)는 이미 `context.variables`에 기록된 채로 노드가 throw한다는, 잠재적으로 놀라울 수 있는 동작을 테스트가 의도적으로 문서화하고 고정한다. 에러 포트가 없어 이 부분-적용이 사용자에게 관찰되지 않는다는 점까지 주석으로 남겨 의도를 명확히 했다 — 테스트 가독성·의도 표현 관점에서 모범적이다. (참고: 이 부분-적용 자체가 바람직한 설계인지는 별개 논점이며 테스트 리뷰 범위 밖.)

- **[INFO]** Mock 적절성 — 기존 컨벤션과 일관, 문제 없음
  - 위치: `workflows.service.spec.ts:379-385`(`saveCanvas`describe 레벨 `beforeEach`가 `mockRepository.findOne`을 세팅) / 신규 5개 테스트는 이를 재사용하며 별도 오버라이드 없음
  - 상세: 신규 테스트들은 describe-레벨 `beforeEach`에 의존해 반복 세팅을 피했고, `rejects.toMatchObject({ response: expect.objectContaining({ code: … }) })` 패턴도 같은 파일의 기존 `INVALID_TRIGGER_PARAMETERS` 테스트(`:521-527`)와 동일 관례를 그대로 따른다. `BadRequestException`의 `.response`가 공개 프로퍼티임을 직접 재현해 이 단언 패턴이 실제로 유효함을 확인했다. handler.spec.ts 쪽도 top-level `beforeEach`가 매 테스트마다 `handler`/`context`를 새로 생성해 테스트 간 상태 누수가 없다(`it.each` 순회 포함).

## 요약

3개 요청 항목(a: 해석된 이름에서 L2 발동 + 시스템 변수 보존, b: `{{ }}` 표현식이 L0을 통과, c: `restoreVersion` legacy-escape이 예약 변수명 케이스도 커버) 모두 정확히 요구된 형태로 테스트에 존재함을 확인했다. 추가로 L2 가드 제거 mutation을 직접 재현한 결과 정확히 11개(변경 대상 두 handler의 신규 describe 블록에 한정) 테스트만 실패하고 나머지 175개는 영향받지 않아, "L2 없으면 오직 reserved 테스트만 깨진다"는 주장이 정확함을 독립적으로 검증했다 — L0/L1/L2 세 계층의 테스트가 서로 다른 코드 경로를 배타적으로 지키고 있다. 남은 유일한 실질적 갭은 `importWorkflow` 경로의 L0 게이트(및 그 전용 `label`-fallback 분기)가 전혀 테스트되지 않는다는 점(WARNING) — `saveCanvas`가 5개 테스트로 두텁게 커버된 것과 비대칭이며, 코드 주석이 이 분기를 명시적으로 예고했음에도 아무 테스트도 이를 지나가지 않는다. 나머지(cross-node offender 집계, `handler.validate()` 경계를 통한 L1 재확인)는 낮은 우선순위의 INFO 수준 보강 여지다.

## 위험도

LOW

STATUS: DONE
