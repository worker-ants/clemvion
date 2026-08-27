# 부작용(Side Effect) 코드 리뷰

## 검토 범위

핵심 변경 파일을 실제 소스(`Read`/`Bash grep`)로 직접 열어 대조했다: `handler-output.adapter.ts`,
`handler-output.adapter.spec.ts`(diff 생략분 포함, `git diff` 로 전문 확인), `mask-sensitive-fields.util.ts`,
`mask-sensitive-fields.util.spec.ts`, `ai-turn-executor.ts`(주석만 변경). `adaptHandlerReturn` /
`maskSensitiveFields` 의 전체 호출부(`ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`,
`execution-context.service.ts`, `explore-tools.service.ts`)를 grep 으로 대조해 다운스트림 부작용을 점검했다.
`plan/**`·`spec/**`·`review/**` 문서 변경은 부작용 관점의 대상이 아니므로(코드 동작 변경 없음) 최소 확인만 했다.

## 발견사항

- **[INFO]** `config` 가 더 이상 deep-clone 되지 않고 핸들러 원본 객체가 참조로 장기 캐시에 들어간다 — PR 자신이 인지·캐너리로 고정했지만, 그 캐시가 별도 API(`setEngineResolvedConfig`)가 명시적으로 회피하는 바로 그 aliasing 패턴이다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53` (`config: r.config ?? {}`), 캐너리 `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:164` (`it('[캐너리] config 는 clone 되지 않고 참조로 전달된다 …')`)
  - 상세: 종전 `maskSensitiveFields`(재귀마다 `out: Record<string, unknown> = {}` 새로 생성)는 마스킹의 부산물로 **암묵적 deep-clone**을 겸했다. 이번 변경으로 `config`는 핸들러가 반환한 객체를 **참조 그대로** 통과시킨다 — PR 스스로도 이 사실을 인지해 캐너리(`out.config === rawConfig`, `out.config.nested === rawConfig.nested`)로 고정했고, 주석에 "핸들러가 반환 후 자기 config 를 변형하면 그것이 저장·emit 값에 보인다"고 명시했다. 문제는 이 참조가 흘러 들어가는 자리다: `adaptHandlerReturn` 의 결과는 `ExecutionContextService.setStructuredOutput` 을 거쳐 `context.structuredOutputCache[nodeId] = adapted;`(diff 밖 `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:151`)에 **그대로(방어적 복사 없이)** 저장되며, 이 캐시는 실행 그래프 전체에서 다운스트림 노드의 표현식 평가(`$node["X"].config.<field>`)가 참조하는 장기 생존 캐시다. 같은 파일의 자매 API `setEngineResolvedConfig`(`execution-context.service.ts:166`)는 JSDoc 에 "Shallow-copies the input so callers can keep mutating their local … reference without leaking changes into the cache" 라고 **정확히 이 위험을 이유로** 방어적 복사를 하는데, `structuredOutputCache` 경로는 그 방어가 없다. 현재 핸들러 코드 중 반환 후 자기 config 를 in-place 로 변형하는 사례는 grep 상 발견되지 않았고(향후 발생 시 캐너리가 놓치지는 않는다 — 이미 aliasing 을 `toBe` 로 단언), 실행 시점의 실측 위험은 낮다. 다만 "새 전역/공유 상태의 의도치 않은 변경" 관점에서 구조적 사각(캐시가 참조를 공유하는데 그 사실이 이 자리에서는 문서화·방어되지 않음)이 새로 생겼다는 점은 남는다.
  - 제안: 회귀는 아니므로 차단 사유는 아니다. 다만 `setStructuredOutput` JSDoc 에 "저장된 `config` 는 핸들러 원본 객체에 대한 참조이며 얕은 복사를 하지 않는다 — 호출자가 반환 후 그 객체를 변형하면 캐시도 함께 바뀐다" 를 `setEngineResolvedConfig` 와 대칭으로 명시해 다음 사람이 같은 실수(핸들러가 config 를 재사용/변형)를 캐너리 없이 저지르지 않도록 하는 것을 고려.

- **[INFO]** `DEFAULT_SENSITIVE_KEYS` 를 모듈-private 상수에서 공개 export 로 전환 — 런타임 소비처는 없다고 명시했지만, `ReadonlySet` 타입은 컴파일 타임 가드일 뿐 런타임 mutable Set 자체를 얼리지 않는다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10` (`export const DEFAULT_SENSITIVE_KEYS: ReadonlySet<string> = new Set([...])`)
  - 상세: 종전에는 이 상수가 파일 스코프에 갇혀 있어 다른 모듈이 절대 이 Set 인스턴스에 접근할 수 없었다. 이제 어떤 모듈이든 import 해 타입 단언(`as Set<string>`)으로 `.add()`/`.delete()` 를 호출하면, **프로세스 전역 싱글턴**이 변경되어 그 순간부터 `maskSensitiveFields` 의 기본 인자를 쓰는 **모든** 호출자(현재는 `explore-tools.service.ts` 하나지만 향후 늘어날 수 있음)의 마스킹 대상 키 집합이 조용히 바뀐다 — 전형적인 "새 전역 변수(공유 가변 상태)의 노출 범위 확대" 패턴이다. JSDoc 에 "런타임 소비처는 이 export 를 쓰지 않는다"고 의도를 명시했고 실제로 이 diff 의 유일한 신규 소비처(테스트)는 `[...DEFAULT_SENSITIVE_KEYS]` 로 **읽기만** 하므로 이번 변경 자체는 안전하다. 구조적 노출 확대만 기록한다.
  - 제안: 강제할 필요가 있다면 `Object.freeze` 는 `Set` 내부 슬롯에 효과가 없으므로 소용없다 — 대신 export 시 `as ReadonlySet<string>` 캐스트를 유지하는 현재 방식(타입 레벨 가드)이 사실상 최선이며, 실질적 강제가 필요해지면 "얼린 배열을 export 하고 소비처에서 `new Set(...)` 하도록" 바꾸는 것을 고려할 수 있다. 현재 리스크는 낮아 차단 사유는 아니다.

