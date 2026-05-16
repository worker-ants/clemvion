# 요구사항(Requirement) 리뷰

세션: `review/code/2026/05/16/11_04_17`
리뷰어: requirement

---

### 발견사항

#### 기능 완전성

- **[INFO]** `OAuthBeginResultDto` — `mode` 필드 enum 에 일반 흐름 식별자(`'google'`, `'github'`, `'cafe24'`)가 주석에만 언급되고 타입 정의에서는 `'cafe24_private_pending'` 단일 값만 선언됨. API 소비자가 `mode`의 취할 수 있는 전체 값 집합을 타입에서 파악하기 어렵다.
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `OAuthBeginResultDto.mode`
  - 상세: 주석에 "미존재 또는 'google'/'github'/'cafe24' 면 일반 흐름"이라 명시하나, `mode?: 'cafe24_private_pending'`으로 선언되어 타입 상으로는 general flow 시 `mode`가 어떤 값인지 알 수 없다. `undefined`이 일반 흐름을 의미한다는 설명은 주석에만 존재.
  - 제안: `mode?: 'cafe24_private_pending' | undefined` 는 현재와 동일하므로 추가 값이 없어 문제는 없으나, Swagger `@ApiProperty` 의 `description`에 "absent = standard flow"를 더 명확히 기록하거나 타입가드 util 제공을 권장.

- **[WARNING]** `send-email` 수신자 검증 조건 표현식이 `length(to) == 0` 인데, `to` 필드가 `null`이거나 배열이 아닌 경우 `length()` 평가 결과가 엔진 구현에 따라 `0`이 아닌 에러 또는 `undefined`가 될 수 있다. `send-email.schema.ts`의 imperative `validateSendEmailConfig`와 이중 방어가 되어 있지만 warningRule이 단독으로 평가될 때의 엣지 케이스가 보장되어 있지 않다.
  - 위치: `backend/src/nodes/integration/send-email/send-email.schema.ts` — `send_email:no-recipient` warningRule
  - 상세: `when: 'length(to) == 0'` 에서 `to` 가 `undefined`면 expression engine 의 `length(undefined)` 동작이 `0`을 반환하는지 보장이 필요. 다른 노드들도 동일 패턴(`length(categories) == 0`, `length(conditions) == 0` 등)을 사용하므로 일관성은 있으나 engine 계약을 확인해야 한다.
  - 제안: expression engine의 `length(undefined)` 반환값을 명시적으로 테스트하거나 `!to || length(to) == 0` 형태로 방어적 조건 추가.

---

#### 엣지 케이스

- **[WARNING]** `consecutive_network_failures` — V049 마이그레이션은 `NOT NULL DEFAULT 0`으로 기존 행을 0으로 backfill 한다고 명시. 그런데 카운터가 정확히 3에 도달할 때 `markStatus('error', 'network')` + 리셋이 이루어진다고 주석에 기술되어 있는데, 실제 `Cafe24ApiClient` 가 연속 실패 3회 카운트 후 status를 전이하는 코드가 이번 diff에 포함되지 않았다. 마이그레이션과 엔티티 컬럼 정의만 있고 비즈니스 로직(카운터 증감, 임계값 상태 전이)의 실제 구현체는 파일 38(`cafe24-api.client.ts` — diff omitted due to size limit)에 있다고 추정되나 검증 불가.
  - 위치: `backend/migrations/V049__integration_consecutive_network_failures.sql`, `backend/src/modules/integrations/entities/integration.entity.ts`
  - 상세: diff에서 `cafe24-api.client.ts`와 `cafe24-token-refresh.processor.spec.ts`는 "diff omitted due to prompt size limit"으로 표시됨. 임계값 3 도달 시 상태 전이 로직 및 성공 시 0 리셋 로직이 실제로 구현되어 있는지 이번 리뷰에서 직접 확인이 불가능하다.
  - 제안: `cafe24-api.client.ts` 전체 diff를 별도 확인하여 `consecutiveNetworkFailures` 증감 로직과 threshold(3) 전이 호출이 완전히 구현되어 있는지 검토 필요.

