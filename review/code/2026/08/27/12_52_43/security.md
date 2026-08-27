# 보안(Security) 코드 리뷰

## 검토 범위 및 방법

이 diff(`masking-expression-egress-split`)는 노드 `config` echo 의 마스킹 시점을 **저장(storage-time)**
에서 **송신(egress-only)**으로 옮긴다. 이 변경은 이미 같은 날 4라운드(`10_53_52` → `11_25_15` →
`12_00_05` → `12_28_26`)에 걸쳐 security/architecture/testing/documentation reviewer 가 검토했고
`12_28_26` RESOLUTION 이 CRITICAL 0 · RISK=LOW 로 수렴을 선언한 상태다. 이번 라운드에서는 그 결론을
그대로 받아쓰지 않고, 핵심 안전 주장 3가지를 실제 소스(`Read`)로 **독립 재검증**했다:

1. `DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축` 캐너리가 실제로 상수에서 파생하는가
2. WS/REST egress 가 정말로 그 캐너리가 검증하는 것과 **같은** 마스킹 함수를 타는가
3. `_retryState`/`_resumeState` 의 credential 배제가 실제로 allow-list 방식인가(주석만이 아니라)

세 항목 모두 아래처럼 코드로 직접 확인했고, 새로운 CRITICAL/WARNING 급 결함은 발견하지 못했다.

## 발견사항

- **[INFO]** 이전 라운드가 지적한 CRITICAL("포함관계 캐너리가 실제로는 상수에서 파생되지 않음")이
  올바르게 수정됐음을 소스로 재확인
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10` (`export const DEFAULT_SENSITIVE_KEYS`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:139` (`const KEYS = [...DEFAULT_SENSITIVE_KEYS]`), `:145-153` (`it.each(KEYS)(...)`)
  - 상세: `DEFAULT_SENSITIVE_KEYS` 가 이제 `export` 되고, 캐너리는 하드코딩 리터럴이 아니라 `[...DEFAULT_SENSITIVE_KEYS]` 로 상수를 직접 순회한다. 추가로 `codebase/backend/src/shared/utils/sanitize-error-message.ts:222-229`(`deepRedactSecrets`)와 `:248-252`(`deepRedactSecretsPreserving`)이 동일한 내부 워커 `deepRedactCore`/`deepRedactObject`(:259-312)를 공유하고, 그 워커가 참조하는 `CREDENTIAL_KEY_PATTERN`(:112-113)이 `DEFAULT_SENSITIVE_KEYS` 의 모든 항목(예: `apikey`, `api_key`, `accesstoken`, `client_secret`, `authorization` 등)을 정규식으로 포함함을 육안으로 대조했다. 즉 캐너리가 실제로 검증하는 함수와, REST(`redact-stored-error.ts:4,34,70` → `deepRedactSecrets`)·WS(`websocket.service.ts:460-467` → `deepRedactSecretsPreserving`)가 **동일한 워커/패턴**을 탄다 — 캐너리의 대표성이 확인됨.
  - 제안: 없음 (양호, 재확인 목적).