- **[INFO]** `adaptHandlerReturn`/`maskSensitiveFields` 시그니처·공개 인터페이스는 변경 없음 — 확인 결과
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:26` (`export function adaptHandlerReturn(raw: unknown): NodeHandlerOutput`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:76` (`export function maskSensitiveFields(value, sensitiveKeys = DEFAULT_SENSITIVE_KEYS, seen = new WeakSet())`)
  - 상세: 두 함수 모두 파라미터·반환 타입이 diff 전후 동일하다 — 내부 동작(마스킹 적용 여부)만 바뀌었으므로 호출자 코드를 고칠 필요는 없다(4개 호출부 — `ai-turn-orchestrator.service.ts`·`execution-engine.service.ts`·`execution-context.service.ts`·`form-interaction.service.ts` — 를 grep 대조, 모두 시그니처 그대로 사용). `handler-output.adapter.ts` 에서 `import { maskSensitiveFields } …` 를 제거해도 재export 배럴이 없어(grep 확인) 다른 모듈의 import 경로에 영향 없음.
  - 제안: 없음 (양호, 기록 목적).

- **[INFO]** `ai-turn-executor.ts` 변경은 주석뿐 — 코드 동작·시그니처 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`buildRetryState` 인근 주석 블록, diff 상 `3280`/`3351-3357` 부근 — 실제 파일에서 `Read`/`grep` 으로 재확인 필요할 만큼 미세하지만 diff 자체가 `//`·`/** */` 라인만 건드림)
  - 상세: "credential 은 allow-list 로 배제" 라는 기존 동작 설명을 정정한 주석 편집이며, `buildRetryState` 의 실제 allow-list 로직·호출 규약은 diff 에 포함되지 않았다. 부작용 없음.
  - 제안: 없음.

- **[INFO]** 파일시스템 부작용 — 이번 diff 가 신규 생성하는 파일은 전부 `review/code/2026/08/27/10_53_52/**` 리뷰 산출물과 `plan/**` 문서다
  - 위치: `review/code/2026/08/27/10_53_52/{RESOLUTION,SUMMARY,api_contract,requirement,scope,maintainability,architecture,documentation}.md`, `meta.json`, `_retry_state.json`
  - 상세: 코드 실행 경로에서 파일을 생성/삭제하는 로직 변경은 없다. 신규 파일은 이전 라운드(`/ai-review`) 산출물이 이번 커밋 세트에 함께 포함된 것으로, CLAUDE.md 의 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 저장 규약과 위치·형식이 일치한다. 예상치 못한 파일시스템 부작용 아님.
  - 제안: 없음.

## 요약

핵심 변경(`handler-output.adapter.ts` 에서 `maskSensitiveFields` boundary 제거)은 함수 시그니처·공개 인터페이스를 바꾸지 않았고, 전역 변수를 새로 도입하지도, 환경 변수·네트워크 호출·이벤트/콜백 배선을 건드리지도 않았다. 실제 부작용은 두 가지 구조적 사항으로 좁혀진다 — (1) 마스킹이 겸하던 암묵적 deep-clone 이 사라지며 `config` 참조가 장기 생존 `structuredOutputCache` 에 방어적 복사 없이 들어가는데, 이는 PR 이 스스로 캐너리로 고정했고 자매 API(`setEngineResolvedConfig`)가 정확히 같은 이유로 얕은 복사를 하는 것과 비대칭이라는 점, (2) `DEFAULT_SENSITIVE_KEYS` 를 export 하면서 프로세스 전역 mutable `Set` 의 접근 범위가 넓어졌다는 점 — 둘 다 이번 diff 자체에서 실제로 악용되거나 트리거되지는 않으며 각각 INFO 수준으로 남긴다. `adaptHandlerReturn`/`maskSensitiveFields` 의 모든 호출부를 직접 grep 대조한 결과 호출자 영향은 없고, 신규 파일 생성은 리뷰 산출물 규약과 일치해 예상치 못한 파일시스템 부작용도 아니다.

## 위험도

LOW
