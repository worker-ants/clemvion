# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `pickCulprit` / `pickCulpritProvider` — "범인 provider" 탐색 로직이 두 파일에 동일하게 중복 구현됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` (신규 `pickCulprit`, 파일 끝부분) vs `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` (기존 `pickCulpritProvider`)
  - 상세: 두 함수 모두 `perProvider` 배열을 순회하며 `bytes` 최댓값 그룹의 `key` 를 반환하는 완전히 동일한 로직이다(변수명만 `culprit`/`top` 로 다름). `tool-payload-save-warning.ts` 는 신규 파일이므로 이 중복은 이번 변경에서 새로 생긴 것이다. `tool-payload-budget.ts` 의 `pickCulpritProvider` 는 현재 export 되지 않아 재사용이 물리적으로 불가능한 상태였다.
  - 제안: `pickCulpritProvider` 를 `tool-payload-budget.ts` 에서 export 하고 `tool-payload-save-warning.ts` 가 이를 import 해 재사용. 신규 `pickCulprit` 삭제.

- **[WARNING]** 예산 초과 메시지 템플릿이 세 번째로 유사 중복됨 — 기존에 이미 한 차례 통합했던 패턴이 재분기
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts:evaluateNodeToolPayload` (message 조립부) vs `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:buildBudgetExceededPrefix`/`buildExceededMessage`
  - 상세: `tool-payload-budget.ts` 의 `buildBudgetExceededPrefix` 주석에는 "hard(throw)·soft(warn) 두 메시지가 공유하는 본문 ... (INFO6, 03 리뷰 — 중복 템플릿 통합)" 이라고, 과거 리뷰에서 동일 템플릿 중복을 이미 한 번 지적받아 통합한 이력이 명시돼 있다. 이번 PR 이 추가한 `evaluateNodeToolPayload` 는 `AI Agent tool definitions serialize to N bytes across M tools, exceeding the {budget} of B bytes(, largest contributor: "key")` 문구와 꼬리 문장 `Reduce exposed tools via mcpServers[].enabledTools allowlist or disable the server.` 를 다시 인라인 문자열 concat 으로 재구현했다(노드 라벨만 추가). `buildBudgetExceededPrefix`/`buildExceededMessage` 가 export 되지 않아 재사용이 불가능했던 것이 원인으로 보인다.
  - 제안: `buildBudgetExceededPrefix` 를 export 하고 앞에 노드 라벨을 붙이는 형태로 재사용하거나, 공통 메시지 빌더를 두 axis(runtime error / config-time warning)가 공유하도록 시그니처를 확장. 최소한 꼬리 안내 문장(`Reduce exposed tools via ...`)만이라도 상수/함수로 공유해 문구 drift 를 막는 것을 권장.

- **[WARNING]** cafe24/makeshop 두 provider 의 JSON Schema 빌더·allowlist 함수가 구조적으로 100% 동일한 채 module-level 로 재승격되었으나 통합되지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (`buildCafe24JsonSchema`, `applyCafe24Allowlist`) vs `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` (`buildMakeshopJsonSchema`, `applyMakeshopAllowlist`)
  - 상세: 두 `buildXxxJsonSchema` 함수는 `op.fields`/`op.constraints`/`op.requiredFields` 순회 로직·oneOf→allOf 변환 로직이 주석까지 포함해 라인 단위로 동일하다(makeshop 쪽 주석은 "same mapping as cafe24" 라고 스스로 인정). `applyCafe24Allowlist`/`applyMakeshopAllowlist` 도 4줄 로직이 완전히 동일하다. 이번 PR 은 두 인스턴스 메서드를 module-level pure 함수로 "승격"하면서 drift-0 재사용(config-time ↔ runtime) 목적을 달성했지만, cafe24 ↔ makeshop 축의 중복은 그대로 이식·유지했다. `Cafe24OperationMetadata`/`MakeshopOperationMetadata` 의 `fields`/`constraints`/`requiredFields` shape 이 사실상 동일 구조라면 제네릭 공용 함수로 추출 가능해 보인다.
  - 제안: 두 provider 가 공유하는 `buildJsonSchemaFromFields<T>`/`applyAllowlist` 를 별도 공용 모듈(예: `tool-providers/shared/json-schema.ts`)로 추출해 이번 기회에 cafe24/makeshop 축 중복까지 제거를 검토. 최소한 이번 PR 범위가 아니라면 TODO/후속 plan 항목으로 명시 남기기를 권장(현재는 "재사용" 의도만 주석에 있고 실제 통합은 안 됨).

- **[INFO]** `evaluateNodeToolPayload` 가 한 함수 안에서 초과 판정·severity 승격·budget label 선택·메시지 조립·params 구성 5가지 책임을 수행
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts:evaluateNodeToolPayload` (약 45줄)
  - 상세: 주석으로 각 단계가 잘 구분돼 있어 즉각적인 가독성 저하는 크지 않으나, 메시지 문자열 조립(위 WARNING 항목)과 결합해 함수가 다소 비대하다.
  - 제안: 메시지 빌더를 분리(위 WARNING 제안과 함께 처리)하면 자연히 함수도 짧아진다.

