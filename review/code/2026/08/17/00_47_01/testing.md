# 테스트(Testing) 코드 리뷰

## 발견사항

- **[INFO]** `maskIfPresent` 의 방어적 폴백 분기(`mask(value) ?? value`)가 어떤 테스트로도 트리거되지 않는다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:115` (`maskIfPresent`)
  - 상세: `redactStoredDataForResponse`/`redactStoredErrorForResponse` 는 현재 구현상 `value` 가 non-null 일 때 항상 `Record<string, unknown>` 을 돌려주고 `null` 을 돌려주는 경우가 없다(둘 다 `data === null || data === undefined` 일 때만 `null`). 즉 `mask(value) ?? value` 의 `?? value` 우측 분기는 현재 어떤 입력으로도 도달할 수 없는 방어 코드다. `background-runs.service.spec.ts`/`executions.service.spec.ts` 의 신규 테스트들은 모두 "값이 있음(마스킹됨)"과 "값이 없음(`value == null` 좌측 분기)" 두 경로만 왕복하고, 이 폴백 분기를 실제로 근거로 삼는 테스트는 없다.
  - 제안: 이 분기가 정말 방어용(다른 `mask` 함수가 미래에 `null` 을 돌려줄 가능성 대비)이라면 조치 불요 — 다만 코드 리뷰 시점에 "이 분기가 왜 필요한가" 를 판단할 근거가 테스트에 없다는 점만 기록. 필요하면 `mask: () => null` 를 넘기는 직접 단위 테스트 한 줄로 의도를 고정할 수 있다.

- **[INFO]** `BackgroundRunsService` 신규 테스트 두 건은 `error` 와 `outputData` 를 각각 단독으로 leaky 하게 만들 뿐, 한 행에서 **두 컬럼이 동시에** leaky 한 경우는 검증하지 않는다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:226` (`it('body nodeExecutions[] 의 outputData 는 마스킹하고 inputData 는 원문 유지', ...)`)
  - 상세: `toNodeExecutionDto`(프로덕션 코드, `background-runs.service.ts:288`)는 `error`/`outputData` 를 조건 없이 각각 독립 호출하여 매 행마다 새 객체를 조립하므로(= `executions.service.ts` 의 `maskIfPresent` AND-copy-on-change 최적화가 없는 단순 매핑), 두 컬럼을 동시에 leaky 하게 만들어도 서로 간섭할 이론적 이유는 없다. 다만 `executions.service.spec.ts` 의 자매 테스트(⑤·⑥-b)는 동일 행에서 `inputData`+`outputData`(+`error`)를 함께 leaky 하게 만들어 "두 마스킹 호출이 서로를 가리지 않는다"를 명시적으로 고정한 반면, 이 파일은 그 조합 케이스가 없어 대칭이 약간 어긋난다.
  - 제안: 위험도가 낮아(로직 자체가 독립 호출) 필수는 아니나, 자매 스위트와의 완전한 대칭을 원하면 `error`+`outputData` 동시 leaky 행 케이스 한 건을 추가하는 것을 권장.

## 강점 (참고용, 조치 불요)

- 신규/변경 로직(WS emit 값-패턴 마스킹 `maskWireEnvelope`/`toFanoutEnvelope`, 읽기 경로 `redactStoredDataForResponse`, `maskIfPresent`, `deepRedactSecretsPreserving`, 마커 보존)이 각 계층(유틸 단위 `sanitize-error-message.spec.ts`/`redact-stored-error.spec.ts` → 서비스 `executions.service.spec.ts`/`background-runs.service.spec.ts` → WS `websocket.service.spec.ts`)에서 빠짐없이 회귀 테스트로 고정돼 있다.
- "자매 표면 중 하나만 관문을 잃어도 초록"이라는 이 저장소의 반복 결함 클래스를 테스트 설계에 명시적으로 반영 — 표면(①~⑧, ⑥-b 등)마다 **독립적으로** 단언하고, 주석에 "이 표면이 왜 따로 필요한지"를 근거와 함께 적었다(`executions.service.spec.ts` `describe('outputData 응답 마스킹...')`).
- 부정 단언(`not.toContain`)만이 아니라 양성 단언(`toContain('***')`)을 짝지어 "필드가 통째로 사라지는" 회귀도 잡도록 했다 — 이전 라운드(`23_50_03` testing W3)의 피드백이 실제로 반영된 흔적.
- 마커 보존(`[REDACTED]`/`[REDACTED_DEPTH]`) 계약을 여러 층(`sanitize-error-message.spec.ts`, `redact-stored-error.spec.ts`, `executions.service.spec.ts` ⑥, `background-runs.service.spec.ts`, `websocket.service.spec.ts`)에서 각각 캐너리로 고정하고, "마커가 아닌 진짜 값은 여전히 마스킹된다"는 반대쪽 단언까지 짝지어 vacuous 테스트("전부 보존"으로도 통과하는 구현)를 배제했다(`sanitize-error-message.spec.ts` `'**마커가 아닌** 진짜 값은...'`).
- copy-on-change 를 값(`toEqual`) 이 아니라 **참조 동일성**(`toBe`)으로 검증하고, `inputData` 만 leaky 한 행이 "복제되지 않아야 한다"는 것까지 확인해 `inputData` 관문 재도입(CRITICAL 회귀)을 그 자리에서 잡는 캐너리로 설계했다(`executions.service.spec.ts` ⑥-b). RESOLUTION.md 는 이 항목을 뮤테이션으로 실제 검증했다고 기록.
- `deepRedactSecretsPreserving` 의 캐시 비공유를 "같은 객체를 두 모드로 호출해도 오염되지 않는다"는 실제 상호작용 시나리오로 검증(`sanitize-error-message.spec.ts` `'캐시를 공유하지 않는다'`) — 캐시 버그 계열의 전형적 함정을 정확히 겨눴다.
- 테스트 격리: `background-runs.service.spec.ts`/`websocket.service.spec.ts` 모두 `beforeEach` 에서 서비스·mock 을 매번 새로 생성해 테스트 간 상태 공유가 없다. WS 테스트는 `firstValueFrom(...).pipe(take(1))` 을 emit 이전에 구독해 두는 기존 공유 헬퍼(`nextFanoutEvent`)를 재사용해 레이스 없이 결정적이다.
- 선존 갭(`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 못 잡는 것)을 fixture 작성 중 실제로 발견해 `Bearer …` 로 교체하고 트래커에 등재한 과정이 RESOLUTION.md/테스트 주석에 투명하게 기록돼 있다 — "생성 입력이 아니라 우연히 통과하는 걸 보고 알았다"는 정직한 커버리지 확장 사례.

## 요약

이번 changeset 은 WS emit 값-패턴 마스킹과 내부 REST `inputData`/`outputData` 읽기 경로 마스킹이라는 보안 민감 변경을, 표면별 독립 단언·양성/부정 단언 짝짓기·참조 동일성 기반 copy-on-change 검증·마커 보존 계약 캐너리·뮤테이션 검증 기록까지 갖춘 매우 촘촘한 테스트 스위트로 뒷받침하고 있다. `maskIfPresent` 의 미도달 방어 분기 하나와 `BackgroundRunsService` 의 동시-leaky 조합 케이스 부재라는 두 개의 사소한 INFO 급 갭 외에는 커버리지·격리·가독성·회귀 안전성 모두에서 결함을 찾지 못했다. CRITICAL/WARNING 급 테스트 결함 없음.

## 위험도
NONE
