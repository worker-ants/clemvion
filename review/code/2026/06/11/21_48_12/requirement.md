# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] [SPEC-DRIFT] LlmService.testConnection 반환 타입에 `dimension` 필드 추가
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L1517, `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` L1817-1823
- 상세: `spec/5-system/7-llm-client.md §3.1` 은 `LLMClient.testConnection(): Promise<boolean>` 으로만 정의하고, `LlmService.testConnection` 의 반환 타입 스키마(`{ success, error?, dimension? }`)를 명시하지 않는다. `spec/2-navigation/6-config.md §B.3` 은 연결 테스트 응답 형식(성공/실패 문자열)을 고수준으로만 기술하며 `dimension` 반환을 언급하지 않는다. 코드에서 `dimension?: number`를 서비스 반환 타입 + DTO에 추가한 것은 의도적인 기능 확장(embedding kind 연결 테스트 시 probe embed 결과로 차원 자동 감지)이며, spec이 침묵하는 영역이다. 버그가 아니라 spec 갱신 누락이다.
- 제안: 코드 유지 + `spec/2-navigation/6-config.md §B.3` 및 `spec/5-system/7-llm-client.md` (LlmService.testConnection 반환 타입 정의 부분)에 `dimension?: number` 반환 및 embedding probe 동작 명세 반영.

### [INFO] [SPEC-DRIFT] LlmService.testConnection이 ModelConfigService.findEntity를 직접 사용 (kind-agnostic 조회)
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L1522-1525, `llm.module.ts`
- 상세: `spec/5-system/7-llm-client.md §5`는 `ModelConfigModule↔LlmModule` 의존 방향을 구체적으로 명시하지 않는다. 기존 `LlmConfigService.findEntity`(kind=chat 고정)에서 `ModelConfigService.findEntity`(kind 무관)로 전환한 것은 embedding/rerank 설정에서 testConnection이 `MODEL_CONFIG_NOT_FOUND`로 거부되던 회귀를 수정한 의도적 버그픽스다. `plan/in-progress/unified-model-management.md §7 W4`에 이 forwardRef 순환이 보류 항목으로 이미 등재되어 있어 의도적 결정임을 알 수 있다.
- 제안: 코드 유지 + `spec/5-system/7-llm-client.md` 또는 `spec/2-navigation/6-config.md §3`에 `LlmService`가 testConnection/listModels 경로에서 kind-agnostic 조회를 위해 `ModelConfigService`를 직접 사용한다는 설계 결정 반영. (`plan/in-progress/unified-model-management.md §7 W4` 백로그와 연동.)

### [INFO] [SPEC-DRIFT] 프론트엔드: embedding 연결 테스트 시 차원 자동 감지 및 퍼시스트 동작
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` L2941-2966, `model-config-form-dialog.tsx` L2650-2651
- 상세: `spec/2-navigation/6-config.md §B.3`은 연결 테스트 결과를 "성공/실패 표시" 수준으로만 기술하며, embedding kind 연결 테스트 시 probe embed 로 차원을 자동 감지하여 `modelConfigsApi.update`로 퍼시스트하고 폼의 `dimension` 필드를 read-only로 전환하는 동작은 spec에 없다. `spec/2-navigation/6-config.md §B.5`는 `dimension`을 사용자 입력 필드로만 기술한다. 이 동작은 버그가 아니라 UX 개선(수동 입력 오류 방지)으로 명백히 의도적이다.
- 제안: 코드 유지 + `spec/2-navigation/6-config.md §B.3` 및 §B.5 에 다음 내용 반영: (a) embedding 연결 테스트 성공 시 probe embed 차원이 응답에 포함되고 자동으로 저장됨, (b) 차원이 저장된 경우 폼 필드가 read-only로 표시됨, (c) 저장 실패 시 토스트 성공 안내는 계속 표시됨.

### [INFO] 프론트엔드 테스트: `updateMock` 호출 확인 누락 케이스 (minor coverage gap)
- 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` L1936-1956 ("still reports success when dimension auto-persist fails")
- 상세: 이 테스트는 `updateMock`가 실패 시 `toast.success`가 호출되고 `toast.error`가 호출되지 않음을 검증한다. 그러나 `updateMock`가 실제로 호출되었는지(`toHaveBeenCalledWith("emb-1", { dimension: 3072 })`)는 검증하지 않는다. 실패 시나리오에서 퍼시스트 시도 자체가 일어났는지 암묵적으로 전제하고 있다. 기능 커버리지 관점에서 minor한 누락이지만 회귀 보호 측면에서 아쉽다.
- 제안: `expect(updateMock).toHaveBeenCalledWith("emb-1", { dimension: 3072 })` 단언을 추가하면 퍼시스트 시도 자체가 누락되는 회귀를 명시적으로 검출할 수 있다.

### [INFO] 백엔드 테스트: 기존 `testConnection` 성공 케이스의 mock 일관성
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` L544-549
- 상세: 기존 "should return success on successful connection" 테스트는 `mockModelConfigService.findEntity`의 기본 mock(`kind: 'chat'`)을 사용하므로 embedding 분기를 타지 않는다. `mockClient.testConnection`이 호출되고 `{ success: true }`가 반환됨을 올바르게 검증하고 있다. chat kind에서는 `dimension` 필드가 반환되지 않아야 하는 계약이 암묵적으로 검증된다. 이 테스트를 명시적으로 `expect(result).not.toHaveProperty('dimension')`으로 보강하면 더 명확하겠으나, 현재 상태로도 회귀 방지 기능은 충분하다.

---

## 요약

이번 변경의 핵심 목적은 두 가지다: (1) embedding 설정(`kind='embedding'`)에서 연결 테스트 호출 시 `LlmConfigService.findEntity`(chat 고정) 대신 `ModelConfigService.findEntity`(kind 무관)로 전환하여 `MODEL_CONFIG_NOT_FOUND` 회귀를 수정하고, (2) embedding probe embed 결과에서 벡터 차원을 자동 감지하여 DTO·프론트엔드 API 타입·UI(read-only 폼 필드 + 자동 퍼시스트)까지 일관되게 전파하는 것이다. 코드 구현은 기능 완전성 관점에서 의도를 충실히 구현하고 있다: 서비스 레이어(`llm.service.ts`)의 embedding 분기, DTO의 `dimension?` 필드, 프론트엔드 API 타입, `model-config-manager.tsx`의 자동 퍼시스트 + 토스트, `model-config-form-dialog.tsx`의 read-only 전환, i18n 문자열 추가가 모두 정합적이다. 엣지 케이스(빈 벡터 배열, embed 실패, 퍼시스트 실패)도 테스트로 명확히 커버된다. spec 관련 발견은 모두 spec 갱신 누락(`[SPEC-DRIFT]`)이며, 코드를 되돌릴 이유가 없다. 프론트엔드 테스트에 한 가지 minor coverage gap(퍼시스트 실패 시나리오의 `updateMock` 호출 단언 누락)이 있으나, 테스트 전체의 품질을 저해하는 수준은 아니다.

## 위험도

LOW