- **[INFO]** optional 필드를 `params`/결과 객체에 추가하는 스타일이 같은 PR 내에서 두 가지로 혼재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:enforceToolPayloadBudget` (`...(culpritProvider ? { culpritProvider } : {})` spread 패턴) vs `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts:evaluateNodeToolPayload` (`if (culprit) params.culprit = culprit;` 조건부 mutate 패턴)
  - 상세: 기능은 동일(있으면 추가)하지만 스타일이 다르다. 사소하지만 동일 도메인(도구 payload 예산) 코드 내 일관성 관점에서 눈에 띈다.
  - 제안: 한 스타일로 통일(택일은 자유, 팀 컨벤션에 맞춰).

- **[INFO]** 테스트 파일 3곳에 걸쳐 "예산을 강제로 초과시키는" 하드코딩 값(`'10'`, `'100000000'` 등)이 매직 넘버로 반복
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts`, `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.spec.ts`, `codebase/backend/test/ai-agent-tool-payload-warning.e2e-spec.ts`
  - 상세: 각 파일이 개별적으로 `process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10'` 류의 값을 재정의한다. 테스트 코드이므로 실제 유지보수 위험은 낮으나, 의미를 드러내는 이름(`TINY_BUDGET_BYTES` 등) 없이 산재된 숫자 리터럴이라 "왜 10인지"를 매번 주석에 의존해 설명한다(실제로 각 파일이 그렇게 하고 있어 즉각적 위험은 낮음).
  - 제안: 낮은 우선순위. 필요 시 공용 테스트 헬퍼 상수로 추출.

## 요약

이번 변경은 AI Agent 도구 payload 예산 경고를 저장 시점(config-time)까지 확장하는 기능으로, 기존 코드베이스의 짙은 한국어 주석·spec 인용 컨벤션을 일관되게 따르고 있고 함수 단위 책임 분리(`evaluateToolPayloadWarnings`/`evaluateToolPayloadWarningsAndThrow`/`loadIntegrationForBudget`)도 대체로 명확하다. `getGraphWarnings` 반환 타입을 `ReturnType<typeof ...>` 추론에서 명시적 `GraphWarningRuleResult[]` 로 바꾼 것도 가독성에 긍정적이다. 다만 신규 모듈(`tool-payload-save-warning.ts`)이 기존 `tool-payload-budget.ts` 의 "범인 provider 탐색" 로직과 예산 초과 메시지 템플릿을 export 부재로 인해 다시 인라인 복제했고, cafe24/makeshop 두 provider 간에 이미 존재하던 JSON Schema 빌더·allowlist 중복도 이번에 module-level 로 승격되며 그대로 보존됐다 — 특히 메시지 템플릿 쪽은 과거 리뷰(INFO6, "03 리뷰")에서 이미 한 차례 통합했던 이력이 주석에 남아있는 만큼 재발이 아쉽다. 모두 export 하나만 추가하면 해소되는 낮은 비용의 개선이라 CRITICAL 로 보지는 않지만, 후속 정리를 권장한다.

## 위험도
LOW