- **[INFO]** `integration-expiry-scanner.service.ts` — `enqueueCafe24BackgroundRefresh`의 `lastRotatedAt: Or(LessThan(cutoff), IsNull())` 확장 이후, `lastRotatedAt IS NULL`인 신규 행도 대상에 포함된다. 그런데 `integrations.service.ts`에서 `lastRotatedAt: new Date()`로 명시 초기화하는 경로는 V049 이전의 코드 경로를 커버한다. OAuth 이외의 create 경로(직접 DB insert, seed, migration 등)에서 `lastRotatedAt`이 NULL로 들어올 수 있는 상황은 주석에 "belt-and-suspenders"로 명시되어 있어 의도는 분명함.
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` L443
  - 상세: 의도는 명확하고 NULL 분기 추가는 올바른 방어 코드. INFO 수준.
  - 제안: 유지.

---

#### TODO/FIXME

- **[INFO]** 전체 diff 범위에서 TODO/FIXME/HACK/XXX 주석은 발견되지 않았다.

---

#### 의도와 구현 간 괴리

- **[WARNING]** `switch.schema.ts` — warningRule `switch:value-mode-needs-switch-value`의 `when` 조건이 `mode != expression && !switchValue`이다. 그런데 메시지는 `"In Value mode, Switch Value must be entered."` 로 "Value mode"를 명시한다. 실제 조건은 `mode != expression`이므로, 만약 제3의 mode가 추가된다면 이 rule이 의도치 않게 발동될 수 있다. 주석(`// mode != expression instead of mode == value covers both`)이 이 의도를 설명하지만 메시지와 조건 간의 괴리가 여전히 존재한다.
  - 위치: `backend/src/nodes/logic/switch/switch.schema.ts` — `switch:value-mode-needs-switch-value`
  - 상세: `when: 'mode != expression && !switchValue'`인데 메시지가 "In Value mode"라고 단정. mode가 null/undefined일 때도 이 rule이 발동한다.
  - 제안: 메시지를 `"Switch Value must be entered (non-expression mode)."` 또는 조건을 `mode == value && !switchValue`로 좁혀 메시지와 일치시키는 것을 검토.

- **[INFO]** `foreach.schema.spec.ts` 의 describe 블록 이름이 `"emits the Korean warning when arrayField is missing"` 인데 해당 diff에서 메시지 자체는 영문으로 바뀌었다. describe 제목이 구 한국어 메시지를 가정한 채로 잔류하고 있다.
  - 위치: `backend/src/nodes/logic/foreach/foreach.schema.spec.ts` — describe 제목 (`emits the Korean warning when arrayField is missing`)
  - 상세: 실제로 반환되는 메시지는 이제 `'Array field must be entered.'`(영문)이다. describe 제목은 "Korean warning"이라는 표현을 유지하고 있어 독자가 혼동할 수 있다.
  - 제안: describe 제목을 `"emits the expected warning when arrayField is missing"` 등으로 업데이트.

- **[INFO]** 유사하게 `code.schema.spec.ts`, `transform.schema.spec.ts`, `form.schema.spec.ts`, `variable-declaration.schema.spec.ts`, `variable-modification.schema.spec.ts` 등 여러 spec 파일에서 describe 또는 it 블록 제목에 "Korean warning" 표현이 잔류할 가능성이 있다 (foreach 사례 확인됨, 나머지는 diff에서 직접 확인 불가).
  - 위치: 각 `*.schema.spec.ts`의 describe/it 제목
  - 상세: 영문화 작업에서 메시지 문자열은 변경되었지만 테스트 블록 명칭이 누락 업데이트됐을 가능성.
  - 제안: 일괄 검색 후 업데이트.

---

#### 에러 시나리오

