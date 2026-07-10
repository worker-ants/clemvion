# 요구사항(Requirement) 리뷰 — `variables.__*` 예약 네임스페이스 3계층 강제

## 검증 방법
diff 텍스트뿐 아니라 실제 워크트리(`reserved-var-prefix-enforce-dedbde`, HEAD `d8ce7693f`)의 코드를 직접 읽고, 관련 unit 테스트(186개, 6 suite)를 실행해 통과를 확인했으며, `tsc --noEmit` 결과를 base 커밋(`b251b73ee`)과 diff 하여 이 PR 이 신규 타입 에러를 도입하지 않았음을 확인했다. 엔진 실측 코드(`execution-engine.service.ts`, `expression-resolver.service.ts`, `expression-exclusions.ts`)를 대조해 L0/L1/L2 각 계층의 실제 호출 경로와 "L2 가 실질 강제 지점" 이라는 주장을 코드 레벨로 재현·검증했다.

## 발견사항

### [INFO] 기능 완전성 — 3계층 강제가 실제로 성립함을 코드로 재확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5278`(`handler.validate(node.config)`, 원본 미해석 config) → `:5321`(`resolveConfig(node.config, ...)`, validate **이후** 실행) → `:5844`/`:5856`(`handler.execute(input, resolvedConfig, context)`, 해석 후 config)
- 상세: `expression-exclusions.ts` 의 `EXPRESSION_EXCLUSIONS` 에 `variable_declaration`/`variable_modification` 이 없음을 직접 확인했고, `expression-resolver.service.ts` 의 `resolveObject`/`resolveValue`(:212-283)가 `excludeKeys` 를 최상위 키에만 적용하고 배열/중첩 객체는 무조건 재귀 해석함을 확인했다 — 즉 `variables[i].name`/`modifications[i].variable` 은 리터럴이 `{{ }}` 를 포함하면 실행 직전 항상 재평가된다. L0(`saveCanvas`/`importWorkflow`)·L1(`validateConfig`)은 이 재평가 **이전** 시점에서만 동작하므로 리터럴만 잡고, L2(`handler.execute`)만 해석된 실제 이름을 본다. PR 의 핵심 주장("L2 가 예약의 실질 강제 지점")이 코드로 실증됨 — 이전 컨센서스 체크(`review/consistency/2026/07/11/00_03_30/cross-spec.md`)가 Critical 로 지적한 "schema-level reject 만으로는 강제가 아니다" 문제를 이 PR 이 실제로 해소한다.
- 결론: 문제 없음, 확인용 기록.

