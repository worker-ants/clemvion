# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `DEFAULT_SENSITIVE_KEYS` 확장이 이 PR 의 실제 스코프(workflow-assistant 읽기 도구) 밖의 **모든 노드 핸들러의 `config` 영속 경로**로 조용히 번진다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:13-27` (`DEFAULT_SENSITIVE_KEYS`에 `csrfToken`/`csrf_token`/`authToken`/`auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token` 8개 추가) — 소비처: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:36` (`maskSensitiveFields(r.config ?? {})`, 두 번째 인자 생략 → `DEFAULT_SENSITIVE_KEYS` 를 그대로 사용)
  - 상세: `DEFAULT_SENSITIVE_KEYS` 는 module-level `const` 로 정의된 공유 기본값이며, 이 diff 는 `explore-tools.service.ts`(LLM 도구 read-only 응답, 저장 안 됨)를 고치려는 목적이지만 같은 상수를 참조하는 `handler-output.adapter.ts`(`adaptHandlerReturn`)에도 자동으로 적용된다. 이 함수의 자체 주석(`36행` 위)이 스스로 명시하듯 그 마스킹 결과는 **DB 저장 / WS emit / 표현식(`$node[...].config.*`) echo** 로 흐른다 — 즉 이번 diff 는 workflow-assistant 세션 응답이 아니라 **전체 노드 실행 엔진의 영속 데이터**에 8개 키 이름을 새로 추가한다. plan 자신은 이 확장을 "위험이 없는 절반(키 축)"으로 분류하고 값 축(자유 텍스트 안의 시크릿)만 위험하다고 선을 그었지만(`plan/in-progress/assistant-mask-leak.md` "표면별로 강도를 나눈다"), 임의 노드의 `config` 에 실제로 `csrfToken`/`authToken`/`session_token` 등의 리터럴 키 이름으로 **다운스트림 표현식이 참조하는 실제 값**이 들어있다면, 그 값이 이제 `****<last4>` 로 DB에 영속되고 표현식이 읽는 값도 마스킹된 값으로 바뀐다 — plan 이 값 축에 대해 명시적으로 경계했던 것과 **동일한 리스크 클래스**가 키 축 확장에도 동일하게 적용되는데, 이 경로에 대한 실측·리스크 검토는 plan 에 없다.
  - 제안: `handler-output.adapter.ts` 가 실제 프로덕션 노드 config 에서 이 8개 키 이름과 충돌하는 사례가 없는지(전체 노드 타입의 `configSchema`/실 데이터) 확인하거나, workflow-assistant 전용 목적이라면 `explore-tools.service.ts` 쪽에서 별도의 `sensitiveKeys` Set 을 만들어 `maskSensitiveFields(v, ASSISTANT_SENSITIVE_KEYS)` 로 분리해 공유 기본값 확장의 블라스트 반경을 스코프 안으로 좁히는 것을 검토할 것. (참고: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 이 표면의 **값 축** 잔여만 별도 항목으로 추적하고 있고, 키 축 확장의 프로덕션 영속 리스크는 별도로 등재돼 있지 않다.)

- **[INFO]** 같은 확장이 `****<last4>` 마커 계약 밖 값의 표면적을 늘린다 (기존에 이미 추적된 이슈의 증분)
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:13-27` → `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:36`
  - 상세: `handler-output.adapter.ts` 는 `deepRedactSecrets` 를 겹치지 않으므로 그 출력은 여전히 `****<last4>`/`****` 포맷이다. `@workflow/masked-markers` 의 `MASKED_MARKERS`(`['***','[REDACTED]','[REDACTED_DEPTH]']`, `codebase/packages/masked-markers/src/index.ts:43`)에는 이 포맷이 없어 `isMaskedMarker` 가 인식하지 못한다 — 재제출 가능 경로에 들어가면 마스킹된 값을 실제 입력으로 오인해 재제출을 허용할 위험이 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:246-248`(`16_21_45` naming INFO 1)에 기록돼 있다. 이번 diff 는 이 위험의 존재 자체를 새로 만들진 않지만, 마스킹 대상 키를 8개 늘려 그 비계약 포맷 값이 발생하는 **키 이름의 가짓수**를 넓힌다. 오늘 시점 재제출 경로에 없다는 전제는 유지되므로 등급은 INFO.
  - 제안: 별도 조치 불필요 — 위 plan 항목이 이미 이 리스크를 추적 중임을 확인.