- **[INFO]** `handler-output.adapter.ts` 의 config echo 마스킹 제거가 실제로 egress 두 지점에서만
  가려지는 구조인지 실측
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53` (`config: r.config ?? {}`)
  - 상세: 어댑터는 더 이상 `maskSensitiveFields` 를 import/호출하지 않는다(1번 줄에서 해당 import 제거 확인). WS 경로는 `websocket.service.ts` 의 `emitExecutionEvent`(:326-345)·`emitNodeEvent`(:399-417)가 `sanitizePayloadForWs`(키-이름 전용, 로컬 `CREDENTIAL_KEY_PATTERN`, :78-79) 를 먼저 태우고, 그 결과를 다시 `maskWireEnvelope`(:460-467, 공유 `deepRedactSecretsPreserving`)에 통과시킨다 — 로컬 패턴이 `x-api-key` 를 안 잡아도(:74-76 JSDoc 이 명시) 뒤이은 공유 패턴이 잡으므로 config echo 경로에는 실질 갭이 없다. REST 경로는 `redact-stored-error.ts` 의 `redactStoredDataForResponse`/`redactNodeExecutionRow` 가 `outputData`(config 포함)를 재귀 마스킹한다. 두 경로 모두 값 축(`SECRET_LEAK_PATTERNS`)까지 겹쳐 걸므로, 이전엔 키-이름 완전일치만 걸던 것보다 오히려 커버리지가 넓어졌다.
  - 제안: 없음.

- **[INFO]** `_retryState`/`_resumeState` 의 credential 배제가 문서상 allow-list 주장과 실제 구현이 일치하는지 실측
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3361-3416` (`buildRetryState`)
  - 상세: 반환 객체 리터럴(:3380-3415)에 `llmConfigId`/`workspaceId`/`executionId` 등 credential·context-binding 필드가 열거되지 않는다 — 주석(:3395-3400)이 주장하는 "allow-list 로 애초에 배제"가 실제 코드와 일치한다. 이 배제는 `maskSensitiveFields` boundary 제거와 무관하게 독립적으로 성립하므로, 이번 diff 로 인한 회귀 가능성은 없다.
  - 제안: 없음.

- **[WARNING]** (기존 트랙된 트레이드오프, 신규 아님) `NodeExecution.outputData.config` 가 이제 DB 에
  자격증명을 **원문**으로 영속한다 — safe-by-construction → safe-by-convention 전환
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53`; 정책 서술은 `spec/2-navigation/14-execution-history.md:471-484`, `spec/conventions/egress-masking.md:54-57`, `spec/conventions/node-output.md:339-350`
  - 상세: 종전엔 저장 시점 마스킹이 있어 DB 를 직접 읽는 경로(운영 쿼리, 백업, 향후 신규 API 표면)도 자동으로 보호됐다. 이제는 REST/WS 두 egress 헬퍼를 **반드시** 거쳐야만 가려지며, 그 강제가 타입/스키마 레벨이 아니라 코드 컨벤션·테스트 캐너리로만 관리된다(`api_contract.md` 10_53_52 라운드가 이미 WARNING 으로 등재). 이번 라운드에서 `background-runs.service.ts:302`(`redactStoredFieldsForResponse`)처럼 실제 소비처들이 현재는 모두 egress 헬퍼를 통과함을 grep 으로 확인했으나, **컴파일러가 강제하지 않는 불변식**이라는 성격 자체는 남아 있다. 부가로 표현식이 `config` 원문을 읽을 수 있게 되어, 같은 워크스페이스 내에서 한 노드의 평문 자격증명을 다른 노드의 요청 body 로 실어 제3자 엔드포인트에 전송하는 것이 (워크스페이스 경계를 넘지 않는 한도 내에서) 가능해졌다.
  - 제안: 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(2026-08-27 등재 항목, "자격증명을 노드 `config` 에 평문으로 담는 노드 타입 — 참조 간접화 검토")와 R-5 정정 블록에 근본 처방(자격증명을 값이 아니라 `llmConfigId` 같은 참조로 담기)이 등재돼 있다. 신규 조치 불필요 — 계속 그 트래커로 추적할 것을 권고.

## 요약

핵심 안전 주장("어댑터가 config 마스킹을 제거해도 egress 두 지점이 동일 패턴/함수로 덮는다")을
`Read` 로 직접 대조한 결과, 이전 라운드가 잡은 CRITICAL(포함관계 캐너리 미파생)은 실제로 상수
직접 순회 방식으로 교정되어 있고, REST/WS egress 헬퍼와 캐너리가 검증하는 함수가 동일한 워커/정규식을
공유함을 확인했다. `_retryState` 의 credential allow-list 배제도 문서와 구현이 일치한다. 새로 도입된
CRITICAL/취약점은 없다. 남는 리스크는 이미 스펙·트래커에 명시된 아키텍처 트레이드오프(DB 평문 저장,
safe-by-convention 전환, 크로스-노드 릴레이)이며 워크스페이스 경계를 넘지 않고 근본 처방(자격증명
참조화)이 별도 항목으로 등재돼 있어 이번 diff 를 차단할 사유는 아니다.

## 위험도

LOW