### [INFO] L0/restoreVersion legacy-data escape 정확성 확인
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:398-416`(`saveCanvas`, `skipLegacyDataGates` 매개변수) · `:450-491`(`restoreVersion` → `saveCanvas(..., true)`) · `:269-278`(`importWorkflow`, 항상 게이트 on)
- 상세: `importWorkflow` 의 `ImportNodeDto`(`import-workflow.dto.ts:23-63`)에는 `id` 필드가 아예 없어(클라이언트가 id 를 지정할 수 없음) `validateReservedVariableNames` 의 `node.id ?? node.label ?? ''` fallback 이 항상 `label` 을 쓰게 되는 것을 직접 확인했다 — 주석("ids are regenerated after this gate")과 실제 타입 정의가 일치. `SaveCanvasNodeDto.id`(`save-canvas.dto.ts:18-27`)는 필수 필드라 `saveCanvas` 경로는 항상 `node.id` 를 쓴다. `restoreVersion` → `saveCanvas(workflowId, workspaceId, userId, dto, /* skipLegacyDataGates */ true)` 호출 체인을 코드로 확인 — 스냅샷 복원 시 `validateReservedVariableNames` 가 스킵되고, 대신 실행 시 L2 가 잡는다는 설계 그대로 동작. `restoreVersion` 테스트("restores a snapshot with a reserved `__` variable name without a 400")가 이 경로를 정확히 커버.
- 결론: 문제 없음.

### [INFO] L1 에러 코드 전파 경로 확인 — 스펙 표의 "L1 → INVALID_NODE_CONFIG" 주장 실증
- 위치: `codebase/backend/src/nodes/core/metadata-validation.ts:46`(`metadata.validateConfig?.(config)` 를 `evaluateMetadataBlockingErrors` 가 호출) · `execution-engine.service.ts:5278-5292`(`handler.validate` 실패 시 `INVALID_NODE_CONFIG: ...` 로 throw)
- 상세: `VariableDeclarationHandler.validate()`/`VariableModificationHandler.validate()` 가 `evaluateMetadataBlockingErrors(this.metadata, config)` 를 통해 `validateVariableDeclarationConfig`/`validateVariableModificationConfig`(신규 `else if (isReservedVariableName(...))` 분기 포함)를 호출하는 체인을 코드로 확인했다. 따라서 두 spec 문서 §6 표의 "L1 → `INVALID_NODE_CONFIG`" 주장이 정확하다.
- 결론: 문제 없음.

### [WARNING] 사전 consistency-check(plan-coherence)가 지적한 `node-output-redesign` 서브 plan 라인 인용 stale 화가 이번 PR 에서 미해결로 남음
- 위치: `plan/in-progress/node-output-redesign/variable-declaration.md:89,111` (`warningRules` → `variable-declaration.schema.ts:117-128`, `executionMetadata.kind` → `schema.ts:110`), `plan/in-progress/node-output-redesign/variable-modification.md:102-103`(`schema.ts:111-144`, `schema.ts:162-173`)
- 상세: 실제 현재 코드를 확인한 결과 `variable-declaration.schema.ts` 의 `executionMetadata` 는 118행, `warningRules:` 는 125행(각 +8), `variable-modification.schema.ts` 의 `warningRules:` 는 170행, `validateConfig:` 는 182행으로 신규 `else if` 분기·import 삽입만큼 밀려 있다. 이 stale 화는 이번 PR 착수 전 consistency-check(`review/consistency/2026/07/11/00_03_30/plan-coherence.md` WARNING #5)가 정확히 예견하고 "이번 PR 안에서 라인 인용 갱신"을 권고했던 항목인데, 실제 커밋 diff 에는 두 서브 plan 문서에 대한 갱신이 포함되지 않았다(diff 대상 파일 목록에 `plan/in-progress/node-output-redesign/*` 없음).
- 제안: `developer` 후속 커밋으로 두 서브 plan 문서의 라인 인용을 현재 코드에 맞춰 갱신(해당 클러스터의 기존 "N차 갱신" 관례 포맷을 따름). 코드 자체의 결함은 아니며 plan 문서 정합성 부채.

### [WARNING] 사전 consistency-check(convention-compliance)가 권고한 "PROJECT.md doc-sync-matrix 검토 완료" 명시가 spec/CHANGELOG 어디에도 남지 않음
- 위치: `spec/conventions/execution-context.md` `## Rationale`(신규 3단락), `CHANGELOG.md`(신규 항목) — 둘 다 "PROJECT.md node-schema-change matrix" 또는 "유저 가이드 갱신 불요" 를 언급하지 않음. `codebase/frontend/src/content/docs/02-nodes/logic.mdx` 에도 `__`/reserved 관련 문구가 전혀 없음(grep 0건, carousel `__item_` 선례와 동일 패턴이라는 점은 이전 리뷰가 이미 확인함).
- 상세: 사전 convention-compliance 검토(`review/consistency/2026/07/11/00_03_30/convention-compliance.md` Warning)가 "검토 누락이 아니라 검토했고 해당 없음을 문서에 남겨야 후속 감사 반복 조사를 막는다"고 명시적으로 권고했으나, 실제 커밋된 spec/CHANGELOG 본문에 이 한 줄이 반영되지 않았다. 기능적 결함은 아니고, 향후 `/spec-coverage` 나 `user-guide-sync-reviewer` 가 동일 갭을 반복 재조사할 낭비 리스크만 있다.
- 제안: `execution-context.md` `## Rationale` 또는 CHANGELOG 항목에 한 줄("PROJECT.md node-schema-change 매트릭스 검토 완료 — FieldTable 갱신 불요, carousel `__item_` 선례와 동일하게 저수준 예약 prefix 는 유저 가이드 비문서화 관행 유지") 추가 권고.

### [INFO] `async execute` 전환의 실제 필요성 — 정당하나 코드 주석의 근거가 현재 유일한 production 호출 지점과는 다소 어긋남
- 위치: `variable-declaration.handler.ts:33-35`, `variable-modification.handler.ts:63-65` (`// async 필수: ... execute(...).catch(...) 처럼 await 없이 부르는 호출부에서 잡히지 않는다`)
- 상세: `handler.execute(` 의 유일한 production 호출부(`execution-engine.service.ts:5844,5856`)는 모두 `private async executeWithRetry(...)` 내부에 있고 이 함수는 항상 `await this.executeWithRetry(...)`(`:5361`)로 호출된다. JS 의미상 async 함수 본문 안에서의 동기 throw 는 (호출 대상 함수가 async 이든 아니든) async 함수의 반환 Promise 를 정상적으로 reject 시키므로, 이 특정 production 경로만 놓고 보면 `execute` 를 non-async 로 둬도 안전하다. 다만 주석의 우려는 **직접 호출**(예: `variable-declaration.handler.spec.ts` 의 `expect(handler.execute(...)).rejects.toThrow(...)` 패턴, 또는 향후 async 래퍼 없이 `.catch()` 를 붙이는 호출부)에는 실제로 유효하다 — non-async 함수가 함수 진입 직후 동기 throw 하면 `expect(...)` 인자 평가 시점에 즉시 throw 되어 `.rejects` matcher 가 개입할 기회가 없다. 즉 `async` 전환 자체는 정당하고 필요(테스트의 `.rejects.toThrow` 패턴을 실제로 성립시킴)하나, 주석의 "execute(...).catch(...) 호출부에서 안 잡힌다"는 근거 서술이 실제 production 호출부 상황을 정확히 반영하지 않고 다소 과장돼 있다. 기능적 결함 아님, 코드 정확성 낮은 severity 의견.
- 제안: 필요시 주석을 "현재 production 경로는 안전하지만, 테스트/향후 직접 호출부를 위한 방어적 조치" 로 다듬으면 더 정확 (선택 사항, 액션 불요).

### [INFO] 엣지 케이스 — 검증된 항목
- `variables[i].name`/`modifications[i].variable` 필수값 누락 시 `else if` 구조로 reserved-check 가 stacking 되지 않음(테스트 `does not stack the reserved error on top of the missing-name/variable error` 로 고정, 실제 코드의 if/else-if 순서와 일치 확인).
- 단일 `_`(single underscore)는 `isReservedVariableName`(`startsWith('__')`)에서 통과 확인 — `_`, `_foo`, `a__`(접두가 아닌 중간/말단 `__`), 빈 문자열 `''` 모두 예약 아님으로 정확히 분류(`reserved-variable-name.util.spec.ts`).
- 비-string 입력(`undefined`/`null`/`42`/`{}`/`['__x']`)에 대해 `isReservedVariableName` 이 `false` 를 반환 — "name-required 체크가 별도로 담당" 이라는 설계 의도와 실제 구현(`typeof name === 'string' && ...`)이 일치.
- L2 partial-application 케이스(예약 변수 이전 항목은 이미 쓰여진 상태에서 throw)는 "명시적으로 관찰됨/의도적" 이라고 주석·테스트에 정확히 기록돼 있고, 노드에 error 포트가 없어 실행이 즉시 중단되므로 실사용자에게는 관찰되지 않는 이론적 케이스임을 코드 주석이 정직하게 밝힘 — 의도와 구현 일치.
- variable-modification 의 6개 연산(set/increment/decrement/append/push/pop) 전부가 `applyModification` 진입 **전** 단일 루프 가드를 통과하므로 예약 이름이 어떤 연산으로도 시스템 변수를 건드릴 수 없음을 테스트(`it.each` 6개 연산)와 실제 코드 배치(가드가 `applyModification` 호출 전)로 함께 확인.

### [INFO] spec fidelity — 4개 spec 문서(§6 표 2건, 원칙 5, error-handling 카탈로그) 모두 line-level 로 구현과 일치
- `spec/4-nodes/1-logic/4-variable-declaration.md:150-151`, `5-variable-modification.md:158-159` 의 신규 §6 표 두 행(L0+L1 통합 행 / L2 행)이 실제 에러 코드(`RESERVED_VARIABLE_NAME`)·메시지 포맷·발생 위치와 정확히 일치.
- `spec/5-system/3-error-handling.md:85` 카탈로그 신규 행이 L0(HTTP 400)·L2(message-prefix, 엔진 노드 실패 분류)를 정확히 구분해 서술 — L2 는 HTTP 상태가 아니라는 점을 본문이 명시하고 있어 오해 소지 없음.
- `spec/conventions/execution-context.md:70-73` "강제 (3계층)" 개정과 `## Rationale` 신규 단락(:108-110)이 "강제 갭"(도입 커밋 `d2b4590a2`, PR #889 이 예고한 후속) → "강제" 로의 정합적 전환이며, 사전 rationale-continuity 검토가 지적한 관찰가능성 구분(§관찰 가능한 silent vs 관찰 불가능한 opaque silent)도 신규 Rationale 에 명시적으로 반영돼 있음을 확인.
- Code 노드 잔여 리스크 서술(`nodes/data/code/code.handler.ts:464,476`)의 라인 인용을 실제 코드로 대조 — 정확.

## 요약
`variables.__*` 예약 네임스페이스의 3계층(L0 저장 시점/L1 pre-flight/L2 런타임) 강제는 실제 코드(`execution-engine.service.ts`·`expression-resolver.service.ts`·`expression-exclusions.ts`·`workflows.service.ts`·두 노드 handler/schema)와 직접 대조한 결과 의도한 대로 정확히 구현돼 있다. 특히 이 PR의 핵심 주장 — "리터럴만 보는 L0/L1 은 `{{ }}` 표현식 이름을 우회당하고, 오직 L2(해석 후 검사)만이 실질적 강제 지점" — 은 엔진의 `handler.validate`(원본 config) → `resolveConfig`(표현식 재평가) → `handler.execute`(해석된 config) 순서와 `EXPRESSION_EXCLUSIONS` 에 두 노드가 미등재된 사실을 코드 레벨로 재현해 검증했다. 4개 spec 문서(원칙 5, 두 노드 §6, error-handling 카탈로그)는 에러 코드·메시지·시점·기본값(restoreVersion escape)까지 구현과 line-level 로 일치하며, 186개 관련 unit 테스트가 전부 통과하고 이 PR 이 신규 TypeScript 에러를 도입하지 않았음도 직접 확인했다. 남은 이슈는 기능 결함이 아니라 문서 정합성 부채 2건 — (1) 사전 consistency-check 가 예견한 `node-output-redesign` 서브 plan 문서의 라인 인용 stale 화가 이번 PR 에서 갱신되지 않았고, (2) PROJECT.md doc-sync-matrix 검토 완료 사실이 spec/CHANGELOG 에 명시되지 않았다 — 둘 다 후속 커밋으로 가볍게 해소 가능한 WARNING 이다.

## 위험도
LOW

STATUS: DONE