- **[INFO]** `explore-tools.service.ts` 출력 포맷 변경(`****<last4>` → `***`)은 LLM 도구 응답이라는 스코프 안에서 다른 소비처가 없음을 확인
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:97-112`(`redactAssistantFields` 신설), 호출부 `:510`·`:528`
  - 상세: `toNodeExecutionEnvelope`/`toExecutionEnvelope` 는 `ExploreToolsService` 의 private 메서드이고 외부에서 이 두 메서드를 직접 호출하는 곳은 없다(`grep` 결과 `getExecutionDetails`/`getWorkflowExecutions` 의 유일한 실사용 호출부는 `assistant-tool-router.service.ts:210` 이며 그 스펙·`workflow-assistant-stream.service.spec.ts` 는 전부 jest mock 이라 포맷에 의존하지 않음). 함수 시그니처(`toNodeExecutionEnvelope(ne: NodeExecution)`, `toExecutionEnvelope(e, workflowName)`)와 반환 객체의 키 구성(`inputData`/`outputData`/`error` 3개, 값은 여전히 `unknown`)은 변경 전과 동일해 시그니처/인터페이스 파괴는 없음. spec 동기화(`spec/3-workflow-editor/4-ai-assistant.md` §4.1.1)도 같은 PR 안에서 처리되어 있다.
  - 제안: 조치 불필요, 확인 목적의 기록.

- **[INFO]** `redactAssistantFields` 가 `deepRedactSecrets` 의 module-level 캐시(`DEEP_REDACT_CACHE`)에 새 호출 경로를 추가하지만, 실질적으로 캐시 적중이 발생하지 않는다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:202`(`DEEP_REDACT_CACHE = new WeakMap<object, unknown>()`, 기존 인프라) / 신규 호출부 `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:106`(`deepRedactSecrets(maskSensitiveFields(v))`)
  - 상세: `deepRedactSecrets` 의 depth-0 캐시는 입력 **객체 identity** 를 키로 쓴다. 그런데 `maskSensitiveFields` 는 항상 얕은 복사본을 새로 생성해 반환하므로(`mask-sensitive-fields.util.ts:57-65`, `out: Record<string, unknown> = {}`), 같은 `NodeExecution`/`Execution` row 를 여러 번 처리해도 `deepRedactSecrets` 에 들어가는 객체는 매번 새 identity라 캐시 hit 이 나지 않는다. 버그는 아니고(WeakMap 이라 메모리 누수도 아님) 순수 성능 관점의 무의미한 캐시 시도일 뿐이라 INFO.
  - 제안: 조치 불필요.

- **[INFO]** 원본 데이터 변경(mutation) 여부 확인 — 변경 없음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:43-66`, `codebase/backend/src/shared/utils/sanitize-error-message.ts:259-312`(`deepRedactCore`/`deepRedactObject`)
  - 상세: `maskSensitiveFields` 는 항상 새 객체를 반환(원본 미변경, 기존 테스트 `does not mutate the input` 로 이미 고정됨), `deepRedactSecrets`/`deepRedactObject` 는 "copy-on-change" 방식으로 값이 안 바뀌면 같은 참조를 반환하지만 그 참조는 `maskSensitiveFields` 가 만든 새 객체이지 DB entity 원본이 아니다. 두 겹을 합성해도 `ne`/`e` 원본 entity 의 `inputData`/`outputData`/`error` 필드는 변경되지 않는다.
  - 제안: 조치 불필요, 확인 목적의 기록.

## 요약

핵심 코드 변경(`redactAssistantFields` 신설, `deepRedactSecrets` 중첩, `explore-tools.service.ts` 출력 포맷 `***` 로 통일)은 함수 시그니처·공개 인터페이스를 깨지 않고, 원본 DB entity 를 변경하지 않으며, 새 전역 변수·환경변수·네트워크 호출·이벤트/콜백 변경도 없다. 다만 `mask-sensitive-fields.util.ts` 의 `DEFAULT_SENSITIVE_KEYS`(공유 module-level 상수)에 8개 키를 추가한 것은 이 PR 의 명목 스코프(workflow-assistant LLM 도구 읽기 경로)를 넘어 `handler-output.adapter.ts` 를 거쳐 **모든 노드 실행의 `config` 영속(DB 저장·WS emit·표현식 echo)** 에까지 자동으로 전파되는 부작용이며, plan 이 "값 축"에 대해서만 명시적으로 경계했던 "저장되는 값·표현식이 읽는 값이 바뀌어 정상 워크플로를 깨뜨릴 수 있다"는 리스크가 "키 축" 확장에도 원리적으로 동일하게 적용될 수 있는데 그 경로에 대한 실측이 plan 에 없다. 나머지는 이미 추적 중이거나(마커 포맷 비계약) 성능상 무해한(캐시 미스) 사항이라 정보성이다.

## 위험도

MEDIUM