- **[WARNING]** `Cafe24TokenRefreshProcessor` — status 검증이 `source` 무관하게 적용되도록 변경되었다. 변경 후 `proactive` source의 잡이 `status !== 'connected'`인 경우에도 skip된다. 이는 의도한 바로 주석에 명확히 설명되어 있다. 그러나 source가 `proactive`인 경우 skip 시 호출자(`Cafe24ApiClient.call`)는 이미 `resolveIntegration`에서 `status='connected'` 검증을 통과한 뒤 도달하므로 일반 흐름에서는 문제 없다. 다만 race window — `resolveIntegration` 통과 후 processor 실행 전에 status가 변경된 케이스 — 에서 proactive 잡이 silently skip되고 사용자에게 알림이 없는 상황이 발생할 수 있다.
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` L1250
  - 상세: skip 시 로그(`Cafe24 refresh skipped for ${integrationId} — status=${fresh.status} (reauthorize required, source=${source})`)는 남으므로 운영상 추적은 가능. 사용자 피드백 경로는 없으나 이는 기존 동작과 동일.
  - 제안: 현재 수준의 로그 처리는 적절. proactive skip 시 BullMQ job result에 에러 대신 `'skipped'` 결과를 기록하는 것을 고려하면 모니터링이 개선됨(선택사항).

- **[INFO]** `integration-expiry-scanner.service.ts` — `pending_install` 상태를 만료 알림 대상에서 명시 제외하는 코드(`status: Not(In(['expired', 'error', 'pending_install']))`)가 추가되었다. 주석에서 REQ-C1으로 추적됨. `disconnected` 상태는 여전히 포함됨이 확인된다 — 이 상태의 통합에 만료 알림을 보내는 것이 비즈니스적으로 맞는지 spec §11.1에서 명시되어야 하지만 이번 diff 범위에서 spec을 직접 볼 수 없어 INFO 처리.

---

#### 데이터 유효성

- **[WARNING]** `OAuthBeginResultDto` — 필드 전부가 optional이 되어 이제 아무 필드도 없는 빈 객체도 타입 검사를 통과한다. 서버 측에서 분기별로 올바른 필드 세트를 채워주는지 런타임 유효성 검사(class-validator `@ValidateIf` 등)가 없다. DTO가 응답 형태이므로 들어오는 데이터 검증 문제는 아니지만, 실수로 잘못된 응답 구조(예: Cafe24 Private 분기에서 `appUrl` 누락)를 보내더라도 타입 에러가 없다.
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `OAuthBeginResultDto`
  - 상세: 분기 완전성(general flow 시 `authorizeUrl + state` 모두 존재, cafe24_private 시 `integrationId + appUrl + callbackUrl` 모두 존재)이 타입 레벨에서 강제되지 않는다. 서버 구현체의 실수를 컴파일 타임에 잡지 못함.
  - 제안: discriminated union 타입(별도 타입 export)을 정의하거나, 최소한 서비스 레이어에서 분기별 필수 필드를 throw로 검증하는 guard를 두는 것을 권장.

- **[INFO]** `parallel.schema.ts` — `branchCount`가 number이지만 유한하지 않은 경우와 정수가 아닌 경우를 각각 두 if 블록으로 확인한다. 첫 번째 if: `typeof rawBranch !== 'number' || !Number.isFinite(rawBranch)`, 두 번째 if: `!Number.isInteger(rawBranch)`. `NaN`은 `typeof === 'number'`이고 `!Number.isFinite(NaN) = true`이므로 첫 번째 블록에서 잡힌다. 그러나 `Infinity`도 첫 번째 블록에서 잡히므로 두 검사가 올바르게 작동한다. 로직은 정확하다.

---

#### 비즈니스 로직

- **[CRITICAL]** `consecutive_network_failures` 카운터의 실제 증감 비즈니스 로직이 이번 diff에서 누락되어 있다. V049 마이그레이션(컬럼 추가)과 엔티티 선언만 포함되어 있고, `Cafe24ApiClient`에서 실패 시 `+1`, 성공 시 `0` 리셋, 3 도달 시 `markStatus('error', 'network')` 호출이 구현되어 있다는 것을 diff에서 직접 확인할 수 없다(파일 38의 diff가 "omitted due to prompt size limit"). 스펙(§6 REQ-C2)이 정의한 "connected → error(network) | 노드 실행 중 커넥션 실패 3회 연속" 상태 전이가 실제로 코드에 완전히 구현되어 있는지 이 리뷰에서는 검증 불가.
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (diff 미포함)
  - 상세: 마이그레이션과 엔티티 정의는 인프라이고, 비즈니스 로직 구현체가 `cafe24-api.client.ts`에 있다고 보이나 해당 diff가 제공되지 않았다. `cafe24-api.client.spec.ts`(파일 37)의 diff도 생략됨. spec REQ-C2의 요구사항이 완전히 구현되어 있는지를 분리 검토해야 한다.
  - 제안: `cafe24-api.client.ts`의 전체 diff를 별도 검토. 특히 (1) fetch 실패 핸들러에서 `consecutiveNetworkFailures++` 후 `integrationRepository.save`, (2) 성공 시 0 리셋, (3) `>= 3` 도달 시 `markStatus('error', 'network')` + 카운터 리셋을 확인.

- **[WARNING]** 영문 메시지 일괄 전환(파일 20~94 범위) 과정에서 `if-else.schema.ts`에 `id: 'if_else:first-condition-field-empty'` 규칙이 있고 메시지가 `'First condition\'s field must be entered.'`로 변경되었다. 동일 패턴의 `variable-declaration` 에도 `'First variable\'s name must be entered.'`가 있다. 이 "first item" 계열 규칙은 조건이 `length(X) > 0 && !X.0.field` 형태이므로, 배열은 있지만 첫 번째 항목이 없는 경우를 처리한다. 그러나 배열 길이가 0인 경우(이미 다른 rule에서 잡힘)와의 중복 발동 여부는 엔진의 short-circuit 동작에 달려 있다. 두 rule이 동시에 발동하는 경우(예: empty array → no-conditions rule + first-condition-field-empty rule) 는 `length == 0` 이면 `length > 0`이 false이므로 실제로는 중복 발동 없음. 로직은 정확하다. INFO로 하향.

- **[INFO]** `metadata-validation.ts` 주석 변경 — "return the resulting Korean messages"가 "return the resulting messages (English SoT — frontend `getConfigSummary` translates them via `WARNING_KO`)"로 업데이트됨. 이는 프론트엔드의 `translateBackendWarning` 함수와 `node-config-summary.ts`의 locale 파라미터 추가와 정확히 일치한다. i18n 아키텍처가 일관되게 구현됨.

---

#### 반환값

- **[INFO]** `getConfigSummary` 함수 — `locale` 파라미터에 `DEFAULT_LOCALE` 기본값이 지정되어 있어 호출자가 locale을 넘기지 않아도 컴파일 에러 없이 동작한다. `translateBackendWarning` 반환값이 `null | undefined`일 경우 `?? blocking.message` fallback으로 영문 원본이 반환된다. 모든 경로에서 적절한 값을 반환함.
  - 위치: `frontend/src/lib/utils/node-config-summary.ts`
  - 상세: nullish coalescing fallback이 정확히 배치되어 있음.

- **[INFO]** `Cafe24TokenRefreshProcessor.process` — 변경 후 `fresh.status !== 'connected'` 시 `return`(void)로 종료. 이전에는 `source === 'background'` 조건이 있었으나 제거됨. 모든 skip 경로에서 명시적 return이 있고 오류를 던지지 않으므로 BullMQ가 해당 job을 completed로 처리함. 의도된 동작이라면 적절하나, monitoring 관점에서 `skipped` vs `completed` 구분이 없다는 점은 앞서 언급.

---

### 요약

이번 변경은 크게 네 영역으로 구성된다: (1) 전 노드 warning 메시지 영문화(26+ 노드 스키마), (2) Cafe24 연속 네트워크 실패 카운터 인프라 추가(V049 마이그레이션 + 엔티티), (3) OAuth 플로우 분기 DTO 확장, (4) e2e Makefile `--build` 플래그 추가 + 문서 정비. 요구사항 관점에서 가장 중요한 리스크는 spec §6 REQ-C2의 핵심 비즈니스 로직(연속 실패 카운터 증감 및 threshold 상태 전이)이 이번 diff에서 `cafe24-api.client.ts` diff가 누락되어 직접 검증이 불가능한 점이다(CRITICAL 1건). 이 외에 `switch` 노드의 `when` 조건과 메시지 간 의미 괴리, `OAuthBeginResultDto`의 optional 필드 완전성 미강제, `send-email` 수신자 expression null 엣지 케이스가 WARNING으로 발견되었다. 영문화 작업 자체는 schema·테스트·summary 유틸리티가 일관되게 갱신되어 있으며, `translateBackendWarning` + `locale` 파라미터 도입으로 i18n 경계가 명확히 정의되어 있다.

### 위험도

MEDIUM

---

*CRITICAL 1건 / WARNING 4건 / INFO 9건 = 합계 14건*
