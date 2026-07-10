# 부작용(Side Effect) 리뷰 — `variables.__*` 예약 네임스페이스 3계층 강제

대상 커밋: `d8ce7693f feat(nodes/logic): variables.__* 예약 네임스페이스 3계층 강제 (RESERVED_VARIABLE_NAME)`

## 발견사항

- **[INFO]** `execute` 를 `async` 로 바꾼 것은 호출부 control flow 를 바꾸지 않는다 — 사전에 항상 `await` 되어 있었음
  - 위치: `codebase/backend/src/nodes/logic/variable-declaration/variable-declaration.handler.ts:63`, `codebase/backend/src/nodes/logic/variable-modification/variable-modification.handler.ts:66` (신규 `async` 키워드) / 호출부 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5844`(`return handler.execute(...)`, non-retry 분기), `:5856`(`return await handler.execute(...)`, retry 분기), 최상위 `:5361`(`const output = await this.executeWithRetry(...)`)
  - 상세: `NodeHandler.execute` 인터페이스(`nodes/core/node-handler.interface.ts:353-357`)는 변경 전에도 `Promise<NodeHandlerOutput>` 반환을 강제했고, 변경 전 구현체도 `return Promise.resolve({...})` 로 항상 Promise 를 반환했다 — 즉 반환 **타입**은 이번 PR 로 전혀 바뀌지 않았다(순수 `async` 키워드 추가는 컴파일 타깃 시그니처 변경이 아님). 엔진 측 유일한 호출부(`executeWithRetry`, 전체 저장소 grep 결과 `handler.execute(` 호출 지점은 이 두 라인뿐)는 두 분기 모두 이미 `async` 함수 안에서 실행되며, 최종적으로 `executeNode` 가 `await this.executeWithRetry(...)` 로 받는다(구조를 확인함). 따라서 (a) 이 메서드가 `async` 이든 아니든 정상 반환값 흐름은 동일하고, (b) 동기 throw 의 경우도 — `executeWithRetry` 자신이 `async` 이므로 body 안에서 발생하는 동기 throw 는 JS 엔진이 자동으로 reject 된 Promise 로 변환한다(async 함수 본문 내 동기 throw 는 항상 캐치되어 반환 Promise 의 rejection 이 됨). 즉 이번 caller 한정으로는 handler 자체가 `async` 가 아니어도 상위로 정상 전파됐을 것이다.
  - 결론: 커밋 코멘트가 주장하는 "non-async 함수가 동기 throw 하면 `execute(...).catch(...)` 처럼 await 없이 부르는 호출부에서 못 잡는다"는 **일반적으로는 맞는 방어적 이유**이지만, 실제 유일한 호출부(`executeWithRetry`)에 한해서는 이미 `async` 함수 바디 안에서 호출되므로 이 변환이 없어도 안전했다. 다만 방어적 관점(향후 non-async 호출부 추가 가능성 차단)에서 `async` 로 명시하는 것은 정당하고 실제 회귀는 없음 — **부작용 없음, 정보 제공 목적으로만 기록**.
  - `handler.validate(...)` (동기 메서드, 별도)는 이번 PR 에서 변경되지 않았고 이 분석과 무관.

- **[WARNING]** L2 가드가 루프 도중 throw — 두 핸들러 모두에서 이번 PR 이 **처음으로** "부분 mutation 후 throw" 경로를 도입했고, 엔진의 범용 `errorPolicy`(`skip_node`/`use_default_output`/`route_to_error_port`) 와 결합하면 부분 상태가 하류로 유출될 수 있다
  - 위치: `variable-declaration.handler.ts:63-74`(루프 상단에서 `isReservedVariableName` 체크 후 throw, 그 아래에서 `context.variables[variable.name] = coerced` 쓰기) / `variable-modification.handler.ts:79-88`(동일 패턴, `applyModification` 호출 전에 체크) / 엔진 쪽 `execution-engine.service.ts:5878-5895`(`getErrorPolicyConfig` — 노드 타입 무관 범용) 및 `:5529-5605`(`errorPolicyHandler.handleError` 결과 `skip`/`use_default`/`route_error` 분기가 `executedNodes.add(node.id)` 로 **워크플로우 진행을 멈추지 않음**, `error/error-policy.handler.ts:47-90`)
  - 상세: `variables[0]='safe'`(정상) → 이미 `context.variables['safe']='v'` 로 기록 → `variables[1]='__x'`(예약) → throw. 신규 테스트(`variable-declaration.handler.spec.ts` "throws before writing the reserved variable")가 이 부분 mutation 을 명시적으로 pin 하고, 주석은 "노드가 실패하면 실행이 중단되므로(에러 포트 없음) 이 부분 적용은 관찰되지 않는다"고 적는다. 그러나 이 주장은 **기본 에러 정책(`stop_workflow`)에서만** 성립한다. `getErrorPolicyConfig`(`node.config.errorHandling`)는 노드 타입과 무관하게 모든 노드에 적용되는 **범용** 메커니즘이라, 워크플로우 작성자가 이 variable_declaration/variable_modification 노드에 `errorPolicy: 'skip_node'`(또는 `use_default_output`/`route_to_error_port`)를 설정하면, 엔진은 노드를 SKIPPED/COMPLETED(default output)/FAILED-but-routed 로 기록하고 **그래프 진행을 멈추지 않는다**(`execution-engine.service.ts:5541-5595`, 세 케이스 모두 `throw` 하지 않고 `executedNodes.add(node.id)`). 이 경우 이미 기록된 `context.variables['safe']='v'` 는 하류 노드의 `$var.safe` 표현식에서 **그대로 관찰**된다 — "관찰 불가능"이라는 주석의 전제가 깨진다.
  - 변경 전에는 이 두 핸들러의 실행 루프에 throw 경로 자체가 없었으므로(항상 전체 루프를 완주), 이런 "부분 mutation + 비-stop 에러 정책" 조합은 이 두 노드 타입에서 **원천적으로 불가능**했다. 이번 PR 이 최초로 이 조합을 가능하게 만든 것 — 엔진 자체의 버그는 아니고(다른 노드 타입도 이미 겪는 일반적 클래스), 두 노드 spec("§6 — 런타임 에러 포트를 갖지 않는다")의 서술이 실질적으로는 엔진 레벨 범용 errorPolicy 로 우회될 수 있다는 점을 반영하지 못한다는 문서-코드 간극이다.
  - 제안: (a) 최소한 handler 주석/spec §6 각주에 "이 partial-write 는 오직 기본 `stop_workflow` 정책에서만 비관측이며, 노드에 `skip_node`/`use_default_output`/`route_to_error_port` 를 설정하면 관측 가능하다"를 명시하거나, (b) 더 견고하게는 mutation 을 시작하기 전에 배열 전체를 한 번 스캔해 예약 이름을 먼저 검출(early full-scan)한 뒤에만 실제 쓰기 루프를 도는 방식으로 바꿔 "all-or-nothing" 원자성을 보장. schema-level validator(L1)가 이미 배열 전체를 스캔하는 방식(`for (let i = 0; i < variables.length; i++)`)이라 handler 에서도 같은 패턴(2-pass: validate 전체 → write 전체)을 재사용하면 이 클래스의 side-effect 를 근본적으로 없앨 수 있다.

- **[INFO]** `saveCanvas`/`restoreVersion` 신규 게이트는 트랜잭션 진입 **이전**에 실행되어 부분 DB 쓰기 위험이 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:412-416`(`saveCanvas` — `validateReservedVariableNames` 가 `this.dataSource.transaction(...)` 호출보다 먼저 실행) / `:274-277`(`importWorkflow` — DB insert 이전)
  - 상세: 두 곳 모두 신규 검증이 어떤 `manager.save`/`insert` 호출보다 앞서 배치되어 있어, throw 가 발생해도 부분 커밋된 워크플로/노드/에지가 남지 않는다. 순수 read-only 검증(로컬 `offenders` 배열만 구성 후 throw)이라 전역 상태·파일시스템·네트워크 부작용 없음.

- **[INFO]** `saveCanvas` 5번째 파라미터 리네임(`skipParamSchemaValidation` → `skipLegacyDataGates`)은 순수 식별자 변경 — `restoreVersion` 동작에 실질적 변화 없음
  - 위치: `workflows.service.ts:399-416`(파라미터 선언 및 사용부), 호출부 전수 확인 — `modules/workflows/workflows.controller.ts:453`(`saveCanvas(id, workspaceId, user.sub, dto)`, 5번째 인자 미전달 → 기본값 `false` 유지) / `workflows.service.ts:487-493`(`restoreVersion` 내부 호출, `/* skipLegacyDataGates */ true` — 이름만 바뀐 동일한 위치 인자)
  - 상세: `saveCanvas` 는 파라미터가 포지셔널로만 호출되고(`saveCanvas(` 전체 grep 결과 이 두 호출부 외 없음) 외부에 named-parameter 로 노출되지 않으므로, 식별자 리네임은 어떤 호출자에도 영향이 없다. 실질적 동작 변화는 **의도된** 것 하나뿐: `restoreVersion`(레거시 스냅샷 복원)이 이제 Manual Trigger 파라미터 스키마 게이트뿐 아니라 신규 `RESERVED_VARIABLE_NAME` L0 게이트도 함께 스킵한다 — 새 테스트("restores a snapshot with a reserved `__` variable name without a 400")가 정확히 이 동작을 고정한다. `validateManualTrigger` 자신의 내부 파라미터명(`workflows.service.ts:601` `skipParamSchemaValidation`)은 변경되지 않았고 별도 스코프라 혼동 없음. **`restoreVersion` 의 기존(Manual Trigger) 동작은 변경 없음** — 예전에 스킵되던 것은 계속 스킵되고, 신규 검증만 같은 플래그를 공유해 추가로 스킵된다(레거시 스냅샷은 여전히 L2 런타임에서 실패로 드러남, 문서화됨).

- **[INFO]** 신규 실패 경로가 처음으로 두 노드 타입에 대해 엔진 이벤트(`NODE_SKIPPED`/`NODE_FAILED`)를 발생시킬 수 있게 됨 — 기존 범용 메커니즘 재사용, 신규 이벤트 타입 없음
  - 위치: `execution-engine.service.ts:5541-5605`(`skip`→`NODE_SKIPPED` emit, `stop`/`default`→`NODE_FAILED` emit; `use_default`/`route_error` 는 emit 없음, 기존 로직 그대로)
  - 상세: 위 WARNING 항목과 동일 원인(이번에 처음 열린 throw 경로)의 파생 효과다. 새 이벤트 타입이나 새 emitter 호출 지점을 추가한 것이 아니라 기존 범용 에러-정책 이벤트 발행 로직을 그대로 재사용하므로 "이벤트/콜백 변경" 관점에서는 신규 부작용이 아니다.

- **[INFO]** `NodeHandler` 인터페이스·공개 API 자체는 변경 없음
  - 위치: `nodes/core/node-handler.interface.ts:351-358`
  - 상세: `execute()` 시그니처(`Promise<NodeHandlerOutput>`)는 이번 PR 로 수정되지 않았다. `saveCanvas`/`importWorkflow` 의 REST 응답 쪽만 신규 400 에러 코드(`RESERVED_VARIABLE_NAME`, `details.offenders[]`)를 추가로 반환할 수 있게 됐는데, 이는 CHANGELOG "Breaking changes" 섹션에 이미 명시적으로 문서화된 **의도된** 인터페이스 확장(기존 200 이 400 으로 바뀔 수 있는 케이스)이라 "의도치 않은" 부작용은 아니다.

## 요약

async 전환은 실질적 control-flow 변화가 없다 — 엔진의 유일한 `handler.execute` 호출부(`executeWithRetry`, 최상위에서 `await` 됨)는 이미 async 함수 바디 안에 있어 non-async 상태에서도 throw 는 안전하게 전파됐을 것이고, 인터페이스 반환 타입도 이전부터 `Promise<NodeHandlerOutput>` 이었다 — 따라서 이 변경은 방어적이지만 회귀 위험은 없다. 가장 실질적인 발견은 L2 가드가 두 핸들러에 **처음으로** "부분 mutation 후 mid-loop throw" 경로를 도입했다는 점이다 — 신규 테스트/주석이 "부분 적용은 관찰되지 않는다"고 주장하지만, 이는 엔진의 범용 `errorPolicy`(`skip_node`/`use_default_output`/`route_to_error_port`, 노드 타입 무관 공통 메커니즘)가 이 노드에 설정된 경우 성립하지 않는다 — 이전에 앞서 쓰인 변수가 하류에 노출될 수 있다. 이는 이번 PR 이전에는 이 두 노드 타입에서 원천적으로 불가능했던 조합이므로 문서화 보강 또는 2-pass(전체 스캔 후 쓰기) 리팩터를 권고한다. `saveCanvas`/`importWorkflow` 의 신규 L0 게이트는 트랜잭션·DB insert 이전에 위치해 부분 커밋 위험이 없고, `skipParamSchemaValidation`→`skipLegacyDataGates` 리네임은 포지셔널-전용 내부 파라미터라 호출자 영향이 없으며 `restoreVersion` 은 의도한 대로(신규 게이트도 레거시 이스케이프에 포함) 동작한다.

## 위험도

LOW

STATUS: DONE
