# Security Review — HEAD `8d39d65ee` (EIA §R17 잔여 하드닝: terminal outputData 마스킹 + deepRedactSecrets 캐시)

## 리뷰 범위

`git show HEAD` 전체(7 files) + `interaction.service.ts` `getStatus()` 전체 + `sanitize-error-message.ts` 전체 + 관련 SSE 마스킹 경로(`websocket.service.ts`) 교차 확인.

## 발견사항

발견된 Critical/Warning 없음.

- **[INFO]** `getStatus` 응답의 모든 필드가 마스킹 커버리지 완결
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:257-353`
  - 상세: `currentNode`(`id`/`type`/`interactionType` — 노드 메타 상수, secret 실을 여지 없음, 확인 완료), `context`(`conversationThread`→`redactThreadForPublic`, `nodeOutput`/`buttonConfig.nodeOutput`→`deepRedactSecrets`, 기존 PR #876 범위), `result`(COMPLETED)/`error`(FAILED)(→ 본 커밋에서 신규 `deepRedactSecrets` 적용) 까지 5개 반환 필드 전부 마스킹 경로를 탄다. DTO(`dto/responses.dto.ts`) 상에도 이 5개 필드 외 추가 표면 없음. 잔여 무마스킹 우회 표면 없음.
  - SSE 측(`websocket.service.ts:353-354,447,507,524,591`)도 `EXECUTION_COMPLETED`/`EXECUTION_FAILED` emit 이 이미 `sanitizePayloadForWs` 를 타므로, 본 커밋은 REST `getStatus` 만 갖고 있던 유일한 무마스킹 gap 을 정확히 닫는다(spec 서술과 일치).

- **[INFO]** `deepRedactSecrets` 마스킹 커버리지 — 기존 테스트 스위트로 충분히 검증됨
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:109-153`, `sanitize-error-message.spec.ts:86-158`
  - 상세: 값-패턴(`Bearer …`, `api_key=…`), 키-패턴(`CREDENTIAL_KEY_PATTERN` — `password`/`token`/`secret`/`authorization`/`x-api-key` 등 wholesale 마스킹), 중첩 JSON 문자열(`redactSecretsInJsonString` round-trip), depth 캡(10, 초과 시 wholesale `***`) 모두 기존 unit test 로 커버. 본 커밋이 추가한 신규 unit test(`interaction.service.spec.ts:694-719`)도 `headers.authorization`(키 매칭) / `api_key`(키 매칭) 케이스로 COMPLETED/FAILED 양쪽 실측. e2e(`external-interaction.e2e-spec.ts:343-407`)는 `waiting_for_input`(conversationThread/nodeOutput) 경로만 실 DB wire 검증하고 COMPLETED/FAILED terminal 경로는 e2e 미커버 — 다만 unit test 로 대체 검증되어 있어 이번 커밋 자체의 실효성 판단에는 영향 없음(커버리지 gap 은 INFO 수준).

- **[INFO]** WeakMap depth-0 캐시 — execution 간 교차 오염 불가, 이론적 staleness 는 기존 sibling 패턴과 동일한 설계 트레이드오프
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:89,118-124`
  - 상세: 캐시 키는 **입력 object identity**(`WeakMap<object, unknown>`)이고, `getStatus` 가 매 호출마다 `executionRepository.findOne(...)` (cache 옵션 미사용, 일반 TypeORM 조회)으로 새 `Execution` 엔티티/새 `outputData` JS object 를 생성하므로, 서로 다른 execution 의 `outputData` 가 동일 참조를 공유할 경로가 없다(`Execution` 엔티티에 `outputData` 기본값 리터럴도 없음 — `execution.entity.ts:78`). 따라서 요청 간 교차 오염은 불가능. 캐시가 마스킹 결과를 반환하기 전에 항상 `deepRedactObject` 전체 계산을 거치므로(라인 122), 캐시가 "마스킹 이전" 값을 우회 반환하는 경로도 없음. 이론적으로만 존재하는 리스크는 "동일 object reference 가 캐시된 뒤 in-place mutation 되면 재조회 시 stale(구버전) 마스킹 결과 반환" 이나, `execution-engine.service.ts` 전수 확인 결과 `outputData` 는 항상 `savedExecution.outputData = ...` **재할당**(새 참조) 패턴이라 in-place mutation 사례가 없어 이 worktree 내에서는 실증되지 않음. 동일 설계(`SANITIZE_CACHE`, `websocket.service.ts:236`)가 이미 프로덕션에 존재하는 승인된 패턴이라 본 diff 고유의 신규 리스크는 아님.

- **[INFO]** 문서화된 잔여 gap (본 커밋 범위 밖, 회귀 아님)
  - 위치: `plan/in-progress/eia-secret-masking-residuals.md:57-63`, `spec/5-system/14-external-interaction-api.md` §R17
  - 상세: (a) SSE waiting emit 의 `nodeOutput` 중 `conversationConfig` 외 나머지(`config`/`meta`)는 `sanitizePayloadForWs` 의 **키 기반** 마스킹만 적용되어 author-config 값-embedded secret gap 이 저위험으로 잔존, (b) `execution-engine/sanitize-error-message.ts`(별개 파일, stack/URI strip 용도)의 에러 알림 경로에 Bearer 토큰 미마스킹 가능성. 둘 다 본 커밋이 건드리지 않은 pre-existing 표면이며, plan 문서에 명시적으로 추적되고 있어 은폐된 리스크가 아님.

## Egress-only 확인

`git show HEAD --stat` 기준 변경 파일은 `interaction.service.ts`(REST read path), `sanitize-error-message.ts`(순수 유틸 + 캐시), 두 spec 파일, e2e, plan/spec 문서뿐이다. `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts` 등 durable 저장·LLM 컨텍스트 주입 경로는 diff 에 포함되지 않아 egress-only 원칙이 유지된다.

## 요약

본 커밋은 PR #876 이 마스킹하지 않고 남겨둔 `getStatus` terminal `result`(COMPLETED)/`error`(FAILED) 표면에 기존에 검증된 `deepRedactSecrets` 를 그대로 적용해 마지막 무마스킹 공개 표면을 닫는다. `getStatus` 응답의 5개 필드(`currentNode`/`context`/`result`/`error`/기타 상수) 전체가 마스킹 경로를 갖추게 되었고, SSE 측은 이미 `sanitizePayloadForWs` 로 동등 마스킹이 적용돼 있어 REST·SSE 양쪽 일관성도 확보됐다. 신규 추가된 WeakMap 캐시는 object-identity 키 + 매 요청 신선한 엔티티 생성 구조상 교차 오염이나 마스킹 우회 경로가 없으며, sibling 코드(`sanitizePayloadForWs`)와 동일한 이미 승인된 설계를 재사용한다. Critical/Warning 급 발견 없음.

## 위험도

NONE
